# NECRO — Architecture Reference

Read this before adding code. It is the contract, not a suggestion.

## Principles (enforced)

1. **Composition root**: `core/Engine.js` is the ONLY place services are
   constructed and wired. Everything else receives dependencies (constructor
   injection or the registry handed to GameStates).
2. **No singletons, no globals**: the `ServiceRegistry` is the single
   intentional shared-state object. Never `export const instance = ...`.
3. **Events over references**: cross-domain communication goes through the
   `EventBus` with `domain/event-name` topics (catalog below). A system may
   hold direct references only to things injected into it.
4. **Composition over inheritance**: the only inheritance trees are
   `GameState` (application modes) and `Screen` (UI). Gameplay entities
   compose behaviors (see `Wraith` + `ai/PursuitBehavior`).
5. **No circular imports**: state-transition "back edges" (menu→game,
   pause→game) use dynamic `import()`. Keep it that way.
6. **Data-driven surfaces**: post effects (`effectRegistry`), options UI
   (`optionsSchema`), input (`actions.js` + settings), levels
   (`levels/*.js`), LUTs (`lutLibrary`). Extending these = adding an entry,
   not editing a system.
7. **No manager explosion**: services are capabilities (render, save, audio),
   feature logic lives in feature modules (gameplay/, world/levels/).
8. **No fake implementations**: unimplemented features are explicit TODOs
   (SSR in `effectRegistry.js`, occlusion in `rendering/culling/`).

## Boot & frame flow

```
main.js → new Engine(viewport, uiRoot) → engine.start()

Boot order (Engine ctor):
  events → settings → input → renderer → postFx → cameraDirector
  → physics → world → story → save → audio → ui → debug → stateMachine

Fixed update (60 Hz):        Per-frame render:
  stateMachine.update(dt)      cameraDirector.update(frameDt)
  input.endFrame()             postFx.render(frameDt)
                               debug.tick(frameDt)
```

The **top state decides what simulates**. GameplayState updates world, player,
enemies, interaction; PauseState/ModalUiState update nothing → the world
freezes (era-correct pause semantics).

## State stack

```
MainMenuState            (menu vista level + title UI)
GameplayState            (level + player + HUD)
  ├─ PauseState          (pushed; Esc)
  │    └─ Options/Load screens (UI-stack only, above the pause screen)
  └─ ModalUiState        (pushed; notes, save menu, game-over card)
```

`GameStateMachine` is a stack: `push/pop/replace`. UI screens live in a
separate stack inside `UIService` (HUD is its own persistent layer).
Rule of thumb: if gameplay must freeze, push a **state**; if it's purely
visual layering, push a **screen**.

## Event catalog

Add new events here when you introduce them.

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `settings/changed` | `{path, value}` | SettingsService | renderer, postFx, input, audio, world, ps2 materials |
| `input/action-pressed` / `-released` | `{action}` | InputService | debug, UI |
| `input/raw-key` | `{code}` | InputService (capture mode) | OptionsScreen rebind |
| `state/changed` | `{top}` | GameStateMachine | debug |
| `render/scene-changed` / `camera-changed` | `{scene\|camera}` | RenderService | PostFxPipeline |
| `render/resolution-changed` | `{width,height}` | RenderService | PostFxPipeline |
| `render/shadows-changed` | `{enabled}` | RenderService | (future: light baking) |
| `camera/zone-changed` | `{id}` | CameraDirector | debug, (future: per-shot audio/visibility) |
| `world/level-loaded` | `{levelId}` | WorldService | (future) |
| `story/flag-changed` | `{flag,value}` | StoryService | SaveService (autosave) |
| `player/stats-changed` | `{health,maxHealth,condition}` | PlayerStats | HUD |
| `player/died` | — | PlayerStats | GameplayState |
| `player/footstep` | `{running}` | PlayerController | (future: surface FX) |
| `interaction/prompt-changed` | `{prompt}` | InteractionSystem | HUD |
| `inventory/changed` | `{stacks,equipped}` | Inventory | InventoryScreen, HUD |
| `combat/aim-changed` | `{aiming}` | WeaponSystem | HUD |
| `combat/fired` | `{position,ranged}` | WeaponSystem | MuzzleFlash |
| `enemy/died` / `enemy/damaged` | `{}` | EnemyHealth | (future: score/FX) |
| `level/transition` | `{levelId,spawn}` | level interactables | GameplayState |
| `ui/fade` | `{opacity,duration}` | anyone | FadeOverlay |
| `ui/toast` | `{text}` | anyone | HUD |
| `ui/show-note` | `{title,body}` | levels | GameplayState (modal) |
| `ui/open-save-menu` | — | shrine interactable | GameplayState (modal) |
| `save/saved` | `{slot,auto}` | SaveService | HUD |
| `audio/sfx` | `{id}` | anyone | AudioService |

