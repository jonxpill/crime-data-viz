/**
 * bake-toll.mjs — LEAN per-province murder bake for THE TOLL → public/data/toll-<prov>.json.
 *
 * The standalone Toll is PLACE-FREE (dots are born from time on the dial, not from a map), so it needs
 * ONLY per-station murder counts by SAPS year — no boundaries, no coordinates, no per-capita join. That
 * makes extending to a new province a pure DATA exercise:
 *
 *   • 2008/09–2022/23 from DataFirst's audited national SAPACR CSV (pipeline/sapacr-2008-2023-v1.1/).
 *     SAPACR has NO province column — stations are selected by district municipality (dc_mn). Rows with a
 *     BLANK dc_mn (19 stations nationally, e.g. Protea Glen) are ADJUDICATED by the SAPS workbook's own
 *     Province column — never guessed, and the adoption is printed.
 *   • 2015/16–2024/25 from the AUDITED annual-2024-2025.xlsx (RAW Data sheet, Province column) — the
 *     WORKBOOK WINS the 2015–22 overlap wholesale: it is SAPS's own current restatement of those years,
 *     and per-station forensics (Gauteng, 2026-07-14) found SAPACR row-shears the workbook doesn't have
 *     (Orlando 2018–22 carrying Magaliesburg's 2-4-4-4-3; Kwa Thema sheared pre-2018). Diffs still printed.
 *   • 2025/26 = the four quarterlies summed (UNAUDITED — say so wherever the number is shown).
 *   • 2008–14 has no workbook: SAPACR baseline, cross-checked per station against the independent legacy
 *     compilation; stations with a PROVEN shear there take the legacy series via `pre2015Fixes` (printed
 *     per year — Gauteng: Kwa Thema only, Σ|diff| 141 vs a clean sweep everywhere else).
 *   • New stations (in the workbooks, not in SAPACR) join as their OWN rows — the toll sums the province,
 *     so no polygon-fold decisions are needed (unlike the WC map bake); back-years arrive via the same
 *     workbook-wins rule. A rename is only merged under numeric identity (see `renames`).
 *
 * Trust checks (printed, never silent):
 *   1. overlap 2015–2022: SAPACR vs the workbook's own back-years, per station + province totals;
 *   2. independent cross-check 2008–2015 vs the legacy data/raw/sa_crime.csv compilation (has Province);
 *   3. per-year totals table + the final M.
 *
 * Run: node pipeline/bake-toll.mjs gauteng
 */
import { readFileSync, writeFileSync } from 'node:fs';
import XLSX from 'xlsx';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const norm = (key) => String(key).toUpperCase().replace(/[^A-Z]/g, '');

// Province registry: dc_mn values as they appear in SAPACR + the display/workbook names.
const PROVINCES = {
  gauteng: {
    label: 'Gauteng', wbName: 'Gauteng',
    dcs: new Set(['city of johannesburg', 'city of tshwane', 'ekurhuleni', 'sedibeng', 'west rand']),
    legacyName: 'Gauteng',
    // Workbook name → SAPACR name, VERIFIED by numeric identity of every overlap back-year (the bake
    // re-asserts the identity and fails loudly on drift). Protea Glen sits blank-dc in SAPACR and the
    // workbook calls it "Protea" — all eight 2015–22 murder values match exactly (checked 2026-07-14).
    renames: { PROTEA: 'PROTEAGLEN' },
    // Stations whose SAPACR 2008–14 series is PROVEN sheared (vs legacy + their own established level):
    // take the legacy compilation's years for them, printed per year. Kwa Thema: SAPACR 2,2,4,5,9,7,12 vs
    // legacy 37,32,26,22,23,21,21 — legacy is continuous with the station's workbook-era ~28/yr.
    pre2015Fixes: ['KWATHEMA'],
  },
  kzn: {
    label: 'KwaZulu-Natal', wbName: 'Kwazulu/Natal', // VERIFY at bake time — the script lists distinct names if zero rows match
    dcs: new Set(['amajuba', 'ethekwini', 'harry gwala', 'ilembe', 'king cetshwayo', 'ugu', 'umgungundlovu', 'umkhanyakude', 'umzinyathi', 'uthukela', 'zululand']),
    legacyName: 'Kwazulu/Natal',
    renames: {}, // NB before baking: SAPACR's blank-dc "kwamashu" (1,582 murders 08–22) is ABSENT from the
                 // workbook under that name — find its workbook identity numerically first (Protea precedent).
  },
};

const provKey = process.argv[2];
const P = PROVINCES[provKey];
if (!P) { console.error(`usage: node pipeline/bake-toll.mjs <${Object.keys(PROVINCES).join('|')}>`); process.exit(1); }
console.log(`\n=== THE TOLL bake · ${P.label} ===`);

