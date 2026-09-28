// THE MOTION DOOR — packet D4 of the polish program (docs/plans/polish-program.md; brainstorm § "Each change
// gets its own motion" + round 2 items 2 and 6).
//
// ONE place decides HOW a change travels. The engine (PointField) offers the vocabulary — path modes
// (straight · arc · swirl), a per-dot stagger ORDER, comet streaks, aerial haze — and this door owns the
// grammar: which kind of change gets which motion (the SPEC table), the meaningful orders (pure helpers
// below), when a motion ends, and the per-frame bookkeeping (streak clock, focus distance, viewport).
// Call sites declare intent — `motion.begin('flip', field, ctx)` right after they write the pair — and the
// door realises it.
//
// HONESTY: motion is TRANSITIONAL ONLY. Every engine term is exactly zero at lt = 0 and lt = 1, a session
// ends the moment its pair lands (uT = 1) or is replaced (a new pair write), and ending restores straight
// paths + the random order + no streak + the call site's own stagger — so no endpoint, no resting frame,
// changes position or brightness. The haze is a no-op at every top-down home (flat field → relative depth 1).
//
// Knobs: MOTION_TUNE below, live via __viz.motion({...}) in the explorer (the planner tunes by eye).
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// ---- the grammar: which change travels how ------------------------------------------------------------------
// order: 'value' (densest first) · 'point' (radiates out from ctx.point) · 'x' | 'y' (a sweep) · null (random).
// stagger: null = keep the call site's; a number = the door's window (narrower = the order reads stronger).
// streak: comet length in frames of travel on DATA pools; structStreak on structure pools.
export const MOTION_TUNE = {
  flip: { path: 'arc', bend: 0.35, fan: 1, order: 'value', reverse: false, stagger: 0.5, streak: 0, structStreak: 0 },
  pie: { path: 'swirl', dir: 1, turns: 0, order: null, stagger: null, streak: 0, structStreak: 0 },
  drill: { path: 'straight', order: 'point', reverse: false, stagger: 0.5, streak: 1.5, structStreak: 0 },
  streakMax: 20,      // CSS px cap on a comet's length
  tail: 0.12,         // tail brightness relative to the head
  conserve: 0.45,     // 0 = a comet adds light · 1 = its energy spreads along it
  haze: { on: true, far: 1.2, near: 0.5, strength: 0.55 },
  dither: 1,          // output dither amplitude in 8-bit LSBs (TPDF: two ±0.5 LSB hashes summed); 0 = off
};

const TAU = Math.PI * 2;

// ---- pure helpers: MEANINGFUL ORDERS -------------------------------------------------------------------
// Each returns a Float32Array in [0,1] (one per dot, 0 = crosses first) for PointField.setOrder — or, via
// toSeeds(), an aSeed array for setSeeds (the Toll's tool; note setSeeds also re-phases twinkle + drift).
// A layout is the engine's contract { positions: Float32Array(n·2), density: Float32Array(n) }; dots with
// density 0 are PARKED (invisible) and never set a range — they fall to the end of the order.

/** RANK order of keys (ascending; reverse = descending): an O(n) bucket rank, no sort — 181k dots in a few
 *  ms. Equal-ish keys (one bucket) spread evenly over their share by a golden-ratio jitter, so departures
 *  flow at a constant rate whatever the key's distribution. */
export function rankOrder(keys, { reverse = false, buckets = 4096 } = {}) {
  const n = keys.length, out = new Float32Array(n);
  if (!n) return out;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const k = keys[i]; if (k < lo) lo = k; if (k > hi) hi = k; }
  const G = 0.6180339887498949;
  let g = 0; // the golden-ratio sequence, stepped (no modulo in the hot loops)
  if (!(hi > lo)) { for (let i = 0; i < n; i++) { out[i] = g; g += G; if (g >= 1) g -= 1; } return out; }
  const B = buckets, scale = (B - 1e-6) / (hi - lo), last = B - 1;
  const bin = new Uint16Array(n), count = new Uint32Array(B);
  for (let i = 0; i < n; i++) {
    let b = ((keys[i] - lo) * scale) | 0;
    if (reverse) b = last - b;
    bin[i] = b; count[b]++;
  }
  const start = new Uint32Array(B);
  for (let b = 1; b < B; b++) start[b] = start[b - 1] + count[b - 1];
  const inv = 1 / n;
  for (let i = 0; i < n; i++) {
    const b = bin[i];
    out[i] = (start[b] + g * count[b]) * inv;
    g += G; if (g >= 1) g -= 1;
  }
  return out;
}

