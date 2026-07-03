import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { FlickerLight } from '../effects/FlickerLight.js';
import { FogCards } from '../effects/FogCards.js';
import { makeItemPickup, makeTransition, makeNpc, makePickupMesh } from './levelHelpers.js';
import { readDocument } from '../../gameplay/story/documents.js';
import { buildWeaponModel } from '../../assets/models/weaponModels.js';
import {
  LEDGER_SCRIPT,
  CENSOR_SCRIPT,
  RECOUNT_SCRIPT,
  COLOPHON_SCRIPT,
} from '../../gameplay/cinematics/scripts.js';

/**
 * THE SCRIPTORIUM WING (♦) — the church's east arm. The library that wrote
 * the town down, and the office that struck the important parts out.
 *
 * REGIONAL MECHANIC — OBSERVATION. The residents ("blanks") are pages
 * nobody wrote: they move ONLY while unobserved. Face them and they stand
 * mid-stride; look away — to read a document, to check the map, to walk —
 * and they close. The wing is built around forcing you to take your eyes
 * off things: documents you must read, shelves you must search, lecterns
 * you must work. Fixed cameras mean YOUR facing, not the camera's.
 *
 * Also here: the shifting stacks (a lever re-shelves the library around
 * you), the Proofing Piece (early firearm, same tallow rounds), Brother
 * Ledger the Counting Man, Pilgrim Moth and her NINE hidden bookmarks
 * (unmarked — no shine, no glint, just eyes), and THE CENSOR, who only
 * kneels to its own instrument.
 *
 *   z=-58 ┌─COLOPHON──┐ (stone)          17 spaces:
 *   z=-48 └──┬────────┘─♦─┌FORBIDDEN┐    vestibule, catalogue, stacks,
 *   z=-40 ┌PALIMPSEST─┘   └─────────┘    copying hall, illuminators,
 *  ┌INK──┐│              ┌OFFICE┐        misprint cell, margin walk,
 *  │CELLAR├─ BINDERY ────┤(key) │        reading room, catechism chapel,
 *  └─────┘│  (BOSS)      └──────┘        proofing room, antechamber,
 *   z=-26 └───┬──────────┘               BINDERY (boss), ink cellar,
 *  ┌PROOF┐┌ANTECH┐                       censor's office, palimpsest,
 *  └──┬──┘└──────┘                       forbidden stack (♦), COLOPHON
 *  ┌MARGIN┐┌READING┐┌CATECHISM┐
 *  └──┬───┘└───────┘└─────────┘
 *  ┌MISPRINT┐┌ILLUMINATORS┐
 *  └────────┘└──┬─────────┘
 *  ┌COPYING──┐┌STACKS──┐
 *  └─────────┘└──┬─────┘
 *   z=0..8    ┌CATALOGUE┐
 *   z=8..16   ┌VESTIBULE┐ → church
 */

const H = 4;