## Gameplay session composition

GameplayState composes two scopes:

- **Session scope** (lives across level transitions): PlayerController+Rig,
  PlayerStats, Inventory, WeaponSystem, MuzzleFlash, EnemyRoster (object),
  HUD. Serialized into saves via each system's captureState/restoreState.
- **Level scope** (rebuilt by `#enterLevel` on every transition): world
  runtime, colliders, camera zones, interactable bindings, roster population,
  ambient track.

Items are data (`gameplay/inventory/itemCatalog.js`); enemies register in
`EnemyRoster`'s ENEMY_TYPES; level loot/doors use the helpers in
`world/levels/levelHelpers.js` (`makeItemPickup`, `makeTransition`). Adding
content means adding entries, not editing systems.

Enemy death persistence: `enemyDead:<levelId>:<spawnIndex>` story flags.
Item persistence: `took:<pickupId>` story flags. Both ride inside saves.

## Rendering pipeline

Forward rendering (three.js) + `postprocessing` composer. **Why not
deferred**: three's material/lighting system is forward; a deferred G-buffer
pipeline would forfeit stock PBR and every material feature for marginal gain
at PS2 light counts. The extension seam is `effectRegistry.js` — new screen
effects are registry entries with a group (`ssao → dof → bloom → composite`
pass order). Convolution effects need their own group.

PS2 look, in order:
1. Low internal res (`display.resolution` × aspect × `resolutionScale`),
   CSS-stretched with `image-rendering: pixelated`.
2. `Ps2MaterialSystem.patch(material)` — injects vertex snapping + affine UV
   warp via `onBeforeCompile`; shared uniforms so toggles are instant.
3. Hard PCF shadows, ACES tone mapping, film grain/vignette in post.

Scaffolded-but-dormant (real code, disabled/unused by default):
reflection/environment probes (`rendering/probes/`), decals
(`rendering/decals/`), GPU instancing (`rendering/instancing/`, used by
levels), LOD (`rendering/lod/`), occlusion culling plan
(`rendering/culling/OcclusionCulling.js` — TODO doc, not fake code).

## Levels

A level module exports `{ id, name, build(ctx) }`. `build` receives
`{ kit, story, events, physics, settings }` and returns:

```js
{
  root,          // THREE.Group – everything visual
  colliders,     // THREE.Box3[] – static collision
  cameraZones,   // CameraZone[] – authored shots (see below)
  interactables, // { id, position, radius, prompt, canInteract?, onInteract }
  updatables,    // { update(dt) }[] – flicker, fog cards, idle animation
  spawn,         // { position, rotationY }
  enemySpawns,   // [{ type, position, homeRadius }]
  fog,           // { color, density } (FogExp2, gated by settings)
  ambientTrack,  // audio bed id
  menuCamera?,   // main-menu-only dolly path
}
```

**Levels are functions of story flags**: taken items and opened doors are
simply not built when their flag is set. Loading a save = restore flags,
rebuild level, restore transforms.

Camera grammar (keep it): every zone is a *composed shot* — high corner
surveillance, low dutch (use `rollDeg`), one-point corridors, foreground
occluders between lens and player. `trackTarget` pans from a fixed mount;
never write a free-follow camera.

## Saves

`SaveService` stores versioned snapshots in localStorage (slots: `auto`,
`slot1..3`). GameplayState installs a **capture provider** that assembles
`{ levelId, playtime, condition, participants: { player, stats, story,
enemies } }` from each system's `captureState()/restoreState()` pair.
Autosave fires on story-flag changes. New persistent systems: implement the
two methods, add to the participants map, bump `SAVE_VERSION` if the shape
breaks.

## UI

DOM overlay (no canvas UI). Design language lives in `ui/styles/*.css`:
bone/blood/ink palette, sheared display type, slash highlights, scanline
overlay. Screens extend `Screen`, are composed by states, and receive
callbacks — screens never touch services except those injected.
`optionsSchema.js` defines the Options rows; `input/actions.js` defines the
keybind rows.

## Performance posture

Architecture first; optimize on measurement (F3 overlay shows fps/draw
calls). Pre-dug optimization seams: instancing helper (used), LOD helper,
per-zone visibility sets (documented in OcclusionCulling.js), physics
backend swap (PhysicsService API), object pooling (DecalFactory notes).
