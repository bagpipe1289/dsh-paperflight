import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApprovalMemory} from '../server/approval-memory.mjs';
import {agentBrowser} from '../plugin/agent-browser.mjs';

test('remembered approvals match exact session, tool, arguments and reason; revoke clears only that session',()=>{
 const m=new ApprovalMemory(),f={event:'approval/request',agentId:'a',request:{toolName:'mai_browser',reason:'click'},toolArguments:'{"action":"click","name":"Read"}'};
 m.remember(f);assert(m.has(f));
 for(const other of [{...f,agentId:'b'},{...f,request:{...f.request,reason:'different'}},{...f,toolArguments:'{"action":"click","name":"Delete"}'},{...f,contextLoading:true},{...f,contextError:'failed'}])assert(!m.has(other));
 m.remember({...f,agentId:'b'});m.clear('a');assert(!m.has(f));assert(m.has({...f,agentId:'b'}));assert.deepEqual(m.counts(),{b:1});
 assert.throws(()=>m.remember({...f,toolArguments:undefined}));assert(!new ApprovalMemory().has(f));
});

function browserFixture({slow=false,stream=false,settleMs=0}={}){
 let address='about:blank',launches=0,closed=0;const operations=[],pageEvents={};
 const page={setDefaultTimeout(){},on:(event,fn)=>pageEvents[event]=fn,url:()=>address,title:async()=>address,locator:()=>({ariaSnapshot:async()=>'- heading "Shared"'}),screenshot:async()=>Buffer.from('image'),goto:async u=>{address=u;operations.push(['open',u])},goBack:async()=>operations.push(['back']),mouse:{click:async(x,y)=>operations.push(['click',x,y]),wheel:async(x,y)=>operations.push(['wheel',x,y])},keyboard:{insertText:async t=>operations.push(['type',t]),press:async k=>operations.push(['key',k])}};
 if(slow)page.waitForLoadState=async()=>{const e=new Error('still loading');e.name='TimeoutError';throw e};
 const events={},sent=[];const cdp={on:(name,fn)=>events[name]=fn,send:async(name,data)=>{sent.push([name,data])}};
 const context={route:async()=>{},newPage:async()=>page,on(){},...(stream?{newCDPSession:async()=>cdp}:{})};
 const browser=agentBrowser({settleMs,blockedOrigins:['http://127.0.0.1:3182'],load:async()=>({chromium:{launch:async()=>{launches++;return{newContext:async()=>context,on(){},close:async()=>{closed++}}}}})});
 return{browser,operations,page,pageEvents,events,sent,counts:()=>({launches,closed})};
}
test('browser waits for delayed accessible content, reports unchanged reads and supports bounded recovery',async()=>{
 const f=browserFixture({settleMs:1400}),signal=new AbortController().signal;let text='Loading',roleArgs,indexUsed;
 f.page.locator=()=>({ariaSnapshot:async()=>text});f.page.getByRole=(role,args)=>{roleArgs={role,...args};return{ariaSnapshot:async()=>'- heading "Region"',nth:index=>{indexUsed=index;return{click:async()=>{text='Page 2'}}}}};
 const timer=setTimeout(()=>text='Page 1 data',300);f.page.reload=async()=>{text='Reloaded'};
 let result=JSON.parse(await f.browser.execute('one',{action:'open',url:'https://example.com'},signal));clearTimeout(timer);assert.equal(result.page,'Page 1 data');assert.equal(result.readiness,'accessible-content-stable');
 result=JSON.parse(await f.browser.execute('one',{action:'read'},signal));assert.equal(result.changed,false);assert(!('page' in result));assert.deepEqual(result.warnings,[]);
 result=JSON.parse(await f.browser.execute('one',{action:'read',full:true},signal));assert.equal(result.page,'Page 1 data');
 result=JSON.parse(await f.browser.execute('one',{action:'click',role:'link',name:'2',index:1},signal));assert.equal(indexUsed,1);assert.equal(result.changed,true);assert.equal(result.page,'Page 2');
 result=JSON.parse(await f.browser.execute('one',{action:'read',role:'region',name:'Products'},signal));assert.deepEqual(roleArgs,{role:'region',name:'Products',exact:true});assert.equal(result.page,'- heading "Region"');assert.equal(result.comparable,false);
 result=JSON.parse(await f.browser.execute('one',{action:'reload'},signal));assert.equal(result.page,'Reloaded');await f.browser.execute('one',{action:'scroll',delta:600},signal);assert.deepEqual(f.operations.at(-1),['wheel',0,600]);
 for(const args of [{action:'wait',milliseconds:5001},{action:'scroll',delta:801},{action:'read',role:'region'},{action:'click',role:'link',name:'2',index:-1}])assert.throws(()=>f.browser.validate(args));await f.browser.close();
});
test('manual and agent handoff keeps the same page; model cannot read, mutate or close a human-owned page',async()=>{
 const f=browserFixture(),b=f.browser,signal=new AbortController().signal;
 await b.execute('one',{action:'open',url:'https://example.com/a'},signal);
 const before=b.view('one');await b.manual('one',{action:'claim',controller:'manual'});
 for(const action of ['read','close','open'])await assert.rejects(b.execute('one',{action,url:'https://example.com/b'},signal),/user is controlling/);
 await b.manual('one',{action:'click',x:20,y:30,revision:before.revision});
 await assert.rejects(b.manual('one',{action:'type',text:'old',revision:before.revision}),/画面已更新/);
 await b.manual('one',{action:'claim',controller:'agent'});await b.execute('one',{action:'read'},signal);
 assert.equal(b.view('one').url,before.url);assert.deepEqual(f.counts(),{launches:1,closed:0});assert.equal(b.view('two'),null);
 await assert.rejects(b.manual('one',{action:'open',url:'https://example.com/b'}),/我来操作/);
 await b.close();
});

