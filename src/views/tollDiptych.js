// THE TOLL — DIPTYCH: two provinces' 18-year murder accumulations side by side, as ONE ceremony on the
// shared shell. Western Cape (left) and Gauteng (right), each a growing disc on its own year-dial, both
// poured by ONE SHARED CALENDAR CLOCK. Sibling of src/views/toll.js (the single-province ceremony) —
// same techniques (phase machine, ordered seeds, counter binary-search, dial scrub grammar, ring
// rollover, memorial word, neutralise-on-exit), remapped onto per-province SLICES of the shared pool.
//
// THE CLOCK IS CALENDAR-UNIFORM (deliberately unlike the single toll, which is event-uniform with the
// hand lingering in heavy years): here each of the 18 years takes EQUAL time, the hands sweep steadily
// in step on both dials, and a heavy year pours as a visible BURST — so the two discs stay comparable
// year by year. Per-dot completion target for province p, year y, within-year index j:
//     t = (y + (j+0.5)/perYear_p[y]) / Y
// converted to the engine's seed convention exactly as toll.js does (a dot completes at
// uT = s01·(1−w) + w, so s01 = max(0, (t − w)/(1 − w)), seed = s01/0.1591549431). Seeds are MONOTONE
// within each province's slice → per-province landed-counts come from the same binary-search-on-the-
// shader's-formula technique as toll.js, slice-local.
//
// THE TOGGLES ARE THE POINT (maker picks by eye later, live via __viz.diptych):
//   • size: 'same' (both discs R_REF — Gauteng reads denser; density = light is this piece's language)
//           'area' (R ∝ √M — equal areal density) · 'radius' (R ∝ M — a unit of radius = the same count
//           on both discs). Switching re-bakes disc layouts + dial frames live (cheap CPU rebuild).
//   • words: 'shared' (ONE central MURDER spanning the composition) · 'each' (a word over each disc,
//           like the single pages). Word pool built once via ctx.makePool, kept.
//
// NO orrery spin in this view — the engine has a single uSpinCentre; two discs would need two (deferred).
//
// INVARIANTS (toll.js parity):
//  • SINGLE-WRITER per frame: phase machine → field.setT → field.setTime → ctx.struct.tick.
//  • PERSISTENT pools + NEUTRALISE on exit (seeds, spin asserted off, stagger, structField size) WITHOUT
//    wiping the live pose. Listeners add on enter(), remove on exit(). Own _downX/_downY.
//  • Keys guard on !ctx.hud.about.isOpen (About gets first dibs).
//  • STANDALONE always (idleViewKey null): you land in the ceremony, it auto-pours and stands; K/M
//    replays; Space pauses; drag EITHER dial scrubs the one shared clock; there is no drain/home.
import { tollLayouts, tollFrameLayout, tollHandLayout, textLayout } from '../layouts/capeTown.js';

