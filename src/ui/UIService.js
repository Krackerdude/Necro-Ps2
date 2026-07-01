/**
 * UIService — owns #ui-root and the screen stack.
 *
 * Two layers:
 *   HUD    — a single persistent overlay during gameplay (setHud/clearHud).
 *   Screens — a stack of modal screens (menus, notes). Only the top screen
 *             receives keyboard focus by convention; screens below stay
 *             mounted but inert (they check `ui.isTop(this)`).
 */
export class UIService {
  #root;
  #stack = [];
  #hud = null;

  constructor(rootElement) {
    this.#root = rootElement;
  }

  /* ---- HUD layer ---- */

  setHud(screen) {
    this.clearHud();
    this.#hud = screen;
    screen.mount(this.#root);
  }

  clearHud() {
    this.#hud?.unmount();
    this.#hud = null;
  }

  /* ---- Screen stack ---- */

  push(screen) {
    this.#stack.push(screen);
    screen.mount(this.#root);
  }

  pop() {
    const screen = this.#stack.pop();
    screen?.unmount();
  }

  /** Pop until `screen` is removed (no-op if it isn't in the stack). */
  remove(screen) {
    const index = this.#stack.indexOf(screen);
    if (index === -1) return;
    while (this.#stack.length > index) this.pop();
  }

  clearScreens() {
    while (this.#stack.length) this.pop();
  }

  isTop(screen) {
    return this.#stack[this.#stack.length - 1] === screen;
  }

  get depth() {
    return this.#stack.length;
  }
}