export const SCRIPTORIUM = {
  id: 'scriptorium',
  name: 'The Scriptorium',

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
    const lintel = (x0, z0, x1, z1) => wall(x0, z0, x1, z1, { h: H - 2.6, yBase: 2.6, tex: 'plasterRot' });
    const q = (flag) => Boolean(story.get(flag));
    const pickupCtx = { root, story, inventory, events, updatables };

    /* --------------------------- FLOOR & SKY --------------------------- */
    add(kit.slab({ center: [-3, -21], size: [36, 78], y: 0, texture: 'woodPlanks', repeat: [18, 39] }));
    add(kit.slab({ center: [-3, -21], size: [36, 78], y: H, texture: 'plasterRot', flip: true, repeat: [18, 39] }));

    /* ----------------------------- WALLS ------------------------------- */
    // VESTIBULE (x -3..3, z 8..16)
    wall(-3, 16, -0.8, 16); wall(0.8, 16, 3, 16); lintel(-0.8, 16, 0.8, 16);
    wall(-3, 8, -3, 16); wall(3, 8, 3, 16);
    wall(-3, 8, -0.8, 8); wall(0.8, 8, 3, 8); lintel(-0.8, 8, 0.8, 8);
    // CATALOGUE (x -6..6, z 0..8)
    wall(-6, 0, -6, 8); wall(6, 0, 6, 8);
    wall(-6, 8, -3, 8); wall(3, 8, 6, 8);
    wall(-6, 0, -0.8, 0); wall(0.8, 0, 6, 0); lintel(-0.8, 0, 0.8, 0);
    // STACKS (x -6..6, z -10..0)
    wall(6, -10, 6, 0);
    wall(-6, -4.4, -6, 0); wall(-6, -10, -6, -6); lintel(-6, -6, -6, -4.4);
    wall(-6, -10, -4.8, -10); wall(-3.2, -10, 6, -10); lintel(-4.8, -10, -3.2, -10);
    // COPYING HALL (x -16..-6, z -8..0)
    wall(-16, 0, -6, 0);
    wall(-16, -8, -12.8, -8); wall(-11.2, -8, -6, -8); lintel(-12.8, -8, -11.2, -8);
    wall(-16, -4, -16, 0); wall(-16, -8, -16, -6); lintel(-16, -6, -16, -4);
    wall(-6, -4.4, -6, 0) /* shared with stacks */;
    // MISPRINT CELL (x -20..-16, z -6..-1)
    wall(-20, -6, -16, -6); wall(-20, -1, -16, -1); wall(-20, -6, -20, -1);
    // ILLUMINATORS (x -16..-8, z -14..-8)
    wall(-16, -14, -8, -14); wall(-16, -14, -16, -8);
    wall(-8, -14, -8, -8);
    // MARGIN WALK (x -6..-2, z -18..-10)
    wall(-6, -18, -6, -10);
    wall(-2, -10, -2, -14.4); wall(-2, -16, -2, -18); lintel(-2, -16, -2, -14.4);
    wall(-6, -18, -4.8, -18); wall(-3.2, -18, -2, -18); lintel(-4.8, -18, -3.2, -18);
    wall(-6, -10, -6, -10);
    // READING ROOM (x -2..6, z -18..-12)
    wall(-2, -12, 6, -12);
    wall(6, -12, 6, -14.4); wall(6, -16, 6, -18); lintel(6, -16, 6, -14.4);
    wall(-2, -18, 6, -18);
    // CATECHISM CHAPEL (x 6..12, z -18..-12)
    wall(6, -12, 12, -12); wall(6, -18, 12, -18); wall(12, -18, 12, -12);
    // PROOFING ROOM (x -7..-1, z -24..-18)
    wall(-7, -18, -6, -18);
    wall(-7, -24, -7, -18);
    wall(-7, -24, -1, -24);
    wall(-1, -24, -1, -22); wall(-1, -20.4, -1, -18); lintel(-1, -22, -1, -20.4);
    // ANTECHAMBER (x -1..5, z -26..-18)
    wall(-1, -18, 5, -18) /* south side of reading room already at -18? reading spans -2..6 so overlap ok */;
    wall(5, -26, 5, -18);
    wall(-1, -26, 1, -26); wall(2.6, -26, 5, -26); lintel(1, -26, 2.6, -26);
    wall(-1, -26, -1, -24);
    // BINDERY (x -8..8, z -40..-26)
    wall(-8, -26, -1, -26); wall(5, -26, 8, -26);
    wall(-8, -32.4, -8, -26); wall(-8, -40, -8, -34); lintel(-8, -34, -8, -32.4);
    wall(8, -32.4, 8, -26); wall(8, -40, 8, -34); lintel(8, -34, 8, -32.4);
    wall(-8, -40, -0.8, -40); wall(0.8, -40, 8, -40); lintel(-0.8, -40, 0.8, -40);
    // INK CELLAR (x -16..-8, z -38..-30)
    wall(-16, -38, -8, -38); wall(-16, -30, -8, -30); wall(-16, -38, -16, -30);
    // CENSOR'S OFFICE (x 8..14, z -38..-30)
    wall(8, -38, 14, -38); wall(8, -30, 14, -30); wall(14, -38, 14, -30);
    // PALIMPSEST (x -3..3, z -48..-40)
    wall(-3, -48, -3, -40);
    wall(3, -40, 3, -44.4); wall(3, -46, 3, -48); lintel(3, -46, 3, -44.4);
    wall(-3, -48, -0.8, -48); wall(0.8, -48, 3, -48); lintel(-0.8, -48, 0.8, -48);
    // FORBIDDEN STACK (x 3..11, z -48..-42)
    wall(3, -42, 11, -42); wall(3, -48, 11, -48); wall(11, -48, 11, -42);
    // COLOPHON (x -6..6, z -58..-48)
    wall(-6, -58, 6, -58); wall(-6, -58, -6, -48); wall(6, -58, 6, -48);
    wall(-6, -48, -3, -48); wall(3, -48, 6, -48);

    /* ------------------------ SHELVES EVERYWHERE ----------------------- */
    const shelfMat = kit.material('woodPlanks', { color: 0x4a382a });
    const bookColors = [0x6a2a2a, 0x2a4a3a, 0x2a3a5c, 0x5a4a22, 0x4a2a4a];
    const mkShelf = (x, z, w, d, ry = 0, solid = true) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), shelfMat);
      body.position.y = 1.3;
      g.add(body);
      // Book spines: a strip of colored boxes on each face.
      for (let i = 0; i < Math.floor(w / 0.28); i++) {
        for (const side of [-1, 1]) {
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.34, 0.05),
            kit.ps2.patch(new THREE.MeshStandardMaterial({ color: bookColors[(i * 3 + side + 5) % 5], roughness: 1 }))
          );
          book.position.set(-w / 2 + 0.2 + i * 0.28, 1.6 + (i % 2) * 0.5, side * (d / 2 + 0.02));
          g.add(book);
        }
      }
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      g.updateMatrixWorld(true);
      root.add(g);
      const box = new THREE.Box3().setFromObject(body);
      if (solid) colliders.push(box);
      return { group: g, box };
    };

    // Static shelf furniture across the wing.
    mkShelf(-3.5, 4, 4.5, 0.5); mkShelf(3.5, 5.6, 4, 0.5);
    mkShelf(-3, -2, 4.5, 0.5); mkShelf(0, -8, 5, 0.5); mkShelf(4.2, -5, 0.5, 4);
    mkShelf(-12, -10.5, 5, 0.5);
    mkShelf(0, -50.5, 4, 0.5); mkShelf(7, -43.5, 5, 0.5);

    // THE SHIFTING STACKS: one lever, two states. Unshifted, the east
    // alcove is shelved off; shifted, the alcove opens and the west
    // shortcut closes. The library rearranges itself around your choice.
    const shelfA = mkShelf(4.2, -2.6, 0.5, 4.4, 0, false); // blocks alcove
    const shelfB = mkShelf(-2.2, -6, 4.2, 0.5, 0, false);  // blocks mid-path when shifted
    let shelvesApplied = null;
    const applyShelves = () => {
      const shifted = q('stacksShifted');
      if (shelvesApplied === shifted) return;
      shelvesApplied = shifted;
      shelfA.group.visible = !shifted;
      shelfB.group.visible = shifted;
      for (const box of [shelfA.box, shelfB.box]) {
        const i = colliders.indexOf(box);
        if (i !== -1) colliders.splice(i, 1);
      }
      colliders.push(shifted ? shelfB.box : shelfA.box);
      physics.setStaticColliders(colliders);
    };
    applyShelves();
    updatables.push({ update: applyShelves });
    interactables.push({
      id: 'stacks-lever',
      position: new THREE.Vector3(5.4, 1, 6.8),
      radius: 1.4,
      prompt: () => (q('stacksShifted') ? 'Pull the catalogue lever (Ⅱ→Ⅰ)' : 'Pull the catalogue lever (Ⅰ→Ⅱ)'),
      onInteract: () => {
        story.set('stacksShifted', !q('stacksShifted'));
        events.emit('audio/sfx', { id: 'doorTransition' });
        events.emit('camera/impulse', { strength: 0.3 });
        events.emit('ui/toast', { text: 'Deep in the stacks, whole shelves walk to new positions. The library prefers edition two.' });
      },
    });

    /* --------------------------- ROOM DRESSING ------------------------- */
    // Vestibule: a warning in marble.
    add(kit.votives({ position: [-2.4, 14.6], seed: 4 }));
    add(kit.banner({ position: [0, 15.8], rotationY: 0, y: 3.4 }));
    // Catalogue: card drawers.
    for (const [cx, cz] of [[-5.2, 2], [-5.2, 5.5]]) {
      const drawers = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 2.6), shelfMat);
      drawers.position.set(cx, 0.8, cz);
      root.add(drawers);
      colliders.push(new THREE.Box3().setFromObject(drawers));
    }
    // Copying hall: rows of desks with dry inkwells.
    for (const [dx, dz] of [[-14, -2], [-11, -2], [-8.5, -2], [-14, -5.5], [-11, -5.5], [-8.5, -5.5]]) {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.9), shelfMat);
      desk.position.set(dx, 0.42, dz);
      desk.rotation.y = 0.12 * ((dx * 7) % 3);
      root.add(desk);
      colliders.push(new THREE.Box3().setFromObject(desk));
    }
    // Illuminators: pigment pots, gold-leaf glint.
    for (const [px, pz, pc] of [[-14.5, -12.5, 0x9c3a30], [-13.8, -12.2, 0x3a5a9c], [-14.1, -13, 0x8a7434]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.24, 6),
        kit.ps2.patch(new THREE.MeshStandardMaterial({ color: pc, roughness: 0.6 })));
      pot.position.set(px, 0.95, pz);
      root.add(pot);
    }
    const illumDesk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 1.1), shelfMat);
    illumDesk.position.set(-14, 0.42, -12.6);
    root.add(illumDesk);
    colliders.push(new THREE.Box3().setFromObject(illumDesk));
    // Misprint cell: scratched walls, a cot, one occupant long gone.
    add(kit.corpse({ position: [-18.5, -3.5], rotationY: 2.4 }));
    add(kit.wallStain({ position: [-19.9, -3.5], y: 1.4, rotationY: Math.PI / 2, size: 1.3, kind: 'scratch' }));
    add(kit.wallStain({ position: [-18, -5.9], y: 1.2, rotationY: 0, size: 1.1, kind: 'scratch' }));
    // Margin walk: scrawl down both sides.
    add(kit.wallStain({ position: [-5.9, -12], y: 1.6, rotationY: Math.PI / 2, size: 1.4, kind: 'scratch' }));
    add(kit.wallStain({ position: [-2.1, -16], y: 1.8, rotationY: -Math.PI / 2, size: 1.2, kind: 'scratch' }));
    // Reading room: Ledger's fortress of ledgers.
    mkShelf(2, -17.5, 6, 0.5);
    const ledgerDesk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.1), shelfMat);
    ledgerDesk.position.set(2, 0.45, -14.5);
    root.add(ledgerDesk);
    colliders.push(new THREE.Box3().setFromObject(ledgerDesk));
    // Catechism chapel: a shrine and kneelers.
    add(kit.shrine({ position: [11.2, -15], rotationY: -Math.PI / 2 }));
    add(kit.pew({ position: [8, -14], rotationY: 0 }));
    add(kit.pew({ position: [8, -16], rotationY: 0 }));
    interactables.push({
      id: 'catechism-shrine',
      position: new THREE.Vector3(11, 1, -15),
      radius: 1.5,
      prompt: 'Pray at the bones (save)',
      onInteract: () => events.emit('ui/open-save-menu'),
    });
    // Proofing room: chained target dummy, powder smell.
    const dummy = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.4),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 1 })));
    dummy.position.set(-5.8, 0.8, -22.5);
    root.add(dummy);
    colliders.push(new THREE.Box3().setFromObject(dummy));
    // Bindery: the four SEAL PRESSES (boss gimmick) + thread and clamps.
    const pressPlates = [];
    const PRESS_POSITIONS = [
      new THREE.Vector3(-5, 0, -29.5),
      new THREE.Vector3(5, 0, -29.5),
      new THREE.Vector3(-5, 0, -36.5),
      new THREE.Vector3(5, 0, -36.5),
    ];
    let pressTimer = -1;
    let pressTarget = null;
    for (const pos of PRESS_POSITIONS) {
      const column = new THREE.Mesh(new THREE.BoxGeometry(0.5, H, 0.5), kit.material('ironDark'));
      column.position.set(pos.x + 1.3, H / 2, pos.z);
      root.add(column);
      colliders.push(new THREE.Box3().setFromObject(column));
      const plate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 2.4),
        kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x8a7434, metalness: 0.6, roughness: 0.5 })));
      plate.position.set(pos.x, H - 0.6, pos.z);
      root.add(plate);
      pressPlates.push({ plate, pos, restY: H - 0.6, slamT: -1 });
      interactables.push({
        id: `press-${pos.x}-${pos.z}`,
        position: new THREE.Vector3(pos.x + 1.3, 1, pos.z + 1.1),
        radius: 1.3,
        prompt: 'PULL THE PRESS LEVER',
        onInteract: () => {
          if (pressTimer >= 0) {
            events.emit('ui/toast', { text: 'A press is already falling.' });
            return;
          }
          pressTimer = 0.9; // the delay is the skill: bait it under, then pull
          pressTarget = pressPlates.find((p) => p.pos.equals(pos));
          events.emit('audio/sfx', { id: 'weaponReady' });
        },
      });
    }
    updatables.push({
      update: (dt) => {
        if (pressTimer >= 0) {
          pressTimer -= dt;
          if (pressTimer < 0 && pressTarget) {
            pressTarget.slamT = 0;
            events.emit('audio/sfx', { id: 'doorTransition' });
            events.emit('camera/impulse', { strength: 0.55 });
            events.emit('press/slammed', { position: pressTarget.pos.clone() });
            pressTarget = null;
          }
        }
        for (const p of pressPlates) {
          if (p.slamT >= 0) {
            p.slamT += dt;
            const t = p.slamT;
            // Fast down, slow rise.
            p.plate.position.y = t < 0.12 ? p.restY - (t / 0.12) * (p.restY - 0.5)
              : t < 1.4 ? 0.5
              : Math.min(p.restY, 0.5 + (t - 1.4) * 2.2);
            if (p.plate.position.y >= p.restY) p.slamT = -1;
          }
        }
      },
    });
    // Ink cellar: black pooled floor (wading slows — 'water' surface).
    const inkPool = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 7.6),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.2, metalness: 0.6 })));
    inkPool.rotation.x = -Math.PI / 2;
    inkPool.position.set(-12, 0.02, -34);
    root.add(inkPool);
    // Censor's office: the desk where the words died. Behind a felled-boss door.
    const officeDesk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 1.2), shelfMat);
    officeDesk.position.set(11.5, 0.47, -34.5);
    root.add(officeDesk);
    colliders.push(new THREE.Box3().setFromObject(officeDesk));
    const officeDoor = kit.door({ position: [8, -33.2], rotationY: -Math.PI / 2, width: 1.6, height: 2.6 });
    if (!q('censorFelled')) {
      add(officeDoor);
    }
    const palimpsestDoor = kit.door({ position: [0, -40], width: 1.6, height: 2.6 });
    if (!q('censorFelled')) {
      add(palimpsestDoor);
    }
    updatables.push({
      update: () => {
        if (!story.get('censorFelled')) return;
        for (const door of [officeDoor, palimpsestDoor]) {
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
    // Palimpsest gallery: scraped murals.
    add(kit.wallStain({ position: [-2.9, -43], y: 2.0, rotationY: Math.PI / 2, size: 1.6, kind: 'damp' }));
    add(kit.wallStain({ position: [2.9, -46], y: 1.8, rotationY: -Math.PI / 2, size: 1.5, kind: 'damp' }));
    add(kit.fallenStatue({ position: [-1.5, -45], rotationY: 1.1 }));
    // Forbidden stack (♦-locked).
    let forbiddenDoor = null;
    if (!q('forbiddenStackOpen')) {
      forbiddenDoor = kit.door({ position: [3, -45.2], rotationY: Math.PI / 2, width: 1.4, height: 2.5 });
      add(forbiddenDoor);
    }
    interactables.push({
      id: 'forbidden-door',
      position: new THREE.Vector3(2.6, 1, -45.2),
      radius: 1.5,
      prompt: () =>
        q('forbiddenStackOpen') ? 'The forbidden stack' : inventory?.has('diamondKey') ? 'Unlock — the Diamond door' : 'A diamond is cut into the lock',
      canInteract: () => !q('forbiddenStackOpen'),
      onInteract: () => {
        if (!inventory?.has('diamondKey')) {
          events.emit('ui/toast', { text: 'Locked. The keyhole is a cut diamond. The Censor kept the key on his desk — everything ends up on his desk.' });
          return;
        }
        story.set('forbiddenStackOpen', true);
        if (forbiddenDoor) {
          forbiddenDoor.object.removeFromParent();
          for (const box of forbiddenDoor.colliders) {
            const i = colliders.indexOf(box);
            if (i !== -1) colliders.splice(i, 1);
          }
          physics.setStaticColliders(colliders);
        }
        events.emit('audio/sfx', { id: 'doorUnlock' });
        events.emit('ui/toast', { text: 'The diamond key turns. The books in here are chained to the shelves. From which side, is the question.' });
      },
    });
    // Colophon: three word-lecterns and the commitment lectern.
    const WHEELS = [
      { id: 'subject', words: ['THE SEA', 'THE TOWN', 'THE GROUND', 'THE CHURCH', 'THE WORD'], answer: 2, x: -3.5, z: -51 },
      { id: 'verb', words: ['FORGIVES', 'SLEEPS', 'IS OWED', 'SINGS', 'COUNTS'], answer: 2, x: 0, z: -50 },
      { id: 'object', words: ['NOTHING', 'A NAME', 'AN HOUR', 'A GUEST', 'EVERYTHING'], answer: 3, x: 3.5, z: -51 },
    ];
    const wheelState = [0, 0, 0];
    WHEELS.forEach((wheel, wi) => {
      const lectern = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.5), shelfMat);
      lectern.position.set(wheel.x, 0.6, wheel.z);
      root.add(lectern);
      colliders.push(new THREE.Box3().setFromObject(lectern));
      interactables.push({
        id: `lectern-${wheel.id}`,
        position: new THREE.Vector3(wheel.x, 1, wheel.z + 0.9),
        radius: 1.2,
        prompt: () => `Turn the ${wheel.id} wheel — it reads “${wheel.words[wheelState[wi]]}”`,
        canInteract: () => !q('wordSolved'),
        onInteract: () => {
          wheelState[wi] = (wheelState[wi] + 1) % wheel.words.length;
          events.emit('audio/sfx', { id: 'uiMove' });
        },
      });
    });
    interactables.push({
      id: 'colophon-commit',
      position: new THREE.Vector3(0, 1, -55),
      radius: 1.6,
      prompt: 'Speak the sentence aloud',
      canInteract: () => !q('wordSolved'),
      onInteract: () => {
        const right = WHEELS.every((w, i) => wheelState[i] === w.answer);
        if (right) {
          story.set('wordSolved', true); // cutscene fires off this flag
        } else {
          events.emit('audio/sfx', { id: 'stingerDetect' });
          story.set('indexMistake', true); // one blank rises from the margins
          events.emit('ui/toast', { text: 'The room reads it back in your own voice, wrong. Somewhere behind you, a page stands up.' });
        }
      },
    });
    const wordStone = makePickupMesh(kit, {
      position: new THREE.Vector3(0, 1.25, -55),
      color: 0x8aa4c9,
      emissive: 0x2a3a52,
    });
    const stonePedestal = kit.pillar({ position: [0, -55], radius: 0.3, height: 0.9, texture: 'stoneWall' });
    add(stonePedestal);
    if (q('wordSolved') && !q('took:colophon-stone')) root.add(wordStone);
    updatables.push({
      update: () => {
        if (!wordStone.parent && story.get('wordSolved') && !story.get('took:colophon-stone')) root.add(wordStone);
        if (wordStone.parent) wordStone.rotation.y += 0.02;
      },
    });
    interactables.push({
      id: 'colophon-stone',
      position: new THREE.Vector3(0, 1, -54.2),
      radius: 1.3,
      prompt: 'Take the Stone of the Word',
      canInteract: () => q('wordSolved') && !q('took:colophon-stone'),
      onInteract: () => {
        if (inventory && !inventory.canFit('stoneOfTheWord')) {
          events.emit('ui/toast', { text: 'Your satchel is full. The Word abides. Words do.' });
          return;
        }
        inventory?.add('stoneOfTheWord');
        story.set('took:colophon-stone', true);
        wordStone.removeFromParent();
        events.emit('audio/sfx', { id: 'pickup' });
        events.emit('ui/toast', { text: 'Taken — THE STONE OF THE WORD. It rearranges gently in your grip, spelling something patient.' });
      },
    });

    /* ------------------------------ LOOT -------------------------------- */
    for (const pickup of [
      // The Proofing Piece — the wing's firearm, on the test bench.
      makeItemPickup(pickupCtx, {
        id: 'proofing-pistol',
        itemId: 'proofingPistol',
        mesh: (() => {
          const model = buildWeaponModel('proofingPistol', kit.ps2);
          model.rotation.z = -Math.PI / 2.3;
          model.position.set(-3.4, 0.95, -21.5);
          return model;
        })(),
        glowColor: 0xffc890,
        position: new THREE.Vector3(-3.4, 1, -21.5),
        prompt: 'Take the Proofing Piece',
        flavor: 'Taken — PROOFING PIECE. One shot at a time, like a signature.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'proofing-shells',
        itemId: 'boneShells',
        qty: 8,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-2.2, 0.35, -23.2), color: 0xc9b37a, emissive: 0x4a3a10 }),
        position: new THREE.Vector3(-2.2, 1, -23.2),
        prompt: 'Take the proofing rounds',
        flavor: 'Taken — TALLOW ROUNDS ×8, each one test-fired against the dummy. All passed.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'catalogue-linen',
        itemId: 'linenStrips',
        qty: 2,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(5.2, 0.35, 0.8), color: 0xc9bd9e, emissive: 0x4a4232 }),
        position: new THREE.Vector3(5.2, 1, 0.8),
        prompt: 'Take the page-binding linen',
        flavor: 'Taken — LINEN STRIPS ×2, cut for spines.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'copying-moss',
        itemId: 'mossPoultice',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-15.2, 0.35, -6.8), color: 0x6f7d4e, emissive: 0x2a3a1a }),
        position: new THREE.Vector3(-15.2, 1, -6.8),
        prompt: 'Take the copyist’s kit',
        flavor: 'Taken — MOSS POULTICE. Ink-stained fingers heal slowly.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'antechamber-shells',
        itemId: 'boneShells',
        qty: 6,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(3.8, 0.35, -24.6), color: 0xc9b37a, emissive: 0x4a3a10 }),
        position: new THREE.Vector3(3.8, 1, -24.6),
        prompt: 'Search the binder’s satchel',
        flavor: 'Taken — TALLOW ROUNDS ×6. Binders went armed too. Everyone here went armed, eventually.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'cellar-tonic',
        itemId: 'graveTonic',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-15.2, 0.35, -31), color: 0x8a4a42, emissive: 0x3a1210 }),
        position: new THREE.Vector3(-15.2, 1, -31),
        prompt: 'Take the shelf bottle',
        flavor: 'Taken — GRAVE TONIC, corked against the ink damp.',
      }),
      // Forbidden stack: the optional upgrade cache.
      makeItemPickup(pickupCtx, {
        id: 'forbidden-draught',
        itemId: 'wardensDraught',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(9.6, 0.5, -46.6), color: 0x8a2a3a, emissive: 0x4a0a12 }),
        glowColor: 0xff9aa8,
        position: new THREE.Vector3(9.6, 1, -46.6),
        prompt: 'Take the chained vial',
        flavor: 'Taken — WARDEN’S DRAUGHT. This one was chained down. Consider that.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'forbidden-salve',
        itemId: 'blessedSalve',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(5, 0.5, -46.8), color: 0xd8cfae, emissive: 0x554a2a }),
        position: new THREE.Vector3(5, 1, -46.8),
        prompt: 'Take the reliquary jar',
        flavor: 'Taken — BLESSED SALVE, shelved under FORBIDDEN: COMFORT.',
      }),
      // The Censor's desk: the diamond key.
      makeItemPickup(pickupCtx, {
        id: 'office-diamond-key',
        itemId: 'diamondKey',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(11.5, 1.1, -34.5), color: 0x8aa4c9, emissive: 0x2a3a52 }),
        glowColor: 0x9ac0ff,
        position: new THREE.Vector3(11.5, 1, -34.2),
        prompt: 'Take the key from the blotter',
        flavor: 'Taken — DIAMOND KEY, sitting square in the center of the blotter, like a verdict.',
      }),
    ]) {
      if (pickup) interactables.push(pickup);
    }

    /* ------------------- THE NINE BOOKMARKS (unmarked) ----------------- */
    // No beacons. No glints. Small silk ribbons tucked where a reader
    // would leave them; only the interact prompt (radius 0.9) gives them up.
    const BOOKMARK_SPOTS = [
      [-2.6, 9.2, 'tucked under the vestibule kneeler'],
      [5.4, 3.4, 'inside an open catalogue drawer'],
      [5.2, -6.6, 'deep in the shifted stacks'],
      [-10.9, -1.4, 'under a copying desk'],
      [-18.8, -2.2, 'in the misprint’s cell, held in a bronze hand'],
      [-15.4, -13.4, 'behind the pigment pots'],
      [-14.6, -36.8, 'on a dry shelf above the ink'],
      [13.2, -37.2, 'in the Censor’s waste-basket, uncensored'],
      [-5.2, -56.6, 'wedged beneath the colophon floor-board'],
    ];
    const ribbonMat = kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x9c2030, roughness: 0.8 }));
    BOOKMARK_SPOTS.forEach(([bx, bz, where], i) => {
      const flag = `took:bookmark-${i}`;
      if (story.get(flag)) return;
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.32), ribbonMat);
      ribbon.position.set(bx, 0.12, bz);
      ribbon.rotation.y = (bx * 13 + bz * 7) % 3;
      root.add(ribbon);
      interactables.push({
        id: `bookmark-${i}`,
        position: new THREE.Vector3(bx, 1, bz),
        radius: 0.9,
        prompt: 'A red silk bookmark',
        canInteract: () => !story.get(flag),
        onInteract: () => {
          if (!inventory?.canFit('silkBookmark')) {
            events.emit('ui/toast', { text: 'Your satchel is full. She would not forgive a dropped sister.' });
            return;
          }
          inventory.add('silkBookmark');
          story.set(flag, true);
          ribbon.removeFromParent();
          events.emit('audio/sfx', { id: 'pickup' });
          events.emit('ui/toast', { text: `Taken — SILK BOOKMARK (${inventory.count('silkBookmark')} of 9), ${where}.` });
        },
      });
    });

    /* --------------------------- DOCUMENTS ----------------------------- */
    interactables.push(
      { id: 'doc-stacks-memo', position: new THREE.Vector3(-4.6, 1, 6.6), radius: 1.4, prompt: 'Read the shelving memo', onInteract: () => readDocument(events, story, 'stacksMemo') },
      { id: 'doc-illum', position: new THREE.Vector3(-13.4, 1, -12.4), radius: 1.4, prompt: 'Read the illuminator’s note', onInteract: () => readDocument(events, story, 'illuminatorsNote') },
      { id: 'doc-misprint', position: new THREE.Vector3(-17.6, 1, -4.6), radius: 1.4, prompt: 'Read the scratched confession', onInteract: () => readDocument(events, story, 'misprintConfession') },
      { id: 'doc-marginalia', position: new THREE.Vector3(-5.4, 1, -13), radius: 1.4, prompt: 'Read the marginalia', onInteract: () => readDocument(events, story, 'mothMarginalia') },
      { id: 'doc-catechism', position: new THREE.Vector3(9, 1, -13), radius: 1.6, prompt: 'Read the catechism', onInteract: () => readDocument(events, story, 'catechismOfTheGround') },
      { id: 'doc-proofing', position: new THREE.Vector3(-6.2, 1, -19.4), radius: 1.4, prompt: 'Read the proofing manual', onInteract: () => readDocument(events, story, 'proofingManual') },
      { id: 'doc-censor-ledger', position: new THREE.Vector3(10.4, 1, -35.4), radius: 1.5, prompt: 'Read the Censor’s ledger', onInteract: () => readDocument(events, story, 'censorsLedger') },
      { id: 'doc-palimpsest', position: new THREE.Vector3(-2.4, 1, -43.2), radius: 1.5, prompt: 'Read the scraped mural', onInteract: () => readDocument(events, story, 'palimpsestReading') },
      { id: 'doc-ledger-count', position: new THREE.Vector3(1.2, 1, -14), radius: 1.5, prompt: 'Read Ledger’s open tally', onInteract: () => readDocument(events, story, 'ledgersCount') }
    );

    /* ------------------------------ PEOPLE ------------------------------ */
    const npcCtx = { root, ps2: kit.ps2, events, updatables, colliders };
    interactables.push(
      // BROTHER LEDGER — the Counting Man. The wing's anchor NPC.
      makeNpc(npcCtx, {
        id: 'ledger',
        name: 'Brother Ledger',
        position: new THREE.Vector3(2, 0, -15.6),
        facing: Math.PI,
        outfit: 'robe',
        hair: 'bald',
        build: 0.92,
        palette: { coat: 0x2e2a36, skin: 0xc9b394 },
        lines: () => {
          if (q('wordSolved'))
            return [
              'Four words — no, five — spoken in the right order. I counted them through two walls. FIVE, if you count the breath before. I always count the breath before.',
              'Take the Word to the cage, friend. And when the key comes out — count its teeth. Seven. If you ever count eight, you are holding a different key, and I am so sorry.',
            ];
          if (q('censorFelled'))
            return [
              'The presses came down four times — no. THREE times and one glorious time. I heard the difference. The whole wing heard the difference.',
              'His office is open now. He kept everything on that desk: the diamond key, the ledger of what he struck. Item forty-one. Read item FORTY-ONE.',
              'And the Colophon will ask you the question he unwrote. The catechism holds the question. His ledger holds the shape of the answer. I hold the number: three words, then two, then two. I am telling you the syllables because I LIKE you.',
            ];
          return [
            'One visitor. ONE. Do you know how long it has been since I counted a visitor? Four thousand and — no. Wait. Let me savor it. One. ONE visitor. Wonderful.',
            'I count for the wing. Pages in: everything. Pages out: nothing — the Censor sees to that. Words struck: eleven thousand and forty-one. The forty-one matter. He keeps them in his office.',
            'Mind the unwritten as you go, friend. The pale ones. They only move when you are not reading them — so READ them. Walk backwards. It is rude and it works.',
            'The big one in the Bindery, though — the CENSOR — looking does nothing. He only kneels to his own instrument. Four presses. Bait, pull, step aside. Count the delay: not-quite-one.',
          ];
        },
      }),
      // PILGRIM MOTH — the side quest: nine sisters of red silk.
      makeNpc(npcCtx, {
        id: 'moth',
        name: 'Pilgrim Moth',
        position: new THREE.Vector3(-4.2, 0, -16.4),
        facing: 0.3,
        scale: 0.8,
        outfit: 'robe',
        hair: 'long',
        palette: { coat: 0x5c5266, skin: 0xd8cfc0, hair: 0xe8e2d8 },
        lines: () => {
          const count = inventory?.count('silkBookmark') ?? 0;
          if (q('mothQuestDone'))
            return [
              'All nine, home in my sleeves. Can you hear them settling? Like little red doors closing, one street at a time.',
              'The tenth? …There is no tenth. There is NO tenth. Thank you again, page-friend. Walk between the lines, where it’s safe.',
            ];
          if (count >= 9)
            return [
              'NINE. Nine nine nine — oh, hold still, let me look at you. You found all my sisters and not one of them screamed. Give, give, give.',
              'Here — the wing pays its debts through me sometimes. A vial the warden never missed and a jar of the good mercy. Spend them on staying alive; it’s what sisters are FOR.',
            ];
          return [
            `A reader! No — a FINDER. I can smell it. I lost my sisters, finder. Nine ribbons of red silk, marking nine places I was reading when it happened. (${count} of 9 have come home. I feel them move when you pocket them.)`,
            'They are not MARKED, you understand. No glow, no glitter — a bookmark that announces itself is a bookmark that gets CONFISCATED. Look low. Look inside things. Look where a person would stop reading forever.',
            'One is somewhere cold and black, one is with the man who scratched, one the Censor stole — he steals everything red. Bring them home and I will pay you in the wing’s own kindness.',
          ];
        },
        onComplete: () => {
          const count = inventory?.count('silkBookmark') ?? 0;
          if (count >= 9 && !q('mothQuestDone')) {
            if (!inventory.canFit('wardensDraught') || !inventory.canFit('blessedSalve')) {
              events.emit('ui/toast', { text: 'Moth clicks her tongue: “Your satchel is FULL, finder. Make room for kindness and come back.”' });
              return;
            }
            story.set('mothQuestDone', true); // the sweep collects her sisters
            inventory.add('wardensDraught');
            inventory.add('blessedSalve');
            events.emit('audio/sfx', { id: 'saveChime' });
            events.emit('ui/toast', { text: 'Received — WARDEN’S DRAUGHT and BLESSED SALVE. Moth tucks nine sisters into her sleeves, humming.' });
          }
        },
      })
    );

    /* ---------------------------- LIGHTING ----------------------------- */
    root.add(new THREE.AmbientLight(0x2d2a38, 2.3));
    root.add(new THREE.HemisphereLight(0x323046, 0x1a140e, 1.0));
    const shaft = new THREE.DirectionalLight(0x8a7a5a, 1.0);
    shaft.position.set(-8, 14, -10);
    shaft.target.position.set(0, 0, -20);
    shaft.castShadow = true;
    shaft.shadow.mapSize.set(1024, 1024);
    shaft.shadow.camera.left = -30;
    shaft.shadow.camera.right = 30;
    shaft.shadow.camera.top = 40;
    shaft.shadow.camera.bottom = -40;
    root.add(shaft, shaft.target);
    const flickers = [
      new FlickerLight({ position: new THREE.Vector3(0, 2.4, 12), intensity: 10, distance: 9, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.6, 4), intensity: 11, distance: 10, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.4, -5), intensity: 9, distance: 9 }),
      new FlickerLight({ position: new THREE.Vector3(-11, 2.6, -4), intensity: 10, distance: 10, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(-12, 2.2, -11.5), intensity: 9, distance: 8, color: 0xc9803a }),
      new FlickerLight({ position: new THREE.Vector3(-4, 2.2, -14), intensity: 8, distance: 8, color: 0x9aa4c9 }),
      new FlickerLight({ position: new THREE.Vector3(2, 2.4, -15), intensity: 10, distance: 9, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(9, 2.2, -15), intensity: 9, distance: 8 }),
      new FlickerLight({ position: new THREE.Vector3(-4, 2.4, -21), intensity: 9, distance: 8 }),
      new FlickerLight({ position: new THREE.Vector3(0, 3.0, -33), intensity: 13, distance: 15, castShadow: true }),
      new FlickerLight({ position: new THREE.Vector3(-12, 2.0, -34), intensity: 7, distance: 8, color: 0x3a4a9c }),
      new FlickerLight({ position: new THREE.Vector3(11, 2.4, -34), intensity: 9, distance: 8, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.4, -44), intensity: 8, distance: 9, color: 0x9aa4c9 }),
      new FlickerLight({ position: new THREE.Vector3(7, 2.2, -45), intensity: 8, distance: 8, color: 0xc9803a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.6, -53), intensity: 11, distance: 11 }),
    ];
    for (const f of flickers) {
      root.add(f.light);
      updatables.push(f);
    }
    const fog1 = new FogCards({ center: [0, -33], size: [16, 14], count: 4, opacity: 0.07 });
    const fog2 = new FogCards({ center: [-12, -34], size: [8, 8], count: 3, opacity: 0.1, color: 0x1a1a2a });
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
          prompt: 'Return to the church',
          targetLevel: 'chapel-of-the-hollow',
          targetSpawn: 'fromScriptorium',
        }
      )
    );

    /* -------------------------- CAMERA ZONES --------------------------- */
    const cameraZones = [
      defineCameraZone({ id: 'vestibule', min: [-3, -1, 8], max: [3, 4, 16], camera: [-2.4, 2.6, 9], trackTarget: true, trackStiffness: 3.5, rollDeg: 2, fovOverride: 58 }),
      defineCameraZone({ id: 'catalogue', min: [-6, -1, 0], max: [6, 4, 8], camera: [5, 3, 6.8], trackTarget: true, trackStiffness: 3, fovOverride: 60 }),
      defineCameraZone({ id: 'stacks', min: [-6, -1, -10], max: [6, 4, 0], camera: [-5, 3.2, -0.8], trackTarget: true, trackStiffness: 2.8, rollDeg: -3, fovOverride: 62 }),
      defineCameraZone({ id: 'copying', min: [-16, -1, -8], max: [-6, 4, 0], camera: [-6.8, 2.8, -0.6], trackTarget: true, trackStiffness: 3, fovOverride: 60 }),
      defineCameraZone({ id: 'misprint', min: [-20, -1, -6], max: [-16, 3, -1], camera: [-16.4, 1.8, -1.6], lookAt: [-19, 1, -4.5], fovOverride: 54, priority: 1 }),
      defineCameraZone({ id: 'illuminators', min: [-16, -1, -14], max: [-8, 4, -8], camera: [-8.6, 2.4, -8.6], trackTarget: true, trackStiffness: 3.2, fovOverride: 58 }),
      defineCameraZone({ id: 'margin', min: [-6, -1, -18], max: [-2, 4, -10], camera: [-4, 2.6, -10.4], lookAt: [-4, 1, -18], fovOverride: 48 }),
      defineCameraZone({ id: 'reading', min: [-2, -1, -18], max: [6, 4, -12], camera: [-1.4, 2.3, -12.6], lookAt: [2.4, 1.1, -15.6], fovOverride: 56 }),
      defineCameraZone({ id: 'catechism', min: [6, -1, -18], max: [12, 4, -12], camera: [6.6, 2.2, -12.6], lookAt: [10.5, 1, -15.5], fovOverride: 54 }),
      defineCameraZone({ id: 'proofing', min: [-7, -1, -24], max: [-1, 4, -18], camera: [-1.6, 2.4, -18.6], trackTarget: true, trackStiffness: 3.2, rollDeg: 3, fovOverride: 58 }),
      defineCameraZone({ id: 'antechamber', min: [-1, -1, -26], max: [5, 4, -18], camera: [4.2, 2.6, -18.8], trackTarget: true, trackStiffness: 3.2, fovOverride: 58 }),
      defineCameraZone({ id: 'bindery', min: [-8, -1, -40], max: [8, 4, -26], camera: [-7, 3.4, -27.2], trackTarget: true, trackStiffness: 2.6, fovOverride: 64 }),
      defineCameraZone({ id: 'inkcellar', min: [-16, -1, -38], max: [-8, 4, -30], camera: [-8.6, 2.2, -30.6], trackTarget: true, trackStiffness: 3, rollDeg: -4, fovOverride: 60 }),
      defineCameraZone({ id: 'office', min: [8, -1, -38], max: [14, 4, -30], camera: [8.6, 2.3, -30.6], lookAt: [11.8, 1.1, -35], fovOverride: 54 }),
      defineCameraZone({ id: 'palimpsest', min: [-3, -1, -48], max: [3, 4, -40], camera: [0, 2.6, -40.6], lookAt: [0, 1.2, -48], fovOverride: 50 }),
      defineCameraZone({ id: 'forbidden', min: [3, -1, -48], max: [11, 4, -42], camera: [3.6, 2.2, -42.6], lookAt: [8.5, 1, -46.5], fovOverride: 56 }),
      defineCameraZone({ id: 'colophon', min: [-6, -1, -58], max: [6, 4, -48], camera: [-5, 3, -48.8], trackTarget: true, trackStiffness: 2.8, rollDeg: 2, fovOverride: 60 }),
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
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(-11, 0, -3.5), homeRadius: 4 },
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(-14.5, 0, -1.5), homeRadius: 4 },
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(-12, 0, -12), homeRadius: 3.5 },
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(-4.5, 0, -13), homeRadius: 3.5 },
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(2, 0, -22), homeRadius: 3.5 },
        { type: 'censor', position: new THREE.Vector3(0, 0, -33) },
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(-12, 0, -35), homeRadius: 3.5 },
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(-14, 0, -32), homeRadius: 3.5 },
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(-1.5, 0, -44), homeRadius: 3.5 },
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(1.5, 0, -46), homeRadius: 3.5 },
        // The index's grudge: one blank, summoned by a wrong sentence.
        { type: 'husk', variant: 'blank', position: new THREE.Vector3(-4, 0, -52), homeRadius: 5, onlyIf: 'indexMistake' },
      ],
      fog: { color: 0x0c0a10, density: 0.05 },
      ambientTrack: 'scriptorium',
      surfaces: {
        default: 'wood',
        regions: [
          { min: [-16, -38], max: [-8, -30], type: 'water' }, // the ink is deep enough to wade
        ],
      },
      cinematics: [
        { when: 'mapSeen:scriptorium:reading', seen: 'cine:ledger', script: LEDGER_SCRIPT },
        { when: 'mapSeen:scriptorium:bindery', seen: 'cine:censor', script: CENSOR_SCRIPT },
        { when: 'mapSeen:scriptorium:office', seen: 'cine:recount', script: RECOUNT_SCRIPT },
        { when: 'wordSolved', seen: 'cine:colophon', script: COLOPHON_SCRIPT },
      ],
      roomComments: {
        'mapSeen:scriptorium:vestibule':
          '…Paper. A whole wing that smells of paper and lampblack. The church grew itself a memory.',
        'mapSeen:scriptorium:stacks':
          '…The shelves go up past the light. I can hear one, somewhere, sliding into a new position. Libraries shouldn’t digest.',
        'mapSeen:scriptorium:inkcellar':
          '…The ink is warm around my ankles. I am going to pretend it’s ink, and it is going to let me.',
        'mapSeen:scriptorium:palimpsest':
          '…They scraped these walls clean and wrote over them. The church isn’t growing rooms. It’s REVISING them.',
      },
      map: {
        rooms: [
          { id: 'vestibule', label: 'Vestibule of the Word', min: [-3, 8], max: [3, 16] },
          { id: 'catalogue', label: 'Card Catalogue', min: [-6, 0], max: [6, 8] },
          { id: 'stacks', label: 'The Stacks', min: [-6, -10], max: [6, 0] },
          { id: 'copying', label: 'Copying Hall', min: [-16, -8], max: [-6, 0] },
          { id: 'misprint', label: 'Misprint Cell', min: [-20, -6], max: [-16, -1] },
          { id: 'illuminators', label: 'Illuminators’ Studio', min: [-16, -14], max: [-8, -8] },
          { id: 'margin', label: 'Margin Walk', min: [-6, -18], max: [-2, -10] },
          { id: 'reading', label: 'Reading Room', min: [-2, -18], max: [6, -12] },
          { id: 'catechism', label: 'Catechism Chapel', min: [6, -18], max: [12, -12] },
          { id: 'proofing', label: 'Proofing Room', min: [-7, -24], max: [-1, -18] },
          { id: 'antechamber', label: 'Bindery Antechamber', min: [-1, -26], max: [5, -18] },
          { id: 'bindery', label: 'The Bindery', min: [-8, -40], max: [8, -26] },
          { id: 'inkcellar', label: 'Ink Cellar', min: [-16, -38], max: [-8, -30] },
          { id: 'office', label: 'Censor’s Office', min: [8, -38], max: [14, -30] },
          { id: 'palimpsest', label: 'Palimpsest Gallery', min: [-3, -48], max: [3, -40] },
          { id: 'forbidden', label: 'Forbidden Stack', min: [3, -48], max: [11, -42] },
          { id: 'colophon', label: 'The Colophon', min: [-6, -58], max: [6, -48] },
        ],
        markers: [
          { type: 'shrine', position: [11.2, -15] },
          { type: 'door', position: [0, 16] },
          { type: 'door', position: [3, -45.2] },
        ],
      },
    };
  },
};
