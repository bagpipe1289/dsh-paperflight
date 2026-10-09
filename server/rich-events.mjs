// Only durable records are rendered. Current plugin code is never evaluated here.
export function enrichEvent(state,e,textOf){
 const d=e.data||{},ts=e.time/1000;
 const put=m=>{const i=state.messages.findIndex(x=>x.id===m.id);if(i<0)state.messages.push(m);else state.messages[i]=m};
 const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v}catch{return v}};
 if(['tool/call','tool/result','tool/ptc-dispatch-start','tool/ptc-dispatch'].includes(e.type)){
  const cid=d.subCallId||d.callId||d.message?.toolCallId||d.message?.source?.callId||d.message?.callId;if(!cid)return false;
  const prior=state.messages.find(x=>x.id==='tool-'+cid),settled=['tool/result','tool/ptc-dispatch'].includes(e.type),result={...(d.message||d),...(d.meta!==undefined?{meta:d.meta}:{})};
  const tool={...prior?.tool,callId:cid,parentCallId:d.parentCallId??prior?.tool?.parentCallId,rootCallId:d.rootCallId??prior?.tool?.rootCallId,name:d.name||prior?.tool?.name||'工具',arguments:d.arguments===undefined?prior?.tool?.arguments:parse(d.arguments),...(settled?{result:textOf(result.content),rawResult:result,status:result.isError?'failed':'completed',endedAt:e.time}:{status:'running',startedAt:e.time})};
  put({id:'tool-'+cid,type:tool.status==='failed'?'error':'system',workStep:true,timestamp:prior?.timestamp||ts,content:'工具 · '+tool.name+'\n'+(tool.result??JSON.stringify(tool.arguments,null,2)),tool});return true;
 }
 if(e.type.startsWith('tool-workflow/')){const key='workflow-'+d.runId,prior=state.messages.find(x=>x.id===key),w={...prior?.workflow,runId:d.runId,members:[...(prior?.workflow?.members||[])]};
  if(e.type==='tool-workflow/run-start'){w.name=d.name;w.status='running';w.hasStart=true}
  if(e.type==='tool-workflow/agent-start'){const i=w.members.findIndex(x=>x.seq===d.seq),m={...d,status:'running'};if(i<0)w.members.push(m);else w.members[i]={...w.members[i],...m}}
  if(e.type==='tool-workflow/agent-end'){const i=w.members.findIndex(x=>x.seq===d.seq);if(i>=0)w.members[i]={...w.members[i],status:d.outcome};else w.members.push({...d,status:d.outcome,label:'较早的成员记录未加载'})}
  if(e.type==='tool-workflow/run-end')w.status=d.stopReason==='error'?'failed':d.stopReason;
  put({id:key,type:'system',workStep:true,timestamp:prior?.timestamp||ts,content:'工作流 · '+(w.name||'较早的开始记录未加载'),workflow:w});return true;
 }
 if(e.type==='turn/end'||e.type==='step/end'){for(const m of state.messages){if(m.workflow?.status==='running'){m.workflow.status='interrupted';m.workflow.members=m.workflow.members.map(x=>x.status==='running'?{...x,status:'interrupted'}:x)}if(m.tool?.status==='running')m.tool.status='interrupted'}}
 if(e.type==='user/message'&&d.source?.kind==='schedule'){put({id:String(e.seq),type:'system',timestamp:ts,content:'◷ 定时提醒\n'+textOf(d.content)});return true}
 return false;
}
