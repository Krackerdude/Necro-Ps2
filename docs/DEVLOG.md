# DEVLOG — notes to future sessions

Newest entry first. Keep this honest and specific; it is the context bridge
when a session starts cold. Update it with EVERY meaningful change.

---

## 2026-07-03 — Session 15: GRAVEN Phase E — the retcon pass

Act II's text now belongs to the same story as the town above. No ids,
flags, or geometry changed — writing only:
- **Warden's note**: the warden preceded Callum; he nailed the doors when
  he understood what the thanksgiving feeds; the pit is the apology.
- **Planting ledger**: gains Row 9 in an unpracticed hand — "the visitor
  with the camera... He is still seeing." (Mike's fate, implied, never
  stated.)
- **Verger's page**: the tower's dusk bell is the ECHO; the ossuary bell
  is the true one; ringing it puts the whole hungry arrangement to sleep.
- **Chapel**: display name → 'Graven Church' (id stays
  `chapel-of-the-hollow` — saves carry it); entrance door is now YOUR bar
  ("palms, flat and patient. No knocking anymore").
- **Objectives**: find-key/reach-bell/rest reworded into the frame;
  cloister gate toast says "church above — older than Graven".
- **END_NOTE**: the toll reaches the streets, the singing stops mid-note,
  and "somewhere below row nine, a camera strap."
Verified in-game: new objective text on church arrival, door toast, warden
note contains Graven/Callum/thanksgiving/pit. Zero errors.

---

## 2026-07-03 — Session 14: character designs + GRAVEN Phase D — the night

