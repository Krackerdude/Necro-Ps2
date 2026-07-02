import * as THREE from 'three';
import { PursuitBehavior } from '../../ai/PursuitBehavior.js';
import { EnemyHealth } from '../combat/EnemyHealth.js';

/**
 * Husk — a member of the congregation that never stopped attending.
 *
 * Slow, relentless shambler: short sight radius but a long memory (once it
 * has seen you, it barely gives up). Killable with any weapon. A walking
 * player outpaces it slightly; two of them in a corridor is the problem.
 */
const SPEED = { haunt: 0.45, pursue: 1.15, return: 0.6 };
const CONTACT_RANGE = 0.62;
const CONTACT_DAMAGE = 12;
const CONTACT_COOLDOWN = 1.0;
const HP = 70;

export class Husk {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  radius = 0.34;
  /** @type {EnemyHealth} */
  health;

  #behavior;
  #physics;
  #events;
  #playerObject;
  #playerStats;
  #cooldown = 0;
  #shamblePhase = Math.random() * 10;
  #limbs = {};
  #wasPursuing = false;

  constructor({ ps2, physics, events, spawn, playerObject, playerStats }) {
    this.#physics = physics;
    this.#events = events;
    this.#playerObject = playerObject;
    this.#playerStats = playerStats;

    const rotSkin = ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x7a8560, roughness: 1 })
    );
    const rags = ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 })
    );

    // Hunched congregation corpse: forward-tilted torso, hanging arms.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.26), rags);
    torso.position.y = 1.0;
    torso.rotation.x = 0.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.22), rotSkin);
    head.position.set(0, 1.32, 0.18);
    head.rotation.x = 0.5;

    const mkLimb = (w, h, material, x, y, z = 0) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), material);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      pivot.position.set(x, y, z);
      this.object.add(pivot);
      return pivot;
    };
    this.#limbs.armL = mkLimb(0.1, 0.5, rotSkin, -0.3, 1.18, 0.12);
    this.#limbs.armR = mkLimb(0.1, 0.5, rotSkin, 0.3, 1.18, 0.12);
    this.#limbs.legL = mkLimb(0.13, 0.72, rags, -0.12, 0.72);
    this.#limbs.legR = mkLimb(0.13, 0.72, rags, 0.12, 0.72);
    this.#limbs.armL.rotation.x = -0.5;
    this.#limbs.armR.rotation.x = -0.5;

    this.object.add(torso, head);
    this.object.traverse((n) => (n.castShadow = true));
    this.object.position.copy(spawn.position);

    this.health = new EnemyHealth(events, { hp: HP, root: this.object });

    this.#behavior = new PursuitBehavior({
      home: spawn.position,
      homeRadius: spawn.homeRadius ?? 4,
      detectRadius: 4.5,
      loseRadius: 14,
      hasLineOfSight: (from, to) => !physics.segmentBlockedXZ(from, to),
    });
  }

  get alive() {
    return this.health.alive;
  }

  takeHit(damage) {
    this.health.takeHit(damage);
  }

  update(dt) {
    const deathProgress = this.health.update(dt);
    if (!this.health.alive) {
      // Collapse: pitch forward into the floor while fading.
      this.object.rotation.x = deathProgress * (Math.PI / 2) * 0.9;
      this.object.position.y = -deathProgress * 0.35;
      return;
    }

    const dir = this.#behavior.update(this.object.position, this.#playerObject.position, dt);
    const speed = SPEED[this.#behavior.state] ?? SPEED.haunt;
    this.#physics.moveCircle(this.object.position, dir.x * speed * dt, dir.z * speed * dt, this.radius);

    if (dir.lengthSq() > 0.001) {
      this.object.rotation.y = Math.atan2(dir.x, dir.z);
    }

    // Broken shamble — uneven stride lengths per leg.
    this.#shamblePhase += dt * 3.4 * (speed / SPEED.pursue + 0.4);
    const swing = Math.sin(this.#shamblePhase);
    this.#limbs.legL.rotation.x = swing * 0.5;
    this.#limbs.legR.rotation.x = Math.sin(this.#shamblePhase + 2.6) * 0.42;
    this.object.position.y = Math.abs(swing) * 0.02;

    const pursuing = this.#behavior.state === 'pursue';
    if (pursuing && !this.#wasPursuing) {
      this.#events.emit('audio/sfx', { id: 'huskGroan' });
    }
    this.#wasPursuing = pursuing;

    this.#cooldown -= dt;
    if (this.#cooldown <= 0) {
      const d = this.object.position.distanceTo(this.#playerObject.position);
      if (d < CONTACT_RANGE + 0.32) {
        this.#playerStats.damage(CONTACT_DAMAGE);
        this.#events.emit('audio/sfx', { id: 'hurt' });
        this.#cooldown = CONTACT_COOLDOWN;
      }
    }
  }

  /* Save participant interface. */
  captureState() {
    const { x, y, z } = this.object.position;
    return { position: [x, y, z], hp: this.health.hp };
  }

  restoreState(state) {
    if (state?.position) this.object.position.set(...state.position);
    if (typeof state?.hp === 'number') this.health.hp = state.hp;
  }
}
