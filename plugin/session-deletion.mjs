import {randomUUID} from 'node:crypto';

// Optional community adapter. Never owns a recursive filesystem delete.
// This matrix is deliberately narrow: Windows JSONL's kernel semaphore survives
// removal of the directory, unlike an unlinked POSIX flock file.
export function sessionDeletion({ctx,hostVersion,invoke,platform=process.platform,now=Date.now}){
 const tickets=new Map(),busy=new Set(),uncertain=new Map();
 const service=name=>ctx.get(name);
 const idOf=a=>a.id??a.session?.id;
 async function status(){
  const manager=service('pluginManager');
  if(!manager)return {available:false,reason:'无法读取插件状态。'};
  const [plugins,bundles]=await Promise.all([manager.listPlugins(),manager.listBundles()]);
  const bundle=bundles.find(b=>b.name==='dsh-session-manager'&&b.installed);
  const active=plugins.some(p=>p.moduleName==='dsh-session-manager'&&p.enabled&&p.fiberPhase==='active');
  let reason='';
  if(!bundle)reason='请先在原生插件管理中安装 dsh-session-manager 0.6.3。';
  else if(!active)reason='请启用社区会话管理插件 dsh-session-manager。';
  else if(bundle.version!=='0.6.3')reason='此社区插件版本尚未验证，暂不开放删除。';
  else if(hostVersion!=='0.2.0-rc.2'||platform!=='win32'||service('sessionPersistence')?.name!=='session-persistence-jsonl')reason='此 DSH 版本或存储后端尚未验证，暂不开放删除。';
  return {available:!reason,reason,provider:'dsh-session-manager',version:bundle?.version||null};
 }
 function validId(id){if(typeof id!=='string'||!/^[-\w]{1,120}$/.test(id))throw new Error('会话标识无效。')}
 async function inspect(id){
  validId(id);
  const provider=await status();if(!provider.available)throw new Error(provider.reason);
  const registry=service('workspaceRegistry'),persistence=service('sessionPersistence');
  if(!registry?.archivedSessionIds?.includes(id))throw new Error('仅支持删除已归档父会话。');
  const rows=await persistence.list(),byId=new Map(rows.map(s=>[s.header.id,s]));
  const root=byId.get(id);if(!root)throw new Error('会话记录不存在，请刷新列表。');
  if(root.header.origin==='subagent'||root.header.parentSession||root.header.isSeeded)throw new Error('请从原始父会话整组删除；暂不支持单独删除子代理或分叉会话。');
  const members=[],seen=new Set();
  function visit(row){
   const current=row.header.id;validId(current);
   if(seen.has(current))throw new Error('会话关联出现循环，未执行删除。');
   seen.add(current);if(seen.size>200)throw new Error('关联会话超过 200 个，暂不支持整组删除。');
   for(const child of rows.filter(s=>s.header.parentSession===current)){
    if(child.header.origin!=='subagent')throw new Error('此组存在普通分叉关联，不能连带删除。');
    visit(child);
   }
   members.push(row);
  }
  visit(root);
  for(const row of members){const current=row.header.id;
   if(uncertain.has(current))throw new Error('上次删除连接中断，保护锁仍保留。请重启 DSH 后核对记录。');
   if(registry.pinnedSessionIds?.includes(current))throw new Error('请先取消父会话或子代理的置顶。');
   if(service('sessions').get(current)||service('agents').list().some(a=>idOf(a)===current))throw new Error('父会话或子代理仍被 DSH 占用。请在方便时重启 DSH，再从归档列表删除，不要先打开该会话。');
  }
  return members;
 }
 const fingerprint=rows=>JSON.stringify(rows.map(s=>[s.header.id,s.revision,s.header.parentSession??null,s.header.origin??null]).sort((a,b)=>a[0].localeCompare(b[0])));
 async function prepare(id){
  const rows=await inspect(id);
  for(const [key,t] of tickets)if(t.expires<=now())tickets.delete(key);
  if(tickets.size>=100)tickets.delete(tickets.keys().next().value);
  const token=randomUUID();tickets.set(token,{id,fingerprint:fingerprint(rows),expires:now()+120000});
  return {token,sessionId:id,expiresInSeconds:120,total:rows.length,children:rows.length-1,targets:rows.map(s=>({sessionId:s.header.id,parentSessionId:s.header.parentSession||null,kind:s.header.id===id?'parent':'subagent',title:s.projections?.values?.title||s.header.id}))};
 }
 async function verifyGone(id){
  const registry=service('workspaceRegistry');
  if(await service('sessionPersistence').stat(id)||registry.archivedSessionIds.includes(id)||registry.pinnedSessionIds?.includes(id)||registry.list().some(w=>(w.record?.sessionIds??w.sessionIds??[]).includes(id))||service('sessions').get(id)||service('agents').list().some(a=>idOf(a)===id))throw new Error('删除后的记录或索引检查未通过。');
 }
 async function remove(id,token){
  validId(id);const ticket=tickets.get(token);tickets.delete(token);
  if(!ticket||ticket.id!==id||ticket.expires<=now())throw new Error('删除确认已失效，请重新确认。');
  if(busy.has(id))throw new Error('此会话正在删除，请等待结果。');
  busy.add(id);const handles=new Map(),deleted=[],warnings=[];let dispatched=false,inFlight=false;
  try{
   const rows=await inspect(id);
   // Lock every member before the first mutation, in stable ID order.
   for(const row of [...rows].sort((a,b)=>a.header.id.localeCompare(b.header.id))){
    try{handles.set(row.header.id,await service('sessionPersistence').open(row.header.id,'write'))}
    catch(e){throw new Error('无法独占整组会话记录，未执行删除。请稍后重试。'+e.message)}
   }
   const locked=await inspect(id);
   if(fingerprint(locked)!==ticket.fingerprint)throw new Error('确认后会话记录或关联发生变化，请重新确认。');
   for(const row of locked){
    // Recheck the surviving graph before every dispatch. Child-first order
    // leaves the parent available for a fresh explicit confirmation on failure.
    const remaining=await inspect(id),expected=locked.filter(s=>!deleted.includes(s.header.id));
    if(fingerprint(remaining)!==fingerprint(expected))throw new Error('删除期间会话关联发生变化，已停止。');
    const current=row.header.id;dispatched=true;inFlight=true;
    const result=await invoke(current);inFlight=false;
    if(result?.ok!==true||result.sessionId!==current||result.filesRemoved!==true||result.wasLive!==false)throw new Error(result?.error||'社区插件未确认完整删除。');
    await verifyGone(current);deleted.push(current);if(result.warning)warnings.push(result.warning);
   }
   for(const current of deleted)await verifyGone(current);
   return {deleted:true,sessionId:id,deletedIds:deleted,deletedCount:deleted.length,warning:warnings.join('；')||null};
  }catch(e){
   // An unknown provider outcome must not release any member's lease while
   // deletion may still be executing. Locks live until host teardown.
   if(inFlight){for(const [current,handle]of handles)uncertain.set(current,handle);handles.clear()}
   if(dispatched)throw new Error('删除结果未完整确认，已确认删除 '+deleted.length+' 条，可能已部分清理；请刷新列表核对，不会自动重试。'+e.message);
   throw e;
  }finally{try{await Promise.all([...handles.values()].map(h=>h.close()))}finally{busy.delete(id)}}
 }
 return {status,prepare,remove};
}
