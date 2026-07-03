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
 * wcExplore.js — the Western Cape explorer, now with the Cape Town DRILL merged in. Full instrument
 * toolkit (year-scrub, crime-flip, pie, 3-pie compare, per-capita, hover) runs over TWO regions —
 * the province (westerncape.json, 150 stations) and Cape Town (capetown.json, 60 stations) — sharing
 * ONE toolkit state (yi/crimeType/dataMode/view). Click the Cape Town cluster on the province MAP to
 * rebuild-zoom in; `M` / click empty space rebuild-zooms back out. Every instrument keeps reading/
 * writing the same shared state either side of the drill, so "per-capita murder 2015/16" stays true
 * across the zoom.
 *
 * TWO-REGION SHAPE: each region gets its own persistent, full-featured bundle — own PointField DATA
 * pool, own PointField STRUCTURE pool, own layouts-by-mode cache — built ONCE at boot and never
 * resized or disposed. `region` selects which bundle is "active" (interactive, camera-framed,
 * instrument-driven); the inactive bundle just sits at its own rest arrangement, hidden, until the
 * next drill. This mirrors wcMain.js's proven pattern (two persistent fields cross-fading via a rest
 * map) MINUS its single-frozen-layout simplification — here both fields carry the FULL toolkit
 * surface, because the explorer (unlike the wcMain spike) must keep scrubbing/flipping/pie-ing after
 * the drill lands.
 *
 * CONSERVATION — resolution (a): the province MAP field is built from ALL 150 stations (Cape Town's
 * crime is genuinely part of the province view you scrub/flip/pie there — the WC pie/3-pie include
 * every station, same as clicking P before this merge existed). The DRILL's "break-away" is computed
 * as an away() transform of the WC field's OWN CURRENT layout (whatever year/crime/mode is live) —
 * ported from wcMain.js's away()/xform() — so the whole province cloud (Cape Town's dots included)
 * flies outward+fades, while a SEPARATE, independently-live Cape Town field (already showing its own
 * aligned "cluster" at rest in the province view — that IS the thing you click) blooms open to full
 * detail. This is intentionally NOT wcMain's rural-only conservation (which would need a second,
 * differently-sized pool just for the map — a real entanglement with the 150-station pie/3-pie
 * pool). The trade: during the ~2s transition Cape Town's crime is visible in BOTH the fleeing
 * province cloud and the blooming Cape Town cloud at once (a brief doubling), same honesty trade
 * wcMain.js itself names for its rural pool. Structure stays fully conserved either way (one pool,
 * reconfiguring outline↔outline, ported unchanged from wcMain.js).
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

// ---- shared toolkit state (carries across the drill) -------------------------
// yi/crimeType/dataMode/view are ONE set, not per-region — both regions' bundles are built over the
// SAME years + crimeTypes keys (verified: westerncape.json and capetown.json share identical
// meta.years and meta.crimeTypes), so "murder · 2015/16 · per-capita" means the same slice of data
// whichever region is active. Only the BUNDLE (which stations/layouts back the instruments) switches.
let years = [], yearLabels = [];
let crimeTypes = [], crimeLabels = {};
let crimeType = '';
let dataMode = 'raw';          // raw ⇄ per-capita ('C') — shared across regions
let yi = 0;                    // current year index (source of the morph) — shared
let t = 0;                     // 0 = years[yi], 1 = years[yi+1]
let playing = true;
let morphStart = -1;
const YEAR_MS = 2200;      // time to cross one year
const HOLD_MS = 450;       // pause on each year
let holdUntil = 0;
let flipping = false, flipStart = 0, flipTo = '';
const FLIP_MS = 1100;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const swarmEase = (x) => x; // constant speed — no acceleration pull at either end (matches main.js's default)
let pieMode = false, pieMorphing = false, pieMorphStart = 0, lastPie = null, pieYears = null;
const PIE_LINE_SIZE = 1.3;                 // frame dots render thinner than the map's (px)
let PIE_MS = 2400;                          // map ⇄ pie morph duration (ms) — slower = more graceful
let PIE_R = 200;
let pieFrameDots = 200000, pieThin = 0.22; // condense (almost) ALL structure dots into thin tight lines
let triPieMode = false, triPieYears = null, lastTriPie = null;
let TRI_R = 128, TRI_GAP = 320;            // per-pie radius + centre-to-centre spacing (world units)
let hoverCrimeType = '';                    // which crime the hovered mark belongs to (per-pie in the 3-pie)
let structDotSize = 1.6;                    // structure dot px on the map

// ---- per-region bundles -------------------------------------------------------
// Each bundle owns: its data + station list, its layouts-by-mode cache, its pie/tripie/resolve
// builders (mode-swapped by ensureMode/applyMode below), its structure outline layout, and its own
// persistent DATA + STRUCTURE PointField pools (never resized/disposed — sized once at boot to that
// region's own full instrument surface). `region` selects which bundle drives the camera + inputs.
const regions = { wc: null, ct: null };
let region = 'wc';           // 'wc' | 'ct' — active bundle
let drilling = false;         // true while the break-away/bloom transition is running (blocks input)
let drillFrom = 'wc', drillTo = 'wc', drillStart = 0;
const DRILL_MS = 2200;
const drillEase = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
let ctAlign = { scale: 0.16, ox: 0, oy: 0 }; // affine mapping capetown.json coords → westerncape.json coords

const yearEl = document.getElementById('year');
const fpsEl = document.getElementById('fps');
const crimeEl = document.getElementById('crime');
const countEl = document.getElementById('count');
const regionEl = document.getElementById('region');

