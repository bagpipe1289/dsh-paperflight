export function sessionTitle(row){
 const title=row.projections?.values?.title;
 return typeof title==='string'&&title.trim()?title:row.blank===true?'新会话':'未命名';
}
