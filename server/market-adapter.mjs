import {marketRequest} from './dsh-client.mjs';
import {findCatalogEntryForLocal} from './vendor/dshmarket/lib/catalog-local-match.js';
export function validateMarketAction(body){
 if(!body||typeof body!=='object')throw new Error('市场操作无效');
 const {action}=body;
 if(!['favorite','install','toggle','uninstall','cancel','region'].includes(action))throw new Error('未开放此市场操作');
 if(action==='region'&&!['global','china'].includes(body.region))throw new Error('下载区域无效');
 if(['favorite','install'].includes(action)){
  if(typeof body.url!=='string'||body.url.length>2000)throw new Error('插件地址无效');
  const u=new URL(body.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('插件地址无效');
 }
 if(['toggle','uninstall'].includes(action)){
  if(typeof body.name!=='string'||!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(body.name)||['dshmarket','dsh-market'].includes(body.name))throw new Error('插件名称无效或受到保护');
 }
 if(action==='favorite'&&typeof body.favorited!=='boolean')throw new Error('收藏状态无效');
 if(action==='toggle'&&typeof body.enabled!=='boolean')throw new Error('启用状态无效');
 if(action!=='favorite'&&body.confirm!==true)throw new Error('请先确认此操作');
 return action;
}
export function createMarketAdapter(request=marketRequest){
let catalog, pending, loadedAt=0, operation=null;
async function marketRead(name){
 if(name==='registry'){
  if(catalog&&Date.now()-loadedAt<60000)return catalog;
  if(!pending)pending=request('registry').then(r=>{catalog=r;loadedAt=Date.now();return r}).finally(()=>{pending=null});
  return pending;
 }
 if(name==='installed'){
  const data=await request('installed');
  return {...data,catalogMatches:Object.fromEntries(Object.keys(data.installed||{}).map(name=>[name,findCatalogEntryForLocal(catalog?.registry?.plugins||[],name,data.repoIdentities?.[name]||[],data.repoHints?.[name]||[])?.url||null]))};
 }
 if(name==='status'){
  const s=await request('status');
  return {version:s.version,region:s.region,channel:s.channel,active:s.active,busy:s.busy,phase:s.phase,target:s.target,seconds:s.seconds,done:s.done,total:s.total,currentPackage:s.currentPackage,downloaded:s.downloaded,size:s.size,lastLine:s.lastLine,error:s.error,cancelling:s.cancelling,runningAgents:s.runningAgents,operation};
 }
 throw new Error('未开放此市场查询');
}
async function marketAction(body){
 const action=validateMarketAction(body);
 if(action==='region'){
  const s=await request('status');if(s.busy||s.active||operation?.state==='running')throw new Error('请等待市场任务结束后切换线路');
  if(pending)await pending.catch(()=>{});
  const result=await request('region',{region:body.region});catalog=undefined;loadedAt=0;return result;
 }
 if(action==='favorite'){
  const known=body.favorited?(await marketRead('registry')).registry.plugins.some(p=>p.url===body.url):(await marketRead('installed')).favorites.includes(body.url);
  if(!known)throw new Error('此插件不在当前市场目录或收藏中，请刷新后重试');
  return request('favorite',{url:body.url,favorited:body.favorited});
 }
 if(action==='cancel')return request('cancel',{});
 if(operation?.state==='running')throw new Error('已有市场任务正在运行');
 if(action==='install'&&!(await marketRead('registry')).registry.plugins.some(p=>p.url===body.url))throw new Error('插件不在当前市场目录');
 if(action==='toggle'||action==='uninstall'){
  const local=await marketRead('installed');if(!Object.hasOwn(local.installed,body.name))throw new Error('此插件未安装');
 }
 const payload=action==='install'?{url:body.url}:action==='toggle'?{name:body.name,enabled:body.enabled}:{name:body.name};
 if(operation?.state==='running')throw new Error('已有市场任务正在运行');
 const job={id:crypto.randomUUID(),action,target:body.name||body.url,state:'running',startedAt:Date.now()};operation=job;
 void request(action,payload).then(result=>{job.state=result.ok===false||result.cancelled||result.ignoredBuilds?.length?'attention':'finished';job.result=result}).catch(e=>{job.state='failed';job.error=e.message;job.ignoredBuilds=e.ignoredBuilds||[]}).finally(()=>{job.finishedAt=Date.now()});
 return job;
}

return {marketRead,marketAction};
}
export const {marketRead,marketAction}=createMarketAdapter();
