import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointField } from './engine/PointField.js';
import { loadCapeTown, buildCrimeLayouts, pieFrameLayout, triPieFrameLayout } from './layouts/capeTown.js';

/**
 * wcExplore.js — STANDALONE Western Cape explorer. src/main.js ADAPTED for the whole province
 * (150 stations, 6 districts) instead of just Cape Town: same instrument toolkit (year-scrub,
 * crime-flip, pie, 3-pie compare, per-capita) MINUS terrain (no relief, no camera tilt — the WC
 * has no baked DEM here, and this app stays a flat, always-overhead map).
 *
 * REUSES the generic layout functions from capeTown.js unchanged — they're pure functions of
 * ANY region's data, not Cape-Town-specific. This file only holds the WC-specific driving logic:
 * which pool plays which role, how instruments wire to keys, camera framing, and the hover readout.
 *
 * The STRUCTURE pool here is simpler than main.js's terrainField: it has no relief target, so its
 * ONLY resting layout is the precinct outlines (the "map"); it still swarms into the pie/3-pie
 * frames exactly like main.js drives its own structure pool.
 */

const BLOOM_LAYER = 1;

// ---- scene / renderer -------------------------------------------------------
const app = document.getElementById('app');
const DARK = new THREE.Color('#05060a');
const scene = new THREE.Scene();
scene.background = DARK;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);
camera.position.set(0, 0, 760); // set precisely once the box is known (frameBox, in init)

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

// Zoom + pan (no 3D tumble — it's a flat map, and this app has no terrain to tilt into).
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.screenSpacePanning = true;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 70;    // how far you can fly in
controls.maxDistance = 2200;  // how far you can pull back (WC box is wider than Cape Town's)
controls.zoomSpeed = 0.9;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
controls.target.set(0, 0, 0); // centred at origin — no FOCUS_Y offset (no relief to nudge room for)
controls.update();

// Data + structure share one frame so geography and crime stay in register.
const fieldGroup = new THREE.Group();
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
let structField = null;    // STRUCTURE pool — ONE pool: precinct outlines (map) ⇄ pie/3-pie frames
let structCurrent = null;  // CPU copy of the layout the structure pool currently shows (transition source)
let structTargetLayout = null; // the map (outline) layout — the resting arrangement structure returns to
let trProg = 1, trStart = 0, trDur = 950, trTo = null; // structure transition progress
let swarmDur = 2400, swarmStagger = 0.6;                // structure swarm: duration (ms) + flock cascade
let years = [], yearLabels = [], layouts = [];
let crimeTypes = [], crimeLabels = {}, crimeType = '', layoutsByType = {}, totalsByType = {}, wcData = null;
// Raw ⇄ per-capita ('C'). Both modes share ONE pool (buildCrimeLayouts sizes to the max of both), so
// toggling is a morph, not a resize. Per-capita is built lazily on first toggle. builtByMode caches each.
let dataMode = 'raw', builtByMode = {};
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
const swarmEase = (x) => x; // constant speed — no acceleration pull at either end (matches main.js's default)
// Pie instrument: 'P' morphs the field off the map into a robbery pie — data dots fill the
// wedges, structure dots swarm into the ring + spokes. Everything travels; nothing fades.
let pieBuilder = null, pieMode = false, pieMorphing = false, pieMorphStart = 0, lastPie = null, pieYears = null;
const PIE_LINE_SIZE = 1.3;                 // frame dots render thinner than the map's (px)
let PIE_MS = 2400;                          // map ⇄ pie morph duration (ms) — slower = more graceful
let PIE_R = 200;
// 150 WC stations (vs Cape Town's 60) → 150 wedges in the pie. Denser than Cape Town's pie; the
// frame-dot budget stays the same (pieFrameDots/thin below) — may need re-tuning once seen (a wedge
// is ~2.4° per station vs ~6° for Cape Town's 60). Consider re-grouping by district in a later pass.
let pieFrameDots = 200000, pieThin = 0.22; // condense (almost) ALL structure dots into thin tight lines
// Three-pie compare ('3'): robbery · burglary · murder side by side, same year.
let triPieBuilder = null, resolvePieBuilder = null, triPieMode = false, triPieYears = null, lastTriPie = null;
let TRI_R = 128, TRI_GAP = 320;            // per-pie radius + centre-to-centre spacing (world units)
let hoverCrimeType = '';                    // which crime the hovered mark belongs to (per-pie in the 3-pie)
let structDotSize = 1.6;                    // structure dot px on the map (finer than Cape Town's terrain
                                             // stipple default since there's no relief to read tonally)

