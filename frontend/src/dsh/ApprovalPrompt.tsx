import {useEffect,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {PendingCards,usePendingInteractions} from './ConversationPanels'
import {L} from './locale'

export function ApprovalPrompt({inbox,sessionId,onPlan}:{inbox:ReturnType<typeof usePendingInteractions>;sessionId:string;onPlan:(p:any)=>void}){
 const[open,O]=useState(false),seen=useRef(new Set<string>());
 const items=inbox.state.items||[],signature=JSON.stringify(items.map((f:any)=>f.eventId));
 useEffect(()=>{const ids=JSON.parse(signature) as string[];if(ids.some(id=>!seen.current.has(id)))O(true);if(!ids.length)O(false);seen.current=new Set(ids)},[signature]);
 return <section className="shrink-0 min-h-0" aria-label={L('审批与提问')}>
 {(items.length>0||inbox.state.error||inbox.state.expired)&&<div className="border-b p-2 flex flex-wrap items-center gap-2" role={items.length?'alert':'status'}>
 <strong>{items.length?L('需要你确认')+' · '+items.length:inbox.state.error|| (inbox.state.expired?L('登录凭据已失效'):'')}</strong>
 {items.length>0&&<Button size="sm" aria-expanded={open} aria-controls="dsh-approval-drawer" onClick={()=>O(v=>!v)}>{L(open?'暂时折叠':'展开审批与提问')}</Button>}

 </div>}
 <div id="dsh-approval-drawer" hidden={!open||!items.length} className="dsh-approval-drawer border-b border-l-4 border-l-primary bg-background p-3 max-h-[48dvh] overflow-y-auto overscroll-contain" aria-label={L('待确认内容')}>
 <PendingCards inbox={inbox} sessionId={sessionId} onPlan={p=>{O(false);onPlan(p)}}/>
 </div>
 </section>
}
