/*
 * THE LOOM BRIDGES — the maker's two instruments meet (sound module).
 *
 * Two independent bridges between this field and the maker's Loom instrument (the iPad app with
 * mic pitch-detection + scale-constrained voices):
 *
 *   createChorale(deps)    — S — six districts as six scale-constrained voices; the year scrub
 *                            (and the monthly pulse) becomes a slow chord progression.
 *   createVoiceScrub(deps) — G — the mic listens (LOCALLY: nothing recorded, nothing sent); your
 *                            hum's pitch scrubs the years.
 *
 * Both are pure OBSERVERS of app state. The chorale only READS (yi/mi/crimeType/pulseMode) through
 * its deps getter; the voice scrub's only write is the `scrub` dep, which wcExplore wires to the
 * existing setYearPair path. NO field-buffer writes, NO engine knowledge — this module never sees a
 * point, only the baked station numbers and a handful of getters. WebAudio is built ONLY on the
 * user's toggle gesture (the autoplay policy requires it anyway), so importing this module is
 * side-effect free — node can import it and check the mapping to the digit.
 *
 * HONESTY: the chorale's mapping is DECLARED, not implied — pitch ∝ per-100k (per-capita is
 * load-bearing here exactly as it is visually), normalized ONCE across the full window (never
 * per-frame — a chord's meaning must not drift), then snapped to a fixed scale. The snap is stated
 * in the hint the moment S activates. PRIVACY: the mic stream feeds an AnalyserNode and NOTHING
 * else — no MediaRecorder, no network, tracks stopped the moment G toggles off.
 */

// ---- the scale ---------------------------------------------------------------
// Minor pentatonic, two octaves up from C3 — 11 fixed steps. Pentatonic because ANY six of its
// degrees sound consonant together (six districts, one chord, no accidental dissonance carrying
// false alarm); minor because this is, after all, a crime field. Exported so the node-side
// verification can check frequencies to the digit.
const C3 = 130.8127826502993; // MIDI 48 at A4 = 440
const PENT = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]; // semitones from C3
export const SCALE = PENT.map((s) => C3 * Math.pow(2, s / 12));

