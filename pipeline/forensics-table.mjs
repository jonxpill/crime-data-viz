/**
 * Prints the forensics ranked table against the REAL baked data — the node-side truth the browser
 * tooltips must match to the digit. Run: `node pipeline/forensics-table.mjs [crime ...]`
 * (default: robbery murder). Per crime: the D distribution of testable stations, zone counts under
 * LOOK_CLOSER_D (the ≤10% tuning check), exclusion counts, and the crystalline/liveliest ends of
 * the ranking. `--all` sweeps all six crimes' zone shares (the threshold-tuning view).
 */
import { readFileSync } from 'node:fs';
import { forensicsStats, LOOK_CLOSER_D, TESTABLE_MEAN } from '../src/layouts/forensics.js';

const wc = JSON.parse(readFileSync(new URL('../public/data/westerncape.json', import.meta.url), 'utf8'));
const types = wc.meta.crimeTypes.map((c) => c.key);
const args = process.argv.slice(2).filter((a) => a !== '--all');
const sweep = process.argv.includes('--all');
const wanted = args.length ? args : ['robbery', 'murder'];

const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const f = (x, d = 2) => x.toFixed(d);

if (sweep) {
  console.log(`threshold sweep — % of TESTABLE stations with D < t (rule: ≤ ~10% land in look-closer)\n`);
  console.log('crime        testable  excl   <0.45   <0.50   <0.55   <0.60   <0.65   <0.70');
  for (const ty of types) {
    const st = forensicsStats(wc.stations, ty).filter((s) => s.testable);
    const pct = (t) => ((100 * st.filter((s) => s.D < t).length) / st.length).toFixed(1).padStart(6) + '%';
    console.log(`${ty.padEnd(12)} ${String(st.length).padStart(8)}  ${String(wc.stations.length - st.length).padStart(4)} ${[0.45, 0.5, 0.55, 0.6, 0.65, 0.7].map(pct).join(' ')}`);
  }
  process.exit(0);
}

for (const ty of wanted) {
  const stats = forensicsStats(wc.stations, ty);
  const tested = stats.filter((s) => s.testable).sort((a, b) => a.D - b.D);
  const excluded = stats.filter((s) => !s.testable);
  const Ds = tested.map((s) => s.D);
  const flagged = tested.filter((s) => s.D < LOOK_CLOSER_D);

  console.log(`\n=== ${ty} — Western Cape, 60 monthly returns/station ===`);
  console.log(`stations ${stats.length} · testable ${tested.length} · too small to test ${excluded.length} (mean < ${TESTABLE_MEAN}/month)`);
  console.log(`D distribution (testable): min ${f(Ds[0])} · p10 ${f(q(Ds, 0.1))} · median ${f(q(Ds, 0.5))} · p90 ${f(q(Ds, 0.9))} · max ${f(Ds.at(-1))}`);
  console.log(`look-closer zone (D < ${LOOK_CLOSER_D}): ${flagged.length}/${tested.length} = ${f((100 * flagged.length) / tested.length, 1)}%  ${flagged.length / tested.length <= 0.105 ? '≤10% ✓' : '>10% ✗ — RETUNE'}`);
  console.log(`\nmost crystalline (the look-closer end):`);
  for (const s of tested.slice(0, Math.max(flagged.length, 5)))
    console.log(`  D ${f(s.D)} · ${f(s.mean, 1).padStart(6)}/mo · digit-χ² ${s.chi2p == null ? '— (n<20)' : 'p ' + f(s.chi2p, 3)} · ${s.name}${s.D < LOOK_CLOSER_D ? '   ← look closer' : ''}`);
  console.log(`liveliest (the honest-shimmer end):`);
  for (const s of tested.slice(-3))
    console.log(`  D ${f(s.D)} · ${f(s.mean, 1).padStart(6)}/mo · ${s.name}`);
}
