import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react'
import {L} from './locale'
import './message-width.css'

const key='dsh-message-width',defaultWidth=896
export function MessageWidthFrame({children}:{children:ReactNode}){
 const frame=useRef<HTMLDivElement>(null)
 const [preferred,setPreferred]=useState(()=>{try{const n=Number(localStorage.getItem(key));return Number.isFinite(n)&&n>=320?Math.min(n,1800):defaultWidth}catch{return defaultWidth}})
 const [available,setAvailable]=useState(0),[dragging,setDragging]=useState(false)
 const gesture=useRef({x:0,width:0,side:1}),pending=useRef<number|null>(null),next=useRef(preferred)
 const maximum=Math.max(0,Math.min(1800,available-56)),minimum=Math.min(360,maximum),width=Math.min(preferred,maximum)
 const clamp=(n:number)=>Math.round(Math.max(minimum,Math.min(maximum,n)))
 useEffect(()=>{const el=frame.current;if(!el)return;const read=()=>setAvailable(el.clientWidth);read();const observer=new ResizeObserver(read);observer.observe(el);return()=>observer.disconnect()},[])
 useEffect(()=>{try{localStorage.setItem(key,String(preferred))}catch{}},[preferred])
 useEffect(()=>()=>{if(pending.current!==null)cancelAnimationFrame(pending.current)},[])
 const finish=()=>{if(pending.current!==null){cancelAnimationFrame(pending.current);pending.current=null;setPreferred(next.current)}setDragging(false)}
 return <div ref={frame} className="dsh-message-width-frame relative min-h-0 min-w-0 flex-1 overflow-hidden" data-resizing={dragging} style={{'--message-width':available?width+'px':'min(896px, calc(100% - 56px))'} as CSSProperties}>
  {children}
  {available>0&&<div role="separator" tabIndex={0} aria-label={L('调整文字宽度（左边界）')} aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.round(width)} aria-valuetext={Math.round(width)+' px'} title={L('拖动调整换行宽度；双击恢复默认；方向键微调')} className="dsh-message-width-handle is-left"
   onDoubleClick={()=>setPreferred(defaultWidth)}
   onKeyDown={e=>{if(e.key==='Home'){e.preventDefault();setPreferred(defaultWidth)}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setPreferred(clamp(width+(e.key==='ArrowRight'?-1:1)*(e.shiftKey?50:10)))}}}
   onPointerDown={e=>{if(e.button!==0)return;gesture.current={x:e.clientX,width,side:-1};next.current=width;e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);e.preventDefault()}}
   onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;next.current=clamp(gesture.current.width+2*(e.clientX-gesture.current.x)*gesture.current.side);if(pending.current===null)pending.current=requestAnimationFrame(()=>{pending.current=null;setPreferred(next.current)})}}
   onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){finish();e.currentTarget.releasePointerCapture(e.pointerId)}}}
   onPointerCancel={finish} onLostPointerCapture={finish}><span aria-hidden="true"/></div>}
 </div>
}
