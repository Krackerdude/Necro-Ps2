/**
 * GameState — base class for top-level application states.
 *
 * States are coarse application modes (Main Menu, Gameplay, Pause), not
 * gameplay logic. They live in a stack managed by GameStateMachine, so Pause
 * can sit on top of Gameplay without tearing the world down.
 *
 * Lifecycle:
 *   enter(params)  — state becomes topmost (pushed, or revealed by a pop? no:
 *                    only on push/replace; reveals get resume()).
 *   exit()         — state is removed from the stack.
 *   suspend()      — another state was pushed on top.
 *   resume()       — the state above was popped; this is topmost again.
 *   update(dt)     — fixed step, only called for the topmost state.
 */
export class GameState {
  /** @param {import('../ServiceRegistry.js').ServiceRegistry} services */
  constructor(services) {
    this.services = services;
  }

  /* eslint-disable no-unused-vars */
  enter(params = {}) {}
  exit() {}
  suspend() {}
  resume() {}
  update(dt) {}
  /* eslint-enable no-unused-vars */
}
