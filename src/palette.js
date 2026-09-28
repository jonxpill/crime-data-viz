// THE PALETTE DOOR — the ONE module that owns colour. See docs/plans/polish-program.md (D2).
//
// Every colour on screen is a ROLE TOKEN resolved here, never a literal at a call site:
//   • DATA ramps by SAPS's own crime FAMILIES (contact · property · commercial). A pool's dots carry a
//     ramp index (layout.ramp); this module owns the crime → family → index map and the ramp colours.
//     Density is still the ONLY brightness channel inside every ramp (density = light).
//   • STRUCTURE roles (lace, district, coast, frame, words, residents, unlit, terrain) → each structure
//     pool's matte + role colours. Structure never glows — the engine enforces that, not the palette.
//   • HUD type → CSS custom properties on :root (the pages' CSS defaults = today's values, so no flash).
//
// Tokens are authored in OKLCH (perceptual lightness L, chroma C, hue h°) so ramps can be LUMINANCE-
// MATCHED: within a candidate the three family ramps share the same L at each stop (hue = family,
// light = density) — one crime never reads brighter than another just because of its hue. Out-of-gamut
// tokens are clipped by REDUCING CHROMA at fixed L and h (never by clamping channels), so hues hold.
//
// Adding a family: add its crime keys to CRIME_FAMILY, append it to FAMILY_ORDER (≤ 4 ramps — the
// engine's MAX_RAMPS), and give every candidate a hue triple for it. Adding a candidate: add a spec to
// CANDIDATES + its name to PALETTE_CYCLE. Nothing else changes — call sites only name crimes and roles.
//
// Pure maths + a DOM-optional apply: importable headless (node) for the colour tests.

// ---- OKLCH ⇄ sRGB (Björn Ottosson's OKLab matrices) ------------------------------------------------
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** OKLCH → LINEAR sRGB [r, g, b] (may fall outside 0..1 when out of gamut). h in degrees. */
export function oklchToLinear(L, C, h) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr), b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

/** sRGB hex → { L, C, h } (for reading today's literals into the same space). */
export function hexToOklch(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = toLinear(((n >> 16) & 255) / 255), g = toLinear(((n >> 8) & 255) / 255), b = toLinear((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  let h = (Math.atan2(B, A) * 180) / Math.PI; if (h < 0) h += 360;
  return { L, C: Math.hypot(A, B), h };
}

const inGamut = (rgb, eps = 1e-7) => rgb.every((c) => c >= -eps && c <= 1 + eps);
const hex2 = (c) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, c))))) * 255).toString(16).padStart(2, '0');

/**
 * OKLCH → an sRGB hex token, gamut-clipped by CHROMA REDUCTION at fixed L and h (bisection), so the
 * hue and lightness the author asked for are what renders. Returns the hex plus the chroma actually
 * achieved (`clipped` when it had to give some up).
 */
export function oklch(L, C, h) {
  let c = C;
  if (!inGamut(oklchToLinear(L, C, h))) {
    let lo = 0, hi = C;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (inGamut(oklchToLinear(L, mid, h))) lo = mid; else hi = mid; }
    c = lo;
  }
  const [r, g, b] = oklchToLinear(L, c, h);
  return { hex: '#' + hex2(r) + hex2(g) + hex2(b), L, C: c, h, wantC: C, clipped: c < C - 1e-6 };
}

// ---- crime → FAMILY → ramp index (SAPS's own grouping) ---------------------------------------------
export const FAMILY_ORDER = ['contact', 'property', 'commercial']; // ramp index = position (engine: ≤ 4)
export const CRIME_FAMILY = {
  murder: 'contact', sexoff: 'contact', robbery: 'contact', carjacking: 'contact', // contact crimes
  burglary: 'property',                                                            // property-related
  commercial: 'commercial',                                                        // commercial crime
};
/** The SAPS family a crime key belongs to. Unknown keys fall to the first family — add them above. */
export const familyOf = (crimeKey) => CRIME_FAMILY[crimeKey] || FAMILY_ORDER[0];
/** The data-ramp index (layout.ramp) a crime's dots are painted with. */
export const rampIndexOf = (crimeKey) => Math.max(0, FAMILY_ORDER.indexOf(familyOf(crimeKey)));