/** LINEAR order of keys: (k − lo)/(hi − lo) over the VISIBLE dots' range (mask), clamped — a wave whose
 *  front moves at a constant speed through the key (distance, x, y), however dots crowd along it. */
export function linearOrder(keys, { mask = null, reverse = false } = {}) {
  const n = keys.length, out = new Float32Array(n);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    const k = keys[i]; if (k < lo) lo = k; if (k > hi) hi = k;
  }
  if (!(hi > lo)) return rankOrder(keys, { reverse });
  const inv = 1 / (hi - lo);
  for (let i = 0; i < n; i++) {
    const v = Math.min(1, Math.max(0, (keys[i] - lo) * inv));
    out[i] = reverse ? 1 - v : v;
  }
  return out;
}

const visibleMask = (layout) => {
  const d = layout.density, m = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) m[i] = d[i] > 0 ? 1 : 0;
  return m;
};

/** RADIATE from a point (a drill sweeps out from the clicked place): nearer dots cross first, the front
 *  moving at constant speed across the layout's visible dots (rank: true = constant dot flow instead). */
export function seedsFromPoint(layout, x, y, { reverse = false, rank = false } = {}) {
  const n = layout.density.length, p = layout.positions, keys = new Float32Array(n);
  for (let i = 0; i < n; i++) { const dx = p[2 * i] - x, dy = p[2 * i + 1] - y; keys[i] = Math.sqrt(dx * dx + dy * dy); }
  if (rank) return rankOrder(keys, { reverse });
  const m = visibleMask(layout);
  const o = linearOrder(keys, { mask: m, reverse });
  for (let i = 0; i < n; i++) if (!m[i]) o[i] = reverse ? 0 : 1; // parked: invisible, never in the way
  return o;
}

/** DENSEST FIRST (a crime flip moves the hottest precincts first): ranks by the max density across one or
 *  more layouts (pass [target, source] so the hot cores of EITHER crime lead); parked dots cross last. */
export function seedsByValue(layouts, { reverse = false } = {}) {
  const Ls = Array.isArray(layouts) ? layouts.filter(Boolean) : [layouts];
  const n = Ls[0].density.length, keys = new Float32Array(n);
  for (const L of Ls) { const d = L.density; for (let i = 0; i < n; i++) if (d[i] > keys[i]) keys[i] = d[i]; }
  return rankOrder(keys, { reverse: !reverse });
}

/** A SWEEP along an axis ('x' west→east, 'y' south→north; reverse flips it) across the visible dots. */
export function seedsByAxis(layout, axis = 'x', { reverse = false, rank = false } = {}) {
  const n = layout.density.length, p = layout.positions, keys = new Float32Array(n), k = axis === 'y' ? 1 : 0;
  for (let i = 0; i < n; i++) keys[i] = p[2 * i + k];
  if (rank) return rankOrder(keys, { reverse });
  const m = visibleMask(layout);
  const o = linearOrder(keys, { mask: m, reverse });
  for (let i = 0; i < n; i++) if (!m[i]) o[i] = 1;
  return o;
}

/** An order → aSeed values for PointField.setSeeds (fract(seed/2π) = order, the Toll's seed math). */
export function toSeeds(order) {
  const s = new Float32Array(order.length);
  for (let i = 0; i < order.length; i++) s[i] = Math.min(order[i], 0.999999) / 0.1591549431;
  return s;
}

/** The mean of a set of {x, y} points (e.g. a district's stations in province coordinates). */
export function centroid(points) {
  let x = 0, y = 0, n = 0;
  for (const p of points) { x += p.x; y += p.y; n++; }
  return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
}

