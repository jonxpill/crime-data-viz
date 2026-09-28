// THE CHROME'S DOM — the explorer's readout + tools (D5 usability pass). Crisp HTML text + tappable words; the
// glass, rim, ribbon and compass themselves are drawn by the engine (src/hud/light.js) into rects this DOM defines.
//
//   top-left      THE READOUT — line 1 the place (‹ backs out), line 2 `crime · year · count · unlit`: the scene's
//                 label AND its controls (tappable parts wear a thin solid underline). The transient scene
//                 caption sits under it.
//   the tools     the RIBBON BAR (▶ · the invisible scrub track · years | months) standing on the glass's rim, and
//                 THE VIEWS — nine living icon cells, in a right rail (body.layout-rail) or one centred row
//                 (body.layout-bottom). An icon FAILS TO FORM only when its mode is truly impossible (its tip
//                 says why); a navigation that must wait for a transition shows as a slow PENDING pulse.
//   top-right     the compass hit area (engine-drawn under it) + `?` — or the top of the rail.
//
// It knows NOTHING about the explorer's state: wcExplore hands it plain models and receives intents through ONE
// callback, act(name, arg, el). Pointer-event driven; popovers open on tap and close on an outside tap or a pick
// (never on idle); no function depends on hover (hover only re-shows text). It also reports what the cinema
// timer needs: is the pointer over the chrome, is the ribbon held, is a popover open.
import { columnAt } from './light.js';
import { LivingIcon, hexRgb } from './icons.js';

