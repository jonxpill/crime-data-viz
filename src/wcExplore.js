import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointField } from './engine/PointField.js';
import { loadCapeTown, buildCrimeLayouts, pieFrameLayout, triPieFrameLayout } from './layouts/capeTown.js';

/*
 * Western Cape explorer — main.js's engine, generalised to more than one region.
 *
 * FOUNDATION (why this file looks the way it does): a SINGLE conserved data pool + a SINGLE conserved
 * structure pool. "Western Cape" and "Cape Town" are NOT two scenes — they're two LAYOUTS the same dots
 * reconfigure between, exactly like map ⇄ pie ⇄ tri-pie already are. So the whole toolkit (year-scrub,
 * crime-flip, pie, 3-pie, resolve, per-capita, hover) is main.js's proven code UNCHANGED — it just
 * drives the one `field`; a region swap is only another repointing of the layout references (like a
 * mode swap). The drill is one more morph of that conserved field.
 *
 * The conserved slice: Cape Town's 60 stations are a byte-identical subset of the province's 150 (same
 * crime counts, verified), so ordering the province [city, then rural] makes Cape Town's crime dots a
 * contiguous slice [0, CT_COUNT) that maps 1:1 onto the Cape Town detail build — the SAME dots in both
 * views. On the drill they simply travel (province cluster ⇄ full detail). Rural crime has no detail to
 * zoom into, so it honestly breaks away (flies out + fades) and flies back on the way out. Structure is
 * one pool whose province outline reconfigures into Cape Town's outline. Camera is DEAD STILL — framed
 * to the union of both boxes once; the drill is entirely in the dots, never the lens (wcMain.js's
 * grammar, here carrying the full toolkit).
 */

const BLOOM_LAYER = 1;
const norm = (s) => (s || '').toLowerCase().trim();

// ---- scene / renderer -------------------------------------------------------
const app = document.getElementById('app');
const DARK = new THREE.Color('#05060a');
const scene = new THREE.Scene();
scene.background = DARK;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);
camera.position.set(0, 0, 900); // set precisely once both boxes are known (frameUnion, in init)

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

// Zoom + pan (no 3D tumble — it's a flat map, no terrain to tilt into). Scroll/pinch zooms, drag pans.
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.screenSpacePanning = true;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 70;
controls.maxDistance = 2500; // the province box is wide — allow a big pull-back
controls.zoomSpeed = 0.9;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
controls.target.set(0, 0, 0);
controls.update();

// Data + structure share one frame so geography and crime stay in register.
const fieldGroup = new THREE.Group();
scene.add(fieldGroup);

// ---- selective bloom: ONLY the data field glows -----------------------------
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.58, 0.72, 0.0);
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

// ---- the ONE data pool + ONE structure pool ---------------------------------
let field = null;          // DATA (glow). Province = all 150; Cape Town view = its city slice [0, CT_COUNT).
let structField = null;    // STRUCTURE (grey matte). Province outline ⇄ Cape Town outline. One conserved pool.
let COUNT = 0;             // total data slots. Field order is [ city 0..CT_COUNT , rural CT_COUNT..COUNT ].
let CT_COUNT = 0;          // Cape Town's dot count — the conserved slice that survives the drill.
let RURAL_COUNT = 0;       // rural dot count (= COUNT - CT_COUNT).
let ruralAway = null;      // rural dots' broken-away rest (pushed out ×2.5, density 0) — the Cape-Town-view rural rest.
let structN = 0;           // structure dot budget (the province outline's) — the shared pool's size.
let provinceOutline = null, ctOutline = null; // the two structure rest poses (Cape Town cycled to structN → dense).
let wcStations = [], ctStations = [];         // per-region station lists (for hover + drill hit-testing).

