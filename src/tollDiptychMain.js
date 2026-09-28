// Standalone Toll — the DIPTYCH: Western Cape × Gauteng, two discs, one shared calendar clock.
// Same shell; the loader concatenates two lean bakes into one slice-packed pool, and the diptych view
// lays each province's slice out around its own column. (data/toll-wc.json is baked by the overseer
// from pipeline/bake-toll.mjs once the pipeline lands — until it exists this page fails loudly on boot.)
import { createStage } from './stage.js';
import { createHud } from './hud.js';
import { loadDiptychToll } from './data/diptychToll.js';
import { createTollDiptychView } from './views/tollDiptych.js';

const stage = createStage();
stage.boot({
  loadData: loadDiptychToll([
    { url: 'data/toll-wc.json' },        // left disc — Western Cape
    { url: 'data/toll-gauteng.json' },   // right disc — Gauteng
  ]),
  hud: createHud(),
  views: [createTollDiptychView],
  initial: 'diptych',
}).then(() => console.info('[toll] shell up — the diptych pours, one clock, two provinces'))
  .catch((e) => console.error('[toll] boot failed', e));
