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

  // ---- cinema idle-fade — after a few idle seconds the chrome bows out; any input wakes it -----------
  // (parity: wcExplore L1230–1243). About-open pins it awake; views register extra keep-awake predicates
  // via pinAwake (the Toll pins `() => active` — the counter is its honesty channel).
  const CHROME_IDLE_MS = 6000;
  const pins = [];
  let lastActive = performance.now();
  function wake() { lastActive = performance.now(); document.body.classList.remove('quiet'); }
  function pinAwake(fn) { if (typeof fn === 'function') pins.push(fn); }
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(ev, wake, { passive: true });
  }
  setInterval(() => {
    const pinned = about.isOpen || pins.some((fn) => { try { return !!fn(); } catch { return false; } });
    document.body.classList.toggle('quiet', performance.now() - lastActive > CHROME_IDLE_MS && !pinned);
  }, 500);

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

  return { setCaption, setHint, setCitation, chips, about, pinAwake, floatingCaption };
}
