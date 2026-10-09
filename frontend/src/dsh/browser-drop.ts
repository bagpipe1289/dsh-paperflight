import {browserURL} from './workspace-policy'
export function droppedBrowserURL(uri:string,plain:string,origin:string){
 const values=(uri||plain).split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
 if(values.length!==1||!/^https?:\/\//i.test(values[0]))throw new Error('请拖入一个 HTTP(S) 网页链接，也可粘贴到地址栏');
 return browserURL(values[0],origin);
}
