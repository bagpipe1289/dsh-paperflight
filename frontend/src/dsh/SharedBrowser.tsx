import {useState,useEffect} from 'react'
import {Button} from '@/components/ui/button'
import {BrowserDrop} from './BrowserDrop'
import {browserURL} from './workspace-policy'
import {L} from './locale'

export function SharedBrowser({page,enabled,busy,action,sessionId}:{page:any;enabled:boolean;busy:boolean;action:(v:unknown)=>Promise<boolean>;sessionId:string}){
 const[input,I]=useState(''),[text,T]=useState(''),[error,E]=useState('');
 const manual=page?.controller==='manual',disabled=busy||!!page?.busy;
 useEffect(()=>{if(page?.url)I(page.url)},[page?.url]);
 const run=(input:any)=>action({action:'browser-manual',input:{revision:page?.revision,...input}});
 const open=async(value:string)=>{try{const url=browserURL(value,location.origin);I(url);E('');await run({action:'open',url})}catch(e){E((e as Error).message)}};
 return <section className="space-y-2" aria-label={L('共享浏览器')}>
 <h3 className="font-bold">{L('共享浏览器')} · {page?L(manual?'你正在操作':'由 DS 控制'):L('尚未打开')}</h3>
 <p className="text-xs text-muted-foreground">{L('你和 DS 轮流控制同一个页面，切换保留页面与登录状态。这里使用独立临时浏览器，不连接你的个人 Edge。')}</p>
 <div className="flex flex-wrap gap-2">
 <Button size="sm" variant={manual?'default':'outline'} disabled={!page||disabled||manual} onClick={()=>void run({action:'claim',controller:'manual'})}>{L('我来操作')}</Button>
 <Button size="sm" variant={page&&!manual?'default':'outline'} disabled={!page||disabled||!manual||!enabled} onClick={async()=>{if(await run({action:'claim',controller:'agent'}))window.dispatchEvent(new CustomEvent('dsh-tool-context',{detail:{sessionId,text:'请使用 mai_browser 的 read 读取共享浏览器当前页面，再根据我的要求继续。当前网址：'+page.url}}))}}>{L('交给 DS')}</Button>
 {page&&<Button size="sm" variant="outline" onClick={()=>window.dispatchEvent(new CustomEvent('dsh-open-browser',{detail:page.url}))}>{L('复制网址到普通网页')}</Button>}
 </div>
 <BrowserDrop onURL={url=>{I(url);E('');}}><form className="flex gap-1" onSubmit={e=>{e.preventDefault();void open(input)}}>
 <input aria-label={L('共享浏览器地址')} className="border bg-background px-2 min-w-0 flex-1" placeholder={page?.url||'https://example.com'} value={input} onChange={e=>I(e.target.value)}/><Button size="sm" disabled={disabled||!!page&&!manual||!input.trim()}>{L('打开')}</Button>
 </form><small>{L('拖入后核对地址，点击打开；需要 DS 继续时点击「交给 DS」，并发送聊天草稿。')}</small></BrowserDrop>
 {error&&<p role="alert">{error}</p>}
 {page&&<><p className="text-xs">引擎：{page.backend||'Playwright'} · 画面与 DS 操作共享</p><div className="flex gap-1 flex-wrap" aria-label="共享浏览器标签页">{page.tabs?.map((t:any)=><Button key={t.index} size="sm" variant={t.active?'default':'outline'} disabled={disabled||!manual} title={t.url} onClick={()=>void run({action:'select',tab:t.index})}>标签 {t.index+1}{t.active?' · 当前':''}</Button>)}</div><p className="text-xs break-all">{page.title} · {page.url}</p>
 <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={disabled||!manual} onClick={()=>void run({action:'back'})}>{L('后退')}</Button><Button size="sm" variant="outline" disabled={disabled||!manual} onClick={()=>void run({action:'read'})}>{L('同步画面')}</Button>{[-600,600].map(delta=><Button key={delta} size="sm" variant="outline" disabled={disabled||!manual} onClick={()=>void run({action:'scroll',delta})}>{delta<0?'↑':'↓'}</Button>)}</div>
 <img className={'w-full border '+(manual&&!disabled?'cursor-crosshair':'')} src={page.image} alt={L('共享浏览器页面，手动模式可点击画面')} draggable={false} onClick={e=>{if(!manual||disabled)return;const r=e.currentTarget.getBoundingClientRect();void run({action:'click',x:Math.min(1279,(e.clientX-r.left)/r.width*1280),y:Math.min(799,(e.clientY-r.top)/r.height*800)})}}/>
 <p className="text-xs text-muted-foreground">{L(page.live?'画面自动更新。手动模式可点击画面；点击网页输入框后，在下方输入文字发送。':'手动模式可点击画面。点击网页输入框后，在下方输入文字发送；当前浏览器不支持连续画面，可点击同步画面。')}</p>
 <form className="flex gap-1" onSubmit={async e=>{e.preventDefault();if(await run({action:'type',text}))T('')}}><input aria-label={L('输入到共享页面的文字')} className="border bg-background min-w-0 flex-1 px-2" type="password" autoComplete="off" value={text} onChange={e=>T(e.target.value)}/><Button size="sm" disabled={disabled||!manual||!text}>{L('输入文字')}</Button></form>
 <div className="flex flex-wrap gap-1">{['Enter','Tab','Backspace','Control+A','Escape'].map(key=><Button key={key} size="sm" variant="outline" disabled={disabled||!manual} onClick={()=>void run({action:'press',key})}>{key}</Button>)}</div>
 <p className="text-xs">{L('最近同步')}：{new Date(page.updatedAt).toLocaleTimeString()}</p></>}
 </section>
}
