// Explicit maintainer-only network step. Normal builds use the checked-in evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,frontend,sha256,writeJson} from './common.mjs';
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(`License source returned ${r.status}`);return r.text();};
const fontUrl='https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt';
const font=await get(fontUrl);if(!font.includes('SIL OPEN FONT LICENSE')||!font.includes('JetBrains'))throw new Error('Unexpected font license');
await fs.writeFile(path.join(root,'licenses/JetBrainsMono-OFL.txt'),font);
await fs.writeFile(path.join(frontend,'public/fonts/OFL.txt'),font);
const ccUrl='https://creativecommons.org/licenses/by/4.0/legalcode.txt';
const cc=await get(ccUrl);if(!cc.includes('Attribution 4.0'))throw new Error('Unexpected CC text');await fs.writeFile(path.join(root,'licenses/CC-BY-4.0.txt'),cc);
const {build}=await import('../frontend/node_modules/esbuild/lib/main.js');
const outfile=path.join(root,'.verify/streamline.mjs');await fs.mkdir(path.dirname(outfile),{recursive:true});
await build({entryPoints:[path.join(frontend,'src/components/ui/streamline-icons.ts')],bundle:true,format:'esm',platform:'node',outfile});
const {streamlineIcons}=await import(pathToFileURL(outfile));
const collections=[];
for(const [collection,icons]of Object.entries(streamlineIcons)){
 const url=`https://raw.githubusercontent.com/iconify/icon-sets/master/json/${collection}.json`;
 const raw=await get(url),data=JSON.parse(raw);
 collections.push({collection,url,sha256:sha256(raw),info:data.info,localIcons:Object.entries(icons).map(([name,value])=>({name,bodyMatchesCurrentDataset:value.body===data.icons[name]?.body}))});
}
await writeJson(path.join(root,'provenance/license-evidence.json'),{checkedDate:'2026-10-01',font:{url:fontUrl,sha256:sha256(font)},ccBy:{url:ccUrl,sha256:sha256(cc)},collections});
console.log('Official font/CC license texts saved; local Streamline paths compared with dataset.');
