import {useState} from 'react'
import {Switch} from '@/components/ui/switch'
import {Button} from '@/components/ui/button'
import {L,useDshLocale} from './locale'
import {customModelAvatar,setCustomModelAvatar,setModelAvatarsEnabled,uploadModelAvatar,useModelAvatarsEnabled,useModelIdentity,type AvatarModel} from './modelIdentity'

export function ModelAvatarSettings(){
 useDshLocale()
 const enabled=useModelAvatarsEnabled(),identity=useModelIdentity()
 const[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function upload(model:AvatarModel,file:File){setBusy(true);setError('');try{await uploadModelAvatar(model,file)}catch(e){setError(L((e as Error).message))}finally{setBusy(false)}}
 function reset(model:AvatarModel){setError('');try{setCustomModelAvatar(model)}catch{setError(L('头像保存失败，请检查浏览器存储空间或权限'))}}
 return <div className="space-y-3 border-t pt-3">
  <div className="flex items-center justify-between gap-3"><label htmlFor="dsh-model-avatars" className="font-medium">{L('模型区分头像')}</label><Switch id="dsh-model-avatars" checked={enabled} onCheckedChange={value=>{try{setModelAvatarsEnabled(value)}catch{setError(L('头像保存失败，请检查浏览器存储空间或权限'))}}}/></div>
  <p className="text-muted-foreground text-sm">{L('适用于会话、回复和子代理。关闭后隐藏模型头像，会话状态点移至标题左侧。')}</p>
  <div className="grid gap-3 sm:grid-cols-2">{(['deepseek','codex'] as const).map(model=>{const info=identity({provider:model}),custom=customModelAvatar(model);return <div key={model} className="flex flex-wrap items-center gap-3 border p-3">
   <img src={custom||'/model-avatars/'+model+'.svg'} alt={info.name+' '+L('头像预览')} className="h-10 w-10 shrink-0 object-contain"/>
   <span className="font-medium">{info.name}</span>
   <label className="min-w-0 text-sm">{L('上传头像')}<input type="file" aria-label={info.name+' '+L('上传头像')} accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon,.ico" disabled={busy} className="block max-w-full text-sm" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(model,file)}}/></label>
   <Button variant="outline" size="sm" disabled={busy||!custom} onClick={()=>reset(model)} aria-label={info.name+' '+L('恢复默认头像')}>{L('恢复默认头像')}</Button>
  </div>})}</div>
  <p className="text-muted-foreground text-xs">{L('支持 PNG、JPEG、WebP、GIF、ICO，最大 2 MB；保存为静态缩略图。仅保存在当前浏览器，不会发送给模型。')}</p>
  {busy&&<p role="status" className="text-sm">{L('正在保存头像…')}</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 </div>
}
