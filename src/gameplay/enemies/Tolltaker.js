import * as THREE from 'three';
import { EnemyHealth } from '../combat/EnemyHealth.js';

/**
 * THE TOLLTAKER — the Bell Tower's midpoint boss. A giant that has knelt
 * beneath the Great Bell for eighty years, wearing a cracked steeple bell
 * as a hood. It is completely deaf — the one resident of the wing that
 * sound cannot fool — and nearly unkillable while it stands:
 *
 *   THE GIMMICK: armored (damage ×0.12) until the GREAT BELL rings
 *   ('bell/great', emitted by the arena's rope-pulls). The toll drops it
 *   to its knees for a long stun window — full damage, no contact harm.
 *   Ring, punish, retreat, repeat.
 *
 * It always knows where you are (it feels footfalls through the stone,
 * which is why walking quietly works on listeners and not on it).
 */
const HP = 240;
const WALK_SPEED = 1.05;
const ENRAGE_SPEED = 1.55; // after each stun it comes back angrier, briefly
const ENRAGE_TIME = 4;
const STUN_TIME = 5.5;
const ARMOR_FACTOR = 0.12;
const CONTACT_RANGE = 0.95;
const CONTACT_DAMAGE = 26;
const CONTACT_COOLDOWN = 1.5;

export class Tolltaker {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  radius = 0.55;
  /** @type {EnemyHealth} */
  health;

  #physics;
  #events;
  #playerObject;
  #playerStats;
  #joints;
  #phase = 0;
  #cooldown = 0;
  #stunTimer = 0;
  #enrageTimer = 0;
  #felledFlagSet = false;
  #story;
  #unsubBell;

  constructor({ ps2, physics, events, spawn, playerObject, playerStats, story }) {
    this.#physics = physics;
    this.#events = events;
    this.#playerObject = playerObject;
    this.#playerStats = playerStats;
    this.#story = story;

    const bronze = ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x6a5a34, metalness: 0.55, roughness: 0.5 })
    );
    const shroud = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 1 }));
    const rotSkin = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x8a8570, roughness: 1 }));

    // Big frame: thick legs on the root, a barrel torso at the waist pivot,
    // long arms, and the cracked bell worn as a hood.
    const torso = new THREE.Group();
    torso.position.y = 1.15;
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.5), shroud);
    torsoMesh.position.y = 0.42;
    torso.add(torsoMesh);
    const bellHead = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.85, 9), bronze);
    bellHead.position.y = 1.2;
    torso.add(bellHead);
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.6, 0.05),
      ps2.patch(new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 }))
    );
    crack.position.set(0.18, 1.15, 0.34);
    crack.rotation.z = 0.3;
    torso.add(crack);

    const mkLimb = (w, h, material, parent, x, y, z = 0) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), material);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      pivot.position.set(x, y, z);
      parent.add(pivot);
      return pivot;
    };
    const armL = mkLimb(0.2, 0.95, rotSkin, torso, -0.55, 0.75, 0.08);
    const armR = mkLimb(0.2, 0.95, rotSkin, torso, 0.55, 0.75, 0.08);
    for (const arm of [armL, armR]) {
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), bronze);
      knuckle.position.y = -0.95;
      arm.add(knuckle);
      arm.rotation.x = -0.35;
    }
    const legL = mkLimb(0.26, 1.15, shroud, this.object, -0.24, 1.15);
    const legR = mkLimb(0.26, 1.15, shroud, this.object, 0.24, 1.15);

    this.object.add(torso);
    this.object.traverse((n) => (n.castShadow = true));
    this.object.position.copy(spawn.position);
    this.#joints = { torso, armL, armR, legL, legR };

    this.health = new EnemyHealth(events, { hp: HP, root: this.object });

    // The Great Bell is the only sound it has ever felt.
    this.#unsubBell = events.on('bell/great', () => {
      if (!this.object.parent || !this.health.alive) return;
      this.#stunTimer = STUN_TIME;
      this.#events.emit('audio/sfx', { id: 'stingerDetect' });
    });
  }

  get alive() {
    return this.health.alive;
  }

  get stunned() {
    return this.#stunTimer > 0;
  }

  /** Deaf. The whole wing's mechanic bounces off this one. */
  hearNoise() {}

  takeHit(damage) {
    if (!this.health.alive) return;
    const dealt = this.stunned ? damage : damage * ARMOR_FACTOR;
    this.health.takeHit(dealt);
    if (!this.health.alive) {
      this.#unsubBell?.();
      this.#unsubBell = null;
      if (!this.#felledFlagSet) {
        this.#felledFlagSet = true;
        this.#story?.set('tolltakerFelled', true);
        this.#events.emit('audio/sfx', { id: 'stingerKill' });
        this.#events.emit('ui/toast', { text: 'The Tolltaker kneels one last time, and means it.' });
      }
    }
  }

  update(dt) {
    const dying = this.health.update(dt);
    if (!this.health.alive) {
      // Slumps forward into the floor as it fades.
      this.#joints.torso.rotation.x = Math.min(1.35, this.#joints.torso.rotation.x + dt * 1.2);
      this.object.position.y = -dying * 0.4;
      return;
    }

    if (this.#stunTimer > 0) {
      this.#stunTimer -= dt;
      // On its knees, bell hood shivering with the toll.
      this.#joints.torso.rotation.x +=
        (1.05 - this.#joints.torso.rotation.x) * Math.min(1, 6 * dt);
      this.#joints.torso.rotation.z = Math.sin(this.#phase * 22) * 0.03;
      this.#phase += dt;
      if (this.#stunTimer <= 0) this.#enrageTimer = ENRAGE_TIME;
      return;
    }

    const speed = this.#enrageTimer > 0 ? ENRAGE_SPEED : WALK_SPEED;
    if (this.#enrageTimer > 0) this.#enrageTimer -= dt;

    // It knows. It has always known.
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

    // Heavy shamble.
    this.#phase += dt * (2.2 * speed);
    const swing = Math.sin(this.#phase) * 0.4;
    this.#joints.legL.rotation.x = swing;
    this.#joints.legR.rotation.x = -swing;
    this.#joints.torso.rotation.x +=
      (0.22 - this.#joints.torso.rotation.x) * Math.min(1, 4 * dt);
    this.#joints.torso.rotation.z = Math.sin(this.#phase * 0.5) * 0.06;
    this.#joints.armL.rotation.x = -0.35 + swing * 0.25;
    this.#joints.armR.rotation.x = -0.35 - swing * 0.25;

    this.#cooldown -= dt;
    if (dist <= CONTACT_RANGE && this.#cooldown <= 0) {
      this.#cooldown = CONTACT_COOLDOWN;
      const landed = this.#playerStats.damage(CONTACT_DAMAGE);
      if (landed) {
        this.#events.emit('audio/sfx', { id: 'hurt' });
        this.#events.emit('camera/impulse', { strength: 0.5 });
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
