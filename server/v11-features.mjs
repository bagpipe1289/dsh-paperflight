import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {rpc,rpcArgs} from './dsh-client.mjs';
import {id,childAddress} from './v10-features.mjs';
import {createState,reduceEvent} from './session-state.mjs';
import {runtime} from './runtime-config.mjs';
import {scheduleAvailable} from './plugin-adapters.mjs';
const badKey=k=>['__proto__','prototype','constructor'].includes(k);
export function schemaFields(schema){
 const refs=schema?.refs||{},out=[];
 function visit(uid,p=[],seen=[]){const s=refs[uid];if(!s||seen.includes(uid)||p.length>12)return;if(s.meta?.role==='secret'){if(p.length)out.push({path:p,type:s.type,meta:s.meta,schema:s});return}
  if(s.type==='object'){for(const[k,v]of Object.entries(s.dict||{}))if(!badKey(k))visit(v,[...p,k],[...seen,uid]);return}
  if(s.type==='intersect'){for(const v of s.list||[])visit(v,p,[...seen,uid]);return}
  if(p.length)out.push({path:p,type:s.type,meta:s.meta||{},schema:s});
 }visit(schema?.uid);return out;
}
export function validateOps(item,ops,confirmFull=false){
 if(!Array.isArray(ops)||!ops.length||ops.length>100)throw new Error('请选择要修改的字段');
 const fields=item.fields||schemaFields(item.schema);
 for(const op of ops){if(!['set','unset'].includes(op.op)||!Array.isArray(op.path)||!op.path.length||op.path.some(k=>typeof k!=='string'||badKey(k)))throw new Error('字段路径无效');
  const field=fields.find(f=>JSON.stringify(f.path)===JSON.stringify(op.path));
  if(!field||field.meta.role==='secret'||field.meta.disabled)throw new Error('此字段须使用专用配置入口');
  if(op.op==='set'){
   if(field.type==='boolean'&&typeof op.value!=='boolean'||field.type==='number'&&(!Number.isFinite(op.value)||field.meta.min!==undefined&&op.value<field.meta.min||field.meta.max!==undefined&&op.value>field.meta.max)||field.type==='string'&&typeof op.value!=='string')throw new Error('字段类型或范围不正确');
   if(op.path.at(-1)==='baseURL'&&op.value){let u;try{u=new URL(op.value)}catch{}if(!u||!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('服务地址必须为无账号密码的 HTTP(S) 地址')}
   if(field.meta.role==='credential-ref'&&!/^[A-Z_a-z][\w.-]{0,150}$/.test(op.value))throw new Error('密钥引用名无效');
   if(item.ns==='permission'&&op.path[0]==='defaultPreset'&&op.value==='danger-full-access'&&!confirmFull)throw new Error('完全访问需要明确确认');
  }
 }
 return ops;
}
export async function settings(){const d=await rpcArgs('settings/describe');return {...d,namespaces:d.namespaces.filter(n=>n.autoGenerate||['permission','agent-preset-registry','ui-settings-account','ui-chat','ui-conversation'].includes(n.ns)).map(n=>({...n,fields:schemaFields(n.schema).filter(f=>n.ns!=='ui-settings-account'||['usage','developerTools'].includes(f.path[0]))}))}}
let settingsQueue=Promise.resolve();
export function saveSettings(b){const task=settingsQueue.then(async()=>{const d=await settings(),n=d.namespaces.find(n=>n.ns===b.ns);if(!d.writable||!n||n.revision!==b.revision)throw new Error('配置已变化或不可写，请刷新');validateOps(n,b.ops,b.confirmFull===true);const dir=path.join(runtime,'v11-backups');await fs.mkdir(dir,{recursive:true});const backup='settings-'+Date.now()+'-'+randomUUID()+'.json';await fs.writeFile(path.join(dir,backup),JSON.stringify({ns:n.ns,user:n.user,revision:n.revision},null,2),{flag:'wx'});return {value:await rpcArgs('settings/mutate',{ns:n.ns,ops:b.ops,expectedRevision:b.revision}),backup}});settingsQueue=task.catch(()=>{});return task}
export const openSettings=()=>rpcArgs('settings/openSettingsDocument',{},120000);
const accountClient=()=>({version:'0.1.7-rc.2',locale:'zh-CN',timezoneOffsetSeconds:-new Date().getTimezoneOffset()*60});
export const bonuses=()=>rpcArgs('account/getUnnotifiedBonuses',{client:accountClient()});
export async function bonusAck(b){if(typeof b.accountId!=='string'||typeof b.orderId!=='string')throw new Error('提醒标识无效');const batch=await bonuses();if(batch?.accountId!==b.accountId||!batch.bonuses.some(x=>x.orderId===b.orderId))throw new Error('账号或提醒已变化，请刷新');return{acknowledged:await rpcArgs('account/ackBonusNotified',{accountId:b.accountId,orderId:b.orderId,client:accountClient()})}}
export async function schedules(){if(!scheduleAvailable(await rpcArgs('pluginManager/listPlugins')))return{available:false,items:[],message:'当前 DSH 未启用原生定时任务组件。启用后可在这里管理提醒；任务看板是独立插件。'};return{available:true,items:await rpcArgs('schedule/catalog')}}
export async function scheduleHistory(b){return rpc('schedule/history',{sessionId:id(b.sessionId),id:id(b.id),limit:30,...(b.before?{before:id(b.before)}:{})})}
export function validateSchedule(b){
 id(b.sessionId);id(b.id);if(b.action==='delete'){if(b.confirm!==true)throw new Error('请确认删除任务');return{sessionId:b.sessionId,id:b.id}}
 if(b.action!=='update'||!b.expected||b.expected.id!==b.id)throw new Error('任务版本无效，请刷新');
 if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>120||typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>100000)throw new Error('名称或任务指令无效');
 const request={sessionId:b.sessionId,id:b.id,expected:b.expected,title:b.title.trim(),prompt:b.prompt};
 if(b.change){if(!['at','every','daily','weekly','cron'].includes(b.change.kind))throw new Error('时间规则无效');if(b.change.kind==='every'&&(!Number.isSafeInteger(b.change.every_seconds)||b.change.every_seconds<60))throw new Error('重复间隔至少 60 秒');request.change=b.change}
 return request;
}
export async function scheduleAction(b){const request=validateSchedule(b);const r=await rpc('schedule/'+b.action,request);if(r.updated===false||r.deleted===false||r.code)throw new Error('任务未修改：'+(r.code||JSON.stringify(r)));return r}
export const goal=b=>rpcArgs('goals/get',{agentId:id(b.sessionId)}).then(value=>({value:value??null}));
export function goalArgs(b){const args={agentId:id(b.sessionId)};if(!['create','edit','pause','resume','clear','complete'].includes(b.action))throw new Error('目标操作无效');if(b.action!=='create'){if(!b.ref?.id||!Number.isSafeInteger(b.ref.revision)||b.ref.revision<1)throw new Error('目标版本无效');args.ref={id:id(b.ref.id),revision:b.ref.revision}}
 if(['create','edit'].includes(b.action)){if(typeof b.objective!=='string'||!b.objective.trim()||b.objective.length>32000)throw new Error('请填写目标');args.request={objective:b.objective.trim()};if(b.maxGoalRounds!==undefined){if(!Number.isSafeInteger(b.maxGoalRounds)||b.maxGoalRounds<1)throw new Error('目标轮数须为正整数');args.request.maxGoalRounds=b.maxGoalRounds}}
 if(['create','resume','clear','complete'].includes(b.action)&&b.confirm!==true)throw new Error('请确认目标操作');return args}
