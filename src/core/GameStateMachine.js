/**
 * GameStateMachine — a stack of GameStates.
 *
 * push()    layers a state (Pause over Gameplay).
 * pop()     removes the top state, resuming the one below.
 * replace() swaps the entire stack for one state (MainMenu -> Gameplay).
 *
 * Emits on the EventBus:
 *   'state/changed' { top: string }  — after any transition.
 */
export class GameStateMachine {
  #stack = [];
  #events;

  constructor(events) {
    this.#events = events;
  }

  get top() {
    return this.#stack[this.#stack.length - 1] ?? null;
  }

  get topName() {
    return this.top?.constructor.name ?? null;
  }

  push(state, params = {}) {
    this.top?.suspend();
    this.#stack.push(state);
    state.enter(params);
    this.#emitChange();
  }

  pop() {
    const state = this.#stack.pop();
    state?.exit();
    this.top?.resume();
    this.#emitChange();
  }

  replace(state, params = {}) {
    while (this.#stack.length > 0) {
      this.#stack.pop().exit();
    }
    this.#stack.push(state);
    state.enter(params);
    this.#emitChange();
  }

  update(dt) {
    this.top?.update(dt);
  }

  #emitChange() {
    this.#events.emit('state/changed', { top: this.topName });
  }
}
