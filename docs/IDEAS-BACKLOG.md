# Crime Data-Viz — Ideas backlog (raised, not agreed)
> Open questions + sparks to *discuss before building*, not commitments. From the idea note's open threads.
> Promote into BUILD-PLAN once decided.

## Next major direction — THE THREE-PROVINCE TOLL (endorsed 2026-07-14; direction agreed, build gated on data)
The Toll (18-year murder accumulation as a settled disc) applied to South Africa's three biggest
provinces **side by side** — **Western Cape · KwaZulu-Natal · Gauteng** — a triptych of discs. Raised while
imagining "the three major cities next to each other"; resolved to PROVINCES because we've already done one
(WC), they're self-contained, and the metros (Cape Town ⊂ WC, eThekwini/Durban ⊂ KZN, Joburg ⊂ Gauteng) are
drill *subsets* the explorer already reaches, so cities come nearly free later.
- **Data exists — it's a pipeline lift, not a wall.** SAPS crime stats are *national*, per police station,
  the SAME source + granularity we baked for WC (DataFirst cat. 1012 + saps.gov.za). Extending = each
  province's station list, precinct geometry (map/source pose), per-year murder counts, and population for
  per-capita. Data-first rule holds: REAL baked data for all three, no eyeballed fills. This last-mile data
  work is the real cost; three discs on the shell is the easy part.
