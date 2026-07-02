import { EventBus } from './EventBus.js';
import { ServiceRegistry, Services } from './ServiceRegistry.js';
import { GameLoop } from './GameLoop.js';
import { GameStateMachine } from './GameStateMachine.js';
import { MainMenuState } from './states/MainMenuState.js';
import { SettingsService } from '../config/SettingsService.js';
import { InputService } from '../input/InputService.js';
import { RenderService } from '../rendering/RenderService.js';
import { PostFxPipeline } from '../rendering/postfx/PostFxPipeline.js';
import { CameraDirector } from '../rendering/CameraDirector.js';
import { PhysicsService } from '../physics/PhysicsService.js';
import { WorldService } from '../world/WorldService.js';
import { AudioService } from '../audio/AudioService.js';
import { UIService } from '../ui/UIService.js';
import { FadeOverlay } from '../ui/components/FadeOverlay.js';
import { CinematicOverlay } from '../ui/components/CinematicOverlay.js';
import { SaveService } from '../save/SaveService.js';
import { StoryService } from '../gameplay/story/StoryService.js';
import { DebugOverlay } from '../debug/DebugOverlay.js';

/**
 * Engine — composition root. The ONLY place where services are constructed
 * and wired together; everything else receives dependencies.
 *
 * Boot order matters and is documented inline. After boot, the engine runs
 * the loop: fixed-step updates go to the state machine (the top state decides
 * what simulates), per-frame rendering goes camera -> post pipeline -> debug.
 */
export class Engine {
  services = new ServiceRegistry();
  stateMachine;

  #loop = new GameLoop();
  #postFx;
  #cameraDirector;
  #debug;
  #input;

  /**
   * @param {HTMLElement} viewport container for the WebGL canvas
   * @param {HTMLElement} uiRoot container for all 2D UI
   */
  constructor(viewport, uiRoot) {
    const events = new EventBus();
    this.services.register(Services.EVENTS, events);

    // Settings first: nearly everything reads configuration at construction.
    const settings = this.services.register(Services.SETTINGS, new SettingsService(events));
    this.#input = this.services.register(Services.INPUT, new InputService(events, settings));

    // Rendering stack.
    const renderer = this.services.register(
      Services.RENDERER,
      new RenderService(events, settings, viewport)
    );
    this.#postFx = this.services.register(
      Services.POST_FX,
      new PostFxPipeline(events, settings, renderer)
    );
    this.#cameraDirector = this.services.register(
      Services.CAMERA_DIRECTOR,
      new CameraDirector(events, settings)
    );

    // Simulation stack.
    const physics = this.services.register(Services.PHYSICS, new PhysicsService());
    this.services.register(
      Services.WORLD,
      new WorldService(events, settings, renderer, physics)
    );
    this.services.register(Services.STORY, new StoryService(events));
    this.services.register(Services.SAVE, new SaveService(events));

    // Presentation stack.
    this.services.register(Services.AUDIO, new AudioService(events, settings));
    this.services.register(Services.UI, new UIService(uiRoot));
    new FadeOverlay(events, uiRoot); // event-driven, needs no registry entry
    new CinematicOverlay(events, uiRoot); // letterbox + captions, same deal
    this.#debug = this.services.register(Services.DEBUG, new DebugOverlay(events, renderer));

    // State machine last — states pull services from the registry.
    this.stateMachine = new GameStateMachine(events);
    this.services.register(Services.STATE_MACHINE, this.stateMachine);

    // Impact frames: anything may request a simulation freeze for weight.
    events.on('time/hitstop', ({ duration }) => this.#loop.hitstop(duration));

    this.#loop.onUpdate((dt) => {
      this.stateMachine.update(dt);
      this.#input.endFrame();
    });
    this.#loop.onRender((alpha, frameDelta) => {
      this.#cameraDirector.update(frameDelta);
      this.#postFx.render(frameDelta);
      this.#debug.tick(frameDelta);
    });
  }

  start() {
    this.stateMachine.replace(new MainMenuState(this.services));
    this.#loop.start();
  }

  stop() {
    this.#loop.stop();
  }
}
