import * as THREE from 'three';

/**
 * FlickerLight — a point light with candle/brazier flicker.
 *
 * Flicker is a sum of two sines plus a random walk, per-light phase offset so
 * clusters don't pulse in sync. WorldService drives update(dt).
 */
export class FlickerLight {
  /** @type {THREE.PointLight} */
  light;

  #baseIntensity;
  #time;
  #walk = 0;

  constructor({ color = 0xff9a3c, intensity = 2.2, distance = 7, position, castShadow = false }) {
    this.light = new THREE.PointLight(color, intensity, distance, 2);
    this.light.position.copy(position);
    this.light.castShadow = castShadow;
    this.#baseIntensity = intensity;
    this.#time = Math.random() * 100;
  }

  update(dt) {
    this.#time += dt;
    this.#walk += (Math.random() - 0.5) * 1.6 * dt;
    this.#walk *= 0.94;
    const s = Math.sin(this.#time * 7.3) * 0.06 + Math.sin(this.#time * 13.7) * 0.04;
    this.light.intensity = this.#baseIntensity * (1 + s + this.#walk);
  }
}
