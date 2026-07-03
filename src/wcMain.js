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
 * SPIKE: Western Cape overview → drill into Cape Town, in the PIE-TRANSITION grammar (camera dead
 * still, the whole feel comes from the dots): the province BREAKS AWAY (dots fly outward + fade) while
 * Cape Town BLOOMS — its detail grows from the exact spot it occupies in the province map (via an
 * affine alignment) out to full size, which reads as zooming toward you. M / click-empty reverses.
 * Generalises: any region blooms from its own place.
 */
const BLOOM_LAYER = 1;
const app = document.getElementById('app');
const DARK = new THREE.Color('#05060a');
const scene = new THREE.Scene(); scene.background = DARK;
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 8000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false; controls.screenSpacePanning = true; controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 80; controls.maxDistance = 2600; controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
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
let wcData, ctData, wcStations = [];
let ctScale = 0.16; const ctPos = new THREE.Vector3();
let view = 'wc', transitioning = false, pendingView = 'wc', tStart = 0;
const DUR = 2200;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const rest = new Map();                 // field → { wc: layout, ct: layout }
const hintEl = document.getElementById('hint');
const _v = new THREE.Vector3();

function distFor(w, h) { const vf = camera.fov * Math.PI / 180, dH = (h / 2) / Math.tan(vf / 2), dW = (w / 2) / (Math.tan(vf / 2) * camera.aspect); return Math.max(dH, dW) * 1.08; }
function outline(structure) { const n = structure.length / 2; return { positions: Float32Array.from(structure), density: new Float32Array(n).fill(0.4) }; }
// affine copy: pos*scale + (ox,oy); optionally kill density (→ invisible resting endpoint)
function xform(base, scale, ox, oy, kill) {
  const n = base.density.length, positions = new Float32Array(n * 2), density = new Float32Array(n);
  for (let i = 0; i < n; i++) { positions[i * 2] = base.positions[i * 2] * scale + ox; positions[i * 2 + 1] = base.positions[i * 2 + 1] * scale + oy; density[i] = kill ? 0 : base.density[i]; }
  return { positions, density };
}
// break away: push each dot radially outward from centre, fade to nothing (the pie "fly out" move)
const away = (base) => xform(base, 2.5, 0, 0, true);