export const fmtCount = (v) => Math.round(v).toLocaleString();
/** Per-100k rates: whole numbers from 10 up, one decimal below (a small district's carjacking rate). */
export const fmtRate = (v) => (Math.abs(v) >= 10 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const fmtValue = (v, unit) => (unit === 'per 100k' ? fmtRate(v) : fmtCount(v));

// ---- contrast (WCAG relative luminance) — the chrome's text tokens are LIFTED from the palette's until legible ----
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const relLum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** Mix `hex` toward white until it reaches `target`:1 against `bgHex` (keeps its hue family; never darkens). */
export function liftToContrast(hex, bgHex, target) {
  const bg = hexRgb(bgHex), c0 = hexRgb(hex);
  for (let k = 0; k <= 40; k++) {
    const t = k / 40, c = c0.map((v) => v + (255 - v) * t);
    if (contrast(c, bg) >= target) return toHex(c);
  }
  return '#ffffff';
}

const CAPTION_MS = 4000, ROLL_MS = 400;

export function createDock({ doc = document, act, ribbonTip = () => null } = {}) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    readout: $('readout'), back: $('back'), place: $('place'), caption: $('caption'),
    crime: $('crime'), year: $('year'), count: $('count'), countSep: $('count-sep'), lens: $('lens-unlit'),
    views: $('views'), dock: $('dock'), rail: $('rail'), bar: $('ribbon-bar'), play: $('rb-play'), track: $('rb-track'),
    sw: $('rb-switch'), tip: $('rb-tip'), vtip: $('view-tip'), pop: $('pop'), compass: $('compass-hit'), help: $('help-btn'), topright: $('topright'),
  };
  const fire = (name, arg, node) => { act(name, arg, node); if (node && node.blur) node.blur(); };

  // ---- is the pointer over the chrome? (the cinema never fades what you're touching) ------------------------
  const inside = new Set();
  for (const z of [el.readout, el.views, el.dock, el.rail, el.bar, el.topright, el.pop]) {
    if (!z) continue;
    z.addEventListener('pointerenter', () => inside.add(z));
    z.addEventListener('pointerleave', () => inside.delete(z));
  }

  // ---- the readout ----------------------------------------------------------------------------------------
  function setPart(node, part) {
    if (!node || !part) return;
    if (part.text != null && node.textContent !== part.text) node.textContent = part.text;
    node.classList.toggle('tap', !!part.act);
    node.classList.toggle('off', !part.act || !!part.off);
    node._act = part.act || null;
    node._arg = part.arg;
  }
  // Numbers ROLL to their new value (~400 ms, ease-out) — the count is the one number that changes under you.
  function roll(node, to, unit) {
    const suffix = unit ? ' ' + unit : '';
    cancelAnimationFrame(node._raf);
    const from = node._v ?? null;                  // a unit switch rolls too (count ⇄ rate)
    if (from == null || !isFinite(from) || from === to) { node._v = to; node.textContent = fmtValue(to, unit) + suffix; return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ROLL_MS), e = 1 - Math.pow(1 - p, 3);
      node._v = p < 1 ? from + (to - from) * e : to;
      node.textContent = fmtValue(node._v, unit) + suffix;
      if (p < 1) node._raf = requestAnimationFrame(step);
    };
    node._raf = requestAnimationFrame(step);
  }
  function setCount(part) {
    const node = el.count;
    if (part.value != null && isFinite(part.value)) roll(node, part.value, part.unit || '');
    else { cancelAnimationFrame(node._raf); node._v = null; node.textContent = part.text || ''; }
    node.classList.toggle('tap', !!part.act);
    node.classList.toggle('off', !part.act || !!part.off);
    node._act = part.act || null;
    el.countSep.style.display = node.textContent ? '' : 'none';
  }
  for (const k of ['back', 'place', 'crime', 'year', 'count']) {
    el[k].addEventListener('click', () => { if (el[k]._act) fire(el[k]._act, el[k]._arg, el[k]); });
  }
  el.lens.addEventListener('click', () => fire('unlit', null, el.lens));

  /** m = { back: {act}|null, place, crime, year, count: {value, unit}|{text}, lens: {on, off} } */
  function setSentence(m) {
    el.back.classList.toggle('show', !!(m.back && m.back.act));
    el.back._act = m.back ? m.back.act : null;
    setPart(el.place, m.place);
    setPart(el.crime, m.crime);
    setPart(el.year, m.year);
    setCount(m.count || {});
    const lens = m.lens || {};
    el.lens.classList.toggle('on', !!lens.on);
    el.lens.classList.toggle('off', !!lens.off);
  }
  // The toll's dial clock writes these at frame rate — plain text, no roll (it is already a counter).
  function setYearText(t) { if (el.year.textContent !== t) el.year.textContent = t; }
  function setCountText(t) {
    cancelAnimationFrame(el.count._raf); el.count._v = null;
    if (el.count.textContent !== t) el.count.textContent = t;
    el.countSep.style.display = t ? '' : 'none';
  }

  // ---- the transient caption (scene instructions), under the readout -------------------------------------------
  let capText = '', capUntil = 0, capHover = false, capTimer = 0;
  function capShow(on) { el.caption.classList.toggle('show', on && !!capText); }
  function setCaption(text) {
    text = text || '';
    if (text === capText) return;
    capText = text;
    el.caption.textContent = text;
    clearTimeout(capTimer);
    if (!text) { capShow(false); return; }
    capUntil = performance.now() + CAPTION_MS;
    capShow(true);
    capTimer = setTimeout(() => { if (!capHover) capShow(false); }, CAPTION_MS);
  }
  el.readout.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; capHover = true; capShow(true); });
  el.readout.addEventListener('pointerleave', () => {
    capHover = false;
    clearTimeout(capTimer);
    capTimer = setTimeout(() => capShow(false), Math.max(900, capUntil - performance.now()));
  });

  // ---- the living views: nine icon cells --------------------------------------------------------------------
  const cells = {};
  let seed = 1, why = {};
  for (const b of el.views.querySelectorAll('.view')) {
    const name = b.dataset.view, icon = new LivingIcon(b.querySelector('canvas'), seed++);
    cells[name] = { b, icon };
    b.addEventListener('click', () => {
      if (b.classList.contains('off')) { showViewTip(name, why[name] || 'not available here'); return; } // explain, don't act
      hideViewTip();
      fire('view', name, b);
    });
    b.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (b.classList.contains('off')) showViewTip(name, why[name] || 'not available here');
      icon.setHover(true, performance.now()); kick();
    });
    b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { icon.setHover(false, performance.now()); kick(); hideViewTip(); } });
    b.addEventListener('pointerdown', (e) => {                      // touch: the alive state plays briefly on tap
      if (e.pointerType === 'mouse') return;
      icon.setHover(true, performance.now()); kick();
      clearTimeout(b._t); b._t = setTimeout(() => { icon.setHover(false, performance.now()); kick(); hideViewTip(); }, 1400);
    });
  }
  function showViewTip(name, text) {
    const r = cells[name].b.getBoundingClientRect(), rail = doc.body.classList.contains('layout-rail');
    el.vtip.textContent = text;
    el.vtip.classList.add('show');
    const w = el.vtip.offsetWidth, h = el.vtip.offsetHeight;
    el.vtip.style.left = (rail ? r.left - w - 10 : Math.max(8, Math.min(r.left + r.width / 2 - w / 2, doc.documentElement.clientWidth - w - 8))) + 'px';
    el.vtip.style.top = (rail ? r.top + r.height / 2 - h / 2 : r.top - h - 8) + 'px';
  }
  function hideViewTip() { el.vtip.classList.remove('show'); }
  let colors = null, ramps = null, raf = 0;
  function readColors() {
    const cs = getComputedStyle(doc.documentElement);
    colors = { text: hexRgb(cs.getPropertyValue('--ro-text')), strong: hexRgb(cs.getPropertyValue('--hud-strong')), ramps };
  }
  function loop(now) {
    raf = 0;
    if (!colors) readColors();
    let any = false;
    for (const { icon } of Object.values(cells)) {
      const anim = icon.tick(now);
      if (anim || icon.dirty) icon.draw(colors);
      any = any || anim;
    }
    if (any) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  /** { active, off: {name: true}, why: {name: 'reason'}, pending: name|null } */
  function setViews({ active = '', off = {}, why: w = {}, pending = null } = {}) {
    why = w;
    const now = performance.now();
    for (const [name, { b, icon }] of Object.entries(cells)) {
      const isOn = name === active, isOff = !!off[name] && !isOn, isPend = name === pending && !isOn;
      b.classList.toggle('on', isOn);
      b.classList.toggle('off', isOff);
      b.classList.toggle('pending', isPend);
      b.setAttribute('aria-disabled', isOff ? 'true' : 'false');
      icon.setState({ avail: !isOff, active: isOn, pending: isPend }, now);
    }
    kick();
  }
  function setIconModel(name, model) {
    const c = cells[name];
    if (!c || !model) return;
    c.icon.setShape(model, performance.now());
    kick();
  }
  /** The palette's family ramps ([[cool, mid, warm] hex] by ramp index) + a repaint of every icon. */
  function setIconPalette(rampHexes) {
    ramps = rampHexes ? rampHexes.map((r) => r.map(hexRgb)) : null;
    refreshColors();
  }
  /** Re-derive the chrome's legible text tokens from the palette's (≥ 7:1 text, ≥ 4.8:1 dim against the bg). */
  function refreshColors() {
    const cs = getComputedStyle(doc.documentElement), st = doc.documentElement.style;
    const bg = cs.getPropertyValue('--bg').trim() || '#05060a';
    const text = cs.getPropertyValue('--hud-text').trim() || '#8792a6', dim = cs.getPropertyValue('--hud-dim').trim() || '#6b7689';
    st.setProperty('--ro-text', liftToContrast(text, bg, 7));
    st.setProperty('--ro-dim', liftToContrast(dim, bg, 4.8));
    colors = null;
    for (const { icon } of Object.values(cells)) icon.dirty = true;
    kick();
  }

  // ---- the ribbon bar: play · the scrub track · years | months --------------------------------------------
  let ncols = 18, scrubOff = false, dragging = false, lastCol = -1, tipTimer = 0;
  el.play.addEventListener('click', () => fire('play', null, el.play));
  for (const b of el.sw.querySelectorAll('button')) b.addEventListener('click', () => fire('pulse', b.dataset.pulse === '1', b));
  let playShown = null;
  function setPlaying(on) {
    if (playShown === on) return;
    playShown = on;
    el.play.textContent = on ? '❚❚' : '▶';
    el.play.setAttribute('aria-label', on ? 'pause' : 'play');
  }
  function setRibbonBar({ playing, playOff, pulse, switchOff, scrubOff: so, ncols: n }) {
    setPlaying(!!playing);
    el.play.classList.toggle('off', !!playOff);
    for (const b of el.sw.querySelectorAll('button')) b.classList.toggle('on', (b.dataset.pulse === '1') === !!pulse);
    el.sw.classList.toggle('off', !!switchOff);
    scrubOff = !!so; el.track.classList.toggle('off', scrubOff);
    if (n) ncols = n;
    if (scrubOff) hideTip();
  }
  function colOf(e) { return columnAt(el.track.getBoundingClientRect(), ncols, e.clientX); }
  function showTip(c) {
    const text = ribbonTip(c);
    if (!text) { hideTip(); return; }
    clearTimeout(tipTimer);
    const r = el.track.getBoundingClientRect();
    el.tip.textContent = text;
    el.tip.style.left = (r.left + (c + 0.5) * (r.width / ncols)) + 'px';
    el.tip.style.top = (r.top - 2) + 'px';
    el.tip.classList.add('show');
  }
  function hideTip() { clearTimeout(tipTimer); el.tip.classList.remove('show'); }
  el.track.addEventListener('pointerdown', (e) => {
    if (scrubOff || e.button > 0) return;
    e.preventDefault();
    try { el.track.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
    dragging = true;
    lastCol = colOf(e);
    act('scrub', lastCol);
    showTip(lastCol);
  });
  el.track.addEventListener('pointermove', (e) => {
    if (scrubOff) return;
    const c = colOf(e);
    if (dragging && c !== lastCol) { lastCol = c; act('scrub', c); }
    showTip(c);
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try { el.track.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (e.pointerType !== 'mouse') { clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 900); }
  };
  el.track.addEventListener('pointerup', endDrag);
  el.track.addEventListener('pointercancel', endDrag);
  el.track.addEventListener('pointerleave', () => { if (!dragging) hideTip(); });

  // ---- top-right: compass hit + ? -------------------------------------------------------------------------
  el.compass.addEventListener('click', () => fire('home', null, el.compass));
  el.help.addEventListener('click', () => fire('help', null, el.help));
  function setCompass(on) { el.compass.classList.toggle('show', !!on); }

  // ---- the popover (one element, re-filled per opener) ----------------------------------------------------
  let popAnchor = null;
  function openPop(anchor, items, { title = '' } = {}) {
    if (popAnchor === anchor && el.pop.classList.contains('open')) { closePop(); return; } // tap again = close
    el.pop.textContent = '';
    if (title) { const h = doc.createElement('div'); h.className = 'pop-title'; h.textContent = title; el.pop.appendChild(h); }
    for (const it of items) {
      const b = doc.createElement('button');
      b.className = (it.cur ? 'cur' : '') + (it.off ? ' off' : '');
      const l = doc.createElement('span'); l.textContent = it.label; b.appendChild(l);
      if (it.note) { const n = doc.createElement('span'); n.className = 'n'; n.textContent = it.note; b.appendChild(n); }
      b.addEventListener('click', () => { closePop(); if (!it.off && it.pick) it.pick(); });
      el.pop.appendChild(b);
    }
    el.pop.classList.add('open');
    popAnchor = anchor;
    const a = anchor.getBoundingClientRect(), W = doc.documentElement.clientWidth, H = doc.documentElement.clientHeight;
    const pw = el.pop.offsetWidth, ph = el.pop.offsetHeight;
    const left = Math.max(8, Math.min(a.left - 8, W - pw - 8));
    const below = a.bottom + 8, above = a.top - ph - 8;                      // the readout opens DOWN; the tools open UP
    const top = below + ph <= H - 8 && a.top < H / 2 ? below : Math.max(8, above);
    el.pop.style.left = left + 'px'; el.pop.style.top = top + 'px';
  }
  function closePop() { el.pop.classList.remove('open'); popAnchor = null; inside.delete(el.pop); }
  const popOpen = () => el.pop.classList.contains('open');
  doc.addEventListener('pointerdown', (e) => {                     // an outside tap closes (capture: before the canvas)
    if (!popOpen()) return;
    if (el.pop.contains(e.target) || (popAnchor && popAnchor.contains(e.target))) return;
    closePop();
  }, true);

  // ---- measurement (the layout truth the engine + the camera read) ---------------------------------------
  const rectOf = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  return {
    setSentence, setYearText, setCountText, setCaption, setViews, setIconModel, setIconPalette, refreshColors,
    setRibbonBar, setPlaying, setCompass, openPop, closePop, popOpen, hideTip,
    trackRect: () => rectOf(el.track),
    compassRect: () => rectOf(el.compass),
    readoutRect: () => rectOf(el.readout),
    barRect: () => rectOf(el.bar),
    pointerInside: () => inside.size > 0,
    dragging: () => dragging,
    get caption() { return capText; },
  };
}
