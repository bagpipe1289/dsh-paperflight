import{test}from'node:test';import assert from'node:assert/strict';import{engramStatus,engramRouteAllowed,validateDefaultPreset,defaultPresetPatch}from'../server/engram-contract.mjs';
test('Engram distinguishes absent, installed disabled, loading and active plugins',()=>{
 const bundle={name:'@kenz1117/dsh-engram',installed:true,version:'0.7.13'},plugin={moduleName:bundle.name,enabled:true,fiberPhase:'active'};
 assert.equal(engramStatus([],[]).installed,false);assert.equal(engramStatus([],[bundle]).state,'disabled');assert.equal(engramStatus([{...plugin,enabled:false}],[bundle]).enabled,false);assert.equal(engramStatus([{...plugin,fiberPhase:'pending'}],[bundle]).state,'unavailable');assert.equal(engramStatus([plugin],[bundle]).enabled,true);assert.equal(engramStatus([{...plugin,moduleName:'fake-dsh-engram'}],[]).installed,false);
});
test('memory bridge rejects path traversal, arbitrary paths and unsupported methods',()=>{
 for(const route of ['stats','list','corridor','export','history-backfill/status'])assert(engramRouteAllowed('GET',route));for(const route of ['forget','restore','update','consolidate'])assert(engramRouteAllowed('POST',route));
 for(const route of ['../settings','stats/../../settings','https://evil.test','stats?x=1','%2e%2e/settings',''])assert(!engramRouteAllowed('GET',route));assert(!engramRouteAllowed('GET','forget'));assert(!engramRouteAllowed('DELETE','list'));
});
test('default presets must exist and be usable',()=>{const catalog={presets:[{id:'standard'},{id:'broken',broken:'missing provider'}]};assert.equal(validateDefaultPreset(catalog,'standard'),'standard');for(const id of ['missing','broken',null,{}])assert.throws(()=>validateDefaultPreset(catalog,id));});

test('default preset writes the registered host field rather than assuming an old name',()=>{for(const key of ['selectedDefault','defaultPreset'])assert.deepEqual(defaultPresetPatch({fields:[{path:[key]}]},'browser'),[{op:'set',path:[key],value:'browser'}]);assert.throws(()=>defaultPresetPatch({fields:[]},'standard'));});
