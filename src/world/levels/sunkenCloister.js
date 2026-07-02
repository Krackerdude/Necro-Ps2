import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { FlickerLight } from '../effects/FlickerLight.js';
import { FogCards } from '../effects/FogCards.js';
import { createInstancedScatter } from '../../rendering/instancing/InstancedScatter.js';
import { makeItemPickup, makeTransition, makePickupMesh } from './levelHelpers.js';
import { buildWeaponModel } from '../../assets/models/weaponModels.js';
import { readDocument } from '../../gameplay/story/documents.js';

/**
 * THE SUNKEN CLOISTER — level 2.
 *
 * A square covered walk around a flooded garth (garden court), buried under
 * the chapel. The congregation's dead were "planted" here; several are still
 * up and walking.
 *
 *            z=-10 ┌─────────── north walk ───────────┐ stairs up (NE)
 *                  │  ┌─────── balustrade ─────────┐  │   → chapel crypt
 *   SCRIPTORIUM    │  │                            │  │
 *   (save room) ═══╡  │      FLOODED GARTH         │  │
 *                  │  │   (verdigris key, husk)    │  │
 *                  │  └────────────────────────────┘  │
 *            z=+10 └──── south walk ── GATE ──────────┘
 *                              (locked → ossuary)
 *
 * Beats: wade into the black water for the Verdigris Key while husks patrol
 * the walks; the revolver is on a body that almost made it to the gate.
 */
const WALL_H = 3.5;
const WALK_CEIL = 2.9;

