import * as THREE from 'three';
import { AnimationPlayer } from '../../animation/AnimationPlayer.js';
import { PLAYER_CLIPS } from '../animation/playerClips.js';

/**
 * PlayerRig — the visible character: a low-poly, SH2-proportioned figure
 * built from primitives.
 *
 * Skeleton (pivot groups — clips drive these by name):
 *   root
 *   ├─ legL / legR         (hip pivots, planted on the root)
 *   └─ torso  (waist pivot — leaning/coiling carries everything above)
 *      ├─ head (neck pivot)
 *      └─ armL / armR (shoulder pivots)
 *
 * Two animation layers:
 *   1. Procedural: walk cycle, idle, smooth aim raise (this file).
 *   2. Clips: attacks/flinches via AnimationPlayer (playerClips.js).
 *      While a clip plays (`isActing`), the procedural layer yields.
 *
 * TODO(art): replace with a skinned, hand-textured GLTF (300–800 tris).
 * The joints map and clip names are the contract a real model must honor.
 */
export class PlayerRig {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  /** @type {AnimationPlayer} */
  anim;
  /** @type {Record<string, THREE.Object3D>} */
  joints = {};

  #walkPhase = 0;
  #moveBlend = 0;
  #runFactor = 1;
  #aiming = false;
  #limping = false;

  /** @param {import('../../rendering/materials/Ps2MaterialSystem.js').Ps2MaterialSystem} ps2 */
  constructor(ps2) {
    const coat = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x3a4436, roughness: 0.9 }));
    const skin = ps2.patch(new THREE.MeshStandardMaterial({ color: 0xc9a68a, roughness: 0.8 }));
    const trousers = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.95 }));

    // Torso pivot at the waist; mesh hangs above it.
    const torso = new THREE.Group();
    torso.position.y = 0.82;
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.24), coat);
    torsoMesh.position.y = 0.24;
    torso.add(torsoMesh);

    const head = new THREE.Group();
    head.position.y = 0.62;
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.21), skin);
    headMesh.position.y = 0.06;
    head.add(headMesh);
    torso.add(head);

    const mkLimb = (w, h, material, parent, x, y) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), material);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      pivot.position.set(x, y, 0);
      parent.add(pivot);
      return pivot;
    };

    const armL = mkLimb(0.11, 0.52, coat, torso, -0.28, 0.48);
    const armR = mkLimb(0.11, 0.52, coat, torso, 0.28, 0.48);
    const legL = mkLimb(0.14, 0.78, trousers, this.object, -0.12, 0.78);
    const legR = mkLimb(0.14, 0.78, trousers, this.object, 0.12, 0.78);

    this.object.add(torso);
    this.object.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });

    this.joints = { torso, head, armL, armR, legL, legR };
    this.anim = new AnimationPlayer(this.joints);
  }

  /** True while an attack/flinch clip owns the body. */
  get isActing() {
    return this.anim.isActing;
  }

  /** @param {keyof typeof PLAYER_CLIPS} name */
  play(name, opts) {
    this.anim.play(PLAYER_CLIPS[name], opts);
  }

  /** @param {boolean} moving @param {boolean} running */
  setMoving(moving, running = false) {
    this.#moveBlend = moving ? 1 : this.#moveBlend * 0.8;
    this.#runFactor = running ? 1.7 : 1;
  }

  setAiming(aiming) {
    this.#aiming = aiming;
  }

  /** DANGER-condition limp: shortened, uneven stride. */
  setLimping(limping) {
    this.#limping = limping;
  }

  update(dt) {
    this.anim.update(dt);
    if (this.anim.isActing) return; // a clip owns the pose

    const j = this.joints;
    this.#walkPhase += dt * 6.2 * this.#runFactor * (this.#moveBlend > 0.05 ? 1 : 0);
    const swing = Math.sin(this.#walkPhase) * 0.65 * this.#moveBlend;

    // Limp: the left leg barely swings, the right overreaches, the torso
    // dips on the bad step.
    const limpFactor = this.#limping ? 0.35 : 1;
    j.legL.rotation.x = swing * limpFactor;
    j.legR.rotation.x = -swing * (this.#limping ? 1.15 : 1);
    j.torso.rotation.z = this.#limping ? Math.sin(this.#walkPhase) * 0.07 : 0;
    j.torso.rotation.x = this.#limping ? 0.12 : 0;
    j.torso.rotation.y = 0;
    j.head.rotation.set(0, 0, 0);

    j.armL.rotation.x = -swing * 0.7;
    // Smooth aim raise — the weapon comes up in a beat, not a snap.
    const armRTarget = this.#aiming ? -Math.PI / 2 : swing * 0.7;
    j.armR.rotation.x += (armRTarget - j.armR.rotation.x) * Math.min(1, 10 * dt);
    j.armR.rotation.z = 0;

    // Subtle body bob sells the cycle.
    this.object.position.y =
      Math.abs(Math.sin(this.#walkPhase)) * (this.#limping ? 0.045 : 0.03) * this.#moveBlend;
  }
}
