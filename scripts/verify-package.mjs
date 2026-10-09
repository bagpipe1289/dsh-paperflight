import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,walk,json,sha256,run,writeJson} from './common.mjs';
const staged=path.join(root,'dist/package'),manifest=await json(path.join(staged,'MANIFEST.sha256.json'));
const files=await walk(staged);assert.equal(files.length,Object.keys(manifest).length+1);
for(const [rel,hash]of Object.entries(manifest)){assert(!path.isAbsolute(rel)&&!rel.split('/').includes('..'));assert.equal(sha256(await fs.readFile(path.join(staged,rel))),hash,rel);assert(rel.includes("source/licenses/npm/")||!/(^|\/)(node_modules|runtime|\.git|\.cache|sessions|backups)(\/|$)|\.private\.|\.log$/i.test(rel),'Unexpected packaged path: '+rel);}
for(const [a,b]of [['index.mjs','source/plugin/index.mjs'],['payload/server.mjs','source/server/server.mjs'],['payload/v4-features.mjs','source/server/v4-features.mjs']])assert.equal(manifest[a],manifest[b]);
const entry=await fs.readFile(path.join(staged,'index.mjs'),'utf8'),pkg=await json(path.join(staged,'package.json'));assert(entry.includes(pkg.version));assert.equal(pkg.private,true);
for(const f of (await walk(path.join(root,'server'))).filter(f=>f.endsWith('.mjs')))await run(process.execPath,['--check',f]);
for(const artifact of await json(path.join(root,'dist/artifacts.json')))assert.equal(sha256(await fs.readFile(path.join(root,'dist',artifact.file))),artifact.sha256);
const sourceArtifact=(await json(path.join(root,'dist/artifacts.json'))).find(a=>a.file.startsWith('dsh-mai-shell-source-'));
assert.equal(manifest['payload/corresponding-source.tgz'],sourceArtifact.sha256,'Local download must match exact published corresponding source');
assert(!files.some(f=>/dsh\.ico$|\.vrm$/i.test(f)),'Restricted assets must not be bundled');
await writeJson(path.join(root,'dist/verification.json'),{manifest:true,files:files.length,sourceMatchesRuntime:true,syntax:true,archiveHashes:true,publicationDisabled:true,liveHostTest:'NOT_RUN',browserVisualTest:'NOT_RUN'});
console.log('Package/source integrity passed ('+files.length+' files). Live host and browser tests NOT_RUN.');
