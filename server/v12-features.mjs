import fs from 'node:fs/promises';
import path from 'node:path';
import {rpc,rpcArgs,observe} from './dsh-client.mjs';
export const identity=x=>{if(typeof x!=='string'||!/^[-\w]{1,120}$/.test(x))throw new Error('标识无效');return x};
export function relativeFile(x='.') {if(typeof x!=='string'||x.length>4096||path.isAbsolute(x)||x.split(/[\\/]/).some(v=>v==='..')||x.includes(':')||x.includes('\0'))throw new Error('仅可访问会话工作区内的相对路径');return x}
export async function scope(b){const session=(await rpc('session/list',{})).items.find(x=>x.sessionId===identity(b.sessionId));if(!session?.cwd)throw new Error('会话没有工作目录');const relative=relativeFile(b.path),root=await fs.realpath(session.cwd),target=await fs.realpath(path.resolve(root,relative)),r=path.relative(root,target);if(r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw new Error('路径超出会话工作区');return{sessionId:b.sessionId,root,target,relative}}
export async function file(b){const s=await scope(b),args={workspaceFileScopeId:s.sessionId,path:s.target};
 if(b.action==='list')return rpcArgs('workspaceFiles/list',args);
 if(b.action==='text'){const offset=Number(b.offset||1);if(!Number.isSafeInteger(offset)||offset<1)throw new Error('行号无效');return rpcArgs('workspaceFiles/read',{...args,range:{offset,limit:150}})}
 if(b.action==='stat')return rpcArgs('workspaceFiles/stat',args);
 if(b.action==='bytes'){
  await rpcArgs('workspaceFiles/stat',args);const h=await fs.open(s.target,'r');try{const st=await h.stat();if(!st.isFile()||st.size>16*1024*1024)throw new Error('媒体预览限 16 MB 内的普通文件');const bytes=await h.readFile();if(bytes.length>16*1024*1024)throw new Error('文件在读取期间变大，请重试');return{base64:bytes.toString('base64'),bytes:bytes.length}}finally{await h.close()}
 }throw new Error('文件操作无效');
}
export async function watchFile(b,emit,fail){const s=await scope(b);return observe('workspaceFiles/changes',{workspaceFileScopeId:s.sessionId,path:s.target},emit,fail)}
export async function openFile(b){const s=await scope(b);if(!['open','reveal'].includes(b.action))throw new Error('打开方式无效');if(b.action==='open'&&/\.(exe|com|bat|cmd|ps1|vbs|js|msi|lnk|url)$/i.test(s.target))throw new Error('可执行文件请使用“所在目录”后手动打开');return rpc('session/openWorkspacePath',{path:s.target,...(b.action==='reveal'?{action:'reveal'}:{})})}
export async function terminals(b){identity(b.sessionId);return{items:await rpcArgs('terminal/list',{sessionId:b.sessionId}),shells:await rpcArgs('terminal/shells',{agentId:b.sessionId})}}
export function terminalArgs(b){const agentId=identity(b.sessionId),args={agentId,id:identity(b.id)};
 if(b.action==='create'){if(typeof b.shellPath!=='string'||!b.shellPath)throw new Error('请选择可用 Shell');return{agentId,request:{id:args.id,cols:80,rows:24,shellPath:b.shellPath}}}
 if(b.action==='rename'){if(typeof b.title!=='string'||!b.title.trim()||b.title.length>80)throw new Error('标题须为 1–80 字符');return{...args,title:b.title.trim()}}
 if(b.action==='close'){if(b.confirm!==true)throw new Error('关闭终端需要确认');return args}
 args.attachmentId=identity(b.attachmentId);
 if(b.action==='write'){if(typeof b.data!=='string'||Buffer.byteLength(b.data)>16384)throw new Error('单次终端输入过长');return{...args,data:b.data}}
 if(b.action==='resize'){if(!Number.isSafeInteger(b.cols)||!Number.isSafeInteger(b.rows)||b.cols<2||b.cols>500||b.rows<2||b.rows>300)throw new Error('终端尺寸无效');return{...args,cols:b.cols,rows:b.rows}}
 throw new Error('终端操作无效');
}
export async function terminal(b){const args=terminalArgs(b);if(b.action==='create'){const shells=await rpcArgs('terminal/shells',{agentId:args.agentId});if(!shells.some(x=>x.path===b.shellPath))throw new Error('Shell 已不可用')};return{value:await rpcArgs('terminal/'+b.action,args)??null}}
export async function terminalFollow(b,emit,fail){return observe('terminal/follow',{agentId:identity(b.sessionId),id:identity(b.id),attachmentId:identity(b.attachmentId)},emit,fail)}
export async function terminalRetain(b,emit,fail){return observe('terminal/retain',{sessionId:identity(b.sessionId),id:identity(b.id)},emit,fail)}
export async function team(b){const p=await rpc('session/projections',{sessionId:identity(b.sessionId)});return{value:p.values?.agentTeam??null}}
export async function speech(){try{return{available:true,...await rpcArgs('speech/catalog')}}catch{return{available:false,providers:[],message:'当前验证后端未启用语音插件，请在插件管理中启用语音输入 Bundle。'}}}
export async function speechAction(b){const c=await speech(),provider=c.providers.find(x=>x.id===b.providerId);if(!provider)throw new Error('语音服务不可用');
 if(b.action==='prepare'){if(b.confirm!==true)throw new Error('下载模型需要确认');if(b.source&&!provider.downloadSources?.includes(b.source))throw new Error('下载源无效');await rpcArgs('speech/prepare',{providerId:b.providerId,options:b.source?{downloadSource:b.source}:{}},120000);return{ok:true}}
 if(b.action==='cancel'){await rpcArgs('speech/cancelPreparation',{providerId:b.providerId});return{ok:true}}
 if(b.action==='transcribe'){if(!provider.languages.includes(b.language)||typeof b.audioBase64!=='string'||! /^[A-Za-z0-9+/]*={0,2}$/.test(b.audioBase64)||Buffer.byteLength(b.audioBase64,'base64')>c.maxAudioBytes)throw new Error('音频或语言无效');return rpcArgs('speech/transcribe',{request:{audioBase64:b.audioBase64,providerId:b.providerId,language:b.language}},120000)}throw new Error('语音操作无效');
}
