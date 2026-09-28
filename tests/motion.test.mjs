/**
 * The MOTION door (packet D4) — everything but the GPU (node; `npm test`):
 *  1. meaningful orders (rank / value / point / axis / toSeeds) are pure, bounded and ordered right;
 *  2. the path math (the shader's JS twin): every mode is EXACTLY the lerp at both endpoints, the arc bows
 *     perpendicular by bend/2 × distance, a CW swirl retraces a CCW one;
 *  3. the engine's motion API is off by default (at rest = today) and its streak clock resets on any new pair;
 *  4. the door: a session ends on landing or on a replaced pair and hands back straight / random / the call
 *     site's stagger; haze + focus + viewport reach the world pools;
 *  5. sky roosts: every parked slot waits ABOVE the box, active dots untouched, raw ≡ per-capita roosts.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PointField } from '../src/engine/PointField.js';
import { rankOrder, linearOrder, seedsByValue, seedsFromPoint, seedsByAxis, toSeeds, pathPoint, centroid, createMotion, MOTION_TUNE } from '../src/motion.js';
import { buildCrimeLayouts, buildUnlitLayouts, skyRoosts, SKY } from '../src/layouts/capeTown.js';

let passed = 0;
const ok = (msg) => { passed++; console.log('  ok — ' + msg); };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// ---- 1. orders ----------------------------------------------------------------------------------------------
{
  const n = 20000, keys = new Float32Array(n);
  for (let i = 0; i < n; i++) keys[i] = Math.sin(i * 12.9898) * 43758.5453 % 1;
  const o = rankOrder(keys);
  let lo = 1, hi = 0, sum = 0;
  for (const v of o) { lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; }
  assert.ok(lo >= 0 && hi <= 1, 'rank in [0,1]');
  near(sum / n, 0.5, 0.01, 'rank is uniform');
  // monotone across buckets: sort by key, orders must rise (allow within-bucket jitter)
  const idx = [...keys.keys()].sort((a, b) => keys[a] - keys[b]);
  let inversions = 0;
  for (let k = 1; k < n; k++) if (o[idx[k]] < o[idx[k - 1]] - 3e-3) inversions++; // within-bucket jitter only (a bucket holds ≪ 60 of 20k keys)
  assert.equal(inversions, 0, 'rank order follows the key');
  const r = rankOrder(keys, { reverse: true });
  assert.ok(r[idx[n - 1]] < 0.01 && r[idx[0]] > 0.99, 'reverse rank: the largest key goes first');
  ok('rankOrder: bounded, uniform, monotone in the key (reverse flips it)');
}
{
  const L = { positions: new Float32Array([0, 0, 10, 0, 20, 0, 999, 999]), density: new Float32Array([0.9, 0.5, 0.1, 0]) };
  const S = { positions: L.positions, density: new Float32Array([0.2, 0.95, 0, 0]) };
  const v = seedsByValue([L, S]);
  assert.ok(v[1] < v[0] && v[0] < v[2] && v[2] < v[3], `densest (max across layouts) first, parked last: ${[...v]}`);
  const p = seedsFromPoint(L, 0, 0);
  assert.deepEqual([...p].map((x) => +x.toFixed(3)), [0, 0.5, 1, 1], 'radiates at constant speed; parked dot waits at the end');
  const pr = seedsFromPoint(L, 0, 0, { reverse: true });
  assert.ok(pr[2] < pr[1] && pr[1] < pr[0], 'reverse = converge from the far edge');
  const ax = seedsByAxis(L, 'x');
  assert.ok(ax[0] < ax[1] && ax[1] < ax[2] && ax[3] === 1, 'x sweep west → east, parked last');
  const ay = seedsByAxis({ positions: new Float32Array([0, 5, 0, -5]), density: new Float32Array([1, 1]) }, 'y');
  assert.ok(ay[1] < ay[0], 'y sweep south → north');
  const sd = toSeeds(new Float32Array([0, 0.25, 0.999, 1]));
  const fr = (x) => x - Math.floor(x);
  near(fr(sd[1] * 0.1591549431), 0.25, 1e-6, 'toSeeds 0.25');
  near(fr(sd[2] * 0.1591549431), 0.999, 1e-5, 'toSeeds 0.999');
  assert.ok(fr(sd[3] * 0.1591549431) > 0.99, 'toSeeds clamps 1 below the wrap');
  const lin = linearOrder(new Float32Array([5, 5, 5]));
  assert.equal(lin.length, 3, 'degenerate linear falls back to a rank');
  const c = centroid([{ x: 0, y: 0 }, { x: 4, y: 2 }]);
  assert.deepEqual(c, { x: 2, y: 1 });
  ok('seedsByValue / seedsFromPoint / seedsByAxis / toSeeds / centroid');
}

// ---- 2. path math -------------------------------------------------------------------------------------------
{
  const cases = [[-300, -250, 120, 80], [0, 0, 0, 0], [50, 60, -40, 700], [0.0005, 0, 30, -30]];
  const modes = [['straight', {}], ['arc', { bend: 0.35 }], ['arc', { bend: 1, fan: 0 }],
    ['swirl', { dir: 0 }], ['swirl', { dir: 1 }], ['swirl', { dir: -1 }], ['swirl', { dir: 1, turns: 1, centre: [10, -5] }]];
  for (const [sx, sy, tx, ty] of cases) for (const [m, o] of modes) for (let seed = 0.1; seed < 6.3; seed += 1.3) {
    assert.deepEqual(pathPoint(m, sx, sy, tx, ty, 0, { ...o, seed }), [sx, sy], `${m} lt=0`);
    assert.deepEqual(pathPoint(m, sx, sy, tx, ty, 1, { ...o, seed }), [tx, ty], `${m} lt=1`);
    const [ax, ay] = pathPoint(m, sx, sy, tx, ty, 1e-6, { ...o, seed });
    const [bx, by] = pathPoint(m, sx, sy, tx, ty, 1 - 1e-6, { ...o, seed });
    near(Math.hypot(ax - sx, ay - sy), 0, 0.05, `${m} continuous at the source`);
    near(Math.hypot(bx - tx, by - ty), 0, 0.05, `${m} continuous at the target`);
  }
  ok('every path mode is EXACTLY the lerp at lt = 0 and 1, and continuous into both');
  // arc: perpendicular bow, peak = bend/2 × distance × (0.55..1)
  const [mx, my] = pathPoint('arc', 0, 0, 100, 0, 0.5, { bend: 0.4, seed: 2 });
  near(mx, 50, 1e-9, 'arc keeps the chord-wise motion of the lerp');
  assert.ok(Math.abs(my) >= 0.5 * 0.4 * 100 * 0.55 - 1e-9 && Math.abs(my) <= 0.5 * 0.4 * 100 + 1e-9, `arc bow ${my}`);
  let pos = 0, neg = 0;
  for (let s = 0; s < 400; s++) { const y = pathPoint('arc', 0, 0, 100, 0, 0.5, { seed: s * 0.0157 })[1]; y > 0 ? pos++ : neg++; }
  assert.ok(pos > 120 && neg > 120, `fan = 1 → the swarm bows both ways (${pos}/${neg})`);
  for (let s = 0; s < 50; s++) assert.ok(pathPoint('arc', 0, 0, 100, 0, 0.5, { seed: s * 0.13, fan: 0 })[1] > 0, 'fan = 0 → one side');
  ok('arc: a perpendicular bow of bend/2 × distance, fanning both ways (fan 0 = one side)');
  // swirl: radius interpolates; CW retraces CCW; CCW turns every dot the same way
  const A = [-200, 30], B = [40, 150];
  for (const lt of [0.1, 0.37, 0.5, 0.8]) {
    const [x, y] = pathPoint('swirl', ...A, ...B, lt, { dir: 1 });
    near(Math.hypot(x, y), Math.hypot(...A) + (Math.hypot(...B) - Math.hypot(...A)) * lt, 1e-9, 'swirl radius');
    const [rx, ry] = pathPoint('swirl', ...B, ...A, 1 - lt, { dir: -1 });
    near(Math.hypot(x - rx, y - ry), 0, 1e-9, 'CW retraces CCW');
  }
  for (let k = 0; k < 64; k++) { // every dot's angle only increases under dir +1
    const a = (k / 64) * 6.28, b = ((k * 37) % 64) / 64 * 6.28;
    const S = [Math.cos(a) * 100, Math.sin(a) * 100], T = [Math.cos(b) * 60, Math.sin(b) * 60];
    let prev = a;
    for (let lt = 0.05; lt < 1; lt += 0.05) {
      const [x, y] = pathPoint('swirl', ...S, ...T, lt, { dir: 1 });
      let th = Math.atan2(y, x); while (th < prev - 1e-9) th += 2 * Math.PI;
      assert.ok(th - prev < Math.PI, 'monotone CCW'); prev = th;
    }
  }
  ok('swirl: radius + angle interpolate about the centre; +1 winds every dot CCW; −1 exactly retraces it');
}

// ---- 3. the engine's motion API -------------------------------------------------------------------------------
{
  const f = new PointField(8, { glow: true });
  const u = f.material.uniforms;
  assert.equal(u.uPath.value, 0); assert.equal(u.uOrderOn.value, 0); assert.equal(u.uStreak.value, 0); assert.equal(u.uHazeOn.value, 0);
  ok('motion is OFF by default — straight, random order, no streak, no haze (every page at rest = today)');
  f.setPath('arc', { bend: 0.5, fan: 0.3 });
  assert.equal(f.path, 'arc'); assert.equal(u.uBend.value, 0.5); assert.equal(u.uFan.value, 0.3);
  f.setPath('swirl', { centre: { x: 3, y: 4 }, dir: -7, turns: 1.4 });
  assert.equal(u.uSwirlDir.value, -1); assert.equal(u.uSwirlTurns.value, 1); assert.deepEqual([u.uSwirlCentre.value.x, u.uSwirlCentre.value.y], [3, 4]);
  f.setPath('nonsense'); assert.equal(f.path, 'straight');
  f.setOrder(new Float32Array([0.1, 0.2]), 3);
  assert.deepEqual([...f.points.geometry.getAttribute('aOrder').array], [0, 0, 0, 0.10000000149011612, 0.20000000298023224, 0, 0, 0]);
  assert.equal(u.uOrderOn.value, 1);
  f.setOrder(null); assert.equal(u.uOrderOn.value, 0);
  ok('setPath (modes, knobs, unknown → straight) · setOrder (slice at an offset; null → random)');
  // streak clock: uTPrev = last frame's uT unless the meaning of uT changed this frame
  const L = { positions: new Float32Array(16), density: new Float32Array(8).fill(0.5) };
  f.setSource(L); f.setTarget(L);
  f.setT(0.2); f.beginFrame(); assert.equal(u.uTPrev.value, 0.2, 'first frame after a pair write: no streak');
  f.setT(0.25); f.beginFrame(); assert.equal(u.uTPrev.value, 0.2, 'next frame: the finite difference');
  f.setT(0.3); f.setTarget(L); f.beginFrame(); assert.equal(u.uTPrev.value, 0.3, 'a new pair → zero streak this frame');
  const e0 = f.epoch, w0 = f.staggerWrites;
  f.setStagger(u.uStagger.value); assert.equal(f.epoch, e0, 'same stagger → uT means the same');
  assert.equal(f.staggerWrites, w0 + 1, 'but every stagger write is counted');
  f.setStagger(0.31); assert.equal(f.epoch, e0 + 1);
  f.setHaze({ far: 2, near: 0.4, strength: 0.7 }); assert.equal(u.uHazeOn.value, 1); assert.equal(u.uHazeFar.value, 2);
  f.setHaze(null); assert.equal(u.uHazeOn.value, 0);
  f.setStreak(1.5, { max: 30, tail: 0.2, conserve: 0.1 }); assert.deepEqual([u.uStreak.value, u.uStreakMax.value, u.uStreakTail.value, u.uStreakConserve.value], [1.5, 30, 0.2, 0.1]);
  ok('beginFrame streak clock (resets on pair / order / path / stagger changes) · setHaze · setStreak');
  // the shader keeps the endpoint guard + the rest-identity (a regression canary on the source text)
  const vs = f.material.vertexShader, fs = f.material.fragmentShader;
  assert.ok(vs.includes('lt <= 0.0 || lt >= 1.0) return p;'), 'path endpoint guard');
  assert.ok(vs.includes('uOrderOn > 0.5 ? aOrder : seed01'), 'order switch');
  assert.ok(fs.includes('gl_FragColor.a *= uOpacity * streakK * vFade;'), 'rest identity multiply');
  ok('shader source keeps the endpoint guard, the order switch and the at-rest identity');
}

// ---- 4. the door ------------------------------------------------------------------------------------------------
{
  const camera = new THREE.PerspectiveCamera(50, 1.5, 1, 4000);
  camera.position.set(0, 0, 900);
  const controls = { target: new THREE.Vector3(0, 0, 0) };
  const renderer = { getDrawingBufferSize: (v) => v.set(1600, 900) };
  const motion = createMotion({ renderer, camera, controls });
  const n = 6;
  const data = new PointField(n, { glow: true }), str = new PointField(n, { glow: false });
  const A = { positions: new Float32Array([0, 0, 10, 0, 20, 0, 30, 0, 40, 0, 999, 999]), density: new Float32Array([0.9, 0.2, 0.5, 0.1, 0.7, 0]) };
  const B = { positions: new Float32Array(12).fill(5), density: new Float32Array(n).fill(0.4) };
  motion.world([data, str]);
  motion.frame();
  assert.equal(data.material.uniforms.uHazeOn.value, 1); assert.equal(data.material.uniforms.uFocus.value, 900);
  assert.deepEqual([data.material.uniforms.uViewport.value.x, data.material.uniforms.uViewport.value.y], [1600, 900]);
  ok('world pools get haze, the focus distance (camera → target) and the viewport');

  // a flip: arc + densest-first + the door's stagger; ends on LANDING, handing everything back
  data.setSource(A); data.setTarget(B); data.setStagger(0.6);
  motion.begin('flip', data, { layouts: [B, A] });
  const u = data.material.uniforms;
  assert.equal(data.path, 'arc'); assert.equal(u.uOrderOn.value, 1); assert.equal(u.uStagger.value, MOTION_TUNE.flip.stagger);
  assert.ok(data.points.geometry.getAttribute('aOrder').array[0] < data.points.geometry.getAttribute('aOrder').array[3], 'densest first');
  data.setT(0.4); motion.frame(); assert.deepEqual(motion.active, ['flip']);
  data.setT(1); motion.frame();
  assert.equal(data.path, 'straight'); assert.equal(u.uOrderOn.value, 0); assert.equal(u.uStreak.value, 0);
  assert.equal(u.uStagger.value, 0.6, "the call site's stagger comes back");
  assert.deepEqual(motion.active, []);
  ok('flip: arc + densest-first + its own window → on landing: straight, random order, the old stagger');

  // a session ends when its pair is REPLACED (a year pair after a flip, a new transition mid-flight)
  data.setStagger(0.55);
  motion.begin('flip', data, { layouts: [B] });
  data.setT(0.3); motion.frame();
  data.setSource(B); data.setTarget(A); data.setT(0); // e.g. setYearPair — no stagger of its own
  motion.frame();
  assert.equal(data.path, 'straight'); assert.equal(u.uStagger.value, 0.55, 'nobody else set one → the door hands its back');
  motion.begin('drill', [data, str], { layouts: [A], point: { x: 0, y: 0 } });
  assert.equal(u.uStreak.value, MOTION_TUNE.drill.streak, 'the drill streaks its data');
  assert.equal(str.material.uniforms.uStreak.value, MOTION_TUNE.drill.structStreak, 'structure keeps its own streak');
  data.setT(0.5); motion.frame();
  data.setSource(A); data.setTarget(B); data.setStagger(0.62); // a new transition with its OWN stagger
  motion.frame();
  assert.equal(u.uStagger.value, 0.62, "a newer call site's stagger wins");
  assert.equal(u.uStreak.value, 0);
  ok('a replaced pair ends the session; the stagger goes back only if nobody set one since');

  // a pie swirl on both pools: dir multiplies the spec's; a never-started session doesn't end early
  motion.begin('pie', [data, str], { dir: -1 });
  assert.equal(data.path, 'swirl'); assert.equal(u.uSwirlDir.value, -1); assert.equal(u.uOrderOn.value, 0);
  data.setT(1); str.setT(1); motion.frame();
  assert.equal(data.path, 'swirl', 'still at uT = 1 before the transition ran → not ended yet (armed on first uT < 1)');
  data.setT(0.2); str.setT(0.2); motion.frame(); data.setT(1); str.setT(1); motion.frame();
  assert.equal(data.path, 'straight'); assert.equal(str.path, 'straight');
  ok('pie: swirl on data + structure, direction per call; ends only after it has actually run');

  const tuned = motion.tune({ flip: { bend: 0.6 }, dither: 0.5, haze: { strength: 0.3 } });
  assert.equal(tuned.flip.bend, 0.6); assert.equal(tuned.flip.path, 'arc', 'nested merge keeps the rest');
  assert.equal(data.material.uniforms.uHazeStrength.value, 0.3);
  near(motion.ditherPass.uniforms.uAmp.value, 0.5 / 255, 1e-12, 'dither amp');
  motion.tune({ haze: { on: false } }); assert.equal(data.material.uniforms.uHazeOn.value, 0);
  motion.tune({ flip: { bend: 0.35 }, dither: 1, haze: { on: true, strength: 0.55 } }); // restore the defaults for anyone after
  ok('tune: nested merge, haze/dither re-applied live');
}

// ---- 5. sky roosts ------------------------------------------------------------------------------------------------
{
  const years = [2010, 2011, 2012];
  const mk = (x, y, r, pop, a, b) => ({ name: `s${x}`, x, y, r, pop, crimes: { robbery: { 2010: a[0], 2011: a[1], 2012: a[2] }, murder: { 2010: b[0], 2011: b[1], 2012: b[2] } } });
  const data = { meta: { years, box: { w: 400, h: 300 } }, stations: [mk(-150, -100, 20, 50000, [80, 20, 50], [3, 9, 1]), mk(0, 0, 25, 90000, [30, 60, 10], [1, 0, 4]), mk(160, 120, 15, 20000, [5, 40, 12], [0, 2, 2])] };
  const T = ['robbery', 'murder'];
  const raw = buildCrimeLayouts(data, { types: T, mode: 'raw' }), pc = buildCrimeLayouts(data, { types: T, mode: 'percapita' });
  assert.deepEqual([...raw.roosts], [...pc.roosts], 'raw ≡ per-capita roosts');
  const top = data.meta.box.h / 2;
  let parked = 0, active = 0;
  for (const ty of T) for (const L of raw.layouts[ty]) for (let i = 0; i < raw.count; i++) {
    if (L.density[i] > 0) { active++; continue; }
    parked++;
    assert.ok(L.positions[2 * i + 1] > top + SKY.lift * data.meta.box.h - 1e-6, 'parked above the box');
    assert.equal(L.positions[2 * i], raw.roosts[2 * i]); assert.equal(L.positions[2 * i + 1], raw.roosts[2 * i + 1]);
  }
  assert.ok(parked > 0 && active > 0);
  // each slot hangs over its own station (plume centred on the station's x)
  for (const [si, [b0, K]] of raw.slotRanges.entries()) {
    let mx = 0; for (let j = 0; j < K; j++) mx += raw.roosts[2 * (b0 + j)] / K;
    near(mx, data.stations[si].x, 0.2 * data.meta.box.w * SKY.plume + 400 * SKY.plume * 3 / Math.sqrt(K), `station ${si} plume centre`);
  }
  const tri = raw.triPieLayout(1, { gap: 300, R: 100 });
  for (let i = 0; i < raw.count; i++) if (tri.crime[i] === 255) assert.ok(tri.positions[2 * i + 1] > 100 + 300 * 0.9, 'compare leftovers wait above the grid');
  const RATES = { rates: { robbery: { r: 0.5 } } };
  const un = buildUnlitLayouts(data, RATES, { types: T });
  const dp = un.disperse().positions;
  for (let i = 1; i < dp.length; i += 2) assert.ok(dp[i] > top, 'unlit roosts in the sky too');
  const direct = skyRoosts([{ s: { x: 7, y: 0 }, K: 2, base: 0 }], 2, { stations: [{ x: 7, y: 0, r: 1 }, { x: 9, y: 50, r: 1 }] });
  assert.ok(direct[1] > 51 && direct[3] > 51, 'no box → the stations\' own extent is the frame');
  ok('sky roosts: every parked slot waits above its box over its own station; raw ≡ per-capita; compare + unlit too');
}

console.log(`\nmotion: ${passed} passed`);
