import {useEffect,useSyncExternalStore} from 'react'
import type {ChatMessage} from '@/routes/chat/types'
import {dsh} from './api'

type Submission = {sessionId:string; message:ChatMessage}
// Kept across route changes; exact request IDs, never text, retire local echoes.
let pending:Submission[]=[]
const listeners=new Set<()=>void>()
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}}
const snapshot=()=>pending
function update(next:Submission[]){pending=next;listeners.forEach(fn=>fn())}
export function useSubmissions(sessionId:string,messages:ChatMessage[]){
 const rows=useSyncExternalStore(subscribe,snapshot)
 const observed=new Set(messages.map(m=>m.requestId).filter(Boolean))
 useEffect(()=>{
  const next=pending.filter(p=>p.sessionId!==sessionId||!observed.has(p.message.requestId))
  if(next.length!==pending.length)update(next)
 },[sessionId,messages])
 useEffect(()=>{
  if(!rows.length)return
  let alive=true,busy=false
  const check=async()=>{if(busy)return;busy=true;try{
   for(const id of new Set(pending.map(p=>p.sessionId))){
    try{const state=await dsh<any>('v5/state?sessionId='+encodeURIComponent(id));if(!alive)return
     const ids=new Set(Object.values(state.values?.inbox||{}).flat().map((item:any)=>item.source?.rpcId).filter(Boolean))
     const next=pending.filter(p=>p.sessionId!==id||!ids.has(p.message.requestId));if(next.length!==pending.length)update(next)
    }catch{/* A missed poll is not a rejection and must not trigger a resend. */}
   }
  }finally{busy=false}}
  void check();const timer=setInterval(check,2000);return()=>{alive=false;clearInterval(timer)}
 },[rows.length])
 return {
  messages:rows.filter(p=>p.sessionId===sessionId&&!observed.has(p.message.requestId)).map(p=>p.message),
  begin:(id:string,message:ChatMessage)=>update([...pending,{sessionId:id,message}]),
  settle:(requestId:string,delivery:'accepted'|'unknown'|'rejected')=>update(delivery==='rejected'?pending.filter(p=>p.message.requestId!==requestId):pending.map(p=>p.message.requestId===requestId?{...p,message:{...p.message,delivery}}:p)),
  forget:(requestId:string)=>update(pending.filter(p=>p.message.requestId!==requestId)),
  has:(requestId:string)=>pending.some(p=>p.message.requestId===requestId),
 }
}
