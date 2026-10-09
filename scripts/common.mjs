import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const frontend=path.join(root,'frontend');
export const sha256=data=>createHash('sha256').update(data).digest('hex');
export const json=async p=>JSON.parse(await fs.readFile(p,'utf8'));
export async function writeJson(p,value){await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(value,null,2)+'\n');}
export async function walk(dir){const files=[];for(const item of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const p=path.join(dir,item.name);if(item.isSymbolicLink())throw new Error('Symlink in source: '+path.relative(root,p));if(item.isDirectory())files.push(...await walk(p));else if(item.isFile())files.push(p);}return files;}
export async function run(exe,args,{cwd=root,capture=false}={}){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{cwd,windowsHide:true,stdio:capture?['ignore','pipe','inherit']:'inherit',shell:false});let result='';if(capture)child.stdout.on('data',b=>result+=b);child.on('error',reject);child.on('exit',code=>code===0?resolve(result):reject(new Error(`${path.basename(exe)} exited ${code}`)));});}
export async function npm(args,cwd=root,options={}){const cli=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');await fs.access(cli);return run(process.execPath,[cli,...args,'--cache',path.join(root,'.cache/npm'),'--no-audit','--no-fund'],{cwd,...options});}
// Only dedicated generated directories may be cleaned, never source or a linked path.
export async function cleanGenerated(relative){if(!['dist/package','.verify'].includes(relative))throw new Error('Unexpected cleanup target');const target=path.resolve(root,relative),base=await fs.realpath(root);if(!target.startsWith(root+path.sep))throw new Error('Escaped source root');for(let p=target;p!==root;p=path.dirname(p)){try{const stat=await fs.lstat(p);if(stat.isSymbolicLink())throw new Error('Linked generated directory');const real=await fs.realpath(p);if(!real.startsWith(base+path.sep))throw new Error('Escaped real root');}catch(e){if(e.code!=='ENOENT')throw e;}}await fs.rm(target,{recursive:true,force:true});}
const dirs=['plugin','server','scripts','tests','docs','licenses','provenance','frontend/src','frontend/public'];
// npm omits .gitignore from tarballs; it is a checkout aid, not a build input.
const top=['package.json','README.md','NOTICE.md','LICENSE','CHANGELOG.md'];
export async function sourceFiles(){const files=top.map(f=>path.join(root,f));for(const dir of dirs)files.push(...await walk(path.join(root,dir)));for(const f of await fs.readdir(frontend))if(['package.json','package-lock.json','index.html','vite.config.ts','app-version.ts'].includes(f)||/^tsconfig.*\.json$/.test(f))files.push(path.join(frontend,f));return files.sort();}
export async function snapshot(destination){for(const from of await sourceFiles()){const to=path.join(destination,path.relative(root,from));await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(from,to);}}
