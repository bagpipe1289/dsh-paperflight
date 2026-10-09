import {useCallback,useEffect,useState} from 'react'
import {dsh} from './api'
export interface MemoryStatus{installed:boolean;enabled:boolean;state:string;version:string|null;providers?:{id:string;title:string;installed:boolean;enabled:boolean;state:string;version:string|null}[]}
export function useMemoryStatus(){
 const[value,setValue]=useState<MemoryStatus|null>(null),[error,setError]=useState('');
 const refresh=useCallback(()=>{window.dispatchEvent(new Event('dsh-memory-refresh'))},[])
 useEffect(()=>{let alive=true;async function load(){try{const next=await dsh<MemoryStatus>('memory-status');if(alive){setValue(next);setError('')}}catch(e){if(alive){setValue(null);setError((e as Error).message)}}}void load();const timer=setInterval(()=>void load(),15000);const update=()=>void load();window.addEventListener('focus',update);window.addEventListener('dsh-memory-refresh',update);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('dsh-memory-refresh',update)}},[])
 return{value,error,refresh}
}
