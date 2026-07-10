# Brainstorm — new visualization directions (2026-07-10)

> 126 ideas from an eight-lens parallel brainstorm (time-as-form, sound, physical/3D, relations,
> human/narrative, generative organism, exotic statistics, play/interaction). RAISED, NOT AGREED —
> the shortlist the maker reacts to lives in IDEAS-BACKLOG.md. 🌙 = deliberately outlandish.

## SPACE, 3D & PHYSICAL

### Veld Room  `project`
A WebXR mode: you put on a Quest and stand INSIDE the 180,000-point field at human scale — the province is a galaxy around your body, glowing data drifting at chest height, grey terrain points underfoot like a matte floor of gravel. Pinch-drag a hand slider and 18 years of deltas fly past your face as conserved swarms; you turn your head to watch a burglary cluster migrate across the room. The camera-never-moves rule inverts beautifully: now the VIEWER moves and the field holds still.
- **Data:** All baked layouts as-is (6 crimes × 18 years × 150 precincts, DEM terrain points); the engine's GPU morph ports almost directly to a three.js/WebXR render loop.
- **Why:** It's the maker's stated VR ambition (walk-around point sculptures) applied to the finished piece — and the engine's 'every view is a layout function' design means VR is a new camera, not a new app. Standing inside a dataset you built is a qualitatively different relationship to it.
- **Honesty:** Human-scale immersion makes jittered positions feel like real places; keep the precinct-jitter disclosure visible in-headset and never let a dot resolve to a street.

### Hold the Year  `weekend`
Eighteen identical-looking 3D-printed pucks, one per SAPS year, each printed with variable infill so its MASS is exactly proportional to that year's total reported Western Cape crime — one gram per N reports, N engraved on the base. You pick up 2008/09 in your left hand and 2025/26 in your right and FEEL the delta before you read a single number. The set lives in a wooden tray shaped like the province outline.
- **Data:** 6 crimes × 18 years, summed per year; total counts drive infill density in the slicer.
- **Why:** Volume-true weight is the most honest physical encoding possible — it literally conserves the dot count into grams — and nobody makes weight-encoded data objects. It's the 'one dot = one crime' foundation translated to the hand.
- **Honesty:** Engrave the scale (1 g = N reported crimes) and 'reported ≠ happened' on the tray; weight encodes reports, not harm.

### Strata Glass  `project`
Eighteen sheets of glass, each UV-printed with one year's density field of the province (warm bright hotspots, cool dim edges), stacked with 10mm air gaps in a black steel frame, edge-lit by LEDs from below. Face-on you see this year; step to the side and time becomes DEPTH — the Cape Flats hotspot is a glowing column boring back through eighteen years, and the years where it dims read as gaps in the column. It is the year-scrub frozen into a physical block you walk around.
- **Data:** Per-precinct 18-year series rendered as 18 density-field images (same colour ramp as the site), per-capita normalized across the full stack.
- **Why:** 'Time as strata' is the piece's core move (same field, rearranged) made architectural — and layered-glass light sculpture photographs spectacularly, giving the portfolio a physical twin of the website.
- **Honesty:** Normalize the colour ramp across all 18 layers, never per-sheet, or the stack lies about trend.

### Crystal Veld  `project`
A subsurface laser-etched crystal block (the 'bubblegram' technique used for 3D portraits) containing the full space-time cube: province footprint in x/y, the 60 months of Apr 2021–Mar 2026 rising as z, one micro-fracture star per N reported crimes. Lit from beneath on a plinth, the monthly pulse becomes visible geology — you tilt the block and watch murder's summer ridges repeat five times up the column. The website's breathing loop, petrified.
- **Data:** 6 crimes × 60 months × 150 precincts (precinct-jittered x/y, month as z); commercial SSLE services etch hundreds of thousands of points per block.
- **Why:** The one substance rule survives the phase change — it is still just a point field, now in glass — and a crime dataset as a desk-sized crystal is genuinely without precedent.
- **Honesty:** If the etcher's point budget forces downsampling, use a fixed disclosed ratio (one star = N reports) applied uniformly — never thin dense regions more than sparse ones.

### Relief Projection Table  `project`
CNC or 3D-print the Cape Town ~100m DEM as a white 60cm relief model, mount a short-throw projector overhead, and projection-map the live site onto the physical terrain — the glowing swarm crawls over REAL ridges and valleys, the monthly pulse breathing across actual topography you can lean over and almost touch. Hover becomes pointing: a lidar/depth camera or simple touch frame lets a fingertip name the precinct it lands on.
- **Data:** Cape Town 100m DEM for the physical form; all crime layouts projected, with the site's terrain-relief view re-used as the UV-mapping (the engine already computes crime-on-landform positions).
- **Why:** The site already makes crime ride the landform in pixels; giving the landform true physical relief closes the loop — shadows and parallax do work no screen can. It's the definitive gallery/installation version of the piece.

### Fibre Veld  `project`
150 fibre-optic stems rise from a matte-black province-shaped baseboard, one per police precinct at its true station coordinate; each stem's height is the per-capita rate and its tip glows with the site's density colour, fed by an LED matrix beneath. A knob on the plinth scrubs 18 years and the meadow of light re-colours in a slow stagger — the conserved-swarm morph as a field of grass you can brush with your palm. Grey, unlit acrylic rods mark the terrain: structure that never glows.
- **Data:** Station coordinates, precinct per-capita series (6 crimes × 18 years), district membership for the baseboard engraving.
- **Why:** It translates the entire visual language — glow = data, matte grey = structure, density = light — into physical materials without losing a single rule. A touchable version of the north star.
- **Honesty:** Heights and colours normalized once across all precincts × years; a station's stem never rescales to flatter the current view.

### Desk Pulse  `weekend`
The 60-month breathing loop rendered as a true volumetric hologram on a Looking Glass display: the province terrain floats an inch deep in the glass, the swarm pulsing over it, viewable from 45 degrees of parallax with no headset. It sits on a shelf like a lava lamp made of evidence. The engine's three-value output (x, y, height) is exactly what a Looking Glass quilt render wants.
- **Data:** 60-month series × 6 crimes, province DEM terrain points; existing pulse view re-rendered as a multi-view quilt.
- **Why:** Cheapest possible route to 'the field as an object in a room' — a weekend port, since Looking Glass takes three.js scenes almost directly — and it makes the piece a permanent ambient presence instead of a tab you open.

### Ghost Plinth  `weekend`
A Pepper's-ghost pyramid (four-sided acrylic prism) over a face-up tablet running a four-way mirrored render of the swarm: the crime field floats as a ghost in mid-air inside the glass, visible from every side of the plinth. Black room, one plinth, one slowly breathing apparition of 180,000 reports. Total build cost: one sheet of acrylic and an old iPad.
- **Data:** Any existing view, re-rendered four-up with radial symmetry; the monthly pulse loop is the natural resident.
- **Why:** Maximum apparition-per-rand — the additive-glow-on-black aesthetic is exactly what Pepper's ghost was invented for, so the site's look survives the illusion untouched.

### Anaglyph Toggle  `trivial`
A red/cyan stereo mode on the existing site: render the terrain-relief views from two eye offsets, composite as anaglyph, ship with a note saying 'find the cardboard glasses in your drawer.' The crime field suddenly has genuine depth on any screen — hotspot columns stand off the landform, the Cape Fold mountains recede.
- **Data:** Everything already on screen; it's two render passes and a compositing shader.
- **Why:** The single cheapest way to make the 3D terrain views actually three-dimensional — an afternoon of shader work for a party trick that never stops working.

### Corridor of Years  `project`
In VR, the 18 years are hung as translucent point-field 'curtains' every three metres down a dark hallway; you WALK through time, each curtain washing over you as you pass, the swarm morphing to the next year exactly as you break its plane. Walk backwards and time rewinds at your own pace. At the far end, the 2025/26 field hangs beside a mirror-curtain of 2008/09 so you finish by seeing both ends of the walk at once.
- **Data:** 18 annual layouts, 6 crime togggles on the wrist; district drill as side-doors off the corridor.
- **Why:** It replaces the scrub slider with locomotion — time becomes distance your legs measure — which is a reading of longitudinal data that literally cannot exist on a screen.

### Signal Hill Lens  `project`
An AR mode for phones: stand at a named viewpoint (Signal Hill, Rhodes Memorial, Bloubergstrand), aim the phone at the real city, and the glowing field overlays the actual landscape, aligned by GPS + compass + the DEM as a registration surface. The Cape Flats glow sits over the real Cape Flats haze at dusk; scrub a thumb and eighteen years pass over the living city. The mountain itself renders as grey structure points fused onto its own silhouette.
- **Data:** Cape Town 100m DEM for registration, precinct polygons + jittered crime layouts, per-capita default.
- **Why:** The data returns to the terrain it describes — no map abstraction at all, the actual horizon is the base layer. Nobody has AR-overlaid longitudinal crime onto its own landscape.
- **Honesty:** Per-capita by default and viewpoint-scale only — lock zoom so glow can never resolve to a visible street or building; jitter and 'reported ≠ happened' persist in the AR HUD.

### Phosphor Mountain  `project`
CNC-mill the province DEM into a slab of blackened oak, then rout each precinct's footprint a few millimetres deep and fill it with clear resin loaded with glow-in-the-dark phosphor at a density proportional to its 18-year per-capita rate. By day it is a handsome matte terrain model; charge it under a lamp, kill the lights, and the crime field GLOWS OUT OF THE WOOD and slowly fades — the data literally an afterglow in the structure. The fade itself becomes a meditation on how attention to these numbers decays.
- **Data:** Province 250m DEM for the milling toolpath, precinct polygons for the pockets, per-capita 18-year means for phosphor loading.
- **Why:** Glow-equals-data enforced by chemistry rather than a shader — the visual language survives with the power off. A one-of-one object worthy of the piece's name.
- **Honesty:** Phosphor density is mixed once, normalized across all 150 precincts on per-capita rates; note on the frame that brightness is per-capita, not raw counts.

### 🌙 Dome Pulse  `moonshot`
A fulldome cut of the piece for the Iziko Planetarium — which is IN Cape Town, twenty minutes from the precincts on screen. The audience lies back and the crime field is the night sky: districts as constellations overhead, the 60-month pulse as the whole heavens breathing, the year-scrub as eighteen years of precession. The final move: the dome's sky morphs down into the province's terrain and the audience realises the stars were their own city all along.
- **Data:** Everything — annual + monthly series, all districts, DEMs; the engine's layout functions re-targeted to dome (fisheye) projection, which is one more camera matrix.
- **Why:** The starfield metaphor the piece is built on gets shown as an actual sky, in the city the data describes, to an audience lying under it together. Fulldome data-art screenings exist; hyper-local crime as constellations does not.
- **Honesty:** A civic audience raises the stakes: per-capita framing mandatory, precinct jitter disclosed in the narration, and no constellation may be named in a way that brands a community.

### 🌙 Mountain Cast  `moonshot`
One night, project the field onto Table Mountain itself — high-lumen projectors from the Signal Hill side painting the 60-month pulse across the face of the mountain, the 16m DEM used to pre-distort the imagery so it sits true on the real rock. The mountain becomes the grey structure it already is in the piece; the data breathes across it at the scale of the city that generated it. Cape Town has precedent (the mountain has been lit for Mandela Day and light-art events).
- **Data:** Table Mountain 16m DEM for projection pre-warp; province monthly pulse as the content; abstract field only, no place labels.
- **Why:** The piece's deepest rule — data glows, structure is grey and mute — performed by an actual mountain. It is the largest possible faithful rendering of the work.
- **Honesty:** Project only onto the mountain (structure), never onto neighbourhoods — no geographic layout that lets a viewer read 'that glow is that suburb.' Use the abstract pulse/aggregate layouts; anything else paints communities onto a billboard.

### 🌙 Drone Veld  `moonshot`
A drone light show over Table Bay where the engine's layout functions drive the choreography directly: 1,000 drones, each representing N reported crimes (N announced on-site), holding the province layout, then executing the staggered conserved-swarm morph into the district split, the pie, the 18-year trend — the actual website playing out in 200m of night sky. The engine already outputs exactly what a swarm show needs: per-point source, target, delay.
- **Data:** Annual layouts downsampled to the drone count at a fixed disclosed ratio; the morph scheduler exported as flight paths.
- **Why:** The engine stops being a metaphor for a swarm and becomes one — 'points that can become any arrangement' flown by literal aircraft. No data-art piece has ever exported its own render loop to a drone fleet.
- **Honesty:** One drone = N reported crimes, N stated before the show; drone counts conserved across every formation exactly as dots are on the site; no formation implies street-level location.

### 🌙 One Lantern Scale  `project`
A VR piece about scale collapse: you begin god-sized above the glowing province, then continuously shrink — district, precinct, cluster — until a single dot hangs in front of you the size of a paper lantern, and the other 179,999 recede into a universe of stars overhead. Reach out and hold it: it says only 'one robbery, reported in Nyanga precinct, 2019/20' — everything the data honestly knows, and nothing more. Then you let it go and grow back, watching it vanish into the aggregate.
- **Data:** One year's full point pool with per-point precinct/crime/year attribution (already baked); continuous world-scale transform on the existing field.
- **Why:** It weaponises the one-dot-one-crime foundation emotionally: the piece's whole tension between 180,000 and 1 becomes a journey your body takes. The honesty constraint — the dot can only say three things — IS the artwork.
- **Honesty:** At lantern scale the temptation is narrative detail the data doesn't contain; the dot must display exactly its real attributes (crime, precinct, year) and explicitly nothing else — the silence is the honest part.

