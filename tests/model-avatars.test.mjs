import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../frontend/node_modules/esbuild/lib/main.js';
import {root,frontend,walk} from '../scripts/common.mjs';
const outfile=path.join(root,'.verify/model-avatars.mjs');
await build({entryPoints:[path.join(frontend,'src/dsh/modelIdentity.ts')],bundle:true,platform:'node',format:'esm',outfile});
const model=await import(pathToFileURL(outfile));
test('model placeholders distinguish recorded providers and can fall back without losing names',()=>{
 assert.equal(model.modelIdentity({model:'DeepSeek-V4-Flash'}).avatar,'/model-avatars/deepseek.svg');
 assert.equal(model.modelIdentity({provider:'subagent-codex'}).avatar,'/model-avatars/codex.svg');
 assert.equal(model.modelIdentity({model:'notcodex'}).avatar,undefined);
 for(const provider of ['deepseek','codex']){const enabled=model.modelIdentity({provider});const disabled=model.modelIdentity({provider},false);assert.equal(disabled.name,enabled.name);assert.equal(disabled.avatar,undefined);}
});
test('avatar preference persists and notifies same-window subscribers on both transitions',()=>{
 const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v))};globalThis.window=new EventTarget();let events=0;window.addEventListener('dsh-model-avatars-change',()=>events++);
 try{assert.equal(model.modelAvatarsEnabled(),true);model.setModelAvatarsEnabled(false);assert.equal(model.modelAvatarsEnabled(),false);assert.equal(saved.get('dsh-model-avatars-enabled'),'false');model.setModelAvatarsEnabled(true);assert.equal(model.modelAvatarsEnabled(),true);assert.equal(events,2);}finally{delete globalThis.window;delete globalThis.localStorage;}
 assert.equal(model.modelAvatarsEnabled(),true);
});
test('current public assets exclude VRM and former avatars; favicon references DSH asset',async()=>{
 const assets=(await walk(path.join(frontend,'public'))).map(f=>path.relative(frontend,f).replaceAll('\\','/'));
 assert(!assets.some(f=>/\.vrm$/i.test(f)||/maimai\.ico$|model-avatars\/.*\.ico$/i.test(f)));
 assert(!assets.includes('public/dsh.ico'));assert((await fs.readFile(path.join(frontend,'index.html'),'utf8')).includes('href="/host-favicon.svg"'));
 for(const name of ['deepseek','codex']){const svg=await fs.readFile(path.join(frontend,'public/model-avatars',name+'.svg'),'utf8');assert(svg.includes('<svg'));assert(!svg.includes('<image'));}
});


test('custom avatars survive toggling, isolate models, reset and reject unsafe stored values',()=>{
 const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};globalThis.window=new EventTarget();let events=0;window.addEventListener('dsh-model-avatars-change',()=>events++);
 const avatar='data:image/png;base64,iVBORw0KGgo=';
 try{
  model.setCustomModelAvatar('codex',avatar);assert.equal(model.customModelAvatar('codex'),avatar);assert.equal(model.customModelAvatar('deepseek'),undefined);
  assert.equal(model.modelIdentity({provider:'codex'},true,{codex:avatar}).avatar,avatar);
  model.setModelAvatarsEnabled(false);assert.equal(model.modelIdentity({provider:'codex'},false,{codex:avatar}).showAvatar,false);assert.equal(model.modelIdentity({provider:'codex'},false,{codex:avatar}).avatar,undefined);assert.equal(model.customModelAvatar('codex'),avatar);
  assert.throws(()=>model.setCustomModelAvatar('codex','https://example.com/tracker.png'));assert.equal(model.customModelAvatar('codex'),avatar);
  model.setCustomModelAvatar('codex');assert.equal(model.customModelAvatar('codex'),undefined);assert.equal(events,3);
  saved.set('dsh-model-avatar-codex','data:image/svg+xml,<svg/>');assert.equal(model.customModelAvatar('codex'),undefined);
  localStorage.setItem=()=>{throw new Error('quota')};assert.throws(()=>model.setCustomModelAvatar('codex',avatar),/存储/);assert.equal(events,3);
 }finally{delete globalThis.window;delete globalThis.localStorage}
});

test('avatar uploads reject oversized or unsupported files before decoding',async()=>{
 await assert.rejects(model.uploadModelAvatar('codex',{size:2097153,type:'image/png',name:'a.png'}),/2 MB/);
 await assert.rejects(model.uploadModelAvatar('deepseek',{size:50,type:'image/svg+xml',name:'a.svg'}),/PNG/);
});


test('upload normalizes a thumbnail and releases the temporary image even on decode failure',async()=>{
 const saved=new Map(),avatar='data:image/png;base64,iVBORw0KGgo=';globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};globalThis.window=new EventTarget();
 const original={Image:globalThis.Image,document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL};let draw,released=0,fail=false;
 URL.createObjectURL=()=> 'blob:test';URL.revokeObjectURL=()=>released++;
 globalThis.Image=class{naturalWidth=800;naturalHeight=400;set src(_){queueMicrotask(()=>fail?this.onerror():this.onload())}};
 globalThis.document={createElement:()=>({getContext:()=>({drawImage:(...args)=>draw=args.slice(1)}),toDataURL:()=>avatar})};
 try{await model.uploadModelAvatar('deepseek',{size:128,type:'image/png',name:'wide.png'});assert.deepEqual(draw,[0,64,256,128]);assert.equal(model.customModelAvatar('deepseek'),avatar);assert.equal(released,1);fail=true;await assert.rejects(model.uploadModelAvatar('deepseek',{size:128,type:'image/png',name:'bad.png'}),/无法读取/);assert.equal(released,2);assert.equal(model.customModelAvatar('deepseek'),avatar);}finally{globalThis.Image=original.Image;globalThis.document=original.document;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;delete globalThis.localStorage;delete globalThis.window;}
});
