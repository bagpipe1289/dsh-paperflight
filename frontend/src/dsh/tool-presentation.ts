const object=(x:any)=>x&&typeof x==='object'&&!Array.isArray(x);
export function safeWebURL(value:unknown){try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}}
// Treat replayed metadata as untrusted data. Unknown schemas use the raw result.
export function toolPresentation(tool:any):any{
 const raw=tool.rawResult||{},meta=raw.meta,value=raw.value,args=object(tool.arguments)?tool.arguments:{};
 if(tool.status==='failed')return {kind:'error'};
 if(['pwsh','bash','job_output'].includes(tool.name)){
  const v=object(value)?value:{};
  return {kind:'terminal',command:typeof args.command==='string'?args.command:undefined,cwd:args.workdir,
   stdout:typeof v.stdout?.text==='string'?v.stdout.text:tool.result,stderr:typeof v.stderr?.text==='string'?v.stderr.text:undefined,
   exitCode:Number.isInteger(v.exitCode)?v.exitCode:undefined,timedOut:v.timedOut===true,jobId:typeof v.jobId==='string'?v.jobId:undefined,
   spillPaths:[v.stdout,v.stderr].filter(s=>s?.truncated&&typeof s.spillPath==='string').map(s=>s.spillPath)};
 }
 if(tool.name==='read'&&object(meta)&&typeof meta.path==='string'&&Number.isInteger(meta.offset)&&meta.offset>=1&&Number.isInteger(meta.totalLines)&&meta.totalLines>=0&&Array.isArray(meta.lines)){
  let last=meta.offset-1;
  if(meta.lines.every((l:any)=>{const valid=Number.isInteger(l?.number)&&l.number>last&&l.number<=meta.totalLines&&typeof l.text==='string';last=l?.number;return valid}))return {...meta,kind:'file'};
 }
 if(['write','edit','str_replace_editor'].includes(tool.name)&&Array.isArray(meta?.diffs)&&meta.diffs.length&&meta.diffs.every((d:any)=>typeof d?.path==='string'&&(d.oldText===null||typeof d.oldText==='string')&&typeof d.newText==='string'))return {kind:'diff',diffs:meta.diffs};
 if(tool.name==='web_search'&&Array.isArray(meta?.sources)&&meta.sources.every((s:any)=>object(s)&&typeof s.url==='string'&&(s.title===undefined||typeof s.title==='string')&&(s.snippet===undefined||typeof s.snippet==='string')))return {kind:'web',sources:meta.sources.map((s:any)=>({...s,safeURL:safeWebURL(s.url)})),answer:typeof meta.answer==='string'?meta.answer:undefined,truncated:meta.truncated===true};
 if(tool.name==='web_fetch'&&typeof meta?.url==='string'&&Number.isInteger(meta.statusCode)&&typeof meta.truncated==='boolean')return {kind:'fetch',url:meta.url,safeURL:safeWebURL(meta.url),statusCode:meta.statusCode,truncated:meta.truncated};
 if(object(meta)&&Number.isInteger(meta.total)&&meta.total>=0&&typeof meta.truncated==='boolean'){
  if(tool.name==='glob'&&meta.shape==='paths'&&Array.isArray(meta.paths)&&meta.paths.every((p:any)=>typeof p==='string'))return {...meta,kind:'paths'};
  if(tool.name==='grep'&&meta.shape==='matches'&&Array.isArray(meta.files)&&meta.files.every((f:any)=>typeof f?.path==='string'&&Array.isArray(f.matches)&&f.matches.every((m:any)=>Number.isInteger(m?.lineNumber)&&m.lineNumber>=1&&typeof m.line==='string')))return {...meta,kind:'matches'};
 }
 if(tool.name==='skill')return {kind:'skill',name:args.name||args.skill};
 return {kind:'generic'};
}
