import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {dsh} from './api'
import {usePendingInteractions} from './ConversationPanels'

export function RememberedPermissions({sessionId,inbox}:{sessionId:string;inbox:ReturnType<typeof usePendingInteractions>}){
 const[busy,B]=useState(false),[error,E]=useState('');
 const rules=(inbox.state.rememberedRules||[]).filter((r:any)=>r.sessionId===sessionId);
 async function revoke(ruleId?:string){B(true);E('');try{await dsh('v10/answer',{action:ruleId?'revoke-remembered':'clear-remembered',sessionId,ruleId})}catch(e){E((e as Error).message)}finally{B(false)}}
 return <section className="mt-4 border-t pt-3 space-y-3" aria-label="已记住的权限"><h3 className="font-bold">已记住的权限 · {rules.length}</h3><p className="text-xs text-muted-foreground">仅本会话、仅当前服务运行期间有效。撤销后下次匹配操作会重新申请，不会中断已经执行的操作。CMD 的底层 PowerShell 或宿主沙箱仍可单独要求审批。</p>{error&&<p role="alert">{error}</p>}{!rules.length&&<p className="text-sm">本会话尚未记住权限。</p>}{rules.map((r:any)=><article key={r.id} className="border p-3 space-y-2"><strong>{r.tool}</strong><p className="text-sm">{r.scope==='browse-origin'?`同一网站浏览：${r.origin}（打开、刷新、滚动，不含点击或输入）`:'仅相同操作与作用范围'}</p><p className="text-xs">记住于 {new Date(r.createdAt).toLocaleString()} · 已复用 {r.uses} 次</p><details><summary>查看授权依据与参数</summary><pre className="text-xs whitespace-pre-wrap break-all max-h-60 overflow-auto">{r.reason+'\n\n'+r.arguments}</pre></details><Button size="sm" variant="outline" disabled={busy} onClick={()=>void revoke(r.id)}>撤销此项权限</Button></article>)}{!!rules.length&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void revoke()}>撤销本会话全部记忆</Button>}</section>
}
