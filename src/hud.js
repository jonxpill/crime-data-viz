// The HUD — the chrome the shell hands each view as `ctx.hud`. See docs/plans/standalone-shell.md §2.
//
// It ADOPTS the static chrome DOM baked into the page (by id) and exposes SLOTS the views drive. Views
// NEVER touch the DOM directly — they call setCaption/setHint/setCitation/chips/about/floatingCaption. Split
// out of stage.js so a headless/perf view can boot the stage without a HUD, and so the HUD stays swappable.
//
// Lifted from wcExplore.js: caption/flag writes (refreshHud L971–1007), the chip toolkit (L1205–1269),
// the About card (L1221–1228), cinema idle-fade (L1230–1243), and the ring-rollover primitive (L810–839).
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const app = $('app');

  // ---- caption / hint / citation slots --------------------------------------
  const regionEl = $('region'), crimeEl = $('crime'), yearEl = $('year'), countEl = $('count');
  const hintEl = $('hint');
  const flagEl = $('flag');                            // CACHED once (plan §2: fixes wcExplore's L999 re-query)
  const set = (el, v) => { if (el != null && v != null) el.textContent = v; };

  function setCaption({ region, lens, time, count } = {}) {
    set(regionEl, region); set(crimeEl, lens); set(yearEl, time); set(countEl, count);
  }
  function setHint(text) { set(hintEl, text); }
  function setCitation(text) { set(flagEl, text); }

  // ---- About card — chip/`?`-opened only; ✕ / backdrop / Esc close (parity: wcExplore L1221–1228) ----
  const aboutEl = $('about');
  const closeBtn = $('about-close');
  const about = {
    // Replace the card body while preserving the ✕ button (its click listener survives — same node kept).
    setBody(html) {
      const card = aboutEl && aboutEl.querySelector('#about-card');
      if (!card) return;
      card.innerHTML = '';
      if (closeBtn) card.appendChild(closeBtn);
      card.insertAdjacentHTML('beforeend', html || '');
    },
    open() { aboutEl && aboutEl.classList.add('open'); wake(); },
    close() { aboutEl && aboutEl.classList.remove('open'); },
    toggle(show) { aboutEl && aboutEl.classList.toggle('open', show ?? !aboutEl.classList.contains('open')); if (this.isOpen) wake(); },
    get isOpen() { return !!(aboutEl && aboutEl.classList.contains('open')); },
  };
  closeBtn?.addEventListener('click', () => about.close());
  aboutEl?.addEventListener('click', (e) => { if (e.target === aboutEl) about.close(); }); // backdrop click

  // ---- chips — the SAME toolkit the keys drive, tappable (touch parity, wcExplore L1205–1269) --------
  // A chip that would no-op in the current state DIMS (`.off`) instead of lying — geometry stays put. Views
  // supply the action map + a dim rule; the About chip is HUD-owned (setActions never clobbers it).
  const chipEls = {};
  for (const el of document.querySelectorAll('.hud [data-act]')) chipEls[el.dataset.act] = el;
  if (chipEls.about) chipEls.about.onclick = () => { about.toggle(); chipEls.about.blur(); };
  let dimRule = null;
  const chips = {
    setActions(map) {
      for (const [act, fn] of Object.entries(map || {})) {
        const el = chipEls[act]; if (!el || act === 'about') continue;
        el.onclick = () => { fn(); el.blur(); };     // blur so a focused chip can't re-fire on Space
      }
    },
    setDimRule(fn) { dimRule = fn; },
    refresh() { for (const [act, el] of Object.entries(chipEls)) el.classList.toggle('off', dimRule ? !!dimRule(act) : false); },
  };

  // ---- cinema, INVERTED — the chrome is HIDDEN by default and reveals on movement, then bows back out.
  // (The explorer fades chrome only after 6 s idle; the standalone Toll wants it gone unless you reach for it
  // — the figures + the disc are the piece.) About-open pins it awake; views add keep-awake predicates via
  // pinAwake. The two flanking FIGURES are NOT chrome — they live outside .quiet and always show.
  const CHROME_IDLE_MS = 2600;                         // reveal, then re-hide after a short idle
  const pins = [];
  let lastActive = 0;                                  // 0 → starts hidden until the first movement
  function wake() { lastActive = performance.now(); document.body.classList.remove('quiet'); }
  function pinAwake(fn) { if (typeof fn === 'function') pins.push(fn); }
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(ev, wake, { passive: true });
  }
  document.body.classList.add('quiet');                // hidden on load
  setInterval(() => {
    const pinned = about.isOpen || pins.some((fn) => { try { return !!fn(); } catch { return false; } });
    document.body.classList.toggle('quiet', performance.now() - lastActive > CHROME_IDLE_MS && !pinned);
  }, 400);

  // ---- `?` opens About / Esc closes it; About gets FIRST DIBS on keys (plan §1 key routing) ----------
  // When the card is open the HUD SWALLOWS the event (stopImmediatePropagation) so the active view's own
  // window-keydown (registered later, thus firing after this) never sees the same Esc. Views additionally
  // guard on `!ctx.hud.about.isOpen` as belt-and-suspenders.
  window.addEventListener('keydown', (e) => {
    if (about.isOpen) {
      e.stopImmediatePropagation();
      if (e.code === 'Escape') { e.preventDefault(); about.close(); }
      return;
    }
    if (e.key === '?' || e.code === 'Slash') { e.preventDefault(); about.toggle(); }
  });

  // ---- floatingCaption — ONE pointer-following primitive, WITH a style channel (plan §2). The toll
  // rollover is a borderless grey structure WHISPER; the map tooltip is a BOXED data-chip. Same code,
  // different variant — do NOT collapse the two looks. Each variant owns its CSS + its placement.
  const CAPTION_VARIANTS = {
    // the toll's ring-rollover: names the year-stratum under the pointer. Grey #8b98ac, letter-spaced, .25s.
    rollover: {
      css: 'position:fixed;pointer-events:none;z-index:20;color:#8b98ac;' +
        'font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;' +
        'opacity:0;transition:opacity .25s',
      place(el, x, y) {                               // clamp so the whisper never runs off the viewport edge
        const w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(8, Math.min(x + 14, window.innerWidth - w - 8)) + 'px';
        el.style.top = Math.max(8, Math.min(y - 10, window.innerHeight - h - 8)) + 'px';
      },
    },
    // the map hover tooltip: a boxed data-chip anchored just above the pointer (the map view's consumer, later).
    tooltip: {
      css: 'position:fixed;pointer-events:none;z-index:20;padding:4px 9px;border-radius:5px;' +
        'background:rgba(8,10,16,.86);border:1px solid rgba(140,170,210,.28);color:#e4ebf4;' +
        'font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;opacity:0;' +
        'transition:opacity .12s;transform:translate(-50%,calc(-100% - 14px))',
      place(el, x, y) { el.style.left = x + 'px'; el.style.top = y + 'px'; },
    },
  };
  function floatingCaption(variant = 'rollover') {
    const v = CAPTION_VARIANTS[variant] || CAPTION_VARIANTS.rollover;
    const el = document.createElement('div');
    el.style.cssText = v.css;
    (app || document.body).appendChild(el);
    return {
      el,
      show(html, x, y) { if (el.innerHTML !== html) el.innerHTML = html; el.style.opacity = '1'; v.place(el, x, y); },
      hide() { el.style.opacity = '0'; },
    };
  }

  // ---- makeFigure — ADDITIVE factory for view-owned reading elements (the diptych's per-disc figures +
  // names; any view needing N readings instead of the fixed #fig-* trio). HUD owns the div creation (like
  // floatingCaption); the VIEW drives content/position/size — set(text), place(x,y in CSS px), show(v).
  // Base look matches the single pages' figures: 14px ui-monospace, #5a6377, tabular-nums, always-on (not
  // .quiet chrome). `cssText` appends AFTER the base so callers override transform/alignment/colour.
  // Does NOT touch `hud.figures` below — the single-province pages keep their fixed trio untouched.
  function makeFigure(cssText) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;z-index:8;transform:translate(-50%,-50%);' +
      'font:400 14px/1.02 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:0.04em;color:#5a6377;' +
      'font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none;user-select:none;' +
      'opacity:0;transition:opacity 0.8s ease;' + (cssText || '');
    (app || document.body).appendChild(el);
    return {
      el,
      set(text) { if (el.textContent !== text) el.textContent = text; },
      place(x, y) { el.style.left = x + 'px'; el.style.top = y + 'px'; },
      show(v) { el.style.opacity = v ? '1' : '0'; },
    };
  }

  // ---- the two flanking FIGURES — the reading beside the word. ALWAYS-ON (not hideable chrome): left is the
  // year's toll (resets per year), right the cumulative total. Positioned by CSS to flank the centred word.
  const figLeftEl = $('fig-left'), figRightEl = $('fig-right'), figTitleEl = $('fig-title');
  const figures = {
    // Just the bare numbers — left = the year's toll (resets per year), right = the running total. No labels:
    // which-is-which is self-evident (one resets, one only grows) and the ring rollover names the years.
    set(leftNum, rightNum) {
      if (figLeftEl) figLeftEl.textContent = leftNum;
      if (figRightEl) figRightEl.textContent = rightNum;
    },
    _titleUnit: 0,                                    // title px width per 1px of font-size (monospace → exact)
    setTitle(text) {
      if (!figTitleEl) return;
      figTitleEl.textContent = text || '';
      // Measure once per text at a SMALL probe size — a big probe (100px) exceeded the viewport and the
      // fixed element CLAMPED to it, corrupting the unit. Fractional rect, tiny font → no clamp, exact ratio.
      figTitleEl.style.fontSize = '10px';
      this._titleUnit = figTitleEl.getBoundingClientRect().width / 10;
      figTitleEl.style.fontSize = '';
    },
    // Pin the figures to the word's ACTUAL screen position (x = word centre, y = word centre, gap = px out to
    // each side; tx/ty = the title's anchor — the word's first letter's left edge, just above the ink).
    // Projected by the view — so everything holds its place at ANY window aspect/zoom, unlike CSS %.
    // `scale` (px-per-world now ÷ at the opening framing) sizes the type WITH the zoom: the reading is part
    // of the object, not chrome floating over it.
    place(x, y, gap, tx, ty, scale, titleW) {
      if (figLeftEl) { figLeftEl.style.right = (window.innerWidth - x + gap) + 'px'; figLeftEl.style.top = y + 'px'; }
      if (figRightEl) { figRightEl.style.left = (x + gap) + 'px'; figRightEl.style.top = y + 'px'; }
      if (figTitleEl && tx != null) { figTitleEl.style.left = tx + 'px'; figTitleEl.style.top = ty + 'px'; }
      if (scale != null) document.documentElement.style.setProperty('--fig-scale', scale.toFixed(4));
      // Title sized to an exact pixel SPAN (the view pins it to the word's own letterforms), not a fixed pt.
      if (figTitleEl && titleW != null && this._titleUnit) figTitleEl.style.fontSize = (titleW / this._titleUnit).toFixed(2) + 'px';
    },
    show(v) {
      const o = v ? '1' : '0';
      if (figLeftEl) figLeftEl.style.opacity = o;
      if (figRightEl) figRightEl.style.opacity = o;
      if (figTitleEl) figTitleEl.style.opacity = o;
    },
  };

  return { setCaption, setHint, setCitation, chips, about, pinAwake, floatingCaption, makeFigure, figures };
}
