import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Official Playwright MCP, in-process over an in-memory JSON-RPC transport.
// Only the fixed adapter operations are callable; no evaluate/run-code/file/network tools.
export async function playwrightAdapter(context,{load=()=>import('@playwright/mcp')}={}){
 const {createConnection}=await load(),output=await fs.mkdtemp(path.join(os.tmpdir(),'paperflight-mcp-'));
 async function cleanup(){const base=await fs.realpath(os.tmpdir()),actual=await fs.realpath(output);if(path.dirname(actual)!==base||!path.basename(actual).startsWith('paperflight-mcp-'))throw new Error('Unexpected MCP output path');await fs.rm(actual,{recursive:true,force:true})}
 const server=await createConnection({browser:{isolated:false},capabilities:['core','core-tabs'],webmcp:false,saveSession:false,imageResponses:'omit',outputDir:output,allowUnrestrictedFileAccess:false,codegen:'none',timeouts:{action:10000,navigation:20000,settle:300,idle:0}},async()=>context);
 let sequence=0,closed=false;const pending=new Map();
 const transport={async start(){},async close(){closed=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Browser MCP closed'))}pending.clear()},async send(message){const p=pending.get(message.id);if(!p)return;pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(new Error(message.error.message)):p.resolve(message.result)}};
 await server.connect(transport);
 const request=(method,params)=>new Promise((resolve,reject)=>{if(closed)return reject(new Error('Browser MCP closed'));const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Browser MCP request timed out'))},30000);pending.set(id,{resolve,reject,timer});transport.onmessage({jsonrpc:'2.0',id,method,params})});
 try{await request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'paperflight',version:'0.1.0-preview.60'}});transport.onmessage({jsonrpc:'2.0',method:'notifications/initialized'})}catch(e){await server.close();await cleanup();throw e}
 const allowed=new Set(['browser_snapshot','browser_click','browser_type','browser_tabs']);
 async function call(name,args={}){if(!allowed.has(name))throw new Error('MCP operation not exposed by Paperflight');const r=await request('tools/call',{name,arguments:args});const text=(r.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');if(r.isError)throw new Error(text||'Playwright MCP operation failed');return text}
 return{call,async clearFileChooser(){const r=await request('tools/call',{name:'browser_file_upload',arguments:{}});if(r.isError)throw new Error('Could not clear MCP file chooser state')},async close(){await server.close();await cleanup()}};
}
