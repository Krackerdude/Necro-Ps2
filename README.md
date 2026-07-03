# GRAVEN

*A PS2-era survival horror game. Fixed cameras. Vertex wobble. A letter, a town, a thing below.*

Built on **Three.js** with a custom engine layer: event-driven, service-based, composition-first.
This README evolves with the project — see `docs/DEVLOG.md` for session-by-session state.

---

## Running it

```bash
npm install
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # production build to dist/
npm run preview   # serve the production build
```

Deploys on **Vercel** with zero config (auto-detected Vite static build).

## Controls (default — all rebindable in Options → Keybinds)

| Action | Keys |
|---|---|
| Move forward / back | `W` / `S` (tank controls) |
| Turn left / right | `A` / `D` |
| Run | `Shift` |
| Quick turn (180°) | `C` |
| Interact / confirm | `E` |
| Ready weapon (hold) | `Q` |
| Attack (while ready) | `Space` |
| Inventory | `Tab` / `I` |
| Pause | `Esc` |
| Debug overlay | `F3` |

## What's in the current build

- **Main menu** — 3D graveyard vista with a slow camera push-in, stylized 2D overlay
  (New Game / Load Game / Options).
- **Act I: the town of Graven** — New Game opens on a two-minute drive-in
  cinematic (a letter from a friend who stopped writing), then a fully
  explorable harbor town at dusk: gate road, square, boardwalk and piers,
  main street, churchyard, lighthouse point. Fourteen townsfolk with paged
  typewriter dialogue; a photo-quest chain (baker → innkeeper → harbormaster
  → lighthouse keeper → priest) that ends with a room at the inn. Daytime is
  pure exploration — no combat, minimal HUD.
- **Three levels below, one arc** — *Chapel of the Hollow* (note → Black Iron Key →
  crypt → Hollow Icon) opens a trapdoor to *The Sunken Cloister* (flooded garth,
  husks on the walks, the Verdigris Key in the black water), which unlocks
  *Ossuary of the Hollow* (bone corridors, the Bell Chamber, and the finale:
  seat the icon, ring the hour). Level transitions fade through black and
  autosave on arrival; keys and progress carry across levels.
- **Inventory** — a data-driven item catalog (weapons, ammo, consumables, key
  items) behind a stylized satchel screen (`Tab`): examine, use, equip. Loot is
  placed in the world and stays taken across saves.
- **Weapons & combat** — hold `Q` to plant your feet and ready the equipped
  weapon, `Space` to attack. Rust-Eaten Machete (melee arc) and Ossuary
  Revolver (hitscan with line-of-sight, consumes Tallow Rounds). Muzzle flash,
  hit flashes, synthesized gunshots.
- **Enemies** — Husks (slow, relentless shamblers with long memories) and
  Wraiths (fast pursuit hazards, now killable at a price). Deaths persist per
  spawn; some spawns are story-gated (open the crypt and something wanders up).
- **Fixed camera direction** — authored shots per room volume: high corner
  surveillance, low dutch angles, one-point corridor perspective, with camera roll
  and per-shot FOV.
- **PS2 rendering** — low internal resolution with nearest upscale, vertex snapping,
  affine texture warp, PBR materials underneath, hard shadow maps.
- **Post pipeline** — SSAO, bloom, film grain, vignette on by default; depth of field,
  chromatic aberration, lens distortion, color-grading LUTs (4 included) off by
  default. All toggleable live in Options.
- **Save system** — 3 manual slots (at ossuary shrines) + autosave on story progress.
  Saves capture exact player position/rotation, stats, story flags, enemy state,
  and playtime.
- **Options** — Display (internal resolution, resolution scale, FOV, raw upscale),
  Graphics (every effect), Audio (bus volumes), Keybinds (full rebinding).
- **Procedural everything (for now)** — textures, character rig, and audio are all
  generated in code; each has a documented seam where real assets slot in.

## Repository layout

```
src/
  core/        Engine (composition root), game loop, event bus, DI registry,
               state machine + application states
  config/      Settings service + the default settings schema
  input/       Action-based input, key labels, rebinding support
  rendering/   Renderer, PS2 material system, camera director, post FX
               (+ probes, decals, instancing, LOD, culling scaffolds)
  physics/     Minimal AABB collision world (swappable seam)
  world/       World service, level definitions, architecture kit,
               atmosphere effects (flicker lights, fog cards)
  gameplay/    Player (rig/controller/stats), interaction, enemies, story flags
  ai/          Reusable behaviors (pursuit brain)
  audio/       WebAudio buses, synthesized SFX + ambient beds
  ui/          UI service, screens (menus/HUD), design-language CSS
  save/        Save slots + snapshot plumbing
  debug/       F3 overlay
  assets/      Procedural texture generators
  utils/       Small shared helpers
docs/
  ARCHITECTURE.md   System map, event catalog, conventions — read before adding code
  DEVLOG.md         Running state-of-the-project notes (context for future sessions)
```

## Architecture in one paragraph

The **Engine** (`src/core/Engine.js`) is the only composition root: it constructs
every service and registers it in a small DI container. Systems communicate
through the **EventBus** (`domain/event-name` topics) or explicit constructor
injection — never by importing each other's singletons. Application flow is a
**state stack** (MainMenu → Gameplay ⇄ Pause/Modals), gameplay simulates on a
fixed 60 Hz step, rendering runs per-frame through a declarative **post-FX
registry**. Levels are data+builder modules that return everything a session
needs (geometry, colliders, camera shots, interactables, spawns). Full detail
in `docs/ARCHITECTURE.md`.
