# Plan — Ember Field  ·  branch `feat/ember`

> The pulse gains memory. In ember mode every dot is born WHITE-HOT in its report month, cools
> through orange to deep red over ~6 months, and settles as dark ash that NEVER leaves the field.
> Pause anywhere: the last quarter's embers glow on top of five years of accumulated ash. Change —
> the derivative — finally gets its own channel, in the Cape's own metaphor (fynbos fire ecology).
> Self-contained: read this + referenced files; don't assume chat context.

## Context (read first)
- `src/wcExplore.js` — the pulse machinery this rides: `pulseMode`, `mi`, `setMonthPair`,
  `PULSE_MS` clock branch in `tick()`, provider `monthly(type)` lazy builder + cache.
- `src/layouts/capeTown.js` — `monthly()` (slots/offs/roosts reuse) is the template for the new
  cumulative layout; station objects carry `monthly[type][0..59]`.
- `src/engine/PointField.js` — the ONE feature of the four that touches the shader.

## Feasibility fact (checked): 5-year cumulative counts per crime fit the existing pool
(COUNT ≈ 181k): robbery ≈ 158k, burglary ≈ 120k, commercial ≈ 127k, others far less. The layout
must ASSERT this at build (if a future data refresh overflows, fail loudly, never sample silently).

## Decisions (made — veto in review)
- Ember is a **sub-mode of the pulse**: enter the pulse (`N`), then **E** toggles ember. Chip:
  the `N months` chip stays; ember gets hint text inside pulse (“E · embers”) — no new chip (row
  is crowded; ember is a connoisseur's second gear).
- **Positions are static** in ember (each event has its own permanent dot at its precinct jitter);
  playback only advances a `uMonth` uniform → the cheapest animation in the whole app (zero
  re-uploads; pure GPU). Scrub = set `uMonth`; loop restarts by fading ash out ONCE at wrap
  (declared: “rewinding 5 years”).
- **Age replaces density as the colour channel while in ember** (declared in hint): cooling curve
  fixed and disclosed (white-hot ≤1mo → amber ≤3mo → deep red ≤6mo → ash floor, NEVER invisible —
  nothing ever cools to “safe”). One curve for all precincts and crimes.
- Engine addition is GENERIC (an age-tinted field, no crime knowledge): `aBirth` attribute +
  `uMonth`, `uAgeMode` uniforms + a colour branch in the fragment shader (~25 lines). aZ untouched.

## Build steps
1. Engine: `aBirth` buffer attribute + `setBirths(arr)`, `uMonth`/`setMonth(m)`, `uAgeMode` flag;
   fragment: when `uAgeMode=1`, colour = agePalette(uMonth − aBirth) with the fixed curve; dots with
   `aBirth > uMonth` are unborn (discard). Additive glow path unchanged.
2. `cumulativeMonthly(type)` in `capeTown.js` provider (lazy, cached like `monthly()`): allocate one
   PERMANENT slot per event in month order per station (reuse `offs` jitter); emit positions +
   births array + per-month cumulative totals. Assert total ≤ COUNT.
3. wcExplore: `emberMode` inside pulse — on E: build/cache, `setBirths`, `setMonth(mi)`,
   `uAgeMode=1`, positions set once (source=target); pulse clock now drives `setMonth` instead of
   `setMonthPair` (fractional uMonth for smooth ignition). On exit: restore monthly pair morphing.
4. HUD: count shows “this month +N · total since Apr 2021: M”; flag appends “embers: age-coloured,
   ash persists”. Tooltip: station month count + cumulative.
5. Crime flip inside ember: rebuild (evict), crossfade via a 1s uAgeMode-off morph (honest, simple).

## Verification
- Unborn discard exact: at mi=0 visible dots = month-0 count to the digit; at mi=59 visible = the
  asserted cumulative. Cooling curve stills at 1/3/6 months screenshotted for the maker's eye.
- Ash floor visible on the darkest background (contrast check vs structure grey — ash must read as
  a THIRD tone: not data-bright, not structure-green/slate).
- Perf: uMonth playback at 60fps with 158k dots (should be trivially fine — no uploads).
- December ignition wave visibly sweeps the province each loop-year (the whole point — eye check).

## Effort: weekend-plus (the shader work is the plus). Merge notes: engine additions are generic +
additive; wcExplore pulse-section edits could brush `feat/reading`'s guard lines — merge Reading
first, rebase this. capeTown.js additive fn.