// ---- S · THE DISTRICT CHORALE ------------------------------------------------
// deps: {
//   districts: [{ key, name, stations }]  — province stations grouped by district (crimes/monthly/pop/x)
//   years: [2008..],  monthCount: 60,
//   get: () => ({ yi, mi, pulseMode, crimeType, blocked })  — blocked = pie/tri (the chorale falls silent)
//   hint: (txt|null) => void  — the HUD hint override (the mapping must be STATED while audible)
// }
export function createChorale(deps) {
  const { districts, years, monthCount, get, hint } = deps;

  // Stereo pan by each district's map x — the geography you see is the stage you hear. Mean station
  // x per district, normalized across the six to ±0.8 (full ±1 hard-pans, which reads as a fault).
  const meanX = districts.map((d) => d.stations.reduce((a, s) => a + s.x, 0) / d.stations.length);
  const xLo = Math.min(...meanX), xHi = Math.max(...meanX);
  const pans = meanX.map((x) => (xHi > xLo ? ((x - xLo) / (xHi - xLo)) * 1.6 - 0.8 : 0));

  // Per-district per-100k tables, cached per (crime, clock). Normalized ONCE across the WHOLE table
  // (all six districts × all steps) so intervals mean the same thing between districts and across
  // time — one shared lo/hi, never recomputed per frame.
  const cache = new Map(); // `${crime}|${kind}` → { rows, lo, hi }
  function table(crime, kind) {
    const key = crime + '|' + kind;
    if (cache.has(key)) return cache.get(key);
    const steps = kind === 'month' ? monthCount : years.length;
    const rows = districts.map((d) => {
      const pop = d.stations.reduce((a, s) => a + (s.pop || 0), 0);
      const row = new Float64Array(steps);
      for (let i = 0; i < steps; i++) {
        let n = 0;
        for (const s of d.stations) {
          n += kind === 'month'
            ? ((s.monthly && s.monthly[crime] && s.monthly[crime][i]) || 0)
            : ((s.crimes[crime] && s.crimes[crime][years[i]]) || 0);
        }
        row[i] = pop ? (n / pop) * 100000 : 0;
      }
      return row;
    });
    let lo = Infinity, hi = -Infinity;
    for (const r of rows) for (const v of r) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const t = { rows, lo, hi };
    cache.set(key, t);
    return t;
  }
  const degreeOf = (v, lo, hi) => Math.round((hi > lo ? (v - lo) / (hi - lo) : 0.5) * (SCALE.length - 1));

  // The CURRENT six-voice chord — a pure function of app state, computable with no AudioContext at
  // all. This is the single source the voices glide to AND what __viz.chorale() reports, so the
  // headless check verifies exactly what would be heard.
  function voicing() {
    const st = get();
    const kind = st.pulseMode ? 'month' : 'year';
    const i = st.pulseMode ? st.mi : st.yi;
    const { rows, lo, hi } = table(st.crimeType, kind);
    return districts.map((d, di) => {
      const rate = rows[di][i];
      const degree = degreeOf(rate, lo, hi);
      return { key: d.key, name: d.name, rate, degree, freq: SCALE[degree], pan: pans[di] };
    });
  }

  // ---- audio (exists only after the first S gesture) ----
  let ctx = null, master = null, voices = null, on = false, lastKey = '', suspendTimer = 0;
  const CEIL = Math.pow(10, -18 / 20);     // −18 dBFS master ceiling — present, never loud
  const LEVEL = 1 / districts.length;      // six voices sum to exactly the ceiling
  const ATTACK = 0.08, RELEASE = 0.4;      // chords breathe rather than beep
  const GLIDE = 0.083;                     // setTargetAtTime constant ≈ a 250ms glide on year change

  function buildAudio() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = CEIL;
    master.connect(ctx.destination);
    // One voice per district: soft triangle → gentle lowpass (tames the triangle's upper partials
    // so six of them stay a wash, not a buzz) → its own envelope → its district's stereo seat.
    voices = districts.map((d, di) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.5;
      const env = ctx.createGain();
      env.gain.value = 0;
      osc.connect(lp); lp.connect(env);
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = pans[di];
        env.connect(pan); pan.connect(master);
      } else env.connect(master);
      osc.start();
      return { osc, env };
    });
  }
  const ramp = (param, to, secs, now) => {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(to, now + secs);
  };

  // Called every tick (cheap: one getter + one string compare when on). Re-voices ONLY when the
  // audible state actually changed — year/month step, crime flip, pulse enter/exit, pie block.
  function update() {
    if (!on || !ctx) return;
    const st = get();
    const key = st.crimeType + '|' + (st.pulseMode ? 'm' + st.mi : 'y' + st.yi) + '|' + (st.blocked ? 1 : 0);
    if (key === lastKey) return;
    lastKey = key;
    const now = ctx.currentTime;
    if (st.blocked) { // inside a pie the chorale falls silent (still an observer — no state writes)
      for (const v of voices) ramp(v.env.gain, 0, RELEASE, now);
      return;
    }
    const chord = voicing();
    voices.forEach((v, i) => {
      v.osc.frequency.setTargetAtTime(chord[i].freq, now, GLIDE);
      ramp(v.env.gain, LEVEL, ATTACK, now);
    });
  }

  function toggle() {
    on = !on;
    if (on) {
      if (suspendTimer) { clearTimeout(suspendTimer); suspendTimer = 0; } // beat a pending suspend from a fast re-toggle
      if (!ctx) buildAudio();               // the S press IS the user gesture the autoplay policy wants
      if (ctx.state === 'suspended') ctx.resume();
      lastKey = '';                         // force a fresh voicing
      update();
      hint('six districts sing — pitch ∝ per-100k, scale-snapped (minor pentatonic) · S to stop');
    } else {
      const now = ctx ? ctx.currentTime : 0;
      if (voices) for (const v of voices) ramp(v.env.gain, 0, RELEASE, now);
      // suspend AFTER the release tail so the fade is heard, keeping the context for the next S
      suspendTimer = setTimeout(() => { suspendTimer = 0; if (ctx && !on) ctx.suspend(); }, RELEASE * 1000 + 120);
      hint(null);
    }
  }

  // __viz.chorale() — the whole audible truth, headless: current six freqs + the mapping table.
  function debug() {
    const st = get();
    const t = table(st.crimeType, st.pulseMode ? 'month' : 'year');
    return {
      on,
      scale: SCALE.slice(),
      voicing: voicing(),
      table: { lo: t.lo, hi: t.hi, rows: districts.map((d, i) => ({ key: d.key, rates: Array.from(t.rows[i]) })) },
    };
  }

  return { toggle, update, voicing, debug, isOn: () => on };
}

