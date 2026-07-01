# Crime Data-Viz — Build plan (the *what*)
> The staged plan. Re-derive each stage's scope from the current code before building it. The *why* is in
> CONTINUITY.md; full origin detail in the idea note (`~/Documents/_Ideas/crime-dataviz-cape-town.md`).

## North star
*"Is this more interesting and enjoyable to look at than a SAPS stat sheet?"* If yes, it's working.
A living field of light, beautiful first, honest always.

## The one bet
**Does the morphing starfield actually feel beautiful with this data?** That's the whole risk — not the
data (verified, free, 16 yrs), not the concept (decided). Prove it cheaply, first.

---

## Stage 0 — engine spike (FAKE data) ✅ DONE (2026-07-01)
**Result: the bet is won.** 90k points, blob ↔ ring GPU morph, density→colour, on near-black —
**3,400+ fps** (target was 60). The cool-blue→warm-gold density journey reads; cores glow; the morph is
a lovely dispersing cloud. *Project de-risked: the morphing starfield is genuinely beautiful.*
- Built: `src/engine/PointField.js` (pure engine — source/target xy + density, one `t` uniform, additive +
  bloom), `src/layouts/dummy.js` + `density.js` (pure layout fns), `src/main.js` (wiring + morph control).
- Key calls made while tuning (the eye judged each): per-point contribution kept GENTLE so cores emerge
  from additive STACKING (not blown-out white) → keeps the density gradient legible; the "nebula behind
  cores" is NOT a painted sprite — it EMERGES from bloom over the bright cores, so it follows the data
  instead of floating in an empty centre when the field morphs.
- Run it: `npm run dev`. Click / space to morph.

A Vite + three.js web app. ~50–100k tiny points of light on near-black. Three things, made *gorgeous*:
1. **Starfield look** — tiny glowing points, soft bloom, on dark.
2. **One morph** — interpolate the whole field between two dummy layouts (random blob ↔ ring) on a
   click/timer, **on the GPU** (each point stores `source` + `target`; one `t` uniform; vertex shader slides
   them — CPU idle).
3. **Density = colour** — per-point local density → ramp (sparse cool/dim blue → dense warm/bright gold);
   faint warm nebula behind dense cores.
- **Definition of done:** it's genuinely beautiful, and 100k+ points morph at 60fps. *That's the project
  de-risked.* If the look/feel disappoints, learn it here for the price of one spike.
- Architecture seed: the engine takes an array of `{source(x,y), target(x,y), brightness}` and tweens — it
  knows nothing else. A "layout" is just a function that fills the target buffer.

## Stage 1 — real data, one real morph = THE PROTOTYPE ✅ DONE (2026-07-01, mechanics-first)
**Result: real Cape Town crime as a living, morphing starfield.** The map + 2008→2023 year-scrub both
work; the field breathes across years (the COVID-2020 dip reads), structure (real precinct mesh) greys
behind glowing data, ~90k pts at 2,700+ fps.

**⬆ UPDATE (2026-07-01, data extended to 2008–2023):** crime swapped to the DataFirst **SAPS Annual
Crime Records 2008/09–2022/23** (cat. 1012, registered download; `pipeline/sapacr-2008-2023-v1.1/`).
Stations now **self-locate** from the crime file's own lng/lat — the fragile GIS name-join is deleted;
the metro = exactly our **60 stations' precincts** (all 60 name-match a precinct polygon). The
**COVID-2020 dip** (27.8k→20.1k robberies) and the **hotspot shift** (Mitchells Plain→Nyanga by 2022/23)
both read in the scrub. ~34k pts @ 60fps (fixed a dead fps meter: `getElapsedTime()`+`getDelta()` per
frame zeroed the delta). Footer year-range now driven from `meta` (no more stale label). **WorldPop 2020**
population clip on disk (`data/raw/capetown_pop_2020.tif`, verified 5.26M in-box) for the real per-capita
join — the next step. Re-bake: `node pipeline/bake.mjs`.
- **Geography is REAL** (no login): fetched from the Western Cape GIS server — 73 metro police-station
  coordinates + precinct boundary polygons, as free GeoJSON. `data/raw/{stations,precincts}.geojson`.
- **Counts are now REAL** (swapped in 2026-07-01): SAPS station-level robbery (aggravated + common),
  **2005/06–2015/16**, from the cleaned OpenUp/Kaggle SAPS CSV mirrored on GitHub (`data/raw/sa_crime.csv`,
  free/curl-able). 72/73 metro stations name-join to the GIS coords (only Samora Machel, a newer station,
  is absent). `meta.simulated:false`. **The real spatial story shows:** Nyanga climbs past Cape Town Central
  by 2015/16; the field redistributes across the decade (was invisible in the old uniform-trend placeholder).
  - *Still placeholder:* per-station **population** is a proxy → per-capita view stays OFF by default (the
    raw view shown is fully real). Real census→precinct join is the remaining TODO.
  - *Window caveat:* this open mirror is 2005–2016, not the full 2008–2023 (that needs the login-walled
    DataFirst cat. 1012 — a one-time registered download, then same swap).
  - *(Superseded: the earlier simulated-counts placeholder, seeded by hotspot geography + a uniform year
    trend. Its flaw — uniform trend → hotspots never move — is exactly what prompted wiring the real data.)*
