# Crime Data-Viz — project conventions
> Auto-loads each session. Standing rules. One-time setup in PROJECT-KICKOFF.md; the *why* in
> docs/CONTINUITY.md. Working title — name TBD.
> Origin: graduated from ~/Documents/_Ideas/crime-dataviz-cape-town.md (2026-06-30) — the deep source.

## What this is
**Crime data as ONE living field of points** — the data glows, the structure greys — so it becomes
something you actually *want* to look at. *"Pretty data, not a spreadsheet."* Cape Town first; a **reusable
WebGL engine** that works for any city's crime data after. A **personal, for-the-joy-of-it portfolio craft
piece** (web) — built for the maker's own pleasure. **Treat it as PLAY, not a product** (no need for
finished / comprehensive / maintained; it grows by curiosity).

**North star (the only success test):** *"Is this more interesting and enjoyable to look at than a SAPS
stat sheet?"*

## How we work here
- **Plan before building** — propose the approach; the maker confirms before deep work. Stay in planning
  mode until told to go.
- **The EYE is the judge.** This is a *feel* product — it must be genuinely *beautiful*, not just correct.
  **Render-and-look at every step**; "it runs" ≠ "it's gorgeous."
- **Prove the FEEL on FAKE data first.** The whole project risk is aesthetic (does the morphing starfield
  feel beautiful?). Build the engine spike on throwaway data before touching the real data pipeline.
- Read ~/.claude/FOUNDATIONS.md on demand when a cross-cutting concern surfaces; never edit it.

## Foundations (binding once set)
- **One substance: a luminous POINT-FIELD; everything is points** (data AND structure/geography). The map,
  heatmap, timeline, elevation are all just *clusterings* of the same field.
- **The engine is the design object — instruments are DEFERRED + emergent.** The engine ONLY interpolates
  `(x,y)` + brightness targets; it knows nothing about crime or maps. **Every layout (incl. the map) is a
  pure function `(features → x, y, brightness)` computed upstream.** A new view = a new function. Build
  *"points that can become any arrangement,"* never a hardcoded map-viewer/chart-maker.
- **Two roles, two looks (the visual language):** DATA points = coloured-by-local-**density** + **GLOWING**
  (pop; conserved + faithful) · STRUCTURE points = **GREY, matte, NO glow** (recede; geography/scale, never
  crime). **Glow = the primary channel** (glow = data always, no-glow = frame always). A structure point
  must never masquerade as data.
- **Density = light** (the heatmap *emerges* from the swarm). Per-point neighbour-density → colour ramp
  (cool/dim → warm/bright), interpolated on the GPU.
- **Performance = GPU interpolation** (each point stores source+target; one `t` uniform in the vertex
  shader; CPU idle) → 100k–1M+ points. Count is never the constraint; legibility is.
- **Honesty = FIDELITY, not restraint-on-beauty.** Beauty is the project. Guard only that *it's the same
  story the numbers tell.* **Per-capita is load-bearing** (raw counts just redden poor areas). **Volume is
  real, micro-position is jittered** within precincts (no false street-level precision). Counterweights
  (per-capita · history overlay · the reported-vs-experienced-vs-died discrepancy) are how the *fuller*
  reading stays available — *show, don't tell.*
- **Data delivery = static.** Download sources → process → **bake a static asset** the page loads. **No
  backend, no runtime API.** Can ship as a static website.
- **Visual language = semantic tokens** (role not value; glow/colour/size carry meaning). Binding once set.

## Handoff docs (keep live, update at breakpoints)
- docs/BUILD-PLAN.md (the what) · docs/CONTINUITY.md (the why + re-anchor) · docs/IDEAS-BACKLOG.md
  (raised-but-not-agreed). Full origin thinking: the idea note (link above).

## Principle harvest (definition-of-done)
- At the end of any work packet, if a universal lesson arose, append ONE sharp line to
  docs/CONTINUITY.md `## Principle candidates`. Filter: universal + sharp + behaviour-changing → candidate;
  project/tool detail → keep local; unsure → flag (?). Append only; NEVER edit ~/.claude/CLAUDE.md or
  FOUNDATIONS.md, never harvest — a separate steward session does that.
