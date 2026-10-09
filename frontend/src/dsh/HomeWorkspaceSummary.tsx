import {Archive,ArrowUpRight,Blocks,MessagesSquare,Radio} from 'lucide-react'
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card'
import {Status,useLoad,type SessionRow} from './Management'
export function HomeWorkspaceSummary(){
 const sessions=useLoad<{items:SessionRow[]}>('sessions'),plugins=useLoad<any>('plugins')
 const counts=[
  {label:'会话',value:sessions.data?.items.filter(s=>!s.archived).length,icon:MessagesSquare},
  {label:'已归档',value:sessions.data?.items.filter(s=>s.archived).length,icon:Archive},
  {label:'运行中',value:sessions.data?.items.filter(s=>s.running).length,icon:Radio},
  {label:'已安装插件',value:plugins.data?.bundles.filter((b:any)=>b.installed).length,icon:Blocks},
 ]
 return <Card className="flex h-full flex-col"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-3 text-base"><Blocks className="h-4 w-4 opacity-60"/>工作区与扩展<span aria-hidden="true" className="ml-auto flex gap-1"><i className="h-1 w-6 bg-primary/60"/><i className="h-1 w-3 bg-primary/30"/><i className="h-1 w-1 bg-primary/20"/></span></CardTitle></CardHeader><CardContent className="flex flex-1 flex-col gap-4"><Status error={sessions.error||plugins.error} loading={sessions.loading||plugins.loading}/><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{counts.map(({label,value,icon:Icon})=><div key={label} className="border-l border-border/50 bg-muted/15 px-3 py-2"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-60"/>{label}</dt><dd className="mt-2 text-xl font-bold tabular-nums text-primary">{value??'—'}</dd></div>)}</dl><div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 border-t border-border/50 pt-3 text-sm"><a className="group flex items-center gap-1 hover:text-primary" href="/chat-management">管理会话与归档<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 opacity-60"/></a><a className="group flex items-center gap-1 hover:text-primary" href="/plugin-workbench">插件工作台<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 opacity-60"/></a></div></CardContent></Card>
}
