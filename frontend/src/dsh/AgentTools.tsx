import {SharedBrowser} from './SharedBrowser'
import {useEffect,useState,useRef} from 'react'
import {Button} from '@/components/ui/button'
import {dsh} from './api'
import {L,useDshLocale} from './locale'
type Kind='terminal'|'browser'
type State={terminal:boolean;browser:boolean;registered:string[];error:string;records:any[];page:any}
export function AgentTools({kind,sessionId='',visible=true}:{kind?:Kind;sessionId?:string;visible?:boolean}){useDshLocale();
 const [data,D]=useState<State>(),[error,E]=useState(''),[busy,B]=useState(false);
 const actionLock=useRef(false),generation=useRef(0);
 const endpoint='agent-tools?'+new URLSearchParams({sessionId});
 useEffect(()=>{if(!visible)return;let live=true,timer:ReturnType<typeof setTimeout>;D(undefined);const read=async()=>{const stamp=generation.current;try{if(!actionLock.current){const v=await dsh<State>(endpoint);if(live&&stamp===generation.current)D(v)}}catch(e){if(live&&stamp===generation.current)E((e as Error).message)}finally{if(live)timer=setTimeout(read,kind==='browser'?200:3000)}};void read();return()=>{live=false;clearTimeout(timer)}},[endpoint,visible,kind]);
 async function action(value:unknown){if(actionLock.current)return false;actionLock.current=true;generation.current++;B(true);E('');try{D(await dsh<State>(endpoint,value));return true}catch(e){E((e as Error).message);return false}finally{actionLock.current=false;generation.current++;B(false)}}
 const kinds:Kind[]=kind?[kind]:['terminal','browser'];
 return <section className="p-3 space-y-3 border-b" aria-label={L('DS 操作工具')}>{kind!=='browser'&&<h3 className="font-bold">{L('DS 操作工具')}</h3>}{error&&<p role="alert" className="text-red-700 break-words">{error}</p>}{data?.error&&<p role="alert">{data.error}</p>}
 {kinds.map(k=><div key={k} className="space-y-2"><label className="flex items-center gap-2"><input type="checkbox" checked={!!data?.[k]} disabled={!data||busy} onChange={e=>void action({action:'configure',settings:{[k]:e.target.checked}})}/>{L(k==='terminal'?'允许 DS 使用 CMD':'允许 DS 使用浏览器')}</label><details className="text-xs text-muted-foreground"><summary>{L("工具说明")}</summary><p>{L(k==='terminal'?'复用 DSH PowerShell 工具与权限；每次执行使用新的 CMD，审批会自动弹出。可将命令送到手动终端草稿，或将终端内容交给 DS。':'使用独立的临时 Edge；你和 DS 可轮流操作同一页面。DS 打开、点击和填写前会请求批准。')}</p></details></div>)}
 <details className="text-xs text-muted-foreground"><summary>{L("开关作用范围")}</summary><p>{L('开关作用于此 DSH 配置下的所有会话。关闭会移除对应工具并停止其正在运行的操作；已有的 DSH 工具不受影响。')}</p>
 {data&&<p className="text-xs" role="status">{L('已注册扩展工具')}：{data.registered.length}/2{data.registered.length>0?' · '+data.registered.join(' / '):''}</p>}</details>
 {kind&&sessionId&&<><Button size="sm" variant="outline" disabled={busy||!data||(!data.page&&!data.records.some(r=>r.kind===kind&&r.state==='running'))} onClick={()=>void action({action:'stop',kind})}>{L(kind==='browser'?'关闭 DS 浏览器':'停止 DS 命令')}</Button>{kind==='browser'&&<SharedBrowser key={sessionId} sessionId={sessionId} page={data?.page} enabled={!!data?.browser} busy={busy} action={action}/>}{data?.records.filter(r=>r.kind===kind).slice().reverse().map((r,i)=><details key={r.startedAt+String(i)} className="border p-2"><summary className="text-sm break-all">{({running:'执行中',done:'已完成',stopped:'已停止',error:'失败'} as any)[r.state]} · {r.action}</summary><pre className="text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto">{r.result||L('等待审批或执行结果…')}</pre>{kind==='terminal'&&<div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>window.dispatchEvent(new CustomEvent('dsh-terminal-draft',{detail:{sessionId,command:r.action}}))}>{L('命令送到手动终端')}</Button><Button size="sm" variant="outline" onClick={()=>window.dispatchEvent(new CustomEvent('dsh-tool-context',{detail:{sessionId,text:'以下是命令与结果，请继续分析：\n'+r.action+'\n'+(r.result||'')}}))}>{L('结果送到聊天草稿')}</Button></div>}</details>)}</>}
 </section>
}