// ---- pitch detection ----------------------------------------------------------
// Plain autocorrelation over a 2048-sample window — the same technique as the maker's iPad
// instrument (Loom): correlate the window against itself across the 50–500 Hz lag band, take the
// best normalized peak, refine it parabolically. Two gates keep noise from ever voting: an RMS
// floor (breath/room tone) and a peak-quality floor (unpitched sound has no clear peak).
// Exported so node can verify it on a synthetic tone.
export function detectPitchACF(buf, sampleRate) {
  const N = buf.length;
  let e0 = 0;
  for (let i = 0; i < N; i++) e0 += buf[i] * buf[i];
  if (Math.sqrt(e0 / N) < 0.012) return null;                  // silence gate
  const minLag = Math.max(2, Math.floor(sampleRate / 500));    // 500 Hz ceiling
  const maxLag = Math.min(Math.floor(sampleRate / 50), N - 2); // 50 Hz floor
  const r = new Float32Array(maxLag + 2);
  let bestLag = -1, best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0, M = N - lag; i < M; i++) s += buf[i] * buf[i + lag];
    r[lag] = s / e0;
    if (r[lag] > best) { best = r[lag]; bestLag = lag; }
  }
  if (bestLag < 0 || best < 0.5) return null;                  // confidence gate
  const a = r[bestLag - 1], b = r[bestLag], c = r[bestLag + 1];
  const den = a - 2 * b + c;
  const shift = den ? Math.max(-1, Math.min(1, (0.5 * (a - c)) / den)) : 0;
  return { freq: sampleRate / (bestLag + shift), conf: best };
}

