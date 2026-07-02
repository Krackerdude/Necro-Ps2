import * as THREE from 'three';

/**
 * WeaponSystem — the aim-and-attack grammar.
 *
 * Hold `aim` to plant your feet and raise the equipped weapon (turning still
 * allowed — classic tank aiming). Press `attack` while aiming to swing/fire.
 *
 * Targeting model (deliberately era-simple, no physics projectiles):
 *   melee  — nearest living enemy within `range` and inside the swing arc.
 *   ranged — nearest living enemy within `range`, within a narrow angular
 *            cone of the facing line, with clear line of sight.
 *
 * Emits:
 *   'combat/aim-changed' { aiming }             — HUD readout
 *   'combat/fired' { position, ranged }         — muzzle flash, future FX
 *
 * Dependencies are injected; enemies come through a provider function so the
 * system doesn't care who owns the roster.
 */
const RANGED_CONE_DEG = 10;

export class WeaponSystem {
  #events;
  #input;
  #inventory;
  #player;
  #physics;
  #getEnemies;
  #aiming = false;
  #cooldown = 0;

  #forward = new THREE.Vector3();
  #toEnemy = new THREE.Vector3();
  #muzzle = new THREE.Vector3();

  constructor({ events, input, inventory, player, physics, getEnemies }) {
    this.#events = events;
    this.#input = input;
    this.#inventory = inventory;
    this.#player = player;
    this.#physics = physics;
    this.#getEnemies = getEnemies;
  }

  get aiming() {
    return this.#aiming;
  }

  update(dt) {
    this.#cooldown = Math.max(0, this.#cooldown - dt);

    const weapon = this.#inventory.equippedWeapon;
    const wantAim = this.#input.isDown('aim') && Boolean(weapon);
    if (wantAim !== this.#aiming) {
      this.#aiming = wantAim;
      this.#player.setAiming(wantAim);
      this.#events.emit('combat/aim-changed', { aiming: wantAim });
      if (wantAim) this.#events.emit('audio/sfx', { id: 'weaponReady' });
    }

    if (this.#aiming && this.#cooldown === 0 && this.#input.wasPressed('attack')) {
      this.#attack(weapon.weapon);
    }
  }

  #attack(stats) {
    if (stats.type === 'ranged') {
      if (this.#inventory.count(stats.usesAmmo) === 0) {
        this.#events.emit('audio/sfx', { id: 'dryFire' });
        this.#events.emit('ui/toast', { text: 'Empty. The hammer falls on nothing.' });
        this.#cooldown = 0.4;
        return;
      }
      this.#inventory.remove(stats.usesAmmo, 1);
      this.#cooldown = stats.fireTime;
      this.#events.emit('audio/sfx', { id: 'gunshot' });
      this.#muzzle.copy(this.#player.object.position).y = 1.35;
      this.#events.emit('combat/fired', { position: this.#muzzle.clone(), ranged: true });
      const target = this.#findTarget(stats.range, RANGED_CONE_DEG, true);
      target?.takeHit(stats.damage);
    } else {
      this.#cooldown = stats.swingTime;
      this.#events.emit('audio/sfx', { id: 'macheteSwing' });
      this.#events.emit('combat/fired', { position: this.#player.object.position.clone(), ranged: false });
      const target = this.#findTarget(stats.range, stats.arcDeg, false);
      if (target) {
        target.takeHit(stats.damage);
        this.#events.emit('audio/sfx', { id: 'macheteHit' });
      }
    }
  }

  /** Nearest living enemy within range + half-angle cone (+ LOS if ranged). */
  #findTarget(range, coneDeg, needsLos) {
    const origin = this.#player.object.position;
    this.#player.getForward(this.#forward);
    const cosHalf = Math.cos((coneDeg * Math.PI) / 360);

    let best = null;
    let bestDist = Infinity;
    for (const enemy of this.#getEnemies()) {
      if (!enemy.alive) continue;
      this.#toEnemy.subVectors(enemy.object.position, origin);
      this.#toEnemy.y = 0;
      const dist = this.#toEnemy.length();
      if (dist > range + enemy.radius || dist >= bestDist) continue;
      if (dist > 0.01) {
        this.#toEnemy.divideScalar(dist);
        // Widen the cone by the enemy's angular radius so close, wide
        // targets aren't missed on a technicality.
        const angularSlack = Math.min(0.5, enemy.radius / Math.max(dist, 0.5));
        if (this.#forward.dot(this.#toEnemy) < cosHalf - angularSlack) continue;
      }
      if (needsLos && this.#physics.segmentBlockedXZ(origin, enemy.object.position)) continue;
      best = enemy;
      bestDist = dist;
    }
    return best;
  }
}
