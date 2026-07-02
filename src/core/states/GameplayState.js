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
import { BloodFx } from '../../gameplay/combat/BloodFx.js';
import { EnemyRoster } from '../../gameplay/enemies/EnemyRoster.js';
import { HudOverlay } from '../../ui/screens/HudOverlay.js';
import { NoteScreen } from '../../ui/screens/NoteScreen.js';
import { SaveLoadScreen } from '../../ui/screens/SaveLoadScreen.js';
import { ShrineScreen } from '../../ui/screens/ShrineScreen.js';
import { ItemBoxScreen } from '../../ui/screens/ItemBoxScreen.js';
import { MapScreen } from '../../ui/screens/MapScreen.js';
import { InventoryScreen } from '../../ui/screens/InventoryScreen.js';
import { GameOverScreen } from '../../ui/screens/GameOverScreen.js';
import { MainMenuState } from './MainMenuState.js';
import { STARTING_LEVEL_ID, getLevel } from '../../world/levels/registry.js';
import { ITEMS } from '../../gameplay/inventory/itemCatalog.js';
import { CinematicState } from './CinematicState.js';
import { BELL_SCRIPT, END_NOTE } from '../../gameplay/cinematics/scripts.js';
import { DoorTransitionScene } from '../../world/effects/DoorTransitionScene.js';

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

const SURFACE_FOOTSTEPS = {
  stone: 'footstep',
  wood: 'footstepWood',
  water: 'footstepWater',
  bone: 'footstepBone',
};

export class GameplayState extends GameState {
  #player = null;
  #stats = null;
  #inventory = null;
  #itemBox = null;
  #weapons = null;
  #gunFx = null;
  #bloodFx = null;
  #roster = null;
  #interaction = null;
  #hud = null;
  #levelId = null;
  #currentRoomId = null;
  #playtime = 0;
  #unsubs = [];
  #dead = false;
  #transitioning = false;
  #doorScene = null;
  #lastDetectStinger = 0;

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
    // The satchel is capped (carry pressure); the reliquary is not.
    this.#inventory = new Inventory(events, { maxSlots: 8 });
    if (snapshot) this.#inventory.restoreState(snapshot.participants.inventory);
    this.#itemBox = new Inventory(events);
    if (snapshot) this.#itemBox.restoreState(snapshot.participants.itemBox);

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
    this.#bloodFx = new BloodFx(events);

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

    // Old saves may carry keys that were already spent.
    this.#discardSpentKeys();

