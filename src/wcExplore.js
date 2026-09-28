import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointField } from './engine/PointField.js';
import { loadCapeTown, buildCrimeLayouts, buildUnlitLayouts, pieFrameLayout, triPieFrameLayout, terrainViewLayout, bandFor, tollLayouts, tollFrameLayout, tollHandLayout, textLayout, canyonLayout, canyonFrameLayout, flockLayouts, personGridLayout, suburbCaptionLine } from './layouts/capeTown.js';
import RATES from '../data/vocs-reporting.json'; // GPSJS reporting rates + citations — bundled, so the offline single-file build needs no fetch
import { forensicsFrameLayout, forensicsStats, LOOK_CLOSER_D, TESTABLE_MEAN, DIGIT_MIN_N } from './layouts/forensics.js';

/*
 * THE APP — a Western Cape crime field you drill into Cape Town from. (Was the single-region Cape Town app
 * `src/main.js`, generalised so "region" is just another layout; once this became a full superset of that
 * app, `main.js` + its `index.html` were retired — both live in git history, referenced below as "main.js".)
 *
 * FOUNDATION (why this file looks the way it does): a SINGLE conserved data pool + a SINGLE conserved
 * structure pool. "Western Cape" and "Cape Town" are NOT two scenes — they're two LAYOUTS the same dots
 * reconfigure between, exactly like map ⇄ pie ⇄ tri-pie already are. So the whole toolkit (year-scrub,
 * crime-flip, pie, 3-pie, resolve, per-capita, hover) is main.js's proven code UNCHANGED — it just
 * drives the one `field`; a region swap is only another repointing of the layout references (like a
 * mode swap). The drill is one more morph of that conserved field.
 *
 * The conserved slices: each district's stations are a byte-identical subset of the province's 150 (same
 * crime counts, verified), so ordering the province BY DISTRICT makes each district's crime dots a
 * contiguous slice that maps 1:1 onto that district's detail build — the SAME dots in both views. On a
 * drill they simply travel (province cluster ⇄ full detail); every OTHER district's crime has no detail to
 * zoom into, so it honestly breaks away (flies out + fades) and flies back on the way out. Structure is
 * one pool whose province outline reconfigures into the district's outline. Camera is DEAD STILL — framed
 * to the union of the boxes once; the drill is entirely in the dots, never the lens (wcMain.js's
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
// Tone mapping = graceful highlight roll-off. The data field is ADDITIVE, so dense cores (Cape Town) sum
// far past 1.0; without this they hard-clip to a featureless white splat that swallows the blue→gold ramp.
// The composers render in half-float (HDR), so the OutputPass tone-maps the true summed values — the core
// resolves to a soft graduated glow instead of a hard splat. NEUTRAL (Khronos PBR) preserves hue into the
// highlights better than ACES's white-shift, so the gradient (the read) survives. Exposure is the master
// brightness — Neutral crushes the low end, so we expose UP from there (tune live via __viz.expo).
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 5.5; // bright enough to READ on a normal monitor; the molten ramp + Neutral
//                                     roll-off keep Cape Town's core amber (not a white splat) at this level.
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
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.65, 0.0);
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
let field = null;          // DATA (glow). Province = all 150; a district view = its own contiguous SLICE of the field.
let structField = null;    // STRUCTURE (grey matte). Province outline ⇄ the active district's outline. One conserved pool.
let wordField = null; const WORD_N = 22000; // the toll's memorial WORD — a dim structure backdrop BEHIND the disc
let COUNT = 0;             // total data slots. Field is ordered BY DISTRICT (Cape Town first); each district a slice.
let awayAll = null;        // ALL province dots pushed out ×2.5 (density 0) — the base a district's lift() overwrites.
let structN = 0;           // structure dot budget (the province outline's) — the shared pool's size.
const outlines = {};       // structN-sized structure poses: outlines.wc (province) + one per district (detail outline, cycled dense).
const slices = {};         // each district's dot range in the province field: { ct:[start,count], winelands:[...], ... }.
const stationsByRegion = {}; // { wc, ct, winelands, ... } — station lists for hover + click hit-testing.

// The regions you can drill into: Cape Town (its own richer capetown.json + a DEM) + the five districts
// from wc-districts.json. Cape Town is FIRST so its slice stays [0, ctCount) — where the DEM's aZ lives.
const DETAIL_REGIONS = ['ct', 'winelands', 'westcoast', 'gardenroute', 'overberg', 'karoo'];
const REGION_META = {
  wc: { name: 'Western Cape' },
  ct: { name: 'Cape Town', dc: 'city of cape town' },
  winelands: { name: 'Cape Winelands', dc: 'cape winelands' },
  westcoast: { name: 'West Coast', dc: 'west coast' },
  gardenroute: { name: 'Garden Route', dc: 'garden route' },
  overberg: { name: 'Overberg', dc: 'overberg' },
  karoo: { name: 'Central Karoo', dc: 'central karoo' },
};
const dcToRegion = (dc) => DETAIL_REGIONS.find((k) => REGION_META[k].dc === norm(dc)) || null;

// A "provider" is a region's { raw, percapita } layout builds. The province build is COUNT-sized (all 150);
// each district build is its own smaller size, written into that district's slice by partial writes (only
// lift()ed to COUNT at the drill boundary + the landing seed, where both endpoints must be full-size).
const providers = {}; // { wc, ct, winelands, westcoast, gardenroute, overberg, karoo }
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

// ---- the PULSE (monthly mode) — 60 calendar months, Apr 2021 – Mar 2026 ----------------------------
// A month is just another layout of the same conserved pool (~1/12 of the dots active, the rest at the
// roost). Layouts are built lazily per crime by the provider (see capeTown.js monthly()).
let pulseMode = false, mi = 0, pulseData = null, monthLabels = null;
const PULSE_MS = 480, PULSE_HOLD = 70; // month crossing + hold → ~1.8 months/sec, full sweep ≈ 33s (maker-tuned: calmer)
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtMonth = (label) => { const [y, m] = label.split('-'); return `${MONTH_NAMES[+m - 1]} ${y}`; };
// ---- FOCUS (stand in your suburb, H) — one precinct lit, the rest of the field dimmed --------------
// Mirrors the pulse's mode grammar (enter/exit through the same at-rest machinery), but the dimming is
// a pure density post-pass (focusLayout) riding EVERY door write — so year scrubs, crime flips and
// per-capita all stay focused for free. Exits: H, Esc, M; drills/pulse/pies exit focus first (snap,
// the drill-from-pulse precedent). Never composes with the pulse or the pies.
let focusMode = false, focusStation = -1;   // index into activeStations() (== the build's slotRanges)
const FOCUS_DIM = 0.12;                     // every OTHER station's density ×0.12 — dim, never hidden
let focusScratch = null, focusPing = 0;     // two COUNT-sized density buffers (a door write needs src+tgt)
let beaconField = null;                     // small structure-voiced ring marking the focused station
const BEACON_N = 420;
// "One in Forty-Three" — the focused precinct's POPULATION stands up as a rough grey grid among the
// year's crime dots. 1 grey dot = 100 residents, DECLARED on screen (the caption); STRUCTURE-voiced
// (matte, no glow — people are scale, never crime). Auto-shown on focus; J hides it if it fights the eye.
let peopleField = null, peopleOn = true, PEOPLE_N = 0;
const PEOPLE_PER_DOT = 100;
let plStart = 0, plProg = 1;                // the stand-up morph's clock (collapsed → grid)
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
// ---- the FORENSICS STRIP (X) — statistics about the statistics --------------------------------------
// Stations as ranked ribbons of their 60 monthly returns, sorted by dispersion D (crystalline LEFT).
// Counts, not rates, are what tallies are — per-capita no-ops here; pies/pulse/terrain guarded off.
let forensicsBuilder = null, forensicsMode = false, lastForensics = null;
let hoverCrimeType = '';
let structDotSize = 1.6;

// Structure swarm transition (one pool; map outline ⇄ pie frame ⇄ Cape Town outline).
let structCurrent = null, strProg = 1, strStart = 0, strDur = 2400, strTo = null, strStagger = 0.6;

// ---- terrain (Cape Town ONLY — the province has no DEM) --------------------------------------------
// A SEPARATE relief pool, ported from main.js and gated to region==='ct'. structField (the conserved
// drill pool) is never touched: on 'T' we swap the CT outline for this pool at its band pose — which
// bandFor() strews along the SAME capetown.structure outline, so the swap is invisible — then morph
// band → relief. Crime climbs via the data field's own per-dot heights (aZ, set for the city slice).
let terrainField = null;
const regionData = {}; // the DATA object (with terrain DEM + box) per region — terrain reads the current region's here
let terrainMode = false, zScaleCur = 0, tiltCur = 0;
const zPeak = 11.5, tiltAngle = -0.62; // true-1:1 relief height + view tilt (from main.js)
const bandW = 0.4, terrainDotSize = 2.5, GX = 432, GY = 378; // fixed relief dot budget (163,296)
let terrainTargetLayout = null, terrainCurrent = null;
let trProg = 1, trStart = 0, trDur = 950, trTo = null;

// ---- the CANYON ('V') — time as the landform ---------------------------------------------------------
// x = the 18 SAPS years, y = the precincts (district blocks, north→south), height = PER-CAPITA rate;
// the 2020/21 lockdown reads as ONE valley cutting across the whole range. A separate DATA-role pool
// (it GLOWS — this is the crime re-arranged, not geography), risen/tilted with the terrain's easing.
// Per-capita ONLY: raw heights would render population, not story. Dots are SAMPLES of the rate
// surface — the one view where dot count carries no volume, declared aloud in the hint.
let canyonField = null, canyonMode = false, canyonZCur = 0, canyonOp = 0;
let canyonCur = null;                        // the layout on the pool (anchors → hover, grid → labels)
let canyonCache = { key: '', layout: null }; // ONE (region, crime) build resident — the pulse's cache pattern
let canyonFlipTo = '';                       // pending crime flip — the swap hides at zero height (see tick)
let cnProg = 1, cnStart = 0, cnTo = null;    // canyon pool crossfade clock (trProg's pattern)
const CN_MS = 800, CANYON_DOTS = 48;         // crossfade ms · dots per province cell (150×18×48 = 129,600 pool)
let canyonZPeak = 260;                       // rate-surface height — a DATA axis, not geography. 90 read as a
//                                              flat sheet at the framed distance; 260 gives the range walls
//                                              (maker's eye: tune live via __viz.canyonZ)

// ---- THE UNLIT FIELD — the third role: ESTIMATED ABSENCE -------------------------------------------
// 'U' on a map view condenses the survey-implied UNREPORTED crimes out of the dark: U = R×(1−r)/r per
// station-year (rates + full citations in data/vocs-reporting.json; the rate is national and applied
// uniformly — declared on the chip and the About card). Its own pool: NO glow, normal blending, dim
// slate-violet, flat density — never data (no glow, no density read), never frame (violet, count-true).
// Blocked in pies/pulse/terrain (v1); murder + commercial have no survey rate, so U shows a one-line
// note instead of dots — excluded, never guessed.
let unlitField = null;
const unlitProviders = {}; // per region — same conserved-slot grammar as the crime providers
const unlitSlices = {};    // each district's slot range in the province unlit pool (mirrors `slices`)
let UNLIT_COUNT = 0;
let unlitOn = false;       // user INTENT — survives crime flips (an excluded crime shows the note; dots return after)
let unlitShown = false;    // dots actually condensed (pool visible)
let unlitProg = 1, unlitStart = 0, unlitPhase = null; // own clock for condense-in / disperse-out
const UNLIT_MS = 1600;
let unlitSrc = null, unlitTgt = null; // CPU copies of the live endpoints (mid-flight captures need them)

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
  const txt = flockMode ? (flockPhase === 'land' ? 'the field lands…' : (attractMode ? 'press any key' : 'F or tap → land'))
    : tollMode
    ? (tollPhase === 'gather' ? 'the years are gathering…'
      : tollPhase === 'drain' || tollPhase === 'home' ? 'the murders return to the map…'
        : tollDone ? 'the toll stands · scrub the dial back · K returns them to the map'
          : (tollHoldPtr || tollHoldKey) ? 'one recorded murder per second — release to resume the sweep'
            : tollPaused ? 'paused — space resumes · drag the dial · K ends the toll'
              : 'drag the dial to scrub · hold the disc (or 1) for one per second · space pauses · K ends the toll')
    : canyonMode ? 'a surface of rates — height is the data · ↑↓ crime · V or tap → flat map'
    : terrainMode ? 'T or tap → flat map'
      : pulseMode ? '←→ month · space play/pause · N or M → years'
      : focusMode ? '←→ year · scroll in close · J neighbours · H or Esc lets go'
      : forensicsMode ? 'colour + width = statistical liveliness (D), not volume · ↑↓ crime · hover · X or M → map'
        : (pieMode || triPieMode) ? 'press M for the map'
          : region !== 'wc' ? 'N months · T terrain · click empty space (or M) to zoom out'
            : 'N months · T terrain · click any area to zoom in';
  if (txt !== _lastHint) { hintEl.textContent = txt; _lastHint = txt; }
}

// Point every builder + layout reference at the active region's build for the current mode. Called on
// a mode swap (C) AND on a region change (a drill lands) — region is just another axis of the same
// repointing that main.js already does for raw ⇄ per-capita.
function repoint() {
  const b = providers[region][dataMode];
  layoutsByType = b.layouts; totalsByType = b.totals;
  pieBuilder = b.pieLayout; triPieBuilder = b.triPieLayout; resolvePieBuilder = b.resolvePieLayout;
  forensicsBuilder = b.forensicsLayout; // mode-independent inside (tallies are raw counts by construction)
  layouts = layoutsByType[crimeType];
}
function applyMode(mode) { dataMode = mode; repoint(); }

// Lift a district's detail layout into a full COUNT-sized pose: its dots fill THAT district's slice, every
// other slot sits parked-away (density 0). Only needed at the drill boundary + the landing seed (both
// endpoints must be full-size); the resting toolkit writes only the district's slice (partial write).
function lift(regionKey, l) {
  const positions = new Float32Array(COUNT * 2), density = new Float32Array(COUNT);
  positions.set(awayAll.positions, 0);           // start with EVERYTHING broken-away (density 0)
  const start = slices[regionKey][0];
  positions.set(l.positions, start * 2);         // the district's slice = its detail
  density.set(l.density, start);
  return { ...l, positions, density };
}
// A region's CURRENT map pose (year yi→yi+1 at the live t), COUNT-sized — the drill's break-away/bloom
// endpoint. The province is already COUNT-sized; a district is lifted (the rest of the field parked-away).
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
  return reg === 'wc' ? live : lift(reg, live);
}
const structRest = () => outlines[region] || outlines.wc;
// ONE door for AT-REST data-field writes (year scrub, crime/mode flips, pies, pulse): the province
// writes full-size at offset 0; a district writes ONLY its conserved slice — everything outside it
// keeps the parked-away pose landing gave it. This partial-write trick used to be correct by
// COINCIDENCE (Cape Town's slice starts at 0, so offset-0 writes landed in the right slots); for the
// other five districts it silently wrote into Cape Town's slots and left the real slice frozen. The
// door makes the offset explicit. Boundary crossings (landRegion, startDrill) still write the FULL
// buffer via lift()/liveMap().
const sliceStart = () => (region === 'wc' ? 0 : slices[region][0]);
// While focused, the door itself applies the dim post-pass — one hook, every at-rest write covered.
function setDataPair(src, tgt) {
  const o = sliceStart();
  field.setSource(focusMode ? focusLayout(src) : src, o);
  field.setTarget(focusMode ? focusLayout(tgt) : tgt, o);
}
// Pure post-pass for the focus dim: same positions, every OTHER station's densities ×factor. Takes any
// region-sized layout (the door's slice offset decides WHERE it lands in the shared field, so station
// slot ranges stay build-local). Ping-pongs two pre-allocated scratch buffers — one door write dims
// src AND tgt, and they must not alias.
function focusLayout(layout, si = focusStation, factor = FOCUS_DIM) {
  if (!focusScratch) focusScratch = [new Float32Array(COUNT), new Float32Array(COUNT)];
  const den = focusScratch[(focusPing ^= 1)];
  const n = layout.density.length;
  const [b0, k] = providers[region][dataMode].slotRanges[si];
  for (let i = 0; i < n; i++) den[i] = layout.density[i] * factor;
  for (let i = b0, e = b0 + k; i < e; i++) den[i] = layout.density[i];
  return { positions: layout.positions, density: den.subarray(0, n) };
}
// Cycle a detail outline (its own point count) up to structN dots so the frame is a DENSE line, not sparse.
function cycleOutline(structure, n) {
  const cN = structure.length / 2, pos = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const j = (i % cN) * 2;
    pos[i * 2] = structure[j] + (Math.random() - 0.5) * 1.4;
    pos[i * 2 + 1] = structure[j + 1] + (Math.random() - 0.5) * 1.4;
  }
  return { positions: pos, density: new Float32Array(n).fill(0.4) };
}

// ---- boot -------------------------------------------------------------------
init();
async function init() {
  const [wcRaw, ctRaw, wcDist] = await Promise.all([
    loadCapeTown('data/westerncape.json'), loadCapeTown('data/capetown.json'), loadCapeTown('data/wc-districts.json'),
  ]);
  years = wcRaw.meta.years;
  yearLabels = wcRaw.meta.yearLabels || years;
  monthLabels = (wcRaw.meta.monthly && wcRaw.meta.monthly.labels) || null; // the pulse's clock
  mi = monthLabels ? monthLabels.length - 12 : 0;                          // enter on the latest full year's start
  crimeTypes = (wcRaw.meta.crimeTypes || [{ key: 'robbery', label: 'robbery' }]).map((c) => c.key);
  crimeLabels = Object.fromEntries((wcRaw.meta.crimeTypes || []).map((c) => [c.key, c.label]));
  crimeType = crimeTypes[0];
  const T = crimeTypes;

  // Detail data per drillable region — Cape Town from its own capetown.json (rich + DEM), the five
  // other districts from wc-districts.json.
  const detailData = { ct: ctRaw };
  // The five district detail objects carry stations + structure but no `meta` (it lives top-level in
  // wc-districts.json). buildCrimeLayouts needs data.meta.years, so graft the province meta on — it has
  // identical years + crimeTypes (verified). Cape Town brings its own richer meta.
  for (const rk of DETAIL_REGIONS) if (rk !== 'ct') detailData[rk] = { ...wcDist.districts[rk], meta: wcRaw.meta };

  // Order the province stations BY DISTRICT (Cape Town first), each district in its own detail's station
  // order, so every district's crime dots form a contiguous conserved SLICE that lines up dot-for-dot with
  // that district's detail build. stationsByRegion holds each region's own station list (hover + click).
  const orderedStations = [];
  for (const rk of DETAIL_REGIONS) {
    const order = new Map(detailData[rk].stations.map((s, i) => [norm(s.name), i]));
    const provStations = wcRaw.stations.filter((s) => norm(s.dc) === REGION_META[rk].dc)
      .sort((a, b) => order.get(norm(a.name)) - order.get(norm(b.name)));
    orderedStations.push(...provStations);
    stationsByRegion[rk] = detailData[rk].stations;
  }
  const provinceData = { ...wcRaw, stations: orderedStations };
  stationsByRegion.wc = orderedStations;

  // Builds: the province (all 150, district-ordered) + each district's own detail.
  providers.wc = { raw: buildCrimeLayouts(provinceData, { types: T, mode: 'raw' }), percapita: buildCrimeLayouts(provinceData, { types: T, mode: 'percapita' }) };
  for (const rk of DETAIL_REGIONS) providers[rk] = { raw: buildCrimeLayouts(detailData[rk], { types: T, mode: 'raw' }), percapita: buildCrimeLayouts(detailData[rk], { types: T, mode: 'percapita' }) };
  COUNT = providers.wc.raw.count;

  // Each district's dot SLICE in the province field (cumulative; a district's dot count = its own build's
  // count, which matches the province slice — same stations, same crime data → same K).
  let cur = 0;
  for (const rk of DETAIL_REGIONS) { const c = providers[rk].raw.count; slices[rk] = [cur, c]; cur += c; }
  if (cur !== COUNT) console.warn('[wc] district slices don\'t sum to COUNT', { cur, COUNT });
  // buildCrimeLayouts tags each map layout with a per-build `z` (each region samples its own DEM). A
  // district's z is district-sized — uploading it as aZ onto the COUNT-sized shared field would break the
  // draw — and we manage the lift ourselves anyway, so strip z here. fillAZ() writes the CURRENT region's
  // relief into the field's aZ on demand; uZScale drives the lift (0 = flat map, eased up in a terrain view).
  for (const rk of ['wc', ...DETAIL_REGIONS]) for (const mode of ['raw', 'percapita']) {
    const b = providers[rk][mode];
    for (const ty of Object.keys(b.layouts)) for (const L of b.layouts[ty]) delete L.z;
  }

  // Break-away rest — ALL province dots pushed out ×2.5 (off-frame), density 0. Drilling into a district
  // flies every OTHER district's dots out to here (and back on the way out); lift() overwrites the active
  // district's slice with its detail.
  awayAll = { positions: new Float32Array(COUNT * 2), density: new Float32Array(COUNT) };
  const ref = providers.wc.raw.layouts[crimeType][0].positions;
  for (let i = 0; i < COUNT * 2; i++) awayAll.positions[i] = ref[i] * 2.5;

  // Structure poses — the province outline + one per district (its own detail outline, cycled up to the
  // province's dot budget so every frame is a DENSE line). One conserved pool reconfigures between them.
  structN = wcRaw.structure.length / 2;
  outlines.wc = { positions: Float32Array.from(wcRaw.structure), density: new Float32Array(structN).fill(0.4) };
  for (const rk of DETAIL_REGIONS) outlines[rk] = cycleOutline(detailData[rk].structure, structN);

  field = new PointField(COUNT, { glow: true, size: 1.9 });
  field.setPixelRatio(renderer.getPixelRatio());
  field.setDrift(0.5);
  field.setDriftSpeed(2.0);
  field.setMaxSize(7);
  field.points.layers.enable(BLOOM_LAYER);
  fieldGroup.add(field.points);

  structField = new PointField(structN, { glow: false, size: structDotSize, matte: '#566d78' }); // desaturated slate — structure must RECEDE (the old green competed with the data)
  structField.setPixelRatio(renderer.getPixelRatio());
  structField.setDrift(0.0);
  structField.setMaxSize(7);
  fieldGroup.add(structField.points);

  // The toll's memorial WORD: a structure pool (grey, matte, NO glow — a word is a LABEL, never a data
  // claim) that renders BEHIND everything (renderOrder -2) so the glowing disc always sits in front of
  // it — "sent backwards", not dimmed into submission. Hidden except during the toll ceremony.
  wordField = new PointField(WORD_N, { glow: false, size: 1.4, matte: '#3a4656' });
  wordField.setPixelRatio(renderer.getPixelRatio());
  wordField.setDrift(0.0);
  wordField.setMaxSize(6);
  wordField.points.renderOrder = -2;
  wordField.points.visible = false;
  fieldGroup.add(wordField.points);

  // Per-dot relief height on the DATA field, filled per region by fillAZ() when terrain is on (0 at rest).
  field.points.geometry.setAttribute('aZ', new THREE.BufferAttribute(new Float32Array(COUNT), 1));

  // The unlit pool — one per-region builder set, exactly the crime providers' pattern: the province
  // build IS the pool, each district a conserved contiguous slice (byte-identical crime subsets →
  // identical per-station slot counts; the sum-check guards that assumption like `slices` does).
  unlitProviders.wc = buildUnlitLayouts(provinceData, RATES, { types: T });
  for (const rk of DETAIL_REGIONS) unlitProviders[rk] = buildUnlitLayouts(detailData[rk], RATES, { types: T });
  UNLIT_COUNT = unlitProviders.wc.count;
  let uc = 0;
  for (const rk of DETAIL_REGIONS) { unlitSlices[rk] = [uc, unlitProviders[rk].count]; uc += unlitProviders[rk].count; }
  if (uc !== UNLIT_COUNT) console.warn('[unlit] district slices don\'t sum to the pool', { uc, UNLIT_COUNT });

  unlitField = new PointField(UNLIT_COUNT, { glow: false, size: 1.55, matte: '#55496b' }); // dim slate-violet — apart from structure slate AND every data ramp hue
  unlitField.setPixelRatio(renderer.getPixelRatio());
  unlitField.setDrift(0.0);      // still, like the frame — a drifting shadow would read as data
  unlitField.setShimmer(0.35);   // calmer than the frame's breath: present, not twinkling
  unlitField.setMaxSize(7);
  unlitField.points.visible = false;
  fieldGroup.add(unlitField.points);

  // regionData: the DATA object (with terrain DEM + box) per drillable region — the terrain code reads the
  // CURRENT region's relief here. Province + Cape Town got their elev via loadCapeTown; the five districts
  // keep terrain nested in wc-districts.json, so load each district's DEM bin now (tolerant when offline).
  Object.assign(regionData, detailData, { wc: wcRaw });
  await Promise.all(DETAIL_REGIONS.filter((rk) => rk !== 'ct').map((rk) => loadRegionDEM(regionData[rk])));
  region = 'wc';

  // Terrain relief pool — ONE GX×GY grey field that reconfigures to the active region's relief (hidden
  // until 'T'); reseedTerrain() rebuilds its band + relief target for each region. Seed the province now.
  terrainField = new PointField(GX * GY, { glow: false, size: terrainDotSize, matte: '#566d78' });
  terrainField.setPixelRatio(renderer.getPixelRatio());
  terrainField.setDrift(0.0);
  terrainField.setMaxSize(7);
  terrainField.points.visible = false;
  fieldGroup.add(terrainField.points);
  reseedTerrain();

  // The canyon pool ('V') — DATA role: it glows and blooms (crime re-shaped, never structure). Sized
  // ONCE to the province's cells; a district build re-spreads the same budget over its fewer, taller
  // cells (area-constant sampling in canyonLayout), so no region ever needs a resize. Hidden until V.
  canyonField = new PointField(stationsByRegion.wc.length * years.length * CANYON_DOTS, { glow: true, size: 1.9 });
  canyonField.setPixelRatio(renderer.getPixelRatio());
  canyonField.setDrift(0.25); // a landform breathes less than the map swarm
  canyonField.setMaxSize(7);
  canyonField.points.layers.enable(BLOOM_LAYER);
  canyonField.points.visible = false;
  fieldGroup.add(canyonField.points);
  // FOCUS beacon — a thin grey ring (structure voice: matte, NO glow) at the focused station; its
  // "pulse" is the existing structure shimmer, just breathing faster. Hidden until H focuses somewhere.
  beaconField = new PointField(BEACON_N, { glow: false, size: 1.7, matte: '#566d78' });
  beaconField.setPixelRatio(renderer.getPixelRatio());
  beaconField.setDrift(0.0);
  beaconField.setMaxSize(7);
  beaconField.setShimmer(0.85);     // a felt beat — the beacon must be findable from province zoom
  beaconField.setShimmerSpeed(2.4);
  beaconField.points.visible = false;
  fieldGroup.add(beaconField.points);

  // People pool — sized once to the most populous precinct (Mitchells Plain ≈ 243k → ~2.4k dots at
  // 1:100); every focus fills round(pop/100) of it and parks the rest. All 300 baked station records
  // are drawn from these same 150 stations, so the province list bounds every region's needs.
  const maxPop = Math.max(...stationsByRegion.wc.map((s) => s.pop || 0));
  PEOPLE_N = Math.round(maxPop / PEOPLE_PER_DOT);
  peopleField = new PointField(PEOPLE_N, { glow: false, size: 1.3, matte: '#566d78' });
  peopleField.setPixelRatio(renderer.getPixelRatio());
  peopleField.setDrift(0.0);
  peopleField.setMaxSize(7);
  peopleField.setShimmer(0.3);      // barely breathing — a standing crowd, not a twinkle
  peopleField.setShimmerSpeed(0.6);
  peopleField.points.visible = false;
  fieldGroup.add(peopleField.points);

  applyMode('raw');
  frameUnion(wcRaw.meta.box, ctRaw.meta.box);
  landRegion(); // seed the province at rest
  enterFlock(true); // the page OPENS released — a nameless swarm; any key or tap lands it into the data
  lastInputAt = performance.now();

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
  if (region === 'wc') {
    field.setSource(layouts[yi]);
    field.setTarget(layouts[next]);
  } else {
    field.setSource(lift(region, layouts[yi]));
    field.setTarget(lift(region, layouts[next]));
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

// ---- terrain (Cape Town only) -----------------------------------------------
function terrainRelief() {
  const d = regionData[region];
  const { w: W, h: H } = d.meta.box;
  return terrainViewLayout(d, { cx: 0, cy: 0, hw: W / 2, hh: H / 2 }, GX, GY);
}
function startTerrainTransition(toLayout) {
  terrainField.setSource(terrainCurrent);
  terrainField.setTarget(toLayout);
  terrainField.setStagger(0.6);
  trTo = toLayout; trStart = performance.now(); trProg = 0;
}
// 'T' inside Cape Town toggles the relief. Swap the CT outline (structField) for the terrain pool at its
// coincident band, rise band → relief; on the way back, sink to band, then tick swaps the outline back.
function toggleTerrain() {
  const d = regionData[region];
  if (!d || !d.terrain || !d.terrain.elev || pieMode || triPieMode || drilling || tollMode || canyonMode || flockMode || forensicsMode) return; // any region WITH a DEM
  terrainMode = !terrainMode;
  if (terrainMode) {
    unlitBlock(); // no estimate on the relief (v1) — flat maps only
    structField.points.visible = false;
    terrainField.points.visible = true;
    terrainTargetLayout = terrainRelief();
    fillAZ();                                                          // crime climbs THIS region's relief
    startTerrainTransition(terrainTargetLayout);                        // band → relief (rises via the zScale ease)
  } else {
    startTerrainTransition(bandFor(d, terrainTargetLayout, { band: bandW })); // relief → band
  }
  refreshHint();
}
function demHeightAt(x, y) { // normalised DEM height (0..1) at a map-local point in the CURRENT region
  const d = regionData[region], T = d && d.terrain; if (!T || !T.elev) return 0;
  const { w: W, h: H } = d.meta.box;
  const gi = Math.max(0, Math.min(T.cols - 1, Math.round(((x + W / 2) / W) * (T.cols - 1))));
  const gj = Math.max(0, Math.min(T.rows - 1, Math.round(((H / 2 - y) / H) * (T.rows - 1))));
  const e = T.elev[gj * T.cols + gi];
  return e > 0 && T.peak ? e / T.peak : 0;
}
// Load a region's DEM bin (Int16 elevation) into data.terrain.elev — the province + Cape Town get theirs
// via loadCapeTown, but the districts' terrain is nested in wc-districts.json. Tolerant: in the offline
// single-file build fetch is blocked, so terrain just stays unavailable for those regions.
async function loadRegionDEM(data, baseDir = 'data/') {
  const T = data && data.terrain;
  if (!T || !T.dem || T.elev) return;
  try { const res = await fetch(baseDir + T.dem); if (res.ok) T.elev = new Int16Array(await res.arrayBuffer()); }
  catch { /* offline: no terrain for this region */ }
}
// Write the CURRENT region's relief height (0..1) into each shown dot's aZ, so the crime climbs the
// mountains in register. Province = all COUNT dots; a district = just its conserved slice (rest stays 0).
function fillAZ() {
  if (!field) return;
  const attr = field.points.geometry.getAttribute('aZ'), arr = attr.array;
  arr.fill(0);
  const pos = (pulseMode && pulseData ? pulseData.layouts[mi] : layouts[yi]).positions; // heights follow the SHOWN dots
  if (region === 'wc') { for (let i = 0; i < COUNT; i++) arr[i] = demHeightAt(pos[i * 2], pos[i * 2 + 1]); }
  else { const [start, k] = slices[region]; for (let m = 0; m < k; m++) arr[start + m] = demHeightAt(pos[m * 2], pos[m * 2 + 1]); }
  attr.needsUpdate = true;
}
// On landing in a region, rebuild the relief pool for THAT region (band + relief target) so 'T' shows its
// mountains. Always lands flat (terrain off); the rise + fillAZ happen when the user toggles T.
function reseedTerrain() {
  if (!terrainField) return;
  terrainMode = false; zScaleCur = 0; tiltCur = 0; trProg = 1; fieldGroup.rotation.x = 0;
  terrainField.points.visible = false;
  if (structField) structField.points.visible = true;
  if (field) field.setZScale(0);
  const d = regionData[region];
  if (d && d.terrain && d.terrain.elev) {
    terrainTargetLayout = terrainRelief();
    terrainCurrent = bandFor(d, terrainTargetLayout, { band: bandW });
    terrainField.setSource(terrainCurrent);
    terrainField.setTarget(terrainCurrent);
    terrainField.setT(1);
    terrainField.setZScale(0);
  }
}

