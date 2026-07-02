import { GameState } from './GameState.js';
import { ModalUiState } from './ModalUiState.js';
import { PauseState } from './PauseState.js';
import { Services } from '../ServiceRegistry.js';
import { PlayerRig } from '../../gameplay/player/PlayerRig.js';
import { PlayerController } from '../../gameplay/player/PlayerController.js';
import { PlayerStats } from '../../gameplay/player/PlayerStats.js';
import { InteractionSystem } from '../../gameplay/interaction/InteractionSystem.js';
import { Inventory } from '../../gameplay/inventory/Inventory.js';
import { WeaponSystem } from '../../gameplay/combat/WeaponSystem.js';
import { GunFx } from '../../gameplay/combat/GunFx.js';
import { EnemyRoster } from '../../gameplay/enemies/EnemyRoster.js';
import { HudOverlay } from '../../ui/screens/HudOverlay.js';
import { NoteScreen } from '../../ui/screens/NoteScreen.js';
import { SaveLoadScreen } from '../../ui/screens/SaveLoadScreen.js';
import { InventoryScreen } from '../../ui/screens/InventoryScreen.js';
import { GameOverScreen } from '../../ui/screens/GameOverScreen.js';
import { MainMenuState } from './MainMenuState.js';
import { STARTING_LEVEL_ID, getLevel } from '../../world/levels/registry.js';

/**
 * GameplayState — the running game session.
 *
 * enter() params: { newGame: true } or { slot: 'auto' | 'slotN' }.
 *
 * Session-scoped objects (player, stats, inventory, weapons) live for the
 * whole state; level-scoped objects (world runtime, enemy roster bindings,
 * camera zones) are rebuilt by #enterLevel on every level transition.
 * This file owns composition and flow only — behavior lives in the systems.
 */
const TRANSITION_FADE = 0.45;

export class GameplayState extends GameState {
  #player = null;
  #stats = null;
  #inventory = null;
  #weapons = null;
  #gunFx = null;
  #roster = null;
  #interaction = null;
  #hud = null;
  #levelId = null;
  #playtime = 0;
  #unsubs = [];
  #dead = false;
  #transitioning = false;

