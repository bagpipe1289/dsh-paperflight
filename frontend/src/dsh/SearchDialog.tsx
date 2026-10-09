import {L,useDshLocale} from './locale'
import {useEffect,useState} from 'react'
import {useNavigate} from '@tanstack/react-router'
import {Search,MessageSquare,Settings2} from 'lucide-react'
import {FloatingPanel} from '@/components/ui/floating-panel'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {dsh} from './api'
const pages=[['首页','/'],['会话管理','/chat-management'],['运行设置','/config/bot'],['模型目录','/config/model'],['Agent 预设','/config/prompts'],['插件目录','/plugins'],['账号与面板设置','/settings'],['执行轨迹','/reasoning-process'],['统计','/statistics'],['子代理监控','/planner-monitor']]
export function SearchDialog({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}){
 const[query,setQuery]=useState(''),[items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');const navigate=useNavigate();
 useEffect(()=>{if(!open)return;let alive=true;setError('');setItems([]);if(!query.trim())return;setLoading(true);const timer=setTimeout(()=>{void dsh<any>('search?q='+encodeURIComponent(query)).then(r=>{if(alive){setItems(r.items.filter((item:any)=>!item.archived));if(r.hasMore)setError('最多展示 20 条结果，请缩小关键词范围')}}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)})},300);return()=>{alive=false;clearTimeout(timer)}},[open,query]);
 const go=(path:string,id?:string)=>{if(id)localStorage.setItem('dsh-active-session',id);onOpenChange(false);if(path==='/chat'&&location.pathname==='/chat'){location.assign('/chat');return}void navigate({to:path})};
 return <FloatingPanel open={open} title={L("搜索 DSH")} onClose={()=>onOpenChange(false)} closeLabel="关闭" className="flex h-[min(calc(100vh-2rem),42rem)] w-[min(calc(100vw-2rem),42rem)] flex-col" initialWidth={672} initialHeight={680} initialTop={88}><div className="border-b px-4 py-3"><Input autoFocus aria-label={L("搜索页面和会话正文")} placeholder={L("搜索页面和会话正文")} value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="flex-1 space-y-3 overflow-auto p-4"><p className="text-muted-foreground text-xs">{L("已接入页面")}</p>{pages.filter(([name])=>!query||name.includes(query)).map(([name,path])=><Button key={path} className="w-full justify-start" variant="ghost" onClick={()=>go(path)}><Settings2 className="mr-2 h-4 w-4"/>{name}</Button>)}{query&&<><p className="text-muted-foreground text-xs">{L("活动会话正文（归档请在会话管理中查询）")}</p>{loading&&<p className="text-sm">{L("正在搜索…")}</p>}{error&&<p role="alert" className="text-destructive text-sm">{error}</p>}{items.map(item=><button key={item.sessionId} className="hover:bg-accent flex w-full items-start gap-3 rounded-md border p-3 text-left" onClick={()=>go('/chat',item.sessionId)}><MessageSquare className="mt-1 h-4 w-4 shrink-0"/><span className="text-sm break-words">{item.snippet}</span></button>)}{!items.length&&!loading&&!error&&<p className="text-muted-foreground text-sm">{L("没有匹配的活动会话正文（归档请在会话管理中查询）")}</p>}</>}</div></FloatingPanel>
}
