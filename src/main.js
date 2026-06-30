import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { PointField } from './engine/PointField.js';
import { blob, ring } from './layouts/dummy.js';

const COUNT = 90000;

// ---- scene / renderer -------------------------------------------------------
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#05060a');

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);
camera.position.set(0, 0, 760);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

// NB: no static nebula sprite. The "warm nebula behind dense cores" EMERGES
// from bloom over the bright cores themselves — so it follows the data (glows
// behind the blob's clusters, behind the ring's band) instead of floating in an
// empty centre. Density drives the glow; nothing is painted where there's no data.

// ---- the point field --------------------------------------------------------
const field = new PointField(COUNT, { size: 1.9 });
field.setPixelRatio(renderer.getPixelRatio());
const layoutA = blob(COUNT);
const layoutB = ring(COUNT);
field.setSource(layoutA);
field.setTarget(layoutB);
scene.add(field.points);

// ---- post: bloom for the glow ----------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.9,   // strength — the core-glow / nebula emerges here, behind dense points
  0.8,   // radius — wide, gassy halo
  0.0,   // threshold — even dim stars get a faint bloom
);
composer.addPass(bloom);

// ---- morph control ----------------------------------------------------------
// t glides 0<->1 with an eased tween; the GPU does the actual point movement.
let t = 0;          // current eased value sent to the shader
let from = 0, to = 0;
let morphStart = -1;
const MORPH_MS = 2600;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function toggleMorph() {
  from = t;
  to = to >= 0.5 ? 0 : 1; // head to whichever end we're not at
  morphStart = performance.now();
}
window.addEventListener('pointerdown', toggleMorph);
window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); toggleMorph(); } });

// Auto-breathe once on load so the morph is the first thing you see.
setTimeout(toggleMorph, 1400);

// Debug hook (dev only): jump straight to an endpoint or value for inspection.
window.__field = {
  set(v) { morphStart = -1; t = v; },     // 0=blob, 1=ring, 0.5=mid-morph
  morph: toggleMorph,
};

// ---- loop -------------------------------------------------------------------
const clock = new THREE.Clock();
const fpsEl = document.getElementById('fps');
let frames = 0, fpsT = 0;

function tick() {
  const now = performance.now();
  const time = clock.getElapsedTime();

  if (morphStart >= 0) {
    const p = Math.min((now - morphStart) / MORPH_MS, 1);
    t = from + (to - from) * easeInOut(p);
    if (p >= 1) morphStart = -1;
  }

  field.setT(t);
  field.setTime(time);
  // A slow drift gives the field life even at rest.
  field.points.rotation.z = Math.sin(time * 0.04) * 0.04;

  composer.render();

  // fps readout
  frames++; fpsT += clock.getDelta();
  if (fpsT >= 0.5) { fpsEl.textContent = Math.round(frames / fpsT) + ' fps · ' + COUNT.toLocaleString() + ' pts'; frames = 0; fpsT = 0; }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---- resize -----------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  field.setPixelRatio(renderer.getPixelRatio());
});
