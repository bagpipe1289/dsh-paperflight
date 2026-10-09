import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {agentTools,cmdCommand} from '../plugin/agent-tools.mjs';
import {agentBrowser} from '../plugin/agent-browser.mjs';

async function fixture(t,{outcome='allowed-once',execute,available,platform='win32',browserView,approvalRequest}={}){
 const runtime=await fs.mkdtemp(path.join(os.tmpdir(),'mai-tools-test-')),registered=new Map(),calls=[],approvals=[],cleanup=[],browserCalls=[];
 const tools={register:d=>{assert(!registered.has(d.name));registered.set(d.name,d);return()=>registered.delete(d.name)},get:(name,scope)=>name==='pwsh'&&scope?.id!=='restricted'?{parameters:{properties:{timeoutMs:{},workdir:{}}}}:undefined,execute:async input=>{calls.push(input);return execute?execute(input):{isError:false,content:[{type:'text',text:'CMD_OK'}]}}};
 const ctx={tools,get:name=>name==='approval'?{request:async input=>{approvals.push(input);return approvalRequest?approvalRequest(input):outcome}}:undefined};
 const browser={available:available||async function(){},validate(){},view:browserView||(()=>null),close:async id=>browserCalls.push(['close',id]),execute:async(id,args,signal)=>{browserCalls.push([id,args]);signal.throwIfAborted();return 'PAGE_OK'}};
 const service=await agentTools({ctx,defineTool:x=>x,runtime,browser,platform});
 t.after(async()=>{await service.dispose();await fs.rm(runtime,{recursive:true,force:true})});
 const exec=(name,id='one')=>({name,agent:{id,session:{header:{cwd:runtime}},ctx:{get:n=>n==='tools'?tools:ctx.get(n),effect:fn=>cleanup.push(fn())}},callId:'call-1',rootCallId:'root-1',token:Symbol('execution'),signal:new AbortController().signal,deferContext(){},concludeTurn(){}});
 return{service,registered,calls,approvals,exec,runtime,browserCalls,cleanup};
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
 await assert.rejects(call({command:'echo test',description:'test'},f.exec('mai_cmd','restricted')),/no accessible pwsh/);
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
