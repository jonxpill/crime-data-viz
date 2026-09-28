// THE LIVING DOCK — nine icon-first mode miniatures (D5 revision, maker-approved 2026-09-28).
//
// Each view's icon is a ~70-dot miniature of what that view WOULD show for the current crime / year / region /
// mode — subsampled from the REAL layouts upstream (wcExplore builds the models; this module only fits and
// draws). Two roles inside every icon, the piece's own language in miniature:
//   • FRAME dots (outlines, rings, relief) — structure: grey, never warm.
//   • DATA dots (crime) — grey at REST (the dock is structure); on HOVER they gather from a light scatter into
//     the shape (~700 ms) and light in their crime family's ramp colour, additive, density → cool…warm. That
//     glow is honest ONLY because these dots are real data — a model marked `real: false` (procedural or
//     illustrative) brightens to structure-WHITE on hover instead.
// ACTIVE mode → structure-white dots. UNAVAILABLE mode → the icon FAILS TO FORM: its dots drift loosely
// scattered in its box, dimmer (no click — the dock disables the button). An unbuilt icon is that same scatter.
// 2D canvases at 2× (crisp at 52×36 CSS px) — not engine pools; the ribbon + compass stay engine-drawn.
// Pure point maths exported for tests/hud.test.mjs; only LivingIcon.draw touches a canvas.

export const ICON_W = 52, ICON_H = 36, ICON_SLOTS = 84;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Deterministic stride sample of up to `n` ACTIVE dots (density ≥ minD) → [[x, y], …] (world, y up). */
export function subsampleActive(positions, density, n, minD = 0.02) {
  return sampleLayout({ positions, density }, n, { minD }).map((p) => [p.x, p.y]);
}
/** Stride sample of a REAL layout's active dots → [{i, x, y, d, r}] — density kept (the shape reads), `r` = the
 *  dot's family ramp (the layout's per-dot ramp array, else `ramp`). `keep(i)` filters indices first. */
export function sampleLayout(L, n, { minD = 0.02, ramp = 0, keep = null, dScale = 1 } = {}) {
  const idx = [];
  for (let i = 0; i < L.density.length; i++) if (L.density[i] >= minD && (!keep || keep(i))) idx.push(i);
  if (!idx.length || n <= 0) return [];
  const step = Math.max(1, idx.length / n), out = [];
  const perDot = L.ramp != null && typeof L.ramp !== 'number' ? L.ramp : null;
  for (let k = 0; k < idx.length && out.length < n; k += step) {
    const i = idx[Math.floor(k)];
    out.push({ i, x: L.positions[2 * i], y: L.positions[2 * i + 1], d: L.density[i] * dScale, r: perDot ? perDot[i] : (typeof L.ramp === 'number' ? L.ramp : ramp) });
  }
  return out;
}

/** Fit a model's frame + data points (world, y UP) into the icon box (y DOWN): one shared scale, aspect kept,
 *  centred, `pad` px margin. Extra fields (d, r) ride along. */
export function fitShape({ frame = [], data = [] }, { w = ICON_W, h = ICON_H, pad = 2 } = {}) {
  const all = [...frame, ...data];
  if (!all.length) return { frame: [], data: [] };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of all) { const x = p.x ?? p[0], y = p.y ?? p[1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bw = Math.max(1e-9, x1 - x0), bh = Math.max(1e-9, y1 - y0);
  const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
  const ox = (w - bw * s) / 2, oy = (h - bh * s) / 2;
  const f = (p) => ({ ...(Array.isArray(p) ? {} : p), x: ox + ((p.x ?? p[0]) - x0) * s, y: oy + (y1 - (p.y ?? p[1])) * s });
  return { frame: frame.map(f), data: data.map(f) };
}

/** A ring of `n` points (world) — a pie's rim, the toll's dial. */
export function ringPoints(R, n, cx = 0, cy = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }); }
  return out;
}

/** A raked (oblique) view of a relief point: the map's y squashed, the height lifted — the terrain/canyon
 *  miniatures seen the way their scenes lean. */
export const oblique = (x, y, z, { squash = 0.5, lift = 1 } = {}) => ({ x, y: y * squash + z * lift });

/** THE TOLL in miniature — the SAME rule as tollLayouts (capeTown.js): event k = the k-th recorded murder,
 *  year-major; its ring = r0 + (R − r0)·cum/M (thickness ∝ that year's count), any angle, warmth by age;
 *  inside the grey dial. `perYear` = the province's recorded murders per year (raw — the toll always is). */
