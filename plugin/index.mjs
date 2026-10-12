import {childService} from './child-service.mjs';
import {agentTools} from './agent-tools.mjs';
import {sessionDeletion} from './session-deletion.mjs';
import {agentBrowser} from './agent-browser.mjs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {fork} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {projectUsage} from './projection.mjs';

export const name='mai-shell';
export const inject=['webServer','connection','tools','agents','agentPresets'];
const root=path.dirname(fileURLToPath(import.meta.url));
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};

// The plugin owns only its child process and routes. The host owns all user data.
export async function apply(ctx,config={}){
 if(ctx.webServer.host!=='127.0.0.1')throw new Error('Paperflight preview requires a loopback DSH web host.');
 const profileContext=ctx.get('profileContext');
 const home=path.resolve(process.env.DSH_HOME||path.join(os.homedir(),'.dsh'));
 const arg=process.argv.indexOf('--profile');
 const profileName=profileContext?.name||(arg>=0?process.argv[arg+1]:'web');
 if(!/^[\w-]+$/.test(profileName))throw new Error('Unsupported profile name');
 const profileDir=profileContext?.dir||path.join(home,'profiles',profileName);
 const runtime=path.join(home,'mai-shell',profileName);
 await fs.mkdir(runtime,{recursive:true});
 const workspace=path.join(runtime,'workspace');
 await fs.mkdir(workspace,{recursive:true});
 const port=config.port??3182;
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid shell port');
 const origin=`http://127.0.0.1:${ctx.webServer.port}`;
 const require=createRequire(profileContext?.installAnchor||process.argv[1]);
 // Resolve against the host's installation, never a user-specific absolute path.
 const gateway=require.resolve('@deepseek-ai/dsh-api-gateway');
 const hostVersion=require('@deepseek-ai/dsh-api-gateway/package.json').version;
 const wsModule=createRequire(gateway).resolve('ws');
 const {defineTool}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-tools')).href);
 const modelTools=await agentTools({ctx,defineTool,runtime,browser:agentBrowser({blockedOrigins:[origin,`http://127.0.0.1:${port}`]})});
 ctx.provide('paperflightTools',modelTools);
 const deletion=sessionDeletion({ctx,hostVersion,invoke:async sessionId=>{
  const auth=await fetch(ctx.connection.authenticatedUrl(origin+'/'),{redirect:'manual'});
  const cookie=auth.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  if(!cookie)throw new Error('无法建立删除连接。');
  const response=await fetch(origin+'/session-manager/api/delete',{method:'POST',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify({sessionId})});
  const data=await response.json();return response.ok&&data.ok===true?data.result:{ok:false,error:data.error};
 }});
 const launchKey=randomBytes(32).toString('hex');
 const service=childService({
  spawn:()=>fork(path.join(root,'payload/entry.mjs'),[],{cwd:runtime,windowsHide:true,stdio:['ignore','ignore','pipe','ipc']}),
  bootstrap:{type:'bootstrap',origin,authUrl:ctx.connection.authenticatedUrl(origin+'/'),runtime,home,profileDir,workspace,port,launchKey,wsModule,hostVersion,hostStartedAt:new Date(Date.now()-process.uptime()*1000).toISOString()},
  version:'0.1.0-preview.59',
  onLog:text=>fs.writeFile(path.join(runtime,'startup-error.log'),text.replace(/([?&](?:token|ticket)=)[^\s&]+/gi,'$1[redacted]')),
 });
 const disposers=[];
 const cleanup=async()=>{for(const off of disposers.splice(0))off();await Promise.allSettled([modelTools.dispose(),service.stop()]);};
 ctx.effect(()=>cleanup,'mai-shell: child process and HTTP routes');
 const handler=async(req,res)=>{
  const rejection=ctx.connection.requestRejection(req);
  if(rejection){send(res,rejection,{error:'Open the authenticated native DSH page first.'});return}
  if(req.url.split('?')[0]==='/mai-shell/session-deletion'){
   try{
    if(req.method==='GET'){send(res,200,await deletion.status());return}
    if(req.method!=='POST'){send(res,405,{error:'GET or POST required'});return}
    if(req.headers.origin!==origin){send(res,403,{error:'Origin required'});return}
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw new Error('Request too large')}
    const value=JSON.parse(raw);
    if(value.action==='prepare')send(res,200,await deletion.prepare(value.sessionId));
    else if(value.action==='delete')send(res,200,await deletion.remove(value.sessionId,value.token));
    else throw new Error('Unknown deletion action');
   }catch(e){send(res,400,{error:e.message})}return;
  }
  if(req.url.split('?')[0]==='/mai-shell/agent-tools'){
   try{
    const id=new URL(req.url,origin).searchParams.get('sessionId')||'';
    if(id.length>200)throw new Error('Invalid session ID');
    if(req.method==='GET'){send(res,200,modelTools.view(id));return}
    if(req.method!=='POST'){send(res,405,{error:'GET or POST required'});return}
    if(req.headers.origin!==origin){send(res,403,{error:'Origin required'});return}
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>24000)throw new Error('Request too large')}
    const value=JSON.parse(raw);
    if(value.action==='configure')await modelTools.configure(value.settings);
    else if(value.action==='stop'&&['terminal','browser'].includes(value.kind)&&id)await modelTools.stop(value.kind,id);
    else if(value.action==='browser-manual'&&id)await modelTools.manual(id,value.input||{});
    else throw new Error('Unknown tool settings action');
    send(res,200,modelTools.view(id));
   }catch(e){send(res,400,{error:e.message})}return;
  }
  if(req.method!=='GET'){send(res,405,{error:'GET required'});return}
  if(req.url.split('?')[0]==='/mai-shell/usage'){
   try{
    const account=ctx.get('deepseekAccount'),session=await account?.getPlatformSession();
    if(!session){send(res,200,{status:'signed-out'});return}
    if(session.origin!=='https://platform.deepseek.com'){send(res,200,{status:'unsupported-origin'});return}
    const response=await fetch(session.origin+'/api/v0/users/get_user_summary',{headers:{...session.requestHeaders,'x-client-bundle-id':'','x-client-platform':'web','x-client-version':hostVersion,'x-client-locale':'zh_CN','x-client-timezone-offset':String(-new Date().getTimezoneOffset()*60),'x-dsh-auth-token':session.token},redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok){send(res,200,{status:'unavailable',reason:'upstream'});return}
    const envelope=await response.json(),current=await account.getPlatformSession();
    if(current?.token!==session.token){send(res,200,{status:'account-changed'});return}
    send(res,200,envelope.code===0&&envelope.data?.biz_code===0?projectUsage(envelope.data.biz_data):{status:'unavailable',reason:'upstream'});
   }catch{send(res,200,{status:'unavailable',reason:'connection'})}return;
  }
  if(req.url.split('?')[0]==='/mai-shell/status'){send(res,200,service.status);return}
  const status=await service.start();
  if(status.state!=='ready'){send(res,503,status);return}
  res.writeHead(302,{location:status.url+'/__mai_launch?ticket='+launchKey,'cache-control':'no-store','referrer-policy':'no-referrer'});res.end();
 };
 try{
  for(const route of ['/mai-shell','/mai-shell/status','/mai-shell/usage','/mai-shell/agent-tools','/mai-shell/session-deletion'])disposers.push(ctx.webServer.register({kind:'exact',path:route,handler}));
  void service.start();
 }catch(e){await cleanup();throw e}
}








