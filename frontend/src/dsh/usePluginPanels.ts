import {useEffect,useState} from 'react'
import {dsh} from './api'
import type {InstalledPanel} from './plugin-navigation'
export function usePluginPanels(){
 const [panels,setPanels]=useState<InstalledPanel[]|null>(null)
 useEffect(()=>{
  let alive=true, pending=false
  const load=async()=>{if(pending)return;pending=true;try{const data=await dsh<{items:InstalledPanel[]}>('plugin-pages');if(alive)setPanels(data.items)}catch{/* Preserve the last confirmed inventory during a brief disconnect. */}finally{pending=false}}
  void load();const timer=setInterval(()=>void load(),5000)
  const events=['focus','dsh-reconnect','dsh-memory-refresh','dsh-plugins-changed']
  events.forEach(event=>window.addEventListener(event,load))
  return()=>{alive=false;clearInterval(timer);events.forEach(event=>window.removeEventListener(event,load))}
 },[])
 return panels
}
