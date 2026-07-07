/**
 * saps-supplement.mjs — one merge door for the SAPS 2023–2025 extension (used by BOTH bakes).
 *
 * Merges data/raw/saps/wc-supplement.json (see parse-saps.mjs) onto a bake's stationMap:
 *   • years 2023/24, 2024/25, 2025/26 are SET from the supplement (absolute values; post-2023 stations
 *     already folded into their old-boundary parents there);
 *   • `backfill` years are ADDED onto DataFirst's values (a child that recorded separately pre-2023 —
 *     Samora Machel under Philippi — which DataFirst's roster never carried).
 *
 * Fails loudly if the supplement is missing: a silent 15-year bake would look like success.
 */
import { readFileSync } from 'node:fs';

export function mergeSupplement(stationMap, yearSet, root) {
  const path = root + 'data/raw/saps/wc-supplement.json';
  let supp;
  try { supp = JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw new Error(`missing ${path} — run: node pipeline/fetch-saps.mjs && node pipeline/parse-saps.mjs`); }

  const NEW_YEARS = [2023, 2024, 2025];
  const CRIMES = ['robbery', 'burglary', 'murder'];
  let merged = 0; const missing = [];
  for (const [key, st] of stationMap) {  // map key = norm(station name) in both bakes
    const s = supp.stations[key];
    if (!s) { missing.push(st.name); continue; }
    merged++;
    for (const cr of CRIMES) for (const y of NEW_YEARS) st.crimes[cr][y] = (s[cr] && s[cr][y]) || 0;
    const bf = supp.backfill[key];
    if (bf) for (const cr of Object.keys(bf)) for (const [y, v] of Object.entries(bf[cr])) st.crimes[cr][y] = (st.crimes[cr][y] || 0) + v;
  }
  for (const y of NEW_YEARS) yearSet.add(y);
  if (missing.length) console.warn(`  supplement MISSING for ${missing.length} station(s): ${missing.join(', ')} — their 2023–2025 stay 0`);
  console.log(`merged SAPS supplement: ${merged} stations × 3 new years (2023/24–2025/26); backfill: ${Object.keys(supp.backfill).join(', ') || 'none'}`);
  return supp.meta;
}
