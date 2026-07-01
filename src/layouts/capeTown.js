import { neighbourCounts } from './density.js';

/**
 * Cape Town layouts — the REAL-data instruments. Still just pure functions
 * producing the engine's only contract { positions, density }. The engine has
 * no idea any of this means "robbery" or "Cape Town"; it only ever tweens points.
 *
 * The map is dot-density: each precinct gets N jittered points where N ∝ that
 * year's count (volume is real), scattered within the precinct's own radius
 * (micro-position is jittered — "a lot of crime, around here", never this corner).
 * Colour/glow then EMERGES from how the dots crowd (density = light).
 *
 * Year-scrub coherence: every point keeps a FIXED buffer slot across all years.
 * A slot is sized to the precinct's PEAK year, so the buffer is constant; in a
 * lighter year the surplus slots "park" at the precinct centre with zero density
 * (invisible) and grow back out as crime rises. So scrubbing the years reads as
 * the field breathing in place, not a chaotic reshuffle.
 */

const TAU = Math.PI * 2;
const PER_POINT = 1.0;     // ONE glowing point per robbery — the most honest dial:
                           // a star IS a crime. Sparser + most legible; cores stack
                           // least. (Higher = sparser still; ratio always exact.)
const PC_SCALE = 9000;     // per-capita: points per (rate) — tuned to a similar budget
const DENSITY_CELL = 11;   // neighbour-density grid cell, in projected px
const ACTIVE_FLOOR = 0.06; // an active point never reads as fully parked

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function loadCapeTown(url = 'data/capetown.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('failed to load ' + url);
  return res.json();
}

/**
 * Build one fixed-buffer layout per year.
 * @returns {{ years:number[], count:number, layouts:{positions:Float32Array,density:Float32Array}[], totals:number[] }}
 */
export function buildYearLayouts(data, { mode = 'raw' } = {}) {
  const years = data.meta.years;
  const stations = data.stations;
  const rng = mulberry32(0x1234);

  const valueOf = (s, y) => (mode === 'percapita' ? (s.counts[y] / s.pop) * PC_SCALE : s.counts[y]);

  // Slot allocation: K points per station from its peak year → constant buffer.
  const slots = stations.map((s) => {
    const peak = Math.max(...years.map((y) => valueOf(s, y)));
    const K = Math.max(0, Math.round(peak / PER_POINT));
    const offs = new Float32Array(K * 2);
    for (let j = 0; j < K; j++) {
      // Gaussian falloff from the precinct centre — denser core, fading edge.
      // NO hard radius clamp: clamping pinned ~10% of points to exactly r, which
      // drew a visible ring around every hotspot. Let it taper off naturally.
      const ang = rng() * TAU;
      const rad = Math.abs(gauss(rng)) * 0.5 * s.r;
      offs[j * 2] = Math.cos(ang) * rad;
      offs[j * 2 + 1] = Math.sin(ang) * rad;
    }
    return { s, K, offs };
  });

  let base = 0;
  for (const sl of slots) { sl.base = base; base += sl.K; }
  const COUNT = base;

  // Pass 1 — build each year's positions + RAW neighbour crowding. Active points
  // are gathered for one cross-precinct density pass so adjacent hotspots merge.
  const per = years.map((y) => {
    const positions = new Float32Array(COUNT * 2);
    const activeXY = [];
    const activeIdx = [];
    for (const sl of slots) {
      const n = Math.min(sl.K, Math.round(valueOf(sl.s, y) / PER_POINT));
      for (let j = 0; j < sl.K; j++) {
        const idx = sl.base + j;
        if (j < n) {
          const px = sl.s.x + sl.offs[j * 2];
          const py = sl.s.y + sl.offs[j * 2 + 1];
          positions[idx * 2] = px;
          positions[idx * 2 + 1] = py;
          activeXY.push(px, py);
          activeIdx.push(idx);
        } else {
          // parked at the precinct centre, invisible (density 0), ready to grow.
          positions[idx * 2] = sl.s.x;
          positions[idx * 2 + 1] = sl.s.y;
        }
      }
    }
    return { positions, activeIdx, raw: neighbourCounts(Float32Array.from(activeXY), DENSITY_CELL) };
  });

  // GLOBAL normalisation across every year — the crux of "feeling the shift".
  // Normalising each year to its own max would re-inflate light years to look as
  // full as heavy ones, hiding the very change the scrub exists to show. One max
  // for all years means more crime → genuinely warmer + denser, year over year.
  let gMax = 1;
  for (const p of per) for (let k = 0; k < p.raw.length; k++) if (p.raw[k] > gMax) gMax = p.raw[k];

  // Pass 2 — normalised density per year against the shared global max.
  const layouts = per.map((p) => {
    const density = new Float32Array(COUNT);
    for (let k = 0; k < p.activeIdx.length; k++) {
      const d = Math.pow(Math.min(p.raw[k] / gMax, 1), 0.55);
      density[p.activeIdx[k]] = ACTIVE_FLOOR + (1 - ACTIVE_FLOOR) * d;
    }
    return { positions: p.positions, density };
  });

  const totals = years.map((y) => stations.reduce((a, s) => a + s.counts[y], 0));
  return { years, count: COUNT, layouts, totals };
}

/** Structure layout from the baked precinct boundaries: { positions, density }. */
export function structureLayout(data) {
  const positions = Float32Array.from(data.structure);
  return { positions, density: new Float32Array(positions.length / 2).fill(0.5) };
}

function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}
