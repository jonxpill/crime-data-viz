// THE NAVIGATION DOOR's plan — pure (no DOM, no engine), so the table the explorer runs is testable in node.
//
// goTo(scene) in src/wcExplore.js asks navPlan(state, target) for ONE next step, performs it, and asks again on
// a later frame (after any heavy transition it started has settled). Every scene is reachable from everywhere:
// the plan UNWINDS whatever is active, in a fixed order (the heavy ceremonies first — each has its own exit and
// its own clock — then the region, then the conserved-swarm morph), and finally ENTERS the target.
//
// Scenes: map · pie · compare · terrain · canyon · forensics · toll · suburb · release.
// Lenses that ride a map (not scenes): pulse (the months), focus (= the suburb scene), unlit.
//
// Steps (the explorer maps each to its existing function):
//   landFlock · exitToll · exitCanyon · flatTerrain         — heavy exits (the door waits for them to settle)
//   drill:<region>                                           — another place (the toll + the flock need the province)
//   morph:<map|pie|compare|forensics>                        — the conserved swarm, retargeted from the live pose
//   exitFocus · openLocate · enterPulse · exitPulse · enterUnlit — the suburb, months + unlit lenses
//   enterTerrain · enterCanyon · enterToll · enterFlock      — heavy entries
//   wait (a morph must land first) · impossible (no DEM here) · done
export const SCENES = ['map', 'pie', 'compare', 'terrain', 'canyon', 'forensics', 'toll', 'suburb', 'release'];
const PROVINCE_ONLY = new Set(['toll', 'release']);

/** The scene on screen now. `s` = { flock, toll, canyon, forensics, terrain, compare, pie, focus }. */
export function sceneOf(s) {
  if (s.flock) return 'release';
  if (s.toll) return 'toll';
  if (s.canyon) return 'canyon';
  if (s.forensics) return 'forensics';
  if (s.terrain) return 'terrain';
  if (s.compare) return 'compare';
  if (s.pie) return 'pie';
  if (s.focus) return 'suburb';
  return 'map';
}

/**
 * The next step toward `target`.
 * @param s { flock, toll, canyon, forensics, terrain, compare, pie, focus, pulse, unlit, region, hasDEM, morphing }
 * @param target one of SCENES
 * @param opts { region } = the same scene in ANOTHER place (a district pick, ‹ back out) ·
 *             { pulse: true } / { unlit: true } = arrive on the map with that lens on
 * @returns { step, final } — `final` = the navigation is complete once this step runs.
 */
export function navPlan(s, target, opts = {}) {
  const want = PROVINCE_ONLY.has(target) ? 'wc' : (opts.region || s.region);
  const here = s.region === want, cur = sceneOf(s);
  const lens = !!(opts.pulse || opts.unlit);
  if (cur === target && here) {                                    // arrived — then any lens asked for
    if (opts.unlit && s.pulse) return { step: 'exitPulse', final: false };  // the estimate lives on the yearly map
    if (opts.pulse && !s.pulse) return s.morphing ? { step: 'wait', final: false } : { step: 'enterPulse', final: true };
    if (opts.unlit && !s.unlit) return s.morphing ? { step: 'wait', final: false } : { step: 'enterUnlit', final: true };
    return { step: 'done', final: true };
  }
  // 1. the heavy ceremonies unwind first — each owns its exit and its clock
  if (s.flock) return { step: 'landFlock', final: false };
  if (s.toll) return { step: 'exitToll', final: false };
  if (s.canyon) return { step: 'exitCanyon', final: false };
  if (s.terrain && (target !== 'suburb' || !here)) return { step: 'flatTerrain', final: target === 'map' && here && !lens && !s.focus };
  // 2. the place: a drill flies from the live pose (the view's flags drop; the target re-enters after landing)
  if (!here) return { step: 'drill:' + want, final: false };
  // 3. now on a flat map-family scene (map · pie · compare · forensics · suburb, ± terrain for the suburb)
  switch (target) {
    case 'map':
      if (cur === 'suburb') return { step: 'exitFocus', final: !lens };
      return { step: 'morph:map', final: !lens };
    case 'pie': case 'compare': case 'forensics':
      return { step: 'morph:' + target, final: true };
    case 'terrain':
      if (!s.hasDEM) return { step: 'impossible', final: true };
      if (cur !== 'map' && cur !== 'suburb') return { step: 'morph:map', final: false }; // the relief lifts FROM the map
      if (s.morphing) return { step: 'wait', final: false };
      return { step: 'enterTerrain', final: true };
    case 'suburb':                                               // focus composes with the map (and the relief)
      if (cur !== 'map' && cur !== 'terrain') return { step: 'morph:map', final: false };
      return { step: 'openLocate', final: true };
    case 'canyon': return { step: 'enterCanyon', final: true };
    case 'toll': return { step: 'enterToll', final: true };
    case 'release': return { step: 'enterFlock', final: true };
    default: return { step: 'done', final: true };
  }
}

/** The whole route from a state, simulated (tests + the report's table): applies each step's effect. */
export function navRoute(s0, target, opts = {}, maxSteps = 12) {
  const s = { ...s0 }, steps = [];
  for (let i = 0; i < maxSteps; i++) {
    const { step, final } = navPlan(s, target, opts);
    if (step === 'wait') { s.morphing = false; continue; }           // time passes; the morph lands
    steps.push(step);
    if (step === 'done' || step === 'impossible') break;
    applyStep(s, step);
    if (final) break;
  }
  return steps;
}
function applyStep(s, step) {
  const clearSwarm = () => { s.pie = s.compare = s.forensics = false; };
  switch (step) {
    case 'landFlock': s.flock = false; break;
    case 'exitToll': s.toll = false; break;
    case 'exitCanyon': s.canyon = false; break;
    case 'flatTerrain': s.terrain = false; break;
    case 'exitPulse': s.pulse = false; break;
    case 'enterUnlit': s.unlit = true; break;
    case 'exitFocus': s.focus = false; break;
    case 'enterPulse': s.pulse = true; break;
    case 'openLocate': s.locate = true; break;
    case 'enterTerrain': s.terrain = true; break;
    case 'enterCanyon': clearSwarm(); s.canyon = true; s.focus = false; s.pulse = false; break;
    case 'enterToll': clearSwarm(); s.toll = true; s.focus = false; s.pulse = false; break;
    case 'enterFlock': clearSwarm(); s.flock = true; s.focus = false; s.pulse = false; break;
    default:
      if (step.startsWith('drill:')) { s.region = step.slice(6); s.focus = false; s.pulse = false; s.unlit = false; clearSwarm(); s.terrain = false; }
      else if (step.startsWith('morph:')) {
        const t = step.slice(6);
        clearSwarm(); s.focus = false; if (t !== 'map') s.pulse = false;
        if (t === 'pie') s.pie = true; else if (t === 'compare') s.compare = true; else if (t === 'forensics') s.forensics = true;
        s.morphing = true;
      }
  }
}
