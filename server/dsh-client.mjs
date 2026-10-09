import {pluginInventory,pluginPagesInventory,adapterRoute,validateBoardAction} from './plugin-adapters.mjs';
import {engramRouteAllowed,engramStatus} from './engram-contract.mjs';
import {backendOrigin,authUrl,runtime,wsModule} from './runtime-config.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {sessionOperationError} from './session-operation-error.mjs';
import {sessionAddressFromRows} from './session-address.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));

export const WebSocket=createRequire(import.meta.url)(wsModule);
const origin=backendOrigin;
let cookie='',authPromise;
async function authenticate(){
  if(cookie)return cookie;
  if(authPromise)return authPromise;
  authPromise=(async()=>{
    const response=await fetch(authUrl,{redirect:'manual',signal:AbortSignal.timeout(10000)});
    cookie=response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
    if(!cookie)throw new Error('无法建立 DSH 本机会话，请重启此验证版。');
    return cookie;
  })().finally(()=>{authPromise=null});
  return authPromise;
}
export async function rpc(endpoint,request){
  const args=request===undefined?{}:endpoint==='session/list'?{_request:request}:{request};
  return rpcArgs(endpoint,args);
}
export function resetAuthentication(){cookie='';authPromise=undefined}
export async function agentToolsRequest(sessionId='',value){
 if(typeof sessionId!=='string'||sessionId.length>200)throw new Error('Invalid session ID');
 const response=await fetch(origin+'/mai-shell/agent-tools?'+new URLSearchParams({sessionId}),{method:value===undefined?'GET':'POST',headers:{origin,cookie:await authenticate(),'content-type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(45000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'模型工具暂不可用');return data;
}
export async function accountUsage(){const response=await fetch(origin+'/mai-shell/usage',{headers:{origin,cookie:await authenticate()},signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('账号累计消费暂不可用');return response.json();}
export async function marketRequest(route,body){
 const reads=['registry','installed','status','api/v1/operations'];
 const writes=['favorite','install','toggle','uninstall','cancel','region'];
 if(!(body===undefined?reads:writes).includes(route))throw new Error('未开放此市场操作');
 const response=await fetch(origin+'/dsh-market/'+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',origin,cookie:await authenticate()},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(body===undefined?90000:900000)});
 if(response.status===401){cookie='';throw new Error('市场连接已失效，请刷新重试。')}
 const result=await response.json();
 if(!response.ok){const error=new Error(result.error||`市场请求失败 (${response.status})`);error.ignoredBuilds=Array.isArray(result.ignoredBuilds)?result.ignoredBuilds.filter(v=>typeof v==='string').slice(0,50):[];throw error;}
 return result;
}
export async function exportSessionLog(sessionId){
 if(typeof sessionId!=='string'||!/^[-\w]{1,120}$/.test(sessionId))throw new Error('会话标识无效');
 const response=await fetch(origin+'/api/session.export?'+new URLSearchParams({sessionId,includeDescendants:'true'}),{headers:{origin,cookie:await authenticate()},signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw new Error('日志导出失败：'+response.status);
 return response;
}
export async function rpcArgs(endpoint,args={},timeout=30000){
  const response=await fetch(origin+'/api/'+endpoint,{method:'POST',headers:{'content-type':'application/json',origin,cookie:await authenticate()},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method:endpoint,payload:{args}}),signal:AbortSignal.timeout(timeout)});
  if(response.status===401){cookie='';throw new Error('DSH 连接已失效，请重试。')}
  const envelope=await response.json();
  if(!envelope.result?.ok)throw new Error(sessionOperationError(envelope.result?.error||envelope.error||{status:response.status}));
  return envelope.result.value;
}
export async function baseline(endpoint,args={}){
  const auth=await authenticate();
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(origin.replace('http:','ws:')+'/api/remote.mux',{headers:{origin,cookie:auth}});
    const finish=(error,value)=>{clearTimeout(timer);ws.removeAllListeners();ws.on('error',()=>{});ws.close();error?reject(error):resolve(value)};
    const timer=setTimeout(()=>finish(new Error('读取状态超时')),15000);
    ws.on('open',()=>ws.send(JSON.stringify({type:'open',streamId:'baseline',endpoint,payload:{args}})));
    ws.on('message',raw=>{try{const m=JSON.parse(String(raw));if(m.type==='item')finish(null,m.value);else if(m.type==='error')finish(new Error(JSON.stringify(m.error)))}catch(e){finish(e)}});
    ws.on('error',e=>finish(e));ws.on('close',()=>finish(new Error('状态连接中断')));
  });
}
export async function follow(sessionId,onFrame,onError){
  const address=sessionAddressFromRows(sessionId,(await rpc('session/list',{})).items);
  const ws=new WebSocket(origin.replace('http:','ws:')+'/api/remote.mux',{headers:{origin,cookie:await authenticate()}});
  ws.on('open',()=>ws.send(JSON.stringify({type:'open',streamId:'follow',endpoint:'session/follow',payload:{args:{request:{address,assistantStream:true,maxMessages:200}}}})));
  ws.on('message',raw=>{try{const m=JSON.parse(String(raw));if(m.type==='item')onFrame(m.value);else if(m.type==='error')onError(new Error(JSON.stringify(m.error)))}catch(e){onError(e)}});
  ws.on('error',onError);
  ws.on('close',()=>onError(new Error('DSH 会话连接已断开')));
  return ()=>{ws.removeAllListeners();ws.on('error',()=>{});ws.close()};
}
export async function officialUrl(){return backendOrigin+'/?mai_native=1'}

// Each observation owns its socket and cancellation lifetime.
export async function observe(endpoint,args,onItem,onError,onEnd=()=>{}){
 const ws=new WebSocket(origin.replace('http:','ws:')+'/api/remote.mux',{headers:{origin,cookie:await authenticate()}});
 let ended=false;
 const stop=()=>{ended=true;ws.removeAllListeners();ws.on('error',()=>{});ws.close()};
 ws.on('open',()=>ws.send(JSON.stringify({type:'open',streamId:'observation',endpoint,payload:{args}})));
 ws.on('message',raw=>{try{const m=JSON.parse(String(raw));if(m.type==='item')onItem(m.value);else if(m.type==='error'){onError(new Error(JSON.stringify(m.error)));stop()}else if(m.type==='end'){onEnd();stop()}}catch(e){onError(e);stop()}});
 ws.on('error',e=>{if(!ended)onError(e)});ws.on('close',()=>{if(!ended){ended=true;onError(new Error('实时连接已中断，请重新连接'))}});
 return stop;
}
export async function nativeResource(route,params,body){
 if(!['changes.summary','changes.diff','present.open','present.host'].includes(route))throw new Error('未开放此资源');
 const r=await fetch(origin+'/api/'+route+'?'+new URLSearchParams(params),{method:body===undefined?'GET':'POST',headers:{origin,cookie:await authenticate(),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const raw=await r.text();let result;try{result=raw?JSON.parse(raw):{ok:true}}catch{result={error:raw}}
 if(!r.ok)throw new Error(result.message||result.error?.message||result.error||'原生资源已不可用');return result;
}

export async function memoryStatus(){const[plugins,bundles]=await Promise.all([rpcArgs('pluginManager/listPlugins'),rpcArgs('pluginManager/listBundles')]);const providers=pluginInventory(plugins,bundles).filter(p=>p.kind==='memory');return {...engramStatus(plugins,bundles),installed:providers.some(p=>p.installed),enabled:providers.some(p=>p.enabled),state:providers.some(p=>p.enabled)?'active':providers.some(p=>p.installed)?'disabled':'absent',providers}}
export async function engramRequest(route,query,method,value){
 if(!engramRouteAllowed(method,route))throw new Error('未开放此记忆库操作');
 if(!(await memoryStatus()).providers.find(p=>p.id==='engram')?.enabled)throw new Error('记忆插件未安装、未启用或尚未就绪');
 return fetch(origin+'/api/engram/'+route+query,{method,redirect:'error',headers:{origin,cookie:await authenticate(),'content-type':'application/json'},body:method==='POST'?JSON.stringify(value):undefined,signal:AbortSignal.timeout(120000)});
}

export async function adapterInventory(){const [p,b]=await Promise.all([rpcArgs('pluginManager/listPlugins'),rpcArgs('pluginManager/listBundles')]);return pluginPagesInventory(p,b)}
export async function adapterRequest(id,route,query,method,value){const target=adapterRoute(id,method,route);if(!target)throw new Error('未开放此插件操作');const a=(await adapterInventory()).items.find(a=>a.id===id);if(!a?.enabled)throw new Error('插件未安装、未启用或尚未就绪');if(id==='tasks'&&method==='POST'){
 validateBoardAction(value);
 if(['delete','move'].includes(value.action.kind)){
  const state=await adapterRequest(id,'state','','GET');const task=state.tasks?.find(t=>t.id===value.action.taskId);
  if(!task||task.archivedAt||!['backlog','todo'].includes(task.status)||task.schedule)throw new Error('仅能整理未归档、未定时的待办草稿；其他任务请使用原生面板');
 }
}const r=await fetch(origin+target+query,{method,redirect:'error',headers:{origin,cookie:await authenticate(),'content-type':'application/json'},body:method==='POST'?JSON.stringify(value):undefined,signal:AbortSignal.timeout(30000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'插件接口不可用');return data}
