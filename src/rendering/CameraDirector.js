import * as THREE from 'three';

/**
 * CameraDirector — fixed camera angles, survival-horror style.
 *
 * Levels define CameraZones (see world/CameraZone.js): a trigger volume plus
 * an authored camera position/framing. The director watches a target (the
 * player), picks the highest-priority zone containing it, and hard-cuts the
 * camera — the classic RE grammar where every room is a composed shot.
 *
 * Zones may either frame a fixed point ('lookAt') or track the target
 * ('trackTarget: true'), with optional smoothing so tracking shots feel like
 * a camera on a mount, not code.
 *
 * Modes:
 *   'zones'  — gameplay; driven by zones + target.
 *   'manual' — cutscenes / main menu; external code positions the camera.
 *
 * Impulse ("trauma") system: anything may emit 'camera/impulse'
 * { strength } — gunshots, taking a hit, the bell. Trauma accumulates,
 * decays, and drives a rotational shake applied ON TOP of the authored
 * framing (the base orientation is kept, so cameras return to their exact
 * shot). Squared falloff: big impacts rock the frame, small ones whisper.
 *
 * Emits: 'camera/zone-changed' { id } on every cut.
 */
const TRAUMA_DECAY = 1.6; // per second
const SHAKE_PITCH = 0.048;
const SHAKE_YAW = 0.042;
const SHAKE_ROLL = 0.06;

export class CameraDirector {
  /** @type {THREE.PerspectiveCamera} */
  camera;

  #events;
  #settings;
  #zones = [];
  #target = null;
  #activeZone = null;
  #mode = 'manual';
  #lookTarget = new THREE.Vector3();
  #trauma = 0;
  #shakeTime = 0;
  #baseQuat = new THREE.Quaternion();
  #shakeEuler = new THREE.Euler();
  #shakeQuat = new THREE.Quaternion();

  constructor(events, settings) {
    this.#events = events;
    this.#settings = settings;
    this.camera = new THREE.PerspectiveCamera(settings.get('display.fov'), 4 / 3, 0.1, 120);

    events.on('settings/changed', ({ path }) => {
      if (path === 'display.fov') this.#applyFov();
    });
    events.on('camera/impulse', ({ strength = 0.3 }) => {
      this.#trauma = Math.min(1, this.#trauma + strength);
    });
  }

  setMode(mode) {
    this.#mode = mode;
    if (mode !== 'zones') this.#activeZone = null;
  }

  /**
   * @param {import('../world/CameraZone.js').CameraZone[]} zones
   * @param {THREE.Object3D} target
   */
  setZones(zones, target) {
    this.#zones = zones;
    this.#target = target;
    this.#activeZone = null;
    this.#mode = 'zones';
  }

  update(dt) {
    if (this.#mode !== 'zones' || !this.#target) {
      this.#trauma = 0;
      return;
    }

    const zone = this.#pickZone(this.#target.position);
    if (zone && zone !== this.#activeZone) {
      this.#activeZone = zone;
      this.camera.position.copy(zone.cameraPosition);
      this.#lookTarget.copy(zone.trackTarget ? this.#target.position : zone.lookAt);
      this.#frame();
      this.#applyFov();
      this.#events.emit('camera/zone-changed', { id: zone.id });
    }

    if (this.#activeZone?.trackTarget) {
      // Smoothed pan toward the target; position stays fixed (camera on a mount).
      const stiffness = this.#activeZone.trackStiffness ?? 4;
      this.#lookTarget.lerp(this.#target.position, Math.min(1, stiffness * dt));
      this.#frame();
    }

    this.#applyShake(dt);
  }

  /** Aim at the look target, apply the zone's roll, remember the base pose. */
  #frame() {
    this.camera.lookAt(this.#lookTarget);
    const roll = this.#activeZone?.rollDeg ?? 0;
    if (roll !== 0) this.camera.rotateZ(THREE.MathUtils.degToRad(roll));
    this.#baseQuat.copy(this.camera.quaternion);
  }

  #applyShake(dt) {
    if (this.#trauma <= 0) return;
    this.#trauma = Math.max(0, this.#trauma - TRAUMA_DECAY * dt);
    this.#shakeTime += dt;

    const shake = this.#trauma * this.#trauma;
    const t = this.#shakeTime;
    // Incommensurate frequencies read as chaos, not wobble.
    this.#shakeEuler.set(
      Math.sin(t * 31.7) * SHAKE_PITCH * shake,
      Math.sin(t * 27.1 + 1.3) * SHAKE_YAW * shake,
      Math.sin(t * 37.3 + 2.1) * SHAKE_ROLL * shake
    );
    this.#shakeQuat.setFromEuler(this.#shakeEuler);
    this.camera.quaternion.copy(this.#baseQuat).multiply(this.#shakeQuat);
    if (this.#trauma === 0) this.camera.quaternion.copy(this.#baseQuat);
  }

  /** Current shot's forward direction projected to the ground plane — the
   *  player controller uses this for camera-relative input remapping. */
  getGroundedForward(out) {
    this.camera.getWorldDirection(out);
    out.y = 0;
    return out.lengthSq() > 1e-6 ? out.normalize() : out.set(0, 0, -1);
  }

  #pickZone(position) {
    let best = null;
    for (const zone of this.#zones) {
      if (!zone.volume.containsPoint(position)) continue;
      if (!best || (zone.priority ?? 0) > (best.priority ?? 0)) best = zone;
    }
    return best ?? this.#activeZone; // leaving all zones keeps the last shot
  }

  #applyFov() {
    const fov = this.#activeZone?.fovOverride ?? this.#settings.get('display.fov');
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
