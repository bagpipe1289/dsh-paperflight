import {useCallback,useEffect,useRef,useState} from 'react'
import {dsh} from '@/dsh/api'
export interface PluginIndicator {enabled:boolean|null;state:string;text:string;detail:string}
interface FeatureStatus {subagent:PluginIndicator;memory:PluginIndicator}
const unknown=(text:string):FeatureStatus=>({subagent:{enabled:null,state:'unknown',text,detail:'子代理状态尚未确认'},memory:{enabled:null,state:'unknown',text,detail:'记忆插件状态尚未确认'}})
export function useFeatureStatus(){
 const[featureStatus,setStatus]=useState<FeatureStatus>(()=>unknown('读取中'));
 const generation=useRef(0),inflight=useRef<number|null>(null);
 const fetchFeatureStatus=useCallback(async()=>{
  if(inflight.current!==null)return;
  const id=++generation.current;inflight.current=id;
  try{const value=await dsh<FeatureStatus>('feature-status');if(id===generation.current)setStatus(value)}
  catch{if(id===generation.current)setStatus(unknown('读取失败'))}
  finally{if(inflight.current===id)inflight.current=null}
 },[]);
 useEffect(()=>{
  void fetchFeatureStatus();const timer=setInterval(()=>{if(document.visibilityState==='visible')void fetchFeatureStatus()},30000);
  const refresh=()=>{if(document.visibilityState==='visible')void fetchFeatureStatus()};
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{generation.current++;inflight.current=null;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}
 },[fetchFeatureStatus]);
 return{featureStatus,fetchFeatureStatus}
}
