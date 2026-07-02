import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointField } from './engine/PointField.js';
import { loadCapeTown, buildCrimeLayouts, terrainViewLayout, bandFor, pieFrameLayout } from './layouts/capeTown.js';

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
// zPeak = height of the tallest peak (1729 m) in projected units. TRUE 1:1 with the land:
// the projection is 150.7 m/unit, so 1729 m = 11.5 units. (Was 700 = a 61× stretch that read
// as an alien tractor-beam.) Dial with __viz.zpeak() — raise it for honest, gentle drama.
let terrainMode = false, zScaleCur = 0, tiltCur = 0, zPeak = 11.5, tiltAngle = -0.62;
let bandW = 0.4;                  // boundary-band ribbon width (map view)
let terrainDotSize = 2.5;         // structure dot px — small = a finer relief stipple
const GX = 432, GY = 378;         // FIXED terrain dot budget (163,296), independent of DEM resolution
let terrainTargetLayout = null;   // relief the pool currently targets (couples the band)
let terrainCurrent = null;        // CPU copy of the layout the pool currently shows (transition source)
let trProg = 1, trStart = 0, trDur = 950, trTo = null; // terrain transition progress → drives uT
let swarmDur = 2400, swarmStagger = 0.6;                // structure swarm: duration (ms) + flock cascade
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
// Swarm-transition easing, swappable via __viz.ease(). 'out' = quick launch, gentle arrival (no
// start-delay); 'linear' = constant speed; 'inout' = the current slow-fast-slow.
const EASES = {
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inout: easeInOut,
};
let swarmEase = EASES.linear;   // constant speed — no acceleration pull at either end
// Pie instrument (spike): 'P' morphs the field off the map into a robbery pie — data dots fill the
// wedges, structure dots swarm into the ring + spokes. Everything travels; nothing fades.
let pieBuilder = null, pieMode = false, pieMorphing = false, pieMorphStart = 0, lastPie = null, pieYears = null;
const PIE_LINE_SIZE = 1.3;                 // frame dots render thinner than the map's (px)
let PIE_MS = 2400;                          // map ⇄ pie morph duration (ms) — slower = more graceful
let PIE_R = 200;
let pieFrameDots = 200000, pieThin = 0.22; // condense (almost) ALL structure dots into thin tight lines — no mass fly-away

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
  pieBuilder = built.pieLayout;
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
  makeTerrainField();

  refreshHud();
  const flagEl = document.getElementById('flag');
  if (flagEl) flagEl.textContent = `◆ SAPS crime records via DataFirst (CC-BY) · ${yearLabels[0]}–${yearLabels.at(-1)}`;
  holdUntil = performance.now() + 900;
  requestAnimationFrame(tick);
}

// TOOL SWARM — ONE pool of dots that is BOTH the overhead map (band) and the terrain relief.
// The relief is a single STATIC landform over the whole box (every dot on land, no ocean waste);
// zooming just magnifies it — no re-swarming on zoom.
function terrainRelief() {
  const { w: W, h: H } = capeData.meta.box;
  return terrainViewLayout(capeData, { cx: 0, cy: 0, hw: W / 2, hh: H / 2 }, GX, GY);
}

function makeTerrainField() {
  if (terrainField) { fieldGroup.remove(terrainField.points); terrainField.points.geometry.dispose(); terrainField.material.dispose(); }
  terrainTargetLayout = terrainRelief();
  terrainCurrent = bandFor(capeData, terrainTargetLayout, { band: bandW }); // start on the map (band)
  terrainField = new PointField(GX * GY, { glow: false, size: terrainDotSize, matte: '#6fe0a0' });
  terrainField.setSource(terrainCurrent);
  terrainField.setTarget(terrainCurrent);
  terrainField.setPixelRatio(renderer.getPixelRatio());
  terrainField.setDrift(0.0);
  terrainField.setZScale(zScaleCur);
  terrainField.setT(1);
  trProg = 1;
  fieldGroup.add(terrainField.points);
}

// Start a staggered swarm from whatever's shown (terrainCurrent) to a new layout.
function startTransition(toLayout, dur = swarmDur, stagger = swarmStagger) {
  if (!terrainField) return;
  terrainField.setSource(terrainCurrent);
  terrainField.setTarget(toLayout);
  terrainField.setStagger(stagger);
  trTo = toLayout; trStart = performance.now(); trDur = dur; trProg = 0;
}

