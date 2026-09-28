// THE HUD MADE OF LIGHT — the engine-drawn half of the explorer's HUD (D5, pass 1).
//
// Two small instruments drawn by the SAME PointField engine as the field, so the chrome is made of the piece's
// own substance (everything is points):
//   • THE YEAR RIBBON (bottom edge) — N columns (18 SAPS years, or 60 months in the pulse) × ROWS dot slots.
//     A STRUCTURE pool draws every slot (grey, matte, no glow = the frame) + one caret dot under the current
//     column; a DATA pool lights the slots (glow, bloom, the current crime's family ramp) — lit count per
//     column ∝ that column's true total, normalised to the series' own max (a sparkline: the sentence carries
//     the absolute number). A series change relights the columns in a left→right WAVE (ordered per-column
//     seeds + the engine's own stagger window — the toll's procession grammar); a year change only moves the
//     hot column + caret. Unlit data slots park at their column's base with density 0, so a lighting column
//     GROWS up from the baseline and a cooling one sinks into it.
//   • THE COMPASS (top-right) — a ring of grey dots + a 4-dot needle, the projection of a small circle lying
//     ON the map around the orbit target: it turns with the camera's spin and squashes to an ellipse with the
//     tilt (and the field's own lean) exactly, because it IS the map's circle seen through the camera.
// Both ride the CAMERA (camera.add) at a fixed depth, so they stay put on screen while the world orbits. The
// PointField's size law is `uSize · 300/depth`, so at HUD_DEPTH = 300 a pool's uSize reads in CSS px.
// Plus THE GLASS — the chrome's tinted bands drawn IN the frame (a clip-space quad, renderOrder between the field
// and the ribbon, on the bloom layer too): the bottom band (the ribbon stands on its top edge), the right rail
// (layout 'rail'), a soft ground above the rim, and a feathered backing behind the top-left readout. A CSS
// backdrop would sit OVER the canvas and dim the ribbon's own light; in-frame, the ribbon draws on top of it.
// A RIM of grey structure dots traces the glass's inner edges (the ribbon's baseline).
//
// Honesty: glow ONLY on the ribbon's lit dots (they are data: true totals). Frame slots, caret, compass —
// structure grey, never glowing. The engine still knows nothing of years or crime: the layouts are computed
// here from numbers the explorer hands in.
import * as THREE from 'three';
import { PointField } from '../engine/PointField.js';

export const HUD_DEPTH = 300;          // camera-local depth — PointField sizes are uSize·300/depth → CSS px here
export const RIBBON_ROWS = 12;
export const RIBBON_WIDE = 3;          // each column is 3 dots wide — the ribbon reads as a small FIELD, not a barcode
export const RIBBON_MAX_COLS = 60;     // the pulse's 60 months — both pools are sized once for it
export const RIBBON_PER_COL = RIBBON_ROWS * RIBBON_WIDE;
export const WAVE_STAGGER_MS = 28;     // per-column delay of a relight wave
export const WAVE_EACH_MS = 520;       // each column's own crossing
export const WAVE_MAX_MS = 1100;       // a long series (60 months) compresses its stagger to keep the wave ≈ 1 s
export const QUICK_MS = 320;           // a year step: hot column + caret move, no wave
export const COMPASS_RING = 16, COMPASS_NEEDLE = 4;

/** Live-tunable look (planner's eye: __viz.hud({...})). Densities ride the engine's own curves: structure
 *  brightness = matte·(0.32 + 4.5·d), data colour/brightness = the family ramp at d. */
