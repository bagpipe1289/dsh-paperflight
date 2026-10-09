import {createHash} from 'node:crypto';
// Deliberately exact, session-scoped and memory-only. No wildcard tool/domain grants.
export function approvalKey(frame){
 if(frame.event!=='approval/request'||!frame.agentId||!frame.request?.toolName||frame.contextLoading||frame.contextError||typeof frame.toolArguments!=='string'||!frame.toolArguments.trim())return null;
 return createHash('sha256').update(JSON.stringify([frame.agentId,frame.request.toolName,frame.request.reason,frame.request.displayReason,frame.toolArguments])).digest('hex');
}
export class ApprovalMemory{
 constructor(){this.rules=new Map()}
 has(frame){const key=approvalKey(frame);return !!key&&this.rules.get(key)===frame.agentId}
 remember(frame){const key=approvalKey(frame);if(!key)throw new Error('无法记住尚未核对的请求');this.rules.set(key,frame.agentId);while(this.rules.size>100)this.rules.delete(this.rules.keys().next().value)}
 clear(sessionId){for(const [key,id]of this.rules)if(id===sessionId)this.rules.delete(key)}
 counts(){const result={};for(const id of this.rules.values())result[id]=(result[id]||0)+1;return result}
}
