# Polish brainstorm — 2026-09-28 (30 ideas from a full eye pass)

> Raised, not agreed. Maker's brief: "little graphical tweaks that make things cooler / more interesting —
> per area (the map) or the whole piece (how scenes shift, a better UI) — anything goes." Viewing: laptop/
> desktop first; touch matters (iPad, large phone); an ambient big-screen option would be cool.
> Method: every surface opened and looked at (1440×860, 768×1024, 375×812) — main explorer, the Toll in the
> explorer + all five standalone Toll pages, and the six experiment branches. Duplicates of the 2026-07-10
> 126-idea brainstorm are marked **[existing: name]** rather than re-proposed.
> Sizes: **tweak** (hours) · **weekend** · **project**. ⭐ = top picks.

## What the eye pass found (the evidence behind the ideas)
- **Everything is framed too small.** Camera is framed once to a union box and never moves → Cape Town lands
  at ~¼ of the width, the pie ~⅕, terrain a slab in the middle. Scroll-zoomed, Cape Town is the best frame
  in the whole app (molten clusters on the precinct lace, the dark bay below) — the default hides it.
- **One motion for every change.** Map→pie, crime flip, year scrub, drill all share straight-line swarms with
  random per-dot stagger. The drill's mid-flight comet is the most beautiful moment in the app — proof that
  motion character pays.
- **3D views hide their payoff from the default angle.** Terrain reads as a tilted slab with hard straight
  raster edges; Canyon's height (and the 2020 notch) is invisible from near-overhead, and a bigger Z smears.
