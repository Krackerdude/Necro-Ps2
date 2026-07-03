import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { FlickerLight } from '../effects/FlickerLight.js';
import { FogCards } from '../effects/FogCards.js';
import { createInstancedScatter } from '../../rendering/instancing/InstancedScatter.js';
import { makeItemPickup, makeTransition, makeNpc, makePickupMesh } from './levelHelpers.js';
import { readDocument } from '../../gameplay/story/documents.js';
import {
  ALDERS_SCRIPT,
  TOLLTAKER_SCRIPT,
  CARILLON_SCRIPT,
} from '../../gameplay/cinematics/scripts.js';

/**
 * THE BELL TOWER WING (♠) — the church's west arm, and the first full wing.
 *
 * REGIONAL MECHANIC — SOUND. The residents ("listeners") are blind; they
 * hunt entirely by ear. Running is dinner, walking is survival — the exact
 * inverse of the town chase. Bell-pulls ring bells in OTHER rooms, and the
 * listeners walk to what they hear: the wing's enemies are also its puzzle
 * pieces. Chime clusters are noise tripwires. The boss is the one thing
 * here that cannot be fooled by sound — and the one thing sound can hurt.
 *
 * Layout (top-down; enter from the church at the south):
 *
 *   z=-70 ┌ROOST────┐┌CARILLON┐            13 rooms + boss + optional:
 *         └───┬─────┘└────────┘            1 narthex      8 warden's rest
 *   z=-60  ┌ASCENT┐ (stone)                2 rope gallery 9 alders' parlor
 *          └──┬───┘                        3 bellfoundry 10 ossuary of ringers
 *   z=-52 ┌GREAT BELL┐  ← THE TOLLTAKER   4 counting house  11 GREAT BELL
 *         │  (boss)  │                     5 choir of ears   12 ascent
 *   z=-36 └────┬─────┘                     6 refectory       13 roost
 *   z=-28 ┌OSSUARY──┐                      7 chime garden    14 CARILLON
 *  ┌REST┐─┤ CHIMES ├─┌PARLOR┐              + clock room (optional, ♠-locked)
 *  └────┘ └───┬────┘ └──────┘
 *   z=-20 ┌CHOIR┐──┌REFECTORY┐
 *         └──┬──┘  └─────────┘
 *   z=-10 ┌COUNTING┐
 *         └──┬─────┘
 *   z=-2  ┌GALLERY ┐──♠──┌CLOCK ROOM┐
 *         └──┬─────┘     └──────────┘
 *   z=8   ┌NARTHEX┐
 *         └──┬────┘
 *   z=16   church
 */

const H = 4;

