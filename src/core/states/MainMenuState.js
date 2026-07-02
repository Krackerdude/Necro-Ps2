import { GameState } from './GameState.js';
import { Services } from '../ServiceRegistry.js';
import { MainMenuScreen } from '../../ui/screens/MainMenuScreen.js';
import { OptionsScreen } from '../../ui/screens/OptionsScreen.js';
import { SaveLoadScreen } from '../../ui/screens/SaveLoadScreen.js';
import { CinematicState } from './CinematicState.js';
import { OPENING_SCRIPT } from '../../gameplay/cinematics/scripts.js';

/**
 * MainMenuState — 3D graveyard vista + the title UI.
 * The camera is manually driven along the level's authored push-in path.
 */
export class MainMenuState extends GameState {
  #screen = null;
  #menuCamera = null;
  #cameraTime = 0;
  #idleTime = 0;
  #attractShot = -1;
  #attractTimer = 0;

  enter() {
    const world = this.services.get(Services.WORLD);
    const cameraDirector = this.services.get(Services.CAMERA_DIRECTOR);
    const renderer = this.services.get(Services.RENDERER);
    const audio = this.services.get(Services.AUDIO);
    const ui = this.services.get(Services.UI);
    const events = this.services.get(Services.EVENTS);
    const save = this.services.get(Services.SAVE);
    const story = this.services.get(Services.STORY);

    const runtime = world.loadLevel('menu-vista', { story });
    this.#menuCamera = runtime.menuCamera;
    this.#cameraTime = 0;
    cameraDirector.setMode('manual');
    renderer.setCamera(cameraDirector.camera);
    audio.playAmbient(runtime.ambientTrack);

    window.addEventListener('keydown', this.#onAnyInput);
    window.addEventListener('pointerdown', this.#onAnyInput);

    this.#screen = new MainMenuScreen({
      events,
      ui,
      hasSaves: save.hasAnySave(),
      onNewGame: () => this.#startGame({ newGame: true }),
      onLoadGame: () => this.#openLoadMenu(),
      onOptions: () => this.#openOptions(),
    });
    ui.push(this.#screen);
  }

  exit() {
    window.removeEventListener('keydown', this.#onAnyInput);
    window.removeEventListener('pointerdown', this.#onAnyInput);
    this.services.get(Services.UI).clearScreens();
  }

  /** Any input wakes the menu out of attract mode. */
  #onAnyInput = () => {
    this.#idleTime = 0;
    this.#attractShot = -1;
  };

  update(dt) {
    this.services.get(Services.WORLD).update(dt);
    if (!this.#menuCamera) return;

    // Attract mode: idle long enough and the title starts cutting through
    // authored shots of the vista, PS2-style.
    this.#idleTime += dt;
    if (this.#idleTime > 22) {
      this.#updateAttract(dt);
      return;
    }

    // Slow ping-pong dolly along the authored path.
    this.#cameraTime += dt;
    const { from, to, lookAt, duration } = this.#menuCamera;
    const t = pingPong(this.#cameraTime / duration);
    const eased = t * t * (3 - 2 * t);
    const camera = this.services.get(Services.CAMERA_DIRECTOR).camera;
    camera.position.lerpVectors(from, to, eased);
    camera.lookAt(lookAt);
  }

  async #startGame(params) {
    // Dynamic import: GameplayState (and its states) statically import
    // MainMenuState for "quit to title", so this direction must stay lazy
    // to keep the module graph acyclic.
    const { GameplayState } = await import('./GameplayState.js');
    const machine = this.services.get(Services.STATE_MACHINE);
    if (params.newGame) {
      // The opening plays over the graveyard vista before the chapel loads.
      machine.replace(
        new CinematicState(this.services, {
          script: OPENING_SCRIPT,
          onComplete: () => machine.replace(new GameplayState(this.services), params),
        })
      );
      return;
    }
    machine.replace(new GameplayState(this.services), params);
  }

  #updateAttract(dt) {
    this.#attractTimer -= dt;
    if (this.#attractShot === -1 || this.#attractTimer <= 0) {
      this.#attractShot = (this.#attractShot + 1) % ATTRACT_SHOTS.length;
      this.#attractTimer = 6;
      const shot = ATTRACT_SHOTS[this.#attractShot];
      const camera = this.services.get(Services.CAMERA_DIRECTOR).camera;
      camera.position.set(...shot.pos);
      camera.lookAt(...shot.look);
    }
  }

  #openLoadMenu() {
    const ui = this.services.get(Services.UI);
    const screen = new SaveLoadScreen({
      mode: 'load',
      save: this.services.get(Services.SAVE),
      events: this.services.get(Services.EVENTS),
      onPick: (slot) => this.#startGame({ slot }),
      onBack: () => ui.remove(screen),
    });
    ui.push(screen);
  }

  #openOptions() {
    const ui = this.services.get(Services.UI);
    const screen = new OptionsScreen({
      settings: this.services.get(Services.SETTINGS),
      events: this.services.get(Services.EVENTS),
      input: this.services.get(Services.INPUT),
      onBack: () => ui.remove(screen),
    });
    ui.push(screen);
  }
}

function pingPong(t) {
  const cycle = t % 2;
  return cycle < 1 ? cycle : 2 - cycle;
}

/** Attract-mode shots of the menu vista (idle title, PS2 demo-disc style). */
const ATTRACT_SHOTS = [
  { pos: [-8, 1.1, 4], look: [0, 3, -14] },
  { pos: [10, 0.9, -6], look: [0, 4.5, -14] },
  { pos: [0.5, 0.8, -2.5], look: [5, 1.0, 8] },
  { pos: [3, 5, 11], look: [0, 2, -14] },
];
