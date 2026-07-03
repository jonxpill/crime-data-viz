# Crime Data-Viz — Continuity & decisions (the *why*)
> Mental model + decision rationale, so a cold session resumes from docs and doesn't re-argue settled calls.
> Update at breakpoints. Full origin thinking: `~/Documents/_Ideas/crime-dataviz-cape-town.md`.

## Re-anchor (play this back before acting)
Crime data shown as **one living field of points** — the data glows in colour-by-density, the structure
(coast, mountain, axes) recedes to grey — so it's something you actually *want* to look at instead of a
stat sheet. It's **"Loom for data": an ensemble of views on a reusable engine**, where every view (map,
timeline, elevation) is just a different *clustering* of the same point-field, and you **morph** between
them. **The engine is the design object; specific instruments are deferred.** It's a **personal craft piece,
for the maker's own pleasure — play, not a product.** Honesty discipline: *it's the same story the numbers
tell, just told beautifully.* On resuming: read this + BUILD-PLAN + the idea note, play back understanding,
and remember the eye is the judge — render and look.

## THE REFRAME (2026-07-02) — what this actually is
The maker named the real product mid-session: **this is not "a Cape Town crime viz" — it's a general
"make any solid dataset a beautiful, honest living field of light" ENGINE.** Cape Town crime is instance #1,
the demo that proved the feel. Any dataset plugs in as a **data-shape archetype** + its layout kit:
*events-in-space* (crime, rhino poaching — runs on today's layouts near-unchanged), *time-series* (climate),
*proportions/rank* (the pie), *flows/routes* (trucks — a new archetype worth building; very drone-show).
Generality = a reusable engine + per-domain modules (the maker's own architecture rule), NOT infinite magic;
a new data shape = one new layout function. Honesty becomes a reusable toolkit (per-capita, normalisation,
"measured-zero vs no-data"); the point-of-view lives per-instance. (Aside the maker clocked: this swarm-
between-formations model **is** how drone light shows work — a physics-free, unlimited-drone version.)

**⬆ (2026-07-03) first proof the reframe is real:** the Western Cape explorer makes "region" *just another
layout* — Cape Town is one region, the province another, the drill is a morph between them, and the whole
toolkit runs unchanged across both. The engine generalised past a single instance without a rewrite — a new
region is a layout, exactly as promised. (The path there also proved the negative: modelling region as a
parallel COPY of the structure, not a value on an existing axis, made the core conserved-swarm invariant
structurally impossible — see the principle candidate.)

## Current state (2026-07-03) — where a cold session picks up
**Live:** https://jonxpill.github.io/crime-data-viz/ · repo `jonxpill/crime-data-viz` (public) · trunk =
`main` · deploy = `npm run deploy` (builds `dist/` → pushes the `gh-pages` branch; Pages serves that, NOT
`main`). **⚠ `main` is AHEAD of the live site:** the whole Western Cape explorer + the one-app consolidation
are pushed to `origin/main` but **NOT yet deployed** (gh-pages still serves the old standalone Cape Town
app). `npm run deploy` swaps the public root to the explorer. Re-check `git log origin/main` vs the last
gh-pages build before assuming state.

**The app is now ONE page — `index.html` → `src/wcExplore.js`** (the whole Western Cape explorer). The
standalone Cape Town app (`src/main.js` + the old `wcExplore.html`) was **RETIRED** once the explorer's Cape
Town region became a full superset of it — both live in git history (comments still say "main.js" for the
lineage). It **opens on the whole province** (150 stations, 6 districts); **click Cape Town → a conserved
drill rebuilds into the detailed Cape Town view** carrying the live toolkit state. Full toolkit: `M` map ·
`P` pie · `3` compare (click a pie → resolve) · `↑↓` crime · `←→`/space scrub · `C` raw⇄per-capita (real
WorldPop) · hover · **`T` terrain — Cape Town only** (surfaced in the CT hint, no-op in the province).
**Also builds as a single offline `.html`** via `npm run build:single` (SINGLE=1 → one bundle;
build-single.mjs inlines BOTH datasets + the DEM; double-click, no server). See BUILD-PLAN Stage 4.

**The explorer's architecture (the session's headline lesson — see principle candidates):** *region is just
another LAYOUT the ONE conserved field morphs to,* exactly like map⇄pie⇄tri-pie. So the whole toolkit is
main.js's code UNCHANGED (a region swap is only a repoint of layout refs). Pools:
- **ONE data field** (COUNT ≈ 140k), ordered `[ city 0..CT_COUNT , rural CT_COUNT..COUNT ]`. Cape Town's 60
  stations are a **byte-identical subset** of the province's 150 (same crime counts — verified), so its dots
  are a **contiguous conserved slice** [0,CT_COUNT) that maps 1:1 onto the Cape Town detail build — the SAME
  dots in both views. On the drill they travel (province cluster ⇄ full detail); rural (no detail to zoom
  into) breaks away + flies back; the CT toolkit writes only the city slice (partial `copyArray` write).
- **ONE structure field** — province outline ⇄ Cape Town outline (conserved, one pool) + pie frames.
- **ONE terrain field** (Cape Town only, GX×GY) — main's relief, swapped in at its coincident `bandFor`
  band on `T` (so the swap reads as no change), then morphs band → relief; crime climbs via the data
  field's per-dot `aZ`.
- **Camera DEAD STILL** — framed to the union of both boxes once; the drill is entirely in the dots.
- **History:** a first Sonnet-built explorer modelled region as a second BUNDLE (two independent pools → the
  drill could only cross-fade → structure disappeared/reappeared). It was BINNED and rebuilt from main.js's
  proven single-field toolkit + `wcMain.js`'s conserved drill. `wcMain.js` (standalone drill spike) + `wc.html`
  remain as the minimal reference.

**Data:** `public/data/capetown.json` (60 stations + `capetown-dem.bin`) · `public/data/westerncape.json`
(150 stations, 6 districts, real per-capita via a WINDOWED WorldPop read, NO terrain). Re-bake:
`node pipeline/bake.mjs` (Cape Town) · `node pipeline/bake-wc.mjs` (province).

**Immediate next threads (none blocking; maker drives by curiosity):**
- **Deploy the explorer** — `npm run deploy` publishes it to `/wcExplore.html`. Held for the maker's call.
- **Generalise the drill to all 6 districts** — today only Cape Town has a detail view. Each district = one
  more layout the one field morphs to (per-district positions in the bake) → one generic drill for all. This
  is the "zoom into every subsection" the maker asked about; the region-as-layout foundation is built for it.
- **✅ Fold to one app — DONE (2026-07-03).** The explorer IS the app (retired `main.js` + `wcExplore.html`);
  `index.html` loads `wcExplore.js`, single Vite entry, one clean bundle. No separate Cape Town page.
- **GBV / sexual-violence view** — per-capita + an underreporting counterweight (maker was curious).
- **Precise map/terrain hit-test** (point-in-polygon) · **VR object** (IDEAS-BACKLOG) · **flows archetype**.

**Gotchas a cold session MUST know:**
- `src/wcExplore.js` keeps a `window.__viz` debug console: `__viz.region('ct'|'wc')` force-drills;
  `__viz.terrain()` toggles the Cape Town relief; plus year/t/drift/pie/stagger/… Console-only, harmless.
- **A "black render" in a preview/headless tab is almost always a CAPTURE ARTIFACT, not a bug** — throttled
  rAF + WebGL's default `preserveDrawingBuffer:false` clears the buffer between the rare renders, so a
  screenshot taken when no render landed just-before-paint is black even when every frame is perfect (this
  cost hours once). To verify feel in a throttled tab, drive `tick` from a `setInterval` and screenshot;
  prove the pipeline with a synchronous `render()`+`gl.readPixels` before theorising.
- The explorer is FLAT except Cape Town terrain: `buildCrimeLayouts` tags each map layout with a per-build
  `z` (Cape Town's is CT_COUNT-sized, because capetown.json carries a DEM). `wcExplore.js` STRIPS it and sets
  the shared field's `aZ` ONCE (city slice = CT heights, rural 0) — else the COUNT-sized field's draw breaks.
- Re-bake needs `data/raw/` inputs (git-ignored / re-downloadable): z10 terrain tiles + `pipeline/sapacr-*`
  (crime) + WorldPop rasters. `.gitignore` inline `#` are NOT comments (once leaked the DEM tiles).

## The mental model (why this exists)
The maker lives in South Africa, is genuinely curious about crime, and wants to **enjoy looking at the
data** — to make it more interesting than a SAPS/government stat sheet. **For himself first** (same footing
as the mountain app being "for a friend"). The gap it fills: crime data lives in fear-maps (tabloid panic)
or dead spreadsheets — nobody shows it with genuine craft. Built like Loom — beauty grounded in a
deterministic/mathematical core.

## Settled decisions (do not re-litigate without reason)
1. **Purpose = a portfolio-grade craft piece WITH a point of view.** Not a maintained analytical tool (a
   commitment not wanted); not a pure neutral aesthetic (hollow with this subject). "Explore it yourself" is
   a light bonus, never a product. **Treat as PLAY** — grows by curiosity, needn't be finished/maintained.
2. **POV = the DATA gives the point of view — "you read it and take what you will."** An *invitation to
   read*, never a thesis pushed at you. **Low-floor/high-ceiling for *meaning*:** the surface read ("this
   area's dangerous") is complete + honest alone; deeper reads (spatial/structural apartheid, policing
   geography, the govt-vs-NGO data gap, history) are *available* for whoever reaches. **Generous, never
   didactic.**
3. **Beauty is the project, not a risk** (an earlier "dignity" caution was over-flagged). Beauty is how hard
   subjects get attention + dignity; a cold spreadsheet is the *less* respectful object. The only thing to
   guard is **HONESTY = FIDELITY** — *the same story the numbers tell.* Test: "is it still the same story?"
4. **The honest responsibility:** no presentation is neutral, and the DEFAULT reading of a crime map is the
   shallow/harmful one. So "let the data speak" only works if you **deliberately build the counterweights**
   so the fuller reading is available: **per-capita** (load-bearing), an optional **history/apartheid-
   boundary overlay**, the **SAPS-vs-NGO discrepancy**, **facts not arguments**. *Show, don't tell* — the
   heaviest reading becomes safe + more powerful by *not* asserting it (recognition, not accusation).
5. **Concept = "Loom for data" as an ENSEMBLE on a reusable engine** (instruments DEFERRED/emergent — a new
   view is what the data invites, not a pre-planned catalogue). Thesis = *"pretty data, not a spreadsheet."*
6. **Engine = one luminous POINT-FIELD; EVERYTHING is points** (data + structure/geography). The engine ONLY
   interpolates `(x,y)`+brightness targets; **every layout (incl. the map/elevation) = a pure function
   `(features→x,y,brightness)` computed upstream**; a new view = a new function. *"Points that can become
   any arrangement,"* not a hardcoded map-viewer.
7. **Visual language = DATA (glowing, coloured by local density) vs STRUCTURE (grey, matte, no glow).** Glow
   = the primary channel (glow=data always, no-glow=frame always). **Density = light** (the heatmap emerges
   from the swarm). A structure point never masquerades as data.
8. **Performance = GPU interpolation** (source+target per point, one `t` uniform) → 100k–1M+ points; count
   never the constraint. Star count = a dial (crimes-per-star); scale 1→millions.
9. **Data = static.** Download → process → **bake a static asset**; no backend/runtime API; can be a static
   site. Crime stats are annual batch releases (nothing to live-pull); the project is historical.
10. **Build = prove the FEEL first** (engine spike on fake data) → real-data morph = the prototype → light
    interactivity → grow by curiosity. **The eye is the judge.** Stack = Vite + three.js + (later) Python/
    d3-geo pipeline.

## Data foundations (settle in the pipeline)
- **Per-capita is load-bearing** (join population → police precincts = a spatial join; the one real prep
  step). **Volume real, micro-position jittered** within precincts (no false street precision).
- Sources verified: DataFirst SAPS 2008–23 (station-level + GIS, ~16 yrs) + VOCS (experienced) + SAMRC
  (died) + ISS + OpenUp. The **reported-vs-experienced-vs-died discrepancy = a built-in POV** (a future
  instrument). Honest limits: gaps pre-2021 some stations; category/boundary breaks over 16 yrs; no
  time-of-day in SAPS.

## Open / to decide later (see IDEAS-BACKLOG)
The pipeline specifics · the interaction paradigm (guided-flow vs free-explore) · the first real layout pair ·
specific instruments (deferred) · where it lives / distribution · a name.

## Principle candidates
> Append ONE sharp line when a *universal* lesson surfaces during building (universal + sharp + behaviour-
> changing). Append only — the steward promotes. Do NOT edit ~/.claude canon.

- *(context, already canon — not new candidates)* the **Loom pattern** — *a continuous interactive world
  grounded in a deterministic/mathematical core, beauty emerging from structure* (recurring across Loom / 2B
  / this — possibly worth a sharper canonical line if it recurs again); "grounded expert / deterministic
  engine + presentation layer"; low-floor/high-ceiling (here applied to *meaning*).
- **Atmospheric glow should EMERGE from the data, not be painted as a static layer.** A hand-placed
  nebula/halo sprite floats free the moment the field moves (empty-centre smudge); deriving it from bloom
  over the actual bright cores makes it follow the data for free. *(Generative/data-viz; the "single source
  → many projections" door applied to light.)* (?)
- **Tune additive+bloom from too-DIM upward, never from too-bright down.** Blown-out white hides the data
  and collapses the colour ramp; start under-exposed and add light until the gradient just sings — the
  gradient is the read, not the brightness. (?)
- **Build on real STRUCTURE even when the VALUES are placeholder.** Splitting "geography (real, fetchable)"
  from "measurements (walled)" let the whole prototype stand on real Cape Town shapes with simulated counts
  — and the real-data swap touches only the numbers, nothing downstream. Foundation/identity first, values
  later. (?)
- **A morph reads as alive only if each point keeps a stable identity across frames.** Fixed buffer slots +
  "park surplus at the centroid and grow back" makes the year-scrub breathe in place; re-deriving the point
  set per frame would reshuffle and read as noise. The smoothness is in the *correspondence*, not the tween. (?)
- **Normalise across the whole comparison set, not per-frame — or you erase the change you're animating.**
  Per-year density normalisation re-inflated every year to look equally "full", flattening the temporal
  signal the year-scrub exists to show; one global max across all years made growth/redistribution visible.
  (Generalises: any per-frame auto-scale — colour, axis, gain — hides the cross-frame trend.) (?)
- **Idle/ambient motion is FELT through SPEED, not amplitude — split the two levers.** Adding "life" by
  raising how FAR a point strays makes it read as *wandering off*; raising how FAST it orbits (same tiny
  radius) reads as alive-but-anchored. Expose speed and amplitude as independent controls. (?)
- **Surplus points should roost OFF-SCREEN and fly back, not blink on at a centroid.** Give each parked
  slot a fixed off-frame home + per-dot staggered timing, and every density change becomes a swarm
  gathering/dispersing — the "one living field" reads as alive. Honesty holds: at rest the count is exact;
  only the *arrival/departure* is animated, never the resting volume. (?)
- **A different pairing, not a different mechanic, makes a morph show "move" vs "grow" vs "shrink."** One
  shared buffer + per-crime layouts: robbery↔burglary moves (different geography), robbery↔murder shrinks
  (same geography, rarer). The engine stayed dumb; the *data pair* supplied the story. (?)
- **Conserved swarms + an off-screen reservoir: only the DELTA ever flies.** A field morphing between
  arrangements of *different size* should restructure the dots already on screen, swarm IN the shortfall
  from a parked off-screen reservoir, swarm OUT the surplus — never rebuild. A view is just
  `{layout + active count}`; the pool conserves what it can and exchanges only the difference. (Two such
  swarms here — DATA + TOOL — each self-managing; scales to any number of views without per-pair wiring.) (?)
- **When two fields share a frame, let one READ the other's derived axis from the same source — don't
  recompute.** The crime field samples the *same* baked DEM the terrain does (same grid, peak, orientation),
  so it rides the relief in perfect register for free; independent height calcs would drift apart. (?)
- **A perspective point-field needs a point-size CAP, and lines want UNIFORM arc-length sampling.**
  `gl_PointSize ∝ 1/dist` grows every dot without limit, so a zoom-in turns a fine field into fat discs —
  clamp it; density (more dots), not size, is how you fill space. And sample an outline by walking it at a
  constant arc-length step, not per-edge: a per-edge min-1-dot sampler clumps at dense vertices and starves
  long edges, so halving the spacing barely changes the count — you can't dial density until it's uniform. (?)
- **A cross-view morph is cleaner as on-screen RECONFIGURATION than fly-in-from-off-screen.** A fly-in is
  usually a patch for "the source view holds fewer dots than the target needs" — but fatten the source
  (here a line → a filled band) until it already holds the target's dot budget, and the morph becomes a
  pure reconfiguration of *visible* dots: no reservoir, no fades, the swarm launches from what you can see.
- **A "black render" in a background/headless tab is a capture artifact until a synchronous readPixels says
  otherwise — don't debug the code from a throttled screenshot.** A throttled rAF + WebGL's default
  `preserveDrawingBuffer:false` clears the buffer between the rare renders, so a screenshot taken when no
  render landed just-before-paint is black even when every frame is perfect. Distinguish real failure from
  artifact by forcing `render()` + `gl.readPixels` in ONE synchronous eval (before the clear): lit pixels =
  the pipeline is fine, look at the harness, not the shader. Hours of "the loop must be throwing" theory
  dissolved the moment the raw render lit 6,650 cells. (Generalises: instrument the actual output before
  theorising about the cause — a screenshot is a lossy, timing-dependent probe.) (?)
  Conserve by making both states use the same on-screen dots. (?)
- **Bank the state the moment it's loved — an un-committed "good enough" can become unrecoverable.** We
  nearly couldn't return to a relief look the maker liked because it was only ever an intermediate in one
  big uncommitted blob; later work buried it. Commit/branch a liked state *when* it's liked, not "later." (?)
- **Don't exile half the swarm off-stage — redistribute culled dots into the visible part.** The terrain
  wasted ~⅓ of its pool on invisible ocean cells (dim, thin land); redirecting would-be-ocean dots onto the
  land (rejection sample) doubled land density AND killed the map⇄view exodus for free. If a view culls
  part of the field, spend those dots where the picture actually is. (?)
- **Volume honesty = one mark per event, so a count change must be SEEN to fly, not just re-normalised.**
  When the number drops (a quieter year, a rarer category), surplus marks should *fly away* and re-enter as
  it climbs — the COVID-2020 pie visibly deflating ~7.7k dots reads the volume change that per-frame
  brightness-normalisation would have hidden. Animate the delta; don't just recolour. (?)
- **Equal categorical slices beat proportional-angle when density carries the value — and they don't hide
  zeros.** A true pie (angle ∝ count) gives a zero-count category zero angle → it vanishes; equal wedges +
  density-by-count keep every category visible (empty slice = a real "zero") and let "density = light" do
  the reading. Choose the encoding that keeps absence legible. (?)
- **Prove the FEEL before building the machinery — a calm static thing can beat a clever dynamic one.** A
  full discrete-level LOD (zoom → swarm-in more detail) was built and rejected on feel; a static relief you
  simply zoom into won. Elaborate motion is a cost, not a default; the eye decides, and often prefers still. (?)
- **A new dimension is another VALUE on an existing axis, not a parallel copy of the structure.** Modelling
  "region" (province vs Cape Town) as a second self-contained bundle — its own data + structure pools —
  instead of another layout the ONE conserved field morphs to made the core invariant (conservation: only
  the delta flies) *structurally* impossible: two separate pools can only cross-fade, never swarm, so the
  drill regressed to disappear/reappear. The single shared pool enforced conservation for free; the mirrored
  copy silently dropped it. When adding a second X (region, tenant, mode, view), make it a value in the one
  structure, not a mirrored subsystem — or you forfeit every invariant that structure guaranteed. Corollary:
  when a fast re-derivation regresses a proven capability, rebuild on the proven exemplar, don't untangle the
  copy. (?)
- *(tooling traps, kept local — not universal):* d3-geo `fitExtent` to ArcGIS polygons fails (clockwise
  winding → global bounds → microscopic scale); fit to vertices-as-points. `import.meta.url` URL-encodes
  spaces in paths. Calling both `THREE.Clock.getElapsedTime()` and `getDelta()` per frame zeroes the delta
  (each resets `oldTime`) → an fps meter silently never ticks; measure off one time source.