### Precinct Stalagmites  `project`
3D-print the space-time cube as a forest: on a printed province base, each of the 150 precincts grows a translucent resin stalagmite whose profile is its 60-month series — radius at each height = that month's count, so seasonal crime prints as visible ribs, like growth rings stretched vertical. Cape Town's CBD is a thick ribbed column; a Karoo precinct is a needle. You read five years of seasonality by running a thumbnail up a spire.
- **Data:** 6 crimes × 60 months × 150 precincts (choose one crime per forest — murder and burglary make radically different forests), station coords for placement, province DEM for the base.
- **Why:** Monthly seasonality as physical ribbing is a tactile reading no screen offers, and printing one forest per crime type turns the crime-toggle into a shelf of comparable objects.
- **Honesty:** Radius scale normalized across all precincts within a forest, and across forests if they sit on the same shelf — a shared engraved scale bar keeps cross-object comparison honest.

## TIME AS FORM

### The Seasonal Coil  `weekend`
The 60 monthly layouts wind into a glowing helix: one full turn = twelve months, five turns tall, every dot parked at its month's angle and its year's height. Decembers stack directly above Decembers, so seasonality stops being a rhythm you wait for and becomes a RIDGE you can see running vertically up the coil — the festive-season murder bulge is literally a bright spine on one side of the spring. Camera stays put; the field simply winds itself up from the map into the coil, and hovering a rung names the month.
- **Data:** 6 crimes × 60 months (Apr 2021–Mar 2026), per precinct; per-capita toggle intact.
- **Why:** It converts the existing pulse loop's invisible periodicity into standing geometry — five years of season superimposed become one readable 3D object, and the engine already does height.
- **Honesty:** Angle must be true calendar month (SAPS fiscal year starts April — label the wheel by calendar month, not fiscal index) and dot count per rung stays exactly the reported monthly count.

### Precinct Tree Rings  `project`
Each precinct becomes a trunk cross-section: 18 concentric rings, oldest year at the core, this year at the bark, each ring's dot-density the year's per-capita rate. The province morphs from map into a felled forest of 150 slices laid out in district groves — you read a precinct's whole history at a glance the way a forester reads drought years, and the 2020/21 COVID year is a visibly starved thin ring in almost every trunk. Hover a ring, it names precinct + year.
- **Data:** 6 crimes × 18 years × 150 precincts; WorldPop for per-capita; district membership for the grove layout.
- **Why:** Growth rings are the oldest time-as-form encoding on earth, but nobody has cut crime data like timber — and 150 simultaneous ring-histories is exactly the kind of small-multiples-of-one-substance the conserved swarm makes cheap.
- **Honesty:** Encode rate as ring dot-density (area-true), never ring radius alone — outer rings have more circumference, so equal density must mean equal rate. Normalize one scale across all 150 slices. Per-capita uses static 2020 population across 18 years; say so.

### The Lockdown Canyon  `project`
Time itself becomes the landform: a synthetic DEM where east–west is the 18 years, north–south is the 150 precincts in geographic order, and elevation is per-capita rate — then the engine renders it exactly like it renders Table Mountain, crime as a glowing mountain range you drift over. The 2020/21 hard-lockdown year cuts a single dark canyon across the ENTIRE range at once, every precinct's cliff dropping into the same valley — one geological scar shared by a whole province. Scrubbing crimes swaps mountain ranges: burglary's range is eroding, sexual offences' is not.
- **Data:** 6 crimes × 18 years × 150 precincts, per-capita; reuses the existing terrain-relief renderer with a data-built heightfield instead of a real DEM.
- **Why:** The project already proved crime-rides-the-landform; this inverts it — crime IS the landform — and the lockdown canyon is a genuinely arresting single image the annual data has been hiding.
- **Honesty:** This terrain is data, so it must GLOW (a grey wireframe graticule beneath stays the only structure); height normalized once across the full range per crime, never per-frame; per-capita mandatory or the range just maps population.

### The Strata Hourglass  `weekend`
Play the 18-year scrub and every dot falls exactly once, in its own year, from a dim holding cloud above into a growing sediment pile below — 18 years accreting as readable layers, each stratum's thickness that year's true volume, its colour the density ramp. When the pour finishes you HOLD a core sample of two decades: six hourglasses side by side, one per crime, and you can see commercial crime's strata thickening while carjacking's thin. Scrub backwards and the sand un-falls.
- **Data:** 6 crimes × 18 years, province and per-district; volume-true counts.
- **Why:** Accumulation is the one temporal reading the current scrub can't give (it always shows a year, never the total weight of years) — and falling-sand conserved motion is exactly this engine's native grammar.
- **Honesty:** Every dot falls once and remains — nothing deleted, nothing painted calm. Strata compared across crimes share one vertical scale.

### Comet Scrub  `weekend`
During any year-to-year morph, each flying dot leaves a fading afterimage — so a precinct whose crime grew drags a visible comet tail pointing back at its smaller past, while stable precincts stay crisp and tail-less. Scrub fast through all 18 years and the field becomes a wind-tunnel photograph of two decades of change: streaks where history moved, stillness where it didn't. Release the scrub and the tails exhale away over a second.
- **Data:** Any existing layout pair; 18-year annual morphs are the natural home.
- **Why:** It makes the DELTA — the thing this engine uniquely animates — persist long enough to read, turning motion (which the eye loses) into form (which it keeps). Nearly free: an additive accumulation buffer over the renderer that exists.
- **Honesty:** Tails are pure motion-history of the honest morph (no synthetic elongation); decay time is fixed and disclosed, and tails never render during pauses where they could read as extra volume.

### Ember Field  `weekend`
Recency becomes temperature: as the 60 months play, each dot is born white-hot at its report month, cools through orange and deep red over the following months, and settles as dark ash that never leaves the field. Pause anywhere and you see two truths at once — the glowing embers of the last quarter sitting on top of the accumulated ash of five years. A precinct that flared and went quiet reads exactly like a dying fire; one that burns steadily never stops shimmering.
- **Data:** 6 crimes × 60 months per precinct, on the existing map + terrain layout.
- **Why:** The monthly pulse currently shows each month then forgets it; decay-as-colour holds the near-past and the deep-past in a single frame — the most emotionally legible time encoding fire gave us.
- **Honesty:** Ash stays visible forever (nothing cools to invisible — that would paint places safe); cooling curve is one fixed disclosed constant across all precincts and crimes.

### Season Rosettes  `weekend`
Phase-fold the five years onto one 12-month wheel per crime: every dot flies to its calendar-month angle, radius set by per-capita rate, and the five superimposed years form a lopsided rosette — a flower whose petals bulge where that crime's season lives. Robbery blooms toward December; burglary's petal leans into winter. Six rosettes in a row become a field guide to the province's criminal seasons, and because each year's dots sit slightly apart you see the SPREAD, not a smoothed average.
- **Data:** 6 crimes × 60 months, phase-folded by calendar month; per-capita toggle.
- **Why:** The pulse loop shows seasonality as rhythm you must watch for a minute; the rosette shows it as a static asymmetric shape you grasp in one second — and superimposing years honestly (dots, not means) is something only a point-field can do.
- **Honesty:** Never average the five years into one petal — plot all five years' dots so a one-off spike can't masquerade as a season. Fold by true calendar month, not SAPS fiscal index.

### Winter–Summer Butterfly  `weekend`
Every dot in the 60-month pool splits by hemisphere-honest season — summer half (Oct–Mar) flies to the right wing, winter half (Apr–Sep) to the left — and the field settles into a bilateral butterfly whose wing asymmetry IS the seasonality. For assault the right wing is visibly heavier; for residential burglary the left. Toggle through six crimes and watch the butterfly lean left, lean right, or sit eerily symmetric (the crimes with no season at all are their own quiet finding).
- **Data:** 6 crimes × 60 months, split into two 30-month season pools; extendable to the 31 unparsed categories for a full butterfly collection.
- **Why:** It reduces an entire temporal question — 'does this crime have a season?' — to a single instantly-judgeable symmetry, the kind of gestalt read a spreadsheet can never give.
- **Honesty:** Define the season split once (Oct–Mar / Apr–Sep, southern hemisphere) and label it; both wings share one scale so symmetry is a real statement.

### Ghost Province  `trivial`
A double exposure of eighteen years: 2008/09 renders as a cold, dim blue ghost-field beneath the warm living field of 2025/26, both in the same map layout. Where nothing changed, ghost and present sit superimposed and quiet; where crime grew, warm dots crowd above a sparse ghost; where it fell, the blue underlayer shows through like an old photograph. One keypress and the ghosts fly forward into their present positions — eighteen years of change as a single migration.
- **Data:** 6 crimes, years 2008/09 and 2025/26 (or any picked pair), per precinct; per-capita toggle.
- **Why:** Then-vs-now is the question every visitor silently asks the scrub to answer, and the scrub makes them hold year 1 in memory; the double exposure holds it on screen. Cheapest idea on this list for what it pays.
- **Honesty:** Per-capita across an 18-year gap uses static WorldPop 2020 for both endpoints — populations genuinely changed, so caption this as rate-per-2020-population, not a perfect rate.

### Six-Armed Galaxy  `weekend`
The whole 18-year record unwinds into one flat Archimedean spiral: angle and radius are time (three slow turns from 2008 at the core to 2026 at the rim), and each of the six crimes is its own spiral arm, dots dense where years were heavy. The province's criminal history becomes a rotating six-armed galaxy — and the COVID year appears as a dark gap crossing all six arms at the same angle, like a shockwave that hit the whole galaxy at once. Tap an arm to peel it out straight into a timeline.
- **Data:** 6 crimes × 18 years, provincial totals (district drill = six smaller galaxies).
- **Why:** It gives the annual data a single iconic poster-image — the piece's 'galaxy shot' — while staying volume-true, and the shared-angle COVID gap is a cross-crime synchrony no side-by-side chart shows this viscerally.
- **Honesty:** Outer spiral turns have more arc length per year — keep dot density area-true (density per arc-length encodes count) so late years don't look artificially sparse.

### Season Flowers on Terrain  `project`
Every one of the 150 stations grows its own tiny Season Rosette in place, on the grey landform, at its true coordinates — the province becomes a night meadow of 150 glowing seasonal flowers, each one's petal shape the LOCAL seasonality of the selected crime. Coastal holiday precincts bloom hard toward December; farming-belt precincts barely change shape. Geography and season, the two axes the project already loves, finally visible in one frame.
- **Data:** 6 crimes × 60 months × 150 precincts; station coords; DEM terrain; per-capita.
- **Why:** Seasonality is currently only visible province-wide (the pulse); this shows that season itself has a GEOGRAPHY — a question none of the existing views can even ask.
- **Honesty:** All 150 rosettes share one radial scale (normalized across the comparison set, never per-flower) or big precincts' shapes lie; sparse precincts show few dots rather than inflated petals.

### Volatility Pendulums  `weekend`
Each precinct's swarm swings continuously between its best-year and worst-year configurations, and the swing FREQUENCY is set by that precinct's 18-year volatility: statistically stormy precincts thrash like weather, stable ones sway like kelp. Stand back and the map becomes a field of metronomes all keeping different time — your eye finds the erratic places instantly, because motion-detection is the one thing human vision does for free. Hover stills a pendulum and shows its actual 18-year trace.
- **Data:** 6 crimes × 18 years × 150 precincts; min/max year layouts per precinct; variance computed once at bake time.
- **Why:** Every current view encodes level; none encodes STABILITY — and unpredictability is arguably what living near crime actually feels like. Time becomes kinetic temperament rather than an axis.
- **Honesty:** Motion frequency = historical variance, stated plainly in the legend — the swinging must never read as live incidents happening; amplitude spans the precinct's real min–max, not a dramatized range.

### 🌙 VR Time Tunnel  `moonshot`
The 60 months become a tunnel you physically walk down in a headset: the province's map is wrapped into a cylinder, each of the 60 rings one month, dots glowing at their precinct's angular position on the tunnel wall. One step forward is one month forward; the festive-season months are visibly brighter hoops you pass through like stations of light, and when you turn around, five years of past recede behind you in fading rings. At the far end the tunnel opens onto the present-day map lying under you as terrain.
- **Data:** 6 crimes × 60 months × 150 precincts; station coords for angular placement; extendable to 18 years / 216 fiscal-month interpolation for a longer walk.
- **Why:** It fuses the maker's stated VR walk-around-sculpture ambition with the one encoding VR does better than any screen: time as literal traversable distance through your own body.
- **Honesty:** Ring brightness normalized once across all 60 rings; tunnel wall position is precinct-level (jittered as always) — the immersion must not imply street-level knowledge.

