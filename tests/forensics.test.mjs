/**
 * Synthetic-series unit tests for the forensics statistics (node, zero deps: `npm test`).
 *
 * The contract under test (the plan's non-negotiables):
 *  1. A true Poisson tally must CENTRE on D ≈ 1 — even with strong real seasonality (the seasonal
 *     adjustment is load-bearing; the naive var/mean must be visibly inflated on the same series).
 *  2. Rigged (suspiciously regular) series must rank CRYSTALLINE — the lowest D ranks.
 *  3. Stations with mean < 5/month are untestable — excluded, never ranked.
 *  4. Last-digit χ²: round-number rigging → tiny p; honest Poisson → unremarkable p; and no p at
 *     all when too few months clear the ≥20-count bar.
 * All deterministic (seeded RNG) — a failure is a regression, never noise.
 */
import assert from 'node:assert/strict';
import { forensicsStats, chi2UpperP, LOOK_CLOSER_D, TESTABLE_MEAN, DIGIT_MIN_N } from '../src/layouts/forensics.js';

// -- seeded RNG + Poisson sampler (Knuth; fine for λ ≤ ~500) ------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(rng, lam) {
  const L = Math.exp(-lam);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
const N_MONTHS = 60;
const station = (name, counts) => ({ name, monthly: { robbery: counts } });
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

let passed = 0;
function test(label, fn) { fn(); passed++; console.log('  ok — ' + label); }

// ---- 1. Poisson centres on D ≈ 1 ---------------------------------------------------------------
test('flat Poisson tallies centre on D ≈ 1', () => {
  const rng = mulberry32(0xa11ce);
  const stations = [];
  for (let i = 0; i < 400; i++) {
    const lam = 8 + rng() * 112; // 8..120 per month — the testable range
    stations.push(station('p' + i, Array.from({ length: N_MONTHS }, () => poisson(rng, lam))));
  }
  const stats = forensicsStats(stations, 'robbery');
  const Dmean = mean(stats.map((s) => s.D));
  assert.ok(Math.abs(Dmean - 1) < 0.05, `mean D ${Dmean.toFixed(3)} not ≈ 1`);
  const flagged = stats.filter((s) => s.D < LOOK_CLOSER_D).length;
  assert.ok(flagged / stats.length < 0.03, `${flagged}/400 honest tallies landed in look-closer`);
  for (const s of stats) assert.equal(s.testable, true);
});

test('strongly seasonal Poisson still centres on D ≈ 1 (and naive var/mean would not)', () => {
  const rng = mulberry32(0x5ea50);
  const stations = [], naive = [];
  for (let i = 0; i < 200; i++) {
    const lam = 15 + rng() * 60;
    const counts = Array.from({ length: N_MONTHS }, (_, m) =>
      poisson(rng, lam * (1 + 0.6 * Math.sin((2 * Math.PI * (m % 12)) / 12)))); // ±60% seasonal wave
    stations.push(station('s' + i, counts));
    const g = mean(counts);
    naive.push(counts.reduce((a, c) => a + (c - g) * (c - g), 0) / (N_MONTHS - 1) / g);
  }
  const stats = forensicsStats(stations, 'robbery');
  const Dmean = mean(stats.map((s) => s.D));
  assert.ok(Math.abs(Dmean - 1) < 0.07, `seasonal-adjusted mean D ${Dmean.toFixed(3)} not ≈ 1`);
  assert.ok(mean(naive) > 1.5, `naive var/mean ${mean(naive).toFixed(2)} — seasonality should inflate it (adjustment is load-bearing)`);
  const flagged = stats.filter((s) => s.D < LOOK_CLOSER_D).length;
  assert.ok(flagged / stats.length < 0.03, `${flagged}/200 seasonal-but-honest stations flagged`);
});

