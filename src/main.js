import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointField } from './engine/PointField.js';
import { loadCapeTown, buildCrimeLayouts, terrainLayout, structureMapSource } from './layouts/capeTown.js';

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
let field = null;          // DATA swarm (glowing crime)
let terrainField = null;   // TOOL swarm (one pool: map boundaries ⇄ terrain relief)
let terrainMode = false, zScaleCur = 0, tiltCur = 0, zPeak = 700, tiltAngle = -0.62, terrainT = 0;
let years = [], yearLabels = [], layouts = [];
let crimeTypes = [], crimeLabels = {}, crimeType = '', layoutsByType = {}, totalsByType = {}, capeData = null;
let yi = 0;                // current year index (source of the morph)
let t = 0;                 // 0 = years[yi], 1 = years[yi+1]
let playing = true;
let morphStart = -1;
const YEAR_MS = 2200;      // time to cross one year
const HOLD_MS = 450;       // pause on each year
let holdUntil = 0;
// Crime-flip morph (orthogonal to the year-scrub): ↑/↓ cross between crimes at the
// current year, then the scrub resumes on the crime you land on.
let flipping = false, flipStart = 0, flipTo = '';
const FLIP_MS = 1100;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const yearEl = document.getElementById('year');
const fpsEl = document.getElementById('fps');
const crimeEl = document.getElementById('crime');
const countEl = document.getElementById('count');

// ---- boot -------------------------------------------------------------------
init();
async function init() {
  const data = await loadCapeTown();
  capeData = data;
  years = data.meta.years;
  yearLabels = data.meta.yearLabels || years;
  crimeTypes = (data.meta.crimeTypes || [{ key: 'robbery', label: 'robbery' }]).map((c) => c.key);
  crimeLabels = Object.fromEntries((data.meta.crimeTypes || []).map((c) => [c.key, c.label]));
  crimeType = crimeTypes[0];
  const built = buildCrimeLayouts(data, { types: crimeTypes, mode: 'raw' });
  layoutsByType = built.layouts;
  totalsByType = built.totals;
  layouts = layoutsByType[crimeType];

  // DATA — glowing crime field; one fixed buffer, morphed across years.
  field = new PointField(built.count, { glow: true, size: 1.9 });
  field.setPixelRatio(renderer.getPixelRatio());
  field.setDrift(0.5);       // small stray — dots stay on their spot, don't wander off
  field.setDriftSpeed(2.0);  // livelier orbit — the movement is FELT without more travel
  field.setSource(layouts[0]);
  field.setTarget(layouts[1]);
  field.points.layers.enable(BLOOM_LAYER);
  fieldGroup.add(field.points);

  // TOOL SWARM — ONE pool of dots. Map view: some sit on the precinct boundaries (that IS the
  // overhead map), the rest park off-screen. On 'T' every dot morphs to its OWN landscape spot —
  // boundary dots RESTRUCTURE, parked dots SWARM IN, ocean stays culled. Only the delta flies.
  const terr = terrainLayout(data);
  terrainField = new PointField(terr.positions.length / 2, { glow: false, size: 3.4, matte: '#6fe0a0' });
  terrainField.setSource(structureMapSource(data, terr)); // overhead map: boundaries + parked
  terrainField.setTarget(terr);                            // the landscape (each dot to its own spot)
  terrainField.setPixelRatio(renderer.getPixelRatio());
  terrainField.setDrift(0.0);
  terrainField.setZScale(0);
  terrainField.setT(0);            // t=0 → map arrangement; t=1 → assembled relief
  fieldGroup.add(terrainField.points);

  refreshHud();
  const flagEl = document.getElementById('flag');
  if (flagEl) flagEl.textContent = `◆ SAPS crime records via DataFirst (CC-BY) · ${yearLabels[0]}–${yearLabels.at(-1)}`;
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
  refreshHud();
}
function stepYear(dir) {
  playing = false;
  setYearPair(yi + dir);
  t = 0; morphStart = -1;
}

// Flip to another crime (dir cycles the list): morph between crimes at the current
// year, then resume the scrub on whichever crime you land on. Volume-honest — the
// rarer crime leaves most points parked, so the cloud visibly contracts to embers.
function flipCrime(dir) {
  if (flipping || crimeTypes.length < 2) return;
  const i = crimeTypes.indexOf(crimeType);
  const next = crimeTypes[(i + dir + crimeTypes.length) % crimeTypes.length];
  if (next === crimeType) return;
  flipTo = next;
  flipping = true;
  flipStart = performance.now();
  morphStart = -1;
  field.setSource(layoutsByType[crimeType][yi]);
  field.setTarget(layoutsByType[next][yi]);
  t = 0;
  refreshHud(next); // name the incoming crime as it morphs in
}

// HUD text for a crime + the current year (defaults to the live crime).
function refreshHud(type = crimeType) {
  if (yearEl) yearEl.textContent = yearLabels[yi];
  if (crimeEl) crimeEl.textContent = crimeLabels[type] || type;
  if (countEl) countEl.textContent = ((totalsByType[type] && totalsByType[type][yi]) || 0).toLocaleString();
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); playing = !playing; if (playing) holdUntil = performance.now(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); stepYear(1); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); stepYear(-1); }
  else if (e.code === 'ArrowUp') { e.preventDefault(); flipCrime(1); }
  else if (e.code === 'ArrowDown') { e.preventDefault(); flipCrime(-1); }
  else if (e.code === 'KeyT') { e.preventDefault(); terrainMode = !terrainMode; }
});

