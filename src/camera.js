// THE CAMERA DOOR — packet D1 of the polish program (docs/plans/polish-program.md, decisions 3 + 4).
//
// ONE module owns the camera for BOTH the explorer (src/wcExplore.js) and the standalone shell (src/stage.js):
//  • CONTROLS (canvas gestures belong to the camera). Desktop: left-drag pans · right-drag — or ctrl/⌘/shift +
//    left-drag, for trackpads without a right click — ROTATES (sideways = SPIN about the map's normal, up/down
//    = TILT) · wheel zooms. Touch: one finger pans · two fingers pinch-zoom + rotate (DOLLY_ROTATE).
//  • LIMITS. Tilt ≤ maxTilt from top-down, MINUS whatever tilt the field itself carries (terrain/canyon lean
//    the fieldGroup), so you can never look under the map. Zoom 0.15×–3× of the current scene's HOME distance.
//    A limit never snaps the camera: if you're already outside it (a cancelled glide, a resize) it widens to
//    where you are and ratchets back as you return. Damped.
//  • HOME = "The Frame". `home(box, {dur})` GLIDES target + distance and unwinds spin/tilt to top-down, north
//    up, fitting `box` inside one HUD-aware SAFE FRAME (6% margins; clear of the bottom .hud card). Scene
//    entries call it, timed to their dot transition; DATA changes (year, crime, per-capita, months, unlit)
//    never do. Any hand on the controls (pointer/wheel/touch) cancels a glide — never fight the hand.
//
// Geometry: the field lives in the XY plane (north = +Y) and the camera looks down −Z from +Z. We set
// camera.up = +Z, so OrbitControls' AZIMUTH is the spin about the map normal and its POLAR angle is the tilt
// (0 = top-down); at polar 0 + azimuth 0 the screen shows north up, east right — exactly the pre-door view.
// Boxes are in field-local world units: {cx, cy, w, h} (cx/cy default 0) or {minX, maxX, minY, maxY}.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const MAX_TILT = (72 * Math.PI) / 180;  // from top-down; a map app's pitch ceiling, never below the horizon
const ZOOM_IN = 0.15, ZOOM_OUT = 3;             // distance limits, × the current scene's home distance
const MARGIN = 0.06;                            // safe-frame side/top margins (fraction of the viewport)
const PAD = 0.03;                               // default breathing room around a home box (fraction of its w/h)
export const REHOME_MS = 1100;                  // ⌂ — a hand-invoked return, a touch quicker than a scene change
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const STATE_NONE = -1;                          // OrbitControls' idle state (its _STATE.NONE) — no hand on it
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = 180 / Math.PI;

// ---- pure geometry (exported for the node unit test) ----------------------------------------------------

/** Normalise {cx,cy,w,h} | {minX,maxX,minY,maxY} → {minX,maxX,minY,maxY}. */
export function normBox(b) {
  if (b.minX != null) return { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY };
  const cx = b.cx || 0, cy = b.cy || 0;
  return { minX: cx - b.w / 2, maxX: cx + b.w / 2, minY: cy - b.h / 2, maxY: cy + b.h / 2 };
}

/** The world points a home must fit: the (padded) box corners — lifted to zMax — plus any extra field-local
 *  `points` ({x,y,z}: e.g. a relief's real peaks), all turned about X by `tilt` when the scene leans its field
 *  (terrain/canyon rotate the fieldGroup about its origin). */
export function boxPoints({ box, tilt = 0, zMax = 0, pad = PAD, points = null }) {
  const b = normBox(box);
  const px = (b.maxX - b.minX) * pad, py = (b.maxY - b.minY) * pad;
  const c = Math.cos(tilt), s = Math.sin(tilt), pts = [];
  const add = (x, y, z) => pts.push({ x, y: y * c - z * s, z: y * s + z * c });   // THREE's rotation.x convention
  for (const x of [b.minX - px, b.maxX + px]) for (const y of [b.minY - py, b.maxY + py]) for (const z of zMax ? [0, zMax] : [0]) add(x, y, z);
  if (points) for (const p of points) add(p.x, p.y, p.z || 0);
  return pts;
}

/** Fit points into a safe NDC rect {xL,xR,yB,yT} for a TOP-DOWN perspective camera (looking down −Z, north up).
 *  Returns the smallest camera height `dist` above the target plane z=0 and the target (tx,ty) that keep every
 *  point inside the rect (centred within it on the slack axis). Perspective-exact: nearer (higher-z) points
 *  project larger. Feasibility is monotone in dist (the rect contains NDC 0), so a bisection finds it. */
