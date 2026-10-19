import {open,rename,unlink,mkdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
export function detectedMime(bytes){
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()))return 'image/gif';
  if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
  if(bytes.subarray(4,8).toString()==='ftyp')return bytes.subarray(8,12).toString()==='M4A '?'audio/mp4':'video/mp4';
  if(bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return 'video/webm';
  if(bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===255&&(bytes[1]&0xe0)===0xe0))return 'audio/mpeg';
  if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE')return 'audio/wav';
  if(bytes.subarray(0,4).toString()==='OggS')return 'audio/ogg';
  return 'application/octet-stream';
}
export async function receiveAttachment(req,store,data){
  const project=req.headers['x-project-id'];if(typeof project!=='string'||!store.projectExists(project))throw Error('El proyecto no existe.');
  let name;try{name=decodeURIComponent(req.headers['x-file-name']||'archivo');}catch{throw Error('Nombre de archivo no válido.');}name=name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,240)||'archivo';
  const folder=join(data,'archivos');await mkdir(folder,{recursive:true});const id=randomUUID(),temp=join(folder,id+'.part'),final=join(folder,id);const file=await open(temp,'wx',0o600);let closed=false,moved=false,size=0,head=Buffer.alloc(0);const hash=createHash('sha256');
  try{for await(const bytes of req){size+=bytes.length;hash.update(bytes);if(head.length<64)head=Buffer.concat([head,bytes.subarray(0,64-head.length)]);let offset=0;while(offset<bytes.length){const r=await file.write(bytes,offset,bytes.length-offset);offset+=r.bytesWritten;}}if(req.headers['content-length']&&size!==Number(req.headers['content-length']))throw Error('La copia quedó incompleta.');await file.sync();await file.close();closed=true;await rename(temp,final);moved=true;const result={id,project,name,mime:detectedMime(head),size,sha256:hash.digest('hex')};store.addAttachment(result);return result;}catch(e){if(!closed)await file.close().catch(()=>{});await unlink(moved?final:temp).catch(()=>{});throw e;}
}
export async function serveAttachment(req,res,store,data,id,download){
  const a=store.attachment(id);if(!a){res.writeHead(404);res.end();return;}const path=join(data,'archivos',a.id),info=await stat(path);if(info.size!==a.size)throw Error('El archivo está incompleto.');let start=0,end=info.size-1,status=200;
  if(req.headers.range&&info.size){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match||Number(match[1])>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(end<start){res.writeHead(416);res.end();return;}status=206;}
  res.writeHead(status,{'Content-Type':a.mime,'Content-Length':info.size?end-start+1:0,'Accept-Ranges':'bytes',...(status===206?{'Content-Range':`bytes ${start}-${end}/${info.size}`}:{ }),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':`${download||a.mime==='application/octet-stream'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(a.name)}`});if(!info.size)return res.end();createReadStream(path,{start,end}).on('error',()=>res.destroy()).pipe(res);
}
