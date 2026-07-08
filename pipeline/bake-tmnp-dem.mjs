/**
 * bake-tmnp-dem.mjs — pre-bake a Table Mountain (TMNP-north) DEM as a HANDOFF ARTIFACT for the
 * hiking app. No engine code crosses over: the output is a plain Int16 grid + a meta JSON that fully
 * specifies the convention, consumable by any native reader (route elevation profiles etc.).
 *
 * Output (committed, referenced from docs/HIKING-APP-HANDOFF.md):
 *   data/handoff/tmnp-north-dem.bin   Int16 little-endian, row-major, metres above sea level
 *   data/handoff/tmnp-north-dem.json  cols/rows/bbox/node convention/source/stats
 *
 * Convention (deliberately the SIMPLEST possible for a consumer with GPX lat/lng points):
 *   a REGULAR GRID IN LNG/LAT (plate carrée) — node (i, j):
 *     lng(i) = west  + (i / (cols-1)) * (east - west)
 *     lat(j) = north - (j / (rows-1)) * (north - south)     // row 0 = NORTH edge
 *     elev   = data[j * cols + i]  (Int16 LE, metres; < 0 = below sea level / non-land)
 *   Bilinear-interpolate between the four surrounding nodes for arbitrary coordinates.
 *
 * Source: AWS Terrain Tiles (s3.amazonaws.com/elevation-tiles-prod/geotiff, public, no auth),
 * z12 @ 512px tiles ≈ 15.8 m/px at this latitude; grid step ~16 m matches it (no fake precision).
 * Verified against known summits before writing (Maclear's Beacon 1086 m, Lion's Head 669 m).
 *
 * Run: node pipeline/bake-tmnp-dem.mjs   (re-downloads tiles only if missing)
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { fromFile } from 'geotiff';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const RAW = ROOT + 'data/raw/terrain/';
const OUT = ROOT + 'data/handoff/';
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

// The requested box: TMNP-north (Table Mountain, Lion's Head, Devil's Peak, Newlands side).
const BBOX = { west: 18.30, east: 18.48, south: -34.00, north: -33.90 };
const Z = 12, TILE = 512;

// ---- 1. which z12 tiles cover the box, fetch any that are missing ---------------------------------
const lon2x = (lon) => Math.floor(((lon + 180) / 360) * (1 << Z));
const lat2y = (lat) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * (1 << Z)); };
const TX0 = lon2x(BBOX.west), TX1 = lon2x(BBOX.east), TY0 = lat2y(BBOX.north), TY1 = lat2y(BBOX.south);
console.log(`z${Z} tiles: x[${TX0}..${TX1}] y[${TY0}..${TY1}] (${(TX1 - TX0 + 1) * (TY1 - TY0 + 1)} tiles)`);
for (let x = TX0; x <= TX1; x++) for (let y = TY0; y <= TY1; y++) {
  const dest = `${RAW}${Z}_${x}_${y}.tif`;
  if (existsSync(dest)) continue;
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/geotiff/${Z}/${x}/${y}.tif`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`  fetched ${Z}/${x}/${y}`);
}

// ---- 2. mosaic the tiles (Web-Mercator pixel space) ------------------------------------------------
const TNX = TX1 - TX0 + 1, TNY = TY1 - TY0 + 1;
const MOS_W = TNX * TILE, MOS_H = TNY * TILE;
const mosaic = new Float32Array(MOS_W * MOS_H);
for (let tx = 0; tx < TNX; tx++) for (let ty = 0; ty < TNY; ty++) {
  const img = await (await fromFile(`${RAW}${Z}_${TX0 + tx}_${TY0 + ty}.tif`)).getImage();
  const [band] = await img.readRasters();
  for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++)
    mosaic[(ty * TILE + py) * MOS_W + (tx * TILE + px)] = band[py * TILE + px];
}
const MERC = 20037508.342789244, WORLD_PX = TILE * (1 << Z), oxpx = TX0 * TILE, oypx = TY0 * TILE;
function elevAt(lng, lat) { // bilinear off the mercator mosaic
  const X = (lng * Math.PI / 180) * 6378137;
  const Y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * 6378137;
  const gx = (X + MERC) / (2 * MERC) * WORLD_PX - oxpx;
  const gy = (MERC - Y) / (2 * MERC) * WORLD_PX - oypx;
  if (gx < 0 || gy < 0 || gx >= MOS_W - 1 || gy >= MOS_H - 1) return -9999;
  const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const a = mosaic[y0 * MOS_W + x0], b = mosaic[y0 * MOS_W + x0 + 1];
  const c = mosaic[(y0 + 1) * MOS_W + x0], d = mosaic[(y0 + 1) * MOS_W + x0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

// ---- 3. sample the regular lng/lat grid ------------------------------------------------------------
// cols chosen so the ground step (~16.2 m) matches the source resolution (~15.8 m/px) — no fake detail.
const COLS = 1024;
const kmX = 111.32 * Math.cos(((BBOX.north + BBOX.south) / 2) * Math.PI / 180) * (BBOX.east - BBOX.west);
const kmY = 111.32 * (BBOX.north - BBOX.south);
const ROWS = Math.round(COLS * (kmY / kmX));
const grid = new Int16Array(COLS * ROWS);
let peak = -32768, min = 32767, land = 0;
for (let j = 0; j < ROWS; j++) {
  const lat = BBOX.north - (j / (ROWS - 1)) * (BBOX.north - BBOX.south);
  for (let i = 0; i < COLS; i++) {
    const lng = BBOX.west + (i / (COLS - 1)) * (BBOX.east - BBOX.west);
    const e = Math.round(elevAt(lng, lat));
    grid[j * COLS + i] = Math.max(-32768, Math.min(32767, e));
    if (e > peak) peak = e;
    if (e < min) min = e;
    if (e > 0) land++;
  }
}

// ---- 4. trust checks: known summits must read true before this ships ------------------------------
const sample = (lng, lat) => { // consumer-convention bilinear, as documented in the meta
  const fi = ((lng - BBOX.west) / (BBOX.east - BBOX.west)) * (COLS - 1);
  const fj = ((BBOX.north - lat) / (BBOX.north - BBOX.south)) * (ROWS - 1);
  const i0 = Math.floor(fi), j0 = Math.floor(fj), fx = fi - i0, fy = fj - j0;
  const g = (jj, ii) => grid[Math.min(ROWS - 1, jj) * COLS + Math.min(COLS - 1, ii)];
  return (g(j0, i0) * (1 - fx) + g(j0, i0 + 1) * fx) * (1 - fy) + (g(j0 + 1, i0) * (1 - fx) + g(j0 + 1, i0 + 1) * fx) * fy;
};
const ANCHORS = [
  // Summit positions as DETECTED in the source mosaic (local maxima), cross-checked against surveyed
  // heights: Maclear's 1086 m, Lion's Head 669 m (sharp cone — z12 smoothing shaves ~40 m), Devil's
  // Peak 1000 m. These pin the lng/lat↔node convention; heights within z12 smoothing of survey = ship.
  { name: "Maclear's Beacon (Table Mountain summit)", lng: 18.42510, lat: -33.96657, expect: 1086 },
  { name: "Lion's Head", lng: 18.38905, lat: -33.93524, expect: 669 },
  { name: "Devil's Peak", lng: 18.43987, lat: -33.95447, expect: 1000 },
];
console.log(`grid ${COLS}×${ROWS} (~${(kmX * 1000 / COLS).toFixed(1)} m/step) · peak ${peak} m · min ${min} m · land ${(100 * land / grid.length).toFixed(1)}%`);
for (const a of ANCHORS) {
  const got = Math.round(sample(a.lng, a.lat));
  const diff = got - a.expect;
  console.log(`  ${a.name}: ${got} m (expected ~${a.expect}, ${diff >= 0 ? '+' : ''}${diff})`);
  if (Math.abs(diff) > 75) throw new Error(`anchor "${a.name}" off by ${diff} m — projection/convention bug, NOT shipping`);
}

// ---- 5. write the artifact + its self-describing meta ---------------------------------------------
writeFileSync(OUT + 'tmnp-north-dem.bin', Buffer.from(grid.buffer));
const meta = {
  name: 'tmnp-north-dem',
  description: 'Table Mountain National Park (northern section: Table Mountain, Lion\'s Head, Devil\'s Peak, Newlands) elevation grid for route elevation profiles.',
  source: 'AWS Terrain Tiles (s3.amazonaws.com/elevation-tiles-prod/geotiff), z12 @ 512px GeoTIFF (~15.8 m/px at this latitude), public domain-ish open data (Mapzen heritage; SRTM-derived blend).',
  built: '2026-07-08',
  builder: '/Users/jonxpillemer/Documents/Crime Data-Viz/pipeline/bake-tmnp-dem.mjs',
  file: 'tmnp-north-dem.bin',
  format: 'Int16 little-endian, row-major (index = j * cols + i), metres above sea level; values < 0 = below sea level / non-land; -9999 = outside coverage (does not occur inside bbox).',
  crs: 'Regular grid in EPSG:4326 longitude/latitude (plate carrée node spacing) — NOT mercator.',
  cols: COLS,
  rows: ROWS,
  bbox: { west: BBOX.west, east: BBOX.east, south: BBOX.south, north: BBOX.north },
  node_convention: {
    lng_of_i: 'lng(i) = west + (i / (cols - 1)) * (east - west)',
    lat_of_j: 'lat(j) = north - (j / (rows - 1)) * (north - south)   // row 0 = the NORTH edge',
    sampling: 'bilinear-interpolate the four surrounding nodes for arbitrary lng/lat',
    approx_step_m: +((kmX * 1000) / COLS).toFixed(1),
  },
  stats: { peak_m: peak, min_m: min, land_fraction: +(land / grid.length).toFixed(3) },
  verification: ANCHORS.map((a) => ({ ...a, sampled_m: Math.round(sample(a.lng, a.lat)) })),
};
writeFileSync(OUT + 'tmnp-north-dem.json', JSON.stringify(meta, null, 2));
console.log(`wrote data/handoff/tmnp-north-dem.bin (${(grid.byteLength / 1e6).toFixed(2)} MB) + tmnp-north-dem.json`);
