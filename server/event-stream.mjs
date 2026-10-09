// Each HTTP stream owns its heartbeat and upstream subscription. finish can
// precede close (or close may never arrive), so both end the subscription.
export function writable(res){return !res.destroyed&&!res.writableEnded&&!res.writableFinished;}
export function writeEvent(res,data){
 if(!writable(res))return false;
 try{res.write(data);return true;}catch{res.destroy();return false;}
}
export function eventStream(res,{heartbeatMs=15000}={}){
 let ended=false,release=null,released=false,timer;
 const stop=()=>{ended=true;clearInterval(timer);if(release&&!released){released=true;release();}};
 res.once('finish',stop);res.once('close',stop);
 // Response errors are connection-local; never allow a disconnected tab to
// terminate the process and every other session.
 res.on('error',()=>{stop();res.destroy();});
 res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive','x-accel-buffering':'no'});
 const send=data=>!ended&&writeEvent(res,data);
 send(': connected\n\n');
 timer=setInterval(()=>{if(!send(': ping\n\n'))stop();},heartbeatMs);timer.unref?.();
 return {
  send,
  end(){stop();if(writable(res))res.end();},
  attach(fn){release=fn;if(ended||!writable(res))stop();},
  get ended(){return ended||!writable(res);},
 };
}
