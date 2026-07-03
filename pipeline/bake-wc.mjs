/**
 * bake-wc.mjs — bake the WHOLE Western Cape (not just Cape Town) → westerncape.json.
 *
 * Same shape as capetown.json (minus terrain), but keeps ALL Western Cape stations (~150 across
 * City of Cape Town + West Coast + Cape Winelands + Garden Route + Overberg + Central Karoo),
 * projected to fit the province. The crime CSV is national and the precinct GeoJSON is WC-wide, so
 * this is just a wider filter — no new downloads.
 *
 * Per-capita: REAL WorldPop 2020 → precinct zonal join, same method as bake.mjs's Cape Town join,
 * but reading a WINDOW of the NATIONAL raster (data/raw/zaf_ppp_2020_UNadj_constrained.tif) instead
 * of the Cape-Town-only clip — the WC extends well beyond that clip's bbox. Only the WC's pixel
 * window is read (not the whole 43 MB national raster into memory).
 *
 * Re-bake: node pipeline/bake-wc.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator } from 'd3-geo';
import { fromFile } from 'geotiff';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const read = (p) => JSON.parse(readFileSync(ROOT + p, 'utf8'));
const norm = (key) => key.toUpperCase().replace(/[^A-Z]/g, '');
const titleCase = (s) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const W = 940, H = 720, PAD = 46;  // WC is wider than tall → a landscape box
const CRIMES = [
  { key: 'robbery',  label: 'robbery',  cols: ['aggr_robbery', 'common_robbery'] },
  { key: 'burglary', label: 'burglary', cols: ['burglary_res'] },
  { key: 'murder',   label: 'murder',   cols: ['murder'] },
];
// The six Western Cape district municipalities (dc_mn), incl. the City of Cape Town metro.
const WC_DISTRICTS = new Set(['city of cape town', 'west coast', 'cape winelands', 'garden route', 'overberg', 'central karoo']);

// ---- read the national SAPACR CSV, keep only Western Cape stations ----
const csvLines = readFileSync(ROOT + 'pipeline/sapacr-2008-2023-v1.1/sapacr-2008-2023-v1.1.csv', 'latin1').trim().split(/\r?\n/);
const head = parseCSVLine(csvLines[0]);
const idx = Object.fromEntries(head.map((h, i) => [h, i]));
const crimeIdx = CRIMES.map((cr) => ({ ...cr, ii: cr.cols.map((c) => idx[c]) }));
const stationMap = new Map(); const yearSet = new Set();
for (let i = 1; i < csvLines.length; i++) {
  const c = parseCSVLine(csvLines[i]);
  if (!WC_DISTRICTS.has((c[idx.dc_mn] || '').trim().toLowerCase())) continue;
  const yr = parseInt(c[idx.year], 10); yearSet.add(yr);
  const key = norm(c[idx.station]);
  let st = stationMap.get(key);
  if (!st) { st = { name: c[idx.station], key, lng: +c[idx.longitude], lat: +c[idx.latitude], dc: (c[idx.dc_mn] || '').trim(), crimes: {} }; for (const cr of crimeIdx) st.crimes[cr.key] = {}; stationMap.set(key, st); }
  for (const cr of crimeIdx) { const v = cr.ii.reduce((a, j) => a + (Number(c[j]) || 0), 0); st.crimes[cr.key][yr] = (st.crimes[cr.key][yr] || 0) + v; }
}
const YEARS = [...yearSet].sort((a, b) => a - b);
const YEAR_LABELS = YEARS.map((y) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`);
const stationList = [...stationMap.values()].filter((s) => s.lng && s.lat && !Number.isNaN(s.lng) && !Number.isNaN(s.lat));

// ---- precincts of our WC stations (WC GIS is already province-wide) ----
const stationKeys = new Set(stationList.map((s) => s.key));
const precincts = read('data/raw/precincts.geojson').features.filter((f) => stationKeys.has(norm(f.properties.COMPNT_NM || '')));

// ---- projection fit to the WHOLE WC extent (fit to vertices-as-points, per the ArcGIS winding gotcha) ----
const fitPoints = [];
for (const f of precincts) for (const ring of allRings(f.geometry)) for (const c of ring) fitPoints.push(c);
for (const s of stationList) fitPoints.push([s.lng, s.lat]);
const proj = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: 'MultiPoint', coordinates: fitPoints });
const project = ([lng, lat]) => { const [px, py] = proj([lng, lat]); return [px - W / 2, H / 2 - py]; };

// ---- per-precinct jitter radius ----
const radiusByName = new Map();
for (const f of precincts) {
  const ring = firstRing(f.geometry); let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const c of ring) { const [x, y] = project(c); minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  const r = 0.52 * (((maxx - minx) + (maxy - miny)) / 2);
  radiusByName.set(norm(f.properties.COMPNT_NM || ''), Math.max(6, Math.min(r, 90)));
}

// ---- per-capita population: WorldPop 2020 → precinct ZONAL SUM, over the WHOLE province ----------
// Same join as bake.mjs's Cape Town version (bbox pre-filter → ray-cast point-in-polygon), but the
// Cape-Town-only raster clip (data/raw/capetown_pop_2020.tif) doesn't cover the rest of the WC, so
// this reads a WINDOW straight off the NATIONAL raster (data/raw/zaf_ppp_2020_UNadj_constrained.tif,
// ~41 MB) — never the whole thing into memory. The window = the WC precincts' own lng/lat bbox,
// padded slightly, converted to a pixel window via the raster's origin + resolution (mirrors
// clip-worldpop.mjs's geo-bbox → pixel-window arithmetic).
const popByKey = new Map();
{
  const PAD_DEG = 0.05;
  const geoBbox = [Infinity, Infinity, -Infinity, -Infinity]; // [minLng, minLat, maxLng, maxLat]
  for (const f of precincts) {
    const b = featBbox(f.geometry);
    if (b[0] < geoBbox[0]) geoBbox[0] = b[0]; if (b[1] < geoBbox[1]) geoBbox[1] = b[1];
    if (b[2] > geoBbox[2]) geoBbox[2] = b[2]; if (b[3] > geoBbox[3]) geoBbox[3] = b[3];
  }
  geoBbox[0] -= PAD_DEG; geoBbox[1] -= PAD_DEG; geoBbox[2] += PAD_DEG; geoBbox[3] += PAD_DEG;

  const img = await (await fromFile(`${ROOT}data/raw/zaf_ppp_2020_UNadj_constrained.tif`)).getImage();
  const RW = img.getWidth(), RH = img.getHeight();
  const [rox, roy] = img.getOrigin();
  const [rrx, rry] = img.getResolution(); // rrx>0, rry<0
  const nodata = img.getGDALNoData();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const left   = clamp(Math.floor((geoBbox[0] - rox) / rrx), 0, RW);
  const right  = clamp(Math.ceil ((geoBbox[2] - rox) / rrx), 0, RW);
  const top    = clamp(Math.floor((geoBbox[3] - roy) / rry), 0, RH); // rry<0 → maxLat is the top row
  const bottom = clamp(Math.ceil ((geoBbox[1] - roy) / rry), 0, RH);
  const wpx = right - left, hpx = bottom - top;
  console.log(`per-capita: WC geo bbox ${geoBbox.map((v) => v.toFixed(3))} → pixel window ${wpx}×${hpx} of the national ${RW}×${RH} raster`);

  const [pband] = await img.readRasters({ window: [left, top, right, bottom], samples: [0] });
  const zones = precincts.map((f) => ({ key: norm(f.properties.COMPNT_NM || ''), geom: f.geometry, bbox: featBbox(f.geometry), pop: 0 }));
  for (let j = 0; j < hpx; j++) {
    const lat = roy + (top + j + 0.5) * rry;
    for (let i = 0; i < wpx; i++) {
      const v = pband[j * wpx + i];
      if ((nodata != null && v === nodata) || !(v > 0)) continue;
      const lng = rox + (left + i + 0.5) * rrx;
      for (const z of zones) {
        if (lng < z.bbox[0] || lng > z.bbox[2] || lat < z.bbox[1] || lat > z.bbox[3]) continue;
        if (pointInFeature(lng, lat, z.geom)) { z.pop += v; break; }
      }
    }
  }
  for (const z of zones) popByKey.set(z.key, z.pop);

  // ---- sanity block: totals, per-district, extremes ----
  const totalPop = zones.reduce((s, z) => s + z.pop, 0);
  console.log(`\nper-capita: WorldPop→precinct join — ${zones.length} precincts, ${Math.round(totalPop).toLocaleString()} people total (WC real population ~7M; Cape Town metro alone ~4.5M)`);
  const dcByKey = new Map(stationList.map((s) => [s.key, s.dc]));
  const popByDc = new Map();
  for (const z of zones) { const dc = dcByKey.get(z.key) || 'unknown'; popByDc.set(dc, (popByDc.get(dc) || 0) + z.pop); }
  console.log('population per district:');
  for (const [dc, pop] of [...popByDc.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${dc}: ${Math.round(pop).toLocaleString()}`);
  const named = zones.map((z) => ({ name: (stationList.find((s) => s.key === z.key) || {}).name || z.key, pop: z.pop })).sort((a, b) => b.pop - a.pop);
  console.log('5 most populous precincts:', named.slice(0, 5).map((n) => `${n.name}(${Math.round(n.pop).toLocaleString()})`).join(', '));
  console.log('5 least populous precincts:', named.slice(-5).map((n) => `${n.name}(${Math.round(n.pop).toLocaleString()})`).join(', '));
}

// ---- station records ----
const stations = stationList.map((s) => {
  const [x, y] = project([s.lng, s.lat]);
  const crimes = {};
  for (const cr of CRIMES) { crimes[cr.key] = {}; YEARS.forEach((yr) => { crimes[cr.key][yr] = Math.round(s.crimes[cr.key][yr] || 0); }); }
  return { name: titleCase(s.name), x: +x.toFixed(1), y: +y.toFixed(1), r: +(radiusByName.get(s.key) ?? 8).toFixed(1), dc: s.dc, pop: Math.round(popByKey.get(s.key) ?? 5000), crimes };
});

// ---- structure: precinct outlines at a constant arc-length step ----
const structure = [];
const STEP = 0.55;
for (const f of precincts) for (const ring of allRings(f.geometry)) {
  const pts = ring.map(project); let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0], ay = pts[i - 1][1]; const dx = pts[i][0] - ax, dy = pts[i][1] - ay; const seg = Math.hypot(dx, dy);
    if (seg === 0) continue;
    for (let d = STEP - acc; d <= seg; d += STEP) { const tt = d / seg; structure.push(+(ax + dx * tt).toFixed(1), +(ay + dy * tt).toFixed(1)); }
    acc = (acc + seg) % STEP;
  }
}

// district roster (for the drill-down: which stations belong to which region)
const districts = [...new Set(stations.map((s) => s.dc))].sort();

const asset = {
  meta: { title: 'Western Cape — crime', simulated: false,
    source: 'SAPS Annual Crime Records 2008/09–2022/23 (DataFirst). Geography: WC GIS precincts.',
    note: 'Counts, coordinates, precinct boundaries AND per-station population are REAL — population is a WorldPop 2020 → precinct zonal join (national raster), so per-capita rates are honest.',
    crimeTypes: CRIMES.map(({ key, label }) => ({ key, label })), years: YEARS, yearLabels: YEAR_LABELS,
    box: { w: W, h: H }, districts },
  stations, structure,
};
writeFileSync(ROOT + 'public/data/westerncape.json', JSON.stringify(asset));
console.log(`baked westerncape.json — ${stations.length} stations across ${districts.length} districts, ${YEARS.length} years, ${structure.length / 2} structure pts`);
console.log('districts:', districts.join(', '));
const cpt = stations.filter((s) => s.dc.toLowerCase() === 'city of cape town').length;
console.log(`City of Cape Town stations (drill-down target): ${cpt}`);

// ---- helpers ----
function parseCSVLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out;
}
function firstRing(geom) { if (!geom) return null; if (geom.type === 'Polygon') return geom.coordinates[0]; if (geom.type === 'MultiPolygon') return geom.coordinates[0][0]; return null; }
function* allRings(geom) { if (!geom) return; if (geom.type === 'Polygon') { for (const r of geom.coordinates) yield r; } else if (geom.type === 'MultiPolygon') { for (const poly of geom.coordinates) for (const r of poly) yield r; } }
// Polygon helpers for the WorldPop zonal sum (each poly = [outerRing, hole1, ...]) — ported from bake.mjs.
function ringsOfGeom(geom) { return geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []; }
function featBbox(geom) {
  const a = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of ringsOfGeom(geom)) for (const c of poly[0]) { if (c[0] < a[0]) a[0] = c[0]; if (c[1] < a[1]) a[1] = c[1]; if (c[0] > a[2]) a[2] = c[0]; if (c[1] > a[3]) a[3] = c[1]; }
  return a;
}
function pipRing(x, y, ring) { // ray-cast even-odd test
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function pointInFeature(x, y, geom) { // inside an outer ring AND not inside any of its holes
  for (const poly of ringsOfGeom(geom)) {
    if (!pipRing(x, y, poly[0])) continue;
    let hole = false;
    for (let h = 1; h < poly.length; h++) if (pipRing(x, y, poly[h])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}
