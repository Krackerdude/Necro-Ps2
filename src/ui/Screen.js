/**
 * Screen — base class for UI screens managed by UIService.
 *
 * Subclasses implement build() returning a root element, and may override
 * onShow/onHide for focus/listener management. Screens receive their
 * dependencies via constructor injection from whichever GameState creates
 * them — screens never reach into the service registry themselves.
 */
export class Screen {
  /** @type {HTMLElement | null} */
  element = null;

  /** @returns {HTMLElement} */
  build() {
    throw new Error(`${this.constructor.name} must implement build()`);
  }

  mount(parent) {
    if (this.element) return;
    this.element = this.build();
    parent.appendChild(this.element);
    this.onShow?.();
  }

  unmount() {
    if (!this.element) return;
    this.onHide?.();
    this.element.remove();
    this.element = null;
  }
}
