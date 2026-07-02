import * as THREE from 'three';
import { PursuitBehavior } from '../../ai/PursuitBehavior.js';
import { EnemyHealth } from '../combat/EnemyHealth.js';
import { AnimationPlayer } from '../../animation/AnimationPlayer.js';
import { HUSK_CLIPS } from '../animation/huskClips.js';

/**
 * Husk — a member of the congregation that never stopped attending.
 *
 * Slow, relentless shambler. Brain in ai/PursuitBehavior, mortality in
 * combat/EnemyHealth, poses in animation/huskClips.
 *
 * Hit reactions:
 *   - any hit    → directional stagger (whipped away from the shooter,
 *                  arms thrown wide, a step of lost balance).
 *   - heavy hit  → chance of full knockdown: falls backwards (root pitch),
 *                  lies still, then gets back up — slow and wrong.
 * While reacting it neither moves nor damages.
 */
const SPEED = { haunt: 0.45, pursue: 1.15, return: 0.6 };
const CONTACT_RANGE = 0.62;
const CONTACT_DAMAGE = 12;
const CONTACT_COOLDOWN = 1.0;
const HP = 70;
const HEAVY_HIT = 30;
const KNOCKDOWN_CHANCE = 0.5;

const FALL_TIME = 0.55;
const DOWN_TIME = 1.6;
const RISE_TIME = 1.1;

export class Husk {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  radius = 0.34;
  /** @type {EnemyHealth} */
  health;
  /** @type {Record<string, THREE.Object3D>} */
  joints = {};

  #anim;
  #behavior;
  #physics;
  #events;
  #playerObject;
  #playerStats;
  #cooldown = 0;
  #shamblePhase = Math.random() * 10;
  #wasPursuing = false;
  /** null | { type: 'fall'|'down'|'rise', timer: number } */
  #reaction = null;
  #staggerShove = new THREE.Vector3();

