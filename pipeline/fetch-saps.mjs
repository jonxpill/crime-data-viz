/**
 * fetch-saps.mjs — download the SAPS station-level crime workbooks that extend the dataset past
 * DataFirst's 2008–2023 curation, into data/raw/saps/ (gitignored). Skips files already on disk.
 *
 * Sources (saps.gov.za, verified 2026-07):
 *   • 2024/25 ANNUAL (audited): its "RAW Data" sheet carries TEN years per station×category
 *     (2015/16–2024/25), giving both missing annual years (2023/24 + 2024/25) AND eight overlap
 *     years to cross-check against DataFirst.
 *   • 2025/26 Q1–Q4 (unaudited quarterly releases): summed per station×category = the complete
 *     SAPS year Apr 2025 – Mar 2026. The audited 2025/26 annual isn't published yet.
 *
 * Downloads via `curl -sk`: saps.gov.za serves an incomplete certificate chain, which Node's
 * fetch rejects outright; curl -k is how we verified the files by hand. Sizes are sanity-checked
 * (a SAPS error page is a few KB; real workbooks are MBs).
 *
 * Run: node pipeline/fetch-saps.mjs   ·   Then: node pipeline/parse-saps.mjs
 */
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const OUT = ROOT + 'data/raw/saps/';
mkdirSync(OUT, { recursive: true });

const BASE = 'https://www.saps.gov.za/services/';
const FILES = [
  { name: 'annual-2024-2025.xlsx', url: BASE + 'downloads/2024-2025%20_Annual_Financial%20year_WEB.xlsx', minMB: 5 },
  { name: 'q1-2025-2026.xlsx', url: BASE + 'downloads/2025/2025-2026_-_1st_Quarter_WEB.xlsx', minMB: 1 },
  { name: 'q2-2025-2026.xlsx', url: BASE + 'downloads/2025/2025-2026_-_2nd_Quarter_WEB.xlsx', minMB: 1 },
  { name: 'q3-2025-2026.xlsx', url: BASE + 'downloads/2025/2025-2026_-_3rd_Quarter_WEB.xlsx', minMB: 1 },
  { name: 'q4-2025-2026.xlsx', url: BASE + 'downloads/2025/2025-2026_-_4th_Quarter_WEB.xlsx', minMB: 1 },
];

for (const f of FILES) {
  const dest = OUT + f.name;
  if (existsSync(dest) && statSync(dest).size > f.minMB * 1e6) { console.log(`skip ${f.name} (already on disk)`); continue; }
  console.log(`fetching ${f.name} …`);
  execFileSync('curl', ['-sk', '--max-time', '300', '-o', dest, f.url]);
  const mb = statSync(dest).size / 1e6;
  if (mb < f.minMB) throw new Error(`${f.name} looks wrong (${mb.toFixed(2)} MB < ${f.minMB} MB) — SAPS may have moved it`);
  console.log(`  ok (${mb.toFixed(1)} MB)`);
}
console.log('done — data/raw/saps/ ready for parse-saps.mjs');
