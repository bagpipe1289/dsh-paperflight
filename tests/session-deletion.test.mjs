import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionDeletion} from '../plugin/session-deletion.mjs';

function fixture({invoke,platform='win32',hostVersion='0.2.0-rc.2'}={}){
 let now=0,revision='a',closed=0,opened=0,calls=0;
 const records=new Map([['one',{header:{id:'one'},revision}]]),live=new Map(),agents=[];
 const registry={archivedSessionIds:['one'],pinnedSessionIds:[],list:()=>[{sessionIds:[]} ]};
 const bundle={name:'dsh-session-manager',installed:true,version:'0.6.3'},plugin={moduleName:'dsh-session-manager',enabled:true,fiberPhase:'active'};
 const persistence={name:'session-persistence-jsonl',list:async()=>[...records.values()],stat:async id=>records.get(id),open:async()=>{opened++;return {close:async()=>{closed++}}}};
 const services={pluginManager:{listBundles:async()=>[bundle],listPlugins:async()=>[plugin]},workspaceRegistry:registry,sessionPersistence:persistence,sessions:{get:id=>live.get(id)},agents:{list:()=>agents}};
 const api=sessionDeletion({ctx:{get:n=>services[n]},hostVersion,platform,now:()=>now,invoke:async id=>{calls++;if(invoke)return invoke(id);records.delete(id);registry.archivedSessionIds=registry.archivedSessionIds.filter(x=>x!==id);return {ok:true,sessionId:id,filesRemoved:true,wasLive:false}}});
 return {api,records,live,agents,bundle,plugin,registry,persistence,get closed(){return closed},get opened(){return opened},get calls(){return calls},time:v=>now=v};
}
test('community deletion requires compatible enabled provider and supported storage',async()=>{
 const f=fixture();assert((await f.api.status()).available);
 for(const [key,value] of [['version','0.6.4'],['installed',false]]){const prev=f.bundle[key];f.bundle[key]=value;assert(!(await f.api.status()).available);await assert.rejects(f.api.prepare('one'));f.bundle[key]=prev}
 f.plugin.enabled=false;assert(!(await f.api.status()).available);assert.equal(f.calls,0);
 assert(!(await fixture({platform:'linux'}).api.status()).available);assert(!(await fixture({hostVersion:'0.3.0'}).api.status()).available);
 f.plugin.enabled=true;f.persistence.name='custom';assert(!(await f.api.status()).available);
});
test('confirmation bound to id, revision, expiration and single use',async()=>{
 const f=fixture();const p=await f.api.prepare('one');await assert.rejects(f.api.remove('other',p.token),/确认已失效/);await assert.rejects(f.api.remove('one',p.token),/确认已失效/);
 const expired=await f.api.prepare('one');f.time(120001);await assert.rejects(f.api.remove('one',expired.token),/确认已失效/);
 const stale=await f.api.prepare('one');f.records.get('one').revision='b';await assert.rejects(f.api.remove('one',stale.token),/发生变化/);assert.equal(f.calls,0);assert.equal(f.closed,1);
});
test('refuse traversal, live sessions, relationships and archive changes without provider mutation',async()=>{
 const f=fixture();await assert.rejects(f.api.prepare('../one'),/标识无效/);
 f.live.set('one',{});await assert.rejects(f.api.prepare('one'),/占用/);f.live.clear();
 f.agents.push({id:'one'});await assert.rejects(f.api.prepare('one'),/占用/);f.agents.length=0;
 f.records.set('child',{header:{id:'child',parentSession:'one'}});await assert.rejects(f.api.prepare('one'),/分叉/);f.records.delete('child');
 f.records.get('one').header.isSeeded=true;await assert.rejects(f.api.prepare('one'),/分叉/);delete f.records.get('one').header.isSeeded;
 const p=await f.api.prepare('one');f.registry.archivedSessionIds=[];await assert.rejects(f.api.remove('one',p.token),/已归档/);assert.equal(f.calls,0);
});
test('successful delete closes lease and validates disappearance',async()=>{
 const f=fixture();const p=await f.api.prepare('one');assert.deepEqual(await f.api.remove('one',p.token),{deleted:true,sessionId:'one',deletedIds:['one'],deletedCount:1,warning:null});assert.equal(f.closed,1);assert.equal(f.calls,1);
});
test('provider rejection preserves data and reports possible partial cleanup',async()=>{
 const f=fixture({invoke:async()=>({ok:false,error:'disk permission denied'})});const p=await f.api.prepare('one');await assert.rejects(f.api.remove('one',p.token),/可能已部分清理.*disk permission denied/);assert(f.records.has('one'));assert.equal(f.closed,1);
});
test('lying success does not become a success notification',async()=>{
 const f=fixture({invoke:async id=>({ok:true,sessionId:id,filesRemoved:true,wasLive:false})});const p=await f.api.prepare('one');await assert.rejects(f.api.remove('one',p.token),/索引检查未通过/);assert.equal(f.calls,1);
});
test('transport failure retains lease until host teardown and blocks retry',async()=>{
 const f=fixture({invoke:async()=>{throw new Error('connection lost')}});const p=await f.api.prepare('one');await assert.rejects(f.api.remove('one',p.token),/不会自动重试/);assert.equal(f.closed,0);await assert.rejects(f.api.prepare('one'),/保护锁仍保留/);assert.equal(f.calls,1);
});
test('concurrent double submission is rejected and only one provider call runs',async()=>{
 let release;const gate=new Promise(r=>release=r);const f=fixture({invoke:async id=>{await gate;f.records.delete(id);f.registry.archivedSessionIds=f.registry.archivedSessionIds.filter(x=>x!==id);return {ok:true,sessionId:id,filesRemoved:true,wasLive:false}}});
 const a=await f.api.prepare('one'),b=await f.api.prepare('one');const first=f.api.remove('one',a.token);await assert.rejects(f.api.remove('one',b.token),/正在删除/);release();await first;assert.equal(f.calls,1);
});

