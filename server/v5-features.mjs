import {runtime} from './runtime-config.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {rpc,rpcArgs,baseline} from './dsh-client.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const id=x=>{if(typeof x!=='string'||! /^[\w-]{1,120}$/.test(x))throw new Error('标识无效');return x};
export async function workspaces(){return (await baseline('workspace/follow')).value}
export async function workspaceAction(b){
 const before=await workspaces();let method,request;
 if(b.action==='create'){if(typeof b.path!=='string'||!path.isAbsolute(b.path))throw new Error('请输入现有目录的完整路径');method='create';request={path:b.path}}
 else{const workspaceId=id(b.workspaceId);if(!before.items.some(w=>w.workspaceId===workspaceId))throw new Error('工作区已不存在');request={workspaceId};
  if(b.action==='rename'){if(typeof b.title!=='string'||!b.title.trim()||b.title.length>120)throw new Error('名称须为 1–120 字符');method='rename';request.title=b.title.trim()}
  else if(b.action==='remove'){if(b.confirm!==true)throw new Error('请确认移除登记');method='delete'}
  else if(b.action==='move'){method='insertBefore';if(b.beforeWorkspaceId){id(b.beforeWorkspaceId);if(!before.items.some(w=>w.workspaceId===b.beforeWorkspaceId))throw new Error('排序锚点不存在');request.beforeWorkspaceId=b.beforeWorkspaceId}}
  else if(b.action==='session-move'){method='insertSessionBefore';request.sessionId=id(b.sessionId);if(b.beforeSessionId)request.beforeSessionId=id(b.beforeSessionId)}
  else throw new Error('不支持的工作区操作');
 }
 await fs.mkdir(path.join(runtime,'v5-backups'),{recursive:true});await fs.writeFile(path.join(runtime,'v5-backups',`workspaces-${Date.now()}.json`),JSON.stringify(before,null,2));
 return rpc('workspace/'+method,request);
}
export async function resolveWorkspace(workspaceId){const w=(await workspaces()).items.find(w=>w.workspaceId===id(workspaceId));if(!w)throw new Error('请选择有效工作区');return w}
export async function sessionState(sessionId){return rpc('session/projections',{sessionId:id(sessionId)})}
export async function queueAction(b){if(!['remove','steer','edit'].includes(b.action))throw new Error('队列操作无效');const action={kind:b.action};if(b.action==='edit'){const p=await rpc('session/projections',{sessionId:id(b.sessionId)});const item=Object.values(p?.values?.inbox||{}).flat().find(x=>x.id===b.itemId);if(!item)throw new Error('消息已被处理或移除');if(item.content?.some(x=>x.type!=='text'))throw new Error('含附件的排队消息不能按纯文本替换');if(typeof b.text!=='string'||!b.text.trim()||b.text.length>100000)throw new Error('请输入有效文本');action.content=[{type:'text',text:b.text}]};return rpc('session/updateQueue',{sessionId:id(b.sessionId),itemId:id(b.itemId),action})}
export async function catalogs(sessionId){id(sessionId);const results=await Promise.allSettled([rpcArgs('commands/list',{agentId:sessionId}),rpc('skills/list',{sessionId})]);return {commands:results[0].status==='fulfilled'?results[0].value:[],skills:results[1].status==='fulfilled'?results[1].value.skills:[],errors:results.filter(r=>r.status==='rejected').map(r=>r.reason.message)}}
export async function executeCommand(b){id(b.sessionId);if(b.confirm!==true)throw new Error('请审阅命令后确认');if(typeof b.line!=='string'||b.line.length>32000)throw new Error('命令过长');const name=/^\/([a-z][a-z0-9-]*)(?:\s|$)/.exec(b.line)?.[1];if(!['goal','plan','compact','feedback','permission'].includes(name))throw new Error('此命令仍由原生界面处理');if(name==='permission'&&!/^\/permission\s+(read-only|workspace-write)\s*$/.test(b.line))throw new Error('这里只开放只读和工作区写入权限');const result=await rpcArgs('commands/execute',{agentId:b.sessionId,line:b.line,submittedAttachments:[]});if(!result)throw new Error('当前会话没有此命令');return result}
export async function files(b){
 const sessionId=id(b.sessionId),session=(await rpc('session/list',{})).items.find(s=>s.sessionId===sessionId);
 if(!session?.cwd)throw new Error('会话没有可浏览的工作目录');
 const requested=b.path||'.';if(typeof requested!=='string'||requested.length>4096||path.isAbsolute(requested)||requested.split(/[\\/]/).includes('..'))throw new Error('仅可访问会话工作区相对路径');
 const base=await fs.realpath(session.cwd),target=await fs.realpath(path.resolve(base,requested));const relative=path.relative(base,target);if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('路径超出会话工作区');
 const args={workspaceFileScopeId:sessionId,path:b.action==='read'?target:requested};
 if(b.action==='read'){const offset=Number(b.offset||1);if(!Number.isSafeInteger(offset)||offset<1)throw new Error('页码无效');return rpcArgs('workspaceFiles/read',{...args,range:{offset,limit:150}})}
 if(b.action!=='list')throw new Error('仅开放目录与文本读取');return rpcArgs('workspaceFiles/list',args);
}
