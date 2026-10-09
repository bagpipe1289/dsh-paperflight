import {useEffect,useRef,useState} from 'react'
import {marketProgress} from './market-progress'
import './market-progress.css'
export function MarketProgress({status}:{status:any}){
 const p=marketProgress(status),[now,N]=useState(Date.now()),last=useRef({key:'',at:Date.now()})
 const key=JSON.stringify([status?.target,status?.phase,status?.done,status?.downloaded,status?.lastLine])
 useEffect(()=>{last.current={key,at:Date.now()}},[key])
 useEffect(()=>{if(!p.running)return;const id=setInterval(()=>N(Date.now()),1000);return()=>clearInterval(id)},[p.running])
 if(!p.running)return null
 const seconds=Math.max(0,Number(status?.seconds)||Math.floor((now-(status?.operation?.startedAt||now))/1000))
 return <div className="space-y-2 border p-4" aria-label="市场安装进度"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{p.phase}</strong><span>{seconds} 秒{p.percent!==null?` · 本阶段 ${p.percent}%`:''}</span></div><div className="market-progress-track" role="progressbar" aria-label="当前安装阶段" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent??undefined} aria-valuetext={p.phase+'，'+p.detail}><div className={p.percent===null?'market-progress-indeterminate':'market-progress-value'} style={p.percent===null?undefined:{width:p.percent+'%'}}/></div><p className="text-xs text-muted-foreground">{p.detail}。阶段完成后仍需等待市场确认安装结果。</p>{status?.currentPackage&&<p className="break-all text-xs">{status.currentPackage}</p>}{now-last.current.at>45000&&<p className="text-sm">进度已有 {Math.floor((now-last.current.at)/1000)} 秒未变化，仍在等待市场。可查看任务日志或取消后重试。</p>}</div>
}
