/**
 * The engine's TONE channel + the palette door's parity guarantee (node — three.js objects need no WebGL
 * to be built, so this checks everything but the GPU: `npm test`).
 *  1. applyPalette('current') leaves every ramp / matte / role uniform BIT-IDENTICAL to the pre-palette
 *     defaults (with the unchanged default shader path, that is what keeps `current` pixel-identical).
 *  2. Untagged pools never upload tone buffers; scalar / per-dot / absent tone fill semantics.
 *  3. setRamp / setRamps / setRoleColors contracts.
 */
import assert from 'node:assert/strict';
import { PointField } from '../src/engine/PointField.js';
import { applyPalette, ROLES } from '../src/palette.js';
const u = (p) => p.material.uniforms;
const col = (c) => [c.r, c.g, c.b];

// 1. current palette leaves every uniform bit-identical to the constructor defaults
const data = new PointField(10, { glow: true });
const before = { cool: u(data).uRampCool.value.map(col), mid: u(data).uRampMid.value.map(col), warm: u(data).uRampWarm.value.map(col) };
const str = new PointField(10, { glow: false, matte: '#566d78' });
const words = new PointField(10, { glow: false, matte: '#3a4656' });
const unlit = new PointField(10, { glow: false, matte: '#55496b' });
const sb = col(u(str).uMatte.value), wb = col(u(words).uMatte.value), ub = col(u(unlit).uMatte.value);
applyPalette('current', { pools: [{ pool: data }, { pool: str, role: 'lace' }, { pool: words, role: 'words' }, { pool: unlit, role: 'unlit' }] });
assert.deepEqual(u(data).uRampCool.value.map(col), before.cool);
assert.deepEqual(u(data).uRampMid.value.map(col), before.mid);
assert.deepEqual(u(data).uRampWarm.value.map(col), before.warm);
assert.deepEqual(col(u(str).uMatte.value), sb);
assert.deepEqual(col(u(words).uMatte.value), wb);
assert.deepEqual(col(u(unlit).uMatte.value), ub);
assert.deepEqual(col(u(str).uRoleColors.value[ROLES.frame]), sb); // frames = the outline's slate in `current`
console.log('ok — current palette: every ramp/matte/role uniform bit-identical to the pre-palette defaults');

// 2. an untagged pool never touches its tone buffers (no uploads)
const L = { positions: new Float32Array(20), density: new Float32Array(10).fill(0.5) };
const p = new PointField(10, { glow: true });
p.setSource(L); p.setTarget(L);
assert.equal(p.points.geometry.getAttribute('aSourceTone').version, 0);
assert.equal(p.points.geometry.getAttribute('aTargetTone').version, 0);
p.setSource({ ...L, ramp: 0 });
assert.equal(p.points.geometry.getAttribute('aSourceTone').version, 0);
console.log('ok — untagged / ramp-0 writes on a never-tagged pool upload nothing');

// 3. scalar ramp fills the slice; array ramp at an offset; absent → 0 once used
const half = { positions: new Float32Array(10), density: new Float32Array(5).fill(0.5) };
p.setTarget({ ...half, ramp: 2 }, 5);
assert.deepEqual([...p.points.geometry.getAttribute('aTargetTone').array], [0, 0, 0, 0, 0, 2, 2, 2, 2, 2]);
p.setTarget({ ...half, ramp: Uint8Array.from([1, 0, 1, 0, 1]) }, 0);
assert.deepEqual([...p.points.geometry.getAttribute('aTargetTone').array], [1, 0, 1, 0, 1, 2, 2, 2, 2, 2]);
p.setTarget(half, 5);
assert.deepEqual([...p.points.geometry.getAttribute('aTargetTone').array], [1, 0, 1, 0, 1, 0, 0, 0, 0, 0]);
console.log('ok — ramp: scalar fills its slice, per-dot arrays land at the offset, absent → 0');

// 4. structure reads layout.role (not ramp); data ignores role
const s2 = new PointField(4, { glow: false });
s2.setSource({ positions: new Float32Array(8), density: new Float32Array(4), role: 3, ramp: 1 });
assert.deepEqual([...s2.points.geometry.getAttribute('aSourceTone').array], [3, 3, 3, 3]);
const d2 = new PointField(4, { glow: true });
d2.setSource({ positions: new Float32Array(8), density: new Float32Array(4), role: 3 });
assert.equal(d2.points.geometry.getAttribute('aSourceTone').version, 0);
console.log('ok — structure pools read layout.role, data pools read layout.ramp');

// 5. setRamp = ramp 0 only; setRamps sparse; setRoleColors ignores index 0
const d3 = new PointField(4, { glow: true });
d3.setRamp('#ff0000', null, null);
assert.equal(u(d3).uRampCool.value[0].getHexString(), 'ff0000');
assert.equal(u(d3).uRampCool.value[1].getHexString(), '7c9ce0');
d3.setRamps([null, null, ['#00ff00', '#0000ff', '#ffffff']]);
assert.equal(u(d3).uRampCool.value[2].getHexString(), '00ff00');
assert.equal(u(d3).uRampCool.value[0].getHexString(), 'ff0000');
const s3 = new PointField(4, { glow: false, matte: '#123456' });
s3.setRoleColors(['#ffffff', '#010203']);
assert.equal(u(s3).uMatte.value.getHexString(), '123456');
assert.equal(u(s3).uRoleColors.value[1].getHexString(), '010203');
console.log('ok — setRamp → ramp 0 · setRamps sparse · setRoleColors leaves role 0 (= matte) alone');

// 6. an ember apply paints three different family ramps
const d4 = new PointField(4, { glow: true });
const P = applyPalette('ember', { pools: [{ pool: d4 }] });
const warm = u(d4).uRampWarm.value.map((c) => '#' + c.getHexString());
assert.deepEqual(warm.slice(0, 3), P.ramps.slice(0, 3).map((r) => r[2]));
console.log('ok — ember: warm stops per family =', warm.slice(0, 3).join(' '));
console.log('\ntone: 6 passed');
