/**
 * Forensics — statistics ABOUT the statistics. Pure, node-testable, no three.js.
 *
 * The question this module answers per station: "do these 60 monthly returns behave like a tally?"
 * A tally of independent rare events is Poisson: its variance equals its mean, so the dispersion
 * index D = var/mean sits near 1. A series that is too QUIET (D ≪ 1) is more regular than counting
 * ever is — worth a look. The wording is load-bearing everywhere downstream: regularity has
 * innocent causes (court-driven detections, quotas of process crimes, tiny true rates), so this is
 * a LOOK-CLOSER flag, never a finding, and never "fraud".
 *
 * STATISTICAL CARE (the whole feature):
 *  · Seasonal adjustment FIRST — subtract each station's own calendar-month mean (5 obs each over
 *    the 5 years) before measuring dispersion, so a real summer-crime wave doesn't read as
 *    over-dispersion. D is then SS_resid / (df · mean) with df = n − (#calendar months fitted):
 *    fitting 12 monthly means consumes 12 degrees of freedom, and only the df-aware denominator
 *    keeps a true Poisson tally centred on D = 1 (a naive n−1 variance would centre it on
 *    48/59 ≈ 0.81 and drag honest stations toward the look-closer zone). The unit tests pin this.
 *  · Small counts cannot be tested — below ~5/month the dispersion test has no power, so those
 *    stations are EXCLUDED from the ranking ("too small to test"), never judged.
 *  · Last-digit uniformity is a tooltip-only second opinion: trailing digits are only "free" once
 *    a count clears ~20, and the χ² only means anything with ≥20 qualifying months. It never ranks.
 */

/** Below this mean monthly count the dispersion test has no power — excluded, "too small to test". */
export const TESTABLE_MEAN = 5;
/** D below this ⇒ the "quieter than a tally — look closer" zone. DESCRIPTIVE, not accusatory —
 *  tuned against the real Western Cape distribution (pipeline/forensics-table.mjs) so at most ~10%
 *  of testable stations land there for any crime. For a true tally P(D < 0.55) ≈ 0.004 (χ²₄₈). */
export const LOOK_CLOSER_D = 0.55;
/** A month's count must clear this for its last digit to carry information. */
export const DIGIT_MIN_COUNT = 20;
/** Minimum qualifying months before the digit χ² is worth reporting. */
export const DIGIT_MIN_N = 20;

/**
 * Per-station forensic statistics over the monthly series of one crime.
 *
 * @param {Array<{name:string, monthly?:Record<string,number[]>}>} stations
 * @param {string} type crime key into station.monthly
 * @returns {Array<{name:string, n:number, mean:number, D:number, testable:boolean,
 *                  z:Float64Array, digitHist:number[], digitN:number, chi2p:number|null}>}
 *          aligned with `stations`; z[m] = seasonally-adjusted residual in Poisson units (r/√mean),
 *          the shared visual scale for the strip's x-jitter (an honest month is ±~2, rigged ≈ 0).
 */
export function forensicsStats(stations, type) {
  return stations.map((s) => {
    const c = (s.monthly && s.monthly[type]) || [];
    const n = c.length;
    const P = 12; // calendar-month period — the seasonal cycle we adjust away
    let sum = 0;
    for (let m = 0; m < n; m++) sum += c[m];
    const mean = n ? sum / n : 0;

    // Calendar-month means (each month-of-year across the years), then residual sum of squares.
    const mSum = new Float64Array(P), mN = new Float64Array(P);
    for (let m = 0; m < n; m++) { mSum[m % P] += c[m]; mN[m % P]++; }
    let groups = 0;
    for (let k = 0; k < P; k++) if (mN[k] > 0) { mSum[k] /= mN[k]; groups++; }

    const z = new Float64Array(n);
    const sd = Math.sqrt(mean);
    let ss = 0;
    for (let m = 0; m < n; m++) {
      const r = c[m] - mSum[m % P];
      ss += r * r;
      z[m] = sd > 0 ? r / sd : 0;
    }
    const df = n - groups; // 60 months − 12 fitted monthly means = 48 (see header — keeps E[D] = 1)
    const D = mean > 0 && df > 0 ? ss / (df * mean) : 0;

    // Last-digit histogram over the months whose count is large enough for the digit to be free.
    const digitHist = new Array(10).fill(0);
    let digitN = 0;
    for (let m = 0; m < n; m++) if (c[m] >= DIGIT_MIN_COUNT) { digitHist[c[m] % 10]++; digitN++; }
    let chi2p = null;
    if (digitN >= DIGIT_MIN_N) {
      const e = digitN / 10;
      let x2 = 0;
      for (const o of digitHist) x2 += ((o - e) * (o - e)) / e;
      chi2p = chi2UpperP(x2, 9);
    }

    return { name: s.name, n, mean, D, testable: mean >= TESTABLE_MEAN, z, digitHist, digitN, chi2p };
  });
}

