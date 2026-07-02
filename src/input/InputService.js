import { ACTIONS } from './actions.js';

/**
 * InputService — translates raw keyboard input into named actions.
 *
 * Query API (polled by gameplay each fixed step):
 *   isDown('moveForward')      — held right now
 *   wasPressed('interact')     — went down since the last endFrame()
 *
 * Event API (for UI / one-shot reactions), via EventBus:
 *   'input/action-pressed'  { action }
 *   'input/action-released' { action }
 *   'input/raw-key'         { code }   — emitted only while capture mode is
 *                                        on; used by the rebind UI.
 *
 * Bindings live in SettingsService under 'keybinds' and are re-read when
 * 'settings/changed' fires for that subtree — the rebind screen never talks
 * to this service directly.
 */
export class InputService {
  #events;
  #settings;
  #keyToActions = new Map();
  #down = new Set();
  #pressed = new Set();
  #captureMode = false;

  constructor(events, settings) {
    this.#events = events;
    this.#settings = settings;
    this.#rebuildBindings();

    events.on('settings/changed', ({ path }) => {
      if (path.startsWith('keybinds')) this.#rebuildBindings();
    });

    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
    window.addEventListener('blur', () => this.#releaseAll());
  }

  isDown(action) {
    return this.#down.has(action);
  }

  wasPressed(action) {
    return this.#pressed.has(action);
  }

  /** Called by the Engine at the end of each fixed step. */
  endFrame() {
    this.#pressed.clear();
  }

  /**
   * Discard buffered presses immediately. UI screens call this when closing
   * so the keypress that closed them (Tab/Esc/E) isn't re-delivered to
   * gameplay as a fresh action on the next fixed step.
   */
  clearPressed() {
    this.#pressed.clear();
  }

  /**
   * Rebind capture: while enabled, the next physical key is reported via
   * 'input/raw-key' and normal action dispatch is suppressed.
   */
  setCaptureMode(enabled) {
    this.#captureMode = enabled;
    if (enabled) this.#releaseAll();
  }

  #onKeyDown = (e) => {
    if (this.#captureMode) {
      e.preventDefault();
      this.#events.emit('input/raw-key', { code: e.code });
      return;
    }
    const actions = this.#keyToActions.get(e.code);
    if (!actions) return;
    if (e.code.startsWith('F') && e.code.length <= 3 && e.code !== 'F3') return;
    e.preventDefault();
    if (e.repeat) return;
    for (const action of actions) {
      this.#down.add(action);
      this.#pressed.add(action);
      this.#events.emit('input/action-pressed', { action });
    }
  };

  #onKeyUp = (e) => {
    const actions = this.#keyToActions.get(e.code);
    if (!actions) return;
    for (const action of actions) {
      this.#down.delete(action);
      this.#events.emit('input/action-released', { action });
    }
  };

  #releaseAll() {
    for (const action of [...this.#down]) {
      this.#down.delete(action);
      this.#events.emit('input/action-released', { action });
    }
    this.#pressed.clear();
  }

  #rebuildBindings() {
    this.#keyToActions.clear();
    const binds = this.#settings.get('keybinds') ?? {};
    for (const { id } of ACTIONS) {
      for (const code of binds[id] ?? []) {
        if (!this.#keyToActions.has(code)) this.#keyToActions.set(code, []);
        this.#keyToActions.get(code).push(id);
      }
    }
  }
}
