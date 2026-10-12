import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {agentTools,cmdCommand,consoleFailureHint} from '../plugin/agent-tools.mjs';
import {agentBrowser} from '../plugin/agent-browser.mjs';
import {localFileContext} from './helpers/browser-fs.mjs';

async function fixture(t,{outcome='allowed-once',execute,available,platform='win32',browserView,approvalRequest,saved,select=true}={}){
 const runtime=await fs.mkdtemp(path.join(os.tmpdir(),'mai-tools-test-')),registered=new Map(),calls=[],approvals=[],cleanup=[],browserCalls=[];
 const agents=new Map(),listeners=new Map(),tables=new Map([['one',registered]]);
 const tools={get:(name,scope)=>name==='pwsh'?(scope?.id!=='restricted'?{parameters:{properties:{timeoutMs:{},workdir:{}}}}:undefined):tables.get(scope?.id)?.get(name),execute:async input=>{calls.push(input);return execute?execute(input):{isError:false,content:[{type:'text',text:'CMD_OK'}]}}};
 const ctx={tools,on:(name,fn)=>{listeners.set(name,fn);return()=>listeners.delete(name)},get:name=>name==='agents'?{list:()=>[...agents.values()],get:id=>agents.get(id)}:name==='agentPresets'?{composedPreset:c=>c.preset,list:async()=>[{id:'standard'},{id:'restricted-preset'}]}:name==='approval'?{request:async input=>{approvals.push(input);return approvalRequest?approvalRequest(input):outcome}}:undefined};
 const agent=(id='one',preset='standard')=>{if(agents.has(id))return agents.get(id);const table=tables.get(id)||new Map();tables.set(id,table);const scoped={...tools,register:d=>{assert(!table.has(d.name));table.set(d.name,d);return()=>table.delete(d.name)}};const a={id,session:{header:{cwd:runtime}},ctx:{preset,get:n=>n==='tools'?scoped:ctx.get(n),effect:fn=>cleanup.push(fn())}};agents.set(id,a);listeners.get('agent/created')?.({agent:a});return a};agent();
 const browser={available:available||async function(){},validate(){},view:browserView||(()=>null),close:async id=>browserCalls.push(['close',id]),execute:async(id,args,signal)=>{browserCalls.push([id,args]);signal.throwIfAborted();return 'PAGE_OK'}};
 if(saved)await fs.writeFile(path.join(runtime,'agent-tools.json'),JSON.stringify(saved));
 const unmounts=new Map();
 const service=await agentTools({ctx,defineTool:x=>x,runtime,browser,platform});
 t.after(async()=>{await service.dispose();await fs.rm(runtime,{recursive:true,force:true})});
 const mount=(id,kind)=>{const off=service.mount(agent(id).ctx,kind);unmounts.set(id+':'+kind,off);return off};
 if(select){mount('one','terminal');mount('one','browser')}
 const exec=(name,id='one')=>({name,agent:agent(id),callId:'call-1',rootCallId:'root-1',token:Symbol('execution'),signal:new AbortController().signal,deferContext(){},concludeTurn(){}});
 return{mount,unmounts,service,registered,calls,approvals,exec,runtime,browserCalls,cleanup,agent,agents,tables,listeners};
}
test('optional tools start absent; independent switches register, persist and unregister real tools',async t=>{
 const f=await fixture(t);assert.deepEqual([...f.registered.keys()],[]);
 await f.service.configure({terminal:true});assert.deepEqual([...f.registered.keys()],['mai_cmd']);
 await f.service.configure({browser:true});assert.equal(f.registered.size,2);
 await f.service.configure({terminal:false});assert.deepEqual([...f.registered.keys()],['mai_browser']);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.runtime,'agent-tools.json'))),{terminal:false,browser:true});
 await assert.rejects(f.service.configure({terminal:'true'}),/Invalid/);await assert.rejects(f.service.configure(null),/Invalid/);
});
test('CMD delegates through the scoped host registry with approval, ancestry and cancellation intact',async t=>{
 const f=await fixture(t);await f.service.configure({terminal:true});const exec=f.exec('mai_cmd');
 assert.equal(await f.registered.get('mai_cmd').execute({command:'echo "a b" & echo it\'s',description:'test'},exec),'CMD_OK');
 assert.equal(f.approvals.length,1);assert.equal(f.calls[0].agent,exec.agent);assert.equal(f.calls[0].parent,exec.token);assert.equal(f.calls[0].rootCallId,'root-1');assert.equal(f.calls[0].name,'pwsh');assert.equal(f.calls[0].arguments.workdir,f.runtime);assert.match(f.calls[0].arguments.command,/it''s/);
 assert.equal(f.service.view('one').records[0].state,'done');assert.equal(f.service.view('other').records.length,0);
});
test('a rejected approval and a preset without pwsh never spawn a CMD command',async t=>{
 const f=await fixture(t,{outcome:'rejected'});await f.service.configure({terminal:true});const call=f.registered.get('mai_cmd').execute;
 await assert.rejects(call({command:'echo test',description:'test'},f.exec('mai_cmd')),/not approved/);
 f.mount('restricted','terminal');await assert.rejects(call({command:'echo test',description:'test'},f.exec('mai_cmd','restricted')),/no accessible pwsh/);
 assert.equal(f.calls.length,0);
});
test('disabling CMD cancels an in-flight host call and removes its registration',async t=>{
 let started;const ready=new Promise(r=>started=r);const f=await fixture(t,{execute:input=>new Promise((resolve,reject)=>{started();input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true})})});
 await f.service.configure({terminal:true});const call=f.registered.get('mai_cmd').execute({command:'echo test',description:'test'},f.exec('mai_cmd'));const rejected=assert.rejects(call,/stopped/);await ready;
 await f.service.configure({terminal:false});await rejected;assert.equal(f.registered.size,0);assert.equal(f.service.view('one').records[0].state,'stopped');
});
test('host denials propagate without a fallback executor',async t=>{
 const f=await fixture(t,{execute:async()=>({isError:true,error:{message:'sandbox denied'}})});await f.service.configure({terminal:true});await assert.rejects(f.registered.get('mai_cmd').execute({command:'echo test',description:'test'},f.exec('mai_cmd')),/sandbox denied/);assert.equal(f.calls.length,1);
});
test('missing browser runtime and non-Windows CMD fail before changing settings',async t=>{
 const f=await fixture(t,{platform:'linux',available:async()=>{throw new Error('missing browser')}});
 await assert.rejects(f.service.configure({terminal:true}),/Windows/);await assert.rejects(f.service.configure({browser:true}),/missing browser/);assert.equal(f.registered.size,0);
});
test('browser mutations require approval but reading an owned page does not',async t=>{
 const f=await fixture(t,{outcome:'rejected'});await f.service.configure({browser:true});const call=f.registered.get('mai_browser').execute;
 await assert.rejects(call({action:'open',url:'https://example.com'},f.exec('mai_browser')),/not approved/);assert.equal(f.browserCalls.length,0);
 assert.equal(await call({action:'read'},f.exec('mai_browser')),'PAGE_OK');assert.equal(f.approvals.length,1);
});
test('reload and scroll retain host approval, bounded wait remains read-only',async t=>{
 const f=await fixture(t,{outcome:'rejected'});await f.service.configure({browser:true});const call=f.registered.get('mai_browser').execute;
 for(const action of ['reload','scroll'])await assert.rejects(call({action,delta:400},f.exec('mai_browser')),/not approved/);
 assert.equal(await call({action:'wait',milliseconds:100},f.exec('mai_browser')),'PAGE_OK');assert.equal(f.approvals.length,2);assert.equal(f.registered.size,1);
});
test('CMD quoting accepts literals and rejects multiline injection and oversized input',()=>{
 assert.match(cmdCommand('echo $foo ` %PATH%'),/echo \$foo ` %PATH%/);assert.throws(()=>cmdCommand('echo a\necho b'));assert.throws(()=>cmdCommand('x'.repeat(16001)));assert.throws(()=>cmdCommand(''));
});
test('browser validates bounded actions and blocks file URLs and the DSH control interface',()=>{
 const browser=agentBrowser({blockedOrigins:['http://127.0.0.1:1234']});for(const url of ['file:///etc/passwd','javascript:alert(1)','http://user:pass@example.com','http://127.0.0.1:1234/settings'])assert.throws(()=>browser.validate({action:'open',url}));
 assert.throws(()=>browser.validate({action:'evaluate'}));assert.throws(()=>browser.validate({action:'fill',role:'textbox',name:'test',value:'x'.repeat(10001)}));assert.throws(()=>browser.validate({action:'press',key:'Control+O'}));browser.validate({action:'open',url:'https://example.com'});
});

test('browser approval expires if the shared page changed while the user was deciding',async t=>{
 let revision=1;const f=await fixture(t,{browserView:()=>({url:'https://example.com',revision,controller:'agent'}),approvalRequest:async()=>{revision++;return 'allowed-once'}});
 await f.service.configure({browser:true});
 await assert.rejects(f.registered.get('mai_browser').execute({action:'click',role:'button',name:'Continue'},f.exec('mai_browser')),/page changed/);
 assert.equal(f.browserCalls.length,0);assert.match(f.approvals[0].reason,/https:\/\/example.com/);
});

test('manually controlled browser is rejected before showing another model approval',async t=>{
 const f=await fixture(t,{browserView:()=>({controller:'manual'})});await f.service.configure({browser:true});
 await assert.rejects(f.registered.get('mai_browser').execute({action:'open',url:'https://example.com'},f.exec('mai_browser')),/user is controlling/);
 assert.equal(f.approvals.length,0);assert.equal(f.browserCalls.length,0);
});

test('upload approval names the file and site; rejection happens before any file content read',async t=>{
 const f=await fixture(t,{outcome:'rejected',browserView:()=>({revision:1,url:'https://example.com/upload',controller:'agent'})});
 await fs.writeFile(path.join(f.runtime,'upload.txt'),'fixture only');await f.service.configure({browser:true});
 const exec=f.exec('mai_browser'),context=localFileContext(f.runtime),original=exec.agent.ctx.get;
 let reads=0;const host=context.agent.ctx.get('fs'),readBytes=host.readBytes;host.readBytes=async(...args)=>{reads++;return readBytes(...args)};
 exec.agent.ctx.get=name=>context.agent.ctx.get(name)||original(name);
 await assert.rejects(f.registered.get('mai_browser').execute({action:'upload',path:'upload.txt'},exec),/not approved/);
 assert.equal(reads,0);assert.equal(f.browserCalls.length,0);assert.match(f.approvals[0].reason,/upload.txt/);assert.match(f.approvals[0].reason,/example.com\/upload/);assert.match(f.approvals[0].reason,/browser-transfer/);
});

test('native declarations control scoped schemas independently without a preset allowlist',async t=>{
 const f=await fixture(t);f.agent('two','restricted-preset');await f.service.configure({terminal:true,browser:true});
 assert.equal(f.tables.get('one').size,2);assert.equal(f.tables.get('two').size,0);
 f.mount('two','browser');assert.deepEqual([...f.tables.get('two').keys()],['mai_browser']);
 await f.unmounts.get('one:browser')();assert.equal(f.tables.get('one').has('mai_browser'),false);assert.equal(f.tables.get('two').has('mai_browser'),true);
 assert.equal(f.service.view('missing').effective.browser,false);
});
test('native unmount blocks retained tool references and manual handoff',async t=>{
 const f=await fixture(t);await f.service.configure({browser:true});const call=f.registered.get('mai_browser').execute;await f.unmounts.get('one:browser')();
 await assert.rejects(call({action:'read'},f.exec('mai_browser')),/preset has not enabled/);
 await assert.rejects(f.service.manual('one',{action:'claim',controller:'agent'}),/未启用/);
 assert.equal(f.approvals.length,0);
});

test('console-buffer hint preserves evidence without confusing network or sandbox denial',()=>{
 const original='Win32 internal error "Access is denied" 0x5 occurred while reading the console output buffer.';
 assert(consoleFailureHint(original).startsWith(original));assert.match(consoleFailureHint(original),/inside that child script/);
 assert.equal(consoleFailureHint('sandbox denied'),'sandbox denied');assert.equal(consoleFailureHint('DNS lookup failed'),'DNS lookup failed');
});

test('legacy preset allowlists cannot grant tools without a native declaration',async t=>{
 const f=await fixture(t,{saved:{terminal:true,browser:true,presets:{standard:{terminal:true,browser:true}}},select:false});
 assert.equal(f.service.view().browser,true);assert.equal(f.registered.size,0);
 f.mount('one','browser');assert.deepEqual([...f.registered.keys()],['mai_browser']);
});
