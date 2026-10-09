import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../frontend/node_modules/esbuild/lib/main.js';
import {root,frontend} from '../scripts/common.mjs';
const outfile=path.join(root,'.verify/browser-drop.mjs');
await build({entryPoints:[path.join(frontend,'src/dsh/browser-drop.ts')],bundle:true,platform:'node',format:'esm',outfile});
const{droppedBrowserURL}=await import(pathToFileURL(outfile));
test('drop reads one URL, handles URI comments, rejects scripts, credentials, multiple links and own origin',()=>{
 const origin='http://127.0.0.1:3182';
 assert.equal(droppedBrowserURL('# title\r\nhttps://example.com/a','',origin),'https://example.com/a');
 assert.equal(droppedBrowserURL('','https://example.com',origin),'https://example.com/');
 for(const value of ['javascript:alert(1)','file:///C:/secret','http://user:pass@example.com','https://example.com\nhttps://example.org','hello','http://127.0.0.1:3182/settings'])assert.throws(()=>droppedBrowserURL('',value,origin));
});