export const goalAction=async b=>({ok:true,value:(await rpcArgs('goals/'+b.action,goalArgs(b)))??null});
export async function childPage(b){const address=childAddress(b),p=await rpc('session/projections',{sessionId:b.childSessionId});const throughSeq=b.throughSeq===undefined?p.asOfSeq:Number(b.throughSeq);const beforeSeq=Number(b.beforeSeq);if(!Number.isSafeInteger(beforeSeq)||beforeSeq<0||!Number.isSafeInteger(throughSeq))throw new Error('历史游标无效');const page=await rpc('session/page',{address,throughSeq,beforeSeq,maxMessages:100});const s=createState();s.sessionId=b.childSessionId;for(const r of page.records)reduceEvent(s,r.event);return{...page,messages:s.messages,throughSeq,beforeSeq:page.records[0]?.event.seq??null}}
const groupsPath=path.join(runtime,'session-groups.json');
export async function groups(){try{return JSON.parse(await fs.readFile(groupsPath,'utf8'))}catch(e){if(e.code==='ENOENT')return{revision:0,value:null};throw e}}
let groupQueue=Promise.resolve();
export function saveGroups(b){const task=groupQueue.then(async()=>{const old=await groups();if(old.revision!==b.revision)throw new Error('分组已在其他页面修改，请刷新');const v=b.value;if(!v||!Array.isArray(v.groups)||v.groups.length>100||!v.assignment||typeof v.assignment!=='object'||Array.isArray(v.assignment)||v.groups.some(g=>typeof g.id!=='string'||typeof g.name!=='string'||g.name.length>40)||JSON.stringify(v).length>100000)throw new Error('分组内容无效');const next={revision:old.revision+1,value:v};await fs.mkdir(runtime,{recursive:true});await fs.writeFile(groupsPath+'.tmp',JSON.stringify(next));await fs.rename(groupsPath+'.tmp',groupsPath);return next});groupQueue=task.catch(()=>{});return task}
export const cordis=()=>rpcArgs('dynamicCordisRunner/inventory').then(items=>({items}));
export async function cordisStop(b){if(b.confirm!==true)throw new Error('请确认停止');const list=await cordis();if(!list.items.some(x=>x.agentId===b.agentId&&x.pluginId===b.pluginId))throw new Error('插件已变化，请刷新');return rpcArgs('dynamicCordisRunner/stopFromPanel',{agentId:id(b.agentId),pluginId:b.pluginId})}