// ---- STRUCTURE roles → role index (layout.role; 0 = the pool's own matte) ---------------------------
export const ROLE_ORDER = ['lace', 'district', 'coast', 'frame', 'words', 'residents', 'unlit', 'terrain'];
export const ROLES = Object.fromEntries(ROLE_ORDER.map((r, i) => [r, i]));

// ---- HUD tokens → CSS custom properties. `from` = which authored token a derived one borrows its
// chroma + hue from (at today's lightness) when a candidate doesn't set it explicitly. ----------------
const HUD_TOKENS = {
  'hud-text': { base: '#8792a6', from: 'hud-text' },   // the HUD's running text
  'hud-strong': { base: '#d4dcef', from: 'hud-text' }, // emphasis (<b>)
  'hud-hint': { base: '#ffce86', from: 'hud-hint' },   // key glyphs + the hint line (and About links)
  'hud-dim': { base: '#6b7689', from: 'hud-text' },    // fps + dim captions
  'hud-sep': { base: '#3a4456', from: 'hud-text' },    // the chip-row group separators
  'hud-flag': { base: '#5e6a52', from: 'hud-flag' },   // the ◆ source credit
  brand: { base: '#cdd6ee', from: 'hud-text' },        // MISDAADVELD / THE TOLL
  'brand-sub': { base: '#77839a', from: 'hud-text' },  // the brand's sub-line, card tags, source lines
  'card-text': { base: '#a8b2c6', from: 'hud-text' },  // About / locate / suburb-caption body
  'card-head': { base: '#e6ebf5', from: 'hud-text' },  // card headings
  'card-dim': { base: '#93a0b5', from: 'hud-text' },   // the honesty paragraphs
  'card-strong': { base: '#b9c4d8', from: 'hud-text' },// the honesty paragraphs' lead-ins
  fig: { base: '#5a6377', from: 'hud-text' },          // the Toll's flanking figures (near the word's grey)
};

// ---- the CANDIDATES (live-switched for the maker's eye; default = current) --------------------------
const L_STOPS = [0.70, 0.81, 0.76]; // shared stop lightness ≈ today's ramp (0.70 / 0.82 / 0.75)
const ROLE_L = { lace: 0.42, district: 0.52, coast: 0.66, frame: 0.50, words: 0.42, residents: 0.58, terrain: 0.48 };
const TODAY_RAMP = ['#7c9ce0', '#e8b892', '#ff8a3a'];

