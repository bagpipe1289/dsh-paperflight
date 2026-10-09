import path from 'node:path';
import {root,json} from './common.mjs';
const items=await json(path.join(root,'docs/release-gates.json'));
for(const item of items)console.log(`${item.status}: ${item.id} - ${item.description}`);
if(items.some(item=>item.status!=='PASS')){console.error('Not cleared for publication. This command never uploads anything.');process.exitCode=1;}
