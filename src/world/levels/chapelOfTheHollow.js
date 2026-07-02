import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { FlickerLight } from '../effects/FlickerLight.js';
import { FogCards } from '../effects/FogCards.js';
import { createInstancedScatter } from '../../rendering/instancing/InstancedScatter.js';
import { makeItemPickup, makeTransition, makePickupMesh } from './levelHelpers.js';
import { buildWeaponModel } from '../../assets/models/weaponModels.js';

/**
 * CHAPEL OF THE HOLLOW — the first playable level, and the reference for how
 * levels are authored in this engine.
 *
 * Layout (top-down, +x east, +z south):
 *
 *            z=-10  ┌──────────────┐
 *   VESTRY          │    ALTAR     │
 *   (save room)     │              │
 *   ┌───────┐ door  │     NAVE     │  door   CORRIDOR        CRYPT
 *   │ shrine ├──────┤  pews  pews  ├────────═══════════╗ ┌─────────┐
 *   └───────┘       │              │        (locked    ║ │  icon   │
 *            z=+10  └──────────────┘         crypt door)╚═╡ wraith  │
 *                        entrance                         └─────────┘
 *
 * Progression: read the warden's note → take the Black Iron Key from the
 * altar → unlock the crypt door → survive the wraith → take the Hollow Icon.
 *
 * Camera grammar (RE2/SH2): every zone is an authored shot — high corner
 * surveillance in the nave, a low dutch angle at the altar, a one-point
 * down-corridor shot, and a floor-level wide in the crypt.
 */

const WALL_H = 5;
const ROOM_H = 3;

