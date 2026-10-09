import {useEffect,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {L,useDshLocale} from './locale'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
export function PdfPreview({base64}:{base64:string}){useDshLocale();
 const canvas=useRef<HTMLCanvasElement>(null),[doc,D]=useState<any>(),[page,P]=useState(1),[scale,S]=useState(1),[error,E]=useState('');
 useEffect(()=>{if(!base64)return;let alive=true,task:any;D(undefined);P(1);E('');
 void import('pdfjs-dist').then(pdf=>{if(!alive)return;pdf.GlobalWorkerOptions.workerSrc=workerUrl;task=pdf.getDocument({data:Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),enableXfa:false,cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/'});return task.promise}).then(value=>{if(alive&&value)D(value)}).catch(e=>{if(alive)E(e.message)});
 return()=>{alive=false;void task?.destroy()}
 },[base64]);
 useEffect(()=>{if(!doc)return;let alive=true,render:any;
 void doc.getPage(page).then((p:any)=>{if(!alive||!canvas.current)return;const viewport=p.getViewport({scale}),c=canvas.current,ratio=Math.min(devicePixelRatio||1,2);c.width=Math.ceil(viewport.width*ratio);c.height=Math.ceil(viewport.height*ratio);c.style.width=viewport.width+'px';c.style.height=viewport.height+'px';render=p.render({canvas:c,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});return render.promise}).catch((e:any)=>{if(alive&&e.name!=='RenderingCancelledException')E(e.message)});
 return()=>{alive=false;render?.cancel()}
 },[doc,page,scale]);
 return <div className="h-full overflow-auto"><div className="sticky top-0 bg-background flex gap-2 p-2 items-center"><Button size="sm" disabled={!doc||page<=1} onClick={()=>P(p=>p-1)}>{L('上一页')}</Button><span>{page} / {doc?.numPages??'…'}</span><Button size="sm" disabled={!doc||page>=doc.numPages} onClick={()=>P(p=>p+1)}>{L('下一页')}</Button><select aria-label={L("PDF 缩放")} value={scale} onChange={e=>S(Number(e.target.value))}>{[.5,.75,1,1.25,1.5,2].map(s=><option key={s} value={s}>{s*100}%</option>)}</select></div>{error&&<p role="alert">{error}</p>}<canvas ref={canvas} aria-label={L("PDF 页面")} className="bg-white"/></div>
}

