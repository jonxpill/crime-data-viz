# MISDAADVELD

*Afrikaans: “crime field.”* Eighteen years of Western Cape crime as **one living field of light** —
a luminous GPU point-field where the data glows and the geography greys, built to be something you
actually *want* to look at instead of a stat sheet.

**▶ Live:** https://jonxpill.github.io/crime-data-viz/

Every glowing dot is **one reported crime**. ~180,000 points hold six crimes × eighteen SAPS years
(2008/09 – 2025/26) across all 150 Western Cape police precincts — and every view is the *same* dots
rearranging. Nothing is ever redrawn, only moved:

- **The province → its districts** — click a district and the field *blooms* into it: that district’s
  dots travel to their detailed positions while the rest of the province breaks away off-frame. One
  conserved swarm; the camera never moves.
- **Six lenses** — robbery, residential burglary, murder, sexual offences, commercial crime,
  carjacking (`↑↓` flips; the morph between two crimes *is* the story: same geography = shrink/grow,
  different geography = migration).
- **Three clocks** — the 18-year scrub (`←→`, `space` plays), the **monthly pulse** (`N`: sixty
  months, Apr 2021 – Mar 2026, looping — watch December murder spike), and stillness.
- **Terrain** (`T`) — the land rises as a relief point-field in every region, the crime riding it.
  **Per-capita** (`C`) — rates per 100k, where dense townships shrink and low-population CBDs swell.
  **Compare** (`3`) — all six crimes as volume-true pies. `?` opens the about card.

The pretty is load-bearing: colour is *local density* (cool sparse → molten dense), normalised across
each comparison set — never per-frame — so growth and decline stay visible. When a count drops, the
surplus dots visibly fly off-frame and roost; when it climbs, they fly back. Volume is never faked.

## Honesty

- **Counts are real; positions are jittered** within each precinct — volume is true, street addresses
  are not (and are not knowable from SAPS data).
- **Raw counts largely map population.** Per-capita (`C`) is the fairer read; both are one keypress.
- **2025/26 is unaudited** (the sum of SAPS’s four quarterly releases; the audited annual isn’t out
  yet). The monthly series comes from the same quarterlies. The HUD flag says so.
- **Post-2023 stations** (Samora Machel, Makhaza) are folded into the older precinct polygons that
  contain them — the map draws the old boundaries, so parent+child is the true count for the shape
  shown. Samora Machel’s separately-recorded 2018–2022 history is backfilled onto Philippi so that
  polygon’s series stays continuous.
- **Carjacking** is also a subcategory of aggravated robbery, so it appears inside the robbery lens too.
- Throughout: these are **reported** crimes — what reaches a police station, not all that happens.

## Architecture

**Static everything.** Pipeline scripts download → verify → bake JSON + binary assets; the page just
loads them. No backend, no runtime API.

- `src/engine/PointField.js` — the reusable engine. One buffer of points; each dot stores a source and
  a target position + density; a single `uT` uniform tweens the whole field on the GPU. It knows
  nothing about crime or maps: **every view is a pure layout function** computed upstream. Data points
  glow (additive, density-ramped, bloomed); structure points stay grey and matte, and never masquerade
  as data.
- `src/layouts/capeTown.js` — the layout builders (map years, monthly pulse, pies, terrain relief),
  all sharing one conserved slot allocation so any view morphs into any other.
- `src/wcExplore.js` — the explorer: the conserved drill, the clocks, terrain, labels, touch chips.
- `pipeline/` — bakes with printed **trust gates**: cross-source checks to the exact count, station
  match reports, months→years reconciliation, every delta named (fold vs backfill vs revision).

### Run / rebuild

```bash
npm install
npm run dev                      # local dev server
npm run build && npm run deploy  # publish dist/ to gh-pages (the live site)

# data refresh (next SAPS release):
node pipeline/fetch-saps.mjs     # annual + quarterly station-level workbooks (saps.gov.za)
node pipeline/parse-saps.mjs     # → wc-supplement.json, with the printed trust report
node pipeline/fetch-terrain.mjs  # AWS Terrain Tiles (WC z9; bake.mjs also uses a z10 Cape Town set)
node pipeline/bake-wc.mjs        # → westerncape.json, wc-districts.json, per-region DEMs
node pipeline/bake.mjs           # → capetown.json + its z10 DEM
```

Raw inputs are git-ignored except the CC-BY crime CSV (see `.gitignore`); the fetch scripts re-obtain
everything else.

## Data & credits

**Crime counts** — *South African Police Service Annual Crime Records 2008–2023*, distributed by
DataFirst under **CC-BY**:

> South African Police Service. *South African Police Service Annual Crime Records 2008-2023*
> [dataset]. Version 1. Pretoria: South African Police Service (SAPS) [producer], 2023.
> Cape Town: DataFirst [distributor], 2025. DOI: https://doi.org/10.25828/5MAW-4H90

extended with the **SAPS annual (2024/25) and quarterly (2025/26) station-level releases**
(saps.gov.za), overlap-verified against DataFirst to the exact count. Robbery = aggravated + common;
sexual offences = the source’s own aggregate.

**Geography** — police station coordinates + precinct boundaries: Western Cape Government GIS (open).

**Population** (the per-capita view) — **WorldPop 2020**, 100 m, UN-adjusted, constrained; real
population per precinct is a zonal sum of the raster over each polygon, so rates are honest:

> WorldPop (2020). *The spatial distribution of population in 2020, South Africa.* University of
> Southampton. DOI: https://dx.doi.org/10.5258/SOTON/WP00660 — licensed CC BY 4.0.

**Terrain** — AWS Terrain Tiles (open elevation). **Rendering** — [three.js](https://threejs.org/).

Made by Jonx Pillemer, for the joy of it.
