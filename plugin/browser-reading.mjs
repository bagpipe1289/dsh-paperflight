import {createHash,randomUUID} from 'node:crypto';

export const fingerprint=text=>createHash('sha256').update(text).digest('hex');
// Keep only one continuation descriptor, never a second copy of the full page.
export function pageSlice(entry,text,scope,url,cursor){
 const hash=fingerprint(text),previous=entry.continuation;
 if(cursor&&(!previous||previous.token!==cursor||previous.hash!==hash||previous.url!==url)){
  entry.continuation=null;
  throw new Error('The reading cursor expired or the page changed. Start a new read; use heading or format:text to narrow the content.');
 }
 const offset=cursor?previous.offset:0,limit=14000;
 let end=Math.min(text.length,offset+limit);
 if(end<text.length){const line=text.lastIndexOf('\n',end);if(line>offset+limit/2)end=line+1;else if(/[\uD800-\uDBFF]/.test(text[end-1]))end--}
 const hasMore=end<text.length,nextCursor=hasMore?randomUUID():undefined;
 entry.continuation=hasMore?{token:nextCursor,offset:end,hash,url,scope}:null;
 return {text:text.slice(offset,end),hash,pagination:{offset,end,totalCharacters:text.length,hasMore,nextCursor}};
}
export function snapshotBody(text){
 // MCP adds console counts and metadata outside the accessibility tree.
 return text.match(/### Snapshot\s*\n```(?:yaml)?\n([\s\S]*?)\n```/)?.[1]??text;
}
export function diagnosticText(value){
 return String(value||'').replace(/\u001b\[[0-9;]*m/g,'')
  .replace(/https?:\/\/[^\s"'<>]+/g,raw=>{try{const u=new URL(raw);return u.origin+u.pathname}catch{return '[url]'}})
  .replace(/\b(Bearer\s+)\S+/gi,'$1[redacted]')
  .replace(/\b(token|password|secret|api[_-]?key|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi,'$1=[redacted]')
  .slice(0,1000);
}
export async function viewport(page){
 if(!page.evaluate)return null;
 return page.evaluate(()=>({x:scrollX,y:scrollY,width:innerWidth,height:innerHeight,
  containers:[...document.querySelectorAll('body *')].filter(el=>el.scrollTop||el.scrollLeft).slice(0,50).map(el=>({tag:el.tagName,id:el.id,x:el.scrollLeft,y:el.scrollTop}))}));
}
export async function readingText(page,args){
 if(!args.heading)return page.locator('body').innerText({timeout:2000});
 let heading=page.getByRole('heading',{name:args.heading,exact:true});
 if(args.index!==undefined)heading=heading.nth(args.index);
 try{return await heading.evaluate(start=>{
  const level=el=>Number(el.getAttribute('aria-level')||el.tagName.slice(1))||2;
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(el).visibility!=='hidden');
  const end=headings.slice(headings.indexOf(start)+1).find(el=>level(el)<=level(start));
  const range=document.createRange();range.setStartBefore(start);end?range.setEndBefore(end):range.setEndAfter(document.body.lastChild||start);
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),parts=[];let node;
  while((node=walker.nextNode())){
   if(!node.textContent.trim()||!range.intersectsNode(node))continue;
   const el=node.parentElement;
   if(!el||el.closest('script,style,template,noscript,[hidden],[aria-hidden="true"]')||!el.getClientRects().length)continue;
   const css=getComputedStyle(el);if(css.visibility==='hidden'||css.display==='none')continue;
   parts.push(node.textContent.trim());
  }
  return parts.join('\n');
 },undefined,{timeout:2000})}catch(e){throw new Error('Heading not uniquely found. Use an exact observed heading and index for duplicates, or read format:text with pagination. '+diagnosticText(e.message).split('\n')[0])}
}
