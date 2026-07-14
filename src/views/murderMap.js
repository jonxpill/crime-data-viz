// murderMap — the standalone Toll page's IDLE view: the Western Cape murder map at rest, from which K
// gathers into the ceremony. See docs/plans/standalone-shell.md §3.
//
// S2 (now): STATIC resting map — proves the stage + pipeline + data bundle render the field identically to
// the explorer. S4 adds the ctx.playback year-loop; S5 wires K → the Toll view (and the frozen return).
export function createMurderMapView(ctx) {
  return {
    meta: { key: 'murderMap', label: 'Western Cape · murder', chipText: '' },

    enter() {
      ctx.frameTo(ctx.data.box);                 // camera framed ONCE to the province box, static
      const rest = ctx.data.restingPose();
      // Single-writer: this view owns the pools while active. Seed both at rest, t=1.
      ctx.field.setSource(rest); ctx.field.setTarget(rest); ctx.field.setT(1);
      ctx.structField.setSource(ctx.data.outline); ctx.structField.setTarget(ctx.data.outline); ctx.structField.setT(1);
      const yl = ctx.data.yearLabels[ctx.data.years.length - 1];
      ctx.hud.setCaption({ region: 'Western Cape', lens: 'murder', time: yl, count: '' });
      ctx.hud.setHint('press K for the toll');
      ctx.hud.setCitation('◆ SAPS crime records · DataFirst + saps.gov.za');
    },

    update(now, dt, elapsed) {                   // static pose; drift/shimmer still breathe via setTime
      ctx.field.setTime(elapsed);
      ctx.structField.setTime(elapsed);
    },

    exit() {},        // nothing perturbed yet (S5 owns the toll's neutralise-on-exit)
    dispose() {},
  };
}