export function createTollDiptychView(ctx) {
  const { years, yearLabels, provinces } = ctx.data;
  const Y = years.length;
  const TAU = Math.PI * 2;
  const _hv = new ctx.THREE.Vector3();                 // view-owned projection scratch

  // ---- EYE-TUNABLE options — ONE object; the overseer + maker tune positions/sizes by eye ------------
  const OPT = {
    colX: 370,             // column centres at cx ± colX (box w 1400)
    cyFrac: -0.06,         // discs' vertical bias, × box.h (matches tollGeom's −0.06)
    R_REF: 230,            // reference disc radius (≈ the single page's 0.32·min(box)); anchors max-M province
    dialFrac: 1.16,        // dialR = R × dialFrac (matches tollGeom)
    size: 'same',          // DEFAULT sizing mode: 'same' | 'area' | 'radius'
    words: 'each',         // DEFAULT word mode (maker's pick 2026-07-14): a word over EACH disc
    sharedWord: { fontFrac: 0.22, jitter: 0.8, weight: 800, yFrac: 0.46, spanFrac: 0.36, cx: 0 },  // narrow — clears the names
    eachWord: { fontFrac: 0.14, jitter: 0.8, weight: 800, yFrac: 0.41, spanFrac: 0.28 },
    figPx: 14,             // base figure type size (px at the opening framing; scales with zoom)
    namePx: 13,            // base name size in 'shared' mode (px; scales with zoom)
    figClearFrac: 0.85,    // 'each': figure clearance beyond the word's half-width, ∝ word height (single-page parity)
    figHFrac: 0.30,        // 'each': figure font ∝ its word's ink height (the single page's proportion) — fixed-px read too LARGE here
    nameSpanFrac: 0.29,    // 'each': name width as a fraction of its word's ink width (single-page parity)
    readingBelow: 34,      // 'shared': the pair sits UNDER its disc (flanking figures collided mid-frame + clipped at the edges)
    pairGap: 24,           // 'shared': half-gap between the pair's numbers at the disc's centreline
    nameAbove: 20,         // 'shared': name's world offset above each dial's top
  };

  // ---- constants (parity: toll.js L31–39) ------------------------------------------------------------
  const TOLL_SWEEP_MS = 75000, TOLL_GATHER_MS = 2400;
  const TOLL_FLIGHT_S = 1.2, TOLL_HOLD_MS = 350;
  const TOLL_FRAME_DOTS = 200000, TOLL_THIN = 0.22;
  const PIE_LINE_SIZE = 1.3, STRUCT_DOT_SIZE = 1.6;    // struct dot size during the ceremony / restored on exit
  const WORD_N = 22000;
  const tollW = () => Math.min(0.95, TOLL_FLIGHT_S / (TOLL_SWEEP_MS / 1000));
  const swarmEase = (x) => x;                          // constant speed (parity: wcExplore L163)

  let tollWord = 'MURDER';

  // ---- state (view-owned) ----------------------------------------------------------------------------
  let active = false, phase = '';                      // '' | 'gather' | 'toll' (standalone: no drain/home)
  let t = 0, tollT = 0;                                // t = field morph; tollT = the shared clock's uT
  let paused = false, holdKey = false, holdPtr = false, scrubbing = false;
  let sizeMode = OPT.size, wordsMode = OPT.words;
  let tollFrame = null;                                // the COMBINED two-dial struct layout
  let tollSeedsSaved = null;                           // the pool's random seeds, restored on exit
  let lastCounts = null, lastYear = -1, done = false;
  let phaseStart = 0, lastNow = 0, handAngle = -1, holdTimer = 0;
  let wordField = null, roll = null, reading = null;   // owned pools/primitives, built lazily, kept across K
  let wordBounds = null;                               // 'each': per-disc word ink boxes; 'shared': null
  let figPxRest = 0;                                   // px-per-world at the opening framing — type's 1:1 ref
  let _downX = 0, _downY = 0;                          // OWN tap down-point (plan §1)

  // One persistent record per province: geometry rebakes on size-switch; seeds bake ONCE (calendar-only).
  const discs = provinces.map((p) => ({
    M: p.M, offset: p.offset,
    cx: 0, cy: 0, R: 0, dialR: 0,
    lay: null,                                         // tollLayouts result (source/disc/perYear/cum/seamRadii/r0)
    hand: null,                                        // { start, count } into the COMBINED struct layout
    seeds: null,                                       // slice-local ordered seeds (calendar clock)
  }));

  // ---- geometry: the three sizing modes --------------------------------------------------------------
  // 'same'   → both discs R_REF (density = light carries the difference — the project's language).
  // 'area'   → R ∝ √M: equal areal density (M/(π·0.9975·R²) equal since r0 = 0.05R).
  // 'radius' → R ∝ M: a unit of radius = the same count on both discs (band mapping is r0 + 0.95R·cum/M).
  // R_REF anchors the LARGEST M so nothing outgrows the composition box.
  function radiusFor(M, mode) {
    const Mmax = Math.max(...provinces.map((p) => p.M));
    if (mode === 'area') return OPT.R_REF * Math.sqrt(M / Mmax);
    if (mode === 'radius') return OPT.R_REF * (M / Mmax);
    return OPT.R_REF;
  }

  // Bake each province's disc endpoints around its own column centre. count = M_p exactly → tollLayouts
  // returns slice-sized arrays (nothing parked), written into the shared pool at the province's offset
  // via the engine's setSource/setTarget(layout, offset). Geometry only — seeds are untouched.
  function bakeDiscs(mode) {
    const box = ctx.data.box, cy = box.h * OPT.cyFrac;
    for (let i = 0; i < discs.length; i++) {
      const d = discs[i], p = provinces[i];
      const R = radiusFor(p.M, mode);
      const cx = (i === 0 ? -1 : 1) * OPT.colX;
      const lay = tollLayouts(p.stations, { years, count: p.M, park: null, cx, cy, R, dialR: R * OPT.dialFrac });
      if (!lay) { console.error('[diptych] pool cannot hold the toll — ceremony unavailable', p.label); return false; }
      Object.assign(d, { cx, cy, R, dialR: R * OPT.dialFrac, lay });
    }
    return true;
  }

  // The two dials share ONE struct pool, HALF each: two tollFrameLayout bakes packed into one combined
  // layout; each dial's hand slice is its frame-local slice shifted by the dial's pack offset.
  function bakeFrames() {
    const structN = ctx.data.structN;
    const half = Math.floor(structN / discs.length);
    const positions = new Float32Array(structN * 2), density = new Float32Array(structN), z = new Float32Array(structN);
    discs.forEach((d, i) => {
      const f = tollFrameLayout(half, {
        cx: d.cx, cy: d.cy, R: d.R, dialR: d.dialR,
        ticks: Y, seamRadii: d.lay.seamRadii, frameDots: TOLL_FRAME_DOTS, thin: TOLL_THIN,
      });
      positions.set(f.positions, i * half * 2);
      density.set(f.density, i * half);
      d.hand = { start: i * half + f.hand.start, count: f.hand.count };
    });
    tollFrame = { positions, density, z };
  }

  // ---- the shared calendar clock ---------------------------------------------------------------------
  // uT IS the calendar fraction: dot (y, j) completes at uT = (y + (j+0.5)/perYear[y]) / Y, so the hand
  // angle is simply frac = uT — the sweep is steady, the pour bursts with the heavy years.
  function yearFrac(uT) {
    const c = Math.min(Math.max(uT, 0), 1);
    const yf = c * Y;
    const y = Math.min(Y - 1, Math.floor(yf));
    return { y, f: Math.min(1, yf - y), frac: c };
  }

  // Slice-local ordered seeds, baked ONCE per province (they depend only on perYear, never on geometry).
  function bakeSeeds(d) {
    const w = tollW(), per = d.lay.perYear;
    d.seeds = new Float32Array(d.M);
    let k = 0;
    for (let y = 0; y < Y; y++) {
      const n = per[y];
      for (let j = 0; j < n; j++, k++) {
        const tt = (y + (j + 0.5) / n) / Y;                      // the dot's CALENDAR completion target
        d.seeds[k] = Math.max(0, (tt - w) / (1 - w)) / 0.1591549431;
      }
    }
  }

  // Per-province landed count — binary search of the SHADER's own formula over the slice's monotone
  // seeds (fround parity with the GPU; the counter and the disc are one formula — toll.js L128–137).
  function countAt(i, uT) {
    const d = discs[i], w = tollW();
    let lo = 0, hi = d.M;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const s01 = Math.fround(d.seeds[mid] * 0.1591549431) % 1;
      if ((uT - s01 * (1 - w)) / w >= 1) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  // Hold-drip: ~one recorded murder per second ACROSS THE PAIR. Calendar-uniform completions in year y
  // arrive at Y·(Σp perYear_p[y]) per unit uT, so duT/dt = 1/(Y·n_y) lands one per second (the two
  // provinces' pulses interleave — a slight syncopation around the 1/s average within each year).
  function dripRate() {
    const y = yearFrac(tollT).y;
    const n = discs.reduce((a, d) => a + (d.lay ? d.lay.perYear[y] : 0), 0);
    return n ? 1 / (n * Y) : 1000 / TOLL_SWEEP_MS;
  }

  // ---- the memorial WORD(s) — grey structure, no glow, behind the discs (renderOrder −2) --------------
  function showWord() {
    if (!wordField) return;
    if (!tollWord) { wordField.points.visible = false; wordBounds = null; return; }
    const box = ctx.data.box, cy = box.h * OPT.cyFrac;
    if (wordsMode === 'shared') {
      const o = OPT.sharedWord;                        // ONE central word spanning the composition
      const lay = textLayout(tollWord, WORD_N, box, {
        fontFrac: o.fontFrac, jitter: o.jitter, weight: o.weight, spanFrac: o.spanFrac,
        cx: o.cx, cy: cy + o.yFrac * box.h,
      });
      wordField.setSource(lay); wordField.setTarget(lay); wordField.setT(1);
      wordBounds = null;                               // figures anchor to the DISCS in this mode
    } else {
      const o = OPT.eachWord;                          // a word over each disc, like the single pages
      const half = Math.floor(WORD_N / discs.length);
      const positions = new Float32Array(WORD_N * 2), density = new Float32Array(WORD_N);
      wordBounds = discs.map((d, i) => {
        const lay = textLayout(tollWord, half, box, {
          fontFrac: o.fontFrac, jitter: o.jitter, weight: o.weight, spanFrac: o.spanFrac,
          cx: d.cx, cy: cy + o.yFrac * box.h,
        });
        positions.set(lay.positions, i * half * 2);
        density.set(lay.density, i * half);
        return lay.bounds;
      });
      const lay = { positions, density };
      wordField.setSource(lay); wordField.setTarget(lay); wordField.setT(1);
    }
    wordField.points.visible = true;
  }
  function hideWord() { if (wordField) wordField.points.visible = false; wordBounds = null; }

  // ---- THE READING, per disc: province NAME + year-count (resets) + running total ---------------------
  // Built from hud.makeFigure (HUD-owned divs, view-driven): left figure right-aligned, right figure
  // left-aligned, name alignment switches with the word mode.
  function buildReading() {
    reading = discs.map(() => ({
      year: ctx.hud.makeFigure('transform:translate(-100%,-50%);text-align:right'),
      total: ctx.hud.makeFigure('transform:translate(0,-50%);text-align:left'),
      name: ctx.hud.makeFigure(''),
      nameUnit: 0,                                     // name px width per 1px font-size (monospace → exact)
    }));
    discs.forEach((d, i) => {
      const rd = reading[i];
      rd.name.set(provinces[i].label);
      // Small-probe measure (single page's trick): tiny font → no viewport clamp, exact ratio.
      rd.name.el.style.fontSize = '10px';
      rd.nameUnit = rd.name.el.getBoundingClientRect().width / 10;
      rd.name.el.style.fontSize = '';
    });
    applyWordsMode();
  }
  function applyWordsMode() {
    if (!reading) return;
    for (const rd of reading) {
      // 'each': the name's left edge seats on the word's first letter (single-page grammar).
      // 'shared': the name centres above its disc.
      rd.name.el.style.transform = wordsMode === 'each' ? 'translate(0,-50%)' : 'translate(-50%,-50%)';
      rd.name.el.style.textAlign = wordsMode === 'each' ? 'left' : 'center';
    }
  }
  function showReading(v) { if (reading) for (const rd of reading) { rd.year.show(v); rd.total.show(v); rd.name.show(v); } }

  // Pin the reading to PROJECTED world anchors every frame (holds at any window aspect/zoom/resize) and
  // scale the type with the zoom — the reading is part of the object, not chrome floating over it.
  function placeReading() {
    if (!reading || !discs[0].lay) return;
    const rect = ctx.dom.getBoundingClientRect();
    const project = (x, y) => {
      _hv.set(x, y, 0).project(ctx.camera);
      return { x: rect.left + (_hv.x * 0.5 + 0.5) * rect.width, y: rect.top + (-_hv.y * 0.5 + 0.5) * rect.height };
    };
    const a = project(0, 0), b = project(100, 0);      // px-per-world via a 100-unit probe
    const ppw = Math.abs(b.x - a.x) / 100;
    if (!figPxRest) figPxRest = ppw;
    const scale = ppw / figPxRest;
    const figFs = (OPT.figPx * scale).toFixed(2) + 'px';
    discs.forEach((d, i) => {
      const rd = reading[i];
      if (wordsMode === 'each' && wordBounds && wordBounds[i]) {
        // Single-page grammar, per disc: the numbers FLANK the word, sized ∝ its ink height (maker's
        // pick — the fixed-size under-disc pair read too large). At this proportion the inner figures
        // clear each other mid-frame.
        const wb = wordBounds[i];
        const fs = (wb.h * ppw * OPT.figHFrac).toFixed(2) + 'px';
        rd.year.el.style.fontSize = fs;
        rd.total.el.style.fontSize = fs;
        const half = wb.w / 2 + wb.h * OPT.figClearFrac;
        const L = project(wb.cx - half, wb.cy), R = project(wb.cx + half, wb.cy);
        rd.year.place(L.x, L.y); rd.total.place(R.x, R.y);
        const nx = project(wb.cx - wb.w / 2, wb.cy + wb.h * 0.62);
        rd.name.place(nx.x, nx.y);                     // seated just above the ink, on the first letter
        if (rd.nameUnit) rd.name.el.style.fontSize = ((wb.w * ppw * OPT.nameSpanFrac) / rd.nameUnit).toFixed(2) + 'px';
      } else {
        rd.year.el.style.fontSize = figFs;
        rd.total.el.style.fontSize = figFs;
        const yB = d.cy - d.dialR - OPT.readingBelow;  // 'shared': the pair under its disc (flanks collided)
        const L = project(d.cx - OPT.pairGap, yB);
        const R = project(d.cx + OPT.pairGap, yB);
        rd.year.place(L.x, L.y); rd.total.place(R.x, R.y);
        const nx = project(d.cx, d.cy + d.dialR + OPT.nameAbove);
        rd.name.place(nx.x, nx.y);                     // seated above the disc
        rd.name.el.style.fontSize = (OPT.namePx * scale).toFixed(2) + 'px';
      }
    });
  }

  // Per-disc figures: left resets per year, right cumulates (single-page grammar, once per disc).
  function updateReading(force = false) {
    if (!reading || !discs[0].lay) return;
    const counting = phase === 'toll';
    const { y } = yearFrac(counting ? tollT : 0);
    const counts = discs.map((d, i) => (counting && d.seeds ? countAt(i, tollT) : 0));
    if (!force && lastCounts && y === lastYear && counts.every((n, i) => n === lastCounts[i])) return;
    lastCounts = counts; lastYear = y;
    const complete = counting && counts.every((n, i) => n >= discs[i].M);
    discs.forEach((d, i) => {
      const n = counts[i];
      const inYear = Math.max(0, n - d.lay.cum[y]);    // landings lag the hand — never more than the year holds
      reading[i].year.set((complete ? d.lay.perYear[y] : inYear).toLocaleString());
      reading[i].total.set(n.toLocaleString());
    });
    if (complete !== done) { done = complete; syncHud(); }
  }

  // ---- hint (standalone grammar; chips are HUD-owned `about` only on this page) -----------------------
  function hintText() {
    if (phase === 'gather') return 'the years are gathering…';
    if (done) return `the toll stands · drag either dial to scrub · K replays · S size (${sizeMode}) · W words (${wordsMode})`;
    if (holdPtr || holdKey) return 'one recorded murder per second — release to resume the sweep';
    if (paused) return 'paused — space resumes · drag either dial to scrub';
    return 'drag either dial to scrub · hold a disc for one per second · space pauses';
  }
  function syncHud() { ctx.hud.setHint(hintText()); ctx.hud.chips.refresh(); }

  // ---- the hands ride the dials: rewrite ONLY their slices, both at the SAME shared angle -------------
  function updateHands(uT) {
    if (!tollFrame || ctx.struct.progress < 1 || ctx.struct.current !== tollFrame) return;
    const angle = yearFrac(uT).frac * TAU;
    if (Math.abs(angle - handAngle) < 6e-4) return;
    handAngle = angle;
    for (const d of discs) {
      const h = tollHandLayout(d.hand.count, { cx: d.cx, cy: d.cy, R: d.R, dialR: d.dialR, angle, thin: TOLL_THIN });
      tollFrame.positions.set(h.positions, d.hand.start * 2);
      tollFrame.density.set(h.density, d.hand.start);
      const slice = {
        positions: tollFrame.positions.subarray(d.hand.start * 2, (d.hand.start + d.hand.count) * 2),
        density: tollFrame.density.subarray(d.hand.start, d.hand.start + d.hand.count),
      };
      ctx.structField.setSource(slice, d.hand.start);
      ctx.structField.setTarget(slice, d.hand.start);
    }
  }

  // ---- ring rollover — nearest disc centre decides WHICH disc; then that disc's seams name the year ---
  function updateRollover(clientX, clientY) {
    if (phase !== 'toll' || scrubbing || !discs[0].lay) { if (roll) roll.hide(); return; }
    const p = worldAt(clientX, clientY);
    const d = nearestDisc(p);
    const r = Math.hypot(p.x - d.cx, p.y - d.cy);
    if (r < d.lay.r0 || r > d.R) { if (roll) roll.hide(); return; }
    let y = 0;
    while (y < d.lay.seamRadii.length && r >= d.lay.seamRadii[y]) y++;
    if (!roll) roll = ctx.hud.floatingCaption('rollover');
    roll.show(`${yearLabels[y]} · ${d.lay.perYear[y].toLocaleString()} recorded`, clientX, clientY);
  }

  // ---- pointer grammar: drag EITHER dial scrubs the ONE shared clock ----------------------------------
  function worldAt(clientX, clientY) {
    const rect = ctx.dom.getBoundingClientRect();
    _hv.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1, 0.5).unproject(ctx.camera);
    const dir = _hv.sub(ctx.camera.position).normalize();
    const k = -ctx.camera.position.z / dir.z;
    return { x: ctx.camera.position.x + dir.x * k, y: ctx.camera.position.y + dir.y * k };
  }
  function nearestDisc(p) {
    let best = discs[0], bestD = Infinity;
    for (const d of discs) {
      const dist = Math.hypot(p.x - d.cx, p.y - d.cy);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  }
  let scrubDisc = null;                                // the dial under the drag — its centre owns the angle math
  function scrubTo(clientX, clientY) {
    const d = scrubDisc || discs[0];
    const p = worldAt(clientX, clientY);
    const ang = Math.atan2(p.x - d.cx, p.y - d.cy);    // 0 at twelve, clockwise positive
    let frac = ang / TAU; if (frac < 0) frac += 1;
    const cur = yearFrac(tollT).frac;                  // unwrap: the dial can't teleport across twelve
    if (frac - cur > 0.5) frac -= 1;
    if (cur - frac > 0.5) frac += 1;
    tollT = Math.min(1, Math.max(0, frac));            // calendar-uniform: frac IS uT
    t = tollT;
    updateReading();
  }

  function onPointerDown(e) {
    _downX = e.clientX; _downY = e.clientY;            // OWN down-point (plan §1)
    if (phase !== 'toll') return;
    const p = worldAt(e.clientX, e.clientY);
    const d = nearestDisc(p);
    const r = Math.hypot(p.x - d.cx, p.y - d.cy);
    if (r <= d.R * 1.02) {                             // a disc: press-and-hold → one per second
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { holdPtr = true; syncHud(); }, TOLL_HOLD_MS);
    } else if (r <= d.dialR * 1.3) {                   // a dial ring: EITHER dial IS the scrubber
      scrubDisc = d; scrubbing = true; scrubTo(e.clientX, e.clientY);
    }
  }
  function onPointerMove(e) {
    if (scrubbing) scrubTo(e.clientX, e.clientY);
    updateRollover(e.clientX, e.clientY);
  }
  function onPointerUp() {
    clearTimeout(holdTimer);
    if (holdPtr) { holdPtr = false; syncHud(); }
    scrubbing = false; scrubDisc = null;               // standalone: no map to tap back to
  }
  function onKeyDown(e) {
    if (ctx.hud.about.isOpen) return;                  // About gets first dibs (plan §1)
    if (e.code === 'Space') { e.preventDefault(); pauseToggle(); }
    else if (e.code === 'Digit1') { e.preventDefault(); if (!holdKey) { holdKey = true; syncHud(); } }
    else if (e.code === 'KeyK' || e.code === 'KeyM') { e.preventDefault(); replay(); }
    else if (e.code === 'KeyS') {                      // cycle the sizing rule BY EYE: same → area → radius
      e.preventDefault();
      setSizeMode({ same: 'area', area: 'radius', radius: 'same' }[sizeMode]);
      syncHud();
    } else if (e.code === 'KeyW') {                    // flip the word mode BY EYE: shared ⇄ each
      e.preventDefault();
      setWordsMode(wordsMode === 'shared' ? 'each' : 'shared');
      syncHud();
    }
  }
  function onKeyUp(e) { if (e.code === 'Digit1' && holdKey) { holdKey = false; syncHud(); } }

  // ---- phase transitions -------------------------------------------------------------------------------
  function beginClock(now) {
    tollSeedsSaved = Float32Array.from(ctx.field.points.geometry.getAttribute('aSeed').array);
    const seeds = Float32Array.from(tollSeedsSaved);
    for (const d of discs) {
      if (!d.seeds) bakeSeeds(d);                      // once — the calendar clock never changes with geometry
      seeds.set(d.seeds, d.offset);
      ctx.field.setSource(d.lay.source, d.offset);     // born on its own dial's ring, in its year's arc
      ctx.field.setTarget(d.lay.disc, d.offset);       // …lands in its own disc's year-band
    }
    ctx.field.setSeeds(seeds);
    ctx.field.setStagger(tollW());
    // NO spin: the engine has one uSpinCentre; two discs would need two (deferred — deliberate).
    phase = 'toll'; tollT = 0; t = 0; lastNow = now;
    syncHud();
  }
  function pauseToggle() { if (phase !== 'toll') return; paused = !paused; syncHud(); }
  // K/M re-pours BOTH from the top (standalone grammar — no map to leave to). The ordered seeds stay;
  // resetting uT un-pours, the shared sweep re-runs.
  function replay() {
    if (phase !== 'toll') return;
    done = false; tollT = 0; t = 0; lastNow = performance.now();
    updateReading(true); syncHud();
  }

  // ---- the per-frame phase machine (standalone: gather → toll; no drain/home, no view swap) ----------
  function runPhase(now) {
    if (phase === 'gather') {                          // the dials swarm in; the field holds invisible
      const p = Math.min((now - phaseStart) / TOLL_GATHER_MS, 1);
      t = swarmEase(p);
      if (p >= 1) beginClock(now);
    } else if (phase === 'toll') {                     // the shared calendar clock: steady sweep, or the 1:1 drip
      const dt = (now - lastNow) / 1000; lastNow = now;
      if (!paused && !scrubbing && tollT < 1) {
        const rate = (holdPtr || holdKey) ? dripRate() : 1000 / TOLL_SWEEP_MS;
        tollT = Math.min(1, tollT + dt * rate);
      }
      t = tollT; updateReading(); updateHands(tollT);
    }
  }

  // ---- the LIVE-SWITCHABLE toggles (the maker picks by eye) -------------------------------------------
  function setSizeMode(mode) {
    if (!['same', 'area', 'radius'].includes(mode) || mode === sizeMode) return sizeMode;
    sizeMode = mode;
    if (!active) return sizeMode;
    if (!bakeDiscs(sizeMode)) return sizeMode;         // re-bake disc endpoints at the new radii (seeds untouched)
    for (const d of discs) {
      ctx.field.setSource(d.lay.source, d.offset);
      // gather still HOLDS on the invisible source; once pouring, targets are the (resized) discs.
      ctx.field.setTarget(phase === 'toll' ? d.lay.disc : d.lay.source, d.offset);
    }
    bakeFrames();
    ctx.struct.startTo(tollFrame, 700, 0.5);           // the dials reflow live to the new radii
    handAngle = -1;                                    // force a hand rewrite once the reflow settles
    updateReading(true);
    return sizeMode;
  }
  function setWordsMode(mode) {
    if (!['shared', 'each'].includes(mode) || mode === wordsMode) return wordsMode;
    wordsMode = mode;
    if (active) { showWord(); applyWordsMode(); }
    return wordsMode;
  }

  // ---- live __viz (attached on enter, detached on exit; the ENTRY setView lives on the shell) ---------
  function vizDiptych(p) {
    if (typeof p === 'number') {                       // numeric → scrub the shared clock (vizToll parity)
      if (phase === 'gather') beginClock(performance.now());
      tollT = Math.min(Math.max(p, 0), 1); t = tollT;
      updateReading(true);
    } else if (p && typeof p === 'object') {
      if (p.size) setSizeMode(p.size);
      if (p.words) setWordsMode(p.words);
    }
    const counting = phase === 'toll';
    return {
      phase, t: tollT, size: sizeMode, words: wordsMode, paused,
      year: yearLabels[yearFrac(counting ? tollT : 0).y],
      provinces: discs.map((d, i) => ({
        label: provinces[i].label, M: d.M,
        count: counting && d.seeds ? countAt(i, tollT) : 0,
      })),
    };
  }

  return {
    meta: { key: 'diptych', label: 'The Toll · diptych' },

    enter() {
      // Owned pools/primitives: built ONCE (lazily), kept across ceremonies, disposed in dispose().
      if (!wordField) wordField = ctx.makePool({ count: WORD_N, glow: false, size: 1.4, maxSize: 6, matte: '#3a4656', renderOrder: -2 });
      if (!roll) roll = ctx.hud.floatingCaption('rollover');
      if (!reading) buildReading();

      if (!bakeDiscs(sizeMode)) return;                // per-province endpoints around the two columns

      active = true;
      phase = 'gather'; paused = false; done = false;
      t = 0; tollT = 0; lastCounts = null; lastYear = -1; handAngle = -1;
      holdKey = holdPtr = scrubbing = false; scrubDisc = null;
      figPxRest = 0;                                   // re-reference the type scale to this mount's framing

      // You LAND in the diptych: frame the camera ONCE to the two-column box (w 1400 outgrows the default
      // framing), HOLD both slices on their born-from-time sources (invisible — density 0) while the dials
      // come up, then pour. Scroll zooms; drag scrubs (pan off so it never fights the scrub).
      ctx.frameTo(ctx.data.box);
      ctx.controls.enabled = true; ctx.controls.enablePan = false; ctx.controls.enableZoom = true;
      for (const d of discs) {
        ctx.field.setSource(d.lay.source, d.offset);
        ctx.field.setTarget(d.lay.source, d.offset);
      }
      ctx.field.setStagger(0.55);
      ctx.field.setT(1);

      phaseStart = performance.now();
      bakeFrames();
      ctx.structField.setSize(PIE_LINE_SIZE);
      ctx.struct.startTo(tollFrame, TOLL_GATHER_MS, 0.6);
      showWord();

      ctx.hud.setCitation('◆ SAPS crime records · DataFirst + saps.gov.za');
      showReading(true);
      updateReading(true); syncHud();

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      ctx.dom.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);

      ctx.viz.diptych = vizDiptych;
    },

    // SINGLE-WRITER upload order (plan §1): phase machine → field.setT → field.setTime → struct.tick.
    // (No frozen-return branch — this view never swaps itself away; there is no idle view.)
    update(now, dt, elapsed) {
      runPhase(now);
      ctx.field.setT(t);
      ctx.field.setTime(elapsed);
      ctx.struct.tick(now, elapsed);
      placeReading();                                  // the reading tracks its anchors through zoom/resize
    },

    // HARD teardown: remove listeners + NEUTRALISE the shared pools (restore every perturbed uniform —
    // seeds, stagger, struct size; spin asserted off though never enabled here) WITHOUT wiping the live
    // pose (the persistent-pool invariant).
    exit() {
      active = false;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      ctx.dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      clearTimeout(holdTimer); holdPtr = holdKey = scrubbing = false; scrubDisc = null;
      if (roll) roll.hide();
      hideWord();
      showReading(false);
      if (tollSeedsSaved) { ctx.field.setSeeds(tollSeedsSaved); tollSeedsSaved = null; }
      ctx.field.setSpinOn(false);
      ctx.field.setStagger(0.55);
      ctx.structField.setSize(STRUCT_DOT_SIZE);
      ctx.structField.setStagger(0.55);
      ctx.controls.enabled = true; ctx.controls.enablePan = true;
      delete ctx.viz.diptych;
      tollFrame = null; handAngle = -1; lastCounts = null; lastYear = -1; done = false; phase = '';
      for (const d of discs) { d.lay = null; d.hand = null; }   // seeds kept — calendar-only, cheap to reuse
    },

    dispose() {
      if (wordField) { ctx.fieldGroup.remove(wordField.points); wordField.points.geometry.dispose(); wordField.material.dispose(); wordField = null; }
      if (roll && roll.el) { roll.el.remove(); roll = null; }
      if (reading) { for (const rd of reading) { rd.year.el.remove(); rd.total.el.remove(); rd.name.el.remove(); } reading = null; }
    },
  };
}
