# Plan — The Toll  ·  branch `feat/toll`

> The accumulation the Reading can't show. **K** on the province map: a thin grey YEAR-DIAL (2008/09
> at twelve, eighteen ticks, a structure hand) sweeps once (~75s, scrubable — the dial IS the
> scrubber); as it sweeps, every recorded murder pours OUT of the dimmed map (each dot leaves its own
> precinct) and settles into a growing central disc — one stratum ring per year, growth rings of loss,
> and it NEVER resets. Press-and-hold drops the pour to 1:1 (one per second — the Reading's soul as a
> gesture); release resumes. End state: “~63,000 recorded murders · Western Cape · Apr 2008 – Mar 2026”
> (exact number from the bake). Self-contained: read this + referenced files; don't assume chat context.

## Context (read first)
- `src/wcExplore.js` on MAIN (your branch base): the mode grammar (pulse/pie blocks), `setDataPair`
  door (the Toll is a province-only full-pool ceremony — full-buffer writes at offset 0, justified in
  a comment, like `startDrill`), the NEW `refreshChips()` contextual dimming + grouped chip row +
  cinema mode (your chip joins the *views* group; extend refreshChips for toll state).
- `docs/plans/reading.md` + the `feat/reading` branch (git show feat/reading:src/wcExplore.js) — THE
  KEY REUSE: the Reading proved ordered-seed processions. `setSeeds()` (tiny engine addition on that
  branch — replicate it identically here; merges will coincide) + seeds ordered so dot k crosses at
  uT ≈ k/M + the counter via binary search on the shader's own lt formula (float32 seeds — the
  closed-form drifts ±1; the search is exact). Steal the technique, re-derive the constants.
- Station murder data: `station.crimes.murder[year]` in the baked JSONs.

## The mechanism (one morph, scrubbed)
The whole ceremony is ONE source→target pair with ordered seeds, `uT` driven by the dial clock:
- Every murder EVENT (station s, year y, index within year) gets its own dot, allocated GLOBALLY in
  chronological order (year-major, station-shuffled-within-year with a seeded rng so no station
  always pours first). Total M ≈ 63k ≤ COUNT (**assert loudly at build**; print the exact M).
- SOURCE pose: the event's station map position (its jitter offs — dots visibly leave their
  precinct). Non-participating pool dots park at their roosts throughout.
- TARGET pose: the event's slot in its YEAR STRATUM of the disc — annuli of equal AREA per dot
  (even area-fill, density honest like the pie), year 1 innermost. Disc radius ~0.32·min(box)
  centred slightly below map centre. Grey structure: the outer dial ring + 18 ticks + year hand +
  faint stratum seams (pieFrameLayout contract).
- Seeds: dot k (chronological) crosses at uT ≈ k/M (the Reading's seed math; stagger window sized so
  a dot's flight is ~1.2s at sweep speed). Scrubbing uT BACKWARDS un-pours — free.
- CLOCK: uT advances so the dial sweeps 18 years in ~75s (TOLL_SWEEP_MS tunable). The hand angle ==
  uT mapped to the year arc; drag on the dial ring scrubs uT directly (pointer → angle → uT).
  Space pauses. HOLD (pointerdown ≥ 350ms on the disc, or holding key `1`) → clock rate switches to
  exactly one crossing per second (compute from seed spacing: d(uT)/dt = 1/M · (1−w) — verify against
  the counter in the step-test); release restores the sweep rate.
- COUNTER (HUD): year under the hand · that year's running count · cumulative total, all via the
  binary-search counter. Completion line: “N recorded murders · Western Cape · Apr 2008 – Mar 2026”
  and the hand rests. The disc stays until exit.
- EXIT (K/M/Esc/tap outside the dial): reverse-drain FAST (~1.4s, uT → 0 with an eased clock) then
  restore the truthful map + HUD (re-anchor via setYearPair like the other ceremonies).

## Decisions (made — veto in review)
- Key **K** + chip `K the toll` in the *views* group; province flat map only (guards like flock's);
  everything else swallowed while tolling except space/hold/scrub/exits; tooltip + labels sleep.
- Murders only, raw counts only (murder is near-fully recorded; still say “recorded”).
- The dial is calendar-honest: each year tick is labeled sparsely (2008 · 2013 · 2018 · 2023 ·
  2025/26 end) via the caption-div pattern; WORDING stays memorial-quiet.
- refreshChips: everything dims in toll except play (pause), map, about, months? No — months exits
  first (dim it); keep play/map/about live.
- Engine: replicate `setSeeds()` EXACTLY as feat/reading added it (same method name/shape) so the
  branches merge without conflict. No other engine change.

## Build steps
1. Engine `setSeeds()` (identical to feat/reading's). 2. `tollLayouts()` (local to wcExplore or
   capeTown.js — chronological allocation, source/target poses, per-year stratum ring geometry,
   dial/hand/seam structure layouts, exact M + per-year offsets returned for the counter).
3. Mode block (enter/exit/clock/hold/drag-scrub/counter/HUD/guards/chip/key/`__viz.toll(p)` hook).
4. Step-test FIRST (Reading's harness pattern): ordered crossings, counter == geometry at every
   sweep step, 1:1 rate == 1.00 dot/s within float tolerance.

## Verification
- Node: M == Σ station.crimes.murder[y] over all 18 years to the digit; each stratum's dot count ==
  that year's total; disc radii give equal area-per-dot within 1%; seeds strictly ordered.
- Browser (or __viz.toll): enter → pour → scrub back/forward → hold-1:1 → complete → exit clean;
  counter matches data at 5 spot-progressions; screenshots at ~25% / ~60% / complete.
- Maker's-eye: sweep speed (75s default), disc size, stratum legibility (can you SEE 2021 thicker
  than 2013?), the hold-for-1:1 gesture's feel, completion-line wording.

## Effort: weekend-plus. Merge notes: engine setSeeds coincides with feat/reading (identical);
chip row edit lands in the *views* group (grouped row is on main now); province-only ceremony,
no bake changes.
