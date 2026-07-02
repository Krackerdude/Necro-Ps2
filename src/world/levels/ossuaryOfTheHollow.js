import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { FlickerLight } from '../effects/FlickerLight.js';
import { FogCards } from '../effects/FogCards.js';
import { createInstancedScatter } from '../../rendering/instancing/InstancedScatter.js';
import { makeItemPickup, makeTransition, makePickupMesh } from './levelHelpers.js';

/**
 * OSSUARY OF THE HOLLOW — level 3, the finale of this build.
 *
 * Bone-lined processional corridors descending to the Bell Chamber: a great
 * bronze bell over an empty altar socket. Placing the Hollow Icon and
 * ringing the bell ends the demo.
 *
 *   gate (north, from cloister)
 *        │
 *   antechamber ── shrine alcove (save)
 *        │
 *   processional corridor (husks between the pillars)
 *        │
 *   BELL CHAMBER (wraiths circle the bell)
 *
 * Ceilings are low everywhere — 2.4 in corridors — so the shots stay
 * compressed and claustrophobic.
 */
const CEIL = 2.4;
const CHAMBER_CEIL = 4.2;

export const OSSUARY_OF_THE_HOLLOW = {
  id: 'ossuary-of-the-hollow',
  name: 'Ossuary of the Hollow',

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
    const pickupCtx = { root, story, inventory, events };

    /* ------------------------- ANTECHAMBER ------------------------------ */
    // x -4..4, z -10..-4. Entrance from the cloister at z=-10.
    add(kit.slab({ center: [0, -7], size: [8, 6], y: 0, texture: 'boneDust', repeat: [4, 3] }));
    add(kit.slab({ center: [0, -7], size: [8, 6], y: CEIL, texture: 'stoneWall', flip: true }));
    add(kit.wall({ from: [-4, -10], to: [-1, -10], height: CEIL }));
    add(kit.wall({ from: [1, -10], to: [4, -10], height: CEIL }));
    add(kit.wall({ from: [-4, -10], to: [-4, -4], height: CEIL }));
    // East wall with shrine alcove gap (z -8.2..-6.8).
    add(kit.wall({ from: [4, -10], to: [4, -8.2], height: CEIL }));
    add(kit.wall({ from: [4, -6.8], to: [4, -4], height: CEIL }));
    // South walls with corridor gap (x -1.2..1.2).
    add(kit.wall({ from: [-4, -4], to: [-1.2, -4], height: CEIL }));
    add(kit.wall({ from: [1.2, -4], to: [4, -4], height: CEIL }));

    /* ------------------------- SHRINE ALCOVE ---------------------------- */
    add(kit.slab({ center: [6, -7.5], size: [4, 3], y: 0, texture: 'stoneFloor', repeat: [2, 1.5] }));
    add(kit.slab({ center: [6, -7.5], size: [4, 3], y: CEIL, texture: 'stoneWall', flip: true }));
    add(kit.wall({ from: [4, -9], to: [8, -9], height: CEIL }));
    add(kit.wall({ from: [4, -6], to: [8, -6], height: CEIL }));
    add(kit.wall({ from: [8, -9], to: [8, -6], height: CEIL }));
    add(kit.shrine({ position: [7.2, -7.5], rotationY: Math.PI / 2 }));

    /* --------------------- PROCESSIONAL CORRIDOR ------------------------ */
    // x -1.2..1.2 wide walkway from z -4 to 4, flanked by bone niches.
    add(kit.slab({ center: [0, 0], size: [2.4, 8], y: 0, texture: 'carpetRed', repeat: [1, 4] }));
    add(kit.slab({ center: [0, 0], size: [2.4, 8], y: CEIL, texture: 'stoneWall', flip: true }));
    add(kit.wall({ from: [-1.2, -4], to: [-1.2, 4], height: CEIL, texture: 'boneDust', repeat: [4, 1.2] }));
    add(kit.wall({ from: [1.2, -4], to: [1.2, 4], height: CEIL, texture: 'boneDust', repeat: [4, 1.2] }));

    /* -------------------------- BELL CHAMBER ---------------------------- */
    // x -7..7, z 4..14, taller ceiling, bell at center-south.
    add(kit.slab({ center: [0, 9], size: [14, 10], y: 0, texture: 'boneDust', repeat: [7, 5] }));
    add(kit.slab({ center: [0, 9], size: [14, 10], y: CHAMBER_CEIL, texture: 'stoneWall', flip: true }));
    add(kit.wall({ from: [-7, 4], to: [-1.2, 4], height: CHAMBER_CEIL }));
    add(kit.wall({ from: [1.2, 4], to: [7, 4], height: CHAMBER_CEIL }));
    add(kit.wall({ from: [-7, 14], to: [7, 14], height: CHAMBER_CEIL }));
    add(kit.wall({ from: [-7, 4], to: [-7, 14], height: CHAMBER_CEIL }));
    add(kit.wall({ from: [7, 4], to: [7, 14], height: CHAMBER_CEIL }));

    for (const [x, z] of [[-4.5, 6], [4.5, 6], [-4.5, 12], [4.5, 12]]) {
      add(kit.pillar({ position: [x, z], radius: 0.4, height: CHAMBER_CEIL }));
    }

    const bell = add(kit.bell({ position: [0, 10.5] }));
    // The empty socket where the icon belongs.
    add(kit.altar({ position: [0, 8.2] }));

    /* --------------------------- SET DRESSING --------------------------- */
    // Skull piles along the chamber walls (instanced icosahedra).
    const skullGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const skullMat = kit.material('boneDust', { color: 0xcfc2a4 });
    const piles = [];
    let s = 77;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const alongSouth = rand() > 0.5;
      piles.push({
        position: new THREE.Vector3(
          alongSouth ? -6.4 + rand() * 12.8 : (rand() > 0.5 ? -6.5 : 6.5),
          0.08 + rand() * 0.18,
          alongSouth ? 13.4 + rand() * 0.5 : 4.6 + rand() * 9,
        ),
        rotationY: rand() * Math.PI,
        scale: 0.6 + rand() * 0.9,
      });
    }
    root.add(createInstancedScatter(skullGeo, skullMat, piles));
    add(kit.corpse({ position: [-3.4, 5.2], rotationY: 2.8 }));
    add(kit.rubble({ position: [5.8, 12.8], seed: 91, count: 8 }));
    add(kit.rubble({ position: [-2.9, -8.7], seed: 93, count: 5 }));

    /* ----------------------------- LIGHTING ----------------------------- */
    root.add(new THREE.AmbientLight(0x282436, 2.1));
    root.add(new THREE.HemisphereLight(0x2c2840, 0x141008, 0.9));

    const flickers = [
      new FlickerLight({ position: new THREE.Vector3(0, 1.8, -7), intensity: 11, distance: 8 }),
      new FlickerLight({ position: new THREE.Vector3(7, 1.4, -7.5), intensity: 12, distance: 7 }),
      new FlickerLight({ position: new THREE.Vector3(0, 1.9, 0), intensity: 8, distance: 6, color: 0x9fdc7a }),
      new FlickerLight({ position: new THREE.Vector3(0, 3.4, 10.5), intensity: 18, distance: 12, color: 0xffa050, castShadow: true }),
      new FlickerLight({ position: new THREE.Vector3(-5.5, 1.2, 5.5), intensity: 7, distance: 6, color: 0x9fdc7a }),
    ];
    for (const f of flickers) {
      root.add(f.light);
      updatables.push(f);
    }

    const boneMist = new FogCards({ center: [0, 9], size: [14, 10], count: 4, opacity: 0.11, color: 0x8a9078, height: 0.5 });
    root.add(boneMist.object);
    updatables.push(boneMist);

    /* --------------------------- INTERACTABLES -------------------------- */
    interactables.push(
      makeTransition(
        { story, inventory, events },
        {
          id: 'gate-to-cloister',
          position: new THREE.Vector3(0, 1, -9.5),
          prompt: 'Return to the cloister',
          targetLevel: 'sunken-cloister',
          targetSpawn: 'fromOssuary',
        }
      ),
      {
        id: 'ossuary-shrine',
        position: new THREE.Vector3(7, 1, -7.5),
        radius: 1.5,
        prompt: 'Pray at the bones (save)',
        onInteract: () => events.emit('ui/open-save-menu'),
      },
      {
        id: 'verger-note',
        position: new THREE.Vector3(-3.4, 1, 5.4),
        radius: 1.2,
        prompt: 'Read the verger’s last page',
        onInteract: () => {
          story.set('readVergerNote', true);
          events.emit('ui/show-note', {
            title: 'THE VERGER’S LAST PAGE',
            body:
              'The bell is not for calling the living. It is for telling the ground ' +
              'the hour, so it stays asleep.\n\n' +
              'The icon is the clapper’s heart. Without it the bell only whispers, ' +
              'and the whisper is what woke them.\n\n' +
              'Seat the icon. Ring the hour. Forgive me for keeping the key.',
          });
        },
      },
      {
        id: 'icon-socket',
        position: new THREE.Vector3(0, 1, 8.2),
        radius: 1.4,
        prompt: () =>
          story.get('iconSeated') ? 'The icon is seated' : 'Seat the Hollow Icon',
        canInteract: () => !story.get('iconSeated'),
        onInteract: () => {
          if (!inventory?.has('hollowIcon')) {
            events.emit('ui/toast', {
              text: 'An empty socket in the altar stone, shaped like a held bird.',
            });
            return;
          }
          inventory.remove('hollowIcon', 1);
          story.set('iconSeated', true);
          events.emit('audio/sfx', { id: 'saveChime' });
          events.emit('ui/toast', { text: 'The icon settles into the socket. The bell leans in.' });
        },
      },
      {
        id: 'the-bell',
        position: new THREE.Vector3(0, 1, 10.5),
        radius: 1.8,
        prompt: () => (story.get('iconSeated') ? 'Ring the bell' : 'Inspect the bell'),
        canInteract: () => !story.get('bellRung'),
        onInteract: () => {
          if (!story.get('iconSeated')) {
            events.emit('ui/toast', {
              text: 'The clapper swings without a sound. Its heart is missing.',
            });
            return;
          }
          story.set('bellRung', true);
          events.emit('audio/sfx', { id: 'bellToll' });
          events.emit('ui/show-note', {
            title: 'THE HOUR IS TOLD',
            body:
              'The toll moves through the floor, up the bone walls, out into the ' +
              'drowned garth and the nave above.\n\n' +
              'Everything that was standing lies down.\n\n' +
              'The ground, satisfied, remembers it is only ground.\n\n' +
              '— END OF THIS BUILD OF NECRO. Your saves will carry forward. —',
          });
        },
      }
    );

    /* ------------------------------ LOOT -------------------------------- */
    for (const pickup of [
      makeItemPickup(pickupCtx, {
        id: 'ossuary-shells',
        itemId: 'boneShells',
        qty: 8,
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(3.2, 0.3, -6.2),
          color: 0xc9b37a,
          emissive: 0x4a3a10,
        }),
        position: new THREE.Vector3(3.2, 1, -6.2),
        prompt: 'Take the ammunition tin',
        flavor: 'Taken — TALLOW ROUNDS ×8, packed for a procession that never left.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'ossuary-tonic',
        itemId: 'graveTonic',
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(-6.2, 0.4, 12.6),
          color: 0x9e1616,
          emissive: 0x4a0a0a,
        }),
        position: new THREE.Vector3(-6.2, 1, 12.6),
        prompt: 'Take the grave tonic',
        flavor: 'Taken — GRAVE TONIC, still warm. Do not think about why.',
      }),
    ]) {
      if (pickup) interactables.push(pickup);
    }

    /* --------------------------- CAMERA ZONES --------------------------- */
    const cameraZones = [
      // Antechamber: tight high corner, ceiling pressing down in frame.
      defineCameraZone({
        id: 'antechamber',
        min: [-4, -1, -10],
        max: [4, 3, -4],
        camera: [-3.4, 2.1, -9.4],
        trackTarget: true,
        trackStiffness: 4,
        rollDeg: -3,
      }),
      defineCameraZone({
        id: 'shrine-alcove',
        min: [4, -1, -9],
        max: [8, 3, -6],
        camera: [4.5, 1.9, -6.4],
        lookAt: [7.2, 0.8, -7.8],
        fovOverride: 50,
      }),
      // Processional: dead-center one-point, the classic dread hallway.
      defineCameraZone({
        id: 'processional',
        min: [-1.2, -1, -4],
        max: [1.2, 3, 4],
        camera: [0, 1.7, -3.8],
        lookAt: [0, 0.9, 4],
        fovOverride: 44,
      }),
      // Bell chamber: low wide dutch from behind the skull line; the bell
      // dominates the composition, the player is small beneath it.
      defineCameraZone({
        id: 'bell-chamber',
        min: [-7, -1, 4],
        max: [7, 5, 14],
        camera: [-6.1, 1.9, 12.9],
        trackTarget: true,
        trackStiffness: 3,
        rollDeg: 5,
        fovOverride: 66,
      }),
    ];

    void bell; // future: swing animation on toll

    return {
      root,
      colliders,
      cameraZones,
      interactables,
      updatables,
      spawn: { position: new THREE.Vector3(0, 0, -9), rotationY: Math.PI },
      spawnPoints: {
        fromCloister: { position: new THREE.Vector3(0, 0, -9), rotationY: Math.PI },
      },
      enemySpawns: [
        { type: 'husk', position: new THREE.Vector3(0, 0, 2.2), homeRadius: 3 },
        { type: 'wraith', position: new THREE.Vector3(-4, 0, 9), homeRadius: 4.5 },
        { type: 'wraith', position: new THREE.Vector3(4, 0, 11.5), homeRadius: 4.5 },
        { type: 'husk', position: new THREE.Vector3(5.5, 0, 6), homeRadius: 4 },
      ],
      fog: { color: 0x0c0a10, density: 0.06 },
      ambientTrack: 'ossuary',
    };
  },
};