// ---- the canyon: enter/exit + the (region, crime) build ---------------------------------------------
// Build (or reuse) THIS (region, crime)'s rate surface. One build resident at a time — a flip or a
// later re-entry after a drill evicts it (the pulse's monthly() cache is the pattern; a build is
// ~130k dots × bilinear sampling, cheap to redo, expensive to hoard).
function canyonRates() {
  const key = region + '·' + crimeType;
  if (canyonCache.key !== key) {
    canyonCache = {
      key,
      layout: canyonLayout(canyonField.count, stationsByRegion[region], years, crimeType, regionData[region].meta.box),
    };
  }
  return canyonCache.layout;
}
// 'V' on a flat map toggles the canyon. The map's data swarm parks away off-frame (the drill's
// break-away grammar — the canyon IS the same crime re-shaped, so showing both would double-count
// it); the canyon pool fades in flat and RISES via the terrain's zScale easing; the structure pool
// reconfigures into the year/district graticule. Exit reverses all three.
function toggleCanyon() {
  if (!canyonField || !field || pieMode || triPieMode || pulseMode || terrainMode || tollMode || flockMode || forensicsMode || drilling || flipping) return;
  canyonMode = !canyonMode;
  playing = false; morphStart = -1;
  if (canyonMode) {
    unlitBlock();                              // the estimate leaves with the map it shadows
    if (focusMode) exitFocus(false);           // the canyon re-shapes the whole crime — no single precinct to stand in
    canyonCur = canyonRates();
    canyonField.setSource(canyonCur);
    canyonField.setTarget(canyonCur);
    canyonField.setT(1);
    canyonField.setZScale(0);
    canyonField.setOpacity(0);                 // fades in as it rises (tick's canyon block)
    canyonField.points.visible = true;
    field.setSource(liveMap(region));          // park the map swarm from its LIVE pose (mid-morph safe)
    field.setTarget(awayAll);
    field.setStagger(0.6);
    structField.setSize(PIE_LINE_SIZE);
    startStructTransition(canyonFrameLayout(structN, { grid: canyonCur.grid, seams: canyonCur.seams }));
  } else {
    if (canyonFlipTo) { // a pending flip leaves WITH you — never a stale swap ticking under the map
      crimeType = canyonFlipTo; canyonFlipTo = '';
      layouts = layoutsByType[crimeType];
    }
    field.setSource(awayAll);                  // the swarm flies home to the map it left
    field.setTarget(region === 'wc' ? layouts[yi] : lift(region, layouts[yi]));
    field.setStagger(0.6);
    structField.setSize(structDotSize);
    startStructTransition(structRest());
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true; // completion re-anchors the year pair on exit
  refreshHud();
  updateFlag();
}

// ---- the unlit field: toggle + morphs ----------------------------------------------------------
// Pool-sized layout for the CURRENT region at year index yiArg — a district's build is lifted into
// its conserved slice, every other slot parked at the province roosts (lift()'s grammar, own pool).
function unlitLift(regionKey, l) {
  const d = unlitProviders.wc.disperse();
  const positions = new Float32Array(UNLIT_COUNT * 2), density = new Float32Array(UNLIT_COUNT);
  positions.set(d.positions, 0);
  const start = unlitSlices[regionKey][0];
  positions.set(l.positions, start * 2);
  density.set(l.density, start);
  return { positions, density };
}
function unlitL(yiArg, type = crimeType, mode = dataMode) {
  const l = unlitProviders[region].layout(type, yiArg, mode);
  return region === 'wc' ? l : unlitLift(region, l);
}
const unlitRoost = () => (region === 'wc' ? unlitProviders.wc.disperse() : unlitLift(region, unlitProviders[region].disperse()));
// The one door for the pool's GPU endpoints — keeps CPU copies so a mid-flight change can capture
// the live pose instead of snapping (liveMap's job, for this pool).
function unlitSet(a, b) {
  unlitSrc = a; unlitTgt = b;
  unlitField.setSource(a); unlitField.setTarget(b);
}
function unlitLive() { // current interpolated pose (stagger ignored — same approximation as liveMap)
  if (!unlitSrc) return unlitRoost();
  const p = unlitProg < 1 ? swarmEase(unlitProg) : t;
  const positions = new Float32Array(UNLIT_COUNT * 2), density = new Float32Array(UNLIT_COUNT);
  for (let i = 0; i < UNLIT_COUNT; i++) {
    positions[2 * i] = unlitSrc.positions[2 * i] + (unlitTgt.positions[2 * i] - unlitSrc.positions[2 * i]) * p;
    positions[2 * i + 1] = unlitSrc.positions[2 * i + 1] + (unlitTgt.positions[2 * i + 1] - unlitSrc.positions[2 * i + 1]) * p;
    density[i] = unlitSrc.density[i] + (unlitTgt.density[i] - unlitSrc.density[i]) * p;
  }
  return { positions, density };
}
function unlitAnchorPair() { // fall in step with the year pair — the shadow scrubs WITH the reported field
  unlitSet(unlitL(yi), unlitL((yi + 1) % years.length));
  unlitField.setT(t);
}
function unlitCondense() { // in from the roosts (or from mid-disperse — the live capture reverses smoothly)
  const from = unlitShown ? unlitLive() : unlitRoost();
  unlitShown = true;
  unlitField.points.visible = true;
  unlitField.setStagger(0.6);
  unlitSet(from, unlitL(yi));
  unlitPhase = 'in'; unlitStart = performance.now(); unlitProg = 0;
}
function unlitDisperse() { // fly home to the roosts, dimming out on the way; tick hides on arrival
  unlitField.setStagger(0.6);
  unlitSet(unlitLive(), unlitRoost());
  unlitPhase = 'out'; unlitStart = performance.now(); unlitProg = 0;
}
function hideUnlitNow() {
  unlitShown = false; unlitPhase = null; unlitProg = 1;
  if (unlitField) unlitField.points.visible = false;
}
// Reconcile the shadow with the CURRENT crime/mode/year/region — called wherever the map re-anchors
// at rest (setYearPair). Intent survives an excluded crime: the note shows, the dots return on the
// next included crime.
function unlitAfterAnchor() {
  if (!unlitField || !unlitOn) { updateUnlitChip(); return; }
  if (pieMode || triPieMode || pulseMode || terrainMode || tollMode || canyonMode || flockMode || focusMode || forensicsMode || drilling) return;
  if (!RATES.rates[crimeType]) { if (unlitShown) hideUnlitNow(); }
  else if (!unlitShown || unlitPhase === 'out') unlitCondense();
  else unlitAnchorPair();
  updateUnlitChip();
}
function unlitBlock() { // a blocked view opens (pie/pulse/terrain/drill) — the estimate leaves with it
  if (!unlitField) return;
  if (unlitShown && unlitPhase !== 'out') unlitDisperse();
  unlitOn = false;
  updateUnlitChip();
}
function toggleUnlit() {
  if (!unlitField || drilling || flipping || pieMode || triPieMode || pulseMode || terrainMode || tollMode || canyonMode || flockMode || focusMode || forensicsMode) return;
  unlitOn = !unlitOn;
  if (!unlitOn) { if (unlitShown) unlitDisperse(); }
  else if (RATES.rates[crimeType]) {
    morphStart = -1; holdUntil = performance.now() + UNLIT_MS + 400; // the condense gets its beat before the years resume
    setYearPair(yi); // clean re-anchor at rest; the hook condenses the shadow in
  }
  updateUnlitChip();
}
// The legend chip — the estimate's on-screen declaration, visible the whole time it's active.
// Sexual offences ALWAYS carry the floor caveat; excluded crimes state their reason instead of dots.
function updateUnlitChip() {
  const chip = document.getElementById('unlit-chip');
  if (!chip) return;
  const active = unlitOn && !pieMode && !triPieMode && !pulseMode && !terrainMode && !tollMode && !canyonMode && !flockMode && !forensicsMode;
  if (!active) { chip.style.display = 'none'; return; }
  const spec = RATES.rates[crimeType];
  chip.innerHTML = !spec
    ? (crimeType === 'murder'
      ? '◌ murder is near-fully recorded — no unreported estimate (GPSJS)'
      : '◌ commercial crime sits outside household surveys — no estimate')
    : `◌ estimated unreported (survey-based) · GPSJS national r=${Math.round(spec.r * 100)}%` +
      (spec.floor ? ' · <b style="color:#b3a4d6">floor — surveys under-capture sexual offences</b>' : '');
  chip.style.display = 'block';
}

// ---- the pulse: month-scrub control ------------------------------------------------------------
// Mirrors the year grammar exactly: a pair of monthly layouts (mi → mi+1), lifted into the region's
// conserved slice when drilled in; tick's playing branch advances it at pulse cadence, looping.
function setMonthPair(i) {
  mi = ((i % monthLabels.length) + monthLabels.length) % monthLabels.length; // loop Apr 2021 ↔ Mar 2026
  const next = (mi + 1) % monthLabels.length;
  const L = pulseData.layouts;
  setDataPair(L[mi], L[next]);
  t = 0;
  refreshHud();
}
function buildPulse() {
  const p = providers[region][dataMode].monthly(crimeType); // lazy: ~60 layouts for THIS crime only
  if (p) pulseData = p;
  return !!p;
}
function enterPulse() {
  if (pulseMode || !monthLabels || !field || pieMode || triPieMode || drilling || tollMode || canyonMode || flockMode || forensicsMode) return;
  if (!buildPulse()) return;
  unlitBlock(); // no estimate in the pulse (v1) — it disperses as the months take over
  if (focusMode) exitFocus(false); // the two lenses don't compose — N trades focus for the pulse (setMonthPair below rewrites the pair)
  pulseMode = true;
  playing = true; morphStart = -1; holdUntil = performance.now();
  setMonthPair(mi);
  updateFlag();
  refreshHud();
}
function exitPulse() {
  if (!pulseMode) return;
  pulseMode = false;
  playing = false;
  landRegion();   // re-seed the yearly pair cleanly, at rest
  updateFlag();
  refreshHud();
}
function stepMonth(dir) {
  playing = false;
  setMonthPair(mi + dir);
}

// ---- THE TOLL — the 18-year accumulation the reading can't show (murders only) ----------------------
// K on the province map: a thin grey YEAR-DIAL sweeps once (~75 s, scrubable — the dial IS the
// scrubber); every recorded murder pours OUT of the dimmed map into a growing central disc — one
// stratum ring per year, growth rings of loss — and it never resets. Press-and-hold on the disc
// (or key 1) drops the pour to exactly ONE PER SECOND (the Reading's soul as a gesture). It is
// ONE morph with ORDERED seeds (dot k = the k-th murder chronologically, window at uT ≈ k/M) and
// uT driven by the dial clock; the engine never learns what a ceremony is. Counts are RAW
// recorded murders, whatever the display mode.
let tollMode = false, tollPhase = '';                // '' | 'gather' | 'toll' | 'drain' | 'home'
let tollT = 0;                                       // the ceremony's uT — the dial reads/writes THIS
let tollPaused = false, tollHoldKey = false, tollHoldPtr = false, tollScrubbing = false;
let tollData = null;                                 // { source, disc, M, perYear, cum, seamRadii } from tollLayouts
let tollFrame = null, tollHand = null;               // the dial structure layout + its hand slice
let tollSeeds = null, tollSeedsSaved = null;         // ordered seeds of dot k + the randoms restored on exit
let tollCount = -1, tollYearShown = -1, tollDone = false;
let tollPhaseStart = 0, tollLastNow = 0, tollDrainFrom = 0, tollHandAngle = -1, tollSpinStart = 0;
let tollHoldTimer = 0;
const TOLL_SWEEP_MS = 75000, TOLL_GATHER_MS = 2400, TOLL_DRAIN_MS = 1400, TOLL_HOME_MS = 2000;
const TOLL_FLIGHT_S = 1.2;                           // one dot's map→disc flight at sweep speed
const TOLL_HOLD_MS = 350;                            // press-and-hold threshold on the disc
let TOLL_SPIN_RATE = 0.028;                          // settled-ring spin (rad/s) ≈ 1 rev / 3.7 min — very slow, tune by eye
// Per-dot stagger window: at sweep speed (uT/s = 1000/TOLL_SWEEP_MS) a window w is a w·75 s flight.
const tollW = () => Math.min(0.95, TOLL_FLIGHT_S / (TOLL_SWEEP_MS / 1000));

// Ceremony geometry, in the province map frame: the disc slightly below map centre, the dial
// ring just outside it. (The plan's constants; the maker's eye owns the ratios.)
function tollGeom() {
  const box = regionData.wc.meta.box;
  const R = Math.min(box.w, box.h) * 0.32;
  return { cx: 0, cy: -box.h * 0.06, R, dialR: R * 1.16 };
}

// The memorial WORD behind the toll. Grey structure, no glow, renderOrder -2 → the disc sits in front.
// Centred a touch ABOVE the disc (yFrac of box.h); all params live-tunable via __viz.word() by eye.
let tollWord = 'MURDER';
let tollWordOpts = { fontFrac: 0.14, jitter: 0.8, weight: 800, yFrac: 0.41, spanFrac: 0.46 }; // "title above" — the word crowns the dial, its base just dipping into the outer ring
function showTollWord() {
  if (!wordField) return;
  if (!tollWord) { wordField.points.visible = false; return; }
  const box = regionData.wc.meta.box;
  const { cy } = tollGeom();
  const o = tollWordOpts;
  const lay = textLayout(tollWord, WORD_N, box, {
    fontFrac: o.fontFrac, jitter: o.jitter, weight: o.weight, spanFrac: o.spanFrac,
    cx: 0, cy: cy + o.yFrac * box.h,
  });
  wordField.setSource(lay); wordField.setTarget(lay); wordField.setT(1);
  wordField.points.visible = true;
}
function hideTollWord() { if (wordField) wordField.points.visible = false; }

// Bake the field's CURRENT on-screen pose (the vertex shader's per-dot staggered mix, minus the
// cosmetic drift) into a plain layout, so a new morph can begin from EXACTLY what the eye sees —
// mid-transition, any seeds, any stagger. Mirrors the shader: fract(aSeed/2π), epsilon floor, and
// Math.fround so float32 seeds resolve the same way they do on the GPU.
function bakeFieldPose() {
  const g = field.points.geometry;
  const src = g.getAttribute('aSource').array, tgt = g.getAttribute('aTarget').array;
  const sd = g.getAttribute('aSourceDensity').array, td = g.getAttribute('aTargetDensity').array;
  const seeds = g.getAttribute('aSeed').array;
  const uT = field.material.uniforms.uT.value;
  const w = Math.max(field.material.uniforms.uStagger.value, 1e-4);
  const positions = new Float32Array(COUNT * 2), density = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const s01 = Math.fround(seeds[i] * 0.1591549431) % 1;
    const lt = Math.min(1, Math.max(0, (uT - s01 * (1 - w)) / w));
    positions[2 * i] = src[2 * i] + (tgt[2 * i] - src[2 * i]) * lt;
    positions[2 * i + 1] = src[2 * i + 1] + (tgt[2 * i + 1] - src[2 * i + 1]) * lt;
    density[i] = sd[i] + (td[i] - sd[i]) * lt;
  }
  return { positions, density };
}

