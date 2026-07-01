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
- **Specific instruments** — decided later, *by the data + what's worth showing* (the engine renders any
  layout; don't pre-spec the catalogue). Loose candidates seen so far: the particle-morph, the year
  time-lapse, the **discrepancy lens** (reported vs experienced vs died), a per-capita choropleth, the
  **elevation terrain**, the history/apartheid overlay, type breakdowns, comparison.
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
