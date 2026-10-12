export async function dsh<T>(endpoint:string,body?:unknown,retry=true):Promise<T>{
 const response=await fetch('/api/dsh/'+endpoint,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),...(endpoint==='prompt'?{signal:AbortSignal.timeout(45000)}:{})})
 if(response.status===401&&retry){await fetch('/',{cache:'no-store'});return dsh<T>(endpoint,body,false)}
 const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'DSH 请求失败'),{delivery:result.delivery});return result as T
}
