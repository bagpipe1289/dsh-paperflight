import {snapshotPublisher} from './snapshot-publisher.mjs';
import {eventStream as sse,writeEvent} from './event-stream.mjs';
import {agentToolsRequest,sessionDeletionRequest} from './dsh-client.mjs';
import {sessionFeedbackRequest} from './plugin-adapters.mjs';
import {legalResponse} from './legal.mjs';
import {adapterInventory,adapterRequest} from './dsh-client.mjs';
import {validateDefaultPreset,defaultPresetPatch} from './engram-contract.mjs';
import {memoryStatus,engramRequest} from './dsh-client.mjs';
import {port as configuredPort,workspace,launchKey,backendOrigin,hostVersion} from './runtime-config.mjs';
import {shellWatchSource} from './shell-watch.mjs';
import {accountAction} from './account-actions.mjs';
import {projectFeatureStatus} from './feature-status.mjs';
import {marketRead,marketAction} from './market-adapter.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes} from 'node:crypto';
import {rpc,rpcArgs,follow,officialUrl,accountUsage} from './dsh-client.mjs';
import {sessionRows,history,statistics,settingsView,saveSettings,account,searchMessages} from './features.mjs';
import {createState,applyFrame,viewState} from './session-state.mjs';
import * as v4 from './v4-features.mjs';
import * as v5 from './v5-features.mjs';
import * as v6 from './v6-features.mjs';
import {exportSessionLog} from './dsh-client.mjs';
import {Readable} from 'node:stream';
import * as v10 from './v10-features.mjs';
import * as v11 from './v11-features.mjs';
import * as v12 from './v12-features.mjs';
import {observe} from './dsh-client.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),dist=path.join(root,'dist');
let port=configuredPort,origin=`http://127.0.0.1:${port}`;
const taskWorkspace=workspace;
const browserKey=randomBytes(24).toString('hex'),cookieName='dsh_mai_plugin_'+configuredPort;
const rooms=new Map(),logClients=new Set();let logs=[];
function log(module,message,level='INFO'){const entry={id:randomUUID(),timestamp:new Date().toISOString(),module,level,message};logs.push(entry);logs=logs.slice(-1000);for(const res of logClients)writeEvent(res,'data: '+JSON.stringify(logs)+'\n\n')}
function json(res,data,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))}

