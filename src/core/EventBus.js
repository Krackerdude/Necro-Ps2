/**
 * EventBus — the engine's decoupling backbone.
 *
 * Systems communicate through named events instead of holding references to
 * each other. Event names are namespaced strings, e.g. 'input/action-pressed',
 * 'save/game-loaded', 'player/died'. See docs/ARCHITECTURE.md for the event
 * catalog; add new events there when you introduce them.
 */
export class EventBus {
  #listeners = new Map();

  /**
   * @param {string} event
   * @param {(payload: any) => void} handler
   * @returns {() => void} unsubscribe function
   */
  on(event, handler) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /** Subscribe for a single emission. */
  once(event, handler) {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(event, handler) {
    this.#listeners.get(event)?.delete(handler);
  }

  emit(event, payload = undefined) {
    const handlers = this.#listeners.get(event);
    if (!handlers) return;
    // Copy so handlers that subscribe/unsubscribe during dispatch are safe.
    for (const handler of [...handlers]) {
      handler(payload);
    }
  }

  /** Drop every listener. Only the engine teardown path should call this. */
  clear() {
    this.#listeners.clear();
  }
}
