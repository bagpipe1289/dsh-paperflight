import {useEffect,useRef,useState} from 'react'
import {ThumbsUp,ThumbsDown} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog'
import {Panel,Status,useLoad,type SessionRow} from './Management'
import {dsh} from './api'
import {L,useDshLocale} from './locale'
import {feedbackCategories,feedbackMessages} from './feedback-model'
export function FeedbackPage(){
 useDshLocale();const sessions=useLoad<{items:SessionRow[]}>('sessions')
 const [active,A]=useState(''),[records,R]=useState<any[]>([]),[feedback,F]=useState<any[]>([]),[error,E]=useState(''),[message,M]=useState(''),[busy,B]=useState(false),[saving,S]=useState(false),[cursor,C]=useState<number|null>(null),[cut,K]=useState<number>(),[more,H]=useState(false)
 const [target,T]=useState<{id?:string;rating?:string;version?:number|null}|null>(null),[note,N]=useState(''),[category,G]=useState('')
 const current=useRef(active),generation=useRef(0);current.current=active
 useEffect(()=>{if(!active&&sessions.data?.items[0])A(sessions.data.items[0].sessionId)},[sessions.data,active])
 async function load(earlier=false){if(!active)return;const sessionId=active,token=++generation.current;B(true);E('');try{const [h,f]=await Promise.all([dsh<any>('history?sessionId='+encodeURIComponent(sessionId)+(earlier&&cursor!==null?'&beforeSeq='+cursor+'&throughSeq='+cut:'')),dsh<any>('v4/feedback?sessionId='+encodeURIComponent(sessionId))]);if(current.current!==sessionId||token!==generation.current)return;R(old=>earlier?[...h.records,...old]:h.records);C(h.beforeSeq);K(h.throughSeq);H(h.hasMore);F(f.items)}catch(e){if(current.current===sessionId)E((e as Error).message)}finally{if(current.current===sessionId&&token===generation.current)B(false)}}
 useEffect(()=>{R([]);F([]);T(null);M('');void load()},[active])
 function open(id?:string,rating?:string){const item=feedback.find(f=>f.messageId===id);N(item?.note||'');G(item?.category||'');E('');T({id,rating,version:item?.version??null})}
 async function reconcile(){try{const sessionId=active,f=await dsh<any>('v4/feedback?sessionId='+encodeURIComponent(active));if(current.current===sessionId){F(f.items);T(t=>t?{...t,version:f.items.find((x:any)=>x.messageId===t.id)?.version??null}:t)}}catch{}}
 async function choose(id:string,rating:string){const item=feedback.find(f=>f.messageId===id);if(item?.rating!==rating){open(id,rating);return}S(true);E('');try{await dsh('v4/feedback',{action:'delete',request:{sessionId:active,messageId:id,ifVersion:item.version}});M('已撤销评价');await load()}catch(e){E((e as Error).message);await reconcile()}finally{S(false)}}
 async function submit(){if(!target||saving)return;S(true);E('');try{if(target.id)await dsh('v4/feedback',{action:'put',request:{sessionId:active,messageId:target.id,rating:target.rating,ifVersion:target.version,...(note.trim()?{note:note.trim()}:{}),...(category?{category}:{})}});else await dsh('session-feedback',{sessionId:active,...(note.trim()?{text:note.trim()}:{}),...(category?{category}:{})});T(null);M('已提交至 DSH 原生反馈记录');await load()}catch(e){E((e as Error).message);await reconcile()}finally{S(false)}}
 const messages=feedbackMessages(records)
 return <Panel title={L('回复反馈')} description={L('只展示有正文的助手回复。评价、分类和说明与 DSH 原生反馈共享；点击已选评价可撤销。')}>
 <Status error={error||sessions.error} loading={busy}/><p role="status">{message}</p><select disabled={saving} className="bg-background w-full border p-2" aria-label="反馈会话" value={active} onChange={e=>A(e.target.value)}>{sessions.data?.items.map(r=><option key={r.sessionId} value={r.sessionId}>{r.title}</option>)}</select>
 <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy||saving} onClick={()=>void load()}>刷新消息</Button><Button disabled={!active||saving} onClick={()=>open()}>会话整体反馈</Button>{more&&<Button variant="outline" disabled={busy||saving} onClick={()=>void load(true)}>加载更早消息</Button>}</div>
 {!busy&&!messages.length&&<p>当前历史窗口没有可评价的正文回复。</p>}
 {messages.map(m=>{const item=feedback.find(f=>f.messageId===m.id);return <article className="border bg-card p-5 space-y-4" key={m.id}><p className="whitespace-pre-wrap break-words">{m.text}</p><div className="flex items-center gap-2">{(['positive','negative'] as const).map(rating=><Button key={rating} disabled={saving} aria-label={item?.rating===rating?'撤销评价':rating==='positive'?'好的回答':'不好的回答'} aria-pressed={item?.rating===rating} variant={item?.rating===rating?'default':'outline'} onClick={()=>void choose(m.id,rating)}>{rating==='positive'?<ThumbsUp size={18}/>:<ThumbsDown size={18}/>}</Button>)}{item&&<><span className="text-sm">已评价</span><Button disabled={saving} variant="ghost" onClick={()=>open(m.id,item.rating)}>编辑说明</Button></>}</div></article>})}
 <Dialog open={target!==null} onOpenChange={value=>{if(!value&&!saving)T(null)}}><DialogContent><DialogHeader><DialogTitle>提交反馈</DialogTitle><DialogDescription>使用 DSH 官方反馈接口，与当前会话关联。反馈不会加入模型上下文。</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2">{feedbackCategories.map(([id,label])=><Button key={id} disabled={saving} variant={category===id?'default':'outline'} aria-pressed={category===id} onClick={()=>G(category===id?'':id)}>{label}</Button>)}</div><textarea aria-label="反馈说明" disabled={saving} className="min-h-36 w-full border bg-background p-3" placeholder="填写详情（可选）" value={note} onChange={e=>N(e.target.value)}/><Status error={error}/><DialogFooter><Button disabled={saving} variant="outline" onClick={()=>T(null)}>取消</Button><Button disabled={saving} onClick={()=>void submit()}>{saving?'提交中…':'提交'}</Button></DialogFooter></DialogContent></Dialog>
 </Panel>
}
