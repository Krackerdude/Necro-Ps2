import * as THREE from 'three';

/**
 * PlayerController — tank controls, the era-correct movement grammar.
 *
 * Left/right rotate the character; forward/back move along facing. This is
 * deliberate: with hard camera cuts, tank controls keep inputs stable across
 * cuts (screen-relative controls would flip mid-stride).
 *
 * Composition: the controller OWNS nothing visual — it drives a rig
 * (PlayerRig) and a transform, consults InputService and PhysicsService, and
 * reports movement via events ('player/footstep').
 */
const WALK_SPEED = 2.1;
const RUN_SPEED = 4.2;
const BACK_SPEED = 1.3;
const TURN_SPEED = Math.PI * 0.85; // rad/s
const RADIUS = 0.32;

export class PlayerController {
  /** World transform root (rig is a child). */
  object = new THREE.Group();

  #events;
  #input;
  #physics;
  #rig;
  #rotationY = 0;
  #quickTurnRemaining = 0;
  #footstepTimer = 0;

  constructor({ events, input, physics, rig }) {
    this.#events = events;
    this.#input = input;
    this.#physics = physics;
    this.#rig = rig;
    this.object.add(rig.object);
  }

  spawnAt({ position, rotationY }) {
    this.object.position.copy(position);
    this.#rotationY = rotationY;
    this.object.rotation.y = rotationY;
  }

  update(dt) {
    // Quick turn (180°) animates over ~0.25s and locks other input.
    if (this.#quickTurnRemaining > 0) {
      const step = Math.min(this.#quickTurnRemaining, Math.PI * 4 * dt);
      this.#rotationY += step;
      this.#quickTurnRemaining -= step;
      this.object.rotation.y = this.#rotationY;
      this.#rig.setMoving(false);
      this.#rig.update(dt);
      return;
    }
    if (this.#input.wasPressed('quickTurn')) {
      this.#quickTurnRemaining = Math.PI;
    }

    const turn =
      (this.#input.isDown('turnLeft') ? 1 : 0) - (this.#input.isDown('turnRight') ? 1 : 0);
    this.#rotationY += turn * TURN_SPEED * dt;

    const forward = this.#input.isDown('moveForward');
    const backward = this.#input.isDown('moveBackward');
    const running = this.#input.isDown('run') && forward;
    let speed = 0;
    if (forward) speed = running ? RUN_SPEED : WALK_SPEED;
    else if (backward) speed = -BACK_SPEED;

    if (speed !== 0) {
      const dx = Math.sin(this.#rotationY) * speed * dt;
      const dz = Math.cos(this.#rotationY) * speed * dt;
      this.#physics.moveCircle(this.object.position, dx, dz, RADIUS);

      this.#footstepTimer -= dt * (running ? 1.6 : 1);
      if (this.#footstepTimer <= 0) {
        this.#footstepTimer = 0.48;
        this.#events.emit('player/footstep', { running });
        this.#events.emit('audio/sfx', { id: 'footstep' });
      }
    }

    this.object.rotation.y = this.#rotationY;
    this.#rig.setMoving(speed > 0.01 || speed < -0.01, running);
    this.#rig.update(dt);
  }

  /* Save participant interface. */
  captureState() {
    const { x, y, z } = this.object.position;
    return { position: [x, y, z], rotationY: this.#rotationY };
  }

  restoreState(state) {
    if (!state) return;
    this.object.position.set(...state.position);
    this.#rotationY = state.rotationY ?? 0;
    this.object.rotation.y = this.#rotationY;
  }
}
