import {npm,frontend} from './common.mjs';
// The inherited lockfile uses legacy peer resolution (React 19 + older Joyride hook peers).
await npm(['ci','--legacy-peer-deps','--ignore-scripts','--prefer-offline'],frontend);
