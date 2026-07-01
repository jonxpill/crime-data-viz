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
      new THREE.Color('#7c9ce0'), // sparse / cool / dim (a touch more saturated to read blue)
      new THREE.Color('#cdd6ee'), // mid
      new THREE.Color('#ffce86'), // dense / warm / bright
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
    // BufferGeometry needs *some* `position`; we drive xy ourselves, keep z=0.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: size },
        uPixelRatio: { value: 1 },
        uGlow: { value: this.glow ? 1 : 0 },
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
        uZScale: { value: 0 }, // terrain vertical scale (0 = flat map; raised = relief)
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

  /** Fill the SOURCE endpoint from a layout { positions:Float32Array(n*2), density:Float32Array(n) }. */
  setSource(layout) { this._fill('aSource', 'aSourceDensity', layout); }

  /** Fill the TARGET endpoint from a layout. */
  setTarget(layout) { this._fill('aTarget', 'aTargetDensity', layout); }

  _fill(posAttr, densAttr, layout) {
    const g = this.points.geometry;
    g.getAttribute(posAttr).copyArray(layout.positions).needsUpdate = true;
    g.getAttribute(densAttr).copyArray(layout.density).needsUpdate = true;
    if (layout.z) {
      const z = layout.z instanceof Float32Array ? layout.z : Float32Array.from(layout.z);
      g.setAttribute('aZ', new THREE.BufferAttribute(z, 1)); // fresh attribute → reliably uploads
    }
  }

  /** @param {number} t 0 = source, 1 = target */
  setT(t) { this.material.uniforms.uT.value = t; }
  setTime(s) { this.material.uniforms.uTime.value = s; }
  setPixelRatio(r) { this.material.uniforms.uPixelRatio.value = r; }
  /** Idle-drift AMPLITUDE — how far a point strays from home (keep small). */
  setDrift(px) { this.material.uniforms.uDrift.value = px; }
  /** Idle-drift SPEED — how fast the orbit runs (makes motion felt; no extra stray). */
  setDriftSpeed(mult) { this.material.uniforms.uDriftSpeed.value = mult; }
  /** Per-dot transition stagger (0 = all move together; ~0.6 = a cascading swarm). */
  setStagger(w) { this.material.uniforms.uStagger.value = w; }
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
  uniform float uZScale;

  attribute vec2 aSource;
  attribute vec2 aTarget;
  attribute float aSourceDensity;
  attribute float aTargetDensity;
  attribute float aSeed;
  attribute float aZ;

  varying float vDensity;
  varying float vTwinkle;

  // Smooth, slightly eased blend so the field "settles" rather than slides linearly.
  void main() {
    // Per-dot staggered transition into a cascading swarm, not a rigid slide. Each dot
    // crosses over a window w of uT, starting at a seed-based offset. Endpoints are
    // preserved (everyone is fully at source at uT=0, fully at target at uT=1).
    float seed01 = fract(aSeed * 0.1591549431);
    float w = max(uStagger, 0.02);
    float lt = clamp((uT - seed01 * (1.0 - w)) / w, 0.0, 1.0);
    vec2 pos = mix(aSource, aTarget, lt);
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

    // Gentle per-point twinkle — denser data breathes a touch; structure is still.
    vTwinkle = uGlow > 0.5 ? (0.85 + 0.15 * sin(uTime * 1.6 + aSeed)) : 1.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, aZ * uZScale, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Data: dense cores read a touch larger. Structure: uniform fine dust.
    float sizeBoost = uGlow > 0.5 ? (0.6 + 0.95 * density) : 1.0;
    gl_PointSize = uSize * sizeBoost * uPixelRatio * (300.0 / -mvPosition.z);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uGlow;
  uniform float uOpacity;
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
      float brightness = (0.14 + 0.70 * vDensity) * vTwinkle;
      gl_FragColor = vec4(col, glow * brightness);
    } else {
      // STRUCTURE — grey, matte, recessive. Brightness rides vDensity so the terrain
      // relief reads tonally (paler high ground); the precinct mesh (flat density) is
      // barely touched. A soft-edged dot: a quiet grey field, not stars.
      if (vDensity < 0.01) discard;              // ocean (density 0) → the land ends at the coast
      float a = smoothstep(1.0, 0.15, r) * 0.92;
      gl_FragColor = vec4(uMatte * (0.32 + 4.5 * vDensity), a);
    }
    gl_FragColor.a *= uOpacity;
  }
`;