export const SUNKEN_CLOISTER = {
  id: 'sunken-cloister',
  name: 'The Sunken Cloister',

  build({ kit, story, inventory, events }) {
    const root = new THREE.Group();
    const colliders = [];
    const updatables = [];
    const interactables = [];

    const add = (piece) => {
      root.add(piece.object);
      colliders.push(...piece.colliders);
      return piece.object;
    };
    const pickupCtx = { root, story, inventory, events, updatables };

    /* ----------------------------- FLOORS ------------------------------ */
    // Walks: stone. Garth: bone-dust mud under standing water.
    add(kit.slab({ center: [0, 0], size: [20, 20], y: 0, texture: 'stoneFloor', repeat: [10, 10] }));
    add(kit.slab({ center: [0, 0], size: [10.4, 10.4], y: 0.02, texture: 'boneDust', repeat: [6, 6] }));
    add(kit.water({ center: [0, 0], size: [10.2, 10.2], y: 0.09 }));

    // Ceiling over the walks only — the garth is open to a buried "sky".
    for (const [center, size] of [
      [[0, -7.5], [20, 5]],
      [[0, 7.5], [20, 5]],
      [[-7.5, 0], [5, 10]],
      [[7.5, 0], [5, 10]],
    ]) {
      add(kit.slab({ center, size, y: WALK_CEIL, texture: 'plasterRot', flip: true }));
    }

    /* ----------------------------- WALLS ------------------------------- */
    add(kit.wall({ from: [-10, -10], to: [10, -10], height: WALL_H }));
    // South wall with the ossuary gate gap (x -1..1).
    add(kit.wall({ from: [-10, 10], to: [-1, 10], height: WALL_H }));
    add(kit.wall({ from: [1, 10], to: [10, 10], height: WALL_H }));
    add(kit.wall({ from: [10, -10], to: [10, 10], height: WALL_H }));
    // West wall with scriptorium door gap (z -0.7..0.7).
    add(kit.wall({ from: [-10, -10], to: [-10, -0.7], height: WALL_H }));
    add(kit.wall({ from: [-10, 0.7], to: [-10, 10], height: WALL_H }));

    /* --------------------- BALUSTRADE + COLONNADE ---------------------- */
    // Low parapet around the garth, one gap per side to step through.
    const parapet = (from, to) =>
      add(kit.wall({ from, to, height: 0.85, thickness: 0.25, texture: 'stoneWall', repeat: [3, 0.5] }));
    parapet([-5, -5], [-1, -5]);
    parapet([1, -5], [5, -5]);
    parapet([-5, 5], [-1, 5]);
    parapet([1, 5], [5, 5]);
    parapet([-5, -5], [-5, -1]);
    parapet([-5, 1], [-5, 5]);
    parapet([5, -5], [5, -1]);
    parapet([5, 1], [5, 5]);

    for (const [x, z] of [
      [-5, -5], [-1.6, -5], [1.6, -5], [5, -5],
      [-5, 5], [-1.6, 5], [1.6, 5], [5, 5],
      [-5, -1.6], [-5, 1.6], [5, -1.6], [5, 1.6],
    ]) {
      add(kit.pillar({ position: [x, z], radius: 0.28, height: WALK_CEIL }));
    }

    /* -------------------------- SCRIPTORIUM ---------------------------- */
    add(kit.slab({ center: [-13, 0], size: [6, 6], y: 0, texture: 'woodPlanks', repeat: [3, 3] }));
    add(kit.slab({ center: [-13, 0], size: [6, 6], y: 2.6, texture: 'plasterRot', flip: true }));
    add(kit.wall({ from: [-16, -3], to: [-10, -3], height: 2.6, texture: 'plasterRot' }));
    add(kit.wall({ from: [-16, 3], to: [-10, 3], height: 2.6, texture: 'plasterRot' }));
    add(kit.wall({ from: [-16, -3], to: [-16, 3], height: 2.6, texture: 'plasterRot' }));
    add(kit.shrine({ position: [-15.2, 0], rotationY: Math.PI / 2 }));
    add(kit.pew({ position: [-12.4, -1.9], rotationY: 0.25, width: 1.8 }));
    add(kit.rubble({ position: [-11, 2.3], seed: 41, count: 5 }));

    /* --------------------------- SET DRESSING --------------------------- */
    // Sunken grave markers poking out of the water (instanced).
    const grave = kit.gravestoneTemplate();
    root.add(
      createInstancedScatter(grave.geometry, grave.material, [
        { position: new THREE.Vector3(-2.8, -0.25, -2.2), rotationY: 0.5, scale: 0.9 },
        { position: new THREE.Vector3(2.2, -0.35, -1.4), rotationY: -0.4 },
        { position: new THREE.Vector3(-1.4, -0.3, 2.6), rotationY: 0.2, scale: 1.1 },
        { position: new THREE.Vector3(3.1, -0.2, 2.9), rotationY: -0.8, scale: 0.8 },
        { position: new THREE.Vector3(0.4, -0.4, -3.3), rotationY: 1.1, scale: 0.95 },
      ], { castShadow: true })
    );
    // Signature landmark: a coffin half-swallowed by the garth, nose down
    // where the ground gave way — visible from the overhead god-shot.
    add(kit.sunkenCoffin({ position: [2.2, -2.0], rotationY: 0.55 }));
    // A doorway someone boarded shut in a hurry (north walk).
    add(kit.boardedDoorway({ position: [-4.2, -9.8], rotationY: 0 }));
    // Banners flanking the ossuary gate — this door MATTERS.
    add(kit.banner({ position: [-2.4, 9.8], rotationY: Math.PI, y: 3.3 }));
    add(kit.banner({ position: [2.4, 9.8], rotationY: Math.PI, y: 3.3 }));
    // Scriptorium: candelabra by the shrine, urn niche in the north walk.
    add(kit.candelabra({ position: [-14.4, 2.3] }));
    add(kit.urnNiche({ position: [3.5, -9.8], rotationY: 0 }));
    // Damp rot everywhere the water reaches.
    add(kit.wallStain({ position: [9.8, -1.5], y: 1.2, rotationY: -Math.PI / 2, size: 1.6, kind: 'damp' }));
    add(kit.wallStain({ position: [-9.8, 2.8], y: 1.1, rotationY: Math.PI / 2, size: 1.5, kind: 'damp' }));
    add(kit.wallStain({ position: [-6.5, 9.8], y: 1.4, rotationY: Math.PI, size: 1.3, kind: 'damp' }));
    add(kit.votives({ position: [-1.4, 8.9], seed: 19 }));

    // The sundial the key rests on, dead center.
    add(kit.pillar({ position: [0, 0], radius: 0.3, height: 1.0, texture: 'stoneWall' }));
    // Bodies: one at the gate (revolver), one slumped in the north walk.
    add(kit.corpse({ position: [1.8, 8.6], rotationY: -1.9 }));
    add(kit.corpse({ position: [-6.2, -7.9], rotationY: 0.7 }));
    add(kit.rubble({ position: [8.6, 8.7], seed: 57, count: 7 }));
    // The door back up to the chapel crypt — a real door, always shut
    // (it creaks a crack open on travel).
    const chapelDoor = kit.door({ position: [8.6, -9.8], width: 1.6, height: 2.4 });
    add(chapelDoor);

    /* ----------------------------- LIGHTING ----------------------------- */
    root.add(new THREE.AmbientLight(0x252a38, 2.0));
    root.add(new THREE.HemisphereLight(0x2c3450, 0x10120e, 1.0));
    // Cold shaft over the open garth.
    const moon = new THREE.DirectionalLight(0x6a7ba8, 2.2);
    moon.position.set(3, 12, -2);
    moon.target.position.set(0, 0, 0);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -16;
    moon.shadow.camera.right = 16;
    moon.shadow.camera.top = 16;
    moon.shadow.camera.bottom = -16;
    root.add(moon, moon.target);

    const flickers = [
      new FlickerLight({ position: new THREE.Vector3(-7.5, 2.2, -7.5), intensity: 10, distance: 8, color: 0xb9c4de }),
      new FlickerLight({ position: new THREE.Vector3(7.5, 2.2, 7.5), intensity: 10, distance: 8, color: 0xb9c4de }),
      new FlickerLight({ position: new THREE.Vector3(-15, 1.3, 0), intensity: 13, distance: 8 }),
      new FlickerLight({ position: new THREE.Vector3(0.2, 1.6, 9.4), intensity: 8, distance: 6 }),
    ];
    for (const f of flickers) {
      root.add(f.light);
      updatables.push(f);
    }

    const mist = new FogCards({ center: [0, 0], size: [20, 20], count: 4, opacity: 0.1, color: 0x7f8fa0, height: 0.6 });
    root.add(mist.object);
    updatables.push(mist);

    /* ----------------------- GATE (to the ossuary) ---------------------- */
    // The gate NEVER opens visually — it's the door you travel "through"
    // via the fade, RE-style. It always blocks movement so the wall gap
    // can't leak into the void. Behind it, a black depth plane sells the
    // descending passage beyond the bars.
    const gate = kit.gate({ position: [0, 10], width: 2.0 });
    add(gate);
    const gateDark = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 3),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    gateDark.position.set(0, 1.5, 10.4);
    gateDark.rotation.y = Math.PI;
    root.add(gateDark);
    // ...and its collider, since the wall gap is wider than the bars.
    colliders.push(new THREE.Box3(new THREE.Vector3(-1.2, 0, 10.1), new THREE.Vector3(1.2, 3, 10.6)));
    // Lintel above the gate: the bars stop at 2.6 under a 3.5 wall.
    add(kit.wall({ from: [-1, 10], to: [1, 10], height: WALL_H - 2.6, yBase: 2.6 }));

    /* --------------------------- INTERACTABLES -------------------------- */
    interactables.push(
      // Back up to the chapel crypt (NE corner stairs).
      makeTransition(
        { story, inventory, events },
        {
          id: 'stairs-to-chapel',
          position: new THREE.Vector3(8.6, 1, -8.6),
          prompt: 'Climb back to the crypt',
          targetLevel: 'chapel-of-the-hollow',
          targetSpawn: 'fromCloister',
          door: chapelDoor.object,
        }
      ),
      {
        id: 'ossuary-gate',
        position: new THREE.Vector3(0, 1, 9.3),
        radius: 1.6,
        prompt: () =>
          story.get('cloisterGateOpen')
            ? 'Enter the ossuary'
            : inventory?.has('verdigrisKey')
              ? 'Unlock the gate'
              : 'Inspect the gate',
        onInteract: () => {
          if (!story.get('cloisterGateOpen')) {
            if (!inventory?.has('verdigrisKey')) {
              events.emit('ui/toast', {
                text: 'Barred. Green bronze, older than the chapel above. The keyhole weeps.',
              });
              return;
            }
            story.set('cloisterGateOpen', true);
            events.emit('audio/sfx', { id: 'doorUnlock' });
            events.emit('ui/toast', { text: 'The verdigris key turns. Something below stops humming.' });
            return;
          }
          events.emit('level/transition', { levelId: 'ossuary-of-the-hollow', spawn: 'fromCloister' });
        },
      },
      {
        id: 'scriptorium-shrine',
        position: new THREE.Vector3(-15, 1, 0),
        radius: 1.5,
        prompt: 'Pray at the bones (save)',
        onInteract: () => events.emit('ui/open-save-menu'),
      },
      {
        id: 'planting-ledger',
        position: new THREE.Vector3(-12.4, 1, -1.9),
        radius: 1.2,
        prompt: 'Read the planting ledger',
        onInteract: () => readDocument(events, story, 'plantingLedger'),
      }
    );

    /* ------------------------------ LOOT -------------------------------- */
    for (const pickup of [
      makeItemPickup(pickupCtx, {
        id: 'cloister-revolver',
        itemId: 'boneRevolver',
        mesh: (() => {
          const model = buildWeaponModel('boneRevolver', kit.ps2);
          model.scale.setScalar(2.4); // reads at pickup distance
          model.rotation.z = Math.PI / 2.3; // barrel presented sideways
          model.position.set(1.8, 0.35, 8.4);
          return model;
        })(),
        glowColor: 0xd0dcff,
        position: new THREE.Vector3(1.8, 1, 8.4),
        prompt: 'Take the revolver from the body',
        flavor: 'Taken — OSSUARY REVOLVER. His hand did not want to give it up.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'cloister-shells-north',
        itemId: 'boneShells',
        qty: 6,
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(-6.2, 0.3, -7.6),
          color: 0xc9b37a,
          emissive: 0x4a3a10,
        }),
        position: new THREE.Vector3(-6.2, 1, -7.6),
        prompt: 'Search the body',
        flavor: 'Taken — TALLOW ROUNDS ×6, dry in a wax-paper fold.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'cloister-key',
        itemId: 'verdigrisKey',
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(0, 1.15, 0),
          color: 0x5a8a6a,
          emissive: 0x1a4a2a,
        }),
        position: new THREE.Vector3(0, 1, 0),
        prompt: 'Take the Verdigris Key',
        flavor: 'Taken — VERDIGRIS KEY, cold from the water. The garth goes quiet.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'scriptorium-tonic',
        itemId: 'graveTonic',
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(-14.4, 0.6, 1.8),
          color: 0x9e1616,
          emissive: 0x4a0a0a,
        }),
        position: new THREE.Vector3(-14.4, 1, 1.8),
        prompt: 'Take the grave tonic',
        flavor: 'Taken — GRAVE TONIC. The cork is sealed with red wax.',
      }),
    ]) {
      if (pickup) interactables.push(pickup);
    }

    /* --------------------------- CAMERA ZONES --------------------------- */
    const cameraZones = [
      // One-point down the north walk, colonnade as left-frame rhythm.
      defineCameraZone({
        id: 'north-walk',
        min: [-10, -1, -10],
        max: [10, 3, -5],
        camera: [-9.2, 1.6, -7.4],
        lookAt: [9.5, 1.0, -7.6],
        fovOverride: 50,
      }),
      // East walk: high corner surveillance, slight dutch.
      defineCameraZone({
        id: 'east-walk',
        min: [5, -1, -5],
        max: [10, 3, 5],
        camera: [9.3, 2.6, -4.4],
        trackTarget: true,
        trackStiffness: 3.5,
        rollDeg: -4,
      }),
      // South walk: floor-level shot past the gate corpse.
      defineCameraZone({
        id: 'south-walk',
        min: [-10, -1, 5],
        max: [10, 3, 10],
        camera: [-8.8, 1.0, 8.9],
        lookAt: [9, 1.2, 7.8],
        fovOverride: 52,
        rollDeg: 2,
      }),
      // West walk: tracking mount above the scriptorium door.
      defineCameraZone({
        id: 'west-walk',
        min: [-10, -1, -5],
        max: [-5, 3, 5],
        camera: [-9.4, 2.5, 4.6],
        trackTarget: true,
        trackStiffness: 4,
      }),
      // The garth: near-overhead god shot. Wading should feel watched.
      defineCameraZone({
        id: 'garth',
        min: [-5, -1, -5],
        max: [5, 3, 5],
        camera: [1.5, 7.2, 1.8],
        trackTarget: true,
        trackStiffness: 2.5,
        fovOverride: 58,
        priority: 1,
      }),
      defineCameraZone({
        id: 'scriptorium',
        min: [-16, -1, -3],
        max: [-10, 3, 3],
        camera: [-10.6, 2.2, 2.5],
        lookAt: [-14.8, 0.7, -0.4],
      }),
    ];

    return {
      root,
      colliders,
      cameraZones,
      interactables,
      updatables,
      spawn: { position: new THREE.Vector3(8.6, 0, -8), rotationY: Math.PI },
      spawnPoints: {
        fromChapel: { position: new THREE.Vector3(8.6, 0, -8), rotationY: Math.PI },
        fromOssuary: { position: new THREE.Vector3(0, 0, 8.8), rotationY: Math.PI },
      },
      enemySpawns: [
        // In the black water of the garth: something without legs.
        { type: 'husk', variant: 'crawler', position: new THREE.Vector3(-2.5, 0, 1.5), homeRadius: 4 },
        { type: 'husk', position: new THREE.Vector3(7.6, 0, 2.5), homeRadius: 5 },
        // Facing the ossuary gate, perfectly still, until you come for it.
        {
          type: 'husk',
          variant: 'watcher',
          facing: Math.PI,
          position: new THREE.Vector3(-2.2, 0, 8.6),
          homeRadius: 6,
        },
      ],
      fog: { color: 0x0b0e14, density: 0.05 },
      ambientTrack: 'cloister',
      surfaces: {
        default: 'stone',
        regions: [
          { min: [-5.1, -5.1], max: [5.1, 5.1], type: 'water' }, // flooded garth
          { min: [-16, -3], max: [-10, 3], type: 'wood' },       // scriptorium
        ],
      },
    };
  },
};