// A "provider" is a region's { raw, percapita } layout builds. Province builds are COUNT-sized (all 150);
// Cape Town builds are their own CT_COUNT size and get written into the field's city slice by partial
// writes (only lifted to COUNT at the drill boundary, where both endpoints must be full-size).
const providers = { wc: null, ct: null };
let region = 'wc';         // 'wc' | 'ct' — the active layout set
let drilling = false, drillTo = 'wc', drillStart = 0;
const DRILL_MS = 2200;
const drillEase = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// ---- toolkit state (main.js) ------------------------------------------------
let years = [], yearLabels = [], layouts = [];
let crimeTypes = [], crimeLabels = {}, crimeType = '', layoutsByType = {}, totalsByType = {};
let dataMode = 'raw';
let yi = 0;                // current year index (source of the morph)
let t = 0;                 // 0 = years[yi], 1 = years[yi+1]
let playing = true;
let morphStart = -1;
const YEAR_MS = 2200, HOLD_MS = 450;
let holdUntil = 0;
let flipping = false, flipStart = 0, flipTo = '';
const FLIP_MS = 1100;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const swarmEase = (x) => x; // constant speed — no acceleration pull at either end
let pieBuilder = null, pieMode = false, pieMorphing = false, pieMorphStart = 0, lastPie = null, pieYears = null;
const PIE_LINE_SIZE = 1.3;
let PIE_MS = 2400, PIE_R = 200;
let pieFrameDots = 200000, pieThin = 0.22;
let triPieBuilder = null, resolvePieBuilder = null, triPieMode = false, triPieYears = null, lastTriPie = null;
let TRI_R = 128, TRI_GAP = 320;
let hoverCrimeType = '';
let structDotSize = 1.6;

// Structure swarm transition (one pool; map outline ⇄ pie frame ⇄ Cape Town outline).
let structCurrent = null, strProg = 1, strStart = 0, strDur = 2400, strTo = null, strStagger = 0.6;

const yearEl = document.getElementById('year');
const fpsEl = document.getElementById('fps');
const crimeEl = document.getElementById('crime');
const countEl = document.getElementById('count');
const regionEl = document.getElementById('region');
const hintEl = document.getElementById('hint');

// Context-aware affordance line: what a click does depends on where you are (only writes on change, so
// it's cheap to call every frame via refreshHud). Mid-drill text is set by startDrill; this defers then.
let _lastHint = null;
function refreshHint() {
  if (!hintEl || drilling) return;
  const txt = (pieMode || triPieMode) ? 'press M for the map'
    : region === 'ct' ? 'click empty space (or M) to zoom back out'
      : 'click Cape Town to zoom in';
  if (txt !== _lastHint) { hintEl.textContent = txt; _lastHint = txt; }
}

// Point every builder + layout reference at the active region's build for the current mode. Called on
// a mode swap (C) AND on a region change (a drill lands) — region is just another axis of the same
// repointing that main.js already does for raw ⇄ per-capita.
function repoint() {
  const b = providers[region][dataMode];
  layoutsByType = b.layouts; totalsByType = b.totals;
  pieBuilder = b.pieLayout; triPieBuilder = b.triPieLayout; resolvePieBuilder = b.resolvePieLayout;
  layouts = layoutsByType[crimeType];
}
function applyMode(mode) { dataMode = mode; repoint(); }

// Lift a Cape Town layout (CT_COUNT-sized) into a full COUNT-sized pose: its dots fill the city slice
// [0, CT_COUNT), rural slots [CT_COUNT, COUNT) sit parked-away (density 0). Only needed at the drill
// boundary + the landing seed (both endpoints must be full-size); the resting toolkit uses partial writes.
function liftCt(l) {
  const positions = new Float32Array(COUNT * 2), density = new Float32Array(COUNT);
  positions.set(l.positions, 0);                 // city dots [0, CT_COUNT)
  density.set(l.density, 0);
  positions.set(ruralAway.positions, CT_COUNT * 2); // rural dots [CT_COUNT, COUNT) → broken-away (density stays 0)
  return { ...l, positions, density };
}
// A region's CURRENT map pose (year yi→yi+1 at the live t), COUNT-sized — the drill's break-away/bloom
// endpoint. Province is already COUNT-sized; Cape Town is lifted (rural parked-away).
function liveMap(reg) {
  const b = providers[reg][dataMode];
  const arr = b.layouts[crimeType];
  const a = arr[yi], c = arr[(yi + 1) % years.length];
  const n = a.density.length, positions = new Float32Array(n * 2), density = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    positions[2 * i] = a.positions[2 * i] + (c.positions[2 * i] - a.positions[2 * i]) * t;
    positions[2 * i + 1] = a.positions[2 * i + 1] + (c.positions[2 * i + 1] - a.positions[2 * i + 1]) * t;
    density[i] = a.density[i] + (c.density[i] - a.density[i]) * t;
  }
  const live = { positions, density };
  return reg === 'ct' ? liftCt(live) : live;
}
const structRest = () => (region === 'ct' ? ctOutline : provinceOutline);