// Build a region's full bundle: data + both-mode layout caches + structure outline + its own fields.
// `label` is a UI name; `stationFilter` (unused for wc/ct today — both are unfiltered) is left as a
// hook, not exercised, so a future region can reuse this unchanged.
function makeBundle(data, { glowSize = 1.9, structSize = structDotSize } = {}) {
  const types = (data.meta.crimeTypes || [{ key: 'robbery', label: 'robbery' }]).map((c) => c.key);
  const built = {};
  const ensureMode = (mode) => { if (!built[mode]) built[mode] = buildCrimeLayouts(data, { types, mode }); return built[mode]; };
  const b0 = ensureMode('raw');
  const structN = data.structure.length / 2;
  const structLayout = { positions: Float32Array.from(data.structure), density: new Float32Array(structN).fill(0.4) };
  const field = new PointField(b0.count, { glow: true, size: glowSize });
  field.setPixelRatio(renderer.getPixelRatio());
  field.setDrift(0.5);
  field.setDriftSpeed(2.0);
  field.points.layers.enable(BLOOM_LAYER);
  fieldGroup.add(field.points);
  const structField = new PointField(structN, { glow: false, size: structSize, matte: '#6fe0a0' });
  structField.setPixelRatio(renderer.getPixelRatio());
  structField.setDrift(0.0);
  fieldGroup.add(structField.points);
  return {
    data, types,
    crimeLabels: Object.fromEntries((data.meta.crimeTypes || []).map((c) => [c.key, c.label])),
    built, ensureMode,
    structLayout,               // the region's own outline (map rest layout)
    field, structField,         // persistent, own-sized pools
    // live pointers, repointed by applyMode() whenever this bundle is (re)activated:
    layoutsByType: b0.layouts, totalsByType: b0.totals,
    pieBuilder: b0.pieLayout, triPieBuilder: b0.triPieLayout, resolvePieBuilder: b0.resolvePieLayout,
    layouts: null,
    // structure transition bookkeeping — PER BUNDLE, so each region's frame remembers its own
    // current arrangement independently (map/pie/tripie state doesn't leak across a drill).
    structCurrent: structLayout, structTargetLayout: structLayout,
    trProg: 1, trStart: 0, trDur: 2400, trTo: null,
  };
}

// Build (once, cached) the full layout set for a data mode, ON THE GIVEN bundle.
function ensureMode(bundle, mode) { return bundle.ensureMode(mode); }
// Point a bundle's live layout references at the given mode's build (mirrors main.js's applyMode,
// just parameterised by bundle instead of a single global).
function applyModeOn(bundle, mode) {
  const b = ensureMode(bundle, mode);
  bundle.layoutsByType = b.layouts; bundle.totalsByType = b.totals;
  bundle.pieBuilder = b.pieLayout; bundle.triPieBuilder = b.triPieLayout; bundle.resolvePieBuilder = b.resolvePieLayout;
  bundle.layouts = bundle.layoutsByType[crimeType] || bundle.layoutsByType[bundle.types[0]];
}
// Apply the CURRENT shared dataMode to every region bundle (both stay in sync — a drill never needs
// a rebuild because both bundles are already sitting in the right mode).
function applyMode(mode) {
  dataMode = mode;
  for (const key of Object.keys(regions)) { const r = regions[key]; if (r) applyModeOn(r, mode); }
}

// ---- camera framing: fit the ACTIVE region's WHOLE box (centred at origin) ------------------------
function frameBox() {
  const { w: W, h: H } = active().data.meta.box;
  const vFov = camera.fov * Math.PI / 180;
  const distForH = (H / 2) / Math.tan(vFov / 2);
  const distForW = (W / 2) / (Math.tan(vFov / 2) * camera.aspect);
  const dist = Math.max(distForH, distForW) * 1.08; // small margin so the outline isn't flush to the edge
  camera.position.set(0, 0, dist);
  controls.target.set(0, 0, 0);
  controls.update();
}

function active() { return regions[region]; }

// ---- boot -------------------------------------------------------------------
init();
async function init() {
  const [wcRaw, ctRaw] = await Promise.all([loadCapeTown('data/westerncape.json'), loadCapeTown('data/capetown.json')]);

  years = wcRaw.meta.years;
  yearLabels = wcRaw.meta.yearLabels || years;
  crimeTypes = (wcRaw.meta.crimeTypes || [{ key: 'robbery', label: 'robbery' }]).map((c) => c.key);
  crimeLabels = Object.fromEntries((wcRaw.meta.crimeTypes || []).map((c) => [c.key, c.label]));
  crimeType = crimeTypes[0];

  regions.wc = makeBundle(wcRaw, { glowSize: 1.9, structSize: structDotSize });
  regions.ct = makeBundle(ctRaw, { glowSize: 2.0, structSize: structDotSize });
  applyMode('raw'); // both bundles now have layouts/layoutsByType/etc pointed at raw mode

  // ALIGN: uniform scale+offset mapping CT-detail coords → WC-map coords (both Mercator of the same
  // lng/lat → near-exact), so Cape Town's detail can bloom from EXACTLY where it sits in the
  // province. Ported unchanged from wcMain.js.
  const wcByName = new Map(wcRaw.stations.map((s) => [s.name, s]));
  const pairs = ctRaw.stations.map((s) => ({ ct: s, wc: wcByName.get(s.name) })).filter((p) => p.wc);
  let cmx = 0, cmy = 0, wmx = 0, wmy = 0;
  for (const p of pairs) { cmx += p.ct.x; cmy += p.ct.y; wmx += p.wc.x; wmy += p.wc.y; }
  const npair = pairs.length; cmx /= npair; cmy /= npair; wmx /= npair; wmy /= npair;
  let num = 0, den = 0;
  for (const p of pairs) { const cx = p.ct.x - cmx, cy = p.ct.y - cmy; num += cx * (p.wc.x - wmx) + cy * (p.wc.y - wmy); den += cx * cx + cy * cy; }
  const scale = num / den;
  ctAlign = { scale, ox: wmx - scale * cmx, oy: wmy - scale * cmy };

  region = 'wc';
  frameBox();

  // Seed each bundle's DATA field at its own map layout (year 0→1) and STRUCTURE field at its own
  // outline, fully at rest. The CT field additionally starts at its ALIGNED-MINI position (the
  // "cluster" visible — and clickable — inside the province view) since it's always in the scene.
  seedField(regions.wc, false);
  seedField(regions.ct, true);
  layoutCtAsCluster(); // CT's rest-in-wc-view pose: aligned + tiny, sitting where it belongs on the map
  setRegionVisibility();

  refreshHud();
  updateFlag();
  holdUntil = performance.now() + 900;
  requestAnimationFrame(tick);
}

