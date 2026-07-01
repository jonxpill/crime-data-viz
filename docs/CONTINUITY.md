# Crime Data-Viz — Continuity & decisions (the *why*)
> Mental model + decision rationale, so a cold session resumes from docs and doesn't re-argue settled calls.
> Update at breakpoints. Full origin thinking: `~/Documents/_Ideas/crime-dataviz-cape-town.md`.

## Re-anchor (play this back before acting)
Crime data shown as **one living field of points** — the data glows in colour-by-density, the structure
(coast, mountain, axes) recedes to grey — so it's something you actually *want* to look at instead of a
stat sheet. It's **"Loom for data": an ensemble of views on a reusable engine**, where every view (map,
timeline, elevation) is just a different *clustering* of the same point-field, and you **morph** between
them. **The engine is the design object; specific instruments are deferred.** It's a **personal craft piece,
for the maker's own pleasure — play, not a product.** Honesty discipline: *it's the same story the numbers
tell, just told beautifully.* On resuming: read this + BUILD-PLAN + the idea note, play back understanding,
and remember the eye is the judge — render and look.

## The mental model (why this exists)
The maker lives in South Africa, is genuinely curious about crime, and wants to **enjoy looking at the
data** — to make it more interesting than a SAPS/government stat sheet. **For himself first** (same footing
as the mountain app being "for a friend"). The gap it fills: crime data lives in fear-maps (tabloid panic)
or dead spreadsheets — nobody shows it with genuine craft. Built like Loom — beauty grounded in a
deterministic/mathematical core.

## Settled decisions (do not re-litigate without reason)
1. **Purpose = a portfolio-grade craft piece WITH a point of view.** Not a maintained analytical tool (a
   commitment not wanted); not a pure neutral aesthetic (hollow with this subject). "Explore it yourself" is
   a light bonus, never a product. **Treat as PLAY** — grows by curiosity, needn't be finished/maintained.
2. **POV = the DATA gives the point of view — "you read it and take what you will."** An *invitation to
   read*, never a thesis pushed at you. **Low-floor/high-ceiling for *meaning*:** the surface read ("this
   area's dangerous") is complete + honest alone; deeper reads (spatial/structural apartheid, policing
   geography, the govt-vs-NGO data gap, history) are *available* for whoever reaches. **Generous, never
   didactic.**
3. **Beauty is the project, not a risk** (an earlier "dignity" caution was over-flagged). Beauty is how hard
   subjects get attention + dignity; a cold spreadsheet is the *less* respectful object. The only thing to
   guard is **HONESTY = FIDELITY** — *the same story the numbers tell.* Test: "is it still the same story?"
4. **The honest responsibility:** no presentation is neutral, and the DEFAULT reading of a crime map is the
   shallow/harmful one. So "let the data speak" only works if you **deliberately build the counterweights**
   so the fuller reading is available: **per-capita** (load-bearing), an optional **history/apartheid-
   boundary overlay**, the **SAPS-vs-NGO discrepancy**, **facts not arguments**. *Show, don't tell* — the
   heaviest reading becomes safe + more powerful by *not* asserting it (recognition, not accusation).
5. **Concept = "Loom for data" as an ENSEMBLE on a reusable engine** (instruments DEFERRED/emergent — a new
   view is what the data invites, not a pre-planned catalogue). Thesis = *"pretty data, not a spreadsheet."*
6. **Engine = one luminous POINT-FIELD; EVERYTHING is points** (data + structure/geography). The engine ONLY
   interpolates `(x,y)`+brightness targets; **every layout (incl. the map/elevation) = a pure function
   `(features→x,y,brightness)` computed upstream**; a new view = a new function. *"Points that can become
   any arrangement,"* not a hardcoded map-viewer.
7. **Visual language = DATA (glowing, coloured by local density) vs STRUCTURE (grey, matte, no glow).** Glow
   = the primary channel (glow=data always, no-glow=frame always). **Density = light** (the heatmap emerges
   from the swarm). A structure point never masquerades as data.
8. **Performance = GPU interpolation** (source+target per point, one `t` uniform) → 100k–1M+ points; count
   never the constraint. Star count = a dial (crimes-per-star); scale 1→millions.
9. **Data = static.** Download → process → **bake a static asset**; no backend/runtime API; can be a static
   site. Crime stats are annual batch releases (nothing to live-pull); the project is historical.
