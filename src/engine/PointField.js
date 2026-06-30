import * as THREE from 'three';

/**
 * PointField — the pure engine. THE DESIGN OBJECT.
 *
 * It knows NOTHING about crime, maps, projections, or years. It holds one field
 * of points, each storing a `source` and a `target` (x, y) plus a source/target
 * `density`, and interpolates the whole field with a single `t` uniform in the
 * vertex shader (the CPU stays idle during a morph). Density → colour + glow
 * happens on the GPU. Brightness/glow is the DATA channel; structure points
 * (later) will opt out of glow entirely.
 *
 * A "layout" is just a function upstream that fills { positions, density }.
 * A new view = a new layout. The engine never grows to know what a view means.
 */
export class PointField {
  /**
   * @param {number} count number of points
   * @param {object} [opts]
   * @param {number} [opts.size] base point size in px (before density boost)
   * @param {THREE.Color[]} [opts.ramp] density colour ramp [cool, mid, warm]
   */
  constructor(count, opts = {}) {
    this.count = count;
    const size = opts.size ?? 2.2;
    const ramp = opts.ramp ?? [
      new THREE.Color('#7c9ce0'), // sparse / cool / dim (a touch more saturated to read blue)
      new THREE.Color('#cdd6ee'), // mid
      new THREE.Color('#ffce86'), // dense / warm / bright
    ];

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
    // BufferGeometry needs *some* `position`; we drive xy ourselves, keep z=0.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: size },
        uPixelRatio: { value: 1 },
        uRampCool: { value: ramp[0] },
        uRampMid: { value: ramp[1] },
        uRampWarm: { value: ramp[2] },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
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
  }

  /** @param {number} t 0 = source, 1 = target */
  setT(t) { this.material.uniforms.uT.value = t; }
  setTime(s) { this.material.uniforms.uTime.value = s; }
  setPixelRatio(r) { this.material.uniforms.uPixelRatio.value = r; }
}

const VERT = /* glsl */ `
  uniform float uT;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute vec2 aSource;
  attribute vec2 aTarget;
  attribute float aSourceDensity;
  attribute float aTargetDensity;
  attribute float aSeed;

  varying float vDensity;
  varying float vTwinkle;

  // Smooth, slightly eased blend so the field "settles" rather than slides linearly.
  void main() {
    vec2 pos = mix(aSource, aTarget, uT);
    float density = mix(aSourceDensity, aTargetDensity, uT);
    vDensity = density;

    // Gentle per-point twinkle — denser points breathe a touch more.
    vTwinkle = 0.85 + 0.15 * sin(uTime * 1.6 + aSeed);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 0.0, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Dense cores read a touch larger; sparse field stays as fine star-dust.
    // Kept modest so cores resolve as packed stars, not one melted mass.
    float sizeBoost = 0.6 + 0.95 * density;
    gl_PointSize = uSize * sizeBoost * uPixelRatio * (300.0 / -mvPosition.z);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec3 uRampCool;
  uniform vec3 uRampMid;
  uniform vec3 uRampWarm;

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
    // Soft round sprite: bright core, smooth glow falloff to the edge.
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float core = smoothstep(1.0, 0.0, r);
    float glow = core * core;

    vec3 col = ramp(vDensity);
    // Per-point contribution is deliberately gentle: a single sparse star is a
    // faint blue ember; the warm bright cores emerge from many points STACKING
    // additively, not from any one point being blown out. Lets additive blending
    // build the glow honestly and keeps the density ramp legible end to end.
    float brightness = (0.14 + 0.92 * vDensity) * vTwinkle;
    float alpha = glow * brightness;

    gl_FragColor = vec4(col, alpha);
  }
`;
