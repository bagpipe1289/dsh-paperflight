// Each HTTP stream owns its heartbeat and upstream subscription.
const MAX_QUEUED_BYTES=8*1024*1024;
const drainWaits=new WeakMap();
export function writable(res){return !res.destroyed&&!res.writableEnded&&!res.writableFinished;}
function waitForDrain(res){
 if(drainWaits.has(res))return;
 const cleanup=()=>{clearTimeout(timer);res.off('drain',cleanup);res.off('close',cleanup);res.off('finish',cleanup);drainWaits.delete(res)};
 const timer=setTimeout(()=>{cleanup();res.destroy();},10000);timer.unref?.();drainWaits.set(res,cleanup);
 res.once('drain',cleanup);res.once('close',cleanup);res.once('finish',cleanup);
}
export function writeEvent(res,data){
 if(!writable(res))return false;
 // A slow/paused tab must never accumulate an unbounded sequence of snapshots.
 // Disconnect rather than silently dropping ordered terminal/file events. SSE
 // consumers reconnect and request their baseline/current state again.
 if((res.writableLength||0)+Buffer.byteLength(data)>MAX_QUEUED_BYTES){drainWaits.get(res)?.();res.destroy();return false;}
 try{if(res.write(data)===false)waitForDrain(res);return true;}catch{drainWaits.get(res)?.();res.destroy();return false;}
}
export function eventStream(res,{heartbeatMs=15000}={}){
 let ended=false,release=null,released=false,timer;
 const stop=()=>{ended=true;clearInterval(timer);drainWaits.get(res)?.();if(release&&!released){released=true;release();}};
 res.once('finish',stop);res.once('close',stop);
 res.on('error',()=>{stop();res.destroy();});
 res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive','x-accel-buffering':'no'});
 const send=data=>!ended&&writeEvent(res,data);
 send(': connected\n\n');
 if(!ended){timer=setInterval(()=>{if(!send(': ping\n\n'))stop();},heartbeatMs);timer.unref?.();}
 return{send,end(){stop();if(writable(res))res.end();},attach(fn){release=fn;if(ended||!writable(res))stop();},get ended(){return ended||!writable(res);}};
}