// Debug hook.
window.__viz = {
  year: (n) => { const i = years.indexOf(n); if (i >= 0) { playing = false; setYearPair(i); t = 0; } },
  t: (v) => { playing = false; t = v; },
  flip: () => flipCrime(1),                                   // cycle crime (robbery↔murder)
  flipAt: (v) => {                                            // debug: hold a crime-flip at t=v
    const i = crimeTypes.indexOf(crimeType);
    const next = crimeTypes[(i + 1) % crimeTypes.length];
    playing = false; flipping = false;
    field.setSource(layoutsByType[crimeType][yi]); field.setTarget(layoutsByType[next][yi]); field.setT(v); t = v;
  },
  drift: (px) => field && field.setDrift(px),                 // data swarm — how FAR it strays
  driftSpeed: (m) => field && field.setDriftSpeed(m),         // data swarm — how FAST (felt-ness)
  stagger: (w) => field && field.setStagger(w),              // swarm cascade (0=together … ~0.6)
  maxSize: (px) => { if (field) field.setMaxSize(px); if (terrainField) terrainField.setMaxSize(px); }, // cap dot px on zoom
  shimmer: (a) => { if (terrainField) terrainField.setShimmer(a); },         // structure breath amplitude (0=still)
  shimmerSpeed: (s) => { if (terrainField) terrainField.setShimmerSpeed(s); },
  band: (w) => { if (terrainField && capeData) terrainField.setSource(structureMapSource(capeData, terrainLayout(capeData), { band: w })); }, // ribbon width
  roost: (d) => {                                            // how far off-screen dots fly & wait
    if (!capeData) return;
    const b = buildCrimeLayouts(capeData, { types: crimeTypes, mode: 'raw', roost: d });
    layoutsByType = b.layouts; totalsByType = b.totals; layouts = layoutsByType[crimeType];
    setYearPair(yi);
  },
  terrain: () => { terrainMode = !terrainMode; },            // toggle the elevation relief
  zpeak: (v) => { zPeak = v; },                              // relief height (layout units)
  tilt: (r) => { tiltAngle = r; },                           // terrain-mode view tilt (radians)
  terrainNow: (on = true) => {                               // debug: jump to/from terrain (no ease)
    terrainMode = on; zScaleCur = on ? zPeak : 0; tiltCur = on ? tiltAngle : 0; terrainT = on ? 1 : 0;
    if (terrainField) { terrainField.setZScale(zScaleCur); terrainField.setT(terrainT); }
    if (field) field.setZScale(zScaleCur);
    fieldGroup.rotation.x = tiltCur;                          // apply directly (don't wait for a frame)
  },
  terrainAt: (v) => {                                        // debug: hold the fly-in at t=v (0..1)
    terrainMode = true; terrainT = v; zScaleCur = zPeak * v; tiltCur = tiltAngle * v;
    if (terrainField) { terrainField.setT(v); terrainField.setZScale(zScaleCur); }
    if (field) field.setZScale(zScaleCur);
    fieldGroup.rotation.x = tiltCur;
  },
  matte: (hex) => {                                          // live-tune the structure colour
    if (terrainField) terrainField.material.uniforms.uMatte.value.set(hex);
  },
  hideData: (hide = true) => { if (field) field.points.visible = !hide; }, // judge terrain alone
  tdbg: () => JSON.stringify({                                // debug: inspect live terrain state
    terrainMode, terrainT: +terrainT.toFixed(2),
    zScaleCur: +zScaleCur.toFixed(0), rotX: +fieldGroup.rotation.x.toFixed(2),
    terr_uT: +terrainField.material.uniforms.uT.value.toFixed(2),
    terr_uZScale: +terrainField.material.uniforms.uZScale.value.toFixed(0),
    crime_uZScale: +field.material.uniforms.uZScale.value.toFixed(0),
  }),
};

// ---- loop -------------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0, fpsWall = -1; // fps measured off performance.now() (the `now` below)

function tick() {
  const now = performance.now();
  const time = clock.getElapsedTime();

  if (flipping) {
    // Crossing between crimes at the current year; year-advance is suspended.
    const p = Math.min((now - flipStart) / FLIP_MS, 1);
    t = easeInOut(p);
    if (p >= 1) {
      flipping = false;
      crimeType = flipTo;
      layouts = layoutsByType[crimeType];
      setYearPair(yi);               // re-anchor the scrub on the crime we landed on
      morphStart = -1;
      holdUntil = now + HOLD_MS;
    }
  } else if (playing) {
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
  if (terrainField) {
    zScaleCur += ((terrainMode ? zPeak : 0) - zScaleCur) * 0.06;   // ease the land up/down
    tiltCur += ((terrainMode ? tiltAngle : 0) - tiltCur) * 0.06;   // ease the view tilt
    terrainT += ((terrainMode ? 1 : 0) - terrainT) * 0.05;         // the tool swarm restructures / flies in
    terrainField.setZScale(zScaleCur); terrainField.setT(terrainT); terrainField.setTime(time);
    field.setZScale(zScaleCur);       // crime CLIMBS the relief with the land beneath it
  }
  fieldGroup.rotation.x = tiltCur;
  fieldGroup.rotation.z = Math.sin(time * 0.03) * 0.02 * (1 - Math.min(1, Math.abs(tiltCur))); // calm the wobble when tilted
  controls.update();

  render();

  // FPS off the wall clock (getElapsedTime already consumed the THREE.Clock delta).
  frames++;
  if (fpsWall < 0) fpsWall = now;
  else if (now - fpsWall >= 500) {
    fpsEl.textContent = Math.round((frames * 1000) / (now - fpsWall)) + ' fps · ' + field.count.toLocaleString() + ' pts';
    frames = 0; fpsWall = now;
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
  if (terrainField) terrainField.setPixelRatio(renderer.getPixelRatio());
});