export function tollMini(perYear, { n = 62, dialN = 18, R = 1, ramp = 0, seed = 0x70115eed } = {}) {
  const rnd = mulberry(seed), Y = perYear.length;
  const cum = [0]; for (const v of perYear) cum.push(cum[cum.length - 1] + v);
  const M = cum[Y] || 1, r0 = R * 0.05, data = [];
  let yy = 0;
  for (let i = 0; i < n; i++) {
    const k = ((i + 0.5) / n) * M;
    while (yy < Y - 1 && k >= cum[yy + 1]) yy++;
    const rIn = r0 + (R - r0) * (cum[yy] / M), rOut = r0 + (R - r0) * (cum[yy + 1] / M);
    const rr = rIn + ((k - cum[yy]) / Math.max(1, perYear[yy])) * (rOut - rIn), a = rnd() * Math.PI * 2;
    data.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, d: 0.42 + 0.5 * (Y > 1 ? yy / (Y - 1) : 0), r: ramp });
  }
  return { frame: ringPoints(R * 1.16, dialN), data, real: true };
}

/** Fallbacks for a view whose real layout isn't available (no DEM, no flock yet) — marked NOT real. */
export function releaseFallback(n = 70, seed = 7) {
  const rnd = mulberry(seed), frame = [];
  for (let i = 0; i < n; i++) { const t = rnd() * 6.2; frame.push({ x: t, y: Math.sin(t * 1.3) * 0.9 + (rnd() - 0.5) * 0.7 }); }
  return { frame, data: [], real: false };
}
export function terrainFallback() {
  const frame = [];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 14; k++) frame.push({ x: k, y: -r * 1.6 + Math.max(0, Math.sin(k / 2.2 + r)) * 1.4 });
  return { frame, data: [], real: false };
}

// ---- colour ------------------------------------------------------------------------------------------------
export function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return [135, 146, 166];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** The engine's density ramp (PointField FRAG): cool → mid → warm, warmth only in genuine cores. */
export function rampAt(ramp, d) {
  const lo = mix(ramp[0], ramp[1], smooth(0.12, 0.62, d));
  return mix(lo, ramp[2], smooth(0.62, 0.95, d));
}
const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;

// ---- the renderer ------------------------------------------------------------------------------------------
/**
 * new LivingIcon(canvas, seed) — one icon's dots, states and clocks.
 *   setShape(model, now)       model = { frame:[{x,y}], data:[{x,y,d,r}], real } (world, y up) — tweens in (450 ms)
 *   setState({avail, active}, now)   avail false → fails to form (loose scatter, dim); active → structure-white
 *   setHover(on, now)          gather from a light scatter (~700 ms) + light (real data → ramp; else → white)
 *   tick(now) → still animating?      draw({text, strong, ramps})
 */
