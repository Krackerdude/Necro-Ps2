import * as THREE from 'three';
import { getTexture } from '../../assets/textures/proceduralTextures.js';

/**
 * DoorTransitionScene — the iconic beat: between levels, a door opens
 * toward the camera out of pure darkness.
 *
 * Self-contained scene + camera + a promise-based play() that swings the
 * leaf; GameplayState points the renderer at it during transitions. The
 * animation drives itself with rAF because the gameplay state machine is
 * intentionally frozen while transitioning.
 */
export class DoorTransitionScene {
  /** @type {THREE.Scene} */
  scene = new THREE.Scene();
  /** @type {THREE.PerspectiveCamera} */
  camera;

  #leafPivot;

  /** @param {import('../../rendering/materials/Ps2MaterialSystem.js').Ps2MaterialSystem} ps2 */
  constructor(ps2) {
    this.scene.background = new THREE.Color(0x000000);

    const woodTexture = getTexture('woodPlanks').clone();
    woodTexture.repeat.set(1.5, 2);
    const wood = ps2.patch(
      new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.9 })
    );
    const iron = ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x3a3a42, metalness: 0.5, roughness: 0.6 })
    );

    // Frame posts + lintel, floating in the void.
    const frame = new THREE.Group();
    for (const x of [-1.05, 1.05]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.0, 0.24), wood);
      post.position.set(x, 1.5, 0);
      frame.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 0.24), wood);
    lintel.position.set(0, 2.95, 0);
    frame.add(lintel);
    this.scene.add(frame);

    // The leaf, hinged at its left edge.
    this.#leafPivot = new THREE.Group();
    this.#leafPivot.position.set(-0.94, 0, 0);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.88, 2.82, 0.1), wood);
    leaf.position.set(0.94, 1.41, 0);
    this.#leafPivot.add(leaf);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 4, 8), iron);
    handle.position.set(1.68, 1.35, 0.09);
    this.#leafPivot.add(handle);
    this.scene.add(this.#leafPivot);

    // A single hard lamp over the shoulder; nothing else exists.
    const lamp = new THREE.PointLight(0xffdcb0, 26, 12, 2);
    lamp.position.set(0.6, 2.2, 2.4);
    this.scene.add(lamp);
    this.scene.add(new THREE.AmbientLight(0x202028, 1.2));

    this.camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 20);
    this.camera.position.set(0.18, 1.35, 2.35);
    this.camera.lookAt(0, 1.35, 0);
  }

  /** Swing the door open toward the viewer. Resolves when fully open. */
  play(durationMs = 1500) {
    this.#leafPivot.rotation.y = 0;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / durationMs);
        // Slow start, committed finish — a heavy door.
        const eased = p * p * (3 - 2 * p);
        this.#leafPivot.rotation.y = eased * 1.9;
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
}
