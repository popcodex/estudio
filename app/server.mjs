import {exportMarkdown} from './formats.mjs';
import {createServer} from 'node:http';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {openLibrary,writeSettings} from './library.mjs';
import {createBackup,listBackups,restoreBackup,verifyBackup} from './backup.mjs';
import {receiveAttachment,serveAttachment} from './media.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const settingsPath=process.env.ESTUDIO_SETTINGS||join(root,'settings.json');let settings=existsSync(settingsPath)?JSON.parse(readFileSync(settingsPath,'utf8')):{};let library=openLibrary(settings.library||process.env.ESTUDIO_DATA_DIR||join(root,'data'),{create:!settings.library});let data=library.path,store=library.store,busy=false;
let port=Number(process.env.PORT||4317);
let origin=`http://127.0.0.1:${port}`;
const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/content.js':['content.js','text/javascript'],'/tasks.js':['tasks.js','text/javascript'],'/rich.js':['rich.js','text/javascript'],'/properties.js':['properties.js','text/javascript'],'/workspace.js':['workspace.js','text/javascript'],'/automations.js':['automations.js','text/javascript'],'/collections.js':['collections.js','text/javascript'],'/formula.mjs':['../formula.mjs','text/javascript'],'/style.css':['style.css','text/css']};
const server=createServer(async(req,res)=>{
  const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);};
  if(req.headers.host!==`127.0.0.1:${port}`)return send(403,{error:'Dirección no permitida.'});
  try {
    if(req.url.startsWith('/api/')&&!['/api/library','/api/library-switch'].includes(req.url))library.check();
    if(req.method==='POST'&&busy)return send(409,{error:'Hay una operación de biblioteca en curso. Espera a que termine.'});
    if(req.method==='GET'&&req.url==='/api/library'){let available=true;try{library.check();}catch{available=false;}return send(200,{path:data,id:library.id,available,backups:available?await listBackups(data):[]});}
    if(req.method==='POST'&&['/api/backup','/api/verify','/api/restore','/api/library-switch'].includes(req.url)){if(req.headers.origin!==origin)return send(403,{error:'Solicitud no permitida.'});let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)throw Error('Solicitud demasiado grande.');}const payload=body?JSON.parse(body):{};busy=true;try{if(req.url==='/api/backup')return send(200,await createBackup(store,data));if(req.url==='/api/verify'){const v=await verifyBackup(data,payload.id);return send(200,{valid:true,files:v.manifest.files.length});}if(req.url==='/api/restore')return send(200,await restoreBackup(data,payload.id));if(req.url==='/api/library-switch'){const next=openLibrary(payload.path);try{writeSettings(settingsPath,{library:next.path});}catch(e){next.store.close();throw e;}store.close();library=next;store=next.store;data=next.path;return send(200,{path:data});}}finally{busy=false;}}
    if(req.method==='POST'&&req.url==='/api/upload'){if(req.headers.origin!==origin)return send(403,{error:'Solicitud no permitida.'});busy=true;try{return send(200,await receiveAttachment(req,store,data));}finally{busy=false;}}
    if(req.method==='GET'&&req.url.startsWith('/api/files/')){const url=new URL(req.url,origin);return await serveAttachment(req,res,store,data,url.pathname.slice('/api/files/'.length),url.searchParams.has('download'));}
    if(req.method==='GET'&&req.url.startsWith('/api/history?')){const url=new URL(req.url,origin);return send(200,store.history(url.searchParams.get('id'),url.searchParams.has('revision')?Number(url.searchParams.get('revision')):undefined));}
    if(req.method==='GET'&&req.url.startsWith('/api/document-export?')){const url=new URL(req.url,origin),state=store.all(),doc=state.documents.find(d=>d.id===url.searchParams.get('id'));if(!doc)return send(404,{error:'Página no encontrada.'});res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(doc.title+'.md'));return send(200,exportMarkdown(doc,state.attachments),'text/markdown');}
    if(req.method==='GET'&&req.url==='/api/state')return send(200,store.all());
    if(req.method==='GET'&&req.url==='/api/export'){res.setHeader('Content-Disposition','attachment; filename="estudio-respaldo.json"');return send(200,{format:'estudio-v1',exported:new Date().toISOString(),...store.exportData()});}
    if(req.method==='POST'&&req.url==='/api/action'){
      if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return send(403,{error:'Solicitud no permitida.'});
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1100000)return send(413,{error:'Contenido demasiado grande.'});}
      const {kind,data}=JSON.parse(body);return send(200,store.act(kind,data||{}));
    }
    if(req.method==='GET'&&files[req.url]){const [file,type]=files[req.url];return send(200,readFileSync(join(root,'public',file)),type);}
    send(404,{error:'No encontrado.'});
  } catch(e){console.error(e);send(400,{error:e.code==='ERR_SQLITE_ERROR'||e.code?.startsWith('SQLITE')?(/UNIQUE/.test(e.message)?'Ya existe un elemento con ese nombre.':/FOREIGN KEY/.test(e.message)?'El elemento relacionado ya no está disponible.':'No se pudo guardar. Revisa los datos y el almacenamiento.'):e.code==='ENOSPC'?'No hay espacio suficiente en el disco.':e.code==='ENOENT'?'No se encuentra un archivo necesario. Comprueba la biblioteca y el disco.':e.message});}
});
server.listen(port,'127.0.0.1',()=>{port=server.address().port;origin=`http://127.0.0.1:${port}`;console.log(`Estudio disponible en ${origin}`);});
process.on('SIGTERM',()=>server.close(()=>{store.close();process.exit(0);}));