export const BELL_TOWER = {
  id: 'bell-tower',
  name: 'The Bell Tower',

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

    /* --------------------------- FLOOR & SKY --------------------------- */
    add(kit.slab({ center: [2, -27], size: [38, 90], y: 0, texture: 'stoneFloor', repeat: [19, 45] }));
    add(kit.slab({ center: [2, -27], size: [38, 90], y: H, texture: 'plasterRot', flip: true, repeat: [19, 45] }));

    /* ----------------------------- WALLS ------------------------------- */
    // 1 NARTHEX (x -3..3, z 8..16)
    wall(-3, 16, -0.8, 16); wall(0.8, 16, 3, 16); lintel(-0.8, 16, 0.8, 16);
    wall(-3, 8, -3, 16); wall(3, 8, 3, 16);
    wall(-3, 8, -0.8, 8); wall(0.8, 8, 3, 8); lintel(-0.8, 8, 0.8, 8);
    // 2 GALLERY (x -5..5, z -2..8)
    wall(-5, 3.6, -5, 8); wall(-5, -2, -5, 2); lintel(-5, 2, -5, 3.6);
    wall(5, 3.6, 5, 8); wall(5, -2, 5, 2); lintel(5, 2, 5, 3.6);
    wall(-5, 8, -3, 8); wall(3, 8, 5, 8);
    wall(-5, -2, -0.8, -2); wall(0.8, -2, 5, -2); lintel(-0.8, -2, 0.8, -2);
    // 3 FOUNDRY (x -15..-5, z -4..6)
    wall(-15, -4, -5, -4); wall(-15, 6, -5, 6); wall(-15, -4, -15, 6);
    wall(-5, -4, -5, -2); wall(-5, 6, -5, 8);
    // 4 COUNTING (x -4..4, z -10..-2)
    wall(-4, -10, -4, -2); wall(4, -10, 4, -2);
    wall(-4, -10, -0.8, -10); wall(0.8, -10, 4, -10); lintel(-0.8, -10, 0.8, -10);
    // 5 CHOIR (x -2..2, z -20..-10)
    wall(-2, -20, -2, -10);
    wall(2, -14, 2, -10); wall(2, -20, 2, -18); lintel(2, -18, 2, -14);
    wall(-2, -20, -0.8, -20); wall(0.8, -20, 2, -20); lintel(-0.8, -20, 0.8, -20);
    // 6 REFECTORY (x 2..14, z -20..-12)
    wall(2, -20, 14, -20); wall(2, -12, 14, -12); wall(14, -20, 14, -12);
    // 7 CHIMES (x -4..4, z -28..-20)
    wall(-4, -28, -4, -26); wall(-4, -24.4, -4, -20); lintel(-4, -26, -4, -24.4);
    wall(4, -28, 4, -26); wall(4, -24.4, 4, -20); lintel(4, -26, 4, -24.4);
    wall(-4, -20, -2, -20); wall(2, -20, 4, -20);
    wall(-4, -28, -0.8, -28); wall(0.8, -28, 4, -28); lintel(-0.8, -28, 0.8, -28);
    // 8 REST (x -12..-4, z -28..-22)
    wall(-12, -28, -4, -28); wall(-12, -22, -4, -22); wall(-12, -28, -12, -22);
    // 9 PARLOR (x 4..12, z -28..-22)
    wall(4, -28, 12, -28); wall(4, -22, 12, -22); wall(12, -28, 12, -22);
    // 10 OSSUARY OF RINGERS (x -5..5, z -36..-28)
    wall(-5, -36, -5, -28); wall(5, -36, 5, -28);
    wall(-5, -28, -4, -28); wall(4, -28, 5, -28);
    wall(-5, -36, -0.8, -36); wall(0.8, -36, 5, -36); lintel(-0.8, -36, 0.8, -36);
    // 11 GREAT BELL (x -8..8, z -52..-36)
    wall(-8, -52, -8, -36); wall(8, -52, 8, -36);
    wall(-8, -36, -5, -36); wall(5, -36, 8, -36);
    wall(-8, -52, -0.8, -52); wall(0.8, -52, 8, -52); lintel(-0.8, -52, 0.8, -52);
    // 12 ASCENT (x -3..3, z -60..-52)
    wall(-3, -60, -3, -52); wall(3, -60, 3, -52);
    wall(-3, -60, -0.8, -60); wall(0.8, -60, 3, -60); lintel(-0.8, -60, 0.8, -60);
    // 13 ROOST (x -10..2, z -68..-60)
    wall(-10, -68, 2, -68); wall(-10, -68, -10, -60);
    wall(-10, -60, -3, -60);
    wall(2, -68, 2, -66); wall(2, -64, 2, -60); lintel(2, -66, 2, -64);
    // 14 CARILLON (x 2..12, z -70..-60)
    wall(2, -70, 12, -70); wall(12, -70, 12, -60); wall(2, -60, 12, -60);
    // 15 CLOCK (corridor x 5..9 z 2..3.6; room x 9..19 z -2..8)
    wall(5, 2, 9, 2); wall(5, 3.6, 9, 3.6);
    wall(9, -2, 9, 2); wall(9, 3.6, 9, 8);
    wall(9, -2, 19, -2); wall(9, 8, 19, 8);
    wall(19, -2, 19, 2); wall(19, 4, 19, 8);
    wall(19, 2, 20.6, 2); wall(19, 4, 20.6, 4); wall(20.6, 2, 20.6, 4);

    /* ---------------------- ROOM DRESSING & FEATURES ------------------- */
    const q = (flag) => Boolean(story.get(flag));
    const pickupCtx = { root, story, inventory, events, updatables };

    // 1 NARTHEX: coiled rope, the first breath of the wing.
    add(kit.rubble({ position: [-2.2, 10], seed: 3, count: 4 }));
    add(kit.votives({ position: [2.3, 14.5], seed: 8 }));

    // 2 ROPE GALLERY: ropes from the dark above.
    const ropeMat = kit.material('woodPlanks', { color: 0x8a7458 });
    for (const [rx, rz, rh] of [[-3.5, 0.5, 3.6], [-1.5, 4, 2.8], [0.5, 1.5, 3.9], [2.5, 5.5, 3.1], [3.8, -0.5, 2.5], [-2.8, 6.5, 3.3]]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, rh, 5), ropeMat);
      rope.position.set(rx, H - rh / 2, rz);
      root.add(rope);
    }
    add(kit.corpse({ position: [3.6, 6.4], rotationY: 1.1 }));

    // 3 BELLFOUNDRY: the casting pit and a bell that never hung.
    const pit = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 12),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 1 }))
    );
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(-10.5, 0.02, 1);
    root.add(pit);
    const deadBell = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 1.6, 9),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x6a5a34, metalness: 0.5, roughness: 0.6 }))
    );
    deadBell.rotation.z = 1.2;
    deadBell.position.set(-7.5, 0.6, 4.2);
    root.add(deadBell);
    colliders.push(new THREE.Box3().setFromObject(deadBell));
    add(kit.rubble({ position: [-13, -2.5], seed: 21, count: 6, solid: true }));

    // 4 COUNTING HOUSE: tally shelves.
    for (const [sx, sz] of [[-3.4, -4], [-3.4, -7], [3.4, -4.5], [3.4, -7.5]]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 2.2), kit.material('woodPlanks', { color: 0x4a382a }));
      shelf.position.set(sx, 1.1, sz);
      root.add(shelf);
      colliders.push(new THREE.Box3().setFromObject(shelf));
    }

    // 5 CHOIR OF EARS: the lure lesson. The pull rings the refectory bell.
    const refectoryBellPos = new THREE.Vector3(11, 1, -16);
    let lureCooldown = 0;
    updatables.push({ update: (dt) => { lureCooldown = Math.max(0, lureCooldown - dt); } });
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 5), ropeMat);
    pull.position.set(1.55, H - 1.2, -11);
    root.add(pull);
    interactables.push({
      id: 'refectory-pull',
      position: new THREE.Vector3(1.55, 1, -11),
      radius: 1.3,
      prompt: 'Pull — a worn plate reads REFECTORY',
      onInteract: () => {
        if (lureCooldown > 0) {
          events.emit('ui/toast', { text: 'The rope is still swinging.' });
          return;
        }
        lureCooldown = 8;
        events.emit('audio/sfx', { id: 'bellToll' });
        events.emit('noise/emitted', { position: refectoryBellPos.clone(), radius: 24 });
        events.emit('ui/toast', { text: 'Somewhere east, a bell rings over an empty table. Feet begin to shuffle toward it.' });
      },
    });

    // 6 REFECTORY: thirteen places, one key.
    const table = new THREE.Mesh(new THREE.BoxGeometry(8, 0.85, 1.6), kit.material('woodPlanks', { color: 0x55402e }));
    table.position.set(8, 0.42, -16);
    root.add(table);
    colliders.push(new THREE.Box3().setFromObject(table));
    for (let i = 0; i < 13; i++) {
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.4), kit.material('woodPlanks', { color: 0x3e2e20 }));
      const side = i % 2 === 0 ? 1 : -1;
      chair.position.set(4.6 + Math.floor(i / 2) * 1.15, 0.45, -16 + side * 1.35);
      if (i === 12) chair.position.set(12.9, 0.45, -16); // the head seat
      chair.rotation.y = side > 0 ? Math.PI : 0;
      root.add(chair);
    }
    const wallBell = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.45, 8),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x6a5a34, metalness: 0.5, roughness: 0.6 }))
    );
    wallBell.position.set(11, 2.6, -19.6);
    root.add(wallBell);

    // 7 CHIME GARDEN: hanging chimes are noise tripwires. Footstep noise
    // inside a cluster makes the whole cluster sing — much louder.
    const chimeClusters = [new THREE.Vector3(-2, 0, -22.3), new THREE.Vector3(1.6, 0, -24.4), new THREE.Vector3(-1, 0, -26.6)];
    const chimeMat = kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x9a8a5a, metalness: 0.7, roughness: 0.35 }));
    for (const c of chimeClusters) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const chime = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5 + (i % 3) * 0.2, 4), chimeMat);
        chime.position.set(c.x + Math.cos(a) * 0.7, 2.4, c.z + Math.sin(a) * 0.7);
        root.add(chime);
      }
    }
    let chimeGuard = 0;
    updatables.push({ update: (dt) => { chimeGuard = Math.max(0, chimeGuard - dt); } });
    unsubs.push(
      events.on('noise/emitted', ({ position, radius, chime }) => {
        if (chime || chimeGuard > 0 || radius > 10) return; // only footfalls
        for (const c of chimeClusters) {
          if (position.distanceTo(c) < 1.25) {
            chimeGuard = 0.8;
            events.emit('audio/sfx', { id: 'casing' });
            events.emit('noise/emitted', { position: c.clone(), radius: 11, chime: true });
            return;
          }
        }
      })
    );

    // 8 WARDEN'S REST: the wing's safe room.
    add(kit.shrine({ position: [-11.2, -25], rotationY: Math.PI / 2 }));
    add(kit.slab({ center: [-8, -25], size: [7, 5], y: 0.01, texture: 'carpetRed', repeat: [3, 2] }));
    const cot = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.9), kit.material('woodPlanks', { color: 0x4a382a }));
    cot.position.set(-6, 0.2, -27.2);
    root.add(cot);
    colliders.push(new THREE.Box3().setFromObject(cot));
    interactables.push({
      id: 'rest-shrine',
      position: new THREE.Vector3(-11, 1, -25),
      radius: 1.5,
      prompt: 'Pray at the bones (save)',
      onInteract: () => events.emit('ui/open-save-menu'),
    });

    // 9 MOTHER ALDERS' PARLOR: a rocking chair, a mountain of knitted
    // bell-rope, and the happiest person left in Graven.
    add(kit.slab({ center: [8, -25], size: [7, 5], y: 0.01, texture: 'carpetRed', repeat: [3, 2] }));
    const ropePile = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.0, 0),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 1 }))
    );
    ropePile.scale.y = 0.6;
    ropePile.position.set(10.6, 0.5, -26.4);
    root.add(ropePile);
    colliders.push(new THREE.Box3().setFromObject(ropePile));
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.7), kit.material('woodPlanks', { color: 0x4a382a }));
    chair.position.set(8.4, 0.55, -25.6);
    root.add(chair);

    // 10 OSSUARY OF RINGERS: the hands that rang, cast in bronze.
    add(kit.reachingNiche({ position: [-4.85, -30], rotationY: Math.PI / 2 }));
    add(kit.reachingNiche({ position: [-4.85, -33], rotationY: Math.PI / 2 }));
    add(kit.reachingNiche({ position: [4.85, -31.5], rotationY: -Math.PI / 2 }));
    add(kit.urnNiche({ position: [0, -35.8], rotationY: 0 }));
    add(kit.rubble({ position: [3.4, -34.5], seed: 17, count: 5, solid: true }));

    // 11 THE GREAT BELL: the boss arena. Three pulls; the bell is the weapon.
    const greatBell = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 3.6, 10),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x7a6838, metalness: 0.6, roughness: 0.45 }))
    );
    greatBell.position.set(0, H - 1.4, -44);
    root.add(greatBell);
    let greatCooldown = 0;
    updatables.push({
      update: (dt) => {
        greatCooldown = Math.max(0, greatCooldown - dt);
        // The bell shivers after a toll.
        if (greatCooldown > 6) greatBell.rotation.z = Math.sin(greatCooldown * 30) * 0.04;
        else greatBell.rotation.z *= 0.95;
      },
    });
    for (const [px, pz] of [[-6.5, -38], [6.5, -38], [0, -50.5]]) {
      const bossPull = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.6, 5), ropeMat);
      bossPull.position.set(px, H - 1.3, pz);
      root.add(bossPull);
      interactables.push({
        id: `great-pull-${px}-${pz}`,
        position: new THREE.Vector3(px, 1, pz),
        radius: 1.4,
        prompt: 'PULL',
        onInteract: () => {
          if (greatCooldown > 0) {
            events.emit('ui/toast', { text: 'The Great Bell is still swallowing its last toll.' });
            return;
          }
          greatCooldown = 9;
          events.emit('audio/sfx', { id: 'bellToll' });
          events.emit('camera/impulse', { strength: 0.6 });
          events.emit('bell/great', {});
          events.emit('noise/emitted', { position: new THREE.Vector3(0, 0, -44), radius: 30, chime: true });
        },
      });
    }
    // The warden door out — barred until the Tolltaker kneels for good.
    const wardenDoor = kit.door({ position: [0, -52], width: 1.6, height: 2.6 });
    if (!q('tolltakerFelled')) {
      add(wardenDoor);
      updatables.push({
        update: () => {
          if (wardenDoor.object.parent && story.get('tolltakerFelled')) {
            wardenDoor.object.removeFromParent();
            for (const box of wardenDoor.colliders) {
              const i = colliders.indexOf(box);
              if (i !== -1) colliders.splice(i, 1);
            }
            physics.setStaticColliders(colliders);
            events.emit('audio/sfx', { id: 'doorUnlock' });
          }
        },
      });
    }

    // 12 ASCENT: the stairs that weren't here before.
    add(kit.stairsDown({ position: [1.8, -54], rotationY: Math.PI }));
    add(kit.rubble({ position: [-2.2, -58], seed: 9, count: 5 }));

    // 13 ROOST: bells nested like eggs.
    for (const [bx, bz, bs] of [[-8, -63, 0.5], [-6.5, -65.5, 0.7], [-4, -62.5, 0.4], [-7.8, -66.8, 0.35], [-3, -66, 0.6]]) {
      const egg = new THREE.Mesh(
        new THREE.ConeGeometry(bs, bs * 1.5, 8),
        kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x6a5a34, metalness: 0.5, roughness: 0.6 }))
      );
      egg.position.set(bx, bs * 0.75, bz);
      egg.rotation.z = (bx * 7 % 3) * 0.2;
      root.add(egg);
      colliders.push(new THREE.Box3().setFromObject(egg));
    }
    add(kit.wallStain({ position: [-9.9, -64], y: 2.2, rotationY: Math.PI / 2, size: 1.5, kind: 'damp' }));

    // 14 THE CARILLON: four hand-bells, one order, one stone.
    const BELL_ORDER = ['dirge', 'quarrel-elder', 'quarrel-younger', 'mercy'];
    const CARILLON_BELLS = [
      { id: 'dirge', label: 'DIRGE — cast 1740', x: 4, z: -62 },
      { id: 'quarrel-elder', label: 'QUARREL — cast 1781', x: 10, z: -62 },
      { id: 'quarrel-younger', label: 'QUARREL — cast 1793', x: 10, z: -68 },
      { id: 'mercy', label: 'MERCY — cast 1802', x: 4, z: -68 },
    ];
    let rung = [];
    for (const bell of CARILLON_BELLS) {
      const post = kit.pillar({ position: [bell.x, bell.z], radius: 0.14, height: 1.4, texture: 'woodPlanks' });
      add(post);
      const handBell = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.4, 8),
        kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x8a7a44, metalness: 0.6, roughness: 0.4 }))
      );
      handBell.position.set(bell.x, 1.55, bell.z);
      root.add(handBell);
      interactables.push({
        id: `carillon-${bell.id}`,
        position: new THREE.Vector3(bell.x, 1, bell.z),
        radius: 1.3,
        prompt: `Ring the bell — ${bell.label}`,
        canInteract: () => !q('carillonSolved'),
        onInteract: () => {
          events.emit('audio/sfx', { id: 'bellToll' });
          rung.push(bell.id);
          if (BELL_ORDER.slice(0, rung.length).join() !== rung.join()) {
            rung = [];
            events.emit('audio/sfx', { id: 'stingerDetect' });
            events.emit('ui/toast', { text: '“No,” says the room, in four dissonant voices at once. The order is lost.' });
            return;
          }
          if (rung.length === BELL_ORDER.length) {
            story.set('carillonSolved', true); // cutscene fires off this flag
          } else {
            events.emit('ui/toast', { text: `The note hangs in the air, approving. (${rung.length} of 4)` });
          }
        },
      });
    }
    // The stone rises at the center once the hymn is sung.
    const stonePedestal = kit.pillar({ position: [7, -65], radius: 0.3, height: 0.9, texture: 'stoneWall' });
    add(stonePedestal);
    const hourStone = makePickupMesh(kit, {
      position: new THREE.Vector3(7, 1.25, -65),
      color: 0xc9c2a8,
      emissive: 0x4a4632,
    });
    if (q('carillonSolved') && !q('took:carillon-stone')) root.add(hourStone);
    updatables.push({
      update: () => {
        if (!hourStone.parent && story.get('carillonSolved') && !story.get('took:carillon-stone')) {
          root.add(hourStone);
        }
        if (hourStone.parent) hourStone.rotation.y += 0.02;
      },
    });
    interactables.push({
      id: 'carillon-stone',
      position: new THREE.Vector3(7, 1, -65),
      radius: 1.3,
      prompt: 'Take the Stone of the Hour',
      canInteract: () => q('carillonSolved') && !q('took:carillon-stone'),
      onInteract: () => {
        if (inventory && !inventory.canFit('stoneOfTheHour')) {
          events.emit('ui/toast', { text: 'Your satchel is full. The Hour can wait. It is good at that.' });
          return;
        }
        inventory?.add('stoneOfTheHour');
        story.set('took:carillon-stone', true);
        hourStone.removeFromParent();
        events.emit('audio/sfx', { id: 'pickup' });
        events.emit('ui/toast', { text: 'Taken — THE STONE OF THE HOUR. It ticks against your ribs, politely.' });
      },
    });

    // 15 CLOCK ROOM (optional, ♠-locked): set the hands to the sleeping hour.
    let clockDoor = null;
    if (!q('clockDoorOpen')) {
      clockDoor = kit.door({ position: [5, 2.8], rotationY: Math.PI / 2, width: 1.4, height: 2.5 });
      add(clockDoor);
    }
    interactables.push({
      id: 'clock-door',
      position: new THREE.Vector3(4.6, 1, 2.8),
      radius: 1.5,
      prompt: () =>
        q('clockDoorOpen') ? 'The clock room' : inventory?.has('spadeKey') ? 'Unlock — the Spade door' : 'A spade is carved over the lock',
      canInteract: () => !q('clockDoorOpen'),
      onInteract: () => {
        if (!inventory?.has('spadeKey')) {
          events.emit('ui/toast', { text: 'Locked. The keyhole is shaped like a grave-spade. The refectory set thirteen places; one of them ate with keys.' });
          return;
        }
        story.set('clockDoorOpen', true);
        if (clockDoor) {
          clockDoor.object.removeFromParent();
          for (const box of clockDoor.colliders) {
            const i = colliders.indexOf(box);
            if (i !== -1) colliders.splice(i, 1);
          }
          physics.setStaticColliders(colliders);
        }
        events.emit('audio/sfx', { id: 'doorUnlock' });
        events.emit('ui/toast', { text: 'The spade key turns. Beyond, something enormous keeps imperfect time.' });
      },
    });
    // The clock face on the floor, and the hand you can move.
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 24),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.9 }))
    );
    face.rotation.x = -Math.PI / 2;
    face.position.set(14, 0.02, 3);
    root.add(face);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 3.0), kit.material('ironDark'));
    hand.position.set(14, 0.12, 3);
    root.add(hand);
    const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    let clockHour = 6; // starts wrong, of course
    const setHand = () => {
      hand.rotation.y = -clockHour * (Math.PI / 6);
      hand.position.set(14 + Math.sin(clockHour * (Math.PI / 6)) * 1.3, 0.12, 3 - Math.cos(clockHour * (Math.PI / 6)) * 1.3);
    };
    setHand();
    let vaultDoor = null;
    if (!q('clockVaultOpen')) {
      vaultDoor = kit.door({ position: [19, 3], rotationY: -Math.PI / 2, width: 1.9, height: 2.2 });
      add(vaultDoor);
    }
    interactables.push(
      {
        id: 'clock-hand',
        position: new THREE.Vector3(14, 1, 3),
        radius: 2.2,
        prompt: () => `Drag the hour hand (it reads ${ROMAN[clockHour % 12]})`,
        canInteract: () => !q('clockVaultOpen'),
        onInteract: () => {
          clockHour = (clockHour + 1) % 12;
          setHand();
          events.emit('audio/sfx', { id: 'uiMove' });
        },
      },
      {
        id: 'clock-strike',
        position: new THREE.Vector3(17.8, 1, 6.6),
        radius: 1.5,
        prompt: 'Pull the striking lever',
        canInteract: () => !q('clockVaultOpen'),
        onInteract: () => {
          if (clockHour === 3) {
            story.set('clockVaultOpen', true);
            if (vaultDoor) {
              vaultDoor.object.removeFromParent();
              for (const box of vaultDoor.colliders) {
                const i = colliders.indexOf(box);
                if (i !== -1) colliders.splice(i, 1);
              }
              physics.setStaticColliders(colliders);
            }
            events.emit('audio/sfx', { id: 'saveChime' });
            events.emit('ui/toast', { text: 'Three soft strikes — the sleeping hour. The works sigh open a little vault.' });
          } else {
            events.emit('audio/sfx', { id: 'stingerDetect' });
            events.emit('noise/emitted', { position: new THREE.Vector3(14, 0, 3), radius: 40, chime: true });
            events.emit('ui/toast', { text: 'The clock SHRIEKS the wrong hour through the whole wing. Everything with ears now knows exactly where the clock room is.' });
          }
        },
      }
    );

    /* ------------------------------ LOOT -------------------------------- */
    for (const pickup of [
      makeItemPickup(pickupCtx, {
        id: 'tower-linen',
        itemId: 'linenStrips',
        qty: 2,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-4.2, 0.35, 7), color: 0xc9bd9e, emissive: 0x4a4232 }),
        position: new THREE.Vector3(-4.2, 1, 7),
        prompt: 'Take the bell-polishing linen',
        flavor: 'Taken — LINEN STRIPS ×2, still smelling of brass.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'foundry-moss',
        itemId: 'mossPoultice',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-13.6, 0.35, 4.8), color: 0x6f7d4e, emissive: 0x2a3a1a }),
        position: new THREE.Vector3(-13.6, 1, 4.8),
        prompt: 'Take the founder’s kit',
        flavor: 'Taken — MOSS POULTICE, packed for burns that never came.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'refectory-key',
        itemId: 'spadeKey',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(12.9, 1.0, -16), color: 0x3a3a44, emissive: 0x30303a }),
        glowColor: 0xc9c2a8,
        position: new THREE.Vector3(12.9, 1, -16),
        prompt: 'Take the key from the head seat',
        flavor: 'Taken — SPADE KEY, set at the head place like cutlery.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'rest-tonic',
        itemId: 'graveTonic',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-7.8, 0.35, -23), color: 0x8a4a42, emissive: 0x3a1210 }),
        position: new THREE.Vector3(-7.8, 1, -23),
        prompt: 'Take the bedside bottle',
        flavor: 'Taken — GRAVE TONIC, left where a guest would find it.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'ossuary-shells',
        itemId: 'boneShells',
        qty: 6,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(3.2, 0.35, -34.2), color: 0xc9b37a, emissive: 0x4a3a10 }),
        position: new THREE.Vector3(3.2, 1, -34.2),
        prompt: 'Search the ringer’s effects',
        flavor: 'Taken — TALLOW ROUNDS ×6. Ringers were buried armed. Telling.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'roost-moss',
        itemId: 'graveMoss',
        qty: 2,
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(-8.8, 0.35, -61.5), color: 0x8fae72, emissive: 0x2a3a1a }),
        position: new THREE.Vector3(-8.8, 1, -61.5),
        prompt: 'Gather the roost moss',
        flavor: 'Taken — GRAVE MOSS ×2, growing on the warm side of the eggs.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'clock-draught',
        itemId: 'wardensDraught',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(19.9, 0.5, 2.7), color: 0x8a2a3a, emissive: 0x4a0a12 }),
        glowColor: 0xff9aa8,
        position: new THREE.Vector3(19.9, 1, 2.7),
        prompt: 'Take the vial from the vault',
        flavor: 'Taken — WARDEN’S DRAUGHT. The label is a single tally mark.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'clock-tonic',
        itemId: 'graveTonic',
        mesh: makePickupMesh(kit, { position: new THREE.Vector3(19.9, 0.5, 3.5), color: 0x8a4a42, emissive: 0x3a1210 }),
        position: new THREE.Vector3(19.9, 1, 3.5),
        prompt: 'Take the second bottle',
        flavor: 'Taken — GRAVE TONIC, from a vault that expected you thirstier.',
      }),
    ]) {
      if (pickup) interactables.push(pickup);
    }

    /* --------------------------- DOCUMENTS ----------------------------- */
    interactables.push(
      { id: 'doc-ringers', position: new THREE.Vector3(-3.3, 1, -5.6), radius: 1.3, prompt: 'Read the ringers’ roll', onInteract: () => readDocument(events, story, 'ringersRoll') },
      { id: 'doc-foundry', position: new THREE.Vector3(-9.5, 1, 1), radius: 1.5, prompt: 'Read the founder’s slate', onInteract: () => readDocument(events, story, 'foundryNote') },
      { id: 'doc-rest', position: new THREE.Vector3(-6, 1, -26.8), radius: 1.4, prompt: 'Read the guest log', onInteract: () => readDocument(events, story, 'wardensRestLog') },
      { id: 'doc-hymn', position: new THREE.Vector3(-1.2, 1, -67.2), radius: 1.4, prompt: 'Read the nailed-up hymn', onInteract: () => readDocument(events, story, 'hymnOfHours') },
      { id: 'doc-clock', position: new THREE.Vector3(10, 1, 6.8), radius: 1.5, prompt: 'Read the horologist’s plaque', onInteract: () => readDocument(events, story, 'clockPlaque') }
    );

    /* ---------------------------- MOTHER ALDERS ------------------------ */
    const npcCtx = { root, ps2: kit.ps2, events, updatables, colliders };
    interactables.push(
      makeNpc(npcCtx, {
        id: 'alders',
        name: 'Mother Alders',
        position: new THREE.Vector3(8.4, 0, -26.2),
        facing: -0.4,
        outfit: 'dress',
        hair: 'bun',
        build: 0.88,
        palette: { coat: 0x5a5266, skin: 0xcab092, skirt: 0x46404f, hair: 0xd8d4cc },
        lines: () => {
          if (q('carillonSolved'))
            return [
              'You SANG it! I heard every note through the floor — the low, the elder quarrel, the younger, and mercy last of all, the way it wants.',
              'Take the Hour and wind it gently, dear. And when you open that dreadful cage, tell the key Mother Alders says it can stop sulking.',
            ];
          if (q('tolltakerFelled'))
            return [
              'You RANG him! Oh, the house will talk about this for YEARS. He held that silence like a job, poor thing. Someone had to retire him.',
              'The carillon is past the roost. Four bells, one order. The hymn is nailed up there, but it sings it wrong on purpose — the tower thinks that’s funny. Low bell FIRST, dear. Always the low bell first.',
              'And the quarrels — there are two, they never agreed on anything, least of all which of them is older. The plaques know. Trust the plaques, not the quarrels.',
            ];
          return [
            'Sit! Sit. Mind the rope — it’s mostly hair. Donated. Everyone donates eventually, that’s what makes it a community.',
            'Mister Alders was a Ringer, you know. Forty years on the DIRGE. He’s in the wall now with the other hands. I knit near him so he can watch. He always did like to watch me work.',
            'You’ll be wanting the Hour, I expect. Everyone who climbs wants the Hour. First you’ll have to get past the big fellow under the Great Bell — deaf as cast bronze, bless him. Sound won’t fool him. But the BELL, dear. The bell is the one thing he still feels.',
            'The tower added this parlor for me in ’61. Grew it in a night, like a tooth. It knows what a lady needs. It’s a GOOD house, whatever the ground says.',
          ];
        },
      })
    );

    /* ---------------------------- LIGHTING ----------------------------- */
    root.add(new THREE.AmbientLight(0x2a2d3f, 2.3));
    root.add(new THREE.HemisphereLight(0x2e3346, 0x181210, 1.0));
    const shaft = new THREE.DirectionalLight(0x63719b, 1.2);
    shaft.position.set(6, 14, -20);
    shaft.target.position.set(0, 0, -30);
    shaft.castShadow = true;
    shaft.shadow.mapSize.set(1024, 1024);
    shaft.shadow.camera.left = -30;
    shaft.shadow.camera.right = 30;
    shaft.shadow.camera.top = 45;
    shaft.shadow.camera.bottom = -45;
    root.add(shaft, shaft.target);
    const flickers = [
      new FlickerLight({ position: new THREE.Vector3(0, 2.2, 12), intensity: 10, distance: 9 }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.4, 3), intensity: 11, distance: 10 }),
      new FlickerLight({ position: new THREE.Vector3(-10, 2.2, 1), intensity: 10, distance: 10, color: 0xd9803a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.2, -6), intensity: 9, distance: 8 }),
      new FlickerLight({ position: new THREE.Vector3(8, 2.4, -16), intensity: 9, distance: 9 }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.4, -24), intensity: 8, distance: 8, color: 0x9aa4c9 }),
      new FlickerLight({ position: new THREE.Vector3(-8, 2.0, -25), intensity: 10, distance: 8 }),
      new FlickerLight({ position: new THREE.Vector3(8.4, 1.6, -25.4), intensity: 10, distance: 8, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.2, -32), intensity: 8, distance: 9, color: 0x9fdc7a }),
      new FlickerLight({ position: new THREE.Vector3(0, 3.0, -44), intensity: 13, distance: 15, castShadow: true }),
      new FlickerLight({ position: new THREE.Vector3(-6, 2.2, -64), intensity: 9, distance: 9, color: 0x9aa4c9 }),
      new FlickerLight({ position: new THREE.Vector3(7, 2.4, -65), intensity: 11, distance: 10, color: 0xd9a05a }),
      new FlickerLight({ position: new THREE.Vector3(14, 2.6, 3), intensity: 10, distance: 10, color: 0x9aa4c9 }),
    ];
    for (const f of flickers) {
      root.add(f.light);
      updatables.push(f);
    }
    const fog1 = new FogCards({ center: [0, -44], size: [16, 16], count: 4, opacity: 0.08 });
    const fog2 = new FogCards({ center: [0, -24], size: [8, 8], count: 3, opacity: 0.06 });
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
          targetSpawn: 'fromBellTower',
        }
      )
    );

    /* -------------------------- CAMERA ZONES --------------------------- */
    const cameraZones = [
      defineCameraZone({ id: 'narthex', min: [-3, -1, 8], max: [3, 4, 16], camera: [2.4, 2.6, 9], trackTarget: true, trackStiffness: 3.5, rollDeg: -2, fovOverride: 58 }),
      defineCameraZone({ id: 'gallery', min: [-5, -1, -2], max: [5, 4, 8], camera: [-4.2, 3.0, 6.8], trackTarget: true, trackStiffness: 3, fovOverride: 60 }),
      defineCameraZone({ id: 'foundry', min: [-15, -1, -4], max: [-5, 4, 6], camera: [-6, 3.2, 5.2], trackTarget: true, trackStiffness: 3, rollDeg: 3, fovOverride: 60 }),
      defineCameraZone({ id: 'counting', min: [-4, -1, -10], max: [4, 4, -2], camera: [3.2, 2.2, -3], trackTarget: true, trackStiffness: 3.5, fovOverride: 56 }),
      defineCameraZone({ id: 'choir', min: [-2, -1, -20], max: [2, 4, -10], camera: [0, 2.4, -10.4], lookAt: [0, 1.1, -20], fovOverride: 48 }),
      defineCameraZone({ id: 'refectory', min: [2, -1, -20], max: [14, 4, -12], camera: [3, 2.8, -13], trackTarget: true, trackStiffness: 3, rollDeg: -3, fovOverride: 58 }),
      defineCameraZone({ id: 'chimes', min: [-4, -1, -28], max: [4, 4, -20], camera: [-3.2, 3.1, -20.6], trackTarget: true, trackStiffness: 2.8, fovOverride: 62 }),
      defineCameraZone({ id: 'rest', min: [-12, -1, -28], max: [-4, 4, -22], camera: [-4.6, 2.2, -22.6], lookAt: [-9.5, 1.0, -26], fovOverride: 54 }),
      defineCameraZone({ id: 'parlor', min: [4, -1, -28], max: [12, 4, -22], camera: [4.8, 2.0, -22.5], lookAt: [9, 1.0, -26], fovOverride: 56 }),
      defineCameraZone({ id: 'ringers', min: [-5, -1, -36], max: [5, 4, -28], camera: [4.2, 1.6, -29], trackTarget: true, trackStiffness: 3, rollDeg: 4, fovOverride: 60 }),
      defineCameraZone({ id: 'greatbell', min: [-8, -1, -52], max: [8, 4, -36], camera: [-7, 3.4, -37.4], trackTarget: true, trackStiffness: 2.6, fovOverride: 64 }),
      defineCameraZone({ id: 'ascent', min: [-3, -1, -60], max: [3, 4, -52], camera: [0, 2.6, -52.6], lookAt: [0, 1.4, -60], rollDeg: -4, fovOverride: 50 }),
      defineCameraZone({ id: 'roost', min: [-10, -1, -68], max: [2, 4, -60], camera: [1.2, 2.8, -60.6], trackTarget: true, trackStiffness: 3, fovOverride: 60 }),
      defineCameraZone({ id: 'carillon', min: [2, -1, -70], max: [12, 4, -60], camera: [2.8, 2.9, -60.8], trackTarget: true, trackStiffness: 2.8, rollDeg: 2, fovOverride: 58 }),
      defineCameraZone({ id: 'clock', min: [5, -1, -2], max: [19, 4, 8], camera: [9.8, 3.2, 7], trackTarget: true, trackStiffness: 3, fovOverride: 60 }),
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
        { type: 'husk', variant: 'listener', position: new THREE.Vector3(-11, 0, 0), homeRadius: 4 },
        { type: 'husk', variant: 'listener', position: new THREE.Vector3(-0.8, 0, -13.5), homeRadius: 3 },
        { type: 'husk', variant: 'listener', position: new THREE.Vector3(0.8, 0, -16.5), homeRadius: 3 },
        { type: 'husk', variant: 'listener', position: new THREE.Vector3(-2.5, 0, -25), homeRadius: 3.5 },
        { type: 'husk', variant: 'listener', position: new THREE.Vector3(0, 0, -31), homeRadius: 3.5 },
        { type: 'husk', variant: 'listener', position: new THREE.Vector3(-3.4, 0, -33.5), homeRadius: 3.5 },
        { type: 'tolltaker', position: new THREE.Vector3(0, 0, -44) },
        { type: 'husk', variant: 'listener', position: new THREE.Vector3(-6, 0, -64), homeRadius: 4 },
      ],
      fog: { color: 0x0a0c11, density: 0.05 },
      ambientTrack: 'tower',
      surfaces: { default: 'stone', regions: [] },
      cinematics: [
        { when: 'mapSeen:bell-tower:parlor', seen: 'cine:alders', script: ALDERS_SCRIPT },
        { when: 'mapSeen:bell-tower:greatbell', seen: 'cine:tolltaker', script: TOLLTAKER_SCRIPT },
        { when: 'carillonSolved', seen: 'cine:carillon', script: CARILLON_SCRIPT },
      ],
      roomComments: {
        'mapSeen:bell-tower:narthex':
          '…This tower is wider inside than the church that holds it. I decide not to do the math again.',
        'mapSeen:bell-tower:refectory':
          '…Thirteen places set, the bread gone to stone. Nobody ever left this table hungry. Or at all.',
        'mapSeen:bell-tower:ascent':
          '…These stairs were not here a minute ago. The church isn’t old. It’s still GROWING.',
      },
      map: {
        rooms: [
          { id: 'narthex', label: 'Tower Narthex', min: [-3, 8], max: [3, 16] },
          { id: 'gallery', label: 'Rope Gallery', min: [-5, -2], max: [5, 8] },
          { id: 'foundry', label: 'Bellfoundry', min: [-15, -4], max: [-5, 6] },
          { id: 'counting', label: 'Counting House', min: [-4, -10], max: [4, -2] },
          { id: 'choir', label: 'Choir of Ears', min: [-2, -20], max: [2, -10] },
          { id: 'refectory', label: 'Refectory', min: [2, -20], max: [14, -12] },
          { id: 'chimes', label: 'Chime Garden', min: [-4, -28], max: [4, -20] },
          { id: 'rest', label: 'Warden’s Rest', min: [-12, -28], max: [-4, -22] },
          { id: 'parlor', label: 'Alders’ Parlor', min: [4, -28], max: [12, -22] },
          { id: 'ringers', label: 'Ossuary of Ringers', min: [-5, -36], max: [5, -28] },
          { id: 'greatbell', label: 'The Great Bell', min: [-8, -52], max: [8, -36] },
          { id: 'ascent', label: 'The Ascent', min: [-3, -60], max: [3, -52] },
          { id: 'roost', label: 'The Roost', min: [-10, -68], max: [2, -60] },
          { id: 'carillon', label: 'The Carillon', min: [2, -70], max: [12, -60] },
          { id: 'clock', label: 'Clock Room', min: [5, -2], max: [19, 8] },
        ],
        markers: [
          { type: 'shrine', position: [-11.2, -25] },
          { type: 'door', position: [0, 16] },
          { type: 'door', position: [5, 2.8] },
        ],
      },
    };
  },
};
