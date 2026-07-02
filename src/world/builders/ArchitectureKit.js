import * as THREE from 'three';
import { getTexture } from '../../assets/textures/proceduralTextures.js';

/**
 * ArchitectureKit — reusable level-building vocabulary.
 *
 * Levels compose rooms out of these pieces instead of hand-rolling meshes.
 * Every builder returns `{ object, colliders }` (colliders may be empty) so
 * level files can do:
 *
 *   const wall = kit.wall({ from: [0,0], to: [10,0] });
 *   root.add(wall.object); colliders.push(...wall.colliders);
 *
 * All materials go through Ps2MaterialSystem so the whole world snaps and
 * warps consistently. Geometries here are deliberately low-poly.
 */
export class ArchitectureKit {
  #ps2;
  #materialCache = new Map();

  /** @param {import('../../rendering/materials/Ps2MaterialSystem.js').Ps2MaterialSystem} ps2Materials */
  constructor(ps2Materials) {
    this.#ps2 = ps2Materials;
  }

  /** The material system, for level content built outside the kit
   *  (weapon pickup models, bespoke meshes). */
  get ps2() {
    return this.#ps2;
  }

  /**
   * Shared, cached PS2-patched material.
   * @param {string} textureName procedural texture id
   * @param {{ repeat?: [number, number], color?: number, roughness?: number,
   *           metalness?: number, emissive?: number, emissiveIntensity?: number }} [opts]
   */
  material(textureName, opts = {}) {
    const key = JSON.stringify([textureName, opts]);
    if (this.#materialCache.has(key)) return this.#materialCache.get(key);

    const texture = getTexture(textureName).clone();
    texture.repeat.set(...(opts.repeat ?? [1, 1]));
    const material = this.#ps2.patch(
      new THREE.MeshStandardMaterial({
        map: texture,
        color: opts.color ?? 0xffffff,
        roughness: opts.roughness ?? 0.95,
        metalness: opts.metalness ?? 0.0,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
      })
    );
    this.#materialCache.set(key, material);
    return material;
  }

  /** Horizontal slab (floor or ceiling). */
  slab({ center, size, y, texture = 'stoneFloor', repeat, flip = false }) {
    const material = this.material(texture, {
      repeat: repeat ?? [size[0] / 2, size[1] / 2],
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
    mesh.rotation.x = flip ? Math.PI / 2 : -Math.PI / 2;
    mesh.position.set(center[0], y, center[1]);
    mesh.receiveShadow = true;
    return { object: mesh, colliders: [] };
  }

  /**
   * Wall segment between two XZ points (axis-aligned or diagonal), with a
   * matching AABB collider.
   */
  wall({ from, to, height = 4, thickness = 0.3, texture = 'stoneWall', repeat, yBase = 0 }) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const material = this.material(texture, { repeat: repeat ?? [length / 2, height / 2] });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), material);
    mesh.position.set((from[0] + to[0]) / 2, yBase + height / 2, (from[1] + to[1]) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.updateMatrixWorld();
    const collider = new THREE.Box3().setFromObject(mesh);
    return { object: mesh, colliders: [collider] };
  }

