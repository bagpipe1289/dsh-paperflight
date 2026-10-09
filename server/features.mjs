import {runtime} from './runtime-config.mjs';
import {rpc,rpcArgs,baseline} from './dsh-client.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createState,reduceEvent} from './session-state.mjs';
import {sessionAddressFromRows} from './session-address.mjs';
import {sessionTitle} from './session-title.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
export const editableSettings={
 'agent-loop':['maxParallelToolCalls'],
 'pwsh-sandbox':['timeoutMs','maxTimeoutMs','maxOutputBytes','maxSpillBytes','graceMs'],
 'subagent':['maxDepth','maxActiveSubagents'],
 'subagent-model-selection-settings':['enabled','allowedModels'],
 'web-search-deepseek':['model','maxTokens','maxUses'],
 'permission':['defaultPreset'],
 'agent-preset-registry':['defaultPreset'],
};
export function validatePatch(ns,patch){
 if(!editableSettings[ns]||!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length)throw new Error('此配置未开放编辑');
 for(const [k,v]of Object.entries(patch)){
  if(!editableSettings[ns].includes(k))throw new Error('此字段未开放编辑：'+k);
  if(['defaultPreset','model'].includes(k)){if(typeof v!=='string'||!v.trim()||v.length>200)throw new Error('请输入有效名称')}
  else if(k==='enabled'){if(typeof v!=='boolean')throw new Error('开关值无效')}
  else if(k==='allowedModels'){if(!Array.isArray(v)||v.length>100||v.some(x=>!x||typeof x.provider!=='string'||typeof x.model!=='string'))throw new Error('模型范围无效')}
  else if(!Number.isSafeInteger(v)||v<0||v>Number.MAX_SAFE_INTEGER)throw new Error('请输入非负整数');
 }
 if(ns==='permission'&&!['read-only','workspace-write','danger-full-access'].includes(patch.defaultPreset))throw new Error('验证版只开放只读或工作区写入；完全访问请在原生界面审阅');
}
export async function settingsView(){const data=await rpcArgs('settings/describe');return {...data,editable:editableSettings}}
export async function saveSettings({ns,patch,revision,confirmFull}){
 if(ns==='permission'&&patch?.defaultPreset==='danger-full-access'&&confirmFull!==true)throw new Error('完全访问需要明确确认');
 validatePatch(ns,patch);if(!Number.isSafeInteger(revision))throw new Error('缺少配置版本，请刷新');
 const data=await settingsView(),before=data.namespaces.find(x=>x.ns===ns);
 if(!before||before.revision!==revision)throw new Error('配置已变化，请刷新后重试');
 const backupDir=path.join(runtime,'settings-backups');await fs.mkdir(backupDir,{recursive:true});
 const backup=ns+'-'+Date.now()+'.json';await fs.writeFile(path.join(backupDir,backup),JSON.stringify({ns,user:before.user,revision},null,2),{flag:'wx'});
 const value=await rpcArgs('settings/update',{ns,patch,expectedRevision:revision});return {value,backup};
}
export async function sessionRows(){
 const [list,frame]=await Promise.all([rpc('session/list',{}),baseline('workspace/follow')]);const w=frame.value;
 return {items:list.items.map(s=>({...s,title:sessionTitle(s),archived:w.archivedSessionIds.includes(s.sessionId),pinned:w.pinnedSessionIds.includes(s.sessionId)})).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt-a.updatedAt),workspaces:w.items};
}
export async function history(sessionId,{beforeSeq,maxMessages=50,throughSeq,address}={}){
 const projection=await rpc('session/projections',{sessionId});if(!projection)throw new Error('会话不存在');
 const cut=throughSeq??projection.asOfSeq;
 const resolved=address??sessionAddressFromRows(sessionId,(await rpc('session/list',{})).items);
 const page=await rpc('session/page',{address:resolved,throughSeq:cut,...(beforeSeq!==undefined?{beforeSeq}:{}),maxMessages});
 const state=createState();state.sessionId=sessionId;for(const r of page.records)reduceEvent(state,r.event);
 return {...page,messages:state.messages,throughSeq:cut,beforeSeq:page.records[0]?.event.seq??null,projections:projection.values};
}
export function summarize(records,hours,now=Date.now()){
 const cutoff=now-hours*3600000,requests=[],buckets=new Map(),models=new Map();let messages=0,replies=0;const steps=new Map();
 for(const {sessionId,event:e}of records){const d=e.data||{},key=sessionId+':'+d.turn+':'+d.step;
  if(e.type==='step/start')steps.set(key,e.time);
  if(e.time<cutoff)continue;
  if(e.type==='user/message'&&(!d.source||d.source?.kind==='user'))messages++;
  if(!['assistant/message','assistant/attempt'].includes(e.type))continue;
  if(e.type==='assistant/message')replies++;
  const u=d.usage;if(!u)continue;
  const input=(u.inputTokens??0)+(u.cacheReadTokens??0)+(u.cacheWriteTokens??0),output=u.outputTokens??0;
  const model=d.message?.source?.model||d.model||'未标注模型';
  const r={timestamp:new Date(e.time).toISOString(),model,request_type:'模型返回',tokens:input+output,input_tokens:input,output_tokens:output,cache_hit_tokens:u.cacheReadTokens??0,cache_miss_tokens:(u.inputTokens??0)+(u.cacheWriteTokens??0),cost:null,time_cost:steps.has(key)?Math.max(0,e.time-steps.get(key))/1000:null,status:e.type==='assistant/attempt'?'未提交':'完成'};requests.push(r);
  const bucket=new Date(Math.floor(e.time/3600000)*3600000).toISOString();if(!buckets.has(bucket))buckets.set(bucket,{timestamp:bucket,requests:0,tokens:0,input_tokens:0,output_tokens:0,cache_hit_tokens:0,cache_miss_tokens:0,cost:null,online_seconds:null});
  if(!models.has(model))models.set(model,{model_name:model,request_count:0,total_tokens:0,input_tokens:0,output_tokens:0,cache_hit_tokens:0,cache_miss_tokens:0,total_cost:null,times:[]});
  const b=buckets.get(bucket),m=models.get(model);b.requests++;m.request_count++;m.total_tokens+=r.tokens;for(const k of ['tokens','input_tokens','output_tokens','cache_hit_tokens','cache_miss_tokens']){b[k]+=r[k];if(k!=='tokens')m[k]+=r[k]}if(r.time_cost!==null)m.times.push(r.time_cost);
 }
 const sum=k=>requests.reduce((n,r)=>n+r[k],0),times=requests.filter(r=>r.time_cost!==null),input=sum('input_tokens'),hit=sum('cache_hit_tokens');
 const summary={total_requests:requests.length,total_cost:null,total_tokens:sum('tokens'),input_tokens:input,output_tokens:sum('output_tokens'),cache_hit_tokens:hit,cache_miss_tokens:sum('cache_miss_tokens'),cache_hit_rate:input?hit/input:null,chat_cache_hit_tokens:hit,chat_cache_miss_tokens:sum('cache_miss_tokens'),chat_cache_hit_rate:input?hit/input:null,online_time:null,total_messages:messages,total_replies:replies,avg_response_time:times.length?times.reduce((n,r)=>n+r.time_cost,0)/times.length:null,cost_per_hour:null,tokens_per_hour:null};
 const hourly_data=[...buckets.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
 const days=new Map();for(const b of hourly_data){const k=b.timestamp.slice(0,10)+'T00:00:00.000Z';if(!days.has(k))days.set(k,{...b,timestamp:k});else for(const field of ['requests','tokens','input_tokens','output_tokens','cache_hit_tokens','cache_miss_tokens'])days.get(k)[field]+=b[field]}
 return {summary,model_stats:[...models.values()].map(({times,...m})=>({...m,avg_response_time:times.length?times.reduce((a,b)=>a+b,0)/times.length:null,cache_hit_rate:m.input_tokens?m.cache_hit_tokens/m.input_tokens:null})),hourly_data,daily_data:[...days.values()],recent_activity:requests.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,100)};
}
let statisticsCache,statisticsPromise;
async function allRecords(){
 if(statisticsCache&&Date.now()-statisticsCache.at<10000)return statisticsCache;
 if(statisticsPromise)return statisticsPromise;
 statisticsPromise=(async()=>{const rows=await sessionRows(),records=[];let truncated=false;
  // Forked histories intentionally remain separate session records, clearly labelled in the UI.
  for(const row of rows.items){const address=sessionAddressFromRows(row.sessionId,rows.items);let beforeSeq,throughSeq;for(let i=0;i<100;i++){const p=await history(row.sessionId,{address,beforeSeq,throughSeq,maxMessages:200});throughSeq=p.throughSeq;records.push(...p.records.map(r=>({sessionId:row.sessionId,event:r.event})));if(!p.hasMore)break;if(p.beforeSeq===beforeSeq||p.beforeSeq===null){truncated=true;break}beforeSeq=p.beforeSeq;if(i===99)truncated=true;}}
  statisticsCache={at:Date.now(),records,truncated,sessionCount:rows.items.length};return statisticsCache;
 })().finally(()=>{statisticsPromise=null});return statisticsPromise;
}
export async function statistics(hours){const result=await allRecords();return {...summarize(result.records,hours),scope:'当前 DSH 空间的会话记录；分叉历史分别计数。模型返回次数含工具步骤；不等于账号账单。',truncated:result.truncated,sessionCount:result.sessionCount,updatedAt:result.at}}
export async function searchMessages(query){
 try{return await rpc('session/search',{query})}catch(e){if(!e.message.includes('session search is disabled'))throw e}
 const data=await allRecords(),matches=new Map(),needle=query.toLocaleLowerCase();
 for(const {sessionId,event:e}of data.records){if(!['user/message','assistant/message'].includes(e.type))continue;if(e.type==='user/message'&&e.data.source?.kind&&e.data.source.kind!=='user')continue;
  const content=e.data.message?.content||e.data.content;if(!Array.isArray(content))continue;const text=content.filter(c=>c.type==='text').map(c=>c.text).join('\n');const index=text.toLocaleLowerCase().indexOf(needle);if(index<0)continue;
  matches.set(sessionId,{sessionId,snippet:[...text.slice(Math.max(0,index-60))].slice(0,240).join('')});
 }
 return {items:[...matches.values()].slice(0,20),hasMore:matches.size>20||data.truncated,source:'history-fallback'};
}
export async function account(){const state=await rpcArgs('account/getState');if(state.status!=='credential-stored')return {state,profile:null,balance:null};const client={version:'0.1.7-rc.2',locale:'zh-CN',timezoneOffsetSeconds:28800};const [profile,balance]=await Promise.allSettled([rpcArgs('account/getProfile',{client}),rpcArgs('account/getBalance',{client})]);return {state,profile:profile.status==='fulfilled'?profile.value:{status:'failed'},balance:balance.status==='fulfilled'?balance.value:{status:'failed'}}}
