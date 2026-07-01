import * as THREE from 'three';

/**
 * ReflectionProbe — a baked-on-demand cubemap capture at a point.
 *
 * DISABLED BY DEFAULT: levels may place probes, but nothing captures until
 * `capture()` is called (typically once after level build, or when lighting
 * changes significantly). Assign `probe.texture` to material.envMap or
 * scene.environment (that makes it an environment probe).
 *
 * Future work can add: box projection, blending between probes, time-sliced
 * re-capture. The capture path is isolated here so none of that touches
 * callers.
 */
export class ReflectionProbe {
  /** @type {THREE.CubeCamera} */
  #cubeCamera;
  /** @type {THREE.WebGLCubeRenderTarget} */
  #renderTarget;

  /**
   * @param {THREE.Vector3} position
   * @param {{ resolution?: number, near?: number, far?: number }} [options]
   */
  constructor(position, { resolution = 128, near = 0.1, far = 60 } = {}) {
    this.#renderTarget = new THREE.WebGLCubeRenderTarget(resolution, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.#cubeCamera = new THREE.CubeCamera(near, far, this.#renderTarget);
    this.#cubeCamera.position.copy(position);
  }

  get texture() {
    return this.#renderTarget.texture;
  }

  /** Render the surrounding scene into the cubemap once. */
  capture(renderer, scene) {
    this.#cubeCamera.update(renderer, scene);
  }

  dispose() {
    this.#renderTarget.dispose();
  }
}
