import * as THREE from 'three';

/**
 * Townsfolk — a living neighbor. Same skeleton family as the player and the
 * husks (that's the point: when night comes, these silhouettes are the ones
 * that come for you), palette-varied, breathing, idly shifting weight.
 *
 * Behavior is deliberately simple: stand at a post, sway, occasionally look
 * around, and turn to face whoever talks to them. Wandering NPCs can come
 * later; a town square full of people at rest reads "alive" already.
 */
export class Townsfolk {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  radius = 0.3;

  #joints = {};
  #idlePhase = Math.random() * 10;
  #glanceTimer = 3 + Math.random() * 5;
  #glanceTarget = 0;
  #faceTarget = null;
  #baseRotation;

  /**
   * @param {import('../../rendering/materials/Ps2MaterialSystem.js').Ps2MaterialSystem} ps2
   * @param {{ position: THREE.Vector3, facing?: number,
   *           palette?: { coat?: number, skin?: number, legs?: number } }} def
   */
  constructor(ps2, def) {
    const palette = def.palette ?? {};
    const coat = ps2.patch(
      new THREE.MeshStandardMaterial({ color: palette.coat ?? 0x5a4a66, roughness: 0.9 })
    );
    const skin = ps2.patch(
      new THREE.MeshStandardMaterial({ color: palette.skin ?? 0xc9a68a, roughness: 0.8 })
    );
    const legs = ps2.patch(
      new THREE.MeshStandardMaterial({ color: palette.legs ?? 0x3a3a44, roughness: 0.95 })
    );

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
    mkLimb(0.11, 0.52, coat, torso, -0.28, 0.48);
    mkLimb(0.11, 0.52, coat, torso, 0.28, 0.48);
    mkLimb(0.14, 0.78, legs, this.object, -0.12, 0.78);
    mkLimb(0.14, 0.78, legs, this.object, 0.12, 0.78);

    this.object.add(torso);
    this.object.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });
    this.object.position.copy(def.position);
    this.#baseRotation = def.facing ?? Math.random() * Math.PI * 2;
    this.object.rotation.y = this.#baseRotation;

    this.#joints = { torso, head };
  }

  /** Turn to look at a world position (called when a conversation opens). */
  faceToward(position) {
    this.#faceTarget = Math.atan2(
      position.x - this.object.position.x,
      position.z - this.object.position.z
    );
  }

  /** Return to the resting facing (conversation over). */
  faceRest() {
    this.#faceTarget = this.#baseRotation;
  }

  update(dt) {
    // Breathe + shift weight.
    this.#idlePhase += dt;
    this.#joints.torso.rotation.z = Math.sin(this.#idlePhase * 0.8) * 0.02;
    this.#joints.torso.position.y = 0.82 + Math.sin(this.#idlePhase * 1.7) * 0.008;

    // Occasional idle glance.
    this.#glanceTimer -= dt;
    if (this.#glanceTimer <= 0) {
      this.#glanceTimer = 4 + Math.random() * 6;
      this.#glanceTarget = (Math.random() - 0.5) * 0.9;
    }
    this.#joints.head.rotation.y +=
      (this.#glanceTarget - this.#joints.head.rotation.y) * Math.min(1, 2.5 * dt);

    // Smooth turn toward a conversation partner (or back to rest).
    if (this.#faceTarget !== null) {
      let delta = this.#faceTarget - this.object.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.object.rotation.y += delta * Math.min(1, 5 * dt);
      if (Math.abs(delta) < 0.02) this.#faceTarget = null;
    }
  }
}