// ---- 1. SAPACR 2008–2022 (audited): district filter + blank-dc candidates ------------------------
function parseCSVLine(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const csvLines = readFileSync(ROOT + 'pipeline/sapacr-2008-2023-v1.1/sapacr-2008-2023-v1.1.csv', 'latin1').trim().split(/\r?\n/);
const head = parseCSVLine(csvLines[0]).map((h) => h.replace(/^"|"$/g, ''));
const idx = Object.fromEntries(head.map((h, i) => [h, i]));
for (const need of ['year', 'station', 'dc_mn', 'murder']) if (idx[need] == null) throw new Error(`SAPACR missing column ${need}`);

const stations = new Map();       // NORMKEY -> { name, murder: { startYear: n } }
const blanks = new Map();         // NORMKEY -> same shape — dc_mn blank, adjudicated by the workbook below
const yearSet = new Set();
const put = (map, name, yr, v) => {
  const key = norm(name);
  let st = map.get(key);
  if (!st) { st = { name: name.trim(), murder: {} }; map.set(key, st); }
  st.murder[yr] = (st.murder[yr] || 0) + v;
};
for (let i = 1; i < csvLines.length; i++) {
  const c = parseCSVLine(csvLines[i]);
  const dc = (c[idx.dc_mn] || '').trim().toLowerCase();
  const isMine = P.dcs.has(dc), isBlank = dc === '';
  if (!isMine && !isBlank) continue;
  const yr = parseInt(c[idx.year], 10);
  const v = Number(c[idx.murder]) || 0;
  if (isMine) { yearSet.add(yr); put(stations, c[idx.station], yr, v); }
  else put(blanks, c[idx.station], yr, v);
}
console.log(`SAPACR: ${stations.size} ${P.label} stations by district · ${blanks.size} blank-district candidates held for adjudication`);

// ---- 2. the audited annual workbook: adjudicate blanks, merge 2023+2024, overlap-check 2015–2022 ----
const annual = XLSX.readFile(ROOT + 'data/raw/saps/annual-2024-2025.xlsx', { sheets: ['RAW Data'] });
const aRows = XLSX.utils.sheet_to_json(annual.Sheets['RAW Data'], { header: 1 });
const aH = aRows[2].map((h) => String(h ?? ''));
const aCol = (label) => { const i = aH.indexOf(label); if (i < 0) throw new Error(`annual: column "${label}" not found`); return i; };
const aComp = aCol('Comp level'), aSt = aCol('Station'), aProv = aCol('Province'), aCat = aCol('Crime_Category');
const A_YEARS = ['2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020', '2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025'];
const aYearCol = Object.fromEntries(A_YEARS.map((y) => [y, aCol(y)]));

// First pass — every station's Province (any category row), for blank adjudication + name sanity.
// Verified renames apply here too, so a renamed workbook row vouches for its SAPACR name.
const R0 = P.renames || {};
const wbProvince = new Map(); const provinceCounts = new Map();
for (let r = 3; r < aRows.length; r++) {
  const row = aRows[r];
  if (!row || row[aComp] !== 'Station') continue;
  const p = String(row[aProv] ?? '');
  const k = norm(String(row[aSt]));
  wbProvince.set(R0[k] || k, p);
  provinceCounts.set(p, (provinceCounts.get(p) || 0) + 1);
}
if (![...provinceCounts.keys()].includes(P.wbName)) {
  throw new Error(`workbook has no province "${P.wbName}" — distinct names: ${[...provinceCounts.keys()].join(' | ')}`);
}

// Adjudicate the blank-dc candidates by the workbook's own Province column.
const adopted = [], unresolved = [];
for (const [key, st] of blanks) {
  const p = wbProvince.get(key);
  if (p === P.wbName) { stations.set(key, st); adopted.push(`${st.name} (${Object.values(st.murder).reduce((a, b) => a + b, 0)} murders 08–22)`); }
  else if (p == null) unresolved.push(`${st.name} (${Object.values(st.murder).reduce((a, b) => a + b, 0)})`);
}
console.log(`blank-district adjudication: ADOPTED into ${P.label}: ${adopted.length ? adopted.join(' · ') : 'none'}`);
if (unresolved.length) console.log(`  unresolved (not in workbook either — EXCLUDED, murders lost if truly ${P.label}): ${unresolved.join(' · ')}`);

// Second pass — murder rows for this province: verified renames, back-year ingestion for genuinely new
// stations, per-station + per-year overlap trust-check.
const RENAMES = P.renames || {};
const overlapDiff = {}; // startYear -> { csv, wb }
const stationDrift = new Map(); // key -> Σ|csv−wb| over the overlap (to characterize residual drift)
const newStations = [], newWithBack = [], renameVerified = [];
for (let r = 3; r < aRows.length; r++) {
  const row = aRows[r];
  if (!row || row[aComp] !== 'Station' || row[aProv] !== P.wbName || row[aCat] !== 'Murder') continue;
  const rawKey = norm(String(row[aSt]));
  const key = RENAMES[rawKey] || rawKey;
  let st = stations.get(key);
  if (RENAMES[rawKey]) {
    // A verified rename MUST land on an existing SAPACR station AND match its every overlap back-year
    // exactly — numeric identity is the proof of sameness; fail loudly on any drift.
    if (!st) throw new Error(`rename ${rawKey}→${key}: no SAPACR station under ${key}`);
    for (const ylab of A_YEARS) {
      const start = parseInt(ylab, 10);
      if (start >= 2023) continue;
      const wbV = Number(row[aYearCol[ylab]]) || 0, csvV = st.murder[start] || 0;
      if (wbV !== csvV) throw new Error(`rename ${rawKey}→${key}: ${ylab} mismatch (workbook ${wbV} vs SAPACR ${csvV}) — identity broken`);
    }
    renameVerified.push(`${String(row[aSt]).trim()} → ${st.name} (all overlap years identical)`);
  }
  if (!st) {
    // Not in SAPACR at all: a genuinely NEW station joins as its own row (real recorded murders DataFirst's
    // roster never listed; place-free, so no polygon fold — the row simply exists). Its back-years arrive
    // via the same workbook-wins rule below. Reported, never silent.
    st = { name: String(row[aSt]).trim(), murder: {} };
    stations.set(key, st);
    const back = A_YEARS.filter((y) => parseInt(y, 10) < 2023).reduce((a, y) => a + (Number(row[aYearCol[y]]) || 0), 0);
    if (back > 0) newWithBack.push(`${st.name} (workbook back-years 15–22: ${back})`);
    else newStations.push(st.name);
  }
  for (const ylab of A_YEARS) {
    const start = parseInt(ylab, 10);
    const v = Number(row[aYearCol[ylab]]) || 0;
    if (start >= 2023) st.murder[start] = (st.murder[start] || 0) + v;   // the two audited new years
    else {
      // THE WORKBOOK WINS 2015–22 (SAPS's own restatement; fixes SAPACR's proven row-shears wholesale).
      // The SAPACR value is captured FIRST so the printed trust-check shows the true source disagreement.
      const o = (overlapDiff[start] ||= { csv: 0, wb: 0 });
      const sapV = st.murder[start] || 0;
      o.wb += v; o.csv += sapV;
      if (v !== sapV) stationDrift.set(key, (stationDrift.get(key) || 0) + Math.abs(v - sapV));
      st.murder[start] = v;
    }
  }
}
yearSet.add(2023); yearSet.add(2024);
if (renameVerified.length) console.log(`verified renames: ${renameVerified.join(' · ')}`);
console.log(`annual workbook: new stations from 2023 on: ${newStations.length ? newStations.join(' · ') : 'none'}`);
if (newWithBack.length) console.log(`  new stations with workbook back-years (ingested by workbook-wins): ${newWithBack.join(' · ')}`);
console.log('overlap 2015–22 (SAPACR vs workbook, province murder totals — the WORKBOOK is applied; diffs shown for trust):');
for (const y of Object.keys(overlapDiff).sort()) {
  const { csv, wb } = overlapDiff[y];
  console.log(`  ${y}/${(+y + 1) % 100}: SAPACR ${csv} · workbook ${wb} (applied) · diff ${wb - csv}`);
}
const drifters = [...stationDrift.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
if (drifters.length) console.log(`  disagreeing stations (Σ|diff| over the 8 overlap years, top ${drifters.length}): ${drifters.map(([k, d]) => `${(stations.get(k) || { name: k }).name}:${d}`).join(' · ')}`);

// ---- 3. the four 2025/26 quarterlies (unaudited) — summed ----------------------------------------
const QUARTERS = [
  { file: 'q1-2025-2026.xlsx', label: 'April 2025 to June 2025' },
  { file: 'q2-2025-2026.xlsx', label: 'July 2025 to September 2025' },
  { file: 'q3-2025-2026.xlsx', label: 'October 2025 to December 2025' },
  { file: 'q4-2025-2026.xlsx', label: 'January 2026 to March 2026' },
];
const flat = (h) => String(h ?? '').replace(/\s+/g, ' ').trim();
const qNew = [];
for (const q of QUARTERS) {
  const wb = XLSX.readFile(ROOT + 'data/raw/saps/' + q.file, { sheets: ['RAW Data'] });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['RAW Data'], { header: 1 });
  const H = rows[2].map(flat);
  const col = (label) => { const i = H.indexOf(label); if (i < 0) throw new Error(`${q.file}: column "${label}" not found`); return i; };
  const iComp = col('Comp level'), iSt = col('Station'), iProv = col('Province'), iCat = col('Crime_Category'), iVal = col(q.label);
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row[iComp] !== 'Station' || row[iProv] !== P.wbName || row[iCat] !== 'Murder') continue;
    const rawKey = norm(String(row[iSt]));
    const key = RENAMES[rawKey] || rawKey;             // verified renames hold in the quarterlies too
    let st = stations.get(key);
    if (!st) { st = { name: String(row[iSt]).trim(), murder: {} }; stations.set(key, st); qNew.push(st.name); }
    st.murder[2025] = (st.murder[2025] || 0) + (Number(row[iVal]) || 0);
  }
}
yearSet.add(2025);
if (qNew.length) console.log(`quarterlies: stations first seen in 2025/26: ${qNew.join(' · ')}`);

