# Handoff: what Crime Data-Viz offers a Table Mountain hiking-safety app

> For a session evaluating a NEW app: hiking trails on Table Mountain with a crime-incident/hotspot
> layer. This doc is self-contained — written to be read cold, from any working directory. Everything
> referenced lives in `/Users/jonxpillemer/Documents/Crime Data-Viz` (git repo; live build at
> https://jonxpill.github.io/crime-data-viz/). Assess each item on its own; take nothing wholesale.

## What the source project is (context in one paragraph)

Western Cape crime data rendered as ONE living field of GPU points — data glows, geography stays grey —
with an 18-year scrub, six crime lenses, a conserved drill into districts, and 3D terrain everywhere.
No backend: pipeline scripts download/verify/bake static JSON+binary; a Vite site loads them. The maker's
north star: *"more interesting and enjoyable to look at than a stat sheet."* The same maker + taste rules
apply to the hiking app.

## Tier 1 — take as-is (drop-in files)

**The PointField engine** — `/Users/jonxpillemer/Documents/Crime Data-Viz/src/engine/PointField.js`
(~270 lines, pure, zero domain knowledge). One field of points; each dot holds source+target (x,y) and
densities; ONE `uT` uniform tweens the whole field on the GPU (CPU idle during morphs). Per-dot stagger
(swarms, not slides), idle drift/shimmer, `aZ × uZScale` terrain lift, density→colour ramp.
- The binding visual language: `glow:true` = DATA (additive, density-coloured, blooms);
  `glow:false` = STRUCTURE (grey, matte, never glows). Structure must never masquerade as data.
- A "layout" is just `{ positions: Float32Array(n*2), density: Float32Array(n), z?: Float32Array(n) }`
  computed upstream by a pure function. New view = new function. The engine never grows domain features.
- Perf envelope (measured, worst-case overdraw on a weak preview GPU): 250k dots @60fps, 1M @40fps.
  An incident layer (hundreds of points) + trail structure (tens of thousands) is trivial for it.
- Maker's framing: the engine is ONE reusable instrument specialized per project — copy it in, don't fork
  its meaning. Mind the one-writer rule: the engine auto-uploads `aZ` from any layout carrying `z`; give
  aZ exactly one owner or strip `z` upstream (see CONTINUITY notes below).

**The colour/exposure recipe** — in `/Users/jonxpillemer/Documents/Crime Data-Viz/src/wcExplore.js`
(renderer setup, ~lines 45–100): selective bloom via a layers mask (ONLY data blooms), Neutral tone
mapping + exposure ~5.5 (additive stacking hard-clips to a white splat without it), per-dot brightness
floor+gain uniforms (`uDataFloor`/`uDataGain` — density must not be double-counted), and a low-blue warm
ramp end (`#ff8a3a`) so dense cores saturate to molten orange instead of white. These were hard-won;
copy the whole block including the `__viz.*` live-tuning-knob pattern (expo/bloom/ramp/dataCurve/matte).

## Tier 0 — PRE-BAKED DELIVERABLE, ready to consume (no code crossing over)

A z12 Table Mountain DEM was baked specifically for the hiking app (route elevation profiles):
- `/Users/jonxpillemer/Documents/Crime Data-Viz/data/handoff/tmnp-north-dem.bin` — Int16 LE, row-major,
  metres; 1024×686 nodes (~16.2 m step, matching the source's native ~15.8 m/px).
- `/Users/jonxpillemer/Documents/Crime Data-Viz/data/handoff/tmnp-north-dem.json` — the full
  self-describing meta: exact bbox (18.30–18.48E, 34.00–33.90S), node convention (REGULAR EPSG:4326
  lng/lat grid — `lng(i) = west + i/(cols-1)·(east-west)`, `lat(j) = north − j/(rows-1)·(north-south)`,
  row 0 = north edge, bilinear between nodes), source, and baked-in verification.
- Verified against summit anchors before shipping: Maclear's Beacon 1083 m (survey 1086), Devil's Peak
  995 m (survey 1000), Lion's Head 621 m (survey 669 — a sharp cone; z12 smoothing shaves ~50 m off
  needle summits, fine for route profiles, know the limit). Rebuild/extend bbox or zoom:
  `node /Users/jonxpillemer/Documents/Crime Data-Viz/pipeline/bake-tmnp-dem.mjs`.

## Tier 2 — adapt (hours, not days)

**Terrain, the biggest gift.** The massif's relief already exists here:
- `/Users/jonxpillemer/Documents/Crime Data-Viz/public/data/capetown-dem.bin` — 900×972 Int16 DEM
  (signed metres, <0 = ocean) covering metro Cape Town INCLUDING the whole TMNP chain at z10
  (~127 m/sample). Loaded client-side as `terrain.elev` with meta `{cols, rows, peak}`.
- `/Users/jonxpillemer/Documents/Crime Data-Viz/pipeline/fetch-terrain.mjs` — AWS Terrain Tiles
  fetcher (GeoTIFF, no auth, free). Edit bbox to the park (~18.30–18.48E, 34.36–33.93S) and zoom to
  z12–z13 → trail-scale relief (~30/15 m per sample). Minutes of work.
- `/Users/jonxpillemer/Documents/Crime Data-Viz/pipeline/bake-wc.mjs` → `bakeDEM()` — the recipe for
  sampling a mosaic into a projection-aligned Int16 grid; the client-side convention (`demHeightAt`,
  grid-node ↔ box-pixel mapping) is in `src/wcExplore.js` and MUST match the bake node-for-node.
- `/Users/jonxpillemer/Documents/Crime Data-Viz/src/layouts/capeTown.js` → `terrainViewLayout()`
  (DEM → relief point layout: land-fill redirection so no dots are wasted on ocean, slope+height →
  brightness) and `bandFor()` (couples a flat pose to the relief so map⇄terrain morphs don't strand
  dots). A slate-grey Table Mountain relief point-field with glowing trails on it is ~a day from these.

**Interaction patterns** (same file, `src/wcExplore.js`): hover naming via
`localToWorld → project(camera)` (tooltip + nearest-anchor pattern); tappable HUD chips wired to the
same functions as keyboard keys (touch parity — the toolkit was keyboard-dead on phones until chips);
place labels with greedy collision pruning, structure-voiced (small grey mono, pointer-transparent).

## Tier 3 — pattern transfers, code doesn't

- **Pipeline discipline**: every stage is fetch → parse → PRINTED TRUST REPORT → bake static asset.
  See `/Users/jonxpillemer/Documents/Crime Data-Viz/pipeline/parse-saps.mjs` as the exemplar: station
  match report, overlap cross-checks against a second source, deltas decomposed until every part has a
  name (backfill vs revision) before merging. For the hiking app this becomes: every incident entry
  carries a source URL + date + location-confidence; nothing enters the corpus unverified; the parse
  prints what it accepted/rejected. **The corpus discipline IS the app's moat.**
- **Honesty rules that carry straight over** (from the project's CLAUDE.md / CONTINUITY):
  volume is real; per-frame auto-normalisation hides the trend (normalise across the whole comparison
  set); absence of data must read as absence of DATA, not as safety.
- `/Users/jonxpillemer/Documents/Crime Data-Viz/docs/CONTINUITY.md` → `## Principle candidates` — the
  distilled build lessons (tone-map from dim upward; conserved swarms; one aZ writer; screenshot-vs-
  readPixels debugging; decompose deltas; old-boundary folds). Ten minutes of reading that saves days.

## What does NOT transfer — and the app-defining gap

- **SAPS data cannot give on-mountain incidents.** Its finest grain is the police precinct; the massif
  is split across 13 precincts (Cape Town Central, Sea Point, Camps Bay, Hout Bay, Mowbray, Rondebosch,
  Claremont, Wynberg, Kirstenhof, Muizenberg, Fish Hoek, Simon's Town, Ocean View). A trail mugging is
  booked at the precinct station, indistinguishable from suburb crime. Usable ONLY as a clearly-labelled
  ambient-context layer (this repo's `public/data/capetown.json` has all 13, six crimes × 18 years,
  2008/09–2025/26) — never as the incident layer.
- **The incident corpus does not exist anywhere as a dataset.** It must be assembled: Table Mountain
  Watch (community incident reports/maps), news archives (GroundUp/News24/IOL report serious incidents
  with trail names — scrapeable + geocodable), SafetyMountain/hiker-group reports, SANParks aggregate
  stats (PAIA/parliamentary replies for detail). Expect sparse data (order: dozens–hundreds of usable
  geocoded incidents, not thousands). Sizing this corpus is the FIRST question — it decides viability.
- **Trails**: not in this repo. OpenStreetMap has the full TMNP path network (Overpass API, free).
  New fetch script; small.
- The conserved-drill/region-slice machinery, crime CSV parsing, WorldPop per-capita join — all
  domain-specific; ignore.

## The one framing rule (maker's honesty bar, non-negotiable)

The app may show **"known reported incidents"**; it may never show **"safe areas."** Under-reporting is
notorious; sparse points over years make treacherous heatmaps. Prefer per-trail-segment counts with
recency weighting over smooth heatmaps; never paint anything green. A wrong hotspot embarrasses; a wrong
"quiet area" endangers.

## Suggested first spike (mirrors this project's proven doctrine)

*"Prove the FEEL on fake data first"* — before any corpus work: z12 park DEM (edit fetch-terrain bbox)
+ OSM trail network as grey structure points + ~40 FAKE incidents as glowing dots on the relief.
Render-and-look. If the mountain-with-glowing-trails object isn't beautiful, the data hunt doesn't
matter; if it is, the corpus (the real work) has a worthy home. The maker judges by eye at every step
and prefers planning proposals before builds.

## Maker's working tastes (apply to the new app too)

Plan → explicit "go" before building. Real data or clearly-labelled fake — never guessed values.
Minimal persistent labels (hover names things; always-on labels only where hover can't reach).
Don't enlarge dots to look solid — densify instead. Quiet frame, glowing data. Every visual claim
verified by looking at an actual render, not by "it runs."
