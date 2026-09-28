// Standalone Toll — the TRIPTYCH: Western Cape × KwaZulu-Natal × Gauteng, three discs, one shared
// calendar clock. Same shell, same province-count-generic view as the diptych (src/views/tollDiptych.js)
// — three lean bakes concatenated into one slice-packed pool, laid out around three columns instead of
// two. (data/toll-*.json baked by the overseer from pipeline/bake-toll.mjs.)
import { createStage } from './stage.js';
import { createHud } from './hud.js';
import { loadDiptychToll } from './data/diptychToll.js';
import { createTollDiptychView } from './views/tollDiptych.js';

const stage = createStage();
stage.boot({
  loadData: loadDiptychToll([
    { url: 'data/toll-wc.json' },        // left disc — Western Cape
    { url: 'data/toll-kzn.json' },       // middle disc — KwaZulu-Natal
    { url: 'data/toll-gauteng.json' },   // right disc — Gauteng
  ]),
  hud: createHud(),
  views: [createTollDiptychView],
  initial: 'diptych',
}).then(() => console.info('[toll] shell up — the triptych pours, one clock, three provinces'))
  .catch((e) => console.error('[toll] boot failed', e));
