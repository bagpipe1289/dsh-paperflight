import {useCallback,useEffect,useRef,useState} from 'react'
import {useTranslation} from 'react-i18next'
import type {ReleaseStatus} from '../types'
import type {VersionCompatibilityResult} from '@/lib/version-compatibility-api'
export interface CustomHitokoto{id:string;content:string;source:string}
export interface HitokotoSettings{defaultEnabled:boolean;customItems:CustomHitokoto[]}
type Quote={hitokoto:string;from:string}
const defaults:HitokotoSettings={defaultEnabled:true,customItems:[]}
function settings(value:unknown):HitokotoSettings{
 const s=value as Partial<HitokotoSettings>|null
 return {defaultEnabled:s?.defaultEnabled!==false,customItems:Array.isArray(s?.customItems)?s.customItems.filter(x=>typeof x?.id==='string'&&typeof x.content==='string'&&typeof x.source==='string').slice(0,100):[]}
}
export function useMaibotVersion(){
 const {t}=useTranslation()
 const[hitokotoSettings,setSettings]=useState<HitokotoSettings>(()=>{try{return settings(JSON.parse(localStorage.getItem('dsh-quote')||localStorage.getItem('maibot-home-hitokoto-settings-v1')||'null'))}catch{return defaults}})
 const[remote,R]=useState<Quote|null>(null),[hitokotoLoading,B]=useState(false),[turn,T]=useState(0)
 const pending=useRef<AbortController|null>(null)
 const fetchHitokoto=useCallback(async()=>{
  pending.current?.abort();if(!hitokotoSettings.defaultEnabled){pending.current=null;R(null);B(false);return}
  const controller=new AbortController();pending.current=controller;B(true)
  const timeout=setTimeout(()=>controller.abort(),5000)
  try{const r=await fetch('https://v1.hitokoto.cn/',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw new Error('Quote unavailable');const q=await r.json();if(typeof q.hitokoto!=='string'||!q.hitokoto.trim())throw new Error('Invalid quote');if(pending.current===controller)R({hitokoto:q.hitokoto.slice(0,1000),from:String(q.from||q.from_who||t('home.hitokotoFallbackFrom')).slice(0,200)})}
  catch{if(pending.current===controller)R({hitokoto:t('home.hitokotoFallback'),from:t('home.hitokotoFallbackFrom')})}
  finally{clearTimeout(timeout);if(pending.current===controller)B(false)}
 },[hitokotoSettings.defaultEnabled,t])
 useEffect(()=>()=>{const old=pending.current;pending.current=null;old?.abort()},[])
 useEffect(()=>{const timer=setInterval(()=>T(n=>n+1),30000);return()=>clearInterval(timer)},[])
 const saveHitokotoSettings=useCallback(async(value:HitokotoSettings)=>{const next=settings(value);localStorage.setItem('dsh-quote',JSON.stringify(next));setSettings(next);T(0)},[])
 const choices:Quote[]=[...hitokotoSettings.customItems.filter(x=>x.content.trim()).map(x=>({hitokoto:x.content,from:x.source})),...(hitokotoSettings.defaultEnabled&&remote?[remote]:[])]
 return{hitokoto:choices[turn%choices.length]||null,hitokotoLoading:hitokotoLoading&&!choices.length,hitokotoSettings,maibotStableRelease:null as ReleaseStatus|null,versionCompatibility:null as VersionCompatibilityResult|null,fetchHitokoto,saveHitokotoSettings}
}
