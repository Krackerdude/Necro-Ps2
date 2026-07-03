import * as THREE from 'three';
import { EnemyHealth } from '../combat/EnemyHealth.js';

/**
 * THE CENSOR — the Scriptorium's midpoint boss. The thing that struck the
 * words out. A towering figure in ink-black vestments with a great brass
 * seal where a face should be, and hands stained past the elbow.
 *
 *   THE GIMMICK — THE PRESSES: armored (damage ×0.1) while it stands. The
 *   Bindery's four SEAL PRESSES slam on a short delay after their lever is
 *   pulled ('press/slammed' { position }). If the Censor is under the
 *   plate when it lands, it is STAMPED — pinned flat for a long damage
 *   window. Positional baiting, not timing: walk it under a press, pull,
 *   and step aside. (The Tolltaker taught rhythm; the Censor teaches
 *   footwork.)
 *
 * Unlike the blanks it commands, it does not care whether you look at it.
 * It has been looked at by better.
 */
const HP = 280;
const WALK_SPEED = 1.18;
const ENRAGE_SPEED = 1.65;
const ENRAGE_TIME = 3.5;
const STAMP_STUN = 6.0;
const STAMP_RADIUS = 1.9;
const ARMOR_FACTOR = 0.1;
const CONTACT_RANGE = 0.9;
const CONTACT_DAMAGE = 24;
const CONTACT_COOLDOWN = 1.4;

export class Censor {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  radius = 0.5;
  /** @type {EnemyHealth} */
  health;

  #physics;
  #events;
  #playerObject;
  #playerStats;
  #story;
  #joints;
  #phase = 0;
  #cooldown = 0;
  #stunTimer = 0;
  #enrageTimer = 0;
  #felledFlagSet = false;
  #unsubPress;

  constructor({ ps2, physics, events, spawn, playerObject, playerStats, story }) {
    this.#physics = physics;
    this.#events = events;
    this.#playerObject = playerObject;
    this.#playerStats = playerStats;
    this.#story = story;

    const ink = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x14121a, roughness: 0.95 }));
    const brass = ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x8a7434, metalness: 0.7, roughness: 0.4 })
    );
    const stained = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x2a2432, roughness: 1 }));

    const torso = new THREE.Group();
    torso.position.y = 1.2;
    const robe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.46), ink);
    robe.position.y = 0.45;
    torso.add(robe);
    // The seal-face: a round brass stamp, blank of features.
    const sealFace = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10), brass);
    sealFace.rotation.x = Math.PI / 2;
    sealFace.position.set(0, 1.12, 0.1);
    torso.add(sealFace);
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), ink);
    cowl.position.y = 1.18;
    cowl.position.z = -0.08;
    torso.add(cowl);

    const mkLimb = (w, h, material, parent, x, y, z = 0) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), material);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      pivot.position.set(x, y, z);
      parent.add(pivot);
      return pivot;
    };
    const armL = mkLimb(0.17, 0.9, stained, torso, -0.5, 0.85, 0.06);
    const armR = mkLimb(0.17, 0.9, stained, torso, 0.5, 0.85, 0.06);
    armL.rotation.x = -0.4;
    armR.rotation.x = -0.4;
    // Robe skirt instead of legs — it glides.
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.55), ink);
    skirt.position.y = 0.6;
    this.object.add(skirt);

    this.object.add(torso);
    this.object.traverse((n) => (n.castShadow = true));
    this.object.position.copy(spawn.position);
    this.#joints = { torso, armL, armR, skirt };

    this.health = new EnemyHealth(events, { hp: HP, root: this.object });

    // The presses are the only argument it respects.
    this.#unsubPress = events.on('press/slammed', ({ position }) => {
      if (!this.object.parent || !this.health.alive) return;
      const dist = this.object.position.distanceTo(position);
      if (dist < STAMP_RADIUS) {
        this.#stunTimer = STAMP_STUN;
        this.#events.emit('audio/sfx', { id: 'enemyHit' });
        this.#events.emit('camera/impulse', { strength: 0.5 });
        this.#events.emit('ui/toast', { text: 'STAMPED. The Censor is pinned under its own instrument.' });
      }
    });
  }

  get alive() {
    return this.health.alive;
  }

  get stunned() {
    return this.#stunTimer > 0;
  }

  hearNoise() {} // it reads the room, it does not listen to it

  takeHit(damage) {
    if (!this.health.alive) return;
    const dealt = this.stunned ? damage : damage * ARMOR_FACTOR;
    this.health.takeHit(dealt);
    if (!this.health.alive) {
      this.#unsubPress?.();
      this.#unsubPress = null;
      if (!this.#felledFlagSet) {
        this.#felledFlagSet = true;
        this.#story?.set('censorFelled', true);
        this.#events.emit('audio/sfx', { id: 'stingerKill' });
        this.#events.emit('ui/toast', { text: 'The Censor is struck out. The margin takes it back.' });
      }
    }
  }

  update(dt) {
    const dying = this.health.update(dt);
    if (!this.health.alive) {
      this.#joints.torso.rotation.x = Math.min(1.4, this.#joints.torso.rotation.x + dt * 1.4);
      this.object.position.y = -dying * 0.5;
      return;
    }

    if (this.#stunTimer > 0) {
      this.#stunTimer -= dt;
      // Pressed flat: torso pitched hard, arms splayed, shivering.
      this.#joints.torso.rotation.x +=
        (1.25 - this.#joints.torso.rotation.x) * Math.min(1, 7 * dt);
      this.#joints.armL.rotation.x = -1.4 + Math.sin(this.#phase * 18) * 0.05;
      this.#joints.armR.rotation.x = -1.4 - Math.sin(this.#phase * 18) * 0.05;
      this.#phase += dt;
      if (this.#stunTimer <= 0) this.#enrageTimer = ENRAGE_TIME;
      return;
    }

    const speed = this.#enrageTimer > 0 ? ENRAGE_SPEED : WALK_SPEED;
    if (this.#enrageTimer > 0) this.#enrageTimer -= dt;

    const toPlayer = new THREE.Vector3()
      .subVectors(this.#playerObject.position, this.object.position)
      .setY(0);
    const dist = toPlayer.length();
    toPlayer.normalize();
    this.object.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    if (dist > CONTACT_RANGE) {
      this.#physics.moveCircle(
        this.object.position,
        toPlayer.x * speed * dt,
        toPlayer.z * speed * dt,
        this.radius
      );
    }

    // The glide: no gait, just a slow breathing bob and reaching hands.
    this.#phase += dt;
    this.object.position.y = Math.sin(this.#phase * 1.8) * 0.03;
    this.#joints.torso.rotation.x +=
      (0.12 - this.#joints.torso.rotation.x) * Math.min(1, 4 * dt);
    const reach = dist < 3 ? -1.2 : -0.4;
    this.#joints.armL.rotation.x += (reach - this.#joints.armL.rotation.x) * Math.min(1, 5 * dt);
    this.#joints.armR.rotation.x += (reach - this.#joints.armR.rotation.x) * Math.min(1, 5 * dt);

    this.#cooldown -= dt;
    if (dist <= CONTACT_RANGE && this.#cooldown <= 0) {
      this.#cooldown = CONTACT_COOLDOWN;
      const landed = this.#playerStats.damage(CONTACT_DAMAGE);
      if (landed) {
        this.#events.emit('audio/sfx', { id: 'hurt' });
        this.#events.emit('camera/impulse', { strength: 0.45 });
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
