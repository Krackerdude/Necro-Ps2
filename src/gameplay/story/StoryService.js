/**
 * StoryService — the game's progression flags.
 *
 * A flat map of flag -> JSON-serializable value. Levels and gameplay systems
 * read flags to decide what exists (built doors, taken items) and set flags
 * when the player progresses.
 *
 * Emits 'story/flag-changed' { flag, value } — the autosave hook and any
 * reactive scripting listen to this.
 */
export class StoryService {
  #flags = new Map();
  #events;

  constructor(events) {
    this.#events = events;
  }

  get(flag) {
    return this.#flags.get(flag);
  }

  set(flag, value) {
    this.#flags.set(flag, value);
    this.#events.emit('story/flag-changed', { flag, value });
  }

  reset() {
    this.#flags.clear();
  }

  /* Save participant interface (see save/SaveService.js). */
  captureState() {
    return Object.fromEntries(this.#flags);
  }

  restoreState(state) {
    this.#flags = new Map(Object.entries(state ?? {}));
  }
}
