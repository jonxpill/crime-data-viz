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
 */
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
        uRampCool: { value: ramp[0] },
        uRampMid: { value: ramp[1] },
        uRampWarm: { value: ramp[2] },
        uMatte: { value: matte },
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
  setSource(layout, offset = 0) { this._fill('aSource', 'aSourceDensity', layout, offset); }

  /** Fill the TARGET endpoint from a layout (same offset semantics as setSource). */
  setTarget(layout, offset = 0) { this._fill('aTarget', 'aTargetDensity', layout, offset); }

  _fill(posAttr, densAttr, layout, offset = 0) {
    const g = this.points.geometry;
    const pos = g.getAttribute(posAttr); pos.array.set(layout.positions, offset * 2); pos.needsUpdate = true;
    const den = g.getAttribute(densAttr); den.array.set(layout.density, offset); den.needsUpdate = true;
    if (layout.z && offset === 0) {
      const z = layout.z instanceof Float32Array ? layout.z : Float32Array.from(layout.z);
      g.setAttribute('aZ', new THREE.BufferAttribute(z, 1)); // fresh attribute → reliably uploads
    }
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
  setStagger(w) { this.material.uniforms.uStagger.value = w; }
  /** Replace the per-point seed buffer (twinkle/drift phase AND stagger order). Random seeds =
   *  an organic flock; ORDERED seeds turn a staggered morph into a strict procession — dot k
   *  crosses at uT ≈ fract(seed_k / 2π). Callers restore the old array to return to randomness. */
  setSeeds(seeds) {
    const a = this.points.geometry.getAttribute('aSeed');
    a.copyArray(seeds);
    a.needsUpdate = true;
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
  /** Density colour ramp — any of cool/mid/warm (hex strings or THREE.Color); a hotter warm keeps dense
   *  cores COLOURED (molten) instead of white, because a low-blue warm saturates to white far later. */
  setRamp(cool, mid, warm) {
    const u = this.material.uniforms;
    if (cool) u.uRampCool.value.set(cool);
    if (mid) u.uRampMid.value.set(mid);
    if (warm) u.uRampWarm.value.set(warm);
  }
  /** Flow-field advection for play states: amp in world units (0 = off), optional speed multiplier.
   *  Keep speed FIXED while amp > 0 — the flow is a function of time, so a speed change mid-flight
   *  snaps every dot's phase; ramp the amplitude instead. */
  setFlow(amp, speed) { this.material.uniforms.uFlow.value = amp; if (speed != null) this.material.uniforms.uFlowSpeed.value = speed; }

  /** Terrain vertical scale — 0 = flat map, higher lifts each point's aZ into relief. */
  setZScale(s) { this.material.uniforms.uZScale.value = s; }
  /** Global opacity 0..1 — for cross-fading fields (map mesh ↔ terrain). */
  setOpacity(o) { this.material.uniforms.uOpacity.value = o; }
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

  attribute vec2 aSource;
  attribute vec2 aTarget;
  attribute float aSourceDensity;
  attribute float aTargetDensity;
  attribute float aSeed;
  attribute float aZ;
  attribute float aSpinRate;
  attribute float aSpinOnset;

  varying float vDensity;
  varying float vTwinkle;

  // Smooth, slightly eased blend so the field "settles" rather than slides linearly.
  void main() {
    // Per-dot staggered transition into a cascading swarm, not a rigid slide. Each dot
    // crosses over a window w of uT, starting at a seed-based offset. Endpoints are
    // preserved (everyone is fully at source at uT=0, fully at target at uT=1).
    float seed01 = fract(aSeed * 0.1591549431);
    // The floor only guards the division — keep it an EPSILON, not a taste value: per-dot windows
    // of a few 1e-4 are legitimate (thousands of ordered dots crossing one at a time).
    float w = max(uStagger, 1.0e-4);
    float lt = clamp((uT - seed01 * (1.0 - w)) / w, 0.0, 1.0);

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

    vec2 pos = mix(aSource, tgt, lt);
    float density = mix(aSourceDensity, aTargetDensity, lt);
    vDensity = density;

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

    vec4 mvPosition = modelViewMatrix * vec4(pos, aZ * uZScale, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Data: dense cores read a touch larger. Structure: uniform fine dust.
    float sizeBoost = uGlow > 0.5 ? (0.6 + 0.95 * density) : 1.0;
    gl_PointSize = uSize * sizeBoost * uPixelRatio * (300.0 / -mvPosition.z);
    // Cap on-screen size so a zoom-in keeps a FINE field of dots instead of fat discs
    // (perspective otherwise grows each point ∝ 1/distance without limit).
    gl_PointSize = min(gl_PointSize, uMaxSize * uPixelRatio);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uGlow;
  uniform float uOpacity;
  uniform float uDataFloor;
  uniform float uDataGain;
  uniform vec3 uRampCool;
  uniform vec3 uRampMid;
  uniform vec3 uRampWarm;
  uniform vec3 uMatte;

  varying float vDensity;
  varying float vTwinkle;

  vec3 ramp(float d) {
    // cool/dim -> mid -> warm/bright. The cool end is held across the whole
    // sparse+mid field so the density "journey" is a real blue->gold gradient;
    // warmth arrives only in genuine cores. This gradient IS the read.
    vec3 lo = mix(uRampCool, uRampMid, smoothstep(0.12, 0.62, d));
    return mix(lo, uRampWarm, smoothstep(0.62, 0.95, d));
  }

  void main() {
    // Soft round sprite: bright core, smooth falloff to the edge.
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
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
      vec3 col = ramp(vDensity);
      float brightness = (uDataFloor + uDataGain * vDensity) * vTwinkle;
      gl_FragColor = vec4(col, glow * brightness);
    } else {
      // STRUCTURE — grey, matte, recessive. Brightness rides vDensity so the terrain
      // relief reads tonally (paler high ground); the precinct mesh (flat density) is
      // barely touched. A soft-edged dot: a quiet grey field, not stars.
      if (vDensity < 0.01) discard;              // ocean (density 0) → the land ends at the coast
      float a = smoothstep(1.0, 0.15, r) * 0.92;
      // 0.9 = a 10% overall brightness trim on the grey-green frame (keeps the tonal shape).
      gl_FragColor = vec4(uMatte * (0.9 * (0.32 + 4.5 * vDensity)) * vTwinkle, a);
    }
    gl_FragColor.a *= uOpacity;
  }
`;
