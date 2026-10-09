// Child histories must retain the native durable parent address. Forks stay sessions.
export function sessionAddressFromRows(sessionId,rows){
 const row=rows.find(r=>r.sessionId===sessionId);
 if(row?.origin!=='subagent')return {kind:'session',sessionId};
 if(!row.parentSessionId)throw new Error('子代理缺少父会话地址');
 const parent=rows.find(r=>r.sessionId===row.parentSessionId);
 const child=parent?.projections?.values?.subagentCatalog?.find(c=>c.id===sessionId);
 return {kind:'subagent',parentSessionId:row.parentSessionId,childSessionId:sessionId,mode:['one-shot','continuable'].includes(child?.mode)?child.mode:'unknown'};
}
