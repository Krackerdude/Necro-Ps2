import { Wraith } from './Wraith.js';
import { Husk } from './Husk.js';

/**
 * EnemyRoster — owns every enemy in the active level.
 *
 * Responsibilities:
 *  - spawn from the level's `enemySpawns` (type registry below), skipping
 *    enemies whose death flag is set ("dead stays dead" across visits/saves)
 *    and gating conditional spawns (`onlyIf` story flag) — re-checked live
 *    when flags change, so a mid-visit story beat can introduce an enemy.
 *  - per-tick updates, corpse cleanup (sets the death flag, removes the mesh).
 *  - save capture/restore keyed by spawn index.
 *
 * Death flags: `enemyDead:<levelId>:<spawnIndex>` in StoryService — they ride
 * along in every save for free.
 *
 * New enemy types register in ENEMY_TYPES; levels reference them by name.
 */
const ENEMY_TYPES = Object.freeze({
  wraith: (deps) => new Wraith(deps),
  husk: (deps) => new Husk(deps),
});

export class EnemyRoster {
  /** @type {Array<{ spawnIndex: number, entity: object }>} */
  #active = [];
  #spawns = [];
  #deps;
  #story;
  #scene;
  #levelId;
  #unsubFlags;
  #unsubNoise;

  /**
   * @param {{ events, physics, ps2, story, playerObject, playerStats }} deps
   */
  constructor(deps) {
    this.#deps = deps;
    this.#story = deps.story;
  }

  /**
   * @param {object[]} enemySpawns level's spawn table
   * @param {THREE.Scene} scene
   * @param {string} levelId
   * @param {Array | undefined} snapshot saved enemy states (by spawn index)
   */
  populate(enemySpawns, scene, levelId, snapshot) {
    this.dispose();
    this.#spawns = enemySpawns ?? [];
    this.#scene = scene;
    this.#levelId = levelId;

    this.#spawns.forEach((spawn, index) => this.#trySpawn(spawn, index, snapshot?.[index]));

    // Conditional spawns may become eligible mid-visit (story beats).
    this.#unsubFlags = this.#deps.events.on('story/flag-changed', () => {
      this.#spawns.forEach((spawn, index) => {
        if (spawn.onlyIf && !this.#isSpawned(index)) this.#trySpawn(spawn, index, undefined);
      });
    });

    // Sound propagates to every enemy that can hear it.
    this.#unsubNoise = this.#deps.events.on('noise/emitted', ({ position, radius }) => {
      for (const { entity } of this.#active) entity.hearNoise?.(position, radius);
    });
  }

  /** Living enemies — the weapon system's target list. */
  living() {
    return this.#active.map((a) => a.entity).filter((e) => e.alive);
  }

  /** The bell tolls: everything standing lies down. */
  killAll() {
    for (const { entity } of this.#active) {
      if (entity.alive) entity.takeHit(99999);
    }
  }

  update(dt) {
    for (const entry of [...this.#active]) {
      entry.entity.update(dt);
      if (entry.entity.health.state === 'dead') {
        this.#story.set(this.#deathFlag(entry.spawnIndex), true);
        entry.entity.object.removeFromParent();
        this.#active = this.#active.filter((a) => a !== entry);
      }
    }
  }

  /* Save participant interface: sparse array keyed by spawn index. */
  captureState() {
    const out = [];
    for (const { spawnIndex, entity } of this.#active) {
      out[spawnIndex] = entity.captureState();
    }
    return out;
  }

  dispose() {
    this.#unsubFlags?.();
    this.#unsubFlags = null;
    this.#unsubNoise?.();
    this.#unsubNoise = null;
    for (const { entity } of this.#active) entity.object.removeFromParent();
    this.#active = [];
  }

  #trySpawn(spawn, index, snapshot) {
    if (this.#story.get(this.#deathFlag(index))) return;
    if (spawn.onlyIf && !this.#story.get(spawn.onlyIf)) return;
    const factory = ENEMY_TYPES[spawn.type];
    if (!factory) throw new Error(`Unknown enemy type '${spawn.type}'`);
    const entity = factory({ ...this.#deps, spawn });
    if (snapshot) entity.restoreState(snapshot);
    this.#scene.add(entity.object);
    this.#active.push({ spawnIndex: index, entity });
  }

  #isSpawned(index) {
    return this.#active.some((a) => a.spawnIndex === index);
  }

  #deathFlag(index) {
    return `enemyDead:${this.#levelId}:${index}`;
  }
}
