/**
 * ServiceRegistry — minimal dependency-injection container.
 *
 * This is the ONE piece of intentionally shared state in the engine.
 * Services are registered once during Engine boot (see Engine.js for the
 * canonical boot order) and consumed by name. Systems should receive the
 * registry (or the specific services they need) through their constructor —
 * never import a service module directly to grab a singleton.
 */
export class ServiceRegistry {
  #services = new Map();

  /**
   * @param {string} name
   * @param {object} service
   */
  register(name, service) {
    if (this.#services.has(name)) {
      throw new Error(`Service '${name}' is already registered.`);
    }
    this.#services.set(name, service);
    return service;
  }

  /**
   * @param {string} name
   * @returns {any}
   */
  get(name) {
    const service = this.#services.get(name);
    if (!service) {
      throw new Error(
        `Service '${name}' is not registered. Registered: [${[...this.#services.keys()].join(', ')}]`
      );
    }
    return service;
  }

  has(name) {
    return this.#services.has(name);
  }

  /** Iterate services that implement a given method (e.g. 'dispose'). */
  *withMethod(methodName) {
    for (const [name, service] of this.#services) {
      if (typeof service[methodName] === 'function') yield [name, service];
    }
  }
}

/**
 * Canonical service names. Import these instead of typing raw strings so
 * renames are a one-line change and typos fail loudly at boot.
 */
export const Services = Object.freeze({
  EVENTS: 'events',
  SETTINGS: 'settings',
  INPUT: 'input',
  RENDERER: 'renderer',
  POST_FX: 'postFx',
  CAMERA_DIRECTOR: 'cameraDirector',
  WORLD: 'world',
  PHYSICS: 'physics',
  AUDIO: 'audio',
  UI: 'ui',
  SAVE: 'save',
  STORY: 'story',
  DEBUG: 'debug',
  ASSETS: 'assets',
  STATE_MACHINE: 'stateMachine',
});
