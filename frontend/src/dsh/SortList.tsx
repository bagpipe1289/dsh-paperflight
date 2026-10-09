import {useEffect,useRef,useState,type ReactNode} from 'react'
import {GripVertical,ArrowUp,ArrowDown} from 'lucide-react'
import {L,useDshLocale} from './locale'
import {moveBefore} from './session-order'
export function SortList<T extends {id:string;pinned?:boolean}>({items,enabled,onOrder,render}:{items:T[];enabled:boolean;onOrder:(ids:string[])=>void;render:(item:T)=>ReactNode}){
 useDshLocale();const root=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),drag=useRef(''),[grabbed,G]=useState(''),[over,O]=useState('');
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;drag.current='';G('');O('')};
 const shift=(i:number,d:number)=>{const next=items[i+d];if(!next||!!items[i].pinned!==!!next.pinned)return;const ids=items.map(x=>x.id);[ids[i],ids[i+d]]=[ids[i+d],ids[i]];onOrder(ids)};
 return <div ref={root}>{items.map((item,i)=><div key={item.id} data-sort-id={item.id} className={over===item.id?'border-t-2 border-primary':''}>
 {enabled&&<div className="flex items-center justify-end gap-1 px-2"><button type="button" aria-label={L('长按拖动排序')} aria-pressed={grabbed===item.id} className="touch-none p-1 cursor-grab" onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if(e.button!==0)return;clear();e.currentTarget.setPointerCapture(e.pointerId);timer.current=setTimeout(()=>{drag.current=item.id;G(item.id)},350)}} onPointerMove={e=>{if(!drag.current)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-sort-id]');O(target&&root.current?.contains(target)?target.dataset.sortId||'':'')}} onPointerUp={e=>{if(drag.current&&over)onOrder(moveBefore(items,drag.current,over));clear();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={clear} onLostPointerCapture={clear} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();shift(i,e.key==='ArrowUp'?-1:1)}if(e.key==='Escape')clear()}}><GripVertical size={15}/></button><button type="button" aria-label={L('上移')} disabled={!items[i-1]||!!items[i-1]?.pinned!==!!item.pinned} onClick={()=>shift(i,-1)}><ArrowUp size={15}/></button><button type="button" aria-label={L('下移')} disabled={!items[i+1]||!!items[i+1]?.pinned!==!!item.pinned} onClick={()=>shift(i,1)}><ArrowDown size={15}/></button></div>}
 {render(item)}</div>)}</div>
}
