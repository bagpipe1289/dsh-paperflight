import {npm,frontend} from './common.mjs';
await npm(['run','typecheck'],frontend);
await npm(['run','build'],frontend);
await import('./audit.mjs');
