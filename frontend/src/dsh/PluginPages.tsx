import {L,useDshLocale} from './locale'
import {useState} from 'react'
import {ChevronDown,Terminal,Workflow,Bot,Search,Shield,Store} from 'lucide-react'
import {Link} from '@tanstack/react-router'
import {Panel,Status,Refresh,useLoad,SettingCard,type SettingsData} from './Management'
import {Button} from '@/components/ui/button'
const official=[
 {id:'terminal',name:'终端',Icon:Terminal,description:'限制每条命令的运行时间、直接输出和溢出文件大小。',namespaces:['pwsh-sandbox']},
 {id:'loop',name:'Agent 循环',Icon:Workflow,description:'控制 Agent 同时派发工具调用的数量。',namespaces:['agent-loop']},
 {id:'subagent',name:'子智能体',Icon:Bot,description:'设置子代理的递归深度、并行数量和可用模型。',namespaces:['subagent','subagent-model-selection-settings']},
 {id:'search',name:'网页搜索',Icon:Search,description:'设置 DeepSeek 搜索模型、输出 Token 和调用次数。',namespaces:['web-search-deepseek']},
]
export function OfficialPluginsPage(){useDshLocale();
 const state=useLoad<SettingsData>('settings');
 return <Panel title={L("官方插件")} description={L("DSH 内置功能的配置入口。社区插件请前往插件市场。")} actions={<Refresh onClick={state.refresh}/>}><Status error={state.error} loading={state.loading}/><p className="text-sm text-muted-foreground">{L("官方 ·")}{official.length}</p><div className="grid gap-4 md:grid-cols-2">{official.map(p=><div key={p.id} className="flex gap-4 border bg-card p-5 shadow-sm"><p.Icon className="h-10 w-10 shrink-0 text-primary"/><div className="min-w-0 space-y-3"><h2 className="text-lg font-bold">{p.name}</h2><p className="text-sm text-muted-foreground">{p.description}</p><Button variant="outline" asChild><Link to="/mcp-settings" search={{plugin:p.id} as any}>{L("配置")}</Link></Button>{state.data&&!p.namespaces.every(ns=>state.data?.namespaces.some(n=>n.ns===ns))&&<p className="text-sm">{L("部分设置未由当前 DSH 提供。")}</p>}</div></div>)}</div><Button variant="outline" asChild><Link to="/plugins">{L("浏览社区插件市场")}</Link></Button></Panel>
}
function Group({title,Icon,initial,children}:{title:string;Icon:typeof Bot;initial?:boolean;children:React.ReactNode}){useDshLocale();
 const[open,setOpen]=useState(!!initial),[visited,setVisited]=useState(!!initial);
 return <section className="border bg-card shadow-sm"><button type="button" className="flex w-full items-center gap-3 p-4 text-left font-semibold hover:bg-accent" aria-expanded={open} onClick={()=>{setVisited(true);setOpen(!open)}}><ChevronDown className={'h-4 w-4 shrink-0 transition-transform '+(open?'':'-rotate-90')}/><Icon className="h-5 w-5 shrink-0"/>{title}</button>{visited&&<div hidden={!open} className="space-y-4 border-t p-4">{children}</div>}</section>
}
export {NativeSettingsPage as PluginSettingsPage} from './NativeSettings'
function LegacyPluginSettingsPage(){useDshLocale();
 const state=useLoad<SettingsData>('settings');const selected=new URLSearchParams(window.location.search).get('plugin');
 const groups=[...official,{id:'permission',name:'权限策略',Icon:Shield,namespaces:['permission']}];
 return <Panel title={L("插件配置")} description={L("点击插件标题展开设置。保存到当前 DSH 环境，保存前自动备份。")} actions={<Refresh onClick={state.refresh}/>}><Status error={state.error} loading={state.loading}/>{state.data&&groups.map(p=><Group key={p.id} title={p.name} Icon={p.Icon} initial={selected===p.id}>{p.namespaces.map(ns=>{const item=state.data?.namespaces.find(n=>n.ns===ns);return item&&state.data?.editable[ns]?<SettingCard key={ns} item={item} fields={state.data.editable[ns]} refresh={state.refresh}/>:<p key={ns}>{L("当前 DSH 未提供这组可编辑设置。")}</p>})}</Group>)}<Group title={L("插件市场")} Icon={Store}><p className="text-sm text-muted-foreground">{L("市场目录、收藏、安装状态与任务由 dshmarket 提供。此版本没有可迁移的通用参数表单。")}</p><Button variant="outline" asChild><Link to="/plugins">{L("打开插件市场")}</Link></Button></Group><p className="text-sm text-muted-foreground">{L("新安装插件若尚未接入参数表单，仍需在原生设置中配置。")}</p></Panel>
}