// ---- boot -------------------------------------------------------------------
init();
async function init() {
  const [wcRaw, ctRaw] = await Promise.all([loadCapeTown('data/westerncape.json'), loadCapeTown('data/capetown.json')]);
  years = wcRaw.meta.years;
  yearLabels = wcRaw.meta.yearLabels || years;
  crimeTypes = (wcRaw.meta.crimeTypes || [{ key: 'robbery', label: 'robbery' }]).map((c) => c.key);
  crimeLabels = Object.fromEntries((wcRaw.meta.crimeTypes || []).map((c) => [c.key, c.label]));
  crimeType = crimeTypes[0];

  // Reorder the province [ city (in Cape Town's own station order), then rural ] so Cape Town's crime
  // dots form the contiguous conserved slice [0, CT_COUNT) that lines up dot-for-dot with the detail build.
  const ctOrder = new Map(ctRaw.stations.map((s, i) => [norm(s.name), i]));
  const rural = wcRaw.stations.filter((s) => norm(s.dc) !== 'city of cape town');
  const city = wcRaw.stations.filter((s) => norm(s.dc) === 'city of cape town')
    .sort((a, b) => ctOrder.get(norm(a.name)) - ctOrder.get(norm(b.name)));
  const provinceData = { ...wcRaw, stations: [...city, ...rural] };
  wcStations = provinceData.stations;
  ctStations = ctRaw.stations;

  const T = crimeTypes;
  providers.wc = { raw: buildCrimeLayouts(provinceData, { types: T, mode: 'raw' }), percapita: buildCrimeLayouts(provinceData, { types: T, mode: 'percapita' }) };
  providers.ct = { raw: buildCrimeLayouts(ctRaw, { types: T, mode: 'raw' }), percapita: buildCrimeLayouts(ctRaw, { types: T, mode: 'percapita' }) };
  COUNT = providers.wc.raw.count;
  CT_COUNT = providers.ct.raw.count;
  RURAL_COUNT = COUNT - CT_COUNT;
  if (RURAL_COUNT <= 0) console.warn('[wc] conserved-slice sizing looks wrong', { COUNT, CT_COUNT, RURAL_COUNT });

  // This explorer is FLAT (no terrain). buildCrimeLayouts still tags each map layout with a per-build
  // `z` (Cape Town's is CT_COUNT-sized because capetown.json carries a DEM) — uploading that as aZ onto
  // the COUNT-sized shared field would break its draw. Strip it: the field keeps its zeroed aZ, uZScale
  // stays 0, everything renders flat. (Pies carry no z, so only the map layouts need it.)
  for (const reg of ['wc', 'ct']) for (const mode of ['raw', 'percapita']) {
    const b = providers[reg][mode];
    for (const ty of Object.keys(b.layouts)) for (const L of b.layouts[ty]) delete L.z;
  }

  // Rural break-away rest — the province's rural dots pushed out ×2.5 (off-frame), density 0. Where rural
  // crime waits while you're inside Cape Town; the drill flies them out to here (and back on the way out).
  ruralAway = { positions: new Float32Array(RURAL_COUNT * 2), density: new Float32Array(RURAL_COUNT) };
  const ref = providers.wc.raw.layouts[crimeType][0].positions;
  for (let i = 0; i < RURAL_COUNT * 2; i++) ruralAway.positions[i] = ref[CT_COUNT * 2 + i] * 2.5;

  // Structure poses — province outline ⇄ Cape Town outline, cycled to the province's dot budget so the
  // detail frame is a DENSE line (not sparse). One conserved pool reconfigures between them.
  structN = wcRaw.structure.length / 2;
  provinceOutline = { positions: Float32Array.from(wcRaw.structure), density: new Float32Array(structN).fill(0.4) };
  const ctN = ctRaw.structure.length / 2, ctPos = new Float32Array(structN * 2);
  for (let i = 0; i < structN; i++) {
    const j = (i % ctN) * 2;
    ctPos[i * 2] = ctRaw.structure[j] + (Math.random() - 0.5) * 1.4;
    ctPos[i * 2 + 1] = ctRaw.structure[j + 1] + (Math.random() - 0.5) * 1.4;
  }
  ctOutline = { positions: ctPos, density: new Float32Array(structN).fill(0.4) };

  field = new PointField(COUNT, { glow: true, size: 1.9 });
  field.setPixelRatio(renderer.getPixelRatio());
  field.setDrift(0.5);
  field.setDriftSpeed(2.0);
  field.setMaxSize(7);
  field.points.layers.enable(BLOOM_LAYER);
  fieldGroup.add(field.points);

  structField = new PointField(structN, { glow: false, size: structDotSize, matte: '#6fe0a0' });
  structField.setPixelRatio(renderer.getPixelRatio());
  structField.setDrift(0.0);
  structField.setMaxSize(7);
  fieldGroup.add(structField.points);

  region = 'wc';
  applyMode('raw');
  frameUnion(wcRaw.meta.box, ctRaw.meta.box);
  landRegion(); // seed the province at rest

  refreshHud();
  updateFlag();
  holdUntil = performance.now() + 900;
  requestAnimationFrame(tick);
}

