/**
 * bake.mjs — the Stage-1 data pipeline (download → process → bake static asset).
 *
 * Inputs:
 *   data/raw/stations.geojson   — WC police stations, real lng/lat (WC GIS, no login)
 *   data/raw/precincts.geojson  — WC police precinct polygons (WC GIS, no login)
 *   data/raw/sa_crime.csv       — REAL SAPS station-level crime counts, 2005/06–2015/16
 *                                 (the cleaned OpenUp/Kaggle SAPS set; per station, per
 *                                 category, per financial year). Robbery = aggravated +
 *                                 common robbery, summed per station per year.
 *
 * Output:
 *   public/data/capetown.json   — the baked asset the page loads. No backend.
 *
 * REAL: station coordinates, precinct boundaries, AND the robbery counts. The only
 * placeholder left is the per-station POPULATION proxy (for a future per-capita
 * view — the real census→precinct join is still pending), so per-capita is off by
 * default and the raw view shown is fully real. Honesty = fidelity.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator } from 'd3-geo';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const read = (p) => JSON.parse(readFileSync(ROOT + p, 'utf8'));
const norm = (key) => key.toUpperCase().replace(/[^A-Z]/g, '');

// ---- framing ----------------------------------------------------------------
const METRO = { minLng: 18.30, maxLng: 19.05, minLat: -34.40, maxLat: -33.45 };
const inMetro = (lng, lat) =>
  lng >= METRO.minLng && lng <= METRO.maxLng && lat >= METRO.minLat && lat <= METRO.maxLat;
const W = 760, H = 820, PAD = 60; // projected target box (centred on 0 later)

// Robbery = aggravated + common. The premises/bank/CIT categories are SAPS
// sub-types of aggravated robbery, so including them would double-count.
const ROBBERY = new Set(['Robbery with aggravating circumstances', 'Common robbery']);

// ---- per-station POPULATION proxy (for the future per-capita view only) ------
// Real census→precinct join is still TODO; until then per-capita is off by default.
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

// ---- read the real crime CSV → robbery per station per year -----------------
const csvLines = readFileSync(ROOT + 'data/raw/sa_crime.csv', 'utf8').trim().split(/\r?\n/);
const header = csvLines[0].split(',');
const YEAR_COLS = header.slice(3); // e.g. "2005-2006" .. "2015-2016"
const YEARS = YEAR_COLS.map((c) => parseInt(c, 10)); // start year ints 2005..2015
const YEAR_LABELS = YEAR_COLS.map((c) => c.slice(0, 4) + '/' + c.slice(7, 9)); // "2005/06"

const robberyByStation = new Map(); // normName -> Float64Array over YEAR_COLS
for (let i = 1; i < csvLines.length; i++) {
  const cells = csvLines[i].split(',');
  if (cells[0] !== 'Western Cape') continue;
  if (!ROBBERY.has(cells[2])) continue;
  const key = norm(cells[1]);
  let arr = robberyByStation.get(key);
  if (!arr) { arr = new Float64Array(YEAR_COLS.length); robberyByStation.set(key, arr); }
  for (let y = 0; y < YEAR_COLS.length; y++) arr[y] += Number(cells[3 + y]) || 0;
}

// ---- load + filter geography ------------------------------------------------
const stationsRaw = read('data/raw/stations.geojson').features
  .filter((f) => f.geometry && inMetro(...f.geometry.coordinates));
const precinctsRaw = read('data/raw/precincts.geojson').features.filter((f) => {
  const ring = firstRing(f.geometry);
  if (!ring) return false;
  let lng = 0, lat = 0;
  for (const [x, y] of ring) { lng += x; lat += y; }
  return inMetro(lng / ring.length, lat / ring.length);
});

// ---- projection (d3-geo, upstream — fit to vertices-as-POINTS) --------------
// (ArcGIS rings wind clockwise; fitting d3 to the polygons reads global bounds.)
const fitPoints = [];
for (const f of precinctsRaw) for (const ring of allRings(f.geometry)) for (const c of ring) fitPoints.push(c);
for (const f of stationsRaw) fitPoints.push(f.geometry.coordinates);
const proj = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: 'MultiPoint', coordinates: fitPoints });
const project = ([lng, lat]) => { const [px, py] = proj([lng, lat]); return [px - W / 2, H / 2 - py]; };

// ---- precinct radius (honest jitter — "around here", precinct-scaled) --------
const radiusByName = new Map();
for (const f of precinctsRaw) {
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

// ---- build station records (real xy + real counts + pop proxy) --------------
const unmatched = [];
const stations = [];
for (const f of stationsRaw) {
  const name = f.properties.PoliceStat || f.properties.COMPNT_NM;
  const key = norm(f.properties.COMPNT_NM || name);
  const robbery = robberyByStation.get(key);
  if (!robbery) { unmatched.push(name); continue; } // no crime record (e.g. newer station)
  const [x, y] = project(f.geometry.coordinates);
  const r = radiusByName.get(key) ?? 22;
  const counts = {};
  YEARS.forEach((yr, i) => { counts[yr] = Math.round(robbery[i]); });
  stations.push({ name, x: +x.toFixed(1), y: +y.toFixed(1), r: +r.toFixed(1), pop: POP[key] ?? DEFAULT_POP, counts });
}
console.log(`metro stations matched: ${stations.length} (unmatched: ${unmatched.join(', ') || 'none'})`);

// ---- structure: sample real precinct boundaries as grey points --------------
const structure = [];
const STEP = 1.7;
for (const f of precinctsRaw) {
  for (const ring of allRings(f.geometry)) {
    let prev = null;
    for (const c of ring) {
      const p = project(c);
      if (prev) {
        const dx = p[0] - prev[0], dy = p[1] - prev[1];
        const steps = Math.max(1, Math.floor(Math.hypot(dx, dy) / STEP));
        for (let s = 0; s < steps; s++) {
          const tt = s / steps;
          structure.push(+(prev[0] + dx * tt).toFixed(1), +(prev[1] + dy * tt).toFixed(1));
        }
      }
      prev = p;
    }
  }
}

// ---- sanity read: real totals + where the hotspot moved ---------------------
const totalByYear = {};
YEARS.forEach((yr) => { totalByYear[yr] = stations.reduce((a, s) => a + s.counts[yr], 0); });
console.log('real robbery totals by year:', totalByYear);
const top = (yr) => [...stations].sort((a, b) => b.counts[yr] - a.counts[yr]).slice(0, 3).map((s) => `${s.name}(${s.counts[yr]})`);
console.log(`top-3 ${YEAR_LABELS[0]}:`, top(YEARS[0]).join(', '));
console.log(`top-3 ${YEAR_LABELS[YEARS.length - 1]}:`, top(YEARS[YEARS.length - 1]).join(', '));
console.log(`structure points: ${structure.length / 2}`);

const asset = {
  meta: {
    title: 'Cape Town — robbery',
    simulated: false,
    source: 'SAPS station-level crime stats (aggravated + common robbery), 2005/06–2015/16. Geography: WC GIS.',
    note: 'Counts, coordinates and precinct boundaries are REAL. Per-station population is a proxy (per-capita view pending the real census join).',
    years: YEARS,
    yearLabels: YEAR_LABELS,
    box: { w: W, h: H },
  },
  stations,
  structure,
};
writeFileSync(ROOT + 'public/data/capetown.json', JSON.stringify(asset));
console.log(`baked public/data/capetown.json (${stations.length} stations, ${YEARS.length} years)`);

// ---- geometry helpers -------------------------------------------------------
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