/**
 * Upper-tail p-value of a χ² statistic: P(X ≥ x2) for X ~ χ²(df), via the regularized upper
 * incomplete gamma Q(df/2, x2/2) (series / continued fraction, Numerical Recipes shape).
 */
export function chi2UpperP(x2, df) {
  if (!(x2 > 0)) return 1;
  const a = df / 2, x = x2 / 2;
  if (x < a + 1) {
    // series for the lower P(a,x); Q = 1 − P
    let ap = a, del = 1 / a, sum = del;
    for (let i = 0; i < 300; i++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-13) break;
    }
    return Math.min(1, Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - gammaln(a))));
  }
  // continued fraction for Q(a,x) directly
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-13) break;
  }
  return Math.min(1, Math.max(0, Math.exp(-x + a * Math.log(x) - gammaln(a)) * h));
}

function gammaln(x) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/**
 * Structure frame for the forensics strip (pie-frame contract: n structure dots, surplus roosts
 * off-screen invisible). Grey/matte skeleton: a baseline under the columns, a thin vertical seam
 * at each zone boundary, and the short D = 1 reference tick on the baseline. Same conserved
 * structure pool as the map outline / pie ring — it just reconfigures.
 *
 * @param {number} n structure pool size
 * @param {{x0:number,x1:number,baseY:number,topY:number,edges:number[],d1x:number|null}} frame
 */
export function forensicsFrameLayout(n, frame, { frameDots = 200000, thin = 0.5 } = {}) {
  const positions = new Float32Array(n * 2), density = new Float32Array(n), z = new Float32Array(n);
  const rng = mulberry32(0x5eed1e);
  const { x0, x1, baseY, topY, edges = [], d1x } = frame;
  const used = Math.min(n, frameDots);
  const BASE = Math.floor(used * (edges.length ? 0.55 : 0.85));
  const TICK = d1x == null ? 0 : Math.floor(used * 0.08);
  const ne = edges.length || 1;
  for (let k = 0; k < n; k++) {
    if (k < BASE) {                                    // baseline under the columns
      positions[k * 2] = x0 + rng() * (x1 - x0);
      positions[k * 2 + 1] = baseY + gauss(rng) * thin;
      density[k] = 0.5;
    } else if (k < BASE + TICK) {                      // the D = 1 reference tick (short, on the baseline)
      positions[k * 2] = d1x + gauss(rng) * thin;
      positions[k * 2 + 1] = baseY + (rng() - 0.2) * 14;
      density[k] = 0.5;
    } else if (k < used && edges.length) {             // thin vertical seam at each zone boundary
      const x = edges[(k - BASE - TICK) % ne];
      positions[k * 2] = x + gauss(rng) * thin;
      positions[k * 2 + 1] = baseY + rng() * (topY - baseY);
      density[k] = 0.5;
    } else {                                           // surplus → off-screen roost, invisible
      const a = rng() * Math.PI * 2, r = 1100 * (0.8 + rng() * 0.5);
      positions[k * 2] = Math.cos(a) * r;
      positions[k * 2 + 1] = Math.sin(a) * r;
      density[k] = 0;
    }
  }
  return { positions, density, z };
}

// Local copies of the layout-grammar helpers (capeTown.js keeps its own private ones; this module
// must stay import-free so the stats are trivially node-testable).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}
