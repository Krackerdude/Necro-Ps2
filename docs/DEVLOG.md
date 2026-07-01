# DEVLOG — notes to future sessions

Newest entry first. Keep this honest and specific; it is the context bridge
when a session starts cold. Update it with EVERY meaningful change.

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