// ---- 2. rigged ranks crystalline ---------------------------------------------------------------
test('rigged series rank crystalline (lowest D), Poisson does not', () => {
  const rng = mulberry32(0xf00d);
  const stations = [];
  for (let i = 0; i < 200; i++) {
    const lam = 10 + rng() * 80;
    stations.push(station('honest' + i, Array.from({ length: N_MONTHS }, () => poisson(rng, lam))));
  }
  for (let i = 0; i < 10; i++) {
    const quota = 20 + i * 7; // a filed quota with a ±1 deterministic wiggle — crystalline
    stations.push(station('rigged' + i, Array.from({ length: N_MONTHS }, (_, m) => quota + ((m % 3) - 1))));
  }
  const stats = forensicsStats(stations, 'robbery');
  const ranked = [...stats].sort((a, b) => a.D - b.D);
  const bottom10 = ranked.slice(0, 10).map((s) => s.name);
  for (const nm of bottom10) assert.ok(nm.startsWith('rigged'), `non-rigged '${nm}' out-crystallined a rigged series`);
  for (const s of stats) if (s.name.startsWith('rigged')) assert.ok(s.D < 0.1, `rigged D ${s.D.toFixed(3)} not ≪ 1`);
});

// ---- 3. small counts are untestable ------------------------------------------------------------
test('mean < 5/month is excluded from the ranking (too small to test)', () => {
  const rng = mulberry32(0xbeef);
  const small = station('tiny', Array.from({ length: N_MONTHS }, () => poisson(rng, 3)));
  const big = station('big', Array.from({ length: N_MONTHS }, () => poisson(rng, 30)));
  const zero = station('silent', new Array(N_MONTHS).fill(0));
  const [a, b, c] = forensicsStats([small, big, zero], 'robbery');
  assert.equal(a.testable, false);
  assert.equal(b.testable, true);
  assert.equal(c.testable, false);
  assert.ok(a.mean < TESTABLE_MEAN && c.mean === 0);
  assert.ok(Number.isFinite(c.D), 'all-zero series must not divide by zero');
});

// ---- 4. last-digit χ² --------------------------------------------------------------------------
test('round-number rigging → tiny digit p; honest Poisson → unremarkable p', () => {
  const rng = mulberry32(0xd161);
  const round = station('round', Array.from({ length: N_MONTHS }, (_, m) => (m % 2 ? 40 : 45))); // only 0s and 5s
  const honest = station('honest', Array.from({ length: N_MONTHS }, () => poisson(rng, 60)));
  const low = station('low', Array.from({ length: N_MONTHS }, () => poisson(rng, 8))); // never clears the ≥20 bar
  const [r, h, l] = forensicsStats([round, honest, low], 'robbery');
  assert.equal(r.digitN, 60);
  assert.ok(r.chi2p !== null && r.chi2p < 1e-6, `round-number p ${r.chi2p} not tiny`);
  assert.ok(h.chi2p !== null && h.chi2p > 0.001, `honest digit p ${h.chi2p} suspiciously small`);
  assert.equal(l.chi2p, null, 'digit χ² must stay silent below the count bar');
  assert.ok(l.digitN < DIGIT_MIN_N);
  assert.equal(h.digitHist.reduce((a, b) => a + b, 0), h.digitN);
});

test('chi2UpperP matches table values', () => {
  assert.ok(Math.abs(chi2UpperP(16.919, 9) - 0.05) < 0.002, `χ²(16.919, 9) → ${chi2UpperP(16.919, 9)}`);
  assert.ok(Math.abs(chi2UpperP(21.666, 9) - 0.01) < 0.001, `χ²(21.666, 9) → ${chi2UpperP(21.666, 9)}`);
  assert.equal(chi2UpperP(0, 9), 1);
  assert.ok(Math.abs(chi2UpperP(48, 48) - 0.4730) < 0.005, `χ²(48, 48) → ${chi2UpperP(48, 48)}`); // D = 1 sits mid-distribution
});

// ---- 5. the df choice itself (the seasonal fit consumes 12 degrees of freedom) -----------------
test('D uses df = n − 12, not n − 1 (else honest tallies would centre on ~0.81)', () => {
  // A hand-built series where the answer is exact: each calendar month k holds the five values
  // mk−2, mk−1, mk, mk+1, mk+2 → SS = 12 groups × 10 = 120; grand mean = 10 → D = 120/(48·10) = 0.25.
  const counts = [];
  for (let y = 0; y < 5; y++) for (let k = 0; k < 12; k++) counts[y * 12 + k] = 10 + (y - 2);
  const [st] = forensicsStats([station('exact', counts)], 'robbery');
  assert.ok(Math.abs(st.D - 0.25) < 1e-12, `exact-series D ${st.D} ≠ 0.25 — wrong df or wrong residuals`);
});

console.log(`\n${passed} forensics tests passed`);