// ---- 4. legacy compilation: per-station shear fixes (pre-2015) + independent totals cross-check ----
const legacy = readFileSync(ROOT + 'data/raw/sa_crime.csv', 'utf8').trim().split(/\r?\n/);
const lHead = parseCSVLine(legacy[0]);
const lIdx = Object.fromEntries(lHead.map((h, i) => [h, i]));
const lYears = lHead.filter((h) => /^\d{4}-\d{4}$/.test(h));
const legacyTot = {}; const legacyByKey = new Map();
for (let i = 1; i < legacy.length; i++) {
  const c = parseCSVLine(legacy[i]);
  if ((c[lIdx.Province] || '').trim() !== P.legacyName || (c[lIdx.Category] || '').trim().toLowerCase() !== 'murder') continue;
  const rec = {};
  for (const ylab of lYears) { const y = parseInt(ylab, 10); const v = Number(c[lIdx[ylab]]) || 0; rec[y] = v; legacyTot[y] = (legacyTot[y] || 0) + v; }
  legacyByKey.set(norm(c[lIdx.Station]), rec);
}
// Proven pre-2015 shears take the legacy series (2008–14 only), printed per year.
for (const key of P.pre2015Fixes || []) {
  const st = stations.get(key), leg = legacyByKey.get(key);
  if (!st || !leg) throw new Error(`pre2015Fix ${key}: station or legacy series missing`);
  const before = [], after = [];
  for (let y = 2008; y <= 2014; y++) { before.push(st.murder[y] || 0); after.push(leg[y] || 0); st.murder[y] = leg[y] || 0; }
  console.log(`pre-2015 shear fix · ${st.name}: SAPACR [${before.join(',')}] → legacy [${after.join(',')}]`);
}
console.log('independent cross-check (legacy sa_crime.csv, murder, province totals — different compilation, small diffs expected):');
const YEARS = [...yearSet].sort((a, b) => a - b);
for (const y of YEARS) {
  if (legacyTot[y] == null) continue;
  const mine = [...stations.values()].reduce((a, s) => a + (s.murder[y] || 0), 0);
  console.log(`  ${y}/${(y + 1) % 100}: bake ${mine} · legacy ${legacyTot[y]} · diff ${mine - legacyTot[y]}`);
}

