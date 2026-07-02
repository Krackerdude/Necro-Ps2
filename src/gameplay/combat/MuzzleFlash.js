import * as THREE from 'three';

/**
 * MuzzleFlash — a single pooled point light that pops on 'combat/fired'.
 * Added to the scene by GameplayState; updated on the fixed step.
 */
export class MuzzleFlash {
  light = new THREE.PointLight(0xffc873, 0, 6, 2);

  #timer = 0;

  constructor(events) {
    this.light.visible = false;
    events.on('combat/fired', ({ position, ranged }) => {
      if (!ranged) return;
      this.light.position.copy(position);
      this.light.intensity = 40;
      this.light.visible = true;
      this.#timer = 0.07;
    });
  }

  update(dt) {
    if (!this.light.visible) return;
    this.#timer -= dt;
    if (this.#timer <= 0) {
      this.light.visible = false;
    } else {
      this.light.intensity *= 0.6;
    }
  }
}