### 🌙 The Crime Score  `moonshot`
The 18 years render as a player-piano roll — x is time, each district a stave, per-capita rate mapped to pitch — and the swarm plays it: dots light as the playhead crosses them while scale-constrained voices (the maker's own Loom pitch-engine, ported) sound each district's line. You HEAR the province: eighteen years compressed to a three-minute piece where the COVID year is an audible hush across every voice and the long rise of commercial crime is a line that keeps modulating upward. The score is deterministic — same data, same music, every play.
- **Data:** 6 crimes × 18 years × 6 districts (60-month version = a faster, five-year étude); maker's existing Loom scale-quantization approach.
- **Why:** Sonification usually fails because it's arbitrary; here the maker already owns a musical instrument system, so the mapping inherits real musicianship — and time-as-score is the oldest time-as-form humans have.
- **Honesty:** Note ONSETS and density are data-driven and volume-true; the scale constraint is declared as aesthetic (pitch class is presentation, rate-order is the honest signal — higher rate must always sound higher/denser). Minor keys must not be used to editorialize.

### 🌙 Pulse Zoetrope Sculpture  `moonshot`
The 12 phase-folded months of the monthly pulse become the 12 sectors of a physical 3D-printed zoetrope disc — each sector a relief of that month's dot-field standing as tiny pillars on the province outline. Spin it under a phone strobe and the crime field ANIMATES in your hands: a year of the Western Cape breathing, as a solid object on a desk. The one view of this project you can HOLD, and hand to someone.
- **Data:** 6 crimes × 60 months phase-folded to 12 month-frames; precinct polygons for the base plate; the '3D Objects/' work already in the repo suggests the print pipeline is half-born.
- **Why:** Every idea in this project lives behind glass; a zoetrope makes the signature pulse loop tactile and strobe-animated with zero electronics — data-art that survives a power cut and a gallery shelf.
- **Honesty:** A print can't hold 180k pillars — dots per sector are the true monthly counts divided by ONE stated factor (e.g., 1 pillar = 50 reports), same factor for all 12 sectors, engraved on the rim.

### Two-Crime Braid  `weekend`
Pick any two crimes and their 60 monthly swarms become the two strands of a slowly rotating double helix: months are height, and at each rung the strands' separation is set by how far apart the two crimes' per-capita rates sit that month. Where they move together the braid pulls tight into a rope; where one spikes alone it bulges open like a snake that swallowed something. Burglary–robbery braids tight; murder–commercial-crime barely touch.
- **Data:** Any 2 of the 6 crimes × 60 months (31 more categories one parse away make this a combinatorial playground — DUI vs assault GBH is the braid people will argue about).
- **Why:** Correlation-over-time is normally a scatterplot and a regression line; as a braid it becomes an object whose tightness you judge by eye, month by month, without a single statistic on screen.
- **Honesty:** Strand separation encodes rate difference on one fixed scale per pair (normalized across the 60 months, never per-frame); braid tightness is descriptive co-movement, and the caption must say correlation ≠ causation.

## SOUND & MUSIC

### Geiger Field  `trivial`
Pick a precinct and a year; its reported crimes play back as a Geiger-counter stream compressed into sixty seconds. Nyanga's robbery year crackles like rain on a tin roof; a Karoo precinct ticks once every few seconds into silence. Your cursor is the probe — sweep it across the map and the crackle density changes under your hand. Nothing is smoothed, nothing is scored: one dot = one reported crime = one click.
- **Data:** Precinct × crime × year counts (150 precincts, 6 crimes, 18 years); monthly counts for finer rhythm; station coords for pan position.
- **Why:** It is the project's core honesty rule translated 1:1 into audio with zero mapping choices to argue about — the most incorruptible sonification possible, and instantly visceral (everyone knows what a hot Geiger counter means).
- **Honesty:** Click timing within the year/month is Poisson-randomized exactly as spatial position is jittered — state this on screen. Counts are exact, never thinned or faked.

### Pulse Drumline  `trivial`
The existing 60-month breathing loop gets a six-piece kit: murder is the kick drum, sexual offences a rimshot, robbery the snare, burglary a floor tom, commercial crime a woodblock, carjacking the hi-hat. Each month-tick fires all six at velocities set by that month's counts, so the loop becomes a five-year groove — you hear all five Decembers swell (festive-season spike) and the pattern's shape burn into memory the way loops do.
- **Data:** 6 crimes × 60 months (Apr 2021–Mar 2026), province or per-district totals.
- **Why:** The pulse view already breathes visually; giving it a rhythm section makes seasonality legible in a way eyes miss — rhythm memory is stronger than shape memory, and the loop format is literally made for it.
- **Honesty:** Velocity normalized once per crime across all 60 months, never per-frame; drum assignments are timbre only, no doom-scoring (murder is the kick because it's lowest-frequency-count, not for menace).

### District Chorale  `weekend`
Six districts, six voices. Each district's per-capita rate picks a scale degree from one of Loom's scale-constrained voices, so scrubbing the 18 years plays an 18-chord progression — the Western Cape's history as a slow chorale. City of Cape Town is the tenor line that never resolves; the Central Karoo hums a near-pedal tone underneath. The year slider becomes a conductor's baton.
- **Data:** 6 districts × 6 crimes × 18 years, per-capita via WorldPop; reuses the maker's existing scale-quantization logic from Loom.
- **Why:** It's the shortest possible bridge to the maker's own instrument-building: the scale-constraint front door he already built guarantees the data can never sing a wrong note — 'constrain at the boundary, be free inside it' as music.
- **Honesty:** Pitch from per-capita (raw counts would just make poor areas shriek); one normalization across all six districts and all 18 years; scale stays modally neutral — no minor-key editorializing.

### Morph Glissando  `weekend`
Sonify the signature move itself. When the field reforms, every flying dot contributes one grain to a granular cloud: pan follows its screen-x, pitch glides from source-layout density to target density, and the existing per-dot stagger makes the sound sweep across the stereo field like a flock passing overhead. Because only deltas fly, only change sounds — a view switch where little changed is nearly silent, and that silence is information.
- **Data:** The engine's own transition state (source/target positions + densities); no new data — it sonifies the morph.
- **Why:** 'Conserved motion' becomes 'conserved sound' — the audio channel inherits the engine's deepest aesthetic rule for free, and every existing view instantly gains an audible identity without a single new layout.
- **Honesty:** Sample ~2,000 of the moving dots as grains (declared as a rendering budget, like bloom) — the sound describes the transition, it makes no new data claims.

### Terrain Rain  `weekend`
With 3D relief up, let a year's dots fall onto the landform; each landing strikes a marimba-like ping whose pitch is the DEM elevation at the impact point. Table Mountain rings high and sparse; the Cape Flats roar low and dense. Within a minute you HEAR the thing the terrain view shows: crime pools on the flats, not the mountain — geography as the instrument's body.
- **Data:** DEMs (CT ~100m, districts ~250m, Table Mountain ~16m) + precinct counts + the existing jittered positions.
- **Why:** The DEM is currently only visual structure; making it the resonator turns 'crime rides the landform' into a physically intuitive sound (low ground = low note), and the 16m Table Mountain DEM gives real melodic terrain.
- **Honesty:** Impact points inherit the existing precinct jitter — the flats/mountain contrast is genuine precinct-level data, and the piece must not imply street-level precision in where a ping lands.

### Voice Scrub  `weekend`
Hum into the mic and the years obey. Pitch detection — the exact autocorrelation tech the maker already ships in Loom — maps your note to a year: bottom of your range is 2008/09, top is 2025/26. A slow upward slide sings the field through eighteen years of reformations; a held vibrato makes 180,000 points shiver around one year. You conduct the swarm with your throat.
- **Data:** 18-year scrub (all baked layouts) + live mic input; ports Loom's pitch-detection into a Web AudioWorklet.
- **Why:** It inverts every other idea — the human makes the sound, the data makes the light — and it's the most personal possible bridge between the maker's two practices: his instrument literally plays his data piece.

### Station Carillon  `weekend`
The 150 grey station points become bells for one performance. Bell SIZE (pitch) is set by precinct population — structure, fixed, matte; toll COUNT is the data — each station tolls once per K reported crimes of the selected type, panned to its true map position. 'Midnight of the province' plays the whole carillon over an hour: the metro is a cathedral quarter in full change-ringing, the Karoo a single country church.
- **Data:** Station coords, precinct populations, precinct × crime × year counts.
- **Why:** It transposes the project's visual grammar into audio exactly — bell size = grey structure, toll count = glowing data — proving the two-roles language survives a medium change intact.
- **Honesty:** Toll count is exact-count ÷ K with K stated on screen; pitch carries population (structure), never crime — a structure sound must never masquerade as data, same as the visual rule.

### The Unreported Silence  `weekend`
Play sexual offences as sparse single notes, one per reported case in the chosen precinct-year. Then the room holds a measured silence — its duration sized by the victims-survey underreporting estimate — for the cases that never became dots. The audience sits inside the gap. Silence as the most honest instrument this piece owns.
- **Data:** Sexual offences counts (baked) + StatsSA Victims of Crime Survey underreporting ratios (one external fetch, clearly sourced).
- **Why:** It sonifies the project's own stated counterweight (reported ≠ experienced) with a device only audio has — you cannot render absence visually without faking dots, but you can make people wait in it.
- **Honesty:** The gap is an external ESTIMATE — labeled, sourced, and rendered ONLY as duration, never as dots (no fabricated volume). This is the show-don't-tell discrepancy made audible, not a claim of precise magnitude.

### Six-String Field  `project`
The six crimes are six strings on one instrument. Pluck a string and the field morphs to that crime's layout while the string sounds — and each string's tuning has drifted with its 18-year trend, so carjacking's string has sharpened audibly since 2008 while commercial crime's has slackened. Strum a chord and the layouts blend, the morph-glissando riding under the strings. The whole dataset becomes something you play with two hands.
- **Data:** 6 crimes × 18 years province trends (tuning drift) + the six existing crime layouts (morph targets).
- **Why:** It reframes navigation as performance — view-switching stops being UI and becomes musical phrasing — and 'detuning = long-term trend' is a genuinely fresh encoding you feel in your ear before you read it.
- **Honesty:** Tuning drift normalized once across all six crimes over the full 18 years; blended chord-layouts must keep per-dot conservation (dots split by crime, never duplicated).

### National Organ  `project`
Parse the untapped national data: nine provinces become nine organ registers, ~1,150 stations the pipes. The country sounds as one sustained chord whose voicing is each province's per-capita rate, and scrubbing eighteen years is hearing South Africa slowly re-voice itself — Gauteng and the Western Cape arguing in the middle register while the Northern Cape holds a thin high stop. The first thing the national dataset does is not a map: it's a chord.
- **Data:** The untapped national SAPS data (9 provinces, ~1,150 stations, same 18 years, same categories) + national population rasters.
- **Why:** It gives the planned national expansion a sensory reason to exist before any national layout is designed, and a drone chord scales to 1,150 stations where 1,150 melodies never could.
- **Honesty:** Per-capita only (raw counts would just make Gauteng the loudest pipe forever); one normalization across all nine provinces and all years.

### Sub-bass Seismograph  `weekend`
A layer you feel more than hear: the province total runs as a sub-40Hz rumble beneath whatever view is up, and on a phone the Vibration API taps the 60-month pulse into your palm. The December swells become a tremor in your hand. It's the closest the piece gets to being HELD.
- **Data:** Province totals per month (60 months) and per year (18 years).
- **Why:** Every other channel in the project is visual and now audible; haptics is the untouched third sense, and a loop you feel in your hand is remembered in the body, not the eye.
- **Honesty:** Amplitude normalized once across the whole loop; rumble intensity is total volume, so pair it with the per-capita toggle's caveat on screen.

### 🌙 180,000 Oscillators  `moonshot`
No mapping, no melody, no composer. Every single dot is its own sine voice, frequency set by its local density, all 180,000 summed in a GPU compute pass into one audio buffer. Dense precincts shimmer as thick spectral bands, sparse ones as lone partials — the timbre EMERGES from the sum exactly as the visual heatmap emerges from the swarm, and a morph becomes an audible spectral migration, a hundred and eighty thousand voices sliding to new seats.
- **Data:** The full point pool with per-point density — the engine's existing per-dot state, fed to a WebGPU compute → AudioWorklet ring buffer.
- **Why:** It's the founding metaphor ('the field is the substance; structure emerges') transposed to audio at FULL fidelity — additive synthesis at dataset scale — and almost certainly something no one has heard before.
- **Honesty:** Genuinely all 180k voices, or say the decimation factor on screen — the whole point is that the count is real.

### 🌙 Locked-Groove Year Disc  `moonshot`
Press the 60-month pulse onto a lathe-cut locked-groove vinyl: one revolution = twelve months, five concentric closed grooves = the five years, the Drumline mix cut into physical plastic. Drop the needle on 2023 and it loops forever; nudge it inward one groove and you're in 2024. The dataset becomes an object on a shelf that plays the Western Cape at 33rpm.
- **Data:** 6 crimes × 60 months rendered to audio (via Pulse Drumline); lathe-cut by a short-run vinyl service.
- **Why:** It's the only idea where you literally HOLD the data — a data-art edition object, photographable, giftable, spinnable — and locked grooves are the vinyl-native twin of the piece's looping pulse.
- **Honesty:** Sleeve notes carry the normalization and 'reported, not happened' caveats — an artifact detached from the website must carry its own honesty.

### 🌙 Binaural Field Walk  `moonshot`
Headphones on. The 150 stations stand in the landscape as fixed binaural sound sources, each whispering its own Geiger stream at loudness proportional to per-capita rate. Walk the N2 from the City Bowl toward Khayelitsha — WASD now, a VR headset later — and the acoustic weather thickens around you, sources approaching, passing, receding behind your head. Crime as a soundscape you traverse rather than a chart you read.
- **Data:** Station coords, precinct per-capita rates, DEM for walk height; Web Audio PannerNodes → later WebXR spatial audio.
- **Why:** It converges the maker's two open ambitions — walk-around point sculptures in VR and mic/sound instruments — into one artifact, and 150 simultaneous positioned sources is exactly what binaural audio does that vision can't.
- **Honesty:** Sources sit at real station coords with real per-capita loudness; quiet passages must never be captioned as 'safe' — quiet means fewer REPORTS, said on screen.

### 🌙 Loom Duet  `project`
A live performance protocol: the viz streams the District Chorale as OSC over WiFi to Loom on the iPad, and the maker improvises against the data's chord progression with his scale-constrained voices — while his mic input feeds back into the browser and makes the field's glow breathe with his playing. On stage: one human, one dataset, taking turns. The eighteen-year scrub is the setlist.
- **Data:** District chorale MIDI/OSC stream (6 districts × 18 years) outbound; Loom mic-pitch inbound driving glow amplitude.
- **Why:** It turns the portfolio piece into a performable duo with the maker's OTHER instrument — nobody else on earth has this pairing, and the shared scale-constraint means human and data literally cannot clash harmonically.
- **Honesty:** The human improvisation layer must be visually distinct from data-driven sound (announced voice/timbre split) — an audience should never mistake the maker's playing for the dataset speaking.

## RELATION & COMPARISON

### The Rank Braid  `weekend`
Press a key and the map pours into a river: 150 luminous strands, one per station, running left-to-right across 18 years, with vertical position = per-capita rank that year. Where two stations swap places their strands physically cross and flare for a frame — Delft's climb and Camps Bay's plunge become rope-crossings you can trace with a finger. Hover names a strand end to end; the crossings ARE the relationships.
- **Data:** 6 crimes x 18 years x 150 stations + WorldPop populations
- **Why:** The backlog already holds static ranked bars; this makes the RESHUFFLE itself the subject — every crossing is two places trading fates, and 18 years of them reads as a single woven object no stat sheet can produce.
- **Honesty:** Rank hides magnitude — keep strand brightness bound to the actual per-capita value so a flat-but-awful top strand still reads hot; the raw/per-capita toggle re-sorts the whole braid, never mixes normalizations mid-view.

### Statistical Twins  `weekend`
Hover any station and the whole field drops to grey except it and its rhythm-twin — the station whose normalized 18-year, 6-crime profile is nearest — wherever it sits in the province. A slack thread of dots arcs between them and their two 18-year traces overlay in a corner, near-identical. The shock is WHO matches: a Winelands farm town breathing in sync with a Cape Flats precinct 100 km away.
- **Data:** 6 x 18 series (z-scored) for all 150 stations + station coords; twin table precomputed in the bake
- **Why:** Turns 150 parallel series into a social graph you can feel one hover at a time — geography's grip on the data loosens live, in the viewer's own hand.
- **Honesty:** Similarity is computed on SHAPE (z-scored series), so the overlay must say 'same rhythm, not same magnitude' — twinning Nyanga with a low-volume town without that caption would mislead.

### The Rhythm Constellation  `project`
The province dissolves and re-settles into a sky with no geography at all: each station placed by similarity of its 18-year, 6-crime rhythm (a baked 2D embedding), so places that move together sit together. Mid-flight you watch physical neighbours tear apart and strangers dock into clusters; the engine's own density-colouring then names the hot families without a single label. Toggle back and the sky snaps into the map — the same 150 characters, two truths.
- **Data:** 6 x 18 x 150 series; embedding (UMAP/PCA) baked offline into the static asset
- **Why:** This is the most direct answer to the lens — the correlation structure of the whole province made into a PLACE you can hover, and the morph map-to-constellation is exactly the conserved-swarm spectacle the engine was built for.
- **Honesty:** Embedding distances are suggestive, not metric — hover must show the two stations' real overlaid series so every claimed kinship is checkable against actual numbers.

### Border Co-movement  `project`
Every shared precinct border becomes a grey seam; as you scrub the years, seams glow where the two neighbours' year-over-year deltas ANTI-correlate — one falling as the other rises, the classic displacement signature. You see which borders behave like membranes and which like firewalls, drawn on the geography where it allegedly happens.
- **Data:** 18-year series + precinct polygon adjacency (derivable from the baked polygons)
- **Why:** 'Does crime move next door when a precinct is policed harder?' is the single most-asked relational question about this data, and nobody has ever drawn it — it lives exactly in our polygons + series and nowhere else.
- **Honesty:** Load-bearing: anti-correlation is NOT proven displacement. Label the channel 'co-movement', never draw arrows of crime 'moving', never let a cooling precinct read as painted-safe, and state n=18 points per pair on hover.

### League of 150  `weekend`
A full 18-season replay of a promotion/relegation league: each station is a small conserved swarm on a vertical ladder, and at every year-tick the swarms fly to their new rungs, the biggest movers streaking farthest. Then toggle per-capita and the entire table detonates and re-sorts before your eyes.
- **Data:** 6 x 18 x 150 + populations
- **Why:** The per-capita toggle already exists as a morph, but staging it as a LEAGUE TABLE exploding is the most visceral argument for normalization the project could make — the counterweight becomes the show.
- **Honesty:** Ladder position is ordinal; keep exact counts/rates on hover and swarm size volume-true so a rank of 80th with 4x the volume of 81st is visibly not a tie.

### The Anti-Twin Mirror  `weekend`
Pick a station and meet its opposite: the most negatively-correlated station in the province, staged as a literal mirror — two swarms face to face, breathing the 60-month pulse in exactly opposite phase, one inhaling as the other exhales. A see-saw of light you can stare at for a full loop.
- **Data:** 60-month series (Apr 2021 - Mar 2026) per station; 18-year series as fallback context
- **Why:** Twins are expected; ANTI-twins are the genuinely strange finding — two places on an inverted rhythm is a question mark made visible, and the existing monthly-pulse mechanic renders it with zero new engine work.
- **Honesty:** On 18 annual points anti-correlation is mostly noise — compute on the 60 monthly points only, print the coefficient plainly, and refuse to show a mirror when no pair clears a threshold.

### Six Heartbeats  `weekend`
The six districts as six resting organisms, each a conserved blob of its own dots, each pulsing the monthly loop at its own visible heart rate — brightness swelling with each month's count, a faint BPM readout tying per-capita rate to tempo. Winter, the Overberg slows; December, the Garden Route races. Districts stop being polygons and become creatures you compare at a glance.
- **Data:** 60-month series rolled up per district + district membership + populations
- **Why:** The shipped pulse is one province-wide breath; splitting it into six independent breathers is where COMPARISON enters — synchrony and phase-lag between districts becomes something your body reads before your brain does.
- **Honesty:** Tempo is a mapping choice, not data — anchor it with the actual monthly counts on screen, and normalize the six breathers across the comparison set (never per-frame) so a calm district never fakes vigour.

### The Squeeze  `weekend`
All 150 stations strung on one horizontal line, spaced by per-capita rate, and you scrub 18 years watching the distribution stretch and bunch. If crime burden is CONCENTRATING, the far end pulls away from the pack year by year — inequality of burden as physical tension in a single strand of light. A small Gini figure rides along, but the stretch is the message.
- **Data:** 6 x 18 x 150 + populations
- **Why:** 'Is crime concentrating or spreading across places?' is a real, answerable, almost-never-visualized question — and a one-dimensional layout is the cheapest possible morph for the engine.
- **Honesty:** Fix the axis scale across the full 18-year window (normalize across the comparison set), or the stretch would be an artifact of per-frame rescaling.

### Peak-Month Clocks  `weekend`
Every station's 60 months folded into a 12-position clock-face fingerprint, then the 150 clocks fly into groups by which month they peak: December-spike stations cluster into a festive constellation, winter-burglary towns gather into another. Seasonality becomes kinship — you see at a glance which places share a calendar.
- **Data:** 60-month x 150 station monthly series
- **Why:** The monthly data is brand new and its most relational property — WHEN places peak, relative to each other — is untouched; grouping by phase is a comparison no annual view can even express.
- **Honesty:** Only 5 samples of each calendar month exist — fold as a mean, print n=5, and grey-mute stations whose seasonal signal doesn't beat their own noise.

### The Travelling Wave  `project`
Cross-correlate every station's monthly series against the provincial aggregate, arrange the stations by their best-fit lag, then fire a single pulse through them in lead order. If trends really start in the metro and roll outward, you SEE a wave of light sweep from Cape Town across the Boland into the Karoo months later — the province as a medium that trends propagate through.
- **Data:** 60-month series for all 150 stations + station coords
- **Why:** Lead-lag structure is the deepest relationship hiding in parallel time series and is essentially never shown spatially; a light-wave over the real geography is pure drone-show AND a real statistical claim.
- **Honesty:** Lags estimated on 60 points are suggestive — bind the wave's opacity to correlation strength so weak lags barely ripple, and caption it as lead-lag correlation, not causation or contagion.

### Pair-Sky  `project`
Make the relationships THEMSELVES the field: all 11,175 station-pairs plotted as one starfield, x = kilometres apart, y = rhythm similarity. The eerie upper-right corner — far apart yet moving identically — glitters; hover any star and it names its two members, who light up on a small inset map with their overlaid series. A sky where every star is a friendship or a feud between two places.
- **Data:** 6 x 18 x 150 (pairwise similarity, baked) + station coords (pairwise distance)
- **Why:** 150 characters have 11,175 relationships and we have never rendered a single one as an object; the distance-vs-similarity scatter is the whole lens compressed into one picture, at a point count the engine eats for breakfast.
- **Honesty:** Hard break from one-dot-one-crime: these dots are PAIRS, i.e. derived statistics. Style them structure-grey (no glow), reserve glow for the hovered pair's true crime dots in the inset, and caption the layer as derived.

### National Twin Invasion  `project`
Parse the untapped national data and let ghosts in: for each Western Cape station, its closest rhythm-twin among ~1,000 out-of-province stations flies in from the edge of the screen and docks alongside it, dim and labelled by province. Nyanga meets Inanda; Stellenbosch meets a Free State wine town. One glance answers whether the Cape's rhythms are provincial quirks or national weather.
- **Data:** UNTAPPED national SAPS parse (all 9 provinces, ~1,150 stations, same 18 years) + existing WC bake
- **Why:** It is the cheapest possible use of the national data — no national map needed, just 150 imported characters — and it reframes the whole piece from 'our province' to 'our province inside a country'.
- **Honesty:** Ghost twins carry real volumes from elsewhere — render them as clearly out-of-set (dim, bordered, province-tagged) so they are never mistaken for Western Cape crime, and match on z-scored shape with the magnitude gap printed.

### Crime-Swap Quadrants  `weekend`
Do crimes trade places WITHIN a station? Scatter all 150 stations by (18-year change in burglary, 18-year change in robbery): the lower-right quadrant — burglary down, robbery up — is the 'hardening' story told across 150 places at once. Flip through all 15 crime-pairs like tuning a radio, watching the swarm re-scatter each time.
- **Data:** 6 x 18 x 150 + populations
- **Why:** Every shipped view compares places or years; this compares the MIX — the relationship between crime types inside each character — which is where the sharpest criminological stories (substitution, hardening) actually live.
- **Honesty:** Mix shifts can reflect reporting behaviour as much as crime — say 'reported' loudly; show per-capita changes with absolute deltas on hover, endpoints averaged over 3 years to blunt single-year noise.

### Comet of Mass  `trivial`
For each crime, trace the crime-weighted centroid of the whole province across 18 years as a slow comet drifting over the dim map — six comets, six drifts. Does the burglary centre creep coastward toward the metro while the stock-theft centre holds still in the Karoo? Eighteen years of provincial drift condensed into six short, eerie trails.
- **Data:** 6 x 18 x 150 + station coords
- **Why:** A whole-field relationship (where the centre of gravity of each crime lives, and how it migrates) rendered in about thirty lines of layout code — maximum insight-per-effort in the whole list.
- **Honesty:** A centroid is an abstraction — draw the comet as structure-grey annotation, never as glowing data dots, and keep the real glowing field visible beneath so the summary can't replace the evidence.

### 🌙 Choir of 150  `moonshot`
The maker's sound-instrument craft turned on the data: every station is a voice, pitch snapped to a musical scale by per-capita rank, and the 18 years play as a slow chord progression. Years when the province moves together sound consonant; divergence years grind into dissonance — you HEAR correlation. Hover mutes everything but one station and its twins, a duet emerging from the choir.
- **Data:** 6 x 18 x 150 + populations; the Loom iPad app's scale-constrained voice engine as the template
- **Why:** Nobody has ever heard 150 police stations sing 18 years; it fuses the maker's two instruments (point-field + sound engine) into one piece, and consonance/dissonance is a genuinely rigorous mapping of co-movement.
- **Honesty:** Music must not prettify: scale-snapping quantizes RANK, not magnitude — declare that, keep the raw numbers visible under the sound, and never let a tragic year resolve to a pleasing cadence by accident of key.

### 🌙 The Orrery  `moonshot`
A VR tabletop solar system you pick up and tilt (the backlog's hologram-object vision): six districts as six suns, their stations as planets whose orbital radius = per-capita rate this year and orbital speed = monthly volatility. Twins across different systems orbit in visible resonance, blinking in phase; scrub 18 years and planets migrate inward and outward. You HOLD the province's relational structure in your hands.
- **Data:** 6 x 18 x 150 + 60-month series + district membership + populations
- **Why:** It converts every relationship in this list — twins, district comparison, volatility, rank — into orbital mechanics the body already knows how to read, and it slots straight into the maker's existing WebXR hologram ambition.
- **Honesty:** The orbit metaphor is decorative physics — pin exact per-capita numbers on grab/hover, normalize radii across all six systems (never per-system), and keep inner-orbit = worse explicit so 'close to the sun' is never read as safe.

### 🌙 Fly the Braid  `project`
The Rank Braid extruded into a 3D rope you fly along: 150 luminous fibres braided down an 18-year corridor, the rope fat where total volume is high, rank-crossings becoming physical over-unders you pass through. The one view that deliberately breaks the fixed-camera rule — an authored 60-second flythrough that works as the piece's cinematic trailer.
- **Data:** 6 x 18 x 150 + populations
- **Why:** The engine already does 3D height (terrain) and the braid is just another layout function plus a camera path — yet the result is a sculptural object made purely of inter-station relationships, unlike anything on the site.
- **Honesty:** Same rank-vs-magnitude guard as the braid, plus: authored camera motion is a TOUR, not exploration — label it as such so cinematic pacing is never mistaken for interactive discovery of the data.

## HUMAN & NARRATIVE

### One Dot, One Door  `weekend`
Click any single dot and the other 179,999 dim to embers; the chosen one stays lit while grey structure points swarm into the outline of a front door around it. Beneath, a quiet line assembles from the bake: 'One reported burglary. Philippi East, 2017/18 — one of 1,178 that year.' Escape, and the door dissolves back into the mountain of light.
- **Data:** Existing baked precinct counts + the shipped hover-anchor mechanism (nearest-dot hit-test already works); the door is a tiny new structure layout.
- **Why:** The whole piece is about volume; this is the one gesture that makes volume mean something — the moment one light stops being a statistic and becomes a family's evening. It uses the engine's own grammar (structure points rearranging) rather than a UI overlay.
- **Honesty:** Caption always says 'reported.' The door is drawn in the grey/matte structure role so it can never masquerade as data, and the dot keeps its precinct jitter — the door is a symbol, not an address.

### The Reading  `weekend`
Murders only. The field files past a thin grey line like names read aloud at a memorial: one dot crosses per second, ignites, and joins a slowly growing column. A counter holds the arithmetic honest: '3,900 murders recorded in 2024/25. At one per second, this reading takes 1 hour 5 minutes.' You can leave — the piece never speeds up.
- **Data:** Murder counts × 18 SAPS years (year selectable); conserved-swarm queue is one new layout function fed to the existing stagger.
- **Why:** Every other view trades volume for glanceability; refusing to compress time IS the memorial. Nobody has seen a SAPS annual total rendered as a duration you must sit inside.
- **Honesty:** Recorded murders only. No names exist in the data and none are invented — the dignity lives in the pacing, not fabricated identity.

### 🌙 The Year-Long Ember  `weekend`
A URL that runs at 1:1 time: the current SAPS year starts empty on April 1 and accumulates at the true monthly rate — in the Western Cape a murder dot kindles on average every ~2 hours, a burglary every few minutes. You leave the tab open like a fireplace; when a light appears at the corner of your eye, that is the actual pace at which the province's ledger grows. A durational art piece disguised as a browser tab.
- **Data:** The 60-month totals (Apr 2021–Mar 2026) set per-crime, per-month arrival rates; wall-clock drives ignition.
- **Why:** Scale translation through real time instead of space — the one dimension the piece has never used honestly at 1:1. It turns 'high crime rate' into a felt rhythm you live alongside.
- **Honesty:** Individual ignition instants are drawn randomly to match the true monthly totals — the rhythm is honest, the specific moments are synthetic, and a persistent footer says exactly that. Monthly seasonality (festive spike) is preserved, not smoothed.

### The Unlit Field  `project`
The reported-vs-experienced gap made visible. Toggle it and, around the glowing reported dots, unlit slate-violet points condense out of the dark — the statistically estimated crimes nobody reported, from Victims of Crime Survey reporting rates. They do not glow (glow = confirmed data, always); they hang like smoke around the light. For sexual offences the shadow dwarfs the lit field.
- **Data:** VOCS reporting rates per crime type — already flagged in docs/IDEAS-BACKLOG.md as the next grab from the same DataFirst login — applied to the existing baked counts.
- **Why:** This is THE counterweight the project's own foundations name ('reported ≠ happened') and it has never been drawn. It is also the first honest use of a third visual role, which is a genuine extension of the piece's language.
- **Honesty:** Requires declaring a new semantic role — 'estimated absence': no glow, visually unmistakable, own legend entry, default OFF, survey-cited on screen. Apply province-level VOCS rates only; never imply precinct-level precision the survey cannot support.

### Household Breath  `weekend`
In murder view, each dot periodically exhales a faint ring of three grey points that drift outward and fade — the average Western Cape household that loss ripples through. Across 180,000 dots the field visibly breathes grief, without a single word of copy.
- **Data:** Existing murder counts + one sourced number (census average WC household size, ~3.3).
- **Why:** It answers 'what does one dot mean for a family' inside the engine's own grammar — data exhaling structure — instead of with a caption. Quietest possible empathy device; zero fear-porn.
- **Honesty:** Rings are the published average household size, rendered grey/matte (structure role) so they are read as a statistical gesture, never as fake victims or extra data volume.

### Two Places, One Size  `weekend`
Pick two precincts of near-equal population — Camps Bay and a same-population slice of Nyanga — and the swarm splits into two identical rectangles of grey resident-points; each precinct's glowing reports then land among its own people. Same denominator, same years, one shared scale, side by side: one panel a faint dusting, the other a blaze. Apartheid's spatial ledger, shown not told.
- **Data:** WorldPop per-precinct population (baked) + 6 crimes × 18 years; one new paired layout function.
- **Why:** The per-capita toggle states the disparity; this makes it physical by holding population visually constant. It is the 'history overlay' counterweight delivered through juxtaposition rather than annotation.
- **Honesty:** Equal population is the entire honesty mechanism (normalize across the comparison set, never per frame). Captions frame it as burden borne by residents — never 'dangerous place' vs 'safe place,' and nothing is painted safe.

### One in Forty-Three  `weekend`
Tap where you live and your precinct's population stands up: rows of grey person-points, a crowd filling the frame; the year's glowing reports then distribute among them. '23.4 per 1,000' becomes 'walk past 43 neighbours and you pass one burglary.' The rate is no longer a number — it is a distance between people.
- **Data:** WorldPop precinct population + baked counts; one new crowd layout function (people as structure points).
- **Why:** Per-capita is load-bearing in this project but still abstract; this converts the rate into the most human unit available — neighbours. It also finally uses population as a visible substance, not just a divisor.
- **Honesty:** Lights are reports, not victims (one burglary touches a whole household; repeat victimization exists) — the caption says 'one reported burglary per N residents,' nothing stronger. No geolocation is read or stored; the user points, the page never asks.

### The Long Look  `weekend`
A first-visit guided mode: four minutes, hands off — the existing layouts play as chapters (the mountain of light → the per-capita flip → the monthly pulse → one precinct's 18 years) with one quiet sentence each, every sentence computed live from the bake, never editorial. Press anything and the tour dissolves mid-morph into free exploration.
- **Data:** Everything already baked; pure choreography of shipped layouts plus a sentence-template system.
- **Why:** docs/IDEAS-BACKLOG.md names guided-vs-free as the open foundational question and leans 'explorable explanation' — this answers it with zero new instruments. It is also the piece's missing narrative front door for a first-time visitor.

### Falling Ash  `weekend`
A view of what stopped. For any precinct whose reports fell from their peak year, the difference detaches from the field as dots that lose their glow mid-air and drift down into the grey structure layer — data becoming ground. Gugulethu robbery, peak vs now: watch four hundred lights go out and settle as ash.
- **Data:** Existing 18-year per-precinct counts (peak-vs-current delta per crime).
- **Why:** Conserved motion carrying meaning: the same dots, demoted from data to structure before your eyes — the engine's two-role language used as a verb for the first time. Decline stories are almost never told about SA crime, and this tells one without ever saying 'safe.'
- **Honesty:** Captioned 'fewer REPORTS than the peak year' — reporting falls for many reasons (including lost trust in police). The view is never labeled safer and nothing is painted safe, per foundations.

### Hold a Dot  `weekend`
Long-press any dot and the field waits while a small card unfolds: what VOCS respondents nationally say follows this kind of crime — the share who felt unsafe walking after dark afterwards, the share who never told the police, the households that stopped letting children play outside. You are not told a story about THIS dot; you are told what thousands of real survey answers say about dots like it.
- **Data:** VOCS microdata (the flagged next DataFirst grab: perceived-safety and behavioural-change questions) keyed by crime type; existing hover/long-press infrastructure.
- **Why:** It gives every one of 180,000 dots a truthful human aftermath without inventing a single detail — grounded empathy at any point in the field, on demand.
- **Honesty:** Card is explicitly labeled national survey averages, source-cited on the card itself, and never narrated as this dot's actual event.

### The Taken  `weekend`
Kidnapping — the untapped SAPS category with the darkest national trend — gets its own single-story mode. Every Western Cape kidnapping dot forms one thin horizontal thread, 2008 at the left: sparse beads at first, then the thread visibly thickens toward 2026 like a rope under load. For a minute, the entire field is just this one line, growing.
- **Data:** The kidnapping column from the raw SAPS workbooks (one parse away) × 18 years × 150 precincts.
- **Why:** The most newsworthy human story hiding in the raw files, told with the engine's sparsest possible layout — a single line whose thickness IS the story. Restraint as impact.
- **Honesty:** SAPS 'kidnapping' bundles ransom, hijacking-linked and custody-dispute cases — the caption names the bundle. Each dot remains exactly one report; the thickening is volume-true.

### 🌙 Lament Engine  `project`
The maker's Loom instrument turned memorial. Scrub a year and each murder dot, as its precinct passes under the playhead, strikes one note in a slow, scale-constrained minor voice — dense precincts become chords, sparse coastline single tones; a year plays as a several-minute lament that the geography itself composes. Hum into the mic and the field's key follows your pitch: you keen, it answers.
- **Data:** Monthly murder counts × precinct positions (baked) + the existing Loom pitch-detection/scale-voice pipeline ported from the iPad app.
- **Why:** It fuses the maker's two instruments — the point-field and the sound engine — into one object, and sound is the only channel the piece has never used. One dot = one note keeps the volume covenant in audio.
- **Honesty:** Pacing maps to real counts — volume is never faked in sound either. Register stays slow and low by design: an elegy, not a soundtrack; no rhythmic 'grooving' on murder data.

### 🌙 Stand Inside the Number  `moonshot`
The moonshot the tabletop-hologram plan (docs/IDEAS-BACKLOG.md, VR section) deliberately avoids — proposed anyway, eyes open. In VR, one precinct-year scales up until you are standing inside it: 1,100 Mitchells Plain burglaries as fireflies at arm's reach — above you, behind you, to the walls of the room — then it shrinks back down to the tabletop object. You do not read the number; for ten seconds you are outnumbered by it.
- **Data:** Existing per-precinct dot positions + WebXR (three.js native support); the per-dot 3D transit arcs the backlog already specifies for VR.
- **Why:** The ultimate scale translation: the count as a physical crowd around your body. Ten seconds inside one precinct's year would outlive every chart the visitor has ever seen.
- **Honesty:** Diverges from the maker's recorded 'hologram, not walk-through world' correction — framed as a deliberate, momentary exception for scale-feel, to be discussed, not assumed. Even at room scale dots keep their precinct jitter; a floor line reads 'positions approximate within the precinct' so proximity never fabricates an address.

### 🌙 Letters to the Field  `moonshot`
A participatory memorial: someone affected can anonymously tie one word — just one, moderated — to a dot from their precinct and year. Touched dots shimmer at a slightly different frequency; hover reveals the word: 'still.' 'brother.' 'unlocked.' Over years the field grows a sparse constellation of human punctuation left by the people the statistics happened to.
- **Data:** Existing field + a minimal moderated word store; dots addressed by precinct-year only.
- **Why:** It inverts the piece's direction of empathy — instead of the viz reaching toward people, people reach into the viz. No crime dataviz anywhere lets the counted mark themselves counted.
- **Honesty:** Breaks the no-backend foundation (needs moderated storage) — that alone makes it a discussion, not a build. A word attaches to 'a dot from that place and year,' never 'your event' (jitter + precinct-level truth prevent re-identification); strict no-names/no-details moderation or it does not ship. A static fallback exists: curated fragments from published victim-testimony research, baked in.

## GENERATIVE ORGANISM

### Starling Ledger  `project`
When you scrub from 2019/20 to 2020/21, the dots that must move — exactly the year-over-year delta — don't slide in straight staggered lines; they lift off and flock. For three seconds a true murmuration wheels over the greyed province, turning-waves rippling through it, before folding down into the new year's layout. The size of the airborne flock IS the size of the change: the lockdown year sends a huge cloud into the sky; a quiet year barely stirs the field.
- **Data:** 6 crimes × 18 SAPS years per 150 precincts (the year-over-year deltas the engine already computes for conserved morphs).
- **Why:** It makes the engine's signature move — only deltas fly — literal biology. Magnitude of change becomes something you feel as flock size before you read a single number, and it upgrades every existing scrub for free.
- **Honesty:** Flock membership is exactly the dots the delta demands — never more, never fewer. The flight is choreography; take-off and landing precincts are the true source and target, so the reading before and after is untouched.

### December Tide  `weekend`
The 60-month loop becomes a tide against the real landform: each precinct's monthly dots rest at a height on the DEM proportional to that month's count, normalized once across all 60 months. As the loop runs you watch a glowing waterline climb the Cape Flats every December — a spring tide of robbery — then recede through the winter months. The terrain stays grey and matte beneath; only the water glows.
- **Data:** Monthly counts (6 crimes × 60 months, Apr 2021–Mar 2026) + the province/district DEMs + precinct polygons.
- **Why:** Cape crime seasonality is real and strong, and today it reads as a brightness pulse; as a tide lapping actual mountains it becomes a physical rhythm you can watch and anticipate — the data acquires weather.
- **Honesty:** Heights normalized across the full 60-month window (never per-frame), so a high tide is high in absolute terms; low tide is 'lower', never 'safe'.

### Fire Season  `weekend`
Fynbos ignition. Month over month, precincts whose counts jump flare ember-orange with heat-shimmer; precincts falling cool through red into blue-grey ash. Play the 60-month loop and the province burns and recovers like a fire ecology — summer flashovers on the Flats, long winter smoulder in the Karoo.
- **Data:** Monthly per-precinct deltas from the 60-month bake; extends naturally to the untapped arson category.
- **Why:** The derivative (change) has no visual channel in the piece today — fire gives it one, and it's the most Cape-native metaphor available. The eye reads spreading ignition and dying ash instantly.
- **Honesty:** Colour maps signed month-over-month change on one fixed scale across the whole window. Spark shimmer is dressing on real dots, never added volume. No fire 'spread' is drawn between precincts — each burns on its own numbers only, so the eye can't infer contagion the data doesn't claim.

### Mycelium of Co-Spikes  `project`
Beneath the glowing field, dim grey hyphae grow between precinct pairs whose 60-month series correlate strongly — a fungal network of shared rhythm under the province. When two connected precincts actually spike in the same month, a pulse of light runs the thread between them. Idle, it's a faint root system; playing, it flickers like nerves firing.
- **Data:** Monthly 60-month series per precinct (pairwise correlation, baked offline) + station coords for thread endpoints.
- **Why:** Which places move together — seasonally, systemically — is structure no current view can show. The correlation matrix becomes an organism you watch instead of a table you'd never read.
- **Honesty:** Threads are grey structure (they encode correlation, not crime volume) per the visual language; light pulses fire only on real same-month co-spikes; the hover readout states correlation ≠ causation.

### Sediment Scrub  `weekend`
Run the 18-year scrub in geology mode: each year's dots fall and settle as a stratum on the terrain, compacting and dimming beneath the next. By 2025/26 every precinct is a glowing sedimentary column — thick bright bands for bad years, thin dark seams for quiet ones — and dragging the scrub backwards is drilling a core through time. History as accumulated mass instead of a flickering present.
- **Data:** 18 annual years × 150 precincts, one crime at a time (keeps the cumulative pool inside the ~1M budget); DEM as the bedrock.
- **Why:** Every current view shows one moment; deposition shows the integral. A precinct's whole 18-year story becomes a single readable column, and 'this place has carried this for two decades' lands viscerally.
- **Honesty:** One dot = one reported crime, so a column's total mass equals the true 18-year total; dimming encodes age only, never diminished importance.

### Synoptic Crime Weather  `project`
The province as a weather-radar loop. Each month, precinct swarms rotate slowly in place like storm cells — spin rate and thunderhead height set by that month's per-capita rate — while grey isobar contours (structure points) ring the systems. A province-wide bad month reads as a cold front: a line of cells lighting up together as the sweep passes.
- **Data:** Monthly 60 months + WorldPop population + precinct polygons (isobars contour the per-capita surface).
- **Why:** It shifts the reading from precincts to SYSTEMS — synoptic pattern-vision is exactly how meteorologists compress thousands of stations into one glance, and nobody has ever given crime data a weather channel.
- **Honesty:** Swirl is in-place texture — dots never leave their honest jitter radius. Cell intensity normalized across the full 60-month window; per-capita is the load-bearing scale so dense townships aren't painted as the permanent storm.

### Release the Field  `project`
One key and all 180,000 dots forget their layout: they lift off the map and become a single province-scale murmuration — real boids, the dark grey terrain far below, turning-waves glinting through the flock. Each dot keeps its density colour, so hot-precinct dots streak the flock with warm veins. A second key whistles them home: the flock banks, folds, and pours back into the exact map, every dot to its own precinct.
- **Data:** Any current view — it's a choreography state over the existing pool and density colours.
- **Why:** The ultimate proof the field is alive, and the perfect demo/opening moment. The landing — 180k dots returning to their exact truthful positions — turns the honesty foundation itself into theatre.
- **Honesty:** Explicitly a play state: no data reading while airborne (UI readouts suspend), and release always ends by restoring the exact truthful layout.

### Plankton Wake  `trivial`
Move the cursor through the field like a hand through a night sea: dots you pass flare with bioluminescence and fade over a second, flare brightness proportional to true local density. Drag through Nyanga and your wake burns; drag across the Karoo and it barely glimmers. The field never moves — it only answers.
- **Data:** The baked per-point density values, live in any view.
- **Why:** Interaction becomes measurement: the sparkle IS a density readout under your hand, more tactile than any tooltip. Cape Town's actual bioluminescent tides make it locally resonant, and it's nearly free in the existing shader.
- **Honesty:** Flare amplitude is driven by the baked density value, so the beauty is a reading, not decoration; structure points stay matte and never flare.

### Growth-Ring Forest  `weekend`
The map morphs into a forest floor: 150 tree stumps, one per precinct, each cross-section showing 18 concentric growth rings — ring thickness proportional to that year's count, 2008/09 at the heartwood. Fat bright rings are bad years, and because every stump shares the same radius-per-year, a province-wide spike reads as one synchronized scar across the whole forest at a glance. Hover names the stump like field identification.
- **Data:** 6 crimes × 18 years × 150 precincts; station coords for stump placement.
- **Why:** Dendrochronology is the organism's own memory format: 18 years become legible in a single still frame, per precinct AND across precincts simultaneously — something the scrub (one year at a time) can never do.
- **Honesty:** Dots per ring = actual annual count. Because outer rings have more circumference, ring thickness must be computed at equal-area so visual mass stays proportional to true count — the classic radial-area lie, pre-empted in the layout function.

### The Migrant Flock  `project`
Each precinct's monthly swarm splits into residents and migrants: the resident layer is the crime that is always there (the precinct's stated monthly floor across the five years), and the migrant layer is the seasonal excess — which arrives the way the whales do. Every December of the loop the migrant dots fly in, hover a season above the resident field, and depart; five cycles show the same flock returning year after year.
- **Data:** Monthly 60 months per precinct (baseline = per-precinct minimum month or an explicitly stated floor).
- **Why:** It's an honest statistical decomposition (level vs seasonality) told as migration — which is literally what the pattern is. 'This much never leaves; this much comes with summer' is a sentence no current view can say.
- **Honesty:** The baseline definition is shown on screen, not implied; resident + migrant always sum to the true monthly total; the arrival flight is choreography, counts are never faked.

### Six Breathing Tempos  `trivial`
At province level each district inhales and exhales — its swarm gently swelling and settling — at a tempo set by its per-capita rate over the current window: Cape Town pants, the Central Karoo breathes long and slow. Out of phase with each other, the province reads as a hillside of sleeping animals, each with its own metabolism.
- **Data:** Annual or monthly counts + WorldPop population + district membership; rides the existing pulse mechanic.
- **Why:** Rate becomes tempo — a pre-attentive channel the piece has never used, orthogonal to colour and height. It also finally gives the per-capita toggle a form you can feel rather than compare.
- **Honesty:** Tempo mapped on one fixed scale across all six districts (a proper comparison set, never per-frame); slow breathing reads as 'lower rate', and the readout never labels any district safe.

### 🌙 Physarum Cartographer  `project`
Kill the map and grow it back. Drop 150 food pellets at the true station coordinates and release a slime mould: a GPU Physarum simulation of grey agents crawls the black void, finds the stations, and grows the classic pulsing vein network between them — the shape of the Western Cape rediscovered by an organism. Then the data dots ride the veins home to their stations and the veins fade into the familiar grey mesh.
- **Data:** Station coordinates only (the simulation is pure structure); hands off to any existing view.
- **Why:** The structure layer gets an origin story: geography as something GROWN rather than drawn. As an opening title for the whole piece it would be mesmerising, and it honours the language — the organism is grey, the data glows.
- **Honesty:** Pure structural theatre: veins are simulation, never presented as roads, borders, or data; they stay grey and matte, and the sequence ends in the truthful layout.

### 🌙 The National Creature  `moonshot`
Parse the same raw sources for all nine provinces — ~1,150 stations, a million points — and see South Africa from orbit as one bioluminescent organism on the dark subcontinent. The monthly loop makes it breathe; each province is an organ with its own visible pulse rate and colour temperature — Gauteng burning like a heart, the Northern Cape glimmering like skin. One body, nine organs, sixty breaths.
- **Data:** Untapped national annual + monthly SAPS data (one parse away), national station coords, WorldPop national raster for per-capita.
- **Why:** Scale-shock: the engine was built comfortable to 1M points and this is the dataset that spends the budget. Nobody has ever seen the national crime picture as a single living body rather than nine ranked tables.
- **Honesty:** Per-capita is mandatory at national scale — raw counts would simply paint Gauteng and the metros. Normalize across all nine provinces as one comparison set; national population joins and provincial precinct polygons are real pipeline work, not garnish.

### 🌙 Sing to the Swarm  `project`
Wire the maker's Loom pitch-detection into the field: the mic listens, and your voice steers a murmuration — hum low and the flock banks and tightens; slide up a fifth and it climbs and shears into two wings; go silent and it settles back onto the truthful map. The data becomes a creature you play like an instrument, and every session ends with the same honest landing.
- **Data:** Any view (a choreography state over the existing pool) + live microphone; borrows the Loom app's pitch-detection approach.
- **Why:** It fuses the maker's two practices — sound instruments and the field — into one artefact, and a murmuration that answers your voice is joy incarnate, which is the project's stated reason to exist.
- **Honesty:** Explicit play mode sharing Release the Field's rules: readouts suspend while airborne, and silence always restores the exact truthful layout — the truth is what the creature comes home to.

### 🌙 Held Breathing Thing  `moonshot`
The backlog's VR tabletop hologram, but alive: in the headset the field floats as a deep-sea creature you cup in two hands. It breathes the 60-month pulse against your palms; reach in and the swarm schools away from your fingers like fish around a diver, then elastically re-forms — the layout always re-asserts itself. Tilt it and the terrain slab shows its underside, grey and matte like a whale's belly.
- **Data:** Everything shipped today (positions, density, DEM heights, monthly pulse) + WebXR hand tracking; extends the backlog VR item with per-dot 3D transit arcs.
- **Why:** It turns 'hologram you inspect' into 'creature you hold' — the emotional register the piece keeps circling. Startle-and-reform is conserved motion made intimate: the data literally cannot be pushed out of shape for long.
- **Honesty:** Hand-avoidance displacement is temporary and elastic; every dot returns to its truthful precinct position — the honest layout is the creature's skeleton, and no reading is offered mid-disturbance.

### Motion Bestiary  `project`
Parse the 31 untapped SAPS categories and give each species its own idle gait inside its honest jitter radius: drug-possession drifts like spores, carjacking makes short darting sprints, stock theft grazes in slow rural drift, arson flickers. A field-guide panel releases one species at a time into the province; hover identifies it like naming a bird.
- **Data:** The 31 additional SAPS crime categories in the raw workbooks (one parse away), same 150 precincts and years.
- **Why:** Motion becomes an identity channel the piece has never used — you learn to recognise a crime type by how it moves before you read its name. It's also the most inviting on-ramp to 31 new datasets that would otherwise be a dropdown.
- **Honesty:** Gait encodes category identity only, never intensity, and stays inside the honest jitter radius. Tone matters as much as truth here: violent and sexual-offence categories get sober, minimal motion — no cuteness where the metaphor could wound.

## PLAY & INTERACTION

### Hold the Morph  `trivial`
Plug in any gamepad; the analog trigger becomes the engine's `t` uniform itself. Squeeze halfway and the swarm hangs frozen mid-flight between map and timeline — 180,000 points suspended between two truths, and you can feel the interpolation as spring-pressure under your finger. Release and it settles; feather it and the field breathes under your hand. Sticks blend between a 2x2 grid of layout targets, so you can 'play' the space of views like a joystick-mixer.
- **Data:** Any two (or four) existing layouts — no new data; this is pure engine exposure.
- **Why:** Nobody ever gets to STOP a transition and look at it — the morph is usually the throwaway between states. Here the engine's one secret (source+target+t) becomes the instrument's fretboard. It is the most engine-native interaction possible: zero new layout code, just the Gamepad API writing one uniform.

### Stand In Your Suburb  `weekend`
One button: 'find me' (client-side geolocation, or type a suburb). A single matte-grey beacon lights at your precinct's station, the field re-sorts so your precinct's glowing points gather in a quiet ring around it, and its 18-year story plays out locally while the rest of the province dims to context. Then the honest kicker: your precinct's points fly into a per-capita ranked queue of all 150 precincts, and you watch where YOUR dot-cloud lands in the line.
- **Data:** Precinct polygons, station coords, all 6 crimes x 18 years, WorldPop per-capita.
- **Why:** The single highest-gravity personalization move: 'that glow is MY street's precinct' converts spectators into stakeholders instantly. The ranked-queue reveal uses conserved motion to answer the only question every local actually has — 'how bad is it where I live, really?' — without a single number on screen.
- **Honesty:** Geolocation resolves client-side to precinct only and is never transmitted (static site stays static). All claims stay at precinct granularity — the beacon marks the station, not your house. Ranking is per-capita across all 150 precincts, framed as 'reported crime', never as 'safety'.

### Pin the Peak  `weekend`
Before a crime's field is revealed, the map is all grey structure. A quiet prompt: 'Where do you think reported carjacking concentrates? Touch the map.' You place up to three guesses; then the glow floods in and the swarm flows to truth, your guesses left behind as thin grey rings — sometimes dead-on, often embarrassingly wrong (per-capita flips everyone's intuition). No score, no confetti: just your mental map and the reported map, side by side in one frame.
- **Data:** Any of the 6 baked crimes (or the 31 unparsed ones) x per-capita toggle, precinct polygons.
- **Why:** It weaponizes the piece's core honesty finding — raw intuition tracks poverty and headlines, not per-capita reality — and makes the viewer discover that about THEMSELVES. Guess-then-reveal is the strongest known trick for making data stick (NYT 'You Draw It'), and it has never been done on a living point-field.
- **Honesty:** Guesses are scored against REPORTED crime, and the reveal copy must say so — being 'wrong' may mean under-reporting where you guessed, not safety. Never render a low-glow area as a 'correct: safe' answer.

### Split-Field Time Duel  `project`
Grab the field and tear it in two: 2008/09 settles on the left half, 2025/26 on the right, mirrored geographies, one shared brightness normalization. Two thumbs, two scrubbers — scrub either half independently. When a precinct's count differs between your two chosen years, the delta points physically defect across the centre line, a glowing migration you can make flow back and forth by rocking the years. Murder's long fall becomes a visible tide with a direction.
- **Data:** 6 crimes x 18 years per precinct; works even better with the 60-month data for seasonal duels (December vs June).
- **Why:** Comparison is the piece's current weak spot (the scrub shows sequence, not contrast). Conserved cross-boundary migration — deltas as defectors — is a genuinely new comparison idiom that only this engine's 'only deltas fly' rule makes honest.
- **Honesty:** Brightness/density normalized jointly across BOTH selected years (the comparison set), never per-half — otherwise every duel looks like a tie.

### Docent Tours & Bookmarks  `weekend`
Press '?' and a docent takes over: a hand-authored sequence of layout states, each with one quiet sentence ('This is eighteen years of murder, one dot each') — spacebar advances, the swarm flies, ESC drops you back into free flight exactly where you are. Then the flip: anyone can RECORD their own tour — capture the current state, type a caption, repeat — and the whole tour serializes into the URL hash. Share a link, share a path through the field.
- **Data:** All existing views/state; tours are just ordered lists of layout parameters + captions.
- **Why:** Solves guided-vs-free with zero backend and turns visitors into curators — the piece grows essays written IN it, not about it. A tour link in a Cape Town group chat ('look what happens to burglary in Khayelitsha, step 3') is the most viral thing a static site can do.

### The Scrub Wheel  `weekend`
A weighted rotary encoder on the desk (any cheap MIDI controller, Web MIDI API): one heavy knob owns the 18 years, a fader owns pulse tempo, six arcade buttons own the six crimes. No screen furniture at all — the UI dissolves because your hands know where everything is. Spin the wheel hard and 18 years of sexual-offence data whirs past under flywheel momentum; feather it to land on 2019/20 and watch COVID lockdown snap the field dim.
- **Data:** Everything already baked; this is a control-surface layer only.
- **Why:** The maker builds instruments — this makes MISDAADVELD physically one. Tangible controls change dwell time radically (people 'play' knobs for minutes where they click a slider once), and Web MIDI means it works in the same static page, controller optional.

### Haptic Decembers  `trivial`
On a phone, thumb-scrub the 60-month pulse and the vibration motor ticks with each month's volume — a faint buzz through quiet winters, then a hard triple-knock as the festive-season spike hits. You feel the seasonality of violence in your palm before you consciously read it. Works with the screen face-down: the data as pure rhythm.
- **Data:** 6 crimes x 60 months (Apr 2021–Mar 2026), per precinct or aggregated to current view.
- **Why:** Adds a whole sensory channel for the cost of one navigator.vibrate() call, and it is honest by construction — pulse amplitude IS the count. Nobody has made SAPS data tactile.
- **Honesty:** Vibration amplitude normalized once across the full 60-month set in view, never per-frame, so a spike feels like a spike relative to the whole period.

### Breath-Locked Pulse  `weekend`
Grant the mic, and the monthly pulse stops looping on its own clock and locks to YOUR breathing — amplitude envelope detection, nothing recorded. Each exhale advances one month; the field swells and dims at the tempo of your own chest. Sixty breaths to cross five years of a province's violence. It turns viewing into a sitting — closer to meditation than to dashboarding.
- **Data:** 6 crimes x 60 months monthly pulse; mic amplitude only.
- **Why:** The pulse is already the piece's most alive gesture; coupling it to the viewer's autonomic rhythm makes the intimacy literal. It reframes 'engagement' as stillness, which almost no interactive dataviz dares to do.
- **Honesty:** All audio processing local, nothing stored or sent; the data values are untouched — only playback tempo is yours.

### 🌙 Hum Conductor  `weekend`
Port the maker's Loom pitch-detection: hum, and your pitch becomes the timeline position — low notes are 2008, high notes 2026, glissando to scrub. Sing a slow rising scale and watch murder fall as your voice climbs; hold a note and the field holds its year, trembling slightly with your vibrato. The province's history becomes something you can literally perform.
- **Data:** 18-year series + 60-month series; reuses existing Loom pitch-detection code.
- **Why:** A direct crossover between the maker's two instruments — the sound app and the point-field — that neither could do alone. 'I sang the crime statistics of the Western Cape' is a sentence no one else on earth can produce.

### Which Is Worse?  `weekend`
Two precincts rise out of the field as twin glowing columns — 'Per person, which had more reported burglary last year?' Touch one. The points then sort themselves into the true comparison, your pick marked with a thin grey underline, and a small running calibration meter ('you lean toward famous townships by 2:1') builds a portrait of your bias over ten rounds. Dead quiet, no fanfare: the reward is finding out how your gut is wrong, and in which direction.
- **Data:** All 150 precincts x per-capita x any crime; the 31 extra categories make the ladder endless (stock theft vs shoplifting is a genuinely hard round).
- **Why:** Game mechanics without trivialization: the score is a bias-diagnosis, not points. It's the only format that gets people to look hard at UNFAMOUS precincts — the mid-table places no heatmap ever makes anyone examine.
- **Honesty:** Every round is per-capita and says 'reported'; the bias meter describes the player's guessing pattern, never labels any place safe or dangerous.

### 🌙 Phone-Swarm Wall  `project`
Installation mode: the field on a projector wall, all UI stripped, and a QR code in the corner. Every visitor who scans gets their phone as a controller — swipe to scrub years, tilt to raise the terrain — and appears IN the field as a single matte-grey comet drifting where they point. Six people arguing over which decade to look at becomes six grey comets tugging at one shared timeline that moves by their consensus (average of all scrub inputs). The crowd is visible in the piece, but always as structure, never as data.
- **Data:** Everything baked; plus a WebRTC/WebSocket presence relay for the room.
- **Why:** Multi-user presence rendered in the piece's own two-role grammar (visitors = grey structure points) is a genuinely new installation move, and consensus-scrubbing turns a gallery crowd into a deliberating body — the social dynamics ARE the exhibit.
- **Honesty:** Bends the no-backend foundation: the public site stays fully static; the relay exists only in the installation build, carries only pointer/tilt state, and stores nothing. Visitor comets are grey and glowless by hard rule — a human must never read as a crime.

### 🌙 Wade Through the Field  `moonshot`
WebXR: the same point pool, room-scale. Table Mountain's 16m DEM underfoot at ankle height, the Cape Flats' glow rising around your knees like bioluminescent water. Walk from Sea Point toward Nyanga and feel the density thicken around your body; reach into a cluster and the precinct names itself in your palm with its 18-year sparkline hanging in the air. The view morphs still happen — you stand still while eighteen years of murder reorganizes itself around you like weather.
- **Data:** Full point pool, all DEMs (16m Table Mountain especially), all crime series.
- **Why:** It fuses the maker's two north stars — this piece and the walk-around VR point-sculpture ambition — into one build, and 'crime density as a medium you physically wade through' is an experience that flatly does not exist. The engine is already GPU-interpolated points; WebXR is 'only' a camera rig and hand-ray away.
- **Honesty:** Immersion raises the stakes on false precision: point jitter within precincts must be visually declared (soft cloud, no crisp street alignment), and density-at-your-body framed as reported volume, never 'you are standing somewhere dangerous'.

### 🌙 Grey Body Floor  `moonshot`
The field projected onto a gallery floor, a depth camera overhead. Step in, and your silhouette is sampled live into a few thousand matte-grey structure points — you literally become part of the frame, and the glowing data flows and pools around your feet, parting where you stand, re-closing behind you. Lie down on the Cape Flats and eighteen years of burglary laps against your outline. Children chase the December pulse across the floor; the data is never displaced or destroyed, only deflected — volume conserved even around a human body.
- **Data:** Any layout; depth-camera silhouette feeds the structure half of the point pool in real time.
- **Why:** The two-roles visual language made physical: humans join the piece on the structure side, glow stays truth. Body-scale flow-around interaction is arresting in a way no screen can be, and the conserved-flow constraint (dots deflect, never vanish) keeps even the spectacle honest.
- **Honesty:** Bodies render grey and glowless, always — a visitor must never light up as data. Deflection is a positional offset only; counts, density colour, and brightness stay faithful to the numbers throughout.

### 🌙 Sixty Steps  `weekend`
Phone in hand, go for a walk: DeviceMotion counts your steps, and each step advances one month of the pulse — sixty paces to walk April 2021 to March 2026, the field swelling and fading in your hand as you move down your own street. Stop walking and time stops. Haptic ticks (from Haptic Decembers) mark the spikes, so you feel a festive season arrive mid-stride.
- **Data:** 60-month pulse, optionally auto-anchored to the precinct you're walking in via Stand In Your Suburb.
- **Why:** It relocates the piece from the desk into the exact streets the dots describe — a five-minute walk becomes a five-year scrub through the place you're standing in. Ambulatory dataviz of local crime is essentially unexplored territory.
- **Honesty:** If anchored to the walker's location, all the Stand In Your Suburb rules apply: precinct granularity, client-side only, 'reported' framing — never 'this street'.

### Since You Arrived  `trivial`
One input: 'What year did you come to (or wake up in) the Western Cape?' The scrub anchors there, a thin grey tick marks your year, and the piece tells your tenure purely in point migration — the swarm plays forward from your arrival to now, and one closing line renders in dots, not digits: the net points that left or joined your district's field since you got here, flying out to a small counted cluster you can hover.
- **Data:** 18-year series per district/precinct; pairs naturally with Stand In Your Suburb.
- **Why:** The cheapest possible personalization with outsized emotional torque: 'since I arrived' converts an 18-year axis into a personal epoch. It reuses the existing scrub wholesale — one anchor tick and one delta-cluster layout.
- **Honesty:** The closing statement says 'reported X fell/rose since YEAR' — never 'it got safer'. Delta cluster is volume-true: one dot per reported crime of difference.

## EXOTIC STATISTICS MADE VISIBLE

### Crime Orbits  `project`
A phase portrait: x = robbery rate, y = murder rate (per-capita), and each of the 150 precincts is a comet whose 18-year history is its tail. Scrub the years and the whole field of comets crawls along its orbits — precincts that co-cycle trace loops, precincts that structurally changed (a new station, a taxi war) drift off on one-way trajectories. Each comet head is made of that precinct's actual crime dots, so a violent precinct is a fat bright comet, not just a marker. Swap the axes to any crime pair and watch the attractor reshape mid-flight.
- **Data:** 6 crimes × 18 SAPS years × 150 precincts, WorldPop per-capita; extendable to 31 more categories and 1,150 stations nationally
- **Why:** Nobody has seen SAPS data as a dynamical system. Loops vs drifts answer a real question — do robbery and murder move together or independently per place? — and the conserved-swarm engine makes the orbit crawl feel alive rather than diagrammatic.
- **Honesty:** Axes are per-capita, normalized once across the full 18-year window (never per-frame). Each comet head's dot count = real reported volume; positions in state space are precinct aggregates, so no street-level claim is introduced.

### The Season Wheel  `weekend`
The 60 monthly frames wrap onto an annual clock — April at twelve, March closing the circle — with five years as five concentric rings. Each month's actual dots swarm to their angle, so the December murder bulge appears as a physical lobe on the wheel, repeated ring after ring like tree growth. Switch crimes and the wheel's shape morphs: burglary's winter lean, sexual offences' festive-season swell. The existing monthly pulse becomes a shape you can compare at a glance instead of a rhythm you must remember.
- **Data:** 6 crimes × 60 months (Apr 2021–Mar 2026), province and 6 districts
- **Why:** Seasonality is the strongest signal in the monthly data and it is currently only experienceable as a loop in time; the wheel makes five years of rhythm one simultaneous, comparable form.
- **Honesty:** Radial scale fixed across all rings and all crimes in a comparison; rings labelled so a low-crime early year isn't read as an inner 'safe' core.

### Anomaly Flare  `project`
For every precinct-month, compute the expected count (same-calendar-month median across the other four years). Dots within expectation glow in the normal density ramp; the surplus dots above expectation burn white-hot and lift slightly off the terrain — you scrub the 60 months and watch anomalies flash across the province like lightning under cloud. Months below expectation show matte grey hollow rings where dots 'should' be. A taxi-violence spike or a festive-season surge stops being a number and becomes a flare you can't miss.
- **Data:** 6 crimes × 60 months × 150 precincts (expectation computed offline, baked as a per-dot flag)
- **Why:** Exceedance is the statistic residents actually feel ('it's worse than usual here, now'), and the glow-vocabulary engine is purpose-built for it: same dots, one extra brightness channel.
- **Honesty:** Every flaring dot is a real reported crime — the flare marks surplus over a stated baseline, shown on screen. Deficits are rendered in structure-grey hollow rings, never as glowing dots, because absence is frame, not data. A quiet month is never painted 'safe'.

### Phase-Shifted Pulses  `weekend`
Two crimes pulse side by side as two breathing swarms — robbery and carjacking, say — visibly out of step. You drag a lag slider and slide one pulse in time until the two swarms lock into breathing together; the lag you had to apply IS the cross-correlation lead, felt in your hand rather than read off a chart. A small grey correlation arc fills in as the sync improves, and the locked-lag value is stamped on screen. Run it per district and discover whether the metro leads the rural districts or vice versa.
- **Data:** 6 crimes × 60 months per district; nationally 37 categories × ~1,150 stations one parse away
- **Why:** Lead/lag is normally a table of r-values; making the user physically find the lag by syncing two living pulses is a genuinely new way to experience cross-correlation — and the monthly-pulse machinery already exists.
- **Honesty:** Both series normalized against the same fixed window; the on-screen correlation is reported with its lag and strength so a weak lock can't be over-read as causation.

### Poisson Fog  `weekend`
A precinct that recorded 1 murder this month and 2 last month has told you almost nothing about its true rate — so wrap every precinct's swarm in fog whose thickness is the width of the Poisson credible interval on its underlying rate. Metro precincts with hundreds of counts sit crisp and sharp-edged; tiny rural precincts dissolve into haze. Toggle it on over the per-capita view and watch exactly the precincts with the scariest-looking small-sample rates blur into honesty. The fog literally is the uncertainty.
- **Data:** Monthly counts (60 months) and yearly counts × 150 precincts, WorldPop denominators
- **Why:** Small-area per-capita rates are the most seductive lie in crime mapping; rendering sampling uncertainty as an atmospheric property of the field — rather than error bars — is exotic statistics made bodily visible.
- **Honesty:** Fog is structure-grey and matte (frame vocabulary, never glow), and it only widens what can be claimed — it never dims or hides the real dots.

### Double Exposure  `trivial`
Freeze the raw↔per-capita morph at t=0.5 and give every dot a motion trail: the whole province becomes a long-exposure photograph smeared between its two truths. Precincts where the two stories agree are sharp points; precincts where they violently disagree — dense townships that raw counts inflate, tiny-population CBDs that per-capita inflates — become long streaks whose direction says which story flatters them. The smear length is the statistic. Release, and the field snaps to whichever truth you choose.
- **Data:** Existing raw + per-capita layouts (already baked); works for all 6 crimes and every region
- **Why:** The per-capita toggle already exists as an either/or; this makes the disagreement itself the visible object, using nothing but the engine's own interpolation state — arguably the purest possible expression of this project's honesty principle.
- **Honesty:** Both endpoints are labelled on screen while frozen; the mid-state is explicitly a superposition of two normalizations, never presented as a third measurement.

### Last-Digit Forensics  `weekend`
A forensic gallery of the counts themselves: for each station, its precinct-month counts fall as dots into ten last-digit columns against a flat grey expectation line (genuine tallies have uniform last digits; human-fudged numbers heap on 0s and 5s). Most stations' columns sit level and dim; a station whose digits heap glows and rises out of the field like a witness under a spotlight. Because monthly murder counts are too small for Benford, the last-digit and repeated-value tests are the honest instruments here — and they work on exactly the data in hand.
- **Data:** 6 crimes × 60 months × 150 precincts (higher-count categories like assault GBH and shoplifting, one parse away, give the strongest signal); nationally ~1,150 stations
- **Why:** SAPS statistics manipulation is a real, documented public concern in South Africa; turning digit-preference tests into a visible gallery is journalism-grade forensics rendered in the project's own visual language.
- **Honesty:** Deviation is flagged as 'counts that don't behave like tallies — look closer', explicitly NEVER as fraud; small-sample stations get Poisson-fog treatment so noise can't masquerade as manipulation.

### Too Smooth  `weekend`
Real monthly counts jitter — Poisson variance roughly equals the mean. Render every station's 60-month series as a ribbon of its own dots: honest ribbons shimmer with natural noise, but a station whose counts are suspiciously under-dispersed freezes into rigid crystal, and runs of identical consecutive months fuse into hard visible bars. Slide across the province and the field reads as living water with occasional dead ice. It is a lie-detector built from the second moment of the data.
- **Data:** 6 crimes × 60 months × 150 precincts; dispersion index computed offline per station-crime
- **Why:** Under-dispersion is an exotic, rarely visualized forensic statistic, and mapping 'statistical liveliness' to literal visual liveliness (shimmer vs freeze) is a perfect fit for a field that already breathes.
- **Honesty:** Under-dispersion has innocent causes (quotas of court-driven detections, tiny true rates); label as 'behaves unlike count data', and always show the raw run of numbers on hover so the viewer judges the evidence directly.

### The Return Map  `weekend`
Plot each month against its successor — count(t) on x, count(t+1) on y — and let the 60 months run as a single comet chasing its own tail through the space. Pure noise makes a shapeless blob, seasonality traces a closed loop, a trend drifts diagonally: the crime's temporal character becomes a signature shape. Morph between the six crimes and watch the attractor melt from robbery's tight ellipse into commercial crime's scattered cloud. It is the cheapest possible window into whether next month is predictable from this one.
- **Data:** 6 crimes × 60 months, province and per district; 37 categories nationally one parse away
- **Why:** Return maps are a beloved tool of dynamical-systems people that has essentially never touched crime statistics; the engine's morphing makes comparing attractor shapes across crimes a single gesture.
- **Honesty:** Axes share one fixed scale per comparison set; the comet is an aggregate trace, drawn in a hybrid style (data-glow head, grey path) so the path itself isn't mistaken for crime volume.

### The Decomposition  `project`
Take a district's 18-year series and perform STL decomposition live in front of the viewer: the single glowing field splits into three co-registered sub-fields — a slow trend river, a breathing seasonal ring, and a shimmer of residual static — each made of a conserved share of the original dots. Hold them apart, study each component, then release and watch them fold back into the observed series exactly. You have literally watched a time series come apart into signal and noise and reassemble. Nothing is created or destroyed; the components sum to the truth by construction.
- **Data:** 6 crimes × 18 years (and × 60 months for the seasonal component) per district; decomposition baked offline
- **Why:** Decomposition is the workhorse of real statistical practice and is always shown as three stacked line charts; doing it as a conservation-obeying split of one living swarm is new, and it teaches what 'trend vs seasonal vs noise' means better than any textbook.
- **Honesty:** Dot allocation across components is proportional and the recombination is exact — the derived components are clearly framed as a model's reading of the same conserved total, not extra data.

### The Lorenz Bend  `weekend`
The law of crime concentration, performed by the dots themselves: every dot marches into one long line, precincts sorted from quietest to worst, and the cumulative curve sags away from the grey diagonal of perfect equality. The glowing area between curve and diagonal IS the Gini coefficient — a wound of light whose size you compare across crimes: carjacking's curve snaps almost vertical at the end (a handful of precincts host nearly everything) while burglary bends gently everywhere. Eighteen years scrubbable: watch concentration itself tighten or relax over two decades.
- **Data:** 6 crimes × 18 years × 150 precincts, per-capita via WorldPop; 31 more categories deepen the contrast (stock theft vs shoplifting)
- **Why:** Crime concentration is one of criminology's most robust findings and this data proves it locally; building the Lorenz curve out of the actual crime dots makes an abstract inequality statistic into a physical bend you feel.
- **Honesty:** Sorting and scale fixed across the crimes being compared; the diagonal is drawn in structure-grey as the reference frame it is.

### Shrinkage Gravity  `project`
Empirical-Bayes shrinkage as literal physics: every precinct's naive per-capita rate hangs in space, tethered by an elastic filament to its shrunk estimate, with population as mass. Hit the toggle and the field relaxes — tiny rural precincts with two murders and eight hundred people snap violently toward the provincial prior while the metros barely tremble. Tether length is exactly how much the naive number was lying to you. It is the statistically honest version of per-capita, rendered as gravity you can watch act.
- **Data:** 6 crimes × 18 years × 150 precincts + WorldPop populations; shrinkage model fit offline, baked as a second layout
- **Why:** Hierarchical shrinkage is the single most important idea in small-area statistics and almost nobody outside the field has ever SEEN it happen; the engine's two-layout morph is precisely the right instrument.
- **Honesty:** The prior and pooling model are stated on screen; both raw and shrunk endpoints stay reachable so the model never silently replaces the observations — and shrinkage must never be used to paint a genuinely violent small precinct as calm (the raw dots remain visible at tether's end).

### The Fault Lines  `project`
Run change-point detection over every precinct's 18-year series and render each precinct as a stratigraphic filament of its own dots rising through time on the terrain. Where the statistics genuinely broke — not drifted, broke — the filament shears sideways in a visible fault scarp. Private shocks scatter as isolated cracks; shared shocks align: the 2020 lockdown appears as one clean geological fault running through the entire province's strata at the same height. Crime history read the way a geologist reads a cliff face.
- **Data:** 6 crimes × 18 years × 150 precincts (change-points via PELT/binary segmentation, baked); DEMs supply the terrain the strata rise from
- **Why:** Change-point detection is exotic, rigorous, and answers 'when did this place actually change?' — and the strata/fault metaphor turns a hypothesis test into landscape, which is exactly this project's native tongue.
- **Honesty:** Detection threshold and minimum-segment rules stated; near-threshold breaks rendered as hairline cracks rather than full scarps so the model's confidence is visually legible.

### 🌙 Bootstrap Flicker  `project`
Resample every precinct-year from its Poisson posterior a thousand times and flicker through the alternative provinces at twenty frames a second. Persistence of vision does the statistics for you: structure that survives resampling fuses into steady solid glow, while detail at the noise floor shimmers like heat haze over a road. You are not looking at THE province; you are looking at the cloud of provinces consistent with the data — and your own retina performs the significance test. Tap to freeze on the one that actually happened.
- **Data:** 6 crimes × 18 years (or 60 months) × 150 precincts; ~1,000 pre-drawn resamples baked as compact per-dot jitter seeds
- **Why:** Uncertainty visualization by hypothetical-outcome flicker exists in academic papers as tiny chart multiples; doing it on a 180k-point living field, where the eye integrates a thousand possible worlds into one image, would be genuinely unprecedented.
- **Honesty:** Perturbation strictly within sampling uncertainty of reported counts (never a simulation of unreported crime); the observed frame is one keypress away and visually marked as the anchor.

### 🌙 Residual Choir  `project`
Sonify the anomalies through the maker's own scale-constrained voice instrument: scrub the 60-month pulse and each district sings — months within expectation hum near the tonic, anomalies leap intervals scaled to their z-score. Six crimes are six voices, so correlated crimes harmonize and a lead/lag relationship arrives at your ear as a canon, one voice echoing another a bar later. The province becomes a choir whose dissonance is literally its statistical surprise. Eyes on the field, ears on the residuals: two channels, one truth.
- **Data:** 6 crimes × 60 months × 6 districts (expected-vs-observed residuals, baked); Web Audio in-browser, voice design borrowed from the Loom iPad instrument
- **Why:** The maker already builds pitch instruments, so this is a bridge between his two practices; and lead/lag heard as musical canon is a channel for cross-correlation that vision simply doesn't have.
- **Honesty:** Pitch mapping is fixed and displayed (z-score → interval table); consonance is only ever 'as expected', never 'safe' — a district singing the tonic still has every one of its crime dots glowing on screen.

### 🌙 Walk the Attractor  `moonshot`
Room-scale VR: the three-axis phase space — murder, robbery, burglary rates — as a walk-around sculpture the size of your living room, with all 150 precincts' 18-year trajectories hanging as luminous ribbons in the dark. You duck under the metro cluster's thick braid, walk out to where a lone rural precinct's ribbon spirals away from everything, and grab any ribbon to run its eighteen years through your closed hand like rope. Structure-grey axis lattices recede; only the data ribbons glow. Statistics as a place you visit.
- **Data:** 6 crimes × 18 years × 150 precincts per-capita (extendable to ~1,150 national stations for a cathedral-scale version)
- **Why:** It fuses this project's engine with the maker's standing VR point-sculpture ambition, and a high-dimensional phase portrait is the one statistical object that genuinely NEEDS embodied 3D — parallax and locomotion resolve what no 2D projection can.
- **Honesty:** Same rules as flat space: per-capita axes normalized once across the set, ribbon thickness = real reported volume, all spatial scaffolding in matte grey so the room's geometry is never mistaken for crime.
