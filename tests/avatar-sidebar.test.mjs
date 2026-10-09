import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from '../frontend/node_modules/esbuild/lib/main.js';
import {root,frontend} from '../scripts/common.mjs';
const outfile=path.join(root,'.verify/avatar-sidebar.cjs');
await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {ConversationItem} from './src/routes/chat/ChatWorkspaceSidebar';export function render(tab){return renderToStaticMarkup(<ConversationItem tab={tab} active={false} onSwitch={()=>{}} onClose={()=>{}} actions={<span>actions</span>}/>)}`,loader:'tsx',resolveDir:frontend},jsx:'automatic',define:{'import.meta.env.DEV':'false'},bundle:true,platform:'node',format:'cjs',outfile,alias:{'@':path.join(frontend,'src')}});
globalThis.localStorage={getItem:()=>null};
const {render}=createRequire(import.meta.url)(outfile);
const base={id:'test',type:'webui',label:'Test session',messages:[],sessionInfo:{bot_name:'Test session'},isConnected:true,isTyping:false};
test('connected idle conversations are not green; running conversations are green',()=>{
 const idle=render(base);assert(!idle.includes('bg-emerald-500'));assert(idle.includes('aria-label="空闲"'));
 const running=render({...base,isConnected:false,isTyping:true});assert(running.includes('bg-emerald-500'));assert(running.includes('aria-label="运行中"'));
});
test('disabled avatars remove the robot and avatar column but keep the title state dot',()=>{
 const html=render({...base,showAvatar:false,isTyping:true});assert(!html.includes('data-slot="avatar"'));assert(!html.includes('lucide-bot'));assert(!html.includes('h-9 w-9'));assert(html.includes('bg-emerald-500'));assert(html.includes('Test session'));
 const visible=render({...base,showAvatar:true});assert(visible.includes('lucide-bot'));assert(visible.includes('h-9 w-9'));
});


