// provinceToll.js — the GENERIC lean data bundle for a standalone province Toll page. One loader, N
// provinces: point it at a `toll-<prov>.json` from pipeline/bake-toll.mjs and it returns the `ctx.data`
// the shell + toll view need. Place-free (no map, no geometry): stations carry ONLY murder-by-year.
//
// COUNT = M exactly — the pool IS the toll (nothing parked). The WC page predates this and sizes its pool
// from the full six-crime explorer build (wcProvince.js); both satisfy the same contract.
export function loadProvinceToll(url) {
  return async function load() {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`provinceToll: ${url} → ${res.status}`);
    const j = await res.json();
    const { label, years, yearLabels, box, structN, M, perYear } = j.meta;

    // tollLayouts reads s.crimes.murder[year] — wrap the lean rows into that shape.
    const stations = j.stations.map((s) => ({ name: s.name, crimes: { murder: s.murder } }));
    const check = stations.reduce((a, s) => a + years.reduce((b, y) => b + (s.crimes.murder[y] || 0), 0), 0);
    console.info(`[toll-data] ${label}: M=${M.toLocaleString()} baked · ${check.toLocaleString()} recomputed · match=${check === M}`);
    if (check !== M) throw new Error(`provinceToll: ${label} station sum ${check} ≠ baked M ${M} — bake and asset disagree`);

    return {
      label,
      stations, box, years, yearLabels,
      COUNT: M,                 // the pool is exactly the toll — every dot is one recorded murder
      structN,
      outline: null, park: null, layouts: null, totals: perYear,
      restingPose: null,        // standalone: no map to rest on…
      idleViewKey: null,        // …and no idle view to return to (the toll stands; K replays)
      has: (f) => f === 'toll',
    };
  };
}
