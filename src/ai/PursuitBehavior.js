import * as THREE from 'three';

/**
 * PursuitBehavior — reusable chase brain, decoupled from any enemy body.
 *
 * States:
 *   'haunt'   — drift around a home point.
 *   'pursue'  — target entered detection radius with line of sight.
 *   'return'  — target escaped; drift home.
 *
 * The behavior computes a desired velocity each tick; the OWNING entity
 * applies it (through physics, with its own speed). This keeps AI reusable:
 * a crawler and a flyer can share this brain with different bodies.
 */
export class PursuitBehavior {
  state = 'haunt';

  #home;
  #homeRadius;
  #detectRadius;
  #loseRadius;
  #hasLineOfSight;
  #wanderAngle = Math.random() * Math.PI * 2;
  #desired = new THREE.Vector3();

  /**
   * @param {{ home: THREE.Vector3, homeRadius?: number, detectRadius?: number,
   *           loseRadius?: number,
   *           hasLineOfSight?: (from: THREE.Vector3, to: THREE.Vector3) => boolean }} opts
   */
  constructor({ home, homeRadius = 5, detectRadius = 6, loseRadius = 9, hasLineOfSight }) {
    this.#home = home.clone();
    this.#homeRadius = homeRadius;
    this.#detectRadius = detectRadius;
    this.#loseRadius = loseRadius;
    this.#hasLineOfSight = hasLineOfSight ?? (() => true);
  }

  /**
   * @param {THREE.Vector3} selfPos
   * @param {THREE.Vector3} targetPos
   * @param {number} dt
   * @returns {THREE.Vector3} desired direction (unit-ish, XZ plane)
   */
  update(selfPos, targetPos, dt) {
    const distToTarget = selfPos.distanceTo(targetPos);

    if (this.state !== 'pursue') {
      if (distToTarget < this.#detectRadius && this.#hasLineOfSight(selfPos, targetPos)) {
        this.state = 'pursue';
      }
    } else if (distToTarget > this.#loseRadius) {
      this.state = 'return';
    }

    if (this.state === 'pursue') {
      this.#desired.subVectors(targetPos, selfPos);
    } else {
      const distHome = selfPos.distanceTo(this.#home);
      if (this.state === 'return' && distHome < 1) this.state = 'haunt';
      if (this.state === 'return') {
        this.#desired.subVectors(this.#home, selfPos);
      } else {
        // Haunt: meander, gently tethered to home.
        this.#wanderAngle += (Math.random() - 0.5) * 2.4 * dt;
        this.#desired.set(Math.sin(this.#wanderAngle), 0, Math.cos(this.#wanderAngle));
        if (distHome > this.#homeRadius) {
          this.#desired.subVectors(this.#home, selfPos).normalize();
          this.#wanderAngle = Math.atan2(this.#desired.x, this.#desired.z);
        }
      }
    }

    this.#desired.y = 0;
    if (this.#desired.lengthSq() > 1) this.#desired.normalize();
    return this.#desired;
  }
}
