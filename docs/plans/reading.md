# Plan — The Reading  ·  branch `feat/reading`

> A memorial that refuses compression. Murders only: the chosen year's dots file past a thin grey
> line at ONE PER SECOND, ignite as they cross, and accrete into a slowly growing column. A counter
> keeps the arithmetic honest: “1,204 of 3,900 recorded murders, 2024/25 — at one per second this
> reading takes 1h 5m.” Space pauses. Leaving returns every dot to the map.
> Self-contained: read this + referenced files; don't assume chat context.

## Context (read first)
- `src/engine/PointField.js` — `aSeed` attribute drives the per-dot stagger window in the vertex
  shader (`seed01 = fract(aSeed × 0.1591549431)`; dot crosses during its slice of `uT`). The Reading
  is ONE morph with **ordered** seeds — no engine loop changes.
- `src/wcExplore.js` — murder dots are a conserved subset: the `murder` layout's active dots for
  year `yi` are exactly that year's count (`totalsByType.murder[yi]`). `lift()`/slices if in a
  district; simplest v1 = province + Cape Town views only (both providers have full murder layouts).

## Decisions (made — veto in review)
- **Entry is quiet, not a toy**: key **R** (works when crime = murder, map view, not pie/pulse/
  terrain) + a text link in the About card (“hold a reading”). NO control-row chip — the chip row
  must not gamify this. Hint line, murder view only: adds “R · a reading”.
- **Pace fixed at 1 dot/second.** Not configurable. The duration IS the statement. Space pauses;
  R or Esc or M ends it gently (dots morph home over ~3s).
- Recorded-murders framing everywhere: counter says “recorded”, caption carries the year; nothing
  invented, no names (the data has none — the dignity lives in the pacing).
- Optional stretch (flagged, default OFF): a single soft tick per crossing (WebAudio osc, −24dB).

## Build steps
1. Engine: add `setSeeds(Float32Array)` (write the `aSeed` buffer; ~5 lines, additive, generic).
2. `readingLayouts(count)` in wcExplore (local fn, not capeTown.js — it's a ceremony, not a data
   view): QUEUE layout (dots stacked in a dim off-right holding cloud, density ~0.06) and COLUMN
   layout (tight vertical accretion left-of-centre, oldest at bottom, warm density). The thin grey
   line = a few hundred `structField` dots (structure role) placed at the crossing x.
3. Enter: park non-murder dots (they're already parked in the murder layout ✓); `setSeeds` on the
   murder slice so dot i crosses at uT ≈ i/M (seed = i/M ÷ 0.1591549431's fract-inverse — compute
   directly: `aSeed = (i/M) / 0.1591549431` won't fract right; instead set seed so
   `fract(seed×0.1591549431) = i/M`, i.e. `seed = (i/M)/0.1591549431` works when i/M<1 ✓ verify in
   step-test). `setStagger(w)` small (≈1.5/M × flightRatio) so each crossing is a ~1.5s flight.
4. Clock: `uT` advances linearly wall-clock over M seconds (its own tick branch, like pulse's);
   pause holds `uT`. Counter + elapsed/remaining in the HUD count element; restore on exit.
5. Exit: normal morph column→map layout; restore seeds to randoms (`setSeeds` with saved originals).
6. About-card link + hint + guards (no drill/flip/pie/pulse/terrain while reading; keys swallowed
   except space/R/Esc/M).

## Verification
- Seed math step-test first (20-dot toy: dots must cross strictly in order, evenly spaced).
- Counter at pause = column dot count exactly; total = `totalsByType.murder[yi]` to the digit.
- Full-run soak at 60× (debug clock multiplier, dev only) — no drift between counter and column.
- Feel check by the maker: the pacing, the ignition brightness, the column shape. This one is
  ALL feel — screenshot mid-reading + get the eye on it before merge.

## Effort: weekend. Merge notes: engine +1 tiny method (`setSeeds`); wcExplore own section + guard
lines; About card one line. Lowest conflict surface of the four — merge this branch FIRST.