  enter(params = {}) {
    const s = this.services;
    const events = s.get(Services.EVENTS);
    const story = s.get(Services.STORY);
    const save = s.get(Services.SAVE);
    const renderer = s.get(Services.RENDERER);

    // --- session source: fresh run or snapshot ---------------------------
    let snapshot = null;
    if (params.slot) snapshot = save.getSave(params.slot)?.data ?? null;
    story.reset();
    if (snapshot) story.restoreState(snapshot.participants.story);
    this.#playtime = snapshot?.playtime ?? 0;
    this.#dead = false;

    // --- session-scoped systems -------------------------------------------
    this.#inventory = new Inventory(events);
    if (snapshot) this.#inventory.restoreState(snapshot.participants.inventory);

    const rig = new PlayerRig(renderer.ps2Materials);
    this.#player = new PlayerController({
      events,
      input: s.get(Services.INPUT),
      physics: s.get(Services.PHYSICS),
      rig,
    });
    this.#stats = new PlayerStats(events);
    if (snapshot) this.#stats.restoreState(snapshot.participants.stats);

    // The visible held weapon tracks the equip slot.
    rig.setHeldWeapon(this.#inventory.equippedWeaponId);

    this.#roster = new EnemyRoster({
      events,
      physics: s.get(Services.PHYSICS),
      ps2: renderer.ps2Materials,
      story,
      playerObject: this.#player.object,
      playerStats: this.#stats,
    });

    this.#weapons = new WeaponSystem({
      events,
      input: s.get(Services.INPUT),
      inventory: this.#inventory,
      player: this.#player,
      physics: s.get(Services.PHYSICS),
      getEnemies: () => this.#roster.living(),
    });
    this.#gunFx = new GunFx(events);

    this.#interaction = new InteractionSystem(events, s.get(Services.INPUT));

    this.#hud = new HudOverlay({
      events,
      settings: s.get(Services.SETTINGS),
      inventory: this.#inventory,
      story,
    });
    s.get(Services.UI).setHud(this.#hud);

    // --- level ------------------------------------------------------------
    this.#enterLevel(snapshot?.levelId ?? STARTING_LEVEL_ID, null, snapshot);
    if (snapshot) this.#player.restoreState(snapshot.participants.player);

    // --- saving -----------------------------------------------------------
    save.setCaptureProvider(() => this.#capture());
    if (!snapshot) save.autosave(); // a fresh run gets an immediate anchor

    // --- session event wiring ----------------------------------------------
    this.#unsubs = [
      events.on('ui/show-note', ({ title, body }) => this.#openNote(title, body)),
      events.on('ui/open-save-menu', () => this.#openSaveMenu()),
      events.on('player/died', () => this.#onDeath()),
      // Condition is physical: DANGER means a limp, CAUTION a slowed pace.
      events.on('player/stats-changed', ({ condition }) => {
        this.#player?.setSpeedMultiplier(
          condition === 'DANGER' ? 0.6 : condition === 'CAUTION' ? 0.85 : 1
        );
      }),
      events.on('level/transition', (target) => this.#beginTransition(target)),
      events.on('inventory/changed', ({ equipped }) => rig.setHeldWeapon(equipped)),
    ];
    events.emit('ui/fade', { opacity: 0, duration: 0.6 });

    // Dev-only session handle for the console and smoke tests. Never ship
    // logic that depends on it.
    if (import.meta.env.DEV) {
      window.__necroSession = {
        player: this.#player,
        stats: this.#stats,
        inventory: this.#inventory,
        story: story,
        roster: this.#roster,
        gotoLevel: (levelId, spawn) => events.emit('level/transition', { levelId, spawn }),
      };
    }
  }

  exit() {
    for (const unsub of this.#unsubs) unsub();
    this.#unsubs = [];
    this.services.get(Services.SAVE).setCaptureProvider(null);
    this.services.get(Services.UI).clearHud();
    this.services.get(Services.UI).clearScreens();
    this.#roster.dispose();
    this.#player.object.removeFromParent();
    this.services.get(Services.WORLD).unload();
    this.#player = null;
    this.#roster = null;
  }

  update(dt) {
    if (this.#dead || this.#transitioning) return;

    const input = this.services.get(Services.INPUT);
    if (input.wasPressed('pause')) {
      this.services.get(Services.STATE_MACHINE).push(new PauseState(this.services));
      return;
    }
    if (input.wasPressed('inventory')) {
      this.#openInventory();
      return;
    }

    this.#playtime += dt;
    this.services.get(Services.WORLD).update(dt);
    this.#player.update(dt);
    this.#weapons.update(dt);
    this.#gunFx.update(dt);
    this.#roster.update(dt);
    this.#interaction.update();
  }

  /* ------------------------ level plumbing ------------------------- */

  /**
   * Load a level and rebind every level-scoped system.
   * @param {string} levelId
   * @param {string | null} spawnName named spawn point (transitions)
   * @param {object | null} snapshot full save snapshot (session start only)
   */
  #enterLevel(levelId, spawnName, snapshot = null) {
    const s = this.services;
    const world = s.get(Services.WORLD);
    const story = s.get(Services.STORY);
    const cameraDirector = s.get(Services.CAMERA_DIRECTOR);
    const renderer = s.get(Services.RENDERER);

    // Detach session objects so world disposal can't touch them.
    this.#roster.dispose();
    this.#player.object.removeFromParent();
    this.#gunFx.object.removeFromParent();

    const runtime = world.loadLevel(levelId, { story, inventory: this.#inventory });
    this.#levelId = levelId;
    if (!story.get(`visited:${levelId}`)) story.set(`visited:${levelId}`, true);

    const spawn = (spawnName && runtime.spawnPoints?.[spawnName]) ?? runtime.spawn;
    this.#player.spawnAt(spawn);
    world.scene.add(this.#player.object, this.#gunFx.object);

    this.#roster.populate(
      runtime.enemySpawns,
      world.scene,
      levelId,
      snapshot?.participants.enemies
    );
    this.#interaction.bind(runtime.interactables, this.#player.object);
    cameraDirector.setZones(runtime.cameraZones, this.#player.object);
    renderer.setCamera(cameraDirector.camera);
    s.get(Services.AUDIO).playAmbient(runtime.ambientTrack);
  }

  #beginTransition({ levelId, spawn }) {
    if (this.#transitioning) return;
    this.#transitioning = true;
    const events = this.services.get(Services.EVENTS);
    events.emit('audio/sfx', { id: 'doorTransition' });
    events.emit('ui/fade', { opacity: 1, duration: TRANSITION_FADE });
    setTimeout(() => {
      this.#enterLevel(levelId, spawn);
      this.services.get(Services.SAVE).autosave();
      events.emit('ui/fade', { opacity: 0, duration: TRANSITION_FADE });
      this.#transitioning = false;
    }, TRANSITION_FADE * 1000 + 80);
  }

  /* ------------------------- save snapshot ------------------------- */

  #capture() {
    return {
      levelId: this.#levelId,
      levelName: getLevel(this.#levelId).name,
      playtime: Math.round(this.#playtime),
      condition: this.#stats.condition,
      participants: {
        player: this.#player.captureState(),
        stats: this.#stats.captureState(),
        story: this.services.get(Services.STORY).captureState(),
        inventory: this.#inventory.captureState(),
        enemies: this.#roster.captureState(),
      },
    };
  }

  /* --------------------------- modals ------------------------------ */

  #openInventory() {
    const machine = this.services.get(Services.STATE_MACHINE);
    const screen = new InventoryScreen({
      inventory: this.#inventory,
      stats: this.#stats,
      events: this.services.get(Services.EVENTS),
      onClose: () => machine.pop(),
    });
    machine.push(new ModalUiState(this.services, screen));
  }

  #openNote(title, body) {
    const machine = this.services.get(Services.STATE_MACHINE);
    const screen = new NoteScreen({ title, body, onClose: () => machine.pop() });
    machine.push(new ModalUiState(this.services, screen));
  }

  #openSaveMenu() {
    const machine = this.services.get(Services.STATE_MACHINE);
    const save = this.services.get(Services.SAVE);
    const events = this.services.get(Services.EVENTS);
    const screen = new SaveLoadScreen({
      mode: 'save',
      save,
      events,
      onPick: (slot) => {
        save.save(slot);
        machine.pop();
      },
      onBack: () => machine.pop(),
    });
    machine.push(new ModalUiState(this.services, screen));
  }

  #onDeath() {
    if (this.#dead) return;
    this.#dead = true;
    const machine = this.services.get(Services.STATE_MACHINE);
    const save = this.services.get(Services.SAVE);
    const events = this.services.get(Services.EVENTS);
    const ui = this.services.get(Services.UI);

    const saves = save.listSaves();
    const latest = saves.sort((a, b) => b.meta.timestamp - a.meta.timestamp)[0];

    const screen = new GameOverScreen({
      events,
      ui,
      hasSaves: Boolean(latest),
      onLoadLast: () =>
        machine.replace(new GameplayState(this.services), { slot: latest.slot }),
      onQuit: () => machine.replace(new MainMenuState(this.services)),
    });
    machine.push(new ModalUiState(this.services, screen));
  }
}
