import * as THREE from 'three';

/**
 * LOD helper — wraps THREE.LOD with the project's convention.
 *
 * Levels pass detail tiers as [{ object, distance }] sorted or not; distance
 * is where that tier becomes active. three.js handles per-frame selection
 * using the active camera, so this composes cleanly with CameraDirector cuts.
 *
 * With fixed cameras most rooms won't need LOD; it earns its keep for long
 * sightlines (corridors, exteriors). Provided now so adding a tier later is
 * data, not engineering.
 *
 * @param {Array<{ object: THREE.Object3D, distance: number }>} tiers
 */
export function createLod(tiers) {
  const lod = new THREE.LOD();
  for (const { object, distance } of tiers) {
    lod.addLevel(object, distance);
  }
  return lod;
}
