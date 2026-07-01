import * as THREE from 'three';

/**
 * PlayerRig — the visible character: a low-poly, SH2-proportioned figure
 * built from primitives, with a procedural walk cycle.
 *
 * TODO(art): replace with a skinned, hand-textured GLTF (300–800 tris,
 * 64–128px texture) loaded through an AssetService. The rig's public API
 * (object, setMoving, update) is the contract a real model must honor —
 * nothing outside this file changes when the art improves.
 */
export class PlayerRig {
  /** @type {THREE.Group} */
  object = new THREE.Group();

  #limbs = {};
  #walkPhase = 0;
  #moveBlend = 0;
  #runFactor = 1;

  /** @param {import('../../rendering/materials/Ps2MaterialSystem.js').Ps2MaterialSystem} ps2 */
  constructor(ps2) {
    const coat = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x3a4436, roughness: 0.9 }));
    const skin = ps2.patch(new THREE.MeshStandardMaterial({ color: 0xc9a68a, roughness: 0.8 }));
    const trousers = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.95 }));

    // Deliberately era-correct proportions: slightly long torso, small head.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.24), coat);
    torso.position.y = 1.06;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.21), skin);
    head.position.y = 1.5;

    const mkLimb = (w, h, material, x, y) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), material);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      pivot.position.set(x, y, 0);
      this.object.add(pivot);
      return pivot;
    };

    this.#limbs.armL = mkLimb(0.11, 0.52, coat, -0.28, 1.3);
    this.#limbs.armR = mkLimb(0.11, 0.52, coat, 0.28, 1.3);
    this.#limbs.legL = mkLimb(0.14, 0.78, trousers, -0.12, 0.78);
    this.#limbs.legR = mkLimb(0.14, 0.78, trousers, 0.12, 0.78);

    this.object.add(torso, head);
    this.object.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });
  }

  /** @param {boolean} moving @param {boolean} running */
  setMoving(moving, running = false) {
    this.#moveBlend = moving ? 1 : this.#moveBlend * 0.8;
    this.#runFactor = running ? 1.7 : 1;
  }

  update(dt) {
    this.#walkPhase += dt * 6.2 * this.#runFactor * (this.#moveBlend > 0.05 ? 1 : 0);
    const swing = Math.sin(this.#walkPhase) * 0.65 * this.#moveBlend;
    this.#limbs.legL.rotation.x = swing;
    this.#limbs.legR.rotation.x = -swing;
    this.#limbs.armL.rotation.x = -swing * 0.7;
    this.#limbs.armR.rotation.x = swing * 0.7;
    // Subtle body bob sells the cycle.
    this.object.position.y = Math.abs(Math.sin(this.#walkPhase)) * 0.03 * this.#moveBlend;
  }
}
