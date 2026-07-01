import { GameState } from './GameState.js';
import { Services } from '../ServiceRegistry.js';
import { PauseScreen } from '../../ui/screens/PauseScreen.js';
import { OptionsScreen } from '../../ui/screens/OptionsScreen.js';
import { SaveLoadScreen } from '../../ui/screens/SaveLoadScreen.js';
import { MainMenuState } from './MainMenuState.js';

/**
 * PauseState — sits on the stack above GameplayState, freezing it.
 * Escape resumes (only when the pause screen itself is topmost — Options or
 * Load may be layered above it and own Escape then).
 */
export class PauseState extends GameState {
  #screen = null;

  enter() {
    const ui = this.services.get(Services.UI);
    this.#screen = new PauseScreen({
      events: this.services.get(Services.EVENTS),
      ui,
      hasSaves: this.services.get(Services.SAVE).hasAnySave(),
      onResume: () => this.#machine.pop(),
      onLoadGame: () => this.#openLoadMenu(),
      onOptions: () => this.#openOptions(),
      onQuit: () => this.#machine.replace(new MainMenuState(this.services)),
    });
    ui.push(this.#screen);
  }

  exit() {
    this.services.get(Services.UI).remove(this.#screen);
  }

  update() {
    const input = this.services.get(Services.INPUT);
    const ui = this.services.get(Services.UI);
    if (ui.isTop(this.#screen) && input.wasPressed('pause')) {
      this.#machine.pop();
    }
  }

  get #machine() {
    return this.services.get(Services.STATE_MACHINE);
  }

  #openLoadMenu() {
    const ui = this.services.get(Services.UI);
    const screen = new SaveLoadScreen({
      mode: 'load',
      save: this.services.get(Services.SAVE),
      events: this.services.get(Services.EVENTS),
      onPick: async (slot) => {
        // Dynamic import avoids a static GameplayState<->PauseState cycle.
        const { GameplayState } = await import('./GameplayState.js');
        this.#machine.replace(new GameplayState(this.services), { slot });
      },
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
