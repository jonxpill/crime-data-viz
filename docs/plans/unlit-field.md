# Plan — The Unlit Field  ·  branch `feat/unlit`

> The counterweight the origin note named on day one: reported vs experienced, finally drawn.
> Toggle **U** and unlit slate points condense out of the dark around the glowing reported dots —
> the survey-estimated crimes that never reached a police station. They NEVER glow: a new, third
> semantic role — **estimated absence** — beside data-glow and structure-grey.
> Self-contained: read this + referenced files; don't assume chat context.

## Phase 0 — RESEARCH (its own gate; nothing builds until this passes)
Source: Stats SA **Governance, Public Safety and Justice Survey (GPSJS)** (successor to the Victims
of Crime Survey/VOCS) — published reporting rates (“% of incidents reported to the police”) by crime
type, national + (where sampled adequately) Western Cape. Deliverable: `data/vocs-reporting.json`
(SMALL, committed, fully cited):
```json
{ "source": "<publication, year, table>", "grain": "national|WC",
  "rates": { "burglary": {"r": 0.48, "src": "..."}, "robbery": {...}, "sexoff": {...},
             "carjacking": {...} } }
```
Rules: every rate carries its citation; cross-check each against TWO publications/years before
accepting; prefer WC-grain, fall back to national (say which); if a category isn't survey-measured,
it is EXCLUDED, never guessed.
Category mapping (verify in the tables, don't assume): burglary→housebreaking/burglary; robbery→
street/individual robbery; carjacking→vehicle hijacking; sexoff→sexual offences **with a mandatory
caveat: surveys themselves under-capture sexual offences — present the estimate as a FLOOR**.
Exclusions (state on screen): **murder** (near-fully recorded; no survey rate), **commercial**
(business crime, outside household surveys). Toggling U on those shows a one-line note instead.

## Decisions (made — veto in review)
- Math: per station-year, unreported estimate `U = R × (1 − r) / r` (R = reported count, r = survey
  reporting rate). The rate is provincial/national — applied uniformly across stations, and THAT
  UNIFORMITY IS DECLARED (the true geography of underreporting is unknown; the card says so).
- The third role's look: **no glow, normal blending, dim slate-violet (≈ #55496b — distinct from
  structure slate #566d78 and from all data ramp hues), slightly smaller, high jitter** — reads as
  shadow-population, never as data, never as frame. Legend chip appears while active:
  “◌ estimated unreported (survey-based)”.
- Own pool (`unlitField = PointField(glow:false, matte:'#55496b')`), sized to the max U across
  crimes/years (burglary ≈ reported×1.1 → ~55k; assert at bake). Dots condense IN around each
  station (from that station's roost direction, conserved-swarm grammar) and disperse on toggle-off.
- Key **U** + chip `U unlit` on map views (province + districts), works with year scrub and
  per-capita (per-capita of reported+estimated uses the same pop denominators). Blocked in pies/
  pulse/terrain/canyon v1.
- Tooltip while active: “Nyanga · burglary · 2024/25 · 511 reported · est. +554 unreported
  (r=48%, GPSJS national)”. About card gains an Unlit paragraph with sources.

## Build steps
1. Phase 0 research + `data/vocs-reporting.json` + a trust-report script printing every rate,
   source, and the implied WC totals (sanity: est. total burglary ≈ reported×1.08 etc.).
2. `unlitLayout(provider, rates, type, yi)` in capeTown.js: per station, U dots at station jitter
   (own rng seed), density flat-dim; plus roost positions for the condense/disperse morph.
3. wcExplore: `unlitField` pool + toggle + morphs + year-scrub hook (U layout follows `yi`),
   legend chip element, tooltip extension, guards, hint, About paragraph.
4. Excluded-crime path (murder/commercial): toggle → quiet inline note, no dots.

## Verification
- Rates audit table printed and eyeballed against the publications (Phase 0 gate).
- Spot math: hover numbers = R and round(R×(1−r)/r) to the digit, 5 stations.
- Visual role test: screenshot with all three roles present — a stranger must be able to point at
  data / structure / estimate without a legend (then the legend confirms). Maker's eye required.
- Sexoff floor-caveat visible whenever sexoff+U active.

## Effort: project (research day + 2–3 build sessions). Merge notes: LAST to merge (largest surface:
new pool, tooltip, About card — rebase over the other three). capeTown.js + wcExplore additive
sections; index.html chip + legend element; no engine edits.
