# Plan — Standalone Views on a Shared Shell  ·  branch `feat/standalone-shell`

> Extract **The Toll** onto a reusable **stage + HUD + view-registry** so it runs as its own page
> (`toll.html`), and so future views (the explorer's map, and the **three-province Toll triptych**) are
> *registered*, not rebuilt. `main` keeps `src/wcExplore.js` byte-for-byte — everything here is **additive
> files**. Designed + adversarially critiqued 2026-07-14 (workflow `wf_01c31977-997`); this doc is the
> critique-corrected version. Self-contained: read this + the referenced files; don't assume chat context.

## The one load-bearing invariant
The shared engine pools (`field` = glow/data, `structField` = matte/structure) are **stage-owned and
PERSIST across view swaps** — buffers are never wiped on exit. This is what lets the Toll `bakeFieldPose()`
the *live* on-screen pose the instant it mounts, and hand the field back invisibly on the way out. Every
other decision hangs off this.

Its sharp corollary (the critic's catch): **exit() must NEUTRALISE, not just "not wipe."** The Toll perturbs
shared state — ordered `aSeed`, `setSpinOn(true)`, `setStagger`, `structField.setSize`, the target/`uT`. On
exit it must restore ALL of them to the neutral pose the next view expects (today `beginTollHome` does:
seeds restored, spin off, stagger/size reset, target = resting map). Drop any one reset and the next view
silently inherits a spinning or mis-staggered pool. State the exit contract as: *return every shared-pool
uniform (seeds, spinOn, stagger, size, target, t) to neutral*; the incoming view's `enter()` must re-seat
without a visible jump.

## 1 — The view contract
A view is a factory `createXView(ctx) → view`. It owns one coherent on-screen state + its transitions, and
is the **sole per-frame writer of the shared pools while active** (single-writer discipline kills the
double-write bug class — the same class as the district phantom-dots bug).

```js
createTollView(ctx) => ({
  meta: { key:'toll', label:'The Toll', chipText:'K the toll' },
  enter(opts) {},   // mount: bake/seed pools, build owned pools, add listeners, drive HUD, attach live __viz readouts
  update(now, dt, elapsed) {}, // per-frame: run phase machine → field.setT + field.setTime(elapsed) → ctx.struct.tick(now)
  exit() {},        // HARD teardown: remove listeners, NEUTRALISE shared pools (see invariant), detach live __viz
  dispose() {},     // page teardown: release everything (incl. owned pools created once)
})
```

**Choreographed leaves are view-owned.** The Toll's exit is a ~3.4 s drain→home animation. `exit()` is a
*synchronous hard teardown*; the animated leave is internal — the Toll's own K/M/Esc handler flips
`phase='drain'`, `update()` runs drain→home across frames, and at home-complete the view calls
`ctx.setView(ctx.data.idleViewKey, { paused:true })` — which is what triggers its `exit()`. The registry
stays dumb; the ceremony stays in the view.

### `ctx` — what the shell passes each view
```js
ctx = {
  // stage handles (three). camera framed ONCE + static; fieldGroup stays at IDENTITY (unproject depends on it)
  THREE, scene, camera, controls, fieldGroup, renderer, dom /* = renderer.domElement */,
  frameTo(box), onResize(fn), BLOOM_LAYER,
  // engine pools — SHARED + PERSISTENT. Real instances (bake reaches raw .geometry/.material), not facades
  field, structField,
  struct,        // StructTransition on structField: startTo(layout,dur,stagger); tick(now); get progress; get current; rest()
  makePool(opts),// build+register an AUXILIARY pool (fieldGroup.add + pixelRatio + resize). MUST carry EVERY uniform
                 //   the caller needs (size, maxSize, matte, glow, drift, renderOrder, …) — else a dropped setMaxSize
                 //   silently fattens dots. wordField = makePool({count:22000,glow:false,size:1.4,maxSize:6,matte:'#3a4656',renderOrder:-2})
  playback,      // idle map driver: play()/pause()/get playing/get yi/seedPair(layouts,i)/currentPose()
  // data bundle — PAGE-DEFINED (no WC/district assumptions in the contract)
  data,          // { stations, box, years, yearLabels, COUNT, structN, outline, park, layouts, totals,
                 //   restingPose(), idleViewKey, has(feature) }
  // HUD — views drive SLOTS, never touch the DOM (see §2)
  hud,
  // registry + debug
  setView(key,opts), get previousViewKey, viz /* shared window.__viz to attach live readouts onto */,
}
```

**Why it holds (and doesn't leak):**
- `ctx.field` is the *real* `PointField` — `bakeFieldPose()` and `beginTollClock()` reach into
  `aSource/aTarget/aSourceDensity/aTargetDensity/aSeed` + `uT/uStagger`; the pool *is* the contract.
- The province-only guard (`region!=='wc'`) becomes `ctx.data.has('toll')` — a data assertion, not a global.
  All dial/word geometry derives from `ctx.data.box`. Nothing named `district`/`pie`/`terrain` in `ctx`.
- **Own what you used to borrow (critic):** the Toll's ported `pointerdown` must record its **own**
  `_downX/_downY` (today it borrows the explorer's *other* drill `pointerdown`); `_hv` scratch is view-owned.
- **Key routing (critic):** two independent `window` keydown listeners (HUD's `?`/Esc, the Toll's) both fire
  on Esc-with-About-open. Rule: **a view must guard its keys on `!ctx.hud.about.isOpen`** (About gets first
  dibs on Esc), OR the shell owns a keydown router with About→active-view precedence. Pick the guard for M1.
- **Live vs entry `__viz` (critic):** the ENTRY point (`setView('toll')`) lives on the **shell** (always
  present, so you can still enter from the console); only the live phase/count/word readouts attach in
  `enter()` and detach in `exit()`.

## 2 — The shell: `src/stage.js` + `src/hud.js`
Split so a headless/perf view can skip the HUD and the HUD stays unit-swappable.

**`src/stage.js`** constructs + owns (lifted verbatim from `wcExplore.js` L33–108, 404–413, 1563–1714):
- renderer (Neutral tonemap, **exposure 5.5**, pixelRatio ≤2), scene (`#05060a`), camera (Perspective 50°,
  framed once via `frameTo(box)`), controls (OrbitControls, rotate off), `fieldGroup` at **identity**.
- selective-bloom pipeline: `bloom` (Unreal **0.32 / 0.65 / 0.0**), bloomComposer, mixPass, finalComposer,
  OutputPass, the two-pass `render()`. `BLOOM_LAYER = 1`.
- **pool SIZE is a BOOT PARAMETER**, not a constant: `stage.boot({ count, structN, … })`. (This is what lets
  the triptych page boot ~3× pools — see §7.) `field = PointField(count,{glow:true,size:1.9})` (drift 0.5,
  driftSpeed 2.0, maxSize 7, `layers.enable(BLOOM_LAYER)`, `aZ` attr); `structField =
  PointField(structN,{glow:false,size:1.6,matte:'#566d78'})`. Auxiliary pools via `ctx.makePool` only.
- resize: composers + **every pool's pixelRatio incl. auxiliary pools** via the `onResize` registry (closes
  the pre-existing wordField pixelRatio gap — a benign "more correct than today", note it in the parity audit).
- **RAF loop:** `controls.update()` (damping — the stage owns it) → `active.update(now, dt, elapsed)` →
  `render()` → fps (`field.count` → "N fps · M pts"). Pass `elapsed` (THREE.Clock seconds) so `setTime`
  drift/shimmer phase matches. The stage writes **no pool** (single-writer rule).

**View registry:**
```js
stage.registerView(factory);  stage.setView(key, opts);  stage.boot({ count, structN, loadData, views, initial });
```
One active view; instances cached after first `enter`. `setView` = `prev.exit()` → `next.enter(opts)`.
`exit()` must NEUTRALISE (not wipe) the shared pools — the invisible handoff depends on it.

**`src/hud.js`** adopts the static chrome DOM by id + creates the dynamic primitives; views drive slots:
```js
hud.setCaption({region,lens,time,count})  hud.setHint(text)  hud.setCitation(text)   // #flag now CACHED (fixes L999 re-query)
hud.chips.setActions(map) / setDimRule(fn) / refresh()       hud.about.setBody(html)/open()/close()/get isOpen
hud.pinAwake(fn)   // cinema keep-awake carve-out; Toll registers () => active ("counter is the honesty channel")
hud.floatingCaption(variant|className) → { show(text,x,y), hide() }  // ONE primitive, but WITH a style channel:
    //   the tooltip is a BOXED data-chip; the ring-rollover is a BORDERLESS structure whisper (#8b98ac, letter-spaced,
    //   .25s). Do NOT collapse them to one look — pass the variant. For M1 just port the rollover's exact CSS.
```
Cinema idle-fade (`body.quiet`) lives here and honours registered `pinAwake` predicates.
**Deferred (critic — speculative, no M1 consumer): `hud.worldLabels()`** — build it with the map-view port.

## 3 — File layout (all NEW + additive; `main` untouched)
| File | Role |
|---|---|
| `src/stage.js` | three/bloom/render/resize/loop + pool construction (sized by boot param) + view registry + `ctx` (~260 ln) |
| `src/hud.js` | adopt-and-drive chrome API of §2 (~200 ln) |
| `src/engine/transition.js` | `StructTransition` — generic staggered struct-swarm from `startStructTransition` + L1661–1668 (~40 ln) |
| `src/playback.js` | shared year/month idle-loop driver from the L1645–1657 `playing` branch (~50 ln) |
| `src/data/wcProvince.js` | the data bundle loader — see the §4 BLOCKER (full six-crime build to size the pool; expose murder layouts) |
| `src/views/toll.js` | `createTollView(ctx)` — the whole ceremony (§5). Owns `wordField` (~260 ln) |
| `src/views/murderMap.js` | lean idle view: `ctx.playback` over murder layouts + K→toll (~60 ln). Proves the registry with a 2nd view |
| `toll.html` | standalone page; chrome markup copied from `index.html`, trimmed to the toll chip set |
| `src/tollMain.js` | entry: `stage.boot({ count, structN, loadData, views:[murderMap, toll], initial:'murderMap' })` |
**Changed:** `vite.config.js` — add `toll.html` to `rollupOptions.input` **only when `!single`** (see §4 BLOCKER).
**Imported, never copied:** `src/engine/PointField.js` (already exposes raw geometry + setSpin/setSeeds),
`src/layouts/capeTown.js` (`tollLayouts`/`tollFrameLayout`/`tollHandLayout`/`textLayout` — pure, shared).
**Not touched for M1:** `src/wcExplore.js` keeps its inline Toll (deleting it is the later §6 re-integration).

## 4 — The three BLOCKERS (baked-in fixes)
1. **Pool must be six-crime-sized, NOT murder-only.** `COUNT` in the explorer sums the *busiest year across
   all six crimes* per station; `tollLayouts` asserts `M > count → return null`, and `M` = the 18-year murder
   total (61,383). A murder-only pool would be *smaller* than M → null → **no ceremony**. `src/data/
   wcProvince.js` MUST run the **full six-crime province build** (identical to `providers.wc.raw` — reuse
   `buildCrimeLayouts` on all crimes) to size `COUNT`, then expose the **murder** `layouts`/`totals` for the
   resting map. `console.info` the M-vs-pool line like `tollLayouts` L528.
2. **Multi-page input breaks `build:single`.** `build:single` sets `inlineDynamicImports:true`, which Rollup
   rejects with multiple inputs; and `pipeline/build-single.mjs` grabs one arbitrary `assets/*.js`. So gate
   the extra input: `input` is index-only when `SINGLE==='1'`, index+toll otherwise. Keep `build:single`
   index-only; verify `npm run build:single` still emits one offline `index` html.
3. **Re-integration is NOT a drop-in.** §6 is re-scoped: the explorer ticks `struct` globally every frame
   (pies/drills/terrain need it), so an embedded `toll.update()` calling `ctx.struct.tick()` double-ticks →
   the dial runs 2× speed. Real re-integration = hand per-frame struct/field-write ownership to the active
   view (stop the global tick while a view is active) — a small **loop refactor**, not a ~50-line adapter.
   This does not affect the standalone; it just means "keep integration possible" costs a bit more later.

Other must-fixes folded into §1–§2: own the tap-exit down-point; Esc guards on `about.isOpen`;
`floatingCaption` keeps a style variant; `makePool` carries every uniform (wordField `maxSize:6`);
loop runs `controls.update()` + passes `elapsed`; live-vs-entry `__viz` split; **return-to-map stays FROZEN**
(the explorer leaves the map paused after the toll — `setView(idle,{paused:true})`, idle view adopts the
settled non-playing pose; do NOT auto-resume the year loop).

## 5 — The Toll's conformance (what's ctx-provided vs view-owned)
**ctx-provided:** `field`/`structField` (+ raw geom for bake); renderer/camera/controls/fieldGroup/`render()`
/bloom; the struct machine → `ctx.struct.*`; `stations/box/years/yearLabels/park/COUNT/structN` → `ctx.data`;
`playing/layouts[yi]/setYearPair/structRest` (exit re-anchor) → `ctx.playback` + `ctx.data.restingPose()` +
`ctx.struct.rest()`; HUD els/refreshHud/refreshChips/cinema/`#flag`/fps → `ctx.hud.*`; the four layout
builders → imports.
**View-owned (moves into `src/views/toll.js`):** all `toll*` state + `TOLL_*` consts; `tollGeom`,
`bakeFieldPose`, `tollCountAt`, `tollYearFrac`, `tollFracToT`, enter/`beginTollClock`/`bakeTollSpin`/
drain+home/`updateTollHud`/`updateTollHand`/`tollWorldAt`/`tollScrubTo`; **`wordField`** (built once via
`ctx.makePool`, kept across ceremonies, disposed at page teardown — NOT per-K, to avoid 22k-pt GC churn);
the **three pointer listeners** (added on `enter` against `ctx.dom`+`window`, **removed on `exit`** — today
they're permanent and leak) **plus its own down-point capture**; the orrery (`setSpin*`, pure engine).
`update()` upload order: phase machine → `field.setT` → `field.setTime(elapsed)` → `ctx.struct.tick(now)`.

## 6 — Re-integration recipe (later, off `main`) — re-scoped per BLOCKER 3
Write `explorerCtx` in `wcExplore.js` backed by its globals (field/struct-shim/playback-shim/data/hud-shims/
makePool/viz), instantiate `createTollView(explorerCtx)` once, delete the inline Toll block, route
K/tick/chip to it — **and refactor the loop so the active view owns the per-frame struct/field write** (stop
the global struct tick while a view is active). Verify explorer-K is pixel-identical, then merge to delete
~243 inline lines. The adapter is the durable artifact documenting exactly what a host must provide.

## 7 — View #2: the THREE-PROVINCE TOLL (must generalise — the maker's ask)
The contract generalises **because pool size is a boot parameter** (§2). The triptych is not a special hack:
- A `triptych.html` + `triptychMain.js` boots the stage with `count ≈ 3×` (sum of the three provinces'
  six-crime pool sizes) and `structN` for three outlines, and hands a `loadData` that returns THREE province
  bundles (WC baked; **KZN + Gauteng gated on the data pipeline** — SAPS is national, same source/granularity).
- `createTollTriptychView(ctx)` lays out three discs by calling the SAME `tollLayouts` per province, each
  offset to its column (a `cx` shift — `tollLayouts`/`tollFrameLayout` already take `cx,cy`), packed into
  contiguous slices of the shared pool (the conserved-slice mechanic the explorer already uses for districts).
- **Per-capita is load-bearing** (raw discs mostly draw population): a raw↔rate toggle (raw = human cost,
  rate = danger; the story likely flips — Gauteng volume vs WC rate). Both are `tollLayouts` inputs.
So M1's `createTollView` should keep its geometry **parameterised on `ctx.data.box` + a centre**, never a
page-global — then the triptych view is three instances' worth of the same math. No contract change needed;
this is the generalisation test the design passed.

## 8 — Staged build plan (each step ends in **build + render-and-look**)
**Milestone 1 = `toll.html` renders the Toll pixel-identical to today.**
- **S0 — Multi-page scaffold.** `toll.html` + gated `toll.html` input in `vite.config.js` (BLOCKER 2);
  `tollMain.js` boots a bare stage clearing to `#05060a`. *Look:* black page at `/toll.html`, no console
  errors; `npm run build` emits both HTMLs; `npm run build:single` still index-only.
- **S1 — Stage core + pipeline parity.** Extract renderer/camera/scene/bloom/`render()`/resize/loop into
  `src/stage.js`; render one static `structField` province outline. *Look:* grey outline, matte, no bloom
  on it; `__viz.bloom()`/`__viz.expo()` report 0.32/0.65/0.0 and 5.5; a glowing test pool blooms on layer 1.
- **S2 — Data bundle + resting map.** `src/data/wcProvince.js` (BLOCKER 1: full six-crime build sizes COUNT;
  murder layouts exposed); seed `field` at `restingPose()`, static. *Look:* the WC murder map at rest,
  glowing correctly; `console.info` shows `M ≤ COUNT`.
- **S3 — HUD adopt.** `src/hud.js` adopts `toll.html`'s brand/fps/.hud/about; drive caption/hint/citation/
  fps + cinema + about (?/Esc/backdrop). *Look:* chrome identical to the explorer; fps ticks.
- **S4 — `struct` + `playback` + `murderMap` view.** Extract `StructTransition` + the year-loop; `murderMap`
  as `initial` (respect the frozen-return rule). *Look:* murder map behaves like the explorer province.
  Validates the registry + contract with a real non-toll view before the Toll lands.
- **S5 — Port the Toll view.** Move the ceremony into `src/views/toll.js` per §5; owns `wordField`,
  listeners+own down-point, live `__viz`. K → `setView('toll')`; internal exit → `setView('murderMap',
  {paused:true})`. *Look:* gather→dial→ordered pour→orrery→MURDER word→ring rollover→drain→home
  indistinguishable from the explorer. **← Milestone 1.**
- **S6 — Parity audit.** Side-by-side explorer-K vs `toll.html`: counter honesty (binary search), dial
  scrub/unwrap, hold-1:1 drip, rollover clamp+style, counter-rotating rings, word placement, cinema-stays-
  awake-while-tolling, exit drain+home re-anchor, **frozen return**. Match only; tune nothing new.
- **S7 (later, off `main`) — Re-integration** per §6 (with the loop refactor). Verify explorer-K identical.

**Cross-cutting risk:** the persistent-pool invariant is the linchpin — if any `exit()`/`setView` path resets
a buffer, the bake seam breaks silently (instrument: log `field.geometry` identity across swaps). And the
"drain+home owns its own swap" model must hold, or an external K mid-ceremony hard-cuts the animation.
