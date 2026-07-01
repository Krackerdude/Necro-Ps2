import { GameState } from './GameState.js';
import { ModalUiState } from './ModalUiState.js';
import { PauseState } from './PauseState.js';
import { Services } from '../ServiceRegistry.js';
import { PlayerRig } from '../../gameplay/player/PlayerRig.js';
import { PlayerController } from '../../gameplay/player/PlayerController.js';
import { PlayerStats } from '../../gameplay/player/PlayerStats.js';
import { InteractionSystem } from '../../gameplay/interaction/InteractionSystem.js';
import { Wraith } from '../../gameplay/enemies/Wraith.js';
import { HudOverlay } from '../../ui/screens/HudOverlay.js';
import { NoteScreen } from '../../ui/screens/NoteScreen.js';
import { SaveLoadScreen } from '../../ui/screens/SaveLoadScreen.js';
import { GameOverScreen } from '../../ui/screens/GameOverScreen.js';
import { MainMenuState } from './MainMenuState.js';
import { STARTING_LEVEL_ID, getLevel } from '../../world/levels/registry.js';

/**
 * GameplayState — the running game: level, player, enemies, HUD.
 *
 * enter() params: { newGame: true } or { slot: 'auto' | 'slotN' }.
 *
 * Owns the session composition (which systems exist and how they're wired);
 * each system owns its own behavior. Save snapshots are assembled here via
 * the capture provider installed on SaveService.
 */
export class GameplayState extends GameState {
  #player = null;
  #stats = null;
  #enemies = [];
  #interaction = null;
  #hud = null;
  #playtime = 0;
  #unsubs = [];
  #dead = false;

  enter(params = {}) {
    const s = this.services;
    const events = s.get(Services.EVENTS);
    const world = s.get(Services.WORLD);
    const story = s.get(Services.STORY);
    const save = s.get(Services.SAVE);
    const renderer = s.get(Services.RENDERER);
    const cameraDirector = s.get(Services.CAMERA_DIRECTOR);
    const ui = s.get(Services.UI);

    // --- resolve the session source: fresh run or snapshot -------------
    let snapshot = null;
    if (params.slot) {
      snapshot = save.getSave(params.slot)?.data ?? null;
    }
    story.reset();
    if (snapshot) story.restoreState(snapshot.participants.story);
    this.#playtime = snapshot?.playtime ?? 0;
    this.#dead = false;

    // --- world (level geometry reflects story flags) --------------------
    const levelId = snapshot?.levelId ?? STARTING_LEVEL_ID;
    const runtime = world.loadLevel(levelId, story);

    // --- player ---------------------------------------------------------
    const rig = new PlayerRig(renderer.ps2Materials);
    this.#player = new PlayerController({
      events,
      input: s.get(Services.INPUT),
      physics: s.get(Services.PHYSICS),
      rig,
    });
    this.#stats = new PlayerStats(events);
    this.#player.spawnAt(runtime.spawn);
    if (snapshot) {
      this.#player.restoreState(snapshot.participants.player);
      this.#stats.restoreState(snapshot.participants.stats);
    }
    world.scene.add(this.#player.object);

    // --- enemies ---------------------------------------------------------
    this.#enemies = (runtime.enemySpawns ?? []).map((spawn, i) => {
      const wraith = new Wraith({
        ps2: renderer.ps2Materials,
        physics: s.get(Services.PHYSICS),
        events,
        spawn,
        playerObject: this.#player.object,
        playerStats: this.#stats,
      });
      wraith.restoreState(snapshot?.participants.enemies?.[i]);
      world.scene.add(wraith.object);
      return wraith;
    });

    // --- systems / camera / hud ------------------------------------------
    this.#interaction = new InteractionSystem(events, s.get(Services.INPUT));
    this.#interaction.bind(runtime.interactables, this.#player.object);

    cameraDirector.setZones(runtime.cameraZones, this.#player.object);
    renderer.setCamera(cameraDirector.camera);

    this.#hud = new HudOverlay({ events, settings: s.get(Services.SETTINGS) });
    ui.setHud(this.#hud);

    s.get(Services.AUDIO).playAmbient(runtime.ambientTrack);

    // --- saving -----------------------------------------------------------
    save.setCaptureProvider(() => this.#capture(levelId));
    if (!snapshot) save.autosave(); // a fresh run gets an immediate anchor

    // --- session event wiring ----------------------------------------------
    this.#unsubs = [
      events.on('ui/show-note', ({ title, body }) => this.#openNote(title, body)),
      events.on('ui/open-save-menu', () => this.#openSaveMenu()),
      events.on('player/died', () => this.#onDeath()),
    ];
  }

  exit() {
    for (const unsub of this.#unsubs) unsub();
    this.#unsubs = [];
    this.services.get(Services.SAVE).setCaptureProvider(null);
    this.services.get(Services.UI).clearHud();
    this.services.get(Services.UI).clearScreens();
    this.services.get(Services.WORLD).unload();
    this.#player = null;
    this.#enemies = [];
  }

  update(dt) {
    if (this.#dead) return;

    const input = this.services.get(Services.INPUT);
    if (input.wasPressed('pause')) {
      this.services
        .get(Services.STATE_MACHINE)
        .push(new PauseState(this.services));
      return;
    }

    this.#playtime += dt;
    this.services.get(Services.WORLD).update(dt);
    this.#player.update(dt);
    for (const enemy of this.#enemies) enemy.update(dt);
    this.#interaction.update();
  }

  /* ------------------------- save snapshot ------------------------- */

  #capture(levelId) {
    return {
      levelId,
      levelName: getLevel(levelId).name,
      playtime: Math.round(this.#playtime),
      condition: this.#stats.condition,
      participants: {
        player: this.#player.captureState(),
        stats: this.#stats.captureState(),
        story: this.services.get(Services.STORY).captureState(),
        enemies: this.#enemies.map((e) => e.captureState()),
      },
    };
  }

  /* --------------------------- modals ------------------------------ */

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
