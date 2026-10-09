import {useCallback,useState} from 'react'
import type {ReleaseStatus} from '../types'
import type {VersionCompatibilityResult} from '@/lib/version-compatibility-api'
export interface CustomHitokoto{id:string;content:string;source:string}
export interface HitokotoSettings{defaultEnabled:boolean;customItems:CustomHitokoto[]}
export function useMaibotVersion(){
const[hitokotoSettings,setSettings]=useState<HitokotoSettings>(()=>{try{return JSON.parse(localStorage.getItem('dsh-quote')||'null')||{defaultEnabled:true,customItems:[]}}catch{return{defaultEnabled:true,customItems:[]}}})
const saveHitokotoSettings=useCallback(async(s:HitokotoSettings)=>{setSettings(s);localStorage.setItem('dsh-quote',JSON.stringify(s))},[])
const first=hitokotoSettings.customItems[0]
return{hitokoto:{hitokoto:first?.content||'当前 DSH 空间会话统计（分叉分别计数）。请求数含工具步骤；累计消费为账号全部历史；运行时间仅计本次服务启动。',from:first?.source||'DSH × MaiBot'},hitokotoLoading:false,hitokotoSettings,maibotStableRelease:null as ReleaseStatus|null,versionCompatibility:null as VersionCompatibilityResult|null,fetchHitokoto:useCallback(async()=>{},[]),saveHitokotoSettings}}
