import test from 'node:test';
import assert from 'node:assert/strict';
import {projectUsage} from '../plugin/projection.mjs';
test('only official lifetime totals are projected; unrelated account fields and credentials are discarded',()=>{
 const r=projectUsage({total_costs:[{currency:'CNY',amount:'1.2304',extra:'discard'}],normal_wallets:[{balance:'99.00'}],token:'secret',contact:'private'},123);
 assert.deepEqual(r,{status:'ready',totals:[{currency:'CNY',amount:'1.2304'}],scope:'account-lifetime',source:'platform-user-summary',updatedAt:123});
});
test('a real zero is preserved; wallet balances never become cumulative spend',()=>{
 assert.equal(projectUsage({total_costs:[{currency:'CNY',amount:'0'}]}).status,'ready');
 for(const x of [{normal_wallets:[{balance:'34'}]},null,{}, {total_costs:[]}])assert.equal(projectUsage(x).status,'unavailable');
});
test('currencies stay separate and malformed or duplicate totals are rejected',()=>{
 assert.equal(projectUsage({total_costs:[{currency:'CNY',amount:'1.00'},{currency:'USD',amount:'2.00'}]}).totals.length,2);
 for(const amount of ['-1','NaN','Infinity','1e999','',null,1,'900719925474099100'])assert.equal(projectUsage({total_costs:[{currency:'CNY',amount}]}).status,'unavailable');
 assert.equal(projectUsage({total_costs:[{currency:'EUR',amount:'1'}]}).status,'unavailable');
 assert.equal(projectUsage({total_costs:[{currency:'CNY',amount:'1'},{currency:'CNY',amount:'2'}]}).status,'unavailable');
});
