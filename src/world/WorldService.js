import * as THREE from 'three';
import { ArchitectureKit } from './builders/ArchitectureKit.js';
import { getLevel } from './levels/registry.js';
import { disposeObject3D } from '../utils/dispose.js';

/**
 * WorldService — owns the active level: its scene, colliders, camera zones,
 * interactables, and per-frame ambience updates (flicker, fog cards).
 *
 * It does not know about the player, enemies, or UI. Gameplay reads the
 * loaded runtime (spawn point, zones, interactables) and builds on top.
 *
 * Level definitions are data+builder modules under world/levels/, registered
 * in levels/registry.js. Builders receive a context (kit, story flags,
 * physics) and return a LevelRuntime — see chapelOfTheHollow.js for the
 * reference example.
 */
export class WorldService {
  /** @type {THREE.Scene | null} */
  scene = null;
  /** @type {object | null} current LevelRuntime */
  runtime = null;
  /** @type {string | null} */
  currentLevelId = null;

  #events;
  #settings;
  #renderService;
  #physics;

  constructor(events, settings, renderService, physics) {
    this.#events = events;
    this.#settings = settings;
    this.#renderService = renderService;
    this.#physics = physics;

    events.on('settings/changed', ({ path }) => {
      if (path === 'graphics.fog') this.#applyFog();
      if (path === 'graphics.dynamicLights') this.#applyDynamicLights();
    });
  }

  /**
   * @param {string} levelId
   * @param {{ story: object, inventory?: object }} session state the level
   *        builds against (story flags gate geometry; inventory backs
   *        pickups and key checks). Menu levels pass just the story.
   */
  loadLevel(levelId, session) {
    this.unload();

    const definition = getLevel(levelId);
    const scene = new THREE.Scene();
    const kit = new ArchitectureKit(this.#renderService.ps2Materials);

    const runtime = definition.build({
      kit,
      story: session.story,
      inventory: session.inventory ?? null,
      events: this.#events,
      physics: this.#physics,
      settings: this.#settings,
    });

    scene.add(runtime.root);
    this.scene = scene;
    this.runtime = runtime;
    this.currentLevelId = levelId;

    this.#physics.setStaticColliders(runtime.colliders);
    this.#applyFog();
    this.#applyDynamicLights();
    this.#renderService.setScene(scene);
    this.#events.emit('world/level-loaded', { levelId });
    return runtime;
  }

  unload() {
    if (!this.runtime) return;
    this.runtime.dispose?.(); // levels may hold event subscriptions
    disposeObject3D(this.runtime.root);
    this.#physics.setStaticColliders([]);
    this.scene = null;
    this.runtime = null;
    this.currentLevelId = null;
  }

  update(dt) {
    if (!this.runtime) return;
    for (const updatable of this.runtime.updatables) updatable.update(dt);
  }

  /**
   * Ground surface under a world position — drives footstep sound and
   * wading. Levels declare `surfaces: { default, regions: [{min, max,
   * type}] }` with min/max as [x, z]; absent config means stone.
   * @returns {'stone'|'wood'|'water'|'bone'}
   */
  getSurfaceAt(position) {
    const surfaces = this.runtime?.surfaces;
    if (!surfaces) return 'stone';
    for (const region of surfaces.regions ?? []) {
      if (
        position.x >= region.min[0] &&
        position.x <= region.max[0] &&
        position.z >= region.min[1] &&
        position.z <= region.max[1]
      ) {
        return region.type;
      }
    }
    return surfaces.default ?? 'stone';
  }

  #applyFog() {
    if (!this.scene || !this.runtime) return;
    const enabled = this.#settings.get('graphics.fog');
    const { fog } = this.runtime;
    this.scene.fog = enabled && fog ? new THREE.FogExp2(fog.color, fog.density) : null;
    this.scene.background = new THREE.Color(fog?.color ?? 0x000000);
  }

  #applyDynamicLights() {
    if (!this.scene) return;
    const enabled = this.#settings.get('graphics.dynamicLights');
    this.scene.traverse((node) => {
      // Ambient/hemisphere are the "baked" baseline; point/spot are dynamic.
      if (node.isPointLight || node.isSpotLight) node.visible = enabled;
    });
  }
}
