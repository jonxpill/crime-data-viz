# Plan — The Forensics Strip  ·  branch `feat/forensics`

> Statistics about the statistics. **X** morphs the field into a ranked strip: every station a short
> vertical ribbon of its own 60 monthly dots, sorted by statistical LIVELINESS. Honest tallies
> shimmer — their dots scatter with natural Poisson noise; suspiciously regular series freeze into
> visibly crystalline rows. Wording is load-bearing: "behaves unlike a tally — look closer",
> NEVER "fraud". Pure layout — no engine changes, no new pools.
> Self-contained: read this + referenced files; don't assume chat context.

## Context (read first)
- `src/layouts/capeTown.js` — the layout grammar (conserved slots, `mulberry32`, one-pass
  normalization); `monthly` arrays on stations (`station.monthly[type][0..59]`).
- `src/wcExplore.js` — mode grammar (pie mode is the closest cousin: a full-field morph to an
  abstract layout with its own structure frame), `setDataPair` door, tooltip machinery.
- STATISTICAL CARE (this is the whole feature):
  - Dispersion index D = var/mean of the 60 monthly counts is ≈1 for a Poisson tally; compute it on
    seasonally-adjusted residuals (subtract each station's calendar-month mean across the 5 years,
    add back the grand mean) so real seasonality doesn't read as over-dispersion.
  - Small counts cannot be tested: stations with mean monthly count < 5 for the selected crime are
    EXCLUDED from ranking — rendered as a dim untested group with the caption "too small to test".
  - Last-digit uniformity (χ² against uniform over trailing digits) is only meaningful for counts
    ≥ ~20; show it as a tooltip histogram + flag, never as the ranking.
  - Innocent causes exist for regularity (court-driven detections, quotas of process crimes, tiny
    true rates) — the legend says so explicitly.

## Decisions (made — veto in review)
- **The view**: stations as columns along x, sorted by D ascending (most crystalline LEFT — the
  "look closer" end), each station's 60 monthly dots plotted in its column: y = month index (Apr 2021
  bottom → Mar 2026 top), x-jitter WITHIN the column ∝ that month's residual (so an honest station's
  ribbon wobbles left-right with real noise; a rigid series draws a plumb line). Dot identity stays
  conserved (the same pool, station slots reused; surplus parks at roosts). Density colour = the
  existing ramp on local crowding (one gMax across the strip).
- A grey structure frame: baseline, the D=1 reference tick, and three labeled zones ("behaves like a
  tally" / "quieter than a tally — look closer" / "too small to test"). Zone thresholds displayed
  (D < 0.55 → look-closer, chosen conservatively; verify against the data's actual distribution and
  adjust so at most ~10% of testable stations land there — thresholds are DESCRIPTIVE, not accusatory).
- **Tooltip** per station: name · crime · D (2dp) · mean/month · a 10-bucket last-digit histogram
  (text-sparkline, e.g. ▂▄▁▃…) with its χ² p-value when n ≥ 20 · the caveat line "regularity has
  innocent causes — this is a look-closer flag, not a finding".
- Works per region (province + districts — the door handles slices) and per crime (↑↓ re-sorts with
  an animated morph — the re-sort IS the show). Per-capita no-ops here (counts, not rates, are what
  tallies are). Pies/pulse/terrain guarded off inside the strip.
- Key **X** + chip `X forensics`. Hint inside: "↑↓ crime · hover a column · X or M → map".
- The stats live in a pure helper `forensicsStats(stations, type)` (node-testable, exported) —
  layout consumes its output.

## Build steps
1. `forensicsStats` (capeTown.js or its own tiny module): per station → {D, mean, testable,
   digitHist, chi2p} with the seasonal adjustment above. Unit-test in node against synthetic
   Poisson + synthetic rigged series (rigged must rank crystalline; Poisson must center on D≈1).
2. `forensicsLayout(...)`: the sorted strip layout + its structure frame layout (pie-frame contract).
3. wcExplore: mode block (mirror pie mode's enter/exit morphs via the door), tooltip branch,
   guards, chips/keys/hints, `__viz.forensics()` returning the ranked table for headless checks.
## Verification
- Node: synthetic-series tests (above) + real-data table printed for robbery + murder: D
  distribution, how many land in each zone (adjust threshold per the ≤10% rule), exclusion counts.
  Spot-check 3 stations' D by hand-recomputation.
- Every dot in the strip = one real monthly report of the selected crime in the current region
  (probe: active count == Σ monthly totals — same forensic band-counting used on main).
- Browser: enter/exit morphs clean; re-sort on crime flip; tooltip content matches the node table
  to the digit; zone wording present. Screenshots: the strip for robbery (province) + one district.
- WORDING REVIEW is a merge gate: the maker signs off the zone labels + tooltip caveat text.

## Effort: weekend-plus (the stats care is the work). Merge notes: no engine/pool/bake changes;
one new layout + mode section; trivial hooks. Wording gate before merge.
