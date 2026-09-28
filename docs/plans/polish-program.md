# Plan — The Polish Program (all 30 ideas + a controllable camera + a richer palette)

> **GO given by the maker 2026-09-28:** "go for it with all of them" (every idea in
> [brainstorms/2026-09-28-polish-brainstorm.md](../brainstorms/2026-09-28-polish-brainstorm.md)), plus:
> the camera must become **controllable** (zoom in/out, rotate, pan); exhibit mode = planner's call; open to
> **more colours**, used as both data colours and structure colours.
> Self-contained: a cold session reads this + the brainstorm + CLAUDE.md/CONTINUITY and can take any packet.
> The EYE is the judge — every packet ends with a render-and-look by the planning session, not "it builds".

## Decisions taken with the GO (the why, so it isn't re-argued)
1. **Merge the keepers first (Wave 0).** Most ideas land on canyon/unlit/flock/suburb/the Toll; building on
   old forks would multiply conflicts. Trial merges (git merge-tree, 2026-09-28): `feat/standalone-shell`
   clean; canyon/forensics conflict only in `index.html`; unlit/flock/suburb in `index.html` +
   `src/wcExplore.js` — the chip-line/keydown surfaces their plans kept small on purpose.
   - **Forensics stays at its wording gate** (its plan makes wording review a merge gate): merge after the
     maker signs off the zone labels + tooltip caveat. **Reading stays parked** (the Toll's hold gesture
     carries its soul). Ember + loom stay parked.
2. **Cross-cutting concerns become DOORS — shared modules, not more monolith.** After Wave 0 the explorer
   is ~3,500 lines; the standalone shell (`src/stage.js`, `src/hud.js`) needs the same camera/palette/address
   behaviour. Each concern gets ONE module both the explorer and the shell import. (A full port of the
   explorer onto the shell's view registry is NOT part of this program — revisit only if the doors prove it.)
3. **The camera goes free; scenes re-home it.** Replaces the settled "camera dead still" principle. You can
   orbit, pan and zoom anywhere; a scene change (region drill, map⇄pie⇄compare⇄terrain⇄canyon⇄toll) GLIDES
   the camera to that scene's HOME framing in step with the dot transition; data changes inside a scene
   (year, crime, per-capita) leave your camera alone. A ⌂ home chip/key returns to the framing. The home
   framings ARE brainstorm idea "The Frame" — every scene composes into one HUD-aware safe frame.
4. **Canvas gestures belong to the camera; data navigation belongs to the dock.** Touch uses map
   conventions (one finger pans, pinch zooms, two-finger twist rotates, two-finger drag tilts). Year/crime
   move to the dock + the draggable year ribbon. *This replaces the brainstorm's "swipe for year/crime"*,
   which would fight the camera.
5. **Pointer parallax is dropped** — superseded by the free camera + exhibit mode's slow orbit.
6. **Palette = role tokens, chosen by eye.** Data ramps by SAPS's own crime families (contact: murder,
   sexual offences, robbery, carjacking · property: burglary · commercial: commercial crime); density still
   = brightness within every ramp. Structure gets roles (coast, district border, precinct lace, frame/
   graticule, words, residents, beacon, unlit-estimate) instead of one grey. Candidates are rendered side
   by side; the maker picks.
7. **Exhibit mode = both doors:** a `?exhibit` address for a big screen (no chrome, slow orbit, chapter
   titles in dots) AND an idle drift (after N minutes any scene releases into the flock and the tour takes
   over; any input hands control back).

