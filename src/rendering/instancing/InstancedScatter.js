import * as THREE from 'three';

/**
 * InstancedScatter — GPU instancing helper for repeated static props
 * (candles, gravestones, fence posts, debris).
 *
 * Takes one geometry+material and N transforms, returns a single
 * InstancedMesh (one draw call). Levels use this instead of cloning meshes
 * whenever a prop repeats more than a couple of times.
 *
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {Array<{position: THREE.Vector3, rotationY?: number, scale?: number}>} transforms
 * @param {{ castShadow?: boolean, receiveShadow?: boolean }} [options]
 */
export function createInstancedScatter(geometry, material, transforms, options = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  transforms.forEach(({ position, rotationY = 0, scale = 1 }, i) => {
    quat.setFromAxisAngle(up, rotationY);
    scaleVec.setScalar(scale);
    matrix.compose(position, quat, scaleVec);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? true;
  return mesh;
}