export const CANDIDATES = {
  // Exactly today — literal hexes (the legacy baseline), so switching back is pixel-identical.
  current: {
    label: 'current',
    ramps: { contact: TODAY_RAMP, property: TODAY_RAMP, commercial: TODAY_RAMP },
    roles: { lace: '#566d78', district: '#566d78', coast: '#566d78', frame: '#566d78', words: '#3a4656', residents: '#566d78', unlit: '#55496b', terrain: '#566d78' },
    bg: '#05060a',
    hud: Object.fromEntries(Object.entries(HUD_TOKENS).map(([k, v]) => [k, v.base])),
  },
  // A — warm ember: contact rose→coral→vermilion-amber, property blue→sand→gold, commercial steel→seafoam→mint.
  ember: {
    label: 'A · Ember',
    stops: { L: L_STOPS, C: [0.10, 0.08, 0.16] },
    hues: { contact: [355, 25, 38], property: [265, 70, 80], commercial: [230, 190, 165] },
    structure: { h: 80, C: 0.015, L: ROLE_L, unlit: [0.45, 0.05, 300] },
    bg: '#05060a',
    hud: { 'hud-text': [0.68, 0.02, 80], 'hud-strong': [0.88], 'hud-hint': [0.85, 0.11, 75], 'hud-flag': [0.55, 0.03, 130] },
  },
  // B — cooler, quieter: moonlit structure, violet commercial.
  nocturne: {
    label: 'B · Nocturne',
    stops: { L: L_STOPS, C: [0.08, 0.06, 0.12] },
    hues: { contact: [330, 10, 25], property: [250, 80, 85], commercial: [290, 300, 310] },
    structure: { h: 250, C: 0.03, L: { ...ROLE_L, coast: 0.68 }, unlit: [0.45, 0.05, 300] },
    bg: [0.12, 0.02, 265],
    hud: { 'hud-text': [0.70, 0.03, 250], 'hud-hint': [0.85, 0.07, 240], 'hud-flag': [0.55, 0.03, 200] },
  },
  // C — vivid: magenta→red→orange, electric blue→amber→yellow, cyan; blue-slate structure, teal coast.
  spectral: {
    label: 'C · Spectral',
    stops: { L: L_STOPS, C: [0.13, 0.11, 0.19] },
    hues: { contact: [340, 15, 30], property: [255, 75, 90], commercial: [210, 185, 175] },
    structure: { h: 240, C: 0.04, L: ROLE_L, overrides: { coast: [0.68, 0.05, 200] }, unlit: [0.46, 0.06, 300] },
    bg: [0.10, 0.025, 270],
    hud: { 'hud-text': [0.70, 0.03, 240], 'hud-hint': [0.86, 0.10, 170], 'hud-flag': [0.55, 0.04, 200] },
  },
};
export const PALETTE_CYCLE = ['current', 'ember', 'nocturne', 'spectral'];
const ALIASES = { a: 'ember', b: 'nocturne', c: 'spectral', default: 'current', today: 'current' };
/** Normalise a name/alias ('A', 'ember', 'Current'…) to a candidate key, or null. */
export function paletteKey(name) {
  const k = String(name ?? '').trim().toLowerCase();
  return CANDIDATES[k] ? k : (ALIASES[k] || null);
}
export const nextPalette = (name) => PALETTE_CYCLE[(PALETTE_CYCLE.indexOf(paletteKey(name) || 'current') + 1) % PALETTE_CYCLE.length];

// ---- resolve a candidate into concrete hex tokens (cached) ------------------------------------------
const tok = (v) => (typeof v === 'string' ? { hex: v, clipped: false } : oklch(v[0], v[1], v[2]));
const cache = new Map();
/**
 * { name, label, ramps: [[cool, mid, warm] × 4], rampsByFamily, roles: [hex × 8], bg, css: {var: hex},
 *   clips: [{ token, wantC, C }] } — every token as an sRGB hex the engine / CSS can take.
 */
