import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { FlickerLight } from '../effects/FlickerLight.js';
import { FogCards } from '../effects/FogCards.js';
import { createInstancedScatter } from '../../rendering/instancing/InstancedScatter.js';
import { makeItemPickup, makeTransition, makeNpc, makePickupMesh } from './levelHelpers.js';
import { readDocument } from '../../gameplay/story/documents.js';
import {
  MOULD_SCRIPT,
  GARDENER_SCRIPT,
  WEIGHING_SCRIPT,
} from '../../gameplay/cinematics/scripts.js';

/**
 * THE UNDERCROFT WING (♣) — behind the apse door. The church's root system:
 * cellars, planting rows, and the machinery of the thanksgiving itself.
 *
 * REGIONAL MECHANIC — THE FLOOR. Soft ground (dark turned earth, always
 * visible) belongs to the DIGGERS: they travel beneath it as moving mounds,
 * fast and untouchable, and must SURFACE to hurt you — which they can only
 * avoid doing on soil. Stone paving is yours: they can't swim it, so they
 * climb out and become ordinary meat. Every room here is a negotiation
 * between the path you want and the ground that wants you off it.
 *
 * The Gardener runs the same rule at boss scale: dodge his marked eruption
 * from a stone island and he surfaces confused, with a longer window.
 *
 *   z=-58 ┌WEIGHING──┐ (stone)          17 spaces:
 *   z=-50 └──┬───────┘                  vestibule, root cellar, potting
 *   z=-44 ┌ANTECH┐   ┌WARDEN'S─♣┐       rows, old well, flooded gallery,
 *         └──┬───┘   └GARDEN────┘       Mould's bed, tithe hall, chapel of
 *   z=-36 ┌ORCHARD──┬┘                  roots (save), compost niche, the
 *  ┌WORM──┤PLANTING │┌SEED─┐            long furrow, PLANTING HALL (boss),
 *  │WORKS │HALL BOSS├┤VAULT│            wormworks, seed vault, bone
 *  └──────┤         │└─────┘            orchard, warden's garden (♣),
 *   z=-22 └──┬──────┘                   scale antechamber, WEIGHING ROOM
 *  ┌FURROW┐┌COMPOST┐
 *  └──┬───┘└───────┘  ┌CHAPEL of ROOTS┐
 *  ┌FLOODED┐┌MOULD┐┌TITHE┐──┘
 *  ┌WELL┐───┘─────└───────┘
 *  ┌POTTING┐┌ROOT CELLAR┐
 *  └───────┘└──┬────────┘
 *   z=8..16 ┌VESTIBULE┐ → church apse
 */

const H = 3.6;

// Soft-ground rects [[x0,z0,x1,z1]] — shared with the diggers who own them.
const SOFT = {
  rootcellar: [[-6, -2, -2, 4], [2, 2, 6, 8]],
  furrow: [[-4, -22, 2, -14]],
  orchard: [[-6, -44, -1, -36], [2, -44, 6, -38]],
  boss: [[-9, -36, 7, -22]],
  antechamber: [[-6, -50, -3, -46]],
};
// Stone islands inside the Planting Hall — safe from eruptions.
const ISLANDS = [
  [-7, -28, -4, -25],
  [3, -32, 6, -29],
  [-2, -25, 1, -22],
];