// Seed a bundle's data+structure fields at year[0]→year[1], t=0, structure resting on its own outline.
function seedField(bundle, isCt) {
  bundle.layouts = bundle.layoutsByType[crimeType];
  bundle.field.setSource(bundle.layouts[0]);
  bundle.field.setTarget(bundle.layouts[1]);
  bundle.field.setT(0);
  bundle.structField.setSource(bundle.structLayout);
  bundle.structField.setTarget(bundle.structLayout);
  bundle.structField.setT(1);
  bundle.structCurrent = bundle.structLayout;
  bundle.structTargetLayout = bundle.structLayout;
  bundle.trProg = 1;
}

// CT's rest arrangement WHILE region==='wc': its own live layout (whatever year/crime/mode is
// active), affine-mapped down into the province frame — the small glowing cluster you click. Ported
// from wcMain.js's xform(). Re-derived whenever CT's own layout changes (year/crime/mode) so the
// cluster stays live/accurate even before you ever drill in.
function ctMiniLayout(layout) {
  const { scale, ox, oy } = ctAlign;
  const n = layout.density.length;
  const positions = new Float32Array(n * 2), density = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    positions[i * 2] = layout.positions[i * 2] * scale + ox;
    positions[i * 2 + 1] = layout.positions[i * 2 + 1] * scale + oy;
    density[i] = layout.density[i];
  }
  return { positions, density };
}
function ctStructMiniLayout() {
  const wcN = regions.wc.structLayout.density.length, ctN = regions.ct.structLayout.density.length;
  const src = regions.ct.structLayout;
  const { scale, ox, oy } = ctAlign;
  const positions = new Float32Array(wcN * 2), density = new Float32Array(wcN).fill(0.4);
  for (let i = 0; i < wcN; i++) {
    const j = (i % ctN) * 2;
    positions[i * 2] = src.positions[j] * scale + ox + (Math.random() - 0.5) * 0.5;
    positions[i * 2 + 1] = src.positions[j + 1] * scale + oy + (Math.random() - 0.5) * 0.5;
  }
  return { positions, density };
}
// Push CT's field to its aligned-mini pose (used at boot, and to re-anchor after any CT-side
// instrument change while resting in the province view).
function layoutCtAsCluster() {
  const mini = ctMiniLayout(regions.ct.field.__liveLayout || regions.ct.layouts[yi]);
  regions.ct.field.setSource(mini);
  regions.ct.field.setTarget(mini);
  regions.ct.field.setT(1);
}
// Only the ACTIVE region's fields are visible/interactive; the inactive one is hidden EXCEPT for
// CT's data field while resting in the province view (region==='wc', map view, not mid-drill) — that
// small glowing cluster is what you click to drill in. Structure stays one-conserved-pool-per-region
// (never cross-shown), so the inactive region's structure is simply hidden.
function setRegionVisibility() {
  const wcActive = region === 'wc';
  regions.wc.field.points.visible = wcActive;
  regions.wc.structField.points.visible = wcActive;
  const showCtCluster = wcActive && !pieMode && !triPieMode && !drilling;
  regions.ct.field.points.visible = !wcActive || showCtCluster;
  regions.ct.structField.points.visible = !wcActive;
}

// ---- structure transitions (per-region) --------------------------------------
function startTransition(bundle, toLayout, dur = 2400, stagger = 0.6) {
  if (!bundle.structField) return;
  bundle.structField.setSource(bundle.structCurrent);
  bundle.structField.setTarget(toLayout);
  bundle.structField.setStagger(stagger);
  bundle.trTo = toLayout; bundle.trStart = performance.now(); bundle.trDur = dur; bundle.trProg = 0;
}

