// The standalone Toll's data bundle — the `ctx.data` the shell hands its views. See docs/plans/standalone-shell.md.
//
// BLOCKER 1 (plan §4): the pool MUST be sized by the FULL SIX-CRIME build, not murder alone. `COUNT` in the
// explorer = each station's busiest year summed across ALL six crimes; `tollLayouts` asserts M > count →
// null, and M (the 18-year MURDER total ≈ 61,383) is far bigger than a murder-peak-year pool. So size from
// the six-crime build, then expose the MURDER layouts for the resting map + the toll's source of stations.
import { loadCapeTown, buildCrimeLayouts } from '../layouts/capeTown.js';

export async function loadWcProvince() {
  const wc = await loadCapeTown('data/westerncape.json');
  const years = wc.meta.years;
  const yearLabels = wc.meta.yearLabels || years;
  const types = (wc.meta.crimeTypes || [{ key: 'murder' }]).map((c) => c.key);

  // Full six-crime build → this is what sizes COUNT (the whole point of blocker 1).
  const built = buildCrimeLayouts(wc, { types, mode: 'raw' });
  const COUNT = built.count;
  const murder = built.layouts.murder;
  for (const L of murder) delete L.z;   // strip per-build DEM z (no terrain lift on this page)

  const structN = wc.structure.length / 2;
  const outline = { positions: Float32Array.from(wc.structure), density: new Float32Array(structN).fill(0.4) };

  // park — all dots pushed out ×2.5, density 0 (the toll's non-participating roost; parity: awayAll L339–341).
  const park = new Float32Array(COUNT * 2);
  const ref = murder[0].positions;
  for (let i = 0; i < COUNT * 2; i++) park[i] = ref[i] * 2.5;

  const restYi = years.length - 1;   // rest on the latest year's murder map
  const M = wc.stations.reduce((a, s) => a + years.reduce((b, y) => b + ((s.crimes && s.crimes.murder && s.crimes.murder[y]) || 0), 0), 0);
  console.info(`[toll-data] COUNT=${COUNT.toLocaleString()} (${types.length} crimes) · murder M=${M.toLocaleString()} · M≤COUNT=${M <= COUNT}`);
  if (M > COUNT) console.error('[toll-data] BLOCKER 1 REGRESSION: murder total exceeds pool — the toll will return null');

  return {
    label: 'Western Cape',   // the display name — the toll seats it above the word (a triptych names each disc)
    stations: wc.stations, box: wc.meta.box, years, yearLabels, COUNT, structN,
    outline, park, layouts: murder, totals: built.totals.murder,   // real per-YEAR SAPS murder counts (not the pool size)
    restingPose: () => murder[restYi],
    idleViewKey: null,   // STANDALONE Toll page: no idle map to return to — the toll stands alone (§UI redesign)
    has: (f) => f === 'toll',
    _raw: wc,   // kept for the toll view (tollLayouts needs the station objects)
  };
}
