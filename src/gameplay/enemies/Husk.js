import * as THREE from 'three';
import { PursuitBehavior } from '../../ai/PursuitBehavior.js';
import { EnemyHealth } from '../combat/EnemyHealth.js';
import { AnimationPlayer } from '../../animation/AnimationPlayer.js';
import { HUSK_CLIPS } from '../animation/huskClips.js';

/**
 * Husk — a member of the congregation that never stopped attending.
 *
 * VARIANTS (spawn def `variant`, default 'shambler'):
 *   shambler — the baseline: slow, relentless, long memory.
 *   watcher  — stands dormant facing wherever it was left (`facing`) until
 *              the player comes close, makes noise, or hurts it. Then it
 *              turns around.
 *   crawler  — legless; drags itself flat along the ground. Slower, less
 *              hp, can't be knocked down (it's already down).
 *   twitcher — spasms violently mid-shamble; a little faster.
 *
 * THE GRAB: at close range a pursuing husk lunges. If it connects, the
 * player is held — damage ticks until they mash free ('grab/struggle'
 * events counted here). Escape staggers the husk and starts a cooldown.
 *
 * Brain in ai/PursuitBehavior, mortality in combat/EnemyHealth, poses in
 * animation/huskClips. This file owns the body and its states:
 *   dormant → normal ⇄ (reaction: stagger/knockdown) and normal → lunge →
 *   hold → normal.
 */
const CONTACT_RANGE = 0.62;
const CONTACT_DAMAGE = 12;
const CONTACT_COOLDOWN = 1.0;
const HEAVY_HIT = 30;
const KNOCKDOWN_CHANCE = 0.5;

const FALL_TIME = 0.55;
const DOWN_TIME = 1.6;
const RISE_TIME = 1.1;

/* Grab tuning: mashing ~7 keys breaks free; a passive player eats the full
 * hold (≈20 hp). Escape buys a real window via stagger + cooldown. */
const LUNGE_RANGE = 1.15;
const LUNGE_SPEED = 3.4;
const LUNGE_TIME = 0.35;
const GRAB_CONNECT = 0.78;
const HOLD_MAX = 3.2;
const HOLD_TICK = 0.75;
const HOLD_TICK_DAMAGE = 5;
const STRUGGLE_PER_PRESS = 0.2;
const STRUGGLE_DECAY = 0.25;
const GRAB_COOLDOWN = 4.5;

const VARIANTS = {
  shambler: { hp: 70, speed: { haunt: 0.45, pursue: 1.15, investigate: 0.9, return: 0.6 }, detect: 4.5 },
  watcher: { hp: 70, speed: { haunt: 0.4, pursue: 1.25, investigate: 1.0, return: 0.6 }, detect: 4.5, dormant: true, wakeRadius: 2.7 },
  crawler: { hp: 55, speed: { haunt: 0.3, pursue: 0.62, investigate: 0.5, return: 0.4 }, detect: 3.5, crawl: true },
  twitcher: { hp: 60, speed: { haunt: 0.5, pursue: 1.38, investigate: 1.1, return: 0.7 }, detect: 5.0 },
};

export class Husk {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  radius = 0.34;
  /** @type {EnemyHealth} */
  health;
  /** @type {Record<string, THREE.Object3D>} */
  joints = {};

  #cfg;
  #anim;
  #behavior;
  #physics;
  #events;
  #playerObject;
  #playerStats;
  #cooldown = 0;
  #shamblePhase = Math.random() * 10;
  #wasPursuing = false;
  /** null | { type: 'fall'|'down'|'rise', timer } */
  #reaction = null;
  #staggerShove = new THREE.Vector3();
  /** 'dormant' | 'normal' | 'lunge' | 'hold' */
  #mode = 'normal';
  #lungeTimer = 0;
  #lungeDir = new THREE.Vector3();
  #holdTimer = 0;
  #tickTimer = 0;
  #struggle = 0;
  #grabCooldown = 0;
  #spasmTimer = 2;
  #spasmRemaining = 0;
  #unsubStruggle = null;
  #baseTorsoX;