async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>30000000)throw new Error('请求内容过长')}return raw?JSON.parse(raw):{}}
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
function publish(room){room.publisher.schedule()}
async function getRoom(id){
  if(rooms.has(id)){const room=rooms.get(id);await room.ready;return room;}
  if(rooms.size>=40){const stale=[...rooms].find(([,r])=>!r.clients.size&&!r.state.running);if(stale){stale[1].stop?.();stale[1].publisher.stop();rooms.delete(stale[0])}else throw new Error('同时打开的会话过多')}
  const room={state:createState(),clients:new Set(),stop:null};room.publisher=snapshotPublisher(()=>viewState(room.state),room.clients);rooms.set(id,room);
  try{room.ready=(async()=>{room.stop=await follow(id,frame=>{
    applyFrame(room.state,frame);
    if(frame.type==='event'&&['turn/start','turn/end','tool/call','tool/result'].includes(frame.event.type))log(frame.event.type,`${id.slice(-8)} · ${frame.event.data?.name||''}${frame.event.type==='turn/end'?' '+JSON.stringify(frame.event.data?.reason):''}`);
    publish(room);
  },error=>{room.state.connected=false;room.state.error=error.message;log('connection',error.message,'ERROR');room.publisher.flush();room.publisher.stop();room.stop?.();rooms.delete(id);for(const client of room.clients)client.end()});})();await room.ready;}catch(e){room.publisher.stop();rooms.delete(id);throw e}
  return room;
}
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.wasm':'application/wasm','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  // The preview never accepts LAN hosts or cross-site browser calls.
  if(req.headers.host!==`127.0.0.1:${port}`){json(res,{error:'Invalid host'},403);return}
  if(req.headers.origin&&req.headers.origin!==origin){json(res,{error:'Cross-origin requests are not allowed'},403);return}
  if(req.headers['sec-fetch-site']==='cross-site'){json(res,{error:'Cross-site requests are not allowed'},403);return}
  res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');res.setHeader('x-frame-options','DENY');
  // Original fonts/icons are bundled; preview data may only contact this adapter.
  res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://v1.hitokoto.cn "+backendOrigin+"; worker-src 'self' blob:; frame-src http: https: blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
  const url=new URL(req.url,origin),p=url.pathname;
  const loggedIn=req.headers.cookie?.split(';').some(v=>v.trim()===`${cookieName}=${browserKey}`);
  if(p==='/__mai_launch'){
    if(req.method!=='GET'||url.searchParams.get('ticket')!==launchKey){json(res,{error:'Invalid launch ticket'},403);return}
    res.writeHead(302,{location:'/', 'set-cookie':`${cookieName}=${browserKey}; HttpOnly; SameSite=Strict; Path=/`,'cache-control':'no-store'});res.end();return;
  }
  if(p==='/__mai_reconnect'&&req.method==='GET'){res.writeHead(302,{location:backendOrigin+'/mai-shell','cache-control':'no-store'});res.end();return}
  if(!loggedIn){json(res,{error:'请从原生 DSH 设置中的 纸航 Paperflight 入口打开'},401);return}
  if(p==='/host-favicon.svg'&&req.method==='GET'){
    const response=await fetch(backendOrigin+'/favicon.svg',{redirect:'error',signal:AbortSignal.timeout(3000)});
    if(!response.ok){res.writeHead(204);res.end();return}
    const content=Buffer.from(await response.arrayBuffer());
    if(content.length>128000||!response.headers.get('content-type')?.includes('image/svg+xml')){res.writeHead(204);res.end();return}
    res.writeHead(200,{'content-type':'image/svg+xml','cache-control':'no-cache'});res.end(content);return;
  }
  if((p==='/legal'||p.startsWith('/legal/'))&&req.method==='GET'){
    const doc=await legalResponse(p,root);if(!doc){json(res,{error:'Document not found'},404);return}
    res.setHeader('content-type',doc.type);res.setHeader('cache-control','no-store');
    if(doc.download)res.setHeader('content-disposition',`attachment; filename="${doc.download}"`);
    res.end(doc.body);return;
  }
  if(p==='/__mai_health'){json(res,{ready:true});return}
  if(p==='/__mai_watch.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store'});res.end(shellWatchSource(backendOrigin));return}

  if(p.startsWith('/api/')){
    if(!req.headers.cookie?.split(';').some(v=>v.trim()===`${cookieName}=${browserKey}`)){json(res,{error:'请先打开验证版首页'},401);return}
    if(req.method!=='GET'&&req.headers.origin!==origin){json(res,{error:'Origin required'},403);return}
    if(p==='/api/dsh/agent-tools'&&['GET','POST'].includes(req.method)){json(res,await agentToolsRequest(url.searchParams.get('sessionId')||'',req.method==='POST'?await body(req):undefined));return}
    if(p==='/api/dsh/session-deletion'&&['GET','POST'].includes(req.method)){json(res,await sessionDeletionRequest(req.method==='POST'?await body(req):undefined));return}
    if(p==='/api/dsh/plugin-pages'&&req.method==='GET'){json(res,await adapterInventory());return}
    if(p.startsWith('/api/dsh/plugin-page/')){const [,id,route]=p.slice('/api/dsh/plugin-page'.length).split('/');if(p!==`/api/dsh/plugin-page/${id}/${route}`)throw new Error('插件路径无效');json(res,await adapterRequest(id,route,url.search,req.method,req.method==='POST'?await body(req):undefined));return}
    if(p==='/api/dsh/session-feedback'&&req.method==='POST'){const r=await rpcArgs('sessionFeedback/record',{request:sessionFeedbackRequest(await body(req))});if(!r.ok)throw new Error('反馈未保存：'+r.error.code);json(res,r.value);return}
    if(p==='/api/dsh/memory-status'&&req.method==='GET'){json(res,await memoryStatus());return}
    if(p.startsWith('/api/dsh/engram/')){
      const r=await engramRequest(p.slice('/api/dsh/engram/'.length),url.search,req.method,req.method==='POST'?await body(req):undefined);
      res.statusCode=r.status;res.setHeader('cache-control','no-store');
      for(const h of ['content-type','content-disposition'])if(r.headers.get(h))res.setHeader(h,r.headers.get(h));
      if(r.body){const stream=Readable.fromWeb(r.body);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}else res.end();return;
    }
    if(p==='/api/dsh/default-preset'&&req.method==='POST'){
      const b=await body(req),catalog=await rpcArgs('agentPresets/list');validateDefaultPreset(catalog,b.id);
      const settings=await v11.settings(),registry=settings.namespaces.find(n=>n.ns==='agent-preset-registry');json(res,await v11.saveSettings({ns:'agent-preset-registry',revision:b.revision,ops:defaultPresetPatch(registry,b.id)}));return;
    }
    if(p.startsWith('/api/dsh/v12/')){
      const name=p.slice('/api/dsh/v12/'.length),q=Object.fromEntries(url.searchParams);
      const streams={'file-watch':v12.watchFile,'terminal-follow':v12.terminalFollow,'terminal-retain':v12.terminalRetain};
      if(req.method==='GET'&&streams[name]){const stream=sse(res);const emit=value=>stream.send('data: '+JSON.stringify(value)+'\n\n');try{stream.attach(await streams[name](q,emit,e=>{emit({error:e.message});stream.end()}));}catch(e){emit({error:e.message});stream.end()}return;}
      const reads={file:()=>v12.file(q),terminals:()=>v12.terminals(q),team:()=>v12.team(q),speech:v12.speech};
      const writes={'open-file':v12.openFile,terminal:v12.terminal,speech:v12.speechAction};
      if(req.method==='GET'&&reads[name]){json(res,await reads[name]());return}
      if(req.method==='POST'&&writes[name]){json(res,await writes[name](await body(req)));return}
      json(res,{error:'未开放此操作'},404);return;
    }
    if(p.startsWith('/api/dsh/v11/')){
      const name=p.slice('/api/dsh/v11/'.length),q=Object.fromEntries(url.searchParams);
      const reads={bonuses:v11.bonuses,settings:v11.settings,schedules:v11.schedules,'schedule-history':()=>v11.scheduleHistory(q),goal:()=>v11.goal(q),'child-page':()=>v11.childPage(q),groups:v11.groups,cordis:v11.cordis,connection:async()=>{await rpc('session/list',{});return{connected:true}}};
      const writes={'bonus-ack':v11.bonusAck,settings:v11.saveSettings,schedule:v11.scheduleAction,goal:v11.goalAction,groups:v11.saveGroups,'open-settings':v11.openSettings,'cordis-stop':v11.cordisStop};
      if(req.method==='GET'&&reads[name]){json(res,await reads[name]());return}
      if(req.method==='POST'&&writes[name]){json(res,await writes[name](await body(req)));return}
      json(res,{error:'未开放此操作'},404);return;
    }
    if(p.startsWith('/api/dsh/v10/')){
      const name=p.slice('/api/dsh/v10/'.length),q=Object.fromEntries(url.searchParams);
      if(req.method==='GET'&&['interactions','job-follow','child-follow'].includes(name)){
        if(name!=='interactions')v10.id(name==='child-follow'?q.childSessionId:q.sessionId);
        const stream=sse(res),emit=value=>stream.send('data: '+JSON.stringify(value)+'\n\n');
        const fail=e=>{emit({error:e.message,connected:false});stream.end()};
        try{stream.attach(name==='interactions'?await v10.interactions.attach(emit):name==='child-follow'?await v10.childFollow(q,emit,fail):await observe('job/follow',{request:{sessionId:q.sessionId,jobId:v10.id(q.jobId),...(q.from?{from:Number(q.from)}:{})}},emit,fail,()=>{emit({ended:true});stream.end()}));}catch(e){fail(e)}return;
      }
      const reads={directory:()=>v10.directory(q),references:()=>v10.references(q),children:()=>v10.children(q.sessionId),jobs:()=>v10.jobList(q.sessionId),artifacts:()=>v10.artifacts(q),resource:()=>v10.resource(q)};
      const writes={directory:b=>v10.directory(b,true),answer:b=>v10.interactions.answer(b),child:v10.childAction,'job-stop':v10.jobStop,'open-file':b=>v10.resource(b,true),command:v10.command};
      if(req.method==='GET'&&reads[name]){json(res,await reads[name]());return}
      if(req.method==='POST'&&writes[name]){json(res,await writes[name](await body(req)));return}
      json(res,{error:'未开放此操作'},404);return;
    }
    if(p.startsWith('/api/dsh/v9/market/')){
      const name=p.slice('/api/dsh/v9/market/'.length);
      if(req.method==='GET'&&['registry','installed','status'].includes(name)){json(res,await marketRead(name));return}
      if(req.method==='POST'&&name==='action'){json(res,await marketAction(await body(req)));return}
      json(res,{error:'未开放此市场操作'},404);return;
    }
    if(p==='/api/dsh/v6/export'&&req.method==='GET'){
      const sessionId=url.searchParams.get('sessionId');if(!validId(sessionId))throw new Error('会话标识无效');
      const result=await exportSessionLog(sessionId);res.setHeader('content-type','application/zip');res.setHeader('content-disposition',`attachment; filename="dsh-session-${sessionId}.zip"`);res.setHeader('cache-control','no-store');
      const stream=Readable.fromWeb(result.body);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return;
    }
    if(p==='/api/dsh/v6/permissions'&&req.method==='GET'){json(res,await v6.permissionCatalog());return}
    if(p==='/api/dsh/v6/permission'&&req.method==='POST'){json(res,await v6.permission(await body(req)));return}
    if(p==='/api/dsh/v6/upload'&&req.method==='POST'){json(res,await v6.uploadFile(await body(req)));return}
    if(p.startsWith('/api/dsh/v5/')){
      const name=p.slice('/api/dsh/v5/'.length),q=Object.fromEntries(url.searchParams);
      const reads={workspaces:()=>v5.workspaces(),state:()=>v5.sessionState(q.sessionId),catalogs:()=>v5.catalogs(q.sessionId),files:()=>v5.files(q)};
      const writes={workspace:v5.workspaceAction,queue:v5.queueAction,command:v5.executeCommand};
      if(req.method==='GET'&&reads[name]){json(res,await reads[name]());return}
      if(req.method==='POST'&&writes[name]){json(res,await writes[name](await body(req)));return}
      json(res,{error:'未开放此操作'},404);return;
    }
    if(p.startsWith('/api/dsh/v4/')){
      const name=p.slice('/api/dsh/v4/'.length);
      const reads={service:()=>v4.serviceStatus(),instructions:()=>v4.instructionRead(),raw:()=>v4.rawSettings(),providers:()=>v4.providerView(),credential:()=>v4.credentialInfo(url.searchParams.get('ref')),releases:()=>v4.releases(),availability:()=>v4.pluginAvailability(),job:()=>v4.pluginJob(url.searchParams.get('id')),feedback:()=>v4.feedback({sessionId:url.searchParams.get('sessionId')},'list')};
      const writes={restart:()=>v4.restartBackend(),instructions:v4.instructionSave,raw:v4.replaceSettings,credential:v4.credentialWrite,discover:v4.discoverModels,plugin:v4.pluginAction,install:v4.installPlugin,'cancel-install':b=>v4.cancelInstall(b.id),feedback:b=>v4.feedback(b.request,b.action)};
      if(req.method==='GET'&&reads[name]){json(res,await reads[name]());return}
      if(req.method==='POST'&&writes[name]){json(res,await writes[name](await body(req)));return}
      json(res,{error:'未开放此操作'},404);return;
    }
    if(p==='/api/webui/auth/check'){json(res,{authenticated:true,requires_custom_token:false,token_source:'local-preview'});return}
    if(p==='/api/webui/config/bot'&&req.method==='GET'){json(res,{webui:{webui_style:1},experimental:{enable_behavior_learning:false},debug:{enable_reply_effect_tracking:true}});return}
    if(p==='/api/webui/system/status'){
      try{const s=await v4.serviceStatus();await rpc('session/list',{});json(res,{running:s.running,uptime:s.uptime,version:hostVersion,start_time:s.startTime})}catch{json(res,{running:false,uptime:null,version:hostVersion,start_time:null})}return
    }
    if(p==='/api/dsh/v7/subagents'&&req.method==='GET'){
      const sessionId=url.searchParams.get('sessionId');if(!validId(sessionId))throw new Error('会话标识无效');
      const parent=await rpc('session/projections',{sessionId});
      const items=[];
      // Catalog ids and modes are native durable facts, not inferred from titles.
      const children=parent?.values?.subagentCatalog||[];
      for(let i=0;i<children.length;i+=4){items.push(...await Promise.all(children.slice(i,i+4).map(async child=>{
        try{const projection=await rpc('session/projections',{sessionId:child.id});return {...child,modelSource:projection?.values?.modelSelection?.next}}
        catch{return {...child,error:'模型信息暂不可用'}}
      })))}
      json(res,{items});return;
    }
    if(p==='/api/dsh/sessions'&&req.method==='GET'){json(res,await sessionRows());return}
    if(p==='/api/dsh/search'&&req.method==='GET'){const query=url.searchParams.get('q')?.trim();const result=query?await searchMessages(query.slice(0,200)):{items:[],hasMore:false};const rows=(await sessionRows()).items;json(res,{...result,items:result.items.map(item=>({...item,archived:rows.find(r=>r.sessionId===item.sessionId)?.archived??false}))});return}
    if(p==='/api/dsh/statistics'&&req.method==='GET'){const hours=Number(url.searchParams.get('hours')||24);if(![24,168,720].includes(hours))throw new Error('统计周期无效');json(res,await statistics(hours));return}
    if(p==='/api/dsh/account/state'&&req.method==='GET'){json(res,await rpcArgs('account/getState'));return}
    if(p==='/api/dsh/account/usage'&&req.method==='GET'){json(res,await accountUsage());return}
    if(p==='/api/dsh/account/action'&&req.method==='POST'){json(res,await accountAction(await body(req)));return}
    if(p==='/api/dsh/account'&&req.method==='GET'){json(res,await account());return}
    if(p==='/api/dsh/settings'&&req.method==='GET'){json(res,await settingsView());return}
    if(p==='/api/dsh/settings'&&req.method==='POST'){json(res,await saveSettings(await body(req)));return}
    if(p==='/api/dsh/feature-status'&&req.method==='GET'){json(res,projectFeatureStatus(await rpcArgs('pluginManager/listPlugins')));return}
    if(p==='/api/dsh/plugins'&&req.method==='GET'){const [plugins,bundles]=await Promise.all([rpcArgs('pluginManager/listPlugins'),rpcArgs('pluginManager/listBundles')]);json(res,{plugins,bundles});return}
    if(p==='/api/dsh/presets'&&req.method==='GET'){json(res,await rpcArgs('agentPresets/list'));return}
    if(p==='/api/dsh/preset-document'&&req.method==='GET'){json(res,await rpcArgs('agentPresets/read',{agentPreset:url.searchParams.get('id')}));return}
    if(p==='/api/dsh/session-action'&&req.method==='POST'){
      const b=await body(req);if(!validId(b.sessionId))throw new Error('Invalid session ID');
      const methods={rename:'session/rename',fork:'session/fork',archive:'workspace/archiveSession',restore:'workspace/unarchiveSession',pin:'workspace/pinSession',unpin:'workspace/unpinSession',model:'session/selectModel'};
      const endpoint=methods[b.action];if(!endpoint)throw new Error('未知操作');
      const request={sessionId:b.sessionId};
      if(b.action==='rename'){if(typeof b.title!=='string'||!b.title.trim()||b.title.length>200)throw new Error('名称应为 1–200 字符');request.title=b.title.trim()}
      if(b.action==='model'){if(typeof b.provider!=='string'||typeof b.model!=='string')throw new Error('请选择模型');Object.assign(request,{provider:b.provider,model:b.model,...(typeof b.reasoningEffort==='string'?{reasoningEffort:b.reasoningEffort}:{})})}
      json(res,await rpc(endpoint,request));return;
    }
    if(p==='/api/dsh/history'&&req.method==='GET'){
      const sessionId=url.searchParams.get('sessionId');if(!validId(sessionId))throw new Error('Invalid session ID');
      const options={};for(const k of ['beforeSeq','throughSeq'])if(url.searchParams.has(k)){const v=Number(url.searchParams.get(k));if(!Number.isSafeInteger(v)||v<0)throw new Error('历史游标无效');options[k]=v}
      json(res,await history(sessionId,options));return;
    }
    if(p==='/api/dsh/native'&&req.method==='GET'){res.writeHead(302,{location:await officialUrl()});res.end();return}
    if(p==='/api/dsh/models'&&req.method==='GET'){json(res,await rpc('session/modelCatalog'));return}
    if(p==='/api/dsh/image'&&req.method==='GET'){const sessionId=url.searchParams.get('sessionId'),attachmentId=url.searchParams.get('attachmentId');if(!validId(sessionId)||!attachmentId||attachmentId.length>160)throw new Error('图片引用无效');const result=await rpc('session/attachment',{sessionId,attachmentId});res.setHeader('content-type',result.attachment.mediaType);res.setHeader('cache-control','private, max-age=300');res.end(Buffer.from(result.data,'base64'));return}
    if(p==='/api/dsh/sessions'&&req.method==='POST'){const b=await body(req);const catalog=await rpcArgs('agentPresets/list');const agentPreset=b.agentPreset||catalog.presets.find(p=>p.isDefault&&!p.broken)?.id||'standard';if(!catalog.presets.some(x=>x.id===agentPreset&&!x.broken))throw new Error('预设不可用');const workspace=b.workspaceId?await v5.resolveWorkspace(b.workspaceId):null;const created=await rpc('session/create',{...(workspace?{workspaceId:workspace.workspaceId}:{cwd:taskWorkspace}),agentPreset});log('session/create','创建验证会话 '+created.sessionId.slice(-8));json(res,created);return}
    if(p==='/api/dsh/follow'&&req.method==='GET'){const id=url.searchParams.get('sessionId');if(!validId(id))throw new Error('Invalid session ID');const room=await getRoom(id);const stream=sse(res);room.clients.add(res);stream.attach(()=>{room.clients.delete(res);if(!room.clients.size){room.publisher.stop();room.stop?.();if(rooms.get(id)===room)rooms.delete(id)}});stream.send('data: '+JSON.stringify(viewState(room.state))+'\n\n');return}
    if(p==='/api/dsh/prompt'&&req.method==='POST'){
      let dispatched=false;try{
      const b=await body(req);if(!validId(b.sessionId)||typeof b.text!=='string'||(!b.text.trim()&&!b.images?.length&&!b.files?.length))throw new Error('消息不能为空');
      if(b.requestId!==undefined&&(typeof b.requestId!=='string'||!/^[-\w]{1,120}$/.test(b.requestId)))throw new Error('请求标识无效');
      const files=b.files||[];if(!Array.isArray(files)||files.length>4||files.some(f=>typeof f.receiptId!=='string'||!/^[-\w]{1,160}$/.test(f.receiptId)))throw new Error('文件附件标识无效');
      const images=b.images||[];if(!Array.isArray(images)||images.length>4||images.some(i=>!['image/png','image/jpeg','image/webp','image/gif'].includes(i.mediaType)||typeof i.data!=='string'||i.data.length>5600000||!/^[A-Za-z0-9+/]*={0,2}$/.test(i.data)))throw new Error('图片无效或超过单张 4 MB 上限');
      const room=await getRoom(b.sessionId);if(!['queue','steer'].includes(b.mode||'queue'))throw new Error('发送模式无效');
      dispatched=true;
      const result=await rpc('session/prompt',{sessionId:b.sessionId,requestId:b.requestId||randomUUID(),mode:b.mode||'queue',content:[...(b.text.trim()?[{type:'text',text:b.text}]:[]),...images.map(i=>({type:'image',mediaType:i.mediaType,data:i.data,name:typeof i.name==='string'?i.name.slice(0,200):undefined})),...files.map(f=>({type:'file',receiptId:f.receiptId}))],clientTimeZone:b.timeZone||'Asia/Shanghai'});
      json(res,result);return
      }catch(error){json(res,{error:error.message,delivery:!dispatched||error.remoteRejected?'rejected':'unknown'},503);return}
    }
    if(p==='/api/dsh/cancel'&&req.method==='POST'){const b=await body(req);if(!validId(b.sessionId))throw new Error('Invalid session ID');json(res,await rpc('session/cancel',{sessionId:b.sessionId}));return}
    if(p==='/api/dsh/logs'&&req.method==='GET'){const stream=sse(res);logClients.add(res);stream.attach(()=>logClients.delete(res));stream.send('data: '+JSON.stringify(logs)+'\n\n');return}
    json(res,{error:'暂未接入：'+p},501);return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){json(res,{error:'Method not allowed'},405);return}
  const relative=decodeURIComponent(p).replace(/^\/+/,''),file=path.resolve(dist,relative||'index.html');
  if(file!==dist&&!file.startsWith(dist+path.sep)){json(res,{error:'Invalid path'},403);return}
  let served=file;try{if(!(await fs.stat(served)).isFile())served=path.join(dist,'index.html')}catch{if(path.extname(file)){res.writeHead(404);res.end();return}served=path.join(dist,'index.html')}
  if(path.extname(served)==='.html')res.setHeader('set-cookie',`${cookieName}=${browserKey}; HttpOnly; SameSite=Strict; Path=/`);
  res.setHeader('content-type',mime[path.extname(served)]||'application/octet-stream');res.setHeader('cache-control','no-cache');const content=await fs.readFile(served);res.end(path.extname(served)==='.html'?content.toString('utf8').replace('</head>','<script defer src="/__mai_watch.js"></script></head>'):content);
 }catch(error){if(!res.headersSent)json(res,{error:error.message},503);else res.end();}
});
server.listen(port,'127.0.0.1',()=>{port=server.address().port;origin=`http://127.0.0.1:${port}`;process.send?.({type:'ready',port})});
server.on('error',e=>{process.send?.({type:'failed',code:e.code});setTimeout(()=>process.exit(1),50)});
