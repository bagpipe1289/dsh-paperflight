import {createHash} from 'node:crypto';
// Session-scoped and memory-only. Broader browsing grants are explicit and exclude input/clicks.
function canonical(value){return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value}
function context(frame){try{const line=frame.request.reason?.split('\n')[0];if(!line?.startsWith('Paperflight permission '))return null;const meta=JSON.parse(line.slice(23)),args=JSON.parse(frame.toolArguments);if(meta.kind==='cmd'&&frame.request.toolName==='mai_cmd'&&meta.command===args.command&&typeof meta.cwd==='string'){delete args.description;return{meta,args}}if(meta.kind==='browser'&&frame.request.toolName==='mai_browser'&&JSON.stringify(canonical(meta.args))===JSON.stringify(canonical(args)))return{meta,args};return null}catch{return null}}
function browsing(frame){const c=context(frame);if(!c||c.meta.kind!=='browser'||!['open','reload','scroll'].includes(c.args.action))return null;try{const u=new URL(c.args.action==='open'?c.args.url:c.meta.url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;return u.origin}catch{return null}}
function transfer(frame){try{return frame.request?.toolName==='mai_browser'&&['upload','download'].includes(JSON.parse(frame.toolArguments).action)}catch{return false}}
export function approvalKey(frame,scope='exact'){
 if(transfer(frame))return null;
 if(frame.event!=='approval/request'||!frame.agentId||!frame.request?.toolName||frame.contextLoading||frame.contextError||typeof frame.toolArguments!=='string'||!frame.toolArguments.trim())return null;
 const c=context(frame),origin=scope==='browse-origin'?browsing(frame):null;if(scope!=='exact'&&!origin)return null;
 const identity=origin?['browse-origin',origin]:c?['exact',c.meta,c.args]:[frame.request.reason,frame.request.displayReason,frame.toolArguments];
 return createHash('sha256').update(JSON.stringify([frame.agentId,frame.request.toolName,canonical(identity)])).digest('hex');
}
export class ApprovalMemory{
 constructor(){this.rules=new Map()}
 scopes(frame){if(transfer(frame))return [];return browsing(frame)?['exact','browse-origin']:['exact']}
 has(frame){for(const scope of ['exact','browse-origin']){const key=approvalKey(frame,scope),rule=key&&this.rules.get(key);if(rule?.sessionId===frame.agentId){rule.uses++;rule.lastUsedAt=new Date().toISOString();return true}}return false}
 remember(frame,scope='exact'){const key=approvalKey(frame,scope);if(!key)throw new Error('无法记住尚未核对的请求或不支持的授权范围');this.rules.set(key,{id:key,sessionId:frame.agentId,tool:frame.request.toolName,scope,origin:scope==='browse-origin'?browsing(frame):undefined,reason:frame.request.reason,arguments:frame.toolArguments,createdAt:new Date().toISOString(),uses:0});while(this.rules.size>100)this.rules.delete(this.rules.keys().next().value)}
 revoke(sessionId,key){const rule=this.rules.get(key);if(!rule||rule.sessionId!==sessionId)throw new Error('权限不存在或不属于此会话');this.rules.delete(key)}
 clear(sessionId){for(const [key,rule]of this.rules)if(rule.sessionId===sessionId)this.rules.delete(key)}
 list(){return [...this.rules.values()]}
 counts(){const result={};for(const {sessionId} of this.rules.values())result[sessionId]=(result[sessionId]||0)+1;return result}
}