  constructor({ ps2, physics, events, spawn, playerObject, playerStats }) {
    this.#physics = physics;
    this.#events = events;
    this.#playerObject = playerObject;
    this.#playerStats = playerStats;
    this.#cfg = VARIANTS[spawn.variant ?? 'shambler'] ?? VARIANTS.shambler;

    const rotSkin = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x7a8560, roughness: 1 }));
    const rags = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }));

    // Torso pivot at the waist (carries head + arms); legs on the root.
    const torso = new THREE.Group();
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
    armL.rotation.x = -0.5;
    armR.rotation.x = -0.5;

    let legL = null;
    let legR = null;
    if (this.#cfg.crawl) {
      // Crawler: prone — waist near the floor, torso pitched almost flat,
      // no legs (they didn't come along).
      torso.position.y = 0.24;
      this.#baseTorsoX = 1.25;
    } else {
      torso.position.y = 0.74;
      this.#baseTorsoX = 0.35;
      legL = mkLimb(0.13, 0.72, rags, this.object, -0.12, 0.72);
      legR = mkLimb(0.13, 0.72, rags, this.object, 0.12, 0.72);
    }
    torso.rotation.x = this.#baseTorsoX;

    this.object.add(torso);
    this.object.traverse((n) => (n.castShadow = true));
    this.object.position.copy(spawn.position);

    this.joints = { torso, armL, armR };
    if (legL) this.joints.legL = legL;
    if (legR) this.joints.legR = legR;
    this.#anim = new AnimationPlayer(this.joints);
    this.health = new EnemyHealth(events, { hp: this.#cfg.hp, root: this.object });

    this.#behavior = new PursuitBehavior({
      home: spawn.position,
      homeRadius: spawn.homeRadius ?? 4,
      detectRadius: this.#cfg.detect,
      loseRadius: 14,
      hasLineOfSight: (from, to) => !physics.segmentBlockedXZ(from, to),
    });

    if (this.#cfg.dormant) {
      this.#mode = 'dormant';
      this.object.rotation.y = spawn.facing ?? Math.random() * Math.PI * 2;
    }
  }

  get alive() {
    return this.health.alive;
  }

  /** A noise reached this husk. Wakes watchers; aggros everyone in range. */
  hearNoise(position, radius) {
    if (!this.health.alive) return;
    if (this.#mode === 'dormant') {
      if (this.object.position.distanceTo(position) <= radius * 1.3) this.#wake();
      return;
    }
    this.#behavior.hearNoise(this.object.position, position, radius);
  }

  takeHit(damage) {
    if (!this.health.alive) return;
    if (this.#mode === 'dormant') this.#wake();
    if (this.#mode === 'hold') this.#releaseGrab(true); // pain breaks the hold
    this.health.takeHit(damage);
    if (!this.health.alive) {
      if (this.#mode === 'hold') this.#releaseGrab(true);
      return;
    }

    // Whipped away from the attacker.
    this.#staggerShove
      .subVectors(this.object.position, this.#playerObject.position)
      .setY(0)
      .normalize()
      .multiplyScalar(1.6);

    const canKnockdown = !this.#cfg.crawl && !this.#reaction;
    if (damage >= HEAVY_HIT && canKnockdown && Math.random() < KNOCKDOWN_CHANCE) {
      this.#mode = 'normal';
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
      const flat = this.#cfg.crawl ? 0.15 : Math.PI / 2;
      this.object.rotation.x = deathProgress * flat * 0.9;
      this.object.position.y = -deathProgress * (this.#cfg.crawl ? 0.12 : 0.35);
      return;
    }

    this.#anim.update(dt);
    this.#grabCooldown = Math.max(0, this.#grabCooldown - dt);

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

    switch (this.#mode) {
      case 'dormant':
        // It senses proximity even without eyes on you.
        if (this.object.position.distanceTo(this.#playerObject.position) < this.#cfg.wakeRadius) {
          this.#wake();
        }
        return;
      case 'lunge':
        this.#updateLunge(dt);
        return;
      case 'hold':
        this.#updateHold(dt);
        return;
      default:
    }

    if (this.#reaction) {
      this.#updateKnockdown(dt);
      return;
    }
    if (this.#anim.isActing) return; // staggering: no walk, no damage

    const dir = this.#behavior.update(this.object.position, this.#playerObject.position, dt);
    const speed = this.#cfg.speed[this.#behavior.state] ?? this.#cfg.speed.haunt;
    this.#physics.moveCircle(this.object.position, dir.x * speed * dt, dir.z * speed * dt, this.radius);

    if (dir.lengthSq() > 0.001) {
      this.object.rotation.y = Math.atan2(dir.x, dir.z);
    }

    const pursuing = this.#behavior.state === 'pursue';
    this.#updateGait(dt, speed, pursuing);

    if (pursuing && !this.#wasPursuing) {
      this.#events.emit('audio/sfx', { id: 'huskGroan' });
    }
    this.#wasPursuing = pursuing;

    const dist = this.object.position.distanceTo(this.#playerObject.position);

    // The grab: lunge when close, off cooldown, and the prey is takeable.
    if (pursuing && dist < LUNGE_RANGE && this.#grabCooldown === 0) {
      this.#mode = 'lunge';
      this.#lungeTimer = LUNGE_TIME;
      this.#lungeDir
        .subVectors(this.#playerObject.position, this.object.position)
        .setY(0)
        .normalize();
      this.#events.emit('audio/sfx', { id: 'huskGroan' });
      return;
    }

    // Fallback contact scrape for non-grab situations.
    this.#cooldown -= dt;
    if (this.#cooldown <= 0 && dist < CONTACT_RANGE + 0.32) {
      if (this.#playerStats.damage(CONTACT_DAMAGE)) {
        this.#events.emit('player/damaged', { from: this.object.position });
        this.#events.emit('audio/sfx', { id: 'hurt' });
        this.#cooldown = CONTACT_COOLDOWN;
      } else {
        this.#cooldown = 0.25;
      }
    }
  }

  /* ------------------------------ gait ------------------------------ */

  #updateGait(dt, speed, pursuing) {
    this.#shamblePhase += dt * 3.4 * (speed / 1.15 + 0.4);
    const swing = Math.sin(this.#shamblePhase);

    if (this.#cfg.crawl) {
      // Drag-crawl: the whole body heaves forward in pulses; arms claw.
      this.object.position.y = Math.max(0, Math.sin(this.#shamblePhase * 0.5)) * 0.03;
      this.joints.armL.rotation.x = -1.8 + Math.sin(this.#shamblePhase) * 0.5;
      this.joints.armR.rotation.x = -1.8 + Math.sin(this.#shamblePhase + Math.PI) * 0.5;
      return;
    }

    this.joints.legL.rotation.x = swing * 0.5;
    this.joints.legR.rotation.x = Math.sin(this.#shamblePhase + 2.6) * 0.42;
    this.object.position.y = Math.abs(swing) * 0.02;

    // Pursuit flail: arms come up and grasp, over-reaching out of sync.
    const reachL = pursuing ? -1.15 + Math.sin(this.#shamblePhase * 1.7) * 0.25 : -0.5;
    const reachR = pursuing ? -1.05 + Math.sin(this.#shamblePhase * 2.3 + 1.2) * 0.3 : -0.5;
    this.joints.armL.rotation.x += (reachL - this.joints.armL.rotation.x) * Math.min(1, 6 * dt);
    this.joints.armR.rotation.x += (reachR - this.joints.armR.rotation.x) * Math.min(1, 6 * dt);

    // Twitcher spasms: brief violent jolts of the torso and head.
    if (this.#cfg === VARIANTS.twitcher) {
      if (this.#spasmRemaining > 0) {
        this.#spasmRemaining -= dt;
        this.joints.torso.rotation.y = (Math.random() - 0.5) * 0.7;
        this.joints.torso.rotation.z = (Math.random() - 0.5) * 0.35;
        if (this.#spasmRemaining <= 0) {
          this.joints.torso.rotation.set(this.#baseTorsoX, 0, 0);
        }
      } else {
        this.#spasmTimer -= dt;
        if (this.#spasmTimer <= 0) {
          this.#spasmTimer = 0.9 + Math.random() * 2.2;
          this.#spasmRemaining = 0.16;
        }
      }
    }
  }

  /* ---------------------------- the grab ---------------------------- */

  #updateLunge(dt) {
    this.#lungeTimer -= dt;
    this.#physics.moveCircle(
      this.object.position,
      this.#lungeDir.x * LUNGE_SPEED * dt,
      this.#lungeDir.z * LUNGE_SPEED * dt,
      this.radius
    );
    this.object.rotation.y = Math.atan2(this.#lungeDir.x, this.#lungeDir.z);
    // Arms shoot forward for the grab.
    this.joints.armL.rotation.x += (-1.5 - this.joints.armL.rotation.x) * Math.min(1, 14 * dt);
    this.joints.armR.rotation.x += (-1.5 - this.joints.armR.rotation.x) * Math.min(1, 14 * dt);

    if (this.object.position.distanceTo(this.#playerObject.position) < GRAB_CONNECT + 0.32) {
      this.#startHold();
      return;
    }
    if (this.#lungeTimer <= 0) {
      this.#mode = 'normal';
      this.#grabCooldown = 2.0; // whiffed — regroup
    }
  }

  #startHold() {
    this.#mode = 'hold';
    this.#holdTimer = HOLD_MAX;
    this.#tickTimer = 0.35; // first bite comes quick
    this.#struggle = 0;
    this.#events.emit('grab/started', { from: this.object.position.clone() });
    this.#events.emit('audio/sfx', { id: 'huskGroan' });
    this.#unsubStruggle = this.#events.on('grab/struggle', () => {
      this.#struggle += STRUGGLE_PER_PRESS;
    });
  }

  #updateHold(dt) {
    this.#holdTimer -= dt;
    this.#struggle = Math.max(0, this.#struggle - STRUGGLE_DECAY * dt);

    // Arms clamp; body leans into the prey.
    this.joints.armL.rotation.x = -1.5;
    this.joints.armR.rotation.x = -1.5;

    this.#tickTimer -= dt;
    if (this.#tickTimer <= 0) {
      this.#tickTimer = HOLD_TICK;
      this.#playerStats.damage(HOLD_TICK_DAMAGE, { ignoreIframes: true });
      this.#events.emit('camera/impulse', { strength: 0.2 });
      this.#events.emit('blood/splat', {
        position: this.#playerObject.position.clone(),
        size: 0.26,
      });
      this.#events.emit('audio/sfx', { id: 'hurt' });
    }

    if (this.#struggle >= 1) {
      this.#releaseGrab(true);
    } else if (this.#holdTimer <= 0 || this.#playerStats.health <= 0) {
      this.#releaseGrab(false);
    }
  }

  #releaseGrab(escaped) {
    if (this.#mode !== 'hold') return;
    this.#mode = 'normal';
    this.#grabCooldown = GRAB_COOLDOWN;
    this.#unsubStruggle?.();
    this.#unsubStruggle = null;
    this.#events.emit('grab/ended', { from: this.object.position.clone(), escaped });
    if (escaped) {
      // Thrown off: stumble back.
      this.#staggerShove
        .subVectors(this.object.position, this.#playerObject.position)
        .setY(0)
        .normalize()
        .multiplyScalar(2.2);
      this.#anim.play(HUSK_CLIPS.stagger);
    }
  }

  #wake() {
    if (this.#mode !== 'dormant') return;
    this.#mode = 'normal';
    this.#behavior.state = 'pursue';
    this.#events.emit('audio/sfx', { id: 'huskGroan' });
  }

  /* --------------------------- knockdown ---------------------------- */

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
    return { position: [x, y, z], hp: this.health.hp, awake: this.#mode !== 'dormant' };
  }

  restoreState(state) {
    if (state?.position) this.object.position.set(...state.position);
    if (typeof state?.hp === 'number') this.health.hp = state.hp;
    if (state?.awake && this.#mode === 'dormant') this.#mode = 'normal';
  }
}
