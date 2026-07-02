# Crime Data-Viz — Ideas backlog (raised, not agreed)
> Open questions + sparks to *discuss before building*, not commitments. From the idea note's open threads.
> Promote into BUILD-PLAN once decided.

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
- **Real per-capita** — area-weighted census-population → precinct join (the one fiddly GIS step), to
  replace the population proxy. Then the Stage-2 raw↔per-capita toggle rearranges on *true* rates.

## Flag (foundation-first hygiene)
- **Honesty is a build-time discipline, not a final polish** — per-capita and the counterweights must be in
  from the first real-data stage, or the default fear-map reading creeps in. Don't defer them.
- **Keep the engine pure** from commit one — if it ever "knows about crime/maps," the generality (and the
  "any city / any dataset" payoff) is lost. Every layout is a function; the engine just tweens points.
