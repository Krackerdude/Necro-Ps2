import * as THREE from 'three';
import { PursuitBehavior } from '../../ai/PursuitBehavior.js';

/**
 * Wraith — the crypt's tenant. A shrouded drifting figure that pursues on
 * sight and damages on contact. Body here, brain in ai/PursuitBehavior.
 *
 * Speeds are tuned so a walking player gets caught and a running player
 * escapes — the classic pressure valve.
 */
const SPEED = { haunt: 0.7, pursue: 2.6, return: 1.2 };
const CONTACT_RANGE = 0.65;
const CONTACT_DAMAGE = 18;
const CONTACT_COOLDOWN = 1.2;

export class Wraith {
  /** @type {THREE.Group} */
  object = new THREE.Group();

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

    this.#behavior = new PursuitBehavior({
      home: spawn.position,
      homeRadius: spawn.homeRadius ?? 5,
      detectRadius: 5.5,
      loseRadius: 10,
      hasLineOfSight: (from, to) => !physics.segmentBlockedXZ(from, to),
    });
  }

  update(dt) {
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
        this.#events.emit('audio/sfx', { id: 'hurt' });
        this.#cooldown = CONTACT_COOLDOWN;
      }
    }
  }

  /* Save participant interface (positions restored on load). */
  captureState() {
    const { x, y, z } = this.object.position;
    return { position: [x, y, z], state: this.#behavior.state };
  }

  restoreState(state) {
    if (state?.position) this.object.position.set(...state.position);
  }
}
