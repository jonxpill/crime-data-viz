/**
 * computeDensity — per-point local neighbour density, normalised to 0..1.
 *
 * This is the "density = light" rule, computed UPSTREAM (CPU, once per layout)
 * and handed to the engine as a plain attribute. The engine never does neighbour
 * search; for static baked layouts a grid bin is exact enough and effectively free.
 *
 * @param {Float32Array} positions interleaved xy, length n*2
 * @param {number} cell  grid cell size in world units (≈ the neighbourhood radius)
 * @returns {Float32Array} density per point, 0 (sparse) .. 1 (dense core)
 */
export function computeDensity(positions, cell) {
  const n = positions.length / 2;
  const bins = new Map(); // "ix,iy" -> count
  const key = (ix, iy) => ix * 73856093 ^ iy * 19349663; // cheap spatial hash

  // Pass 1: bin every point.
  const ixs = new Int32Array(n);
  const iys = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const ix = Math.floor(positions[i * 2] / cell);
    const iy = Math.floor(positions[i * 2 + 1] / cell);
    ixs[i] = ix; iys[i] = iy;
    const k = key(ix, iy);
    bins.set(k, (bins.get(k) || 0) + 1);
  }

  // Pass 2: each point's density = sum over its 3x3 cell neighbourhood.
  const raw = new Float32Array(n);
  let max = 1;
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        c += bins.get(key(ixs[i] + dx, iys[i] + dy)) || 0;
      }
    }
    raw[i] = c;
    if (c > max) max = c;
  }

  // Normalise with a soft curve so a few mega-cores don't crush the midtones.
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.pow(Math.min(raw[i] / max, 1), 0.55);
  }
  return out;
}
