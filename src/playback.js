// Playback — the shared year/month idle-loop driver on the DATA field. See standalone-shell.md §3.
//
// Extracted from wcExplore.js's tick `playing` branch (L1645–1657): advance a data-field morph across a
// layout sequence (index i → i+1), hold between crossings, loop. Bound to `field`; the murder map is its M1
// consumer. play()/pause()/seedPair mirror the explorer's year-scrub grammar. It owns the field's per-frame
// setT + drift breath while a playback-driven view is active (single-writer — only the active view ticks it).
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // parity: wcExplore L164

export function createPlayback(field, { crossMs = 2200, holdMs = 450 } = {}) {
  let seq = null, yi = 0, t = 0, playing = false;
  let morphStart = -1, holdUntil = 0;

  // The ONE door for the scrub pair: seed field at seq[i] → seq[i+1], at rest (t=0). Loops the index.
  function seedPair(layouts, i) {
    seq = layouts;
    yi = ((i % layouts.length) + layouts.length) % layouts.length;
    const next = (yi + 1) % layouts.length;
    field.setSource(layouts[yi]); field.setTarget(layouts[next]); field.setT(0);
    t = 0; morphStart = -1;
  }

  return {
    seedPair,
    play(now = performance.now()) { playing = true; holdUntil = now; morphStart = -1; },
    pause() { playing = false; },
    get playing() { return playing; },
    get yi() { return yi; },
    // Per-frame: advance the loop (if playing) + write the field's t + drift breath. Returns TRUE on the
    // frame the index advanced, so the view can repaint its caption. Re-seeds the pair on each crossing.
    tick(now, elapsed) {
      let advanced = false;
      if (playing && seq) {
        if (morphStart < 0 && now >= holdUntil) morphStart = now;
        if (morphStart >= 0) {
          const p = Math.min((now - morphStart) / crossMs, 1);
          t = easeInOut(p);
          if (p >= 1) { morphStart = -1; holdUntil = now + holdMs; seedPair(seq, yi + 1); advanced = true; }
        }
      }
      field.setT(t);
      if (elapsed != null) field.setTime(elapsed);
      return advanced;
    },
    // The settled source layout at the current index (a convenience for a frozen hand-off).
    currentPose() { return seq ? seq[yi] : null; },
  };
}
