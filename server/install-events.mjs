import {observe,rpcArgs} from './dsh-client.mjs';
export function installFrame(job,f){const data=f.args?.[0];if(f.type!=='emit'||data?.requestId!==job.id)return;
 if(f.event==='plugin-manager/install-log'){job.output=((job.output||'')+data.text).slice(-200000);job.outputTruncated=(job.outputTruncated||false)||job.output.length>=200000;job.lastOutputAt=Date.now();job.exitCode=data.exitCode??job.exitCode}
 if(f.event==='plugin-manager/install-state'){job.phase=data.phase;job.attempt=data.attempt}
}
export async function watchInstall(job){let clientId,stop;let ready,fail;const attached=new Promise((r,j)=>{ready=r;fail=j});const timeout=setTimeout(()=>fail(new Error('安装输出连接未就绪，请重试')),10000);
 try{stop=await observe('$events',{},f=>{if(f.type==='ready'){clientId=f.clientId;ready()}installFrame(job,f);if(f.type==='waterfall'&&clientId)void rpcArgs('$events/result',{clientId,eventId:f.eventId,outcome:{kind:'next'}}).catch(()=>{})},e=>{job.streamError='安装输出连接中断；最终结果仍会单独返回：'+e.message;fail(e)});await attached;return stop}catch(e){stop?.();throw e}finally{clearTimeout(timeout)}
}