export const HUD_TUNE = {
  slotDensity: 0.035,    // the ribbon's unlit frame slots — faint, recessive
  caretDensity: 0.42,    // the grey caret under the current column
  litDensity: 0.74,      // a lit (data) slot — up the ramp from its cool end (0.4 read as grey on screen)
  hotDensity: 0.97,      // the current column's lit slots — hotter (warmer ramp stop, larger, brighter)
  subDx: 2.8,            // CSS px between a column's 3 sub-columns
  jitter: 1.0,           // CSS px of fixed, seeded wobble per slot (0 = a strict grid)
  frameSize: 1.7,        // CSS px (at HUD_DEPTH)
  dataSize: 2.6,         // × the engine's density size-boost (0.6 + 0.95·d)
  compassSize: 1.7,
  compassR: 9,           // ring radius, CSS px
  ringDensity: 0.16, needleDensity: 0.30, tipDensity: 0.62,
  quietRibbon: 0.25,     // cinema: the ribbon fades to this (its lit dots stay faintly alive)
  glass: 0.8,            // the bands' darkening (75–85 % of whatever is beneath)
  glassLift: 0.0022,     // a faint linear lift so the glass reads as a surface, not a hole
  ground: 0.42,          // the soft ground above the rim (under the ribbon's columns) …
  groundH: 56,           // … and how far up it fades (CSS px)
  readout: 0.55,         // the feathered backing behind the top-left readout
  rimDensity: 0.1, rimGap: 6,  // the glass's rim of grey structure dots
  rimInset: 10,          // the rim sits this far above the ribbon track's bottom (the caret hangs below it)
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const linear = (x) => x;
const TAU = Math.PI * 2;

// ---- pure geometry (exported for tests/hud.test.mjs) ----------------------------------------------------

/** Camera-local units per CSS px at `depth` for a perspective camera of vertical `fovDeg` over a `H`-px view. */
export function unitsPerPx(fovDeg, H, depth = HUD_DEPTH) {
  return (2 * depth * Math.tan((fovDeg * Math.PI) / 360)) / H;
}
/** A CSS-px (x right, y down, origin top-left) → camera-local (x right, y up) mapper at `depth`. */
export function makePxMap({ W, H, fov, depth = HUD_DEPTH }) {
  const u = unitsPerPx(fov, H, depth);
  return (px, py) => [(px - W / 2) * u, (H / 2 - py) * u];
}

/** The ribbon's slot grid inside a track rect {left, top, width, height} (CSS px): column centres, row
 *  heights (row 0 = the baseline, rows climb), the caret line at the very bottom. */
export function ribbonGrid(rect, ncols, rows = RIBBON_ROWS) {
  const n = Math.max(1, ncols);
  const pitchX = rect.width / n;
  const rim = rect.top + rect.height - HUD_TUNE.rimInset; // the glass's top edge = the ribbon's baseline
  const base = rim - 4;                             // row 0 stands on the rim
  const topY = rect.top + 3;
  const pitchY = rows > 1 ? (base - topY) / (rows - 1) : 0;
  const colX = (c) => rect.left + (clamp(c, 0, n - 1) + 0.5) * pitchX;
  const rowY = (j) => base - j * pitchY;
  const dx = Math.min(HUD_TUNE.subDx, pitchX / (RIBBON_WIDE + 0.5));   // 60 narrow months never overlap
  const J = HUD_TUNE.jitter;
  return {
    ncols: n, rows, pitchX, pitchY, colX, rowY,
    caretY: rim + 6,                                // the caret hangs just below the rim, in the glass
    /** The slot's CSS-px position: column c, row j, sub-column k — with slot i's fixed seeded wobble (the SAME
     *  for the frame and the data pool, so a lit dot lands exactly on its grey slot). */
    slotXY: (c, j, k, i) => [colX(c) + (k - (RIBBON_WIDE - 1) / 2) * dx + J * slotJitter(i, 1), rowY(j) + J * 0.8 * slotJitter(i, 2)],
  };
}
/** Deterministic wobble in [−0.5, 0.5] for slot i (axis s) — a fixed hash, never animated. */
export function slotJitter(i, s) {
  const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return v - Math.floor(v) - 0.5;
}
/** Which column a client x falls in (clamped — dragging past either end holds the end column). */
export function columnAt(rect, ncols, clientX) {
  return clamp(Math.floor(((clientX - rect.left) / Math.max(1, rect.width)) * ncols), 0, Math.max(0, ncols - 1));
}

/** A column's lit dots: rows·v/max rounded to WHOLE dots (≥ 1 for any nonzero value — something is never
 *  drawn as nothing). Whole, not a dimmed fractional cap: in this engine density drives hue as well as light,
 *  so a part-lit top dot would read as a second (cooler) signal. Error ≤ half a dot; the sentence and the hover
 *  caption carry the exact number. `height` = the exact proportional height (tests + the probe). */
export function litColumn(v, max, rows = RIBBON_ROWS) {
  if (!(max > 0) || !(v > 0)) return { full: 0, frac: 0, height: 0 };
  const height = Math.min(rows, (rows * v) / max);
  return { full: Math.min(rows, Math.max(1, Math.round(height))), frac: 0, height };
}

/** STRUCTURE pose: every slot of the first `ncols` columns (grey), the rest parked invisible at the right
 *  end; + one caret dot (last slot) under `cur` (hidden when cur < 0). Positions in camera-local units. */
export function ribbonFrameLayout({ grid, cur = -1, map, maxCols = RIBBON_MAX_COLS, slotDensity = HUD_TUNE.slotDensity, caretDensity = HUD_TUNE.caretDensity }) {
  const rows = grid.rows, W = RIBBON_WIDE, n = maxCols * rows * W + 1;
  const positions = new Float32Array(n * 2), density = new Float32Array(n);
  for (let c = 0; c < maxCols; c++) {
    const live = c < grid.ncols;
    for (let j = 0; j < rows; j++) for (let k = 0; k < W; k++) {
      const i = (c * rows + j) * W + k;
      const [px, py] = grid.slotXY(live ? c : grid.ncols - 1, live ? j : 0, k, i);
      const [x, y] = map(px, py);
      positions[2 * i] = x; positions[2 * i + 1] = y;
      density[i] = live ? slotDensity : 0;
    }
  }
  const [cx, cy] = map(grid.colX(cur >= 0 ? cur : 0), grid.caretY);
  positions[2 * (n - 1)] = cx; positions[2 * (n - 1) + 1] = cy;
  density[n - 1] = cur >= 0 ? caretDensity : 0;
  return { positions, density };
}

/** DATA pose: column c lights litColumn(values[c], max) slots (the current column hotter); every unlit slot
 *  parks at its column's BASE with density 0 (so lighting grows up from the baseline). `values` null/empty =
 *  the dark frame (nothing lit). `ramp` = the palette door's family index for the whole ribbon. */
export function ribbonDataLayout({ grid, values = null, cur = -1, ramp = 0, map, maxCols = RIBBON_MAX_COLS, litDensity = HUD_TUNE.litDensity, hotDensity = HUD_TUNE.hotDensity }) {
  const rows = grid.rows, W = RIBBON_WIDE, n = maxCols * rows * W;
  const positions = new Float32Array(n * 2), density = new Float32Array(n);
  let max = 0;
  if (values) for (let c = 0; c < grid.ncols; c++) if (values[c] > max) max = values[c];
  const lit = new Array(grid.ncols).fill(0);
  for (let c = 0; c < maxCols; c++) {
    const live = c < grid.ncols;
    const col = live && values ? litColumn(values[c], max, rows) : { full: 0, frac: 0, height: 0 };
    const d = c === cur ? hotDensity : litDensity;
    if (live) lit[c] = col.height;
    for (let j = 0; j < rows; j++) for (let k = 0; k < W; k++) {
      const i = (c * rows + j) * W + k;
      const dj = j < col.full ? d : 0;       // every sub-column of a row lights together — honest heights
      // lit → its own slot; unlit → parked at its sub-column's BASE slot (so a lighting column grows up)
      const [px, py] = grid.slotXY(live ? c : grid.ncols - 1, dj > 0 ? j : 0, k, dj > 0 ? i : (c * rows) * W + k);
      const [x, y] = map(px, py);
      positions[2 * i] = x; positions[2 * i + 1] = y;
      density[i] = dj;
    }
  }
  return { positions, density, ramp, lit, max };
}

/** Wave timing for `ncols` columns: each column crosses in `each` ms, starting `stagger` ms after its left
 *  neighbour (compressed so the whole wave stays ≤ maxTotal). → the pool's clock `dur` + stagger window `w`. */
export function waveTiming(ncols, { stagger = WAVE_STAGGER_MS, each = WAVE_EACH_MS, maxTotal = WAVE_MAX_MS } = {}) {
  let st = stagger;
  if (ncols > 1 && each + (ncols - 1) * st > maxTotal) st = Math.max(0, (maxTotal - each) / (ncols - 1));
  const dur = each + Math.max(0, ncols - 1) * st;
  return { dur, w: each / dur, stagger: st };
}

/** Per-dot seed01 for a left→right wave: column c crosses at uT ≈ c/(ncols−1)·(1−w) — the engine's
 *  `lt = clamp((uT − seed01·(1−w))/w)` with ORDERED seeds (the toll's procession grammar). Parked columns
 *  (c ≥ ncols) go last. Capped below 1 because the shader takes fract(). `perCol` = slots per column. */
export function columnSeed01(n, perCol, ncols) {
  const s = new Float32Array(n);
  const last = Math.max(1, ncols - 1);
  for (let i = 0; i < n; i++) {
    const c = Math.floor(i / perCol);
    s[i] = Math.min(0.9999, c < ncols ? c / last : 0.9999);
  }
  return s;
}

/** The pose the eye sees (the vertex shader's per-dot mix, minus drift) — a new transition starts from HERE,
 *  so an interrupted wave never snaps. Ramp = each dot's nearer endpoint (an index can't blend on the CPU);
 *  per-dot only when the endpoints disagree (a crime flip mid-wave), else the shared number. */
export function livePose(src, tgt, s01, uT, w) {
  const n = src.density.length;
  const positions = new Float32Array(n * 2), density = new Float32Array(n);
  const ww = Math.max(w, 1e-4);
  const rs = src.ramp ?? 0, rt = tgt.ramp ?? 0;
  const mixed = !(typeof rs === 'number' && rs === rt);
  const ramp = mixed ? new Uint8Array(n) : rs;
  const at = (r, i) => (typeof r === 'number' ? r : r[i]);
  for (let i = 0; i < n; i++) {
    const lt = clamp((uT - s01[i] * (1 - ww)) / ww, 0, 1);
    positions[2 * i] = src.positions[2 * i] + (tgt.positions[2 * i] - src.positions[2 * i]) * lt;
    positions[2 * i + 1] = src.positions[2 * i + 1] + (tgt.positions[2 * i + 1] - src.positions[2 * i + 1]) * lt;
    density[i] = src.density[i] + (tgt.density[i] - src.density[i]) * lt;
    if (mixed) ramp[i] = lt < 0.5 ? at(rs, i) : at(rt, i);
  }
  return { positions, density, ramp };
}

/** The compass pose from a PROJECTED ring (screen-px offsets of a map circle about the orbit target, y down)
 *  and the projected north point: scaled so the ring's widest reach = R, centred at (cx, cy). Needle = 4 dots
 *  from near the centre to the north point on the ring; the tip is the brightest (still grey — structure). */
export function compassLayout({ ring, north, cx, cy, R = HUD_TUNE.compassR, map,
  ringDensity = HUD_TUNE.ringDensity, needleDensity = HUD_TUNE.needleDensity, tipDensity = HUD_TUNE.tipDensity }) {
  let reach = 0;
  for (const [x, y] of ring) reach = Math.max(reach, Math.hypot(x, y));
  const s = reach > 1e-9 ? R / reach : 0;
  const n = ring.length + COMPASS_NEEDLE;
  const positions = new Float32Array(n * 2), density = new Float32Array(n);
  ring.forEach(([x, y], i) => {
    const [lx, ly] = map(cx + x * s, cy + y * s);
    positions[2 * i] = lx; positions[2 * i + 1] = ly; density[i] = ringDensity;
  });
  const fr = [0.2, 0.45, 0.7, 0.95];
  for (let k = 0; k < COMPASS_NEEDLE; k++) {
    const i = ring.length + k;
    const [lx, ly] = map(cx + north[0] * s * fr[k], cy + north[1] * s * fr[k]);
    positions[2 * i] = lx; positions[2 * i + 1] = ly;
    density[i] = k === COMPASS_NEEDLE - 1 ? tipDensity : needleDensity;
  }
  return { positions, density };
}

// ---- a pool + its own transition clock (source → target with ordered seeds) -----------------------------
class PoolClock {
  constructor(pool, perCol) {
    this.pool = pool; this.perCol = perCol;
    this.src = null; this.tgt = null;
    this.s01 = new Float32Array(pool.count);
    this.uT = 1; this.w = 1; this.start = 0; this.dur = 1; this.prog = 1; this.ease = linear;
    this.ncols = 0;
    // Seeds carry the per-column ORDER (fract part) + a random whole number of turns: the order is exact
    // while the structure shimmer (phase = seed·1.7) decorrelates dot to dot.
    this.turns = new Float32Array(pool.count);
    for (let i = 0; i < pool.count; i++) this.turns[i] = Math.floor(Math.random() * 12);
  }
  get busy() { return this.prog < 1; }
  setOrder(ncols) {
    if (ncols === this.ncols) return;
    this.ncols = ncols;
    const s = columnSeed01(this.pool.count, this.perCol, ncols);
    this.s01 = s;
    const seeds = new Float32Array(s.length);
    for (let i = 0; i < s.length; i++) seeds[i] = (s[i] + this.turns[i]) * TAU;
    this.pool.setSeeds(seeds);
  }
  snap(layout) {
    this.src = layout; this.tgt = layout;
    this.pool.setSource(layout); this.pool.setTarget(layout);
    this.uT = 1; this.prog = 1; this.pool.setT(1);
  }
  live() { return this.src ? livePose(this.src, this.tgt, this.s01, this.uT, this.w) : null; }
  /** Start a transition from the live pose. wave → ordered left→right; else every dot together (quick). */
  go(layout, now, { wave = false, ncols = this.ncols } = {}) {
    const from = this.live();
    if (!from) { this.setOrder(ncols); this.snap(layout); return; }
    this.setOrder(ncols);                         // at uT = 0 every lt is 0 → re-seeding here is invisible
    const tm = wave ? waveTiming(ncols) : { dur: QUICK_MS, w: 1 };
    this.src = from; this.tgt = layout;
    this.pool.setSource(from); this.pool.setTarget(layout);
    this.w = tm.w; this.pool.setStagger(tm.w);
    this.dur = tm.dur; this.start = now; this.prog = 0; this.uT = 0; this.ease = wave ? linear : easeInOut;
    this.pool.setT(0);
  }
  /** Swap the destination mid-flight without restarting the clock (a year step during a wave). */
  retarget(layout) { this.tgt = layout; this.pool.setTarget(layout); }
  tick(now) {
    if (this.prog >= 1) return;
    this.prog = Math.min(1, (now - this.start) / this.dur);
    this.uT = this.ease(this.prog);
    this.pool.setT(this.uT);
  }
}

// ---- the instrument set ----------------------------------------------------------------------------------
/**
 * new LightHud({ camera, scene, bloomLayer, bg, pixelRatio })
 *   pools()                      the pools for the palette door: [{pool}, {pool, role:'frame'} …]
 *   layout({W,H,fov,track,compass,glass})    CSS-px rects measured from the chrome DOM (the layout truth);
 *                                glass = {band, rail, readout} — the in-frame tinted bands + the readout's backing
 *   setRibbon(spec)              spec = { mode:'data'|'scrub'|'frame', ncols, values, cur, ramp, key }
 *   setQuiet(bool)               cinema: ribbon → 25 %, compass + glass + rim → 0
 *   update(now, time, {compass:bool, fieldGroup, target})   once per frame, before render
 */
export class LightHud {
  constructor({ camera, scene, bloomLayer = 1, bg, pixelRatio = 1 }) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.position.set(0, 0, -HUD_DEPTH);
    camera.add(this.group);
    if (!camera.parent) scene.add(camera);       // a camera's children only render when the camera is in the scene
    const T = HUD_TUNE;

    this.frame = new PointField(RIBBON_MAX_COLS * RIBBON_PER_COL + 1, { glow: false, size: T.frameSize });
    this.data = new PointField(RIBBON_MAX_COLS * RIBBON_PER_COL, { glow: true, size: T.dataSize });
    this.compass = new PointField(COMPASS_RING + COMPASS_NEEDLE, { glow: false, size: T.compassSize });
    for (const f of [this.frame, this.data, this.compass]) {
      f.setPixelRatio(pixelRatio);
      f.setDrift(0);
      f.setMaxSize(7);
      f.points.frustumCulled = false;
      this.group.add(f.points);
    }
    this.frame.setShimmer(0.22); this.frame.setShimmerSpeed(0.6);   // the frame barely breathes
    this.compass.setShimmer(0); this.compass.setT(1);
    this.frame.points.renderOrder = 100;
    this.data.points.renderOrder = 101;         // after the glass (50) → the ribbon's light is never dimmed by it
    this.compass.points.renderOrder = 102;
    this.data.points.layers.enable(bloomLayer); // the ribbon's lit dots ARE data: they bloom like the field
    this.frameClock = new PoolClock(this.frame, RIBBON_PER_COL);
    this.dataClock = new PoolClock(this.data, RIBBON_PER_COL);
    this.compass.points.visible = false;

    // THE GLASS — a clip-space quad: no matrices, drawn in CSS px from gl_FragCoord (uPR = the pixel ratio).
    // Colour = the scene's bg token (the palette door mutates that THREE.Color in place) + a faint lift.
    this.glassMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: bg || new THREE.Color('#05060a') }, uPR: { value: pixelRatio }, uView: { value: new THREE.Vector2(1, 1) },
        uBand: { value: 0 }, uRail: { value: 0 }, uGroundH: { value: T.groundH }, uRead: { value: new THREE.Vector4(0, 0, 0, 0) },
        uGlass: { value: T.glass }, uGround: { value: T.ground }, uReadA: { value: T.readout }, uLift: { value: T.glassLift }, uOpacity: { value: 1 },
      },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uPR; uniform vec2 uView;
        uniform float uBand, uRail, uGroundH; uniform vec4 uRead;
        uniform float uGlass, uGround, uReadA, uLift, uOpacity;
        void main(){
          vec2 p = gl_FragCoord.xy / uPR;                                   // CSS px, origin bottom-left
          float railX = uView.x - uRail;
          float band = 1.0 - smoothstep(uBand - 0.5, uBand + 0.5, p.y);     // the bottom band (below the rim)
          float rail = uRail > 0.0 ? smoothstep(railX - 0.5, railX + 0.5, p.x) : 0.0;
          float glass = max(band, rail) * uGlass;
          float up = p.y - uBand;                                           // soft ground under the ribbon
          float ground = (up > 0.0 && p.x < railX) ? uGround * (1.0 - smoothstep(0.0, uGroundH, up)) : 0.0;
          vec2 q = vec2(p.x, uView.y - p.y);                                // the readout rect (top-left origin)
          // a corner VIGNETTE anchored at the page's top-left, reaching past the readout — darkest behind the
          // text, fading diagonally with no straight edge (a feathered rect still read as a box on the field)
          vec2 e = q / max(uRead.zw + vec2(60.0, 36.0), vec2(1.0));
          float read = uRead.z > uRead.x ? uReadA * (1.0 - smoothstep(0.30, 1.0, length(e * vec2(0.85, 1.0)))) : 0.0;
          float a = max(max(glass, ground), read) * uOpacity;
          gl_FragColor = vec4(uColor + vec3(uLift), a);
        }`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.glass = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.glassMat);
    this.glass.frustumCulled = false;
    this.glass.renderOrder = 50;
    this.glass.layers.enable(bloomLayer);       // darken the field's bloom INPUT too, or halos float over the glass
    scene.add(this.glass);
    // THE RIM — grey structure dots along the glass's inner edges (sized once for a 4K screen's perimeter).
    this.rim = new PointField(1400, { glow: false, size: 1.5 });
    this.rim.setPixelRatio(pixelRatio); this.rim.setDrift(0); this.rim.setShimmer(0.18); this.rim.setShimmerSpeed(0.5);
    this.rim.points.frustumCulled = false; this.rim.points.renderOrder = 99; this.rim.setT(1);
    this.group.add(this.rim.points);

    this.geom = null; this.spec = null; this.map = null;
    this.quiet = false;
    this.op = { ribbon: 1, compass: 0, glass: 1 };
    this.lastNow = 0;
    this._v = new THREE.Vector3(); this._c = new THREE.Vector3();
    this.compassOn = false;
  }

  pools() { return [{ pool: this.data }, { pool: this.frame, role: 'frame' }, { pool: this.compass, role: 'frame' }, { pool: this.rim, role: 'frame' }]; }

  setPixelRatio(r) {
    for (const f of [this.frame, this.data, this.compass, this.rim]) f.setPixelRatio(r);
    this.glassMat.uniforms.uPR.value = r;
  }

  /** Re-measure: the chrome DOM owns the layout (CSS), the engine draws into the measured rects.
   *  glass = { band (bottom glass height), rail (right glass width), readout: {x0, y0, x1, y1} } in CSS px. */
  layout({ W, H, fov, track, compass, glass = null }) {
    this.geom = { W, H, fov, track, compass, glass };
    this.map = makePxMap({ W, H, fov });
    this._glass();
    if (this.spec) this._apply(this.spec, null, performance.now(), true);
  }
  /** Only the readout's soft backing follows its text — a uniform write, never a re-layout. */
  setReadout(r) {
    if (!this.geom || !r) return;
    this.geom.glass = { ...(this.geom.glass || {}), readout: r };
    this.glassMat.uniforms.uRead.value.set(r.x0, r.y0, r.x1, r.y1);
  }
  _glass() {
    const { W, H, glass } = this.geom, u = this.glassMat.uniforms, T = HUD_TUNE;
    const g = glass || { band: 0, rail: 0, readout: null };
    u.uView.value.set(W, H);
    u.uBand.value = g.band || 0; u.uRail.value = g.rail || 0; u.uGroundH.value = T.groundH;
    const r = g.readout;
    u.uRead.value.set(r ? r.x0 : 0, r ? r.y0 : 0, r ? r.x1 : 0, r ? r.y1 : 0);
    u.uGlass.value = T.glass; u.uGround.value = T.ground; u.uReadA.value = T.readout; u.uLift.value = T.glassLift;
    // the rim: along the band's top edge (left of the rail) + the rail's inner edge (above the band)
    const n = this.rim.count, pos = new Float32Array(n * 2), den = new Float32Array(n), gap = T.rimGap;
    let i = 0;
    const put = (x, y) => { if (i >= n) return; const [lx, ly] = this.map(x, y); pos[2 * i] = lx; pos[2 * i + 1] = ly; den[i] = T.rimDensity; i++; };
    const railX = W - (g.rail || 0), rimY = H - (g.band || 0);
    if (g.band > 0) for (let x = gap / 2; x < railX; x += gap) put(x, rimY);
    if (g.rail > 0) for (let y = gap / 2; y < rimY; y += gap) put(railX, y);
    for (; i < n; i++) { pos[2 * i] = 0; pos[2 * i + 1] = 0; den[i] = 0; }
    const L = { positions: pos, density: den };
    this.rim.setSource(L); this.rim.setTarget(L); this.rim.setT(1);
  }

  _grid(spec) { return ribbonGrid(this.geom.track, spec.ncols, RIBBON_ROWS); }
  _frameLayout(spec, grid) {
    return ribbonFrameLayout({ grid, cur: spec.mode === 'frame' ? -1 : spec.cur, map: this.map });
  }
  _dataLayout(spec, grid) {
    return ribbonDataLayout({ grid, values: spec.mode === 'data' ? spec.values : null, cur: spec.cur, ramp: spec.ramp || 0, map: this.map });
  }

  /** The explorer's ribbon state. Diffed here: a new SERIES (key/mode/columns) relights in a wave; a new
   *  current column alone is a quick move (or, mid-wave, a retarget that keeps the wave's clock). */
  setRibbon(spec) {
    const prev = this.spec;
    this.spec = spec;
    if (!this.geom || !this.map) return;
    this._apply(spec, prev, performance.now(), false);
  }

  _apply(spec, prev, now, snap) {
    const grid = this._grid(spec);
    const fl = this._frameLayout(spec, grid), dl = this._dataLayout(spec, grid);
    if (snap || !prev) {
      this.frameClock.setOrder(spec.ncols); this.frameClock.snap(fl);
      this.dataClock.setOrder(spec.ncols); this.dataClock.snap(dl);
      return;
    }
    const cols = prev.ncols !== spec.ncols;
    const series = cols || prev.key !== spec.key || prev.mode !== spec.mode;
    const cur = prev.cur !== spec.cur;
    // frame: the grid re-forms in a wave when the column count changes; the caret glides on a year step
    if (cols || prev.mode !== spec.mode) this.frameClock.go(fl, now, { wave: true, ncols: spec.ncols });
    else if (cur) this.frameClock.go(fl, now, { wave: false, ncols: spec.ncols });
    // data: relight on a new series; a year step moves only the hot column
    if (series) this.dataClock.go(dl, now, { wave: true, ncols: spec.ncols });
    else if (cur) {
      if (this.dataClock.busy) this.dataClock.retarget(dl);
      else this.dataClock.go(dl, now, { wave: false, ncols: spec.ncols });
    }
  }

  /** Re-lay the current spec with fresh tunables (the __viz.hud eye knobs). */
  retune() {
    const T = HUD_TUNE;
    this.frame.setSize(T.frameSize); this.data.setSize(T.dataSize); this.compass.setSize(T.compassSize);
    if (this.geom) this.layout(this.geom);
  }

  setQuiet(q) { this.quiet = !!q; }
  /** Wake instantly (a tap on a faded control acts AND shows the chrome at once — no 400 ms fade-in lag). */
  wake() { this.quiet = false; }

  update(now, time, { compass = false, fieldGroup = null, target = null } = {}) {
    const dt = this.lastNow ? Math.min(100, now - this.lastNow) : 16;
    this.lastNow = now;
    const k = 1 - Math.exp(-dt / 140);            // ≈ 400 ms to settle
    const T = HUD_TUNE;
    this.op.ribbon += ((this.quiet ? T.quietRibbon : 1) - this.op.ribbon) * k;
    this.op.compass += ((compass && !this.quiet ? 1 : 0) - this.op.compass) * k;
    this.op.glass += ((this.quiet ? 0 : 1) - this.op.glass) * k;
    this.frameClock.tick(now); this.dataClock.tick(now);
    this.frame.setOpacity(this.op.ribbon); this.data.setOpacity(this.op.ribbon);
    this.frame.setTime(time); this.data.setTime(time);
    this.glassMat.uniforms.uOpacity.value = this.op.glass;
    this.glass.visible = this.op.glass > 0.003;
    this.rim.setOpacity(this.op.glass); this.rim.setTime(time); this.rim.points.visible = this.op.glass > 0.003;
    const showCompass = this.op.compass > 0.01 && this.geom && fieldGroup && target;
    this.compass.points.visible = !!showCompass;
    if (showCompass) {
      this._compassPose(fieldGroup, target);
      this.compass.setOpacity(this.op.compass);
      this.compass.setTime(time);
    }
  }

  /** Project a small circle lying ON the map about the orbit target (+ its north point) and hand the screen
   *  shape to compassLayout — spin, tilt and the field's own lean all come out of the projection exactly. */
  _compassPose(fieldGroup, target) {
    const cam = this.camera, { W, H, compass } = this.geom;
    cam.updateMatrixWorld();                      // THIS frame's pose (the controls just moved it; render hasn't run)
    fieldGroup.updateWorldMatrix(true, false);
    const c = this._c.copy(target);
    fieldGroup.worldToLocal(c);
    const rho = Math.max(1e-3, cam.position.distanceTo(target) * 0.04);
    const scr = (x, y) => {                        // field-local (x, y, 0) → CSS px
      const v = this._v.set(x, y, 0);
      fieldGroup.localToWorld(v); v.project(cam);
      return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
    };
    const [ox, oy] = scr(c.x, c.y);
    const ring = [];
    for (let i = 0; i < COMPASS_RING; i++) {
      const a = (i / COMPASS_RING) * TAU;
      const [x, y] = scr(c.x + Math.cos(a) * rho, c.y + Math.sin(a) * rho);
      ring.push([x - ox, y - oy]);
    }
    const [nx, ny] = scr(c.x, c.y + rho);
    const L = compassLayout({ ring, north: [nx - ox, ny - oy], cx: compass.left + compass.width / 2, cy: compass.top + compass.height / 2, map: this.map });
    this.compass.setSource(L); this.compass.setTarget(L); this.compass.setT(1);
  }

  /** Verification probe: what the ribbon holds right now. */
  probe() {
    const s = this.spec;
    if (!s || !this.geom) return null;
    const dl = this._dataLayout(s, this._grid(s));
    return { mode: s.mode, ncols: s.ncols, cur: s.cur, key: s.key, ramp: s.ramp, values: s.values && s.values.slice(), litHeights: dl.lit.map((h) => +h.toFixed(2)), waving: this.dataClock.busy, opacity: +this.op.ribbon.toFixed(2), compassOpacity: +this.op.compass.toFixed(2) };
  }
}
