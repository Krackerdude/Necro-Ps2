import * as THREE from 'three';
import { EnemyHealth } from '../combat/EnemyHealth.js';

/**
 * DIGGER — the Undercroft's resident. A husk that never learned to stop
 * being planted: it travels UNDER the floor as a moving mound of turned
 * earth — fast, and completely immune to harm — but it can only swim in
 * SOFT GROUND (the spawn def's `soft` rects). Stone is the counterplay:
 * on the paved paths it must surface and walk like anything else, and a
 * surfaced digger is just meat with opinions.
 *
 * Cycle: burrowed (chasing, invulnerable) → surfaces beside its prey (or
 * at the soft/stone boundary when frustrated) → fights on foot (vulnerable)
 * → re-burrows when the prey gets away and there's soil underfoot.
 */
const BURROW_SPEED = 2.3;
const WALK_SPEED = 1.0;
const SENSE_RADIUS = 12;
const SURFACE_RANGE = 1.7;
const SURFACE_TIME = 0.5;
const REBURROW_RANGE = 5;
const REBURROW_DELAY = 2.2;
const FRUSTRATION_TIME = 3.0;
const CONTACT_RANGE = 0.68;
const CONTACT_DAMAGE = 14;
const CONTACT_COOLDOWN = 1.1;

export class Digger {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  radius = 0.34;
  /** @type {EnemyHealth} */
  health;

  #physics;
  #events;
  #playerObject;
  #playerStats;
  #soft;
  #body;
  #mound;
  #joints;
  /** 'burrowed' | 'surfacing' | 'surfaced' */
  #state = 'burrowed';
  #timer = 0;
  #frustration = 0;
  #reburrow = 0;
  #cooldown = 0;
  #phase = Math.random() * 10;

