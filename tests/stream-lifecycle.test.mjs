import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import http from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {eventStream,writeEvent} from '../server/event-stream.mjs';
import {childService} from '../plugin/child-service.mjs';

class Response extends EventEmitter{
 writes=[];writableEnded=false;destroyed=false;
 writeHead(){}
 write(data){if(this.writableEnded||this.destroyed)throw new Error('write after end');this.writes.push(data);}
 end(){this.writableEnded=true;this.emit('finish');} // deliberately no close
 destroy(){this.destroyed=true;this.emit('close');}
}
test('SSE finish without close cancels heartbeat and rejects late upstream frames',async()=>{
 const res=new Response(),stream=eventStream(res,{heartbeatMs:2});let releases=0;
 res.end();stream.attach(()=>releases++);const n=res.writes.length;
 await delay(25);assert.equal(res.writes.length,n);assert.equal(releases,1);
 assert.equal(stream.send('late'),false);assert.equal(writeEvent(res,'late'),false);
 stream.end();res.emit('close');assert.equal(releases,1);
});
test('response errors clean up late subscriptions and do not escape as unhandled errors',()=>{
 const res=new Response(),stream=eventStream(res);let releases=0;
 res.emit('error',Object.assign(new Error('write after end'),{code:'ERR_STREAM_WRITE_AFTER_END'}));
 stream.attach(()=>releases++);assert.equal(releases,1);assert(res.destroyed);assert(stream.ended);
});
test('HTTP stream end and reconnect leave the server able to serve ordinary requests',async()=>{
 let releases=0;
 const server=http.createServer((req,res)=>{if(req.url==='/health'){res.end('ok');return;}const stream=eventStream(res,{heartbeatMs:2});stream.attach(()=>releases++);stream.send('data: done\n\n');stream.end();});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${server.address().port}`;for(let i=0;i<8;i++)assert.match(await(await fetch(base)).text(),/done/);await delay(25);assert.equal(await(await fetch(base+'/health')).text(),'ok');assert.equal(releases,8);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
function fixture(options={}){
 const children=[],logs=[];
 const service=childService({version:'test',bootstrap:{type:'bootstrap'},onLog:s=>logs.push(s),spawn:()=>{const c=new EventEmitter();c.stderr=new EventEmitter();c.exitCode=null;c.signalCode=null;c.send=()=>{};c.kill=()=>{c.signalCode='SIGTERM';c.emit('exit',null)};children.push(c);return c;},...options});
 return{service,children,logs};
}
test('launcher restarts crashed child and coalesces concurrent visits without restarting host',async()=>{
 const{service,children,logs}=fixture();const p=service.start();assert.equal(service.start(),p);assert.equal(children.length,1);
 children[0].emit('message',{type:'ready',port:1234});assert.equal((await p).state,'ready');
 children[0].stderr.emit('data','simulated crash');children[0].emit('exit',1);assert.equal(service.status.state,'stopped');assert.deepEqual(logs,['simulated crash']);
 const p2=service.start();assert.equal(service.start(),p2);assert.equal(children.length,2);children[1].emit('message',{type:'ready',port:1234});assert.equal((await p2).state,'ready');
 await service.stop();await service.start();assert.equal(children.length,2);
});
test('failed startup does not loop and an explicit later visit may retry',async()=>{
 const{service,children}=fixture();const p=service.start();children[0].emit('message',{type:'failed',code:'EADDRINUSE'});assert.equal((await p).state,'failed');assert.equal(children.length,1);
 const retry=service.start();assert.equal(children.length,2);children[1].emit('message',{type:'ready',port:2345});await retry;await service.stop();
});
test('startup timeout terminates child and settles waiting launcher',async()=>{
 const{service,children}=fixture({timeoutMs:5});const p=service.start();await delay(15);assert.equal((await p).state,'failed');assert.equal(children[0].signalCode,'SIGTERM');assert.equal(children.length,1);await service.stop();
});
