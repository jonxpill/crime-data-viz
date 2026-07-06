/**
 * fetch-terrain.mjs — download AWS Terrain Tiles (GeoTIFF elevation, no login) covering a bbox at a
 * given zoom, into data/raw/terrain/{z}_{x}_{y}.tif. Skips tiles already on disk, so it's safe to re-run.
 *
 * Source: s3.amazonaws.com/elevation-tiles-prod/geotiff/{z}/{x}/{y}.tif — public AWS Open Data
 * (Mapzen/Terrarium heritage), signed Int16 metres, 512×512 per tile. Ocean-only tiles may 404 (fine).
 *
 * The bake steps mosaic these: bake.mjs reads the Cape Town z10 set (its hero DEM); bake-wc.mjs reads
 * this z9 set for the province + the five district reliefs.
 *
 * Run: node pipeline/fetch-terrain.mjs   (defaults to the Western Cape bbox at z9)
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const OUT = ROOT + 'data/raw/terrain/';
mkdirSync(OUT, { recursive: true });

// Western Cape bbox (padded a touch past the precinct extent) at z9 (~250 m/sample) — plenty for the
// zoomed-out province and the big rural districts. Cape Town keeps its own crisper z10 set (bake.mjs).
const Z = 9;
const BBOX = { w: 17.7, e: 24.3, s: -34.9, n: -30.3 };
const lon2x = (lon) => Math.floor(((lon + 180) / 360) * (1 << Z));
const lat2y = (lat) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * (1 << Z)); };
const x0 = lon2x(BBOX.w), x1 = lon2x(BBOX.e), y0 = lat2y(BBOX.n), y1 = lat2y(BBOX.s);

const tiles = [];
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push([x, y]);
console.log(`z${Z} · ${x1 - x0 + 1}×${y1 - y0 + 1} = ${tiles.length} tiles over WC bbox [${BBOX.w},${BBOX.s} → ${BBOX.e},${BBOX.n}]`);

const CONC = 8;
let idx = 0, fetched = 0, skipped = 0, failed = 0, bytes = 0;
async function worker() {
  while (idx < tiles.length) {
    const [x, y] = tiles[idx++];
    const dest = `${OUT}${Z}_${x}_${y}.tif`;
    if (existsSync(dest)) { skipped++; continue; }
    try {
      const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/geotiff/${Z}/${x}/${y}.tif`);
      if (!res.ok) { console.warn(`  ${res.status} ${Z}/${x}/${y}`); failed++; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(dest, buf); fetched++; bytes += buf.length;
    } catch (e) { console.warn(`  ERR ${Z}/${x}/${y}: ${e.message}`); failed++; }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`done — ${fetched} fetched (${(bytes / 1e6).toFixed(1)} MB), ${skipped} skipped, ${failed} failed/absent`);
