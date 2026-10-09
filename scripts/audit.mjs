import fs from 'node:fs/promises';
import path from 'node:path';
import {root,frontend,walk,json,writeJson,sha256,sourceFiles} from './common.mjs';
const baseline=await json(path.join(root,'provenance/upstream-manifest.json'));
const states=[];
const current=(await sourceFiles()).filter(f=>f.startsWith(frontend+path.sep));
const currentPaths=new Set(current.map(f=>path.relative(frontend,f).split(path.sep).join('/')));
for(const file of baseline.files){const rel=file.path;if(path.isAbsolute(rel)||rel.split(/[\\/]/).includes('..'))throw new Error('Invalid provenance path');let hash;try{hash=sha256(await fs.readFile(path.join(frontend,rel)))}catch(e){if(e.code!=='ENOENT')throw e;}states.push({path:rel,upstreamSha256:file.sha256,currentSha256:hash??null,status:!hash?'removed':hash===file.sha256?'unchanged':'modified'});currentPaths.delete(rel);}
for(const rel of currentPaths)states.push({path:rel,currentSha256:sha256(await fs.readFile(path.join(frontend,rel))),status:'added'});
await writeJson(path.join(root,'provenance/changes.json'),{preparedDate:'2026-10-01',scope:'Frontend files compared with original copy; not a feature count',counts:states.reduce((a,f)=>(a[f.status]=(a[f.status]||0)+1,a),{}),files:states});
const lock=await json(path.join(frontend,'package-lock.json')),deps=[];
const supplements=await json(path.join(root,'provenance/supplemental-licenses.json'));
for(const [rel,pkg]of Object.entries(lock.packages)){if(!rel)continue;if(!rel.startsWith('node_modules/')||rel.split('/').includes('..'))throw new Error('Invalid lock path');
 const dir=path.join(frontend,rel);let names=[];try{names=await fs.readdir(dir)}catch(e){if(e.code!=='ENOENT')throw e;}
 const licenseFiles=[];
 for(const f of names.filter(f=>/^(licen[sc]e|copying|notice|copyright|third[-_ ]party)([._ -]|$)/i.test(f))){const from=path.join(dir,f);if(!(await fs.lstat(from)).isFile())continue;const dest=path.join(root,'licenses/npm',rel.replaceAll('node_modules/',''),f);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(from,dest);licenseFiles.push(path.relative(root,dest).split(path.sep).join('/'));}
 // victory-vendor includes third-party notices below lib-vendor, not at package root.
 if(rel==='node_modules/victory-vendor'&&names.includes('lib-vendor'))for(const from of await walk(path.join(dir,'lib-vendor'))){if(!/^license([._ -]|$)/i.test(path.basename(from)))continue;const dest=path.join(root,'licenses/npm/victory-vendor',path.relative(dir,from));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(from,dest);licenseFiles.push(path.relative(root,dest).split(path.sep).join('/'));}
 const name=rel.split('node_modules/').at(-1),supplement=supplements.packages.find(p=>p.name===name&&p.version===pkg.version);
 for(const evidence of supplement?.found||[]){const dest=path.resolve(root,evidence.path);if(!dest.startsWith(path.join(root,'licenses/supplemental')+path.sep))throw new Error('Invalid supplemental license path');await fs.access(dest);licenseFiles.push(evidence.path);}
 deps.push({lockPath:rel,name,version:pkg.version,declaredLicense:pkg.license||'UNKNOWN',optional:!!pkg.optional,dev:!!pkg.dev,resolved:pkg.resolved,integrity:pkg.integrity,installed:!!names.length,licenseFiles,...(supplement?.reviewRequired?{licenseProvenanceReviewRequired:true}: {})});
}
await writeJson(path.join(root,'provenance/dependencies.json'),{lockfileSha256:sha256(await fs.readFile(path.join(frontend,'package-lock.json'))),note:'Declared metadata plus installed package license texts, not a compatibility opinion. Optional packages for other operating systems may not be installed.',packages:deps});
const assets=[];for(const dir of ['public','src/assets'])for(const file of await walk(path.join(frontend,dir)))assets.push({path:path.relative(frontend,file).split(path.sep).join('/'),sha256:sha256(await fs.readFile(file)),bytes:(await fs.stat(file)).size});
// Read SFNT naming table without modifying the font.
const font=await fs.readFile(path.join(frontend,'public/fonts/JetBrainsMono-Medium.ttf')),fontNames=[];
for(let i=0;i<font.readUInt16BE(4);i++){const t=12+i*16;if(font.toString('ascii',t,t+4)!=='name')continue;const offset=font.readUInt32BE(t+8),count=font.readUInt16BE(offset+2),base=offset+font.readUInt16BE(offset+4);for(let j=0;j<count;j++){const n=offset+6+j*12,platform=font.readUInt16BE(n),id=font.readUInt16BE(n+6);if(![0,1,2,5,13,14].includes(id))continue;const data=font.subarray(base+font.readUInt16BE(n+10),base+font.readUInt16BE(n+10)+font.readUInt16BE(n+8));let value;if(platform===0||platform===3){value=Buffer.from(data).swap16().toString('utf16le')}else value=data.toString('latin1');if(!fontNames.some(v=>v.id===id&&v.value===value))fontNames.push({id,value});}}
await writeJson(path.join(root,'provenance/assets.json'),{fontNames,vrmRemoved:true,modelAvatars:'Project-created SVG placeholders',files:assets});
for(const f of ['licenses/JetBrainsMono-OFL.txt','licenses/CC-BY-4.0.txt','provenance/license-evidence.json'])await fs.access(path.join(root,f));
const source=await sourceFiles(),findings=[];
for(const file of source){const rel=path.relative(root,file).split(path.sep).join('/');if(!rel.startsWith("licenses/npm/")&&/(^|\/)(runtime|\.git|\.cache|node_modules|sessions|backups)(\/|$)|\.private\.|\.log$/i.test(rel))findings.push({path:rel,rule:'forbidden-file'});
 if(/\.(?:mjs|js|ts|tsx|json|md|html|ya?ml|css)$/i.test(file)){const value=await fs.readFile(file,'utf8');for(const [rule,re]of [['personal-absolute-path',/(?:[a-z]:[\\/](?:Users|data[\\/]Documents[\\/]AgentWorkspace)[\\/]|(?<![a-z0-9_])\/Users\/(?!example\/)[a-z0-9._-]+\/)/i],['github-credential',/\b(?:gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,})\b/],['api-secret',/\bsk-[a-zA-Z0-9]{24,}\b/]])if(re.test(value))findings.push({path:rel,rule});}}
await writeJson(path.join(root,'provenance/audit-summary.json'),{files:source.length,frontendChanges:states.reduce((a,f)=>(a[f.status]=(a[f.status]||0)+1,a),{}),dependencies:deps.length,unknownLicense:deps.filter(p=>p.declaredLicense==='UNKNOWN').map(p=>p.lockPath),installedWithoutLicenseText:deps.filter(p=>p.installed&&!p.licenseFiles.length).map(p=>p.lockPath),notInstalled:deps.filter(p=>!p.installed).map(p=>p.lockPath),sensitivePatternFindings:findings,limitation:'Pattern scan is not proof of absence of all private data; redistribution permissions still pending.'});
if(findings.length)throw new Error('Review source audit findings in provenance/audit-summary.json');
console.log(JSON.stringify({sourceFiles:source.length,dependencies:deps.length,unknownLicense:deps.filter(p=>p.declaredLicense==='UNKNOWN').length,installedWithoutLicenseText:deps.filter(p=>p.installed&&!p.licenseFiles.length).length,sensitivePatternFindings:0}));
