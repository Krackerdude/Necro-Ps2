import * as THREE from 'three';

/**
 * Townsfolk — a living neighbor. Same skeleton family as the player and the
 * husks (that's the point: when night comes, these silhouettes are the ones
 * that come for you), but individually dressed: hair styles, dresses, robes,
 * aprons, hats, beards, and build variation, all from the def.
 *
 * Def options (all optional):
 *   palette: { coat, skin, legs, hair, skirt, apron, vest, hat }
 *   hair:    'short' | 'long' | 'bun' | 'bald' | 'cap' | 'hat'
 *   beard:   true
 *   outfit:  'coat' | 'dress' | 'robe'    (dress/robe hide the legs)
 *   apron:   true                          (over a dress or coat)
 *   vest:    true                          (over a coat)
 *   build:   0.85..1.2                     (torso/limb girth)
 *   scale:   overall size (children, elders)
 *
 * Behavior stays deliberately simple: stand at a post, sway, occasionally
 * look around, and turn to face whoever talks to them.
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
  #pointing = false;
  #baseRotation;

  /**
   * @param {import('../../rendering/materials/Ps2MaterialSystem.js').Ps2MaterialSystem} ps2
   * @param {object} def
   */
  constructor(ps2, def) {
    const palette = def.palette ?? {};
    const build = def.build ?? 1;
    const mat = (color, roughness = 0.9) =>
      ps2.patch(new THREE.MeshStandardMaterial({ color, roughness }));

    const coat = mat(palette.coat ?? 0x5a4a66);
    const skin = mat(palette.skin ?? 0xc9a68a, 0.8);
    const legs = mat(palette.legs ?? 0x3a3a44, 0.95);
    const hairMat = mat(palette.hair ?? 0x3a2e24);

    /* ------------------------------ BODY ------------------------------ */
    const torso = new THREE.Group();
    torso.position.y = 0.82;
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.24), coat);
    torsoMesh.position.y = 0.24;
    torsoMesh.scale.set(build, 1, Math.min(1.15, build));
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
    const armL = mkLimb(0.11 * build, 0.52, coat, torso, -0.28 * build, 0.48);
    const armR = mkLimb(0.11 * build, 0.52, coat, torso, 0.28 * build, 0.48);
    mkLimb(0.14, 0.78, legs, this.object, -0.12, 0.78);
    mkLimb(0.14, 0.78, legs, this.object, 0.12, 0.78);

    /* ------------------------------ HAIR ------------------------------ */
    const hair = def.hair ?? 'short';
    if (hair === 'short' || hair === 'long' || hair === 'bun') {
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.23), hairMat);
      crown.position.set(0, 0.19, -0.01);
      head.add(crown);
    }
    if (hair === 'long') {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.06), hairMat);
      back.position.set(0, 0.02, -0.12);
      head.add(back);
    }
    if (hair === 'bun') {
      const bun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.09), hairMat);
      bun.position.set(0, 0.14, -0.14);
      head.add(bun);
    }
    if (hair === 'cap') {
      const capMat = mat(palette.hat ?? 0x2e3038);
      const dome = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.25), capMat);
      dome.position.set(0, 0.2, -0.01);
      head.add(dome);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.09), capMat);
      brim.position.set(0, 0.17, 0.14);
      head.add(brim);
    }
    if (hair === 'hat') {
      const hatMat = mat(palette.hat ?? 0x241f1a);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 8), hatMat);
      brim.position.set(0, 0.19, 0);
      head.add(brim);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.17), hatMat);
      crown.position.set(0, 0.27, 0);
      head.add(crown);
    }
    if (def.beard) {
      const beard = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.12, 0.05),
        mat(palette.beard ?? palette.hair ?? 0x8a8078)
      );
      beard.position.set(0, -0.05, 0.1);
      head.add(beard);
    }

    /* ----------------------------- OUTFIT ----------------------------- */
    const outfit = def.outfit ?? 'coat';
    if (outfit === 'dress' || outfit === 'robe') {
      const cloth = outfit === 'robe' ? coat : mat(palette.skirt ?? palette.coat ?? 0x6a4a52);
      // Two stacked, widening boxes read as a skirt at 448p.
      const hip = new THREE.Mesh(new THREE.BoxGeometry(0.46 * build, 0.34, 0.3), cloth);
      hip.position.y = -0.16; // hangs from the waist pivot
      torso.add(hip);
      const hem = new THREE.Mesh(new THREE.BoxGeometry(0.54 * build, 0.46, 0.36), cloth);
      hem.position.y = 0.36;
      this.object.add(hem);
      if (outfit === 'robe') {
        // A robe swallows the shoes too.
        const fall = new THREE.Mesh(new THREE.BoxGeometry(0.5 * build, 0.3, 0.33), coat);
        fall.position.y = 0.15;
        this.object.add(fall);
      }
    } else {
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44 * build, 0.06, 0.26), mat(0x241f1a));
      belt.position.y = 0.01;
      torso.add(belt);
    }
    if (def.vest) {
      const vest = new THREE.Mesh(
        new THREE.BoxGeometry(0.36 * build, 0.44, 0.27),
        mat(palette.vest ?? 0x6a3a32)
      );
      vest.position.y = 0.26;
      torso.add(vest);
    }
    if (def.apron) {
      const apron = new THREE.Mesh(
        new THREE.BoxGeometry(0.3 * build, 0.5, 0.03),
        mat(palette.apron ?? 0xd8cfae)
      );
      apron.position.set(0, 0.08, 0.14 * Math.min(1.15, build));
      torso.add(apron);
    }

    this.object.add(torso);
    this.object.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });
    this.object.position.copy(def.position);
    if (def.scale) {
      this.object.scale.setScalar(def.scale); // children, elders
      this.radius *= def.scale;
    }
    this.#baseRotation = def.facing ?? Math.random() * Math.PI * 2;
    this.object.rotation.y = this.#baseRotation;

    this.#joints = { torso, head, armL, armR };
  }

  /** The head group — night beats bolt things onto it. */
  get head() {
    return this.#joints.head;
  }

  /** Raise the right arm toward a world position and face it. */
  pointAt(position) {
    this.faceToward(position);
    this.#pointing = true;
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

    if (this.#pointing) {
      const arm = this.#joints.armR;
      arm.rotation.x += (-1.4 - arm.rotation.x) * Math.min(1, 4 * dt);
    }

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
