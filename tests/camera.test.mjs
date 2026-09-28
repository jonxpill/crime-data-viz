/**
 * Camera-door unit tests (node, no browser: `npm test`). Exercises the REAL three.js OrbitControls against a
 * stub canvas, so the conventions the whole app leans on are proven, not assumed:
 *  1. The fit is exact: a flat box touches the safe rect on its limiting axis, centred on the slack one; an
 *     off-centre (HUD-aware) rect shifts the target; a tilted, raised box stays inside (perspective-exact).
 *  2. Home = top-down, NORTH UP, EAST RIGHT (up = +Z must not flip the view), at the fitted distance.
 *  3. Limits: tilt clamps at 72° (minus the field's own lean), zoom at 0.15×–3× of the home distance.
 *  4. A glide lands exactly at home, unwinding spin the SHORT way; a hand ('start') cancels it in place.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCameraDoor, fitTopDown, boxPoints, normBox, MAX_TILT } from '../src/camera.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b} (±${eps})`);

// ---- 1. the fit ------------------------------------------------------------------------------------------
{
  const full = { xL: -1, xR: 1, yB: -1, yT: 1 };
  const tanV = Math.tan((50 * Math.PI) / 360);
  const f = fitTopDown(boxPoints({ box: { w: 800, h: 600 }, pad: 0 }), 50, 1.6, full);
  near(f.dist, Math.max(300 / tanV, 400 / (tanV * 1.6)), 1e-6, 'flat fit distance');
  near(f.tx, 0, 1e-9, 'flat fit tx'); near(f.ty, 0, 1e-9, 'flat fit ty');

  // HUD-aware rect: bottom 20% reserved → the box centre lands on the SAFE centre (ndc y = +0.2).
  const hud = { xL: -0.88, xR: 0.88, yB: -0.6, yT: 0.88 };
  const g = fitTopDown(boxPoints({ box: { cx: 30, cy: -20, w: 500, h: 400 }, pad: 0 }), 50, 1.6, hud);
  const ndcY = (y) => (y - g.ty) / (g.dist * tanV), ndcX = (x) => (x - g.tx) / (g.dist * tanV * 1.6);
  near(ndcY(180), hud.yT, 1e-6, 'limiting axis touches the top');
  near(ndcY(-220), hud.yB, 1e-6, 'limiting axis touches the bottom');
  near((ndcX(-220) + ndcX(280)) / 2, 0, 1e-6, 'slack axis centred');

  // Tilted + raised (the canyon's lean): every point inside; any closer and something leaves the rect.
  const pts = boxPoints({ box: { w: 940, h: 720 }, tilt: -0.62, zMax: 260, pad: 0 });
  const t = fitTopDown(pts, 50, 1.6, hud);
  const inside = (D) => pts.every((p) => {
    const k = D - p.z, x = (p.x - t.tx) / (k * tanV * 1.6), y = (p.y - t.ty) / (k * tanV);
    return x >= hud.xL - 1e-6 && x <= hud.xR + 1e-6 && y >= hud.yB - 1e-6 && y <= hud.yT + 1e-6;
  });
  assert.ok(inside(t.dist), 'tilted box fits');
  assert.ok(fitTopDown(pts, 50, 1.6, hud).dist > 0 && !inside(t.dist * 0.97), 'tilted fit is tight');
  assert.deepEqual(normBox({ minX: -1, maxX: 2, minY: -3, maxY: 4 }), { minX: -1, maxX: 2, minY: -3, maxY: 4 });
}

// ---- a stub canvas the real OrbitControls can attach to -------------------------------------------------
const listeners = {};
const dom = {
  clientWidth: 1440, clientHeight: 860, style: {},
  addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }, removeEventListener() {},
  setPointerCapture() {}, releasePointerCapture() {},
  getRootNode: () => ({ addEventListener() {}, removeEventListener() {} }),
};
const camera = new THREE.PerspectiveCamera(50, 1440 / 860, 1, 4000);
camera.position.set(0, 0, 900);                 // exactly overhead — the singular pose both callers start from
const inset = { top: 52, right: 86, bottom: 114, left: 86 };
const cam = createCameraDoor({ camera, dom, safeInset: () => inset });
const ndc = (x, y, z = 0) => { camera.updateMatrixWorld(); return new THREE.Vector3(x, y, z).project(camera); };
const deg = MAX_TILT * 180 / Math.PI;

// ---- 2. orientation: north up, east right ---------------------------------------------------------------
{
  const s = cam.state();
  near(s.spinDeg, 0, 1e-6, 'opening spin'); near(s.tiltDeg, 0, 1e-3, 'opening tilt');
  const c = ndc(0, 0), e = ndc(100, 0), n = ndc(0, 100);
  assert.ok(e.x - c.x > 0.05 && Math.abs(e.y - c.y) < 1e-6, 'east is screen-right');
  assert.ok(n.y - c.y > 0.05 && Math.abs(n.x - c.x) < 1e-6, 'north is screen-up');
}

// ---- home + limits ---------------------------------------------------------------------------------------
{
  cam.home({ w: 776, h: 628 }, { dur: 0 });
  const s = cam.state();
  assert.ok(s.atHome && !s.gliding, 'instant home lands');
  near(s.tiltDeg, 0, 1e-3, 'home is top-down'); near(s.spinDeg, 0, 1e-6, 'home is north-up');
  // the box's top/bottom edges sit on the safe rect's top/bottom (height-limited at this aspect)
  const top = ndc(0, 314 + 628 * 0.03), bot = ndc(0, -314 - 628 * 0.03);   // PAD = 3% of h per side
  near(top.y, 1 - (2 * inset.top) / 860, 1e-4, 'box top on the safe top');
  near(bot.y, -1 + (2 * inset.bottom) / 860, 1e-4, 'box bottom on the safe bottom');
  near(s.limits.minDist, s.homeDist * 0.15, 0.1, 'zoom-in limit'); near(s.limits.maxDist, s.homeDist * 3, 0.1, 'zoom-out limit');

  near(cam.orbit({ tilt: 89 }).tiltDeg, deg, 0.01, 'tilt clamps at the max');
  near(cam.orbit({ dist: 1e6 }).dist, s.homeDist * 3, 0.1, 'zoom-out clamps');
  near(cam.orbit({ dist: 1 }).dist, s.homeDist * 0.15, 0.1, 'zoom-in clamps');
  cam.orbit({ spin: 90, tilt: 0, dist: s.homeDist });
  const c = ndc(0, 0), n = ndc(0, 100);
  assert.ok(Math.abs(n.x - c.x) > Math.abs(n.y - c.y), 'a 90° spin turns north sideways (spin is about the map normal)');

  // the field leans (terrain): the camera's own tilt limit shrinks so the SUM stays ≤ max
  cam.home({ w: 776, h: 628 }, { dur: 0 });
  cam.setFieldTilt(-0.62); cam.update(0);
  near(cam.state().limits.maxTiltDeg, deg - 0.62 * 180 / Math.PI, 0.05, 'field lean eats into the tilt limit');
  cam.setFieldTilt(0); cam.update(0);
}

// ---- 4. glide: short-way unwind, exact landing, hand cancels ---------------------------------------------
{
  cam.home({ w: 776, h: 628 }, { dur: 0 });
  cam.orbit({ spin: 190, tilt: 50 });            // = −170°: the short way home is back through −85°, not +95°
  cam.home({ cx: 100, cy: 50, w: 400, h: 400 }, { dur: 1000 });
  cam.update(1000);                             // resolves the pending fit at t = 1000
  cam.update(1500);
  const mid = cam.state();
  near(mid.spinDeg, -85, 0.5, 'unwinds the SHORT way (mid-glide spin)');
  assert.ok(mid.gliding && mid.tiltDeg > 20 && mid.tiltDeg < 30, `tilt unwinds with it: ${mid.tiltDeg}`);
  cam.update(2000);
  const end = cam.state();
  assert.ok(end.atHome && !end.gliding, 'glide lands at home');
  near(Math.abs(end.spinDeg) % 360, 0, 1e-3, 'landed north-up'); near(end.tiltDeg, 0, 1e-3, 'landed top-down');

  cam.orbit({ spin: 40, tilt: 30 });
  cam.home({ w: 776, h: 628 }, { dur: 1000 });
  cam.update(5000); cam.update(5300);
  const before = cam.state();
  cam.controls.dispatchEvent({ type: 'start' });   // a hand touches the controls
  cam.update(5400);
  const after = cam.state();
  assert.ok(!after.gliding, 'the hand cancels the glide');
  near(after.spinDeg, before.spinDeg, 0.5, 'cancel leaves the camera where it was');
}

// ---- a hand already mid-drag when a scene changes keeps the camera -------------------------------------
{
  cam.home({ w: 776, h: 628 }, { dur: 0 });
  cam.controls.state = 2;                          // OrbitControls PAN in progress
  cam.home({ w: 300, h: 300 }, { dur: 1000 });
  cam.update(9000);
  assert.ok(!cam.state().gliding, 'no glide under a hand that is already dragging');
  cam.controls.state = -1;
}

// ---- 6. the shell's triptych: a resize to 839×993 re-fits the home box (no clipped outer discs) --------
{
  const box = { w: 2140, h: 720 };
  dom.clientWidth = 1440; dom.clientHeight = 860; cam.onResize();
  cam.home(box, { dur: 0 });
  dom.clientWidth = 839; dom.clientHeight = 993; cam.onResize();
  const s = cam.state();
  assert.ok(s.atHome, 'still at home after the resize');
  for (const [x, y] of [[-1070, -360], [1070, 360], [-1070, 360], [1070, -360]]) {
    const p = ndc(x, y);
    assert.ok(Math.abs(p.x) <= 1 - (2 * inset.left) / 839 + 1e-6 && p.y <= 1 && p.y >= -1, `corner ${x},${y} inside at 839×993 (${p.x.toFixed(3)}, ${p.y.toFixed(3)})`);
  }
  // …but once the hand has moved it, a resize only updates the aspect
  cam.orbit({ spin: 20 });
  dom.clientWidth = 1440; dom.clientHeight = 860; cam.onResize();
  near(cam.state().spinDeg, 20, 1e-3, 'a moved camera is left where the hand put it');
}

console.log('camera door: all tests pass');