  pillar({ position, radius = 0.4, height = 4, texture = 'stoneWall' }) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.15, height, 6),
      this.material(texture, { repeat: [2, height / 2] })
    );
    mesh.position.set(position[0], height / 2, position[1]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const collider = new THREE.Box3(
      new THREE.Vector3(position[0] - radius, 0, position[1] - radius),
      new THREE.Vector3(position[0] + radius, height, position[1] + radius)
    );
    return { object: mesh, colliders: [collider] };
  }

  /** Chapel pew: seat + back + two legs, one collider. */
  pew({ position, rotationY = 0, width = 2.2 }) {
    const group = new THREE.Group();
    const wood = this.material('woodPlanks', { repeat: [2, 1] });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.5), wood);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(width, 0.55, 0.07), wood);
    back.position.set(0, 0.75, -0.24);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.5), wood);
    legL.position.set(-width / 2 + 0.1, 0.22, 0);
    const legR = legL.clone();
    legR.position.x = width / 2 - 0.1;
    group.add(seat, back, legL, legR);
    group.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }

  /** Stone altar block with cloth drape. */
  altar({ position }) {
    const group = new THREE.Group();
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 1.0),
      this.material('stoneWall', { repeat: [2, 1] })
    );
    block.position.y = 0.55;
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.06, 1.1),
      this.material('clothShroud')
    );
    cloth.position.y = 1.13;
    group.add(block, cloth);
    group.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });
    group.position.set(position[0], 0, position[1]);
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }

  /** Wooden door leaf; collider present so a closed door blocks movement. */
  door({ position, rotationY = 0, width = 1.4, height = 2.6 }) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.12),
      this.material('woodPlanks', { repeat: [1, 2] })
    );
    mesh.position.set(position[0], height / 2, position[1]);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.updateMatrixWorld();
    return { object: mesh, colliders: [new THREE.Box3().setFromObject(mesh)] };
  }

  /** Low-poly candle geometry+material pair, for use with InstancedScatter. */
  candleTemplate() {
    const geometry = new THREE.CylinderGeometry(0.05, 0.06, 0.35, 5);
    geometry.translate(0, 0.175, 0);
    const material = this.material('boneDust', {
      emissive: 0xff9a3c,
      emissiveIntensity: 0.25,
    });
    return { geometry, material };
  }

  /** Gravestone geometry+material pair, for use with InstancedScatter. */
  gravestoneTemplate() {
    const geometry = new THREE.BoxGeometry(0.7, 1.1, 0.16);
    geometry.translate(0, 0.55, 0);
    const material = this.material('stoneWall', { repeat: [1, 1] });
    return { geometry, material };
  }

  /**
   * Rubble pile — grime/dressing. Random low-poly chunks, no collider by
   * default (dressing shouldn't snag the player unless it's a real blocker).
   */
  rubble({ position, spread = 0.8, count = 6, seed = 1, solid = false }) {
    const group = new THREE.Group();
    const material = this.material('stoneWall');
    let s = seed;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < count; i++) {
      const size = 0.08 + rand() * 0.22;
      const chunk = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), material);
      chunk.position.set((rand() - 0.5) * spread * 2, size * 0.5, (rand() - 0.5) * spread * 2);
      chunk.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      chunk.castShadow = true;
      chunk.receiveShadow = true;
      group.add(chunk);
    }
    group.position.set(position[0], 0, position[1]);
    group.updateMatrixWorld(true);
    const colliders = solid ? [new THREE.Box3().setFromObject(group)] : [];
    return { object: group, colliders };
  }

  /** Still, dark water. No collider — wading is allowed (and unwise). */
  water({ center, size, y = 0.06 }) {
    const material = this.#ps2.patch(
      new THREE.MeshStandardMaterial({
        color: 0x16211f,
        roughness: 0.25,
        metalness: 0.5,
        transparent: true,
        opacity: 0.86,
      })
    );
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center[0], y, center[1]);
    mesh.receiveShadow = true;
    return { object: mesh, colliders: [] };
  }

  /** Iron-barred gate. Collider blocks until the mesh is removed. */
  gate({ position, rotationY = 0, width = 1.8, height = 2.6 }) {
    const group = new THREE.Group();
    const iron = this.material('ironDark', { metalness: 0.6, roughness: 0.6 });
    const bars = Math.floor(width / 0.22);
    for (let i = 0; i < bars; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, height, 5), iron);
      bar.position.set(-width / 2 + (i + 0.5) * (width / bars), height / 2, 0);
      group.add(bar);
    }
    for (const y of [0.25, height - 0.25]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.09), iron);
      rail.position.y = y;
      group.add(rail);
    }
    group.traverse((n) => (n.castShadow = true));
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }

  /** A great bronze bell on a frame. The bell itself hangs from a swing
   *  pivot at the beam (`group.userData.swing`) so a toll can rock it. */
  bell({ position }) {
    const group = new THREE.Group();
    const bronze = this.material('ironDark', {
      color: 0x6a5a38,
      metalness: 0.7,
      roughness: 0.45,
    });
    const swing = new THREE.Group();
    swing.position.y = 3.05;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 1.3, 8), bronze);
    body.position.y = -1.05;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 6), bronze);
    crown.position.y = -0.25;
    swing.add(body, crown);
    group.userData.swing = swing;
    const frame = this.material('woodPlanks');
    for (const x of [-1.2, 1.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.2, 0.22), frame);
      post.position.set(x, 1.6, 0);
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.22), frame);
    beam.position.y = 3.1;
    group.add(swing, beam);
    group.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });
    group.position.set(position[0], 0, position[1]);
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }

  /** A body where it fell. Dressing with weight; no collider. */
  corpse({ position, rotationY = 0 }) {
    const group = new THREE.Group();
    const rags = this.material('clothShroud', { color: 0x5a5248 });
    const skin = this.material('boneDust', { color: 0x9a8f78 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.7), rags);
    torso.position.y = 0.1;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.22), skin);
    head.position.set(0.05, 0.08, 0.5);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.5), skin);
    arm.position.set(0.32, 0.05, 0.15);
    arm.rotation.y = -0.6;
    group.add(torso, head, arm);
    group.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    return { object: group, colliders: [] };
  }

  /**
   * Descending stair mouth: steps dropping into a black well. The darkness
   * is a cap plane — the actual descent is a level transition.
   */
  stairsDown({ position, rotationY = 0, width = 1.6 }) {
    const group = new THREE.Group();
    const stone = this.material('stoneWall');
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.4), stone);
      step.position.set(0, -0.09 - i * 0.18, 0.2 + i * 0.4);
      group.add(step);
    }
    const dark = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.4, 2.4),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    dark.rotation.x = -Math.PI / 2;
    dark.position.set(0, -0.72, 1.4);
    group.add(dark);
    group.traverse((n) => (n.receiveShadow = true));
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    return { object: group, colliders: [] };
  }

  /* ==================== SET DRESSING (Tier 5) ==================== */

  /** Iron candelabra: pole, drip tray, three lit candles. Pair with a
   *  FlickerLight from the level for the actual glow. */
  candelabra({ position }) {
    const group = new THREE.Group();
    const iron = this.material('ironDark', { metalness: 0.5, roughness: 0.6 });
    const wax = this.material('boneDust', { emissive: 0xff9a3c, emissiveIntensity: 0.3 });
    const base = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 6), iron);
    base.position.y = 0.06;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.35, 5), iron);
    pole.position.y = 0.72;
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.03, 6), iron);
    tray.position.y = 1.4;
    group.add(base, pole, tray);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.14, 5), wax);
      candle.position.set(Math.cos(angle) * 0.09, 1.49, Math.sin(angle) * 0.09);
      group.add(candle);
    }
    group.traverse((n) => (n.castShadow = true));
    group.position.set(position[0], 0, position[1]);
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }

  /** Hanging processional banner (the Hollow sigil). `y` is the rod height;
   *  rotationY faces the cloth out from its wall. */
  banner({ position, rotationY = 0, y = 3.4, width = 0.85, length = 2.2 }) {
    const group = new THREE.Group();
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, width + 0.24, 5),
      this.material('woodPlanks', { color: 0x6a5238 })
    );
    rod.rotation.z = Math.PI / 2;
    const texture = getTexture('bannerCloth').clone();
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      this.#ps2.patch(
        new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
          roughness: 1,
        })
      )
    );
    cloth.position.y = -length / 2;
    cloth.rotation.x = 0.06; // hangs slightly off the wall
    group.add(rod, cloth);
    group.position.set(position[0], y, position[1]);
    group.rotation.y = rotationY;
    return { object: group, colliders: [] };
  }

  /** Wall niche holding a funerary urn: a dark recess faked with a black
   *  backing quad, shelf, and the urn itself. */
  urnNiche({ position, rotationY = 0, y = 1.15 }) {
    const group = new THREE.Group();
    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.75),
      new THREE.MeshBasicMaterial({ color: 0x030303 })
    );
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.05, 0.22),
      this.material('stoneWall')
    );
    shelf.position.set(0, -0.3, 0.1);
    const urnBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.055, 0.24, 6),
      this.material('boneDust', { color: 0xb8ac8e })
    );
    urnBody.position.set(0, -0.15, 0.1);
    const urnLid = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.07, 6),
      this.material('boneDust', { color: 0xa89c7e })
    );
    urnLid.position.set(0, 0.005, 0.1);
    group.add(backing, shelf, urnBody, urnLid);
    group.traverse((n) => (n.castShadow = true));
    group.position.set(position[0], y, position[1]);
    group.rotation.y = rotationY;
    return { object: group, colliders: [] };
  }

  /** Doorway boarded over in a hurry: black void quad + nailed planks. */
  boardedDoorway({ position, rotationY = 0, width = 1.3, height = 2.3 }) {
    const group = new THREE.Group();
    const void_ = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0x020202 })
    );
    void_.position.y = height / 2;
    group.add(void_);
    const wood = this.material('woodPlanks');
    let s = 3;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 4; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.3, 0.16, 0.045),
        wood
      );
      plank.position.set((rand() - 0.5) * 0.12, 0.4 + i * 0.55, 0.05);
      plank.rotation.z = (rand() - 0.5) * 0.3;
      group.add(plank);
    }
    group.traverse((n) => (n.castShadow = true));
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }

  /** Votive cluster: stumpy candles of uneven height on a wax-drip tray. */
  votives({ position, seed = 1 }) {
    const group = new THREE.Group();
    const wax = this.material('boneDust', {
      color: 0xd8ccae,
      emissive: 0xff9a3c,
      emissiveIntensity: 0.25,
    });
    const tray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.22, 0.03, 7),
      this.material('ironDark')
    );
    tray.position.y = 0.015;
    group.add(tray);
    let s = seed;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 5; i++) {
      const h = 0.05 + rand() * 0.13;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, h, 5), wax);
      const angle = rand() * Math.PI * 2;
      const r = rand() * 0.13;
      candle.position.set(Math.cos(angle) * r, 0.03 + h / 2, Math.sin(angle) * r);
      group.add(candle);
    }
    group.position.set(position[0], 0, position[1]);
    return { object: group, colliders: [] };
  }

  /** Toppled robed statue: the pedestal still stands; the saint does not. */
  fallenStatue({ position, rotationY = 0 }) {
    const group = new THREE.Group();
    const stone = this.material('stoneWall', { color: 0xb8b2a4 });
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), stone);
    pedestal.position.y = 0.25;
    group.add(pedestal);
    // The figure, lying where it fell beside the pedestal.
    const figure = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.3, 6), stone);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 6), stone);
    hood.position.y = 0.78;
    const armStub = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), stone);
    armStub.position.set(0.2, 0.2, 0.05);
    armStub.rotation.z = -0.5;
    figure.add(body, hood, armStub);
    figure.rotation.z = Math.PI / 2 - 0.06; // lying down
    figure.position.set(1.0, 0.18, 0.15);
    group.add(figure);
    group.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }

  /** Coffin half-sunk, nose down, where the ground gave way. */
  sunkenCoffin({ position, rotationY = 0 }) {
    const group = new THREE.Group();
    const coffin = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.35, 1.7),
      this.material('woodPlanks', { color: 0x5a4632 })
    );
    coffin.rotation.x = 0.38; // tilted into the water
    coffin.position.y = 0.02;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.05, 0.9),
      this.material('woodPlanks', { color: 0x6a5238 })
    );
    lid.rotation.x = 0.7;
    lid.rotation.y = 0.25;
    lid.position.set(0.15, 0.32, -0.5);
    group.add(coffin, lid);
    group.traverse((n) => (n.castShadow = true));
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }

  /** Bone niche with arms reaching out of the dark. Corridor dressing. */
  reachingNiche({ position, rotationY = 0, y = 1.05 }) {
    const group = new THREE.Group();
    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.6),
      new THREE.MeshBasicMaterial({ color: 0x020202 })
    );
    group.add(backing);
    const skin = this.material('boneDust', { color: 0x9a8f78 });
    for (const [x, ry, len] of [
      [-0.1, 0.35, 0.42],
      [0.12, -0.25, 0.34],
    ]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, len), skin);
      arm.position.set(x, -0.08, len / 2);
      arm.rotation.y = ry;
      arm.rotation.x = -0.15;
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.11), skin);
      hand.position.set(x + Math.sin(ry) * len, -0.14, Math.cos(ry) * len);
      group.add(arm, hand);
    }
    group.traverse((n) => (n.castShadow = true));
    group.position.set(position[0], y, position[1]);
    group.rotation.y = rotationY;
    return { object: group, colliders: [] };
  }

  /** Grime quad flush against a wall. kind: 'damp' | 'soot' | 'scratch'. */
  wallStain({ position, y = 1.6, rotationY = 0, size = 1.2, kind = 'damp' }) {
    const texture = getTexture(
      kind === 'soot' ? 'stainSoot' : kind === 'scratch' ? 'stainScratch' : 'stainDamp'
    );
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );
    mesh.position.set(position[0], y, position[1]);
    mesh.rotation.y = rotationY;
    mesh.renderOrder = 1;
    return { object: mesh, colliders: [] };
  }

  /** Ossuary shrine — the save point. Distinct silhouette, faint glow. */
  shrine({ position, rotationY = 0 }) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.5, 0.8),
      this.material('stoneWall')
    );
    base.position.y = 0.25;
    const skullPile = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 0),
      this.material('boneDust', { emissive: 0x4a5a3a, emissiveIntensity: 0.35 })
    );
    skullPile.position.y = 0.75;
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.07, 5, 8, Math.PI),
      this.material('ironDark')
    );
    arch.position.y = 0.85;
    group.add(base, skullPile, arch);
    group.traverse((n) => {
      n.castShadow = true;
      n.receiveShadow = true;
    });
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }
}