export function resolvePalette(name) {
  const key = paletteKey(name) || 'current';
  if (cache.has(key)) return cache.get(key);
  const spec = CANDIDATES[key];
  const clips = [];
  const note = (label, t) => { // record chroma the gamut took (report-worthy losses only, > 0.0005)
    if (t.clipped && t.wantC - t.C > 5e-4) clips.push({ token: label, wantC: +t.wantC.toFixed(3), C: +t.C.toFixed(3) });
    return t.hex;
  };

  // Data ramps, one per family (FAMILY_ORDER), the spare slots filled with the first family's ramp.
  const rampsByFamily = {};
  for (const fam of FAMILY_ORDER) {
    rampsByFamily[fam] = spec.ramps
      ? spec.ramps[fam].slice()
      : spec.hues[fam].map((h, i) => note(`${fam}[${i}]`, oklch(spec.stops.L[i], spec.stops.C[i], h)));
  }
  const ramps = FAMILY_ORDER.map((f) => rampsByFamily[f]);
  while (ramps.length < 4) ramps.push(ramps[0].slice());

  // Structure roles (index 0 = lace = what each untagged outline dot draws).
  const roles = ROLE_ORDER.map((r) => {
    if (spec.roles) return spec.roles[r];
    const s = spec.structure;
    if (r === 'unlit') return note('unlit', oklch(...s.unlit));
    if (s.overrides && s.overrides[r]) return note(r, oklch(...s.overrides[r]));
    return note(r, oklch(s.L[r], s.C, s.h));
  });

  const bg = typeof spec.bg === 'string' ? spec.bg : note('bg', oklch(...spec.bg));

  // HUD: authored tokens as given ([L] alone borrows C/h from its `from`), the rest keep TODAY's
  // lightness in the candidate's own neutral/hint/flag chroma + hue — one rule, no guessed values.
  const css = { bg };
  if (spec.roles) Object.assign(css, spec.hud);
  else {
    const authored = {};
    for (const [k, v] of Object.entries(spec.hud)) authored[k] = v;
    const full = (k) => { const v = authored[k]; return v && v.length === 3 ? v : null; };
    for (const [k, { base, from }] of Object.entries(HUD_TOKENS)) {
      const src = full(from) || full('hud-text');
      const own = authored[k];
      const L = own ? own[0] : hexToOklch(base).L;
      const C = own && own.length === 3 ? own[1] : src[1];
      const h = own && own.length === 3 ? own[2] : src[2];
      css[k] = note(`hud:${k}`, oklch(L, C, h));
    }
  }
  const out = { name: key, label: spec.label, ramps, rampsByFamily, roles, bg, css, clips };
  cache.set(key, out);
  return out;
}

// ---- APPLY: the one call that repaints everything ----------------------------------------------------
/**
 * Apply a candidate to pools + background + HUD.
 * @param {string} name candidate key or alias ('current', 'A'/'ember', 'B'/'nocturne', 'C'/'spectral')
 * @param {object} o
 * @param {Array<{pool, role?}>} [o.pools] every PointField to paint. Data pools (pool.glow) get the family
 *        ramps; structure pools get the role colours + their matte = the token of `role` (default 'lace').
 * @param {object} [o.background] a THREE.Color to set IN PLACE (the render loop re-assigns
 *        scene.background from the same object every frame, so mutate it, don't replace it).
 * @param {Document} [o.document] sets the HUD CSS custom properties on :root.
 * @returns the resolved palette.
 */
export function applyPalette(name, { pools = [], background = null, document: doc = null } = {}) {
  const P = resolvePalette(name);
  for (const entry of pools) {
    const pool = entry && entry.pool;
    if (!pool) continue;
    if (pool.glow) pool.setRamps(P.ramps);
    else {
      pool.setRoleColors(P.roles);
      pool.setMatte(P.roles[ROLES[entry.role] ?? 0]);
    }
  }
  if (background && background.set) background.set(P.bg);
  if (doc && doc.documentElement) {
    const st = doc.documentElement.style;
    for (const [k, v] of Object.entries(P.css)) st.setProperty('--' + k, v);
  }
  return P;
}

/** A small self-removing toast naming the palette (1.5 s) — the eye session's "which one is this?". */
export function paletteToast(label, doc = typeof document !== 'undefined' ? document : null, ms = 1500) {
  if (!doc) return;
  let el = doc.getElementById('palette-toast');
  if (!el) {
    el = doc.createElement('div');
    el.id = 'palette-toast';
    el.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:45;' +
      'font:12px/1.5 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.08em;color:var(--hud-strong,#d4dcef);' +
      'padding:6px 14px;border-radius:8px;background:rgba(6,8,13,.78);border:1px solid rgba(140,170,210,.16);' +
      'pointer-events:none;user-select:none;opacity:0;transition:opacity .25s ease';
    doc.body.appendChild(el);
  }
  el.textContent = 'palette · ' + label;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, ms);
}
