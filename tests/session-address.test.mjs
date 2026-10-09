import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionAddressFromRows} from '../server/session-address.mjs';
test('native child history uses durable parent and catalog mode',()=>{
 const rows=[{sessionId:'parent',projections:{values:{subagentCatalog:[{id:'child',mode:'one-shot'}]}}},{sessionId:'child',parentSessionId:'parent',origin:'subagent'}];
 assert.deepEqual(sessionAddressFromRows('child',rows),{kind:'subagent',parentSessionId:'parent',childSessionId:'child',mode:'one-shot'});
});
test('fork parent does not turn a top-level session into a subagent',()=>{
 assert.deepEqual(sessionAddressFromRows('fork',[{sessionId:'fork',parentSessionId:'source',origin:'fork'}]),{kind:'session',sessionId:'fork'});
});
test('missing catalog keeps unknown child mode; missing durable parent fails',()=>{
 assert.equal(sessionAddressFromRows('child',[{sessionId:'child',parentSessionId:'parent',origin:'subagent'}]).mode,'unknown');
 assert.throws(()=>sessionAddressFromRows('child',[{sessionId:'child',origin:'subagent'}]),/父会话/);
});