## The doors (Wave 1) — contracts
| Door | Module | Owns | Consumers |
|---|---|---|---|
| **Camera** | `src/camera.js` | OrbitControls config (rotate/pan/zoom, desktop + touch map conventions), limits (distance, polar clamp so you can't go under the map), `home(box, {dur})` glide, per-scene home registry, ⌂ | explorer, shell (`stage.frameTo` delegates), exhibit |
| **Palette** | `src/palette.js` | role tokens → PointField uniforms (`uRamp*`, `uMatte`) + CSS vars for HUD type; crime→family map; candidate sets for the eye pass | every pool, HUD |
| **Address** | `src/address.js` | `#region/crime/year/view[/mode]` ⇄ state; history (Back = go back out); parse/serialise only — views apply | explorer, exhibit script |
| **Motion** | `src/engine/PointField.js` (+ `src/motion.js` helpers) | path modes (straight · arc · swirl) via one uniform + per-dot arc offset; ordered-stagger helpers (sweep-from-point, by-value, by-axis) on top of existing `setSeeds`; comet streaks (velocity-oriented sprite during transitions, zero at rest); dither in the output pass | every transition |
| **Input + dock** | `src/input.js` + HUD | ONE keymap table (keys → intents); coarse-pointer dock (one row + "more" sheet, no key glyphs); fps only with `?debug`; the year ribbon (18 grey dot ticks, draggable); breadcrumb | explorer, shell |

## Packets
Sizes: S (hours) · M (a day) · L (multi-day). Tier = the agent model for execution (planner does the eye).

### Wave 0 — Consolidate (branch `integrate/keepers` → PR → main)
> **Status 2026-09-28:** W0.1–W0.5 DONE on `integrate/keepers` (each merge browser-verified + a core
> regression pass: drill, pie, compare, terrain, pulse, the five Toll pages). Cross-guards added so the five
> modes (toll · canyon · unlit · flock · suburb · forensics) refuse/exit each other cleanly. W0.6 DONE —
> wording approved as-is by the maker. PR → main approved by the maker.
- **W0.1** merge `feat/standalone-shell` (clean; brings the Toll in the explorer + the five Toll pages + dotted names).
- **W0.2** canyon · **W0.3** unlit · **W0.4** flock (its attract state becomes the opening) · **W0.5** suburb.
- **W0.6** forensics — only after the maker's wording sign-off.
- Verify each merge by its tour-script shot list (`tour-script` facts are banked in the brainstorm's evidence
  section) + a regression pass: drill, pie, compare, terrain, pulse, toll. Chip row will be long until D5.

### Wave 1 — Doors (branch `polish/doors`)
- **D1 Camera** L · opus — includes The Frame (home framings) + the triptych narrow-window fix. *Checkpoint: maker feels it.*
- **D2 Palette** M · sonnet build, planner eye — 2–3 candidate sets rendered side by side. *Checkpoint: maker picks.*
- **D3 Address** M · sonnet.
- **D4 Motion** L · opus — path modes, meaningful stagger, comet streaks (= [existing: Comet Scrub]), dither.
- **D5 Input + dock** M · sonnet — incl. year ribbon + breadcrumb; absorbs the Wave-0 chips into groups.
- Order: D1 + D2 first (they change the look everything else is judged against); D3/D4/D5 in parallel lanes.

### Wave 2 — Explorer polish (branch `polish/explorer`)
- **E1** structure hierarchy (coast / district / lace weights, palette structure roles) S
- **E2** hover lights the precinct outline S
- **E3** dotted words: hover district names, crime-flip title, event words (LOCKDOWN 2020/21, UNAUDITED 2025/26) M
- **E4** compare pies: linked hover across all six M
- **E5** per-capita that lands: raw | rate diptych on the N-column grammar M
- **E6** terrain reads: fixed-sun hillshade, feathered raster edges, raking home view, depth of field M
- **E7** pulse clock (12-month ring, current month lit) S
- **E8** snapshot → PNG with typeset caption (key TBD — `S` is taken in the diptych) S

### Wave 3 — Keepers polish (branch `polish/keepers`)
- **K1** canyon as ridgelines (dense-dot lines, matte curtain occlusion, raking home, DOF) L · opus
- **K2** unlit as hollow rings (sprite mode) S
- **K3** suburb arrives (camera home to the precinct) S — needs D1
- **K4** forensics presence at rest (after W0.6) M
- **K5** flock everywhere (release/land from any scene) M
- **K6** Toll: ring gaps · triptych default 'area' · per-dot spin centres (N-disc orrery) · per-capita flip M–L

### Wave 4 — Exhibit (branch `polish/exhibit`)
- **X1** the director: a script of addresses (flock → province → drill Cape Town → six pies → the Toll →
  release), `?exhibit` + idle drift, chapter titles in dots, slow orbit, Toll as finale. L · opus

## Execution rules
- **Flat delegation:** each packet = a self-contained brief (goal, files, acceptance, what NOT to touch) to
  ONE agent with an explicit `model`; agents never spawn sub-agents. Parallel lanes get separate worktrees;
  merge lanes sequentially. The planner reads every report critically and does the render-and-look.
- **Acceptance = the eye:** screenshots at 1440×860, 768×1024, 375×812 for anything visible; engine packets
  also keep 60 fps with the full field.
- **Honesty guards:** density = brightness in every palette; structure never glows; motion is transitional
  (endpoints true); words are structure-role only.
- **Git:** each wave on its branch → PR → merge to main; `git status`/branch checked every commit; deploy to
  gh-pages only on the maker's call.
- **Docs:** update BUILD-PLAN + CONTINUITY at each wave's end; one principle candidate per packet if earned.

## Maker checkpoints
1. Forensics wording (merge gate) — any time.
2. D1 camera feel (glide timing, limits, does the drill glide?).
3. D2 palette pick.
4. Per-packet keep/tune after each Wave 2/3 lane.
5. Exhibit script + pacing.