10. **Build = prove the FEEL first** (engine spike on fake data) → real-data morph = the prototype → light
    interactivity → grow by curiosity. **The eye is the judge.** Stack = Vite + three.js + (later) Python/
    d3-geo pipeline.

## Data foundations (settle in the pipeline)
- **Per-capita is load-bearing** (join population → police precincts = a spatial join; the one real prep
  step). **Volume real, micro-position jittered** within precincts (no false street precision).
- Sources verified: DataFirst SAPS 2008–23 (station-level + GIS, ~16 yrs) + VOCS (experienced) + SAMRC
  (died) + ISS + OpenUp. The **reported-vs-experienced-vs-died discrepancy = a built-in POV** (a future
  instrument). Honest limits: gaps pre-2021 some stations; category/boundary breaks over 16 yrs; no
  time-of-day in SAPS.

## Open / to decide later (see IDEAS-BACKLOG)
The pipeline specifics · the interaction paradigm (guided-flow vs free-explore) · the first real layout pair ·
specific instruments (deferred) · where it lives / distribution · a name.

## Principle candidates
> Append ONE sharp line when a *universal* lesson surfaces during building (universal + sharp + behaviour-
> changing). Append only — the steward promotes. Do NOT edit ~/.claude canon.

- *(context, already canon — not new candidates)* the **Loom pattern** — *a continuous interactive world
  grounded in a deterministic/mathematical core, beauty emerging from structure* (recurring across Loom / 2B
  / this — possibly worth a sharper canonical line if it recurs again); "grounded expert / deterministic
  engine + presentation layer"; low-floor/high-ceiling (here applied to *meaning*).
- **Atmospheric glow should EMERGE from the data, not be painted as a static layer.** A hand-placed
  nebula/halo sprite floats free the moment the field moves (empty-centre smudge); deriving it from bloom
  over the actual bright cores makes it follow the data for free. *(Generative/data-viz; the "single source
  → many projections" door applied to light.)* (?)
- **Tune additive+bloom from too-DIM upward, never from too-bright down.** Blown-out white hides the data
  and collapses the colour ramp; start under-exposed and add light until the gradient just sings — the
  gradient is the read, not the brightness. (?)
- **Build on real STRUCTURE even when the VALUES are placeholder.** Splitting "geography (real, fetchable)"
  from "measurements (walled)" let the whole prototype stand on real Cape Town shapes with simulated counts
  — and the real-data swap touches only the numbers, nothing downstream. Foundation/identity first, values
  later. (?)
- **A morph reads as alive only if each point keeps a stable identity across frames.** Fixed buffer slots +
  "park surplus at the centroid and grow back" makes the year-scrub breathe in place; re-deriving the point
  set per frame would reshuffle and read as noise. The smoothness is in the *correspondence*, not the tween. (?)
- **Normalise across the whole comparison set, not per-frame — or you erase the change you're animating.**
  Per-year density normalisation re-inflated every year to look equally "full", flattening the temporal
  signal the year-scrub exists to show; one global max across all years made growth/redistribution visible.
  (Generalises: any per-frame auto-scale — colour, axis, gain — hides the cross-frame trend.) (?)
- **Idle/ambient motion is FELT through SPEED, not amplitude — split the two levers.** Adding "life" by
  raising how FAR a point strays makes it read as *wandering off*; raising how FAST it orbits (same tiny
  radius) reads as alive-but-anchored. Expose speed and amplitude as independent controls. (?)
- **Surplus points should roost OFF-SCREEN and fly back, not blink on at a centroid.** Give each parked
  slot a fixed off-frame home + per-dot staggered timing, and every density change becomes a swarm
  gathering/dispersing — the "one living field" reads as alive. Honesty holds: at rest the count is exact;
  only the *arrival/departure* is animated, never the resting volume. (?)
- **A different pairing, not a different mechanic, makes a morph show "move" vs "grow" vs "shrink."** One
  shared buffer + per-crime layouts: robbery↔burglary moves (different geography), robbery↔murder shrinks
  (same geography, rarer). The engine stayed dumb; the *data pair* supplied the story. (?)
- *(tooling traps, kept local — not universal):* d3-geo `fitExtent` to ArcGIS polygons fails (clockwise
  winding → global bounds → microscopic scale); fit to vertices-as-points. `import.meta.url` URL-encodes
  spaces in paths. Calling both `THREE.Clock.getElapsedTime()` and `getDelta()` per frame zeroes the delta
  (each resets `oldTime`) → an fps meter silently never ticks; measure off one time source.
