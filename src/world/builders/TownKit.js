import * as THREE from 'three';

/**
 * TownKit — the daytime vocabulary of GRAVEN: houses, market stalls, boats,
 * street lamps, trees, fences, the car. Deliberately separate from
 * ArchitectureKit (the gothic-horror vocabulary) so neither bloats the
 * other; it borrows the kit's material cache so textures stay shared.
 *
 * Same conventions as ArchitectureKit pieces: each returns
 * `{ object: THREE.Object3D, colliders: THREE.Box3[] }` with colliders
 * computed at build time — don't reposition pieces after adding them.
 *
 * The palette philosophy: warm plasters, oiled wood, dusk-lit windows.
 * Everything here should look like somewhere you'd want to stay the night.
 * That's the trap.
 */
export class TownKit {
  #kit;
  #windowsLit;
  #lampsLit;

  /**
   * @param {import('./ArchitectureKit.js').ArchitectureKit} kit
   * @param {{ windowsLit?: boolean, lampsLit?: boolean }} [mood] — the night
   *        build passes false/false and the whole vocabulary goes dark.
   */
  constructor(kit, { windowsLit = true, lampsLit = true } = {}) {
    this.#kit = kit;
    this.#windowsLit = windowsLit;
    this.#lampsLit = lampsLit;
  }

  get ps2() {
    return this.#kit.ps2;
  }

  material(name, opts) {
    return this.#kit.material(name, opts);
  }