- **Pipeline = Node + d3-geo** (NOT Python — 3.14 lacks geo wheels; d3-geo was always the plan):
  `pipeline/bake.mjs` → `public/data/capetown.json` (static, no backend). Re-bake: `node pipeline/bake.mjs`.
- **Layouts** (`src/layouts/capeTown.js`, pure fns): map = dot-density (N∝count, jittered in-precinct,
  volume real / micro-pos jittered); year-scrub = fixed-buffer slots, surplus "park" at precinct centre in
  lighter years and grow back out → the scrub breathes in place, never reshuffles.
- **Per-capita** is baked in (population per station in the asset; `mode:'percapita'` path exists in the
  layout) — ready for the Stage-2 toggle. **Gotchas hit:** ArcGIS clockwise winding broke d3 `fitExtent`
  (fit to vertices-as-points, not polygons); `import.meta.url` URL-encodes the space in the folder name.
- **Known refinements (backlog, not blockers):** jitter is disc-around-centroid (precincts merge but read
  a touch circular) — upgrade to real polygon-fill; structure is a precinct mesh — a coastline / Table
  Mountain void would read as "Cape Town" more strongly; real population join for true per-capita.

## Stage 1 — real data, one real morph = THE PROTOTYPE (original plan, for reference)
- **Minimal pipeline (Python + pandas + d3-geo):** one slice of SAPS (robberies per Cape Town precinct) +
  population (per-capita) + project precinct centroids → screen xy + scatter **N jittered points per
  precinct** (dot-density) → **static JSON**.
- **Wire two real layouts:** the **map** (project lat/lng → xy) + a **2008→2023 year scrub** (the field
  morphs across the years — the "watch it shift" payoff). Data points glow + density-colour; add minimal
  grey **structure points** (coast / Table Mountain void) so it reads as Cape Town.
- **Definition of done:** real Cape Town crime as a living starfield you'd *choose* to look at. Judge vs the
  north star.

## Stage 2 — light interactivity (the fidelity counterweight, made visible)
**⬆ IN PROGRESS (2026-07-01):** the field now flips between **three crimes** (robbery · burglary · murder)
with ↑/↓ as well as scrubbing years — one shared point-buffer, each crime a pure layout; the pairs read
honestly as **move** (robbery↔burglary, different geography), **diminish** (robbery↔murder, ~8× rarer) and
**grow**. Transitions are a **swarm**: surplus dots fly to fixed off-screen "roosts" and back, staggered
per-dot like a flock (`uStagger` + roost distance, both live-tunable via `__viz`). Idle drift split into
amplitude + speed levers. Shipped to **GitHub Pages** (public repo). *Still TODO here: the per-capita
toggle (WorldPop→precinct join; the clip is on disk).*
- **Per-capita toggle** — watch the field rearrange between raw counts and per-capita rate (delightful *and*
  the built-in lesson in how stats mislead).
- **Year scrubber** (if the year-lapse is the morph). Basic controls.

## Stage 3+ — grow by curiosity (no spec; play)
New layouts/instruments as curiosity strikes: the **history / apartheid Group-Areas overlay** (let the
correlation sit, say nothing); the **discrepancy instrument** (SAPS reported vs VOCS experienced vs SAMRC
died — the gaps are the story); the **elevation terrain** (grey points clustered by DEM height; crime glows
on the low ground); type breakdowns; comparison. Each = a new layout function over the same field.

## Data (summary — full in the idea note + CONTINUITY)
- **Download → process → bake static asset → page loads it. No backend.** Crime stats are annual batch
  releases (nothing to live-pull); the project is historical/retrospective.
- **Sources:** crime counts (OpenUp CSV 2011–23 / DataFirst SAPS 2008–23, station-level + GIS) · precinct
  boundaries · population (Census, for per-capita) · elevation (SRTM/DEM) · complementary VOCS (experienced)
  + SAMRC (died) + ISS (analysis).
- **The one fiddly prep step:** joining population → police precincts for per-capita (a spatial join;
  geographies don't line up). The only real pipeline work.
- **Honest limits:** annual + precinct-level → volume real, micro-pos jittered; year-lapse solid; NO
  time-of-day in SAPS (a clock view needs a finer source / is illustrative).

## Stack
Engine = **Vite + three.js** (`Points` + custom shader for glow/density). Pipeline = **Python + pandas**,
**d3-geo** projection upstream (keeps the engine pure). Spike shortcut = **Observable notebook**. The one
real skill hurdle = the WebGL/shader glow-at-scale; the rest is routine.

## Reference mocks (in the idea note's transcript — conceptual targets)
`crime_particle_morph` (map↔clock morph) · `crime_starfield_density` (density=colour stars) ·
`capetown_grey_structure_glowing_data` (grey city / glowing crime / mountain void) ·
`capetown_elevation_points_crime` (elevation = grey point density, crime on the lowlands).