const yearEl = document.getElementById('year');
const fpsEl = document.getElementById('fps');
const crimeEl = document.getElementById('crime');
const countEl = document.getElementById('count');

// Build (once, cached) the full layout set for a data mode. Both modes share one COUNT (the pool is
// sized to cover both), so the DATA field can morph between them.
function ensureMode(mode) {
  if (!builtByMode[mode]) builtByMode[mode] = buildCrimeLayouts(wcData, { types: crimeTypes, mode });
  return builtByMode[mode];
}
// Point every builder + layout reference at the given mode's build.
function applyMode(mode) {
  const b = ensureMode(mode);
  dataMode = mode;
  layoutsByType = b.layouts; totalsByType = b.totals;
  pieBuilder = b.pieLayout; triPieBuilder = b.triPieLayout; resolvePieBuilder = b.resolvePieLayout;
  layouts = layoutsByType[crimeType];
}

// ---- camera framing: fit the WHOLE box (no FOCUS_Y offset — centred at origin) --------------------
function frameBox() {
  const { w: W, h: H } = wcData.meta.box;
  const vFov = camera.fov * Math.PI / 180;
  const distForH = (H / 2) / Math.tan(vFov / 2);
  const distForW = (W / 2) / (Math.tan(vFov / 2) * camera.aspect);
  const dist = Math.max(distForH, distForW) * 1.08; // small margin so the outline isn't flush to the edge
  camera.position.set(0, 0, dist);
  controls.target.set(0, 0, 0);
  controls.update();
}

// ---- boot -------------------------------------------------------------------
init();
async function init() {
  const data = await loadCapeTown('data/westerncape.json'); // generic loader — just a URL param
  wcData = data;
  years = data.meta.years;
  yearLabels = data.meta.yearLabels || years;
  crimeTypes = (data.meta.crimeTypes || [{ key: 'robbery', label: 'robbery' }]).map((c) => c.key);
  crimeLabels = Object.fromEntries((data.meta.crimeTypes || []).map((c) => [c.key, c.label]));
  crimeType = crimeTypes[0];
  const built = ensureMode('raw');    // per-capita is built on first toggle; both share one COUNT
  applyMode('raw');

  frameBox(); // size the camera to the WC box now that meta.box is known

  // DATA — glowing crime field; one fixed buffer, morphed across years.
  field = new PointField(built.count, { glow: true, size: 1.9 });
  field.setPixelRatio(renderer.getPixelRatio());
  field.setDrift(0.5);       // small stray — dots stay on their spot, don't wander off
  field.setDriftSpeed(2.0);  // livelier orbit — the movement is FELT without more travel
  field.setSource(layouts[0]);
  field.setTarget(layouts[1]);
  field.points.layers.enable(BLOOM_LAYER);
  fieldGroup.add(field.points);

  // STRUCTURE — ONE pool of dots, grey/matte, no glow. Map view: the precinct outlines (sized to
  // the outline point count itself — no fixed terrain-grid budget needed since there's no relief).
  makeStructField();

  refreshHud();
  updateFlag();
  holdUntil = performance.now() + 900;
  requestAnimationFrame(tick);
}

// The structure pool's MAP resting layout — the precinct outlines, straight from the baked asset.
function outlineLayout() {
  const n = wcData.structure.length / 2;
  return { positions: Float32Array.from(wcData.structure), density: new Float32Array(n).fill(0.4) };
}

function makeStructField() {
  if (structField) { fieldGroup.remove(structField.points); structField.points.geometry.dispose(); structField.material.dispose(); }
  const n = wcData.structure.length / 2;
  structTargetLayout = outlineLayout();
  structCurrent = structTargetLayout; // start on the map (the outlines themselves — no band needed)
  structField = new PointField(n, { glow: false, size: structDotSize, matte: '#6fe0a0' });
  structField.setSource(structCurrent);
  structField.setTarget(structCurrent);
  structField.setPixelRatio(renderer.getPixelRatio());
  structField.setDrift(0.0);
  structField.setT(1);
  trProg = 1;
  fieldGroup.add(structField.points);
}

