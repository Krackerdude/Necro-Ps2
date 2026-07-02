import * as THREE from 'three';
import { buildItemModel } from '../../assets/models/itemModels.js';

/**
 * ExamineView — the satchel's rotating item viewport: a tiny dedicated
 * renderer (low internal res, pixelated upscale — same language as the main
 * view) spinning the selected item over transparent black.
 *
 * One instance per InventoryScreen; setItem() swaps the model; dispose()
 * releases the GL context when the screen closes.
 */
export class ExamineView {
  /** @type {HTMLCanvasElement} */
  canvas;

  #renderer;
  #scene;
  #camera;
  #model = null;
  #ps2;
  #rafId = 0;
  #disposed = false;

  constructor(ps2) {
    this.#ps2 = ps2;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'examine-canvas';

    this.#renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
    });
    this.#renderer.setSize(150, 110, false); // low-res; CSS stretches it

    this.#scene = new THREE.Scene();
    this.#scene.add(new THREE.AmbientLight(0x8a8a9a, 1.6));
    const key = new THREE.PointLight(0xffe0b0, 30, 10);
    key.position.set(0.6, 0.8, 0.9);
    this.#scene.add(key);
    const rim = new THREE.PointLight(0x9e1616, 12, 10);
    rim.position.set(-0.8, -0.2, -0.6);
    this.#scene.add(rim);

    this.#camera = new THREE.PerspectiveCamera(32, 150 / 110, 0.01, 10);
    this.#camera.position.set(0, 0.12, 0.75);
    this.#camera.lookAt(0, 0, 0);

    const loop = () => {
      if (this.#disposed) return;
      this.#rafId = requestAnimationFrame(loop);
      if (this.#model) {
        this.#model.rotation.y += 0.014;
        this.#renderer.render(this.#scene, this.#camera);
      }
    };
    loop();
  }

  setItem(itemId) {
    if (this.#model) {
      this.#scene.remove(this.#model);
      this.#model = null;
    }
    this.#model = buildItemModel(itemId, this.#ps2);
    // Normalize to a consistent apparent size.
    const box = new THREE.Box3().setFromObject(this.#model);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    const center = box.getCenter(new THREE.Vector3());
    this.#model.position.sub(center);
    // Museum mount: the item lies back in a 3/4 tilt (weapons are modeled
    // along -Y), and the spin happens around the upright axis OUTSIDE the
    // tilt so it turns like a pedestal, not a flipped coin.
    const tilt = new THREE.Group();
    tilt.add(this.#model);
    tilt.rotation.x = -1.15;
    const spin = new THREE.Group();
    spin.add(tilt);
    spin.scale.setScalar(0.36 / size);
    this.#scene.add(spin);
    this.#model = spin;
  }

  dispose() {
    this.#disposed = true;
    cancelAnimationFrame(this.#rafId);
    this.#renderer.dispose();
    this.#renderer.forceContextLoss?.();
  }
}
