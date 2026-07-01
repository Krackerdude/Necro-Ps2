import { GameState } from './GameState.js';
import { Services } from '../ServiceRegistry.js';

/**
 * ModalUiState — freezes gameplay under a UI screen.
 *
 * Pushed on top of GameplayState for notes, save menus, etc. Because the
 * state machine only updates the topmost state, the world halts (era-correct)
 * while the screen is up. The screen's own callbacks are expected to pop this
 * state (the constructor caller wires that up).
 */
export class ModalUiState extends GameState {
  #screen;

  constructor(services, screen) {
    super(services);
    this.#screen = screen;
  }

  enter() {
    this.services.get(Services.UI).push(this.#screen);
  }

  exit() {
    this.services.get(Services.UI).remove(this.#screen);
  }
}