init();
async function init() {
  const [wc, ct] = await Promise.all([loadCapeTown('data/westerncape.json'), loadCapeTown('data/capetown.json')]);
  wcStations = wc.stations;
  const yWC = wc.meta.years.length - 1, yCT = ct.meta.years.length - 1;
  // Province data pool EXCLUDES Cape Town — its crime is carried (conserved) by the ctData field, so it
  // blooms open instead of flying away. Only the rural towns (no detail to zoom into) honestly break away.
  const ruralWc = { ...wc, stations: wc.stations.filter((s) => (s.dc || '').toLowerCase() !== 'city of cape town') };
  const bWC = buildCrimeLayouts(ruralWc, { types: wc.meta.crimeTypes.map((c) => c.key), mode: 'raw' });
  const bCT = buildCrimeLayouts(ct, { types: ct.meta.crimeTypes.map((c) => c.key), mode: 'raw' });

  // ALIGN: uniform scale+offset mapping CT-detail coords → WC-map coords (both Mercator of the same
  // lng/lat → near-exact). So Cape Town's detail can bloom from EXACTLY where it sits in the province.
  const wcByName = new Map(wc.stations.map((s) => [s.name, s]));
  const pairs = ct.stations.map((s) => ({ ct: s, wc: wcByName.get(s.name) })).filter((p) => p.wc);
  let cmx = 0, cmy = 0, wmx = 0, wmy = 0; for (const p of pairs) { cmx += p.ct.x; cmy += p.ct.y; wmx += p.wc.x; wmy += p.wc.y; }
  const n = pairs.length; cmx /= n; cmy /= n; wmx /= n; wmy /= n;
  let num = 0, den = 0; for (const p of pairs) { const cx = p.ct.x - cmx, cy = p.ct.y - cmy; num += cx * (p.wc.x - wmx) + cy * (p.wc.y - wmy); den += cx * cx + cy * cy; }
  ctScale = num / den; ctPos.set(wmx - ctScale * cmx, wmy - ctScale * cmy, 0);

  // DATA (glow). Rural province crime breaks away (no detail to zoom into); Cape Town's crime CONSERVES —
  // it's the aligned cluster you see in the overview (real density, not a hidden placeholder) and it blooms
  // OPEN into the full detail. Same 1-dot-per-crime dots either way, so none are lost on the way in.
  wcData = mkField(bWC.count, true, 1.7); ctData = mkField(bCT.count, true, 1.9);
  const wcF = bWC.layouts.robbery[yWC], ctF = bCT.layouts.robbery[yCT];
  rest.set(wcData, { wc: wcF, ct: away(wcF) });
  rest.set(ctData, { wc: xform(ctF, ctScale, ctPos.x, ctPos.y, false), ct: ctF });
  // STRUCTURE — ONE conserved pool (the pie-frame principle): the province outline RECONFIGURES into
  // Cape Town's outline, so no grey dots are lost — the frame reforms, it never vanishes. Pool sized to
  // the larger (province) outline; the CT endpoint cycles the pool over Cape Town's fewer outline points
  // with a hair of jitter, so the detail frame is a dense line, not a sparse one.
  const structN = wc.structure.length / 2, ctN = ct.structure.length / 2;
  const structField = mkField(structN, false, 1.4);
  const wcStructL = { positions: Float32Array.from(wc.structure), density: new Float32Array(structN).fill(0.4) };
  const ctSP = new Float32Array(structN * 2);
  for (let i = 0; i < structN; i++) { const j = (i % ctN) * 2; ctSP[i * 2] = ct.structure[j] + (Math.random() - 0.5) * 1.4; ctSP[i * 2 + 1] = ct.structure[j + 1] + (Math.random() - 0.5) * 1.4; }
  rest.set(structField, { wc: wcStructL, ct: { positions: ctSP, density: new Float32Array(structN).fill(0.4) } });

  for (const [f, m] of rest) { f.setSource(m.wc); f.setTarget(m.wc); f.setStagger(0.62); f.setT(1); }
  camera.position.set(0, 0, distFor(Math.max(wc.meta.box.w, 760), Math.max(wc.meta.box.h, 820)));
  controls.target.set(0, 0, 0); controls.update();
  requestAnimationFrame(tick);
}

function mkField(count, glow, size) {
  const f = new PointField(count, { glow, size, matte: '#6fe0a0' });
  f.setPixelRatio(renderer.getPixelRatio()); f.setDrift(glow ? 0.5 : 0); f.setDriftSpeed(2); f.setMaxSize(7);
  if (glow) f.points.layers.enable(BLOOM_LAYER);
  fieldGroup.add(f.points); return f;
}

function drill(toView) {
  if (transitioning || toView === view) return;
  for (const [f, m] of rest) { f.setSource(m[view]); f.setTarget(m[toView]); }
  transitioning = true; pendingView = toView; tStart = performance.now();
  if (hintEl) hintEl.textContent = toView === 'ct' ? 'blooming into Cape Town…' : 'back to the Western Cape…';
}

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
  if (view === 'wc') { const { s, d } = nearestStation(e.clientX, e.clientY); if (s && d < 120 && (s.dc || '').toLowerCase() === 'city of cape town') drill('ct'); }
  else drill('wc');
});
addEventListener('keydown', (e) => { if (e.code === 'KeyM' || e.code === 'Escape') drill('wc'); });

const clock = new THREE.Clock();
function tick() {
  const now = performance.now(), time = clock.getElapsedTime();
  if (transitioning) { const p = Math.min((now - tStart) / DUR, 1); for (const f of rest.keys()) f.setT(ease(p)); if (p >= 1) { transitioning = false; view = pendingView; if (hintEl) hintEl.textContent = view === 'ct' ? 'Cape Town — click empty space or press M to break back out' : 'Western Cape — click the Cape Town cluster (bottom-left) to bloom in'; } }
  for (const f of rest.keys()) f.setTime(time);
  controls.update(); render();
  requestAnimationFrame(tick);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); bloomComposer.setSize(innerWidth, innerHeight); finalComposer.setSize(innerWidth, innerHeight); for (const f of rest.keys()) f.setPixelRatio(renderer.getPixelRatio()); });