function tree(f){for(const [id,parent]of [['child','one'],['grandchild','child']])f.records.set(id,{header:{id,parentSession:parent,origin:'subagent'},revision:'a'});}
test('tree preview and child-first removal retain unrelated records',async()=>{
 const f=fixture();tree(f);f.records.set('other',{header:{id:'other'},revision:'a'});
 const p=await f.api.prepare('one');assert.equal(p.children,2);assert.deepEqual(p.targets.map(t=>t.sessionId),['grandchild','child','one']);
 const r=await f.api.remove('one',p.token);assert.deepEqual(r.deletedIds,['grandchild','child','one']);assert(f.records.has('other'));assert.equal(f.closed,3);
});
test('live descendant, pinned descendant and ordinary fork at any depth block whole tree',async()=>{
 const f=fixture();tree(f);f.live.set('grandchild',{});await assert.rejects(f.api.prepare('one'),/占用/);f.live.clear();
 f.registry.pinnedSessionIds.push('child');await assert.rejects(f.api.prepare('one'),/置顶/);f.registry.pinnedSessionIds=[];
 f.records.set('fork',{header:{id:'fork',parentSession:'grandchild',origin:'fork'},revision:'a'});await assert.rejects(f.api.prepare('one'),/分叉/);assert.equal(f.calls,0);
});
test('new descendants or changed descendant revisions invalidate the entire confirmation',async()=>{
 const f=fixture();tree(f);const p=await f.api.prepare('one');f.records.get('grandchild').revision='b';await assert.rejects(f.api.remove('one',p.token),/发生变化/);
 const q=await f.api.prepare('one');f.records.set('new',{header:{id:'new',parentSession:'one',origin:'subagent'},revision:'a'});await assert.rejects(f.api.remove('one',q.token),/发生变化/);assert.equal(f.calls,0);
});
test('failure to lock any descendant releases acquired leases with no deletion',async()=>{
 const f=fixture();tree(f);let closed=0;f.persistence.open=async id=>{if(id==='grandchild')throw Error('owned');return{close:async()=>closed++}};
 const p=await f.api.prepare('one');await assert.rejects(f.api.remove('one',p.token),/无法独占/);assert.equal(f.calls,0);assert.equal(closed,1);
});
test('mid-tree provider failure stops before parent deletion and reports partial progress',async()=>{
 const f=fixture({invoke:async id=>{if(id==='child')return{ok:false,error:'disk denied'};f.records.delete(id);return{ok:true,sessionId:id,filesRemoved:true,wasLive:false}}});tree(f);
 const p=await f.api.prepare('one');await assert.rejects(f.api.remove('one',p.token),/已确认删除 1 条/);assert(f.records.has('one'));assert(f.records.has('child'));assert.equal(f.calls,2);assert.equal(f.closed,3);
});
test('unknown outcome retains all tree locks until restart, not just the dispatched child',async()=>{
 const f=fixture({invoke:async()=>{throw Error('transport lost')}});tree(f);const p=await f.api.prepare('one');await assert.rejects(f.api.remove('one',p.token),/不会自动重试/);assert.equal(f.closed,0);await assert.rejects(f.api.prepare('one'),/保护锁/);
});
