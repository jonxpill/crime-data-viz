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
  const data = await res.json();
  // Elevation ships as a separate compact Int16 binary (see bake.mjs). Load it and attach as
  // terrain.elev so every downstream layout reads it exactly as before (just far finer).
  if (data.terrain && data.terrain.dem && !data.terrain.elev) {
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    const demRes = await fetch(base + data.terrain.dem);
    if (!demRes.ok) throw new Error('failed to load ' + data.terrain.dem);
    data.terrain.elev = new Int16Array(await demRes.arrayBuffer());
  }
  return data;
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

  // Terrain height under each crime dot (sampled from the baked DEM) so in the terrain view
  // the crime "climbs" the relief — high-ground crime rides the mountains, the flats stay low.
  const T = data.terrain;
  const crimeZ = new Float32Array(COUNT);
  if (T) {
    const BW = data.meta.box.w, BH = data.meta.box.h;
    for (const sl of slots) {
      for (let j = 0; j < sl.K; j++) {
        const x = sl.s.x + sl.offs[j * 2], y = sl.s.y + sl.offs[j * 2 + 1];
        const gi = Math.max(0, Math.min(T.cols - 1, Math.round(((x + BW / 2) / BW) * (T.cols - 1))));
        const gj = Math.max(0, Math.min(T.rows - 1, Math.round(((BH / 2 - y) / BH) * (T.rows - 1))));
        const e = T.elev[gj * T.cols + gi];
        crimeZ[sl.base + j] = (e > 0 ? e / T.peak : 0) + 0.04; // +lift → sits ABOVE the land dots
      }
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
      return { positions: p.positions, density, z: crimeZ };
    });

    totals[type] = years.map((y) => stations.reduce((a, s) => a + (s.crimes[type][y] || 0), 0));
  }

  /**
   * PIE layout for one crime + year, reusing the SAME slots (so the map ⇄ pie morph is a
   * conserved swarm — dot i stays with its precinct, it just flies to the wedge). Each precinct's
   * wedge ANGLE = its share of the crime (the honest channel); its active dots even-area-fill the
   * wedge; surplus slots stay parked at their roost (invisible, never faded). Returns the data
   * layout plus the cumulative wedge-boundary angles (the frame draws its spokes there).
   */
  function pieLayout(type, yiArg, { cx = 0, cy = 0, R = 240 } = {}) {
    const y = years[yiArg];
    const counts = stations.map((s) => valueOf(s, type, y));
    const positions = new Float32Array(COUNT * 2);
    const density = new Float32Array(COUNT);
    const rng = mulberry32(0x9e13a7);
    const boundaries = [];
    const activeXY = [], activeIdx = [];
    const dtheta = TAU / slots.length;               // EQUAL slices — each precinct its own wedge
    let theta = -Math.PI / 2;                        // start at 12 o'clock
    for (let si = 0; si < slots.length; si++) {
      const sl = slots[si];
      // dots in THIS wedge = this precinct's crime count, so a dense wedge = a high-crime precinct
      // (density = light). Surplus slots fly away to their roost — Nyanga packs its wedge, Camps Bay
      // barely fills it. Same buffer, so the map ⇄ pie morph stays a conserved swarm.
      const n = Math.min(sl.K, Math.round(counts[si] / PER_POINT));
      for (let j = 0; j < sl.K; j++) {
        const idx = sl.base + j;
        if (j < n) {
          const a = theta + (0.08 + 0.84 * rng()) * dtheta; // small margin so each wedge reads as its own
          const r = Math.sqrt(rng()) * R;            // even fill → areal density IS the crime level
          const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
          positions[idx * 2] = px; positions[idx * 2 + 1] = py;
          activeXY.push(px, py); activeIdx.push(idx);
        } else {
          // surplus flies OUT radially along its own wedge, past the rim (density stays 0 → dims to
          // nothing as it goes). The honest "fly away": fewer crimes this year/crime = fewer dots.
          const a = theta + (0.08 + 0.84 * rng()) * dtheta;
          const rr = R * (1.9 + rng() * 0.9);
          positions[idx * 2] = cx + Math.cos(a) * rr;
          positions[idx * 2 + 1] = cy + Math.sin(a) * rr;
        }
      }
      theta += dtheta;
      boundaries.push(theta);
    }
    // density = local crowding → the centre (where every wedge converges) glows: "density = light".
    const raw = neighbourCounts(Float32Array.from(activeXY), DENSITY_CELL);
    let gMax = 1; for (let k = 0; k < raw.length; k++) if (raw[k] > gMax) gMax = raw[k];
    for (let k = 0; k < activeIdx.length; k++) {
      const d = Math.pow(Math.min(raw[k] / gMax, 1), 0.55);
      density[activeIdx[k]] = ACTIVE_FLOOR + (1 - ACTIVE_FLOOR) * d;
    }
    return { positions, density, boundaries, R, cx, cy };
  }

  return { years, count: COUNT, layouts, totals, pieLayout };
}

