// StructTransition — the generic staggered struct-swarm on ONE structure pool. See standalone-shell.md §3.
//
// Extracted from wcExplore.js: startStructTransition (L435–441) + the per-frame advance (L1661–1668). It
// morphs `structField` between structure layouts (map outline ⇄ dial frame ⇄ pie ring …) with a staggered
// swarm — no fades, conserved. The pool PERSISTS across view swaps; `current` tracks the settled pose so the
// NEXT startTo always sources from exactly what's on screen (this is what keeps the toll's gather seamless).
//
// The engine knows nothing of crime/dials: a view hands it layouts. `tick(now, elapsed)` advances the swarm
// AND breathes the shimmer (elapsed = THREE.Clock seconds) so ALL structField per-frame writes live behind
// one door (single-writer). `rest(layout)` snaps to a resting pose (parity: landRegion L429–432).
const swarmEase = (x) => x; // constant speed — no acceleration pull at either end (parity: wcExplore L165)

export function createStructTransition(structField) {
  let current = null, progress = 1, start = 0, dur = 2400, to = null;

  return {
    // Start a staggered swarm from whatever's shown (`current`) to a new layout.
    startTo(layout, d = 2400, stagger = 0.6) {
      if (!structField || !layout) return;
      structField.setSource(current || layout);
      structField.setTarget(layout);
      structField.setStagger(stagger);
      structField.setT(0);                      // avoid a stale-t frame before the first tick lands
      to = layout; start = performance.now(); dur = d; progress = 0;
    },
    // Per-frame: advance the swarm (if mid-transition) + breathe the structure shimmer.
    tick(now, elapsed) {
      if (!structField) return;
      if (progress < 1) {
        progress = Math.min((now - start) / dur, 1);
        structField.setT(swarmEase(progress));
        if (progress >= 1 && to) current = to;
      }
      if (elapsed != null) structField.setTime(elapsed);
    },
    // Snap to a resting pose (source=target=layout, t=1) — the initial seed + the between-view rest.
    rest(layout) {
      if (!structField) return;
      if (layout) { structField.setSource(layout); structField.setTarget(layout); structField.setT(1); current = layout; }
      else { structField.setT(1); if (to) current = to; }
      progress = 1; to = null;
    },
    get progress() { return progress; },
    get current() { return current; },
  };
}
