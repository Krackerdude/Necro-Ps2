import { cloneDefaultSettings, DEFAULT_SETTINGS } from './defaultSettings.js';

const STORAGE_KEY = 'necro.settings.v1';

/**
 * SettingsService — persisted user configuration.
 *
 * Read with dot paths: settings.get('graphics.effects.bloom').
 * Write with settings.set(path, value) — persists to localStorage and emits
 * 'settings/changed' { path, value } so systems react without polling.
 * Systems that care about a subtree just prefix-match `path`.
 */
export class SettingsService {
  #data;
  #events;

  constructor(events) {
    this.#events = events;
    this.#data = this.#load();
  }

  get(path) {
    return path.split('.').reduce((node, key) => node?.[key], this.#data);
  }

  set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    let node = this.#data;
    for (const key of keys) {
      if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
      node = node[key];
    }
    node[last] = value;
    this.#persist();
    this.#events.emit('settings/changed', { path, value });
  }

  resetToDefaults(subtree = null) {
    const defaults = cloneDefaultSettings();
    if (subtree) {
      this.set(subtree, subtree.split('.').reduce((n, k) => n?.[k], defaults));
    } else {
      this.#data = defaults;
      this.#persist();
      this.#events.emit('settings/changed', { path: '', value: this.#data });
    }
  }

  /** Full snapshot (cloned) — used by the debug overlay, never for writes. */
  snapshot() {
    return structuredClone(this.#data);
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaultSettings();
      // Merge saved values over defaults so new settings added in updates
      // pick up their default instead of being undefined.
      return deepMerge(cloneDefaultSettings(), JSON.parse(raw));
    } catch {
      return cloneDefaultSettings();
    }
  }

  #persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#data));
    } catch {
      // Storage full/unavailable — settings just won't persist this session.
    }
  }
}

function deepMerge(base, override) {
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      deepMerge(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

export { DEFAULT_SETTINGS };
