import {L,useDshLocale} from './locale'
import {useState} from 'react'
import {ArchiveRestore,Bot,Search,Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {dsh} from './api'
import {useModelIdentity} from './modelIdentity'
export function ArchivedSessions({rows,onRestored}:{rows:any[];onRestored:(id:string)=>Promise<void>}){useDshLocale();const modelIdentity=useModelIdentity();
 const[query,setQuery]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('')
 async function restore(id:string){setBusy(id);setError('');try{await dsh('session-action',{sessionId:id,action:'restore'});await onRestored(id)}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 const matches=rows.filter(r=>r.title.toLowerCase().includes(query.trim().toLowerCase()))
 return <div className="space-y-3 p-3"><p className="text-xs text-muted-foreground">{L("已归档")}{rows.length} {L("个会话。取消归档后可以继续对话。")}</p><div className="flex items-center gap-2"><Search className="h-4 w-4 shrink-0"/><Input aria-label={L("搜索已归档会话")} placeholder={L("搜索已归档会话")} value={query} onChange={e=>setQuery(e.target.value)}/></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 {matches.map(row=>{const identity=modelIdentity(row.projections?.values.modelSelection?.next);return <article key={row.sessionId} className="space-y-2 border p-3" aria-label={'已归档会话：'+row.title}><div className="flex items-center gap-2">{identity.showAvatar&&(identity.avatar?<img src={identity.avatar} alt={identity.name+' 头像'} className="h-9 w-9 shrink-0 object-contain"/>:<Bot className="h-8 w-8 shrink-0"/>)}<p className="min-w-0 break-words text-sm font-medium">{row.title}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>void restore(row.sessionId)}><ArchiveRestore className="mr-1 h-4 w-4"/>{busy===row.sessionId?L("正在恢复…"):L("取消归档")}</Button><Button size="sm" variant="outline" disabled aria-describedby="archive-delete-note"><Trash2 className="mr-1 h-4 w-4"/>{L("永久删除")}</Button></div></article>})}
 {!matches.length&&<p className="py-6 text-center text-sm text-muted-foreground">{rows.length?L("没有匹配的归档会话"):L("暂无已归档会话")}</p>}
 <p id="archive-delete-note" className="text-xs text-muted-foreground">{L("永久删除暂未接入：当前 DSH 没有会话删除接口，需补齐记录、索引和子代理关联的清理后才能启用。")}</p></div>
}
