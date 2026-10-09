import {useMemo} from 'react'
import i18n from 'i18next'
import {Link} from '@tanstack/react-router'
import {Panel,Refresh,Status,useLoad} from './Management'
import {Button} from '@/components/ui/button'
import {L,useDshLocale} from './locale'
import {dsh} from './api'
import {EngramSection} from './engram/EngramPanel'
import {zh,en,type EngramKey} from './engram/locales'
import {useMemoryStatus} from './useMemoryStatus'
const noopSubscribe=()=>()=>{}
export function MemoryPage(){
 useDshLocale();const status=useMemoryStatus(),w=useLoad<any>('v5/workspaces')
 const services=useMemo(()=>({workspaces:w.data?{list:{getSnapshot:()=>w.data,subscribe:noopSubscribe}}:undefined,sessions:{list:{getSnapshot:()=>({current:localStorage.getItem('dsh-active-session')||undefined}),subscribe:noopSubscribe}}}),[w.data])
 const t=(key:EngramKey,params?:Record<string,unknown>)=>(i18n.language?.startsWith('zh')?zh:en)[key].replace(/\{(\w+)\}/g,(match,k)=>String(params?.[k]??match))
 return <Panel title={L('长期记忆')} actions={<Refresh onClick={()=>{status.refresh();w.refresh()}}/>}>
  <Status error={status.error} loading={!status.value&&!status.error}/>
  {status.value?.providers?.find(p=>p.id==='engram')?.enabled?<div className="dsh-engram"><EngramSection t={t} {...services}/></div>:status.value&&<div className="space-y-3 border p-5"><p>{L(status.value.providers?.find(p=>p.id==='engram')?.installed?'记忆插件尚未启用或未就绪，请在插件管理中检查。':'未安装 Engram 记忆插件，记忆库已禁用。')}</p><Button asChild variant="outline"><Link to="/plugins">{L('管理插件')}</Link></Button></div>}
 </Panel>
}