// The counter and the disc are ONE formula: a murder is counted the moment its dot LANDS
// (lt = 1 — the reading counted at its line, lt = 0.5; the toll has no line, so the count is the
// dots visibly IN the disc, never more). Binary search calling the shader's own math — lt at a
// fixed uT is non-increasing in k for ordered seeds — so the count CANNOT disagree with the
// pixels (step-tested exact at 1,501 sweep steps, float32 seeds included).
function tollCountAt(uT) {
  const w = tollW();
  let lo = 0, hi = tollData.M;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const s01 = Math.fround(tollSeeds[mid] * 0.1591549431) % 1;
    if ((uT - s01 * (1 - w)) / w >= 1) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// The dial's two clocks reconciled: uT counts EVENTS (dot k crosses at uT ≈ k/M), the dial shows
// CALENDAR (18 equal ticks). Mapping through the cumulative counts keeps both honest — the pour
// runs at one constant density of loss, so the hand LINGERS through the heavy years.
function tollYearFrac(uT) {
  const { cum, perYear, M } = tollData;
  const km = Math.min(uT, 1) * M;
  let y = 0; while (y < years.length - 1 && km >= cum[y + 1]) y++;
  const f = perYear[y] ? Math.min(1, (km - cum[y]) / perYear[y]) : 0;
  return { y, f, frac: (y + f) / years.length };
}
function tollFracToT(frac) {                         // dial arc (0..1 from twelve, cw) → uT
  const { cum, perYear, M } = tollData;
  const yf = Math.min(Math.max(frac, 0), 1) * years.length;
  const y = Math.min(years.length - 1, Math.floor(yf));
  return (cum[y] + (yf - y) * perYear[y]) / M;
}

function enterToll() {
  if (tollMode || !field || drilling || pieMorphing || flipping || pieMode || triPieMode || pulseMode || terrainMode || canyonMode || flockMode || forensicsMode) return;
  if (region !== 'wc') return;                       // province-only: the toll is the WHOLE province's 18 years
  const { cx, cy, R, dialR } = tollGeom();
  // Province-only full-pool CEREMONY: the pool IS the province (sliceStart() = 0), and tollLayouts
  // returns full COUNT-sized endpoints by construction — full-buffer writes at offset 0 are the
  // correct door here (startDrill is the precedent). Raw murder counts, whatever the display mode.
  tollData = tollLayouts(stationsByRegion.wc, { years, count: COUNT, park: awayAll.positions, cx, cy, R, dialR });
  if (!tollData) return;                             // tollLayouts asserted loudly (M > pool)
  unlitBlock();                                      // the estimate leaves with the map (the toll counts the recorded dead)
  if (focusMode) exitFocus(false);                   // the toll is the whole province's dead — focus lets go first
  playing = false; morphStart = -1;
  tollMode = true; tollPhase = 'gather'; tollPaused = false; tollDone = false;
  tollT = 0; tollCount = -1; tollYearShown = -1; tollHandAngle = -1;
  tollHoldKey = tollHoldPtr = tollScrubbing = false;
  controls.enabled = false;                          // the dial owns the pointer while tolling
  field.setSource(bakeFieldPose());                  // from exactly what the eye sees (any crime, mid-morph)
  field.setTarget(tollData.source);
  field.setStagger(0.55);
  t = 0; tollPhaseStart = performance.now();
  tollFrame = tollFrameLayout(structN, { cx, cy, R, dialR, ticks: years.length, seamRadii: tollData.seamRadii, frameDots: pieFrameDots, thin: pieThin });
  tollHand = tollFrame.hand;
  structField.setSize(PIE_LINE_SIZE);
  startStructTransition(tollFrame, TOLL_GATHER_MS, 0.6);
  showTollWord();                                    // the memorial word appears behind the ceremony
  refreshHud();
}

// The gather has landed: impose the ORDER (dot k's window at uT ≈ k/M), then let the dial walk.
function beginTollClock(now) {
  tollSeedsSaved = Float32Array.from(field.points.geometry.getAttribute('aSeed').array);
  const seeds = Float32Array.from(tollSeedsSaved);
  const M = tollData.M;
  tollSeeds = new Float32Array(M);
  for (let k = 0; k < M; k++) {
    tollSeeds[k] = (k / M) / 0.1591549431;           // fract(seed · 1/2π) = k/M (the reading's seed math)
    seeds[k] = tollSeeds[k];                         // event k IS pool dot k (chronological allocation)
  }
  field.setSeeds(seeds);
  field.setSource(tollData.source);
  field.setTarget(tollData.disc);
  field.setStagger(tollW());
  bakeTollSpin();                                     // the settled rings will turn (a real-time clock)
  field.setSpinTime(0); field.setSpinOn(true); tollSpinStart = now;
  tollPhase = 'toll';
  tollT = 0; tollLastNow = now; t = 0;
  refreshHud();
}

// Bake the ORDERED SPIN: once a year's ring has settled it turns VERY slowly, and ADJACENT rings
// turn OPPOSITE ways (parity by year index) — a nested orrery. Onset = when dot k lands at the
// DEFAULT sweep speed, so each ring eases from angle 0 the instant it settles; the engine gates
// the spin by landed-ness, so scrubbing back lifts dots and stops them cleanly. Radius-preserving,
// so it changes no year/count — ambient living-motion, like the idle drift.
function bakeTollSpin() {
  if (!tollData) return;
  const M = tollData.M, rates = new Float32Array(COUNT), onsets = new Float32Array(COUNT);
  const sweepS = TOLL_SWEEP_MS / 1000, w = tollW();
  let yy = 0;
  for (let k = 0; k < M; k++) {
    while (yy < years.length - 1 && k >= tollData.cum[yy + 1]) yy++;
    onsets[k] = ((k / M) * (1 - w) + w) * sweepS;     // seconds until this dot lands at sweep speed
    rates[k] = TOLL_SPIN_RATE * ((yy & 1) ? -1 : 1);  // adjacent rings counter-rotate
  }
  field.setSpin(rates, onsets);
  field.setSpinCentre(tollData.cx, tollData.cy);       // rotate about the DISC centre → radius invariant
}

// K/M/Esc/tap outside the dial: the pour REVERSES — a fast eased drain back into the dimmed map,
// then the ordinary morph home to the truthful map (re-anchored via setYearPair, like the pies).
function exitToll() {
  if (!tollMode || tollPhase === 'drain' || tollPhase === 'home') return;
  clearTimeout(tollHoldTimer); tollHoldPtr = false; tollScrubbing = false;
  if (tollPhase === 'gather') {                      // no order imposed yet — morph straight home
    field.setSource(bakeFieldPose());
    beginTollHome();
    return;
  }
  if (tollT <= 0) { field.setSource(tollData.source); beginTollHome(); return; }
  tollDrainFrom = tollT; tollPhase = 'drain'; tollPhaseStart = performance.now();
  refreshHud();
}
function beginTollHome() {
  // At uT = 0 the pose IS the source, so restoring the random seeds is invisible here.
  if (tollSeedsSaved) { field.setSeeds(tollSeedsSaved); tollSeedsSaved = null; }
  field.setSpinOn(false);                            // stop the orrery BEFORE the map target lands (never spin the map)
  hideTollWord();                                    // the memorial word leaves with the disc
  hideTollRoll();                                    // and the ring caption goes with it
  field.setTarget(layouts[yi]);                      // the truthful map (current crime, year yi)
  field.setStagger(0.55);
  t = 0; tollT = 0; tollPhase = 'home'; tollPhaseStart = performance.now();
  structField.setSize(structDotSize);
  startStructTransition(structRest(), TOLL_HOME_MS, 0.6);
  controls.enabled = true;
  refreshHud();
}
function tollPauseToggle() {
  if (!tollMode || tollPhase !== 'toll') return;
  tollPaused = !tollPaused;
  refreshHud();
}

// The ceremony's HUD line — year under the hand · that year's running count · cumulative total.
// Writes only when a count or the hand's year changes (called every frame while tolling).
function updateTollHud(force = false) {
  if (!countEl || !tollData) return;
  const M = tollData.M;
  const counting = tollPhase === 'toll' || tollPhase === 'drain';
  const n = counting ? tollCountAt(tollT) : 0;
  const { y } = tollYearFrac(counting ? tollT : 0);
  if (!force && n === tollCount && y === tollYearShown) return;
  tollCount = n; tollYearShown = y;
  if (yearEl) yearEl.textContent = yearLabels[y];
  const total = M.toLocaleString();
  if (tollPhase === 'gather') {
    countEl.textContent = `${total} recorded murders · Apr 2008 – Mar 2026`;
  } else if (n >= M) {
    countEl.textContent = `${total} recorded murders · Western Cape · Apr 2008 – Mar 2026`;
    if (!tollDone) { tollDone = true; refreshHud(); } // the hand rests; the hint flips once
  } else {
    const inYear = Math.max(0, n - tollData.cum[y]); // landings lag the hand — never more than the year holds
    countEl.textContent = `${inYear.toLocaleString()} this year · ${n.toLocaleString()} recorded murders so far`;
    if (tollDone) { tollDone = false; refreshHud(); } // scrubbed back below complete
  }
}

// The hand rides the dial: rewrite ONLY its slice of the structure pool (both endpoints, so the
// pose survives the next full-buffer transition), leaving ring/ticks/seams untouched. Writing
// into tollFrame's own arrays keeps structCurrent truthful — the exit morph starts from the
// hand's REAL angle, not a stale twelve.
function updateTollHand(uT) {
  if (!tollHand || strProg < 1 || structCurrent !== tollFrame) return;
  const angle = tollYearFrac(uT).frac * Math.PI * 2;
  if (Math.abs(angle - tollHandAngle) < 6e-4) return;
  tollHandAngle = angle;
  const { cx, cy, R, dialR } = tollGeom();
  const h = tollHandLayout(tollHand.count, { cx, cy, R, dialR, angle, thin: pieThin });
  tollFrame.positions.set(h.positions, tollHand.start * 2);
  tollFrame.density.set(h.density, tollHand.start);
  const slice = {
    positions: tollFrame.positions.subarray(tollHand.start * 2, (tollHand.start + tollHand.count) * 2),
    density: tollFrame.density.subarray(tollHand.start, tollHand.start + tollHand.count),
  };
  structField.setSource(slice, tollHand.start);
  structField.setTarget(slice, tollHand.start);
}

// Ring rollover: hover a year-stratum to name its year + that year's murder count. Structure-voiced —
// grey, small, pointer-transparent; a memorial caption that follows the pointer over the disc.
let tollRollEl = null;
function tollRoll() {
  if (!tollRollEl) {
    tollRollEl = document.createElement('div');
    tollRollEl.style.cssText = 'position:fixed;pointer-events:none;z-index:20;color:#8b98ac;' +
      'font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;' +
      'opacity:0;transition:opacity .25s';
    app.appendChild(tollRollEl);
  }
  return tollRollEl;
}
function hideTollRoll() { if (tollRollEl) tollRollEl.style.opacity = '0'; }
function updateTollRollover(clientX, clientY) {
  // Only while the disc exists (not gather/home), and never mid-scrub — rollover is pure hover.
  if (!tollMode || tollPhase === 'gather' || tollPhase === 'home' || tollScrubbing || !tollData) {
    hideTollRoll(); return;
  }
  const { cx, cy } = tollGeom();                       // fieldGroup local == world here (same as the pointer grammar)
  const p = tollWorldAt(clientX, clientY);
  const r = Math.hypot(p.x - cx, p.y - cy);
  if (r < tollData.r0 || r > tollData.R) { hideTollRoll(); return; }  // off the disc band → nothing to name
  let y = 0;                                           // radius → year; the orrery spin preserves radius, so it's unaffected
  while (y < tollData.seamRadii.length && r >= tollData.seamRadii[y]) y++;
  const el = tollRoll();
  el.textContent = `${yearLabels[y]} · ${tollData.perYear[y].toLocaleString()} recorded`;
  el.style.opacity = '1';
  const w = el.offsetWidth, h = el.offsetHeight;       // clamp so the caption never runs off the viewport edge
  el.style.left = Math.max(8, Math.min(clientX + 14, window.innerWidth - w - 8)) + 'px';
  el.style.top = Math.max(8, Math.min(clientY - 10, window.innerHeight - h - 8)) + 'px';
}

// ---- the dial's pointer grammar: drag the ring scrubs, hold the disc drips 1:1, tap outside exits ----
function tollWorldAt(clientX, clientY) {             // screen → the flat map plane (z = 0 while tolling)
  const rect = renderer.domElement.getBoundingClientRect();
  _hv.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1, 0.5)
    .unproject(camera);
  const dir = _hv.sub(camera.position).normalize();
  const k = -camera.position.z / dir.z;
  return { x: camera.position.x + dir.x * k, y: camera.position.y + dir.y * k };
}
function tollScrubTo(clientX, clientY) {
  const { cx, cy } = tollGeom();
  const p = tollWorldAt(clientX, clientY);
  const ang = Math.atan2(p.x - cx, p.y - cy);        // 0 at twelve, clockwise positive
  let frac = ang / (Math.PI * 2); if (frac < 0) frac += 1;
  const cur = tollYearFrac(tollT).frac;              // unwrap: the dial can't teleport across twelve
  if (frac - cur > 0.5) frac -= 1;
  if (cur - frac > 0.5) frac += 1;
  tollT = tollFracToT(Math.min(1, Math.max(0, frac)));
  t = tollT;
  updateTollHud();
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!tollMode || tollPhase !== 'toll') return;
  const { cx, cy, R, dialR } = tollGeom();
  const p = tollWorldAt(e.clientX, e.clientY);
  const r = Math.hypot(p.x - cx, p.y - cy);
  if (r <= R * 1.02) {                               // the disc: press-and-hold → one per second
    clearTimeout(tollHoldTimer);
    tollHoldTimer = setTimeout(() => { tollHoldPtr = true; refreshHud(); }, TOLL_HOLD_MS);
  } else if (r <= dialR * 1.3) {                     // the ring: the dial IS the scrubber
    tollScrubbing = true;
    tollScrubTo(e.clientX, e.clientY);
  }
});
window.addEventListener('pointermove', (e) => {
  if (tollScrubbing) tollScrubTo(e.clientX, e.clientY);
  updateTollRollover(e.clientX, e.clientY);           // pure hover — name the ring under the pointer
});
window.addEventListener('pointerup', (e) => {
  if (!tollMode) return;
  clearTimeout(tollHoldTimer);
  const wasHolding = tollHoldPtr, wasScrubbing = tollScrubbing;
  if (tollHoldPtr) { tollHoldPtr = false; refreshHud(); }
  tollScrubbing = false;
  // a quick tap OUTSIDE the dial ends the toll (the drill's tap-to-leave grammar)
  if (wasHolding || wasScrubbing) return;
  if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 6) return;
  const { cx, cy, dialR } = tollGeom();
  const p = tollWorldAt(e.clientX, e.clientY);
  if (Math.hypot(p.x - cx, p.y - cy) > dialR * 1.3) exitToll();
});

