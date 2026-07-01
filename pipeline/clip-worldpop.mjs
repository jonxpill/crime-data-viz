/**
 * clip-worldpop.mjs — clip the national WorldPop raster to the Cape Town metro box
 * and verify it reads correctly.
 *
 * Input:  data/raw/zaf_ppp_2020_UNadj_constrained.tif  (WorldPop 2020, constrained,
 *         UN-adjusted, 100m, people-per-pixel — the national ZAF source, ~43 MB)
 *         Re-fetch (gitignored, not in the repo):
 *         curl -o data/raw/zaf_ppp_2020_UNadj_constrained.tif \
 *           https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/2020/maxar_v1/ZAF/zaf_ppp_2020_UNadj_constrained.tif
 * Output: data/raw/capetown_pop_2020.tif               (the metro clip, small)
 *
 * The METRO box matches bake.mjs exactly, so the clip covers the same extent the
 * pipeline filters stations/precincts to. Verification: sum the population inside the
 * box — it should land near Cape Town's real population (~4.6M), which proves the
 * raster is valid and correctly parsed before we ever wire it into per-capita.
 */
import { fromFile, writeArrayBuffer } from 'geotiff';
import { writeFileSync } from 'node:fs';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const SRC = ROOT + 'data/raw/zaf_ppp_2020_UNadj_constrained.tif';
const OUT = ROOT + 'data/raw/capetown_pop_2020.tif';
const METRO = { minLng: 18.30, maxLng: 19.05, minLat: -34.40, maxLat: -33.45 }; // == bake.mjs

const tiff = await fromFile(SRC);
const image = await tiff.getImage();
const W = image.getWidth(), H = image.getHeight();
const [ox, oy] = image.getOrigin();        // top-left corner (lng, lat)
const [rx, ry] = image.getResolution();    // pixel size (rx>0, ry<0)
const nodata = image.getGDALNoData();
console.log('national raster:', { W, H, origin: [ox, oy], resDeg: [rx, ry], nodata });
console.log('national bbox:', image.getBoundingBox().map((v) => +v.toFixed(3)));

// geo bbox -> pixel window [left, top, right, bottom], clamped to the image
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const left   = clamp(Math.floor((METRO.minLng - ox) / rx), 0, W);
const right  = clamp(Math.ceil ((METRO.maxLng - ox) / rx), 0, W);
const top    = clamp(Math.floor((METRO.maxLat - oy) / ry), 0, H); // ry<0
const bottom = clamp(Math.ceil ((METRO.minLat - oy) / ry), 0, H);
const wpx = right - left, hpx = bottom - top;
console.log('cape town pixel window:', { left, top, right, bottom, wpx, hpx });

const [band] = await image.readRasters({ window: [left, top, right, bottom], samples: [0] });

// verify: sum real people in the box
let sum = 0, cells = 0, maxv = 0;
for (let i = 0; i < band.length; i++) {
  const v = band[i];
  if ((nodata != null && v === nodata) || !(v > 0)) continue;
  sum += v; cells++; if (v > maxv) maxv = v;
}
console.log(`\nVERIFY — populated 100m cells: ${cells.toLocaleString()}`);
console.log(`VERIFY — population summed in metro box: ${Math.round(sum).toLocaleString()}`);
console.log(`VERIFY — busiest single 100m cell: ${maxv.toFixed(0)} people`);

// write the clip (unsettled/nodata -> 0 for a clean, small raster)
const clean = new Float32Array(band.length);
for (let i = 0; i < band.length; i++) {
  const v = band[i];
  clean[i] = (nodata != null && v === nodata) || !(v > 0) ? 0 : v;
}
try {
  const ab = await writeArrayBuffer(clean, {
    width: wpx, height: hpx,
    ModelPixelScale: [rx, Math.abs(ry), 0],
    ModelTiepoint: [0, 0, 0, ox + left * rx, oy + top * ry, 0],
    GTModelTypeGeoKey: 2,       // geographic (lat/lng)
    GTRasterTypeGeoKey: 1,      // PixelIsArea
    GeographicTypeGeoKey: 4326, // WGS84
    GDAL_NODATA: '0',
  });
  writeFileSync(OUT, Buffer.from(ab));
  console.log(`\nwrote clip -> data/raw/capetown_pop_2020.tif (${(ab.byteLength / 1024).toFixed(0)} KB)`);
} catch (e) {
  console.log(`\nclip write skipped (${e.message}); national raster + verified read still stand.`);
}