- **Per-capita is the load-bearing crux AND the reason to build it.** Populations ~ Gauteng 15.8M · KZN 11.5M
  · WC 7.2M — three raw discs would mostly draw *population* ("more people, more murders"). But the Toll is
  about *raw bodies* (the actual dead), so raw is honest for a memorial. The story likely **flips** on rate:
  Gauteng leads on volume, WC/Cape Town carries one of the highest murder *rates* in SA. So it must be a
  raw↔per-capita toggle (raw = human cost, rate = danger) — that flip is the payoff. (Verify rankings against
  the baked data, don't assert.)
- **Architecture fit — this is concrete "view #2".** A 3-province Toll is a *view* (or a "compare" mode of the
  Toll view) fed N province data-modules; the shell + view-registry (being designed 2026-07-14) makes adding
  a province a *registration*, not a rebuild — the generalization target the view-contract is being tested
  against.
- **Sequencing:** standalone shell + WC Toll first (in flight) → KZN + Gauteng **data pipeline** (the gate) →
  the triptych view on top. National expansion (~1M-point "National Creature" moonshot) is the far horizon.

## Decide as you build (ripe)
- **The data→particles pipeline specifics** — the **per-capita spatial join** (population census geography ≠
  police precincts), the **jitter** rules (how to scatter N points within a precinct honestly), and how
  **generic** the data model is from day one (any-city engine) vs a Cape-Town-only instance. Lean: keep the
  engine generic (ingest `{location, year, type, count}`), make Cape Town the first instance.
- **The interaction paradigm** — guided-flow (scrollytelling) vs free-explore vs a hybrid (the "explorable
  explanation": a beautiful guided story that opens into free exploration). *More foundational than any
  single instrument — revisit once the Stage-0 spike feels right and you know what the morphs feel like.*
- **The first real layout pair** for the prototype — **map + 2008→2023 year-scrub** is the lead candidate
  (data-supported, the "watch it shift" payoff). Confirm once the engine exists.

## Later (deferred by design)
- **VR presentation object (raised 2026-07-02).** NOT a walk-through world — the maker's correction: the
  whole field is a **holographic object floating in a VR meeting room** (à la Horizon Workrooms/Spatial),
  which the presenter picks up, spins, tilts, zooms, sets on its side — a tabletop hologram, not an
  environment you walk into. Fits what's already built almost unchanged: the pie is already a flat disc (just
  reorient it as a floating object instead of face-on to a fixed camera); the terrain is already a bounded,
  liftable slab. Core scope is small — same one-camera/one-scene/source-target-buffer architecture; the real
  work is the INPUT layer (hand-tracking/controller grab-rotate-scale replacing mouse-drag/scroll) and the
  WebXR session plumbing (three.js supports it natively), not a rebuild of the viz. **Gesture-triggered
  morphs**: a snap/pinch flips landscape↔pie↔map and the dots swarm in true 3D. This wants the swarm to
  fly REAL 3D arcs per dot (lift–arc–descend during transit), not the current flat (x,y)-slide-plus-one-
  global-z-dial — stereo depth + head-parallax would expose a flat slide as fake, so the arc is the part that
  actually sells "swarm of fireflies reforming" in VR (extends the existing per-dot stagger with a z-bump
  during transit — not a new system). Gesture note: a literal finger-SNAP is hard to detect from hand-
  skeleton joints alone (it's mostly audio); a **pinch** (thumb-to-index) is the pragmatic, WebXR-native
  stand-in with the same "make a gesture, it reforms" feel.
- **Hover-to-identify readout — ✅ SHIPPED (2026-07-02).** Roll over any mark in map/terrain/pie → a tooltip
  with its exact datum ("Steenberg · 289 robbery · 2018/19"), from the baked counts, live with the year-scrub
  + crime-flip. Built view-agnostic as planned: each precinct gets an anchor in field-local space, projected
  through the live transform (tilt/z-lift/camera) to the screen; nearest-to-cursor wins — one mechanism
  covers all three views. Map/terrain hit-test is nearest-CENTROID (not exact polygon) — upgrading to
  precise point-in-polygon (bake the boundary rings) is a small future refinement, not a gap.
- **The "leave the map" chart-morph — ✅ FIRST ONE SHIPPED as the PIE (2026-07-02, `P`).** Equal per-precinct
  wedges, density = crime level, volume-honest fly-away. Remaining chart candidates on the same grammar:
  **ranked station bars** (worst→shortest, exact order) · **year bars** (15-yr trend) · **crime × elevation
  scatter** (bridges terrain). Each = a new layout function; the swarm animates the fly-over.
- **Flows / routes archetype** (raised 2026-07-02) — the new data-SHAPE for e.g. truck routes in/out of the
  city: dots streaming along paths. A genuinely new archetype (not events-in-space); very drone-show. Would
  prove the engine generalises past point-clusters.
- **Generalise the drill to all 6 districts (raised 2026-07-03).** Today the Western Cape explorer
  (BUILD-PLAN Stage 4) only drills into Cape Town — the one region with a detail dataset. Each district =
  another layout the ONE field morphs to (per-district positions in the bake) → one generic drill for all,
  clickable anywhere. This is the "zoom into every subsection" the maker asked about; the region-as-layout
  foundation is built for exactly it. Needs: per-district detail geometry/positions baked, and the drill
  target generalised from a hardcoded 'ct' to any district. Lean: bake per-district `fitExtent` positions,
  keep the single conserved-slice mechanic (each district's stations a contiguous slice).
- **✅ Fold to one app — DONE (2026-07-03).** The explorer is now THE app: `index.html` loads `wcExplore.js`;
  `src/main.js` + `wcExplore.html` retired (git history); single Vite entry → one clean bundle; the offline
  single-file share repointed to inline both datasets. Opens on the province, drill into Cape Town. The
  "main IS the multi-region engine" end state is reached — one app, region is just a layout.
- **Specific instruments** — decided later, *by the data + what's worth showing* (the engine renders any
  layout; don't pre-spec the catalogue). Loose candidates seen so far: the particle-morph, the year
  time-lapse, the **discrepancy lens** (reported vs experienced vs died), a per-capita choropleth, the
  **elevation terrain** (✅ shipped 2026-07-01), the history/apartheid overlay, type breakdowns, comparison.
- **Where it lives / distribution** — a static site (it bakes to static; GitHub Pages-able). Portfolio host?
- **A name** — working title is "Crime Data-Viz"; the concept ("a living field of light") wants something
  more evocative eventually.

## Stage-1 refinements (raised during the build — pick up when curiosity strikes)
- **✅ DONE (2026-07-01) — year window extended to 2008/09–2022/23** via DataFirst SAPS Annual Crime
  Records (cat. 1012). Stations self-locate from the file's own lng/lat (name-join deleted); metro = our 60
  stations' precincts. Re-bake: `node pipeline/bake.mjs`. *Next grab from the same DataFirst login:* **VOCS**
  (Victims of Crime Survey) — the "experienced crime" counterweight leg (reported-vs-experienced-vs-died).
- **Polygon-fill jitter** — scatter data points inside each precinct's *real polygon* (point-in-polygon),
  not a disc around the centroid, so the field is truly continuous and precinct-shaped, not a touch
  circular. Bake per-precinct interior sample offsets so the client stays cheap.
- **More evocative structure** — the precinct mesh reads as a map but not unmistakably *Cape Town*; add the
  coastline + a Table Mountain void (the reference mocks) so the silhouette is instantly recognisable.
- **✅ DONE (2026-07-02→03) — real per-capita** — WorldPop 2020 → precinct join baked for BOTH Cape Town
  (`bake.mjs`) and the whole Western Cape (`bake-wc.mjs`, a windowed read of the national raster). `C` morphs
  the field between raw counts and true rates (dense townships shrink, low-population CBD/Camps-Bay swell);
  rollover + flag credit switch with the mode. The population proxy is gone.

- **✅ DONE (2026-07-09) — the Monthly Pulse** shipped: `N months`, 60 months Apr 2021–Mar 2026, looping.
- **THE BIG BRAINSTORM (2026-07-10, raised not agreed)** — 126 new-visualization ideas across eight lenses,
  full archive in [brainstorms/2026-07-10-viz-brainstorm.md](brainstorms/2026-07-10-viz-brainstorm.md).
  Maker-shortlist pending; standouts flagged in that session: the Lockdown Canyon (time AS the landform),
  Ember/Fire Season (recency & change as temperature), Seasonal Coil / Season Wheel (months as standing
  geometry), The Reading (a memorial that refuses compression), The Unlit Field (the reported-vs-experienced
  counterweight, drawn at last), Release the Field / Starling Ledger (delta murmurations), the Loom bridges
  (District Chorale · Voice Scrub · Lament Engine), Stand In Your Suburb + One in Forty-Three
  (personalization), Pin the Peak / Which Is Worse? (calibration play), Rank Braid / Rhythm Constellation /
  Statistical Twins (150 characters), Poisson Fog (uncertainty as weather), Last-Digit Forensics (the counts
  on trial), and the moonshots: Dome Pulse (Iziko planetarium), Drone Veld, Mountain Cast, the National
  Creature (~1M points), Wade Through the Field (WebXR).
- **Monthly granularity, 2022→2026 (raised 2026-07-07, not agreed)** — the SAPS quarterly workbooks
  (data/raw/saps/) carry per-station MONTHLY columns for every month since Jan 2022: a much finer clock
  than the annual scrub (seasonality, festive-season spikes, a month-by-month swarm). Parser sums
  differently; the engine needs nothing new.

## Flag (foundation-first hygiene)
- **Honesty is a build-time discipline, not a final polish** — per-capita and the counterweights must be in
  from the first real-data stage, or the default fear-map reading creeps in. Don't defer them.
- **Keep the engine pure** from commit one — if it ever "knows about crime/maps," the generality (and the
  "any city / any dataset" payoff) is lost. Every layout is a function; the engine just tweens points.
