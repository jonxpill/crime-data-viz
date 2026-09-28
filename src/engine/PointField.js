import * as THREE from 'three';

/**
 * PointField — the pure engine. THE DESIGN OBJECT.
 *
 * It knows NOTHING about crime, maps, projections, or years. It holds one field
 * of points, each storing a `source` and a `target` (x, y) plus a source/target
 * `density`, and interpolates the whole field with a single `t` uniform in the
 * vertex shader (the CPU stays idle during a morph). Density → colour + glow
 * happens on the GPU.
 *
 * Two ROLES, one substance (the binding visual language):
 *   • glow: true  → DATA. Coloured by local density, glowing. Lives on the bloom
 *     layer so the warm core-glow emerges from it.
 *   • glow: false → STRUCTURE. Grey, matte, NO glow. Excluded from bloom. It
 *     recedes; it carries geography/scale, never crime. A structure point must
 *     never masquerade as data — so glow is the primary channel, enforced here.
 *
 * A "layout" is just a function upstream that fills { positions, density }.
 * A new view = a new layout. The engine never grows to know what a view means.
 *
 * TONE — an optional per-dot palette index, carried like density (a source + a target value, blended
 * by the same per-dot lt, so a change of tone BLENDS in flight instead of snapping):
 *   • DATA pools read `layout.ramp` → which of up to 4 density ramps paints the dot (a caller maps
 *     crime families onto ramp indices; the engine never learns what a family is).
 *   • STRUCTURE pools read `layout.role` → which of 8 role colours paints the dot; role 0 = the pool's
 *     own matte (uMatte), so an untagged pool looks exactly as it always did.
 *   `ramp`/`role` may be a number (the whole written slice) or a typed array (one per dot, same length as
 *   the layout's density). Absent → 0. Density is still the ONLY brightness channel inside any ramp.
 *
 * MOTION (packet D4 — the Motion door drives these; src/motion.js). Every term below is TRANSITIONAL: it is
 * exactly zero at lt = 0 and lt = 1 and off by default, so no endpoint (no layout, no resting frame) moves.
 *   • PATH (`setPath`) — how a dot travels source → target: `straight` (the lerp, default), `arc` (a quadratic
 *     bezier bowed perpendicular to its own travel, ∝ travel distance × bend, side per dot from its seed so the
 *     swarm fans both ways), `swirl` (angle + radius interpolated about a centre → the field WINDS in/out).
 *   • ORDER (`setOrder`) — a per-dot stagger order in [0,1) that REPLACES the random seed's slot in the stagger
 *     window, without touching aSeed (twinkle + drift phase) — so switching it on/off at an endpoint is
 *     pixel-invisible (setSeeds, the Toll's tool, re-phases every dot's drift + twinkle).
 *   • STREAK (`setStreak`) — a moving dot's sprite stretches into a comet along its SCREEN-space velocity
 *     (the finite difference of its own path between last frame's uT and this one, through the same camera;
 *     a bright head, a fading tail). Zero speed → the round dot, bit-identical. Needs `beginFrame()` once
 *     per rendered frame + `setViewport()`.
 *   • HAZE (`setHaze`) — aerial perspective by VIEW DEPTH relative to the camera's focus distance (`setFocus`):
 *     far dots fade toward the background; dots nearer than a threshold dissolve instead of ballooning. A flat
 *     field seen top-down sits at relative depth 1 everywhere → a no-op at every top-down home.
 * Invisible dots (the fragment would discard all of them) are clipped in the vertex stage — same pixels, no
 * rasterisation cost (parked surplus is most of every pool).
 */
export const MAX_RAMPS = 4;
export const MAX_ROLES = 8;
export const PATH_MODES = { straight: 0, arc: 1, swirl: 2 };

