// murderMap — the standalone Toll page's IDLE view: the Western Cape murder map, from which K gathers into
// the ceremony. See docs/plans/standalone-shell.md §3,§4.
//
// It drives ctx.playback over the 18 murder-year layouts (the caption tracks the year), and routes K → the
// Toll view. FROZEN-RETURN rule (plan §4): re-entered from the toll it must be PAUSED at the settled pose —
// enter({paused:true}) seeds the current year statically and does NOT auto-resume the loop, matching the
// explorer, which leaves the map frozen after the ceremony. A fresh entry auto-plays the year loop.
export function createMurderMapView(ctx) {
  let lastYi = -1, onKey = null;

  function paintCaption() {
    const yi = ctx.playback.yi;
    if (yi === lastYi) return;
    lastYi = yi;
    ctx.hud.setCaption({
      region: 'Western Cape', lens: 'murder',
      time: ctx.data.yearLabels[yi],
      count: (ctx.data.totals[yi] || 0).toLocaleString() + ' recorded',
    });
  }

  return {
    meta: { key: 'murderMap', label: 'Western Cape · murder', chipText: '' },

    enter(opts = {}) {
      ctx.frameTo(ctx.data.box);                 // camera framed ONCE to the province box, static
      // Seed the struct pool at the resting outline (current=outline, so the toll's gather sources from it).
      ctx.struct.rest(ctx.data.outline);
      // Seed the data pair. On a frozen return we hold the year the toll left us on; on a fresh entry we
      // open on the latest year, then play forward. seedPair writes source/target/t — single-writer.
      const startYi = opts.paused ? ctx.playback.yi : ctx.data.years.length - 1;
      ctx.playback.seedPair(ctx.data.layouts, startYi);
      if (opts.paused) ctx.playback.pause(); else ctx.playback.play();
      lastYi = -1; paintCaption();

      ctx.hud.setHint('press K for the toll');
      ctx.hud.setCitation('◆ SAPS crime records · DataFirst + saps.gov.za');
      ctx.hud.chips.setActions({ toll: () => ctx.setView('toll') });
      ctx.hud.chips.setDimRule(() => false);     // nothing dims on the idle map (toll + about always live)
      ctx.hud.chips.refresh();

      onKey = (e) => {
        if (ctx.hud.about.isOpen) return;        // About gets first dibs on keys (plan §1)
        if (e.code === 'KeyK') { e.preventDefault(); ctx.setView('toll'); }
      };
      window.addEventListener('keydown', onKey);
    },

    update(now, dt, elapsed) {                   // playback advances the year loop + drift breath; struct breathes
      if (ctx.playback.tick(now, elapsed)) paintCaption();
      ctx.struct.tick(now, elapsed);
    },

    exit() { if (onKey) { window.removeEventListener('keydown', onKey); onKey = null; } },
    dispose() {},
  };
}
