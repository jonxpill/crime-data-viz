# Plan — Release the Field  ·  branch `feat/flock`

> Pure joy, engine-native. Press **F** on the province map and all ~180,000 dots FORGET the map: the
> field lifts into a province-scale murmuration wheeling over the darkened terrain — then lands back
> on the exact truthful layout. The flight is CHOREOGRAPHY, not simulation: a chain of precomputed
> flock-shaped layouts, morphed through with heavy stagger (the stagger IS the turning-wave).
> Self-contained: read this + referenced files; don't assume chat context.

## Context (read first)
- `src/wcExplore.js` — the mode grammar to mirror (pulseMode/pieMode blocks in keydown, CHIP_ACTIONS,
  refreshHint/refreshHud, the tick's morph branches). NOTE main now routes all at-rest data writes
  through `setDataPair()` (the slice-offset door); the flock is a PROVINCE-ONLY full-pool state, so it
  writes full-size layouts at offset 0 — use `field.setSource/setTarget` directly like `startDrill`
  does, and say why in a comment.
- `src/layouts/capeTown.js` — layout functions are pure `{positions, density}`; `mulberry32` for
  seeded randomness (NEVER Math.random in a layout — morph targets must be stable per build).
- Engine untouched. The per-dot stagger (`uStagger`) already creates traveling waves through a morph.

## Decisions (made — veto in review)
- **Province map only** (region === 'wc', flat, no pie/pulse/terrain/reading): in a district most of
  the pool is parked-away with density 0 — flying it would materialize dots that aren't in the view's
  truth. Guard like toggleTerrain does.
- **A declared play state**: HUD count/year suspend to '— released —', hint says 'F or tap → land'.
  No data reading while airborne; landing always returns every dot to `layouts[yi]` (the truthful map)
  and restores the HUD. The tooltip and labels sleep during flight.
- Each dot KEEPS its current density (colour) through the flight — the flock visibly carries the
  data's warmth through the sky (hot-core dots streak as warm threads).
- **Choreography = 8 flock keyframes** cycled: `flockLayouts(count, box, seed)` in capeTown.js emits
  an array of 8 layouts, each a murmuration silhouette built from 3–5 gaussian lobes whose centres
  drift along seeded curve paths across/above the box (lobe sigma varies; ~15% of dots assigned to a
  diffuse halo so edges feather). Positions only — density is copied from the live layout at entry.
- Chain: morph current → frame k with `setStagger(0.75)` over ~2.4s, brief 200ms hold, next frame;
  wrap around. Landing: from wherever the chain is, one morph home over ~2.8s with stagger 0.6.
- Key **F** + chip `F release`. Exits: F, M, Esc, tap. Everything else swallowed while airborne.

## Build steps
1. `flockLayouts(count, box, seed)` in capeTown.js (pure, seeded; 8 frames; document the lobe-path
   construction). Density arrays are NOT built here — entry copies the live one (write a tiny helper).
2. wcExplore: `flockMode` state block (mirroring pulse): enter (snapshot current density; build frames
   lazily once per session; start chain), tick branch advancing the chain clock, exit-to-land, guards,
   HUD/hint/flag suspension + restore, chip/key wiring.
3. Land-then-restore correctness: after landing morph completes, re-anchor with `setYearPair(yi)`
   (mirrors pieMorphing's re-anchor) so the scrub pair is clean.
4. Chip + keydown + hint lines (one each, in the same style as N/T/V).

## Verification
- Node: flockLayouts purity (same seed → byte-identical frames; different seed → different), frame
  positions bounded within 1.6× the box, no NaNs, halo fraction ≈ 15%.
- Browser (if preview works): enter/exit cleanly from several years/crimes; readouts suspend/restore;
  guards no-op everywhere they should; after landing, the forensic invariant: year-step still writes
  only full-pool (province) and HUD count == data. Screenshot mid-flight + after landing.
- The turning-wave read (stagger 0.75 at 2.4s) is a maker's-eye item — bank screenshots.

## Effort: weekend. Merge notes: additive layout fn + own wcExplore section + 3 one-line hooks; no
engine edits; no bake/data changes. Should merge trivially over the other three of this round.
