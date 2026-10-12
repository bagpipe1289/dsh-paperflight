import {playwrightAdapter} from './browser-mcp.mjs';
import {pageSlice,fingerprint,snapshotBody,diagnosticText,viewport,readingText} from './browser-reading.mjs';
import {finishDownload} from './browser-files.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const actions=new Set(['open','read','click','fill','press','back','close','reload','wait','scroll','tabs','select','screenshot','upload','download']);
async function cleanDownloads(directory){if(!directory)return;try{const actual=await fs.realpath(directory),base=await fs.realpath(os.tmpdir());if(path.dirname(actual)!==base||!path.basename(actual).startsWith('paperflight-download-'))throw new Error('Unexpected browser temporary path');await fs.rm(actual,{recursive:true,force:true})}catch(e){if(e.code!=='ENOENT')throw e}}
const keys=new Set(['Enter','Escape','Tab','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','PageDown','PageUp']);
export function agentBrowser({load,mcpFactory=load?null:playwrightAdapter,blockedOrigins=[],settleMs=4000}={}){
 load??=()=>import('playwright-core');
 const sessions=new Map(),queues=new Map(),epochs=new Map();let library;
 function queued(id,signal,work){
  const previous=queues.get(id),epoch=epochs.get(id)||0;
  if((previous?.count||0)>=8)return Promise.reject(new Error('浏览器操作排队过多，请稍后再试。'));
  const item={count:(previous?.count||0)+1};
  item.promise=(previous?.promise||Promise.resolve()).catch(()=>{}).then(()=>{signal.throwIfAborted();if((epochs.get(id)||0)!==epoch)throw new Error('浏览器已关闭，已取消排队操作。');return work()}).finally(()=>{if(queues.get(id)===item)queues.delete(id)});
  queues.set(id,item);return item.promise;
 }
 const ports=new Set(blockedOrigins.map(v=>new URL(v).port));
 const url=value=>{const u=new URL(value),loopback=/^(localhost\.?|127\.[\d.]+|0\.0\.0\.0|\[::1\])$/i.test(u.hostname);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||blockedOrigins.includes(u.origin)||(loopback&&ports.has(u.port)))throw new Error('Only HTTP(S) web pages outside the DSH control interface are allowed.');return u.href};
 function validate(args){
  if(args.action==='upload'&&(typeof args.path!=='string'||!args.path.trim()||args.path.length>2000))throw new Error('Upload requires a workspace path');
  if(args.action==='download'&&!args.ref&&(!args.role||typeof args.name!=='string'||args.name.length>500))throw new Error('Download requires an observed link/button ref or role/name');
  for(const key of ['cursor','heading','format'])if(args[key]!==undefined&&args.action!=='read')throw new Error(key+' is only supported on read');
  if(args.cursor!==undefined&&(typeof args.cursor!=='string'||!/^[-a-f0-9]{36}$/.test(args.cursor)||['role','name','ref','heading','format','index'].some(k=>args[k]!==undefined)))throw new Error('Use a returned reading cursor without additional scope arguments');
  if(args.heading!==undefined&&(typeof args.heading!=='string'||!args.heading.trim()||args.heading.length>500))throw new Error('Heading must be exact observed text up to 500 characters');
  if(args.format!==undefined&&!['text','accessibility'].includes(args.format))throw new Error('Read format must be text or accessibility');
  if(args.action==='read'&&[!!args.role,!!args.ref,!!args.heading].filter(Boolean).length>1)throw new Error('Choose only one read scope: role/name, ref, or heading');
  if(args.action==='read'&&args.format==='text'&&(args.role||args.ref))throw new Error('Text reads support heading or the whole body');
if(!actions.has(args.action))throw new Error('Unknown browser action');if(args.action==='open')url(args.url);if(args.ref!==undefined&&(typeof args.ref!=='string'||!/^\w{1,80}$/.test(args.ref)))throw new Error('Invalid observed element reference');if(args.action==='select'&&(!Number.isInteger(args.tab)||args.tab<0||args.tab>7))throw new Error('Select an observed tab index from tabs');if(['click','fill'].includes(args.action)&&!args.ref&&(!args.role||typeof args.name!=='string'||args.name.length>500))throw new Error('Use a role and accessible name from the last page snapshot.');if(args.action==='fill'&&(typeof args.value!=='string'||args.value.length>10000))throw new Error('Fill requires text up to 10000 characters.');if(args.action==='press'&&!keys.has(args.key))throw new Error('Unsupported browser key');if(args.action==='wait'&&(!Number.isInteger(args.milliseconds)||args.milliseconds<0||args.milliseconds>5000))throw new Error('Wait requires milliseconds from 0 to 5000');if(args.action==='scroll'&&(!Number.isInteger(args.delta)||Math.abs(args.delta)>800))throw new Error('Scroll delta must be -800 to 800');if(args.index!==undefined&&(!Number.isInteger(args.index)||args.index<0||args.index>100))throw new Error('Index must be 0 to 100');if(args.action==='read'&&(args.role!==undefined||args.name!==undefined)&&(!args.role||typeof args.name!=='string'||args.name.length>500))throw new Error('Scoped read requires role and exact name')}
 async function available(){try{library??=await load()}catch{throw new Error('浏览器执行组件未安装完整，请重新安装此版插件。')}}
 async function close(id){for(const key of id?[id]:new Set([...sessions.keys(),...queues.keys()]))epochs.set(key,(epochs.get(key)||0)+1);const entries=id?[sessions.get(id)].filter(Boolean):[...sessions.values()];await Promise.all(entries.map(async entry=>{entry.closed=true;clearTimeout(entry.frameAck);try{await entry.pending}catch{}if(entry.mcp)await entry.mcp.close().catch(()=>{});if(entry.browser)await entry.browser.close();await cleanDownloads(entry.downloadsPath);if(sessions.get(entry.id)===entry)sessions.delete(entry.id)}))}
 async function get(id,signal){
  let entry=sessions.get(id);if(entry){await entry.pending;return entry}
  if(sessions.size>=4)throw new Error('最多同时打开 4 个会话的 DS 浏览器，请先关闭不用的浏览器。');
  entry={id,closed:false,busy:false,snapshot:null,controller:'agent',revision:0};sessions.set(id,entry);
  entry.pending=(async()=>{
   await available();signal.throwIfAborted();
   // A new isolated process/context, never attach to a personal browser profile.
   entry.downloadsPath=await fs.mkdtemp(path.join(os.tmpdir(),'paperflight-download-'));
   entry.browser=await library.chromium.launch({channel:'msedge',headless:true,chromiumSandbox:true,timeout:20000,downloadsPath:entry.downloadsPath});
   if(entry.closed||signal.aborted){await entry.browser.close();signal.throwIfAborted();throw new Error('Browser was closed')}
   entry.context=await entry.browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true,serviceWorkers:'block'});
   await entry.context.route('**/*',route=>{try{const requested=route.request().url();if(requested.startsWith('blob:')&&entry.downloadPage&&new URL(requested).origin===new URL(entry.downloadPage.url()).origin)return route.continue();url(requested);return route.continue()}catch{return route.abort('blockedbyclient')}});
   const first=await entry.context.newPage();
   await selectPage(entry,first);
   if(mcpFactory)entry.mcp=await mcpFactory(entry.context);
   entry.context.on('page',page=>{if(/^(edge|chrome|devtools):/.test(page.url())){void page.close().catch(()=>{});return}page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&/^(edge|chrome|devtools):/.test(page.url())){if(entry.pendingPage===page)entry.pendingPage=null;void page.close().catch(()=>{})}});watchDownloads(entry,page);if((entry.context.pages?.().length||0)>8){void page.close().catch(()=>{});return}if(page!==entry.page)entry.pendingPage=page});
   entry.browser.on('disconnected',()=>{if(sessions.get(id)===entry)sessions.delete(id)});
  })();
  try{await entry.pending;return entry}catch(e){if(entry.browser)await entry.browser.close().catch(()=>{});await cleanDownloads(entry.downloadsPath);if(sessions.get(id)===entry)sessions.delete(id);throw e}
 }
 function watchDownloads(entry,page){entry.downloadPages??=new WeakSet();if(entry.downloadPages.has(page))return;entry.downloadPages.add(page);page.on('download',download=>{if(entry.downloadPage===page&&!entry.activeDownload){entry.activeDownload=download;return}entry.downloadBlocked=true;void download.cancel().catch(()=>{});void download.delete().catch(()=>{})})}
 async function selectPage(entry,page){
  if(entry.page===page)return;
  clearTimeout(entry.frameAck);if(entry.cdp){await entry.cdp.detach?.().catch(()=>{});entry.cdp=null}
  entry.page=page;entry.fileChooser=null;entry.liveImage=null;entry.lastResult=null;entry.continuation=null;entry.revision++;watchDownloads(entry,page);
  if(entry.mcp){const index=entry.context.pages().indexOf(page);await entry.mcp.call('browser_tabs',{action:'select',index})}
  page.setDefaultTimeout(10000);entry.requests=new Set();entry.diagnostics=[];entry.refs=new Set();
   entry.observedPages??=new WeakSet();
   if(!entry.observedPages.has(page)){entry.observedPages.add(page);
   const diagnostic=value=>{
    if(entry.page!==page)return;
    let scope='unknown';try{scope=new URL(value.url).origin===new URL(page.url()).origin?'first-party':'third-party'}catch{}
    const row={...value,scope};entry.diagnostics.push(row);
    // Noisy embeds cannot evict all first-party failures.
    entry.diagnostics=[...entry.diagnostics.filter(d=>!d.expected&&d.scope!=='third-party').slice(-10),...entry.diagnostics.filter(d=>!d.expected&&d.scope==='third-party').slice(-5),...entry.diagnostics.filter(d=>d.expected).slice(-2)];return row;
   };
   const requestPath=request=>{try{const u=new URL(request.url());return u.origin+u.pathname}catch{return 'unknown'}};
   page.on('request',request=>{if(entry.page===page&&['fetch','xhr','document','script'].includes(request.resourceType()))entry.requests.add(request)});
   page.on('requestfinished',request=>entry.requests.delete(request));
   page.on('requestfailed',request=>{entry.requests.delete(request);const error=diagnosticText(request.failure()?.errorText),row=diagnostic({kind:'request-failed',url:requestPath(request),error});if(row&&entry.downloadPage===page&&error==='net::ERR_ABORTED'&&request.resourceType()==='document'&&request.isNavigationRequest?.())entry.downloadFailures?.push({request,row})});
   page.on('response',response=>{if(response.status()>=400)diagnostic({kind:'http-error',url:requestPath(response.request()),status:response.status()})});
   page.on('pageerror',error=>diagnostic({kind:'script-error',message:diagnosticText(error.message)}));
   page.on('console',message=>{if(['error','warning'].includes(message.type())){const raw=message.location?.().url;let source;try{const u=new URL(raw);source=u.origin+u.pathname}catch{}diagnostic({kind:'console',level:message.type(),message:diagnosticText(message.text()),url:source})}});
   page.on('framenavigated',frame=>{if(entry.page===page&&frame===page.mainFrame()){entry.refs.clear();entry.continuation=null;entry.fileChooser=null;entry.diagnostics=[];entry.revision++;entry.liveImage=null;if(entry.snapshot)entry.snapshot={...entry.snapshot,url:page.url(),title:'',text:'',revision:entry.revision}}});
   page.on('dialog',dialog=>void dialog.dismiss().catch(()=>{}));
   page.on('filechooser',chooser=>{if(entry.page===page)entry.fileChooser=chooser});
   }
   // Frames are independent of action/approval locks. ACK throttling bounds capture work.
   if(entry.context.newCDPSession){
    entry.cdp=await entry.context.newCDPSession(page);
    const cdp=entry.cdp;cdp.on('Page.screencastFrame',event=>{
     if(entry.closed||entry.page!==page)return;
     try{url(page.url());entry.liveImage='data:image/jpeg;base64,'+event.data;entry.frameAt=new Date().toISOString()}catch{entry.liveImage=null}
     clearTimeout(entry.frameAck);entry.frameAck=setTimeout(()=>{void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{})},Date.now()-(entry.viewedAt||0)<3000?100:1000);entry.frameAck.unref?.();
    });
    await entry.cdp.send('Page.startScreencast',{format:'jpeg',quality:65,maxWidth:1280,maxHeight:800,everyNthFrame:1});
   }

 }
 async function followPopup(entry){if(entry.pendingPage){const page=entry.pendingPage;entry.pendingPage=null;if(page.isClosed?.())return;if(/^(edge|chrome|devtools):/.test(page.url())){await page.close().catch(()=>{});return}await selectPage(entry,page)}}
 const pause=(ms,signal)=>new Promise((resolve,reject)=>{signal.throwIfAborted();const stop=()=>{clearTimeout(timer);reject(signal.reason)};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve()},ms);signal.addEventListener('abort',stop,{once:true})});
 function target(page,args){const item=page.getByRole(args.role,{name:args.name,exact:true});return args.index===undefined?item:item.nth(args.index)}
 async function capture(entry,signal,args={}){
   const page=entry.page;
   if(args.cursor){if(entry.continuation?.token!==args.cursor)throw new Error('The reading cursor expired. Start a new read.');args={...entry.continuation.scope,action:'read',cursor:args.cursor,full:true}}
   for(let attempt=0;attempt<3;attempt++){
    try{
     let documentReady=true;try{await page.waitForLoadState?.('domcontentloaded',{timeout:1000})}catch(e){if(e.name!=='TimeoutError')throw e;documentReady=false}
     const location=page.url();if(location!=='about:blank')url(location);
     const scoped=args.action==='read',textMode=scoped&&(args.heading||args.format==='text');
     if(scoped&&args.ref&&!args.cursor&&(!entry.mcp||!entry.refs.has(args.ref)))throw new Error('Use an element ref from the latest snapshot');
     const locator=scoped&&args.role?target(page,args):page.locator('body');
     const snapshotText=async()=>{
      if(textMode)return readingText(page,args);
      if(entry.mcp&&!entry.fileChooser&&!(scoped&&args.role))return snapshotBody(await entry.mcp.call('browser_snapshot',scoped&&args.ref?{target:args.ref}:{}));
      try{return await locator.ariaSnapshot({timeout:2000})}catch(e){if(scoped&&args.role)throw new Error('No unique accessible role/name match. A heading is not its container name; use read heading with the exact title, format:text, or an observed ref.');throw e}
     };
     const started=Date.now();let snapshot='',stableSince=started,stable=false;
     do{signal.throwIfAborted();const next=await snapshotText();if(next!==snapshot){snapshot=next;stableSince=Date.now()}stable=Date.now()-stableSince>=750;if(stable||Date.now()-started>=settleMs)break;await pause(Math.min(250,Math.max(0,settleMs-(Date.now()-started))),signal)}while(true);
     const screenshot=await page.screenshot({type:'jpeg',quality:65,timeout:10000}),title=await page.title();signal.throwIfAborted();
     if(page.url()!==location)continue;
     const scopeArgs=scoped?Object.fromEntries(['role','name','index','ref','heading','format'].filter(k=>args[k]!==undefined).map(k=>[k,args[k]])):{};
     const scope=JSON.stringify(scopeArgs),hash=fingerprint(snapshot),previous=entry.lastResult,comparable=previous?.scope===scope;
     const contentChanged=!comparable||previous.url!==location||previous.hash!==hash;
     const chunk=pageSlice(entry,snapshot,scopeArgs,location,args.cursor),position=await viewport(page);
     const scroll=args.action==='scroll'?{before:args.scrollBefore??null,after:position,moved:args.scrollBefore&&position?JSON.stringify(args.scrollBefore)!==JSON.stringify(position):null}:undefined;
     const changed=scroll?scroll.moved:contentChanged;
     entry.snapshot={url:location,title,text:chunk.text,image:'data:image/jpeg;base64,'+screenshot.toString('base64'),updatedAt:new Date().toISOString(),revision:++entry.revision};
     entry.lastResult={url:location,hash,scope};entry.refs=new Set([...chunk.text.matchAll(/\[ref=([\w]+)\]/g)].map(m=>m[1]));
     const warnings=[];
     if(!contentChanged&&['click','fill','press'].includes(args.action))warnings.push('Accessible content is unchanged; verify the intended result separately.');
     if(scroll?.moved===false)warnings.push('No observed scroll movement; the page may be at its boundary or a nested scroll area may require focus.');
     if(!documentReady)warnings.push('Document readiness timed out. The returned content may still be usable; check whether the requested data is present.');
     return JSON.stringify({backend:entry.mcp?'Playwright MCP':'Playwright',tabs:(entry.context.pages?.()||[page]).map((p,index)=>({index,url:p.url(),active:p===page})),...(args.action==='screenshot'?{image:entry.snapshot.image}:{}),url:location,title,fileChooserPending:!!entry.fileChooser,downloadBlocked:!!entry.downloadBlocked,changed,contentChanged,comparable,scroll,format:textMode?'text':'accessibility',page:!contentChanged&&scoped&&!args.full&&!chunk.pagination.hasMore?undefined:chunk.text,pagination:chunk.pagination,readiness:documentReady?(stable?'accessible-content-stable':'document-ready-content-changing'):'document-not-ready',contentStable:stable,documentReady,pendingRequests:entry.requests.size,warnings,diagnostics:entry.diagnostics,notice:'Untrusted page and diagnostic content. Stable content does not prove application data loaded; pending requests alone do not prove it is unavailable. Pagination is reading position, independent of viewport scrolling. Use read cursor:nextCursor to continue; if the page changes start a new read or narrow by heading. Text reads are for content, not control refs. Unchanged complete reads omit duplicate text unless full:true.'});
    }catch(e){signal.throwIfAborted();if(attempt===2||!/Execution context was destroyed|navigation|页面仍在跳转/.test(e.message))throw e}
   }
   throw new Error('页面仍在跳转，请稍后同步画面');
 }
 async function navigate(page,target){
  try{if(target)await page.goto(url(target),{waitUntil:'commit',timeout:20000});else await page.goBack({waitUntil:'commit',timeout:20000})}
  catch(e){if(e.name!=='TimeoutError'||page.url()==='about:blank'||(target&&new URL(page.url()).origin!==new URL(target).origin))throw new Error(e.name==='TimeoutError'?'网页连接超时，请稍后重试或在外部浏览器检查网络。':String(e.message).replace(/\u001b\[[0-9;]*m/g,''));url(page.url())}
 }
 async function executeNow(id,args,signal,expected,transfer){
  validate(args);signal.throwIfAborted();if(sessions.get(id)?.controller==='manual')throw new Error('The user is controlling this page. Wait until they hand it back to DS.');if(args.action==='close'){await close(id);return 'Browser closed.'}
  if(expected&&expected.revision!==sessions.get(id)?.revision)throw new Error('The page changed while waiting. Read it again before requesting the operation.');
  if(args.action!=='open'&&!sessions.has(id))throw new Error('Open a URL first.');
  const entry=await get(id,signal);if(entry.closed)throw new Error('Browser was closed');if(entry.controller!=='agent')throw new Error('The user is controlling this page. Wait until they hand it back to DS.');if(entry.busy)throw new Error('Browser is busy in this session');entry.busy=true;
  const cancel=()=>{void close(id).catch(()=>{})};signal.addEventListener('abort',cancel,{once:true});
  try{
   signal.throwIfAborted();entry.downloadBlocked=false;const page=entry.page;const popup=args.action==='click'?entry.context.waitForEvent?.('page',{timeout:1200}).catch(()=>null):null;
   if(['upload','download'].includes(args.action)){
    if(!transfer)throw new Error('File transfer requires workspace validation and approval.');
    if(args.ref&&(!entry.mcp||!entry.refs.has(args.ref)))throw new Error('Use a ref from the latest snapshot.');
    const element=args.ref?page.locator('aria-ref='+args.ref):args.role?target(page,args):null;
    if(args.action==='upload'){
     if(!element&&!entry.fileChooser)throw new Error('Click the observed upload button first to open a file chooser, then call upload with path.');
     const payload=await transfer.upload();signal.throwIfAborted();
     if(entry.fileChooser&&entry.mcp)await entry.mcp.clearFileChooser();
     if(element)await element.setInputFiles(payload,{timeout:10000});else await entry.fileChooser.setFiles(payload,{timeout:10000});
     entry.fileChooser=null;
     let observation;try{observation=JSON.parse(await capture(entry,signal))}catch(e){observation={url:page.url(),warnings:['File selected, but page refresh failed: '+diagnosticText(e.message)]}}
     return JSON.stringify({...observation,transfer:{...transfer.summary,status:'selected',notice:'File selected; the website may upload immediately or require a submit action. Verify the site response.'}});
    }
    entry.downloadPage=page;entry.activeDownload=null;entry.downloadFailures=[];
    const pending=page.waitForEvent('download',{timeout:15000}).then(value=>({value}),error=>({error}));
    try{
     await element.click({timeout:10000});const observed=await pending;if(observed.error)throw new Error('No file download started. Use an observed download link/button.');
     const download=observed.value;const address=download.url();if(address.startsWith('blob:')){if(new URL(address).origin!==new URL(page.url()).origin)throw new Error('Download blob origin mismatch.')}else url(address);await finishDownload(download,entry.downloadsPath,signal);
     const saved=await transfer.save(download);
     // A successful attachment navigation is reported as aborted by Chromium.
     // Correlate only this action's navigation request, including redirects; never mask arbitrary aborts.
     for(const {request,row} of entry.downloadFailures){let matched=false;for(let r=request;r;r=r.redirectedTo?.())if(r.url()===address)matched=true;if(matched){row.kind='download-navigation';row.expected=true;row.reason='Navigation became a file download; file saved successfully.'}}
     entry.diagnostics=[...entry.diagnostics.filter(d=>!d.expected),...entry.diagnostics.filter(d=>d.expected).slice(-2)];
     let observation;try{observation=JSON.parse(await capture(entry,signal))}catch(e){observation={url:page.url(),warnings:['File saved, but page refresh failed: '+diagnosticText(e.message)]}}
     return JSON.stringify({...observation,transfer:{action:'download',status:'saved',...saved}});
    }finally{entry.downloadPage=null;entry.downloadFailures=null;const download=entry.activeDownload;entry.activeDownload=null;if(download){await download.cancel().catch(()=>{});await download.delete().catch(()=>{})}}
   }
   if(args.action==='open')await navigate(page,args.url);
   if(args.action==='select'){const pages=entry.context.pages?.()||[entry.page];if(!pages[args.tab])throw new Error('Tab no longer exists');await selectPage(entry,pages[args.tab])}
   if(['click','fill'].includes(args.action)&&args.ref){if(!entry.mcp||!entry.refs.has(args.ref))throw new Error('Use an element ref from the latest snapshot');await entry.mcp.call(args.action==='click'?'browser_click':'browser_type',{target:args.ref,...(args.action==='fill'?{text:args.value}: {})})}
   if(args.action==='click'&&!args.ref)await target(page,args).click();
   if(args.action==='fill'&&!args.ref)await target(page,args).fill(args.value);
   if(args.action==='press')await page.keyboard.press(args.key);
   if(args.action==='back')await navigate(page);
   if(args.action==='reload'){entry.diagnostics=[];await page.reload({waitUntil:'commit',timeout:20000})}
   if(args.action==='wait')await pause(args.milliseconds,signal);
   if(args.action==='scroll'){args={...args,scrollBefore:await viewport(page)};await page.mouse.wheel(0,args.delta);await pause(100,signal)}
   if(popup){const p=await popup;if(p)entry.pendingPage=p}await followPopup(entry);return await capture(entry,signal,args);
  }finally{signal.removeEventListener('abort',cancel);entry.busy=false;if(signal.aborted)await close(id)}
 }
 // Human actions use the same page/context. Ownership switches never navigate or clone cookies.
 async function manualNow(id,args,signal){
  const allowed=new Set(['claim','open','read','click','type','press','scroll','back','select']);
  if(!allowed.has(args.action))throw new Error('Unknown manual browser action');
  if(args.action==='open')url(args.url);
  if(args.action==='claim'&&!['manual','agent'].includes(args.controller))throw new Error('Unknown browser controller');
  if(!sessions.has(id)&&args.action!=='open')throw new Error('请先打开共享页面');
  const entry=await get(id,signal);if(entry.closed||entry.busy)throw new Error('浏览器正在执行操作，请稍后再接管');
  if(args.action==='claim'){
   entry.controller=args.controller;
   return view(id);
  }
  if(args.action==='open'&&!entry.snapshot)entry.controller='manual';
  if(entry.controller!=='manual')throw new Error('请先点击「我来操作」，暂停 DS 对这个页面的控制');
  if(['click','type','press','scroll'].includes(args.action)&&args.revision!==entry.revision)throw new Error('画面已更新，请核对新画面后再操作');
  if(args.action==='select'&&(!Number.isInteger(args.tab)||!(entry.context.pages?.()||[])[args.tab]))throw new Error('Tab no longer exists');
  if(args.action==='click'&&(!Number.isFinite(args.x)||!Number.isFinite(args.y)||args.x<0||args.x>=1280||args.y<0||args.y>=800))throw new Error('点击位置无效');
  if(args.action==='type'&&(typeof args.text!=='string'||!args.text||args.text.length>10000))throw new Error('输入内容须为 1–10000 字符');
  if(args.action==='press'&&!new Set([...keys,'Backspace','Delete','Home','End','Control+A','Space']).has(args.key))throw new Error('Unsupported manual browser key');
  if(args.action==='scroll'&&(!Number.isFinite(args.delta)||Math.abs(args.delta)>800))throw new Error('滚动距离无效');
  entry.busy=true;
  const cancel=()=>void close(id).catch(()=>{});signal.addEventListener('abort',cancel,{once:true});
  try{
   const page=entry.page;const popup=args.action==='click'?entry.context.waitForEvent?.('page',{timeout:1200}).catch(()=>null):null;
   if(args.action==='open')await navigate(page,args.url);
   if(args.action==='click')await page.mouse.click(args.x,args.y);
   if(args.action==='type')await page.keyboard.insertText(args.text);
   if(args.action==='press')await page.keyboard.press(args.key);
   if(args.action==='scroll')await page.mouse.wheel(0,args.delta);
   if(args.action==='back')await navigate(page);
   if(args.action==='select')await selectPage(entry,entry.context.pages()[args.tab]);if(popup){const p=await popup;if(p)entry.pendingPage=p}await followPopup(entry);await capture(entry,signal);return view(id);
  }finally{signal.removeEventListener('abort',cancel);entry.busy=false;if(signal.aborted)await close(id)}
 }
 const view=id=>{const e=sessions.get(id);if(e)e.viewedAt=Date.now();return e?.snapshot?{...e.snapshot,backend:e.mcp?'Playwright MCP':'Playwright',tabs:(e.context.pages?.()||[e.page]).map((p,index)=>({index,url:p.url(),active:p===e.page})),image:e.liveImage||e.snapshot.image,updatedAt:e.frameAt||e.snapshot.updatedAt,live:!!e.cdp,controller:e.controller,busy:e.busy}:null};
 const execute=(id,args,signal,expected,transfer)=>queued(id,signal,()=>executeNow(id,args,signal,expected,transfer));
 const manual=(id,args)=>{const signal=AbortSignal.timeout(30000);return queued(id,signal,()=>manualNow(id,args,signal))};
 return {validate,available,execute,manual,close,view};
}
