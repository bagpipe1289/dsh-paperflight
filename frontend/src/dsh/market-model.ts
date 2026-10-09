export interface MarketEntry {name:string;url:string;owner?:string;npm?:string;category?:string|string[];description?:Record<string,string>;version?:string;stars?:number;downloads?:number;added?:string;deprecated?:boolean;capabilities?:string[];localName?:string;localVersion?:string;activation?:string;unlisted?:boolean;favorite?:boolean}
export interface LocalMarket {installed:Record<string,string>;favorites:string[];catalogMatches:Record<string,string|null>;activation:Record<string,{state:string}>;present:string[]}
export const categoriesOf=(p:MarketEntry):string[]=>Array.isArray(p.category)?p.category:p.category?[p.category]:[];
export function marketEntries(plugins:MarketEntry[],local:LocalMarket|null):MarketEntry[]{
 const rows=plugins.map(p=>({...p,favorite:local?.favorites.includes(p.url)||false}));
 for(const [name,version] of Object.entries(local?.installed||{})){
  const url=local?.catalogMatches?.[name];const row=url?rows.find(p=>p.url===url):undefined;
  const fields={localName:name,localVersion:version,activation:local?.activation?.[name]?.state||'unknown'};
  if(row)Object.assign(row,fields);else rows.push({name,url:'',unlisted:true,...fields} as typeof rows[number]);
 }
 for(const url of local?.favorites||[])if(!rows.some(p=>p.url===url))rows.push({name:url,url,favorite:true,unlisted:true});
 return rows;
}
export function selectMarket(rows:MarketEntry[],options:{tab:string;query:string;category:string;filter:string;sort:string;page:number;size:number}){
 const {tab,query,category,filter,sort}=options;const q=query.trim().toLocaleLowerCase();
 const list=rows.filter(p=>(tab==='installed'?!!p.localName:tab==='favorites'?p.favorite:tab==='themes'?categoriesOf(p).includes('theme'):!p.unlisted&&!categoriesOf(p).includes('theme'))&&(!category||categoriesOf(p).includes(category))&&(!q||[p.name,p.owner,p.npm,p.description?.zh,p.description?.en,p.localName].some(v=>v?.toLocaleLowerCase().includes(q)))&&(filter==='all'||filter==='installed'&&!!p.localName||filter==='available'&&!p.localName||filter==='favorites'&&p.favorite));
 list.sort((a,b)=>{
  if(sort==='name')return a.name.localeCompare(b.name);
  const score=(p:MarketEntry)=>sort==='added'?(p.added?Date.parse(p.added):NaN):sort==='downloads'?p.downloads:p.stars;
  const av=score(a),bv=score(b),ak=typeof av==='number'&&Number.isFinite(av),bk=typeof bv==='number'&&Number.isFinite(bv);
  return ak&&bk?bv!-av!||a.name.localeCompare(b.name):ak?-1:bk?1:a.name.localeCompare(b.name);
 });
 const size=Math.max(1,options.size);const pages=Math.max(1,Math.ceil(list.length/size)),page=Math.min(pages,Math.max(1,options.page));
 return {items:list.slice((page-1)*size,page*size),total:list.length,page,pages};
}
