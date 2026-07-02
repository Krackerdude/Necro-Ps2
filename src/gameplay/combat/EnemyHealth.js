/**
 * EnemyHealth — composable health/hit-reaction component for enemies.
 *
 * Owns: hit points, damage intake, hit flash (emissive pulse on the entity's
 * materials), and the dying timer. The OWNING entity reads `state` each tick
 * to drive its own death animation and stops acting when not 'alive'.
 *
 * States: 'alive' → 'dying' (death anim window) → 'dead' (remove me).
 */
const FLASH_TIME = 0.12;
const DYING_TIME = 1.4;

export class EnemyHealth {
  state = 'alive';
  hp;

  #events;
  #materials = [];
  #flashTimer = 0;
  #dyingTimer = 0;

  /**
   * @param {import('../../core/EventBus.js').EventBus} events
   * @param {{ hp: number, root: import('three').Object3D }} opts
   */
  constructor(events, { hp, root }) {
    this.#events = events;
    this.hp = hp;
    root.traverse((node) => {
      if (node.material?.emissive) {
        // Materials may be shared via the kit cache — clone so the flash
        // (and death fade) never bleeds onto level geometry.
        node.material = node.material.clone();
        this.#materials.push(node.material);
      }
    });
  }

  get alive() {
    return this.state === 'alive';
  }

  takeHit(damage) {
    if (this.state !== 'alive') return;
    this.hp -= damage;
    this.#flashTimer = FLASH_TIME;
    for (const m of this.#materials) m.emissive.setHex(0xb03030);
    if (this.hp <= 0) {
      this.state = 'dying';
      this.#dyingTimer = DYING_TIME;
      this.#events.emit('enemy/died', {});
      this.#events.emit('audio/sfx', { id: 'enemyDie' });
    } else {
      this.#events.emit('audio/sfx', { id: 'enemyHit' });
    }
  }

  /**
   * @param {number} dt
   * @returns {number} death-animation progress 0..1 (0 while alive)
   */
  update(dt) {
    if (this.#flashTimer > 0) {
      this.#flashTimer -= dt;
      if (this.#flashTimer <= 0) {
        for (const m of this.#materials) m.emissive.setHex(0x000000);
      }
    }
    if (this.state === 'dying') {
      this.#dyingTimer -= dt;
      const progress = 1 - Math.max(0, this.#dyingTimer / DYING_TIME);
      for (const m of this.#materials) {
        m.transparent = true;
        m.opacity = 1 - progress;
      }
      if (this.#dyingTimer <= 0) this.state = 'dead';
      return progress;
    }
    return 0;
  }
}
