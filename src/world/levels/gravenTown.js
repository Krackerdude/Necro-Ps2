import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { makeNpc } from './levelHelpers.js';

/**
 * GRAVEN — the harbor town, by day. PHASE A SHELL.
 *
 * This is deliberately a proving ground, not the final town: one square, a
 * fountain, a ring of facades, warm dusk light, and three talkable
 * townsfolk. It exists so the dialogue system, NPC entity, exploration HUD
 * mode, and daytime lighting can be verified end to end before Phase B
 * builds the real town (docks, lighthouse, church hill, inn, 12–15 NPCs).
 *
 * Layout (top-down, +x east, +z south):
 *
 *        z=-11 ┌── bakery ── houses ──┐
 *              │                      │
 *    houses    │       SQUARE         │   houses
 *              │      (fountain)      │
 *        z=+11 └──── harbor edge ─────┘
 *                    (sea beyond)
 */

const FACADE_H = 4.2;

export const GRAVEN_TOWN = {
  id: 'graven-town',
  name: 'Graven',

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

    /* ---------------------------- THE SQUARE --------------------------- */
    add(kit.slab({ center: [0, 0], size: [26, 22], y: 0, texture: 'stoneFloor', repeat: [13, 11] }));

    // Perimeter facades. North row holds the bakery; the south edge is the
    // harbor wall with the sea beyond it.
    add(kit.wall({ from: [-13, -11], to: [13, -11], height: FACADE_H, texture: 'plasterRot' }));
    add(kit.wall({ from: [-13, -11], to: [-13, 11], height: FACADE_H, texture: 'plasterRot' }));
    add(kit.wall({ from: [13, -11], to: [13, 11], height: FACADE_H, texture: 'plasterRot' }));
    // Harbor edge: waist-high sea wall, not a building.
    add(kit.wall({ from: [-13, 11], to: [13, 11], height: 1.0, texture: 'stoneWall' }));

    // The sea. Decorative — the sea wall keeps you out of it.
    root.add(kit.water({ center: [0, 16], size: [30, 10], y: -0.15 }).object);

    // Facade dressing: doors and window shutters so the walls read as homes.
    for (const [x, z, rotY] of [
      [-6, -10.85, 0],
      [0, -10.85, 0],
      [6, -10.85, 0],
      [-12.85, -3, Math.PI / 2],
      [-12.85, 4, Math.PI / 2],
      [12.85, -3, -Math.PI / 2],
      [12.85, 4, -Math.PI / 2],
    ]) {
      add(kit.door({ position: [x, z], rotationY: rotY, width: 1.3, height: 2.4 }));
    }
    // Awning posts by the bakery door — the closest thing to a shopfront.
    add(kit.pillar({ position: [-7, -9.8], radius: 0.12, height: 2.6, texture: 'woodPlanks' }));
    add(kit.pillar({ position: [-5, -9.8], radius: 0.12, height: 2.6, texture: 'woodPlanks' }));
    add(kit.banner({ position: [-6, -10.8], rotationY: 0, y: 3.4 }));

    /* ---------------------------- FOUNTAIN ----------------------------- */
    const basin = add(kit.pillar({ position: [0, 0], radius: 1.7, height: 0.6, texture: 'stoneWall' }));
    basin.position.y = 0.3;
    const spire = add(kit.pillar({ position: [0, 0], radius: 0.28, height: 2.0, texture: 'stoneWall' }));
    spire.position.y = 1.0;
    const pool = kit.water({ center: [0, 0], size: [2.8, 2.8], y: 0.62 });
    root.add(pool.object);

    // Benches around the fountain (pews, in their honest daylight job).
    add(kit.pew({ position: [-3.4, 0], rotationY: Math.PI / 2 }));
    add(kit.pew({ position: [3.4, 0], rotationY: -Math.PI / 2 }));
    add(kit.pew({ position: [0, 3.4], rotationY: 0 }));

    // Crates and clutter near the harbor edge.
    add(kit.rubble({ position: [9.5, 9.2], seed: 12, count: 5, solid: true }));
    add(kit.rubble({ position: [-10.4, 8.6], seed: 41, count: 4, solid: true }));
    add(kit.votives({ position: [-11.9, -9.4], seed: 5 }));

    /* ---------------------------- LIGHTING ----------------------------- */
    // Dusk, but a kind one: low golden sun, blue sky fill, warm bounce.
    root.add(new THREE.AmbientLight(0x9a8878, 2.2));
    root.add(new THREE.HemisphereLight(0x87a3c9, 0xa07850, 1.6));

    const sun = new THREE.DirectionalLight(0xffc27d, 3.2);
    sun.position.set(-16, 9, 10);
    sun.target.position.set(4, 0, -4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    root.add(sun, sun.target);

    /* ---------------------------- TOWNSFOLK ---------------------------- */
    const npcCtx = { root, ps2: kit.ps2, events, updatables, colliders };

    interactables.push(
      makeNpc(npcCtx, {
        id: 'baker',
        name: 'Rosa, the baker',
        position: new THREE.Vector3(-6, 0, -8.6),
        facing: Math.PI, // faces the square from her doorway
        palette: { coat: 0xc9b78a, skin: 0xd0a888, legs: 0x6a4a3a },
        lines: [
          'Off the evening boat, are you? You have the look — half salt, half paper.',
          'We don’t get visitors past midsummer. The last one was... oh, must be near a year now. Tall fellow. Kept a camera on a strap.',
          'If you’re staying the night, tell the inn Rosa sent you, and take bread up with you. The kitchen fire goes out when the church bell stops.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'harbormaster',
        name: 'Aldous, harbormaster',
        position: new THREE.Vector3(8.4, 0, 8.2),
        facing: -Math.PI / 2,
        palette: { coat: 0x3a4a5c, skin: 0xb89878, legs: 0x2a2a30 },
        lines: [
          'Mind the sea wall. Tide comes up fast after dark, and nobody swims here. Nobody has for years.',
          'Your boat’s the last in until Thursday. Whatever business you came for, you’ve got the week for it.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'widow',
        name: 'Maren',
        position: new THREE.Vector3(-2.2, 0, 3.9),
        facing: 0,
        palette: { coat: 0x4a3a4c, skin: 0xc9a68a, legs: 0x3a3a44 },
        lines: [
          'I sit here every evening. The fountain used to run clear as glass. Now look at it.',
          'You hear the bell at dusk? Everyone goes in when it rings. You should too. It’s only... custom. Old custom.',
        ],
      })
    );

    /* -------------------------- INTERACTABLES -------------------------- */
    interactables.push({
      id: 'fountain',
      position: new THREE.Vector3(0, 1, 2.2),
      radius: 1.6,
      prompt: 'Look into the fountain',
      onInteract: () => {
        events.emit('ui/toast', { text: 'The water is dark for such a bright evening. Coins down there, none of them silver.' });
      },
    });

    void story;
    void inventory;

    /* -------------------------- CAMERA ZONES --------------------------- */
    const cameraZones = [
      // Arrival wide: high over the harbor edge, the whole square golden.
      defineCameraZone({
        id: 'square-south',
        min: [-13, -1, 0],
        max: [13, 5, 11],
        camera: [11.8, 3.0, 13.8], // over the sea wall, low, into the gold
        trackTarget: true,
        trackStiffness: 3,
        fovOverride: 58,
      }),
      // North half: lower, past the fountain toward the bakery row.
      defineCameraZone({
        id: 'square-north',
        min: [-13, -1, -11],
        max: [13, 5, 0],
        camera: [-9.5, 3.4, 4.5],
        trackTarget: true,
        trackStiffness: 3.5,
        fovOverride: 58,
      }),
    ];

    return {
      root,
      colliders,
      cameraZones,
      interactables,
      updatables,
      spawn: { position: new THREE.Vector3(6, 0, 8.5), rotationY: Math.PI * 0.8 },
      spawnPoints: {},
      enemySpawns: [], // daytime GRAVEN has no combat, ever
      fog: { color: 0xc9a075, density: 0.012 },
      ambientTrack: 'townDay',
      hudMinimal: true,
      surfaces: { default: 'stone', regions: [] },
      map: {
        rooms: [{ id: 'square', label: 'Town Square', min: [-13, -11], max: [13, 11] }],
        markers: [],
      },
    };
  },
};
