import {L,useDshLocale} from './locale'
import {useEffect,useState} from 'react'
import {ArchiveRestore,Bot,Search,Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {dsh} from './api'
import {useModelIdentity} from './modelIdentity'
import {confirmAction} from './confirm'
export function ArchivedSessions({rows,onRestored,onDeleted}:{rows:any[];onRestored:(id:string)=>Promise<void>;onDeleted:()=>Promise<void>}){useDshLocale();const modelIdentity=useModelIdentity();
 const[query,setQuery]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('')
 const[provider,setProvider]=useState<{available:boolean;reason:string}|null>(null),[notice,setNotice]=useState('')
 const checkProvider=()=>dsh<{available:boolean;reason:string}>('session-deletion').then(setProvider).catch(e=>setProvider({available:false,reason:e.message}))
 useEffect(()=>{void checkProvider()},[])
 async function restore(id:string){setBusy(id);setError('');try{await dsh('session-action',{sessionId:id,action:'restore'});await onRestored(id)}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function remove(row:any){setBusy(row.sessionId);setError('');setNotice('');try{
  const prepared=await dsh<{token:string;total:number;children:number;targets:{sessionId:string;kind:string}[]}>('session-deletion',{action:'prepare',sessionId:row.sessionId})
  if(!await confirmAction(`永久删除“${row.title}”？包含父会话及 ${prepared.children} 条子代理记录，共 ${prepared.total} 条，无法撤销。\n\n${prepared.targets.map(t=>(t.kind==='parent'?'父会话':'子代理')+'：'+t.sessionId).join('\n')}\n\n工作区文件和长期记忆不会删除。`))return
  const result=await dsh<{warning?:string;deletedCount:number}>('session-deletion',{action:'delete',sessionId:row.sessionId,token:prepared.token})
  setNotice(result.warning||`已永久删除 ${result.deletedCount} 条会话记录，并核对记录与索引。`);await onDeleted()
 }catch(e){setError((e as Error).message);await onDeleted()}finally{setBusy('')}}
 const matches=rows.filter(r=>r.title.toLowerCase().includes(query.trim().toLowerCase()))
 return <div className="space-y-3 p-3"><p className="text-xs text-muted-foreground">{L("已归档")}{rows.length} {L("个会话。取消归档后可以继续对话。")}</p><div className="flex items-center gap-2"><Search className="h-4 w-4 shrink-0"/><Input aria-label={L("搜索已归档会话")} placeholder={L("搜索已归档会话")} value={query} onChange={e=>setQuery(e.target.value)}/></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 {notice&&<p role="status" className="text-sm">{notice}</p>}
 <div className="space-y-1 text-xs text-muted-foreground"><p>{provider?(provider.available?'永久删除由社区会话管理插件提供。':provider.reason):'正在检查删除服务…'}</p><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>void checkProvider()}>重新检查删除服务</Button></div>
 {matches.map(row=>{const identity=modelIdentity(row.projections?.values.modelSelection?.next);return <article key={row.sessionId} data-session-id={row.sessionId} className="space-y-2 border p-3" aria-label={'已归档会话：'+row.title}><div className="flex items-center gap-2">{identity.showAvatar&&(identity.avatar?<img src={identity.avatar} alt={identity.name+' 头像'} className="h-9 w-9 shrink-0 object-contain"/>:<Bot className="h-8 w-8 shrink-0"/>)}<p className="min-w-0 break-words text-sm font-medium">{row.title}</p></div><p className="break-all text-xs text-muted-foreground">{row.sessionId}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>void restore(row.sessionId)}><ArchiveRestore className="mr-1 h-4 w-4"/>{L("取消归档")}</Button>{provider?.available&&<Button size="sm" variant="outline" className="text-destructive" disabled={!!busy} onClick={()=>void remove(row)}><Trash2 className="mr-1 h-4 w-4"/>永久删除</Button>}{busy===row.sessionId&&<span role="status" className="text-xs">正在处理…</span>}</div></article>})}
 {!matches.length&&<p className="py-6 text-center text-sm text-muted-foreground">{rows.length?L("没有匹配的归档会话"):L("暂无已归档会话")}</p>}
 <p id="archive-delete-note" className="text-xs text-muted-foreground">归档会保留记录，可随时恢复。永久删除会包含所有层级的子代理，确认时列出范围；普通分叉不会连带删除。整组记录仍被占用时需先重启 DSH。</p></div>
}
