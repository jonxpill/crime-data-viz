import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointField } from './engine/PointField.js';
import { loadCapeTown, buildYearLayouts, structureLayout } from './layouts/capeTown.js';

const BLOOM_LAYER = 1;

// ---- scene / renderer -------------------------------------------------------
const app = document.getElementById('app');
const DARK = new THREE.Color('#05060a');
const scene = new THREE.Scene();
scene.background = DARK;

const FOCUS_Y = 35; // the field is nudged up so the taller False-Bay extent centres
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);
camera.position.set(0, FOCUS_Y, 760);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

// Zoom + pan (no 3D tumble — it's a flat map). Scroll/pinch zooms, drag pans.
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.screenSpacePanning = true;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 70;    // how far you can fly in
controls.maxDistance = 1500;  // how far you can pull back
controls.zoomSpeed = 0.9;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
controls.target.set(0, FOCUS_Y, 0);
controls.update();

// Data + structure share one frame so geography and crime stay in register.
const fieldGroup = new THREE.Group();
fieldGroup.position.y = FOCUS_Y;
scene.add(fieldGroup);

// ---- selective bloom: ONLY the data field glows -----------------------------
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.58, 0.72, 0.0,
);
const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(new RenderPass(scene, camera));
bloomComposer.addPass(bloom);

const mixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv;
      void main(){ gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }`,
  }),
  'baseTexture',
);
mixPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(scene, camera));
finalComposer.addPass(mixPass);
finalComposer.addPass(new OutputPass());

function render() {
  scene.background = null;
  camera.layers.set(BLOOM_LAYER);
  bloomComposer.render();
  scene.background = DARK;
  camera.layers.set(0);
  finalComposer.render();
}

// ---- state ------------------------------------------------------------------
let field = null;          // data PointField (built once data loads)
let structure = null;      // structure PointField
let years = [], yearLabels = [], layouts = [];
let yi = 0;                // current year index (source of the morph)
let t = 0;                 // 0 = years[yi], 1 = years[yi+1]
let playing = true;
let morphStart = -1;
const YEAR_MS = 2200;      // time to cross one year
const HOLD_MS = 450;       // pause on each year
let holdUntil = 0;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const yearEl = document.getElementById('year');
const fpsEl = document.getElementById('fps');

// ---- boot -------------------------------------------------------------------
init();
async function init() {
  const data = await loadCapeTown();
  years = data.meta.years;
  yearLabels = data.meta.yearLabels || years;
  const built = buildYearLayouts(data, { mode: 'raw' });
  layouts = built.layouts;

  // STRUCTURE — real precinct boundaries, grey/matte, off the bloom layer.
  const struct = structureLayout(data);
  structure = new PointField(struct.positions.length / 2, { glow: false, size: 2.0, matte: '#56647e' });
  structure.setSource(struct);
  structure.setTarget(struct);
  structure.setPixelRatio(renderer.getPixelRatio());
  structure.setDrift(0.1); // the faintest whisper — far quieter than the data
  fieldGroup.add(structure.points);

  // DATA — glowing crime field; one fixed buffer, morphed across years.
  field = new PointField(built.count, { glow: true, size: 1.9 });
  field.setPixelRatio(renderer.getPixelRatio());
  field.setDrift(0.4); // the at-rest "living swarm" shimmer
  field.setSource(layouts[0]);
  field.setTarget(layouts[1]);
  field.points.layers.enable(BLOOM_LAYER);
  fieldGroup.add(field.points);

  if (yearEl) yearEl.textContent = yearLabels[0];
  holdUntil = performance.now() + 900;
  requestAnimationFrame(tick);
}

// ---- year-scrub control -----------------------------------------------------
function setYearPair(i) {
  yi = (i + years.length) % years.length;
  const next = (yi + 1) % years.length;
  field.setSource(layouts[yi]);
  field.setTarget(layouts[next]);
  t = 0;
  if (yearEl) yearEl.textContent = yearLabels[yi];
}
function stepYear(dir) {
  playing = false;
  setYearPair(yi + dir);
  t = 0; morphStart = -1;
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); playing = !playing; if (playing) holdUntil = performance.now(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); stepYear(1); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); stepYear(-1); }
});

// Debug hook.
window.__viz = {
  year: (n) => { const i = years.indexOf(n); if (i >= 0) { playing = false; setYearPair(i); t = 0; } },
  t: (v) => { playing = false; t = v; },
  drift: (px) => field && field.setDrift(px), // live-tune the at-rest shimmer (px)
};

// ---- loop -------------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0, fpsT = 0;

function tick() {
  const now = performance.now();
  const time = clock.getElapsedTime();

  if (playing) {
    if (morphStart < 0 && now >= holdUntil) morphStart = now; // begin a year crossing
    if (morphStart >= 0) {
      const p = Math.min((now - morphStart) / YEAR_MS, 1);
      t = easeInOut(p);
      if (p >= 1) {
        // Land on the next year; show it; hold; then advance the pair.
        morphStart = -1;
        holdUntil = now + HOLD_MS;
        setYearPair(yi + 1);
      }
    }
  }

  field.setT(t);
  field.setTime(time);
  structure.setTime(time);
  fieldGroup.rotation.z = Math.sin(time * 0.03) * 0.02;
  controls.update();

  render();

  frames++; fpsT += clock.getDelta();
  if (fpsT >= 0.5) {
    fpsEl.textContent = Math.round(frames / fpsT) + ' fps · ' + field.count.toLocaleString() + ' pts';
    frames = 0; fpsT = 0;
  }
  requestAnimationFrame(tick);
}

// ---- resize -----------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  bloomComposer.setSize(window.innerWidth, window.innerHeight);
  finalComposer.setSize(window.innerWidth, window.innerHeight);
  if (field) field.setPixelRatio(renderer.getPixelRatio());
  if (structure) structure.setPixelRatio(renderer.getPixelRatio());
});
