import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointField } from './engine/PointField.js';
import { loadCapeTown, buildCrimeLayouts } from './layouts/capeTown.js';

/**
 * SPIKE: Western Cape overview → drill into Cape Town. Two glowing DATA fields + two grey STRUCTURE
 * fields (WC + CT), each morphing formed⇄dispersed. Click the Cape Town cluster: the WC map swarms
 * OUT while the Cape Town detail (the exact capetown.json we already have) swarms IN. Press M / click
 * empty space to fly back out. The pattern generalises — any region could nest its own detail.
 */
const BLOOM_LAYER = 1;
const app = document.getElementById('app');
const DARK = new THREE.Color('#05060a');
const scene = new THREE.Scene(); scene.background = DARK;
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 6000);
camera.position.set(0, 0, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false; controls.screenSpacePanning = true; controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 120; controls.maxDistance = 2200; controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }; controls.update();
const fieldGroup = new THREE.Group(); scene.add(fieldGroup);

// selective bloom — only the glowing DATA layer blooms
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.72, 0.0);
const bloomComposer = new EffectComposer(renderer); bloomComposer.renderToScreen = false;
bloomComposer.addPass(new RenderPass(scene, camera)); bloomComposer.addPass(bloom);
const mixPass = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main(){ gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }',
}), 'baseTexture'); mixPass.needsSwap = true;
const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(scene, camera)); finalComposer.addPass(mixPass); finalComposer.addPass(new OutputPass());
function render() { scene.background = null; camera.layers.set(BLOOM_LAYER); bloomComposer.render(); scene.background = DARK; camera.layers.set(0); finalComposer.render(); }

// ---- state ----
let wcData, ctData, wcStruct, ctStruct;
let wcStations = [];                    // for click hit-testing (WC-map coords)
let view = 'wc', pendingView = 'wc', transitioning = false, t = 1, tStart = 0;
const DUR = 1900;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const rest = new Map();                 // field → { wc: layout, ct: layout }
const hintEl = document.getElementById('hint');

// deterministic radial dispersal (dots fly off-frame, density 0 → invisible at rest)
function disperse(count, r0) {
  const positions = new Float32Array(count * 2), density = new Float32Array(count);
  for (let i = 0; i < count; i++) { const a = (i * 2.399963229) % (Math.PI * 2), r = r0 + (i % 137) * 3; positions[i * 2] = Math.cos(a) * r; positions[i * 2 + 1] = Math.sin(a) * r; }
  return { positions, density };
}
// a flat grey STRUCTURE layout straight from the baked outline points
function outlineLayout(structure) {
  const n = structure.length / 2, positions = Float32Array.from(structure), density = new Float32Array(n).fill(0.4);
  return { positions, density, n };
}

init();
async function init() {
  const [wc, ct] = await Promise.all([loadCapeTown('data/westerncape.json'), loadCapeTown('data/capetown.json')]);
  wcStations = wc.stations;
  const yWC = wc.meta.years.length - 1, yCT = ct.meta.years.length - 1;   // show the most recent year
  const bWC = buildCrimeLayouts(wc, { types: wc.meta.crimeTypes.map((c) => c.key), mode: 'raw' });
  const bCT = buildCrimeLayouts(ct, { types: ct.meta.crimeTypes.map((c) => c.key), mode: 'raw' });

  // DATA fields (glow) — formed = the map; dispersed = flown off-frame
  wcData = mkField(bWC.count, true, 1.7); ctData = mkField(bCT.count, true, 1.9);
  const wcDataFormed = bWC.layouts.robbery[yWC], ctDataFormed = bCT.layouts.robbery[yCT];
  const wcDataDisp = disperse(bWC.count, 780), ctDataDisp = disperse(bCT.count, 680);
  rest.set(wcData, { wc: wcDataFormed, ct: wcDataDisp });
  rest.set(ctData, { wc: ctDataDisp, ct: ctDataFormed });

  // STRUCTURE fields (grey, no glow) — the precinct outlines
  const wcOutline = outlineLayout(wc.structure), ctOutline = outlineLayout(ct.structure);
  wcStruct = mkField(wcOutline.n, false, 1.3); ctStruct = mkField(ctOutline.n, false, 1.7);
  rest.set(wcStruct, { wc: wcOutline, ct: disperse(wcOutline.n, 820) });
  rest.set(ctStruct, { wc: disperse(ctOutline.n, 720), ct: ctOutline });

  for (const [f, m] of rest) { f.setSource(m.wc); f.setTarget(m.wc); f.setT(1); }   // rest on the WC overview
  frameBox(wc.meta.box);
  requestAnimationFrame(tick);
}

