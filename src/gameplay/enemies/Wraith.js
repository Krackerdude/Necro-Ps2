import * as THREE from 'three';
import { PursuitBehavior } from '../../ai/PursuitBehavior.js';
import { EnemyHealth } from '../combat/EnemyHealth.js';

/**
 * Wraith — the crypt's tenant. A shrouded drifting figure that pursues on
 * sight and damages on contact. Body here, brain in ai/PursuitBehavior,
 * mortality in combat/EnemyHealth.
 *
 * Speeds are tuned so a walking player gets caught and a running player
 * escapes — the classic pressure valve. It takes most of a revolver's worth
 * of rounds to put one down; running remains the honest option.
 */
const SPEED = { haunt: 0.7, pursue: 2.6, return: 1.2 };
const CONTACT_RANGE = 0.65;
const CONTACT_DAMAGE = 18;
const CONTACT_COOLDOWN = 1.2;
const HP = 150;

export class Wraith {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  radius = 0.3;
  /** @type {EnemyHealth} */
  health;

  #behavior;
  #physics;
  #events;
  #playerObject;
  #playerStats;
  #cooldown = 0;
  #bobPhase = Math.random() * 10;
  #wasPursuing = false;

  constructor({ ps2, physics, events, spawn, playerObject, playerStats }) {
    this.#physics = physics;
    this.#events = events;
    this.#playerObject = playerObject;
    this.#playerStats = playerStats;

    const shroud = ps2.patch(
      new THREE.MeshStandardMaterial({
        color: 0x8a8f96,
        roughness: 1,
        transparent: true,
        opacity: 0.82,
      })
    );
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.9, 6, 1, true), shroud);
    body.position.y = 0.95;
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.19, 0),
      ps2.patch(new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 1 }))
    );
    head.position.y = 1.85;
    this.object.add(body, head);
    this.object.traverse((n) => (n.castShadow = true));
    this.object.position.copy(spawn.position);

    this.health = new EnemyHealth(events, { hp: HP, root: this.object });

    this.#behavior = new PursuitBehavior({
      home: spawn.position,
      homeRadius: spawn.homeRadius ?? 5,
      detectRadius: 5.5,
      loseRadius: 10,
      hasLineOfSight: (from, to) => !physics.segmentBlockedXZ(from, to),
    });
  }

  #flickerRemaining = 0;
  #basePosition = new THREE.Vector3();

  get alive() {
    return this.health.alive;
  }

  takeHit(damage) {
    this.health.takeHit(damage);
    // Wraiths don't stagger — they DISTORT: position jitter + shroud
    // flicker for a beat, and the pursuit loses a step.
    this.#flickerRemaining = 0.28;
    this.#basePosition.copy(this.object.position);
  }

  update(dt) {
    const deathProgress = this.health.update(dt);
    if (!this.health.alive) {
      // The shroud deflates and sinks into the ground.
      this.object.scale.setScalar(1 - deathProgress * 0.4);
      this.object.position.y = 0.08 - deathProgress * 1.2;
      return;
    }

    if (this.#flickerRemaining > 0) {
      this.#flickerRemaining -= dt;
      // Teleport-jitter around the held position; visibility strobes.
      this.object.position.set(
        this.#basePosition.x + (Math.random() - 0.5) * 0.24,
        this.#basePosition.y,
        this.#basePosition.z + (Math.random() - 0.5) * 0.24
      );
      this.object.visible = Math.random() > 0.3;
      if (this.#flickerRemaining <= 0) {
        this.object.position.copy(this.#basePosition);
        this.object.visible = true;
      }
      return;
    }

    const dir = this.#behavior.update(this.object.position, this.#playerObject.position, dt);
    const speed = SPEED[this.#behavior.state] ?? SPEED.haunt;
    this.#physics.moveCircle(this.object.position, dir.x * speed * dt, dir.z * speed * dt, 0.3);

    if (dir.lengthSq() > 0.001) {
      this.object.rotation.y = Math.atan2(dir.x, dir.z);
    }
    // Dead-float bob; it never quite touches the ground.
    this.#bobPhase += dt * 2.1;
    this.object.position.y = 0.08 + Math.sin(this.#bobPhase) * 0.05;

    const pursuing = this.#behavior.state === 'pursue';
    if (pursuing && !this.#wasPursuing) {
      this.#events.emit('audio/sfx', { id: 'wraithShriek' });
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

  /* Save participant interface (positions restored on load). */
  captureState() {
    const { x, y, z } = this.object.position;
    return { position: [x, y, z], hp: this.health.hp };
  }

  restoreState(state) {
    if (state?.position) this.object.position.set(...state.position);
    if (typeof state?.hp === 'number') this.health.hp = state.hp;
  }
}