export class PointField {
  /**
   * @param {number} count number of points
   * @param {object} [opts]
   * @param {boolean} [opts.glow] true = data (glowing, density-coloured); false = structure (grey matte)
   * @param {number} [opts.size] base point size in px (before density boost)
   * @param {THREE.Color[]} [opts.ramp] density colour ramp [cool, mid, warm] (data role)
   * @param {string|THREE.Color} [opts.matte] flat colour for the structure role
   */
  constructor(count, opts = {}) {
    this.count = count;
    this.glow = opts.glow ?? true;
    const size = opts.size ?? (this.glow ? 1.9 : 1.5);
    const ramp = opts.ramp ?? [
      new THREE.Color('#7c9ce0'), // sparse / cool / dim — blue ember
      new THREE.Color('#e8b892'), // mid — warm sand (bridges blue→molten so the transition isn't via white)
      new THREE.Color('#ff8a3a'), // dense / hot — MOLTEN amber. Low blue, so a dense additive stack saturates
      //                             to orange, not white: the core stays coloured instead of burning out.
    ];
    const matte = new THREE.Color(opts.matte ?? '#3e4a60'); // grey-blue, recessive

    const geometry = new THREE.BufferGeometry();
    // Two endpoint buffers per point; the GPU tweens between them.
    geometry.setAttribute('aSource', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    geometry.setAttribute('aTarget', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    geometry.setAttribute('aSourceDensity', new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('aTargetDensity', new THREE.BufferAttribute(new Float32Array(count), 1));
    // Per-point phase so twinkle isn't uniform across the field.
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) seed[i] = Math.random() * Math.PI * 2;
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    // Per-point terrain height (0 for flat fields; the terrain field fills it).
    geometry.setAttribute('aZ', new THREE.BufferAttribute(new Float32Array(count), 1));
    // Per-point ORDERED SPIN (0 = still). A signed angular rate + a per-point onset time turn a
    // SETTLED target field into a slow orrery: once a dot has landed, its target rotates about
    // uSpinCentre by rate·(uSpinTime − onset). Off by default; the engine knows nothing of why.
    geometry.setAttribute('aSpinRate', new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('aSpinOnset', new THREE.BufferAttribute(new Float32Array(count), 1));
    // Per-point TONE index (ramp for data, role for structure) at each endpoint — see the class note.
    // All-zero by default = ramp 0 / the pool's matte, i.e. the look every pool had before tones existed.
    geometry.setAttribute('aSourceTone', new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('aTargetTone', new THREE.BufferAttribute(new Float32Array(count), 1));
    this._toneUsed = false; // stays false until a non-zero tone is written → untagged pools never re-upload
    // Per-point stagger ORDER (the Motion door's meaningful stagger) — only read while uOrderOn = 1.
    geometry.setAttribute('aOrder', new THREE.BufferAttribute(new Float32Array(count), 1));
    // Streak bookkeeping: any change to what a given uT MEANS (a pair write, seeds, order, path, stagger)
    // bumps the epoch, and beginFrame() then gives that frame a zero-length streak instead of a false one.
    this._epoch = 0; this._frameEpoch = -1; this._frameT = null; this._staggerWrites = 0;
    // BufferGeometry needs *some* `position`; we drive xy ourselves, keep z=0.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: size },
        uPixelRatio: { value: 1 },
        uMaxSize: { value: 7.0 }, // cap on-screen size (px) — stops dots ballooning into discs when you zoom in
        uGlow: { value: this.glow ? 1 : 0 },
        // DATA per-dot brightness = uDataFloor + uDataGain * density. The GAIN is the density dependence;
        // keeping it modest stops dense cores double-counting density (many dots × each-bright) into a
        // white burn-out — the areal STACKING already carries "denser = brighter". Floor lifts lone embers.
        uDataFloor: { value: 0.30 },
        uDataGain: { value: 0.34 },
        // Idle drift — the at-rest "living swarm" shimmer, on two independent levers:
        //   uDrift      = AMPLITUDE (how far a point strays from home). Keep small so
        //                 dots feel alive without "wandering away".
        //   uDriftSpeed = SPEED (how fast the orbit runs). This is what makes the
        //                 movement FELT; raising it does NOT increase how far a dot
        //                 strays. Data breathes; structure only whispers.
        uDrift: { value: this.glow ? 0.4 : 0.0 },
        uDriftSpeed: { value: 1.0 },
        // Per-dot transition stagger: each point crosses on its own slice of uT, so a
        // big change ripples like a flock instead of sliding as one rigid sheet.
        uStagger: { value: 0.55 },
        // Structure shimmer — each grey/matte dot fades slightly in/out on its own phase so the
        // frame breathes like faint stars. Data has its own twinkle; these are ignored there.
        uShimmer: { value: 0.9 },      // amplitude (0 = still; ~0.3 gentle, ~0.45 present, ~0.9 dramatic)
        uShimmerSpeed: { value: 0.8 }, // how fast the breath cycles (slow = calm)
        // Ordered spin — a real-time clock (uSpinTime, seconds) + the centre to rotate targets
        // about; per-point aSpinRate/aSpinOnset carry the sign + start. uSpinOn gates the whole
        // feature off (0) so no other view pays for it.
        uSpinTime: { value: 0 },
        uSpinCentre: { value: new THREE.Vector2(0, 0) },
        uSpinOn: { value: 0 },
        uZScale: { value: 0 }, // terrain vertical scale (0 = flat map; raised = relief)
        // Flow field — continuous curl advection for RELEASED/play states. 0 in every truthful view;
        // a play mode ramps it up so dots stream between morph waypoints instead of ever resting.
        uFlow: { value: 0 },
        uFlowSpeed: { value: 1 },
        uOpacity: { value: 1 }, // global fade — cross-fades map structure ↔ terrain relief
        // Up to MAX_RAMPS density ramps (cool/mid/warm stop arrays); a dot's tone picks one. All start
        // as the same ramp, so a pool that never tags its dots is untouched.
        uRampCool: { value: Array.from({ length: MAX_RAMPS }, () => new THREE.Color(ramp[0])) },
        uRampMid: { value: Array.from({ length: MAX_RAMPS }, () => new THREE.Color(ramp[1])) },
        uRampWarm: { value: Array.from({ length: MAX_RAMPS }, () => new THREE.Color(ramp[2])) },
        uMatte: { value: matte },
        // Structure role colours (index 0 unused — role 0 IS uMatte). Default = the matte, so a tagged
        // dot in a pool nobody has given role colours still draws the pool's own grey.
        uRoleColors: { value: Array.from({ length: MAX_ROLES }, () => matte.clone()) },
        // ---- MOTION (D4) — all off by default; see the class note ----
        uTPrev: { value: 0 },        // last frame's uT (beginFrame) — the streak's finite difference
        uPath: { value: 0 },         // PATH_MODES: 0 straight · 1 arc · 2 swirl
        uBend: { value: 0.35 },      // arc: control-point offset ∝ travel distance (peak bow = bend/2 × distance)
        uFan: { value: 1 },          // arc: 1 = sides 50/50 per dot (the swarm fans both ways) · 0 = all one side
        uSwirlCentre: { value: new THREE.Vector2(0, 0) },
        uSwirlDir: { value: 0 },     // swirl: 0 = each dot takes its shortest turn · +1 all CCW · −1 all CW (a vortex)
        uSwirlTurns: { value: 0 },   // swirl: extra WHOLE turns in that direction (whole, so endpoints stay exact)
        uOrderOn: { value: 0 },      // 0 = the random seed's stagger slot · 1 = aOrder
        uStreak: { value: 0 },       // comet length in FRAMES of travel at 60 fps (0 = off)
        uStreakRate: { value: 1 },   // (1/60 s) ÷ this frame's dt — keeps a comet's length refresh-rate-free
        uStreakMax: { value: 20 },   // cap on the streak's length (CSS px)
        uStreakTail: { value: 0.12 },   // tail brightness relative to the head
        uStreakConserve: { value: 0.45 }, // 0 = the comet adds light · 1 = its energy spreads (head dims ∝ width/length)
        uViewport: { value: new THREE.Vector2(1, 1) }, // drawing-buffer px (streak px ↔ NDC)
        uHazeOn: { value: 0 },
        uFocus: { value: 1 },        // camera → orbit-target distance: relative depth 1 = the plane you look at
        uHazeFar: { value: 1.2 },    // haze reaches full `strength` at relative depth 1 + far
        uHazeNear: { value: 0.5 },   // dots nearer than this relative depth dissolve (gone at half of it)
        uHazeStrength: { value: 0.6 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // Data glows → additive (light stacks). Structure is matte → normal blend
      // (overlaps don't brighten, so it can't fake a glow).
      blending: this.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  /** Fill the SOURCE endpoint from a layout { positions:Float32Array(n*2), density:Float32Array(n) }.
   *  `offset` (in POINTS) writes a partial layout into a slice of the pool starting there — the rest of
   *  the buffer keeps its previous values. Callers own the slice bookkeeping; offset 0 + full-size
   *  layout is a whole-buffer write (the classic path). */
  setSource(layout, offset = 0) { this._fill('aSource', 'aSourceDensity', 'aSourceTone', layout, offset); }

  /** Fill the TARGET endpoint from a layout (same offset semantics as setSource). */
  setTarget(layout, offset = 0) { this._fill('aTarget', 'aTargetDensity', 'aTargetTone', layout, offset); }

  _fill(posAttr, densAttr, toneAttr, layout, offset = 0) {
    this._epoch++;
    const g = this.points.geometry;
    const pos = g.getAttribute(posAttr); pos.array.set(layout.positions, offset * 2); pos.needsUpdate = true;
    const den = g.getAttribute(densAttr); den.array.set(layout.density, offset); den.needsUpdate = true;
    if (layout.z && offset === 0) {
      const z = layout.z instanceof Float32Array ? layout.z : Float32Array.from(layout.z);
      g.setAttribute('aZ', new THREE.BufferAttribute(z, 1)); // fresh attribute → reliably uploads
    }
    // Tone: data reads layout.ramp, structure reads layout.role. Absent → 0 over the written slice.
    this._fillTone(toneAttr, this.glow ? layout.ramp : layout.role, offset, layout.density.length);
  }

  _fillTone(name, v, offset, n) {
    if (v == null) v = 0;
    if (v === 0 && !this._toneUsed) return; // never tagged → the buffer is already all zeros (no upload)
    const a = this.points.geometry.getAttribute(name);
    if (typeof v === 'number') a.array.fill(v, offset, offset + n);
    else a.array.set(v.length > n ? v.subarray(0, n) : v, offset);
    this._toneUsed = true;
    a.needsUpdate = true;
  }

  /** @param {number} t 0 = source, 1 = target */
  setT(t) { this.material.uniforms.uT.value = t; }
  setTime(s) { this.material.uniforms.uTime.value = s; }
  setPixelRatio(r) { this.material.uniforms.uPixelRatio.value = r; }
  /** Base point size (px, before density boost / perspective). */
  setSize(px) { this.material.uniforms.uSize.value = px; }
  /** Cap on-screen point size (px) so dots stay fine, not fat discs, when zoomed in. */
  setMaxSize(px) { this.material.uniforms.uMaxSize.value = px; }
  /** Structure shimmer — per-dot brightness-breath amplitude (0 = still) and speed. */
  setShimmer(a) { this.material.uniforms.uShimmer.value = a; }
  setShimmerSpeed(s) { this.material.uniforms.uShimmerSpeed.value = s; }
  /** Idle-drift AMPLITUDE — how far a point strays from home (keep small). */
  setDrift(px) { this.material.uniforms.uDrift.value = px; }
  /** Idle-drift SPEED — how fast the orbit runs (makes motion felt; no extra stray). */
  setDriftSpeed(mult) { this.material.uniforms.uDriftSpeed.value = mult; }
  /** Per-dot transition stagger (0 = all move together; ~0.6 = a cascading swarm). */
  setStagger(w) {
    const u = this.material.uniforms.uStagger;
    this._staggerWrites++; // every call counts (the Motion door hands its stagger back only if nobody set one since)
    if (u.value !== w) { u.value = w; this._epoch++; }
  }
  get staggerWrites() { return this._staggerWrites; }
  /** Replace the per-point seed buffer (twinkle/drift phase AND stagger order). Random seeds =
   *  an organic flock; ORDERED seeds turn a staggered morph into a strict procession — dot k
   *  crosses at uT ≈ fract(seed_k / 2π). Callers restore the old array to return to randomness. */
  setSeeds(seeds) {
    const a = this.points.geometry.getAttribute('aSeed');
    a.copyArray(seeds);
    a.needsUpdate = true;
    this._epoch++;
  }
  /** Ordered per-point SPIN: a LANDED dot's target slowly rotates about uSpinCentre by
   *  sign·rate·(uSpinTime − onset), gated to only bite near lt≈1 — the inbound morph stays a clean
   *  path and the rotation is pure about the centre, so each dot's RADIUS is preserved (it implies
   *  nothing). `rates` are signed (opposite signs = counter-rotating groups); `onsets` (seconds)
   *  start each dot from angle 0 at its own settle. Generic: any caller can turn a settled target
   *  field into an orrery. Pair with setSpinCentre/setSpinTime and setSpinOn(true). */
  setSpin(rates, onsets) {
    const g = this.points.geometry;
    g.getAttribute('aSpinRate').copyArray(rates).needsUpdate = true;
    g.getAttribute('aSpinOnset').copyArray(onsets).needsUpdate = true;
    this._epoch++;
  }
  /** Advance the spin's REAL-time clock (seconds) — independent of the morph's uT, so a settled
   *  field keeps turning even when the morph is paused. */
  setSpinTime(s) { this.material.uniforms.uSpinTime.value = s; }
  /** The point that targets rotate about (radius from here is the invariant). */
  setSpinCentre(x, y) { this.material.uniforms.uSpinCentre.value.set(x, y); }
  /** Master gate — false (default) = no spin anywhere; true = ordered spin per aSpinRate/aSpinOnset. */
  setSpinOn(on) { this.material.uniforms.uSpinOn.value = on ? 1 : 0; }
  /** DATA per-dot brightness curve: floor (lone-ember glow) + gain (density dependence; low = tamer cores). */
  setDataFloor(v) { this.material.uniforms.uDataFloor.value = v; }
  setDataGain(v) { this.material.uniforms.uDataGain.value = v; }
  /** Density colour ramp 0 — any of cool/mid/warm (hex strings or THREE.Color); a hotter warm keeps dense
   *  cores COLOURED (molten) instead of white, because a low-blue warm saturates to white far later.
   *  (Ramp 0 is what every untagged dot uses; setRamps sets all of them.) */
  setRamp(cool, mid, warm) { this.setRamps([[cool, mid, warm]]); }
  /** Up to MAX_RAMPS density ramps: [[cool, mid, warm], …] indexed by a dot's tone (layout.ramp). A
   *  missing/null entry (or stop) keeps its current value, so sparse arrays set just one ramp. */
  setRamps(list) {
    const u = this.material.uniforms;
    for (let k = 0; k < Math.min(list.length, MAX_RAMPS); k++) {
      const r = list[k];
      if (!r) continue;
      if (r[0]) u.uRampCool.value[k].set(r[0]);
      if (r[1]) u.uRampMid.value[k].set(r[1]);
      if (r[2]) u.uRampWarm.value[k].set(r[2]);
    }
  }
  /** The pool's own flat structure colour — role 0 (and every untagged structure dot). */
  setMatte(c) { this.material.uniforms.uMatte.value.set(c); }
  /** Structure role colours [c0, c1, … c7] indexed by a dot's tone (layout.role). Entry 0 is IGNORED —
   *  role 0 is always the pool's matte (setMatte); null entries keep their current value. */
  setRoleColors(list) {
    const v = this.material.uniforms.uRoleColors.value;
    for (let k = 1; k < Math.min(list.length, MAX_ROLES); k++) if (list[k]) v[k].set(list[k]);
  }
  /** Flow-field advection for play states: amp in world units (0 = off), optional speed multiplier.
   *  Keep speed FIXED while amp > 0 — the flow is a function of time, so a speed change mid-flight
   *  snaps every dot's phase; ramp the amplitude instead. */
  setFlow(amp, speed) { this.material.uniforms.uFlow.value = amp; if (speed != null) this.material.uniforms.uFlowSpeed.value = speed; }

  /** Terrain vertical scale — 0 = flat map, higher lifts each point's aZ into relief. */
  setZScale(s) { this.material.uniforms.uZScale.value = s; }
  /** Global opacity 0..1 — for cross-fading fields (map mesh ↔ terrain). */
  setOpacity(o) { this.material.uniforms.uOpacity.value = o; }

  // ---- MOTION (D4) ------------------------------------------------------------------------------------
  /** How dots travel source → target. `mode`: 'straight' (default) | 'arc' | 'swirl'. opts — arc:
   *  { bend (control offset × travel distance, ~0.35), fan (1 = both sides, 0 = one side) }; swirl:
   *  { centre: {x,y} | [x,y], dir (0 = shortest turn per dot · +1 every dot CCW · −1 every dot CW — a
   *  vortex; −1 exactly retraces a +1 swirl backwards), turns (extra whole turns) }. Endpoints are untouched
   *  (every mode equals the lerp at lt = 0 and 1). Unknown modes fall back to straight. */
  setPath(mode = 'straight', opts = {}) {
    const u = this.material.uniforms;
    const m = PATH_MODES[mode] ?? 0;
    if (u.uPath.value !== m) { u.uPath.value = m; this._epoch++; }
    if (opts.bend != null) u.uBend.value = opts.bend;
    if (opts.fan != null) u.uFan.value = opts.fan;
    if (opts.dir != null) u.uSwirlDir.value = Math.sign(opts.dir);
    if (opts.turns != null) u.uSwirlTurns.value = Math.max(0, Math.round(opts.turns));
    if (opts.centre) {
      const c = opts.centre;
      u.uSwirlCentre.value.set(c.x ?? c[0] ?? 0, c.y ?? c[1] ?? 0);
    }
  }
  get path() { return Object.keys(PATH_MODES).find((k) => PATH_MODES[k] === this.material.uniforms.uPath.value); }
  /** A per-dot stagger ORDER in [0,1) (0 = crosses first) that replaces the random seed's slot in the stagger
   *  window — aSeed (twinkle/drift phase) is untouched, so this is invisible to switch at an endpoint.
   *  `offset` (points) writes a slice (the rest keeps its values). null → back to the random order. */
  setOrder(order, offset = 0) {
    const u = this.material.uniforms.uOrderOn;
    if (order == null) {
      if (u.value !== 0) { u.value = 0; this._epoch++; }
      return;
    }
    const a = this.points.geometry.getAttribute('aOrder');
    a.array.set(order.length + offset > this.count ? order.subarray(0, this.count - offset) : order, offset);
    a.needsUpdate = true;
    u.value = 1;
    this._epoch++;
  }
  /** Comet streaks: `k` = length in frames of travel (0 = off). opts: { max (CSS px cap), tail (0..1 tail
   *  brightness), conserve (0 = the comet adds light, 1 = its energy spreads along it) }. */
  setStreak(k, opts = {}) {
    const u = this.material.uniforms;
    u.uStreak.value = k;
    if (opts.max != null) u.uStreakMax.value = opts.max;
    if (opts.tail != null) u.uStreakTail.value = opts.tail;
    if (opts.conserve != null) u.uStreakConserve.value = opts.conserve;
  }
  /** (1/60 s) ÷ the last frame's duration: the per-frame travel × this = travel per 60-fps frame, so a comet
   *  is as long on a 120 Hz display as on a 60 Hz one. The Motion door sets it each frame (default 1). */
  setStreakRate(r) { this.material.uniforms.uStreakRate.value = r; }
  /** Drawing-buffer size in device px (the streak converts NDC motion → px). */
  setViewport(w, h) { this.material.uniforms.uViewport.value.set(w, h); }
  /** Aerial perspective: { far, near, strength } (any subset; relative to the focus distance), or
   *  false/null to switch it off. far = relative depth past the focus plane where haze is full; near = the
   *  relative depth below which dots dissolve (fully gone at near/2); strength = the far fade (0..1). */
  setHaze(cfg) {
    const u = this.material.uniforms;
    if (!cfg) { u.uHazeOn.value = 0; return; }
    u.uHazeOn.value = cfg.on === false ? 0 : 1;
    if (cfg.far != null) u.uHazeFar.value = cfg.far;
    if (cfg.near != null) u.uHazeNear.value = cfg.near;
    if (cfg.strength != null) u.uHazeStrength.value = cfg.strength;
  }
  /** The camera's focus distance (camera → the point it looks at), world units — haze's depth yardstick. */
  setFocus(d) { this.material.uniforms.uFocus.value = d; }
  /** Once per RENDERED frame, before rendering: last frame's uT becomes uTPrev (the streak's finite
   *  difference). A frame in which the pair/order/path/stagger changed gets uTPrev = uT (no streak) — the old
   *  uT means nothing against the new endpoints. Pages that never call this never streak (uStreak = 0). */
  beginFrame() {
    const u = this.material.uniforms, t = u.uT.value;
    u.uTPrev.value = this._frameEpoch === this._epoch && this._frameT != null ? this._frameT : t;
    this._frameT = t; this._frameEpoch = this._epoch;
  }
  /** Monotone counter of changes that alter what uT means (pair writes, seeds, order, path, stagger). */
  get epoch() { return this._epoch; }
}

const VERT = /* glsl */ `
  uniform float uT;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uGlow;
  uniform float uDrift;
  uniform float uDriftSpeed;
  uniform float uStagger;
  uniform float uShimmer;
  uniform float uShimmerSpeed;
  uniform float uZScale;
  uniform float uFlow;
  uniform float uFlowSpeed;
  uniform float uMaxSize;
  uniform float uSpinTime;
  uniform vec2 uSpinCentre;
  uniform float uSpinOn;
  // motion (D4)
  uniform float uTPrev;
  uniform float uPath;
  uniform float uBend;
  uniform float uFan;
  uniform vec2 uSwirlCentre;
  uniform float uSwirlDir;
  uniform float uSwirlTurns;
  uniform float uOrderOn;
  uniform float uStreak;
  uniform float uStreakRate;
  uniform float uStreakMax;
  uniform vec2 uViewport;
  uniform float uHazeOn;
  uniform float uFocus;
  uniform float uHazeFar;
  uniform float uHazeNear;
  uniform float uHazeStrength;

  attribute vec2 aSource;
  attribute vec2 aTarget;
  attribute float aSourceDensity;
  attribute float aTargetDensity;
  attribute float aSeed;
  attribute float aZ;
  attribute float aSpinRate;
  attribute float aSpinOnset;
  attribute float aSourceTone;
  attribute float aTargetTone;
  attribute float aOrder;

  varying float vDensity;
  varying float vTwinkle;
  varying vec3 vTone;   // x = source tone, y = target tone, z = this dot's lt (the blend between them)
  varying vec3 vStreak; // xy = unit travel direction in gl_PointCoord's frame (y down) · z = round width / sprite size (1 = round)
  varying float vFade;  // aerial perspective × near-dissolve (1 = untouched)

  const float TAU = 6.2831853;

  // This dot's progress through its OWN stagger window at a given uT (o = its order slot in [0,1)).
  float ltAt(float T, float o, float w) { return clamp((T - o * (1.0 - w)) / w, 0.0, 1.0); }

  // Where the dot is along its PATH at progress lt (tgt = its target, possibly spun). Every mode is EXACTLY
  // the lerp at lt = 0 and lt = 1 — the endpoints (the layouts) are never touched.
  vec2 pathAt(float lt, vec2 tgt) {
    vec2 p = mix(aSource, tgt, lt);
    if (uPath < 0.5 || lt <= 0.0 || lt >= 1.0) return p;
    vec2 d = tgt - aSource;
    if (uPath < 1.5) {
      // ARC — a quadratic bezier whose control point sits off the chord's midpoint, perpendicular to the
      // travel, by bend × travel distance: bezier − lerp = 2·lt·(1−lt)·(C − mid), so the motion ALONG the
      // chord is the lerp's and only the bow is added. Side + magnitude per dot from two seed hashes.
      float h1 = fract(sin(aSeed * 12.9898 + 1.7) * 43758.5453);
      float h2 = fract(sin(aSeed * 78.233 + 4.1) * 43758.5453);
      float side = h1 < 0.5 * uFan ? -1.0 : 1.0;
      return p + vec2(-d.y, d.x) * (side * 2.0 * lt * (1.0 - lt) * uBend * (0.55 + 0.45 * h2));
    }
    // SWIRL — radius + angle about a centre, interpolated separately: the field winds in / unwinds out.
    vec2 a = aSource - uSwirlCentre, b = tgt - uSwirlCentre;
    float ra = length(a), rb = length(b);
    float tb0 = rb > 1.0e-3 ? atan(b.y, b.x) : 0.0;
    float ta = ra > 1.0e-3 ? atan(a.y, a.x) : tb0;
    float tb = rb > 1.0e-3 ? tb0 : ta;
    float dth = tb - ta;
    if (uSwirlDir > 0.5) dth = mod(dth, TAU);                // every dot turns CCW (a vortex)
    else if (uSwirlDir < -0.5) dth = mod(dth, TAU) - TAU;    // every dot turns CW (retraces a CCW swirl)
    else dth -= TAU * floor(dth / TAU + 0.5);                // each dot's shortest turn
    dth += TAU * uSwirlTurns * (uSwirlDir < -0.5 ? -1.0 : 1.0); // whole extra turns → the endpoint stays exact
    float th = ta + dth * lt;
    return uSwirlCentre + mix(ra, rb, lt) * vec2(cos(th), sin(th));
  }

  void main() {
    // Per-dot staggered transition into a cascading swarm, not a rigid slide. Each dot
    // crosses over a window w of uT, starting at an order-based offset: the random seed (an organic
    // flock) or, while the Motion door asks, a MEANINGFUL order (aOrder). Endpoints are preserved
    // (everyone is fully at source at uT=0, fully at target at uT=1).
    float seed01 = fract(aSeed * 0.1591549431);
    float o = uOrderOn > 0.5 ? aOrder : seed01;
    // The floor only guards the division — keep it an EPSILON, not a taste value: per-dot windows
    // of a few 1e-4 are legitimate (thousands of ordered dots crossing one at a time).
    float w = max(uStagger, 1.0e-4);
    float lt = ltAt(uT, o, w);

    // Ordered spin — a LANDED dot's target rotates about uSpinCentre on a real-time clock. gate ≈ 0
    // until lt≈1, so a still-inbound dot keeps its clean path (the spiral pour is untouched); the
    // angle grows from ZERO at the dot's own onset (max(0, …)), so a ring eases into motion with no
    // jerk and keeps turning while the morph is paused. Pure rotation → radius is preserved exactly.
    vec2 tgt = aTarget;
    if (uSpinOn > 0.5) {
      float gate = smoothstep(0.86, 1.0, lt);
      float ang = aSpinRate * max(0.0, uSpinTime - aSpinOnset) * gate;
      float cs = cos(ang), sn = sin(ang);
      vec2 d = aTarget - uSpinCentre;
      tgt = uSpinCentre + vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
    }

    vec2 base = pathAt(lt, tgt);
    vec2 pos = base;
    float density = mix(aSourceDensity, aTargetDensity, lt);
    vDensity = density;
    vTone = vec3(aSourceTone, aTargetTone, lt); // the colour choice travels with the dot, blended by ITS lt

    // Idle drift — each point wanders a slow, tiny orbit on its own phase, so the
    // field shimmers like a living swarm even at rest. Two summed frequencies keep
    // it organic (not a clean circle); sparse points float a touch more than packed
    // cores. Structure has uDrift = 0, so the frame stays solid.
    float ph = aSeed;
    float tt = uTime * uDriftSpeed; // speed scales the orbit, NOT its radius
    float wander = uDrift * (1.3 - 0.5 * density);
    pos.x += wander * (sin(tt * 0.5 + ph) + 0.5 * sin(tt * 1.1 + ph * 2.0));
    pos.y += wander * (cos(tt * 0.43 + ph * 1.3) + 0.5 * cos(tt * 0.9 + ph * 1.7));

    // FLOW FIELD — divergence-free curl advection for released/play states (uFlow is 0 in every
    // truthful view). Sampled from POSITION + time, never per-dot randomness, so neighbours ride the
    // same stream — coherent turning waves, not jitter. Two octaves of the analytic curl
    // (∂ψ/∂y, −∂ψ/∂x) of trig potentials: swirls that never bunch the field up.
    if (uFlow > 0.0) {
      float ft = uTime * uFlowSpeed;
      vec2 q1 = pos * 0.011;
      vec2 f1 = vec2(-1.30 * sin(q1.x + ft * 0.90) * sin(q1.y * 1.30 - ft * 0.63),
                     -cos(q1.x + ft * 0.90) * cos(q1.y * 1.30 - ft * 0.63));
      vec2 q2 = pos * 0.033;
      vec2 f2 = vec2(-0.80 * sin(q2.x - ft * 1.70) * sin(q2.y * 0.80 + ft * 1.10),
                     -cos(q2.x - ft * 1.70) * cos(q2.y * 0.80 + ft * 1.10));
      pos += uFlow * (f1 + 0.5 * f2);
    }

    // Per-point breath. Data: a gentle twinkle. Structure: each dot fades slightly in/out on
    // its OWN phase (never brighter than base), so the frame shimmers like faint stars.
    vTwinkle = uGlow > 0.5
      ? (0.85 + 0.15 * sin(uTime * 1.6 + aSeed))
      : (1.0 - uShimmer * (0.5 - 0.5 * sin(uTime * uShimmerSpeed + aSeed * 1.7)));

    float zLift = aZ * uZScale;
    vec4 mvPosition = modelViewMatrix * vec4(pos, zLift, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Data: dense cores read a touch larger. Structure: uniform fine dust.
    float sizeBoost = uGlow > 0.5 ? (0.6 + 0.95 * density) : 1.0;
    float D = uSize * sizeBoost * uPixelRatio * (300.0 / -mvPosition.z);
    // Cap on-screen size so a zoom-in keeps a FINE field of dots instead of fat discs
    // (perspective otherwise grows each point ∝ 1/distance without limit).
    D = min(D, uMaxSize * uPixelRatio);

    // The fragment discards these anyway (data < 0.02, structure < 0.01) — clip them here instead, so the
    // parked surplus (most of every pool) costs no rasterisation. Same pixels.
    bool hidden = density < (uGlow > 0.5 ? 0.02 : 0.01);

    // COMET STREAK — the dot's own screen-space travel since last frame (same path, same camera: an orbiting
    // camera never streaks a resting field), × uStreak frames, capped. The sprite grows to hold the comet and
    // its centre slides back half the tail, so the head stays exactly where the dot is.
    vStreak = vec3(0.0, 0.0, 1.0);
    if (uStreak > 0.0 && !hidden && abs(uT - uTPrev) < 0.35) {
      float ltp = ltAt(uTPrev, o, w);
      if (ltp != lt) {
        vec4 cp = projectionMatrix * modelViewMatrix * vec4(pathAt(ltp, tgt) + (pos - base), zLift, 1.0);
        if (cp.w > 0.0 && gl_Position.w > 0.0) {
          vec2 v = (gl_Position.xy / gl_Position.w - cp.xy / cp.w) * 0.5 * uViewport * (uStreak * uStreakRate);
          float L = length(v);
          float Lc = min(L, uStreakMax * uPixelRatio);
          if (Lc > 0.75) {
            vec2 dir = v / L;
            gl_Position.xy -= dir * (0.5 * Lc) / (0.5 * uViewport) * gl_Position.w;
            vStreak = vec3(dir.x, -dir.y, D / (D + Lc));
            D += Lc;
          }
        }
      }
    }
    gl_PointSize = D;

    // AERIAL PERSPECTIVE — depth relative to the focus distance (1 = the plane the camera looks at). A flat
    // field seen top-down is at 1 everywhere, so this is a no-op at every top-down home; tilt the camera and
    // the far land fades toward the background while dots closer than uHazeNear dissolve (never balloon).
    vFade = 1.0;
    if (uHazeOn > 0.5) {
      float rel = -mvPosition.z / max(uFocus, 1.0e-3);
      float hz = uHazeStrength * smoothstep(1.03, 1.0 + max(uHazeFar, 0.05), rel);
      float nr = max(uHazeNear, 1.0e-3);
      vFade = (1.0 - hz) * smoothstep(nr * 0.5, nr, rel);
    }
    if (hidden || vFade <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // outside the clip volume → culled
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uGlow;
  uniform float uOpacity;
  uniform float uDataFloor;
  uniform float uDataGain;
  uniform vec3 uRampCool[${MAX_RAMPS}];
  uniform vec3 uRampMid[${MAX_RAMPS}];
  uniform vec3 uRampWarm[${MAX_RAMPS}];
  uniform vec3 uMatte;
  uniform vec3 uRoleColors[${MAX_ROLES}];
  uniform float uStreakTail;
  uniform float uStreakConserve;

  varying float vDensity;
  varying float vTwinkle;
  varying vec3 vTone;
  varying vec3 vStreak;
  varying float vFade;

  vec3 ramp(float k, float d) {
    // Pick ramp k (constant-index selects — portable), then the SAME curve as always:
    // cool/dim -> mid -> warm/bright. The cool end is held across the whole
    // sparse+mid field so the density "journey" is a real cool->warm gradient;
    // warmth arrives only in genuine cores. This gradient IS the read.
    vec3 c = uRampCool[0], m = uRampMid[0], w = uRampWarm[0];
    if (k > 0.5) {
      if (k < 1.5)      { c = uRampCool[1]; m = uRampMid[1]; w = uRampWarm[1]; }
      else if (k < 2.5) { c = uRampCool[2]; m = uRampMid[2]; w = uRampWarm[2]; }
      else              { c = uRampCool[3]; m = uRampMid[3]; w = uRampWarm[3]; }
    }
    vec3 lo = mix(c, m, smoothstep(0.12, 0.62, d));
    return mix(lo, w, smoothstep(0.62, 0.95, d));
  }
  vec3 role(float k) {
    // Role 0 = the pool's own matte; 1..7 = the role colours (a constant-index loop — portable).
    if (k < 0.5) return uMatte;
    int i = int(k + 0.5);
    vec3 c = uRoleColors[1];
    for (int j = 2; j < ${MAX_ROLES}; j++) if (j == i) c = uRoleColors[j];
    return c;
  }

  void main() {
    // Soft round sprite: bright core, smooth falloff to the edge.
    vec2 uv = gl_PointCoord - 0.5;
    float r;
    float streakK = 1.0;
    if (vStreak.z < 0.999) {
      // A COMET: a capsule along the travel direction — the round dot's own profile across it, a head at
      // the dot's true position, a tail fading back along where it just was.
      float b = 0.5 * vStreak.z;               // half-width (point-coord units; the sprite is 1 wide)
      float h = 0.5 - b;                       // half-length of the capsule's core segment
      float along = dot(uv, vStreak.xy);       // + = toward the head
      float across = dot(uv, vec2(-vStreak.y, vStreak.x));
      float s = clamp(along, -h, h);
      r = length(vec2(along - s, across)) / b;
      // tail fade + energy spread, both weighted by the elongation (1 − z) → continuous from the round dot
      float e = 1.0 - vStreak.z;
      streakK = mix(1.0, mix(uStreakTail, 1.0, smoothstep(-0.5, 0.5, along)), e) * mix(1.0, vStreak.z, uStreakConserve);
    } else {
      r = length(uv) * 2.0;
    }
    if (r > 1.0) discard;
    float core = smoothstep(1.0, 0.0, r);

    if (uGlow > 0.5) {
      // DATA — glowing, density-coloured. Parked points (density ~0, used by the
      // year-scrub to hold surplus slots at a precinct centre) are invisible.
      if (vDensity < 0.02) discard;
      // Per-point contribution is deliberately gentle: a single sparse star is a
      // faint blue ember; warm bright cores emerge from many points STACKING
      // additively, not from any one blown out.
      float glow = core * core;
      vec3 col = ramp(vTone.x, vDensity);
      // A tone change (e.g. a crime flip across families) BLENDS by this dot's own lt, in flight.
      if (vTone.y != vTone.x) col = mix(col, ramp(vTone.y, vDensity), vTone.z);
      float brightness = (uDataFloor + uDataGain * vDensity) * vTwinkle;
      gl_FragColor = vec4(col, glow * brightness);
    } else {
      // STRUCTURE — grey, matte, recessive. Brightness rides vDensity so the terrain
      // relief reads tonally (paler high ground); the precinct mesh (flat density) is
      // barely touched. A soft-edged dot: a quiet grey field, not stars.
      if (vDensity < 0.01) discard;              // ocean (density 0) → the land ends at the coast
      float a = smoothstep(1.0, 0.15, r) * 0.92;
      // 0.9 = a 10% overall brightness trim on the grey-green frame (keeps the tonal shape).
      vec3 col = role(vTone.x);
      if (vTone.y != vTone.x) col = mix(col, role(vTone.y), vTone.z); // a role change blends in flight too
      gl_FragColor = vec4(col * (0.9 * (0.32 + 4.5 * vDensity)) * vTwinkle, a);
    }
    gl_FragColor.a *= uOpacity * streakK * vFade; // streakK = vFade = 1 at rest with haze off → unchanged
  }
`;
