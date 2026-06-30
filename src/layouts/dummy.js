import { computeDensity } from './density.js';

/**
 * Dummy Stage-0 layouts. Each is a PURE function returning the engine's only
 * contract: { positions:Float32Array(n*2), density:Float32Array(n) }. They stand
 * in for real crime layouts (map projection, year-scrub) which arrive in Stage 1
 * as nothing more than additional functions of this exact shape.
 */

// Box-Muller gaussian for a soft-cored cloud (denser in the middle).
function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A drifting nebulous blob — a few overlapping gaussian clumps, brightest where they pile up. */
export function blob(n, radius = 360) {
  const positions = new Float32Array(n * 2);
  // A handful of cluster centres so density varies across the cloud.
  const clusters = [
    { x: 0, y: 0, s: 0.55 },
    { x: -0.45, y: 0.25, s: 0.32 },
    { x: 0.5, y: -0.2, s: 0.28 },
    { x: 0.15, y: 0.5, s: 0.22 },
    { x: -0.3, y: -0.45, s: 0.3 },
  ];
  for (let i = 0; i < n; i++) {
    const c = clusters[(Math.random() * clusters.length) | 0];
    positions[i * 2] = (c.x + gauss() * c.s * 0.5) * radius;
    positions[i * 2 + 1] = (c.y + gauss() * c.s * 0.5) * radius;
  }
  return { positions, density: computeDensity(positions, radius * 0.05) };
}

/** A luminous ring — points hug a circle with a soft radial scatter. */
export function ring(n, radius = 320) {
  const positions = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    // Tight band around the ring; sqrt keeps the band visually even.
    const rr = radius * (0.82 + gauss() * 0.06);
    positions[i * 2] = Math.cos(a) * rr;
    positions[i * 2 + 1] = Math.sin(a) * rr;
  }
  return { positions, density: computeDensity(positions, radius * 0.05) };
}