    // --- saving -----------------------------------------------------------
    save.setCaptureProvider(() => this.#capture());
    if (!snapshot) save.autosave(); // a fresh run gets an immediate anchor

    // --- session event wiring ----------------------------------------------
    this.#unsubs = [
      events.on('ui/show-note', ({ title, body }) => this.#openNote(title, body)),
      events.on('ui/open-save-menu', () => this.#openShrine()),
      events.on('player/died', () => this.#onDeath()),
      // Condition is physical: DANGER means a limp, a muffled world, and a
      // heartbeat under everything.
      events.on('player/stats-changed', ({ condition }) => {
        this.#player?.setSpeedMultiplier(
          condition === 'DANGER' ? 0.6 : condition === 'CAUTION' ? 0.85 : 1
        );
        s.get(Services.AUDIO).setCondition(condition);
      }),
      // Footsteps sound like what they land on.
      events.on('player/footstep', () => {
        const surface = s.get(Services.WORLD).getSurfaceAt(this.#player.object.position);
        events.emit('audio/sfx', { id: SURFACE_FOOTSTEPS[surface] ?? 'footstep' });
      }),
      // A key whose every lock is open leaves the satchel on its own.
      events.on('story/flag-changed', () => this.#discardSpentKeys()),
      // The hour is told: the ambient bed dies, everything standing lies
      // down, and the toll plays as a directed scene ending on the note.
      events.on('story/flag-changed', ({ flag, value }) => {
        if (flag !== 'bellRung' || !value) return;
        this.#roster.killAll();
        const audio = s.get(Services.AUDIO);
        audio.stopAmbient();
        setTimeout(() => audio.playAmbient('ossuary'), 9000);
        const machine = s.get(Services.STATE_MACHINE);
        machine.push(
          new CinematicState(this.services, {
            script: BELL_SCRIPT,
            onComplete: () => {
              machine.pop();
              events.emit('ui/show-note', END_NOTE);
            },
          })
        );
      }),
      // Music stingers: a dissonant stab when something first notices you
      // (throttled), a low resolution when something dies.
      events.on('enemy/alerted', () => {
        if (performance.now() - this.#lastDetectStinger < 9000) return;
        this.#lastDetectStinger = performance.now();
        events.emit('audio/sfx', { id: 'stingerDetect' });
      }),
      events.on('enemy/died', () => events.emit('audio/sfx', { id: 'stingerKill' })),
      events.on('level/transition', (target) => this.#beginTransition(target)),
      // Read the satchel model, not the payload — the reliquary emits the
      // same event and must not unequip the held weapon.
      events.on('inventory/changed', () =>
        rig.setHeldWeapon(this.#inventory.equippedWeaponId)
      ),
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
    if (input.wasPressed('map')) {
      this.#openMap();
      return;
    }

    this.#playtime += dt;
    const world = this.services.get(Services.WORLD);
    world.update(dt);
    this.#trackSurveyRoom(world);
    // Wading through water costs speed (and dignity).
    this.#player.setTerrainMultiplier(
      world.getSurfaceAt(this.#player.object.position) === 'water' ? 0.72 : 1
    );
    this.#player.update(dt);
    this.#weapons.update(dt);
    this.#gunFx.update(dt);
    this.#roster.update(dt);
    this.#interaction.update();
  }

  /** Remove key items whose every use is behind them (from satchel AND
   *  reliquary). Data-driven off `spentWhen` in the item catalog. */
  #discardSpentKeys() {
    const story = this.services.get(Services.STORY);
    const events = this.services.get(Services.EVENTS);
    for (const [id, def] of Object.entries(ITEMS)) {
      if (def.kind !== 'key' || !def.spentWhen || !def.spentWhen(story)) continue;
      for (const container of [this.#inventory, this.#itemBox]) {
        if (container?.has(id)) {
          container.remove(id, container.count(id));
          events.emit('ui/toast', { text: def.discardFlavor ?? `The ${def.name} is spent.` });
        }
      }
    }
  }

  /** The survey only draws rooms you have stood in. */
  #trackSurveyRoom(world) {
    const rooms = world.runtime?.map?.rooms;
    if (!rooms) return;
    const p = this.#player.object.position;
    const room = rooms.find(
      (r) => p.x >= r.min[0] && p.x <= r.max[0] && p.z >= r.min[1] && p.z <= r.max[1]
    );
    if (!room || room.id === this.#currentRoomId) return;
    this.#currentRoomId = room.id;
    const story = this.services.get(Services.STORY);
    const flag = `mapSeen:${this.#levelId}:${room.id}`;
    if (!story.get(flag)) story.set(flag, true);
  }

  #openMap() {
    const world = this.services.get(Services.WORLD);
    if (!world.runtime?.map) return;
    const machine = this.services.get(Services.STATE_MACHINE);
    const screen = new MapScreen({
      levelName: getLevel(this.#levelId).name,
      map: world.runtime.map,
      story: this.services.get(Services.STORY),
      levelId: this.#levelId,
      playerObject: this.#player.object,
      events: this.services.get(Services.EVENTS),
      onClose: () => machine.pop(),
    });
    machine.push(new ModalUiState(this.services, screen));
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
    this.#bloodFx.reset();
    this.#bloodFx.object.removeFromParent();

    const runtime = world.loadLevel(levelId, { story, inventory: this.#inventory });
    this.#levelId = levelId;
    if (!story.get(`visited:${levelId}`)) story.set(`visited:${levelId}`, true);

    this.#currentRoomId = null;
    const spawn = (spawnName && runtime.spawnPoints?.[spawnName]) ?? runtime.spawn;
    this.#player.spawnAt(spawn);
    world.scene.add(this.#player.object, this.#gunFx.object, this.#bloodFx.object);

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

  /** The iconic beat: darkness, a door swings open, the next room. */
  #beginTransition({ levelId, spawn }) {
    if (this.#transitioning) return;
    this.#transitioning = true;
    const events = this.services.get(Services.EVENTS);
    const renderer = this.services.get(Services.RENDERER);
    if (!this.#doorScene) this.#doorScene = new DoorTransitionScene(renderer.ps2Materials);

    events.emit('ui/fade', { opacity: 1, duration: 0.22 });
    setTimeout(() => {
      renderer.setScene(this.#doorScene.scene);
      renderer.setCamera(this.#doorScene.camera);
      events.emit('ui/fade', { opacity: 0, duration: 0.18 });
      events.emit('audio/sfx', { id: 'doorTransition' });
      this.#doorScene.play(1500).then(() => {
        events.emit('ui/fade', { opacity: 1, duration: 0.22 });
        setTimeout(() => {
          this.#enterLevel(levelId, spawn);
          this.services.get(Services.SAVE).autosave();
          events.emit('ui/fade', { opacity: 0, duration: TRANSITION_FADE });
          this.#transitioning = false;
        }, 260);
      });
    }, 260);
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
        itemBox: this.#itemBox.captureState(),
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
      ps2: this.services.get(Services.RENDERER).ps2Materials,
      story: this.services.get(Services.STORY),
      onClose: () => machine.pop(),
    });
    machine.push(new ModalUiState(this.services, screen));
  }

  #openNote(title, body) {
    const machine = this.services.get(Services.STATE_MACHINE);
    const screen = new NoteScreen({ title, body, onClose: () => machine.pop() });
    machine.push(new ModalUiState(this.services, screen));
  }

  /** Praying at the bones: save, or open the reliquary. */
  #openShrine() {
    const machine = this.services.get(Services.STATE_MACHINE);
    const events = this.services.get(Services.EVENTS);
    const ui = this.services.get(Services.UI);
    const screen = new ShrineScreen({
      events,
      ui,
      onSave: () => {
        machine.pop();
        this.#openSaveMenu();
      },
      onBox: () => {
        machine.pop();
        this.#openItemBox();
      },
      onLeave: () => machine.pop(),
    });
    machine.push(new ModalUiState(this.services, screen));
  }

  #openItemBox() {
    const machine = this.services.get(Services.STATE_MACHINE);
    const screen = new ItemBoxScreen({
      satchel: this.#inventory,
      box: this.#itemBox,
      events: this.services.get(Services.EVENTS),
      onBack: () => machine.pop(),
    });
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
