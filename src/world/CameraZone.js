import * as THREE from 'three';

/**
 * CameraZone — an authored shot bound to a trigger volume.
 *
 * Pure data; consumed by rendering/CameraDirector. Levels author zones with
 * `defineCameraZone` so typos fail at build time, not silently at runtime.
 */
export class CameraZone {
  /**
   * @param {{
   *   id: string,
   *   min: [number, number, number],
   *   max: [number, number, number],
   *   camera: [number, number, number],
   *   lookAt?: [number, number, number],
   *   trackTarget?: boolean,
   *   trackStiffness?: number,
   *   fovOverride?: number,
   *   rollDeg?: number,
   *   priority?: number,
   * }} def
   */
  constructor(def) {
    if (!def.id) throw new Error('CameraZone requires an id');
    if (!def.lookAt && !def.trackTarget) {
      throw new Error(`CameraZone '${def.id}' needs lookAt or trackTarget`);
    }
    this.id = def.id;
    this.volume = new THREE.Box3(
      new THREE.Vector3(...def.min),
      new THREE.Vector3(...def.max)
    );
    this.cameraPosition = new THREE.Vector3(...def.camera);
    this.lookAt = def.lookAt ? new THREE.Vector3(...def.lookAt) : null;
    this.trackTarget = def.trackTarget ?? false;
    this.trackStiffness = def.trackStiffness;
    this.fovOverride = def.fovOverride;
    /** Dutch-angle roll in degrees (applied after framing). */
    this.rollDeg = def.rollDeg ?? 0;
    this.priority = def.priority ?? 0;
  }
}

export const defineCameraZone = (def) => new CameraZone(def);
