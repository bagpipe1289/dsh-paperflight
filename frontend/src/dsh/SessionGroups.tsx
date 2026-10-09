import {L,useDshLocale} from './locale'
import {useEffect,useRef,useState,type ReactNode} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {dsh} from './api'
import {useLoad} from './Management'
import {useSessionDrag} from './SessionDrag'
import {dropSession,type GroupState} from './session-drop'
import {ordered} from './session-order'
import {confirmAction} from './confirm'
// Display-only grouping. No filesystem workspace or native session is moved.
export function SessionGroups({rows,render,onNavigationOrder}:{rows:{id:string;label:string;pinned?:boolean}[];render:(row:any)=>ReactNode;onNavigationOrder?:(ids:string[])=>void}){useDshLocale();
 const[state,setState]=useState<GroupState>(()=>{try{const x=JSON.parse(localStorage.getItem('dsh-session-groups')||'null');if(Array.isArray(x?.groups)&&x.assignment)return x}catch{}return{groups:[],assignment:{},flat:false}})
 const initialState=useRef(state),hadLocal=useRef(!!localStorage.getItem('dsh-session-groups'));
 const[serverRevision,SR]=useState(0),[syncError,SE]=useState(''),[native,N]=useState(false);const workspaces=useLoad<any>('sessions');
 useEffect(()=>{let alive=true;dsh<any>('v11/groups').then(r=>{if(alive){SR(r.revision);if(r.value&&!hadLocal.current)setState(s=>s===initialState.current?r.value:s)}}).catch(e=>{if(alive)SE(e.message)});return()=>{alive=false}},[])
 async function sync(write:boolean){try{const r=await dsh<any>('v11/groups',write?{revision:serverRevision,value:state}:undefined);SR(r.revision);if(r.value)setState(r.value);SE(write?'已同步到验证服务；其他浏览器点读取共享分组即可。':'已读取共享分组。')}catch(e){SE((e as Error).message)}}
 const[name,setName]=useState(''),[manage,setManage]=useState(false)
 const drag=useSessionDrag((id,from,target)=>setState(s=>{
  const group=target.key.startsWith('group:')?target.key.slice(6):undefined
  const items=target.key.startsWith('cwd:')?rows.filter(r=>(workspaces.data?.items?.find((x:any)=>x.sessionId===r.id)?.cwd||'未记录目录')===target.key.slice(4)):rows
  return dropSession(s,items,id,from,{...target,group})
 }))
 const list=(key:string,items:typeof rows)=>{const sorted=ordered(items,state.orders?.[key]),group=key.startsWith('group:')?key.slice(6):undefined;return <div data-session-drop={key} data-drop-group={group} className="min-h-3">{sorted.map(row=><div key={row.id} data-session-drop={key} data-drop-group={group} data-drop-row={row.id} {...drag.bindings(row,key,sorted.map(r=>r.id))} className="dsh-session-sort-row" data-dragging={drag.dragging===row.id} data-drag-over={drag.over===row.id}>{render(row)}</div>)}</div>}
 useEffect(()=>localStorage.setItem('dsh-session-groups',JSON.stringify(state)),[state])
 const groupRows=(group:string)=>rows.filter(r=>(state.assignment[r.id]||'')===group)
 useEffect(()=>{let ids:string[];
  if(native){const cwd=(r:typeof rows[number])=>workspaces.data?.items?.find((x:any)=>x.sessionId===r.id)?.cwd||'未记录目录';ids=ordered([...new Set(rows.map(cwd))].map(id=>({id})),state.workspaceOrder).flatMap(g=>ordered(rows.filter(r=>cwd(r)===g.id),state.orders?.['cwd:'+g.id]).map(r=>r.id));}
  else if(state.flat)ids=ordered(rows,state.orders?.flat).map(r=>r.id);
  else ids=['',...state.groups.map(g=>g.id)].flatMap(g=>ordered(groupRows(g),state.orders?.['group:'+g]).map(r=>r.id));
  onNavigationOrder?.(ids);
 },[rows,state,native,workspaces.data,onNavigationOrder]);
 return <div ref={drag.root} className="space-y-1" onKeyDown={e=>{if(e.key==='Escape')drag.clear()}}><div className="dsh-session-view-actions"><Button size="sm" variant="ghost" onClick={()=>setManage(!manage)}>{L("会话分组")}</Button><Button size="sm" variant="ghost" onClick={()=>{N(false);setState(s=>({...s,flat:!s.flat}))}}>{state.flat?L("分组视图"):L("扁平视图")}</Button><Button size="sm" variant="ghost" onClick={()=>N(!native)}>{native?L("自定义分组"):L("按工作目录")}</Button></div><p role="status" className="sr-only">{drag.message}</p>{manage&&<div className="v10-card m-2"><p className="text-xs text-muted-foreground">{L("分组不改变会话目录；保存到验证服务后可跨浏览器读取。")}</p><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={()=>void sync(true)}>{L("保存共享分组")}</Button><Button size="sm" variant="outline" onClick={()=>void sync(false)}>{L("读取共享分组")}</Button></div><p role="status" className="text-xs">{syncError}</p><Input aria-label={L("新会话分组名称")} value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder={L("新分组名称")}/><Button size="sm" disabled={!name.trim()||state.groups.some(g=>g.name===name.trim())} onClick={()=>{setState(s=>({...s,groups:[...s.groups,{id:crypto.randomUUID(),name:name.trim()}]}));setName('')}}>{L("创建分组")}</Button>{rows.map(r=><label className="text-xs" key={r.id}><span className="block truncate">{L(r.label)}</span><select className="border bg-background w-full p-1" aria-label={'分组：'+r.label} value={state.assignment[r.id]||''} onChange={e=>setState(s=>({...s,assignment:{...s.assignment,[r.id]:e.target.value}}))}><option value="">{L("未分组")}</option>{state.groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label>)}{state.groups.map(g=><div className="flex gap-1" key={g.id}><Input aria-label={'重命名分组 '+g.name} value={g.name} maxLength={40} onChange={e=>setState(s=>({...s,groups:s.groups.map(x=>x.id===g.id?{...x,name:e.target.value}:x)}))}/><Button size="sm" variant="ghost" onClick={async()=>{if(!await confirmAction('删除此分组？组内会话会回到未分组，所有对话保留。'))return;setState(s=>({...s,groups:s.groups.filter(x=>x.id!==g.id),assignment:Object.fromEntries(Object.entries(s.assignment).filter(([,v])=>v!==g.id))}))}}>{L("移除组")}</Button></div>)}</div> }{native?ordered([...new Set(rows.map(r=>workspaces.data?.items?.find((x:any)=>x.sessionId===r.id)?.cwd||'未记录目录'))].map(id=>({id})),state.workspaceOrder).map(({id:cwd})=><details key={cwd} open><summary className="p-2 text-xs break-all">{cwd}</summary>{list('cwd:'+cwd,rows.filter(r=>(workspaces.data?.items?.find((x:any)=>x.sessionId===r.id)?.cwd||'未记录目录')===cwd))}</details>):state.flat?list('flat',rows):<><section data-session-drop="group:" data-drop-group="" className="dsh-session-drop-group" data-drag-over={drag.over==='group:'}>{state.groups.length>0&&<p className="p-2 text-xs">未分组 · {groupRows('').length}</p>}{list('group:',groupRows(''))}</section>{state.groups.map(g=><section key={g.id} data-session-drop={'group:'+g.id} data-drop-group={g.id} className="dsh-session-drop-group" data-drag-over={drag.over==='group:'+g.id}><button className="w-full p-2 text-left text-xs font-semibold" aria-expanded={!g.closed} onClick={()=>setState(s=>({...s,groups:s.groups.map(x=>x.id===g.id?{...x,closed:!x.closed}:x)}))}>{g.closed?'▸':'▾'} {g.name||'未命名分组'} · {groupRows(g.id).length}</button>{!g.closed&&list('group:'+g.id,groupRows(g.id))}</section>)}</>}</div>
}
