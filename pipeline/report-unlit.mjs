#!/usr/bin/env node
/**
 * Trust report for the UNLIT FIELD (docs/plans/unlit-field.md, Phase 0 gate).
 *
 * Prints every survey reporting rate with its citation, then the implied Western Cape
 * unreported totals per crime — U = R × (1 − r) / r, the exact math the app draws — so the
 * numbers can be eyeballed against the GPSJS publications BEFORE any dots exist. Also prints
 * the max U across crimes/years: the unlit pool's size (asserted here, not guessed in the app).
 *
 *   node pipeline/report-unlit.mjs
 */
import { readFileSync } from 'node:fs';

const rates = JSON.parse(readFileSync(new URL('../data/vocs-reporting.json', import.meta.url)));
const wc = JSON.parse(readFileSync(new URL('../public/data/westerncape.json', import.meta.url)));

const years = wc.meta.years;
const yearLabels = wc.meta.yearLabels || years;
const U = (R, r) => Math.round((R * (1 - r)) / r); // per station-year in the app; totals here for the audit

console.log('UNLIT FIELD — trust report (grain: ' + rates.grain + ')');
console.log('  ' + rates.grainNote + '\n');

let maxU = 0, maxUAt = '';
for (const [key, spec] of Object.entries(rates.rates)) {
  console.log(`── ${key}  ·  r = ${spec.r}  (${(spec.r * 100).toFixed(1)}% reported some or all)  ·  confidence: ${spec.confidence}${spec.floor ? '  ·  FLOOR' : ''}`);
  console.log(`   survey: ${spec.surveyCategory}`);
  console.log(`   src:    ${spec.src}`);
  console.log(`   check:  ${spec.crosscheck}`);
  for (const c of spec.caveats || []) console.log(`   caveat: ${c}`);
  console.log('   year      reported   est.unreported   est.total   (×' + ((1 - spec.r) / spec.r + 1).toFixed(3) + ')');
  for (let yi = 0; yi < years.length; yi++) {
    const R = wc.stations.reduce((a, s) => a + ((s.crimes[key] && s.crimes[key][years[yi]]) || 0), 0);
    // Sum of per-station U (the app's math), NOT U of the summed R — rounding differs slightly.
    const u = wc.stations.reduce((a, s) => a + U((s.crimes[key] && s.crimes[key][years[yi]]) || 0, spec.r), 0);
    if (u > maxU) { maxU = u; maxUAt = `${key} ${yearLabels[yi]}`; }
    console.log(`   ${String(yearLabels[yi]).padEnd(9)} ${R.toLocaleString().padStart(8)}   ${u.toLocaleString().padStart(14)}   ${(R + u).toLocaleString().padStart(9)}`);
  }
  console.log('');
}

for (const [key, why] of Object.entries(rates.excluded)) console.log(`── ${key} · EXCLUDED — ${why}\n`);

console.log(`MAX U across crimes/years: ${maxU.toLocaleString()}  (${maxUAt}) — the unlit pool's dot budget.`);
