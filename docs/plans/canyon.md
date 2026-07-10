# Plan — The Lockdown Canyon  ·  branch `feat/canyon`

> Time as the landform. A 3D surface where **x = the 18 SAPS years, y = the 150 precincts
> (geographically ordered), height = per-capita rate**, rendered by the same relief machinery as the
> terrain views. The 2020/21 lockdown reads as ONE canyon cutting across the entire range at once;
> flipping crimes swaps mountain ranges (burglary erodes, sexual offences plateaus).
> Self-contained: read this + the referenced files; don't assume chat context.

## Context (read first)
- `src/wcExplore.js` — terrain machinery to mirror: `terrainField` pool, `terrainRelief()`,
  `startTerrainTransition()`, `zScaleCur`/`tiltCur` easing in `tick()`, `toggleTerrain()` guards.
- `src/layouts/capeTown.js` — `terrainViewLayout()` (grid-sample → land dots w/ slope+height density)
  is the shape of the new layout fn; `PC_SCALE`, provider `totals`.
- Data: `public/data/westerncape.json` stations carry `crimes[type][year]` + `pop`; district details
  same shape (canyon works per region: its provider's stations only).

## Decisions (made — veto in review)
- **Per-capita ONLY** (raw would render population, not story). Height + colour = rate.
- **Dots are SAMPLES of a rate surface, not one-per-crime** — a declared mode (hint text: “a surface
  of rates — height is the data”). Volume honesty is suspended *and said aloud*; this is the same
  contract as the terrain relief. (Stretch, later: volume-true variant for low-volume crimes.)
- The canyon is DATA → it **glows** (a dedicated `PointField` with `glow:true`, like `terrainField`
  but data-role). Structure = a grey graticule: year gridlines + district separators + year labels
  (HTML labels reuse the place-label pattern).
- Key **V** + chip `V canyon`; available on flat map views (blocked in pies/pulse/terrain, exits like
  terrain does). Entering: map field dims/parks (like pie mode parks the outline), canyon rises from
  flat via the `zScaleCur` easing pattern; exiting reverses.
- Geographic y-order: stations sorted by district block, then north→south within district (keeps
  metro adjacent; simple, defensible). Order baked once in the layout fn.

## Build steps
1. `canyonLayout(provider, stations, years, box)` in `capeTown.js` (pure): grid GX=years×spacing,
   GY≈stations; each (station,year) cell → per-capita rate; emit `{positions, density, z}` sampled
   dots per cell (dot count per cell fixed; density+z encode the rate). Normalize z + density ONCE
   per crime across all years×stations (never per-frame). Return also `anchors` (cell centers +
   station/year ids) for hover.
2. Canyon pool in `wcExplore.js` (mirror the `terrainField` block): own `PointField(glow:true)`,
   bloom layer, build lazily per (crime, region) on first entry; cache one crime (evict on flip —
   the pulse's `monthly()` cache is the pattern).
3. Mode state machine: `canyonMode`, enter/exit fns, tilt/zScale easing (reuse constants, own
   `zPeak` tuned by eye), guards vs pie/pulse/terrain/drill (mirror `toggleTerrain`).
4. Graticule structure layout (year lines + district seams) fed to `structField` target on entry;
   restore `structRest()` on exit. Year labels via the label layer (they’re the one labels-on-relief
   exception — few, load-bearing, no hover equivalent).
5. Hover: nearest canyon anchor → tooltip “Nyanga · 2014/15 · 43.1 per 100k”. Crime flip (↑↓)
   rebuilds in place (crossfade morph). ←→ optional v1: slide a bright year-band highlight.
6. Chip + key + hint + flag (“rates surface · per 100k”).

## Verification (each step before the next)
- Numbers: hover values match `station.crimes[type][y]/pop×100k` to the digit for 5 spot checks.
- The 2020/21 canyon is visible across ALL SIX crimes (screenshot each).
- Burglary range visibly declines W→E in time; sexoff plateau flat. No per-frame renormalization
  (scrub a highlight band — heights must not breathe).
- Perf: fps ≥ 50 at canyon dot budget; enter/exit transitions clean; drill/pulse/terrain guards hold.

## Effort: project (~3 focused sessions). Merge notes: touches wcExplore (own section + 1-line hooks
in keydown/CHIP_ACTIONS/refreshHint), index.html (1 chip line), capeTown.js (additive fn). No engine edits.