/**
 * Structure frame for a pie: n dots strewn along the outline ring + one radial spoke per wedge
 * boundary. Grey/matte (the frame). The SAME structure pool that draws the map band / terrain
 * relief swarms here, so nothing fades — it just reconfigures into the chart's skeleton.
 */
export function pieFrameLayout(n, { cx = 0, cy = 0, R = 240, boundaries = [], frameDots = 26000, thin = 0.5 } = {}) {
  const positions = new Float32Array(n * 2), density = new Float32Array(n), z = new Float32Array(n);
  const rng = mulberry32(0x5eed1e);
  const nb = boundaries.length || 1;
  // Only `frameDots` draw the thin ring + spokes; the SURPLUS flies away to an off-screen roost
  // (invisible, no pile-up) so the frame stays a crisp thin skeleton, not a blown annulus.
  const used = Math.min(n, frameDots);
  const RING = Math.floor(used * 0.32);
  for (let k = 0; k < n; k++) {
    if (k < RING) {                                  // thin ring
      const a = rng() * TAU, r = R + gauss(rng) * thin;
      positions[k * 2] = cx + Math.cos(a) * r;
      positions[k * 2 + 1] = cy + Math.sin(a) * r;
      density[k] = 0.5;
    } else if (k < used) {                           // thin radial spokes at the wedge boundaries
      const a = boundaries[(k - RING) % nb];
      const r = rng() * R, off = gauss(rng) * thin;
      positions[k * 2] = cx + Math.cos(a) * r - Math.sin(a) * off;
      positions[k * 2 + 1] = cy + Math.sin(a) * r + Math.cos(a) * off;
      density[k] = 0.5;
    } else {                                         // surplus → fly away off-screen (roost), invisible
      const a = rng() * TAU, r = 900 * (0.8 + rng() * 0.5);
      positions[k * 2] = cx + Math.cos(a) * r;
      positions[k * 2 + 1] = cy + Math.sin(a) * r;
      density[k] = 0;
    }
  }
  return { positions, density, z };
}

/** Structure layout from the baked precinct boundaries: { positions, density }. */
export function structureLayout(data) {
  const positions = Float32Array.from(data.structure);
  return { positions, density: new Float32Array(positions.length / 2).fill(0.8) };
}

/**
 * Terrain layout from the baked elevation grid: grey points laid on the projected box
 * with a per-point height z (normalised 0..1). Grid orientation matches bake.mjs so the
 * relief registers with the crime + precincts. The engine lifts z via uZScale.
 *
 * A grid has fixed dots-per-GROUND-area, not per-SCREEN-area: a steep face tilted toward
 * the eye stretches its cell-spacing across far more screen height, so the mountains THIN
 * OUT exactly where they rise — and the ragged, dissolving peaks that follows is an
 * accident, not a choice. `fill` counters it: each cell scatters extra samples of the REAL
 * heightfield (bilinear-interpolated z, so they sit ON the surface) in proportion to its
 * slope, so the projected density stays even and the faces gain body + a defined edge.
 */
