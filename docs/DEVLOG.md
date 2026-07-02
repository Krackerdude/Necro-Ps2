# DEVLOG — notes to future sessions

Newest entry first. Keep this honest and specific; it is the context bridge
when a session starts cold. Update it with EVERY meaningful change.

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
