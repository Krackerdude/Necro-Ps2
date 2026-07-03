import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { FlickerLight } from '../effects/FlickerLight.js';
import { createInstancedScatter } from '../../rendering/instancing/InstancedScatter.js';
import { makeNpc, makeTransition } from './levelHelpers.js';
import { readDocument } from '../../gameplay/story/documents.js';

/**
 * THE GULL & ANCHOR — inside the inn, by day. Two regions on one flat map:
 * the common room (hearth, bar, tables, Tobias and the regulars) and, off
 * to the east at +40 x, "upstairs" — the landing corridor and the corner
 * room Mike had. The stairs are a door transition within the same level;
 * the vertical lie works because no camera ever sees both regions at once.
 *
 * Act I ends here: the bed in the corner room is the sleep trigger (gated
 * on quest:priest), which flips `nightfall` and puts you back at the inn
 * door in the dark. Only reachable by day — the town locks this door at
 * night.
 */

const H = 3.2;

export const INN_INTERIOR = {
  id: 'inn-interior',
  name: 'The Gull & Anchor',

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
    const q = (flag) => Boolean(story.get(flag));
    const warmWood = (color) => kit.material('woodPlanks', { color });

    /* --------------------------- COMMON ROOM --------------------------- */
    // x -7..7, z -4..6; the front door south leads back to the square.
    add(kit.slab({ center: [0, 1], size: [14, 10], y: 0, texture: 'woodPlanks', repeat: [7, 5] }));
    add(kit.slab({ center: [0, 1], size: [14, 10], y: H, texture: 'woodPlanks', flip: true, repeat: [7, 5] }));
    add(kit.wall({ from: [-7, -4], to: [7, -4], height: H, texture: 'plasterRot' }));
    // South wall with the front doorway gap.
    add(kit.wall({ from: [-7, 6], to: [-1, 6], height: H, texture: 'plasterRot' }));
    add(kit.wall({ from: [1, 6], to: [7, 6], height: H, texture: 'plasterRot' }));
    add(kit.wall({ from: [-1, 6], to: [1, 6], height: H - 2.4, yBase: 2.4, texture: 'plasterRot' }));
    add(kit.wall({ from: [-7, -4], to: [-7, 6], height: H, texture: 'plasterRot' }));
    // East wall solid; west wall has the stair doorway (z 2.6..4).
    add(kit.wall({ from: [7, -4], to: [7, 6], height: H, texture: 'plasterRot' }));
    // Ceiling beams — the thing every PS2 tavern shot needs.
    for (const z of [-2, 1, 4]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 0.22, 0.3), warmWood(0x4a382a));
      beam.position.set(0, H - 0.12, z);
      root.add(beam);
    }

    // The hearth, east wall — the warmest object in Act I.
    const hearthStone = kit.material('stoneWall');
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 2.4), hearthStone);
    mantel.position.set(6.7, 1.1, 0);
    root.add(mantel);
    colliders.push(new THREE.Box3().setFromObject(mantel));
    const firebox = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.0, 1.4),
      kit.ps2.patch(
        new THREE.MeshStandardMaterial({
          color: 0x1a0e08,
          emissive: 0xd96a28,
          emissiveIntensity: 1.6,
          roughness: 1,
        })
      )
    );
    firebox.position.set(6.42, 0.55, 0);
    root.add(firebox);
    const fire = new FlickerLight({
      position: new THREE.Vector3(6.1, 1.0, 0),
      intensity: 14,
      distance: 11,
      color: 0xe8883a,
      castShadow: true,
    });
    root.add(fire.light);
    updatables.push(fire);
    const barLamp = new FlickerLight({
      position: new THREE.Vector3(-3.2, 2.1, -2.2),
      intensity: 6,
      distance: 7,
      color: 0xe8a860,
    });
    root.add(barLamp.light);
    updatables.push(barLamp);

    // The bar along the north wall, bottles behind it.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.05, 0.8), warmWood(0x5a4230));
    bar.position.set(-3.2, 0.52, -2.6);
    root.add(bar);
    colliders.push(new THREE.Box3().setFromObject(bar));
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.08, 0.35), warmWood(0x4a382a));
    shelf.position.set(-3.2, 1.9, -3.8);
    root.add(shelf);
    for (let i = 0; i < 7; i++) {
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 0.3, 5),
        kit.ps2.patch(
          new THREE.MeshStandardMaterial({
            color: [0x3a5a3a, 0x5a3a2a, 0x2a3a5a][i % 3],
            roughness: 0.3,
          })
        )
      );
      bottle.position.set(-5.4 + i * 0.75, 2.1, -3.8);
      root.add(bottle);
    }

    // Tables and stools.
    const mkTable = (x, z) => {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.3), warmWood(0x6a4a34));
      top.position.set(x, 0.78, z);
      root.add(top);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.16), warmWood(0x4a382a));
      leg.position.set(x, 0.39, z);
      root.add(leg);
      colliders.push(new THREE.Box3(
        new THREE.Vector3(x - 0.65, 0, z - 0.65),
        new THREE.Vector3(x + 0.65, 1.0, z + 0.65)
      ));
      for (const [sx, sz] of [[-1, 0], [1, 0], [0, 1]]) {
        const stool = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.36), warmWood(0x55402e));
        stool.position.set(x + sx * 1.05, 0.25, z + sz * 1.05);
        root.add(stool);
      }
    };
    mkTable(3.2, 2.4);
    mkTable(-3.4, 2.2);
    mkTable(1.2, -1.4);

    // Candles on the tables.
    const candle = kit.candleTemplate();
    root.add(
      createInstancedScatter(candle.geometry, candle.material, [
        { position: new THREE.Vector3(3.2, 0.82, 2.4) },
        { position: new THREE.Vector3(-3.4, 0.82, 2.2), scale: 0.85 },
        { position: new THREE.Vector3(1.2, 0.82, -1.4), scale: 1.1 },
        { position: new THREE.Vector3(-1.2, 1.1, -2.7), scale: 0.9 },
      ])
    );

    /* ---------------------------- UPSTAIRS ----------------------------- */
    // Landing corridor x 33..43, z -1.6..1.6; corner room x 43..49, z -4..3.
    add(kit.slab({ center: [38, 0], size: [10, 3.2], y: 0, texture: 'woodPlanks', repeat: [5, 1.6] }));
    add(kit.slab({ center: [38, 0], size: [10, 3.2], y: 2.6, texture: 'woodPlanks', flip: true, repeat: [5, 1.6] }));
    add(kit.wall({ from: [33, -1.6], to: [43, -1.6], height: 2.6, texture: 'plasterRot' }));
    add(kit.wall({ from: [33, 1.6], to: [43, 1.6], height: 2.6, texture: 'plasterRot' }));
    add(kit.wall({ from: [33, -1.6], to: [33, 1.6], height: 2.6, texture: 'plasterRot' }));
    // Guest doors along the corridor (set dressing — shut).
    for (const z of [-1.5, 1.5]) {
      for (const x of [35.5, 39]) {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.09), warmWood(0x4a3626));
        leaf.position.set(x, 1.05, z + (z < 0 ? 0.06 : -0.06));
        root.add(leaf);
      }
    }
    // The corner room.
    add(kit.slab({ center: [46, -0.5], size: [6, 7], y: 0, texture: 'woodPlanks', repeat: [3, 3.5] }));
    add(kit.slab({ center: [46, -0.5], size: [6, 7], y: 2.6, texture: 'woodPlanks', flip: true, repeat: [3, 3.5] }));
    add(kit.slab({ center: [46, -0.5], size: [3.4, 4.2], y: 0.01, texture: 'carpetRed', repeat: [2, 2] }));
    add(kit.wall({ from: [43, -4], to: [49, -4], height: 2.6, texture: 'plasterRot' }));
    add(kit.wall({ from: [43, 3], to: [49, 3], height: 2.6, texture: 'plasterRot' }));
    add(kit.wall({ from: [49, -4], to: [49, 3], height: 2.6, texture: 'plasterRot' }));
    // Corridor-to-room wall with doorway gap (z -1.6..1.6 shared edge).
    add(kit.wall({ from: [43, -4], to: [43, -1.2], height: 2.6, texture: 'plasterRot' }));
    add(kit.wall({ from: [43, 1.2], to: [43, 3], height: 2.6, texture: 'plasterRot' }));
    add(kit.wall({ from: [43, -1.2], to: [43, 1.2], height: 2.6 - 2.2, yBase: 2.2, texture: 'plasterRot' }));

    // The harbor window: dusk pours in. This is the window from the scene.
    const dusk = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.3, 1.8),
      kit.ps2.patch(
        new THREE.MeshStandardMaterial({
          color: 0x1a140e,
          emissive: 0xd9905e,
          emissiveIntensity: 1.5,
        })
      )
    );
    dusk.position.set(48.94, 1.6, -0.5);
    root.add(dusk);
    const duskLight = new THREE.PointLight(0xd9905e, 6, 7);
    duskLight.position.set(48.2, 1.7, -0.5);
    root.add(duskLight);

    // The bed — Act I's last interactable.
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 1.3), warmWood(0x4a382a));
    frame.position.set(47.4, 0.18, -2.9);
    root.add(frame);
    colliders.push(new THREE.Box3().setFromObject(frame));
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.22, 1.15),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0xc9bfa4, roughness: 1 }))
    );
    mattress.position.set(47.4, 0.46, -2.9);
    root.add(mattress);
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.8),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: 1 }))
    );
    pillow.position.set(48.2, 0.62, -2.9);
    root.add(pillow);

    // Desk with Mike's journal page; his boxed things in the corner.
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.7), warmWood(0x5a4230));
    desk.position.set(46.6, 0.4, 2.5);
    root.add(desk);
    colliders.push(new THREE.Box3().setFromObject(desk));
    const page = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.02, 0.42),
      kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: 1 }))
    );
    page.rotation.y = 0.3;
    page.position.set(46.6, 0.82, 2.45);
    root.add(page);
    const boxes = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), warmWood(0x6a5238));
    boxes.position.set(43.8, 0.35, 2.4);
    root.add(boxes);
    colliders.push(new THREE.Box3().setFromObject(boxes));

    // Upstairs lamp.
    const hall = new FlickerLight({
      position: new THREE.Vector3(38, 2.2, 0),
      intensity: 7,
      distance: 8,
      color: 0xe8a860,
    });
    root.add(hall.light);
    updatables.push(hall);

    /* ---------------------------- LIGHTING ----------------------------- */
    root.add(new THREE.AmbientLight(0x9a8468, 2.5));
    root.add(new THREE.HemisphereLight(0x7a6a54, 0x3a2c20, 1.5));

    /* ----------------------------- PEOPLE ------------------------------ */
    const npcCtx = { root, ps2: kit.ps2, events, updatables, colliders };
    interactables.push(
      makeNpc(npcCtx, {
        id: 'tobias',
        name: 'Tobias, the innkeeper',
        position: new THREE.Vector3(-3.2, 0, -3.4),
        facing: Math.PI, // behind the bar, facing the room
        hair: 'bald',
        beard: true,
        vest: true,
        build: 1.18,
        palette: { coat: 0x8a7458, skin: 0xc9a082, legs: 0x3a3028, vest: 0x5c2c30, beard: 0x9a9088 },
        lines: () => {
          if (q('quest:priest'))
            return [
              'There you are. Rosa sent bread up, the fire’s banked, and the corner room is yours — end of the hall, harbor view. Same one your friend had.',
              'Sleep well, friend. The bell will ring at dusk. Pay it no mind. It’s only custom.',
            ];
          if (q('quest:inn'))
            return [
              'Aldous will be down on the long pier — he practically sleeps standing up down there. Go on, I’ll air your room out while you’re about it.',
            ];
          if (!q('quest:rosa'))
            return [
              'Welcome to the Gull & Anchor! Room, meal, or gossip — we stock all three.',
              'See a bit of the town first, though. Graven at dusk is worth your eyes. I’ll be here. I’m always here.',
            ];
          return [
            'Rosa sent you? Then you’re family already. Let’s see the photograph.',
            'Michael. Corner room, eleven nights, paid for seven more he never used. Left his key on the desk one morning and his luggage in the room and that was the end of him.',
            'I’d have said he took the boat out, except — well. Aldous keeps the harbor ledger, and Aldous swears no boat took him. You’d want to ask Aldous himself, down on the long pier.',
            'His things are still boxed upstairs. Nobody came for them. Until now, I suppose.',
          ];
        },
        onComplete: () => {
          if (q('quest:rosa') && !q('quest:inn')) story.set('quest:inn', true);
        },
      }),
      makeNpc(npcCtx, {
        id: 'henrik',
        name: 'Henrik',
        position: new THREE.Vector3(3.2, 0, 3.3),
        facing: 0.2,
        hair: 'cap',
        beard: true,
        build: 1.05,
        palette: { coat: 0x4a4a3a, skin: 0xb89878, legs: 0x2e2e28, hat: 0x3a3630, beard: 0x6a5a48 },
        lines: [
          'Same stool, same hour, same two pints. Forty years. You want to live long in Graven, find a routine and be thankful in it.',
          'The fire never goes out here, you know. Tobias says it’s the flue. Forty years I’ve never once seen him feed it.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'greta',
        name: 'Greta, the cook',
        position: new THREE.Vector3(-5.8, 0, 0.6),
        facing: 1.4,
        outfit: 'dress',
        apron: true,
        hair: 'bun',
        build: 1.05,
        palette: { coat: 0x6a5a6c, skin: 0xd0a888, skirt: 0x4a3a4c, apron: 0xd8d0bc, hair: 0x8a7a68 },
        lines: [
          'Chowder tonight, and Rosa’s bread. Guests eat first, that’s the house rule. Guests always eat first here.',
          'Your friend with the camera — he loved my chowder. Three bowls, that last supper. Like he knew, poor lamb. Knew what? Oh… that he was leaving, of course.',
        ],
      })
    );

    /* -------------------------- INTERACTABLES -------------------------- */
    interactables.push(
      makeTransition(
        { story, inventory, events },
        {
          id: 'front-door',
          position: new THREE.Vector3(0, 1, 5.6),
          radius: 1.5,
          prompt: 'Back to the square',
          targetLevel: 'graven-town',
          targetSpawn: 'innDoor',
        }
      ),
      makeTransition(
        { story, inventory, events },
        {
          id: 'stairs-up',
          position: new THREE.Vector3(-6.2, 1, 4.6),
          radius: 1.5,
          prompt: 'Take the stairs up',
          targetLevel: 'inn-interior',
          targetSpawn: 'landing',
        }
      ),
      makeTransition(
        { story, inventory, events },
        {
          id: 'stairs-down',
          position: new THREE.Vector3(33.8, 1, 0),
          radius: 1.4,
          prompt: 'Down to the common room',
          targetLevel: 'inn-interior',
          targetSpawn: 'ground',
        }
      ),
      {
        id: 'hearth',
        position: new THREE.Vector3(6.1, 1, 0),
        radius: 1.7,
        prompt: 'Warm your hands',
        onInteract: () => {
          events.emit('ui/toast', {
            text: 'The fire takes no wood and gives real warmth. You decide not to think about it.',
          });
        },
      },
      {
        id: 'mikes-boxes',
        position: new THREE.Vector3(44, 1, 2.4),
        radius: 1.5,
        prompt: 'Mike’s boxed things',
        onInteract: () => {
          events.emit('ui/toast', {
            text: 'Clothes, folded by someone else’s hands. Lens caps. No camera, and no film anywhere.',
          });
        },
      },
      {
        id: 'mikes-journal',
        position: new THREE.Vector3(46.6, 1, 2.5),
        radius: 1.4,
        prompt: 'Read the page on the desk',
        onInteract: () => readDocument(events, story, 'mikesJournal'),
      },
      // Act I's final door: the bed.
      {
        id: 'corner-bed',
        position: new THREE.Vector3(47.4, 1, -2.9),
        radius: 1.6,
        prompt: () => (q('quest:priest') ? 'Turn in for the night' : 'Your bed'),
        onInteract: () => {
          if (!q('quest:priest')) {
            events.emit('ui/toast', {
              text: 'Too early. Daylight is for questions — you still owe Mike a few.',
            });
            return;
          }
          story.set('sleptAtInn', true);
          story.set('nightfall', true);
          events.emit('level/transition', { levelId: 'graven-town', spawn: 'innDoor' });
        },
      }
    );

    /* -------------------------- CAMERA ZONES --------------------------- */
    const cameraZones = [
      // Common room: high from the door corner — hearth right, bar left.
      defineCameraZone({
        id: 'common-room',
        min: [-7, -1, -4],
        max: [7, 4, 6],
        camera: [5.8, 2.4, -2.6], // from the hearth corner: bar, tables, door
        trackTarget: true,
        trackStiffness: 3,
        fovOverride: 62,
      }),
      // Landing: one-point down the corridor toward the corner room.
      defineCameraZone({
        id: 'landing',
        min: [33, -1, -1.6],
        max: [43, 3, 1.6],
        camera: [33.5, 1.9, 0],
        lookAt: [43, 1.2, 0],
        fovOverride: 52,
      }),
      // The corner room: from the doorway; the bed and the window own it.
      defineCameraZone({
        id: 'corner-room',
        min: [43, -1, -4],
        max: [49, 3, 3],
        camera: [43.6, 2.1, 2.4],
        lookAt: [47.6, 0.9, -2.2],
        fovOverride: 58,
      }),
    ];

    return {
      root,
      colliders,
      cameraZones,
      interactables,
      updatables,
      spawn: { position: new THREE.Vector3(0, 0, 4.4), rotationY: Math.PI },
      spawnPoints: {
        fromTown: { position: new THREE.Vector3(0, 0, 4.4), rotationY: Math.PI },
        landing: { position: new THREE.Vector3(34.6, 0, 0), rotationY: Math.PI / 2 },
        ground: { position: new THREE.Vector3(-5.2, 0, 3.8), rotationY: -Math.PI / 2 },
      },
      enemySpawns: [],
      fog: { color: 0x1a120c, density: 0.045 },
      ambientTrack: 'hearth',
      hudMinimal: true,
      surfaces: { default: 'wood', regions: [] },
      map: {
        rooms: [
          { id: 'common', label: 'Common Room', min: [-7, -4], max: [7, 6] },
          { id: 'landing', label: 'Upstairs Hall', min: [33, -1.6], max: [43, 1.6] },
          { id: 'corner', label: 'The Corner Room', min: [43, -4], max: [49, 3] },
        ],
        markers: [{ type: 'door', position: [0, 6] }],
      },
    };
  },
};