export function terrainLayout(data, { fill = 4 } = {}) {
  const { cols, rows, peak, elev } = data.terrain;
  const { w: W, h: H } = data.meta.box;
  const rng = mulberry32(0x7e44a1);
  const jit = 0.75 * (W / cols); // scatter points off the grid so no rows/columns read
  const land = (ii, jj) => Math.max(0, elev[Math.max(0, Math.min(cols - 1, ii)) + Math.max(0, Math.min(rows - 1, jj)) * cols]);
  const SLOPE_NORM = 130; // elevation drop (m) between neighbours that reads as a full slope
  // Bilinear height sample at continuous grid coords → an extra dot sits on the real surface.
  const sampleRaw = (gi, gj) => {
    const i0 = Math.max(0, Math.min(cols - 1, Math.floor(gi))), j0 = Math.max(0, Math.min(rows - 1, Math.floor(gj)));
    const i1 = Math.min(cols - 1, i0 + 1), j1 = Math.min(rows - 1, j0 + 1);
    const fx = gi - i0, fy = gj - j0;
    const a = elev[i0 + j0 * cols], b = elev[i1 + j0 * cols], c = elev[i0 + j1 * cols], d = elev[i1 + j1 * cols];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
  const px = [], pz = [], pd = [];
  // Emit one dot at continuous grid coords (gi,gj): projected xy (+jitter), height z, brightness.
  const emit = (gi, gj) => {
    const cx = -W / 2 + (gi / (cols - 1)) * W;
    const cy = H / 2 - (gj / (rows - 1)) * H;
    px.push(cx + (rng() - 0.5) * 2 * jit, cy + (rng() - 0.5) * 2 * jit);
    const raw = sampleRaw(gi, gj);
    if (raw < 0) { pz.push(0); pd.push(0); return; } // ocean → hidden; the land ends at the coastline
    const h = peak ? Math.min(1, raw / peak) : 0;
    const ii = Math.round(gi), jj = Math.round(gj);
    const slope = Math.min(1, Math.hypot(land(ii + 1, jj) - land(ii - 1, jj), land(ii, jj + 1) - land(ii, jj - 1)) / SLOPE_NORM);
    pz.push(h);
    // brighter the HIGHER the land and the STEEPER the slope (ridges + faces glow).
    // steep gamma on h + low base sinks the flats deep into the dark; the ridges keep the light.
    pd.push(0.03 + 0.6 * Math.pow(h, 1.6) + 0.6 * slope);
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      emit(i, j); // the grid node itself
      const raw = elev[j * cols + i];
      if (raw < 0) continue; // no fill over ocean
      const slope = Math.min(1, Math.hypot(land(i + 1, j) - land(i - 1, j), land(i, j + 1) - land(i, j - 1)) / SLOPE_NORM);
      const extra = Math.round(fill * slope); // steep faces get the most fill; flats get none
      for (let e = 0; e < extra; e++) emit(i + (rng() - 0.5) * 2, j + (rng() - 0.5) * 2);
    }
  }
  return { positions: Float32Array.from(px), density: Float32Array.from(pd), z: Float32Array.from(pz) };
}

/**
 * ONE tool swarm, land-only BAND. EVERY land dot (~44k) starts on the precinct outlines, scattered
 * into a soft world-space ribbon — that IS the overhead map, now with body. The ocean dots sit
 * culled. The target is terrainLayout (each dot → its own landscape spot), so map ⇄ terrain is a
 * pure ON-SCREEN reconfiguration: the boundary band spreads out to BECOME the relief and back —
 * still a staggered swarm, but launched from the boundary, not flown in from off-screen. No
 * reservoir, no fly-in: everything you see rebuilds out of what's already on screen.
 */
export function structureMapSource(data, terr, { band = 0.4 } = {}) {
  const centre = data.structure;             // baked outline centreline points (flat xy)
  const C = centre.length / 2;
  const n = terr.density.length;
  const positions = new Float32Array(n * 2);
  const density = new Float32Array(n);
  const rng = mulberry32(0x5eed1e);
  const landIdx = [];
  for (let idx = 0; idx < n; idx++) if (terr.density[idx] > 0) landIdx.push(idx);
  const L = landIdx.length || 1;
  for (let k = 0; k < L; k++) {
    const idx = landIdx[k];
    const c = Math.min(C - 1, Math.floor((k * C) / L)); // spread land dots along the whole outline
    positions[idx * 2] = centre[c * 2] + gauss(rng) * band;        // soft ribbon, world-space width
    positions[idx * 2 + 1] = centre[c * 2 + 1] + gauss(rng) * band;
    density[idx] = 0.35;                       // matte, recessive
  }
  for (let idx = 0; idx < n; idx++) {
    if (terr.density[idx] > 0) continue;        // ocean → stays culled (density 0); park at its own cell
    positions[idx * 2] = terr.positions[idx * 2];
    positions[idx * 2 + 1] = terr.positions[idx * 2 + 1];
  }
  return { positions, density, z: terr.z };
}

/**
 * Detail-on-demand terrain (neighbourhood LOD). A FIXED dot budget (GX×GY) is laid out to
 * fill the current VIEWPORT rect (map-local cx,cy ± hw,hh), each dot sampling the DEM at its
 * own world position. The dot count is DECOUPLED from the DEM resolution: zoom the viewport
 * smaller and the same dots pack into it, sampling a finer patch → detail blooms. Zoom out and
 * they spread to a coarse overview. "Whatever's on screen gets the full budget."
 *
 * Honest: the detail is REAL (sampled from the baked DEM); it only grows until you hit the DEM's
 * native resolution, then holds. Terrain only — crime is never LOD'd (no fake street precision).
 */
