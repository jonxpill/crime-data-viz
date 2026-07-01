/**
 * neighbourCounts — RAW local crowding per point (sum over its 3x3 grid cells).
 *
 * The "density = light" rule, computed UPSTREAM (CPU, once per layout). Returns
 * the raw neighbour counts WITHOUT normalising — so callers that span multiple
 * layouts (e.g. the year-scrub) can normalise GLOBALLY and keep intensity
 * comparable across them. The engine never does neighbour search.
 *
 * @param {Float32Array} positions interleaved xy, length n*2
 * @param {number} cell grid cell size in world units (≈ the neighbourhood radius)
 * @returns {Float32Array} raw neighbour count per point
 */
export function neighbourCounts(positions, cell) {
  const n = positions.length / 2;
  const bins = new Map();
  const key = (ix, iy) => ix * 73856093 ^ iy * 19349663; // cheap spatial hash

  const ixs = new Int32Array(n);
  const iys = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const ix = Math.floor(positions[i * 2] / cell);
    const iy = Math.floor(positions[i * 2 + 1] / cell);
    ixs[i] = ix; iys[i] = iy;
    bins.set(key(ix, iy), (bins.get(key(ix, iy)) || 0) + 1);
  }

  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) c += bins.get(key(ixs[i] + dx, iys[i] + dy)) || 0;
    }
    raw[i] = c;
  }
  return raw;
}

/** Normalise a raw-count field to 0..1 by its OWN max, soft curve. Single-layout use. */
export function normaliseDensity(raw) {
  let max = 1;
  for (let i = 0; i < raw.length; i++) if (raw[i] > max) max = raw[i];
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = Math.pow(Math.min(raw[i] / max, 1), 0.55);
  return out;
}

/** Convenience: raw counts normalised by their own max (back-compat for single layouts). */
export function computeDensity(positions, cell) {
  return normaliseDensity(neighbourCounts(positions, cell));
}
