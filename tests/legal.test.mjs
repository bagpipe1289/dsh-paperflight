import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {legalResponse} from '../server/legal.mjs';

test('legal routes offer local matching source and escape document text',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mai-legal-'));
 try{
  const payload=path.join(root,'payload');await fs.mkdir(payload);await fs.mkdir(path.join(root,'source/docs'),{recursive:true});
  await fs.writeFile(path.join(root,'source/package.json'),JSON.stringify({version:'test<1>'}));
  await fs.writeFile(path.join(root,'source/LICENSE'),'<script>private</script> & notice');
  await fs.writeFile(path.join(payload,'corresponding-source.tgz'),Buffer.from([31,139,1,2,3]));
  const home=await legalResponse('/legal',payload);assert(home.body.includes('test&lt;1&gt;'));assert(home.body.includes('/legal/source.tgz'));
  const license=await legalResponse('/legal/license',payload);assert(license.body.includes('&lt;script&gt;'));assert(!license.body.includes('<script>'));
  const source=await legalResponse('/legal/source.tgz',payload);assert.equal(source.type,'application/gzip');assert.deepEqual(source.body,Buffer.from([31,139,1,2,3]));
  for(const p of ['/legal/../package.json','/legal/%2e%2e/LICENSE','/legal/__proto__','/other/license','/legal/license/extra']) assert.equal(await legalResponse(p,payload),null);
 }finally{assert(root.startsWith(path.join(os.tmpdir(),'mai-legal-')));await fs.rm(root,{recursive:true,force:true});}
});