export function terrainViewLayout(data, view, GX, GY) {
  const { cx, cy, hw, hh } = view;
  const { cols, rows, peak, elev } = data.terrain;
  const { w: W, h: H } = data.meta.box;
  const rng = mulberry32(0x7e44a1);
  const SLOPE_NORM = 130;
  const cGi = (v) => (v < 0 ? 0 : v > cols - 1 ? cols - 1 : v);
  const cGj = (v) => (v < 0 ? 0 : v > rows - 1 ? rows - 1 : v);
  const land = (ii, jj) => { const e = elev[cGi(ii) + cGj(jj) * cols]; return e > 0 ? e : 0; };
  const sampleRaw = (gi, gj) => { // bilinear DEM height at continuous grid coords
    const gci = cGi(gi), gcj = cGj(gj);
    const i0 = Math.floor(gci), j0 = Math.floor(gcj);
    const i1 = Math.min(cols - 1, i0 + 1), j1 = Math.min(rows - 1, j0 + 1);
    const fx = gci - i0, fy = gcj - j0;
    const a = elev[i0 + j0 * cols], b = elev[i1 + j0 * cols], c = elev[i0 + j1 * cols], d = elev[i1 + j1 * cols];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
  const n = GX * GY;
  const positions = new Float32Array(n * 2), z = new Float32Array(n), density = new Float32Array(n);
  const cellW = (2 * hw) / GX, cellH = (2 * hh) / GY;
  // Place dot `idx` at (x,y) IF it's on land (filling its height + brightness); false over the sea.
  const placeLand = (idx, x, y) => {
    const gi = ((x + W / 2) / W) * (cols - 1), gj = ((H / 2 - y) / H) * (rows - 1);
    if (gi < 0 || gj < 0 || gi > cols - 1 || gj > rows - 1) return false;
    const raw = sampleRaw(gi, gj);
    if (raw < 0) return false;
    positions[idx * 2] = x; positions[idx * 2 + 1] = y;
    const h = peak ? Math.min(1, raw / peak) : 0;
    const ii = Math.round(gi), jj = Math.round(gj);
    const slope = Math.min(1, Math.hypot(land(ii + 1, jj) - land(ii - 1, jj), land(ii, jj + 1) - land(ii, jj - 1)) / SLOPE_NORM);
    z[idx] = h;
    density[idx] = 0.03 + 0.6 * Math.pow(h, 1.6) + 0.6 * slope;
    return true;
  };
  for (let j = 0; j < GY; j++) {
    for (let i = 0; i < GX; i++) {
      const idx = j * GX + i;
      const x = cx + ((i + 0.5) / GX - 0.5) * 2 * hw + (rng() - 0.5) * cellW;
      const y = cy + ((j + 0.5) / GY - 0.5) * 2 * hh + (rng() - 0.5) * cellH;
      if (placeLand(idx, x, y)) continue;                  // on the land → done
      // over the sea (or off the box): don't waste the dot — REDIRECT it onto the land in view, so
      // EVERY dot builds the landscape (~2× denser land, nothing lost to the ocean).
      let ok = false;
      for (let tr = 0; tr < 16 && !ok; tr++) ok = placeLand(idx, cx + (rng() - 0.5) * 2 * hw, cy + (rng() - 0.5) * 2 * hh);
      if (!ok) { positions[idx * 2] = x; positions[idx * 2 + 1] = y; density[idx] = 0; } // no land in view (rare)
    }
  }
  return { positions, density, z };
}

/**
 * Map-view arrangement of the SAME fixed pool, COUPLED to a terrain layout so the map ⇄ terrain
 * morph is honest: a dot that lands on OCEAN in the relief (culled) is parked at that same ocean
 * cell here too — invisible and still — so it never flies out over the sea and vanishes. Only the
 * dots that become LAND ride the visible journey, strewn along the precinct outline as a soft
 * ribbon. (This is the coupling the first viewport spike dropped — hence the "ocean exodus".)
 */
export function bandFor(data, terr, { band = 0.4 } = {}) {
  const centre = data.structure;         // baked outline centreline points (flat xy)
  const C = centre.length / 2;
  const n = terr.density.length;
  const positions = new Float32Array(n * 2), density = new Float32Array(n), z = new Float32Array(n);
  const rng = mulberry32(0x5eed1e);
  const landIdx = [];
  for (let idx = 0; idx < n; idx++) if (terr.density[idx] > 0) landIdx.push(idx);
  const L = landIdx.length || 1;
  for (let k = 0; k < L; k++) {           // land dots → strewn along the whole outline (the ribbon)
    const idx = landIdx[k];
    const c = Math.min(C - 1, Math.floor((k * C) / L));
    positions[idx * 2] = centre[c * 2] + gauss(rng) * band;
    positions[idx * 2 + 1] = centre[c * 2 + 1] + gauss(rng) * band;
    density[idx] = 0.35;                   // matte, recessive
  }
  for (let idx = 0; idx < n; idx++) {      // ocean dots → parked at their own relief cell, invisible
    if (terr.density[idx] > 0) continue;
    positions[idx * 2] = terr.positions[idx * 2];
    positions[idx * 2 + 1] = terr.positions[idx * 2 + 1];
  }
  return { positions, density, z };
}

function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}
