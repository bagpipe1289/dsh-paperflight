import {once} from 'node:events';
process.on('disconnect',()=>process.exit(0));
process.on('SIGTERM',()=>process.exit(0));
const [config]=await once(process,'message');
if(config?.type!=='bootstrap')process.exit(1);
// Private IPC, never command-line flags, persisted logs, or browser responses.
globalThis.__MAI_PLUGIN_CONFIG__=config;
try{await import('./server.mjs')}catch(e){console.error(e);process.send?.({type:'failed',code:e.code||'STARTUP'});setTimeout(()=>process.exit(1),50)}