// ---- THE FLOCK — release the field (province map only) ----------------------------------------------
// Press F and all ~180k dots FORGET the map: the field lifts into a province-scale murmuration
// wheeling over the grey outline — a chain of 8 precomputed flock keyframes (flockLayouts) morphed
// through in a loop. THE STAGGER IS THE MURMURATION: each dot crosses on its own slice of t, so every
// frame-to-frame morph ripples through the flock as a turning wave — no physics engine, no per-frame
// position uploads, the same GPU tween the year-scrub rides. A declared PLAY state: the readouts
// suspend (no data reading while airborne), the tooltip + labels sleep, and landing always returns
// every dot to layouts[yi] — the truthful map — then re-anchors the scrub pair.
let flockMode = false, flockPhase = 'fly', flockIdx = 0, flockStart = 0;
let flockFrames = null, flockDensity = null;
const FLOCK_MS = 3200, FLOCK_LAND_MS = 2800; // leg length · the glide home
// Stagger ≈ 1 keeps EVERY dot in motion for the whole leg (heavy stagger parks each dot outside its
// own window — that was the stop-start). The turning-wave texture now comes from the flow field.
const FLOCK_STAGGER = 0.97, FLOCK_LAND_STAGGER = 0.6;
// Surge easing: t(p) = p − (A/2π)·sin(2πp). Velocity swings smoothly between (1−A) and (1+A) and its
// SLOPE MATCHES at every leg join (1−A on both sides) — the flock slows into each waypoint, banks,
// and surges out, but never stops and never steps. This is the anti-jerk.
const FLOCK_SURGE = 0.62;
const surgeEase = (p) => p - (FLOCK_SURGE / (2 * Math.PI)) * Math.sin(2 * Math.PI * p);
// Continuous-motion levers: the curl flow + boosted idle drift keep every dot streaming BETWEEN
// waypoints (amplitudes are eased in the tick; speeds are set only while amplitudes are tiny —
// a speed change mid-flight snaps orbit/flow phase).
const FLOCK_FLOW = 15, FLOCK_FLOW_SPEED = 1.05, FLOCK_DRIFT = 5.5, FLOCK_DRIFT_SPEED = 2.4;
// The ATTRACT state: the page LANDS released (a nameless swarm over the dark terrain) and any input
// wakes it into the data; long idleness on the resting province releases it again.
const IDLE_RELEASE_MS = 75000;
let attractMode = false, lastInputAt = 0;
let flowCur = 0, flockDriftCur = 0.4;

// Pair a flock frame (positions only) with the density snapshotted at take-off — each dot KEEPS its
// warmth through the flight, so the hot-core dots streak as warm threads across the sky.
const withFlockDensity = (frame) => ({ positions: frame.positions, density: flockDensity });

function enterFlock(attract = false) {
  // Province map only: in a district most of the pool is parked-away with density 0 — flying it would
  // materialize dots that aren't in the view's truth. And only from the FLAT map with nothing else in
  // flight (no pie/pulse/terrain, nothing mid-morph) — self-guarding, like toggleTerrain.
  if (flockMode || region !== 'wc' || !field || pieMode || triPieMode || pulseMode || terrainMode
    || tollMode || canyonMode || forensicsMode || drilling || flipping || pieMorphing) return;
  unlitBlock();                                      // the estimate leaves with the map it shadows
  if (focusMode) exitFocus(false);                   // the whole field flies — the focus dim can't ride along
  if (!flockFrames) flockFrames = flockLayouts(COUNT, regionData.wc.meta.box, 0xf10c); // seeded → stable per build; built once per session
  const live = liveMap('wc');     // wherever the map is mid-breath — the flight lifts from HERE
  flockDensity = live.density;
  // Full-buffer writes (offset 0), like startDrill: the flock is a PROVINCE-ONLY full-pool state — no
  // district slice is at rest, so the whole COUNT-sized field is legitimately re-pointed.
  field.setSource(live);
  field.setTarget(withFlockDensity(flockFrames[0]));
  field.setStagger(FLOCK_STAGGER);
  field.setDriftSpeed(FLOCK_DRIFT_SPEED); // amp still at-rest tiny here; it ramps in the tick
  field.setT(0);
  flockMode = true; flockPhase = 'fly'; flockIdx = 0; flockStart = performance.now();
  attractMode = attract;
  playing = false; morphStart = -1; t = 0;
  refreshHud();
}

// The exact CURRENT airborne pose — replicating the vertex shader's per-dot stagger window (the same
// seed01/window arithmetic as PointField's VERT) — because a landing must start from precisely where
// each dot IS on screen; a uniform-t lerp would snap every dot that had already crossed its window.
function airbornePose() {
  const g = field.points.geometry;
  const src = g.getAttribute('aSource').array, tgt = g.getAttribute('aTarget').array;
  const seed = g.getAttribute('aSeed').array;
  const uT = field.material.uniforms.uT.value;
  const w = Math.max(field.material.uniforms.uStagger.value, 0.02);
  const out = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    const s01 = (seed[i] * 0.1591549431) % 1;
    let lt = (uT - s01 * (1 - w)) / w;
    lt = lt < 0 ? 0 : lt > 1 ? 1 : lt;
    out[2 * i] = src[2 * i] + (tgt[2 * i] - src[2 * i]) * lt;
    out[2 * i + 1] = src[2 * i + 1] + (tgt[2 * i + 1] - src[2 * i + 1]) * lt;
  }
  return out;
}

// Land: from wherever the chain is, ONE long staggered morph home to the truthful map. tick's flock
// branch finishes it (flockMode off → setYearPair re-anchor → HUD restore).
function landFlock() {
  if (!flockMode || flockPhase === 'land') return;
  field.setSource({ positions: airbornePose(), density: flockDensity }); // full-buffer: see enterFlock
  field.setTarget(layouts[yi]);                                          // province layouts are COUNT-sized
  field.setStagger(FLOCK_LAND_STAGGER);
  field.setT(0); t = 0;
  flockPhase = 'land'; flockStart = performance.now();
  refreshHint();
}

