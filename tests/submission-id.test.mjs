import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,reduceEvent,applyFrame,viewState} from '../server/session-state.mjs';
test('durable user messages expose exact request IDs even for repeated text and snapshot replay',()=>{
 const state=createState(),events=['first','second'].map((rpcId,i)=>({type:'user/message',seq:i+1,time:1000+i,data:{source:{kind:'user',rpcId},content:[{type:'text',text:'same message'}]}}));
 for(const e of events)reduceEvent(state,e);
 assert.deepEqual(viewState(state).messages.map(m=>m.requestId),['first','second']);
 applyFrame(state,{type:'snapshot',header:{id:'test'},cursor:2,records:events.map(event=>({type:'event',event}))});
 assert.deepEqual(viewState(state).messages.map(m=>m.requestId),['first','second']);
 assert.equal(state.running,false);
});
