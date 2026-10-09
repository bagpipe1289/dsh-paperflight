// Public navigation URL only: never embed the native launch token in page assets.
function watchShell(nativeUrl){
 let stopped=false,timer,failures=0;
 const check=async()=>{
  try{const r=await fetch('/__mai_health',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});if(r.status===401){if(!stopped)window.location.replace('/__mai_reconnect');return}if(!r.ok)throw new Error('HTTP '+r.status);failures=0}
  // HTTP/1 event streams can occupy all browser connection slots. A queued
  // health request timing out is not evidence that the shell has exited.
  catch(e){failures=e?.name==='TimeoutError'?0:failures+1;console.warn('[Mai shell] Health check failed:',e?.name||'Error',e?.message||'Unavailable')}
  if(stopped)return;
  if(failures>=3){
   // The launcher may give the restarted host a new port. Never navigate to
   // the cached native address until that host actually answers again.
   try{await fetch(nativeUrl,{mode:'no-cors',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(3000)});if(!stopped)window.location.replace(nativeUrl);return}catch{}
  }
  timer=setTimeout(check,2000);
 };
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer)},{once:true});
 // BFCache restoration must restart the watchdog that pagehide stopped.
 window.addEventListener('pageshow',e=>{if(e.persisted){stopped=false;failures=0;void check()}});
 void check();
}
export function shellWatchSource(origin){
 const url=new URL(origin);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password)throw new Error('Expected loopback native origin');
 return `(${watchShell.toString()})(${JSON.stringify(url.origin+'/?mai_native=1')});`;
}
