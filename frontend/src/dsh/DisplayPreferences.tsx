import {createContext,useContext,useEffect,useState} from 'react'
import {dsh} from './api'
export const defaultDisplay={transcriptView:'standard',performanceUsage:'detailed',linkOpening:'sidebar',developerTools:true,busyEnter:'queue'};
export const DisplayContext=createContext(defaultDisplay);
export const useDisplay=()=>useContext(DisplayContext);
export function useDisplayPreferences(){
 const[value,V]=useState(defaultDisplay);
 useEffect(()=>{let alive=true,busy=false;const read=async()=>{if(busy)return;busy=true;try{const d=await dsh<any>('v11/settings');const get=(ns:string)=>d.namespaces.find((n:any)=>n.ns===ns)?.value||{};const chat=get('ui-chat'),account=get('ui-settings-account'),conversation=get('ui-conversation');if(alive)V({transcriptView:({normal:'standard',expanded:'detailed'} as any)[chat.transcriptView]||chat.transcriptView||'standard',performanceUsage:chat.performanceUsage||'detailed',linkOpening:chat.linkOpening||'sidebar',developerTools:account.developerTools??true,busyEnter:conversation.busyEnter||'queue'})}catch{}finally{busy=false}};void read();const tick=setInterval(()=>{if(document.visibilityState==='visible')void read()},5000);window.addEventListener('focus',read);window.addEventListener('dsh-preferences-changed',read);return()=>{alive=false;clearInterval(tick);window.removeEventListener('focus',read);window.removeEventListener('dsh-preferences-changed',read)}},[]);
 return value;
}