// Toggle map ⇄ terrain (the `T` key): band ⇄ the static relief. Both fields' dots swarm; ocean parked.
function toggleTerrain() {
  if (pieMode) {
    // Leaving the pie for the map/terrain: the DATA must swarm back too (not stranded in the pie).
    pieMode = false;
    field.setSource({ positions: lastPie.positions, density: lastPie.density });
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    if (terrainField) terrainField.setSize(terrainDotSize);   // restore full dot size for band/relief
    refreshHud();
  }
  terrainMode = !terrainMode;
  if (terrainMode) {
    terrainTargetLayout = terrainRelief();
    startTransition(terrainTargetLayout);          // band → relief (rises via the zScale ease)
  } else {
    startTransition(bandFor(capeData, terrainCurrent, { band: bandW })); // relief → band
  }
}

// ---- year-scrub control -----------------------------------------------------
function setYearPair(i) {
  yi = (i + years.length) % years.length;
  const next = (yi + 1) % years.length;
  if (pieMode && pieYears) {                       // scrub the PIE through the years — frame holds, wedges re-fill
    lastPie = pieYears[yi];
    field.setSource({ positions: pieYears[yi].positions, density: pieYears[yi].density });
    field.setTarget({ positions: pieYears[next].positions, density: pieYears[next].density });
  } else {
    field.setSource(layouts[yi]);
    field.setTarget(layouts[next]);
  }
  t = 0;
  refreshHud();
}
function stepYear(dir) {
  playing = false;
  if (pieMode && pieYears) {                       // step the PIE year with an ANIMATED morph — dots
    yi = (yi + dir + years.length) % years.length; // fly out / re-enter as that year's count changes
    field.setSource({ positions: lastPie.positions, density: lastPie.density });
    lastPie = pieYears[yi];
    field.setTarget({ positions: pieYears[yi].positions, density: pieYears[yi].density });
    field.setStagger(0.6);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
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
  if (pieMode) {
    // Flip the PIE to another crime: rebuild its per-year pies and morph. Volume is honest — murder
    // is ~8× rarer, so most dots fly OUT (the pie empties toward its sparse murder pattern).
    crimeType = next;
    layouts = layoutsByType[crimeType];
    pieYears = years.map((_, k) => pieBuilder(crimeType, k, { cx: 0, cy: 0, R: PIE_R }));
    field.setSource({ positions: lastPie.positions, density: lastPie.density });
    lastPie = pieYears[yi];
    field.setTarget({ positions: pieYears[yi].positions, density: pieYears[yi].density });
    field.setStagger(0.6);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
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
// Spike: morph off the map into a robbery pie and back. Data dots swarm into the wedges, structure
// dots swarm into the ring + spokes — conserved, staggered, no fades.
function togglePie() {
  if (!pieBuilder || !field) return;
  pieMode = !pieMode;
  playing = false;
  if (pieMode) {
    pieYears = years.map((_, i) => pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R })); // one pie per year
    const pie = pieYears[yi];
    lastPie = pie;
    field.setSource(layoutsByType[crimeType][yi]);
    field.setTarget({ positions: pie.positions, density: pie.density });
    field.setStagger(0.6);
    terrainMode = false;                          // flatten (face-on pie, no relief tilt)
    if (terrainField) { terrainField.setSize(PIE_LINE_SIZE); startTransition(pieFrameLayout(GX * GY, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin })); }
  } else {
    field.setSource({ positions: lastPie.positions, density: lastPie.density });
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    if (terrainField) { terrainField.setSize(terrainDotSize); startTransition(bandFor(capeData, terrainTargetLayout, { band: bandW })); } // back to the map band, full dot size
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// Jump straight to the 2D map from anywhere — data + structure swarm home (the `M` key).
function goToMap() {
  if (!pieMode && !terrainMode) return;            // already on the map
  if (pieMode) {                                   // pie → map: data swarms back
    pieMode = false;
    field.setSource({ positions: lastPie.positions, density: lastPie.density });
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    if (terrainField) terrainField.setSize(terrainDotSize);
    refreshHud();
  }
  terrainMode = false;                             // flatten the relief; structure → the map band
  if (terrainField) startTransition(bandFor(capeData, terrainTargetLayout, { band: bandW }));
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); playing = !playing; if (playing) { holdUntil = performance.now(); if (pieMode) setYearPair(yi); } }
  else if (e.code === 'KeyP') { e.preventDefault(); togglePie(); }
  else if (e.code === 'KeyM') { e.preventDefault(); goToMap(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); stepYear(1); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); stepYear(-1); }
  else if (e.code === 'ArrowUp') { e.preventDefault(); flipCrime(1); }
  else if (e.code === 'ArrowDown') { e.preventDefault(); flipCrime(-1); }
  else if (e.code === 'KeyT') { e.preventDefault(); toggleTerrain(); }
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
  band: (w) => { bandW = w; if (terrainField && terrainTargetLayout) terrainField.setSource(bandFor(capeData, terrainTargetLayout, { band: w })); }, // map ribbon width
  terrainDots: (px) => { terrainDotSize = px; if (terrainField) terrainField.setSize(px); }, // structure dot size (finer stipple)
  pieR: (r) => {                                                             // live-tune the pie radius (denser = brighter data)
    if (r != null) PIE_R = r;
    if (pieMode && pieBuilder) {
      const pie = pieBuilder(crimeType, yi, { cx: 0, cy: 0, R: PIE_R }); lastPie = pie;
      field.setSource({ positions: pie.positions, density: pie.density }); field.setTarget({ positions: pie.positions, density: pie.density }); field.setT(1);
      if (terrainField) { const f = pieFrameLayout(GX * GY, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin }); terrainField.setSource(f); terrainField.setTarget(f); terrainField.setT(1); trProg = 1; }
    }
    return PIE_R;
  },
  pieFrame: (dots, thin) => { if (dots != null) pieFrameDots = dots; if (thin != null) pieThin = thin; if (window.__viz) window.__viz.pieR(); return { frameDots: pieFrameDots, thin: pieThin }; }, // thin/tight frame
  view: (x = 0, y = 0, dist = 200) => {                                       // debug: fly to a map-local point + zoom
    const world = fieldGroup.localToWorld(new THREE.Vector3(x, y, 0));
    const dir = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(world);
    camera.position.copy(world).addScaledVector(dir, dist);
    controls.update();
  },
  swarm: (stagger, dur) => { if (stagger != null) swarmStagger = stagger; if (dur != null) swarmDur = dur; return { stagger: swarmStagger, dur: swarmDur }; }, // tune the structure flock
  speed: (ms) => { if (ms != null) { PIE_MS = ms; swarmDur = ms; } return { pie: PIE_MS, swarm: swarmDur }; }, // slow/quicken BOTH transition speeds at once
  ease: (name) => { if (name && EASES[name]) swarmEase = EASES[name]; return { current: Object.keys(EASES).find((k) => EASES[k] === swarmEase), options: Object.keys(EASES) }; }, // swap the transition curve
  station: (name) => {                                                        // debug: find a station's map-local xy
    const s = (capeData.stations || []).find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
    return s ? { name: s.name, x: s.x, y: s.y } : 'not found';
  },
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
    terrainMode = on;
    zScaleCur = on ? zPeak : 0; tiltCur = on ? tiltAngle : 0;
    fieldGroup.rotation.x = tiltCur;                          // apply directly (don't wait for a frame)
    if (field) field.setZScale(zScaleCur);
    if (!terrainField) return;
    terrainTargetLayout = terrainRelief();
    terrainCurrent = on ? terrainTargetLayout : bandFor(capeData, terrainTargetLayout, { band: bandW });
    terrainField.setSource(terrainCurrent); terrainField.setTarget(terrainCurrent);
    terrainField.setZScale(zScaleCur); terrainField.setT(1); trProg = 1;
  },
  matte: (hex) => {                                          // live-tune the structure colour
    if (terrainField) terrainField.material.uniforms.uMatte.value.set(hex);
  },
  hideData: (hide = true) => { if (field) field.points.visible = !hide; }, // judge terrain alone
  tdbg: () => JSON.stringify({                                // debug: inspect live terrain state
    terrainMode, pieMode, trProg: +trProg.toFixed(2),
    dist: +camera.position.distanceTo(controls.target).toFixed(0),
    zScaleCur: +zScaleCur.toFixed(0), rotX: +fieldGroup.rotation.x.toFixed(2),
    terr_uT: +terrainField.material.uniforms.uT.value.toFixed(2),
  }),
};

// ---- loop -------------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0, fpsWall = -1; // fps measured off performance.now() (the `now` below)

function tick() {
  const now = performance.now();
  const time = clock.getElapsedTime();

  if (pieMorphing) {
    // Morphing the field between the map and the pie (both fields swarm; nothing fades).
    const p = Math.min((now - pieMorphStart) / PIE_MS, 1);
    t = swarmEase(p);
    if (p >= 1) pieMorphing = false;
  } else if (flipping) {
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
    if (trProg < 1) {                                              // advance the current swarm transition
      trProg = Math.min((now - trStart) / trDur, 1);
      terrainField.setT(swarmEase(trProg));
      if (trProg >= 1 && trTo) terrainCurrent = trTo;              // it's now the resting arrangement
    }
    terrainField.setZScale(zScaleCur); terrainField.setTime(time);
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