// ---- year-scrub control -----------------------------------------------------
function setYearPair(i) {
  yi = (i + years.length) % years.length;
  const next = (yi + 1) % years.length;
  const bundle = active();
  if (pieMode && pieYears) {                       // scrub the PIE through the years — frame holds, wedges re-fill
    lastPie = pieYears[yi];
    bundle.field.setSource({ positions: pieYears[yi].positions, density: pieYears[yi].density });
    bundle.field.setTarget({ positions: pieYears[next].positions, density: pieYears[next].density });
  } else {
    bundle.field.setSource(bundle.layouts[yi]);
    bundle.field.setTarget(bundle.layouts[next]);
  }
  t = 0;
  refreshHud();
  syncRestingRegion();
}
function stepYear(dir) {
  playing = false;
  const bundle = active();
  if (triPieMode && triPieYears) {                 // step the 3-PIE year — all three re-fill at once
    yi = (yi + dir + years.length) % years.length; // (the burglary→robbery crossover animates)
    bundle.field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
    lastTriPie = triPieYears[yi];
    bundle.field.setTarget({ positions: lastTriPie.positions, density: lastTriPie.density });
    bundle.field.setStagger(0.6);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
  if (pieMode && pieYears) {                       // step the PIE year with an ANIMATED morph — dots
    yi = (yi + dir + years.length) % years.length; // fly out / re-enter as that year's count changes
    bundle.field.setSource({ positions: lastPie.positions, density: lastPie.density });
    lastPie = pieYears[yi];
    bundle.field.setTarget({ positions: pieYears[yi].positions, density: pieYears[yi].density });
    bundle.field.setStagger(0.6);
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
  const bundle = active();
  const i = crimeTypes.indexOf(crimeType);
  const next = crimeTypes[(i + dir + crimeTypes.length) % crimeTypes.length];
  if (next === crimeType) return;
  if (pieMode) {
    // Flip the PIE to another crime: rebuild its per-year pies and morph. Volume is honest — murder
    // is far rarer, so most dots fly OUT (the pie empties toward its sparse murder pattern).
    crimeType = next;
    bundle.layouts = bundle.layoutsByType[crimeType];
    pieYears = years.map((_, k) => bundle.pieBuilder(crimeType, k, { cx: 0, cy: 0, R: PIE_R }));
    bundle.field.setSource({ positions: lastPie.positions, density: lastPie.density });
    lastPie = pieYears[yi];
    bundle.field.setTarget({ positions: pieYears[yi].positions, density: pieYears[yi].density });
    bundle.field.setStagger(0.6);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
  flipTo = next;
  flipping = true;
  flipStart = performance.now();
  morphStart = -1;
  bundle.field.setSource(bundle.layoutsByType[crimeType][yi]);
  bundle.field.setTarget(bundle.layoutsByType[next][yi]);
  t = 0;
  refreshHud(next); // name the incoming crime as it morphs in
}

// HUD text for a crime + the current year (defaults to the live crime).
function refreshHud(type = crimeType) {
  const rate = dataMode === 'percapita';           // per-capita view → tag the encoding
  const bundle = active();
  if (regionEl) regionEl.textContent = region === 'ct' ? 'Cape Town' : 'Western Cape';
  if (triPieMode) {                                // comparing all three at once
    if (crimeEl) crimeEl.textContent = 'robbery · burglary · murder' + (rate ? ' · per capita' : '');
    if (yearEl) yearEl.textContent = yearLabels[yi];
    if (countEl) countEl.textContent = 'click a pie to focus it';
    return;
  }
  if (yearEl) yearEl.textContent = yearLabels[yi];
  if (crimeEl) crimeEl.textContent = (crimeLabels[type] || type) + (rate ? ' · per 100k' : '');
  if (countEl) countEl.textContent = ((bundle.totalsByType[type] && bundle.totalsByType[type][yi]) || 0).toLocaleString();
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
// dots swarm into the ring + spokes — conserved, staggered, no fades. Operates on the ACTIVE region.
function togglePie() {
  const bundle = active();
  if (!bundle.pieBuilder || !bundle.field || drilling) return;
  pieMode = !pieMode;
  playing = false;
  if (pieMode) {
    pieYears = years.map((_, i) => bundle.pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R })); // one pie per year
    const pie = pieYears[yi];
    lastPie = pie;
    bundle.field.setSource(bundle.layoutsByType[crimeType][yi]);
    bundle.field.setTarget({ positions: pie.positions, density: pie.density });
    bundle.field.setStagger(0.6);
    if (bundle.structField) { bundle.structField.setSize(PIE_LINE_SIZE); startTransition(bundle, pieFrameLayout(bundle.structLayout.density.length, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin })); }
  } else {
    bundle.field.setSource({ positions: lastPie.positions, density: lastPie.density });
    bundle.field.setTarget(bundle.layoutsByType[crimeType][yi]);
    bundle.field.setStagger(0.55);
    if (bundle.structField) { bundle.structField.setSize(structDotSize); startTransition(bundle, bundle.structTargetLayout); } // back to the map outlines, full dot size
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
  setRegionVisibility(); // pie/map toggling hides/shows the CT cluster in the province view
}

// Break the single pie into THREE — robbery · burglary · murder, same year, side by side.
function toggleTriPie() {
  const bundle = active();
  if (!bundle.triPieBuilder || !bundle.field || drilling) return;
  const wasPie = pieMode;
  triPieMode = !triPieMode;
  playing = false;
  if (triPieMode) {
    pieMode = false;
    triPieYears = years.map((_, i) => bundle.triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
    const tp = triPieYears[yi]; lastTriPie = tp;
    const dataSrc = wasPie && lastPie ? { positions: lastPie.positions, density: lastPie.density } : bundle.layoutsByType[crimeType][yi];
    bundle.field.setSource(dataSrc);
    bundle.field.setTarget({ positions: tp.positions, density: tp.density });
    bundle.field.setStagger(0.6);
    if (bundle.structField) { bundle.structField.setSize(PIE_LINE_SIZE); startTransition(bundle, triPieFrameLayout(bundle.structLayout.density.length, { centers: tp.centers, R: TRI_R, boundaries: tp.boundaries, frameDots: pieFrameDots, thin: pieThin })); }
  } else {
    bundle.field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
    bundle.field.setTarget(bundle.layoutsByType[crimeType][yi]);
    bundle.field.setStagger(0.55);
    if (bundle.structField) { bundle.structField.setSize(structDotSize); startTransition(bundle, bundle.structTargetLayout); }
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
  setRegionVisibility();
}

// Toggle raw ⇄ per-capita ('C'). BOTH region bundles switch mode together (so the drill never needs
// a mode rebuild), but only the ACTIVE region's field visibly morphs; the inactive/resting region
// just re-derives its resting layout in the new mode (relevant for CT's mini-cluster: switching
// per-capita while resting on the province map re-poses the cluster in the new mode too).
function toggleMode() {
  const bundle = active();
  if (!bundle.field || drilling) return;
  const newMode = dataMode === 'raw' ? 'percapita' : 'raw';
  const oldMapLayout = bundle.layoutsByType[crimeType][yi];   // old-mode source for the map case
  applyMode(newMode);
  playing = false;
  if (pieMode) {
    pieYears = years.map((_, i) => bundle.pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R }));
    const oldPie = lastPie, pie = pieYears[yi]; lastPie = pie;
    bundle.field.setSource({ positions: oldPie.positions, density: oldPie.density });
    bundle.field.setTarget({ positions: pie.positions, density: pie.density });
    bundle.field.setStagger(0.6);
    if (bundle.structField) startTransition(bundle, pieFrameLayout(bundle.structLayout.density.length, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else if (triPieMode) {
    triPieYears = years.map((_, i) => bundle.triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
    const oldTp = lastTriPie, tp = triPieYears[yi]; lastTriPie = tp;
    bundle.field.setSource({ positions: oldTp.positions, density: oldTp.density });
    bundle.field.setTarget({ positions: tp.positions, density: tp.density });
    bundle.field.setStagger(0.6);
    if (bundle.structField) startTransition(bundle, triPieFrameLayout(bundle.structLayout.density.length, { centers: tp.centers, R: TRI_R, boundaries: tp.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else {
    // map: only the DATA redistributes; the geography frame is identical in both modes.
    bundle.field.setSource(oldMapLayout);
    bundle.field.setTarget(bundle.layoutsByType[crimeType][yi]);
    bundle.field.setStagger(0.55);
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
  updateFlag();   // credit WorldPop when per-capita is active
  syncRestingRegion(); // re-pose the OTHER (resting) region's cluster/mini in the new mode
}

// Click one of the three pies → they all resolve into THAT crime, centred.
function resolveTriToPie(ci) {
  const bundle = active();
  if (!lastTriPie || !bundle.resolvePieBuilder) return;
  crimeType = crimeTypes[ci];
  bundle.layouts = bundle.layoutsByType[crimeType];
  const resolved = bundle.resolvePieBuilder(ci, yi, { cx: 0, cy: 0, R: PIE_R });
  pieYears = years.map((_, i) => bundle.pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R })); // for the resulting single pie
  lastPie = resolved;
  bundle.field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
  bundle.field.setTarget({ positions: resolved.positions, density: resolved.density });
  bundle.field.setStagger(0.6);
  if (bundle.structField) { bundle.structField.setSize(PIE_LINE_SIZE); startTransition(bundle, pieFrameLayout(bundle.structLayout.density.length, { cx: 0, cy: 0, R: PIE_R, boundaries: resolved.boundaries, frameDots: pieFrameDots, thin: pieThin })); }
  triPieMode = false; pieMode = true;
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// Jump straight to the 2D map from anywhere — data + structure swarm home (the `M` key). ALSO the
// drill-out trigger: if we're viewing Cape Town (region==='ct'), M rebuild-zooms back to the province
// instead (the pie/tripie map-exit happens first if needed, THEN the region drills out).
function goToMap() {
  const bundle = active();
  if (pieMode || triPieMode) {
    if (triPieMode) { toggleTriPie(); }
    else if (pieMode) {
      pieMode = false;
      bundle.field.setSource({ positions: lastPie.positions, density: lastPie.density });
      bundle.field.setTarget(bundle.layoutsByType[crimeType][yi]);
      bundle.field.setStagger(0.55);
      t = 0; pieMorphStart = performance.now(); pieMorphing = true;
      if (bundle.structField) bundle.structField.setSize(structDotSize);
      refreshHud();
    }
    if (bundle.structField) startTransition(bundle, bundle.structTargetLayout);
    setRegionVisibility();
    return;
  }
  if (region === 'ct') startDrill('wc'); // already on the CT map → M drills back OUT to the province
}

// ---- THE DRILL — break-away (province) + bloom (Cape Town), ported from wcMain.js -------------------
// Available ONLY from the WC MAP view (gated at the call sites: click-handler checks
// `region==='wc' && !pieMode && !triPieMode`; keyboard goToMap() only fires this from the CT map).
// Structure is ONE conserved pool PER REGION reconfiguring within itself (map outline is stable per
// region already) — what actually moves during the drill is each region's DATA field (break-away /
// bloom) and BOTH regions' STRUCTURE fields cross-fading their scale/position the same way, ported
// from wcMain's single conserved structure pool but kept as two pools here (one per region, sized
// for that region's own outline) since the explorer's structure pool must also serve THAT region's
// own pie/tripie frames independently — a single shared struct pool would entangle WC-pie-frame
// sizing with CT-pie-frame sizing the same way a single data pool would. Both structure pools
// transform together (province outline shrinks+fades as CT's grows+un-shrinks) so the frame still
// reads as one continuous reconfiguration even though it's two pools swapping visibility mid-flight.
function startDrill(toRegion) {
  if (drilling || toRegion === region || pieMode || triPieMode) return;
  drilling = true;
  drillFrom = region; drillTo = toRegion; drillStart = performance.now();
  const hintEl = document.getElementById('hint');
  if (hintEl) hintEl.textContent = toRegion === 'ct' ? 'zooming into Cape Town…' : 'zooming back to the Western Cape…';

  const wc = regions.wc, ct = regions.ct;
  if (toRegion === 'ct') {
    // WC's OWN current map layout breaks away (flies out + fades) — the whole province cloud,
    // Cape Town's dots included (conservation resolution a: the province pool is the full 150).
    const wcNow = { positions: wc.field.material.uniforms ? null : null, }; // placeholder, replaced below
    const wcLive = liveDataLayout(wc);
    wc.field.setSource(wcLive);
    wc.field.setTarget(awayXform(wcLive));
    wc.field.setStagger(0.62);
    // CT's field is currently resting at its aligned-mini pose (set by layoutCtAsCluster); bloom OUT
    // to its own full-size live layout.
    const ctLive = liveDataLayout(ct);
    ct.field.setSource(ctMiniLayout(ctLive));
    ct.field.setTarget(ctLive);
    ct.field.setStagger(0.62);
    // Structure: WC's outline breaks away like its data; CT's outline blooms from its mini pose to
    // its own full outline (mirrors the data fields' break-away/bloom pairing).
    wc.structField.setSource(wc.structCurrent);
    wc.structField.setTarget(awayXform(wc.structCurrent));
    wc.structField.setStagger(0.62);
    ct.structField.setSource(ctStructMiniLayout());
    ct.structField.setTarget(ct.structCurrent);
    ct.structField.setStagger(0.62);
  } else {
    // Reverse: CT's live layout breaks away to its mini pose (shrinks back into the province frame,
    // not a fade-to-nothing — it's still the same conserved cluster you'll see resting there); WC's
    // field blooms back from its away pose to its own live map layout.
    const ctLive = liveDataLayout(ct);
    ct.field.setSource(ctLive);
    ct.field.setTarget(ctMiniLayout(ctLive));
    ct.field.setStagger(0.62);
    const wcLive = liveDataLayout(wc);
    wc.field.setSource(awayXform(wcLive));
    wc.field.setTarget(wcLive);
    wc.field.setStagger(0.62);
    ct.structField.setSource(ct.structCurrent);
    ct.structField.setTarget(ctStructMiniLayout());
    ct.structField.setStagger(0.62);
    wc.structField.setSource(awayXform(wc.structCurrent));
    wc.structField.setTarget(wc.structTargetLayout);
    wc.structField.setStagger(0.62);
  }
  // Both regions' fields are visible for the DURATION of the transition regardless of resting rules.
  wc.field.points.visible = true; wc.structField.points.visible = true;
  ct.field.points.visible = true; ct.structField.points.visible = true;
}

// The DATA layout a bundle is showing RIGHT NOW at rest (map view, not mid pie-morph) — year yi→yi+1
// held at whatever t currently is. Used as the drill's break-away/bloom source so the transition
// always launches from exactly what's on screen, honouring the live year/crime/mode.
function liveDataLayout(bundle) {
  const next = (yi + 1) % years.length;
  const a = bundle.layoutsByType[crimeType][yi], b = bundle.layoutsByType[crimeType][next];
  const n = a.density.length, positions = new Float32Array(n * 2), density = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    positions[i * 2] = a.positions[i * 2] + (b.positions[i * 2] - a.positions[i * 2]) * t;
    positions[i * 2 + 1] = a.positions[i * 2 + 1] + (b.positions[i * 2 + 1] - a.positions[i * 2 + 1]) * t;
    density[i] = a.density[i] + (b.density[i] - a.density[i]) * t;
  }
  return { positions, density };
}
// Push each dot radially outward from centre + kill density → invisible resting endpoint. Ported
// unchanged (in spirit) from wcMain.js's away()/xform(scale=2.5, kill=true).
function awayXform(layout) {
  const n = layout.density.length, positions = new Float32Array(n * 2), density = new Float32Array(n);
  for (let i = 0; i < n; i++) { positions[i * 2] = layout.positions[i * 2] * 2.5; positions[i * 2 + 1] = layout.positions[i * 2 + 1] * 2.5; density[i] = 0; }
  return { positions, density };
}

// Re-pose the RESTING (non-drilling, currently-inactive-but-visible) region after an instrument
// change so it doesn't go stale — specifically CT's mini-cluster while resting in the province view.
function syncRestingRegion() {
  if (drilling) return;
  if (region === 'wc' && !pieMode && !triPieMode) layoutCtAsCluster();
}

window.addEventListener('keydown', (e) => {
  if (drilling) return; // input is quiet mid-transition (matches wcMain's `transitioning` gate)
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
// terrainDots/terrainNow — this app has no relief). Region-aware: reads/writes the ACTIVE bundle.
window.__viz = {
  year: (n) => { const i = years.indexOf(n); if (i >= 0) { playing = false; setYearPair(i); t = 0; } },
  t: (v) => { playing = false; t = v; },
  flip: () => flipCrime(1),                                   // cycle crime (robbery↔murder)
  drift: (px) => active().field && active().field.setDrift(px),                 // data swarm — how FAR it strays
  driftSpeed: (m) => active().field && active().field.setDriftSpeed(m),         // data swarm — how FAST (felt-ness)
  stagger: (w) => active().field && active().field.setStagger(w),              // swarm cascade (0=together … ~0.6)
  maxSize: (px) => { const b = active(); if (b.field) b.field.setMaxSize(px); if (b.structField) b.structField.setMaxSize(px); }, // cap dot px on zoom
  shimmer: (a) => { const b = active(); if (b.structField) b.structField.setShimmer(a); },         // structure breath amplitude (0=still)
  shimmerSpeed: (s) => { const b = active(); if (b.structField) b.structField.setShimmerSpeed(s); },
  structDots: (px) => { structDotSize = px; const b = active(); if (b.structField) b.structField.setSize(px); }, // structure dot size
  pieR: (r) => {                                                             // live-tune the pie radius
    const b = active();
    if (r != null) PIE_R = r;
    if (pieMode && b.pieBuilder) {
      const pie = b.pieBuilder(crimeType, yi, { cx: 0, cy: 0, R: PIE_R }); lastPie = pie;
      b.field.setSource({ positions: pie.positions, density: pie.density }); b.field.setTarget({ positions: pie.positions, density: pie.density }); b.field.setT(1);
      if (b.structField) { const f = pieFrameLayout(b.structLayout.density.length, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin }); b.structField.setSource(f); b.structField.setTarget(f); b.structField.setT(1); b.trProg = 1; }
    }
    return PIE_R;
  },
  pieFrame: (dots, thin) => { if (dots != null) pieFrameDots = dots; if (thin != null) pieThin = thin; if (window.__viz) window.__viz.pieR(); return { frameDots: pieFrameDots, thin: pieThin }; },
  triPie: (r, gap) => {                                                       // live-tune the 3-pie radius + spacing
    const b = active();
    if (r != null) TRI_R = r; if (gap != null) TRI_GAP = gap;
    if (triPieMode && b.triPieBuilder) {
      triPieYears = years.map((_, i) => b.triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
      lastTriPie = triPieYears[yi];
      b.field.setSource({ positions: lastTriPie.positions, density: lastTriPie.density });
      b.field.setTarget({ positions: lastTriPie.positions, density: lastTriPie.density }); b.field.setT(1);
      if (b.structField) { const f = triPieFrameLayout(b.structLayout.density.length, { centers: lastTriPie.centers, R: TRI_R, boundaries: lastTriPie.boundaries, frameDots: pieFrameDots, thin: pieThin }); b.structField.setSource(f); b.structField.setTarget(f); b.structField.setT(1); b.trProg = 1; }
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
  station: (name) => {                                                        // debug: find a station's map-local xy
    const s = (active().data.stations || []).find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
    return s ? { name: s.name, x: s.x, y: s.y, dc: s.dc, pop: s.pop } : 'not found';
  },
  matte: (hex) => {                                          // live-tune the structure colour
    const b = active(); if (b.structField) b.structField.material.uniforms.uMatte.value.set(hex);
  },
  hideData: (hide = true) => { const b = active(); if (b.field) b.field.points.visible = !hide; }, // judge structure alone
  region: (r) => { if (r === 'wc' || r === 'ct') startDrill(r); return region; }, // debug: force a drill
};

// ---- hover readout — "Nyanga · 2,300 robbery · 2019/20" (works in map AND pie) ----
// One mechanism, view-agnostic, ACTIVE-region-aware: give each precinct an ANCHOR in field-local
// space (its centroid on the map; its wedge centreline in the pie), project it through the LIVE
// transform (camera) to the screen, and pick the anchor nearest the cursor.
const tip = document.createElement('div');
tip.style.cssText = 'position:fixed;pointer-events:none;z-index:20;padding:4px 9px;border-radius:5px;' +
  'background:rgba(8,10,16,.86);border:1px solid rgba(140,170,210,.28);color:#e4ebf4;' +
  'font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;opacity:0;' +
  'transition:opacity .12s;transform:translate(-50%,calc(-100% - 14px))';
app.appendChild(tip);
const _hv = new THREE.Vector3();
function precinctAnchors() {                                  // [{si, x, y, crime?}] in field-local space
  const bundle = active();
  const out = [], st = bundle.data.stations;
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
  if (drilling || !active().data) return -1;
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
  // Cape Town's 60 stations are less densely packed on-screen than the province's 150 — reuse the
  // same tightened threshold either way (safe for both: it only ever narrows the catch radius).
  return bestD <= (pieMode || triPieMode ? 30 : 34) ? best : -1; // beyond the threshold → empty space
}
let mouseX = null, mouseY = null;
function updateTooltip() {
  if (mouseX == null) return;
  const si = hoverPrecinct(mouseX, mouseY);
  if (si < 0) { tip.style.opacity = '0'; return; }
  const bundle = active();
  const s = bundle.data.stations[si];
  const ct = hoverCrimeType || crimeType;                    // in the 3-pie, the pie under the cursor
  const n = (s.crimes[ct] && s.crimes[ct][years[yi]]) || 0;
  const rate = s.pop ? Math.round((n / s.pop) * 100000) : 0; // per-capita rate per 100k residents
  const val = dataMode === 'percapita' ? `${rate.toLocaleString()} per 100k` : `${n.toLocaleString()} reported`;
  tip.innerHTML = `${s.name} · ${crimeLabels[ct] || ct} · ${yearLabels[yi]}` +
    `<br><span style="color:#9fb0c8">${val}</span>`;
  tip.style.left = mouseX + 'px';
  tip.style.top = mouseY + 'px';
  tip.style.opacity = '1';
}
renderer.domElement.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; updateTooltip(); });
renderer.domElement.addEventListener('mouseleave', () => { mouseX = mouseY = null; tip.style.opacity = '0'; });

// Click handling: (1) in the 3-pie, resolve to the clicked pie; (2) on the WC MAP, clicking the Cape
// Town cluster drills in; (3) on the CT map, clicking empty space drills back out. A tap (not a
// drag/pan) is told from a pan by how far the pointer moved between down and up.
let _downX = 0, _downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { _downX = e.clientX; _downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (drilling) return;
  if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 6) return; // it was a drag (pan), not a click

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

  // Drill gating: ONLY from the map view (not pie/3-pie), matching wcMain's own click-to-drill.
  if (pieMode || triPieMode) return;
  if (region === 'wc') {
    const { s, d } = nearestStation(regions.wc.data.stations, e.clientX, e.clientY);
    if (s && d < 120 && (s.dc || '').toLowerCase() === 'city of cape town') startDrill('ct');
  } else {
    startDrill('wc'); // click empty space (or anywhere) on the CT map → back out to the province
  }
});
function nearestStation(stations, cx, cy) {
  const rect = renderer.domElement.getBoundingClientRect(); const mx = cx - rect.left, my = cy - rect.top;
  fieldGroup.updateWorldMatrix(true, false); let best = null, bestD = Infinity;
  for (const s of stations) { _hv.set(s.x, s.y, 0); fieldGroup.localToWorld(_hv); _hv.project(camera); const sx = (_hv.x * 0.5 + 0.5) * rect.width, sy = (-_hv.y * 0.5 + 0.5) * rect.height; const d = Math.hypot(sx - mx, sy - my); if (d < bestD) { bestD = d; best = s; } }
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

  if (drilling) {
    const p = Math.min((now - drillStart) / DRILL_MS, 1);
    const e = drillEase(p);
    for (const key of ['wc', 'ct']) { const b = regions[key]; b.field.setT(e); b.structField.setT(e); }
    if (p >= 1) {
      drilling = false;
      region = drillTo;
      frameBox();
      const bundle = active();
      bundle.structCurrent = bundle.structTargetLayout;
      // Re-anchor the just-landed region cleanly at rest (map, t=0→1 pair) so scrub/pie/hover are
      // all correct immediately, no dangling drill-endpoint state.
      seedField(bundle, region === 'ct');
      if (drillTo === 'ct') { regions.ct.structCurrent = regions.ct.structTargetLayout; }
      else { regions.wc.structCurrent = regions.wc.structTargetLayout; layoutCtAsCluster(); }
      setRegionVisibility();
      const hintEl = document.getElementById('hint');
      if (hintEl) hintEl.textContent = region === 'ct'
        ? 'Cape Town — click empty space or press M to zoom back out'
        : 'Western Cape — click the Cape Town cluster to zoom in';
      refreshHud();
    }
    for (const key of ['wc', 'ct']) { const b = regions[key]; b.field.setTime(time); b.structField.setTime(time); }
    controls.update();
    render();
    requestAnimationFrame(tick);
    return;
  }

  const bundle = active();

  if (pieMorphing) {
    const p = Math.min((now - pieMorphStart) / PIE_MS, 1);
    t = swarmEase(p);
    if (p >= 1) {
      pieMorphing = false;
      if (!pieMode && !triPieMode) setYearPair(yi);
    }
  } else if (flipping) {
    const p = Math.min((now - flipStart) / FLIP_MS, 1);
    t = easeInOut(p);
    if (p >= 1) {
      flipping = false;
      crimeType = flipTo;
      bundle.layouts = bundle.layoutsByType[crimeType];
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

  bundle.field.setT(t);
  bundle.field.setTime(time);
  if (bundle.structField) {
    if (bundle.trProg < 1) {
      bundle.trProg = Math.min((now - bundle.trStart) / bundle.trDur, 1);
      bundle.structField.setT(swarmEase(bundle.trProg));
      if (bundle.trProg >= 1 && bundle.trTo) bundle.structCurrent = bundle.trTo;
    }
    bundle.structField.setTime(time);
  }
  // Keep the RESTING region's fields ticking too (time-based shimmer/drift) even though they're not
  // morphing — cheap (uniform update only) and keeps the CT cluster's idle twinkle alive.
  const resting = region === 'wc' ? regions.ct : regions.wc;
  resting.field.setTime(time);
  if (resting.structField) resting.structField.setTime(time);

  controls.update();
  updateTooltip();
  updateTriLabels();

  render();

  frames++;
  if (fpsWall < 0) fpsWall = now;
  else if (now - fpsWall >= 500) {
    fpsEl.textContent = Math.round((frames * 1000) / (now - fpsWall)) + ' fps · ' + bundle.field.count.toLocaleString() + ' pts';
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
  for (const key of Object.keys(regions)) {
    const b = regions[key]; if (!b) continue;
    if (b.field) b.field.setPixelRatio(renderer.getPixelRatio());
    if (b.structField) b.structField.setPixelRatio(renderer.getPixelRatio());
  }
});