test('overlapping reads wait for the browser action rather than reporting busy; queued ownership is rechecked',async()=>{
 const f=browserFixture(),b=f.browser,signal=new AbortController().signal;
 await b.execute('one',{action:'open',url:'https://example.com'},signal);
 const reads=await Promise.all([b.execute('one',{action:'read'},signal),b.execute('one',{action:'read'},signal)]);assert.equal(reads.length,2);
 const claim=b.manual('one',{action:'claim',controller:'manual'});
 await assert.rejects(b.execute('one',{action:'read'},signal),/user is controlling/);await claim;await b.close();
});

test('slow document loading preserves a usable page and requests commit instead of domcontentloaded',async()=>{
 const f=browserFixture({slow:true});let waitUntil;
 const original=f.page.goto;f.page.goto=async(u,options)=>{waitUntil=options.waitUntil;await original(u)};
 await f.browser.manual('one',{action:'open',url:'https://example.com'});
 assert.equal(waitUntil,'commit');assert.equal(f.browser.view('one').url,'https://example.com/');await f.browser.close();
});

test('live frames update independently without modifying operation revisions or acquiring the action lock',async()=>{
 const f=browserFixture({stream:true}),b=f.browser;
 await b.manual('one',{action:'open',url:'https://example.com'});const before=b.view('one');
 f.events['Page.screencastFrame']({sessionId:1,data:'LIVE_FRAME'});
 const after=b.view('one');assert.equal(after.image,'data:image/jpeg;base64,LIVE_FRAME');assert.equal(after.revision,before.revision);assert.equal(after.busy,false);assert.equal(after.live,true);
 assert(f.sent.some(([name])=>name==='Page.startScreencast'));await b.close();
});
test('human browser input is bounded, requires ownership, blocks control URLs and does not register new tools',async()=>{
 const f=browserFixture(),b=f.browser;
 await assert.rejects(b.manual('one',{action:'open',url:'http://127.0.0.1:3182'}));
 await b.manual('one',{action:'open',url:'https://example.com'});assert.equal(b.view('one').controller,'manual');
 const revision=b.view('one').revision;
 for(const args of [{action:'click',x:1280,y:1},{action:'click',x:-1,y:1},{action:'press',key:'Control+O'},{action:'type',text:'x'.repeat(10001)},{action:'scroll',delta:900},{action:'evaluate'}])await assert.rejects(b.manual('one',{...args,revision}));
 assert.equal(f.operations.length,1);await b.manual('one',{action:'type',text:'human input',revision});assert.deepEqual(f.operations.at(-1),['type','human input']);await b.close();
});

