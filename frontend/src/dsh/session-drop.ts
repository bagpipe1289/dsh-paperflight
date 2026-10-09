import {ordered} from './session-order'
export interface GroupState {groups:{id:string;name:string;closed?:boolean}[];assignment:Record<string,string>;flat:boolean;orders?:Record<string,string[]>;workspaceOrder?:string[]}
export interface DropTarget {key:string;group?:string;row?:string;after?:boolean}
export function dropSession<T extends {id:string;pinned?:boolean}>(state:GroupState,rows:T[],source:string,from:string,target:DropTarget):GroupState {
 if(!rows.some(r=>r.id===source)||target.row===source)return state
 if(target.group!==undefined&&target.group!==''&&!state.groups.some(g=>g.id===target.group))return state
 if(target.group===undefined&&from!==target.key)return state
 const assignment={...state.assignment};if(target.group!==undefined)assignment[source]=target.group
 const orders={...state.orders}
 if(from!==target.key)orders[from]=(orders[from]||[]).filter(id=>id!==source)
 const candidates=rows.filter(r=>target.group===undefined||((assignment[r.id]||'')===target.group))
 const ids=ordered(candidates,orders[target.key]).map(r=>r.id).filter(id=>id!==source)
 const index=target.row?ids.indexOf(target.row):-1
 ids.splice(index<0?ids.length:index+(target.after?1:0),0,source)
 orders[target.key]=ordered(candidates,ids).map(r=>r.id)
 return {...state,assignment,orders}
}
