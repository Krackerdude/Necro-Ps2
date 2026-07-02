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
