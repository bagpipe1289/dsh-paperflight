import {L,useDshLocale} from './locale'
import {useCallback,useEffect,useRef,useState} from 'react'
import {RefreshCw} from 'lucide-react'
import {dsh} from './api'
interface Usage {status:string;totals?:{currency:string;amount:string}[];updatedAt?:number;reason?:string}
export function AccountSpend(){
 const [usage,setUsage]=useState<Usage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 const generation=useRef(0),inflight=useRef<number|null>(null);
 const refresh=useCallback(async()=>{
  if(inflight.current!==null)return;const id=++generation.current;inflight.current=id;setLoading(true);
  // Clear the displayed total until this request confirms the current account.
  setUsage(null);setError(false);
  try{const result=await dsh<Usage>('account/usage');if(id===generation.current)setUsage(result)}catch{if(id===generation.current)setError(true)}finally{if(inflight.current===id)inflight.current=null;if(id===generation.current)setLoading(false)}
 },[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},60000);const onFocus=()=>void refresh();const onVisibility=()=>{if(document.visibilityState==='visible')void refresh()};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisibility);return()=>{generation.current++;inflight.current=null;clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility)}},[refresh]);
 const ready=usage?.status==='ready';
 return <div data-home-summary-primary="true" aria-label={L("账号累计消费")} className="flex min-h-0 min-w-0 flex-col justify-center px-3 py-1">
  <div className="flex items-center gap-2" title={L("官方账号全部历史累计消费，不随 24 小时、7 天或 30 天筛选变化")}><span className="text-muted-foreground truncate text-xs font-bold">{L("账号累计消费")}</span><button aria-label={L("刷新累计消费")} title={L("读取官方账号累计消费")} type="button" disabled={loading} onClick={()=>void refresh()} className="shrink-0 cursor-pointer disabled:opacity-50"><RefreshCw className={'h-3 w-3 '+(loading?'animate-spin':'')}/></button></div>
  <div className={"text-primary mt-1 shrink-0 truncate leading-none font-black tracking-[-0.04em] tabular-nums "+((usage?.totals?.length||0)>1?"text-base":"text-3xl")} role="status">
   {ready?usage.totals?.map(t=><div key={t.currency} title={`${t.amount} ${t.currency}`}>{t.currency==='CNY'?'¥':'$'}{Number(t.amount).toFixed(2)} <span className="text-xs tracking-normal">{t.currency}</span></div>):loading?L("读取中"):error?L("读取失败"):usage?.status==='signed-out'?L("未登录"):L("暂不可用")}
  </div>
 </div>
}
