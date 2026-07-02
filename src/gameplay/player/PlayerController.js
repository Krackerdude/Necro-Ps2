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
const GRAB_STRUGGLE_ACTIONS = [
  'moveForward',
  'moveBackward',
  'turnLeft',
  'turnRight',
  'interact',
  'attack',
  'run',
];
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

  #shove = new THREE.Vector3();
  #stunRemaining = 0;
  #speedMultiplier = 1;
  #terrainMultiplier = 1;
  #grabbed = false;

  constructor({ events, input, physics, rig }) {
    this.#events = events;
    this.#input = input;
    this.#physics = physics;
    this.#rig = rig;
    this.object.add(rig.object);

    // Getting hit is physical: flinch clip, knockback away from the
    // attacker, and a beat of lost control.
    events.on('player/damaged', ({ from }) => {
      if (from) {
        this.#shove
          .set(this.object.position.x - from.x, 0, this.object.position.z - from.z)
          .normalize()
          .multiplyScalar(3.2);
      }
      // An attack in flight is COMMITTED: taking a hit mid-swing hurts and
      // shoves you but must not cancel the swing (playing the flinch clip
      // would silently replace the attack clip and drop its 'hit' frame).
      if (!this.#rig.isActing) {
        this.#stunRemaining = 0.3;
        this.#rig.play('hurtFlinch');
      }
      events.emit('camera/impulse', { strength: 0.42 });
      events.emit('blood/splat', { position: this.object.position.clone(), size: 0.32 });
    });

    // Grabbed: control is taken away; mashing anything is the way out.
    events.on('grab/started', () => {
      this.#grabbed = true;
      if (!this.#rig.isActing) this.#rig.play('hurtFlinch');
    });
    events.on('grab/ended', ({ from, escaped }) => {
      this.#grabbed = false;
      if (from) {
        this.#shove
          .set(this.object.position.x - from.x, 0, this.object.position.z - from.z)
          .normalize()
          .multiplyScalar(escaped ? 3.6 : 2.4);
      }
      this.#stunRemaining = escaped ? 0.1 : 0.45;
    });
  }

  /** The rig, for systems that drive attack clips (WeaponSystem). */
  get rig() {
    return this.#rig;
  }

  /** Condition-driven pace (limp). GameplayState feeds this from stats. */
  setSpeedMultiplier(multiplier) {
    this.#speedMultiplier = multiplier;
    this.#rig.setLimping(multiplier < 0.7);
  }

  /** Ground-driven pace (wading through the garth costs you). */
  setTerrainMultiplier(multiplier) {
    this.#terrainMultiplier = multiplier;
  }

  /** External impulse (melee lunge, hurt knockback). Decays on its own. */
  applyShove(direction, strength) {
    this.#shove.copy(direction).setY(0).normalize().multiplyScalar(strength);
  }

  #aiming = false;

  spawnAt({ position, rotationY }) {
    this.object.position.copy(position);
    this.#rotationY = rotationY;
    this.object.rotation.y = rotationY;
  }

  /** While aiming the character can pivot but not walk (era-correct). */
  setAiming(aiming) {
    this.#aiming = aiming;
    this.#rig.setAiming(aiming);
  }

  get rotationY() {
    return this.#rotationY;
  }

  /** Unit facing vector on the ground plane. */
  getForward(out) {
    return out.set(Math.sin(this.#rotationY), 0, Math.cos(this.#rotationY));
  }

  update(dt) {
    // Decaying external impulse (knockback / lunge) applies regardless of
    // control state — you can't cancel physics by being stunned.
    if (this.#shove.lengthSq() > 1e-4) {
      this.#physics.moveCircle(
        this.object.position,
        this.#shove.x * dt,
        this.#shove.z * dt,
        RADIUS
      );
      this.#shove.multiplyScalar(Math.max(0, 1 - 9 * dt));
    }

    // Grabbed: movement is gone; every mashed key is a struggle pulse.
    if (this.#grabbed) {
      for (const action of GRAB_STRUGGLE_ACTIONS) {
        if (this.#input.wasPressed(action)) {
          this.#events.emit('grab/struggle', {});
          this.#events.emit('audio/sfx', { id: 'uiMove' });
          break;
        }
      }
      this.#rig.setMoving(false);
      this.#rig.update(dt);
      return;
    }

    // Stunned or mid-attack: the body is committed; input is ignored.
    if (this.#stunRemaining > 0 || this.#rig.isActing) {
      this.#stunRemaining = Math.max(0, this.#stunRemaining - dt);
      this.#rig.setMoving(false);
      this.#rig.update(dt);
      return;
    }

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

    const forward = this.#input.isDown('moveForward') && !this.#aiming;
    const backward = this.#input.isDown('moveBackward') && !this.#aiming;
    const running = this.#input.isDown('run') && forward;
    let speed = 0;
    if (forward) speed = running ? RUN_SPEED : WALK_SPEED;
    else if (backward) speed = -BACK_SPEED;
    speed *= this.#speedMultiplier * this.#terrainMultiplier;

    if (speed !== 0) {
      const dx = Math.sin(this.#rotationY) * speed * dt;
      const dz = Math.cos(this.#rotationY) * speed * dt;
      this.#physics.moveCircle(this.object.position, dx, dz, RADIUS);

      this.#footstepTimer -= dt * (running ? 1.6 : 1);
      if (this.#footstepTimer <= 0) {
        this.#footstepTimer = 0.48;
        // Surface-specific audio is resolved by GameplayState (it knows the
        // world); this event is the step itself.
        this.#events.emit('player/footstep', { running });
        // Feet make noise the dead can hear. Walking is the stealth option.
        this.#events.emit('noise/emitted', {
          position: this.object.position.clone(),
          radius: running ? 7 : 2.5,
        });
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