export const CHAPEL_OF_THE_HOLLOW = {
  id: 'chapel-of-the-hollow',
  name: 'Chapel of the Hollow',

  build({ kit, story, inventory, events, physics }) {
    const root = new THREE.Group();
    const colliders = [];
    const updatables = [];
    const interactables = [];

    const add = (piece) => {
      root.add(piece.object);
      colliders.push(...piece.colliders);
      return piece.object;
    };

    /* ------------------------------ NAVE ------------------------------ */
    add(kit.slab({ center: [0, 0], size: [12, 20], y: 0, texture: 'stoneFloor' }));
    add(kit.slab({ center: [0, 0], size: [12, 20], y: WALL_H, texture: 'plasterRot', flip: true }));
    // Carpet runner down the aisle, slightly raised to avoid z-fighting.
    add(kit.slab({ center: [0, 0], size: [2, 19], y: 0.01, texture: 'carpetRed', repeat: [1, 8] }));

    add(kit.wall({ from: [-6, -10], to: [6, -10], height: WALL_H }));
    add(kit.wall({ from: [-6, 10], to: [6, 10], height: WALL_H }));
    // West wall with vestry doorway gap (z -4.7..-3.3).
    add(kit.wall({ from: [-6, -10], to: [-6, -4.7], height: WALL_H }));
    add(kit.wall({ from: [-6, -3.3], to: [-6, 10], height: WALL_H }));
    // East wall with corridor gap (z 2.5..5.5).
    add(kit.wall({ from: [6, -10], to: [6, 2.5], height: WALL_H }));
    add(kit.wall({ from: [6, 5.5], to: [6, 10], height: WALL_H }));
    // Rotten plaster lintels above the doorways so gaps read as arches.
    add(kit.wall({ from: [6, 2.5], to: [6, 5.5], height: WALL_H - 2.8, yBase: 2.8, texture: 'plasterRot' }));
    add(kit.wall({ from: [-6, -4.7], to: [-6, -3.3], height: WALL_H - 2.8, yBase: 2.8, texture: 'plasterRot' }));

    for (const z of [-6, -1, 4]) {
      add(kit.pillar({ position: [-4.2, z], height: WALL_H }));
      add(kit.pillar({ position: [4.2, z], height: WALL_H }));
    }

    // Pews — two columns, slightly irregular, one knocked askew.
    for (let i = 0; i < 5; i++) {
      const z = -3.5 + i * 2.1;
      add(kit.pew({ position: [-2.6, z], rotationY: Math.PI + (i === 2 ? 0.35 : (i % 2) * 0.04) }));
      add(kit.pew({ position: [2.6, z], rotationY: Math.PI - (i === 4 ? 0.5 : (i % 3) * 0.05) }));
    }

    add(kit.altar({ position: [0, -8] }));
    add(kit.rubble({ position: [-4.6, 8.2], seed: 3, count: 8 }));
    add(kit.rubble({ position: [5.1, -8.8], seed: 9, count: 5 }));

    // Barred entrance door (decorative — the game starts inside).
    add(kit.door({ position: [0, 9.9], width: 2.0, height: 3.2 }));

    /* ----------------------------- VESTRY ----------------------------- */
    add(kit.slab({ center: [-9, -4], size: [6, 6], y: 0, texture: 'woodPlanks', repeat: [3, 3] }));
    add(kit.slab({ center: [-9, -4], size: [6, 6], y: ROOM_H, texture: 'plasterRot', flip: true }));
    add(kit.wall({ from: [-12, -7], to: [-6, -7], height: ROOM_H, texture: 'plasterRot' }));
    add(kit.wall({ from: [-12, -1], to: [-6, -1], height: ROOM_H, texture: 'plasterRot' }));
    add(kit.wall({ from: [-12, -7], to: [-12, -1], height: ROOM_H, texture: 'plasterRot' }));
    const shrine = add(kit.shrine({ position: [-11.2, -4], rotationY: Math.PI / 2 }));
    add(kit.rubble({ position: [-6.8, -6.4], seed: 21, count: 4 }));

    /* ---------------------------- CORRIDOR ---------------------------- */
    add(kit.slab({ center: [11, 4], size: [10, 3], y: 0, texture: 'stoneFloor', repeat: [5, 1.5] }));
    add(kit.slab({ center: [11, 4], size: [10, 3], y: ROOM_H, texture: 'stoneWall', flip: true }));
    add(kit.wall({ from: [6, 2.5], to: [16, 2.5], height: ROOM_H }));
    add(kit.wall({ from: [6, 5.5], to: [16, 5.5], height: ROOM_H }));

    /* ------------------------------ CRYPT ----------------------------- */
    add(kit.slab({ center: [20, 3], size: [8, 10], y: 0, texture: 'boneDust', repeat: [4, 5] }));
    add(kit.slab({ center: [20, 3], size: [8, 10], y: ROOM_H, texture: 'stoneWall', flip: true }));
    add(kit.wall({ from: [16, -2], to: [24, -2], height: ROOM_H }));
    add(kit.wall({ from: [16, 8], to: [24, 8], height: ROOM_H }));
    add(kit.wall({ from: [24, -2], to: [24, 8], height: ROOM_H }));
    add(kit.wall({ from: [16, -2], to: [16, 2.5], height: ROOM_H }));
    add(kit.wall({ from: [16, 5.5], to: [16, 8], height: ROOM_H }));
    // Door jambs + lintel: the doorway cut is 3 m wide but the crypt door
    // leaf is 1.6 m — these fill the gaps so the door meets its frame.
    add(kit.wall({ from: [16, 2.5], to: [16, 3.2], height: ROOM_H }));
    add(kit.wall({ from: [16, 4.8], to: [16, 5.5], height: ROOM_H }));
    add(kit.wall({ from: [16, 3.2], to: [16, 4.8], height: ROOM_H - 2.6, yBase: 2.6 }));
    add(kit.rubble({ position: [22.8, -0.8], seed: 33, count: 9, solid: true }));

    // Gravestones (instanced — one draw call).
    const grave = kit.gravestoneTemplate();
    root.add(
      createInstancedScatter(
        grave.geometry,
        grave.material,
        [
          { position: new THREE.Vector3(17.2, 0, 0.2), rotationY: 0.2 },
          { position: new THREE.Vector3(18.6, 0, -0.9), rotationY: -0.15, scale: 0.9 },
          { position: new THREE.Vector3(21.5, 0, 6.8), rotationY: 0.4 },
          { position: new THREE.Vector3(23.0, 0, 5.9), rotationY: -0.3, scale: 1.1 },
          { position: new THREE.Vector3(19.4, 0, 7.1), rotationY: 0.1, scale: 0.85 },
        ],
        { castShadow: true }
      )
    );

    // The Hollow Icon on a plinth.
    const plinth = add(kit.pillar({ position: [20, 3], radius: 0.35, height: 1.1, texture: 'stoneWall' }));
    plinth.position.y = 0.55;
    const icon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      kit.material('ironDark', { emissive: 0x6a1a1a, emissiveIntensity: 0.8 })
    );
    icon.position.set(20, 1.5, 3);
    if (!story.get('hasHollowIcon')) root.add(icon);
    updatables.push({
      update: (dt) => {
        icon.rotation.y += dt * 0.7;
      },
    });

    /* --------------------------- SET DRESSING -------------------------- */
    // Candles (instanced).
    const candle = kit.candleTemplate();
    root.add(
      createInstancedScatter(candle.geometry, candle.material, [
        { position: new THREE.Vector3(-1.1, 1.13, -7.9) },
        { position: new THREE.Vector3(1.0, 1.13, -8.1), scale: 0.8 },
        { position: new THREE.Vector3(0.4, 1.13, -7.7), scale: 1.15 },
        { position: new THREE.Vector3(-10.9, 0.55, -3.2), scale: 0.9 },
        { position: new THREE.Vector3(-10.9, 0.55, -4.8) },
        { position: new THREE.Vector3(19.6, 0, 2.5), scale: 1.2 },
        { position: new THREE.Vector3(20.5, 0, 3.6), scale: 0.9 },
      ])
    );

    /* ----------------------------- LIGHTING ---------------------------- */
    root.add(new THREE.AmbientLight(0x2a2d3f, 2.4));
    root.add(new THREE.HemisphereLight(0x2e3346, 0x181210, 1.0));

    // Cold moonlight raking through the nave's east windows.
    const moon = new THREE.DirectionalLight(0x63719b, 1.5);
    moon.position.set(9, 10, -4);
    moon.target.position.set(-2, 0, -2);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -14;
    moon.shadow.camera.right = 14;
    moon.shadow.camera.top = 14;
    moon.shadow.camera.bottom = -14;
    root.add(moon, moon.target);

    const flickers = [
      new FlickerLight({ position: new THREE.Vector3(0, 1.7, -7.8), intensity: 20, distance: 11, castShadow: true }),
      new FlickerLight({ position: new THREE.Vector3(-10.8, 1.3, -4), intensity: 13, distance: 8 }),
      new FlickerLight({ position: new THREE.Vector3(11, 2.3, 4), intensity: 9, distance: 8, color: 0xb9c4de }),
      new FlickerLight({ position: new THREE.Vector3(20, 1.4, 3), intensity: 15, distance: 10, color: 0x9fdc7a }),
    ];
    for (const f of flickers) {
      root.add(f.light);
      updatables.push(f);
    }

    const naveFog = new FogCards({ center: [0, 0], size: [12, 20], count: 3, opacity: 0.05 });
    const cryptFog = new FogCards({ center: [20, 3], size: [8, 10], count: 4, opacity: 0.09, color: 0x8fa08a });
    root.add(naveFog.object, cryptFog.object);
    updatables.push(naveFog, cryptFog);

    /* ------------------------- DOORS & PROGRESSION --------------------- */
    // Locked crypt door. If the story already opened it, it isn't rebuilt.
    let cryptDoor = null;
    if (!story.get('cryptDoorOpen')) {
      cryptDoor = kit.door({ position: [16, 4], rotationY: Math.PI / 2, width: 1.6, height: 2.6 });
      add(cryptDoor);
    }

    // The crypt trapdoor — hidden until the Hollow Icon is lifted from its
    // plinth ("the only thing keeping the ground closed").
    const trapdoor = kit.stairsDown({ position: [22.5, 6.8], rotationY: Math.PI });
    if (story.get('hasHollowIcon')) root.add(trapdoor.object);

    // Pickup context shared by the loot below.
    const pickupCtx = { root, story, inventory, events, updatables };

    /* --------------------------- INTERACTABLES ------------------------- */
    interactables.push(
      {
        id: 'entrance-door',
        position: new THREE.Vector3(0, 1, 9.4),
        radius: 1.4,
        prompt: 'Try the door',
        onInteract: () => {
          events.emit('ui/toast', { text: 'It will not move. Something bars it from the other side.' });
        },
      },
      {
        id: 'warden-note',
        position: new THREE.Vector3(-2.6, 1, 0.7),
        radius: 1.2,
        prompt: 'Read the warden’s note',
        onInteract: () => {
          story.set('readWardenNote', true);
          events.emit('ui/show-note', {
            title: 'THE WARDEN’S NOTE',
            body:
              'The congregation would not stop singing, so I nailed the doors.\n\n' +
              'I keep the black key upon the altar, where He can watch it.\n\n' +
              'Do not go below. The thing we buried does not know it is dead, ' +
              'and the icon it clutches is the only thing keeping the ground closed.\n\n' +
              '— If you must pray, pray at the bones.',
          });
        },
      },
      {
        id: 'crypt-door',
        position: new THREE.Vector3(15.4, 1, 4),
        radius: 1.5,
        prompt: () =>
          hasCryptKey() ? 'Unlock the crypt door' : 'Inspect the door',
        canInteract: () => !story.get('cryptDoorOpen'),
        onInteract: () => {
          if (!hasCryptKey()) {
            events.emit('ui/toast', { text: 'Locked. The lock is black iron, and it is warm.' });
            return;
          }
          story.set('cryptDoorOpen', true);
          if (cryptDoor) {
            cryptDoor.object.removeFromParent();
            for (const box of cryptDoor.colliders) {
              const i = colliders.indexOf(box);
              if (i !== -1) colliders.splice(i, 1);
            }
            physics.setStaticColliders(colliders);
          }
          events.emit('ui/toast', { text: 'The black key turns with a dead click.' });
          events.emit('audio/sfx', { id: 'doorUnlock' });
        },
      },
      {
        id: 'ossuary-shrine',
        position: new THREE.Vector3(-10.9, 1, -4),
        radius: 1.5,
        prompt: 'Pray at the bones (save)',
        onInteract: () => events.emit('ui/open-save-menu'),
      },
      {
        id: 'hollow-icon',
        position: new THREE.Vector3(20, 1, 3),
        radius: 1.3,
        prompt: 'Take the Hollow Icon',
        canInteract: () => story.get('cryptDoorOpen') && !story.get('hasHollowIcon'),
        onInteract: () => {
          // Inventory first — the flag change triggers the autosave.
          inventory?.add('hollowIcon');
          story.set('hasHollowIcon', true);
          icon.removeFromParent();
          // Lifting the icon opens the ground: the trapdoor appears.
          root.add(trapdoor.object);
          events.emit('audio/sfx', { id: 'doorUnlock' });
          events.emit('ui/show-note', {
            title: 'THE HOLLOW ICON',
            body:
              'The metal squirms faintly, like a held bird.\n\n' +
              'Behind you, stone grinds against stone — a stairway exhales a ' +
              'draught of pond water and myrrh.\n\n' +
              'Somewhere beneath your feet, the ground remembers it is a mouth.',
          });
        },
      },
      // Down into the Sunken Cloister (appears with the icon).
      makeTransition(
        { story, inventory, events },
        {
          id: 'trapdoor-to-cloister',
          position: new THREE.Vector3(22.5, 1, 7),
          radius: 1.4,
          prompt: 'Descend the stair',
          targetLevel: 'sunken-cloister',
          targetSpawn: 'fromChapel',
        }
      )
    );
    // The trapdoor route only exists once the icon is taken.
    const trapdoorRoute = interactables[interactables.length - 1];
    const baseCanInteract = trapdoorRoute.canInteract;
    trapdoorRoute.canInteract = () =>
      story.get('hasHollowIcon') && (baseCanInteract?.() ?? true);

    // Old saves stored the key as a story flag; honor both.
    const hasCryptKey = () =>
      Boolean(inventory?.has('blackIronKey') || story.get('hasCryptKey'));

    /* ------------------------------ LOOT ------------------------------- */
    for (const pickup of [
      makeItemPickup(pickupCtx, {
        id: 'chapel-key',
        itemId: 'blackIronKey',
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(0.4, 1.25, -8),
          color: 0x3a3a44,
          emissive: 0x30303a,
        }),
        position: new THREE.Vector3(0.4, 1, -7.8),
        radius: 1.3,
        prompt: 'Take the Black Iron Key',
        flavor: 'Taken — BLACK IRON KEY. It is colder than the room.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'chapel-machete',
        itemId: 'rustMachete',
        mesh: (() => {
          const model = buildWeaponModel('rustMachete', kit.ps2);
          model.rotation.z = -Math.PI / 2.2; // presented blade-out
          model.position.set(-7, 0.45, -6.3);
          return model;
        })(),
        glowColor: 0xffc890,
        position: new THREE.Vector3(-7, 1, -6.3),
        prompt: 'Take the groundskeeper’s machete',
        flavor: 'Taken — RUST-EATEN MACHETE. Someone left in a hurry.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'chapel-poultice',
        itemId: 'mossPoultice',
        qty: 2,
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(2.6, 0.65, 4.6),
          color: 0x6f7d4e,
          emissive: 0x2a3a1a,
        }),
        position: new THREE.Vector3(2.6, 1, 4.6),
        prompt: 'Gather the moss poultices',
        flavor: 'Taken — MOSS POULTICE ×2, folded into a hymnal.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'corridor-shells',
        itemId: 'boneShells',
        qty: 6,
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(13.5, 0.3, 3.2),
          color: 0xc9b37a,
          emissive: 0x4a3a10,
        }),
        position: new THREE.Vector3(13.5, 1, 3.2),
        prompt: 'Search the body',
        flavor: 'Taken — TALLOW ROUNDS ×6. He never got to use them.',
      }),
    ]) {
      if (pickup) interactables.push(pickup);
    }
    // The body the shells came from.
    add(kit.corpse({ position: [13.6, 4.6], rotationY: 2.2 }));
    void shrine; // shot dressing reference retained for future shrine VFX

    /* --------------------------- CAMERA ZONES -------------------------- */
    const cameraZones = [
      // High corner surveillance shot over the pews, tracking the player.
      defineCameraZone({
        id: 'nave-main',
        min: [-6, -1, -2.5],
        max: [6, 4, 10],
        camera: [-5.2, 4.1, 8.7],
        trackTarget: true,
        trackStiffness: 3,
      }),
      // Low dutch angle at the altar — the shot leans with the wrongness.
      defineCameraZone({
        id: 'nave-altar',
        min: [-6, -1, -10],
        max: [6, 4, -2.5],
        camera: [4.4, 1.1, -9.0],
        trackTarget: true,
        trackStiffness: 5,
        rollDeg: -7,
        fovOverride: 60,
      }),
      // Vestry: fixed frame from the doorway; the shrine owns the composition.
      defineCameraZone({
        id: 'vestry',
        min: [-12, -1, -7],
        max: [-6, 3, -1],
        camera: [-6.5, 2.3, -1.5],
        lookAt: [-10.6, 0.8, -4.6],
      }),
      // One-point perspective straight down the corridor, slightly low.
      defineCameraZone({
        id: 'corridor',
        min: [6, -1, 2.5],
        max: [16, 3, 5.5],
        camera: [6.5, 1.5, 4.0],
        lookAt: [16, 1.1, 4.0],
        fovOverride: 48,
      }),
      // Crypt: floor-level wide with gravestones as foreground occluders.
      defineCameraZone({
        id: 'crypt',
        min: [16, -1, -2],
        max: [24, 3, 8],
        camera: [23.3, 0.9, 7.2],
        trackTarget: true,
        trackStiffness: 4,
        rollDeg: 4,
        fovOverride: 64,
      }),
    ];

    return {
      root,
      colliders,
      cameraZones,
      interactables,
      updatables,
      spawn: { position: new THREE.Vector3(0, 0, 8), rotationY: Math.PI },
      spawnPoints: {
        fromCloister: { position: new THREE.Vector3(21.5, 0, 6.2), rotationY: -Math.PI / 2 },
      },
      enemySpawns: [
        { type: 'wraith', position: new THREE.Vector3(21.5, 0, 5.5), homeRadius: 5.5 },
        // Opening the crypt lets something wander up into the nave.
        {
          type: 'husk',
          variant: 'twitcher',
          position: new THREE.Vector3(0.5, 0, 2),
          homeRadius: 6,
          onlyIf: 'cryptDoorOpen',
        },
      ],
      fog: { color: 0x0a0c11, density: 0.055 },
      ambientTrack: 'chapel',
      surfaces: {
        default: 'stone',
        regions: [
          { min: [-12, -7], max: [-6, -1], type: 'wood' }, // vestry
          { min: [16, -2], max: [24, 8], type: 'bone' },   // crypt
        ],
      },
    };
  },
};