  /**
   * A whole townhouse: plaster body, pitched plank roof with ridge beam,
   * front door, shuttered windows lit warm from inside (it is dusk, and
   * every home has its lamps on — count the lit windows now; at night the
   * same windows will be dark).
   *
   * The front face is local +z; use rotationY to face the street.
   */
  house({
    position,
    size = [6, 6],
    height = 3,
    rotationY = 0,
    tint = 0xcfc4ae,
    roofTint = 0x7a5240,
    windows = 2,
    door = true,
    lit = this.#windowsLit,
  }) {
    const [w, d] = size;
    const group = new THREE.Group();

    const plaster = this.material('plasterRot', { color: tint });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), plaster);
    body.position.y = height / 2;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    // Pitched roof: a solid plaster attic prism closes the gables and fills
    // the space up to the ridge; two plank panels overhang it as the skin.
    const roofH = w * 0.32;
    const gable = new THREE.Shape();
    gable.moveTo(-w / 2, 0);
    gable.lineTo(w / 2, 0);
    gable.lineTo(0, roofH);
    gable.closePath();
    const attic = new THREE.Mesh(
      new THREE.ExtrudeGeometry(gable, { depth: d - 0.04, bevelEnabled: false }),
      plaster
    );
    attic.position.set(0, height, -(d - 0.04) / 2);
    attic.castShadow = attic.receiveShadow = true;
    group.add(attic);

    const slope = Math.hypot(w / 2, roofH) + 0.5;
    const pitch = Math.atan2(roofH, w / 2);
    const roofMat = this.material('woodPlanks', { color: roofTint, repeat: [3, 1] });
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.14, d + 0.6), roofMat);
      panel.rotation.z = side * pitch;
      // Centered on the slope face, dropped so the eave dips past the wall top.
      panel.position.set((-side * w) / 4, height + roofH / 2 - 0.03, 0);
      panel.castShadow = panel.receiveShadow = true;
      group.add(panel);
    }
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.2, d + 0.7),
      this.material('woodPlanks', { color: 0x4a382a })
    );
    ridge.position.y = height + roofH + 0.06;
    group.add(ridge);

    const woodDark = this.material('woodPlanks', { color: 0x584434 });
    if (door) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.1), woodDark);
      leaf.position.set(0, 1.1, d / 2 + 0.06);
      group.add(leaf);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.16), woodDark);
      lintel.position.set(0, 2.32, d / 2 + 0.07);
      group.add(lintel);
    }

    // Windows: dark glass with a warm lamp glow, wooden shutters thrown open.
    const glass = this.ps2.patch(
      new THREE.MeshStandardMaterial({
        color: 0x241d16,
        roughness: 0.35,
        emissive: lit ? 0xd98d3a : 0x0a0c14,
        emissiveIntensity: lit ? 0.85 : 0.4,
      })
    );
    const spacing = w / (windows + 1);
    for (let i = 0; i < windows; i++) {
      const x = -w / 2 + spacing * (i + 1);
      if (door && Math.abs(x) < 1.1) continue; // don't overlap the door
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.08), glass);
      pane.position.set(x, 1.75, d / 2 + 0.05);
      group.add(pane);
      for (const s of [-1, 1]) {
        const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.95, 0.05), woodDark);
        shutter.position.set(x + s * 0.55, 1.75, d / 2 + 0.06);
        group.add(shutter);
      }
    }

    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(body)] };
  }

  /** Market stall: counter, posts, tilted cloth canopy, goods. */
  stall({ position, rotationY = 0, canopy = 0xa8493c }) {
    const group = new THREE.Group();
    const wood = this.material('woodPlanks');
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.9), wood);
    counter.position.y = 0.45;
    counter.castShadow = true;
    group.add(counter);
    for (const [x, z] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.2, 0.09), wood);
      post.position.set(x, 1.1, z);
      group.add(post);
    }
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.06, 1.6),
      this.ps2.patch(new THREE.MeshStandardMaterial({ color: canopy, roughness: 0.95 }))
    );
    cloth.rotation.x = -0.16;
    cloth.position.set(0, 2.25, 0.1);
    cloth.castShadow = true;
    group.add(cloth);
    // Goods: a couple of anonymous warm bundles on the counter.
    for (const [x, c] of [[-0.6, 0xc9a35a], [0.1, 0xb8865a], [0.7, 0xa8926a]]) {
      const bundle = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.22, 0.32),
        this.ps2.patch(new THREE.MeshStandardMaterial({ color: c, roughness: 1 }))
      );
      bundle.position.set(x, 1.01, (Math.abs(x) * 7) % 0.3 - 0.1);
      bundle.rotation.y = x * 1.7;
      group.add(bundle);
    }
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(counter)] };
  }

  /** Stacked shipping crates. Solid. */
  crates({ position, rotationY = 0, count = 3, seed = 1 }) {
    const group = new THREE.Group();
    const wood = this.material('woodPlanks', { color: 0x8a6a48 });
    let rand = seed;
    const next = () => ((rand = (rand * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const s = 0.5 + next() * 0.22;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), wood);
      const stackedOn = i > 0 && next() > 0.55;
      crate.position.set(
        stackedOn ? group.children[i - 1].position.x : (next() - 0.5) * 1.6,
        stackedOn ? group.children[i - 1].position.y + s : s / 2,
        stackedOn ? group.children[i - 1].position.z : (next() - 0.5) * 1.4
      );
      crate.rotation.y = next() * 0.8;
      crate.castShadow = crate.receiveShadow = true;
      group.add(crate);
    }
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(group)] };
  }

  /** A moored fishing skiff. No collider — it sits out in the water. */
  boat({ position, rotationY = 0, hull = 0x5a6a72 }) {
    const group = new THREE.Group();
    const paint = this.ps2.patch(new THREE.MeshStandardMaterial({ color: hull, roughness: 0.85 }));
    const wood = this.material('woodPlanks', { color: 0x6a5238 });
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 1.2), paint);
    bottom.position.y = 0.15;
    group.add(bottom);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.14), paint);
      side.position.set(0, 0.4, s * 0.6);
      side.rotation.x = s * -0.18;
      group.add(side);
    }
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), paint);
    bow.rotation.y = Math.PI / 4;
    bow.position.set(1.85, 0.35, 0);
    group.add(bow);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 1.1), wood);
    bench.position.set(-0.4, 0.5, 0);
    group.add(bench);
    group.traverse((n) => {
      n.castShadow = true;
    });
    group.position.set(position[0], -0.08, position[1]);
    group.rotation.y = rotationY;
    return { object: group, colliders: [] };
  }

  /**
   * Street lamp. `lit` adds a real point light — budget those (six or so a
   * level); unlit ones still glow via emissive and read fine at 448p.
   */
  streetLamp({ position, lit = false }) {
    lit = lit && this.#lampsLit;
    const group = new THREE.Group();
    const iron = this.material('ironDark');
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 6), iron);
    post.position.y = 1.3;
    post.castShadow = true;
    group.add(post);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), iron);
    cap.position.y = 2.86;
    group.add(cap);
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.3, 0.22),
      this.ps2.patch(
        new THREE.MeshStandardMaterial({
          color: 0x443520,
          emissive: 0xffc27d,
          emissiveIntensity: this.#lampsLit ? 1.4 : 0.04,
        })
      )
    );
    lantern.position.y = 2.68;
    group.add(lantern);
    if (lit) {
      const light = new THREE.PointLight(0xffb865, 7, 8);
      light.position.y = 2.6;
      group.add(light);
    }
    group.position.set(position[0], 0, position[1]);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(post);
    return { object: group, colliders: [box] };
  }

  /** A leaning coastal tree: trunk + wind-blown canopy blobs. */
  tree({ position, scale = 1, lean = 0.12, tint = 0x4d6b3c }) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1 * scale, 0.16 * scale, 1.8 * scale, 5),
      this.material('woodPlanks', { color: 0x5a4632 })
    );
    trunk.position.y = 0.9 * scale;
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = this.ps2.patch(new THREE.MeshStandardMaterial({ color: tint, roughness: 1 }));
    const leavesDark = this.ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x3c5530, roughness: 1 })
    );
    for (const [dx, dy, dz, r, mat] of [
      [lean * 1.6, 1.95, 0, 0.85, leaves],
      [lean * 1.6 - 0.45, 1.7, 0.25, 0.6, leavesDark],
      [lean * 1.6 + 0.4, 1.75, -0.28, 0.55, leavesDark],
    ]) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r * scale, 0), mat);
      blob.position.set(dx * scale, dy * scale, dz * scale);
      blob.castShadow = true;
      group.add(blob);
    }
    group.position.set(position[0], 0, position[1]);
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(trunk)] };
  }

  /** Low post-and-rail fence between two points. Blocks movement. */
  fence({ from, to, height = 0.95 }) {
    const group = new THREE.Group();
    const wood = this.material('woodPlanks', { color: 0x6a5844 });
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const posts = Math.max(2, Math.round(length / 2) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 0.12), wood);
      post.position.set(from[0] + dx * t, height / 2, from[1] + dz * t);
      group.add(post);
    }
    for (const y of [height * 0.55, height * 0.95]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, length), wood);
      rail.position.set(from[0] + dx / 2, y, from[1] + dz / 2);
      rail.rotation.y = angle;
      group.add(rail);
    }
    group.traverse((n) => {
      n.castShadow = true;
    });
    const pad = 0.12;
    const collider = new THREE.Box3(
      new THREE.Vector3(Math.min(from[0], to[0]) - pad, 0, Math.min(from[1], to[1]) - pad),
      new THREE.Vector3(Math.max(from[0], to[0]) + pad, height + 0.4, Math.max(from[1], to[1]) + pad)
    );
    return { object: group, colliders: [collider] };
  }

  /**
   * The car — a boxy pre-owned sedan, the kind a letter makes you gas up.
   * Returns `wheels` so the drive cinematic can spin them.
   */
  car({ position, rotationY = 0, headlights = false, paint = 0x6e3a30 }) {
    const group = new THREE.Group();
    const body = this.ps2.patch(
      new THREE.MeshStandardMaterial({ color: paint, roughness: 0.55, metalness: 0.35 })
    );
    const chrome = this.ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.3, metalness: 0.8 })
    );
    const glass = this.ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x1a222a, roughness: 0.2, metalness: 0.4 })
    );

    const shell = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.6, 1.7), body);
    shell.position.y = 0.62;
    group.add(shell);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.6), body);
    hood.position.set(1.5, 0.95, 0);
    group.add(hood);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 1.5), body);
    cabin.position.set(-0.35, 1.2, 0);
    group.add(cabin);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.35), glass);
    windshield.position.set(0.62, 1.2, 0);
    windshield.rotation.z = -0.35;
    group.add(windshield);
    for (const s of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.06), glass);
      win.position.set(-0.35, 1.22, s * 0.73);
      group.add(win);
    }
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 1.74), chrome);
    bumperF.position.set(1.98, 0.42, 0);
    group.add(bumperF);
    const bumperR = bumperF.clone();
    bumperR.position.x = -1.98;
    group.add(bumperR);

    const lampMat = this.ps2.patch(
      new THREE.MeshStandardMaterial({
        color: 0xd8d0b0,
        emissive: headlights ? 0xffe9b8 : 0x111111,
        emissiveIntensity: headlights ? 2.2 : 0.2,
      })
    );
    for (const s of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.28), lampMat);
      lamp.position.set(2.0, 0.68, s * 0.55);
      group.add(lamp);
    }
    if (headlights) {
      const beam = new THREE.PointLight(0xffe0a0, 10, 12);
      beam.position.set(2.6, 0.7, 0);
      group.add(beam);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 8);
    const wheelMat = this.ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.95 })
    );
    const wheels = [];
    for (const [x, z] of [[1.25, 0.78], [1.25, -0.78], [-1.25, 0.78], [-1.25, -0.78]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.34, z);
      group.add(wheel);
      wheels.push(wheel);
    }

    group.traverse((n) => {
      n.castShadow = true;
    });
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    const collider = new THREE.Box3().setFromObject(shell);
    return { object: group, colliders: [collider], wheels };
  }

  /** The lighthouse: banded tower, gallery, lamp room already burning. */
  lighthouse({ position }) {
    const group = new THREE.Group();
    const white = this.material('plasterRot', { color: 0xe6ddcc });
    const red = this.material('plasterRot', { color: 0x9c3a30 });
    const iron = this.material('ironDark');

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 1.6, 10), white);
    base.position.y = 0.8;
    group.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 2.0, 8.5, 10), white);
    shaft.position.y = 5.8;
    group.add(shaft);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.92, 1.7, 10), red);
    band.position.y = 4.1;
    group.add(band);
    const band2 = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.52, 1.3, 10), red);
    band2.position.y = 8.4;
    group.add(band2);
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.22, 10), iron);
    gallery.position.y = 10.15;
    group.add(gallery);
    const lampRoom = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 1.3, 8),
      this.ps2.patch(
        new THREE.MeshStandardMaterial({
          color: 0x3a3226,
          emissive: 0xffe9b0,
          emissiveIntensity: 1.6,
        })
      )
    );
    lampRoom.position.y = 10.9;
    group.add(lampRoom);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.9, 8), iron);
    roof.position.y = 12.0;
    group.add(roof);
    const lamp = new THREE.PointLight(0xffe0a0, 16, 22);
    lamp.position.y = 10.9;
    group.add(lamp);

    group.traverse((n) => {
      n.castShadow = true;
    });
    group.position.set(position[0], 0, position[1]);
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(base)] };
  }

  /**
   * The church of Graven — proper gothic, nothing house-shaped about it:
   * buttressed stone walls, a steep slate roof, stained lancets down both
   * flanks, a rose window in the front gable over a pointed-arch door, and
   * an attached bell tower with a needle spire.
   *
   * Front is local +z. By day the glass glows warm amber/red/blue; at night
   * (mood `windowsLit: false`) every pane burns the same low wrong red.
   */
  church({ position, rotationY = 0, width = 9.5, depth = 14, height = 6.5 }) {
    const group = new THREE.Group();
    const stone = this.material('stoneWall', { repeat: [4, 3] });
    const slate = this.material('woodPlanks', { color: 0x38343c, repeat: [4, 1] });
    const darkWood = this.material('woodPlanks', { color: 0x3a2c20 });

    const w = width;
    const d = depth;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), stone);
    body.position.y = height / 2;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    // Steep gothic pitch — reads cathedral, not cottage.
    const roofH = w * 0.62;
    const gable = new THREE.Shape();
    gable.moveTo(-w / 2, 0);
    gable.lineTo(w / 2, 0);
    gable.lineTo(0, roofH);
    gable.closePath();
    const attic = new THREE.Mesh(
      new THREE.ExtrudeGeometry(gable, { depth: d - 0.04, bevelEnabled: false }),
      stone
    );
    attic.position.set(0, height, -(d - 0.04) / 2);
    attic.castShadow = attic.receiveShadow = true;
    group.add(attic);
    const slope = Math.hypot(w / 2, roofH) + 0.55;
    const pitch = Math.atan2(roofH, w / 2);
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.16, d + 0.7), slate);
      panel.rotation.z = side * pitch;
      panel.position.set((-side * w) / 4, height + roofH / 2 - 0.03, 0);
      panel.castShadow = panel.receiveShadow = true;
      group.add(panel);
    }
    const ridgeCross = new THREE.Group();
    const crossMat = this.material('ironDark');
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), crossMat);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.1), crossMat);
    crossH.position.y = 0.22;
    ridgeCross.add(crossV, crossH);
    ridgeCross.position.set(0, height + roofH + 0.55, d / 2 - 0.6);
    group.add(ridgeCross);

    // Buttresses stepping down the flanks.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const z = -d / 2 + (i + 0.5) * (d / 4);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, height * 0.55, 0.7), stone);
        foot.position.set(side * (w / 2 + 0.3), height * 0.275, z);
        foot.castShadow = true;
        group.add(foot);
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.45, height * 0.35, 0.55), stone);
        shoulder.position.set(side * (w / 2 + 0.22), height * 0.72, z);
        shoulder.rotation.z = side * -0.18;
        shoulder.castShadow = true;
        group.add(shoulder);
      }
    }

    // Stained glass: stacked color panes in a pointed frame.
    const lit = this.#windowsLit;
    const paneColors = lit ? [0xd98d3a, 0x9c3a30, 0x3a5a9c] : [0x7a1812, 0x7a1812, 0x7a1812];
    const paneMat = paneColors.map((c) =>
      this.ps2.patch(
        new THREE.MeshStandardMaterial({
          color: 0x1a140e,
          roughness: 0.3,
          emissive: c,
          emissiveIntensity: lit ? 1.0 : 1.3,
        })
      )
    );
    const lancet = (parent, x, y, z, ry = 0, scale = 1) => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.72 * scale, 0.07), paneMat[i]);
        pane.position.y = i * 0.72 * scale;
        g.add(pane);
      }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3 * scale, 0.5 * scale, 4), paneMat[0]);
      tip.rotation.y = Math.PI / 4;
      tip.position.y = 2.36 * scale;
      g.add(tip);
      g.position.set(x, y, z);
      g.rotation.y = ry;
      parent.add(g);
    };
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        lancet(group, side * (w / 2 + 0.05), 2.1, -d / 2 + (i + 1) * (d / 4), side * (Math.PI / 2), 0.9);
      }
    }
    lancet(group, -w / 4, 2.0, d / 2 + 0.06, 0, 0.8);
    lancet(group, w / 4, 2.0, d / 2 + 0.06, 0, 0.8);

    // Rose window in the front gable.
    const rose = new THREE.Mesh(new THREE.CircleGeometry(1.05, 12), paneMat[1]);
    rose.position.set(0, height + roofH * 0.42, d / 2 + 0.03);
    group.add(rose);
    const roseRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.09, 6, 12), stone);
    roseRing.position.copy(rose.position);
    group.add(roseRing);
    for (const r of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.08, 0.05), darkWood);
      mullion.position.copy(rose.position);
      mullion.rotation.z = r;
      group.add(mullion);
    }

    // Pointed-arch doorway: recessed double door under angled lintels.
    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.9, 0.12), darkWood);
    doorLeaf.position.set(0, 1.45, d / 2 + 0.05);
    group.add(doorLeaf);
    for (const sSide of [-1, 1]) {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.26, 0.3), stone);
      arch.position.set(sSide * 0.55, 3.25 + Math.abs(sSide) * 0, d / 2 + 0.08);
      arch.rotation.z = sSide * 0.75;
      group.add(arch);
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.0, 0.3), stone);
      jamb.position.set(sSide * 1.2, 1.5, d / 2 + 0.08);
      group.add(jamb);
    }

    // The bell tower: attached at the front-left corner, spire above the roof.
    const towerW = 2.6;
    const towerH = height + roofH + 3.2;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(towerW, towerH, towerW), stone);
    tower.position.set(-(w / 2 + towerW / 2 - 0.2), towerH / 2, d / 2 - towerW / 2);
    tower.castShadow = tower.receiveShadow = true;
    group.add(tower);
    // Belfry openings near the top.
    const belfryDark = this.ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 1 })
    );
    for (const [ox, oz, ry] of [
      [0, towerW / 2 + 0.02, 0],
      [towerW / 2 + 0.02, 0, Math.PI / 2],
      [-(towerW / 2 + 0.02), 0, Math.PI / 2],
    ]) {
      const opening = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.06), belfryDark);
      opening.position.set(tower.position.x + ox, towerH - 1.6, tower.position.z + oz);
      opening.rotation.y = ry;
      group.add(opening);
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(towerW * 0.72, 3.4, 4), slate);
    spire.rotation.y = Math.PI / 4;
    spire.position.set(tower.position.x, towerH + 1.7, tower.position.z);
    spire.castShadow = true;
    group.add(spire);
    lancet(group, tower.position.x, 1.9, tower.position.z + towerW / 2 + 0.02, 0, 0.65);

    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return {
      object: group,
      colliders: [new THREE.Box3().setFromObject(body), new THREE.Box3().setFromObject(tower)],
    };
  }

  /** Parish notice board: two posts and a shingled little roof. */
  noticeBoard({ position, rotationY = 0 }) {
    const group = new THREE.Group();
    const wood = this.material('woodPlanks', { color: 0x6a5238 });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.0, 0.12), wood);
      post.position.set(s * 0.85, 1.0, 0);
      group.add(post);
    }
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 0.08), wood);
    board.position.y = 1.35;
    group.add(board);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 0.4), wood);
    cap.position.y = 1.98;
    cap.rotation.x = -0.12;
    group.add(cap);
    // Pinned papers.
    const paper = this.ps2.patch(
      new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: 1 })
    );
    for (const [x, y, r] of [[-0.45, 1.42, 0.05], [0.1, 1.3, -0.08], [0.55, 1.45, 0.1]]) {
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.02), paper);
      sheet.position.set(x, y, 0.06);
      sheet.rotation.z = r;
      group.add(sheet);
    }
    group.traverse((n) => {
      n.castShadow = true;
    });
    group.position.set(position[0], 0, position[1]);
    group.rotation.y = rotationY;
    group.updateMatrixWorld(true);
    return { object: group, colliders: [new THREE.Box3().setFromObject(board)] };
  }

  /** Mooring bollard for the piers. */
  bollard({ position }) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 0.7, 6),
      this.material('ironDark')
    );
    post.position.set(position[0], 0.35, position[1]);
    post.castShadow = true;
    post.updateMatrixWorld(true);
    return { object: post, colliders: [new THREE.Box3().setFromObject(post)] };
  }
}
