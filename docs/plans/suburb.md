# Plan — Stand In Your Suburb + One in Forty-Three  ·  branch `feat/suburb`

> The personalization pair. **H** opens a quiet one-field prompt ("your suburb… or find me"): the
> matching precinct gets a grey beacon, the rest of the field dims, and its 18-year story plays.
> Then the money moment: the precinct's POPULATION stands up as a grid of grey person-points and the
> year's reported crimes land among them — "walk past 43 neighbours and you pass one burglary."
> Self-contained: read this + referenced files; don't assume chat context.

## Context (read first)
- `src/wcExplore.js` — `stationsByRegion`, `activeStations()`, hover/nearestStation, the pulse's mode
  grammar (focus mode mirrors it), `setDataPair` (THE door — all at-rest data writes go through it;
  focus dimming included), labels layer + about-card overlay patterns (reuse the overlay CSS style).
- `pipeline/bake-wc.mjs` + `pipeline/bake.mjs` — station records. **Baked stations do NOT carry
  lng/lat** (only projected x/y); the geolocate path needs them.
- Semantic roles: people are NOT crime — person-points are STRUCTURE-voiced (grey, matte, no glow).

## Decisions (made — veto in review)
- **Bake addition**: add `lng`/`lat` (1 decimal-minute precision is plenty; round to 4dp) to station
  records in BOTH bakes; rebake all three assets on this branch. Nothing else in the bake changes;
  run the bakes and confirm the usual trust lines print unchanged.
- **Locate paths**: (a) text input matched against the CURRENT region's station names + a small
  alias pass (case/space/punct-insensitive prefix+contains); (b) a "find me" button →
  `navigator.geolocation` (client-side ONLY, never transmitted, never stored — the hint says so) →
  nearest station by haversine on the new lng/lat. If outside the WC (>60km from every station), say
  so kindly and stay put.
- **Focus mode** (mirrors the pulse's grammar): `focusStation` index + `focusMode` flag. The layout
  shown is the live one with every OTHER station's densities scaled ×0.12 (a pure post-pass helper
  `focusLayout(layout, stationIdx, factor)` — allocate once, reuse buffers). All writes via the door.
  A grey beacon ring (structure dots, pulsing size via the existing shimmer) sits at the station.
  Year scrub/play still work (the post-pass rides `setYearPair` via one hook), crime flips too.
  Exits: H, Esc, M (and drilling exits focus first, like the pulse does).
- **One in Forty-Three** (auto-shown while focused, toggleable with **J** if it fights the eye): a
  fourth small pool `peopleField = PointField(glow:false, matte:'#566d78', size 1.3)` (~3,000 dots
  max) — a rough grid filling the precinct's polygon radius around the station, **1 grey dot = 100
  residents** (declared on-screen: "each grey dot ≈ 100 residents · WorldPop 2020"). The year's
  reported dots are already there (the focused slice). Caption computes live:
  "`{pop.toLocaleString()} residents · {n} reported {crime} in {year} — 1 for every {round(pop/n)}
  residents`" (guard n=0: "none reported"). Rate honesty: counts are reports, not victims — caption
  footnote says 'reported'.
- HUD while focused: region line shows the station name; count shows the station's own count.
  Tooltip continues to work (it already names stations).
- Key **H** + chip `H my suburb`. The prompt overlay reuses the about-card look (small, centered,
  Esc/backdrop closes).

## Build steps
1. Bake lng/lat (both bakes + detailView station records) → rebake → verify assets carry them and
   nothing else drifted (diff the JSON keys; totals unchanged).
2. `focusLayout` helper + focus mode state/machinery (enter/exit, beacon, door-routed dimmed writes,
   year/crime hooks) mirroring pulse.
3. The locate overlay (text match + geolocation) — client-side only, graceful failures.
4. `peopleField` + precinct person-grid layout (seeded, fits within station.r radius; 1:100
   declared) + the live caption line + J toggle.
5. Chips/keys/hints/about-card line; `__viz.suburb('paarl')` debug hook for headless testing.

## Verification
- Node: nearest-station haversine spot-checks (5 known coords → expected stations); person-dot counts
  == round(pop/100) for 5 stations; caption arithmetic to the digit.
- Browser (or debug hook): `__viz.suburb('nyanga')` focuses (others dimmed — probe densities via the
  slice bands if the door forensic trick is handy), beacon present, caption matches data
  (`pop`/`crimes` from the JSON), year-step keeps focus, H/Esc/M exit clean, drill exits focus.
  Geolocation path: mock `navigator.geolocation` in the console to a Cape Town coord.
- Privacy grep: no coordinate ever leaves the page (no fetch/beacon with position data).

## Effort: weekend-plus (the bake touch + a new small pool). Merge notes: rebaked JSON assets make
this branch's diff LARGE but mechanically safe (no other current branch touches assets); merge it
last of this round.
