// The SHARED STAGE — the reusable shell every standalone view mounts on. See docs/plans/standalone-shell.md.
//
// Owns three: renderer + camera + scene + the selective-bloom pipeline + the RAF loop + resize, plus the
// two CONSERVED pools (field = glow/data, structField = matte/structure) and a view registry. Lifted
// verbatim from the explorer's boot (wcExplore.js L33–108, 404–413, 1563–1714) so the LOOK is byte-parity.
//
// INVARIANTS (plan §1):
//  • pools PERSIST across view swaps — never wiped on exit (the bake seam depends on the live pose surviving).
//  • the ACTIVE VIEW is the sole per-frame writer of the pools (single-writer kills the double-write bug class).
//    The stage writes NO pool; it only runs controls + the active view's update + render + fps.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointField } from './engine/PointField.js';
import { createStructTransition } from './engine/transition.js';
import { createPlayback } from './playback.js';
import { applyPalette, paletteToast, paletteKey, nextPalette, PALETTE_CYCLE } from './palette.js';

export const BLOOM_LAYER = 1;
const DARK = new THREE.Color('#05060a');

export function createStage() {
  // ---- scene / renderer (parity: wcExplore L36–71) --------------------------
  const app = document.getElementById('app');
  const scene = new THREE.Scene();
  scene.background = DARK;

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);
  camera.position.set(0, 0, 900);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 5.5;
  app.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.screenSpacePanning = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 70;
  controls.maxDistance = 2500;
  controls.zoomSpeed = 0.9;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.target.set(0, 0, 0);
  controls.update();

  const fieldGroup = new THREE.Group();
  scene.add(fieldGroup);

  // ---- selective bloom: ONLY the data field glows (parity: wcExplore L78–108) ----
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

  // ---- pools + auxiliary-pool factory ---------------------------------------
  let field = null, structField = null;
  const resizeHooks = [];

  // ---- the palette (src/palette.js is the ONE colour door) --------------------------------------------
  // Every data pool + every structure pool that names a ROLE registers here; a palette switch repaints
  // them all, the bg and the HUD. A new pool is painted with the live palette at birth. Live candidates:
  // __viz.palette(name) · Shift+P cycles current → A → B → C (no persistence). Default = today, exactly.
  const palettePools = [];
  let paletteName = 'current';
  function registerPalettePool(pool, role) {
    const entry = { pool, role };
    palettePools.push(entry);
    applyPalette(paletteName, { pools: [entry] });
  }
  function setPalette(name, toast = false) {
    const key = paletteKey(name);
    if (!key) return null;
    paletteName = key;
    const P = applyPalette(key, { pools: palettePools, background: DARK, document }); // DARK mutated in place
    if (toast) paletteToast(P.label);
    return P;
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && e.shiftKey) { e.preventDefault(); setPalette(nextPalette(paletteName), true); }
  });

  // Build+register an AUXILIARY pool (plan §1: makePool must carry EVERY uniform, else a dropped setMaxSize
  // silently fattens dots). Adds to fieldGroup, wires pixelRatio into resize, returns the PointField.
  // Palette: a data pool (glow) always wears the family ramps; a structure pool joins the palette only when
  // it names its `role` (e.g. 'words') — one that passes just a `matte` keeps that literal (back-compat).
  function makePool(opts = {}) {
    const p = new PointField(opts.count, { glow: !!opts.glow, size: opts.size ?? 1.5, matte: opts.matte });
    p.setPixelRatio(renderer.getPixelRatio());
    p.setDrift(opts.drift ?? 0);
    if (opts.driftSpeed != null) p.setDriftSpeed(opts.driftSpeed);
    if (opts.maxSize != null) p.setMaxSize(opts.maxSize);
    if (opts.renderOrder != null) p.points.renderOrder = opts.renderOrder;
    if (opts.glow) p.points.layers.enable(BLOOM_LAYER);
    if (opts.visible === false) p.points.visible = false;
    fieldGroup.add(p.points);
    resizeHooks.push(() => p.setPixelRatio(renderer.getPixelRatio()));
    if (opts.glow || opts.role) registerPalettePool(p, opts.role);
    return p;
  }

  // The two CONSERVED pools (parity: wcExplore L349–361 + the aZ attr L375).
  function makeConservedPools(COUNT, structN) {
    field = new PointField(COUNT, { glow: true, size: 1.9 });
    field.setPixelRatio(renderer.getPixelRatio());
    field.setDrift(0.5);
    field.setDriftSpeed(2.0);
    field.setMaxSize(7);
    field.points.layers.enable(BLOOM_LAYER);
    field.points.geometry.setAttribute('aZ', new THREE.BufferAttribute(new Float32Array(COUNT), 1));
    fieldGroup.add(field.points);

    structField = new PointField(structN, { glow: false, size: 1.6, matte: '#566d78' });
    structField.setPixelRatio(renderer.getPixelRatio());
    structField.setDrift(0.0);
    structField.setMaxSize(7);
    fieldGroup.add(structField.points);

    registerPalettePool(field);                 // DATA → family ramps (the Toll's murders = contact)
    registerPalettePool(structField, 'lace');   // outline = role 0; dial/frames tag ROLES.frame
    setPalette(paletteName);                    // bg + HUD too (default = today, exactly)
  }

  // ---- camera framing (parity: frameUnion L405–413, single box) -------------
  function frameTo(box) {
    const W = box.w, H = box.h;
    const vFov = camera.fov * Math.PI / 180;
    const dH = (H / 2) / Math.tan(vFov / 2);
    const dW = (W / 2) / (Math.tan(vFov / 2) * camera.aspect);
    camera.position.set(0, 0, Math.max(dH, dW) * 1.08);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  function onResize(fn) { resizeHooks.push(fn); }
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomComposer.setSize(window.innerWidth, window.innerHeight);
    finalComposer.setSize(window.innerWidth, window.innerHeight);
    if (field) field.setPixelRatio(renderer.getPixelRatio());
    if (structField) structField.setPixelRatio(renderer.getPixelRatio());
    for (const fn of resizeHooks) fn();
  });

  // ---- view registry --------------------------------------------------------
  const factories = [];
  const views = new Map();     // key -> instance
  let active = null, previousViewKey = null;
  let ctx = null;

  function registerView(factory) { factories.push(factory); }

  function setView(key, opts) {
    const next = views.get(key);
    if (!next || next === active) return;
    if (active) { previousViewKey = active.meta.key; active.exit(); }   // exit MUST neutralise, not wipe (plan §1)
    active = next;
    active.enter(opts || {});
  }

  // ---- the loop (parity: wcExplore L1563–1702) ------------------------------
  const clock = new THREE.Clock();
  let frames = 0, fpsWall = -1, lastNow = -1;
  const fpsEl = document.getElementById('fps');

  function tick() {
    const now = performance.now();
    const elapsed = clock.getElapsedTime();
    const dt = lastNow < 0 ? 0 : now - lastNow;
    lastNow = now;

    controls.update();                         // damping — shell owns it (not a pool write)
    if (active) active.update(now, dt, elapsed);
    render();

    frames++;
    if (fpsWall < 0) fpsWall = now;
    else if (now - fpsWall >= 500) {
      if (fpsEl && field) fpsEl.textContent = Math.round((frames * 1000) / (now - fpsWall)) + ' fps · ' + field.count.toLocaleString() + ' pts';
      frames = 0; fpsWall = now;
    }
    requestAnimationFrame(tick);
  }

  // ---- shared __viz (generic hooks live on the shell; views attach their own live readouts) ----
  const viz = (window.__viz = window.__viz || {});
  viz.expo = (v) => { if (v != null) renderer.toneMappingExposure = v; return renderer.toneMappingExposure; };
  viz.bloom = (s, t, r) => { if (s != null) bloom.strength = s; if (t != null) bloom.threshold = t; if (r != null) bloom.radius = r; return { strength: bloom.strength, threshold: bloom.threshold, radius: bloom.radius }; };
  viz.tonemap = () => renderer.toneMapping;
  viz.view = (key, opts) => { setView(key, opts); return key; };
  viz.palette = (name) => { // the palette door: palette() → current + candidates; palette('A'|'B'|'C'|'current'…)
    if (name === undefined) return { palette: paletteName, candidates: PALETTE_CYCLE, key: 'Shift+P cycles' };
    const P = setPalette(name, true);
    return P ? { palette: P.name, label: P.label, ramps: P.rampsByFamily, roles: P.roles, bg: P.bg, clipped: P.clips }
      : `unknown palette '${name}' — try ${PALETTE_CYCLE.join(' | ')} (or A / B / C)`;
  };

  // ---- boot -----------------------------------------------------------------
  // Pool SIZE comes from the data bundle's COUNT/structN (plan §2: size is effectively a boot parameter —
  // the triptych page's loader returns a bigger COUNT; same mechanism, no contract change).
  async function boot({ loadData, hud, views: viewList = [], initial }) {
    const data = await loadData();
    makeConservedPools(data.COUNT, data.structN);
    const struct = createStructTransition(structField);   // generic staggered struct-swarm on structField
    const playback = createPlayback(field);               // year/month idle-loop driver on field
    ctx = {
      THREE, scene, camera, controls, fieldGroup, renderer, dom: renderer.domElement,
      frameTo, onResize, BLOOM_LAYER,
      field, structField, makePool,
      struct,
      playback,
      data,
      hud,                                              // real HUD (src/hud.js) passed in by the page entry
      setView, get previousViewKey() { return previousViewKey; }, viz,
    };
    for (const f of viewList) { registerView(f); const v = f(ctx); views.set(v.meta.key, v); }
    if (initial) setView(initial);
    requestAnimationFrame(tick);
    return ctx;
  }

  return { boot, registerView, frameTo, makePool, onResize, get ctx() { return ctx; }, get field() { return field; }, get structField() { return structField; } };
}
