import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
export const uploadLimit=20*1024*1024,downloadLimit=50*1024*1024;
const inside=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)};
// Reject junctions/symlinks at every component, including the workspace itself.
async function localPath(root,file,{absent=false}={}){
 if(!path.isAbsolute(root)||!inside(root,file))throw new Error('Browser files must be inside the current session workspace.');
 const parsed=path.parse(file);let current=parsed.root;
 for(const part of file.slice(parsed.root.length).split(path.sep)){
  if(part.includes(':'))throw new Error('Alternate file streams are not supported.');
  current=path.join(current,part);
  try{if((await fs.lstat(current)).isSymbolicLink())throw new Error('Browser files cannot use symlinks or junctions.')}catch(e){if(absent&&e.code==='ENOENT')continue;throw e}
 }
 const realRoot=await fs.realpath(root);if(realRoot.toLowerCase()!==path.resolve(root).toLowerCase())throw new Error('Workspace path is not canonical.');
 return file;
}
export async function prepareBrowserTransfer(args,exec){
 const host=exec.agent.ctx.get('fs'),resolver=exec.agent.ctx.get('sandboxPolicy'),cwd=exec.agent.session.header.cwd;
 if(!cwd||!host?.resolve||!host?.contains)throw new Error('Browser transfer requires the current session filesystem and workspace.');
 const policy=resolver?.resolve({session:exec.agent.session});
 if(host.sandboxMode!==undefined&&!policy)throw new Error('Filesystem sandbox policy unavailable.');
 const workspace=await host.resolve(cwd,{signal:exec.signal}),root=host.processPath(workspace);
 if(host.processPathFromHostPath?.(root)!==root)throw new Error('Browser transfer currently requires a local, host-mapped workspace.');
 const signal=exec.signal;
 if(args.action==='upload'){
  if(typeof args.path!=='string'||!args.path.trim()||args.path.length>2000||/[\0\r\n]/.test(args.path))throw new Error('Upload requires a workspace file path.');
  const lexical=path.resolve(root,args.path);await localPath(root,lexical);
  const target=await host.resolve(args.path,{cwd,signal});if(!host.contains(workspace,target))throw new Error('Upload file is outside the workspace.');
  const file=host.processPath(target);await localPath(root,file);
  const info=await host.stat(target,signal);if(info?.type!=='file'||!Number.isFinite(info.size)||info.size>uploadLimit)throw new Error('Upload must be one regular file up to 20 MiB.');
  const local=await fs.stat(file);if(local.nlink>1)throw new Error('Hard-linked files are not supported for browser upload.');
  return {summary:{action:'upload',path:file,bytes:info.size},async upload(){
   await localPath(root,file);if((await fs.stat(file)).nlink>1)throw new Error('Hard-linked files are not supported for browser upload.');const now=await host.stat(target,signal);if(now?.version!==info.version)throw new Error('File changed after approval; request upload again.');
   const data=await host.readBytes(target,signal,uploadLimit);signal.throwIfAborted();
   if((await host.stat(target,signal))?.version!==info.version)throw new Error('File changed during upload preparation.');
   return{name:path.basename(file),mimeType:({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.pdf':'application/pdf','.zip':'application/zip','.txt':'text/plain','.csv':'text/csv','.json':'application/json','.md':'text/markdown'}[path.extname(file).toLowerCase()]||'application/octet-stream'),buffer:Buffer.from(data)};
  }};
 }
 if(!policy||!['workspace-write','danger-full-access'].includes(policy.mode))throw new Error('Downloads require a writable session workspace; read-only mode cannot save files.');
 if(policy.workspaceRoot){const allowed=await host.resolve(policy.workspaceRoot,{signal});if(!host.contains(allowed,workspace))throw new Error('Session workspace is outside sandbox write policy.');}
 const folder=path.join(root,'browser-downloads');await localPath(root,folder,{absent:true});
 return {summary:{action:'download',directory:folder,maxBytes:downloadLimit},async save(download){
  signal.throwIfAborted();await localPath(root,folder,{absent:true});await fs.mkdir(folder,{recursive:false}).catch(e=>{if(e.code!=='EEXIST')throw e});await localPath(root,folder);
  const suggested=download.suggestedFilename(),safe=suggested.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,120)||'download.bin';
  const destination=path.join(folder,randomUUID()+'-'+safe);await localPath(root,destination,{absent:true});
  const target=await host.resolve(destination,{cwd,signal});if(!host.contains(workspace,target))throw new Error('Download target escaped workspace.');
  const handle=await fs.open(destination,'wx'),hash=createHash('sha256');let bytes=0,success=false;
  try{
   await localPath(root,destination);
   const stream=await download.createReadStream();if(!stream)throw new Error('Download has no readable file.');
   for await(const chunk of stream){signal.throwIfAborted();bytes+=chunk.length;if(bytes>downloadLimit){stream.destroy();throw new Error('Download exceeds 50 MiB.')}hash.update(chunk);let offset=0;while(offset<chunk.length){const written=await handle.write(chunk,offset,chunk.length-offset);offset+=written.bytesWritten}}
   await handle.sync();signal.throwIfAborted();success=true;
   return {path:destination,relativePath:path.relative(root,destination).replaceAll('\\','/'),bytes,sha256:hash.digest('hex'),filename:safe,notice:'Saved only; not opened or executed. Treat downloaded content as untrusted.'};
  }finally{await handle.close();if(!success){await localPath(root,destination);await fs.unlink(destination).catch(()=>{})}}
 }};
}

export async function finishDownload(download,directory,signal){
 let timer,poller,stop;const stopped=new Promise((_,reject)=>stop=reject);
 const fail=message=>{void download.cancel().catch(()=>{});stop(new Error(message))};
 const abort=()=>fail('Download cancelled.');signal.addEventListener('abort',abort,{once:true});
 let checking=false;
 try{
  signal.throwIfAborted();timer=setTimeout(()=>fail('Download exceeded 60 seconds; retry a smaller file.'),60000);
  poller=setInterval(async()=>{if(checking)return;checking=true;try{let size=0;for(const name of await fs.readdir(directory)){const stat=await fs.stat(path.join(directory,name)).catch(()=>null);if(stat?.isFile())size+=stat.size}if(size>downloadLimit)fail('Download exceeds 50 MiB.')}catch(e){fail(e.message)}finally{checking=false}},100);
  const file=await Promise.race([download.path(),stopped]);if(!file)throw new Error('Download did not produce a file.');
  if((await fs.stat(file)).size>downloadLimit)throw new Error('Download exceeds 50 MiB.');
 }finally{clearTimeout(timer);clearInterval(poller);signal.removeEventListener('abort',abort)}
}
