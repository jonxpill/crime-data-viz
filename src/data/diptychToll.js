// diptychToll.js — the data bundle for the Toll ROW (N provinces side by side: diptych N=2, triptych
// N=3). One loader, N lean bakes: point it at `toll-<prov>.json` assets from pipeline/bake-toll.mjs (the
// same format provinceToll.js reads) and it returns ONE `ctx.data` bundle whose glow pool is the
// CONCATENATION of the provinces' tolls — province p owns the contiguous slice [offset, offset+M). Every
// dot is one recorded murder; nothing is parked. Each province's M is RE-VERIFIED from its own rows (bake
// and asset must agree).
//
// The view lays each slice out around its own column centre via tollLayouts(count = M_p) + the engine's
// setSource/setTarget(layout, offset) slice writes; structN sums the bakes' dial budgets (an equal share
// per dial).
export function loadDiptychToll(sources) {
  return async function load() {
    const bakes = await Promise.all(sources.map(async ({ url }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`diptychToll: ${url} → ${res.status}`);
      return res.json();
    }));

    let offset = 0, structN = 0;
    const provinces = bakes.map((j) => {
      const { label, years, yearLabels, M, perYear } = j.meta;
      // tollLayouts reads s.crimes.murder[year] — wrap the lean rows into that shape (provinceToll parity).
      const stations = j.stations.map((s) => ({ name: s.name, crimes: { murder: s.murder } }));
      const check = stations.reduce((a, s) => a + years.reduce((b, y) => b + (s.crimes.murder[y] || 0), 0), 0);
      console.info(`[diptych-data] ${label}: M=${M.toLocaleString()} baked · ${check.toLocaleString()} recomputed · match=${check === M}`);
      if (check !== M) throw new Error(`diptychToll: ${label} station sum ${check} ≠ baked M ${M} — bake and asset disagree`);
      const p = { label, stations, years, yearLabels, M, perYear, offset };
      offset += M;                        // slice offsets: contiguous, in fetch order (leftmost disc first)
      structN += j.meta.structN;          // Σ per-province dial budgets → an equal share of the struct pool per dial
      return p;
    });

    // ONE shared calendar clock needs ONE calendar — the provinces' year axes must agree exactly.
    const y0 = provinces[0].years;
    for (const p of provinces) {
      if (p.years.length !== y0.length || p.years.some((y, i) => y !== y0[i])) {
        throw new Error('diptychToll: provinces disagree on the year axis — one clock cannot serve two calendars');
      }
    }

    // Composition box scales with province count: tollDiptych.js's OPT.colSpacing (740) between column
    // centres + a fixed 330px margin each side of the outermost columns → w = 740·(N−1) + 660.
    // N=2 → 1400 (unchanged); N=3 → 2140. h is untouched — the row widens, discs never grow taller.
    const boxW = 740 * (provinces.length - 1) + 660;

    return {
      label: provinces.map((p) => p.label).join(' × '),
      provinces,                // per-province { label, stations, years, yearLabels, M, perYear, offset }
      stations: null,           // no single-province station list — the view reads provinces[i].stations
      years: y0, yearLabels: provinces[0].yearLabels,
      box: { w: boxW, h: 720 }, // the N-province composition box (view geometry derives from it)
      COUNT: offset,            // = ΣM — the pool is exactly the N tolls, slice-packed
      structN,
      outline: null, park: null, layouts: null, totals: null,
      restingPose: null,        // standalone: no map to rest on…
      idleViewKey: null,        // …and no idle view to return to (the diptych stands; K replays)
      has: (f) => f === 'diptych',
    };
  };
}
