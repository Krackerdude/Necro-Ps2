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
 * Emits: 'camera/zone-changed' { id } on every cut.
 */
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

  constructor(events, settings) {
    this.#events = events;
    this.#settings = settings;
    this.camera = new THREE.PerspectiveCamera(settings.get('display.fov'), 4 / 3, 0.1, 120);

    events.on('settings/changed', ({ path }) => {
      if (path === 'display.fov') this.#applyFov();
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
    if (this.#mode !== 'zones' || !this.#target) return;

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
  }

  /** Aim at the look target, then apply the zone's dutch-angle roll. */
  #frame() {
    this.camera.lookAt(this.#lookTarget);
    const roll = this.#activeZone?.rollDeg ?? 0;
    if (roll !== 0) this.camera.rotateZ(THREE.MathUtils.degToRad(roll));
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