// ---- G · THE VOICE SCRUB -------------------------------------------------------
// deps: {
//   yearCount: () => 18,
//   blocked: () => bool          — pie/tri/pulse/drill: the voice must not write a year there
//   isPlaying: () => bool, setPlaying: (b) => void,
//   scrub: (i) => void           — wcExplore wires this to { playing = false; setYearPair(i) }
//   hint: (txt|null) => void     — MUST state local-only privacy the moment G activates
// }
export function createVoiceScrub(deps) {
  const { yearCount, blocked, isPlaying, setPlaying, scrub, hint } = deps;

  const POLL_MS = 50;       // ~43ms of audio per ACF window; 20Hz polling is plenty for a hum
  const HOLD_MS = 150;      // a mapped year must HOLD this long before it writes (mic-noise filter)
  const RELEASE_MS = 600;   // this much silence hands control back
  const CAL_MS = 2000;      // the first 2s of VOICED input measures the singer's own range

  // Log-frequency range the years map onto. Starts at C3–C5 (a generous 2 octaves) so the scrub
  // works from the first hum; auto-calibration then replaces it with the singer's own measured
  // lo/hi. __viz.sing() tests against whatever range is current (the default, headless).
  const DEF_LO = Math.log(SCALE[0]), DEF_HI = Math.log(SCALE[SCALE.length - 1]);
  let lo = DEF_LO, hi = DEF_HI;
  let calibrated = false, calFrames = 0, calLo = Infinity, calHi = -Infinity;

  let on = false, ctx = null, stream = null, srcNode = null, analyser = null, timer = 0, buf = null;
  let candYear = -1, candSince = 0, applied = -1, tookControl = false, wasPlaying = false, lastVoiced = 0;

  const HINT_PRIVACY = 'mic is LOCAL-ONLY — nothing recorded, nothing sent';
  const HINT_CAL = HINT_PRIVACY + ' · hum low → high to set your range…';
  const HINT_ON = HINT_PRIVACY + ' · hum to scrub the years · G to stop';

  const yearOf = (freq) => {
    const n = Math.max(0, Math.min(1, (Math.log(freq) - lo) / (hi - lo)));
    return Math.round(n * (yearCount() - 1));
  };

  // A confident pitch arrived (mic or injected). Calibrate → map → hold-gate → scrub.
  function ingest(freq, now, fromMic) {
    lastVoiced = now;
    if (fromMic && !calibrated) {
      calLo = Math.min(calLo, freq); calHi = Math.max(calHi, freq);
      if (++calFrames * POLL_MS >= CAL_MS) {
        calibrated = true;
        let l = calLo, h = calHi;
        // a monotone hum measures a degenerate range — widen to a full octave around its centre
        if (h / l < Math.pow(2, 3 / 12)) { const c = Math.sqrt(l * h); l = c / Math.SQRT2; h = c * Math.SQRT2; }
        lo = Math.log(l); hi = Math.log(h);
        hint(HINT_ON);
      }
    }
    if (blocked()) { candYear = -1; applied = -1; tookControl = false; return; } // a pie/pulse owns the field — drop control silently
    const y = yearOf(freq);
    if (y !== candYear) { candYear = y; candSince = now; }
    if (now - candSince >= HOLD_MS && y !== applied) {
      if (!tookControl) { tookControl = true; wasPlaying = isPlaying(); } // remember, to hand back on silence
      applied = y;
      scrub(y);
    }
  }
  // Silence releases control back to normal: the loop resumes ONLY if the voice was what paused it.
  function silent(now) {
    if (candYear >= 0 && now - lastVoiced > RELEASE_MS) {
      candYear = -1; applied = -1;
      if (tookControl) { tookControl = false; if (wasPlaying) setPlaying(true); }
    }
  }

  function poll() {
    analyser.getFloatTimeDomainData(buf);
    const p = detectPitchACF(buf, ctx.sampleRate);
    const now = performance.now();
    if (p && p.freq >= 50 && p.freq <= 500) ingest(p.freq, now, true);
    else silent(now);
  }

  async function toggle() {
    if (on) { stop(); return; }
    on = true;
    hint(HINT_CAL); // the privacy statement appears the MOMENT G activates — before permission even resolves
    try {
      // getUserMedia happens ONLY here, on the G gesture — never at load, never speculatively.
      // Raw signal (no processing) — pitch detection wants the actual hum, not a cleaned-up one.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (!on) { for (const t of stream.getTracks()) t.stop(); stream = null; return; } // G'd off while the prompt was up
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      srcNode = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      buf = new Float32Array(analyser.fftSize);
      srcNode.connect(analyser); // a DEAD END — the mic reaches an analyser and nothing else (no output, no recorder)
      timer = setInterval(poll, POLL_MS);
    } catch {
      stop(); // permission denied / no mic — stand down quietly
    }
  }

  function stop() {
    on = false;
    if (timer) { clearInterval(timer); timer = 0; }
    if (srcNode) { srcNode.disconnect(); srcNode = null; }
    if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; } // the browser's mic light goes OFF here
    if (ctx) ctx.suspend();
    analyser = null; buf = null;
    if (tookControl && wasPlaying) setPlaying(true);
    tookControl = false; candYear = -1; applied = -1; lastVoiced = 0;
    calibrated = false; calFrames = 0; calLo = Infinity; calHi = -Infinity; // next singer recalibrates
    lo = DEF_LO; hi = DEF_HI;
    hint(null);
  }

  // __viz.sing(freqHz) — inject a fake pitch. Bypasses the mic AND the hold gate (both are noise
  // filters, not mapping) so the freq → year → scrub path is testable headless, mic never opened.
  function sing(freqHz) {
    if (blocked()) return { blocked: true };
    const y = yearOf(freqHz);
    if (!tookControl) { tookControl = true; wasPlaying = isPlaying(); }
    candYear = y; applied = y; lastVoiced = performance.now();
    scrub(y);
    return { freq: freqHz, year: y, range: [Math.exp(lo), Math.exp(hi)], calibrated };
  }

  return { toggle, stop, sing, isOn: () => on, state: () => ({ on, calibrated, range: [Math.exp(lo), Math.exp(hi)] }) };
}
