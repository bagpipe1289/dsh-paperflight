import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {build} from '../frontend/node_modules/esbuild/lib/main.js';
import {root,frontend} from '../scripts/common.mjs';
test('old theme migrates while preserving retro settings; reset/import stay retro',async()=>{
 const outfile=path.join(root,'.verify/theme.mjs');await fs.mkdir(path.dirname(outfile),{recursive:true});
 await build({stdin:{contents:`export * from './src/lib/theme/storage';export {getComputedTokens} from './src/lib/theme/pipeline';export {futureRetroLightTokens,futureRetroDarkTokens} from './src/lib/theme/tokens';`,resolveDir:frontend,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile});
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),clear:()=>memory.clear()};
 try{const m=await import(pathToFileURL(outfile)),keys=m.THEME_STORAGE_KEYS;
 localStorage.setItem(keys.DASHBOARD_STYLE,'modern');localStorage.setItem(keys.MODE,'dark');localStorage.setItem(keys.STYLE_CONFIG,JSON.stringify({futureRetro:{paperWarmth:72,textureStyle:'dot-grid'}}));
 localStorage.setItem(keys.STYLE_OVERRIDES,JSON.stringify({modern:{typography:{'font-size-base':'2rem'}},'future-retro':{typography:{'font-size-base':'1.125rem'}}}));
 localStorage.setItem(keys.STYLE_CUSTOM_CSS,JSON.stringify({modern:'body {display:none}'}));
 const config=m.loadThemeConfig();assert.equal(config.dashboardStyle,'future-retro');assert.equal(localStorage.getItem(keys.MODE),'dark');assert.equal(config.styleConfig.futureRetro.paperWarmth,72);assert.equal(config.styleConfig.futureRetro.textureStyle,'dot-grid');assert.equal(config.styleTokenOverrides.modern,undefined);assert.deepEqual(config.styleCustomCSS,{});assert.equal(m.getComputedTokens(config,false).typography['font-size-base'],'1.125rem');
 for(const dark of [false,true])assert.equal(m.getComputedTokens({...config,dashboardStyle:'modern',accentColor:'120 100% 50%'},dark).color.primary,(dark?m.futureRetroDarkTokens:m.futureRetroLightTokens).color.primary);
 m.saveThemePartial({dashboardStyle:'modern'});assert.equal(m.loadThemeConfig().dashboardStyle,'future-retro');assert.equal(m.importThemeJSON(JSON.stringify({...config,dashboardStyle:'modern'})).success,true);assert.equal(m.loadThemeConfig().dashboardStyle,'future-retro');m.resetThemeToDefault();assert.equal(m.getComputedTokens(m.loadThemeConfig(),false).typography['font-size-base'],'1rem');
 }finally{delete globalThis.localStorage;}
});
