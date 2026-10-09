import {useCallback,useEffect,useRef,useState} from 'react'
import {dsh} from '@/dsh/api'
import {selectStatistics} from '@/dsh/statistics-selection'
import type {DashboardData} from '../types'
const empty:DashboardData={summary:{total_requests:NaN,total_cost:NaN,total_tokens:NaN,input_tokens:NaN,output_tokens:NaN,cache_hit_tokens:NaN,cache_miss_tokens:NaN,cache_hit_rate:null,chat_cache_hit_tokens:NaN,chat_cache_miss_tokens:NaN,chat_cache_hit_rate:null,online_time:NaN,total_messages:NaN,total_replies:NaN,avg_response_time:NaN,cost_per_hour:NaN,tokens_per_hour:NaN},model_stats:[],hourly_data:[],daily_data:[],recent_activity:[]}
const requests=new Map<number,{at:number;promise:Promise<DashboardData>}>()
function loadStatistics(hours:number,force=false){
 let entry=requests.get(hours)
 if(force||!entry||Date.now()-entry.at>10000){
  entry={at:Date.now(),promise:dsh<DashboardData&{truncated:boolean}>('statistics?hours='+hours).then(r=>{if(r.truncated)throw new Error('历史过大，统计尚不完整，请使用原生界面核对');return r})}
  requests.set(hours,entry)
 }
 return entry.promise
}
export function useDashboardData(){
 const[manual,setManual]=useState<number|null>(null),[timeRange,showRange]=useState(24),[dashboardData,setData]=useState<DashboardData>(empty),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true)
 const generation=useRef(0),initialLoadFinished=useRef(false)
 const setTimeRange=useCallback((hours:number)=>{if(manual===hours)return;generation.current++;setManual(hours);showRange(hours);setData(empty)},[manual])
 const fetchDashboardData=useCallback(async(force=false)=>{
  const current=++generation.current;if(!initialLoadFinished.current)setLoading(true);setError(null)
  try{
   const selected=await selectStatistics(hours=>loadStatistics(hours,force),manual)
   if(current===generation.current){showRange(selected.hours);setData(selected.data)}
  }catch(e){if(current===generation.current)setError((e as Error).message)}
  finally{if(current===generation.current){initialLoadFinished.current=true;setLoading(false)}}
 },[manual])
 useEffect(()=>{void fetchDashboardData();const timer=setInterval(()=>void fetchDashboardData(),30000);return()=>{generation.current++;clearInterval(timer)}},[fetchDashboardData])
 return{dashboardData,error,loading,loadingProgress:loading?0:100,timeRange,setTimeRange,fetchDashboardData}
}