// Frame BOTH boxes' union once and never move again — the drill is in the dots, not the lens.
function frameUnion(a, b) {
  const W = Math.max(a.w, b.w), H = Math.max(a.h, b.h);
  const vFov = camera.fov * Math.PI / 180;
  const dH = (H / 2) / Math.tan(vFov / 2);
  const dW = (W / 2) / (Math.tan(vFov / 2) * camera.aspect);
  camera.position.set(0, 0, Math.max(dH, dW) * 1.08);
  controls.target.set(0, 0, 0);
  controls.update();
}

// Seed the shared fields cleanly at the ACTIVE region's map, at rest (year yi→yi+1, t=0). For Cape Town
// this uses full COUNT-sized (lifted) layouts so the rural slice is written to its parked-away pose in
// BOTH endpoints; thereafter the toolkit's partial (city-only) writes preserve it.
function landRegion() {
  layouts = layoutsByType[crimeType];
  const next = (yi + 1) % years.length;
  if (region === 'ct') {
    field.setSource(liftCt(layouts[yi]));
    field.setTarget(liftCt(layouts[next]));
  } else {
    field.setSource(layouts[yi]);
    field.setTarget(layouts[next]);
  }
  field.setT(0); t = 0; morphStart = -1;
  const outline = structRest();
  structField.setSource(outline); structField.setTarget(outline); structField.setT(1);
  structCurrent = outline; strProg = 1;
}

