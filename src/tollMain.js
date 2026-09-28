// Standalone Toll — entry point. See docs/plans/standalone-shell.md.
//
// Boots the shared stage with the WC province data bundle and the view set, opening on the idle murder map.
// (S0 was a bare stage; S1 extracted the shell into stage.js; S2 wires the real data + resting map. The
// Toll view + K routing land in S5.)
import { createStage } from './stage.js';
import { createHud } from './hud.js';
import { loadProvinceToll } from './data/provinceToll.js';
import { createTollView } from './views/toll.js';

// The standalone Toll: you LAND in the ceremony — it auto-pours on load and stands. No idle map (murderMap
// stays in the repo as a proven contract example, just not mounted here — see docs/plans/standalone-shell.md).
// Data = the LEAN toll bake (bake-toll.mjs): same reconciliation policy as every province, so the pages are
// comparable — M 61,561 (the explorer's own pipeline reads 61,383: it keeps DataFirst's 2018–23, this bake
// takes SAPS's audited restatement — divergence known + documented, the explorer's upgrade is a later item).
const stage = createStage();
stage.boot({
  loadData: loadProvinceToll('data/toll-wc.json'),
  hud: createHud(),
  views: [createTollView],
  initial: 'toll',
}).then(() => console.info('[toll] shell up — the toll pours'))
  .catch((e) => console.error('[toll] boot failed', e));
