# Project kickoff — Crime Data-Viz
*Run once, first session. Crime data in Cape Town shown as ONE living field of points — the data glows, the
structure greys — so it's something you actually want to look at. "Pretty data, not a spreadsheet." A
personal, for-the-joy-of-it web/WebGL craft piece. Treat it as PLAY.*

**Source:** graduated from `~/Documents/_Ideas/crime-dataviz-cape-town.md` — **read it first, in full.** It
holds the complete thinking (the why, purpose/POV, the engine + visual language, the data sources + delivery,
the staged build path, and reference mocks). Standing rules auto-loaded from `./CLAUDE.md`.

## Before any code
1. **Read `~/.claude/FOUNDATIONS.md`** (pillars A + B) + the idea note.
2. **Confirm the foundations (they're decided — play them back, don't re-derive):**
   - the substance = one **point-field**; **everything is points** (data + structure);
   - the engine = *"points that can become any arrangement"* — it ONLY interpolates `(x,y)`+brightness;
     **every layout (incl. the map) = a function `(features→x,y,brightness)` upstream**; a new view = a new
     function; **instruments are DEFERRED** (the engine is the design object);
   - the visual language = **DATA glowing + coloured-by-density · STRUCTURE grey/matte/no-glow** (glow =
     primary signal); **density = light** (heatmap emerges from the swarm);
   - honesty = **fidelity** (same story the numbers tell): **per-capita load-bearing**; volume real,
     micro-pos jittered (no false street precision);
   - delivery = **static baked asset, no backend.**
3. **Stack:** **Vite + three.js** (`Points` + a custom shader for glow + density-colour; regl/Pixi are alts;
   deck.gl fights the abstract morphs). Pipeline (later) = Python + pandas, **d3-geo** projection upstream.
   Optional: an **Observable notebook** to spike Stage 0–1 fast.
4. **Handoff trio** seeded in `docs/` — keep it live; don't recreate.
5. **Stay in planning mode.** Play back understanding — what this is, the engine purity rule, the visual
   language, and the Stage-0 spike scope — and confirm before building.

## The mission = the prototype, starting by proving ONE thing
The entire project risk is **aesthetic**: *does the morphing starfield actually feel beautiful?* So:

- **Stage 0 (do this FIRST) — engine spike on FAKE data.** ~50–100k tiny points of light on near-black.
  Nail: (1) the **starfield look** (tiny glowing points, soft bloom); (2) **ONE morph** between two dummy
  layouts (e.g. random blob ↔ ring), interpolated **on the GPU** (each point stores source+target; one `t`
  uniform slides the whole field in the vertex shader); (3) **colour = local density** (sparse cool/dim blue
  → dense warm/bright gold). **Make it genuinely gorgeous — if it's beautiful, the project works.** Days,
  not weeks; this is the only sink-risk.
- **Stage 1 (once Stage 0 looks great) — real data, one real morph = THE PROTOTYPE.** Minimal Python/d3-geo
  pipeline → static JSON (robberies per Cape Town precinct + population for per-capita + N jittered points
  per precinct). Wire the **map layout** + a **2008→2023 year scrub**. Judge vs the north star.
- **Stage 2+ (later, play):** per-capita toggle + year scrubber → then grow by curiosity (history overlay,
  the reported-vs-experienced-vs-died discrepancy, elevation terrain, more instruments). No spec.

**Visual spec (to recreate the look):** near-black bg; r≈1.5 points; soft glow (blur+merge) on data only;
density ramp cool `#8aa6dc` → mid `#cdd6ee` → warm `#ffce86`; grey structure `~#3e4a60` matte; warm radial
nebula behind dense cores.

**Start by reading the note + FOUNDATIONS, then show the plan for the Stage-0 spike. The eye is the judge —
render and look.**
