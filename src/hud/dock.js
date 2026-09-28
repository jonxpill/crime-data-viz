// THE DOCK — the DOM half of the explorer's HUD (D5, pass 1). Crisp HTML text + tappable words; the ribbon
// and compass themselves are drawn by the engine (src/hud/light.js) into rects this DOM defines.
//
//   bottom-left   THE SENTENCE — `place · crime · year · count  unlit`. The readout IS the control: every
//                 tappable part carries a dotted underline (the affordance). A transient CAPTION above it
//                 carries a scene's instructions (~4 s, re-shown on hover).
//   bottom-right  THE VIEWS — words with 28×20 dot icons (icons.js masks → currentColor), `more` → popover.
//   bottom edge   THE RIBBON BAR — ▶/❚❚ · the invisible hit track over the engine-drawn ribbon · years | months.
//   top-right     the compass hit area (engine-drawn above it) + `?`.
//
// It knows NOTHING about the explorer's state: wcExplore hands it plain models and receives intents through
// ONE callback, act(name, arg, el) — the same action table the keys drive. Pointer-event driven throughout;
// popovers open on tap and close on an outside tap; no function depends on hover (hover only re-shows text).
import { columnAt } from './light.js';

export const fmtCount = (v) => Math.round(v).toLocaleString();
/** Per-100k rates: whole numbers from 10 up, one decimal below (a small district's carjacking rate). */
export const fmtRate = (v) => (Math.abs(v) >= 10 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const fmtValue = (v, unit) => (unit === 'per 100k' ? fmtRate(v) : fmtCount(v));

const CAPTION_MS = 4000, ROLL_MS = 400;

export function createDock({ doc = document, act, ribbonTip = () => null } = {}) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    dock: $('dock'), wrap: $('sentence-wrap'), sentence: $('sentence'), caption: $('caption'),
    place: $('place'), crime: $('crime'), year: $('year'), count: $('count'), countSep: $('count-sep'),
    lens: $('lens-unlit'), views: $('views'), play: $('rb-play'), track: $('rb-track'), sw: $('rb-switch'),
    tip: $('rb-tip'), pop: $('pop'), compass: $('compass-hit'), help: $('help-btn'),
  };
  const fire = (name, arg, node) => { act(name, arg, node); if (node && node.blur) node.blur(); };

  // ---- the sentence --------------------------------------------------------------------------------------
  let placeSig = '';
  function renderPlace(parts) {
    const sig = JSON.stringify(parts);
    if (sig === placeSig) return;
    placeSig = sig;
    el.place.textContent = '';
    parts.forEach((p, i) => {
      if (i) { const s = doc.createElement('span'); s.className = 'crumb-sep'; s.textContent = ' › '; el.place.appendChild(s); }
      const tappable = !!p.act;
      const n = doc.createElement(tappable ? 'button' : 'span');
      n.textContent = p.text;
      if (tappable) {
        n.className = 'tap' + (p.off ? ' off' : '');
        n.addEventListener('click', () => fire(p.act, p.arg, n));
      }
      el.place.appendChild(n);
    });
  }
  function setPart(node, part) {
    if (!node || !part) return;
    if (part.text != null && node.textContent !== part.text) node.textContent = part.text;
    node.classList.toggle('tap', !!part.act);
    node.classList.toggle('off', !part.act || !!part.off);
    node._act = part.act || null;
  }
  // Numbers ROLL to their new value (~400 ms, ease-out) — the count is the one number that changes under you.
  function roll(node, to, unit) {
    const suffix = unit ? ' ' + unit : '';
    cancelAnimationFrame(node._raf);
    const from = node._v ?? null;                  // a unit switch rolls too (count ⇄ rate)
    node._unit = unit;
    if (from == null || !isFinite(from) || from === to) { node._v = to; node.textContent = fmtValue(to, unit) + suffix; return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ROLL_MS), e = 1 - Math.pow(1 - p, 3);
      const v = from + (to - from) * e;
      node._v = p < 1 ? v : to;
      node.textContent = fmtValue(node._v, unit) + suffix;
      if (p < 1) node._raf = requestAnimationFrame(step);
    };
    node._raf = requestAnimationFrame(step);
  }
  function setCount(part) {
    const node = el.count;
    if (part.value != null && isFinite(part.value)) roll(node, part.value, part.unit || '');
    else { cancelAnimationFrame(node._raf); node._v = null; node._unit = null; node.textContent = part.text || ''; }
    node.classList.toggle('tap', !!part.act);
    node.classList.toggle('off', !part.act || !!part.off);
    node._act = part.act || null;
    const empty = !node.textContent;
    el.countSep.style.display = empty ? 'none' : '';
  }
  for (const k of ['crime', 'year', 'count']) {
    el[k].addEventListener('click', () => { if (el[k]._act) fire(el[k]._act, null, el[k]); });
  }
  el.lens.addEventListener('click', () => fire('unlit', null, el.lens));

  function setSentence(m) {
    renderPlace(m.place || []);
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
    cancelAnimationFrame(el.count._raf); el.count._v = null; el.count._unit = null;
    if (el.count.textContent !== t) el.count.textContent = t;
    el.countSep.style.display = t ? '' : 'none';
  }

  // ---- the transient caption (scene instructions) --------------------------------------------------------
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
  el.wrap.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; capHover = true; capShow(true); });
  el.wrap.addEventListener('pointerleave', () => {
    capHover = false;
    const left = capUntil - performance.now();
    clearTimeout(capTimer);
    capTimer = setTimeout(() => capShow(false), Math.max(900, left));
  });

  // ---- the views ------------------------------------------------------------------------------------------
  const viewEls = {};
  for (const b of el.views.querySelectorAll('.view')) {
    viewEls[b.dataset.view] = b;
    b.addEventListener('click', () => fire(b.dataset.view === 'more' ? 'more' : 'view', b.dataset.view, b));
  }
  function setViews({ active = '', off = {} } = {}) {
    for (const [name, b] of Object.entries(viewEls)) {
      b.classList.toggle('on', name === active);
      b.classList.toggle('off', !!off[name] && name !== active);
    }
  }
  function setIcons(urls) {
    for (const [name, url] of Object.entries(urls)) {
      const ico = viewEls[name] && viewEls[name].querySelector('.ico');
      if (!ico || !url || ico._url === url) continue;
      ico._url = url;
      ico.style.webkitMaskImage = ico.style.maskImage = `url(${url})`;
      ico.classList.add('ready');
    }
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
    const top = a.top - ph - 8 >= 8 ? a.top - ph - 8 : Math.min(H - ph - 8, a.bottom + 8); // above; below near the top
    el.pop.style.left = left + 'px'; el.pop.style.top = top + 'px';
  }
  function closePop() { el.pop.classList.remove('open'); popAnchor = null; }
  const popOpen = () => el.pop.classList.contains('open');
  doc.addEventListener('pointerdown', (e) => {                     // an outside tap closes (capture: before the canvas)
    if (!popOpen()) return;
    if (el.pop.contains(e.target) || (popAnchor && popAnchor.contains(e.target))) return;
    closePop();
  }, true);

  // ---- measurement (the layout truth the engine draws into) -----------------------------------------------
  const rectOf = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
  return {
    setSentence, setYearText, setCountText, setCaption, setViews, setIcons, setRibbonBar, setPlaying, setCompass,
    openPop, closePop, popOpen, hideTip,
    trackRect: () => rectOf(el.track),
    compassRect: () => rectOf(el.compass),
    hudTop: () => el.dock.getBoundingClientRect().top,
    get caption() { return capText; },
  };
}
