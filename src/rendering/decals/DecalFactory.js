import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

/**
 * DecalFactory — projected decals (blood, scorch, grime) onto level meshes.
 *
 * DISABLED BY DEFAULT: nothing spawns decals yet; this is the sanctioned
 * path when gameplay needs them (weapon impacts, scripted set dressing).
 *
 * Future optimization path (no API change required): pool decal meshes and
 * cap live decals per room; merge static set-dressing decals at level build.
 */
export class DecalFactory {
  #ps2Materials;

  /** @param {import('../materials/Ps2MaterialSystem.js').Ps2MaterialSystem} ps2Materials */
  constructor(ps2Materials) {
    this.#ps2Materials = ps2Materials;
  }

  /**
   * @param {THREE.Mesh} targetMesh   mesh to project onto
   * @param {THREE.Vector3} position  world-space hit point
   * @param {THREE.Euler} orientation projector orientation
   * @param {THREE.Vector3} size      projector box size
   * @param {THREE.Material} material decal material (map with transparency)
   */
  create(targetMesh, position, orientation, size, material) {
    const geometry = new DecalGeometry(targetMesh, position, orientation, size);
    const decalMaterial = this.#ps2Materials.patch(material);
    decalMaterial.depthWrite = false;
    decalMaterial.polygonOffset = true;
    decalMaterial.polygonOffsetFactor = -4;
    decalMaterial.transparent = true;
    const mesh = new THREE.Mesh(geometry, decalMaterial);
    mesh.renderOrder = 1;
    return mesh;
  }
}
