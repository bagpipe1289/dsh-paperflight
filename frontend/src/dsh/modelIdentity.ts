import {useSyncExternalStore} from 'react'

const preferenceKey='dsh-model-avatars-enabled'
const preferenceEvent='dsh-model-avatars-change'
export function modelAvatarsEnabled(){try{return localStorage.getItem(preferenceKey)!=='false'}catch{return true}}
export function setModelAvatarsEnabled(enabled:boolean){localStorage.setItem(preferenceKey,String(enabled));window.dispatchEvent(new Event(preferenceEvent))}
function subscribe(callback:()=>void){window.addEventListener(preferenceEvent,callback);window.addEventListener('storage',callback);return()=>{window.removeEventListener(preferenceEvent,callback);window.removeEventListener('storage',callback)}}
export function useModelAvatarsEnabled(){return useSyncExternalStore(subscribe,modelAvatarsEnabled,()=>true)}
export type AvatarModel='deepseek'|'codex'
const customKey=(model:AvatarModel)=>'dsh-model-avatar-'+model
export function customModelAvatar(model:AvatarModel){try{const value=localStorage.getItem(customKey(model));return value&&validAvatar(value)?value:undefined}catch{return undefined}}
function validAvatar(value:string){return value.length<=400000&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)}
export function setCustomModelAvatar(model:AvatarModel,value?:string){
 if(value&&!validAvatar(value))throw new Error('头像数据无效或过大')
 try{if(value)localStorage.setItem(customKey(model),value);else localStorage.removeItem(customKey(model))}catch{throw new Error('头像保存失败，请检查浏览器存储空间或权限')}
 window.dispatchEvent(new Event(preferenceEvent))
}
export async function uploadModelAvatar(model:AvatarModel,file:File){
 if(file.size>2*1024*1024||!(/^(image\/(png|jpeg|webp|gif|x-icon|vnd.microsoft.icon))$/.test(file.type)||/\.ico$/i.test(file.name)&&(!file.type||file.type==='application/octet-stream')))throw new Error('请选择 PNG、JPEG、WebP、GIF 或 ICO 图片，最大 2 MB')
 const url=URL.createObjectURL(file)
 try{
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('图片无法读取，请换一张图片'));img.src=url})
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>16000000)throw new Error('图片尺寸过大，请使用不超过 1600 万像素的图片')
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('图片无法读取，请换一张图片')
  const scale=Math.min(256/image.naturalWidth,256/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale
  ctx.drawImage(image,(256-w)/2,(256-h)/2,w,h)
  setCustomModelAvatar(model,canvas.toDataURL('image/png'))
 }finally{URL.revokeObjectURL(url)}
}
export function useModelIdentity(){
 const enabled=useModelAvatarsEnabled()
 const deepseek=useSyncExternalStore(subscribe,()=>customModelAvatar('deepseek'),()=>undefined)
 const codex=useSyncExternalStore(subscribe,()=>customModelAvatar('codex'),()=>undefined)
 return (source?:ModelSource)=>modelIdentity(source,enabled,{deepseek,codex})
}
export interface ModelSource {provider?: string; model?: string}
// Match recorded routes, never conversation titles or prompt text.
export function modelIdentity(source?: ModelSource,enabled=true,custom:Partial<Record<AvatarModel,string>>={}) {
 const provider=(source?.provider||'').toLowerCase(),model=(source?.model||'').toLowerCase()
 if (/(^|[-_/])codex($|[-_/])/.test(provider)||/(^|[-_/])codex($|[-_/])/.test(model))
  return {name:'Codex',showAvatar:enabled,avatar:enabled?(custom.codex||'/model-avatars/codex.svg'):undefined}
 if (/(^|[-_/])deepseek($|[-_/])/.test(provider)||/^deepseek([-_]|$)/.test(model))
  return {name:'DeepSeek',showAvatar:enabled,avatar:enabled?(custom.deepseek||'/model-avatars/deepseek.svg'):undefined}
 return {name:source?.model||source?.provider||'模型',showAvatar:enabled,avatar:undefined}
}
