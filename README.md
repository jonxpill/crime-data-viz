# Crime Data-Viz — Cape Town

Crime data as **one living field of light** — a luminous point-field where the data glows and
the geography greys, so it's something you actually *want* to look at instead of a stat sheet.
Cape Town robbery, burglary and murder (2008–2023) as a morphing swarm: flip between crimes,
scrub the years, and watch the light move, grow and thin.

**▶ Live:** https://jonxpill.github.io/crime-data-viz/

**Controls:** `space` play/pause · `← →` year · `↑ ↓` crime · `scroll` zoom · `drag` pan

Each glowing dot is one real crime; colour is local density (cool/sparse → warm/dense); the grey
mesh is the real police-precinct geography. When a crime is rarer the swarm honestly thins — surplus
dots fly off-frame and roost, then fly back when it fills.

## Data & credits

**Crime counts — South African Police Service Annual Crime Records 2008–2023**, distributed by
DataFirst under a **Creative Commons CC-BY (Attribution)** licence:

> South African Police Service. *South African Police Service Annual Crime Records 2008-2023*
> [dataset]. Version 1. Pretoria: South African Police Service (SAPS) [producer], 2023.
> Cape Town: DataFirst [distributor], 2025. DOI: https://doi.org/10.25828/5MAW-4H90

Robbery = aggravated + common robbery; also shown: residential burglary and murder. Only aggregate,
already-public station-level counts are used (the record notes outputs follow the NT-SDF
data-checking policy).

**Geography** — police station coordinates + precinct boundaries: Western Cape Government GIS (open).
**Population** (for the pending per-capita view) — WorldPop 2020, 100 m, constrained (CC-BY); and
Stats SA Census 2011 Small Area Layer.

## How it works

Download → process → **bake a static asset** the page loads. No backend.

```bash
npm install
npm run dev      # local dev server
npm run build    # → dist/ (base /crime-data-viz/ for GitHub Pages)
node pipeline/bake.mjs   # re-bake public/data/capetown.json from data/raw + pipeline/sapacr-*
```

**Engine** = Vite + three.js (a `Points` field morphed on the GPU: each point stores a source +
target and one `t` uniform tweens the whole field). **Pipeline** = Node + d3-geo. The engine knows
nothing about crime or maps — every view is just a pure layout function `(features → x, y, brightness)`.

Raw inputs are git-ignored except the CC-BY crime CSV (see `.gitignore`); re-obtain the rasters/census
from the sources above.