// ---- year-scrub control -----------------------------------------------------
function setYearPair(i) {
  yi = (i + years.length) % years.length;
  const next = (yi + 1) % years.length;
  if (pieMode && pieYears) {                       // scrub the PIE through the years — frame holds, wedges re-fill
    lastPie = pieYears[yi];
    setDataPair(pieYears[yi], pieYears[next]);
  } else {
    setDataPair(layouts[yi], layouts[next]);
  }
  t = 0;
  unlitAfterAnchor(); // the shadow re-anchors with the reported field (no-op unless active on a map)
  refreshHud();
}
function stepYear(dir) {
  playing = false;
  if (triPieMode && triPieYears) {                 // step the 3-PIE year — all three re-fill at once
    yi = (yi + dir + years.length) % years.length;
    const prevTp = lastTriPie;
    lastTriPie = triPieYears[yi];
    setDataPair(prevTp, lastTriPie);
    field.setStagger(0.6);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
  if (pieMode && pieYears) {                       // step the PIE year with an ANIMATED morph
    yi = (yi + dir + years.length) % years.length;
    const prevPie = lastPie;
    lastPie = pieYears[yi];
    setDataPair(prevPie, lastPie);
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
  if (flipping || crimeTypes.length < 2 || flockMode) return;
  const i = crimeTypes.indexOf(crimeType);
  const next = crimeTypes[(i + dir + crimeTypes.length) % crimeTypes.length];
  if (next === crimeType) return;
  if (canyonMode) { // canyon: sink flat → swap the landform → rise as the new crime. aZ is ONE
    if (canyonFlipTo) return;                 // attribute (it snaps on setTarget), so the swap hides
    canyonFlipTo = next;                      // at zero height — tick performs it once the range is flat.
    refreshHud(next);
    return;
  }
  if (pulseMode) { // pulse: cross-fade this month, old crime → new crime (lazy build evicts the old months)
    const from = pulseData.layouts[mi];
    crimeType = next;
    layouts = layoutsByType[crimeType];
    buildPulse();
    setDataPair(from, pulseData.layouts[mi]);
    field.setStagger(0.6);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true; // completion re-anchors to setMonthPair(mi)
    refreshHud();
    return;
  }
  if (forensicsMode) { // re-sort the strip to the new crime — columns fly to their new ranks
    crimeType = next;
    layouts = layoutsByType[crimeType];
    const prev = lastForensics;
    lastForensics = forensicsBuilder(crimeType);
    setDataPair(prev, lastForensics);
    field.setStagger(0.6);
    startStructTransition(forensicsFrameLayout(structN, lastForensics.frame, { frameDots: pieFrameDots, thin: pieThin }));
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
  if (pieMode) {
    crimeType = next;
    layouts = layoutsByType[crimeType];
    pieYears = years.map((_, k) => pieBuilder(crimeType, k, { cx: 0, cy: 0, R: PIE_R }));
    const prevPie = lastPie;
    lastPie = pieYears[yi];
    setDataPair(prevPie, lastPie);
    field.setStagger(0.6);
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
  flipTo = next;
  flipping = true;
  flipStart = performance.now();
  morphStart = -1;
  setDataPair(layoutsByType[crimeType][yi], layoutsByType[next][yi]);
  if (unlitField && unlitShown) { // the shadow flips WITH the reported field — or flies home if the next crime has no rate
    unlitField.setStagger(0.6);
    unlitSet(unlitLive(), RATES.rates[next] ? unlitL(yi, next) : unlitRoost());
  }
  t = 0;
  refreshHud(next);
}

// HUD text for a crime + the current year (defaults to the live crime).
function refreshHud(type = crimeType) {
  const rate = dataMode === 'percapita';
  const focusS = focusMode && focusStation >= 0 ? activeStations()[focusStation] : null;
  if (regionEl) regionEl.textContent = focusS ? focusS.name : (REGION_META[region] || REGION_META.wc).name;
  refreshHint();
  updateCaption(); // the One-in-N line rides every HUD refresh (year scrubs, crime flips, focus moves)
  refreshChips();
  if (tollMode) {
    if (crimeEl) crimeEl.textContent = 'murder · the toll';
    updateTollHud(true); // the dial clock owns yearEl + countEl
    return;
  }
  if (flockMode) { // airborne: the readouts suspend — no data reading while the field is released
    if (crimeEl) crimeEl.textContent = (crimeLabels[type] || type) + (rate ? ' · per 100k' : '');
    if (yearEl) yearEl.textContent = '— released —';
    if (countEl) countEl.textContent = '';
    return;
  }
  if (triPieMode) {
    if (crimeEl) crimeEl.textContent = `all ${crimeTypes.length} crimes` + (rate ? ' · per capita' : '');
    if (yearEl) yearEl.textContent = yearLabels[yi];
    if (countEl) countEl.textContent = 'click a pie to focus it';
    return;
  }
  if (pulseMode) {
    if (crimeEl) crimeEl.textContent = (crimeLabels[type] || type) + (rate ? ' · per 100k' : '');
    if (yearEl) yearEl.textContent = fmtMonth(monthLabels[mi]);
    if (countEl) countEl.textContent = ((pulseData && pulseData.totals[mi]) || 0).toLocaleString();
    return;
  }
  if (canyonMode) { // all 18 years at once — the canyon has no single year or count to name
    if (crimeEl) crimeEl.textContent = (crimeLabels[type] || type) + ' · per 100k';
    if (yearEl) yearEl.textContent = `${yearLabels[0]}–${yearLabels.at(-1)}`;
    if (countEl) countEl.textContent = `${(stationsByRegion[region] || stationsByRegion.wc).length} precincts × ${years.length} years`;
    return;
  }
  if (forensicsMode) { // the strip: every station's 60 monthly returns at once — counts, never rates
    if (crimeEl) crimeEl.textContent = (crimeLabels[type] || type) + ' · monthly returns';
    if (yearEl) yearEl.textContent = monthLabels ? `${fmtMonth(monthLabels[0])} – ${fmtMonth(monthLabels.at(-1))}` : '';
    if (countEl) countEl.textContent = lastForensics ? `${lastForensics.reports.toLocaleString()} reported` : '';
    return;
  }
  if (yearEl) yearEl.textContent = yearLabels[yi];
  if (crimeEl) crimeEl.textContent = (crimeLabels[type] || type) + (rate ? ' · per 100k' : '');
  if (countEl) countEl.textContent = focusS
    ? ((focusS.crimes[type] && focusS.crimes[type][years[yi]]) || 0).toLocaleString() // the station's OWN count
    : ((totalsByType[type] && totalsByType[type][yi]) || 0).toLocaleString();
}
// Data-source credit line — names the population source too once per-capita is in play.
function updateFlag() {
  const flagEl = document.getElementById('flag');
  if (!flagEl || !yearLabels.length) return;
  const span = (pulseMode || forensicsMode) // both run on the monthly series — credit the quarterlies
    ? `${fmtMonth(monthLabels[0])}–${fmtMonth(monthLabels.at(-1))} monthly (SAPS quarterlies, unaudited)`
    : canyonMode
      ? `${yearLabels[0]}–${yearLabels.at(-1)} · rates surface · per 100k`
      : `${yearLabels[0]}–${yearLabels.at(-1)}` + (dataMode === 'percapita' ? '' : ' (25/26 unaudited)');
  flagEl.textContent = dataMode === 'percapita' || canyonMode // the canyon is per-capita by construction
    ? `◆ crime: SAPS (DataFirst + saps.gov.za) · population: WorldPop 2020 · ${span}`
    : `◆ SAPS crime records · DataFirst + saps.gov.za · ${span}`;
}

// Morph off the map into a robbery pie and back. Data swarms into the wedges, structure into the ring
// + spokes — conserved, staggered, no fades.
function togglePie() {
  if (!pieBuilder || !field || canyonMode || flockMode || forensicsMode) return;
  if (focusMode) exitFocus(false); // pies read the whole field — the write below replaces the pair
  pieMode = !pieMode;
  playing = false;
  if (pieMode) {
    unlitBlock(); // no estimate in the pies (v1)
    pieYears = years.map((_, i) => pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R }));
    const pie = pieYears[yi];
    lastPie = pie;
    setDataPair(layoutsByType[crimeType][yi], pie);
    field.setStagger(0.6);
    structField.setSize(PIE_LINE_SIZE);
    startStructTransition(pieFrameLayout(structN, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else {
    setDataPair(lastPie, layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    structField.setSize(structDotSize);
    startStructTransition(structRest());
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// Break the single pie into THREE — robbery · burglary · murder, same year, side by side.
function toggleTriPie() {
  if (!triPieBuilder || !field || canyonMode || flockMode || forensicsMode) return;
  if (focusMode) exitFocus(false); // pies read the whole field — the write below replaces the pair
  const wasPie = pieMode;
  triPieMode = !triPieMode;
  playing = false;
  if (triPieMode) {
    pieMode = false;
    unlitBlock(); // no estimate in the compare view (v1)
    triPieYears = years.map((_, i) => triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
    const tp = triPieYears[yi]; lastTriPie = tp;
    const dataSrc = wasPie && lastPie ? lastPie : layoutsByType[crimeType][yi];
    setDataPair(dataSrc, tp);
    field.setStagger(0.6);
    structField.setSize(PIE_LINE_SIZE);
    startStructTransition(triPieFrameLayout(structN, { centers: tp.centers, R: TRI_R, boundaries: tp.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else {
    setDataPair(lastTriPie, layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    structField.setSize(structDotSize);
    startStructTransition(structRest());
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// The forensics strip ('X'): the field morphs off the map into ranked ribbons of monthly returns
// and back. Entered from the FLAT MAP only (pies/pulse/terrain each have their own exits first);
// inside it, ↑↓ re-sorts to another crime — the re-sort IS the show. Data swarms to the columns,
// structure to the baseline + seams + D=1 tick — conserved, staggered, no fades (pie grammar).
function toggleForensics() {
  if (!forensicsBuilder || !field || drilling) return;
  if (!forensicsMode && (pieMode || triPieMode || pulseMode || terrainMode || tollMode || canyonMode || flockMode)) return;
  forensicsMode = !forensicsMode;
  playing = false;
  if (forensicsMode) {
    unlitBlock();                                   // the strip reads the recorded returns — the estimate leaves
    if (focusMode) exitFocus(false);                // the whole province re-sorts — focus lets go first
    lastForensics = forensicsBuilder(crimeType);
    setDataPair(layoutsByType[crimeType][yi], lastForensics);
    field.setStagger(0.6);
    structField.setSize(PIE_LINE_SIZE);
    startStructTransition(forensicsFrameLayout(structN, lastForensics.frame, { frameDots: pieFrameDots, thin: pieThin }));
  } else {
    setDataPair(lastForensics, layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    structField.setSize(structDotSize);
    startStructTransition(structRest());
  }
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
  updateFlag(); // the strip runs on the monthly series — credit the quarterlies while inside
}

// Toggle raw ⇄ per-capita ('C'). The DATA field morphs to the same view in the new mode — dense
// townships shrink, low-population hotspots swell, because rate ≠ count. Works in every view + region.
function toggleMode() {
  if (!field || canyonMode || flockMode || forensicsMode) return; // the canyon is per-capita ONLY; the strip's tallies are counts, not rates
  const newMode = dataMode === 'raw' ? 'percapita' : 'raw';
  const oldMapLayout = layoutsByType[crimeType][yi];
  applyMode(newMode);
  playing = false;
  if (pieMode) {
    pieYears = years.map((_, i) => pieBuilder(crimeType, i, { cx: 0, cy: 0, R: PIE_R }));
    const oldPie = lastPie, pie = pieYears[yi]; lastPie = pie;
    setDataPair(oldPie, pie);
    field.setStagger(0.6);
    startStructTransition(pieFrameLayout(structN, { cx: 0, cy: 0, R: PIE_R, boundaries: pie.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else if (triPieMode) {
    triPieYears = years.map((_, i) => triPieBuilder(i, { gap: TRI_GAP, R: TRI_R }));
    const oldTp = lastTriPie, tp = triPieYears[yi]; lastTriPie = tp;
    setDataPair(oldTp, tp);
    field.setStagger(0.6);
    startStructTransition(triPieFrameLayout(structN, { centers: tp.centers, R: TRI_R, boundaries: tp.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  } else if (pulseMode) {
    // pulse: same month, raw ⇄ per-capita dot budgets (the provider's monthly() is mode-aware)
    const from = pulseData.layouts[mi];
    buildPulse();
    setDataPair(from, pulseData.layouts[mi]);
    field.setStagger(0.6);
  } else {
    // map: only the DATA redistributes; the geography frame is identical in both modes.
    setDataPair(oldMapLayout, layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    if (unlitField && unlitShown) { // the estimate re-budgets with the mode (same pop denominators)
      unlitField.setStagger(0.55);
      unlitSet(unlitLive(), unlitL(yi));
    }
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
  setDataPair(lastTriPie, resolved);
  field.setStagger(0.6);
  structField.setSize(PIE_LINE_SIZE);
  startStructTransition(pieFrameLayout(structN, { cx: 0, cy: 0, R: PIE_R, boundaries: resolved.boundaries, frameDots: pieFrameDots, thin: pieThin }));
  triPieMode = false; pieMode = true;
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  refreshHud();
}

// The `M` key: from a pie/3-pie → swarm home to the map. On the Cape Town map → drill back out.
function goToMap() {
  if (tollMode) { exitToll(); return; }         // the toll drains home first
  if (canyonMode) { toggleCanyon(); return; }   // canyon → flat map (exits exactly like terrain)
  if (flockMode) { landFlock(); return; }       // airborne → land (M is an exit everywhere)
  if (terrainMode) { toggleTerrain(); return; } // terrain → flat first (then M again exits pulse / drills out)
  if (pulseMode) { exitPulse(); return; }       // pulse → back to the years
  if (focusMode) { exitFocus(); return; }       // focused → the whole field first (M again drills out)
  if (forensicsMode) { toggleForensics(); return; } // strip → swarm home to the map
  if (triPieMode) { toggleTriPie(); return; }
  if (pieMode) {
    pieMode = false;
    setDataPair(lastPie, layoutsByType[crimeType][yi]);
    field.setStagger(0.55);
    structField.setSize(structDotSize);
    startStructTransition(structRest());
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
    refreshHud();
    return;
  }
  if (region !== 'wc') startDrill('wc'); // already in a district → M drills back out to the province
}

// ---- THE DRILL — one conserved swarm each, camera dead still (wcMain.js's grammar) ------------------
// Available ONLY from a MAP view (gated at the call sites). DATA: Cape Town's city dots travel
// province-cluster ⇄ full detail (conserved — the SAME dots); rural breaks away / flies back.
// STRUCTURE: the province outline reconfigures into Cape Town's outline. Nothing fades except the rural
// crime that genuinely has no detail to zoom into; the lens never moves.
function startDrill(to) {
  if (drilling || to === region || pieMode || triPieMode || tollMode || canyonMode || flockMode || forensicsMode) return; // exit the canyon first — a drill mid-relief would strand the graticule
  if (focusMode) exitFocus(false); // drilling exits focus first (like the pulse); liveMap below rewrites the whole pair
  if (pulseMode) { pulseMode = false; playing = false; updateFlag(); } // drill flies on the YEARLY field (liveMap below); land re-seeds yearly
  if (terrainMode) { // never drill mid-relief — snap flat first (normal input exits terrain before this)
    terrainMode = false; zScaleCur = 0; tiltCur = 0; fieldGroup.rotation.x = 0; trProg = 1;
    if (terrainField) terrainField.points.visible = false;
    if (structField) structField.points.visible = true;
    if (field) field.setZScale(0);
  }
  drilling = true; drillTo = to; drillStart = performance.now(); playing = false;
  labelLayer.style.opacity = '0'; // labels leave with the outline (tick's drill branch skips updateLabels)
  if (hintEl) hintEl.textContent = to === 'wc' ? 'back to the Western Cape…' : `blooming into ${REGION_META[to].name}…`;
  field.setSource(liveMap(region));
  field.setTarget(liveMap(to));
  field.setStagger(0.62);
  structField.setSource(structCurrent);
  structField.setTarget(outlines[to]);
  structField.setStagger(0.62);
  if (unlitField && unlitShown) { // the estimate can't survive the region change — it flies home with the drill
    unlitField.setStagger(0.62);
    unlitSet(unlitLive(), unlitRoost());
    unlitOn = false;
    updateUnlitChip();
  }
}

// ---- FOCUS: stand in your suburb (H) ---------------------------------------------------------------
// Enter writes the ONE asymmetric pair (undimmed → dimmed) while the flag is still off — so the door
// can't double-dim it — then flips the flag; every later at-rest write lands pre-dimmed. The morph
// rides the pieMorphing clock, whose completion re-anchors setYearPair(yi) exactly like a pie/flip.
function enterFocus(si) {
  if (!field || si < 0 || drilling || pieMode || triPieMode || tollMode || canyonMode || flockMode || forensicsMode || flipping) return;
  unlitBlock();                      // the estimate doesn't compose with the focus dim — it leaves
  if (pulseMode) exitPulse();        // focus reads the YEARLY field (the drill's same snap)
  if (focusMode) exitFocus(false);   // refocus = clean slate; the write below re-dims for the new station
  playing = false;
  focusStation = si;
  peopleOn = true;                   // the residents auto-show on each fresh focus (J hides them)
  const dim = focusLayout(layouts[yi], si);
  setDataPair(layouts[yi], dim);     // flag still false → the door passes both through untouched
  focusMode = true;
  field.setStagger(0.55);
  t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  seedBeacon();
  seedPeople();
  refreshHud();
}
function exitFocus(animate = true) {
  if (!focusMode) return;
  const dim = focusLayout(layouts[yi]);  // the dimmed pose, composed while the flag is still on
  focusMode = false; focusStation = -1;
  if (beaconField) beaconField.points.visible = false;
  hidePeople();
  if (animate) {                     // fade back up; completion re-anchors the undimmed year pair.
    setDataPair(dim, layouts[yi]);   // animate:false = a boundary caller (drill/pulse/pie) immediately
    field.setStagger(0.55);          //   rewrites the whole pair itself, so no write here.
    t = 0; pieMorphStart = performance.now(); pieMorphing = true;
  }
  refreshHud();
}
// ---- One in Forty-Three: the people stand up --------------------------------------------------------
function seedPeople() {
  if (!peopleField || focusStation < 0) return;
  const s = activeStations()[focusStation];
  const n = Math.round((s.pop || 0) / PEOPLE_PER_DOT);   // 1 grey dot = 100 residents, exactly
  const grid = personGridLayout({ x: s.x, y: s.y, r: Math.max(8, s.r) }, n, PEOPLE_N);
  // They RISE: same dots huddled dark at the centre → the standing grid (dot count never lies).
  const from = { positions: new Float32Array(PEOPLE_N * 2), density: new Float32Array(PEOPLE_N) };
  for (let i = 0; i < PEOPLE_N; i++) {
    from.positions[i * 2] = s.x + (grid.positions[i * 2] - s.x) * 0.12;
    from.positions[i * 2 + 1] = s.y + (grid.positions[i * 2 + 1] - s.y) * 0.12;
  }
  peopleField.setSource(from);
  peopleField.setTarget(grid);
  peopleField.setStagger(0.6);
  plStart = performance.now(); plProg = 0;
  peopleField.points.visible = true;
  updateCaption();
}
function hidePeople() {
  if (peopleField) peopleField.points.visible = false;
  updateCaption();
}
function togglePeople() { // J — only meaningful while focused
  if (!focusMode) return;
  peopleOn = !peopleOn;
  if (peopleOn) seedPeople(); else hidePeople();
}

// The caption — the money line, with its own honesty attached: the 1:100 scale, the population
// source, and 'reported' (these are reports that reached a station, not victims).
const captionEl = document.createElement('div');
captionEl.id = 'suburb-caption';
captionEl.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:10;' +
  'max-width:min(92vw,640px);text-align:center;font:12px/1.6 ui-monospace,"SF Mono",Menlo,monospace;' +
  'color:#a8b2c6;padding:7px 14px;border-radius:8px;background:rgba(6,8,13,.66);' +
  'border:1px solid rgba(140,170,210,.10);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);' +
  'pointer-events:none;user-select:none;opacity:0;transition:opacity .4s';
document.body.appendChild(captionEl);
function updateCaption() {
  const on = focusMode && peopleOn && focusStation >= 0;
  captionEl.style.opacity = on ? '1' : '0';
  if (!on) return;
  const s = activeStations()[focusStation];
  const n = (s.crimes[crimeType] && s.crimes[crimeType][years[yi]]) || 0;
  const line = suburbCaptionLine(s.pop, n, crimeLabels[crimeType] || crimeType, yearLabels[yi]);
  captionEl.innerHTML = line.replace(/^([\d,]+ residents)/, '<b style="color:#d4dcef">$1</b>') +
    '<br><span style="color:#77839a;font-size:10.5px">each grey dot ≈ 100 residents · WorldPop 2020 · reported crimes only</span>';
}

// The beacon ring sits just outside the precinct's jitter radius; the shimmer is its pulse.
function seedBeacon() {
  const s = activeStations()[focusStation];
  const R = Math.max(9, s.r * 1.15);
  const pos = new Float32Array(BEACON_N * 2), den = new Float32Array(BEACON_N).fill(0.55);
  for (let i = 0; i < BEACON_N; i++) {
    const a = (i / BEACON_N) * Math.PI * 2;
    const r = R + (Math.random() - 0.5) * 1.6;
    pos[i * 2] = s.x + Math.cos(a) * r;
    pos[i * 2 + 1] = s.y + Math.sin(a) * r;
  }
  const ring = { positions: pos, density: den };
  beaconField.setSource(ring); beaconField.setTarget(ring); beaconField.setT(1);
  beaconField.points.visible = true;
}

// ---- the locate overlay (H): "your suburb… or find me" ----------------------------------------------
// Text matches the CURRENT region's station names — case/space/punct-insensitive, prefix beats
// contains, shorter name beats longer (most specific wins). "Find me" is CLIENT-SIDE ONLY: the
// coordinate lives in one callback for one nearest-station pass and is never transmitted or stored
// (the card says so). Outside the reach of every station here (>60 km) → say so kindly, stay put.
const locateEl = document.getElementById('locate');
const locateInput = document.getElementById('locate-input');
const locateMatch = document.getElementById('locate-match');
const fold = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function matchStation(q) {
  const f = fold(q);
  if (!f) return -1;
  const sts = activeStations();
  let best = -1, bestRank = Infinity;
  for (let i = 0; i < sts.length; i++) {
    const n = fold(sts[i].name);
    const rank = n.startsWith(f) ? n.length : (n.includes(f) || f.includes(n)) ? 1000 + n.length : -1;
    if (rank >= 0 && rank < bestRank) { bestRank = rank; best = i; }
  }
  return best;
}
function haversineKm(lng1, lat1, lng2, lat2) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLng = (lng2 - lng1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function openLocate() {
  if (!locateEl || drilling || pieMode || triPieMode || tollMode || canyonMode || flockMode || forensicsMode) return; // focus is a map-view lens (pulse ok — confirm exits it)
  locateEl.classList.add('open');
  if (locateInput) locateInput.value = '';
  if (locateMatch) locateMatch.textContent = `matching ${(REGION_META[region] || REGION_META.wc).name}’s precincts…`;
  locateInput && locateInput.focus();
}
function closeLocate() { if (locateEl) locateEl.classList.remove('open'); }
locateInput && locateInput.addEventListener('input', () => {
  const si = matchStation(locateInput.value);
  locateMatch.textContent = si < 0
    ? (fold(locateInput.value) ? 'no match here yet — keep typing, or try the police-station name' : '…')
    : '→ ' + activeStations()[si].name;
});
locateInput && locateInput.addEventListener('keydown', (e) => {
  if (e.code !== 'Enter') return;
  const si = matchStation(locateInput.value);
  if (si < 0) { locateMatch.textContent = 'nothing matches — try the nearest big suburb, or ◎ find me'; return; }
  closeLocate();
  enterFocus(si);
});
document.getElementById('locate-me')?.addEventListener('click', () => {
  if (!navigator.geolocation) { locateMatch.textContent = 'no location on this device — type your suburb instead'; return; }
  locateMatch.textContent = 'asking your browser…';
  navigator.geolocation.getCurrentPosition((p) => {
    // The coordinate never leaves this callback: one nearest-station pass, then it's gone.
    const lng = p.coords.longitude, lat = p.coords.latitude;
    const sts = activeStations();
    let best = -1, bestKm = Infinity;
    for (let i = 0; i < sts.length; i++) {
      const d = haversineKm(lng, lat, sts[i].lng, sts[i].lat);
      if (d < bestKm) { bestKm = d; best = i; }
    }
    if (best < 0 || bestKm > 60) {
      locateMatch.textContent = region === 'wc'
        ? 'you seem to be outside the Western Cape — the field stays put (type a suburb to visit one anyway)'
        : `nothing within 60 km of ${REGION_META[region].name} — M zooms back out to the whole province`;
      return;
    }
    closeLocate();
    enterFocus(best);
  }, () => { locateMatch.textContent = 'location unavailable — type your suburb instead'; }, { timeout: 8000, maximumAge: 60000 });
});
document.getElementById('locate-close')?.addEventListener('click', closeLocate);
locateEl && locateEl.addEventListener('click', (e) => { if (e.target === locateEl) closeLocate(); });

window.addEventListener('keydown', (e) => {
  lastInputAt = performance.now();
  if (aboutEl && aboutEl.classList.contains('open')) { // the about card swallows keys; Esc closes
    if (e.code === 'Escape') { e.preventDefault(); toggleAbout(false); }
    return;
  }
  if (locateEl && locateEl.classList.contains('open')) { // the locate prompt swallows keys (typing!); Esc closes
    if (e.code === 'Escape') { e.preventDefault(); closeLocate(); }
    return;
  }
  if (e.key === '?' || e.code === 'Slash') { e.preventDefault(); toggleAbout(); return; } // ? opens the card from ANY state
  if (tollMode) { // the toll swallows the toolkit: space pauses, 1 holds the 1:1 drip, K/M/Esc end it
    if (e.code === 'Space') { e.preventDefault(); tollPauseToggle(); }
    else if (e.code === 'Digit1') { e.preventDefault(); if (!tollHoldKey) { tollHoldKey = true; refreshHud(); } }
    else if (e.code === 'KeyK' || e.code === 'KeyM' || e.code === 'Escape') { e.preventDefault(); exitToll(); }
    return;
  }
  if (drilling) return; // input is quiet mid-transition
  if (flockMode) { // airborne: ANY key lands the field (it's the attract state — input means "wake")
    e.preventDefault();
    landFlock();
    return;
  }
  if (e.code === 'KeyH') { e.preventDefault(); if (focusMode) exitFocus(); else openLocate(); return; }
  if (pulseMode) { // the pulse has its own clock: arrows step months, N/M return to years
    if (e.code === 'KeyN' || e.code === 'KeyM') { e.preventDefault(); exitPulse(); }
    else if (e.code === 'Space') { e.preventDefault(); playing = !playing; if (playing) { holdUntil = performance.now(); morphStart = -1; } }
    else if (e.code === 'ArrowRight') { e.preventDefault(); stepMonth(1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); stepMonth(-1); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); flipCrime(1); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); flipCrime(-1); }
    else if (e.code === 'KeyC') { e.preventDefault(); toggleMode(); }
    else if (e.code === 'KeyT') { e.preventDefault(); toggleTerrain(); }
    return;
  }
  if (canyonMode) { // the canyon's own quiet toolkit: flip the landform's crime, or leave
    if (e.code === 'KeyV' || e.code === 'KeyM') { e.preventDefault(); toggleCanyon(); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); flipCrime(1); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); flipCrime(-1); }
    return;
  }
  if (forensicsMode) { // the strip's own keys: ↑↓ re-sorts to another crime, X or M swarms home
    if (e.code === 'KeyX' || e.code === 'KeyM') { e.preventDefault(); toggleForensics(); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); flipCrime(1); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); flipCrime(-1); }
    return;
  }
  if (e.code === 'KeyX') { e.preventDefault(); toggleForensics(); return; }
  if (e.code === 'KeyN') { e.preventDefault(); enterPulse(); return; }
  if (e.code === 'KeyK') { e.preventDefault(); enterToll(); return; } // province flat map only (guards itself)
  if (e.code === 'KeyF') { e.preventDefault(); enterFlock(); return; } // release the field (province map only — guards itself)
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
  else if (e.code === 'KeyT') { e.preventDefault(); toggleTerrain(); } // Cape Town relief (no-op in the province)
  else if (e.code === 'KeyV') { e.preventDefault(); toggleCanyon(); }  // time as the landform (guards itself)
  else if (e.code === 'KeyU') { e.preventDefault(); toggleUnlit(); }   // the unlit field (map views only)
  else if (e.code === 'KeyJ') { e.preventDefault(); togglePeople(); } // hide/show the residents (focus only)
  else if (e.code === 'Escape') { if (focusMode) { e.preventDefault(); exitFocus(); } }
});
window.addEventListener('keyup', (e) => { // release the toll's 1:1 hold
  if (e.code === 'Digit1' && tollHoldKey) { tollHoldKey = false; if (tollMode) refreshHud(); }
});

// HUD chips → the SAME actions as the keys (touch parity: on a phone the keyboard toolkit doesn't
// exist). Guards mirror the keydown handler exactly: input is quiet mid-drill, and the 3-pie only
// listens to map/year/compare/per-capita. Blur after click so a focused chip can't re-fire on Space.
const CHIP_ACTIONS = {
  play: () => { if (triPieMode || canyonMode || forensicsMode) return; if (tollMode) { tollPauseToggle(); return; } playing = !playing; if (playing) { holdUntil = performance.now(); if (pulseMode) morphStart = -1; else if (pieMode) setYearPair(yi); } },
  yearPrev: () => { if (canyonMode || forensicsMode) return; (pulseMode ? stepMonth(-1) : stepYear(-1)); }, // the canyon holds ALL years at once — no pair to step
  yearNext: () => { if (canyonMode || forensicsMode) return; (pulseMode ? stepMonth(1) : stepYear(1)); },
  crimeUp: () => { if (triPieMode) return; flipCrime(1); },
  crimeDown: () => { if (triPieMode) return; flipCrime(-1); },
  map: () => goToMap(),
  pie: () => { if (triPieMode || pulseMode) return; togglePie(); },
  compare: () => { if (pulseMode) return; toggleTriPie(); },
  percapita: () => toggleMode(),
  terrain: () => toggleTerrain(), // guards itself (needs a loaded DEM, no pies, no drill)
  canyon: () => toggleCanyon(),   // guards itself (flat map views only)
  unlit: () => toggleUnlit(),     // guards itself (map views only)
  months: () => (pulseMode ? exitPulse() : enterPulse()),
  toll: () => (tollMode ? exitToll() : enterToll()),
  release: () => (flockMode ? landFlock() : enterFlock()), // guards itself (province flat map only)
  suburb: () => (focusMode ? exitFocus() : openLocate()), // same toggle as the H key
  forensics: () => toggleForensics(), // guards itself (flat map in, X/M out)
  about: () => toggleAbout(),
};

// About card — chip-opened only (never automatic); ✕ / backdrop / Esc close it.
const aboutEl = document.getElementById('about');
function toggleAbout(show) {
  if (!aboutEl) return;
  aboutEl.classList.toggle('open', show ?? !aboutEl.classList.contains('open'));
}
document.getElementById('about-close')?.addEventListener('click', () => toggleAbout(false));
aboutEl?.addEventListener('click', (e) => { if (e.target === aboutEl) toggleAbout(false); });

// CINEMA -- after a few idle seconds the chrome (HUD, brand, fps) bows out and the field stands
// alone; any pointer/key/wheel/touch brings it back. The About card pins the chrome awake.
const CHROME_IDLE_MS = 6000;
let chromeLastActive = performance.now();
const wakeChrome = () => { chromeLastActive = performance.now(); document.body.classList.remove('quiet'); };
for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
  window.addEventListener(ev, wakeChrome, { passive: true });
}
setInterval(() => {
  const asleep = performance.now() - chromeLastActive > CHROME_IDLE_MS
    && !(aboutEl && aboutEl.classList.contains('open'))
    && !tollMode; // the counter is the toll's honesty channel — the chrome stays awake
  document.body.classList.toggle('quiet', asleep);
}, 500);
const chipEls = {};
for (const el of document.querySelectorAll('.hud [data-act]')) {
  chipEls[el.dataset.act] = el;
  el.addEventListener('click', () => {
    // Airborne, the toolkit sleeps: only the landing chips (F release / M map) + about respond —
    // mirrors the keydown swallow, so touch and keyboard agree on what a released field ignores.
    const swallowed = flockMode && !['release', 'map', 'about'].includes(el.dataset.act);
    if (!drilling && !swallowed) { const f = CHIP_ACTIONS[el.dataset.act]; if (f) f(); }
    el.blur();
  });
}

// Contextual chips: a chip that would no-op in the current state DIMS instead of lying. Geometry
// stays put (dimming, never hiding -- a reflowing row is worse than a grey chip). Mirrors the
// keydown guards exactly; called from refreshHud so every state change repaints it.
function refreshChips() {
  const off = (act, is) => { const el = chipEls[act]; if (el) el.classList.toggle('off', !!is); };
  off('play', triPieMode || canyonMode);
  // The toll dims the whole toolkit except play (= pause), map (= end), about — months would
  // have to exit first anyway, so it dims with the rest. Everything mirrors the keydown swallow.
  // The canyon holds all 18 years at once and listens only to ↑↓ crime and V/M (its keydown swallow).
  off('yearPrev', tollMode || canyonMode); off('yearNext', tollMode || canyonMode);
  off('percapita', tollMode || canyonMode);
  off('months', pieMode || triPieMode || !monthLabels || tollMode || canyonMode);
  off('crimeUp', triPieMode || tollMode); off('crimeDown', triPieMode || tollMode);
  off('pie', triPieMode || pulseMode || tollMode || canyonMode);
  off('compare', pulseMode || tollMode || canyonMode);
  off('terrain', pieMode || triPieMode || tollMode || canyonMode || !(regionData[region] && regionData[region].terrain && regionData[region].terrain.elev));
  off('canyon', !canyonMode && (pieMode || triPieMode || pulseMode || terrainMode || tollMode));
  off('unlit', pieMode || triPieMode || pulseMode || terrainMode || tollMode || canyonMode);
  off('suburb', !focusMode && (pieMode || triPieMode || tollMode || canyonMode || forensicsMode));
  off('forensics', !forensicsMode && (pieMode || triPieMode || pulseMode || terrainMode || tollMode || canyonMode));
  if (focusMode) off('unlit', true);
  off('release', !flockMode && (region !== 'wc' || pieMode || triPieMode || pulseMode || terrainMode || tollMode || canyonMode));
  off('toll', !tollMode && (region !== 'wc' || pieMode || triPieMode || pulseMode || terrainMode || canyonMode || flockMode));
  // Whole-toolkit dims LAST, so no per-chip rule above can re-light a chip the mode swallows.
  // Airborne, the toolkit sleeps (the click handler swallows all but release/map/about) — dim to match.
  if (flockMode) for (const act of Object.keys(chipEls)) if (!['release', 'map', 'about'].includes(act)) off(act, true);
  // The strip holds all 60 months, counts only, and listens to ↑↓ + X/M — dim the rest to match its keydown swallow.
  if (forensicsMode) for (const act of ['play', 'yearPrev', 'yearNext', 'months', 'percapita', 'unlit', 'suburb', 'pie', 'compare', 'terrain', 'canyon', 'toll', 'release']) off(act, true);
}

// Debug hook (region-aware).
window.__viz = {
  // --- colour/exposure tuning (live) ---
  expo: (v) => { if (v != null) renderer.toneMappingExposure = v; return renderer.toneMappingExposure; }, // master brightness
  dataCurve: (floor, gain) => { if (field) { if (floor != null) field.setDataFloor(floor); if (gain != null) field.setDataGain(gain); } return { floor: field && field.material.uniforms.uDataFloor.value, gain: field && field.material.uniforms.uDataGain.value }; }, // per-dot brightness floor+gain
  ramp: (cool, mid, warm) => { if (field) field.setRamp(cool, mid, warm); return 'ramp updated'; }, // density colour ramp (hex strings)
  bloom: (strength, threshold, radius) => { if (strength != null) bloom.strength = strength; if (threshold != null) bloom.threshold = threshold; if (radius != null) bloom.radius = radius; return { strength: bloom.strength, threshold: bloom.threshold, radius: bloom.radius }; },
  tonemap: (name) => { const m = { none: THREE.NoToneMapping, aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping, agx: THREE.AgXToneMapping, reinhard: THREE.ReinhardToneMapping, cineon: THREE.CineonToneMapping }; if (name && m[name] !== undefined) { renderer.toneMapping = m[name]; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); } return renderer.toneMapping; },
  year: (n) => { const i = years.indexOf(n); if (i >= 0) { playing = false; setYearPair(i); t = 0; } },
  pulse: (m) => { // debug: enter the pulse (optionally at a 'YYYY-MM'), or exit if already in it
    if (pulseMode && m === undefined) { exitPulse(); return 'exited'; }
    if (!pulseMode) enterPulse();
    if (m !== undefined && monthLabels) { const i = monthLabels.indexOf(m); if (i >= 0) { playing = false; setMonthPair(i); } }
    return { pulseMode, month: monthLabels && monthLabels[mi], total: pulseData && pulseData.totals[mi] };
  },
  t: (v) => { playing = false; t = v; },
  toll: (p) => { // debug: enter the toll; toll(p) fast-forwards the gather and scrubs to uT = p
    if (!tollMode) enterToll();
    if (!tollMode) return 'toll unavailable here (province flat map only)';
    if (typeof p === 'number') {
      if (tollPhase === 'gather') beginTollClock(performance.now());
      tollT = Math.min(Math.max(p, 0), 1); t = tollT;
      updateTollHud(true);
    }
    const counting = tollPhase === 'toll' || tollPhase === 'drain';
    return { phase: tollPhase, M: tollData.M, count: counting ? tollCountAt(tollT) : 0,
      tollT, year: yearLabels[tollYearFrac(counting ? tollT : 0).y], paused: tollPaused, spinRate: TOLL_SPIN_RATE };
  },
  tollSpin: (rate) => { // debug: live-tune the settled-ring spin rate (rad/s); re-bakes if tolling
    if (typeof rate === 'number') { TOLL_SPIN_RATE = rate; if (tollMode && tollData) bakeTollSpin(); }
    return { spinRate: TOLL_SPIN_RATE, revSeconds: TOLL_SPIN_RATE ? (2 * Math.PI / Math.abs(TOLL_SPIN_RATE)).toFixed(0) : Infinity };
  },
  word: (w, opts) => { // live-tune the toll's memorial backdrop word. word('') hides; opts: {fontFrac,jitter,weight,yFrac,spanFrac}
    if (typeof w === 'string') tollWord = w;
    if (opts) Object.assign(tollWordOpts, opts);
    if (tollMode) showTollWord();
    if (wordField && (opts && opts.matte)) wordField.material.uniforms.uMatte.value.set(opts.matte);
    return { word: tollWord, ...tollWordOpts, matte: '#' + (wordField ? wordField.material.uniforms.uMatte.value.getHexString() : '') };
  },
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
      setDataPair(pie, pie); field.setT(1);
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
      setDataPair(lastTriPie, lastTriPie); field.setT(1);
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
    const s = (stationsByRegion[region] || stationsByRegion.wc).find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
    return s ? { name: s.name, x: s.x, y: s.y, dc: s.dc, pop: s.pop } : 'not found';
  },
  matte: (hex) => { for (const f of [structField, terrainField]) if (f) f.material.uniforms.uMatte.value.set(hex); },
  hideData: (hide = true) => { if (field) field.points.visible = !hide; },
  region: (r) => { if (REGION_META[r]) startDrill(r); return region; }, // debug: force a drill into any region
  terrain: () => { toggleTerrain(); return { terrainMode, region }; },            // debug: toggle the current region's relief
  canyon: () => { toggleCanyon(); return { canyonMode, region, crime: crimeType }; }, // debug: toggle the rate surface
  canyonZ: (v) => { if (v != null) canyonZPeak = v; return canyonZPeak; },            // live-tune the surface height
  canyonState: () => ({ canyonMode, crime: crimeType, flipTo: canyonFlipTo, zCur: canyonZCur, op: canyonOp, region }), // read-only probe
  unlit: () => { toggleUnlit(); return { unlitOn, unlitShown, pool: UNLIT_COUNT }; }, // debug: toggle the estimated-unreported field
  unlitDots: (px) => unlitField && unlitField.setSize(px),
  unlitMatte: (hex) => unlitField && unlitField.material.uniforms.uMatte.value.set(hex),
  flock: () => { if (flockMode) landFlock(); else enterFlock(); return { flockMode, phase: flockPhase, frame: flockIdx }; }, // debug: release / land the field
  suburb: (name) => { // debug: focus a precinct by name (no name while focused = exit) — headless testing
    if (name === undefined) { if (focusMode) { exitFocus(); return 'exited'; } return 'not focused'; }
    const si = matchStation(String(name));
    if (si < 0) return 'not found';
    enterFocus(si);
    const s = activeStations()[si];
    const n = (s.crimes[crimeType] && s.crimes[crimeType][years[yi]]) || 0;
    return { station: s.name, pop: s.pop, personDots: Math.round(s.pop / PEOPLE_PER_DOT), n,
      caption: suburbCaptionLine(s.pop, n, crimeLabels[crimeType] || crimeType, yearLabels[yi]) };
  },
  focusForensic: () => { // verification: is the dim post-pass REALLY on the GPU buffer? Per-station
    if (!field) return null; // ratio of the field's live target densities vs the undimmed provider
    const arr = field.points.geometry.getAttribute('aTargetDensity').array; // layout — 1.0 = kept, 0.12 = dimmed.
    const b = providers[region][dataMode];
    const und = b.layouts[crimeType][(yi + 1) % years.length].density; // at rest, target = yi+1
    const o = sliceStart();
    const sts = activeStations();
    const ratios = b.slotRanges.map(([b0, k], si) => {
      let sum = 0, n = 0;
      for (let j = 0; j < k; j++) { const u = und[b0 + j]; if (u > 0.001) { sum += arr[o + b0 + j] / u; n++; } }
      return { name: sts[si].name, ratio: n ? sum / n : -1, active: n };
    });
    return { focusMode, region, station: focusMode && focusStation >= 0 ? sts[focusStation].name : null, ratios };
  },
  peopleForensic: () => ({ // verification: the beacon/people pools' live state
    beaconVisible: !!(beaconField && beaconField.points.visible),
    peopleVisible: !!(peopleField && peopleField.points.visible),
    peopleActive: peopleField ? peopleField.points.geometry.getAttribute('aTargetDensity').array.filter((d) => d > 0).length : 0,
    pop: focusMode && focusStation >= 0 ? activeStations()[focusStation].pop : 0,
  }),
  forensics: (enter) => { // debug/headless: the ranked table for the current region + crime; enter=true/false toggles the strip
    if (enter === true && !forensicsMode) toggleForensics();
    else if (enter === false && forensicsMode) toggleForensics();
    const stats = forensicsStats(activeStations(), crimeType);
    const zone = (s) => (!s.testable ? 'too small to test' : s.D < LOOK_CLOSER_D ? 'look closer' : 'behaves like a tally');
    const rows = [...stats].sort((a, b) => (a.testable === b.testable ? a.D - b.D : a.testable ? -1 : 1))
      .map((s) => ({ name: s.name, D: +s.D.toFixed(4), mean: +s.mean.toFixed(2), testable: s.testable, zone: zone(s), digitN: s.digitN, chi2p: s.chi2p == null ? null : +s.chi2p.toFixed(4) }));
    return { region, crime: crimeType, threshold: LOOK_CLOSER_D, forensicsMode, testable: rows.filter((r) => r.testable).length, excluded: rows.length - rows.filter((r) => r.testable).length, rows };
  },
};

// ---- hover readout — "Nyanga · 2,300 robbery · 2019/20" (works in map AND pie), region-aware ----
const tip = document.createElement('div');
tip.style.cssText = 'position:fixed;pointer-events:none;z-index:20;padding:4px 9px;border-radius:5px;' +
  'background:rgba(8,10,16,.86);border:1px solid rgba(140,170,210,.28);color:#e4ebf4;' +
  'font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;opacity:0;' +
  'transition:opacity .12s;transform:translate(-50%,calc(-100% - 14px))';
app.appendChild(tip);
const _hv = new THREE.Vector3();
const activeStations = () => stationsByRegion[region] || stationsByRegion.wc;
function precinctAnchors() {
  const out = [], st = activeStations();
  if (forensicsMode && lastForensics) { // one anchor ladder per column — hover anywhere on a ribbon
    for (const col of lastForensics.columns) {
      for (const fy of [-0.4, -0.2, 0, 0.2, 0.4]) out.push({ si: col.si, x: col.x, y: fy * lastForensics.H });
    }
    return out;
  }
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
    const zLift = terrainMode ? zScaleCur : 0; // ride the current region's relief when terrain is on
    for (let si = 0; si < st.length; si++) {
      const s = st[si];
      out.push({ si, x: s.x, y: s.y, z: zLift ? demHeightAt(s.x, s.y) * zLift : 0 });
    }
  }
  return out;
}
function hoverPrecinct(clientX, clientY) {
  if (drilling || flockMode) return -1; // airborne dots aren't at any precinct — the tooltip sleeps
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = clientX - rect.left, my = clientY - rect.top;
  fieldGroup.updateWorldMatrix(true, false);
  let best = -1, bestD = Infinity, bestCrime = crimeType;
  for (const a of precinctAnchors()) {
    _hv.set(a.x, a.y, a.z || 0);
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
// Canyon hover: snap to the nearest (station, year) cell centre, riding the risen surface. The rate
// shown is the anchor's own float64 (crimes/pop×100k) — never read back from the GPU arrays.
function updateCanyonTip() {
  if (!canyonCur || drilling) { tip.style.opacity = '0'; return; }
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = mouseX - rect.left, my = mouseY - rect.top;
  fieldGroup.updateWorldMatrix(true, false);
  let best = null, bestD = Infinity;
  for (const a of canyonCur.anchors) {
    _hv.set(a.x, a.y, a.z * canyonZCur);
    fieldGroup.localToWorld(_hv);
    _hv.project(camera);
    const sx = (_hv.x * 0.5 + 0.5) * rect.width, sy = (-_hv.y * 0.5 + 0.5) * rect.height;
    const d = Math.hypot(sx - mx, sy - my);
    if (d < bestD) { bestD = d; best = a; }
  }
  if (!best || bestD > 26) { tip.style.opacity = '0'; return; }
  tip.innerHTML = `${best.name} · ${crimeLabels[crimeType] || crimeType} · ${yearLabels[best.yi]}` +
    `<br><span style="color:#9fb0c8">${best.rate.toFixed(1)} per 100k</span>`;
  tip.style.left = mouseX + 'px';
  tip.style.top = mouseY + 'px';
  tip.style.opacity = '1';
}

// Text-sparkline of the 10-bucket last-digit histogram (digits 0–9 left to right).
const SPARK = '▁▂▃▄▅▆▇█';
function digitSpark(hist) {
  const max = Math.max(1, ...hist);
  return hist.map((v) => SPARK[Math.round((v / max) * (SPARK.length - 1))]).join('');
}
function updateTooltip() {
  if (tollMode) { tip.style.opacity = '0'; return; } // the tooltip sleeps during the ceremony
  if (mouseX == null) return;
  if (canyonMode) { updateCanyonTip(); return; }
  const si = hoverPrecinct(mouseX, mouseY);
  if (si < 0) { tip.style.opacity = '0'; return; }
  const s = activeStations()[si];
  const ct = hoverCrimeType || crimeType;
  if (forensicsMode && lastForensics) {
    // The forensic readout — wording is load-bearing: a look-closer FLAG, never a finding.
    const st = lastForensics.stats[si];
    let body;
    if (!st.testable) {
      body = `<span style="color:#9fb0c8">too small to test — ${st.mean.toFixed(1)}/month (below ${TESTABLE_MEAN})</span>`;
    } else {
      const digits = st.chi2p != null
        ? `last digits ${digitSpark(st.digitHist)} · χ² p ${st.chi2p < 0.01 ? '&lt; 0.01' : st.chi2p.toFixed(2)}`
        : st.digitN > 0
          ? `last digits ${digitSpark(st.digitHist)} · under ${DIGIT_MIN_N} months ≥ 20 — no χ²`
          : `counts under 20 — last digits untestable`;
      body = `<span style="color:#9fb0c8">D ${st.D.toFixed(2)} · ${st.mean.toFixed(1)}/month</span>` +
        `<br><span style="color:#9fb0c8">${digits}</span>` +
        `<br><span style="color:#77839a">regularity has innocent causes —</span>` +
        `<br><span style="color:#77839a">this is a look-closer flag, not a finding</span>`;
    }
    tip.innerHTML = `${s.name} · ${crimeLabels[ct] || ct}<br>${body}`;
    tip.style.left = mouseX + 'px';
    tip.style.top = mouseY + 'px';
    tip.style.opacity = '1';
    return;
  }
  const n = pulseMode
    ? ((s.monthly && s.monthly[ct] && s.monthly[ct][mi]) || 0)
    : ((s.crimes[ct] && s.crimes[ct][years[yi]]) || 0);
  const rate = s.pop ? Math.round((n / s.pop) * 100000) : 0;
  const val = dataMode === 'percapita' ? `${rate.toLocaleString()} per 100k` : `${n.toLocaleString()} reported`;
  tip.innerHTML = `${s.name} · ${crimeLabels[ct] || ct} · ${pulseMode ? fmtMonth(monthLabels[mi]) : yearLabels[yi]}` +
    `<br><span style="color:#9fb0c8">${val}</span>`;
  if (unlitOn && unlitShown && !pulseMode && !pieMode && !triPieMode && RATES.rates[ct]) { // est line leaves WITH the chip — never numbers without the declaration
    const spec = RATES.rates[ct];
    const u = Math.round((n * (1 - spec.r)) / spec.r); // the exact math the dots draw — R×(1−r)/r
    const uval = dataMode === 'percapita'
      ? `est. +${(s.pop ? Math.round((u / s.pop) * 100000) : 0).toLocaleString()} per 100k unreported`
      : `est. +${u.toLocaleString()} unreported`;
    tip.innerHTML += `<br><span style="color:#9c8fc0">${uval} (r=${Math.round(spec.r * 100)}%, GPSJS national${spec.floor ? ' · floor' : ''})</span>`;
  }
  tip.style.left = mouseX + 'px';
  tip.style.top = mouseY + 'px';
  tip.style.opacity = '1';
}
renderer.domElement.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; updateTooltip(); });
renderer.domElement.addEventListener('mouseleave', () => { mouseX = mouseY = null; tip.style.opacity = '0'; });

// ---- place labels — a whisper of typography (structure-role: grey, matte, recessive) ----------------
// Sense of place: the PROVINCE names its six districts. Detail (zoomed) views stay label-free — always-on
// town names made them busy, and the rollover already names a station (maker's call, 2026-07-07). Labels
// exist only AT REST on a flat map — they fade during drills/pies/terrain — and are pointer-transparent
// so they can never block a tap. They must whisper: small, grey, no glow — frame, never data.
const labelLayer = document.createElement('div');
labelLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .5s ease';
document.body.appendChild(labelLayer);
const labelEls = [], LABEL_MAX = 22;
let labelSpecs = [], labelsRegion = null;
const labelsKey = () => region + (canyonMode ? '·canyon' : ''); // the canyon swaps the label set without a region change
function buildLabelSpecs() {
  labelsRegion = labelsKey();
  const total = (s) => { let n = 0; for (const ty of crimeTypes) for (const y of years) n += (s.crimes[ty] && s.crimes[ty][y]) || 0; return n; };
  if (canyonMode && canyonCur) {
    // The canyon's labels-on-relief exception: the year axis (few, load-bearing — hover names a cell
    // but can't name a column). Even years outrank odd, so collision-culling on a narrow screen
    // drops every OTHER label instead of a random scatter; 2020/21 is even, it always survives.
    const g = canyonCur.grid;
    labelSpecs = years.map((_, c) => ({
      name: yearLabels[c],
      x: g.x0 + (c + 0.5) * g.cellW,
      y: g.y0 - g.rows * g.cellH - 14, // just south of the grid — the tilted view's near edge
      rank: c % 2 === 0 ? 2 : 1,
      big: false,
    }));
  } else if (region === 'wc') {
    labelSpecs = DETAIL_REGIONS.map((rk) => {   // six district names, each at the mean of its stations
      const sts = stationsByRegion.wc.filter((s) => norm(s.dc) === REGION_META[rk].dc);
      const x = sts.reduce((a, s) => a + s.x, 0) / sts.length, y = sts.reduce((a, s) => a + s.y, 0) / sts.length;
      return { name: REGION_META[rk].name, x, y, rank: sts.reduce((a, s) => a + total(s), 0), big: true };
    });
  } else {
    labelSpecs = []; // zoomed views stay clean — hover names the stations
  }
  labelSpecs.sort((a, b) => b.rank - a.rank);
  labelSpecs = labelSpecs.slice(0, LABEL_MAX);
  while (labelEls.length < labelSpecs.length) {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;transform:translate(-50%,-150%);white-space:nowrap;' +
      'font:500 11px ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;' +
      'color:#9aa7bd;opacity:.78;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 9px rgba(0,0,0,.85)';
    labelLayer.appendChild(el); labelEls.push(el);
  }
}
const _lv = new THREE.Vector3();
function updateLabels() {
  const show = canyonMode
    ? strProg >= 1 // year labels ride in once the graticule settles
    : !drilling && !flockMode && !pieMode && !triPieMode && !forensicsMode && !terrainMode && !tollMode && strProg >= 1 && trProg >= 1;
  labelLayer.style.opacity = show ? '1' : '0';
  if (!show) return;
  if (labelsRegion !== labelsKey()) buildLabelSpecs();
  fieldGroup.updateWorldMatrix(true, false);
  const W = window.innerWidth, H = window.innerHeight, placed = [];
  for (let i = 0; i < labelEls.length; i++) {
    const el = labelEls[i], sp = labelSpecs[i];
    if (!sp) { el.style.display = 'none'; continue; }
    _lv.set(sp.x, sp.y, 0);
    fieldGroup.localToWorld(_lv); _lv.project(camera);
    const sx = (_lv.x * 0.5 + 0.5) * W, sy = (-_lv.y * 0.5 + 0.5) * H;
    // greedy collision by rank: an approx text box; later (lower-rank) labels yield to placed ones
    const w = sp.name.length * 8.2 + 16, h = 19;
    let hit = sx < 8 || sx > W - 8 || sy < 16 || sy > H - 8;
    if (!hit) for (const p of placed) { if (Math.abs(sx - p.x) < (w + p.w) / 2 && Math.abs(sy - p.y) < h) { hit = true; break; } }
    if (hit) { el.style.display = 'none'; continue; }
    placed.push({ x: sx, y: sy, w });
    if (el.textContent !== sp.name) el.textContent = sp.name;
    if (el.__big !== sp.big) { el.__big = sp.big; el.style.fontSize = sp.big ? '12px' : '11px'; el.style.opacity = sp.big ? '.85' : '.78'; }
    el.style.left = sx + 'px'; el.style.top = sy + 'px'; el.style.display = 'block';
  }
}

// Click: (1) in the 3-pie, resolve to the clicked pie; (2) on the province MAP, clicking Cape Town's
// cluster drills in; (3) on the Cape Town MAP, a tap drills back out. A tap is told from a pan by move distance.
let _downX = 0, _downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { lastInputAt = performance.now(); _downX = e.clientX; _downY = e.clientY; });
window.addEventListener('wheel', () => { lastInputAt = performance.now(); }, { passive: true });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (drilling || tollMode) return; // the toll's own pointer grammar owns taps while tolling
  if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 6) return; // a drag (pan), not a click
  if (flockMode) { landFlock(); return; } // a tap anywhere lands the field — the F/Esc parity for touch
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
  if (pieMode || forensicsMode) return;              // no drill from the pie or the strip
  if (canyonMode) { toggleCanyon(); return; }        // tap in the canyon → back to the flat map
  if (terrainMode) { toggleTerrain(); return; }      // tap in Cape Town terrain → back to the flat map
  if (region === 'wc') {
    const { s, d } = nearestStation(stationsByRegion.wc, e.clientX, e.clientY);
    if (s && d < 120) { const rk = dcToRegion(s.dc); if (rk) startDrill(rk); } // click near a station → drill its district
  } else {
    startDrill('wc');                                // tap anywhere in a district → back out to the province
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
const triLabels = []; // one label per compare-pie, pool grows to however many crimes are baked
function ensureTriLabels(n) {
  while (triLabels.length < n) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;pointer-events:none;z-index:19;color:#8b98ac;' +
      'font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;' +
      'opacity:0;transition:opacity .2s;transform:translate(-50%,0)';
    app.appendChild(d);
    triLabels.push(d);
  }
}
function updateTriLabels() {
  if (!triPieMode || !lastTriPie) { for (const d of triLabels) d.style.opacity = '0'; return; }
  ensureTriLabels(lastTriPie.centers.length);
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

// Grey captions for the forensics strip: zone labels along the baseline, the D = 1 tick's name, and
// the innocent-causes legend. Structure-voiced (grey, small, recessive) and pointer-transparent; the
// WORDING is load-bearing — descriptive zones and a look-closer flag, never an accusation.
const forensicsLabels = [];
function ensureForensicsLabels(n) {
  while (forensicsLabels.length < n) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;pointer-events:none;z-index:19;color:#8b98ac;' +
      'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;' +
      'opacity:0;transition:opacity .2s;transform:translate(-50%,0);text-align:center;white-space:nowrap';
    app.appendChild(d);
    forensicsLabels.push(d);
  }
}
function updateForensicsLabels() {
  if (!forensicsMode || !lastForensics || strProg < 1) { for (const d of forensicsLabels) d.style.opacity = '0'; return; }
  const fr = lastForensics.frame;
  const anchors = [];
  for (const zn of fr.zones) anchors.push({ x: (zn.x0 + zn.x1) / 2, y: fr.baseY - 12, text: zn.label, dim: false });
  if (fr.d1x != null) anchors.push({ x: fr.d1x, y: fr.baseY + 16, text: 'D = 1 · a pure tally', dim: true });
  // the legend: two short stacked rows ABOVE the strip (below the baseline it hides behind the
  // HUD card at the default framing; one long line overflows narrow screens)
  const legendX = (fr.x0 + fr.x1) / 2;
  anchors.push({ x: legendX, y: fr.topY + 46, dim: true, text: `zones are descriptive: D ≈ 1 behaves like a tally · D < ${lastForensics.threshold} → look closer` });
  anchors.push({ x: legendX, y: fr.topY + 28, dim: true, text: 'regularity has innocent causes (court-driven detections, process-crime quotas, tiny true rates) — a flag, not a finding' });
  ensureForensicsLabels(anchors.length);
  const rect = renderer.domElement.getBoundingClientRect();
  fieldGroup.updateWorldMatrix(true, false);
  forensicsLabels.forEach((d, i) => {
    const a = anchors[i];
    if (!a) { d.style.opacity = '0'; return; }
    _hv.set(a.x, a.y, 0);
    fieldGroup.localToWorld(_hv); _hv.project(camera);
    d.style.left = ((_hv.x * 0.5 + 0.5) * rect.width) + 'px';
    d.style.top = ((-_hv.y * 0.5 + 0.5) * rect.height) + 'px';
    if (d.textContent !== a.text) d.textContent = a.text;
    d.style.color = a.dim ? '#6b7689' : '#8b98ac';
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
    if (unlitField && unlitShown) { unlitField.setT(e); unlitField.setTime(time); } // dispersing with the drill
    if (p >= 1) {
      drilling = false;
      region = drillTo;
      hideUnlitNow(); // the estimate dispersed with the drill (intent already off) — land clean
      repoint();
      landRegion();                                  // re-seed cleanly at the landed region's map, at rest
      reseedTerrain();                               // rebuild the relief pool for the landed region ('T' shows ITS mountains)
      refreshHud();                                  // refreshes the region label + context-aware hint

    }
    controls.update();
    render();
    requestAnimationFrame(tick);
    return;
  }

  if (flockMode) {
    // The murmuration chain: fly to the next keyframe (heavy stagger = the turning wave), hold a
    // breath, then on — wrapping around forever until a landing is asked for. The 'land' leg is the
    // one morph home; its completion restores the truthful at-rest pair.
    if (flockPhase === 'land') {
      const p = Math.min((now - flockStart) / FLOCK_LAND_MS, 1);
      t = easeInOut(p);
      if (p >= 1) {
        flockMode = false;
        field.setDriftSpeed(1.0); // flow/drift amplitudes have eased ~to rest through the glide
        setYearPair(yi);   // re-anchor the scrub pair on the truthful map (mirrors pieMorphing's re-anchor) + restore the HUD
        morphStart = -1; holdUntil = now + HOLD_MS;
      }
    } else {
      // Full legs under the SURGE easing: velocity slides between (1−A) and (1+A) with matched
      // slope at the joins — the flock slows into each waypoint, banks, surges out; never stops,
      // never steps. At p=1 (stagger ≈ 1) the pose IS the frame, so the handoff to the next leg is
      // seamless — no pose-readback needed in flight (airbornePose still serves the landing).
      const p = Math.min((now - flockStart) / FLOCK_MS, 1);
      t = surgeEase(p);
      if (p >= 1) {
        const next = (flockIdx + 1) % flockFrames.length;
        field.setSource(withFlockDensity(flockFrames[flockIdx])); // full-buffer: province-only state (see enterFlock)
        field.setTarget(withFlockDensity(flockFrames[next]));
        flockIdx = next; flockStart = now; t = 0;
      }
    }
  } else if (pieMorphing) {
    const p = Math.min((now - pieMorphStart) / PIE_MS, 1);
    t = swarmEase(p);
    if (p >= 1) {
      pieMorphing = false;
      if (!pieMode && !triPieMode && !canyonMode && !forensicsMode) (pulseMode ? setMonthPair(mi) : setYearPair(yi)); // re-anchor the scrub pair on the flat map (in the canyon the swarm stays parked)
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
  } else if (tollMode) {
    if (tollPhase === 'gather') {                    // map → the dimmed 18-year murder map (random seeds)
      const p = Math.min((now - tollPhaseStart) / TOLL_GATHER_MS, 1);
      t = swarmEase(p);
      if (p >= 1) beginTollClock(now);
    } else if (tollPhase === 'toll') {               // the dial clock: sweep rate, or the 1:1 drip on hold
      const dt = (now - tollLastNow) / 1000;
      tollLastNow = now;
      field.setSpinTime((now - tollSpinStart) / 1000); // real time — the settled disc turns even when paused/complete
      if (!tollPaused && !tollScrubbing && tollT < 1) {
        const rate = (tollHoldPtr || tollHoldKey)
          ? (1 - tollW()) / tollData.M               // exactly one landing per second (seed spacing)
          : 1000 / TOLL_SWEEP_MS;                    // the ~75 s sweep
        tollT = Math.min(1, tollT + dt * rate);
      }
      t = tollT;
      updateTollHud();
      updateTollHand(tollT);
    } else if (tollPhase === 'drain') {              // the pour reverses — fast, eased, ordered seeds still on
      const p = Math.min((now - tollPhaseStart) / TOLL_DRAIN_MS, 1);
      field.setSpinTime((now - tollSpinStart) / 1000); // still-landed dots keep turning; lifting dots stop (gate)
      tollT = tollDrainFrom * (1 - drillEase(p));
      t = tollT;
      updateTollHud();
      updateTollHand(tollT);
      if (p >= 1) beginTollHome();
    } else {                                         // 'home' — the dots morph gently back to the truthful map
      const p = Math.min((now - tollPhaseStart) / TOLL_HOME_MS, 1);
      t = swarmEase(p);
      if (p >= 1) {
        tollMode = false; tollPhase = '';
        tollData = null; tollFrame = null; tollHand = null; tollSeeds = null;
        setYearPair(yi);                             // re-anchor the year pair cleanly, at rest (playing stays off)
        refreshHud();
      }
    }
  } else if (playing) {
    const MS = pulseMode ? PULSE_MS : YEAR_MS, HOLD = pulseMode ? PULSE_HOLD : HOLD_MS;
    if (morphStart < 0 && now >= holdUntil) morphStart = now; // begin a year (or month) crossing
    if (morphStart >= 0) {
      const p = Math.min((now - morphStart) / MS, 1);
      t = easeInOut(p);
      if (p >= 1) {
        morphStart = -1;
        holdUntil = now + HOLD;
        if (pulseMode) setMonthPair(mi + 1); else setYearPair(yi + 1);
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
  if (unlitField && unlitShown) {
    if (unlitProg < 1) { // own clock: condense-in / disperse-out
      unlitProg = Math.min((now - unlitStart) / UNLIT_MS, 1);
      unlitField.setT(swarmEase(unlitProg));
      if (unlitProg >= 1) {
        if (unlitPhase === 'out') hideUnlitNow();
        else unlitAnchorPair(); // condensed — fall in step with the year scrub
        unlitPhase = null;
      }
    } else {
      unlitField.setT(t); // anchored: the shadow rides the SAME t as the reported field
    }
    if (unlitShown) unlitField.setTime(time);
  }
  // Idle attract: long stillness on the resting province releases the field again (any input wakes it).
  if (!flockMode && region === 'wc' && !drilling && !pieMode && !triPieMode && !pulseMode
    && !terrainMode && !tollMode && !canyonMode && !focusMode && !forensicsMode && !flipping && !pieMorphing && lastInputAt > 0 && now - lastInputAt > IDLE_RELEASE_MS) {
    enterFlock(true);
  }

  // Released-field motion ramps: flow + boosted drift ease UP on take-off and settle through the
  // landing glide (amplitudes only — speeds are pinned while amplitudes are live, see FLOCK_ consts).
  if (field && (flockMode || flowCur > 0.001 || Math.abs(flockDriftCur - 0.4) > 0.01)) {
    const airborne = flockMode && flockPhase !== 'land';
    flowCur += ((airborne ? FLOCK_FLOW : 0) - flowCur) * 0.045;
    flockDriftCur += ((airborne ? FLOCK_DRIFT : 0.4) - flockDriftCur) * 0.045;
    field.setFlow(flowCur, FLOCK_FLOW_SPEED);
    field.setDrift(flockDriftCur);
  }

  if (beaconField) beaconField.setTime(time); // the beacon's pulse IS the shimmer breath
  if (peopleField) {
    if (plProg < 1) { plProg = Math.min((now - plStart) / 1100, 1); peopleField.setT(swarmEase(plProg)); }
    peopleField.setTime(time);
  }
  // Terrain (Cape Town only): ease the land up/down + the view tilt, advance the band⇄relief swarm, and
  // lift the crime with it. In the province zScaleCur stays 0 (T is a no-op there), so it renders flat.
  if (terrainField) {
    zScaleCur += ((terrainMode ? zPeak : 0) - zScaleCur) * 0.06;
    tiltCur += (((terrainMode || canyonMode) ? tiltAngle : 0) - tiltCur) * 0.06; // the canyon shares the view tilt (one relief grammar)
    if (trProg < 1) {
      trProg = Math.min((now - trStart) / trDur, 1);
      terrainField.setT(swarmEase(trProg));
      if (trProg >= 1 && trTo) terrainCurrent = trTo;
    }
    terrainField.setZScale(zScaleCur);
    terrainField.setTime(time);
    field.setZScale(zScaleCur);                        // crime climbs the relief with the land beneath it
    if (!terrainMode && terrainField.points.visible && trProg >= 1) {
      terrainField.points.visible = false;             // sink done → swap the outline back in (coincident band)
      structField.points.visible = true;
    }
  }
  // The canyon: ease the rate surface up/down, fade the pool with it. A pending crime flip parks its
  // swap at ZERO height — aZ is a single attribute (it snaps on setTarget), so the range sinks flat
  // as the old crime, swaps unseen, and rises as the new one (density crossfades on the way up).
  if (canyonField) {
    canyonZCur += (((canyonMode && !canyonFlipTo) ? canyonZPeak : 0) - canyonZCur) * 0.06;
    canyonOp += ((canyonMode ? 1 : 0) - canyonOp) * 0.08;
    if (canyonFlipTo && canyonZCur < canyonZPeak * 0.02) {
      crimeType = canyonFlipTo; canyonFlipTo = '';
      layouts = layoutsByType[crimeType];              // the map the exit returns to follows the flip
      const to = canyonRates();
      canyonField.setSource(canyonCur);
      canyonField.setTarget(to);
      canyonField.setStagger(0.6);
      cnTo = to; cnStart = now; cnProg = 0;
      refreshHud();
    }
    if (cnProg < 1) {
      cnProg = Math.min((now - cnStart) / CN_MS, 1);
      canyonField.setT(swarmEase(cnProg));
      if (cnProg >= 1 && cnTo) { canyonCur = cnTo; cnTo = null; }
    }
    canyonField.setZScale(canyonZCur);
    canyonField.setOpacity(canyonOp);
    canyonField.setTime(time);
    if (!canyonMode && canyonField.points.visible && canyonOp < 0.02) canyonField.points.visible = false;
  }
  fieldGroup.rotation.x = tiltCur;
  controls.update();
  updateTooltip();
  updateLabels();
  updateTriLabels();
  updateForensicsLabels();

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
  if (terrainField) terrainField.setPixelRatio(renderer.getPixelRatio());
  if (canyonField) canyonField.setPixelRatio(renderer.getPixelRatio());
  if (unlitField) unlitField.setPixelRatio(renderer.getPixelRatio());
});
