// Restart only on an authenticated launcher visit. Concurrent visits share one
// startup; a broken installation cannot enter an automatic restart loop.
export function childService({spawn,bootstrap,version,onLog=()=>{},timeoutMs=15000}){
 let child=null,status={state:'starting'},pending=null,disposed=false,buffer='',settle;
 const save=()=>{if(buffer)Promise.resolve(onLog(buffer)).catch(()=>{});};
 const finish=()=>{settle?.(status);settle=null;pending=null;};
 function start(){
  if(disposed)return Promise.resolve({state:'stopped'});
  if(status.state==='ready')return Promise.resolve(status);
  if(pending)return pending;
  if(child)return Promise.resolve(status); // Wait for a failed child to exit.
  status={state:'starting',message:'正在启动外壳…'};buffer='';
  let resolve;const result=new Promise(r=>resolve=r);pending=result;settle=resolve;
  let current;
  try{current=spawn();child=current;}catch(e){status={state:'failed',message:'无法启动外壳进程，请检查启动日志。'};buffer=String(e.stack||e);save();finish();return result;}
  const timer=setTimeout(()=>{if(child!==current)return;status={state:'failed',message:'外壳启动超时，请检查启动日志后从原生入口重试。'};buffer+='\nShell startup timed out';save();current.kill();finish();},timeoutMs);timer.unref?.();
  current.stderr?.on('data',chunk=>{buffer=(buffer+String(chunk)).slice(-16000)});
  current.on('error',e=>{if(child!==current)return;clearTimeout(timer);buffer+='\n'+String(e.stack||e);save();status={state:'failed',message:'无法启动外壳进程，请检查启动日志。'};current.kill();finish();});
  const exited=(code)=>{if(child!==current)return;clearTimeout(timer);child=null;if(!disposed){if(status.state!=='failed')status={state:'stopped',code,message:'外壳进程已退出；从原生 未来复古外壳入口重新打开可重启外壳。'};save();}finish();};
  current.on('exit',exited);current.on('close',exited);
  current.on('message',m=>{if(disposed||child!==current)return;if(m?.type==='ready'&&Number.isInteger(m.port)&&m.port>0&&m.port<=65535){clearTimeout(timer);status={state:'ready',url:`http://127.0.0.1:${m.port}`,version};finish();}else if(m?.type==='failed'){clearTimeout(timer);status={state:'failed',message:m.code==='EADDRINUSE'?'外壳端口被占用，请更改插件 port 配置后重新启用。':'外壳启动失败，请检查启动日志后从原生入口重试。'};current.kill();finish();}});
  try{current.send(bootstrap,e=>{if(e&&child===current)current.emit('error',e)});}catch(e){current.emit('error',e);}
  return result;
 }
 async function stop(){disposed=true;status={state:'stopped'};finish();const c=child;if(c&&c.exitCode===null&&c.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(resolve,5000);c.once('exit',()=>{clearTimeout(timer);resolve()});c.kill();});}
 return{start,stop,get status(){return status;}};
}
