import {writeEvent} from './event-stream.mjs';
// Keep one scheduled serialization, not one queued string per streamed token.
export function snapshotPublisher(read,clients,{intervalMs=100}={}){
 let timer=null,stopped=false;
 const flush=()=>{clearTimeout(timer);timer=null;if(stopped||!clients.size)return;const wire='data: '+JSON.stringify(read())+'\n\n';for(const res of clients)writeEvent(res,wire)};
 return{schedule(){if(!stopped&&clients.size&&!timer){timer=setTimeout(flush,intervalMs);timer.unref?.();}},flush,stop(){stopped=true;clearTimeout(timer);timer=null;}};
}
