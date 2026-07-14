// Standalone Toll — entry point. See docs/plans/standalone-shell.md.
//
// Boots the shared stage with the WC province data bundle and the view set, opening on the idle murder map.
// (S0 was a bare stage; S1 extracted the shell into stage.js; S2 wires the real data + resting map. The
// Toll view + K routing land in S5.)
import { createStage } from './stage.js';
import { createHud } from './hud.js';
import { loadWcProvince } from './data/wcProvince.js';
import { createTollView } from './views/toll.js';

// The standalone Toll: you LAND in the ceremony — it auto-pours on load and stands. No idle map (murderMap
// stays in the repo as a proven contract example, just not mounted here — see docs/plans/standalone-shell.md).
const stage = createStage();
stage.boot({
  loadData: loadWcProvince,
  hud: createHud(),
  views: [createTollView],
  initial: 'toll',
}).then(() => console.info('[toll] shell up — the toll pours'))
  .catch((e) => console.error('[toll] boot failed', e));