/** JS twin of the engine's pathAt (tests + docs; the shader is the truth on screen). Returns [x, y]. */
export function pathPoint(mode, sx, sy, tx, ty, lt, { bend = 0.35, fan = 1, seed = 1, centre = [0, 0], dir = 0, turns = 0 } = {}) {
  const lx = sx + (tx - sx) * lt, ly = sy + (ty - sy) * lt;
  if (mode === 'straight' || lt <= 0 || lt >= 1) return [lx, ly];
  const frac = (v) => v - Math.floor(v);
  if (mode === 'arc') {
    const h1 = frac(Math.sin(seed * 12.9898 + 1.7) * 43758.5453), h2 = frac(Math.sin(seed * 78.233 + 4.1) * 43758.5453);
    const side = h1 < 0.5 * fan ? -1 : 1, k = side * 2 * lt * (1 - lt) * bend * (0.55 + 0.45 * h2);
    return [lx - (ty - sy) * k, ly + (tx - sx) * k];
  }
  const [cx, cy] = centre;
  const ax = sx - cx, ay = sy - cy, bx = tx - cx, by = ty - cy;
  const ra = Math.hypot(ax, ay), rb = Math.hypot(bx, by);
  const tb0 = rb > 1e-3 ? Math.atan2(by, bx) : 0;
  const ta = ra > 1e-3 ? Math.atan2(ay, ax) : tb0, tb = rb > 1e-3 ? tb0 : ta;
  const mod = (v, m) => v - m * Math.floor(v / m);
  let d = tb - ta;
  if (dir > 0) d = mod(d, TAU); else if (dir < 0) d = mod(d, TAU) - TAU; else d -= TAU * Math.floor(d / TAU + 0.5);
  d += TAU * turns * (dir < 0 ? -1 : 1);
  const th = ta + d * lt, r = ra + (rb - ra) * lt;
  return [cx + r * Math.cos(th), cy + r * Math.sin(th)];
}

// ---- the output dither -----------------------------------------------------------------------------------
/** A final full-screen pass AFTER the OutputPass (tone mapping + sRGB encode), BEFORE the 8-bit screen: adds
 *  triangular (TPDF) noise of ±`amp` LSB so the wide, dim bloom halos stop banding. Static per pixel (no
 *  shimmer), decorrelated per channel. amp 0 = exact passthrough. */