  constructor({ ps2, physics, events, spawn, playerObject, playerStats }) {
    this.#physics = physics;
    this.#events = events;
    this.#playerObject = playerObject;
    this.#playerStats = playerStats;
    // Soft-ground rects [[x0,z0,x1,z1], ...] — the digger's whole world.
    this.#soft = spawn.soft ?? [];

    const soil = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 }));
    const rootSkin = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }));
    const rags = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x3e3428, roughness: 1 }));

    // The mound: what you see while it swims.
    this.#mound = new THREE.Group();
    const heap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.36, 7), soil);
    heap.position.y = 0.18;
    this.#mound.add(heap);
    const crumbs = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 5), soil);
    crumbs.position.set(0.35, 0.1, 0.2);
    this.#mound.add(crumbs);
    this.object.add(this.#mound);

    // The body: a root-fed husk, hidden below until it isn't.
    this.#body = new THREE.Group();
    const torso = new THREE.Group();
    torso.position.y = 0.74;
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.26), rags);
    torsoMesh.position.y = 0.26;
    torso.add(torsoMesh);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.22), rootSkin);
    head.position.set(0, 0.6, 0.16);
    head.rotation.x = 0.5;
    torso.add(head);
    const mkLimb = (w, h, material, parent, x, y, z = 0) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), material);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      pivot.position.set(x, y, z);
      parent.add(pivot);
      return pivot;
    };
    const armL = mkLimb(0.11, 0.5, rootSkin, torso, -0.3, 0.44, 0.1);
    const armR = mkLimb(0.11, 0.5, rootSkin, torso, 0.3, 0.44, 0.1);
    const legL = mkLimb(0.13, 0.72, rags, this.#body, -0.12, 0.72);
    const legR = mkLimb(0.13, 0.72, rags, this.#body, 0.12, 0.72);
    // Roots trail from the shoulders — it never fully left the bed.
    for (const side of [-1, 1]) {
      const rootTrail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.5, 4), rootSkin);
      rootTrail.position.set(side * 0.2, 0.9, -0.18);
      rootTrail.rotation.x = 0.7;
      this.#body.add(rootTrail);
    }
    this.#body.add(torso);
    this.#body.visible = false;
    this.#body.position.y = -1.4;
    this.object.add(this.#body);
    this.#joints = { torso, armL, armR, legL, legR };

    this.object.traverse((n) => (n.castShadow = true));
    this.object.position.copy(spawn.position);
    this.health = new EnemyHealth(events, { hp: 60, root: this.object });
  }

  get alive() {
    return this.health.alive;
  }

  hearNoise() {} // it reads footfalls through the soil already

  #inSoft(x, z) {
    return this.#soft.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  }

  takeHit(damage) {
    if (!this.health.alive) return;
    if (this.#state === 'burrowed') {
      // Blades and bullets do not argue with the ground.
      this.#events.emit('audio/sfx', { id: 'uiBack' });
      return;
    }
    this.health.takeHit(damage);
  }

  update(dt) {
    const dying = this.health.update(dt);
    if (!this.health.alive) {
      this.#body.rotation.x = Math.min(Math.PI / 2, this.#body.rotation.x + dt * 2);
      this.object.position.y = -dying * 0.3;
      return;
    }

    const toPlayer = new THREE.Vector3()
      .subVectors(this.#playerObject.position, this.object.position)
      .setY(0);
    const dist = toPlayer.length();
    toPlayer.normalize();

    if (this.#state === 'burrowed') {
      this.#mound.visible = true;
      this.#phase += dt * 8;
      this.#mound.children[0].scale.y = 1 + Math.sin(this.#phase) * 0.15;
      if (dist > SENSE_RADIUS) return; // dozing in the dark soil

      // Swim toward the prey, but only through soft ground.
      const step = BURROW_SPEED * dt;
      const nx = this.object.position.x + toPlayer.x * step;
      const nz = this.object.position.z + toPlayer.z * step;
      if (this.#inSoft(nx, nz)) {
        this.object.position.x = nx;
        this.object.position.z = nz;
        this.#frustration = 0;
      } else if (this.#inSoft(nx, this.object.position.z)) {
        this.object.position.x = nx;
        this.#frustration += dt;
      } else if (this.#inSoft(this.object.position.x, nz)) {
        this.object.position.z = nz;
        this.#frustration += dt;
      } else {
        this.#frustration += dt;
      }

      // Close enough to strike — or angry enough at the paving to try.
      if (dist < SURFACE_RANGE || this.#frustration > FRUSTRATION_TIME) {
        this.#state = 'surfacing';
        this.#timer = SURFACE_TIME;
        this.#frustration = 0;
        this.#body.visible = true;
        this.#events.emit('audio/sfx', { id: 'huskGroan' });
        this.#events.emit('camera/impulse', { strength: 0.25 });
      }
      return;
    }

    if (this.#state === 'surfacing') {
      this.#timer -= dt;
      const t = 1 - Math.max(0, this.#timer / SURFACE_TIME);
      this.#body.position.y = -1.4 * (1 - t);
      this.#mound.visible = t < 0.6;
      if (this.#timer <= 0) {
        this.#state = 'surfaced';
        this.#body.position.y = 0;
        this.#reburrow = REBURROW_DELAY;
      }
      return;
    }

    // Surfaced: an ordinary nightmare on foot.
    this.object.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    if (dist > CONTACT_RANGE) {
      this.#physics.moveCircle(
        this.object.position,
        toPlayer.x * WALK_SPEED * dt,
        toPlayer.z * WALK_SPEED * dt,
        this.radius
      );
    }
    this.#phase += dt * 4;
    const swing = Math.sin(this.#phase) * 0.45;
    this.#joints.legL.rotation.x = swing;
    this.#joints.legR.rotation.x = -swing;
    this.#joints.armL.rotation.x = -1.0 + Math.sin(this.#phase * 1.6) * 0.25;
    this.#joints.armR.rotation.x = -0.9 - Math.sin(this.#phase * 1.6) * 0.25;

    this.#cooldown -= dt;
    if (dist <= CONTACT_RANGE && this.#cooldown <= 0) {
      this.#cooldown = CONTACT_COOLDOWN;
      if (this.#playerStats.damage(CONTACT_DAMAGE)) {
        this.#events.emit('audio/sfx', { id: 'hurt' });
      }
    }

    // The prey escaped and there's soil underfoot: go home into the ground.
    if (dist > REBURROW_RANGE && this.#inSoft(this.object.position.x, this.object.position.z)) {
      this.#reburrow -= dt;
      if (this.#reburrow <= 0) {
        this.#state = 'burrowed';
        this.#body.visible = false;
        this.#body.position.y = -1.4;
        this.#mound.visible = true;
        this.#events.emit('audio/sfx', { id: 'footstepBone' });
      }
    } else {
      this.#reburrow = REBURROW_DELAY;
    }
  }

  /* Save participant interface. */
  captureState() {
    const { x, y, z } = this.object.position;
    return { position: [x, y, z], hp: this.health.hp, surfaced: this.#state !== 'burrowed' };
  }

  restoreState(state) {
    if (state?.position) this.object.position.set(...state.position);
    if (typeof state?.hp === 'number') this.health.hp = state.hp;
    if (state?.surfaced) {
      this.#state = 'surfaced';
      this.#body.visible = true;
      this.#body.position.y = 0;
      this.#mound.visible = false;
    }
  }
}
