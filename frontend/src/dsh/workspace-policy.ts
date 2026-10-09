export function browserURL(value:string,ownOrigin:string){
 const input=value.trim();if(!input||input.length>4096)throw new Error('请输入网页地址');
 const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(input)&&!/^localhost:\d/i.test(input)?input:'https://'+input);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('仅支持不含账号密码的 HTTP(S) 地址');
 if(url.origin===ownOrigin||(['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&['3082','3141'].includes(url.port)))throw new Error('DSH 自身请使用原生界面入口');
 return url.href;
}
export function fileKind(file:string){const ext=file.split('.').at(-1)?.toLowerCase();return ['png','jpg','jpeg','gif','webp','bmp','ico','svg'].includes(ext||'')?'image':ext==='pdf'?'pdf':['html','htm'].includes(ext||'')?'html':['md','markdown'].includes(ext||'')?'markdown':'text'}
export type WorkspaceTab={id:string;kind:string;title:string;path?:string;url?:string;termId?:string;data?:any};
export function storedTabs(raw:string|null):Record<string,WorkspaceTab[]>{try{const v=JSON.parse(raw||'{}');if(!v||Array.isArray(v)||typeof v!=='object')return{};return Object.fromEntries(Object.entries(v).filter(([id])=>/^[-\w]{1,120}$/.test(id)).map(([id,tabs])=>[id,Array.isArray(tabs)?tabs.filter(t=>t&&typeof t.id==='string'&&['files','file','browser','terminal','shell-picker','changes','approvals','plans','deliveries','teams','preview','child'].includes(t.kind)).slice(0,24):[]]))}catch{return{}}}
