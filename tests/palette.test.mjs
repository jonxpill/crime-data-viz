/**
 * The palette door's colour maths (node, zero deps: `npm test`). `node tests/palette.test.mjs --table`
 * also prints every resolved hex (the eye session's reference sheet).
 *
 * The contract under test:
 *  1. `current` is EXACTLY today's literals (ramps, structure, bg, HUD) — switching back is pixel-identical.
 *  2. OKLCH round-trips (hex → OKLCH → hex) on today's colours.
 *  3. Luminance rule: within every candidate, the three family ramps share the SAME OKLCH lightness at
 *     each stop (hue = family, light = density) — to within 8-bit rounding.
 *  4. Gamut clipping gives up CHROMA only — the resolved token keeps the authored L and h.
 *  5. Crime → family → ramp index follows SAPS's grouping.
 */
import assert from 'node:assert/strict';
import {
  oklch, hexToOklch, resolvePalette, applyPalette, familyOf, rampIndexOf, paletteKey, nextPalette,
  PALETTE_CYCLE, FAMILY_ORDER, ROLE_ORDER, CANDIDATES,
} from '../src/palette.js';

let passed = 0;
function test(label, fn) { fn(); passed++; console.log('  ok — ' + label); }
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

test('current = today\'s literals, exactly', () => {
  const P = resolvePalette('current');
  for (const r of P.ramps) assert.deepEqual(r, ['#7c9ce0', '#e8b892', '#ff8a3a']);
  assert.deepEqual(P.roles, ['#566d78', '#566d78', '#566d78', '#566d78', '#3a4656', '#566d78', '#55496b', '#566d78']);
  assert.equal(P.bg, '#05060a');
  assert.equal(P.css['hud-text'], '#8792a6');
  assert.equal(P.css['hud-hint'], '#ffce86');
  assert.equal(P.css['hud-flag'], '#5e6a52');
  assert.equal(P.css.brand, '#cdd6ee');
  assert.equal(P.clips.length, 0);
});

test('OKLCH round-trips today\'s colours', () => {
  for (const h of ['#7c9ce0', '#e8b892', '#ff8a3a', '#566d78', '#3a4656', '#55496b', '#05060a', '#8792a6', '#ffce86', '#5e6a52']) {
    const { L, C, h: hh } = hexToOklch(h);
    assert.equal(oklch(L, C, hh).hex, h, h);
  }
});

test('every candidate resolves to valid hex tokens', () => {
  for (const name of PALETTE_CYCLE) {
    const P = resolvePalette(name);
    const all = [...P.ramps.flat(), ...P.roles, P.bg, ...Object.values(P.css)];
    for (const x of all) assert.match(x, /^#[0-9a-f]{6}$/, `${name}: ${x}`);
    assert.equal(P.ramps.length, 4);
    assert.equal(P.roles.length, 8);
  }
});

test('luminance rule: family ramps share OKLCH L at each stop (± 8-bit rounding)', () => {
  for (const name of PALETTE_CYCLE.filter((n) => n !== 'current')) {
    const P = resolvePalette(name);
    for (let s = 0; s < 3; s++) {
      const Ls = FAMILY_ORDER.map((f) => hexToOklch(P.rampsByFamily[f][s]).L);
      const spread = Math.max(...Ls) - Math.min(...Ls);
      assert.ok(spread < 0.006, `${name} stop ${s}: L spread ${spread.toFixed(4)} (${Ls.map((x) => x.toFixed(3))})`);
      for (const L of Ls) assert.ok(Math.abs(L - CANDIDATES[name].stops.L[s]) < 0.006, `${name} stop ${s} L ${L}`);
    }
  }
});

test('gamut clipping reduces chroma only (L and h hold)', () => {
  for (const name of PALETTE_CYCLE.filter((n) => n !== 'current')) {
    const spec = CANDIDATES[name];
    for (const f of FAMILY_ORDER) {
      spec.hues[f].forEach((h, s) => {
        const t = oklch(spec.stops.L[s], spec.stops.C[s], h);
        assert.ok(t.C <= spec.stops.C[s] + 1e-9);
        const back = hexToOklch(t.hex);
        assert.ok(Math.abs(back.L - spec.stops.L[s]) < 0.006, `${name}/${f}[${s}] L`);
        if (t.C > 0.03) assert.ok(hueDist(back.h, h) < 3, `${name}/${f}[${s}] hue ${back.h.toFixed(1)} vs ${h}`);
      });
    }
  }
});

test('crime → SAPS family → ramp index', () => {
  for (const k of ['murder', 'sexoff', 'robbery', 'carjacking']) assert.equal(familyOf(k), 'contact');
  assert.equal(familyOf('burglary'), 'property');
  assert.equal(familyOf('commercial'), 'commercial');
  assert.deepEqual(['robbery', 'burglary', 'murder', 'sexoff', 'commercial', 'carjacking'].map(rampIndexOf), [0, 1, 0, 0, 2, 0]);
  assert.equal(rampIndexOf('something-new'), 0); // unknown → the first family, never a crash
});

test('names, aliases, cycle', () => {
  assert.equal(paletteKey('A'), 'ember'); assert.equal(paletteKey('b'), 'nocturne'); assert.equal(paletteKey('Spectral'), 'spectral');
  assert.equal(paletteKey('nope'), null);
  assert.deepEqual(PALETTE_CYCLE.map(nextPalette), ['ember', 'nocturne', 'spectral', 'current']);
});

test('applyPalette paints data ramps, structure roles + matte, bg, CSS', () => {
  const calls = [];
  const data = { glow: true, setRamps: (r) => calls.push(['ramps', r]) };
  const words = { glow: false, setRoleColors: (r) => calls.push(['roles', r]), setMatte: (m) => calls.push(['matte', m]) };
  const bg = { v: null, set(x) { this.v = x; } };
  const props = {};
  const doc = { documentElement: { style: { setProperty: (k, v) => { props[k] = v; } } } };
  const P = applyPalette('ember', { pools: [{ pool: data }, { pool: words, role: 'words' }, { pool: null }], background: bg, document: doc });
  assert.deepEqual(calls[0], ['ramps', P.ramps]);
  assert.deepEqual(calls[1], ['roles', P.roles]);
  assert.deepEqual(calls[2], ['matte', P.roles[ROLE_ORDER.indexOf('words')]]);
  assert.equal(bg.v, P.bg);
  assert.equal(props['--hud-text'], P.css['hud-text']);
});

if (process.argv.includes('--table')) {
  for (const name of PALETTE_CYCLE) {
    const P = resolvePalette(name);
    console.log(`\n## ${P.label}`);
    for (const f of FAMILY_ORDER) console.log(`  ${f.padEnd(11)} ${P.rampsByFamily[f].join('  ')}`);
    console.log('  roles      ' + ROLE_ORDER.map((r, i) => `${r} ${P.roles[i]}`).join(' · '));
    console.log('  bg         ' + P.bg);
    console.log('  css        ' + Object.entries(P.css).map(([k, v]) => `${k} ${v}`).join(' · '));
    if (P.clips.length) console.log('  clipped    ' + P.clips.map((c) => `${c.token} C ${c.wantC}→${c.C}`).join(' · '));
  }
}

console.log(`\npalette: ${passed} passed`);
