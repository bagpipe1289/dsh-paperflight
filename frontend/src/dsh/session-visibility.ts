export interface SessionDisplayRow {
 sessionId:string; blank?:boolean; running?:boolean; pinned?:boolean;
 projections?:{values?:Record<string,any>};
}
// Only the host's blank bit can establish that a session has never been used.
// Missing preview messages are not evidence of an empty session.
export function sessionVisible(row:SessionDisplayRow,active:string,hasDraft=false){
 const title=row.projections?.values?.title;
 return row.blank!==true||row.sessionId===active||!!row.running||!!row.pinned||hasDraft||
  (typeof title==='string'&&!!title.trim());
}
