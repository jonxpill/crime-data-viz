/**
 * HUD-made-of-light unit tests (node, no browser: `npm test`). The pure maths behind the explorer's new HUD
 * (src/hud/light.js · icons.js · dock.js formatters), plus the real three.js camera, so the claims the eye
 * pass leans on are proven, not assumed:
 *  1. Screen-fixed: a point placed through makePxMap on a group riding the camera at HUD_DEPTH projects back to
 *     the SAME CSS px however the camera orbits, pans or zooms.
 *  2. The ribbon is a faithful sparkline: lit height ∝ value / the series' max (the max column full), the
 *     current column hotter, unlit slots parked at the base with density 0; per-capita with one population
 *     per place lights EXACTLY the same heights as the counts (the ribbon never invents a difference).
 *  3. The wave: column c starts crossing at c·28 ms and lands 520 ms later (the engine's own lt formula with
 *     ordered seeds); a 60-month wave is compressed to ≲ 1.1 s; an interrupted wave resumes from the live pose.
 *  4. The compass: north-up top-down → needle up; spin ±90° → needle sideways, opposite ways; tilt squashes
 *     the ring by cos(tilt); the tip is the brightest dot (still structure — the pool has no glow).
 *  5. The living dock: icons sample REAL layouts (active dots only, density + family kept), fit their 52×36
 *     box, the toll miniature follows the toll's own ring rule; an icon FORMS when available, FAILS TO FORM
 *     (drifts to its scatter) when not, and hover gathers + lights it. Formatters read like the sentence.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  HUD_DEPTH, RIBBON_ROWS, RIBBON_WIDE, RIBBON_PER_COL, RIBBON_MAX_COLS, HUD_TUNE, slotJitter, unitsPerPx, makePxMap, ribbonGrid, columnAt, litColumn,
  ribbonFrameLayout, ribbonDataLayout, waveTiming, columnSeed01, livePose, compassLayout, LightHud,
} from '../src/hud/light.js';
import { subsampleActive, sampleLayout, fitShape, tollMini, releaseFallback, rampAt, LivingIcon, ICON_W, ICON_H, ICON_SLOTS } from '../src/hud/icons.js';
import { fmtRate, fmtCount, fmtValue } from '../src/hud/dock.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b} (±${eps})`);
const W = 1440, H = 860, FOV = 50;

// ---- 1. screen-fixed ---------------------------------------------------------------------------------------
{
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 1, 4000);
  const scene = new THREE.Scene();
  scene.add(camera);
  const group = new THREE.Group(); group.position.set(0, 0, -HUD_DEPTH); camera.add(group);
  const map = makePxMap({ W, H, fov: FOV });
  const probes = [[W / 2, H / 2], [0, 0], [W, H], [120, 820], [1300, 40]];
  const project = (px, py) => {
    const [x, y] = map(px, py);
    const v = new THREE.Vector3(x, y, 0);
    group.localToWorld(v); v.project(camera);
    return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
  };
  const poses = [
    () => { camera.position.set(0, 0, 900); camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0); },
    () => { camera.position.set(300, -500, 400); camera.up.set(0, 0, 1); camera.lookAt(50, 20, 0); },  // orbited + tilted + panned
    () => { camera.position.set(-40, 10, 60); camera.up.set(0, 0, 1); camera.lookAt(-40, 30, 0); },     // zoomed right in
  ];
  for (const pose of poses) {
    pose(); scene.updateMatrixWorld(true);
    for (const [px, py] of probes) {
      const [sx, sy] = project(px, py);
      near(sx, px, 1e-6 * W, `screen-fixed x @${px},${py}`);
      near(sy, py, 1e-6 * H, `screen-fixed y @${px},${py}`);
    }
  }
  near(unitsPerPx(FOV, H) * H, 2 * HUD_DEPTH * Math.tan((FOV * Math.PI) / 360), 1e-9, 'units per px spans the view height');
}

// ---- 2. the ribbon is a faithful sparkline --------------------------------------------------------------
// Real Western Cape robbery totals 2008/09 – 2025/26 (the explorer's totalsByType.robbery for the province).
const ROBBERY = [21099, 21915, 22565, 24829, 29083, 32591, 36536, 36217, 36606, 36332, 34738, 35161, 25903, 26985, 31878, 35682, 33768, 31219];
const WC_POP = 7214118;
const ident = (x, y) => [x, y];
const track = { left: 100, top: 780, width: 900, height: 44 };
{
  const grid = ribbonGrid(track, 18);
  assert.equal(columnAt(track, 18, track.left - 50), 0, 'left of the track holds the first column');
  assert.equal(columnAt(track, 18, track.left + track.width + 50), 17, 'right of the track holds the last');
  for (let c = 0; c < 18; c++) assert.equal(columnAt(track, 18, grid.colX(c)), c, `column centre ${c} hits column ${c}`);
  assert.ok(grid.rowY(RIBBON_ROWS - 1) >= track.top && grid.rowY(0) < grid.caretY && grid.caretY <= track.top + track.height, 'rows + caret inside the track');

  assert.deepEqual(litColumn(0, 10), { full: 0, frac: 0, height: 0 }, 'zero lights nothing');
  assert.equal(litColumn(10, 10).full, RIBBON_ROWS, 'the max column is full');
  near(litColumn(5, 10).height, RIBBON_ROWS / 2, 1e-9, 'half the max = half the rows');
  assert.equal(litColumn(0.01, 10).full, 1, 'a tiny nonzero value still lights one dot (never drawn as nothing)');

  const cur = 11; // 2019/20
  const L = ribbonDataLayout({ grid, values: ROBBERY, cur, ramp: 0, map: ident });
  const max = Math.max(...ROBBERY);
  ROBBERY.forEach((v, c) => near(L.lit[c], (RIBBON_ROWS * v) / max, 1e-9, `column ${c} height ∝ its total`));
  // count lit dots per column (3 wide) + check the hot column, the shared slot geometry and the parked base
  const F0 = ribbonFrameLayout({ grid, cur, map: ident });
  for (let c = 0; c < 18; c++) {
    let on = 0;
    for (let j = 0; j < RIBBON_ROWS; j++) for (let k = 0; k < RIBBON_WIDE; k++) {
      const i = (c * RIBBON_ROWS + j) * RIBBON_WIDE + k, d = L.density[i];
      if (d > 0) {
        on++;
        near(d, c === cur ? HUD_TUNE.hotDensity : HUD_TUNE.litDensity, 1e-6, `c${c} j${j} density (whole dots, one tone)`);
        near(L.positions[2 * i], F0.positions[2 * i], 1e-9, `lit dot sits exactly on its grey slot (x, c${c} j${j} k${k})`);
        near(L.positions[2 * i + 1], F0.positions[2 * i + 1], 1e-9, `lit dot sits exactly on its grey slot (y, c${c} j${j} k${k})`);
      } else {
        const b = (c * RIBBON_ROWS) * RIBBON_WIDE + k;           // its sub-column's base slot
        near(L.positions[2 * i], F0.positions[2 * b], 1e-9, `parked dot waits on its sub-column's base (x, c${c} j${j})`);
        near(L.positions[2 * i + 1], F0.positions[2 * b + 1], 1e-9, `parked dot waits at the baseline (y, c${c} j${j})`);
      }
    }
    assert.equal(on, RIBBON_WIDE * Math.max(1, Math.round(L.lit[c])), `column ${c}: ${on} dots for height ${L.lit[c].toFixed(2)} (rounded, 3 wide)`);
  }
  // the ZERO baseline: every column's lit rows start at row 0 (never cropped to exaggerate a dip)
  near(L.lit[12] / L.lit[8], ROBBERY[12] / ROBBERY[8], 1e-9, 'the lockdown dip keeps its true proportion');
  // the seeded wobble is small and fixed
  for (let i = 0; i < 200; i++) { const v = slotJitter(i, 1); assert.ok(v >= -0.5 && v < 0.5, 'jitter within ±0.5'); assert.equal(v, slotJitter(i, 1), 'jitter is deterministic'); }
  // parked columns beyond the series never light
  for (let i = 18 * RIBBON_PER_COL; i < RIBBON_MAX_COLS * RIBBON_PER_COL; i++) assert.equal(L.density[i], 0, 'columns past the series stay dark');
  // per-capita with ONE population per place: exactly the same heights (the rate's shape IS the count's)
  const R = ribbonDataLayout({ grid, values: ROBBERY.map((v) => (v / WC_POP) * 1e5), cur, map: ident });
  R.lit.forEach((h, c) => near(h, L.lit[c], 1e-9, `per-capita column ${c} = count column`));
  // the dark frame: no values → nothing lit
  const D = ribbonDataLayout({ grid, values: null, cur, map: ident });
  assert.ok(D.density.every((d) => d === 0), 'frame mode lights nothing');

  const F = ribbonFrameLayout({ grid, cur, map: ident });
  const n = RIBBON_MAX_COLS * RIBBON_PER_COL + 1;
  assert.equal(F.density.length, n, 'frame pool = every slot + the caret');
  for (let i = 0; i < n - 1; i++) assert.equal(F.density[i] > 0, i < 18 * RIBBON_PER_COL, `frame slot ${i} visible iff inside the series`);
  near(F.positions[2 * (n - 1)], grid.colX(cur), 1e-9, 'the caret sits under the current column');
  assert.equal(ribbonFrameLayout({ grid, cur: -1, map: ident }).density[n - 1], 0, 'no current column → no caret');
}

// ---- 3. the wave -----------------------------------------------------------------------------------------
{
  const t18 = waveTiming(18);
  near(t18.stagger, 28, 1e-9, '18 columns keep the 28 ms stagger');
  near(t18.dur, 520 + 17 * 28, 1e-9, '18-column wave duration');
  const t60 = waveTiming(60);
  assert.ok(t60.dur <= 1100 + 1e-9 && t60.stagger < 28, `a 60-month wave is compressed (${t60.dur} ms, ${t60.stagger.toFixed(1)} ms/col)`);
  // The engine's per-dot formula with ordered seeds: column c starts at c·stagger, lands `each` ms later.
  for (const [ncols, tm] of [[18, t18], [60, t60]]) {
    const s01 = columnSeed01(RIBBON_MAX_COLS * RIBBON_PER_COL, RIBBON_PER_COL, ncols);
    const lt = (c, ms) => { const uT = ms / tm.dur, s = s01[c * RIBBON_PER_COL + 7]; return Math.min(1, Math.max(0, (uT - s * (1 - tm.w)) / tm.w)); };
    for (const c of [0, 1, Math.floor(ncols / 2), ncols - 1]) {
      const start = c * tm.stagger;
      near(lt(c, start), 0, 1e-3, `col ${c}/${ncols} still at source when its turn comes (seed capped < 1)`);
      near(lt(c, start + 520), 1, 1e-3, `col ${c}/${ncols} landed 520 ms later`);
      if (c > 0) near(lt(c, start - 1), 0, 1e-9, `col ${c} waits for its turn`);
    }
  }
  // An interrupted wave resumes from what the eye sees: early columns already at the target, late ones not.
  const grid = ribbonGrid(track, 18);
  const src = ribbonDataLayout({ grid, values: ROBBERY, cur: 11, ramp: 0, map: ident });
  const tgt = ribbonDataLayout({ grid, values: ROBBERY.map((v, i) => (i % 2 ? v : v / 3)), cur: 11, ramp: 1, map: ident });
  const s01 = columnSeed01(src.density.length, RIBBON_PER_COL, 18);
  const mid = livePose(src, tgt, s01, 300 / t18.dur, t18.w);
  const i0 = 0 * RIBBON_PER_COL + 3 * RIBBON_WIDE, i17 = 17 * RIBBON_PER_COL + 3 * RIBBON_WIDE;
  near(mid.density[i0], src.density[i0] + (tgt.density[i0] - src.density[i0]) * Math.min(1, 300 / 520), 1e-6, 'column 0 is part-way');
  near(mid.density[i17], src.density[i17], 1e-9, 'column 17 has not started');
  assert.ok(mid.ramp instanceof Uint8Array && mid.ramp[i17] === 0, 'a mid-wave family change keeps each dot its own ramp');
  assert.deepEqual(Array.from(livePose(src, tgt, s01, 0, t18.w).density), Array.from(src.density), 'uT 0 = source');
  assert.deepEqual(Array.from(livePose(src, tgt, s01, 1, t18.w).density), Array.from(tgt.density), 'uT 1 = target');
}

// ---- 4. the compass --------------------------------------------------------------------------------------
{
  // Pure: a map circle seen top-down, north up (screen y is DOWN).
  const ringOf = (fn) => Array.from({ length: 16 }, (_, i) => fn((i / 16) * Math.PI * 2));
  const up = compassLayout({ ring: ringOf((a) => [Math.cos(a) * 30, -Math.sin(a) * 30]), north: [0, -30], cx: 100, cy: 100, R: 9, map: ident });
  const needle = (L) => { const i = 16 + 3; return [L.positions[2 * i] - 100, L.positions[2 * i + 1] - 100]; };
  const [nx, ny] = needle(up);
  near(nx, 0, 1e-4, 'north-up needle has no sideways lean'); near(ny, -9 * 0.95, 1e-4, 'north-up needle points up'); // float32 pool buffers
  assert.ok(up.density[19] > up.density[18] && up.density[18] > up.density[0], 'tip brightest, needle over ring');
  let reach = 0; for (let i = 0; i < 16; i++) reach = Math.max(reach, Math.hypot(up.positions[2 * i] - 100, up.positions[2 * i + 1] - 100));
  near(reach, 9, 1e-4, 'the ring is normalised to R');

  // Integration: the REAL projection through LightHud (camera orbits with up = +Z, the camera door's convention).
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 1, 4000);
  camera.up.set(0, 0, 1);
  const scene = new THREE.Scene();
  const fieldGroup = new THREE.Group(); scene.add(fieldGroup);
  const hud = new LightHud({ camera, scene });
  hud.layout({ W, H, fov: FOV, track, compass: { left: 1380, top: 10, width: 26, height: 26 }, hudTop: 760 });
  const target = new THREE.Vector3(0, 0, 0);
  const place = (spinDeg, tiltDeg) => {
    const th = (spinDeg * Math.PI) / 180, ph = Math.max(1e-6, (tiltDeg * Math.PI) / 180), r = 900;
    camera.position.set(r * Math.sin(ph) * Math.sin(th), -r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph));
    camera.lookAt(target); scene.updateMatrixWorld(true);
    hud.update(1000, 0, { compass: true, fieldGroup, target });
    const a = hud.compass.points.geometry.getAttribute('aTarget').array, map = makePxMap({ W, H, fov: FOV });
    const [c0x, c0y] = map(1393, 23), u = unitsPerPx(FOV, H);
    const tip = [(a[2 * 19] - c0x) / u, -(a[2 * 19 + 1] - c0y) / u]; // → CSS px offset (y down)
    let ry = 0, rx = 0;
    for (let i = 0; i < 16; i++) { rx = Math.max(rx, Math.abs(a[2 * i] - c0x) / u); ry = Math.max(ry, Math.abs(a[2 * i + 1] - c0y) / u); }
    return { tip, rx, ry };
  };
  const home = place(0, 0);
  near(home.tip[0], 0, 1e-3, 'home: needle straight up (x)'); assert.ok(home.tip[1] < -8, 'home: needle points up the screen');
  const east = place(90, 0), west = place(-90, 0);
  near(east.tip[1], 0, 1e-3, 'spin +90: needle horizontal'); near(west.tip[1], 0, 1e-3, 'spin −90: needle horizontal');
  assert.ok(Math.sign(east.tip[0]) === -Math.sign(west.tip[0]) && Math.abs(east.tip[0]) > 8, 'opposite spins, opposite needles');
  const tilted = place(0, 60);
  near(tilted.ry / tilted.rx, Math.cos(Math.PI / 3), 0.03, 'tilt 60° squashes the ring by cos(tilt)');
  assert.equal(hud.compass.glow, false, 'the compass is structure (no glow)');
  assert.equal(hud.frame.glow, false, 'the ribbon frame is structure (no glow)');
  assert.equal(hud.data.glow, true, 'the ribbon lights are data (glow)');
}

// ---- 5. the living dock + formatters -------------------------------------------------------------------
{
  const pos = new Float32Array([0, 0, 10, 10, 5, 5, 99, 99]), den = new Float32Array([1, 0.5, 0, 1]);
  assert.deepEqual(subsampleActive(pos, den, 10), [[0, 0], [10, 10], [99, 99]], 'only active dots are sampled');
  const sm = sampleLayout({ positions: pos, density: den, ramp: new Uint8Array([2, 1, 0, 0]) }, 10);
  assert.deepEqual(sm.map((p) => [p.i, p.d, p.r]), [[0, 1, 2], [1, 0.5, 1], [3, 1, 0]], 'density + per-dot family ride along');
  assert.equal(sampleLayout({ positions: pos, density: den, ramp: 1 }, 10)[0].r, 1, 'a scalar family applies to every dot');
  assert.equal(sampleLayout({ positions: pos, density: den }, 10, { keep: (i) => i === 3 }).length, 1, 'keep() filters indices');
  assert.equal(subsampleActive(new Float32Array(2000), new Float32Array(1000).fill(1), 50).length, 50, 'the sample is capped');

  const f = fitShape({ frame: [{ x: 0, y: 0 }], data: [{ x: 100, y: 100, d: 0.7, r: 2 }] });
  for (const p of [...f.frame, ...f.data]) assert.ok(p.x >= 2 - 1e-9 && p.x <= ICON_W - 2 + 1e-9 && p.y >= 2 - 1e-9 && p.y <= ICON_H - 2 + 1e-9, 'fit stays inside the 52×36 box');
  near(Math.abs(f.data[0].x - f.frame[0].x), Math.abs(f.data[0].y - f.frame[0].y), 1e-9, 'fit keeps the aspect');
  assert.ok(f.frame[0].y > f.data[0].y, 'world y-up becomes icon y-down');
  assert.equal(f.data[0].d, 0.7, 'fields survive the fit');

  // The toll miniature follows the toll's own rule: ring radius grows with the cumulative count, warmth by age.
  const MURDER = [2343, 2271, 2308, 2293, 2575, 2904, 3186, 3224, 3311, 3729, 3925, 3940, 3823, 4076, 4114, 4544, 4369, 4448];
  const tm = tollMini(MURDER, { n: 62, R: 1, ramp: 0 });
  assert.equal(tm.real, true); assert.equal(tm.data.length, 62); assert.equal(tm.frame.length, 18);
  const rad = tm.data.map((p) => Math.hypot(p.x, p.y));
  for (let i = 1; i < rad.length; i++) assert.ok(rad[i] >= rad[i - 1] - 1e-9, 'later murders sit on outer rings (chronological)');
  assert.ok(rad[0] >= 0.05 - 1e-9 && rad.at(-1) <= 1 + 1e-9, 'inside the disc');
  assert.ok(tm.data[0].d < tm.data.at(-1).d, 'older rings cooler, newer warmer (age only)');
  assert.equal(releaseFallback().real, false, 'an illustrative icon is never marked real');

  // the density ramp matches the engine: cool at the sparse end, warm in the cores
  const RAMP = [[124, 156, 224], [232, 184, 146], [255, 138, 58]];
  assert.deepEqual(rampAt(RAMP, 0), RAMP[0]); assert.deepEqual(rampAt(RAMP, 1), RAMP[2]);

  // LivingIcon states, driven without a canvas
  const icon = new LivingIcon(null, 3);
  const model = { frame: [{ x: 0, y: 0 }, { x: 10, y: 0 }], data: [{ x: 5, y: 5, d: 0.9, r: 1 }], real: true };
  icon.setShape(model, 0); for (let t = 0; t <= 1200; t += 16) icon.tick(t);
  const shaped = fitShape(model);
  near(icon.pos(2).x, shaped.data[0].x, 1e-6, 'formed: a data dot sits on its shape'); near(icon.pos(2).on, 1, 1e-9, 'shape dots are on');
  near(icon.pos(ICON_SLOTS - 1).on, 0, 1e-9, 'spare slots fade out');
  icon.setState({ avail: false }, 1300); for (let t = 1300; t <= 2400; t += 16) icon.tick(t);
  near(icon.pos(2).x, icon.slots[2].sx, 1e-6, 'unavailable: the icon fails to form (its dots sit at their scatter)');
  near(icon.dim, 0.5, 0.01, 'unavailable: dimmer');
  icon.setState({ avail: true, active: true }, 2500); for (let t = 2500; t <= 3600; t += 16) icon.tick(t);
  near(icon.pos(2).x, shaped.data[0].x, 1e-6, 'available again: it forms'); near(icon.white, 1, 0.01, 'active → structure-white');
  icon.setHover(true, 3700); icon.tick(3700); icon.tick(3780);
  assert.ok(icon.form < 1, 'hover: the dots loosen first…');
  for (let t = 3780; t <= 4800; t += 16) icon.tick(t);
  near(icon.form, 1, 1e-9, '…then gather into the shape'); near(icon.glow, 1, 0.01, 'hover lights the icon');
  const off = new LivingIcon(null, 4); off.setState({ avail: false }, 0); off.setHover(true, 0); for (let t = 0; t <= 1000; t += 16) off.tick(t);
  near(off.glow, 0, 0.01, 'an unavailable mode never comes alive');

  assert.equal(fmtCount(35161), (35161).toLocaleString(), 'counts read like the old HUD');
  assert.equal(fmtRate(487.4), (487).toLocaleString(), 'rates ≥ 10 are whole');
  assert.equal(fmtRate(7.46), (7.5).toLocaleString(undefined, { minimumFractionDigits: 1 }), 'rates < 10 keep one decimal');
  assert.equal(fmtValue(1234.6, 'reported'), (1235).toLocaleString(), 'fmtValue routes by unit');
}

console.log('hud tests: all passed');
