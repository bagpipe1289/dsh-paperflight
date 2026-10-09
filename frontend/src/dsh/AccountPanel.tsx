import {L,useDshLocale} from './locale'
import {AccountBonuses} from './AccountBonuses'
import {useEffect,useRef,useState} from 'react'
import {ExternalLink,LogIn,LogOut,RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card'
import {dsh} from './api'
import {confirmAction} from './confirm'

const pendingPhases=['initializing','waiting-browser','exchanging','committing']
const phaseNames:Record<string,string>={initializing:'正在准备登录…','waiting-browser':'等待你在官方页面完成登录授权',exchanging:'正在验证授权…',committing:'正在保存授权…',succeeded:'登录授权已完成',cancelled:'已取消登录',expired:'登录链接已过期，请重新登录',failed:'登录未完成，请重试'}
const failureNames:Record<string,string>={network:'连接官方服务失败，请检查网络后重试。',protocol:'官方授权响应异常，请重试。',expired:'授权已过期，请重新登录。',storage:'授权保存失败，请检查 DSH 凭据存储。'}
export function officialAccountLink(value:unknown,path?:string){
 if(typeof value!=='string')return undefined
 try{const u=new URL(value);return u.origin==='https://platform.deepseek.com'&&!u.username&&!u.password&&(!path||u.pathname===path)?u.href:undefined}catch{return undefined}
}
export function AccountPanel(){
 useDshLocale()
 const[state,setState]=useState<any>(null),[details,setDetails]=useState<any>(null),[error,setError]=useState(''),[actionError,setActionError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0)
 const detailsKey=useRef(''),operation=useRef(0)
 useEffect(()=>{
  let alive=true,timer:ReturnType<typeof setTimeout>;detailsKey.current=''
  async function poll(){const generation=operation.current;let delay=4000
   try{
    const next=await dsh<any>('account/state');if(!alive||generation!==operation.current)return
    setState(next);setError('');delay=pendingPhases.includes(next.attempt?.phase)?1500:10000
    const key=next.status+':'+(next.attempt?.id||'')+':'+(next.attempt?.phase||'')
    if(detailsKey.current!==key){detailsKey.current=key;setDetails(null);if(next.status==='credential-stored'){const value=await dsh<any>('account');if(alive&&generation===operation.current)setDetails(value)}}
   }catch(e){if(alive&&generation===operation.current)setError((e as Error).message)}
   finally{if(alive)timer=setTimeout(()=>void poll(),delay)}
  }
  void poll();const focus=()=>setRevision(n=>n+1);window.addEventListener('focus',focus)
  return()=>{alive=false;clearTimeout(timer);window.removeEventListener('focus',focus)}
 },[revision])
 async function act(action:string){
  if(action==='signout'&&!await confirmAction('退出 DeepSeek 账号？这会移除当前 DSH 保存的账号授权，并停止通过此账号运行的任务。本验证版与本机 DSH 共用凭据，其他使用同一授权的窗口也可能受影响。API Key 配置会保留。'))return
  setBusy(true);setActionError('');operation.current++
  try{const next=await dsh<any>('account/action',{action,...(action==='cancel'?{attemptId:state.attempt.id}:{}),...(action==='signout'?{confirm:true}:{})});setState(next);if(next.status!=='credential-stored')setDetails(null)}catch(e){setActionError((e as Error).message)}finally{setBusy(false);setRevision(n=>n+1)}
 }
 const attempt=state?.attempt,waiting=pendingPhases.includes(attempt?.phase),stored=state?.status==='credential-stored'
 const authorizeUrl=officialAccountLink(attempt?.authorizeUrl,'/dsh/authorize')
 const usageUrl=officialAccountLink(state?.links?.usageUrl)||'https://platform.deepseek.com/usage'
 return <Card><CardHeader><CardTitle>{L("DeepSeek 账号")}</CardTitle></CardHeader><CardContent className="space-y-4">
  <p>{!state?L("正在读取账号状态…"):stored?L("已保存账号授权"): L("未登录账号；API Key 模型可独立使用")}</p>
  {(actionError||error)&&<p role="alert" className="text-destructive text-sm break-words">{actionError||error}</p>}
  <div className="flex flex-wrap gap-2">
   {!stored&&!waiting&&<Button disabled={busy||!state} onClick={()=>void act('start')}><LogIn className="mr-2 h-4 w-4"/>{L("登录 DeepSeek")}</Button>}
   {stored&&!waiting&&<Button variant="outline" disabled={busy} onClick={()=>void act('signout')}><LogOut className="mr-2 h-4 w-4"/>{L("退出账号")}</Button>}
   <Button variant="outline" disabled={busy} onClick={()=>setRevision(n=>n+1)}><RefreshCw className="mr-2 h-4 w-4"/>{L("刷新账号")}</Button>
  </div>
  {attempt&&<div className="space-y-3 border p-3" aria-label={L("DeepSeek 登录进度")}><p role="status">{phaseNames[attempt.phase]||L("正在读取登录进度…")}</p>{attempt.phase==='failed'&&<p className="text-sm text-destructive">{failureNames[attempt.errorCode]||L("请重新登录或在原生界面检查账号状态。")}</p>}
   {attempt.phase==='waiting-browser'&&<><p className="text-sm">{L("在新页面完成登录和授权后，返回这里即可自动更新账号状态。")}</p>{authorizeUrl?<Button asChild><a href={authorizeUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4"/>{L("打开官方登录页")}</a></Button>:<p role="alert">{L("未取得有效的官方登录链接，请取消后重试。")}</p>}{attempt.expiresAt&&<p className="text-xs text-muted-foreground">{L("链接有效至")}{new Date(attempt.expiresAt).toLocaleTimeString()}</p>}</>}
   {waiting&&<Button variant="outline" disabled={busy||attempt.phase==='committing'} onClick={()=>void act('cancel')}>{L("取消登录")}</Button>}
  </div>}
  {stored&&<AccountBonuses key={revision}/>}
  {details?.profile?.status==='ready'&&<p>{details.profile.value.name||L("DeepSeek 用户")} {details.profile.value.contact||''}</p>}
  {details?.balance?.status==='ready'?<div className="grid gap-3 sm:grid-cols-2"><div><p className="text-muted-foreground text-sm">{L("充值余额")}</p>{details.balance.value.map((w:any)=><p key={w.currency}>{w.balance} {w.currency}</p>)}</div><div><p className="text-muted-foreground text-sm">{L("赠送额度")}</p>{details.balance.bonusWallets.map((w:any)=><p key={w.currency}>{w.balance} {w.currency}</p>)}</div></div>:<p className="text-sm text-muted-foreground">{stored?(details?L('余额暂不可用，可刷新重试。'):L('正在读取账号资料和余额…')):L("登录后可查询账号余额。")}</p>}
  <p className="text-xs text-muted-foreground">{L("密码和验证码只在 DeepSeek 官方页面填写。账号余额与本地会话统计分别展示。")}</p><p className="text-xs text-muted-foreground">{L("本验证版与本机 DSH 共用账号凭据，登录和退出会同步影响该授权。")}</p>
  <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={usageUrl} target="_blank" rel="noreferrer">{L("官方用量与消费明细")}</a></Button><Button asChild variant="outline"><a href="/api/dsh/native" target="_blank" rel="noreferrer">{L("打开原生账号与密钥设置")}</a></Button></div>
 </CardContent></Card>
}
