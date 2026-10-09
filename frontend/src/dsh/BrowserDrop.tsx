import {useState,type ReactNode} from 'react'
import {droppedBrowserURL} from './browser-drop'
import {L} from './locale'

export function BrowserDrop({onURL,children}:{onURL:(url:string)=>void;children?:ReactNode}){
 const[error,E]=useState('');
 return <div className="border-b p-2 space-y-2" onDragOver={e=>{if([...e.dataTransfer.types].some(t=>['text/uri-list','text/plain'].includes(t))){e.preventDefault();e.dataTransfer.dropEffect='copy'}}} onDrop={e=>{e.preventDefault();e.stopPropagation();try{onURL(droppedBrowserURL(e.dataTransfer.getData('text/uri-list'),e.dataTransfer.getData('text/plain'),location.origin));E('')}catch(e){E((e as Error).message)}}}>
 <p className="text-xs text-muted-foreground">{L('可将 Edge 地址栏的网址或网页链接拖到这里。只传递网址，不包含原标签页的登录状态。')}</p>
 {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}{children}</div>
}
