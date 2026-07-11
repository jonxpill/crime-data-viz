# Plan — The Loom Bridges  ·  branch `feat/loom`

> The maker's two instruments meet. Two independent toggles:
> **S — District Chorale**: six districts as six scale-constrained voices; the year scrub (and the
> monthly pulse) becomes a slow chord progression — the Western Cape's history, heard.
> **G — Voice Scrub**: the mic listens (locally, nothing recorded or sent); your hum's pitch scrubs
> the years — sing a rising scale and watch two decades reform under your voice.
> Self-contained: read this + referenced files; don't assume chat context.

## Context (read first)
- `src/wcExplore.js` — year state (`yi`, `setYearPair`), pulse (`pulseMode`, `mi`), districts:
  `DETAIL_REGIONS`/`REGION_META`, per-district totals derivable from `stationsByRegion` (crimes per
  station per year) or provider totals. HUD/hint/chip/keydown grammar. The `setDataPair` door: sound
  code READS state only — it must never write field buffers.
- Data: baked stations carry `crimes[type][year]`, `pop`, `dc`, `monthly[type][m]`.

## Decisions (made — veto in review)
- **WebAudio only, built on user gesture** (first S/G press or chip tap creates the AudioContext —
  required by autoplay policy anyway). Master gain modest (−18 dBFS ceiling), gentle 80ms attack /
  400ms release per voice so chords breathe rather than beep.
- **Chorale mapping (declared, aesthetic)**: per district, per-capita rate of the CURRENT crime,
  normalized ONCE across the 18 years (never per-frame), quantized to a fixed minor-pentatonic table
  spanning 2 octaves (C3 root). Pitch encodes rate level; the scale-snap is stated in the hint
  ('musical mapping: pitch ∝ per-100k, scale-snapped'). Six voices = six districts, timbre one soft
  triangle + lowpass each, stereo pan by each district's map x. Voices glide (~250ms) on year change;
  in the pulse, they re-voice per month (the December swell becomes a heard crescendo).
- **Voice Scrub mapping**: autocorrelation pitch detection (plain ACF over a 2048 sample window,
  50–500 Hz band, confidence gate) — implement clean and small, commented as the same technique as
  the maker's iPad instrument. Log-frequency maps the singer's own range (auto-calibrated: first 2s
  of voiced input sets lo/hi) onto years 0..17; a confident hold >150ms scrubs to that year (playing
  pauses). Silence releases control back to normal. Mic stream is local-only: NOTHING recorded,
  NOTHING transmitted — say so in the hint the moment G activates.
- Both features are pure OBSERVERS of app state (they read yi/mi/crimeType/region; Voice Scrub's only
  write is calling the existing `setYearPair`/`stepYear` path). No field-buffer writes, no engine
  changes, no new pools.
- Keys **S** (chorale) + **G** (voice) + chips `S sound` / `G sing`. Both no-op inside the pies and
  the reading-style ceremonies of other branches (guard by the flags that exist on THIS branch: pie/
  tri modes; keep guards minimal and additive).
- File layout: put the audio code in its OWN module `src/sound/loomBridge.js` exporting
  `createChorale(deps)` / `createVoiceScrub(deps)` with tiny dependency objects (getters for state +
  setYearPair) — keeps wcExplore's footprint to wiring lines and makes the merge surface small.

## Build steps
1. `src/sound/loomBridge.js`: scale table, voice pool, chorale update fn (called from the tick when
   audible + on year/month/crime/mode changes), ACF pitch detector + calibration + year mapping.
2. Precompute per-district per-year (and per-month, for pulse) per-capita values once per
   (crime, mode) — a tiny cached table read from the baked stations; normalize across the full window.
3. wcExplore wiring: keys/chips/hints, tick hook (`chorale.update(...)` — cheap, only when on),
   teardown on toggle-off (voices release, context suspends), pulse integration.
4. Debug hooks for verification: `__viz.chorale()` returns the CURRENT six frequencies + the mapping
   table; `__viz.sing(freqHz)` injects a fake pitch (bypasses the mic) so the scrub is testable
   headless.
## Verification
- Node: the mapping table to the digit — district per-capita values → expected scale degrees →
  expected Hz for 3 spot years × 2 crimes (recompute from public/data/westerncape.json independently).
- Browser: S toggles without console errors; `__viz.chorale()` frequencies change on year-step and
  match the node table; `__viz.sing()` scrubs years with the mic never opened; G requests mic
  permission ONLY when pressed (verify no getUserMedia call before). Audio AUDIBILITY itself is a
  maker's-eye (ear) item — bank the debug-hook numbers instead.
- Privacy check: grep the branch — no MediaRecorder, no network sends of audio, stream tracks stopped
  on toggle-off.

## Effort: weekend. Merge notes: new module + wiring lines; no engine/pool/bake changes; trivially
mergeable. The Lament Engine (reading's sound) is explicitly OUT of scope — a post-merge idea.
