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
 * Build fixed-buffer layouts for EVERY crime, sharing one point buffer so the field
 * can flip between crimes as smoothly as it scrubs years.
 *
 * The buffer (slot count + jitter offsets per station) is sized to the BUSIEST
 * (crime, year) per station — so a rarer crime (murder) leaves most slots parked at
 * the precinct centre (invisible), and flipping robbery→murder reads as the cloud
 * CONTRACTING to a few embers. That sparseness is the honest signal: murder really
 * is ~8× rarer. Density-colour is normalised PER CRIME (across its own years), so
 * each crime's spatial pattern still glows legibly instead of washing out — volume
 * lives in the dot COUNT, pattern lives in the colour.
 *
 * @returns {{ years:number[], count:number,
 *             layouts:Record<string,{positions:Float32Array,density:Float32Array}[]>,
 *             totals:Record<string,number[]> }}
 */
export function buildCrimeLayouts(data, { types, mode = 'raw', roost = 700 } = {}) {
  const years = data.meta.years;
  const stations = data.stations;
  const rng = mulberry32(0x1234);

  const valueOf = (s, type, y) => {
    const c = s.crimes[type][y] || 0;
    return mode === 'percapita' ? (c / s.pop) * PC_SCALE : c;
  };

  // Shared slot allocation: K = busiest (crime, year) per station → constant buffer
  // across every crime, so a slot keeps its identity through BOTH a flip and a scrub.
  const slots = stations.map((s) => {
    let peak = 0;
    for (const type of types) for (const y of years) peak = Math.max(peak, valueOf(s, type, y));
    const K = Math.max(0, Math.round(peak / PER_POINT));
    const offs = new Float32Array(K * 2);
    for (let j = 0; j < K; j++) {
      // Gaussian falloff from the precinct centre — denser core, fading edge.
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

  // Per-slot "roost" — an OFF-SCREEN waiting spot out past the frame edge, in the
  // direction of the station (jittered). A parked dot flies OUT to its roost when its
  // hotspot cools and flies BACK IN when it fills — so the field reads as a living
  // swarm gathering and dispersing, not points blinking on at a centroid.
  const roostPos = new Float32Array(COUNT * 2);
  for (const sl of slots) {
    const central = Math.hypot(sl.s.x, sl.s.y) < 30; // stations near the centre → random bearing
    const baseAng = Math.atan2(sl.s.y, sl.s.x);
    for (let j = 0; j < sl.K; j++) {
      const idx = sl.base + j;
      const ang = central ? rng() * TAU : baseAng + (rng() - 0.5) * 0.9;
      const rr = roost * (0.8 + rng() * 0.5);
      roostPos[idx * 2] = Math.cos(ang) * rr;
      roostPos[idx * 2 + 1] = Math.sin(ang) * rr;
    }
  }

  const layouts = {};
  const totals = {};
  for (const type of types) {
    // Pass 1 — each year's positions + RAW cross-precinct neighbour crowding.
    const per = years.map((y) => {
      const positions = new Float32Array(COUNT * 2);
      const activeXY = [];
      const activeIdx = [];
      for (const sl of slots) {
        const n = Math.min(sl.K, Math.round(valueOf(sl.s, type, y) / PER_POINT));
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
            // parked OFF-SCREEN at the slot's roost (invisible); flies back in when
            // the hotspot fills again, instead of growing from the centre.
            positions[idx * 2] = roostPos[idx * 2];
            positions[idx * 2 + 1] = roostPos[idx * 2 + 1];
          }
        }
      }
      return { positions, activeIdx, raw: neighbourCounts(Float32Array.from(activeXY), DENSITY_CELL) };
    });

    // GLOBAL normalisation across THIS crime's years (not per-year, not cross-crime):
    // year-over-year growth stays visible, and each crime keeps its own legible ramp.
    let gMax = 1;
    for (const p of per) for (let k = 0; k < p.raw.length; k++) if (p.raw[k] > gMax) gMax = p.raw[k];

    layouts[type] = per.map((p) => {
      const density = new Float32Array(COUNT);
      for (let k = 0; k < p.activeIdx.length; k++) {
        const d = Math.pow(Math.min(p.raw[k] / gMax, 1), 0.55);
        density[p.activeIdx[k]] = ACTIVE_FLOOR + (1 - ACTIVE_FLOOR) * d;
      }
      return { positions: p.positions, density };
    });

    totals[type] = years.map((y) => stations.reduce((a, s) => a + (s.crimes[type][y] || 0), 0));
  }

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