export function fitTopDown(points, fovDeg, aspect, ndc) {
  const tanV = Math.tan((fovDeg * Math.PI) / 360), tanH = tanV * aspect;
  const zTop = Math.max(0, ...points.map((p) => p.z || 0));
  const solve = (D) => {
    let loX = -Infinity, hiX = Infinity, loY = -Infinity, hiY = Infinity;
    for (const p of points) {
      const depth = D - (p.z || 0);
      if (depth <= 0) return null;
      const kx = depth * tanH, ky = depth * tanV;
      loX = Math.max(loX, p.x - ndc.xR * kx); hiX = Math.min(hiX, p.x - ndc.xL * kx);
      loY = Math.max(loY, p.y - ndc.yT * ky); hiY = Math.min(hiY, p.y - ndc.yB * ky);
    }
    return loX <= hiX && loY <= hiY ? { tx: (loX + hiX) / 2, ty: (loY + hiY) / 2 } : null;
  };
  let lo = zTop + 1e-3, hi = Math.max(1, zTop * 2), sol = solve(hi);
  for (let g = 0; !sol && g < 64; g++) { lo = hi; hi *= 2; sol = solve(hi); }
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2, s = solve(mid);
    if (s) { hi = mid; sol = s; } else lo = mid;
  }
  return { tx: sol.tx, ty: sol.ty, dist: hi };
}

/** Default safe inset (CSS px): 6% sides + top (≥ 40px, clear of the brand line), and the bottom kept clear
 *  of the `.hud` card (measured — its height changes with the viewport). */
export function hudSafeInset(W, H) {
  let bottom = MARGIN * H;
  const hud = typeof document !== 'undefined' && document.querySelector('.hud');
  if (hud) {
    const r = hud.getBoundingClientRect();
    if (r.height > 0 && r.top < H) bottom = Math.max(bottom, H - r.top + 10);
  }
  return { top: Math.max(MARGIN * H, 40), right: MARGIN * W, bottom, left: MARGIN * W };
}

// ---- the door -------------------------------------------------------------------------------------------

/**
 * createCameraDoor({ camera, dom, safeInset, maxTilt }) → the ONE camera door.
 *   controls          the OrbitControls it built (callers may toggle enabled/enablePan/enableZoom per view)
 *   home(box, opts)   glide (opts.dur ms, opts.ease) — or snap when dur is 0 — to the box's safe-frame fit,
 *                     top-down + north up. opts.tilt/zMax: the field's lean/relief in that scene; opts.points:
 *                     extra field-local {x,y,z} to include (a relief's real peaks); opts.pad.
 *   rehome(dur)       re-home the CURRENT scene's box (the ⌂ chip / 0 key).
 *   update(now)       once per frame, before render: advances a glide, applies limits, runs the controls.
 *   cancelGlide()     stop a glide where it is (the controls' 'start' event calls this for you).
 *   onResize()        aspect + (if the camera still sits at home) a re-fit; else just re-derive the limits.
 *   setFieldTilt(r)   the field's current lean (|rad|) — shrinks the tilt limit so the sum stays < maxTilt.
 *   state(), orbit({spin,tilt,dist})   debug/verification (degrees, world units; orbit obeys the limits).
 */
