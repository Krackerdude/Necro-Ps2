/**
 * SaveService — save slots in localStorage.
 *
 * Slots: 'auto' (autosave) + 'slot1'..'slot3' (manual). A save is an exact
 * snapshot: whatever the active gameplay session's capture provider returns
 * (player transform + stats, story flags, enemies, level id, playtime).
 *
 * The service is deliberately dumb about content: GameplayState installs a
 * capture provider (`setCaptureProvider`) that assembles the snapshot, and
 * consumes snapshots on load. This keeps save I/O decoupled from gameplay
 * internals and lets the snapshot shape evolve with a version bump.
 *
 * Autosave: on every 'story/flag-changed' (progress moments), if a provider
 * is installed.
 *
 * Emits: 'save/saved' { slot, auto }, and listens for nothing else.
 */
const STORAGE_KEY = 'necro.saves.v1';
const SAVE_VERSION = 1;

export const MANUAL_SLOTS = Object.freeze(['slot1', 'slot2', 'slot3']);
export const AUTO_SLOT = 'auto';

export class SaveService {
  #events;
  #captureProvider = null;

  #autosavePending = false;

  constructor(events) {
    this.#events = events;
    events.on('story/flag-changed', () => this.autosave());
  }

  /** @param {(() => object) | null} provider returns { levelId, playtime, participants } */
  setCaptureProvider(provider) {
    this.#captureProvider = provider;
  }

  /** @returns {Array<{slot: string, meta: object}>} newest first, autosave first */
  listSaves() {
    const store = this.#read();
    return [AUTO_SLOT, ...MANUAL_SLOTS]
      .filter((slot) => store[slot])
      .map((slot) => ({ slot, meta: store[slot].meta }));
  }

  getSave(slot) {
    return this.#read()[slot] ?? null;
  }

  hasAnySave() {
    return this.listSaves().length > 0;
  }

  save(slot) {
    if (!this.#captureProvider) return false;
    const snapshot = this.#captureProvider();
    const store = this.#read();
    store[slot] = {
      version: SAVE_VERSION,
      meta: {
        timestamp: Date.now(),
        levelId: snapshot.levelId,
        levelName: snapshot.levelName,
        playtime: snapshot.playtime,
        condition: snapshot.condition,
      },
      data: snapshot,
    };
    this.#write(store);
    this.#events.emit('save/saved', { slot, auto: slot === AUTO_SLOT });
    return true;
  }

  /**
   * Deferred to the end of the current task so a gameplay beat that mutates
   * several things (story flag + inventory add + mesh removal) is captured
   * as a whole. A mid-beat snapshot once saved "item taken" without the
   * item in the inventory — that class of bug dies here.
   */
  autosave() {
    if (!this.#captureProvider || this.#autosavePending) return;
    this.#autosavePending = true;
    queueMicrotask(() => {
      this.#autosavePending = false;
      if (this.#captureProvider) this.save(AUTO_SLOT);
    });
  }

  deleteSave(slot) {
    const store = this.#read();
    delete store[slot];
    this.#write(store);
  }

  #read() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    } catch {
      return {};
    }
  }

  #write(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Quota exceeded — surface it; a silent failed save is the worst bug.
      this.#events.emit('ui/toast', { text: 'SAVE FAILED — storage unavailable.' });
    }
  }
}
