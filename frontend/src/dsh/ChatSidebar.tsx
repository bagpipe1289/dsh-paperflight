import {L,useDshLocale} from './locale'
import {useEffect,useRef,useState,type ReactNode,type CSSProperties,type ElementType} from 'react'
import {ChevronLeft,Pin} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Link} from '@tanstack/react-router'
import './chat-sidebar.css'
export interface SidebarSection{id:string;label:string;icon:ElementType;content?:ReactNode;onClick?:()=>void;href?:string;external?:boolean}
export function ChatSidebar({sections,active,onSelect,revealKey=0}:{sections:SidebarSection[];active:string;onSelect:(id:string)=>void;revealKey?:number}){useDshLocale();
 const [pinned,setPinned]=useState(()=>localStorage.getItem('dsh-chat-sidebar-pinned')!=='false')
 const [wide,setWide]=useState(()=>window.matchMedia('(min-width: 1024px)').matches)
 const [peek,setPeek]=useState(false),[resizing,setResizing]=useState(false)
 const [width,setWidth]=useState(()=>Math.max(280,Math.min(560,Number(localStorage.getItem('dsh-chat-sidebar-width'))||320)))
 const resizeStart=useRef({x:0,width:320}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),hoverBlockedUntil=useRef(0)
 useEffect(()=>{if(revealKey)setPeek(true)},[revealKey])
 const rail=useRef<HTMLDivElement>(null)
 const fixed=wide&&pinned,open=fixed||peek,section=sections.find(s=>s.id===active&&s.content!==undefined)||sections[0]
 const cancel=()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null}}
 const close=()=>{hoverBlockedUntil.current=Date.now()+500;cancel();setPeek(false);if(wide){setPinned(false);localStorage.setItem('dsh-chat-sidebar-pinned','false')}requestAnimationFrame(()=>rail.current?.querySelector<HTMLButtonElement>(`[data-section="${section.id}"]`)?.focus())}
 useEffect(()=>{const toggle=(e:Event)=>{if((e as CustomEvent).detail!=='left')return;if(open)close();else setPeek(true)};window.addEventListener('dsh-shortcut',toggle);return()=>window.removeEventListener('dsh-shortcut',toggle)},[open,wide]);
 const resize=(v:number)=>{const next=Math.round(Math.max(280,Math.min(560,window.innerWidth-372,v)));setWidth(next);localStorage.setItem('dsh-chat-sidebar-width',String(next))}
 const reveal=(id:string)=>{cancel();onSelect(id);setPeek(true)}
 useEffect(()=>{const media=window.matchMedia('(min-width: 1024px)');const change=()=>{setWide(media.matches);setPeek(false)};media.addEventListener('change',change);return()=>{media.removeEventListener('change',change);cancel()}},[])
 return <div className="dsh-chat-sidebar-space" data-fixed={fixed} style={{'--chat-sidebar-width':`${width}px`} as CSSProperties} onPointerLeave={()=>{cancel();if(wide&&!fixed&&!resizing){timer.current=setTimeout(()=>{if(!document.querySelector('[role="dialog"],[role="menu"]'))setPeek(false)},220)}}} onPointerEnter={cancel} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close()}}}>
  {open&&!fixed&&<button className="dsh-chat-sidebar-backdrop" aria-label={L("关闭会话侧栏遮罩")} onClick={close}/>}
  <div ref={rail} className="dsh-chat-sidebar-rail" role="navigation" aria-label={L("会话功能分区")}>
   {sections.map(item=>{const Icon=item.icon,contents=<Icon className="h-5 w-5"/>;return item.href?<Button key={item.id} size="icon" variant="ghost" asChild>{item.external?<a href={item.href} target="_blank" rel="noreferrer" aria-label={L(item.label)} title={L(item.label)}>{contents}</a>:<Link to={item.href as '/chat-management'} aria-label={L(item.label)} title={L(item.label)}>{contents}</Link>}</Button>:<Button key={item.id} data-section={item.id} size="icon" variant="ghost" title={L(item.label)} aria-label={L(item.label)} aria-pressed={item.content!==undefined?open&&section.id===item.id:undefined} aria-controls={item.content!==undefined?'dsh-chat-sidebar':undefined} onClick={()=>item.onClick?item.onClick():reveal(item.id)} onPointerEnter={e=>{if(item.content!==undefined&&wide&&e.pointerType==='mouse'&&Date.now()>hoverBlockedUntil.current){cancel();timer.current=setTimeout(()=>reveal(item.id),180)}}} onPointerLeave={cancel}>{contents}</Button>})}
  </div>
  <div id="dsh-chat-sidebar" role="region" aria-label={section.label+'面板'} className="dsh-chat-sidebar-panel" data-open={open} inert={!open}>
   <div className="dsh-chat-sidebar-heading"><strong>{L(section.label)}</strong><div className="flex gap-1">
    {wide&&<Button size="icon" variant="ghost" title={fixed?L("取消固定会话侧栏"):L("固定会话侧栏")} aria-label={fixed?L("取消固定会话侧栏"):L("固定会话侧栏")} aria-pressed={fixed} onClick={()=>{setPinned(!pinned);localStorage.setItem('dsh-chat-sidebar-pinned',String(!pinned));setPeek(true)}}><Pin className="h-4 w-4"/></Button>}
    <Button size="icon" variant="ghost" title={L("收起会话侧栏")} aria-label={L("收起会话侧栏")} onClick={close}><ChevronLeft className="h-5 w-5"/></Button>
   </div></div>
   <div className="dsh-chat-section-body" key={section.id}>{section.content}</div>
   {wide&&<div role="separator" aria-label={L("会话侧栏宽度")} aria-orientation="vertical" aria-valuemin={280} aria-valuemax={560} aria-valuenow={width} tabIndex={0} title={L("拖动调整宽度；方向键微调；双击恢复默认")} className="dsh-chat-sidebar-resize" onDoubleClick={()=>resize(320)} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();resize(width+(e.key==='ArrowRight'?16:-16))}}} onPointerDown={e=>{e.preventDefault();resizeStart.current={x:e.clientX,width};setResizing(true);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))resize(resizeStart.current.width+e.clientX-resizeStart.current.x)}} onPointerUp={e=>{setResizing(false);e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>setResizing(false)}/>}
  </div>
 </div>
}
