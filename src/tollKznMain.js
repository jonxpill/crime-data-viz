// Standalone Toll — KWAZULU-NATAL. Same shell, same view, a different province's data bundle.
// (The pattern: one entry per province page; the loader + label do all the differing work.)
import { createStage } from './stage.js';
import { createHud } from './hud.js';
import { loadProvinceToll } from './data/provinceToll.js';
import { createTollView } from './views/toll.js';

const stage = createStage();
stage.boot({
  loadData: loadProvinceToll('data/toll-kzn.json'),
  hud: createHud(),
  views: [createTollView],
  initial: 'toll',
}).then(() => console.info('[toll] shell up — the KZN toll pours'))
  .catch((e) => console.error('[toll] boot failed', e));