// Start a staggered structure swarm from whatever's shown (structCurrent) to a new layout.
function startStructTransition(toLayout, dur = strDur, stagger = strStagger) {
  if (!structField) return;
  structField.setSource(structCurrent);
  structField.setTarget(toLayout);
  structField.setStagger(stagger);
  strTo = toLayout; strStart = performance.now(); strDur = dur; strProg = 0;
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
    yi = (yi + dir + years.length) % years.length;
    field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
    lastTriPie = triPieYears[yi];
    field.setTarget({ positions: lastTriPie.positions, density: lastTriPie.density });
    field.setStagger(0.6);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
  if (pieMode && pieYears) {                       // step the PIE year with an ANIMATED morph
    yi = (yi + dir + years.length) % years.length;
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

// Flip to another crime (dir cycles the list): morph between crimes at the current year, then resume.
function flipCrime(dir) {
  if (flipping || crimeTypes.length < 2) return;
  const i = crimeTypes.indexOf(crimeType);
  const next = crimeTypes[(i + dir + crimeTypes.length) % crimeTypes.length];
  if (next === crimeType) return;
  if (pieMode) {
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
  refreshHud(next);
}

// HUD text for a crime + the current year (defaults to the live crime).
function refreshHud(type = crimeType) {
  const rate = dataMode === 'percapita';
  if (regionEl) regionEl.textContent = region === 'ct' ? 'Cape Town' : 'Western Cape';
  refreshHint();
  if (triPieMode) {
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

// Morph off the map into a robbery pie and back. Data swarms into the wedges, structure into the ring
// + spokes — conserved, staggered, no fades.
function togglePie() {
  if (!pieBuilder || !field) return;
  pieMode = !pieMode;
  playing = false;
  if (pieMode) {
    pieYears = years.map((_, i) => pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R }));
    const pie = pieYears[yi];
    lastPie = pie;
    field.setSource(layoutsByType[crimeType][yi]);
    field.setTarget({ positions: pie.positions, density: pie.density });
    field.setStagger(0.6);
    structField.setSize(PIE_LINE_SIZE);
    startStructTransition(pieFrameLayout(structN, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else {
    field.setSource({ positions: lastPie.positions, density: lastPie.density });
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    structField.setSize(structDotSize);
    startStructTransition(structRest());
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// Break the single pie into THREE — robbery · burglary · murder, same year, side by side.
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
    structField.setSize(PIE_LINE_SIZE);
    startStructTransition(triPieFrameLayout(structN, { centers: tp.centers, R: TRI_R, boundaries: tp.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else {
    field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    structField.setSize(structDotSize);
    startStructTransition(structRest());
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// Toggle raw ⇄ per-capita ('C'). The DATA field morphs to the same view in the new mode — dense
// townships shrink, low-population hotspots swell, because rate ≠ count. Works in every view + region.
function toggleMode() {
  if (!field) return;
  const newMode = dataMode === 'raw' ? 'percapita' : 'raw';
  const oldMapLayout = layoutsByType[crimeType][yi];
  applyMode(newMode);
  playing = false;
  if (pieMode) {
    pieYears = years.map((_, i) => pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R }));
    const oldPie = lastPie, pie = pieYears[yi]; lastPie = pie;
    field.setSource({ positions: oldPie.positions, density: oldPie.density });
    field.setTarget({ positions: pie.positions, density: pie.density });
    field.setStagger(0.6);
    startStructTransition(pieFrameLayout(structN, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else if (triPieMode) {
    triPieYears = years.map((_, i) => triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
    const oldTp = lastTriPie, tp = triPieYears[yi]; lastTriPie = tp;
    field.setSource({ positions: oldTp.positions, density: oldTp.density });
    field.setTarget({ positions: tp.positions, density: tp.density });
    field.setStagger(0.6);
    startStructTransition(triPieFrameLayout(structN, { centers: tp.centers, R: TRI_R, boundaries: tp.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else {
    // map: only the DATA redistributes; the geography frame is identical in both modes.
    field.setSource(oldMapLayout);
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
  updateFlag();
}

// Click one of the three pies → they all resolve into THAT crime, centred.
function resolveTriToPie(ci) {
  if (!lastTriPie || !resolvePieBuilder) return;
  crimeType = crimeTypes[ci];
  layouts = layoutsByType[crimeType];
  const resolved = resolvePieBuilder(ci, yi, { cx: 0, cy: 0, R: PIE_R });
  pieYears = years.map((_, i) => pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R }));
  lastPie = resolved;
  field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
  field.setTarget({ positions: resolved.positions, density: resolved.density });
  field.setStagger(0.6);
  structField.setSize(PIE_LINE_SIZE);
  startStructTransition(pieFrameLayout(structN, { cx: 0, cy: 0, R: PIE_R, boundaries: resolved.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  triPieMode = false; pieMode = true;
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// The `M` key: from a pie/3-pie → swarm home to the map. On the Cape Town map → drill back out.
function goToMap() {
  if (triPieMode) { toggleTriPie(); return; }
  if (pieMode) {
    pieMode = false;
    field.setSource({ positions: lastPie.positions, density: lastPie.density });
    field.setTarget(layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    structField.setSize(structDotSize);
    startStructTransition(structRest());
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
  if (region === 'ct') startDrill('wc'); // already on the Cape Town map → M drills back out
}

// ---- THE DRILL — one conserved swarm each, camera dead still (wcMain.js's grammar) ------------------
// Available ONLY from a MAP view (gated at the call sites). DATA: Cape Town's city dots travel
// province-cluster ⇄ full detail (conserved — the SAME dots); rural breaks away / flies back.
// STRUCTURE: the province outline reconfigures into Cape Town's outline. Nothing fades except the rural
// crime that genuinely has no detail to zoom into; the lens never moves.
function startDrill(to) {
  if (drilling || to === region || pieMode || triPieMode) return;
  drilling = true; drillTo = to; drillStart = performance.now(); playing = false;
  if (hintEl) hintEl.textContent = to === 'ct' ? 'blooming into Cape Town…' : 'back to the Western Cape…';
  field.setSource(liveMap(region));
  field.setTarget(liveMap(to));
  field.setStagger(0.62);
  structField.setSource(structCurrent);
  structField.setTarget(to === 'ct' ? ctOutline : provinceOutline);
  structField.setStagger(0.62);
}

window.addEventListener('keydown', (e) => {
  if (drilling) return; // input is quiet mid-transition
  if (e.code === 'KeyC') { e.preventDefault(); toggleMode(); return; }
  if (e.code === 'Digit3') { e.preventDefault(); toggleTriPie(); return; }
  if (triPieMode) {
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

// Debug hook (region-aware).
window.__viz = {
  year: (n) => { const i = years.indexOf(n); if (i >= 0) { playing = false; setYearPair(i); t = 0; } },
  t: (v) => { playing = false; t = v; },
  flip: () => flipCrime(1),
  drift: (px) => field && field.setDrift(px),
  driftSpeed: (m) => field && field.setDriftSpeed(m),
  stagger: (w) => field && field.setStagger(w),
  maxSize: (px) => { if (field) field.setMaxSize(px); if (structField) structField.setMaxSize(px); },
  shimmer: (a) => { if (structField) structField.setShimmer(a); },
  shimmerSpeed: (s) => { if (structField) structField.setShimmerSpeed(s); },
  structDots: (px) => { structDotSize = px; if (structField) structField.setSize(px); },
  pieR: (r) => {
    if (r != null) PIE_R = r;
    if (pieMode && pieBuilder) {
      const pie = pieBuilder(crimeType, yi, { cx: 0, cy: 0, R: PIE_R }); lastPie = pie;
      field.setSource({ positions: pie.positions, density: pie.density }); field.setTarget({ positions: pie.positions, density: pie.density }); field.setT(1);
      const f = pieFrameLayout(structN, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin });
      structField.setSource(f); structField.setTarget(f); structField.setT(1); strProg = 1; structCurrent = f;
    }
    return PIE_R;
  },
  pieFrame: (dots, thin) => { if (dots != null) pieFrameDots = dots; if (thin != null) pieThin = thin; if (window.__viz) window.__viz.pieR(); return { frameDots: pieFrameDots, thin: pieThin }; },
  triPie: (r, gap) => {
    if (r != null) TRI_R = r; if (gap != null) TRI_GAP = gap;
    if (triPieMode && triPieBuilder) {
      triPieYears = years.map((_, i) => triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
      lastTriPie = triPieYears[yi];
      field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
      field.setTarget({ positions: lastTriPie.positions, density: lastTriPie.density }); field.setT(1);
      const f = triPieFrameLayout(structN, { centers: lastTriPie.centers, R: TRI_R, boundaries: lastTriPie.boundaries, frameDots: pieFrameDots, thin: pieThin });
      structField.setSource(f); structField.setTarget(f); structField.setT(1); strProg = 1; structCurrent = f;
    }
    return { R: TRI_R, gap: TRI_GAP };
  },
  view: (x = 0, y = 0, dist = 200) => {
    const world = fieldGroup.localToWorld(new THREE.Vector3(x, y, 0));
    const dir = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(world);
    camera.position.copy(world).addScaledVector(dir, dist);
    controls.update();
  },
  speed: (ms) => { if (ms != null) { PIE_MS = ms; strDur = ms; } return { pie: PIE_MS, struct: strDur }; },
  station: (name) => {
    const s = (region === 'ct' ? ctStations : wcStations).find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
    return s ? { name: s.name, x: s.x, y: s.y, dc: s.dc, pop: s.pop } : 'not found';
  },
  matte: (hex) => { if (structField) structField.material.uniforms.uMatte.value.set(hex); },
  hideData: (hide = true) => { if (field) field.points.visible = !hide; },
  region: (r) => { if (r === 'wc' || r === 'ct') startDrill(r); return region; }, // debug: force a drill
};

// ---- hover readout — "Nyanga · 2,300 robbery · 2019/20" (works in map AND pie), region-aware ----
const tip = document.createElement('div');
tip.style.cssText = 'position:fixed;pointer-events:none;z-index:20;padding:4px 9px;border-radius:5px;' +
  'background:rgba(8,10,16,.86);border:1px solid rgba(140,170,210,.28);color:#e4ebf4;' +
  'font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;opacity:0;' +
  'transition:opacity .12s;transform:translate(-50%,calc(-100% - 14px))';
app.appendChild(tip);
const _hv = new THREE.Vector3();
const activeStations = () => (region === 'ct' ? ctStations : wcStations);
function precinctAnchors() {
  const out = [], st = activeStations();
  if (triPieMode && lastTriPie) {
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
      const a = -Math.PI / 2 + (si + 0.5) * dth;                 // same wedge order as pieLayout
      for (const rr of [0.32, 0.58, 0.86]) out.push({ si, x: Math.cos(a) * PIE_R * rr, y: Math.sin(a) * PIE_R * rr });
    }
  } else {
    for (let si = 0; si < st.length; si++) out.push({ si, x: st[si].x, y: st[si].y });
  }
  return out;
}
function hoverPrecinct(clientX, clientY) {
  if (drilling) return -1;
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
  hoverCrimeType = bestCrime;
  return bestD <= (pieMode || triPieMode ? 30 : 40) ? best : -1;
}
let mouseX = null, mouseY = null;
function updateTooltip() {
  if (mouseX == null) return;
  const si = hoverPrecinct(mouseX, mouseY);
  if (si < 0) { tip.style.opacity = '0'; return; }
  const s = activeStations()[si];
  const ct = hoverCrimeType || crimeType;
  const n = (s.crimes[ct] && s.crimes[ct][years[yi]]) || 0;
  const rate = s.pop ? Math.round((n / s.pop) * 100000) : 0;
  const val = dataMode === 'percapita' ? `${rate.toLocaleString()} per 100k` : `${n.toLocaleString()} reported`;
  tip.innerHTML = `${s.name} · ${crimeLabels[ct] || ct} · ${yearLabels[yi]}` +
    `<br><span style="color:#9fb0c8">${val}</span>`;
  tip.style.left = mouseX + 'px';
  tip.style.top = mouseY + 'px';
  tip.style.opacity = '1';
}
renderer.domElement.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; updateTooltip(); });
renderer.domElement.addEventListener('mouseleave', () => { mouseX = mouseY = null; tip.style.opacity = '0'; });

// Click: (1) in the 3-pie, resolve to the clicked pie; (2) on the province MAP, clicking Cape Town's
// cluster drills in; (3) on the Cape Town MAP, a tap drills back out. A tap is told from a pan by move distance.
let _downX = 0, _downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { _downX = e.clientX; _downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (drilling) return;
  if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 6) return; // a drag (pan), not a click
  if (triPieMode && lastTriPie) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    fieldGroup.updateWorldMatrix(true, false);
    let best = -1, bestD = Infinity;
    lastTriPie.centers.forEach((c, i) => {
      _hv.set(c.cx, c.cy, 0); fieldGroup.localToWorld(_hv); _hv.project(camera);
      const sx = (_hv.x * 0.5 + 0.5) * rect.width, sy = (-_hv.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - mx, sy - my);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) resolveTriToPie(best);
    return;
  }
  if (pieMode) return;                               // no drill from the pie
  if (region === 'wc') {
    const { s, d } = nearestStation(wcStations, e.clientX, e.clientY);
    if (s && d < 120 && norm(s.dc) === 'city of cape town') startDrill('ct');
  } else {
    startDrill('wc');                                // tap anywhere on the Cape Town map → back out
  }
});
function nearestStation(sts, cx, cy) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = cx - rect.left, my = cy - rect.top;
  fieldGroup.updateWorldMatrix(true, false);
  let best = null, bestD = Infinity;
  for (const s of sts) {
    _hv.set(s.x, s.y, 0); fieldGroup.localToWorld(_hv); _hv.project(camera);
    const sx = (_hv.x * 0.5 + 0.5) * rect.width, sy = (-_hv.y * 0.5 + 0.5) * rect.height;
    const d = Math.hypot(sx - mx, sy - my);
    if (d < bestD) { bestD = d; best = s; }
  }
  return { s: best, d: bestD };
}

// Grey labels under each pie in the 3-pie compare.
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
    _hv.set(c.cx, c.cy - TRI_R - 24, 0);
    fieldGroup.localToWorld(_hv); _hv.project(camera);
    d.style.left = ((_hv.x * 0.5 + 0.5) * rect.width) + 'px';
    d.style.top = ((-_hv.y * 0.5 + 0.5) * rect.height) + 'px';
    d.textContent = crimeLabels[c.type] || c.type;
    d.style.opacity = '1';
  });
}

// ---- loop -------------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0, fpsWall = -1;

function tick() {
  const now = performance.now();
  const time = clock.getElapsedTime();

  if (drilling) {
    const p = Math.min((now - drillStart) / DRILL_MS, 1);
    const e = drillEase(p);
    field.setT(e); structField.setT(e);
    field.setTime(time); structField.setTime(time);
    if (p >= 1) {
      drilling = false;
      region = drillTo;
      repoint();
      landRegion();                                  // re-seed cleanly at the landed region's map, at rest
      refreshHud();                                  // refreshes the region label + context-aware hint

    }
    controls.update();
    render();
    requestAnimationFrame(tick);
    return;
  }

  if (pieMorphing) {
    const p = Math.min((now - pieMorphStart) / PIE_MS, 1);
    t = swarmEase(p);
    if (p >= 1) {
      pieMorphing = false;
      if (!pieMode && !triPieMode) setYearPair(yi);  // re-anchor the scrub pair on the flat map
    }
  } else if (flipping) {
    const p = Math.min((now - flipStart) / FLIP_MS, 1);
    t = easeInOut(p);
    if (p >= 1) {
      flipping = false;
      crimeType = flipTo;
      layouts = layoutsByType[crimeType];
      setYearPair(yi);
      morphStart = -1;
      holdUntil = now + HOLD_MS;
    }
  } else if (playing) {
    if (morphStart < 0 && now >= holdUntil) morphStart = now; // begin a year crossing
    if (morphStart >= 0) {
      const p = Math.min((now - morphStart) / YEAR_MS, 1);
      t = easeInOut(p);
      if (p >= 1) {
        morphStart = -1;
        holdUntil = now + HOLD_MS;
        setYearPair(yi + 1);
      }
    }
  }

  field.setT(t);
  field.setTime(time);
  if (structField) {
    if (strProg < 1) {
      strProg = Math.min((now - strStart) / strDur, 1);
      structField.setT(swarmEase(strProg));
      if (strProg >= 1 && strTo) structCurrent = strTo;
    }
    structField.setTime(time);
  }
  controls.update();
  updateTooltip();
  updateTriLabels();

  render();

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
