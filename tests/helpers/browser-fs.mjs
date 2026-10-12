import fs from 'node:fs/promises';import path from 'node:path';
// Local test provider only; production uses the session's mounted DSH fs service.
export function localFileContext(root,mode='workspace-write'){
 const host={sandboxMode:mode,resolve:async(file,options={})=>({path:path.resolve(options.cwd||root,file)}),processPath:t=>t.path,processPathFromHostPath:p=>p,contains:(a,b)=>{const rel=path.relative(a.path,b.path);return !rel||!rel.startsWith('..')&&!path.isAbsolute(rel)},stat:async t=>{try{const s=await fs.stat(t.path);return{type:s.isFile()?'file':'directory',size:s.size,version:[s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':')}}catch(e){if(e.code==='ENOENT')return;throw e}},readBytes:async(t,signal,max)=>{signal.throwIfAborted();const b=await fs.readFile(t.path);if(b.length>max)throw new Error('Too large');return b}};
 return {agent:{id:'file-fixture',session:{header:{cwd:root}},ctx:{get:name=>name==='fs'?host:name==='sandboxPolicy'?{resolve:()=>({mode,workspaceRoot:root})}:undefined}},signal:new AbortController().signal};
}