export const UNDERCROFT = {
  id: 'undercroft',
  name: 'The Undercroft',

  build({ kit, story, inventory, events, physics }) {
    const root = new THREE.Group();
    const colliders = [];
    const updatables = [];
    const interactables = [];
    const unsubs = [];

    const add = (piece) => {
      root.add(piece.object);
      colliders.push(...piece.colliders);
      return piece.object;
    };
    const wall = (x0, z0, x1, z1, opts = {}) =>
      add(kit.wall({ from: [x0, z0], to: [x1, z1], height: opts.h ?? H, yBase: opts.yBase ?? 0, texture: opts.tex ?? 'stoneWall' }));
    const lintel = (x0, z0, x1, z1) => wall(x0, z0, x1, z1, { h: H - 2.4, yBase: 2.4, tex: 'plasterRot' });
    const q = (flag) => Boolean(story.get(flag));
    const pickupCtx = { root, story, inventory, events, updatables };

    /* --------------------------- FLOOR & SKY --------------------------- */
    add(kit.slab({ center: [-1, -21], size: [32, 78], y: 0, texture: 'boneDust', repeat: [16, 39] }));
    add(kit.slab({ center: [-1, -21], size: [32, 78], y: H, texture: 'stoneWall', flip: true, repeat: [16, 39] }));
    // Soft ground reads as dark turned earth, slightly proud of the floor.
    const soilMat = kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x3c2c1a, roughness: 1 }));
    for (const rects of Object.values(SOFT)) {
      for (const [x0, z0, x1, z1] of rects) {
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), soilMat);
        patch.rotation.x = -Math.PI / 2;
        patch.position.set((x0 + x1) / 2, 0.015, (z0 + z1) / 2);
        patch.receiveShadow = true;
        root.add(patch);
      }
    }
    // Stone islands in the Planting Hall, visibly paved.
    for (const [x0, z0, x1, z1] of ISLANDS) {
      const isle = kit.slab({ center: [(x0 + x1) / 2, (z0 + z1) / 2], size: [x1 - x0, z1 - z0], y: 0.03, texture: 'stoneFloor', repeat: [2, 2] });
      root.add(isle.object);
    }

    /* ----------------------------- WALLS ------------------------------- */
    // VESTIBULE (x -3..3, z 8..16)
    wall(-3, 16, -0.8, 16); wall(0.8, 16, 3, 16); lintel(-0.8, 16, 0.8, 16);
    wall(-3, 8, -3, 16); wall(3, 8, 3, 16);
    wall(-3, 8, -0.8, 8); wall(0.8, 8, 3, 8); lintel(-0.8, 8, 0.8, 8);
    // ROOT CELLAR (x -6..6, z -4..8)
    wall(-6, 1.6, -6, 8); wall(-6, -4, -6, 0); lintel(-6, 0, -6, 1.6);
    wall(6, -4, 6, 8);
    wall(-6, 8, -3, 8); wall(3, 8, 6, 8);
    wall(-6, -4, -2, -4);
    wall(2.6, -4, 6, -4);
    lintel(-2, -4, 2.6, -4); // one wide arch down into Mould's room
    // POTTING ROWS (x -16..-6, z -4..6)
    wall(-16, 6, -6, 6);
    wall(-16, -4, -13.8, -4); wall(-12.2, -4, -6, -4); lintel(-13.8, -4, -12.2, -4);
    wall(-16, -4, -16, 6);
    // OLD WELL (x -16..-10, z -14..-4)
    wall(-16, -14, -16, -4);
    wall(-16, -14, -10, -14);
    wall(-10, -14, -10, -10); wall(-10, -8.4, -10, -4); lintel(-10, -10, -10, -8.4);
    // FLOODED GALLERY (x -10..-2, z -14..-4)
    wall(-10, -14, -2, -14) /* south shared with furrow below? furrow x -4..2; overlap x -4..-2 handled by gap */;
    // (the furrow entrance cuts the mouldsbed south wall instead)
    wall(-2, -14, -2, -10); wall(-2, -8.4, -2, -4); lintel(-2, -10, -2, -8.4);
    // MOULD'S BED (x -2..6, z -14..-4)
    wall(-2, -14, -0.8, -14); wall(0.8, -14, 6, -14); lintel(-0.8, -14, 0.8, -14);
    wall(6, -14, 6, -10); wall(6, -8.4, 6, -4); lintel(6, -10, 6, -8.4);
    // TITHE HALL (x 6..14, z -14..-4)
    wall(6, -4, 14, -4); wall(14, -14, 14, -4);
    wall(6, -14, 8, -14); wall(9.6, -14, 14, -14); lintel(8, -14, 9.6, -14);
    // CHAPEL OF ROOTS (x 6..12, z -20..-14)
    wall(6, -20, 6, -14);
    wall(6, -20, 12, -20); wall(12, -20, 12, -14);
    // THE LONG FURROW (x -4..2, z -22..-14)
    wall(-4, -22, -4, -14);
    wall(2, -14, 2, -17.4); wall(2, -19, 2, -22); lintel(2, -17.4, 2, -19);
    wall(-4, -22, -1.8, -22); wall(-0.2, -22, 2, -22); lintel(-1.8, -22, -0.2, -22);
    wall(-4, -14, -2, -14);
    // COMPOST NICHE (x 2..6, z -22..-14)
    wall(2, -22, 6, -22); wall(6, -22, 6, -20);
    // PLANTING HALL (x -9..7, z -36..-22)
    wall(-9, -36, -9, -29); wall(-9, -27.4, -9, -22); lintel(-9, -29, -9, -27.4);
    wall(7, -36, 7, -30); wall(7, -28.4, 7, -22); lintel(7, -30, 7, -28.4);
    wall(-9, -22, -4, -22); wall(2, -22, 7, -22);
    wall(-9, -36, -0.8, -36); wall(0.8, -36, 7, -36); lintel(-0.8, -36, 0.8, -36);
    // WORMWORKS (x -16..-9, z -32..-24)
    wall(-16, -32, -9, -32); wall(-16, -24, -9, -24); wall(-16, -32, -16, -24);
    // SEED VAULT (x 7..13, z -32..-26)
    wall(7, -32, 13, -32); wall(7, -26, 13, -26); wall(13, -32, 13, -26);
    // BONE ORCHARD (x -6..6, z -44..-36)
    wall(-6, -44, -6, -36);
    wall(6, -36, 6, -40.4); wall(6, -42, 6, -44); lintel(6, -40.4, 6, -42);
    wall(-6, -36, -0.8, -36) /* shared with hall */;
    wall(-6, -44, -2.8, -44); wall(-1.2, -44, 6, -44); lintel(-2.8, -44, -1.2, -44);
    // WARDEN'S GARDEN (x 6..12, z -44..-38)
    wall(6, -38, 12, -38); wall(6, -44, 12, -44); wall(12, -44, 12, -38);
    // SCALE ANTECHAMBER (x -6..2, z -50..-44)
    wall(-6, -50, -6, -44); wall(2, -50, 2, -44);
    wall(-6, -50, -0.8, -50); wall(0.8, -50, 2, -50); lintel(-0.8, -50, 0.8, -50);
    // THE WEIGHING ROOM (x -6..6, z -58..-50)
    wall(-6, -58, 6, -58); wall(-6, -58, -6, -50); wall(6, -58, 6, -50);
    wall(2, -50, 6, -50);

    /* --------------------------- ROOM DRESSING ------------------------- */
    // Vestibule: root-cracked steps down.
    add(kit.stairsDown({ position: [0, 12], rotationY: Math.PI }));
    add(kit.votives({ position: [-2.4, 9], seed: 6 }));
    // Root cellar: hanging roots, shelves of jarred things.
    const rootMat = kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x6a5a3c, roughness: 1 }));
    for (const [rx, rz, rh] of [[-4, 0, 1.4], [-1, 3, 1.8], [3, 5, 1.2], [5, 0.5, 1.6], [0.5, 6.5, 1.5]]) {
      const tendril = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, rh, 4), rootMat);
      tendril.position.set(rx, H - rh / 2, rz);
      tendril.rotation.z = 0.12;
      root.add(tendril);
    }
    // Potting rows: raised beds.
    for (const [bx, bz] of [[-13.5, 3.5], [-9.5, 3.5], [-13.5, -1], [-9.5, -1]]) {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1.4), kit.material('woodPlanks', { color: 0x4a382a }));
      bed.position.set(bx, 0.25, bz);
      root.add(bed);
      colliders.push(new THREE.Box3().setFromObject(bed));
      const soil = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.2), soilMat);
      soil.position.set(bx, 0.52, bz);
      root.add(soil);
    }
    // Old well: the shaft that predates the church.
    const wellRing = add(kit.pillar({ position: [-13, -9], radius: 1.1, height: 0.9, texture: 'stoneWall' }));
    wellRing.position.y = 0.45;
    const wellDark = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 10),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x020204, roughness: 1 }))
    );
    wellDark.rotation.x = -Math.PI / 2;
    wellDark.position.set(-13, 0.92, -9);
    root.add(wellDark);
    // Flooded gallery: black water, wading slows you.
    root.add(kit.water({ center: [-6, -9], size: [7.6, 9.6], y: 0.05 }).object);
    add(kit.sunkenCoffin({ position: [-7.5, -11.5], rotationY: 0.5 }));
    // Mould's bed: the raised planter he lives in.
    const mouldBed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 2), kit.material('woodPlanks', { color: 0x503c28 }));
    mouldBed.position.set(2.2, 0.4, -9.5);
    root.add(mouldBed);
    colliders.push(new THREE.Box3().setFromObject(mouldBed));
    const mouldSoil = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.8), soilMat);
    mouldSoil.position.set(2.2, 0.84, -9.5);
    root.add(mouldSoil);
    // Tithe hall: offering boxes in rows.
    for (const [tx, tz] of [[8, -6.5], [10.5, -6.5], [13 - 0.5, -6.5], [8, -11], [10.5, -11]]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), kit.material('ironDark'));
      box.position.set(tx, 0.45, tz);
      root.add(box);
      colliders.push(new THREE.Box3().setFromObject(box));
    }
    // Chapel of roots: shrine tangled in tendrils.
    add(kit.shrine({ position: [11.2, -17], rotationY: -Math.PI / 2 }));
    add(kit.votives({ position: [7.5, -19], seed: 12 }));
    interactables.push({
      id: 'roots-shrine',
      position: new THREE.Vector3(11, 1, -17),
      radius: 1.5,
      prompt: 'Pray at the bones (save)',
      onInteract: () => events.emit('ui/open-save-menu'),
    });
    // Compost niche.
    add(kit.corpse({ position: [4, -18], rotationY: 0.8 }));
    add(kit.corpse({ position: [4.8, -20.5], rotationY: 2.2 }));
    add(kit.rubble({ position: [3, -21], seed: 31, count: 6 }));
    // Long furrow: grave mounds in a row.
    for (const fz of [-15.5, -17.5, -19.5, -21]) {
      const mound = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 7), soilMat);
      mound.position.set(-1 + (fz % 2), 0.2, fz);
      root.add(mound);
    }
    // Planting Hall: rows of fresh mounds between the stone islands.
    for (const [mx, mz] of [[-6, -31], [-3, -34], [1, -28], [4, -34], [-6, -23.5], [5, -24], [0, -31.5], [-3, -26.5]]) {
      const mound = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.45, 7), soilMat);
      mound.position.set(mx, 0.22, mz);
      root.add(mound);
    }
    // Wormworks: low tunnels, bone litter.
    add(kit.rubble({ position: [-14.5, -30.5], seed: 44, count: 8, solid: true }));
    add(kit.rubble({ position: [-10.5, -25.5], seed: 45, count: 5 }));
    add(kit.wallStain({ position: [-15.9, -28], y: 1.4, rotationY: Math.PI / 2, size: 1.4, kind: 'damp' }));
    // Seed vault: shelves of labeled jars. The clover key rests here.
    for (const sx of [8.5, 11.5]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.5), kit.material('woodPlanks', { color: 0x4a382a }));
      shelf.position.set(sx, 1.1, -31.4);
      root.add(shelf);
      colliders.push(new THREE.Box3().setFromObject(shelf));
    }
    // Bone orchard: gravestone trees with reaching hands.
    const grave = kit.gravestoneTemplate();
    root.add(
      createInstancedScatter(
        grave.geometry,
        grave.material,
        [
          { position: new THREE.Vector3(-4.5, 0, -38), rotationY: 0.2 },
          { position: new THREE.Vector3(-2.5, 0, -41), rotationY: -0.3, scale: 1.1 },
          { position: new THREE.Vector3(3, 0, -39.5), rotationY: 0.1 },
          { position: new THREE.Vector3(5, 0, -42.5), rotationY: 0.4, scale: 0.9 },
          { position: new THREE.Vector3(-5, 0, -42.5), rotationY: -0.15 },
        ],
        { castShadow: true }
      )
    );
    add(kit.reachingNiche({ position: [-5.85, -40], rotationY: Math.PI / 2 }));
    // Warden's garden: his private plot, suspiciously well tended.
    add(kit.fallenStatue({ position: [9, -42.5], rotationY: 2.6 }));
    add(kit.votives({ position: [11, -39], seed: 9 }));
    // Weighing room: THE SCALE — two pans on a beam over an altar base.
    add(kit.altar({ position: [0, -55.5] }));
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.2), kit.material('ironDark'));
    beam.position.set(0, 2.2, -55.5);
    root.add(beam);
    const panMat = kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x8a7434, metalness: 0.6, roughness: 0.5 }));
    const panL = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.14, 8), panMat);
    panL.position.set(-1.6, 1.5, -55.5);
    root.add(panL);
    const panR = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.14, 8), panMat);
    panR.position.set(1.6, 1.5, -55.5);
    root.add(panR);

    /* ----------------------- THE WEIGHING (finale) --------------------- */
    // Five relics, five weights; the plaques know four of them. The pan
    // wants A FAIR GIFT — twelve stone exactly, per the tithing table.
    const WEIGHTS = [
      { id: 'skull', label: 'the warden’s skull (marked Ⅴ)', weight: 5, x: -4.6, z: -51.5 },
      { id: 'femur', label: 'a blessed femur (marked Ⅲ)', weight: 3, x: -2.4, z: -51 },
      { id: 'nails', label: 'a bundle of coffin nails (marked Ⅱ)', weight: 2, x: 0, z: -51.5 },
      { id: 'teeth', label: 'a purse of teeth (marked Ⅰ)', weight: 1, x: 2.4, z: -51 },
      { id: 'hand', label: 'a bronze ringer’s hand (unmarked)', weight: 7, x: 4.6, z: -51.5 },
    ];
    const onPan = new Set();
    const panTotal = () => [...onPan].reduce((sum, id) => sum + WEIGHTS.find((w) => w.id === id).weight, 0);
    for (const w of WEIGHTS) {
      const relic = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16, 0),
        kit.ps2.patch(new THREE.MeshStandardMaterial({ color: w.id === 'hand' ? 0x8a7434 : 0xc9c2a8, roughness: 0.8 }))
      );
      relic.position.set(w.x, 1.0, w.z);
      root.add(relic);
      const plinth = kit.pillar({ position: [w.x, w.z], radius: 0.16, height: 0.9, texture: 'stoneWall' });
      add(plinth);
      const homePos = new THREE.Vector3(w.x, 1.0, w.z);
      interactables.push({
        id: `weight-${w.id}`,
        position: new THREE.Vector3(w.x, 1, w.z),
        radius: 1.1,
        prompt: () => (onPan.has(w.id) ? `Take back ${w.label}` : `Offer ${w.label}`),
        canInteract: () => !q('groundSolved'),
        onInteract: () => {
          if (onPan.has(w.id)) {
            onPan.delete(w.id);
            relic.position.copy(homePos);
          } else {
            onPan.add(w.id);
            relic.position.set(-1.6 + onPan.size * 0.18 - 0.4, 1.68, -55.3);
          }
          events.emit('audio/sfx', { id: 'uiMove' });
        },
      });
    }
    interactables.push(
      {
        id: 'scale-readout',
        position: new THREE.Vector3(-1.6, 1, -54.4),
        radius: 1.3,
        prompt: () => `The pan reads ${panTotal()} stone`,
        onInteract: () => {
          events.emit('ui/toast', { text: `The pan reads ${panTotal()} stone. The other pan reads nothing you can see.` });
        },
      },
      {
        id: 'scale-commit',
        position: new THREE.Vector3(1.6, 1, -54.4),
        radius: 1.4,
        prompt: 'Let the ground weigh it',
        canInteract: () => !q('groundSolved'),
        onInteract: () => {
          const total = panTotal();
          if (total === 12) {
            story.set('groundSolved', true); // cutscene fires off this flag
          } else {
            events.emit('audio/sfx', { id: 'stingerDetect' });
            story.set('scaleMistake', true); // something rises in the antechamber
            events.emit('ui/toast', {
              text: total > 12
                ? `${total} stone. Too heavy — greed reads as mockery, and the floor behind you takes it personally.`
                : `${total} stone. Too light — the ground is owed a full guest, and the floor behind you takes it personally.`,
            });
          }
        },
      }
    );
    const groundStone = makePickupMesh(kit, {
      position: new THREE.Vector3(0, 1.45, -55.5),
      color: 0x7aa46a,
      emissive: 0x2a4222,
    });
    if (q('groundSolved') && !q('took:weighing-stone')) root.add(groundStone);
    updatables.push({
      update: () => {
        if (!groundStone.parent && story.get('groundSolved') && !story.get('took:weighing-stone')) root.add(groundStone);
        if (groundStone.parent) groundStone.rotation.y += 0.02;
      },
    });
    interactables.push({
      id: 'weighing-stone',
      position: new THREE.Vector3(0, 1, -54.8),
      radius: 1.3,
      prompt: 'Take the Stone of the Ground',
      canInteract: () => q('groundSolved') && !q('took:weighing-stone'),
      onInteract: () => {
        if (inventory && !inventory.canFit('stoneOfTheGround')) {
          events.emit('ui/toast', { text: 'Your satchel is full. The Ground has waited this long.' });
          return;
        }
        inventory?.add('stoneOfTheGround');
        story.set('took:weighing-stone', true);
        groundStone.removeFromParent();
        events.emit('audio/sfx', { id: 'pickup' });
        events.emit('ui/toast', { text: 'Taken — THE STONE OF THE GROUND. It breathes once, slowly, like something turning over in sleep.' });
      },
    });

    /* -------------------- GATED DOORS (boss rewards) ------------------- */
    const seedDoor = kit.door({ position: [7, -29.2], rotationY: -Math.PI / 2, width: 1.6, height: 2.6 });
    const orchardDoor = kit.door({ position: [0, -36], width: 1.6, height: 2.6 });
    if (!q('gardenerFelled')) {
      add(seedDoor);
      add(orchardDoor);
    }
    updatables.push({
      update: () => {
        if (!story.get('gardenerFelled')) return;
        for (const door of [seedDoor, orchardDoor]) {
          if (!door.object.parent) continue;
          door.object.removeFromParent();
          for (const box of door.colliders) {
            const i = colliders.indexOf(box);
            if (i !== -1) colliders.splice(i, 1);
          }
          physics.setStaticColliders(colliders);
          events.emit('audio/sfx', { id: 'doorUnlock' });
        }
      },
    });
    // Warden's garden (♣-locked).
    let gardenDoor = null;
    if (!q('wardensGardenOpen')) {
      gardenDoor = kit.door({ position: [6, -41.2], rotationY: -Math.PI / 2, width: 1.4, height: 2.5 });
      add(gardenDoor);
    }
    interactables.push({
      id: 'garden-door',
      position: new THREE.Vector3(5.6, 1, -41.2),
      radius: 1.5,
      prompt: () =>
        q('wardensGardenOpen') ? 'The warden’s garden' : inventory?.has('cloverKey') ? 'Unlock — the Clover door' : 'A clover is grown into the lock',
      canInteract: () => !q('wardensGardenOpen'),
      onInteract: () => {
        if (!inventory?.has('cloverKey')) {
          events.emit('ui/toast', { text: 'Locked. The keyhole has grown a three-lobed leaf. The seed vault labels everything — even its keys.' });
          return;
        }
        story.set('wardensGardenOpen', true);
        if (gardenDoor) {
          gardenDoor.object.removeFromParent();
          for (const box of gardenDoor.colliders) {
            const i = colliders.indexOf(box);
            if (i !== -1) colliders.splice(i, 1);
          }
          physics.setStaticColliders(colliders);
        }
        events.emit('audio/sfx', { id: 'doorUnlock' });
        events.emit('ui/toast', { text: 'The clover key turns, green flakes falling. The warden kept a garden. Of course he did.' });
      },
    });

    /* --------------------- DEACON MOULD & THE FLASK -------------------- */
    const npcCtx = { root, ps2: kit.ps2, events, updatables, colliders };
    interactables.push(
      makeNpc(npcCtx, {
        id: 'mould',
        name: 'Deacon Mould',
        position: new THREE.Vector3(2.2, 0.55, -9.5), // waist-deep in his bed
        facing: Math.PI,
        outfit: 'robe',
        hair: 'bald',
        beard: true,
        build: 1.02,
        palette: { coat: 0x3c4430, skin: 0xb0a884, beard: 0x8a9a70 },
        lines: () => {
          if (q('mouldQuestDone') && q('groundSolved'))
            return [
              'Twelve stone on the nose — I FELT it balance, friend, right through the bed. The ground purred. Sixty years down here and I never once heard it purr.',
              'Off you go with all three stones. And when the cage opens, tell the church old Mould says: the roots forgive it. Somebody down here ought to.',
            ];
          if (q('mouldQuestDone'))
            return [
              'Ahh, that’s the good black. You can taste the whole town in it. Mostly the harbor.',
              'Now listen, because the scale room lies by omission: the bronze HAND weighs SEVEN. They never mark the hand. A fair gift is TWELVE, no more — the ground counts greed as mockery, and mockery as appetite.',
              'And keep to the paving as you go, friend. The soft rows belong to the planted. It’s only good manners.',
            ];
          if (inventory?.has('mouldsFlaskFull'))
            return [
              'You found it! The good black, from the flooded walk. Pour it here, right at the roots — sixty years is a long time between drinks.',
            ];
          if (inventory?.has('mouldsFlask'))
            return [
              'The flask fills at the flooded gallery, friend — the black water by the old coffin. Mind your ankles and mind the mounds. The planted get thirsty too; that’s the whole trouble with them.',
            ];
          return [
            'A WALKER! Ha! Sixty years I’ve been coming along nicely in this bed and the legs still get jealous when one of you strolls past.',
            'Deacon Mould, at your service — planted by choice, mind. Volunteered! The thanksgiving needed a gardener’s gardener, someone to listen to the rows. I hear EVERYTHING down here. The mounds gossip terribly.',
            'The big fellow with the spade — the GARDENER — he marks his spot before he comes up. A ring in the soil, plain as print. Stand on PAVING when it closes and he’ll surface all confused, poor lamb. Longer window for your arguing-iron.',
            'Do an old stump a kindness? My cup — take it, fill it at the flooded gallery. The good black water. Sixty years dry, friend. SIXTY. Bring it back and I’ll tell you what the scale room never marks.',
          ];
        },
        onComplete: () => {
          if (q('mouldQuestDone')) return;
          if (inventory?.has('mouldsFlaskFull')) {
            inventory.remove('mouldsFlaskFull', 1);
            story.set('mouldQuestDone', true);
            if (inventory.canFit('wardensDraught')) {
              inventory.add('wardensDraught');
              events.emit('audio/sfx', { id: 'saveChime' });
              events.emit('ui/toast', { text: 'Mould drinks, sighs sixty years out, and presses a WARDEN’S DRAUGHT into your hand: “From the warden’s own plot. He owes me.”' });
            } else {
              events.emit('ui/toast', { text: 'Mould drinks, sighs, and frowns at your bulging satchel: “Come back with a free hand, friend — I pay my debts.”' });
              story.set('mouldOwesReward', true);
            }
          } else if (!inventory?.has('mouldsFlask') && !q('mouldQuestDone')) {
            if (inventory?.canFit('mouldsFlask')) {
              inventory.add('mouldsFlask');
              events.emit('audio/sfx', { id: 'pickup' });
              events.emit('ui/toast', { text: 'Received — MOULD’S CUP, a tin flask green with sixty years of patience.' });
            }
          }
        },
      })
    );
    // Owed-reward makeup: if the satchel was full at turn-in.
    updatables.push({
      update: () => {
        if (story.get('mouldOwesReward') && inventory?.canFit('wardensDraught')) {
          story.set('mouldOwesReward', false);
          inventory.add('wardensDraught');
          events.emit('ui/toast', { text: 'Mould flags you down and settles his debt: WARDEN’S DRAUGHT received.' });
        }
      },
    });
    // The filling point, out in the black water.
    interactables.push({
      id: 'flask-fill',
      position: new THREE.Vector3(-7, 1, -11),
      radius: 1.6,
      prompt: () => (inventory?.has('mouldsFlask') ? 'Fill Mould’s cup with the black water' : 'The water is black and patient'),
      onInteract: () => {
        if (!inventory?.has('mouldsFlask')) {
          events.emit('ui/toast', { text: 'The water holds your reflection a half-second longer than you do.' });
          return;
        }
        inventory.remove('mouldsFlask', 1);
        inventory.add('mouldsFlaskFull');
        events.emit('audio/sfx', { id: 'footstepWater' });
        events.emit('ui/toast', { text: 'The flask fills with the good black. It is heavier than water has any right to be.' });
      },
    });

    /* ------------------------------ LOOT -------------------------------- */
    for (const pickup of [
      makeItemPickup(pickupCtx, {
        id: 'potting-moss',
        itemId: 'graveMoss',
        qty: 2,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-9.5, 0.65, 3.5), color: 0x8fae72, emissive: 0x2a3a1a }),
        glowColor: 0xb8e0a0,
        position: new THREE.Vector3(-9.5, 1, 3.5),
        prompt: 'Harvest the potting moss',
        flavor: 'Taken — GRAVE MOSS ×2, the best crop in the row.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'well-linen',
        itemId: 'linenStrips',
        qty: 2,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-15, 0.35, -12.5), color: 0xc9bd9e, emissive: 0x4a4232 }),
        position: new THREE.Vector3(-15, 1, -12.5),
        prompt: 'Take the well rope linens',
        flavor: 'Taken — LINEN STRIPS ×2, from a bucket nobody hauls anymore.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'chapel-tonic',
        itemId: 'graveTonic',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(7.4, 0.35, -15), color: 0x8a4a42, emissive: 0x3a1210 }),
        position: new THREE.Vector3(7.4, 1, -15),
        prompt: 'Take the offering bottle',
        flavor: 'Taken — GRAVE TONIC, left at the roots by someone hedging.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'compost-shells',
        itemId: 'boneShells',
        qty: 6,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(5, 0.35, -16.5), color: 0xc9b37a, emissive: 0x4a3a10 }),
        position: new THREE.Vector3(5, 1, -16.5),
        prompt: 'Search the compost',
        flavor: 'Taken — TALLOW ROUNDS ×6. The compost keeps what the ground doesn’t want.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'vault-clover-key',
        itemId: 'cloverKey',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(10, 1.3, -31.2), color: 0x5aa04a, emissive: 0x1a3a12 }),
        glowColor: 0x8ae07a,
        position: new THREE.Vector3(10, 1, -31),
        prompt: 'Take the jar labeled KEY, CLOVER, ONE',
        flavor: 'Taken — CLOVER KEY, from a jar labeled in the warden’s hand.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'vault-shells',
        itemId: 'boneShells',
        qty: 8,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(8.5, 1.3, -31.2), color: 0xc9b37a, emissive: 0x4a3a10 }),
        position: new THREE.Vector3(8.5, 1, -31),
        prompt: 'Take the jar labeled SEEDS, IRON',
        flavor: 'Taken — TALLOW ROUNDS ×8, filed under seeds. Down here, everything is a seed.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'orchard-moss',
        itemId: 'graveMoss',
        qty: 2,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-4.5, 0.35, -41.5), color: 0x8fae72, emissive: 0x2a3a1a }),
        position: new THREE.Vector3(-4.5, 1, -41.5),
        prompt: 'Gather the orchard moss',
        flavor: 'Taken — GRAVE MOSS ×2, sweet from the bone trees.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'garden-draught',
        itemId: 'wardensDraught',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(10.5, 0.5, -42.5), color: 0x8a2a3a, emissive: 0x4a0a12 }),
        glowColor: 0xff9aa8,
        position: new THREE.Vector3(10.5, 1, -42.5),
        prompt: 'Dig up the buried vial',
        flavor: 'Taken — WARDEN’S DRAUGHT, planted in the warden’s own plot. It grew nothing. It was the crop.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'garden-salve',
        itemId: 'blessedSalve',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(7.5, 0.5, -39.5), color: 0xd8cfae, emissive: 0x554a2a }),
        position: new THREE.Vector3(7.5, 1, -39.5),
        prompt: 'Take the potted salve',
        flavor: 'Taken — BLESSED SALVE, raised from a cutting. Do not ask of what.',
      }),
    ]) {
      if (pickup) interactables.push(pickup);
    }

    /* --------------------------- DOCUMENTS ----------------------------- */
    interactables.push(
      { id: 'doc-almanac', position: new THREE.Vector3(4.5, 1, 6.5), radius: 1.4, prompt: 'Read the cellar almanac', onInteract: () => readDocument(events, story, 'rootAlmanac') },
      { id: 'doc-well', position: new THREE.Vector3(-13, 1, -7.6), radius: 1.4, prompt: 'Read the well rubbing', onInteract: () => readDocument(events, story, 'wellRubbing') },
      { id: 'doc-tithing', position: new THREE.Vector3(12.4, 1, -6.5), radius: 1.5, prompt: 'Read the tithing table', onInteract: () => readDocument(events, story, 'tithingTable') },
      { id: 'doc-sermon', position: new THREE.Vector3(0.6, 1, -11.5), radius: 1.4, prompt: 'Read Mould’s pinned sermon', onInteract: () => readDocument(events, story, 'mouldsSermon') },
      { id: 'doc-calendar', position: new THREE.Vector3(9, 1, -18.5), radius: 1.5, prompt: 'Read the planting calendar', onInteract: () => readDocument(events, story, 'plantingCalendar') },
      { id: 'doc-manifest', position: new THREE.Vector3(11.5, 1, -30.4), radius: 1.4, prompt: 'Read the vault manifest', onInteract: () => readDocument(events, story, 'seedManifest') },
      { id: 'doc-wormworks', position: new THREE.Vector3(-13, 1, -26), radius: 1.5, prompt: 'Read the tunneler’s note', onInteract: () => readDocument(events, story, 'wormworksNote') },
      { id: 'doc-plot', position: new THREE.Vector3(8.5, 1, -43), radius: 1.5, prompt: 'Read the warden’s plot ledger', onInteract: () => readDocument(events, story, 'wardensPlot') }
    );

    /* ---------------------------- LIGHTING ----------------------------- */
    root.add(new THREE.AmbientLight(0x2a3226, 2.2));
    root.add(new THREE.HemisphereLight(0x2e3a2a, 0x14100a, 1.0));
    const shaft = new THREE.DirectionalLight(0x6a8a5a, 0.9);
    shaft.position.set(6, 12, -12);
    shaft.target.position.set(0, 0, -24);
    shaft.castShadow = true;
    shaft.shadow.mapSize.set(1024, 1024);
    shaft.shadow.camera.left = -28;
    shaft.shadow.camera.right = 28;
    shaft.shadow.camera.top = 42;
    shaft.shadow.camera.bottom = -42;
    root.add(shaft, shaft.target);
    const flickers = [
      new FlickerLight({ position: new THREE.Vector3(0, 2.2, 12), intensity: 10, distance: 9, color: 0x9fdc7a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.4, 2), intensity: 10, distance: 10, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(-11, 2.4, 1), intensity: 9, distance: 9, color: 0x9fdc7a }),
      new FlickerLight({ position: new THREE.Vector3(-13, 2.0, -9), intensity: 8, distance: 8, color: 0x63719b }),
      new FlickerLight({ position: new THREE.Vector3(-6, 2.2, -9), intensity: 8, distance: 9, color: 0x3a4a9c }),
      new FlickerLight({ position: new THREE.Vector3(2.2, 2.2, -9.5), intensity: 10, distance: 8, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(10, 2.4, -9), intensity: 9, distance: 9 }),
      new FlickerLight({ position: new THREE.Vector3(9, 2.2, -17), intensity: 10, distance: 8, color: 0x9fdc7a }),
      new FlickerLight({ position: new THREE.Vector3(-1, 2.2, -18), intensity: 8, distance: 8, color: 0x63719b }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.8, -29), intensity: 12, distance: 14, castShadow: true, color: 0xc9803a }),
      new FlickerLight({ position: new THREE.Vector3(-12.5, 2.0, -28), intensity: 8, distance: 8, color: 0x9fdc7a }),
      new FlickerLight({ position: new THREE.Vector3(10, 2.2, -29), intensity: 9, distance: 8, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.4, -40), intensity: 9, distance: 10, color: 0x63719b }),
      new FlickerLight({ position: new THREE.Vector3(9, 2.2, -41), intensity: 9, distance: 8, color: 0x9fdc7a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.6, -54), intensity: 12, distance: 11, color: 0xd9a05a }),
    ];
    for (const f of flickers) {
      root.add(f.light);
      updatables.push(f);
    }
    const fog1 = new FogCards({ center: [-1, -29], size: [16, 14], count: 4, opacity: 0.08, color: 0x4a5a3a });
    const fog2 = new FogCards({ center: [-6, -9], size: [8, 10], count: 3, opacity: 0.1, color: 0x2a3a4a });
    root.add(fog1.object, fog2.object);
    updatables.push(fog1, fog2);

    /* ---------------------------- TRANSITIONS -------------------------- */
    interactables.push(
      makeTransition(
        { story, inventory, events },
        {
          id: 'back-to-church',
          position: new THREE.Vector3(0, 1, 15.4),
          radius: 1.5,
          prompt: 'Climb back to the church',
          targetLevel: 'chapel-of-the-hollow',
          targetSpawn: 'fromUndercroft',
        }
      )
    );

    /* -------------------------- CAMERA ZONES --------------------------- */
    const cameraZones = [
      defineCameraZone({ id: 'vestibule', min: [-3, -1, 8], max: [3, 4, 16], camera: [2.4, 2.6, 9.2], trackTarget: true, trackStiffness: 3.5, rollDeg: -3, fovOverride: 58 }),
      defineCameraZone({ id: 'rootcellar', min: [-6, -1, -4], max: [6, 4, 8], camera: [-5, 3, 6.6], trackTarget: true, trackStiffness: 3, fovOverride: 62 }),
      defineCameraZone({ id: 'potting', min: [-16, -1, -4], max: [-6, 4, 6], camera: [-6.8, 2.8, 5], trackTarget: true, trackStiffness: 3, fovOverride: 58 }),
      defineCameraZone({ id: 'well', min: [-16, -1, -14], max: [-10, 4, -4], camera: [-10.6, 2.4, -4.8], lookAt: [-13.5, 0.8, -9.5], fovOverride: 54 }),
      defineCameraZone({ id: 'flooded', min: [-10, -1, -14], max: [-2, 4, -4], camera: [-2.8, 2.6, -4.6], trackTarget: true, trackStiffness: 2.8, rollDeg: 3, fovOverride: 60 }),
      defineCameraZone({ id: 'mouldsbed', min: [-2, -1, -14], max: [6, 4, -4], camera: [-1.4, 2.2, -4.8], lookAt: [2.4, 1.0, -9.8], fovOverride: 56 }),
      defineCameraZone({ id: 'tithe', min: [6, -1, -14], max: [14, 4, -4], camera: [13.2, 2.8, -4.8], trackTarget: true, trackStiffness: 3.2, fovOverride: 58 }),
      defineCameraZone({ id: 'chapelroots', min: [6, -1, -20], max: [12, 4, -14], camera: [6.6, 2.2, -14.6], lookAt: [10.5, 1, -17.5], fovOverride: 54 }),
      defineCameraZone({ id: 'furrow', min: [-4, -1, -22], max: [2, 4, -14], camera: [-1, 2.6, -14.4], lookAt: [-1, 1, -22], fovOverride: 50 }),
      defineCameraZone({ id: 'compost', min: [2, -1, -22], max: [6, 3, -14], camera: [2.6, 1.9, -14.8], lookAt: [4.6, 0.8, -19.5], fovOverride: 56, priority: 1 }),
      defineCameraZone({ id: 'plantinghall', min: [-9, -1, -36], max: [7, 4, -22], camera: [-8, 3.4, -23], trackTarget: true, trackStiffness: 2.6, fovOverride: 64 }),
      defineCameraZone({ id: 'wormworks', min: [-16, -1, -32], max: [-9, 4, -24], camera: [-9.6, 1.8, -24.6], trackTarget: true, trackStiffness: 3, rollDeg: -4, fovOverride: 62 }),
      defineCameraZone({ id: 'seedvault', min: [7, -1, -32], max: [13, 4, -26], camera: [7.6, 2.3, -26.6], lookAt: [10.5, 1.2, -30.5], fovOverride: 54 }),
      defineCameraZone({ id: 'orchard', min: [-6, -1, -44], max: [6, 4, -36], camera: [5, 3, -36.8], trackTarget: true, trackStiffness: 2.8, rollDeg: 2, fovOverride: 60 }),
      defineCameraZone({ id: 'garden', min: [6, -1, -44], max: [12, 4, -38], camera: [6.6, 2.2, -38.6], lookAt: [9.5, 1, -42], fovOverride: 56 }),
      defineCameraZone({ id: 'antechamber', min: [-6, -1, -50], max: [2, 4, -44], camera: [1.4, 2.5, -44.6], trackTarget: true, trackStiffness: 3, fovOverride: 58 }),
      defineCameraZone({ id: 'weighing', min: [-6, -1, -58], max: [6, 4, -50], camera: [-5, 2.8, -50.8], trackTarget: true, trackStiffness: 2.8, rollDeg: -2, fovOverride: 60 }),
    ];

    return {
      root,
      colliders,
      cameraZones,
      interactables,
      updatables,
      dispose: () => {
        for (const unsub of unsubs) unsub();
      },
      spawn: { position: new THREE.Vector3(0, 0, 14.2), rotationY: Math.PI },
      spawnPoints: {
        fromChurch: { position: new THREE.Vector3(0, 0, 14.2), rotationY: Math.PI },
      },
      enemySpawns: [
        { type: 'digger', position: new THREE.Vector3(-4, 0, 1), soft: SOFT.rootcellar },
        { type: 'husk', variant: 'shambler', position: new THREE.Vector3(10.5, 0, -8.5), homeRadius: 4 },
        { type: 'digger', position: new THREE.Vector3(-2, 0, -17), soft: SOFT.furrow },
        { type: 'digger', position: new THREE.Vector3(0, 0, -20), soft: SOFT.furrow },
        { type: 'gardener', position: new THREE.Vector3(0, 0, -29), soft: SOFT.boss, islands: ISLANDS },
        { type: 'husk', variant: 'crawler', position: new THREE.Vector3(-13, 0, -28), homeRadius: 4 },
        { type: 'husk', variant: 'crawler', position: new THREE.Vector3(-11, 0, -30.5), homeRadius: 4 },
        { type: 'digger', position: new THREE.Vector3(-3.5, 0, -40), soft: SOFT.orchard },
        { type: 'digger', position: new THREE.Vector3(4, 0, -41), soft: SOFT.orchard },
        // The scale's grudge: a digger, if you mock the ground.
        { type: 'digger', position: new THREE.Vector3(-4.5, 0, -48), soft: SOFT.antechamber, onlyIf: 'scaleMistake' },
      ],
      fog: { color: 0x0a0e08, density: 0.052 },
      ambientTrack: 'undercroft',
      surfaces: {
        default: 'stone',
        regions: [
          { min: [-10, -14], max: [-2, -4], type: 'water' }, // the flooded gallery
          { min: [-6, -2], max: [-2, 4], type: 'bone' },
          { min: [-4, -22], max: [2, -14], type: 'bone' },
        ],
      },
      cinematics: [
        { when: 'mapSeen:undercroft:mouldsbed', seen: 'cine:mould', script: MOULD_SCRIPT },
        { when: 'mapSeen:undercroft:plantinghall', seen: 'cine:gardener', script: GARDENER_SCRIPT },
        { when: 'groundSolved', seen: 'cine:weighing', script: WEIGHING_SCRIPT },
      ],
      roomComments: {
        'mapSeen:undercroft:vestibule':
          '…Warm air rising from below, like breath. The church grew a throat and I am walking down it.',
        'mapSeen:undercroft:flooded':
          '…The water is black and body-warm. Something under it is being very, very still on my account.',
        'mapSeen:undercroft:orchard':
          '…Gravestones planted in rows, budding hands. The church isn’t burying its dead down here. It’s FARMING them.',
        'mapSeen:undercroft:wormworks':
          '…The tunnels are rib-shaped. I noticed, and now I cannot un-notice.',
      },
      map: {
        rooms: [
          { id: 'vestibule', label: 'Descent', min: [-3, 8], max: [3, 16] },
          { id: 'rootcellar', label: 'Root Cellar', min: [-6, -4], max: [6, 8] },
          { id: 'potting', label: 'Potting Rows', min: [-16, -4], max: [-6, 6] },
          { id: 'well', label: 'The Old Well', min: [-16, -14], max: [-10, -4] },
          { id: 'flooded', label: 'Flooded Gallery', min: [-10, -14], max: [-2, -4] },
          { id: 'mouldsbed', label: 'Mould’s Bed', min: [-2, -14], max: [6, -4] },
          { id: 'tithe', label: 'Tithe Hall', min: [6, -14], max: [14, -4] },
          { id: 'chapelroots', label: 'Chapel of Roots', min: [6, -20], max: [12, -14] },
          { id: 'furrow', label: 'The Long Furrow', min: [-4, -22], max: [2, -14] },
          { id: 'compost', label: 'Compost Niche', min: [2, -22], max: [6, -14] },
          { id: 'plantinghall', label: 'The Planting Hall', min: [-9, -36], max: [7, -22] },
          { id: 'wormworks', label: 'Wormworks', min: [-16, -32], max: [-9, -24] },
          { id: 'seedvault', label: 'Seed Vault', min: [7, -32], max: [13, -26] },
          { id: 'orchard', label: 'Bone Orchard', min: [-6, -44], max: [6, -36] },
          { id: 'garden', label: 'Warden’s Garden', min: [6, -44], max: [12, -38] },
          { id: 'antechamber', label: 'Scale Antechamber', min: [-6, -50], max: [2, -44] },
          { id: 'weighing', label: 'The Weighing Room', min: [-6, -58], max: [6, -50] },
        ],
        markers: [
          { type: 'shrine', position: [11.2, -17] },
          { type: 'door', position: [0, 16] },
          { type: 'door', position: [6, -41.2] },
        ],
      },
    };
  },
};
