// THE TOLL — the 18-year Western Cape murder accumulation, as a VIEW on the shared shell.
// See docs/plans/standalone-shell.md §1,§4,§5. Ported verbatim from wcExplore.js's inline ceremony (its
// toll block ~L557–891 + the tick branch L1609–1644 + __viz L1287–1309), remapped onto ctx.
//
// The ceremony: K gathers the dimmed murder map onto a thin grey YEAR-DIAL, then every recorded murder pours
// OUT of the ring into a growing central disc — one stratum ring per year, growth-rings of loss that never
// reset. The dial IS the scrubber (drag to scrub); press-and-hold the disc (or 1) drops the pour to exactly
// one-per-second; settled rings turn as a slow counter-rotating orrery. K/M/Esc/tap-outside → drain → home.
//
// INVARIANTS this view guards (the critique's catches):
//  • SINGLE-WRITER per frame: phase machine → field.setT → field.setTime → ctx.struct.tick. Sole pool writer.
//  • PERSISTENT pools + NEUTRALISE on exit: exit() restores every shared-pool uniform the ceremony perturbed
//    (seeds, spinOn, stagger, structField size) WITHOUT wiping the live pose (the bake seam needs it).
//  • OWNS what it used to borrow: its own _downX/_downY (tap-exit) + _hv scratch.
//  • Its 3 pointer + 2 key listeners add on enter(), remove on exit() (they leaked in the explorer).
//  • wordField built ONCE via ctx.makePool (kept across ceremonies, disposed only in dispose()).
//  • Keys guard on !ctx.hud.about.isOpen (About gets first dibs on Esc).
//  • The choreographed leave is view-owned: K/M/Esc → phase='drain'; update runs drain→home; at home-complete
//    it calls ctx.setView(idle,{paused:true}) — the FROZEN return — which is what triggers exit().
import { tollLayouts, tollFrameLayout, tollHandLayout, textLayout } from '../layouts/capeTown.js';