- **The opening is a map with one glow.** Province outline + one orange flare at Cape Town; everything else
  near-black. (feat/flock's attract state already fixes the first ten seconds.)
- **Structure has no hierarchy.** District borders, precinct lace and coast share one weight → busy grey lace.
- **Per-capita barely changes the province picture** — the load-bearing honesty toggle doesn't land visually
  at that scale.
- **Touch is a keyboard design on glass.** Phone: the HUD panel covers the bottom third; chips carry key
  letters; fps counter shows.
- **Engine facts that price ideas:** no dithering anywhere (bloom halos can band); stagger is random but
  ORDERED seeds already exist (setSeeds, from the Toll/Reading); paths are straight lerps; structure brightness
  rides density (0.32 + 4.5·d) so hierarchy needs no engine change; textLayout now takes `fontWorld`.

## ⭐ Top picks
1. **The Frame** — one framing door: every layout composes into a shared safe frame (~80% of the viewport,
   HUD-aware). Camera stays still (the settled principle holds); the LAYOUT scales. Fixes small Cape Town,
   small pies, the terrain slab, the suburb speck, triptych clipping on narrow screens, phone framing.
   Scale isn't data, so it's honest. *weekend · foundation*
2. **Each change gets its own motion** — path modes in the engine (one uniform + a shader branch): straight
   (today), ARC (crime flip — the field changes pasture like birds), SWIRL/polar (map→pie winds into the
   disc), COMET (drill, today). Plus stagger WITH MEANING via existing ordered seeds: a drill sweeps out from
   the clicked place, a crime flip moves the hottest precincts first. Endpoints stay true. *weekend+*
3. **Exhibit mode** (the ambient option) — builds on **[existing: The Long Look]** + **[existing: Docent
   Tours]** + flock's attract. A director loops the existing scenes: flock → land on the province → drill to
   Cape Town → six pies → the Toll pours → release back to the flock. Chapter titles spelled in grey dots that
   dissolve into the next scene. Enter via a URL/key or after long idle. Needs #5. *project*
4. **Structure hierarchy** — three weights via density only: coastline brightest (the most "Cape" line),
   district borders medium, precinct lace faint. *tweak*
5. **Compare pies: linked hover** — hover a wedge, the same precinct lights in all six pies. The six-pie grid
   is already the most legible screen; this makes it a cross-reading instrument. *weekend*
6. **Toll rings that survive settling** — a hairline radial gap between years (position only, no brightness
   trick) so settled discs read as tree rings, not a smooth gradient with a white core. *tweak*
7. **Canyon as ridgelines** — each precinct's 18-year rate as a line of dense dots, low raking camera, a dark
   matte "curtain" under each ridge so front ridges occlude back ones. The 2020 lockdown notch cuts every
   ridge. Rescues the Canyon's height. *weekend+*
8. **Suburb that arrives** — after focusing, frame the precinct (via #1) so you actually stand in it: beacon,
   resident dots and caption at readable scale. Today the view stays on the province. *tweak (after #1)*
9. **Touch grammar** — swipe ←→ year, ↑↓ crime, pinch zoom, tap drill, two-finger tap = back out,
   long-press = hold (the Toll). Coarse pointers: drop key glyphs, hide fps, one-row dock + a "more" sheet.
   *weekend*

## Whole piece
- **Every state has an address** — URL hash (`#ct/robbery/2020/pie`): share a moment; the exhibit script is
  a list of addresses; browser Back = "go back out". *weekend · foundation for #3*
- **Dotted type as the piece's voice** — extend the Toll's dotted names: district names condense from the
  lace on HOVER (not always-on — minimal-labels rule), a crime's name spells briefly in grey on a flip,
  faint event words at their year (LOCKDOWN over 2020/21, UNAUDITED on 2025/26). Structure role only. *weekend*
- **[existing: Comet Scrub]** — motion streaks on fast dots (velocity-oriented elongated sprites). The drill
  confirms it would sing. *weekend*
- **Parallax** — ±2° sway following the pointer; gyroscope on iPad; slow orbit in exhibit mode. ⚠ tension
  with the "camera dead still" principle — a sway is not a move, but it's the maker's call. *tweak*
- **Dither** — no dithering exists; one line in the output pass kills banding in the big orange halos on
  8-bit screens. Invisible when right. *tweak*
- **Snapshot** — `S` → PNG with a typeset caption (place · crime · year · source) for portfolio stills. *tweak*

## Explorer / map
- **Hover lights the precinct** — its outline brightens in structure dots (spatial feedback, not only a
  tooltip); pairs with dotted hover-names. *tweak*
- **Per-capita that lands** — at province scale the in-place flip barely reads. Either **[existing: Double
  Exposure]** (freeze at t = 0.5) or a raw | rate diptych using the triptych's N-column grammar (lean). *weekend*
- **Terrain that reads** — raking default tilt, hillshade from a fixed sun, feather the DEM's straight raster
  edges to the coastline, slow orbit when idle. *weekend*
- **Year ribbon** — 18 grey dot ticks along the bottom edge, current year brighter, draggable → also THE touch
  scrubber. *weekend*
- **Pulse clock** — a 12-month ring in grey dots with the current month lit; a monthly map is sparse as a still
  and needs an anchor. *tweak*
- **Drill breadcrumb** — "Western Cape › Cape Town", clickable. *tweak*

## The Toll
- **Triptych defaults to 'area'** — the only mode where the picture tells the right ratio (same = hides it,
  radius = exaggerates area). *tweak*
- **Triptych orrery** — per-dot spin centre so all three discs turn (deferred today: one uSpinCentre). *weekend*
- **Per-capita flip** for the triptych — known, the backlog's "payoff". *weekend*
- **The Toll as the exhibit finale** — the natural last chapter of #3.

## Branch keepers
- **Unlit as hollow lights** — estimated-unreported dots as rings (hollow sprites): "a light that isn't
  there". Violet flat dots vanish at province scale by design; a hollow shape reads as absence at any scale.
  Role by shape, not glow — honest. *tweak*
- **Forensics** — the transition is more striking than the settled strip, which read faint at desktop size.
  Give ribbons presence at rest (width/brightness, a slow scan line that reads each ribbon's name) — or cut.
  Wording gate still pending. *verdict needed*
- **Flock everywhere** — idle→release currently province-only; release from ANY scene and land back into it.
  The heart of exhibit mode. *weekend*

## Look
- **Depth of field on 3D views** (terrain, canyon ridgelines) — size + alpha by distance from a focus plane →
  a macro photograph of a model. *weekend*
- **Crime hue families** — violent vs property on different ramps, density still = brightness. A change to a
  binding token system → discuss before anything. *discuss*

## Verdicts
(pending — maker to mark keep / maybe / drop)

---

## Round 2 — after the free camera + the HUD made of light (2026-09-28, second eye pass)
Four passes over `polish/doors` at 1440×860: scenes at rest · the camera (tilted/close views the free camera
opened) · transitions mid-flight · palettes against the new HUD.

**What the passes found**
- The free camera's tilted close-ups are the best frames in the project (Cape Town's peninsula relief with the
  Cape Flats burning) — but three things break the illusion: foreground dots balloon (perspective size) and
  spill over the dock; far land is as bright as near (no depth); the relief is one flat grey (no light).
- Charts (pie, compare, forensics) are flat plates when tilted — the camera has nothing to reveal in them.
- Sparse districts (Garden Route) read as empty lace with three tiny clusters.
- The canyon still reads flat even tilted (one glowing ridge at the far edge; the grid dominates).
- Crime-flip surplus sprays sideways to arbitrary roosts; the drill + map→pie comets are the best motion.
- The palette candidates soften the molten punch of the dense cores vs today's amber.
- Bug: a resize mid-glide leaves stale framing (the door only re-fits when exactly at home).

**Ideas** (⭐ = top picks)
1. ⭐ **Every view gets a height, revealed by tilting** — top-down unchanged; tilt and the data rises: pie/compare
   wedges lift by count (a crown of spires; six crowns on a table), the flat map's crime lifts by local density
   ("light rising off a flat land" — the grey land stays flat so it can't be mistaken for terrain), the Toll's
   years stack into an 18-layer cairn (oldest at the base). Same number, second channel — honest.
2. ⭐ **Aerial perspective** — distance haze (far dots fade toward the background) + a near-plane fade (dots
   closer than a threshold dissolve instead of ballooning over the HUD). One shader term each.
3. ⭐ **Hillshade + feathered edges on terrain** (E6, confirmed urgent by the tilted views): a fixed low sun so
   Table Mountain and the Outeniqua ridges carry light; land dissolves at the raster box instead of cutting.
4. **Land texture in quiet places** — a faint relief ghost (structure grey) under the map in sparse districts,
   so the land isn't empty where crime is rare.
5. **The canyon as a range** — K1 ridgelines + rows ordered by rate so the surface climbs to the horizon (row
   order is a grouping, not geography — honest), seen from a low side angle by default.
6. ⭐ **Surplus goes to the sky** — roosts above the frame: leaving dots rise like sparks, arriving dots rain in.
   Purposeful instead of a sideways spray; one change to the roost positions.
7. **The Toll can be turned** — right-drag rotates in the Toll (the dial keeps left-drag), paired with the cairn.
8. **The ribbon breathes** — during play, the arriving year's column flares briefly (a heartbeat on the time bar).
9. **A stronger map icon** — the province as its density heat, not a sparse outline.
10. **Palette punch** — whichever candidate is chosen, lift the contact family's warm-stop chroma so dense cores
    stay molten (or keep today's amber for contact — the open question).
11. **Idle drift** — in cinema mode the camera orbits almost imperceptibly (an exhibit-mode ingredient).
12. Fix: re-fit when a resize lands mid-glide.