**Characters.** Townsfolk v2: defs now carry `hair` (short/long/bun/bald/
cap/hat), `beard`, `outfit` (coat/dress/robe), `apron`, `vest`, `build`
(girth), extended palette (hair/skirt/apron/vest/hat/beard). All 14 town
NPCs have unique looks. Townsfolk exposes `get head()` (night beats bolt
things onto it) and `pointAt(pos)` (raises the right arm — Mike's beat).
PlayerRig: dark hair, open collar, cross-body satchel + bag, belt.
Phase C interiors were DEFERRED by the user — jumped straight to D.

**The night.** `graven-town` builds from `story.get('nightfall')` — one
map, two truths. TownKit takes `{ windowsLit, lampsLit }` so the whole
vocabulary goes dark in one place. Night: cold moon key, dead lamps, dark
windows, church lancets glowing a low wrong red (the only guide light),
fog 0x090b12 @ 0.026, `townNight` ambient (the day track's corpse), FULL
hud (hudMinimal only by day), no NPCs.

Sequence (all flags, all autosaved):
1. Sleep at the inn → `sleptAtInn` + `nightfall` → transition to the same
   level, night build.
2. WINDOW_SCRIPT auto-plays on night entry until `windowSceneSeen`
   (GameplayState #enterLevel hook → #playScene). The churchyard has a pit
   that wasn't there + 12 congregation Townsfolk + torch FlickerLights,
   built only while the flag is unset; the onComplete re-transition clears
   the set.
3. Mike: translucent flickering Townsfolk in the square (interact '— Mike?'
   → pointAt(church) → captions → vanish → `mikeSeen`).
4. Rosa at the church-path mouth, back turned ('…Rosa?', gated on
   mikeSeen) → turns → split-jaw mesh bolted to her head + wraithShriek +
   impulse + '"You looked."' → `chaseStarted`.
5. THE CHASE: husk variant `neighbor` — speed 3.0 (run is 4.2 — walking
   dies), `detect 200`, `lose 400`, `xray: true` (hasLineOfSight stubbed
   true), `dressed: true` (keeps dusk coat colors, deterministic per
   post). NINE spawn across the districts `onlyIf: 'chaseStarted'` — the
   roster's live onlyIf re-check is what releases them mid-level. NEVER
   use `neighbor` outside a scripted chase.
6. Church doors (night + chaseStarted) → `doorsBarred` → transition to the
   chapel; BAR_DOORS_SCRIPT plays over the arrival once (`barSceneSeen`)
   — the chapel entrance "barred from the other side" is now barred by YOU.
   Retcon of chapel text is Phase E.
7. Death during the chase reloads the autosave anchored at nightfall (the
   inn door), per design: caught = retry from waking.

Night objectives inserted between Act I and Act II (self-complete for
saves already below). Verified headless end to end: sleep → window scene →
mike → reveal → swarm converging on screenshot → doors → bar cinematic →
chapel with 'Search the chapel…' objective. Zero page errors.

---

## 2026-07-03 — Session 13: GRAVEN Phase B — the town, the drive, Act I

New Game is now: title → 2-minute drive cinematic → the town of Graven at
dusk → photo quest across six districts → sleep at the inn → wake in the
chapel (stitch; Phase D replaces it with the night sequence).

- **TownKit** (world/builders/TownKit.js): the daytime vocabulary — houses
  (plaster body + solid attic prism closing the gables + overhanging plank
  panels + dusk-lit shuttered windows), market stalls, crates, boats,
  street lamps (`lit` adds a real point light — budget ~6/level, unlit ones
  glow by emissive), trees, fences, notice board, bollards, the lighthouse,
  and the car (returns `wheels` for the cinematic). Same `{object,
  colliders}` convention as ArchitectureKit; borrows its material cache.
  GOTCHA (user-caught): roof panels alone leave the gable triangles open —
  the attic prism (ExtrudeGeometry triangle) is what closes them.
- **gravenTown.js**: gate road (parked car = photograph pickup + letter
  document), square (fountain, stalls, notice board, bakery), boardwalk +
  two piers (rails, boats, harbor shack + ledger), main street (5 houses),
  the inn, church path + churchyard (lancet windows, 10 m tower, graves),
  east lane + lighthouse point. 15 camera zones, postcard grammar (high,
  warm, wide — deliberately kinder than the chapel's). `hudMinimal`, no
  enemySpawns ever. Surfaces: piers are wood.
- **The quest chain**: `dialogue/open` defs may pass `lines: () => [...]`
  (evaluated at open) + `onComplete` (fires on every FULL read — keep it
  idempotent). Chain flags: quest:rosa → quest:inn → quest:harbor →
  quest:lighthouse → quest:priest → sleptAtInn. Each key NPC gates on the
  previous flag (and Rosa on holding the photograph) and falls back to
  flavor lines otherwise. Objectives CHAIN got an Act I block; every town
  step also counts done for legacy saves via `visited:chapel-of-the-hollow`.
- **14 NPCs**: 5 quest (Rosa, Tobias, Aldous, Edda, Father Callum) + 9
  texture (Maren, Petr, Signe, Ilsa, Brammel, Yuri, Wren, kids Ana & Piet —
  Townsfolk now takes `scale`). All dialogue carries the same undertow:
  thanksgiving, generosity, nobody leaves, be indoors when the bell rings.
- **The drive** (coastRoad.js + DRIVE_SCRIPT): a treadmill set — the car
  never moves, guardrail posts/fences/trees/rocks flow past and wrap
  (band 90 m, 9 m/s), wheels spin via `rotateY` (local axle), body bobs.
  Every shot is authored around the origin. CinematicState now calls
  `world.update(dt)` so level updatables run under cinematics everywhere
  (fog drifts during the bell toll too; gameplay actors stay frozen).
  ~2 min of letter monologue, skippable. MainMenuState loads `coast-road`
  + `coastDrive` ambient before pushing the script.
- **STARTING_LEVEL_ID = graven-town.** Old saves keep working (they carry
  their own level id). Items: freshBread (heal 30), mikesPhotograph (key).
  Documents: mikesLetter, townNotice, harborLedger.
- Verified headless end-to-end: cinematic → skip → arrival objective →
  photograph pickup → all five quest flags in order → inn prompt flips to
  “Turn in for the night” → sleptAtInn → chapel loads with survival HUD
  back on. Zero page errors.
- Camera-authoring note: never place a zone camera near a house footprint —
  roofs now overhang 0.3+ m and eat the frame. High-over-the-sea-wall and
  street-mouth positions are the safe spots.

---

## 2026-07-02 — Session 12: GRAVEN Phase A — retitle, dialogue, townsfolk

The game is now **GRAVEN**. Big story restructure incoming (see plan): a
pre-chapel intro — drive-in cinematic, a cozy dusk harbor town you explore
for 30–60 min, 12–15 NPCs, inn sleep, night flip, full-town chase to the
chapel doors. Phases: A systems (this session) → B town by day → C
interiors/dialogue → D night+chase → E retcon existing levels.

- **Retitle**: MainMenuScreen h1, index.html, package.json, END_NOTE,
  README. Storage keys (`necro.saves.v1`/`necro.settings.v1`) deliberately
  unchanged so existing saves survive.
- **Dialogue system**: DialogueScreen (paged typewriter, 44 cps,
  `dialogueTick` sfx; E/Enter/Space/click = reveal-full then advance; Esc
  closes with NO credit). GameplayState listens for `'dialogue/open'
  {npc, def}` → modal push; sets `talked:<def.id>` ONLY on full completion,
  so required conversations can't be skimmed. NPC `faceToward(player)` on
  open, `faceRest()` on close.
- **Townsfolk entity** (gameplay/npcs/Townsfolk.js): palette-varied
  humanoid on the same skeleton family as the husks (deliberate — night
  makes the silhouette a threat). Idle breathe/sway/glance. `makeNpc()` in
  levelHelpers builds entity + collider + Talk interactable; ctx needs
  `{root, ps2: kit.ps2, events, updatables, colliders}`.
- **HUD minimal mode**: levels may return `hudMinimal: true`; GameplayState
  emits `'hud/mode' {minimal}` on every level entry; HudOverlay toggles
  `.hud-minimal` (hides condition + weapon readouts). Daytime GRAVEN is
  pure exploration — no combat, no enemySpawns, ever.
- **Town shell** (world/levels/gravenTown.js, id `graven-town`): one square
  + fountain + facades + sea wall + 3 NPCs (Rosa the baker, Aldous the
  harbormaster, Maren), warm dusk lighting (sun 0xffc27d, warm fog
  0xc9a075 @ 0.012), `townDay` ambient (breeze + gulls — the only kind
  track). Registered but NOT the starting level; it's the Phase B proving
  ground and will be replaced by the full town.
- **Gotcha — dialogue box CSS**: `clip-path` on a parent clips absolutely
  positioned children; the panel chrome lives on `.dialogue-box::before`
  (z-index:-1 inside the transform's stacking context) so the overhanging
  name plate isn't clipped.
- Verified headless: hud-minimal on in town, prompt → typewriter →
  `talked:baker` true on completion; Esc bail leaves `talked:harbormaster`
  unset AND doesn't leak into pause.
- Known placeholder: objective strip still shows chapel text in town —
  town objectives are Phase B; retcon of objectives/documents is Phase E.

---

## 2026-07-02 — Session 11: key auto-discard + Tier 7 (presentation)

- **Spent keys discard themselves**: key defs carry `spentWhen(story)` +
  `discardFlavor`; GameplayState sweeps satchel AND reliquary on every flag
  change (and once on load for old saves).
- **Cinematic system**: CinematicState runs data scripts (camera dollies,
  captions, waits, sfx/fade/impulse as instantaneous steps); E/Esc skips;
  exit restores zones with a director refresh. CinematicOverlay =
  letterbox + caption, event-driven ('ui/letterbox'/'ui/caption').
  Scripts in gameplay/cinematics/scripts.js: OPENING (New Game plays it
  over the menu vista before the chapel loads) and BELL (pushed over
  gameplay on bellRung; the END_NOTE shows after). Levels no longer own
  those beats — the bell interactable just sets the flag.
- **The RE door**: level transitions now cut to a dedicated void scene
  where a heavy wooden door swings open (DoorTransitionScene, promise-based
  self-driven animation since gameplay is frozen), then the next level.
- **Stingers**: 'enemy/alerted' (emitted on pursue start) → dissonant
  detect stab, throttled to one per 9 s; 'enemy/died' → soft low fifth.
- **Attract mode**: idle 22 s on the title → cuts through four authored
  vista shots; any input snaps back. Menu ambience gained a distant bell
  on an untrustworthy 12–18 s schedule.

---

## 2026-07-02 — Session 10: Tier 6 — systems depth

- **Combination**: recipes registry (gameplay/inventory/recipes.js);
  Inventory.combine consumes the pair, yields the result. Satchel gains
  combine mode (Combine button → pick partner, tiles pulse green, Esc backs
  out). Chain: graveMoss+linenStrips→mossPoultice; poultice+tonic→
  blessedSalve (full heal). New gatherables placed: moss (crypt, garth),
  linen (vestry, scriptorium).
- **Carry cap + reliquary**: the satchel is 8 STACKS (weapons/keys count).
  Pickups that don't fit stay in the world (beacon intact, flag unset).
  Shrines now open a ShrineScreen (Commit to Bone / The Reliquary / Rise);
  the reliquary is an uncapped Inventory instance shared by all shrines and
  saved as participants.itemBox. GOTCHA: both inventories emit
  'inventory/changed' — listeners must read the SATCHEL MODEL, not the
  payload (the held-weapon visual bug).
- **Puzzle primitive**: levelHelpers.makeItemSocket (place item → flag →
  gates anything). The ossuary icon socket is the reference usage.
- **Survey map** (M): levels author map.rooms/markers; GameplayState flags
  `mapSeen:<level>:<room>` as you walk (rooms match in order — nested rooms
  list first). MapScreen draws only walked rooms on canvas, shrine crosses,
  bell circle, door notches, blood-arrow player marker.
- Verified headless: combine ok, 8/8 cap blocks pickups without consuming
  them, reliquary transfer survives the save roundtrip, map renders.

---

## 2026-07-02 — Session 9: playtest fixes + Tier 5 (dressing density)

**Fixes from playtest:**
- Footsteps were too loud/bright: all four surface recipes dropped to
  ~0.10–0.13 peak and darker filters (stone lp 200–260 Hz, etc.).
- Wraiths were "insufferable": hp 150→90 (3 revolver rounds), pursue speed
  2.4, loseRadius 8.5, and PURSUIT FATIGUE — a hunt burns out after 6 s,
  then a 5 s aggro cooldown (hearNoise suppressed) while it drifts home.
  Pressure now comes in waves. RULE: relentless pursuit is only for scripted
  chase beats, never ambient enemies.

**Tier 5 — environmental storytelling:**
- Kit set-dressing vocabulary: candelabra, banner (procedural Hollow-sigil
  cloth w/ frayed alpha edge), urnNiche, boardedDoorway, votives,
  fallenStatue, sunkenCoffin, reachingNiche (arms from the walls),
  wallStain (alpha grime quads: damp/soot/scratch).
- New alpha textures: stainDamp/stainSoot/stainScratch/bannerCloth.
- Signature landmarks per room: nave = toppled saint; garth = half-sunken
  coffin; processional = reaching arms between the one-point walls; bell
  chamber = flanking banners. RULE: every authored camera shot should
  contain one memorable object.
- Documents system: gameplay/story/documents.js registry; levels call
  readDocument() (sets `doc:<id>`, rides in saves); the satchel now has a
  DOCUMENTS shelf (n/3 counter, re-read any collected paper).

---

## 2026-07-02 — Session 8: Tier 4 — ambience polish

- **Bell finale**: kit.bell exposes `userData.swing` (pivot at the beam);
  the ossuary animates a decaying toll swing (~9 s). GameplayState on
  bellRung: roster.killAll() (everything standing lies down) + ambient bed
  stops for 7.5 s of ringing "silence". Camera impulse 1.0 already there.
- **Footstep surfaces**: levels declare `surfaces: { default, regions:
  [{min:[x,z], max:[x,z], type}] }`; WorldService.getSurfaceAt resolves.
  Types: stone/wood/water/bone with distinct synthesized steps. Wading
  (water) also multiplies speed ×0.72 (terrain multiplier on the
  controller, separate from the condition multiplier). Chapel: vestry wood
  + crypt bone; cloister: garth water + scriptorium wood; ossuary: bone.
- **Condition audio**: DANGER lowpasses the ambient bed to 480 Hz and runs
  a 52 Hz lub-dub heartbeat on the master bus (AudioService.setCondition,
  fed from player/stats-changed in GameplayState).
- **Door beat**: makeTransition accepts `door` (mesh); on travel it creaks
  open a crack (rAF tween, 0.42 rad over 340 ms) before the fade. Wired on
  cloister→chapel and ossuary→cloister doors.
- **Examine view**: satchel dossier shows a rotating 3D model of the
  selected item (ExamineView: tiny dedicated low-res renderer, pixelated
  upscale, pedestal spin outside a 3/4 tilt). itemModels.js builds bespoke
  models for non-weapons (shell fold, tonic bottle, poultice, keys, icon);
  weapons reuse weaponModels. GL context disposed on screen close.
- Verified headless: surfaces resolve (water/stone/wood), wading slows,
  bell toll kills all 4 ossuary enemies and swings, examine renders.

---

## 2026-07-02 — Session 7: Tier 3 — enemy behavior texture

- **Husk variants** (spawn def `variant`, registry in Husk.js VARIANTS):
  shambler (baseline), watcher (dormant, `facing` authored; wakes on
  proximity/noise/pain — placed back-turned mid-processional and staring at
  the cloister gate), crawler (legless, prone rig, ground-drag gait, no
  knockdown, in the garth water and the ossuary skull piles), twitcher
  (violent torso spasms, faster — the nave spawn).
- **The grab**: pursuing husk lunges within 1.15 m → hold: control taken,
  5 dmg ticks/0.75 s (ignoreIframes), HUD panic banner, mash any action to
  break (0.2/press vs 0.25/s decay, hold caps at 3.2 s). Escape staggers
  the husk; grab cooldown 4.5 s. Damaging it breaks the hold. Event flow:
  grab/started → grab/struggle (from PlayerController mash) → grab/ended.
- **Noise/hearing**: 'noise/emitted' {position, radius} — walk 2.5, run 7,
  gunshot 16. EnemyRoster fans out to entities' hearNoise(). PursuitBehavior
  gained an **investigate** state: hearing sends enemies to WHERE THE SOUND
  WAS (sight can escalate en route); only noise inside loseRadius escalates
  straight to pursue. Lesson: plain "hear → pursue" self-cancels beyond
  loseRadius on the next tick — investigate is required.
- Verified headless: wraith closed 11.2→6.6 m toward a gunshot through
  walls; watcher held its pose then turned on approach; grab triggered,
  ticked damage, and broke on a ~30-press mash (escaped=true).
- Tuning note: mash escape assumes ≥5 presses/s; STRUGGLE_PER_PRESS 0.2.

---

## 2026-07-02 — Session 6: Tier 2 — camera impulse, blood, combat fairness

- **Camera impulse ("trauma")**: 'camera/impulse' {strength} → CameraDirector
  accumulates trauma, decays 1.6/s, squared falloff drives rotational shake
  over the authored base pose (base quaternion preserved — shots settle back
  EXACTLY). Emitters: gunshot 0.24, melee hit 0.35, player hurt 0.42, bell
  toll 1.0. Manual (menu) mode never shakes.
- **BloodFx**: era-style flat floor splats (spray on 'enemy/damaged', pool
  on 'enemy/died' — EnemyHealth now emits positions — 'blood/splat' for the
  player). FIFO cap 48/level, reset() on transitions. Wall sprays via
  DecalFactory remain a TODO.
- **Combat fairness fixes found by testing** (important design rules):
  1. Player i-frames: 0.9 s post-hit invulnerability in PlayerStats.damage
     (returns boolean; enemies only emit 'player/damaged' when it LANDS).
     Without this, adjacent enemies stun-lock.
  2. Attack input buffering: presses during flinch/recovery hold for 0.4 s
     and fire on recovery instead of being eaten (WeaponSystem).
  3. **Attacks are committed**: hurtFlinch must NOT play while rig.isActing —
     AnimationPlayer.play() REPLACES the current clip, which silently
     dropped the swing's pending 'hit' frame. Rule: never play a reaction
     clip over an attack clip; gate on rig.isActing.
  Verified: fair-spacing machete duel kills a husk in 4 swings while the
  player trades ~36 hp at knife range. That economy is intentional.

---

## 2026-07-02 — Session 5: weapon models

- `src/assets/models/weaponModels.js` — detailed low-poly procedural models
  (machete: extruded bolo blade, riveted wood grip, lanyard ring; revolver:
  octagonal barrel, fluted drum ringed with bone teeth, bird's-head grip,
  hammer/trigger/guard/sight). New textures: `rustBlade` (honed edge line +
  rust bloom), `gunMetal` (blued steel with holster wear).
- CONVENTION: models built along -Y, origin at the grip. They parent to the
  rig's right-hand anchor, so hanging arm = carried at the side, aim raise =
  pointed down-range, no per-pose math.
- HOLD_TRANSFORMS includes per-weapon SCALE (machete 1.45×, revolver 2.1×;
  pickups 2.4×): at 448p a true-scale handgun is 2 pixels. PS2 games
  oversized weapons for exactly this reason — keep doing it for new weapons.
- Held model tracks the equip slot via 'inventory/changed'; world pickups
  for weapons use the same builders (levels call buildWeaponModel(kit.ps2)).
- When real GLTF art arrives: replace a BUILDERS entry, keep the -Y/grip
  convention and HOLD_TRANSFORMS.

---

## 2026-07-02 — Session 4: Tier 1 combat feel (animation layer)

**The "weight" pass.** Everything verified headless: melee damage lands on
the strike frame (not button press), knockdown/rise cycle observed, DANGER
limp measured at 0.62× walk speed, zero console errors.

### New systems
- `src/animation/AnimationPlayer.js` — THE animation layer. Clips are plain
  data: keyed Euler tracks per named joint + frame events, smoothstep
  between keys, short fade-in blend, `isActing` lock. Deliberately not
  three's AnimationMixer (pivot-group rigs, frame events first-class).
- `GameLoop.hitstop(s)` + `'time/hitstop'` event — freezes simulation, not
  rendering. Melee contact 75 ms, gunshot hit 35 ms.
- Clips live in `gameplay/animation/` (playerClips.js, huskClips.js).
  AUTHORING RULE: clips return to the rig's BASE pose (husk torso 0.35,
  arms -0.5), not to zero.

### How attacks flow now
WeaponSystem no longer resolves damage on input. It plays a clip and
resolves on frame events: machete = 'windup' (swing sfx) → 'lunge'
(forward shove) → 'hit' at 0.37 s (target find + damage + hitstop);
revolver = 'fire' at 0.02 s (ammo, sfx, GunFx, hit + hitstop). Cooldown
covers clip duration. Player input is locked while `rig.isActing`.

### Rigs
Both PlayerRig and Husk restructured: torso is a waist pivot carrying head
+ arm pivots (lean/coil moves everything above), legs on the root. Joints
map + clip names are the contract future GLTF models must honor.

### Reactions
- Player: 'player/damaged' {from} (emitted by enemies alongside
  stats.damage) → hurtFlinch clip + knockback shove + 0.3 s stun.
  DANGER = 0.6× speed + asymmetric limp gait; CAUTION = 0.85×.
- Husk: any hit → directional stagger (whipped away from shooter, arms
  wide, balance step). Heavy hit (≥30 dmg) → 50% knockdown: root-motion
  fall backwards → 1.6 s down → rise clip (it gets back up, slow and
  wrong). No movement/damage while reacting.
- Wraith: hits cause a 0.28 s distortion — position jitter + visibility
  strobe + pursuit pause. Wraiths don't stagger; they glitch.
- GunFx (replaces MuzzleFlash): star flash sprite + light pop, ejected
  brass casing (gravity, bounce, 'casing' tick sfx), drifting smoke wisp.

### Notes / next
- [ ] Aim raise is a lerp (10/s) — feels right; revisit with viewmodel art.
- [ ] Knockdown chance is flat 0.5 on heavy hits; consider guaranteeing on
      crossing 50% hp for predictability.
- [ ] Tier 2 next: camera impulse service, blood decals (DecalFactory is
      still dormant), bodies persisting.

---

## 2026-07-02 — Session 3: playtest fixes (first user feedback pass)

All five reported issues fixed and regression-tested headless:

1. **Modal key leak** — closing a modal (Tab/Esc/E) re-delivered the same
   press to gameplay next tick (inventory reopened, pause opened, notes
   re-triggered interact). Fix: `InputService.clearPressed()`, called from
   `ModalUiState.exit()`. RULE: any new modal path must go through
   ModalUiState or call clearPressed on close.
2. **Autosave lost items** — pickups set the story flag BEFORE adding the
   item; the flag triggered autosave mid-beat → saves had `took:` flags with
   no item. Fix: inventory.add before story.set in levelHelpers + chapel
   icon, AND autosave is now microtask-debounced so a whole beat is captured
   atomically. RULE: mutate inventory before flags in any pickup-like beat.
3. **Void doors** — the cloister gate used to be removed on unlock (open gap
   into the void); it now stays closed forever (fade transition "through"
   it) with a black depth plane behind the bars + explicit collider. The
   ossuary entrance gap got a real door. RULE: every level-transition gap
   needs a physical door/gate mesh that never opens.
4. **Objective tracker** — `gameplay/story/objectives.js` (ordered chain of
   flag predicates; first not-done wins) + a stylized top-left HUD strip
   that slashes in on change. `visited:<levelId>` flags are set by
   GameplayState.#enterLevel and drive the "go there" steps. Extend the
   CHAIN when adding beats — nothing else needs wiring.
5. **Pickup visibility** — `world/effects/PickupBeacon.js`: spin + bob +
   additive breathing glow + periodic four-point star glint (RPG shine).
   Wired automatically by makeItemPickup (pass `updatables` in pickupCtx).
   Revolver mesh also brightened (was near-black).

---

## 2026-07-02 — Session 2: inventory, combat, enemies, levels 2 & 3

**State: full three-level arc playable.** Chapel → (icon opens trapdoor) →
Sunken Cloister → (Verdigris Key opens gate) → Ossuary → seat icon → ring
bell → demo end. Inventory (Tab), machete + revolver combat (hold Q, Space),
Husks + killable Wraiths, level transitions with fade + arrival autosave.
Combat verified numerically headless (revolver 150→74 over 2 shots, machete
70→48, ammo drain correct); save snapshots carry inventory.

### New systems (where things live)
- `gameplay/inventory/` — itemCatalog (ALL items are data), Inventory model.
- `gameplay/combat/` — WeaponSystem (aim/attack, cone+LOS targeting),
  EnemyHealth (hp/flash/dying/dead), MuzzleFlash.
- `gameplay/enemies/EnemyRoster.js` — ENEMY_TYPES registry, onlyIf-gated
  spawns (re-checked on flag changes), death flags, save capture.
- `world/levels/levelHelpers.js` — makeItemPickup / makeTransition /
  makePickupMesh. USE THESE in levels; don't hand-roll flags.
- `ui/screens/InventoryScreen.js` + satchel CSS; HUD weapon/ammo readout.
- `ui/components/FadeOverlay.js` — 'ui/fade' event, constructed in Engine.

### Decisions
- Aiming plants feet (turn-only), attack while ready: era grammar.
- No reload mechanic — revolver draws straight from the ammo pool. TODO if
  wanted later: chamber capacity + reload beat.
- Wraith hp 150 (≈4 rounds), husk 70 (2 rounds / 4 swings). Running still
  beats fighting for wraiths — keep that pressure economy.
- Old saves: crypt door accepts `inventory.has('blackIronKey') ||
  story.get('hasCryptKey')` (v1 saves stored the key as a flag).
- Dev handle: `window.__necroSession` (DEV builds only) exposes player,
  inventory, story, roster, gotoLevel — used by smoke tests; never ship
  logic on it.

### Rough edges / next candidates
- [ ] Enemy attack animations (contact damage is instant with cooldown).
- [ ] Wraith/husk pathing is straight-line + wall-slide; a nav mesh or
      corner-steering pass will matter in more complex rooms.
- [ ] Bell doesn't visually swing on the finale toll (hook exists: `bell`).
- [ ] Inventory has no discard/combine; tiles use glyphs (icon art seam is
      the tile renderer in InventoryScreen).
- [ ] Ammo economy untuned beyond first pass (20 rounds + 2 wraiths + 6
      husks in the full arc — deliberately tight, revisit with playtests).
- [ ] Cloister water is a flat plane; no wading SFX/slowdown in the garth.

---

## 2026-07-01 — Session 1: engine + first playable

**State: playable end-to-end.** Title → New Game → chapel → note → key →
crypt → wraith → icon → "end of build" note. Save/load, options (incl. full
rebinding), pause, game over all work. `npm run build` clean; smoke-tested
headless (Playwright + SwiftShader) with screenshots.

### Decisions made (don't relitigate without reason)
- Forward rendering + pmndrs `postprocessing`, NOT deferred — rationale in
  ARCHITECTURE.md. SSR + occlusion culling are explicit TODOs, not stubs.
- Tank controls, hard camera cuts, freeze-world pause: era grammar, on purpose.
- Vite 8 (rolldown): `manualChunks` must be the **function** form.
- `getLut()` returns a fresh texture per call — LUT3DEffect disposal would
  poison a cache. Don't re-add caching.
- Dynamic imports break state cycles: MainMenu→Gameplay and Pause→Gameplay
  are lazy. Keep back-edges lazy.
- three r185 physical lights: point-light intensities in levels are ~9–20
  (candela-ish), ambient ~2.2–2.4, exposure 1.25. If a scene looks black,
  it's this, not fog.
- MenuList skips disabled entries when navigating (tripped up the first
  smoke test; not a bug).

### Known rough edges / next candidates
- [ ] Player/enemy art: procedural rigs are placeholders with documented
      seams (PlayerRig TODO(art)). GLTF loader + AssetService not built yet
      (`Services.ASSETS` name reserved).
- [ ] Door transitions are open gaps + one locked door; no door-opening
      cut/animation ("door loading screen" à la RE would be a nice touch).
- [ ] No inventory — progression is story flags only. Fine for one key;
      won't scale past ~3 items.
- [ ] Wraith has no attack anim / player has no damage anim; contact damage
      with cooldown only. No way to kill it (by design — it's a hazard).
- [ ] SaveLoadScreen: mouse-first; add full keyboard nav + delete-slot.
- [ ] Volumetric fog = FogExp2 + drifting fog cards (era-authentic). True
      raymarch would be a new postfx group (notes in FogCards.js).
- [ ] SSAO NormalPass runs full internal res; fine at 448p, revisit if perf.
- [ ] `display.resolution` is internal render height only — browser "real"
      resolution/fullscreen modes not applicable; revisit if we add
      fullscreen API support.
- [ ] Audio is all synthesized; sfxLibrary/ambientTracks are the seams for
      real samples.
- [ ] No tests. If logic grows (inventory, combat math), add Vitest for the
      pure modules (physics resolution, save shape, story flags).

### Gotchas
- InputService `wasPressed` is cleared by `Engine` (input.endFrame) after the
  state update — only the top state reliably sees presses. Intentional.
- `disposeObject3D` disposes material textures; ArchitectureKit clones
  cached procedural textures per material so the cache survives. Keep clones.
- ArchitectureKit colliders are computed at build time from world matrices —
  don't reposition pieces after `add()` (use builder opts like `yBase`).
- Playwright smoke script lives in the session scratchpad, not the repo;
  recreate as needed (chromium at /opt/pw-browsers/chromium, SwiftShader flags).

### Tuning values that matter
- Player: walk 2.1, run 4.2, back 1.3, turn 0.85π rad/s, radius 0.32.
- Wraith: haunt 0.7 / pursue 2.6 / return 1.2; detect 5.5 (LOS-gated),
  lose 10; contact 18 dmg, 1.2 s cooldown. Running player escapes; walking
  player gets caught. Keep that inequality.
- Fixed step 60 Hz; frame delta clamp 0.25 s.
