import * as THREE from 'three';
import { GameState } from './GameState.js';
import { Services } from '../ServiceRegistry.js';

/**
 * CinematicState — plays a scripted sequence over whatever scene is loaded.
 *
 * A script is an array of steps, executed in order:
 *   { camera: { from:[x,y,z], to:[x,y,z], lookAt:[x,y,z], duration } }
 *       — dolly the camera (from omitted = current position, hold at `to`)
 *   { caption: { text, duration } }   — letterboxed caption
 *   { wait: { duration } }
 *   { sfx: { id } }                   — fire and continue immediately
 *   { fade: { opacity, duration } }   — fire and continue immediately
 *   { impulse: { strength } }         — camera shake, continue immediately
 *
 * Interact/pause skips the whole sequence. On finish (or skip): letterbox
 * off, caption cleared, camera director returns to zones (with a refresh so
 * the authored shot re-frames), `onComplete` runs after the state pops.
 *
 * Push it (over gameplay) or replace into it (menu → opening) — both work;
 * `onComplete` decides what happens next.
 */
export class CinematicState extends GameState {
  #script;
  #onComplete;
  #stepIndex = -1;
  #stepTime = 0;
  #current = null;
  #camFrom = new THREE.Vector3();
  #camTo = new THREE.Vector3();
  #camLook = new THREE.Vector3();

  constructor(services, { script, onComplete }) {
    super(services);
    this.#script = script;
    this.#onComplete = onComplete;
  }

  enter() {
    const events = this.services.get(Services.EVENTS);
    this.services.get(Services.CAMERA_DIRECTOR).setMode('manual');
    events.emit('ui/letterbox', { on: true });
    this.#advance();
  }

  exit() {
    const events = this.services.get(Services.EVENTS);
    events.emit('ui/letterbox', { on: false });
    events.emit('ui/caption', { text: null });
    const director = this.services.get(Services.CAMERA_DIRECTOR);
    director.setMode('zones');
    director.refresh();
  }

  update(dt) {
    const input = this.services.get(Services.INPUT);
    if (input.wasPressed('interact') || input.wasPressed('pause')) {
      this.#finish();
      return;
    }

    if (!this.#current) return;
    this.#stepTime += dt;

    if (this.#current.camera) {
      const { duration } = this.#current.camera;
      const t = Math.min(1, this.#stepTime / duration);
      const eased = t * t * (3 - 2 * t);
      const camera = this.services.get(Services.CAMERA_DIRECTOR).camera;
      camera.position.lerpVectors(this.#camFrom, this.#camTo, eased);
      camera.lookAt(this.#camLook);
      if (t >= 1) this.#advance();
      return;
    }

    const duration = this.#current.caption?.duration ?? this.#current.wait?.duration ?? 0;
    if (this.#stepTime >= duration) this.#advance();
  }

  #advance() {
    const events = this.services.get(Services.EVENTS);
    events.emit('ui/caption', { text: null });

    // Consume instantaneous steps until we land on a timed one (or the end).
    for (;;) {
      this.#stepIndex += 1;
      const step = this.#script[this.#stepIndex];
      if (!step) {
        this.#finish();
        return;
      }
      if (step.sfx) {
        events.emit('audio/sfx', { id: step.sfx.id });
        continue;
      }
      if (step.fade) {
        events.emit('ui/fade', step.fade);
        continue;
      }
      if (step.impulse) {
        events.emit('camera/impulse', step.impulse);
        continue;
      }

      this.#current = step;
      this.#stepTime = 0;
      if (step.camera) {
        const camera = this.services.get(Services.CAMERA_DIRECTOR).camera;
        this.#camFrom.copy(step.camera.from ? arr3(step.camera.from) : camera.position);
        this.#camTo.copy(arr3(step.camera.to));
        this.#camLook.copy(arr3(step.camera.lookAt));
        camera.position.copy(this.#camFrom);
        camera.lookAt(this.#camLook);
      }
      if (step.caption) {
        events.emit('ui/caption', { text: step.caption.text });
      }
      return;
    }
  }

  #finish() {
    if (this.#stepIndex >= this.#script.length && !this.#current) return;
    this.#current = null;
    this.#stepIndex = this.#script.length;
    const done = this.#onComplete;
    this.#onComplete = null;
    // onComplete decides the next state (it typically pops or replaces us).
    done?.();
  }
}

const arr3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