  constructor({ ps2, physics, events, spawn, playerObject, playerStats }) {
    this.#physics = physics;
    this.#events = events;
    this.#playerObject = playerObject;
    this.#playerStats = playerStats;

    const rotSkin = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x7a8560, roughness: 1 }));
    const rags = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }));

    // Torso pivot at the waist (carries head + arms); legs on the root.
    const torso = new THREE.Group();
    torso.position.y = 0.74;
    torso.rotation.x = 0.35; // base hunch
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.26), rags);
    torsoMesh.position.y = 0.26;
    torso.add(torsoMesh);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.22), rotSkin);
    headMesh.position.set(0, 0.6, 0.16);
    headMesh.rotation.x = 0.5;
    torso.add(headMesh);

    const mkLimb = (w, h, material, parent, x, y, z = 0) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), material);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      pivot.position.set(x, y, z);
      parent.add(pivot);
      return pivot;
    };
    const armL = mkLimb(0.1, 0.5, rotSkin, torso, -0.3, 0.44, 0.1);
    const armR = mkLimb(0.1, 0.5, rotSkin, torso, 0.3, 0.44, 0.1);
    const legL = mkLimb(0.13, 0.72, rags, this.object, -0.12, 0.72);
    const legR = mkLimb(0.13, 0.72, rags, this.object, 0.12, 0.72);
    armL.rotation.x = -0.5;
    armR.rotation.x = -0.5;

    this.object.add(torso);
    this.object.traverse((n) => (n.castShadow = true));
    this.object.position.copy(spawn.position);

    this.joints = { torso, armL, armR, legL, legR };
    this.#anim = new AnimationPlayer(this.joints);
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
    if (!this.health.alive) return;
    this.health.takeHit(damage);
    if (!this.health.alive) return; // death animation takes over

    // Whipped away from the attacker.
    this.#staggerShove
      .subVectors(this.object.position, this.#playerObject.position)
      .setY(0)
      .normalize()
      .multiplyScalar(1.6);

    if (damage >= HEAVY_HIT && Math.random() < KNOCKDOWN_CHANCE && !this.#reaction) {
      this.#reaction = { type: 'fall', timer: FALL_TIME };
      this.#anim.play(HUSK_CLIPS.fall);
      this.#events.emit('audio/sfx', { id: 'huskGroan' });
    } else if (!this.#reaction) {
      this.#anim.play(HUSK_CLIPS.stagger);
    }
  }

  update(dt) {
    const deathProgress = this.health.update(dt);
    if (!this.health.alive) {
      this.object.rotation.x = deathProgress * (Math.PI / 2) * 0.9;
      this.object.position.y = -deathProgress * 0.35;
      return;
    }

    this.#anim.update(dt);

    // Stagger knockback applies while it decays, whatever else is happening.
    if (this.#staggerShove.lengthSq() > 1e-4) {
      this.#physics.moveCircle(
        this.object.position,
        this.#staggerShove.x * dt,
        this.#staggerShove.z * dt,
        this.radius
      );
      this.#staggerShove.multiplyScalar(Math.max(0, 1 - 7 * dt));
    }

    if (this.#reaction) {
      this.#updateKnockdown(dt);
      return;
    }
    if (this.#anim.isActing) return; // staggering: no walk, no damage

    const dir = this.#behavior.update(this.object.position, this.#playerObject.position, dt);
    const speed = SPEED[this.#behavior.state] ?? SPEED.haunt;
    this.#physics.moveCircle(this.object.position, dir.x * speed * dt, dir.z * speed * dt, this.radius);

    if (dir.lengthSq() > 0.001) {
      this.object.rotation.y = Math.atan2(dir.x, dir.z);
    }

    // Broken shamble — uneven stride lengths per leg.
    const pursuing = this.#behavior.state === 'pursue';
    this.#shamblePhase += dt * 3.4 * (speed / SPEED.pursue + 0.4);
    const swing = Math.sin(this.#shamblePhase);
    this.joints.legL.rotation.x = swing * 0.5;
    this.joints.legR.rotation.x = Math.sin(this.#shamblePhase + 2.6) * 0.42;
    this.object.position.y = Math.abs(swing) * 0.02;

    // Pursuit flail: arms come up and grasp, over-reaching out of sync.
    const reachL = pursuing ? -1.15 + Math.sin(this.#shamblePhase * 1.7) * 0.25 : -0.5;
    const reachR = pursuing ? -1.05 + Math.sin(this.#shamblePhase * 2.3 + 1.2) * 0.3 : -0.5;
    this.joints.armL.rotation.x += (reachL - this.joints.armL.rotation.x) * Math.min(1, 6 * dt);
    this.joints.armR.rotation.x += (reachR - this.joints.armR.rotation.x) * Math.min(1, 6 * dt);

    if (pursuing && !this.#wasPursuing) {
      this.#events.emit('audio/sfx', { id: 'huskGroan' });
    }
    this.#wasPursuing = pursuing;

    this.#cooldown -= dt;
    if (this.#cooldown <= 0) {
      const d = this.object.position.distanceTo(this.#playerObject.position);
      if (d < CONTACT_RANGE + 0.32) {
        this.#playerStats.damage(CONTACT_DAMAGE);
        this.#events.emit('player/damaged', { from: this.object.position });
        this.#events.emit('audio/sfx', { id: 'hurt' });
        this.#cooldown = CONTACT_COOLDOWN;
      }
    }
  }

  /** Root-motion knockdown: pitch over backwards, lie still, get back up. */
  #updateKnockdown(dt) {
    const r = this.#reaction;
    r.timer -= dt;
    switch (r.type) {
      case 'fall': {
        const p = 1 - Math.max(0, r.timer / FALL_TIME);
        this.object.rotation.x = -p * 1.35; // over backwards
        this.object.position.y = -p * 0.3;
        if (r.timer <= 0) this.#reaction = { type: 'down', timer: DOWN_TIME };
        break;
      }
      case 'down':
        if (r.timer <= 0) {
          this.#reaction = { type: 'rise', timer: RISE_TIME };
          this.#anim.play(HUSK_CLIPS.rise);
          this.#events.emit('audio/sfx', { id: 'huskGroan' });
        }
        break;
      case 'rise': {
        const p = 1 - Math.max(0, r.timer / RISE_TIME);
        this.object.rotation.x = -(1 - p) * 1.35;
        this.object.position.y = -(1 - p) * 0.3;
        if (r.timer <= 0) {
          this.object.rotation.x = 0;
          this.object.position.y = 0;
          this.#reaction = null;
        }
        break;
      }
      default:
        this.#reaction = null;
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
