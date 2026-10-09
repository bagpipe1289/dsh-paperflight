export function mergeMessages(older:any[],newer:any[]){const map=new Map<string,any>();for(const m of [...older,...newer]){const prior=map.get(m.id);if(prior?.tool&&m.tool){const tool={...prior.tool,...Object.fromEntries(Object.entries(m.tool).filter(([,v])=>v!==undefined))};if(tool.name==='工具'&&prior.tool.name)tool.name=prior.tool.name;map.set(m.id,{...prior,...m,timestamp:Math.min(prior.timestamp,m.timestamp),tool});}else map.set(m.id,m)}return [...map.values()]}
export function summarizeTurns(records:any[]){const turns=new Map<string,any>();let current:string|undefined;
 const events=[...new Map(records.map(r=>[r.event.seq,r.event])).values()].sort((a,b)=>a.seq-b.seq);
 for(const e of events){const d=e.data||{};if(e.type==='turn/start')current=String(d.turn??e.seq);const key=d.turn!==undefined?String(d.turn):current;if(key===undefined)continue;
  if(!turns.has(key))turns.set(key,{id:key,steps:new Set(),tools:new Set(),requests:0,input:0,output:0,cache:0,missingUsage:false,status:'running'});const t=turns.get(key);
  if(e.type==='turn/start')t.start=e.time;
  if(e.type==='step/start')t.steps.add(String(d.step??e.seq));
  if(e.type==='tool/call'||e.type==='tool/ptc-dispatch-start')t.tools.add(d.subCallId||d.callId||e.seq);
  if(['assistant/message','assistant/attempt'].includes(e.type)){t.requests++;const u=d.usage;const fields=['inputTokens','cacheReadTokens','cacheWriteTokens','outputTokens'];if(!u||fields.some(k=>typeof u[k]!=='number'||!Number.isFinite(u[k])||u[k]<0)){t.missingUsage=true;}else{t.input+=u.inputTokens+u.cacheReadTokens+u.cacheWriteTokens;t.cache+=u.cacheReadTokens;t.output+=u.outputTokens;}}
  if(e.type==='turn/end'){t.end=e.time;t.status=d.reason?.type||d.reason?.kind||'completed';current=undefined;}
 }
 return [...turns.values()].map(t=>({...t,steps:t.steps.size,tools:t.tools.size,partial:t.start===undefined,elapsed:t.start!==undefined&&t.end!==undefined?Math.max(0,t.end-t.start):null}));
}
