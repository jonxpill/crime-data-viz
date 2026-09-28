// VIEW ICONS — each view word in the dock carries a 28×20 CSS-px miniature of that view's dot arrangement.
// Derived from the REAL layouts where cheap (the map's outline + crime cloud, the pie, the six-pie compare, a
// terrain slice through the real DEM, the canyon's real rate series), procedural where not (forensics, toll).
//
// STRUCTURE voice: the icon is drawn ONCE as white dots on a 2× canvas and used as a CSS MASK over
// `background: currentColor` — so it is grey (--hud-text) at rest, brightens to structure-white
// (--hud-strong) when its view is active, and follows every palette with no repaint. Never amber, never glow.
// Pure point maths here is exported for tests/hud.test.mjs; only iconDataUrl touches a canvas.

export const ICON_W = 28, ICON_H = 20;

/** Deterministic stride sample of up to `n` ACTIVE dots (density ≥ minD) from a layout → [[x, y], …] (world). */
export function subsampleActive(positions, density, n, minD = 0.02) {
  const idx = [];
  for (let i = 0; i < density.length; i++) if (density[i] >= minD) idx.push(i);
  if (!idx.length || n <= 0) return [];
  const step = Math.max(1, idx.length / n), out = [];
  for (let k = 0; k < idx.length && out.length < n; k += step) {
    const i = idx[Math.floor(k)];
    out.push([positions[2 * i], positions[2 * i + 1]]);
  }
  return out;
}

/** Fit world points (y UP) into the icon box (y DOWN), aspect preserved, centred, `pad` px margin. */
export function fitIcon(points, { w = ICON_W, h = ICON_H, pad = 1.5 } = {}) {
  if (!points.length) return [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of points) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bw = Math.max(1e-9, x1 - x0), bh = Math.max(1e-9, y1 - y0);
  const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
  const ox = (w - bw * s) / 2, oy = (h - bh * s) / 2;
  return points.map(([x, y]) => [ox + (x - x0) * s, oy + (y1 - y) * s]);
}

/** Ridgelines (a terrain slice): `profiles` = rows of heights 0..1 (NaN/≤0 = sea, skipped), back row first;
 *  each row is drawn as a dotted skyline, rows stepping down the icon like a raked relief. */
export function ridgeIcon(profiles, { w = ICON_W, h = ICON_H, amp = 7, pad = 1.5 } = {}) {
  const pts = [], R = profiles.length;
  profiles.forEach((row, r) => {
    const base = pad + 4 + (r / Math.max(1, R - 1)) * (h - 2 * pad - 5);
    row.forEach((z, i) => {
      if (!(z > 0)) return;
      const x = pad + (i / Math.max(1, row.length - 1)) * (w - 2 * pad);
      pts.push([x, Math.max(0.6, base - Math.min(1, z) * amp)]); // a peak never leaves the icon
    });
  });
  return pts;
}

/** The canyon: the real rate series (18 years) as a few raked ridgelines — the 2020/21 valley cuts them all. */
export function canyonIcon(series, { w = ICON_W, h = ICON_H } = {}) {
  const max = Math.max(1e-9, ...series), rows = 4, pts = [];
  for (let r = 0; r < rows; r++) {
    const k = 0.55 + 0.45 * (r / (rows - 1));      // nearer rows lower + taller (a lean)
    const base = 5 + r * 3.6;
    series.forEach((v, i) => {
      const x = 2 + (i / (series.length - 1)) * (w - 4);
      pts.push([x, base + 4 - (v / max) * 4.5 * k]);
    });
  }
  return pts.filter(([, y]) => y > 0.5 && y < h - 0.5);
}

/** The forensics strip: ranked ribbons — narrow, crystalline columns on the left widening to the right. */
export function forensicsIcon({ w = ICON_W, h = ICON_H } = {}) {
  const pts = [], cols = 9;
  for (let c = 0; c < cols; c++) {
    const x = 2.5 + c * ((w - 5) / (cols - 1));
    const span = 3 + (c / (cols - 1)) * 10;      // D: tight → lively
    const mid = h / 2;
    for (let k = 0; k < 6; k++) pts.push([x + (k % 2 ? 0.6 : -0.6) * (c / cols), mid - span / 2 + (k / 5) * span]);
  }
  return pts;
}

/** The toll: growth rings of loss inside the grey dial. */
export function tollIcon({ w = ICON_W, h = ICON_H } = {}) {
  const pts = [], cx = w / 2, cy = h / 2;
  for (let ring = 1; ring <= 3; ring++) {
    const r = ring * 2.3, n = ring * 9;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  }
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; pts.push([cx + Math.cos(a) * 9, cy + Math.sin(a) * 9]); }
  return pts;
}

/** `more`: three quiet dots. */
export function moreIcon({ w = ICON_W, h = ICON_H } = {}) { return [[w / 2 - 5, h / 2], [w / 2, h / 2], [w / 2 + 5, h / 2]]; }

/** A ring of `n` dots at radius R about the (world) origin — the pie's rim, added to the sampled wedges. */
export function ringPoints(R, n, cx = 0, cy = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  return out;
}

/** Icon points (icon px) → a PNG data URL of white dots on transparent, drawn at `scale`× (the mask). */
export function iconDataUrl(points, { r = 0.6, scale = 2, doc = typeof document !== 'undefined' ? document : null } = {}) {
  if (!doc) return '';
  const cv = doc.createElement('canvas');
  cv.width = ICON_W * scale; cv.height = ICON_H * scale;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff';
  for (const [x, y] of points) { g.beginPath(); g.arc(x * scale, y * scale, r * scale, 0, Math.PI * 2); g.fill(); }
  return cv.toDataURL('image/png');
}
