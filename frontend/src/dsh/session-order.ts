export function ordered<T extends {id:string;pinned?:boolean}>(rows:T[],ids:string[]=[]):T[]{
 const ranks=new Map(ids.map((id,i)=>[id,i]));
 return [...rows].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(ranks.get(a.id)??Infinity)-(ranks.get(b.id)??Infinity));
}
export function moveBefore<T extends {id:string;pinned?:boolean}>(rows:T[],source:string,target:string){
 const a=rows.find(x=>x.id===source),b=rows.find(x=>x.id===target);
 if(!a||!b||!!a.pinned!==!!b.pinned||source===target)return rows.map(x=>x.id);
 const ids=rows.map(x=>x.id).filter(id=>id!==source);ids.splice(ids.indexOf(target),0,source);return ids;
}
export function storedNavigationOrder<T extends {id:string;pinned?:boolean}>(rows:T[],raw:string|null){
 try{const s=JSON.parse(raw||'null');if(!s||!Array.isArray(s.groups)||!s.assignment)return ordered(rows).map(r=>r.id);
  if(s.flat)return ordered(rows,s.orders?.flat).map(r=>r.id);
  const groups=['',...s.groups.map((g:any)=>g.id)];
  return groups.flatMap(g=>ordered(rows.filter(r=>(groups.includes(s.assignment[r.id])?s.assignment[r.id]:'')===g),s.orders?.['group:'+g]).map(r=>r.id));
 }catch{return ordered(rows).map(r=>r.id)}
}
