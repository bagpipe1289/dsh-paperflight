import {useRef,useState,type HTMLAttributes} from 'react'
import type {DropTarget} from './session-drop'
export function useSessionDrag(onDrop:(id:string,from:string,target:DropTarget)=>void){
 const root=useRef<HTMLDivElement>(null)
 const source=useRef<{id:string;key:string;x:number;y:number;active:boolean}|null>(null)
 const target=useRef<DropTarget|null>(null),commit=useRef(onDrop),suppressClick=useRef(false)
 commit.current=onDrop
 const [dragging,setDragging]=useState(''),[over,setOver]=useState(''),[message,setMessage]=useState('')
 const clear=()=>{source.current=null;target.current=null;setDragging('');setOver('')}
 const locate=(x:number,y:number)=>{
  const node=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-session-drop]')
  if(!node||!root.current?.contains(node)){target.current=null;setOver('');return}
  const key=node.dataset.sessionDrop!,group=node.dataset.dropGroup
  if(group===undefined&&key!==source.current?.key){target.current=null;setOver('');return}
  const rect=node.getBoundingClientRect()
  target.current={key,group,row:node.dataset.dropRow,after:y>rect.top+rect.height/2};setOver(node.dataset.dropRow||key)
  const scroller=root.current?.closest<HTMLElement>('.dsh-chat-section-body')
  if(scroller){const r=scroller.getBoundingClientRect();if(y<r.top+40)scroller.scrollTop-=14;else if(y>r.bottom-40)scroller.scrollTop+=14}
 }
 const bindings=(row:{id:string;label:string},key:string,ids:string[]):HTMLAttributes<HTMLDivElement>=>({
  onDragStartCapture:e=>e.preventDefault(),
  onClickCapture:e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false}},
  onPointerDown:e=>{
   suppressClick.current=false
   const control=(e.target as HTMLElement).closest('button,a,input,select,textarea,[role="menuitem"]')
   if(e.button!==0||(control&&!control.hasAttribute('data-session-select')))return
   clear();source.current={id:row.id,key,x:e.clientX,y:e.clientY,active:false};(control as HTMLElement||e.currentTarget).setPointerCapture(e.pointerId)
  },
  onPointerMove:e=>{
   const s=source.current;if(!s||s.id!==row.id)return
   if(!s.active){
    if(Math.hypot(e.clientX-s.x,e.clientY-s.y)<6)return
    s.active=true;suppressClick.current=true
    setDragging(row.id);setMessage('拖动到会话之间或分组标题，松开完成；Esc 取消。')
   }
   e.preventDefault();locate(e.clientX,e.clientY)
  },
  onPointerUp:e=>{
   const s=source.current
   if(s?.active){locate(e.clientX,e.clientY);if(target.current){commit.current(s.id,s.key,target.current);setMessage('已保存会话排序与分组。')}}
   clear();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
  },
  onPointerCancel:clear,onLostPointerCapture:clear,
  onKeyDown:e=>{
   if(e.key==='Escape'){clear();setMessage('已取消拖动。')}
   if(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')&&(e.target as HTMLElement).hasAttribute('data-session-select')){
    e.preventDefault();const i=ids.indexOf(row.id),to=ids[i+(e.key==='ArrowUp'?-1:1)]
    if(to){commit.current(row.id,key,{key,row:to,after:e.key==='ArrowDown'});setMessage('已调整会话顺序。')}
   }
  }
 })
 return {root,bindings,dragging,over,message,clear}
}