export class LivingIcon {
  constructor(canvas, seed = 1) {
    this.cv = canvas;
    this.g = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    this.k = canvas ? canvas.width / ICON_W : 2;
    const rnd = mulberry(seed * 2654435761);
    this.slots = Array.from({ length: ICON_SLOTS }, () => {
      const sx = 2.5 + rnd() * (ICON_W - 5), sy = 2.5 + rnd() * (ICON_H - 5);
      return { sx, sy, x0: sx, y0: sy, x1: sx, y1: sy, on0: 0.8, on1: 0.8, d0: 0.35, d1: 0.35, r: 0, data: false };
    });
    this.shapeT = 1; this.shapeStart = 0;
    this.form = 1; this.legs = [];        // formation: 0 = loose scatter · 1 = the shape
    this.avail = true; this.active = false; this.hover = false; this.real = false;
    this.glow = 0; this.white = 0; this.dim = 1; this.lastNow = 0; this.pending = false; this.pulse = 0;
    this.dirty = true;
  }
  _shape(s) {
    const e = easeInOut(this.shapeT);
    return { x: s.x0 + (s.x1 - s.x0) * e, y: s.y0 + (s.y1 - s.y0) * e, on: s.on0 + (s.on1 - s.on0) * e, d: s.d0 + (s.d1 - s.d0) * e };
  }
  /** The dot's position NOW: its tweened shape, pulled toward its scatter by (1 − formation). */
  pos(i) {
    const s = this.slots[i], p = this._shape(s), F = clamp(this.form, 0, 1);
    return { x: s.sx + (p.x - s.sx) * F, y: s.sy + (p.y - s.sy) * F, on: p.on, d: p.d };
  }
  setShape(model, now = 0) {
    const fitted = fitShape(model);
    const pts = [...fitted.frame.map((p) => ({ x: p.x, y: p.y, d: 0.5, r: 0, data: false })),
      ...fitted.data.map((p) => ({ x: p.x, y: p.y, d: p.d ?? 0.5, r: p.r ?? 0, data: true }))].slice(0, ICON_SLOTS);
    this.slots.forEach((s, i) => {
      const cur = this._shape(s);
      s.x0 = cur.x; s.y0 = cur.y; s.on0 = cur.on; s.d0 = cur.d;
      const p = pts[i];
      if (p) { s.x1 = p.x; s.y1 = p.y; s.on1 = 1; s.d1 = p.d; s.r = p.r; s.data = p.data; }
      else { s.x1 = cur.x; s.y1 = cur.y; s.on1 = 0; }               // spare slots fade where they are
    });
    this.real = !!model.real;
    this.shapeStart = now; this.shapeT = 0; this.dirty = true;
  }
  setState({ avail = true, active = false, pending = false } = {}, now = 0) {
    if (avail !== this.avail) { this.avail = avail; this.legs = [{ to: avail ? 1 : 0, dur: avail ? 700 : 600, ease: easeInOut }]; }
    this.active = !!active; this.pending = !!pending; this.dirty = true;
  }
  setHover(on, now = 0) {
    on = !!on;
    if (on === this.hover) return;
    this.hover = on;
    if (on && this.avail) this.legs = [{ to: Math.min(this.form, 0.55), dur: 150, ease: easeOut }, { to: 1, dur: 700, ease: easeInOut }];
    this.dirty = true;
  }
  tick(now) {
    const dt = this.lastNow ? Math.min(80, now - this.lastNow) : 16;
    this.lastNow = now;
    let anim = false;
    if (this.shapeT < 1) { this.shapeT = Math.min(1, (now - this.shapeStart) / 450); anim = true; }
    if (this.legs.length) {
      const leg = this.legs[0];
      if (leg.start == null) { leg.start = now; leg.from = this.form; }
      const p = Math.min(1, (now - leg.start) / leg.dur);
      this.form = leg.from + (leg.to - leg.from) * leg.ease(p);
      if (p >= 1) this.legs.shift();
      anim = true;
    }
    const k = 1 - Math.exp(-dt / 170);
    // pending (a queued navigation waiting for a transition): a slow breath toward white, ~1.4 s a cycle
    const pulse = this.pending ? 0.5 - 0.5 * Math.cos((now / 1400) * Math.PI * 2) : 0;
    if (this.pending || this.pulse > 0.004) anim = true;
    this.pulse = pulse;
    const tg = this.hover && this.avail ? 1 : 0, tw = this.active ? 1 : Math.max(0, this.pulse * 0.8), td = this.avail ? 1 : 0.5;
    for (const [key, t] of [['glow', tg], ['white', tw], ['dim', td]]) {
      if (Math.abs(this[key] - t) > 0.004) { this[key] += (t - this[key]) * k; anim = true; } else this[key] = t;
    }
    if (anim) this.dirty = true;
    return anim;
  }
  draw({ text = [135, 146, 166], strong = [212, 220, 239], ramps = null } = {}) {
    const g = this.g;
    if (!g) return;
    const K = this.k;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    const base = mix(text, strong, this.white);
    const lit = [];
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i], p = this.pos(i);
      if (p.on < 0.01) continue;
      const warm = this.real && s.data && ramps;            // honest glow: real data dots only
      const gd = warm ? this.glow : 0;
      let col = base, a = (s.data ? 0.34 + 0.6 * p.d : 0.62) * p.on * this.dim;
      if (!warm && this.glow > 0) { col = mix(base, strong, this.glow * 0.9); a = Math.min(1, a + 0.3 * this.glow); }
      const r = (s.data ? 1.0 : 0.85) * K;
      if (a * (1 - gd) > 0.01) {
        g.fillStyle = css(col, a * (1 - gd));
        g.beginPath(); g.arc(p.x * K, p.y * K, r, 0, Math.PI * 2); g.fill();
      }
      if (gd > 0.01) lit.push([p, s, gd]);
    }
    if (lit.length) {                                        // the living state: additive family-ramp light
      g.globalCompositeOperation = 'lighter';
      for (const [p, s, gd] of lit) {
        const c = rampAt(ramps[s.r] || ramps[0], p.d), x = p.x * K, y = p.y * K;
        g.fillStyle = css(c, 0.16 * gd * (0.5 + p.d) * p.on);
        g.beginPath(); g.arc(x, y, 2.6 * K, 0, Math.PI * 2); g.fill();
        g.fillStyle = css(c, gd * (0.55 + 0.45 * p.d) * p.on);
        g.beginPath(); g.arc(x, y, 1.05 * K, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    this.dirty = false;
  }
}