// Start a staggered swarm from whatever's shown (structCurrent) to a new layout.
function startTransition(toLayout, dur = swarmDur, stagger = swarmStagger) {
  if (!structField) return;
  structField.setSource(structCurrent);
  structField.setTarget(toLayout);
  structField.setStagger(stagger);
  trTo = toLayout; trStart = performance.now(); trDur = dur; trProg = 0;
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
  if (triPieMode && triPieYears) {                 // step the 3-PIE year — all three re-fill at once
    yi = (yi + dir + years.length) % years.length; // (the burglary→robbery crossover animates)
    field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
    lastTriPie = triPieYears[yi];
    field.setTarget({ positions: lastTriPie.positions, density: lastTriPie.density });
    field.setStagger(0.6);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
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
    // is far rarer, so most dots fly OUT (the pie empties toward its sparse murder pattern).
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
  const rate = dataMode === 'percapita';           // per-capita view → tag the encoding
  if (triPieMode) {                                // comparing all three at once
    if (crimeEl) crimeEl.textContent = 'robbery · burglary · murder' + (rate ? ' · per capita' : '');
    if (yearEl) yearEl.textContent = yearLabels[yi];
    if (countEl) countEl.textContent = 'click a pie to focus it';
    return;
  }
  if (yearEl) yearEl.textContent = yearLabels[yi];
  if (crimeEl) crimeEl.textContent = (crimeLabels[type] || type) + (rate ? ' · per 100k' : '');
  if (countEl) countEl.textContent = ((totalsByType[type] && totalsByType[type][yi]) || 0).toLocaleString();
}
// Data-source credit line — names the population source too once per-capita is in play.
function updateFlag() {
  const flagEl = document.getElementById('flag');
  if (!flagEl || !yearLabels.length) return;
  const span = `${yearLabels[0]}–${yearLabels.at(-1)}`;
  flagEl.textContent = dataMode === 'percapita'
    ? `◆ crime: SAPS via DataFirst · population: WorldPop 2020 · CC-BY · ${span}`
    : `◆ SAPS crime records via DataFirst (CC-BY) · ${span}`;
}
// Morph off the map into a robbery pie and back. Data dots swarm into the wedges, structure
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
    if (structField) { structField.setSize(PIE_LINE_SIZE); startTransition(pieFrameLayout(wcData.structure.length / 2, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin })); }
  } else {
    field.setSource({ positions: lastPie.positions, density: lastPie.density });
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    if (structField) { structField.setSize(structDotSize); startTransition(structTargetLayout); } // back to the map outlines, full dot size
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// Break the single pie into THREE — robbery · burglary · murder, same year, side by side. Data
// splits across the three pies (volume honest → murder sparse); structure draws three frames.
function toggleTriPie() {
  if (!triPieBuilder || !field) return;
  const wasPie = pieMode;
  triPieMode = !triPieMode;
  playing = false;
  if (triPieMode) {
    pieMode = false;
    triPieYears = years.map((_, i) => triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
    const tp = triPieYears[yi]; lastTriPie = tp;
    const dataSrc = wasPie && lastPie ? { positions: lastPie.positions, density: lastPie.density } : layoutsByType[crimeType][yi];
    field.setSource(dataSrc);
    field.setTarget({ positions: tp.positions, density: tp.density });
    field.setStagger(0.6);
    if (structField) { structField.setSize(PIE_LINE_SIZE); startTransition(triPieFrameLayout(wcData.structure.length / 2, { centers: tp.centers, R: TRI_R, boundaries: tp.boundaries, frameDots: pieFrameDots, thin: pieThin })); }
  } else {
    field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    if (structField) { structField.setSize(structDotSize); startTransition(structTargetLayout); }
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// Toggle raw ⇄ per-capita ('C'). The DATA field morphs from its current arrangement to the same view
// in the new mode — the field visibly redistributing IS the honesty lesson: dense townships shrink,
// low-population hotspots swell, because rate ≠ count. Works in every view. THE PRIORITY instrument.
function toggleMode() {
  if (!field || !wcData) return;
  const newMode = dataMode === 'raw' ? 'percapita' : 'raw';
  const oldMapLayout = layoutsByType[crimeType][yi];   // old-mode source for the map case
  applyMode(newMode);
  playing = false;
  if (pieMode) {
    pieYears = years.map((_, i) => pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R }));
    const oldPie = lastPie, pie = pieYears[yi]; lastPie = pie;
    field.setSource({ positions: oldPie.positions, density: oldPie.density });
    field.setTarget({ positions: pie.positions, density: pie.density });
    field.setStagger(0.6);
    if (structField) startTransition(pieFrameLayout(wcData.structure.length / 2, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else if (triPieMode) {
    triPieYears = years.map((_, i) => triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
    const oldTp = lastTriPie, tp = triPieYears[yi]; lastTriPie = tp;
    field.setSource({ positions: oldTp.positions, density: oldTp.density });
    field.setTarget({ positions: tp.positions, density: tp.density });
    field.setStagger(0.6);
    if (structField) startTransition(triPieFrameLayout(wcData.structure.length / 2, { centers: tp.centers, R: TRI_R, boundaries: tp.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else {
    // map: only the DATA redistributes; the geography frame is identical in both modes.
    field.setSource(oldMapLayout);
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
  updateFlag();   // credit WorldPop when per-capita is active
}

// Click one of the three pies → they all resolve into THAT crime, centred. The clicked pie's own
// dots consolidate + grow to the middle; the other two fly out. Lands in the normal single-pie mode.
function resolveTriToPie(ci) {
  if (!lastTriPie || !resolvePieBuilder) return;
  crimeType = crimeTypes[ci];
  layouts = layoutsByType[crimeType];
  const resolved = resolvePieBuilder(ci, yi, { cx: 0, cy: 0, R: PIE_R });
  pieYears = years.map((_, i) => pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R })); // for the resulting single pie
  lastPie = resolved;
  field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
  field.setTarget({ positions: resolved.positions, density: resolved.density });
  field.setStagger(0.6);
  if (structField) { structField.setSize(PIE_LINE_SIZE); startTransition(pieFrameLayout(wcData.structure.length / 2, { cx: 0, cy: 0, R: PIE_R, boundaries: resolved.boundaries, frameDots: pieFrameDots, thin: pieThin })); }
  triPieMode = false; pieMode = true;
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// Jump straight to the 2D map from anywhere — data + structure swarm home (the `M` key).
function goToMap() {
  if (!pieMode && !triPieMode) return; // already on the map
  if (triPieMode) { toggleTriPie(); return; }      // three-pie → map (its exit swarms data + frame home)
  if (pieMode) {                                   // pie → map: data swarms back
    pieMode = false;
    field.setSource({ positions: lastPie.positions, density: lastPie.density });
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    if (structField) structField.setSize(structDotSize);
    refreshHud();
  }
  if (structField) startTransition(structTargetLayout);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') { e.preventDefault(); toggleMode(); return; }        // raw ⇄ per-capita (any view)
  if (e.code === 'Digit3') { e.preventDefault(); toggleTriPie(); return; }   // break into 3 crime-pies / back
  if (triPieMode) {                                                          // in the 3-pie only 3/M/←→ respond
    if (e.code === 'KeyM') { e.preventDefault(); goToMap(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); stepYear(1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); stepYear(-1); }
    return;
  }
  if (e.code === 'Space') { e.preventDefault(); playing = !playing; if (playing) { holdUntil = performance.now(); if (pieMode) setYearPair(yi); } }
  else if (e.code === 'KeyP') { e.preventDefault(); togglePie(); }
  else if (e.code === 'KeyM') { e.preventDefault(); goToMap(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); stepYear(1); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); stepYear(-1); }
  else if (e.code === 'ArrowUp') { e.preventDefault(); flipCrime(1); }
  else if (e.code === 'ArrowDown') { e.preventDefault(); flipCrime(-1); }
});

// Debug hook — mirrors main.js's __viz surface, minus the terrain-only dials (no zpeak/tilt/band/
// terrainDots/terrainNow — this app has no relief).
window.__viz = {
  year: (n) => { const i = years.indexOf(n); if (i >= 0) { playing = false; setYearPair(i); t = 0; } },
  t: (v) => { playing = false; t = v; },
  flip: () => flipCrime(1),                                   // cycle crime (robbery↔murder)
  drift: (px) => field && field.setDrift(px),                 // data swarm — how FAR it strays
  driftSpeed: (m) => field && field.setDriftSpeed(m),         // data swarm — how FAST (felt-ness)
  stagger: (w) => field && field.setStagger(w),              // swarm cascade (0=together … ~0.6)
  maxSize: (px) => { if (field) field.setMaxSize(px); if (structField) structField.setMaxSize(px); }, // cap dot px on zoom
  shimmer: (a) => { if (structField) structField.setShimmer(a); },         // structure breath amplitude (0=still)
  shimmerSpeed: (s) => { if (structField) structField.setShimmerSpeed(s); },
  structDots: (px) => { structDotSize = px; if (structField) structField.setSize(px); }, // structure dot size
  pieR: (r) => {                                                             // live-tune the pie radius
    if (r != null) PIE_R = r;
    if (pieMode && pieBuilder) {
      const pie = pieBuilder(crimeType, yi, { cx: 0, cy: 0, R: PIE_R }); lastPie = pie;
      field.setSource({ positions: pie.positions, density: pie.density }); field.setTarget({ positions: pie.positions, density: pie.density }); field.setT(1);
      if (structField) { const f = pieFrameLayout(wcData.structure.length / 2, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin }); structField.setSource(f); structField.setTarget(f); structField.setT(1); trProg = 1; }
    }
    return PIE_R;
  },
  pieFrame: (dots, thin) => { if (dots != null) pieFrameDots = dots; if (thin != null) pieThin = thin; if (window.__viz) window.__viz.pieR(); return { frameDots: pieFrameDots, thin: pieThin }; },
  triPie: (r, gap) => {                                                       // live-tune the 3-pie radius + spacing
    if (r != null) TRI_R = r; if (gap != null) TRI_GAP = gap;
    if (triPieMode && triPieBuilder) {
      triPieYears = years.map((_, i) => triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
      lastTriPie = triPieYears[yi];
      field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
      field.setTarget({ positions: lastTriPie.positions, density: lastTriPie.density }); field.setT(1);
      if (structField) { const f = triPieFrameLayout(wcData.structure.length / 2, { centers: lastTriPie.centers, R: TRI_R, boundaries: lastTriPie.boundaries, frameDots: pieFrameDots, thin: pieThin }); structField.setSource(f); structField.setTarget(f); structField.setT(1); trProg = 1; }
    }
    return { R: TRI_R, gap: TRI_GAP };
  },
  view: (x = 0, y = 0, dist = 200) => {                                       // debug: fly to a map-local point + zoom
    const world = fieldGroup.localToWorld(new THREE.Vector3(x, y, 0));
    const dir = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(world);
    camera.position.copy(world).addScaledVector(dir, dist);
    controls.update();
  },
  swarm: (stagger, dur) => { if (stagger != null) swarmStagger = stagger; if (dur != null) swarmDur = dur; return { stagger: swarmStagger, dur: swarmDur }; },
  speed: (ms) => { if (ms != null) { PIE_MS = ms; swarmDur = ms; } return { pie: PIE_MS, swarm: swarmDur }; },
  station: (name) => {                                                        // debug: find a station's map-local xy
    const s = (wcData.stations || []).find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
    return s ? { name: s.name, x: s.x, y: s.y, dc: s.dc, pop: s.pop } : 'not found';
  },
  roost: (d) => {                                            // how far off-screen dots fly & wait
    if (!wcData) return;
    const b = buildCrimeLayouts(wcData, { types: crimeTypes, mode: 'raw', roost: d });
    layoutsByType = b.layouts; totalsByType = b.totals; layouts = layoutsByType[crimeType];
    setYearPair(yi);
  },
  matte: (hex) => {                                          // live-tune the structure colour
    if (structField) structField.material.uniforms.uMatte.value.set(hex);
  },
  hideData: (hide = true) => { if (field) field.points.visible = !hide; }, // judge structure alone
};

// ---- hover readout — "Nyanga · 2,300 robbery · 2019/20" (works in map AND pie) ----
// One mechanism, view-agnostic: give each precinct an ANCHOR in field-local space (its centroid on
// the map; its wedge centreline in the pie), project it through the LIVE transform (camera) to the
// screen, and pick the anchor nearest the cursor. The pie gets a few anchors along each wedge so
// anywhere in the slice resolves. Numbers are exact — straight from the baked counts.
const tip = document.createElement('div');
tip.style.cssText = 'position:fixed;pointer-events:none;z-index:20;padding:4px 9px;border-radius:5px;' +
  'background:rgba(8,10,16,.86);border:1px solid rgba(140,170,210,.28);color:#e4ebf4;' +
  'font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;opacity:0;' +
  'transition:opacity .12s;transform:translate(-50%,calc(-100% - 14px))';
app.appendChild(tip);
const _hv = new THREE.Vector3();
function precinctAnchors() {                                  // [{si, x, y, crime?}] in field-local space
  const out = [], st = wcData.stations;
  if (triPieMode && lastTriPie) {                            // one set of anchors per pie, each tagged its crime
    const dth = (Math.PI * 2) / st.length;
    for (const c of lastTriPie.centers) {
      for (let si = 0; si < st.length; si++) {
        const a = -Math.PI / 2 + (si + 0.5) * dth;
        for (const rr of [0.45, 0.8]) out.push({ si, x: c.cx + Math.cos(a) * TRI_R * rr, y: c.cy + Math.sin(a) * TRI_R * rr, crime: c.type });
      }
    }
    return out;
  }
  if (pieMode) {
    const dth = (Math.PI * 2) / st.length;
    for (let si = 0; si < st.length; si++) {
      const a = -Math.PI / 2 + (si + 0.5) * dth;             // same wedge order as pieLayout
      for (const rr of [0.32, 0.58, 0.86]) out.push({ si, x: Math.cos(a) * PIE_R * rr, y: Math.sin(a) * PIE_R * rr });
    }
  } else {
    for (let si = 0; si < st.length; si++) {
      const s = st[si];
      out.push({ si, x: s.x, y: s.y });
    }
  }
  return out;
}
function hoverPrecinct(clientX, clientY) {
  if (!wcData) return -1;
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = clientX - rect.left, my = clientY - rect.top;
  fieldGroup.updateWorldMatrix(true, false);
  let best = -1, bestD = Infinity, bestCrime = crimeType;
  for (const a of precinctAnchors()) {
    _hv.set(a.x, a.y, 0);
    fieldGroup.localToWorld(_hv);
    _hv.project(camera);
    const sx = (_hv.x * 0.5 + 0.5) * rect.width, sy = (-_hv.y * 0.5 + 0.5) * rect.height;
    const d = Math.hypot(sx - mx, sy - my);
    if (d < bestD) { bestD = d; best = a.si; bestCrime = a.crime || crimeType; }
  }
  hoverCrimeType = bestCrime;                                 // which pie's crime we landed in (3-pie)
  // 150 WC stations are far denser-packed than Cape Town's 60 (esp. metro precincts) — the map
  // threshold is tightened accordingly so hover doesn't snap across neighbouring precincts.
  return bestD <= (pieMode || triPieMode ? 30 : 34) ? best : -1; // beyond the threshold → empty space
}
// Last-known cursor position (null = not over the canvas). Re-resolved every FRAME (not just on
// mousemove, from tick() below) so the label keeps reading the live year/crime while the cursor
// sits still through autoplay, a crime-flip, or a pie year-step.
let mouseX = null, mouseY = null;
function updateTooltip() {
  if (mouseX == null) return;
  const si = hoverPrecinct(mouseX, mouseY);
  if (si < 0) { tip.style.opacity = '0'; return; }
  const s = wcData.stations[si];
  const ct = hoverCrimeType || crimeType;                    // in the 3-pie, the pie under the cursor
  const n = (s.crimes[ct] && s.crimes[ct][years[yi]]) || 0;
  const rate = s.pop ? Math.round((n / s.pop) * 100000) : 0; // per-capita rate per 100k residents
  // Match the view: per-capita view → the rate; counts view → the reported number of crimes.
  const val = dataMode === 'percapita' ? `${rate.toLocaleString()} per 100k` : `${n.toLocaleString()} reported`;
  tip.innerHTML = `${s.name} · ${crimeLabels[ct] || ct} · ${yearLabels[yi]}` +
    `<br><span style="color:#9fb0c8">${val}</span>`;
  tip.style.left = mouseX + 'px';
  tip.style.top = mouseY + 'px';
  tip.style.opacity = '1';
}
renderer.domElement.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; updateTooltip(); });
renderer.domElement.addEventListener('mouseleave', () => { mouseX = mouseY = null; tip.style.opacity = '0'; });

// Click-to-resolve in the 3-pie: a tap (not a drag/pan) on the nearest pie collapses all three into
// that crime. We tell click from pan by how far the pointer moved between down and up.
let _downX = 0, _downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { _downX = e.clientX; _downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!triPieMode || !lastTriPie) return;
  if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 6) return; // it was a drag (pan), not a click
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  fieldGroup.updateWorldMatrix(true, false);
  let best = -1, bestD = Infinity;                                    // nearest pie centre to the click wins
  lastTriPie.centers.forEach((c, i) => {
    _hv.set(c.cx, c.cy, 0); fieldGroup.localToWorld(_hv); _hv.project(camera);
    const sx = (_hv.x * 0.5 + 0.5) * rect.width, sy = (-_hv.y * 0.5 + 0.5) * rect.height;
    const d = Math.hypot(sx - mx, sy - my);
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best >= 0) resolveTriToPie(best);
});

// Grey labels under each pie in the 3-pie compare — projected from each pie's field-local centre
// through the live camera, so they track zoom/pan. Hidden in every other view.
const triLabels = [0, 1, 2].map(() => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;pointer-events:none;z-index:19;color:#8b98ac;' +
    'font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;' +
    'opacity:0;transition:opacity .2s;transform:translate(-50%,0)';
  app.appendChild(d);
  return d;
});
function updateTriLabels() {
  if (!triPieMode || !lastTriPie) { for (const d of triLabels) d.style.opacity = '0'; return; }
  const rect = renderer.domElement.getBoundingClientRect();
  fieldGroup.updateWorldMatrix(true, false);
  lastTriPie.centers.forEach((c, i) => {
    const d = triLabels[i]; if (!d) return;
    _hv.set(c.cx, c.cy - TRI_R - 24, 0);                     // just under the pie
    fieldGroup.localToWorld(_hv); _hv.project(camera);
    d.style.left = ((_hv.x * 0.5 + 0.5) * rect.width) + 'px';
    d.style.top = ((-_hv.y * 0.5 + 0.5) * rect.height) + 'px';
    d.textContent = crimeLabels[c.type] || c.type;
    d.style.opacity = '1';
  });
}

// ---- loop -------------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0, fpsWall = -1; // fps measured off performance.now() (the `now` below)

function tick() {
  const now = performance.now();
  const time = clock.getElapsedTime();

  if (pieMorphing) {
    // Morphing the field between arrangements (map⇄pie⇄3-pie; both fields swarm, nothing fades).
    const p = Math.min((now - pieMorphStart) / PIE_MS, 1);
    t = swarmEase(p);
    if (p >= 1) {
      pieMorphing = false;
      // Landed back on the flat map (not a pie view) → re-anchor the scrub pair seamlessly so a
      // later play/scrub is clean (the field is already at layouts[yi], so this doesn't jump).
      if (!pieMode && !triPieMode) setYearPair(yi);
    }
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
  if (structField) {
    if (trProg < 1) {                                              // advance the current swarm transition
      trProg = Math.min((now - trStart) / trDur, 1);
      structField.setT(swarmEase(trProg));
      if (trProg >= 1 && trTo) structCurrent = trTo;               // it's now the resting arrangement
    }
    structField.setTime(time);
  }
  controls.update();
  updateTooltip(); // re-resolve every frame — keeps the label live even when the cursor doesn't move
  updateTriLabels(); // keep the 3-pie crime labels pinned under their pies (self-hides otherwise)

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
  if (structField) structField.setPixelRatio(renderer.getPixelRatio());
});