export function createCameraDoor({ camera, dom, safeInset = hudSafeInset, maxTilt = MAX_TILT } = {}) {
  camera.up.set(0, 0, 1);                       // BEFORE the controls: OrbitControls bakes its orbit axis from .up
  const controls = new OrbitControls(camera, dom);
  controls.enableRotate = true;
  // Pan ⟂ camera.up = along the MAP plane (the map-app pan). Identical to screen-space panning when top-down;
  // under tilt it keeps the target ON the map instead of lifting the orbit pivot into the air.
  controls.screenSpacePanning = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.zoomSpeed = 0.9;
  controls.rotateSpeed = 0.7;                   // a full-height drag ≈ 250° — calmer than the default 360°
  controls.minDistance = 70;                    // absolute until the first home sets scene-relative limits
  controls.maxDistance = 2500;
  controls.maxPolarAngle = maxTilt;
  // LEFT pans; OrbitControls flips PAN→ROTATE when ctrl/⌘/shift is held — the trackpad path to rotate.
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.update();

  const farBase = camera.far;
  let homeReq = null;          // { box, tilt, zMax, pad, points } — the current scene's framing request
  let homeDist = 0;            // its resolved fit distance (0 = never homed → absolute limits)
  let homePose = null;         // { target, position, quat } where the last home LANDED (resize re-fits only from here)
  let pending = null;          // { dur, ease } — a home whose fit resolves on the next update (HUD text settled)
  let glide = null;            // { from, to, start, dur, ease } in orbit coordinates
  let fieldTilt = 0;
  let limMin = 70, limMax = 2500, limPolar = maxTilt;

  // ---- orbit coordinates (the SAME convention OrbitControls uses with up = +Z) ----
  const _off = new THREE.Vector3();
  function readOrbit() {
    _off.copy(camera.position).sub(controls.target);
    const r = _off.length() || 1e-6;
    const flat = Math.hypot(_off.x, _off.y) < r * 1e-9;  // EXACTLY overhead: atan2(0, −0) would read π (south up)
    return {
      tx: controls.target.x, ty: controls.target.y, tz: controls.target.z, r,
      phi: Math.acos(clamp(_off.z / r, -1, 1)),       // tilt from +Z (top-down = 0)
      theta: flat ? 0 : Math.atan2(_off.x, -_off.y),   // spin: 0 = camera to the south, i.e. north up
    };
  }
  // Never place the camera EXACTLY overhead: at polar 0 the spin is undefined and OrbitControls could read it
  // as π. Its own floor (makeSafe, 1e-6) keeps a definite azimuth — so top-down = polar 1e-6 at the wanted spin.
  function placeOrbit(o) {
    const phi = Math.max(o.phi, 1e-6), s = Math.sin(phi);
    controls.target.set(o.tx, o.ty, o.tz);
    camera.position.set(o.tx + o.r * s * Math.sin(o.theta), o.ty - o.r * s * Math.cos(o.theta), o.tz + o.r * Math.cos(phi));
  }
  // Kill any damping inertia still in flight (underscore fields = OrbitControls r171 internals; guarded).
  function stillControls() {
    if (controls._sphericalDelta) controls._sphericalDelta.set(0, 0, 0);
    if (controls._panOffset) controls._panOffset.set(0, 0, 0);
    if ('_scale' in controls) controls._scale = 1;
  }

  // ---- the safe frame + the fit ----
  function viewSize() { return { W: dom.clientWidth || window.innerWidth, H: dom.clientHeight || window.innerHeight }; }
  function safeNdc() {
    const { W, H } = viewSize();
    const i = (typeof safeInset === 'function' ? safeInset(W, H) : safeInset) || {};
    const L = clamp(i.left || 0, 0, 0.3 * W), R = clamp(i.right || 0, 0, 0.3 * W);
    const T = clamp(i.top || 0, 0, 0.3 * H), B = clamp(i.bottom || 0, 0, 0.45 * H);  // the rect keeps NDC 0 inside
    return { xL: -1 + (2 * L) / W, xR: 1 - (2 * R) / W, yB: -1 + (2 * B) / H, yT: 1 - (2 * T) / H };
  }
  function fitNow() {
    const f = fitTopDown(boxPoints(homeReq), camera.fov, camera.aspect, safeNdc());
    return { tx: f.tx, ty: f.ty, tz: 0, r: f.dist, phi: 0, theta: 0 };
  }

  // ---- limits (scene-relative, ratcheted — a limit never snaps the camera) ----
  function baseLimits() {
    const polar = Math.max(0.05, maxTilt - fieldTilt);
    return homeDist ? { min: homeDist * ZOOM_IN, max: homeDist * ZOOM_OUT, polar } : { min: 70, max: 2500, polar };
  }
  function applyLimits(snapshot = false) {
    const b = baseLimits(), o = readOrbit();
    if (snapshot) {            // just landed / released: include wherever the camera is right now
      limMin = Math.min(b.min, o.r); limMax = Math.max(b.max, o.r); limPolar = Math.max(b.polar, o.phi);
    } else {                   // ratchet: a widened limit tightens back toward its base as the camera returns
      limMin = Math.min(b.min, Math.max(limMin, o.r));
      limMax = Math.max(b.max, Math.min(limMax, o.r));
      limPolar = Math.max(b.polar, Math.min(limPolar, o.phi));
    }
    controls.minDistance = limMin; controls.maxDistance = limMax; controls.maxPolarAngle = limPolar;
    syncFar(limMax);
  }
  function openLimits(a, b) {  // mid-glide nothing clamps (the path may cross the old scene's range)
    controls.minDistance = Math.min(a.r, b.r) * 0.5;
    controls.maxDistance = Math.max(a.r, b.r) * 2;
    controls.maxPolarAngle = Math.max(a.phi, b.phi, 1e-3);
    syncFar(controls.maxDistance);
  }
  function syncFar(maxR) {     // a zoomed-out (or huge-box) scene must never slide past the far plane
    const want = Math.max(farBase, maxR * 2.2);
    if (Math.abs(camera.far - want) > 1) { camera.far = want; camera.updateProjectionMatrix(); }
  }

  // ---- home + glide ----
  function land(to) {
    glide = null;
    placeOrbit(to);
    stillControls();
    controls.update();                           // lookAt now, so an instant home renders home this very frame
    homePose = { target: controls.target.clone(), position: camera.position.clone(), quat: camera.quaternion.clone() };
    applyLimits(true);
  }
  function resolvePending(now) {
    const { dur, ease } = pending;
    pending = null;
    const to = fitNow();
    homeDist = to.r;
    if (!dur) { land(to); return; }
    const from = readOrbit();
    from.theta = wrapPi(from.theta);             // unwind the SHORT way round
    glide = { from, to, start: now, dur, ease };
    openLimits(from, to);
  }
  function home(box, opts = {}) {
    homeReq = { box: normBox(box), tilt: opts.tilt || 0, zMax: opts.zMax || 0, pad: opts.pad ?? PAD, points: opts.points || null };
    pending = { dur: Math.max(0, opts.dur || 0), ease: opts.ease || easeInOut };
    glide = null;
    homePose = null;
    stillControls();
    if (!pending.dur) resolvePending(performance.now());
  }
  function rehome(dur = REHOME_MS) {
    if (homeReq) home(homeReq.box, { ...homeReq, dur });
  }
  function cancelGlide() {
    if (pending) { pending = null; homeDist = fitNow().r; applyLimits(true); }
    if (glide) { glide = null; applyLimits(true); }
  }
  // The hand wins: any pointer/wheel/touch the controls accept stops a glide where it is.
  controls.addEventListener('start', () => { if (glide || pending) cancelGlide(); });

  // Pin the opening pose to a DEFINITE north-up top-down (callers park the camera exactly overhead; the
  // controls' constructor may have resolved that singular pose to either spin).
  { const o = readOrbit(); o.theta = 0; placeOrbit(o); stillControls(); controls.update(); }

  function update(now = performance.now()) {
    // A hand already mid-gesture when a scene changed (a key pressed while dragging): let the hand keep it.
    if ((glide || pending) && controls.enabled && controls.state !== STATE_NONE) cancelGlide();
    if (pending) resolvePending(now);
    if (glide) {
      const p = Math.min(1, (now - glide.start) / glide.dur);
      const e = glide.ease(p), a = glide.from, b = glide.to;
      if (p >= 1) { land(b); return; }
      placeOrbit({
        tx: a.tx + (b.tx - a.tx) * e, ty: a.ty + (b.ty - a.ty) * e, tz: a.tz + (b.tz - a.tz) * e,
        r: a.r * Math.pow(b.r / a.r, e),        // geometric: a zoom feels even at every scale
        phi: a.phi + (b.phi - a.phi) * e, theta: a.theta + (b.theta - a.theta) * e,
      });
      stillControls();
    } else {
      applyLimits();
    }
    controls.update();
  }

  const atHome = () => {
    if (!homePose || glide || pending) return false;
    const eps = Math.max(1e-3, homeDist * 1e-3);
    return controls.target.distanceTo(homePose.target) < eps && camera.position.distanceTo(homePose.position) < eps
      && camera.quaternion.angleTo(homePose.quat) < 1e-3;  // top-down, a SPIN barely moves the position — check the turn
  };

  function onResize() {
    const { W, H } = viewSize();
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (!homeReq || pending) return;             // a pending home fits on the next frame anyway
    if (glide) { glide.to = fitNow(); homeDist = glide.to.r; openLimits(glide.from, glide.to); return; } // retarget, keep the clock
    if (atHome()) { const to = fitNow(); homeDist = to.r; land(to); return; }
    homeDist = fitNow().r;                       // the hand moved it: keep the view, re-derive the limits
    applyLimits(true);
  }

  function setFieldTilt(rad) { fieldTilt = Math.abs(rad) || 0; }

  function state() {
    const o = readOrbit(), r1 = (v) => Math.round(v * 10) / 10;
    return {
      target: [r1(o.tx), r1(o.ty), r1(o.tz)], dist: r1(o.r),
      tiltDeg: r1(o.phi * DEG), spinDeg: r1(wrapPi(o.theta) * DEG),
      homeDist: r1(homeDist), homeBox: homeReq && { ...homeReq.box, tilt: homeReq.tilt, zMax: homeReq.zMax },
      gliding: !!(glide || pending), atHome: atHome(),
      limits: { minDist: r1(controls.minDistance), maxDist: r1(controls.maxDistance), maxTiltDeg: r1(controls.maxPolarAngle * DEG) },
      fieldTiltDeg: r1(fieldTilt * DEG), controlsEnabled: controls.enabled,
    };
  }
  function orbit({ spin, tilt, dist } = {}) {    // debug: set spin/tilt/dist THROUGH the controls' clamps
    cancelGlide();
    const o = readOrbit();
    if (spin != null) o.theta = spin / DEG;
    if (tilt != null) o.phi = tilt / DEG;
    if (dist != null) o.r = dist;
    placeOrbit(o); stillControls(); controls.update();
    return state();
  }

  return {
    controls, home, rehome, update, cancelGlide, onResize, setFieldTilt, state, orbit,
    get homeBox() { return homeReq ? { ...homeReq.box } : null; },
    get gliding() { return !!(glide || pending); },
    get atHome() { return atHome(); },
  };
}