function mkField(count, glow, size) {
  const f = new PointField(count, { glow, size, matte: '#6fe0a0' });
  f.setPixelRatio(renderer.getPixelRatio()); f.setDrift(glow ? 0.5 : 0); f.setDriftSpeed(2); f.setStagger(0.6);
  if (glow) f.points.layers.enable(BLOOM_LAYER);
  fieldGroup.add(f.points); return f;
}
function frameBox(box) { camera.position.set(0, 0, Math.max(box.w / (2 * Math.tan((camera.fov * Math.PI / 180) / 2) * camera.aspect), box.h / (2 * Math.tan((camera.fov * Math.PI / 180) / 2))) * 1.08); controls.target.set(0, 0, 0); controls.update(); }

function drill(toView) {
  if (transitioning || toView === view) return;
  for (const [f, m] of rest) { f.setSource(m[view]); f.setTarget(m[toView]); }
  t = 0; transitioning = true; tStart = performance.now(); pendingView = toView;
  if (hintEl) hintEl.textContent = toView === 'ct' ? 'diving into Cape Town…' : 'back to the Western Cape…';
}

// click the Cape Town cluster → drill in; click empty space (or M) → back out
const _v = new THREE.Vector3();
function nearestStation(cx, cy) {
  const rect = renderer.domElement.getBoundingClientRect(); const mx = cx - rect.left, my = cy - rect.top;
  fieldGroup.updateWorldMatrix(true, false); let best = null, bestD = Infinity;
  for (const s of wcStations) { _v.set(s.x, s.y, 0); fieldGroup.localToWorld(_v); _v.project(camera); const sx = (_v.x * 0.5 + 0.5) * rect.width, sy = (-_v.y * 0.5 + 0.5) * rect.height; const d = Math.hypot(sx - mx, sy - my); if (d < bestD) { bestD = d; best = s; } }
  return { s: best, d: bestD };
}
let _downX = 0, _downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { _downX = e.clientX; _downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 6 || transitioning) return;
  if (view === 'wc') { const { s, d } = nearestStation(e.clientX, e.clientY); if (s && d < 90 && (s.dc || '').toLowerCase() === 'city of cape town') drill('ct'); }
  else drill('wc');
});
addEventListener('keydown', (e) => { if (e.code === 'KeyM' || e.code === 'Escape') drill('wc'); });

const clock = new THREE.Clock();
function tick() {
  const now = performance.now(), time = clock.getElapsedTime();
  if (transitioning) { const p = Math.min((now - tStart) / DUR, 1); t = ease(p); if (p >= 1) { transitioning = false; view = pendingView; if (hintEl) hintEl.textContent = view === 'ct' ? 'Cape Town — click empty space or press M to zoom back out' : 'Western Cape — click the Cape Town cluster (bottom-left) to dive in'; } }
  for (const f of rest.keys()) { f.setT(t); f.setTime(time); }
  controls.update(); render();
  requestAnimationFrame(tick);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); bloomComposer.setSize(innerWidth, innerHeight); finalComposer.setSize(innerWidth, innerHeight); for (const f of rest.keys()) f.setPixelRatio(renderer.getPixelRatio()); });
