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

/**
 * A faint structure grid — stand-in for real geography (coast, axes, mountain).
 * STRUCTURE points carry no density meaning; we hand a flat value so the engine's
 * data-only density logic is bypassed for this role. This is throwaway: Stage 1
 * replaces it with a real Cape Town structure function of the same shape.
 */
export function grid(n, extent = 760, lines = 22) {
  const positions = new Float32Array(n * 2);
  const half = extent / 2;
  const step = extent / (lines - 1);
  for (let i = 0; i < n; i++) {
    // Lay each point on a random gridline, jittered slightly off it.
    if (Math.random() < 0.5) {
      const gx = -half + Math.round(Math.random() * (lines - 1)) * step;
      positions[i * 2] = gx + (Math.random() - 0.5) * 1.5;
      positions[i * 2 + 1] = -half + Math.random() * extent;
    } else {
      const gy = -half + Math.round(Math.random() * (lines - 1)) * step;
      positions[i * 2] = -half + Math.random() * extent;
      positions[i * 2 + 1] = gy + (Math.random() - 0.5) * 1.5;
    }
  }
  return { positions, density: new Float32Array(n).fill(0.5) };
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