export function createTollView(ctx) {
  const { years, yearLabels } = ctx.data;
  const _hv = new ctx.THREE.Vector3();                 // view-owned unproject scratch (was borrowed L1365)
  // STANDALONE page (no idle map): you LAND in the toll — it auto-pours, stands, and there is no "return to
  // the map". The reading figures flank the word (the honesty channel), the chrome hides by default, and K
  // REPLAYS instead of exiting. The explorer (later re-integration) sets idleViewKey, taking the map path.
  const standalone = ctx.data.idleViewKey == null;

  // ---- constants (parity: wcExplore L574–592) -------------------------------
  const TOLL_SWEEP_MS = 75000, TOLL_GATHER_MS = 2400, TOLL_DRAIN_MS = 1400, TOLL_HOME_MS = 2000;
  const TOLL_FLIGHT_S = 1.2, TOLL_HOLD_MS = 350;
  const TOLL_FRAME_DOTS = 200000, TOLL_THIN = 0.22;    // (= the explorer's pieFrameDots / pieThin at the toll)
  const PIE_LINE_SIZE = 1.3, STRUCT_DOT_SIZE = 1.6;    // struct dot size during the ceremony / the default to restore
  const WORD_N = 22000;
  let TOLL_SPIN_RATE = 0.028;                          // settled-ring spin (rad/s) — live-tunable via __viz.tollSpin
  const tollW = () => Math.min(0.95, TOLL_FLIGHT_S / (TOLL_SWEEP_MS / 1000));
  const swarmEase = (x) => x;                          // constant speed (parity: wcExplore L163)
  const drillEase = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // drain ease (L142)

  let tollWord = 'MURDER';
  const tollWordOpts = { fontFrac: 0.14, jitter: 0.8, weight: 800, yFrac: 0.41, spanFrac: 0.46 };

  // ---- state (view-owned; was the explorer's toll* globals) -----------------
  let active = false, phase = '';                      // '' | 'gather' | 'toll' | 'drain' | 'home'
  let t = 0, tollT = 0;                                // t = field morph; tollT = the dial's uT
  let paused = false, holdKey = false, holdPtr = false, scrubbing = false;
  let tollData = null, tollFrame = null, tollHand = null;
  let tollSeeds = null, tollSeedsSaved = null;
  let tollCount = -1, tollYearShown = -1, done = false;
  let phaseStart = 0, lastNow = 0, drainFrom = 0, handAngle = -1, spinStart = 0, holdTimer = 0;
  let wordField = null, roll = null;                   // owned pools/primitives, built lazily, kept across K
  let _downX = 0, _downY = 0;                          // OWN tap-exit down-point (plan §1)

  // In the EXPLORER the on-screen HUD counter is the toll's honesty channel, so it pins the chrome awake.
  // On the STANDALONE page the flanking FIGURES carry the count (always visible), so the chrome is free to
  // hide by default — don't pin.
  if (!standalone) ctx.hud.pinAwake(() => active);

  // ---- ceremony geometry, in the province map frame (parity: tollGeom L583–587) --------------------
  function tollGeom() {
    const box = ctx.data.box;
    const R = Math.min(box.w, box.h) * 0.32;
    return { cx: 0, cy: -box.h * 0.06, R, dialR: R * 1.16 };
  }

  // ---- the memorial WORD behind the disc (grey structure, no glow, renderOrder -2) -----------------
  let wordBounds = null;                               // the rendered word's world box — the figures flank it
  function showWord() {
    if (!wordField) return;
    if (!tollWord) { wordField.points.visible = false; wordBounds = null; return; }
    const box = ctx.data.box, { cy } = tollGeom(), o = tollWordOpts;
    const lay = textLayout(tollWord, WORD_N, box, {
      fontFrac: o.fontFrac, jitter: o.jitter, weight: o.weight, spanFrac: o.spanFrac, cx: 0, cy: cy + o.yFrac * box.h,
    });
    wordField.setSource(lay); wordField.setTarget(lay); wordField.setT(1);
    wordField.points.visible = true;
    wordBounds = lay.bounds;
  }
  function hideWord() { if (wordField) wordField.points.visible = false; wordBounds = null; }

  // Pin the flanking figures to the WORD's actual screen position (projected every frame, so they hold
  // their place — vertically centred on the word, a fixed clearance beyond its widest ink — at any window
  // aspect, zoom, or resize; CSS % broke the moment the browser wasn't the dev window's shape).
  function placeFigures() {
    if (!standalone || !wordBounds || !ctx.hud.figures) return;
    const rect = ctx.dom.getBoundingClientRect();
    const half = wordBounds.w / 2 + wordBounds.h * 0.85;   // clearance ∝ the word's own height
    _hv.set(wordBounds.cx, wordBounds.cy, 0).project(ctx.camera);
    const px = rect.left + (_hv.x * 0.5 + 0.5) * rect.width;
    const py = rect.top + (-_hv.y * 0.5 + 0.5) * rect.height;
    _hv.set(wordBounds.cx + half, wordBounds.cy, 0).project(ctx.camera);
    const gap = Math.abs(rect.left + (_hv.x * 0.5 + 0.5) * rect.width - px);
    // The place-name sits just above the word, its left edge on the first letter's left edge (the M).
    _hv.set(wordBounds.cx - wordBounds.w / 2, wordBounds.cy + wordBounds.h * 0.95, 0).project(ctx.camera);
    const tx = rect.left + (_hv.x * 0.5 + 0.5) * rect.width;
    const ty = rect.top + (-_hv.y * 0.5 + 0.5) * rect.height;
    ctx.hud.figures.place(px, py, gap, tx, ty);
  }

  // ---- bake the field's LIVE on-screen pose into a plain layout (parity: bakeFieldPose L612–628) ----
  function bakeFieldPose() {
    const COUNT = ctx.data.COUNT, g = ctx.field.points.geometry;
    const src = g.getAttribute('aSource').array, tgt = g.getAttribute('aTarget').array;
    const sd = g.getAttribute('aSourceDensity').array, td = g.getAttribute('aTargetDensity').array;
    const seeds = g.getAttribute('aSeed').array;
    const uT = ctx.field.material.uniforms.uT.value;
    const w = Math.max(ctx.field.material.uniforms.uStagger.value, 1e-4);
    const positions = new Float32Array(COUNT * 2), density = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const s01 = Math.fround(seeds[i] * 0.1591549431) % 1;
      const lt = Math.min(1, Math.max(0, (uT - s01 * (1 - w)) / w));
      positions[2 * i] = src[2 * i] + (tgt[2 * i] - src[2 * i]) * lt;
      positions[2 * i + 1] = src[2 * i + 1] + (tgt[2 * i + 1] - src[2 * i + 1]) * lt;
      density[i] = sd[i] + (td[i] - sd[i]) * lt;
    }
    return { positions, density };
  }

  // ---- the counter + disc are ONE formula (binary search of the shader's math; parity: L635–661) -----
  function tollCountAt(uT) {
    const w = tollW();
    let lo = 0, hi = tollData.M;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const s01 = Math.fround(tollSeeds[mid] * 0.1591549431) % 1;
      if ((uT - s01 * (1 - w)) / w >= 1) lo = mid + 1; else hi = mid;
    }
    return lo;
  }
  function tollYearFrac(uT) {
    const { cum, perYear, M } = tollData;
    const km = Math.min(uT, 1) * M;
    let y = 0; while (y < years.length - 1 && km >= cum[y + 1]) y++;
    const f = perYear[y] ? Math.min(1, (km - cum[y]) / perYear[y]) : 0;
    return { y, f, frac: (y + f) / years.length };
  }
  function tollFracToT(frac) {
    const { cum, perYear, M } = tollData;
    const yf = Math.min(Math.max(frac, 0), 1) * years.length;
    const y = Math.min(years.length - 1, Math.floor(yf));
    return (cum[y] + (yf - y) * perYear[y]) / M;
  }

  // ---- the ordered SPIN bake (nested counter-rotating orrery; parity: bakeTollSpin L715–727) --------
  function bakeSpin() {
    if (!tollData) return;
    const M = tollData.M, COUNT = ctx.data.COUNT;
    const rates = new Float32Array(COUNT), onsets = new Float32Array(COUNT);
    const sweepS = TOLL_SWEEP_MS / 1000, w = tollW();
    let yy = 0;
    for (let k = 0; k < M; k++) {
      while (yy < years.length - 1 && k >= tollData.cum[yy + 1]) yy++;
      onsets[k] = ((k / M) * (1 - w) + w) * sweepS;
      rates[k] = TOLL_SPIN_RATE * ((yy & 1) ? -1 : 1);
    }
    ctx.field.setSpin(rates, onsets);
    ctx.field.setSpinCentre(tollData.cx, tollData.cy);
  }

  // ---- the HUD line — year under the hand · running count · total (parity: updateTollHud L765–785) --
  function updateHud(force = false) {
    if (!tollData) return;
    const M = tollData.M;
    const counting = phase === 'toll' || phase === 'drain';
    const n = counting ? tollCountAt(tollT) : 0;
    const { y } = tollYearFrac(counting ? tollT : 0);
    if (!force && n === tollCount && y === tollYearShown) return;
    tollCount = n; tollYearShown = y;

    if (standalone) {                                    // the two figures flank MURDER — left resets per year, right cumulates
      const inYear = Math.max(0, n - tollData.cum[y]);
      const complete = n >= M;
      ctx.hud.figures.set(
        (complete ? tollData.perYear[y] : inYear).toLocaleString(),  // left: this year's toll (resets per year)
        n.toLocaleString(),                                          // right: the running total
      );
      if (complete !== done) { done = complete; syncHud(); }
      return;
    }

    const total = M.toLocaleString();
    let count;
    if (phase === 'gather') {
      count = `${total} recorded murders · Apr 2008 – Mar 2026`;
    } else if (n >= M) {
      count = `${total} recorded murders · Western Cape · Apr 2008 – Mar 2026`;
      if (!done) { done = true; syncHud(); }
    } else {
      const inYear = Math.max(0, n - tollData.cum[y]);   // landings lag the hand — never more than the year holds
      count = `${inYear.toLocaleString()} this year · ${n.toLocaleString()} recorded murders so far`;
      if (done) { done = false; syncHud(); }
    }
    ctx.hud.setCaption({ time: yearLabels[y], count });
  }

  // Hint + chip dimming, on state changes (parity: refreshHint toll branch L203–209 + refreshChips).
  function hintText() {
    if (phase === 'gather') return 'the years are gathering…';
    if (phase === 'drain' || phase === 'home') return standalone ? 'replaying the toll…' : 'the murders return to the map…';
    if (done) return standalone ? 'the toll stands · drag the dial to scrub · K replays' : 'the toll stands · scrub the dial back · K returns them to the map';
    if (holdPtr || holdKey) return 'one recorded murder per second — release to resume the sweep';
    if (paused) return standalone ? 'paused — space resumes · drag the dial to scrub' : 'paused — space resumes · drag the dial · K ends the toll';
    return standalone ? 'drag the dial to scrub · hold the disc for one per second · space pauses' : 'drag the dial to scrub · hold the disc (or 1) for one per second · space pauses · K ends the toll';
  }
  function syncHud() { ctx.hud.setHint(hintText()); ctx.hud.chips.refresh(); }

  // ---- the hand rides the dial: rewrite ONLY its slice (parity: updateTollHand L791–806) ------------
  function updateHand(uT) {
    if (!tollHand || ctx.struct.progress < 1 || ctx.struct.current !== tollFrame) return;
    const angle = tollYearFrac(uT).frac * Math.PI * 2;
    if (Math.abs(angle - handAngle) < 6e-4) return;
    handAngle = angle;
    const { cx, cy, R, dialR } = tollGeom();
    const h = tollHandLayout(tollHand.count, { cx, cy, R, dialR, angle, thin: TOLL_THIN });
    tollFrame.positions.set(h.positions, tollHand.start * 2);
    tollFrame.density.set(h.density, tollHand.start);
    const slice = {
      positions: tollFrame.positions.subarray(tollHand.start * 2, (tollHand.start + tollHand.count) * 2),
      density: tollFrame.density.subarray(tollHand.start, tollHand.start + tollHand.count),
    };
    ctx.structField.setSource(slice, tollHand.start);
    ctx.structField.setTarget(slice, tollHand.start);
  }

  // ---- ring rollover — name the year-stratum under the pointer (parity: updateTollRollover L822–839) --
  function updateRollover(clientX, clientY) {
    if (phase === 'gather' || phase === 'home' || scrubbing || !tollData) { if (roll) roll.hide(); return; }
    const { cx, cy } = tollGeom();
    const p = worldAt(clientX, clientY);
    const r = Math.hypot(p.x - cx, p.y - cy);
    if (r < tollData.r0 || r > tollData.R) { if (roll) roll.hide(); return; }
    let y = 0;
    while (y < tollData.seamRadii.length && r >= tollData.seamRadii[y]) y++;
    if (!roll) roll = ctx.hud.floatingCaption('rollover');
    roll.show(`${yearLabels[y]} · ${tollData.perYear[y].toLocaleString()} recorded`, clientX, clientY);
  }

  // ---- the dial's pointer grammar (parity: L842–891) ---------------------------------------------
  function worldAt(clientX, clientY) {
    const rect = ctx.dom.getBoundingClientRect();
    _hv.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1, 0.5).unproject(ctx.camera);
    const dir = _hv.sub(ctx.camera.position).normalize();
    const k = -ctx.camera.position.z / dir.z;
    return { x: ctx.camera.position.x + dir.x * k, y: ctx.camera.position.y + dir.y * k };
  }
  function scrubTo(clientX, clientY) {
    const { cx, cy } = tollGeom();
    const p = worldAt(clientX, clientY);
    const ang = Math.atan2(p.x - cx, p.y - cy);        // 0 at twelve, clockwise positive
    let frac = ang / (Math.PI * 2); if (frac < 0) frac += 1;
    const cur = tollYearFrac(tollT).frac;              // unwrap: the dial can't teleport across twelve
    if (frac - cur > 0.5) frac -= 1;
    if (cur - frac > 0.5) frac += 1;
    tollT = tollFracToT(Math.min(1, Math.max(0, frac)));
    t = tollT;
    updateHud();
  }

  function onPointerDown(e) {
    _downX = e.clientX; _downY = e.clientY;            // OWN down-point (was the drill's L1494)
    if (phase !== 'toll') return;
    const { cx, cy, R, dialR } = tollGeom();
    const p = worldAt(e.clientX, e.clientY);
    const r = Math.hypot(p.x - cx, p.y - cy);
    if (r <= R * 1.02) {                               // the disc: press-and-hold → one per second
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { holdPtr = true; syncHud(); }, TOLL_HOLD_MS);
    } else if (r <= dialR * 1.3) {                     // the ring: the dial IS the scrubber
      scrubbing = true; scrubTo(e.clientX, e.clientY);
    }
  }
  function onPointerMove(e) {
    if (scrubbing) scrubTo(e.clientX, e.clientY);
    updateRollover(e.clientX, e.clientY);
  }
  function onPointerUp(e) {
    clearTimeout(holdTimer);
    const wasHolding = holdPtr, wasScrubbing = scrubbing;
    if (holdPtr) { holdPtr = false; syncHud(); }
    scrubbing = false;
    if (wasHolding || wasScrubbing) return;
    if (standalone) return;                                              // no map to tap back to
    if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 6) return;   // a drag, not a tap
    const { cx, cy, dialR } = tollGeom();
    const p = worldAt(e.clientX, e.clientY);
    if (Math.hypot(p.x - cx, p.y - cy) > dialR * 1.3) leave();            // tap outside the dial → end
  }
  function onKeyDown(e) {
    if (ctx.hud.about.isOpen) return;                 // About gets first dibs (plan §1)
    if (e.code === 'Space') { e.preventDefault(); pauseToggle(); }
    else if (e.code === 'Digit1') { e.preventDefault(); if (!holdKey) { holdKey = true; syncHud(); } }
    else if (e.code === 'KeyK' || e.code === 'KeyM' || e.code === 'Escape') {
      if (standalone) { if (e.code !== 'Escape') { e.preventDefault(); replay(); } } // K/M replay; Escape is About's
      else { e.preventDefault(); leave(); }
    }
  }
  function onKeyUp(e) { if (e.code === 'Digit1' && holdKey) { holdKey = false; syncHud(); } }

  // ---- phase transitions (parity: beginTollClock / exitToll / beginTollHome / tollPauseToggle) -------
  function beginClock(now) {
    tollSeedsSaved = Float32Array.from(ctx.field.points.geometry.getAttribute('aSeed').array);
    const seeds = Float32Array.from(tollSeedsSaved), M = tollData.M;
    tollSeeds = new Float32Array(M);
    for (let k = 0; k < M; k++) { tollSeeds[k] = (k / M) / 0.1591549431; seeds[k] = tollSeeds[k]; }
    ctx.field.setSeeds(seeds);
    ctx.field.setSource(tollData.source);
    ctx.field.setTarget(tollData.disc);
    ctx.field.setStagger(tollW());
    bakeSpin();
    ctx.field.setSpinTime(0); ctx.field.setSpinOn(true); spinStart = now;
    phase = 'toll'; tollT = 0; lastNow = now; t = 0;
    syncHud();
  }
  function leave() {                                   // K/M/Esc/tap-outside → the choreographed drain→home
    if (phase === 'drain' || phase === 'home') return;
    clearTimeout(holdTimer); holdPtr = false; scrubbing = false;
    if (phase === 'gather') { ctx.field.setSource(bakeFieldPose()); beginHome(); return; }
    if (tollT <= 0) { ctx.field.setSource(tollData.source); beginHome(); return; }
    drainFrom = tollT; phase = 'drain'; phaseStart = performance.now();
    syncHud();
  }
  function beginHome() {
    if (tollSeedsSaved) { ctx.field.setSeeds(tollSeedsSaved); tollSeedsSaved = null; } // invisible at uT≈0 (pose = source)
    ctx.field.setSpinOn(false);                        // stop the orrery BEFORE the map lands (never spin the map)
    hideWord(); if (roll) roll.hide();
    ctx.field.setTarget(ctx.data.layouts[ctx.playback.yi]);  // the truthful map, the year the toll left us on
    ctx.field.setStagger(0.55);
    t = 0; tollT = 0; phase = 'home'; phaseStart = performance.now();
    ctx.structField.setSize(STRUCT_DOT_SIZE);
    ctx.struct.startTo(ctx.data.outline, TOLL_HOME_MS, 0.6);
    ctx.controls.enabled = true;
    syncHud();
  }
  function pauseToggle() { if (phase !== 'toll') return; paused = !paused; syncHud(); }
  // STANDALONE: K re-pours from the top (no map to leave to). The ordered seeds stay; resetting uT un-pours,
  // the sweep re-runs, and the orrery restarts from spinStart.
  function replay() {
    if (phase !== 'toll') return;
    done = false; tollT = 0; t = 0; lastNow = performance.now();
    spinStart = performance.now(); ctx.field.setSpinTime(0);
    updateHud(true); syncHud();
  }

  // ---- the per-frame phase machine (parity: the tick toll branch L1609–1644) ----------------------
  // Returns TRUE when it triggered the frozen return (view already swapped — do not write pools after).
  function runPhase(now) {
    if (phase === 'gather') {                          // map → the dimmed 18-year murder map (random seeds)
      const p = Math.min((now - phaseStart) / TOLL_GATHER_MS, 1);
      t = swarmEase(p);
      if (p >= 1) beginClock(now);
    } else if (phase === 'toll') {                     // the dial clock: sweep rate, or the 1:1 drip on hold
      const dt = (now - lastNow) / 1000; lastNow = now;
      ctx.field.setSpinTime((now - spinStart) / 1000); // real time — the settled disc turns even paused/complete
      if (!paused && !scrubbing && tollT < 1) {
        const rate = (holdPtr || holdKey) ? (1 - tollW()) / tollData.M : 1000 / TOLL_SWEEP_MS;
        tollT = Math.min(1, tollT + dt * rate);
      }
      t = tollT; updateHud(); updateHand(tollT);
    } else if (phase === 'drain') {                    // the pour reverses — fast, eased, ordered seeds on
      const p = Math.min((now - phaseStart) / TOLL_DRAIN_MS, 1);
      ctx.field.setSpinTime((now - spinStart) / 1000);
      tollT = drainFrom * (1 - drillEase(p));
      t = tollT; updateHud(); updateHand(tollT);
      if (p >= 1) beginHome();
    } else if (phase === 'home') {                     // the dots morph gently back to the truthful map
      const p = Math.min((now - phaseStart) / TOLL_HOME_MS, 1);
      t = swarmEase(p);
      if (p >= 1) { phase = ''; ctx.setView(ctx.data.idleViewKey, { paused: true }); return true; } // FROZEN return
    }
    return false;
  }

  // ---- live __viz (the ENTRY viz.view lives on the shell; these attach only while active) -----------
  function vizToll(p) {
    if (typeof p === 'number') {
      if (phase === 'gather') beginClock(performance.now());
      tollT = Math.min(Math.max(p, 0), 1); t = tollT;
      updateHud(true);
    }
    const counting = phase === 'toll' || phase === 'drain';
    return { phase, M: tollData ? tollData.M : 0, count: counting && tollData ? tollCountAt(tollT) : 0,
      tollT, year: tollData ? yearLabels[tollYearFrac(counting ? tollT : 0).y] : '', paused, spinRate: TOLL_SPIN_RATE };
  }
  function vizTollSpin(rate) {
    if (typeof rate === 'number') { TOLL_SPIN_RATE = rate; if (tollData) bakeSpin(); }
    return { spinRate: TOLL_SPIN_RATE, revSeconds: TOLL_SPIN_RATE ? (2 * Math.PI / Math.abs(TOLL_SPIN_RATE)).toFixed(0) : Infinity };
  }
  function vizWord(w, opts) {
    if (typeof w === 'string') tollWord = w;
    if (opts) Object.assign(tollWordOpts, opts);
    if (active) showWord();
    if (wordField && opts && opts.matte) wordField.material.uniforms.uMatte.value.set(opts.matte);
    return { word: tollWord, ...tollWordOpts, matte: '#' + (wordField ? wordField.material.uniforms.uMatte.value.getHexString() : '') };
  }

  return {
    meta: { key: 'toll', label: 'The Toll', chipText: 'K the toll' },

    enter() {
      // wordField: built ONCE (lazily), kept across ceremonies (no 22k-pt GC churn), disposed in dispose().
      if (!wordField) wordField = ctx.makePool({ count: WORD_N, glow: false, size: 1.4, maxSize: 6, matte: '#3a4656', renderOrder: -2 });
      if (!roll) roll = ctx.hud.floatingCaption('rollover');

      const { cx, cy, R, dialR } = tollGeom();
      // Province-only full-pool ceremony: the pool IS the province; tollLayouts returns full COUNT-sized
      // endpoints (raw murder counts). BLOCKER 1: the six-crime-sized pool holds M (guarded here too).
      tollData = tollLayouts(ctx.data.stations, { years, count: ctx.data.COUNT, park: ctx.data.park, cx, cy, R, dialR });
      if (!tollData) { console.error('[toll] pool cannot hold the toll — ceremony unavailable'); return; }

      active = true;
      phase = 'gather'; paused = false; done = false;
      t = 0; tollT = 0; tollCount = -1; tollYearShown = -1; handAngle = -1;
      holdKey = holdPtr = scrubbing = false;
      if (standalone) {
        // You LAND in the toll: no map to gather from, so HOLD on the born-from-time source while the dial
        // comes up, then pour. Scroll still zooms (natural movement); drag scrubs the dial (pan off so it
        // never fights the scrub).
        ctx.controls.enabled = true; ctx.controls.enablePan = false; ctx.controls.enableZoom = true;
        ctx.field.setSource(tollData.source);
        ctx.field.setTarget(tollData.source);
        ctx.field.setStagger(0.55);
        ctx.field.setT(1);
      } else {
        ctx.controls.enabled = false;                  // the dial owns the pointer while tolling
        ctx.field.setSource(bakeFieldPose());          // from exactly what the eye sees (any year, mid-morph)
        ctx.field.setTarget(tollData.source);
        ctx.field.setStagger(0.55);
        ctx.field.setT(0);                             // no stale-t frame before the first update lands
      }
      phaseStart = performance.now();
      tollFrame = tollFrameLayout(ctx.data.structN, { cx, cy, R, dialR, ticks: years.length, seamRadii: tollData.seamRadii, frameDots: TOLL_FRAME_DOTS, thin: TOLL_THIN });
      tollHand = tollFrame.hand;
      ctx.structField.setSize(PIE_LINE_SIZE);
      ctx.struct.startTo(tollFrame, TOLL_GATHER_MS, 0.6);
      showWord();                                       // the memorial word appears behind the ceremony

      if (standalone) {
        ctx.hud.setCitation('◆ SAPS crime records · DataFirst + saps.gov.za');
        ctx.hud.figures.setTitle(ctx.data.label);       // the place-name, seated on the word's first letter
        ctx.hud.figures.show(true);                     // the two flanking figures are the reading here
      } else {
        ctx.hud.setCaption({ region: 'Western Cape', lens: 'murder · the toll', time: yearLabels[0], count: '' });
        ctx.hud.chips.setActions({ toll: () => leave() }); // the toll chip ENDS the toll (about stays HUD-wired)
        ctx.hud.chips.setDimRule(() => false);
      }
      updateHud(true); syncHud();

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      ctx.dom.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);

      ctx.viz.toll = vizToll; ctx.viz.tollSpin = vizTollSpin; ctx.viz.word = vizWord;
    },

    update(now, dt, elapsed) {
      if (runPhase(now)) return;                        // leave triggered → swapped; do not write pools
      ctx.field.setT(t);
      ctx.field.setTime(elapsed);
      ctx.struct.tick(now, elapsed);
      placeFigures();                                   // figures track the word through zoom/resize
    },

    // HARD teardown: remove listeners + NEUTRALISE the shared pools (restore every perturbed uniform) WITHOUT
    // wiping the live pose (the bake seam needs it to survive the swap). On a normal leave beginHome already
    // restored seeds/spin/target/size; this re-affirms + covers an abrupt external swap.
    exit() {
      active = false;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      ctx.dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      clearTimeout(holdTimer); holdPtr = holdKey = scrubbing = false;
      if (roll) roll.hide();
      hideWord();
      if (ctx.hud.figures) ctx.hud.figures.show(false);
      if (tollSeedsSaved) { ctx.field.setSeeds(tollSeedsSaved); tollSeedsSaved = null; }
      ctx.field.setSpinOn(false);
      ctx.field.setStagger(0.55);
      ctx.structField.setSize(STRUCT_DOT_SIZE);
      ctx.structField.setStagger(0.55);
      ctx.controls.enabled = true;
      delete ctx.viz.toll; delete ctx.viz.tollSpin; delete ctx.viz.word;
      tollData = null; tollFrame = null; tollHand = null; tollSeeds = null;
      tollCount = -1; tollYearShown = -1; handAngle = -1; done = false; phase = '';
    },

    dispose() {
      if (wordField) { ctx.fieldGroup.remove(wordField.points); wordField.points.geometry.dispose(); wordField.material.dispose(); wordField = null; }
      if (roll && roll.el) { roll.el.remove(); roll = null; }
    },
  };
}
