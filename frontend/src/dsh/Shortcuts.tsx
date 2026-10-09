import {L,useDshLocale} from './locale'
import {useEffect,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {confirmAction} from './confirm'
import {commands,fixedInputs,readBindings,keyBinding,bindingIssue,effective,matchedCommand,searchMatch,type Bindings} from './shortcut-policy'
const store='dsh-shortcuts-v11'
export function ShortcutRuntime(){useEffect(()=>{const handler=(e:KeyboardEvent)=>{
 if(e.defaultPrevented||e.isComposing||e.repeat||document.querySelector('[data-shortcut-recording="true"],[role=dialog],[role=alertdialog],[role=menu]'))return;
 if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"],[role=combobox]'))return;
 let saved:Bindings;try{saved=readBindings(localStorage.getItem(store))}catch{return}
 const c=matchedCommand(keyBinding(e),saved);if(!c||(!('path' in c)&&location.pathname!=='/chat'))return;
 e.preventDefault();if('path' in c&&c.path)location.assign(c.path);else window.dispatchEvent(new CustomEvent('dsh-shortcut',{detail:c.id}));
 };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[]);return null}
export function ShortcutSettings(){useDshLocale();const[values,V]=useState<Bindings>({}),[q,Q]=useState(''),[record,R]=useState(''),[error,E]=useState(''),[invalid,I]=useState(false);
 useEffect(()=>{const read=()=>{try{V(readBindings(localStorage.getItem(store)));I(false)}catch(e){I(true);E((e as Error).message)}R('')};read();window.addEventListener('storage',read);return()=>window.removeEventListener('storage',read)},[]);
 function save(v:Bindings){try{localStorage.setItem(store,JSON.stringify(v));V(v);E('');R('')}catch{E('快捷键保存失败，请检查浏览器存储权限')}}
 useEffect(()=>{if(!record||invalid)return;const onKey=(e:KeyboardEvent)=>{e.preventDefault();e.stopPropagation();if(e.code==='Escape'){R('');E('');return}if(e.isComposing||e.repeat||/^(Control|Alt|Shift|Meta)(Left|Right)$/.test(e.code))return;const key=keyBinding(e),problem=bindingIssue(key);if(problem){E(problem);return}const conflict=commands.find(c=>c.id!==record&&effective(c,values)===key);if(conflict){E(L('按键冲突')+'：'+L(conflict.name));return}save({...values,[record]:key})};window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true)},[record,values,invalid]);
 return <section className="space-y-4" data-shortcut-recording={!!record}><h2 className="text-xl font-bold">{L('快捷键')}</h2><p className="text-sm">{L('当前浏览器单独保存。输入文字时不触发全局快捷键；新建会话使用侧栏选中的预设和目录。录制时按 Escape 取消。')}</p><Input aria-label={L('搜索快捷键')} value={q} onChange={e=>Q(e.target.value)} placeholder={L('搜索操作或按键')}/>{error&&<p role="alert">{L(error)}</p>}
 {commands.filter(c=>searchMatch(q,c.name,L(c.name),c.alias,effective(c,values))).map(c=><div className="flex flex-wrap items-center gap-3 border p-3" key={c.id}><strong className="flex-1">{L(c.name)}</strong><kbd className="text-xs">{effective(c,values)||L('未绑定')}</kbd><Button disabled={invalid} variant="outline" size="sm" onClick={()=>{R(c.id);E('')}}>{L(record===c.id?'按下组合键…':'录制')}</Button><Button disabled={invalid||!effective(c,values)} variant="ghost" size="sm" onClick={()=>save({...values,[c.id]:null})}>{L('清除')}</Button><Button disabled={invalid||!(c.id in values)} variant="ghost" size="sm" onClick={()=>{const next={...values};delete next[c.id];const clash=c.key&&commands.find(x=>x.id!==c.id&&effective(x,next)===c.key);if(clash){E(L('按键冲突')+'：'+L(clash.name));return}save(next)}}>{L('恢复默认')}</Button></div>)}
 <h3>{L('固定输入操作')}</h3>{fixedInputs.filter(([name,key])=>searchMatch(q,name,L(name),key)).map(([name,key])=><div key={key} className="flex justify-between border-b py-2"><span>{L(name)}</span><kbd>{key}</kbd></div>)}
 <Button disabled={invalid||!Object.keys(values).length} variant="outline" onClick={async()=>{R('');if(await confirmAction(L('恢复所有自定义快捷键？')))save({})}}>{L('全部恢复默认')}</Button></section>
}
