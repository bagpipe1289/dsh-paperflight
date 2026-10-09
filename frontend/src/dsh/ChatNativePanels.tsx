import {TurnActivity} from './TurnActivity'
import {useDisplay} from './DisplayPreferences'
import {L,useDshLocale} from './locale'
import {useEffect,useState} from 'react'
import {Button} from '@/components/ui/button'
import {useLoad,Status} from './Management'
import {dsh} from './api'
import {confirmAction} from './confirm'
import {SessionTools} from './V5Pages'
const count=(n:unknown)=>typeof n==='number'?n.toLocaleString('zh-CN'):'—'
export function SessionStatsPanel({sessionId}:{sessionId:string}){useDshLocale();
 const display=useDisplay();const s=useLoad<any>('v5/state?sessionId='+encodeURIComponent(sessionId));useEffect(()=>{const t=setInterval(s.refresh,3000);return()=>clearInterval(t)},[])
 const v=s.data?.values,stats=v?.sessionStats,u=v?.tokenUsage,p=v?.contextPressure,b=v?.contextBreakdown
 const input=u?u.uncachedInputTokens+u.cacheReadTokens+u.cacheWriteTokens:0,total=u?input+u.outputTokens:undefined,used=p?.projectedTokens??p?.pressureTokens
 const percent=typeof used==='number'&&p?.contextWindow>0?Math.min(100,Math.round(100*used/p.contextWindow)):null
 if(display.performanceUsage==='compact')return <div className="dsh-chat-action-list"><Status error={s.error}/><p>{L('生成速度：')}{stats?.decodeMs>0?(1000*stats.decodeTokens/stats.decodeMs).toFixed(1)+' tok/s':'—'}</p><p>{L('缓存命中：')}{input>0?(100*u.cacheReadTokens/input).toFixed(1)+'%':'—'}</p><p className="text-xs">{L('简洁用量模式；完整统计仍保留，可在通用设置中切换。')}</p></div>;
 return <div className="dsh-chat-action-list"><Status error={s.error} loading={s.loading&&!s.data}/><div className="dsh-chat-stat"><span>{L("会话进度")}</span><strong>{count(stats?.turns)} {L("轮 ·")}{count(stats?.steps)} {L("步")}</strong><span>{L("生成速度：")}{stats?.decodeMs>0?(1000*stats.decodeTokens/stats.decodeMs).toFixed(1)+' tok/s':'—'}</span><span>{L("模型用时：")}{stats? (stats.llmMs/1000).toFixed(1)+L(" 秒"):'—'}</span><span>{L("工具用时：")}{stats? (stats.toolMs/1000).toFixed(1)+L(" 秒"):'—'}</span></div><div className="dsh-chat-stat"><span>{L("累计 Token")}</span><strong>{count(total)}</strong><span>{L("输入")}{u?count(input):'—'} {L("· 输出")}{count(u?.outputTokens)}</span><span>{L("缓存命中：")}{input>0?(100*u.cacheReadTokens/input).toFixed(1)+'%':'—'}</span></div><div className="dsh-chat-stat"><span>{L("上下文占用")}</span><strong>{percent===null?'—':percent+'%'}</strong>{percent!==null&&<progress aria-label={L("上下文占用")} max={100} value={percent} className="w-full"/>}<span>{count(used)} / {count(p?.contextWindow)} Token</span><span>{L("系统")}{count(b?.systemTokens)} {L("· 工具")}{count(b?.toolsTokens)} {L("· 消息")}{count(b?.messageTokens)}</span></div><p className="text-xs text-muted-foreground">{L("读取当前会话原生统计；上下文为原生估计值，累计 Token 不是账号账单。")}</p><TurnActivity sessionId={sessionId}/></div>
}
export function PermissionPanel({sessionId}:{sessionId:string}){useDshLocale();
 const state=useLoad<any>('v5/state?sessionId='+encodeURIComponent(sessionId)),catalog=useLoad<any>('v6/permissions')
 const[value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const names:Record<string,string>={'read-only':'只读','workspace-write':'工作区内修改','danger-full-access':'完全访问'}
 async function apply(){if(!value)return;const full=value==='danger-full-access';if(!await confirmAction(full?'切换为完全访问？这会解除沙盒范围限制，原生预设也可能不再询问工具审批。仅在信任当前会话时继续。':'将当前会话权限切换为“'+(names[value]||value)+'”？'))return;setBusy(true);setError('');try{await dsh('v6/permission',{sessionId,value,confirm:true,acceptFullAccess:full});state.refresh();setMessage('权限策略已更新')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="dsh-chat-sidebar-controls"><Status error={error||state.error||catalog.error}/><p>{L("当前：")}{names[state.data?.values?.permissions?.currentValue]||state.data?.values?.permissions?.currentValue||L("读取中")}</p><label>{L("权限策略")}<select aria-label={L("权限策略")} className="border bg-background" value={value||state.data?.values?.permissions?.currentValue||''} onChange={e=>{setValue(e.target.value);setMessage('')}}><option value="" disabled>{L("选择策略")}</option>{catalog.data?.options.map((p:any)=><option key={p.value} value={p.value}>{names[p.value]||p.name}</option>)}</select></label><p className="text-xs text-muted-foreground">{L("预设同时控制沙盒范围和审批策略。只读用于查看；工作区内修改用于当前目录内操作；完全访问会扩大权限。")}</p><Button disabled={busy||!value} onClick={()=>void apply()}>{L("应用权限策略")}</Button>{message&&<p role="status">{message}</p>}</div>
}
export function CommandsPanel({sessionId,command,onCommand,onSection,onInsert}:{sessionId:string;command:string;onCommand:(s:string)=>void;onSection:(s:string)=>void;onInsert:(s:string)=>void}){useDshLocale();
 const[revision,setRevision]=useState(0)
 return <><div className="dsh-chat-action-list"><p className="text-xs text-muted-foreground">{L("选择后编辑并确认执行。")}</p>{[['goal',L("目标")],['plan',L("计划")],['feedback','反馈'],['compact','压缩上下文']].map(([id,name])=><Button key={id} variant="outline" onClick={()=>{onCommand('/'+id+' ');setRevision(r=>r+1)}}>{name} · /{id}</Button>)}<Button variant="outline" onClick={()=>onSection('permission')}>{L("权限 · /permission")}</Button><Button variant="outline" onClick={()=>onSection('current')}>{L("模型 · /model")}</Button><Button variant="outline" asChild><a href={'/api/dsh/v6/export?sessionId='+encodeURIComponent(sessionId)} download>{L("下载日志 ZIP · /export")}</a></Button></div><SessionTools key={command+revision} sessionId={sessionId} initialCommand={command} onInsert={onInsert}/></>
}