test('browser diagnostics retain bounded failures without query credentials or response bodies',async()=>{
 const f=browserFixture(),signal=new AbortController().signal;await f.browser.execute('one',{action:'open',url:'https://example.com'},signal);
 const req={url:()=> 'https://example.com/api?token=secret',resourceType:()=> 'fetch',failure:()=>({errorText:'net::ERR_FAILED'})};
 f.pageEvents.request(req);for(let i=0;i<12;i++)f.pageEvents.response({status:()=>503,request:()=>req});f.pageEvents.requestfailed(req);f.pageEvents.pageerror(new Error('Application failed token=private-value'));
 const result=JSON.parse(await f.browser.execute('one',{action:'read'},signal));assert.equal(result.pendingRequests,0);assert.equal(result.diagnostics.length,10);assert(!JSON.stringify(result.diagnostics).includes('secret'));assert(!JSON.stringify(result.diagnostics).includes('private-value'));assert(result.diagnostics.some(d=>d.message?.includes('Application failed')));assert(result.diagnostics.some(d=>d.status===503));await f.browser.close();
});

test('long snapshots can be fully read; continuation detects changed content and holds no full cached text',async()=>{
 const f=browserFixture(),signal=new AbortController().signal;let text=Array.from({length:1800},(_,i)=>'- generic [ref=e'+i+']: Row '+i).join('\n');
 f.page.locator=()=>({ariaSnapshot:async()=>text});
 let r=JSON.parse(await f.browser.execute('one',{action:'open',url:'https://example.com'},signal)),combined=r.page;
 assert(r.pagination.hasMore);assert(r.page.length<=14000);assert(f.browser.view('one').text.length<=14000);
 while(r.pagination.hasMore){r=JSON.parse(await f.browser.execute('one',{action:'read',cursor:r.pagination.nextCursor},signal));combined+=r.page}
 assert.equal(combined,text);assert(combined.includes('Row 1799'));
 r=JSON.parse(await f.browser.execute('one',{action:'read'},signal));const old=r.pagination.nextCursor;text+='\nChanged tail';
 await assert.rejects(f.browser.execute('one',{action:'read',cursor:old},signal),/page changed/);await f.browser.close();
});

test('pending background network does not override stable content; scroll movement differs from content changes',async()=>{
 const f=browserFixture({settleMs:900}),signal=new AbortController().signal;let y=0;
 f.page.evaluate=async()=>({x:0,y,width:1280,height:800,containers:[]});f.page.mouse.wheel=async(_,delta)=>{y=Math.min(400,y+delta)};
 await f.browser.execute('one',{action:'open',url:'https://example.com'},signal);
 f.pageEvents.request({resourceType:()=> 'fetch'});
 let r=JSON.parse(await f.browser.execute('one',{action:'scroll',delta:400},signal));assert.equal(r.contentChanged,false);assert.equal(r.changed,true);assert.equal(r.scroll.moved,true);assert.equal(r.pendingRequests,1);assert.equal(r.readiness,'accessible-content-stable');assert.deepEqual(r.warnings,[]);
 r=JSON.parse(await f.browser.execute('one',{action:'scroll',delta:400},signal));assert.equal(r.scroll.moved,false);assert.match(r.warnings[0],/boundary/);await f.browser.close();
});

test('third-party failures stay labeled and cannot evict first-party console details',async()=>{
 const f=browserFixture(),signal=new AbortController().signal;await f.browser.execute('one',{action:'open',url:'https://example.com'},signal);
 f.pageEvents.console({type:()=> 'error',text:()=> 'Renderer failed https://example.com/api?token=hidden',location:()=>({url:'https://example.com/app.js'})});
 for(let i=0;i<50;i++)f.pageEvents.response({status:()=>401,request:()=>({url:()=> 'https://embed.example/api?key=hidden'})});
 const r=JSON.parse(await f.browser.execute('one',{action:'read'},signal));assert.equal(r.diagnostics.length,6);assert.equal(r.diagnostics[0].scope,'first-party');assert.match(r.diagnostics[0].message,/Renderer failed/);assert(r.diagnostics.slice(1).every(d=>d.scope==='third-party'));assert(!JSON.stringify(r.diagnostics).includes('hidden'));await f.browser.close();
});
