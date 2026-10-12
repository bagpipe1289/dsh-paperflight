import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {Readable} from 'node:stream';
import {prepareBrowserTransfer,uploadLimit} from '../plugin/browser-files.mjs';import {ApprovalMemory} from '../server/approval-memory.mjs';import {localFileContext} from './helpers/browser-fs.mjs';
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'paperflight-files-test-'));t.after(async()=>{const real=await fs.realpath(root);assert.equal(path.dirname(real),await fs.realpath(os.tmpdir()));await fs.rm(real,{recursive:true,force:true})});await fs.mkdir(path.join(root,'workspace'));return {root,cwd:path.join(root,'workspace'),exec:localFileContext(path.join(root,'workspace'))}}
test('upload reads exact workspace bytes and refuses approval-stale files',async t=>{
 const {cwd,exec}=await fixture(t);await fs.writeFile(path.join(cwd,'sample.pdf'),Buffer.from('%PDF\0test'));
 let transfer=await prepareBrowserTransfer({action:'upload',path:'sample.pdf'},exec);assert.equal(transfer.summary.bytes,9);const payload=await transfer.upload();assert.equal(payload.mimeType,'application/pdf');assert.equal(payload.buffer.toString(),'%PDF\0test');
 transfer=await prepareBrowserTransfer({action:'upload',path:'sample.pdf'},exec);await fs.writeFile(path.join(cwd,'sample.pdf'),'changed');await assert.rejects(transfer.upload(),/changed/);
});
test('upload rejects outside paths, linked files, folders and excessive size',async t=>{
 const {root,cwd,exec}=await fixture(t);await fs.writeFile(path.join(root,'private.txt'),'private');await fs.mkdir(path.join(root,'outside'));await fs.writeFile(path.join(root,'outside','linked.txt'),'outside');await fs.symlink(path.join(root,'outside'),path.join(cwd,'junction'),process.platform==='win32'?'junction':'dir');
 for(const file of ['../private.txt',path.join(root,'private.txt'),'junction/linked.txt','.'])await assert.rejects(prepareBrowserTransfer({action:'upload',path:file},exec));
 await fs.writeFile(path.join(cwd,'large.bin'),'');await fs.truncate(path.join(cwd,'large.bin'),uploadLimit+1);await assert.rejects(prepareBrowserTransfer({action:'upload',path:'large.bin'},exec),/20 MiB/);
 await fs.link(path.join(root,'private.txt'),path.join(cwd,'hard.txt'));await assert.rejects(prepareBrowserTransfer({action:'upload',path:'hard.txt'},exec),/Hard-linked/);
});
test('downloads are unique workspace files, preserve binary bytes and reject read-only policy',async t=>{
 const {cwd,exec}=await fixture(t),bytes=Buffer.from([0,1,255,80,75]);const d={suggestedFilename:()=> '../../sample.zip',createReadStream:async()=>Readable.from([bytes])};
 const transfer=await prepareBrowserTransfer({action:'download'},exec),a=await transfer.save(d),b=await transfer.save(d);
 assert.notEqual(a.path,b.path);assert.equal(a.bytes,5);assert.deepEqual(await fs.readFile(a.path),bytes);assert(a.relativePath.startsWith('browser-downloads/'));assert.equal(a.sha256.length,64);
 await assert.rejects(prepareBrowserTransfer({action:'download'},localFileContext(cwd,'read-only')),/read-only/);
});
test('download rejects linked destination and removes interrupted partial file',async t=>{
 const {root,cwd,exec}=await fixture(t);await fs.mkdir(path.join(root,'outside'));await fs.symlink(path.join(root,'outside'),path.join(cwd,'browser-downloads'),process.platform==='win32'?'junction':'dir');await assert.rejects(prepareBrowserTransfer({action:'download'},exec),/symlinks|junctions/);
 await fs.unlink(path.join(cwd,'browser-downloads'));const transfer=await prepareBrowserTransfer({action:'download'},exec);
 await assert.rejects(transfer.save({suggestedFilename:()=> 'bad.zip',createReadStream:async()=>Readable.from((async function*(){yield Buffer.from('part');throw new Error('Interrupted')})())}),/Interrupted/);
 assert.deepEqual(await fs.readdir(path.join(cwd,'browser-downloads')),[]);
});
test('file transfers cannot acquire remembered exact or browsing grants',()=>{
 const memory=new ApprovalMemory();for(const action of ['upload','download']){const f={event:'approval/request',agentId:'one',request:{toolName:'mai_browser',reason:'transfer'},toolArguments:JSON.stringify({action,path:'sample.txt'})};assert.deepEqual(memory.scopes(f),[]);assert(!memory.has(f));assert.throws(()=>memory.remember(f));assert.throws(()=>memory.remember(f,'browse-origin'))}
});