// ---- 5. emit ---------------------------------------------------------------------------------------
const YEAR_LABELS = YEARS.map((y) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`);
const perYear = YEARS.map((y) => [...stations.values()].reduce((a, s) => a + (s.murder[y] || 0), 0));
const M = perYear.reduce((a, b) => a + b, 0);
console.log('\nper-year murder totals:');
YEARS.forEach((y, i) => console.log(`  ${YEAR_LABELS[i]}: ${perYear[i].toLocaleString()}`));
console.log(`M = ${M.toLocaleString()} recorded murders · ${P.label} · ${YEAR_LABELS[0]}–${YEAR_LABELS.at(-1)}\n`);

const out = {
  meta: {
    label: P.label,
    years: YEARS, yearLabels: YEAR_LABELS,
    box: { w: 940, h: 720 },     // the WC page's visual frame — same dial/word geometry across provinces (a frame, not geography)
    structN: 42616,              // same structure budget as the WC page → identical dial density
    M, perYear,
    sources: 'SAPS Annual Crime Records 2008–2023 via DataFirst (CC-BY) + SAPS annual & quarterly releases 2023–2026 (saps.gov.za); 2025/26 unaudited',
  },
  stations: [...stations.values()].map((s) => ({ name: s.name, murder: s.murder })),
};
writeFileSync(ROOT + `public/data/toll-${provKey}.json`, JSON.stringify(out));
console.log(`wrote public/data/toll-${provKey}.json (${(JSON.stringify(out).length / 1024).toFixed(0)} kB, ${out.stations.length} stations)`);
