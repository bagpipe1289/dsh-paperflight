import {enrichEvent} from './rich-events.mjs';
// Adapter state for original MaiBot message components. No upstream data is mutated.
export const textOf=content=>typeof content==='string'?content:Array.isArray(content)?content.flatMap(x=>x?.type==='text'?[x.text||'']:x?.type==='file'&&x.attachment?.name?['[文件：'+x.attachment.name+']']:[]).join('\n'):'';
export function createState(){return{messages:[],running:false,connected:false,error:null,hasMore:false,title:'新会话',attempt:null,cursor:0};}
function upsert(state,message){if(!message.content&&!message.reasoning&&!message.segments?.length)return;const i=state.messages.findIndex(m=>m.id===message.id);if(i<0)state.messages.push(message);else state.messages[i]=message;}
export function reduceEvent(state,event){
  const d=event.data||{},id=String(event.seq),timestamp=(event.time||Date.now())/1000;state.cursor=Math.max(state.cursor,event.seq||0);
  if(event.type==='turn/start'){state.running=true;state.error=null}
  if(event.type==='turn/end'){state.running=false;state.attempt=null;if(d.reason?.type==='error'||d.reason?.kind==='error'){state.error=JSON.stringify(d.reason);upsert(state,{id,type:'error',content:state.error,timestamp})}}
  if(event.type==='user/message'){
    // Synthetic context is not a message authored by the user.
    if(!d.source||d.source==='user'||d.source?.kind==='user'||d.source?.type==='user'||d.source==='prompt'){
      const content=textOf(d.content);const images=Array.isArray(d.content)?d.content.filter(x=>x.type==='image'&&x.attachment?.attachmentId):[];
      const rich=images.length?{message_type:'rich',segments:[...(content?[{type:'text',data:content}]:[]),...images.map(x=>({type:'image',data:'/api/dsh/image?sessionId='+encodeURIComponent(state.sessionId||'')+'&attachmentId='+encodeURIComponent(x.attachment.attachmentId)}))]}:{};
      upsert(state,{id,type:'user',content,timestamp,...rich});if(state.title==='新会话'&&content)state.title=content.slice(0,32);
    }
  }
  if(event.type==='model/selection')state.modelSource={provider:d.provider,model:d.model};
  if(event.type==='assistant/message'){const content=textOf(d.message?.content);const source=d.message?.source;const modelSource=source?{provider:source.provider,model:source.model}:state.modelSource;upsert(state,{id,type:'bot',content,reasoning:(d.message?.content||[]).filter(x=>x.type==='reasoning').map(x=>x.text||'').join(''),timestamp,modelSource});state.attempt=null}
  const enriched=enrichEvent(state,event,textOf);
  if(!enriched&&event.type==='tool/call'){upsert(state,{id:'tool-'+d.callId,workStep:true,type:'system',content:'工具 · '+d.name+'\n'+d.arguments,timestamp})}
  if(!enriched&&event.type==='tool/result'){upsert(state,{id,workStep:true,type:d.message?.isError?'error':'system',content:'工具结果\n'+textOf(d.message?.content),timestamp})}
  if(event.type.includes('error')&&d.message){upsert(state,{id,type:'error',content:typeof d.message==='string'?d.message:JSON.stringify(d.message),timestamp})}
  if(event.type==='session/title'||event.type==='title'){state.title=d.title||d.value||state.title;state.storedTitle=!!(d.title||d.value);}
  state.messages=state.messages.slice(-500);
}
export function applyFrame(state,frame){
  if(frame.type==='snapshot'){
    state.modelSource=undefined;state.messages=[];state.running=false;state.error=null;state.attempt=null;state.cursor=frame.cursor;state.hasMore=frame.hasMore;state.throughSeq=frame.cursor;state.beforeSeq=frame.records?.[0]?.event.seq;state.sessionId=frame.header?.id;
    for(const record of frame.records||[])if(record.type==='event')reduceEvent(state,record.event);
    state.storedTitle=typeof frame.projections?.values?.title==='string'&&!!frame.projections.values.title.trim();
    if(state.storedTitle)state.title=frame.projections.values.title;
    state.modelSource=frame.projections?.values?.modelSelection?.next||state.modelSource;
    const live=frame.assistantStream?.activeAttempt;
    if(live){state.running=true;state.attempt={id:live.attemptId,content:'',reasoning:'',timestamp:Date.now()/1000};for(const rec of live.stream||[]){if(rec.type==='text-chunks')state.attempt.content+=(rec.texts||[]).join('');if(rec.type==='reasoning-chunks')state.attempt.reasoning+=(rec.texts||[]).join('')}}
    state.connected=true;
  }else if(frame.type==='event')reduceEvent(state,frame.event);
  else if(frame.type==='assistant-stream'){
    const f=frame.frame;
    if(f.type==='start'){state.attempt={id:f.attemptId,content:'',reasoning:'',timestamp:Date.now()/1000};state.running=true}
    if(f.type==='chunk'){
      if(!state.attempt||state.attempt.id!==f.attemptId)state.attempt={id:f.attemptId,content:'',reasoning:'',timestamp:f.time/1000};
      if(f.chunk?.type==='text-delta')state.attempt.content+=f.chunk.text||f.chunk.delta||'';
      if(f.chunk?.type==='reasoning-delta')state.attempt.reasoning+=f.chunk.text||f.chunk.delta||'';
      if(f.chunk?.type==='error')state.error=f.chunk.error?.message||JSON.stringify(f.chunk.error);
    }
    if(f.type==='end')state.attempt=null;
  }
  return state;
}
export function viewState(state){const messages=(state.attempt?.content||state.attempt?.reasoning)?[...state.messages,{id:'stream-'+state.attempt.id,type:'bot',content:state.attempt.content,reasoning:state.attempt.reasoning,timestamp:state.attempt.timestamp,modelSource:state.modelSource}]:state.messages;return{...state,attempt:undefined,messages};}
