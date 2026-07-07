/**
 * parse-saps.mjs — turn the raw SAPS workbooks (data/raw/saps/, see fetch-saps.mjs) into a compact
 * Western Cape supplement the bakes merge on top of DataFirst's audited 2008–2022 CSV:
 *
 *   data/raw/saps/wc-supplement.json
 *     { meta, stations: { <NORMKEY>: { name, robbery:{2023,2024,2025}, burglary:{…}, murder:{…} } } }
 *
 * Year keys are SAPS-year START years (2023 = 2023/24 … 2025 = 2025/26), matching the CSV convention.
 *   • 2023 + 2024 come from the AUDITED 2024/25 annual (its RAW Data sheet carries 2015/16–2024/25).
 *   • 2025 = sum of the four 2025/26 quarterly releases (UNAUDITED — the audited annual isn't out yet).
 *
 * Trust step (printed, not silent):
 *   • station match report vs the DataFirst CSV's 150 WC stations (new/renamed stations surface here);
 *   • overlap cross-check 2015–2022: DataFirst totals vs the workbook's own back-years, per composite —
 *     validates the name matching AND the category mapping against the source we already trust.
 *
 * Composites mirror bake-wc.mjs exactly:
 *   robbery = Robbery with aggravating circumstances + Common robbery
 *   burglary = Burglary at residential premises · murder = Murder
 *
 * Run: node pipeline/fetch-saps.mjs && node pipeline/parse-saps.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import XLSX from 'xlsx';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const RAW = ROOT + 'data/raw/saps/';
const norm = (key) => key.toUpperCase().replace(/[^A-Z]/g, '');

const COMPOSITES = {
  robbery: ['Robbery with aggravating circumstances', 'Common robbery'],
  burglary: ['Burglary at residential premises'],
  murder: ['Murder'],
  sexoff: ['Sexual offences'],        // the source's own aggregate — overlap-verified vs DataFirst below
  commercial: ['Commercial crime'],
  carjacking: ['Carjacking'],         // NB: also a subcategory of aggravated robbery (inside 'robbery')
};
const catToComposite = new Map();
for (const [k, cats] of Object.entries(COMPOSITES)) for (const c of cats) catToComposite.set(c, k);
const zeroComps = () => Object.fromEntries(Object.keys(COMPOSITES).map((k) => [k, 0]));
const mkStation = (name) => ({ name, ...Object.fromEntries(Object.keys(COMPOSITES).map((k) => [k, {}])) });

// Stations absent from the DataFirst/GIS snapshot get folded back into the precinct whose polygon
// contains them: our map draws the OLD boundaries, so parent+child is the correct count for the shape we
// show (dropping them would fake a decline in the parent). Parents verified, not guessed:
//   • Samora Machel sits inside eastern Philippi (GroundUp/SAPS) — and has recorded under its OWN name
//     since 2019/20 (satellite station), which DataFirst's roster never carried: those back-years are
//     BACKFILLED additively onto Philippi so the polygon's history is true (else 2023 shows a fake cliff).
//     Verified: workbook Philippi === DataFirst Philippi exactly, 2019–2022 — no double count.
//   • Makhaza (opened May 2024) "fell under the Harare precinct" (GroundUp/EWN); zero before 2024/25.
// Tafalehashe (Q4 2025/26 only, ALL composite counts zero) is intentionally NOT remapped — nothing to fold.
const REMAP = { SAMORAMACHEL: 'PHILIPPI', MAKHAZA: 'HARARE' };
const folded = {};   // rawKey -> composite -> year -> folded-in count (for the trust report)
const backfill = {}; // parentKey -> composite -> year(≤2022) -> ADDITIVE count the bakes add onto DataFirst

// ---- 1. the DataFirst CSV: our 150 WC stations + audited 2008–2022 totals (for the cross-check) ----
const WC_DISTRICTS = new Set(['city of cape town', 'west coast', 'cape winelands', 'garden route', 'overberg', 'central karoo']);
const csvLines = readFileSync(ROOT + 'pipeline/sapacr-2008-2023-v1.1/sapacr-2008-2023-v1.1.csv', 'latin1').trim().split(/\r?\n/);
const head = parseCSVLine(csvLines[0]);
const idx = Object.fromEntries(head.map((h, i) => [h, i]));
const compCols = {
  robbery: ['aggr_robbery', 'common_robbery'], burglary: ['burglary_res'], murder: ['murder'],
  sexoff: ['sexual_offences'], commercial: ['commercial_crime'], carjacking: ['carjacking'],
};
const csvStations = new Map();               // NORMKEY -> name
const csvTotals = {};                        // year -> composite -> WC sum
for (let i = 1; i < csvLines.length; i++) {
  const c = parseCSVLine(csvLines[i]);
  if (!WC_DISTRICTS.has((c[idx.dc_mn] || '').trim().toLowerCase())) continue;
  const key = norm(c[idx.station]);
  csvStations.set(key, c[idx.station]);
  const yr = parseInt(c[idx.year], 10);
  const t = (csvTotals[yr] ||= zeroComps());
  for (const [k, cols] of Object.entries(compCols)) t[k] += cols.reduce((a, col) => a + (Number(c[idx[col]]) || 0), 0);
}
console.log(`DataFirst CSV: ${csvStations.size} WC stations, years ${Object.keys(csvTotals).length}`);

// ---- 2. the audited 2024/25 annual: station rows × categories × years 2015/16–2024/25 -------------
const annual = XLSX.readFile(RAW + 'annual-2024-2025.xlsx', { sheets: ['RAW Data'] });
const aRows = XLSX.utils.sheet_to_json(annual.Sheets['RAW Data'], { header: 1 });
const aH = aRows[2].map((h) => String(h ?? ''));
const aCol = (label) => { const i = aH.indexOf(label); if (i < 0) throw new Error(`annual: column "${label}" not found`); return i; };
const aComp = aCol('Comp level'), aSt = aCol('Station'), aProv = aCol('Province'), aCat = aCol('Crime_Category');
const A_YEARS = ['2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020', '2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025'];
const aYearCol = Object.fromEntries(A_YEARS.map((y) => [y, aCol(y)]));

const stations = {};                          // NORMKEY -> { name, robbery:{}, burglary:{}, murder:{} }
const annualTotals = {};                      // startYear -> composite -> WC sum (matched stations only)
const sapsNames = new Map();                  // NORMKEY -> workbook display name (for the match report)
for (let r = 3; r < aRows.length; r++) {
  const row = aRows[r];
  if (!row || row[aComp] !== 'Station' || row[aProv] !== 'Western Cape') continue;
  const comp = catToComposite.get(row[aCat]);
  if (!comp) continue;
  const rawKey = norm(String(row[aSt]));
  sapsNames.set(rawKey, String(row[aSt]));
  const key = REMAP[rawKey] || rawKey;
  if (!csvStations.has(key)) continue;        // new/unknown station — reported below, never guessed in
  const st = (stations[key] ||= mkStation(csvStations.get(key)));
  for (const ylab of A_YEARS) {
    const start = parseInt(ylab, 10);
    const v = Number(row[aYearCol[ylab]]) || 0;
    if (start >= 2023) {
      st[comp][start] = (st[comp][start] || 0) + v;                    // the two new audited years
      if (REMAP[rawKey] && v) (((folded[rawKey] ||= {})[comp] ||= {})[start] = ((folded[rawKey][comp] || {})[start] || 0) + v);
    } else if (REMAP[rawKey] && v) {
      // a remapped station's PRE-2023 recording — DataFirst never had it; backfill onto the parent
      (((backfill[key] ||= {})[comp] ||= {})[start] = ((backfill[key][comp] || {})[start] || 0) + v);
    }
    const t = (annualTotals[start] ||= zeroComps());
    t[comp] += v;
  }
}

// ---- 3. the four 2025/26 quarterlies (unaudited): sum each station×category's quarter total -------
const QUARTERS = [
  { file: 'q1-2025-2026.xlsx', label: 'April 2025 to June 2025' },
  { file: 'q2-2025-2026.xlsx', label: 'July 2025 to September 2025' },
  { file: 'q3-2025-2026.xlsx', label: 'October 2025 to December 2025' },
  { file: 'q4-2025-2026.xlsx', label: 'January 2026 to March 2026' },
];
const flat = (h) => String(h ?? '').replace(/\s+/g, ' ').trim();
for (const q of QUARTERS) {
  const wb = XLSX.readFile(RAW + q.file, { sheets: ['RAW Data'] });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['RAW Data'], { header: 1 });
  const H = rows[2].map(flat);
  const col = (label) => { const i = H.indexOf(label); if (i < 0) throw new Error(`${q.file}: column "${label}" not found — headers: ${H.filter((h) => / to /.test(h)).join(' | ')}`); return i; };
  const iComp = col('Comp level'), iSt = col('Station'), iProv = col('Province'), iCat = col('Crime_Category');
  const iVal = col(q.label);
  let wcRows = 0;
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row[iComp] !== 'Station' || row[iProv] !== 'Western Cape') continue;
    const comp = catToComposite.get(row[iCat]);
    if (!comp) continue;
    const rawKey = norm(String(row[iSt]));
    sapsNames.set(rawKey, String(row[iSt]));
    const key = REMAP[rawKey] || rawKey;
    if (!csvStations.has(key)) continue;
    wcRows++;
    const st = (stations[key] ||= mkStation(csvStations.get(key)));
    const v = Number(row[iVal]) || 0;
    st[comp][2025] = (st[comp][2025] || 0) + v;
    if (REMAP[rawKey] && v) (((folded[rawKey] ||= {})[comp] ||= {})[2025] = ((folded[rawKey][comp] || {})[2025] || 0) + v);
  }
  console.log(`${q.file}: "${q.label}" summed over ${wcRows} WC station×category rows`);
}

// ---- 4. trust report ------------------------------------------------------------------------------
const matched = Object.keys(stations).length;
const newInSaps = [...sapsNames.keys()].filter((k) => !csvStations.has(k) && !REMAP[k]);
const missingFromSaps = [...csvStations.keys()].filter((k) => !sapsNames.has(k));
console.log(`\nmatch report: ${matched}/${csvStations.size} CSV stations matched`);
for (const [rawKey, comps] of Object.entries(folded)) {
  const parts = Object.entries(comps).map(([c, ys]) => `${c} ` + Object.entries(ys).map(([y, v]) => `${y}:${v}`).join(' '));
  console.log(`  FOLDED ${sapsNames.get(rawKey)} → ${csvStations.get(REMAP[rawKey])} (old-boundary precinct): ${parts.join(' · ')}`);
}
if (newInSaps.length) console.log(`  NEW in SAPS releases (dropped — no geometry, no fold target): ${newInSaps.map((k) => sapsNames.get(k)).join(', ')}`);
if (missingFromSaps.length) console.log(`  MISSING from SAPS releases (their 2023–2025 stay 0 — investigate!): ${missingFromSaps.map((k) => csvStations.get(k)).join(', ')}`);

for (const [pKey, comps] of Object.entries(backfill)) {
  const parts = Object.entries(comps).map(([c, ys]) => `${c} ` + Object.entries(ys).map(([y, v]) => `${y}:+${v}`).join(' '));
  console.log(`  BACKFILL onto ${csvStations.get(pKey)} (child recorded separately pre-2023; DataFirst lacked it): ${parts.join(' · ')}`);
}

console.log('\noverlap cross-check (WC totals · DataFirst vs 2024/25 annual back-years · delta = backfill + SAPS revisions):');
for (const y of [2015, 2017, 2019, 2021, 2022]) {
  const a = csvTotals[y], b = annualTotals[y];
  const bf = (k) => Object.values(backfill).reduce((s, comps) => s + ((comps[k] || {})[y] || 0), 0);
  console.log(`  ${y}/${String(y + 1).slice(2)}  ` + Object.keys(COMPOSITES)
    .map((k) => `${k} ${a[k]}→${b[k]} (+${b[k] - a[k]}, backfill +${bf(k)}, revisions +${b[k] - a[k] - bf(k)})`).join(' · '));
}
console.log('\nnew years (WC totals from this parse):');
for (const y of [2023, 2024, 2025]) {
  const t = zeroComps();
  for (const st of Object.values(stations)) for (const k of Object.keys(t)) t[k] += st[k][y] || 0;
  console.log(`  ${y}/${String(y + 1).slice(2)}  ` + Object.keys(t).map((k) => `${k} ${t[k]}`).join(' · ') + (y === 2025 ? '  (sum of quarterlies, unaudited)' : ''));
}

// ---- 5. write the supplement ----------------------------------------------------------------------
const out = {
  meta: {
    source: 'SAPS annual crime statistics 2024/25 (audited; carries 2023/24) + SAPS quarterly releases 2025/26 Q1–Q4 (unaudited), saps.gov.za',
    note: 'Year keys are SAPS-year start years (2023 = Apr 2023–Mar 2024). 2025 = sum of the four quarterly releases. ' +
      '`stations` holds ABSOLUTE new-year values (post-2023 stations folded into their old-boundary parent); ' +
      '`backfill` holds ADDITIVE pre-2023 amounts for parents whose child recorded separately before 2023 (DataFirst lacked those).',
    composites: COMPOSITES,
  },
  stations,
  backfill,
};
writeFileSync(RAW + 'wc-supplement.json', JSON.stringify(out));
console.log(`\nwrote data/raw/saps/wc-supplement.json — ${matched} stations × ${Object.keys(COMPOSITES).length} crimes × 3 new years, backfill for ${Object.keys(backfill).length} station(s)`);

function parseCSVLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out;
}