export function createDitherPass(amp = MOTION_TUNE.dither) {
  const pass = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uAmp: { value: amp / 255 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uAmp; varying vec2 vUv;
      // interleaved gradient noise (Jimenez 2014) — cheap, blue-ish, no texture
      float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 p = gl_FragCoord.xy;
        vec3 n = vec3(ign(p) + ign(p + vec2(37.0, 17.0)),
                      ign(p + vec2(11.0, 71.0)) + ign(p + vec2(53.0, 29.0)),
                      ign(p + vec2(97.0, 43.0)) + ign(p + vec2(23.0, 89.0))) - 1.0; // TPDF in (−1, 1)
        gl_FragColor = vec4(c.rgb + n * uAmp, c.a);
      }`,
  }), 'tDiffuse');
  return pass;
}

// ---- the door ---------------------------------------------------------------------------------------------
/**
 * createMotion({ renderer, camera, controls }) → the explorer's motion door.
 *  • world(pools)            — the pools that live in the world (not the HUD): they get haze, the focus distance,
 *                              the viewport and the per-frame streak clock. Call once when they exist.
 *  • begin(kind, pools, ctx) — AFTER a call site writes its pair: give that transition its motion (SPEC table).
 *                              ctx: { layouts: [primary, secondary?], point: {x,y}, offset, dir }. Each pool
 *                              gets its own session; it ends on landing (uT = 1) or when its pair is replaced.
 *  • end(pool)               — restore straight / random order / no streak / the call site's stagger (idempotent).
 *  • frame()                 — once per rendered frame, BEFORE rendering (the explorer's render()).
 *  • tune(o)                 — merge knobs ({ flip: {...}, pie: {...}, drill: {...}, streakMax, tail, conserve,
 *                              haze: {...}, dither }) and re-apply; returns the live table.
 *  • ditherPass              — the output pass to add after the OutputPass.
 */
export function createMotion({ renderer = null, camera = null, controls = null } = {}) {
  const worldPools = new Set();
  const sessions = new Map(); // pool → { kind, epoch, armed, stagger0, staggerSet, staggerWrites }
  const ditherPass = createDitherPass(MOTION_TUNE.dither);
  const _vp = new THREE.Vector2(-1, -1), _size = new THREE.Vector2();
  let lastNow = -1;

  const applyHaze = (p) => p.setHaze(MOTION_TUNE.haze && MOTION_TUNE.haze.on !== false ? MOTION_TUNE.haze : null);
  const streakOpts = () => ({ max: MOTION_TUNE.streakMax, tail: MOTION_TUNE.tail, conserve: MOTION_TUNE.conserve });

  function orderFor(spec, ctx, pool) {
    const Ls = (ctx.layouts || []).filter(Boolean);
    const opt = { reverse: !!spec.reverse };
    switch (spec.order) {
      case 'value': return Ls.length ? seedsByValue(Ls, opt) : null;
      case 'point': return Ls.length && ctx.point ? seedsFromPoint(Ls[0], ctx.point.x, ctx.point.y, opt) : null;
      case 'x': case 'y': return Ls.length ? seedsByAxis(Ls[0], spec.order, opt) : null;
      default: return null;
    }
  }

  function end(pool) {
    const s = sessions.get(pool);
    if (!s) return;
    sessions.delete(pool);
    pool.setPath('straight');
    pool.setOrder(null);
    pool.setStreak(0);
    // Hand the stagger back ONLY if nobody set one since the door did (a new transition's own stagger wins).
    if (s.staggerSet && pool.staggerWrites === s.staggerWrites) pool.setStagger(s.stagger0);
  }

  function begin(kind, pools, ctx = {}) {
    const spec = MOTION_TUNE[kind];
    if (!spec) return;
    for (const pool of [].concat(pools)) {
      if (!pool) continue;
      end(pool);
      const s = { kind, armed: false, stagger0: pool.material.uniforms.uStagger.value, staggerSet: false };
      pool.setPath(spec.path || 'straight', {
        bend: spec.bend, fan: spec.fan, turns: spec.turns,
        dir: (spec.dir ?? 0) * (ctx.dir ?? 1),
        centre: ctx.centre || spec.centre || [0, 0],
      });
      const order = orderFor(spec, ctx, pool);
      pool.setOrder(order, order ? ctx.offset || 0 : 0);
      if (spec.stagger != null) { pool.setStagger(spec.stagger); s.staggerSet = true; }
      pool.setStreak(pool.glow ? spec.streak || 0 : spec.structStreak || 0, streakOpts());
      s.staggerWrites = pool.staggerWrites;
      s.epoch = pool.epoch;
      sessions.set(pool, s);
    }
  }

  function frame() {
    // Sessions end on LANDING (uT reaches 1 after having run) or when their pair is REPLACED (epoch moved).
    for (const [pool, s] of sessions) {
      const t = pool.material.uniforms.uT.value;
      if (pool.epoch !== s.epoch) end(pool);
      else if (t >= 1) { if (s.armed) end(pool); }
      else s.armed = true;
    }
    if (renderer) {
      renderer.getDrawingBufferSize(_size);
      if (!_size.equals(_vp)) { _vp.copy(_size); for (const p of worldPools) p.setViewport(_size.x, _size.y); }
    }
    const focus = camera && controls ? camera.position.distanceTo(controls.target) : 1;
    const now = performance.now(), dt = lastNow < 0 ? 1000 / 60 : Math.min(Math.max(now - lastNow, 4), 100);
    lastNow = now;
    const rate = 1000 / 60 / dt; // comets measured in 60-fps frames, whatever the display's refresh
    for (const p of worldPools) { p.setFocus(focus); p.setStreakRate(rate); p.beginFrame(); }
  }

  function world(pools) {
    for (const p of pools) if (p) { worldPools.add(p); applyHaze(p); }
    _vp.set(-1, -1); // re-push the viewport to newcomers on the next frame
  }

  function tune(o) {
    if (o) {
      for (const [k, v] of Object.entries(o)) {
        if (v && typeof v === 'object' && MOTION_TUNE[k] && typeof MOTION_TUNE[k] === 'object') Object.assign(MOTION_TUNE[k], v);
        else if (k in MOTION_TUNE) MOTION_TUNE[k] = v;
      }
      for (const p of worldPools) applyHaze(p);
      for (const [pool, s] of sessions) { // live sessions pick up streak knobs at once
        const spec = MOTION_TUNE[s.kind];
        pool.setStreak(pool.glow ? spec.streak || 0 : spec.structStreak || 0, streakOpts());
      }
      ditherPass.uniforms.uAmp.value = (MOTION_TUNE.dither || 0) / 255;
    }
    return JSON.parse(JSON.stringify(MOTION_TUNE));
  }

  return {
    begin, end, frame, world, tune, ditherPass,
    get active() { return [...sessions.values()].map((s) => s.kind); },
  };
}
