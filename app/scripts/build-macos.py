#!/usr/bin/env python3
"""Empaqueta código local y un runtime oficial previamente verificado; nunca incluye datos."""
import argparse,pathlib,shutil,plistlib,subprocess,json,os,tempfile
p=argparse.ArgumentParser();p.add_argument('--runtime',required=True);p.add_argument('--binary',required=True);p.add_argument('--dmg',action='store_true');args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];source=root/'app';deliverable=root/'outputs'/'Estudio.app';stage=pathlib.Path(tempfile.mkdtemp(prefix='estudio-build-',dir='/private/tmp'));out=stage/'Estudio.app';contents=out/'Contents';resources=contents/'Resources'
(root/'outputs').mkdir(exist_ok=True)
(root/'work').mkdir(exist_ok=True)
if out.exists():shutil.rmtree(out)
(contents/'MacOS').mkdir(parents=True);(resources/'runtime').mkdir(parents=True);(resources/'app').mkdir()
shutil.copy2(args.binary,contents/'MacOS'/'Estudio')
runtime=pathlib.Path(args.runtime);shutil.copy2(runtime/'bin'/'node',resources/'runtime'/'node');shutil.copy2(runtime/'LICENSE',resources/'runtime'/'LICENSE')
for file in source.glob('*.mjs'):shutil.copy2(file,resources/'app'/file.name)
shutil.copytree(source/'public',resources/'app'/'public')
shutil.copy2(source/'THIRD-PARTY-NOTICES.txt',resources/'THIRD-PARTY-NOTICES.txt')
# A portable release starts with a fresh library in Application Support.
with (contents/'Info.plist').open('wb') as f:plistlib.dump({'CFBundleName':'Estudio','CFBundleDisplayName':'Estudio','CFBundleExecutable':'Estudio','CFBundleIdentifier':'local.estudio.personal','CFBundlePackageType':'APPL','CFBundleShortVersionString':'0.5.0','CFBundleVersion':'5','LSMinimumSystemVersion':'13.5','CFBundleDevelopmentRegion':'es','CFBundleLocalizations':['es'],'NSHighResolutionCapable':True,'NSAppTransportSecurity':{'NSAllowsLocalNetworking':True},'NSHumanReadableCopyright':'Estudio personal. Componentes de terceros bajo sus respectivas licencias.'},f)
for attr in ('com.apple.FinderInfo','com.apple.ResourceFork'):
 subprocess.run(['/usr/bin/xattr','-dr',attr,str(out)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['/usr/bin/codesign','--force','--sign','-',str(resources/'runtime'/'node')],check=True)
subprocess.run(['/usr/bin/codesign','--force','--sign','-',str(out)],check=True)
subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(out)],check=True)
if deliverable.exists():shutil.rmtree(deliverable)
subprocess.run(['/usr/bin/ditto','--norsrc',str(out),str(deliverable)],check=True)
subprocess.run(['/usr/bin/xattr','-d','com.apple.FinderInfo',str(deliverable)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
# The signed staging copy is authoritative: cloud folders may add Finder metadata.
# Build the disk image from staging rather than the copied output app.
(root/'work'/'native-build-path.txt').write_text(str(out))
print(deliverable)
print('Copia de compilación: '+str(out))

if args.dmg:
 os.symlink('/Applications',stage/'Applications')
 subprocess.run(['/usr/bin/hdiutil','create','-size','400m','-fs','HFS+','-volname','Estudio','-srcfolder',str(stage),'-format','UDZO','-ov',str(root/'outputs'/'Estudio-Mac-AppleSilicon.dmg')],check=True)
