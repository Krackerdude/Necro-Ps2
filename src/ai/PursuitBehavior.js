import * as THREE from 'three';

/**
 * PursuitBehavior — reusable chase brain, decoupled from any enemy body.
 *
 * States:
 *   'haunt'       — drift around a home point.
 *   'pursue'      — target entered detection radius with line of sight.
 *   'investigate' — heard something; walking to where the sound was.
 *                   Sight can escalate it to pursue on the way.
 *   'return'      — target escaped; drift home.
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

  #investigateTarget = null;

  /**
   * A sound happened. If it's within earshot, the brain walks to WHERE THE
   * SOUND WAS — hearing needs no line of sight (gunfire and running feet
   * carry through walls), but it doesn't grant sight either. If the target
   * is close (inside loseRadius), hearing escalates straight to pursuit.
   * @param {THREE.Vector3} selfPos
   * @param {THREE.Vector3} noisePos
   * @param {number} radius
   * @returns {boolean} true if the noise was heard
   */
  hearNoise(selfPos, noisePos, radius) {
    const dist = selfPos.distanceTo(noisePos);
    if (dist > radius) return false;
    if (this.state !== 'pursue') {
      if (dist < this.#loseRadius) {
        this.state = 'pursue';
      } else {
        this.state = 'investigate';
        this.#investigateTarget = noisePos.clone();
      }
    }
    return true;
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
    } else if (this.state === 'investigate' && this.#investigateTarget) {
      this.#desired.subVectors(this.#investigateTarget, selfPos);
      if (selfPos.distanceTo(this.#investigateTarget) < 1.0) {
        // Nothing here. Drift back eventually.
        this.#investigateTarget = null;
        this.state = 'return';
      }
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
