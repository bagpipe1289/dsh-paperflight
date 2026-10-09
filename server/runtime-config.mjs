const c=globalThis.__MAI_PLUGIN_CONFIG__;
if(!c)throw new Error('Start this shell through the DSH plugin.');
export const hostVersion=c.hostVersion||'unknown';
export const runtime=c.runtime,home=c.home,profileDir=c.profileDir,backendOrigin=c.origin,authUrl=c.authUrl,wsModule=c.wsModule,hostStartedAt=c.hostStartedAt,launchKey=c.launchKey,port=c.port,workspace=c.workspace;
