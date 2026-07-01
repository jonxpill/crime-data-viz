/**
 * bake.mjs — the Stage-1 data pipeline (download → process → bake static asset).
 *
 * Inputs:
 *   pipeline/sapacr-2008-2023-v1.1/sapacr-2008-2023-v1.1.csv
 *       — SAPS Annual Crime Records, 2008/09–2022/23 (DataFirst cat. 1012). ONE row
 *         per station per financial year, wide across crime types, with built-in
 *         longitude/latitude and a local-municipality field.
 *   data/raw/precincts.geojson
 *       — WC police precinct polygons (WC GIS, no login). Used only for the grey
 *         STRUCTURE outline + the per-precinct jitter radius, matched to each station
 *         by name (all 60 Cape Town stations match a precinct exactly).
 *
 * Output:
 *   public/data/capetown.json   — the baked asset the page loads. No backend.
 *
 * Each station carries counts for EVERY crime in CRIMES, per year, so the field can
 * flip between crimes (robbery ↔ murder …) as well as scrub years. Robbery =
 * aggravated + common (the bank/premises/CIT columns are SAPS sub-types of aggravated,
 * so adding them would double-count).
 *
 * REAL: coordinates, precinct boundaries, AND the counts (2008–2023). Stations
 * SELF-LOCATE from the crime file; population is still a proxy (per-capita off by
 * default) — the WorldPop join is the next step.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator } from 'd3-geo';
import { fromFile } from 'geotiff';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const read = (p) => JSON.parse(readFileSync(ROOT + p, 'utf8'));
const norm = (key) => key.toUpperCase().replace(/[^A-Z]/g, '');
const titleCase = (s) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const W = 760, H = 820, PAD = 60; // projected target box (centred on 0 later)

// ---- the crimes we bake (key → SAPACR columns summed) ------------------------
// A new flippable view = one more entry here. Robbery is aggravated + common.
const CRIMES = [
  { key: 'robbery',  label: 'robbery',  cols: ['aggr_robbery', 'common_robbery'] },
  { key: 'burglary', label: 'burglary', cols: ['burglary_res'] },
  { key: 'murder',   label: 'murder',   cols: ['murder'] },
];

// ---- per-station POPULATION proxy (for the future per-capita view only) ------
// Real WorldPop → precinct join is the next step; until then per-capita is off by
// default. Keyed by normalised station name; anything absent falls back to default.
const POP = {
  NYANGA: 260000, KHAYELITSHA: 390000, HARARE: 220000, GUGULETHU: 160000,
  PHILIPPI: 200000, DELFT: 210000, MFULENI: 120000, MITCHELLSPLAIN: 310000,
  KRAAIFONTEIN: 200000, BISHOPLAVIS: 130000, MANENBERG: 95000, LWANDLE: 80000,
  KLEINVLEI: 130000, CAPETOWNCENTRAL: 50000, ATHLONE: 110000, ELSIESRIVER: 90000,
  RAVENSMEAD: 70000, BELLVILLE: 110000, KUILSRIVER: 130000, PAROW: 90000,
  GOODWOOD: 80000, WYNBERG: 100000, GRASSYPARK: 90000, STRAND: 90000,
  SOMERSETWEST: 90000, MUIZENBERG: 60000, TABLEVIEW: 110000, MILNERTON: 90000,
  RONDEBOSCH: 60000, CLAREMONT: 70000, SEAPOINT: 40000, CAMPSBAY: 12000,
  HOUTBAY: 40000, FISHHOEK: 35000, SIMONSTOWN: 15000, CONSTANTIA: 30000,
  DIEPRIVIER: 45000, PINELANDS: 30000, DURBANVILLE: 90000, BRACKENFELL: 80000,
};
const DEFAULT_POP = 70000;

// ---- read the SAPACR CSV → per-crime counts per Cape Town station per year ---
// Read as latin1: the file has a few non-UTF8 bytes in outside-metro names; every
// field we touch (year, station, coords, crime cols, city of cape town) is ASCII.
const csvLines = readFileSync(ROOT + 'pipeline/sapacr-2008-2023-v1.1/sapacr-2008-2023-v1.1.csv', 'latin1')
  .trim().split(/\r?\n/);
const head = parseCSVLine(csvLines[0]);
const idx = Object.fromEntries(head.map((h, i) => [h, i]));
const crimeIdx = CRIMES.map((cr) => ({ ...cr, ii: cr.cols.map((c) => idx[c]) }));

const stationMap = new Map(); // normName -> { name, key, lng, lat, crimes:{type:{year:n}} }
const yearSet = new Set();
for (let i = 1; i < csvLines.length; i++) {
  const c = parseCSVLine(csvLines[i]);
  if ((c[idx.loc_mn] || '').trim().toLowerCase() !== 'city of cape town') continue;
  const yr = parseInt(c[idx.year], 10); // "2008/2009" -> 2008
  yearSet.add(yr);
  const key = norm(c[idx.station]);
  let st = stationMap.get(key);
  if (!st) {
    st = { name: c[idx.station], key, lng: +c[idx.longitude], lat: +c[idx.latitude], crimes: {} };
    for (const cr of crimeIdx) st.crimes[cr.key] = {};
    stationMap.set(key, st);
  }
  for (const cr of crimeIdx) {
    const v = cr.ii.reduce((a, j) => a + (Number(c[j]) || 0), 0);
    st.crimes[cr.key][yr] = (st.crimes[cr.key][yr] || 0) + v;
  }
}
const YEARS = [...yearSet].sort((a, b) => a - b);                        // 2008 .. 2022
const YEAR_LABELS = YEARS.map((y) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`); // "2008/09"
const stationList = [...stationMap.values()];

// ---- geography: keep only the precincts of OUR stations ----------------------
const stationKeys = new Set(stationList.map((s) => s.key));
const precincts = read('data/raw/precincts.geojson').features
  .filter((f) => stationKeys.has(norm(f.properties.COMPNT_NM || '')));

// ---- projection (d3-geo, upstream — fit to vertices-as-POINTS) --------------
// (ArcGIS rings wind clockwise; fitting d3 to the polygons reads global bounds.)
const fitPoints = [];
for (const f of precincts) for (const ring of allRings(f.geometry)) for (const c of ring) fitPoints.push(c);
for (const s of stationList) fitPoints.push([s.lng, s.lat]);
const proj = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: 'MultiPoint', coordinates: fitPoints });
const project = ([lng, lat]) => { const [px, py] = proj([lng, lat]); return [px - W / 2, H / 2 - py]; };

// ---- precinct radius (honest jitter — "around here", precinct-scaled) --------
const radiusByName = new Map();
for (const f of precincts) {
  const ring = firstRing(f.geometry);
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const c of ring) {
    const [x, y] = project(c);
    minx = Math.min(minx, x); maxx = Math.max(maxx, x);
    miny = Math.min(miny, y); maxy = Math.max(maxy, y);
  }
  const r = 0.52 * (((maxx - minx) + (maxy - miny)) / 2);
  radiusByName.set(norm(f.properties.COMPNT_NM || ''), Math.max(12, Math.min(r, 120)));
}

// ---- build station records (real xy + real per-crime counts + pop proxy) ----
const stations = stationList.map((s) => {
  const [x, y] = project([s.lng, s.lat]);
  const crimes = {};
  for (const cr of CRIMES) {
    crimes[cr.key] = {};
    YEARS.forEach((yr) => { crimes[cr.key][yr] = Math.round(s.crimes[cr.key][yr] || 0); });
  }
  return {
    name: titleCase(s.name),
    x: +x.toFixed(1), y: +y.toFixed(1),
    r: +(radiusByName.get(s.key) ?? 22).toFixed(1),
    pop: POP[s.key] ?? DEFAULT_POP,
    crimes,
  };
});
console.log(`Cape Town stations: ${stations.length} · years ${YEAR_LABELS[0]}–${YEAR_LABELS.at(-1)} · crimes: ${CRIMES.map((c) => c.key).join(', ')}`);

// ---- structure: sample real precinct boundaries as grey points --------------
const structure = [];
// Walk each precinct ring at a CONSTANT arc-length step so boundary dots are evenly
// spaced no matter how the polygon vertices fall. The old per-edge sampler forced ≥1 dot
// per edge, so dense-vertex outlines couldn't get any denser — halving the spacing barely
// moved the count. Uniform spacing lets us spend the pool waiting off-screen: MANY small
// dots, never bigger ones. Keep the total under the land-dot count (they live in that pool).
const STEP = 0.38; // units between boundary dots along the outline (denser = more little dots)
for (const f of precincts) {
  for (const ring of allRings(f.geometry)) {
    const pts = ring.map(project);
    let acc = 0; // distance walked since the last dot, carried across edges
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], ay = pts[i - 1][1];
      const dx = pts[i][0] - ax, dy = pts[i][1] - ay;
      const segLen = Math.hypot(dx, dy);
      if (segLen === 0) continue;
      for (let d = STEP - acc; d <= segLen; d += STEP) {
        const tt = d / segLen;
        structure.push(+(ax + dx * tt).toFixed(1), +(ay + dy * tt).toFixed(1));
      }
      acc = (acc + segLen) % STEP; // leftover into the next edge keeps spacing continuous
    }
  }
}

// ---- terrain: sample a DEM into an elevation grid over the projected box -----
// AWS Terrain Tiles (z10, 12 tiles, metres) → one mosaic; invert each grid node
// back to lng/lat through the SAME projection and read its height. Sea (negative
// bathymetry) clamps to 0. The client lifts these into a grey relief — the
// structure "doing its job" as the actual land. Re-fetch tiles: see README / the
// curl loop in data/raw/terrain (elevation-tiles-prod, no login).
const TILE = 512, TZ = 10, TX0 = 564, TY0 = 613, TNX = 3, TNY = 4;
const MOS_W = TNX * TILE, MOS_H = TNY * TILE;
const mosaic = new Float32Array(MOS_W * MOS_H);
for (let tx = 0; tx < TNX; tx++) {
  for (let ty = 0; ty < TNY; ty++) {
    const img = await (await fromFile(`${ROOT}data/raw/terrain/${TZ}_${TX0 + tx}_${TY0 + ty}.tif`)).getImage();
    const [band] = await img.readRasters();
    for (let py = 0; py < TILE; py++)
      for (let px = 0; px < TILE; px++)
        mosaic[(ty * TILE + py) * MOS_W + (tx * TILE + px)] = band[py * TILE + px];
  }
}
const MERC = 20037508.342789244;        // half the Web-Mercator extent (metres)
const WORLD_PX = TILE * (1 << TZ);       // full-world pixels at z10
const oxpx = TX0 * TILE, oypx = TY0 * TILE; // mosaic top-left in world pixels
function elevAt(lng, lat) {
  const X = (lng * Math.PI / 180) * 6378137;
  const Y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * 6378137;
  const gx = (X + MERC) / (2 * MERC) * WORLD_PX - oxpx;
  const gy = (MERC - Y) / (2 * MERC) * WORLD_PX - oypx;
  if (gx < 0 || gy < 0 || gx >= MOS_W - 1 || gy >= MOS_H - 1) return -9999; // out of DEM → treat as ocean (culled)
  const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const a = mosaic[y0 * MOS_W + x0], b = mosaic[y0 * MOS_W + x0 + 1];
  const c = mosaic[(y0 + 1) * MOS_W + x0], d = mosaic[(y0 + 1) * MOS_W + x0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
const TGX = 300, TGY = 324;              // terrain grid resolution over the box (dense = reads as a surface)
const elev = new Array(TGX * TGY);
let emax = 0;
for (let j = 0; j < TGY; j++) {
  for (let i = 0; i < TGX; i++) {
    const [lng, lat] = proj.invert([(i / (TGX - 1)) * W, (j / (TGY - 1)) * H]);
    const e = Math.round(elevAt(lng, lat)); // signed: < 0 = below sea level (ocean)
    elev[j * TGX + i] = e;
    if (e > emax) emax = e;
  }
}
console.log(`terrain grid: ${TGX}×${TGY} (${TGX * TGY} pts) · peak ${emax} m`);

// ---- sanity read: real totals + where each hotspot moved --------------------
for (const cr of CRIMES) {
  const totalByYear = {};
  YEARS.forEach((yr) => { totalByYear[yr] = stations.reduce((a, s) => a + s.crimes[cr.key][yr], 0); });
  const top = (yr) => [...stations].sort((a, b) => b.crimes[cr.key][yr] - a.crimes[cr.key][yr]).slice(0, 3).map((s) => `${s.name}(${s.crimes[cr.key][yr]})`);
  console.log(`\n${cr.label}: ${YEAR_LABELS[0]}=${totalByYear[YEARS[0]]} … ${YEAR_LABELS.at(-1)}=${totalByYear[YEARS.at(-1)]}`);
  console.log(`  top-3 ${YEAR_LABELS[0]}:`, top(YEARS[0]).join(', '));
  console.log(`  top-3 ${YEAR_LABELS.at(-1)}:`, top(YEARS.at(-1)).join(', '));
}
console.log(`\nstructure points: ${structure.length / 2}`);

const asset = {
  meta: {
    title: 'Cape Town — crime',
    simulated: false,
    source: 'SAPS Annual Crime Records (robbery = aggravated + common; murder), 2008/09–2022/23, DataFirst cat. 1012. Geography: WC GIS precincts.',
    note: 'Counts, coordinates and precinct boundaries are REAL. Per-station population is a proxy (per-capita view pending the WorldPop join).',
    crimeTypes: CRIMES.map(({ key, label }) => ({ key, label })),
    years: YEARS,
    yearLabels: YEAR_LABELS,
    box: { w: W, h: H },
  },
  stations,
  structure,
  terrain: { cols: TGX, rows: TGY, peak: emax, elev },
};
writeFileSync(ROOT + 'public/data/capetown.json', JSON.stringify(asset));
console.log(`baked public/data/capetown.json (${stations.length} stations, ${YEARS.length} years, ${CRIMES.length} crimes)`);

// ---- helpers ----------------------------------------------------------------
function parseCSVLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
function firstRing(geom) {
  if (!geom) return null;
  if (geom.type === 'Polygon') return geom.coordinates[0];
  if (geom.type === 'MultiPolygon') return geom.coordinates[0][0];
  return null;
}
function* allRings(geom) {
  if (!geom) return;
  if (geom.type === 'Polygon') { for (const r of geom.coordinates) yield r; }
  else if (geom.type === 'MultiPolygon') { for (const poly of geom.coordinates) for (const r of poly) yield r; }
}
