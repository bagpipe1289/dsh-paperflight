import {L,useDshLocale} from './locale'
import {useState} from 'react'
import {MoreHorizontal,Pin} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog'
import {dsh} from './api'
import {confirmAction} from './confirm'
export function SessionActions({row,onChanged}:{row:{sessionId:string;title:string;pinned?:boolean;blank?:boolean;running:boolean};onChanged:(id?:string)=>Promise<void>}){useDshLocale();
 const[renaming,setRenaming]=useState(false),[title,setTitle]=useState(row.title),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function act(action:string){
  if(action==='archive'&&!await confirmAction('归档“'+row.title+'”？历史会保留，可以从会话管理恢复。'))return
  setBusy(true);setError('');try{const result=await dsh<any>('session-action',{sessionId:row.sessionId,action,...(action==='rename'?{title}:{})});setRenaming(false);await onChanged(action==='fork'?result.sessionId:undefined)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <><span className="flex items-center">{row.pinned&&<Pin aria-label={L("已置顶")} className="h-3 w-3"/>}<DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={'会话操作：'+row.title} title={L("会话操作")} disabled={busy}><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="start" side="right"><DropdownMenuItem onSelect={()=>void act(row.pinned?'unpin':'pin')}>{row.pinned?L("取消置顶"):L("置顶")}</DropdownMenuItem><DropdownMenuItem onSelect={()=>{setTitle(row.title);setError('');setRenaming(true)}}>{L("重命名")}</DropdownMenuItem><DropdownMenuItem disabled={row.running||row.blank} onSelect={()=>void act('fork')}>{L("分叉会话")}</DropdownMenuItem><DropdownMenuItem disabled={row.running} onSelect={()=>void act('archive')}>{L("归档会话")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></span>
 <Dialog open={renaming||!!error} onOpenChange={o=>{if(!o){setRenaming(false);setError('')}}}><DialogContent><DialogHeader><DialogTitle>{renaming?L("重命名会话"):L("操作未完成")}</DialogTitle><DialogDescription>{L("操作同步到 DSH 会话记录。")}</DialogDescription></DialogHeader>{error&&<p role="alert">{error}</p>}{renaming&&<><Input aria-label={L("会话名称")} value={title} maxLength={200} onChange={e=>setTitle(e.target.value)}/><DialogFooter><Button disabled={busy||!title.trim()} onClick={()=>void act('rename')}>{L("保存名称")}</Button></DialogFooter></>}</DialogContent></Dialog></>
}
