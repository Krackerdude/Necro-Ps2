import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { FlickerLight } from '../effects/FlickerLight.js';
import { FogCards } from '../effects/FogCards.js';
import { createInstancedScatter } from '../../rendering/instancing/InstancedScatter.js';
import { makeItemPickup, makeTransition, makeItemSocket, makePickupMesh } from './levelHelpers.js';
import { buildWeaponModel } from '../../assets/models/weaponModels.js';
import { readDocument } from '../../gameplay/story/documents.js';

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

/** Wing-door emblem: the shape motif, glowing faintly over each arch. */
function buildEmblem(kit, kind) {
  const group = new THREE.Group();
  const colors = { spade: 0xc9c2a8, diamond: 0x6a9ad9, clover: 0x5aa04a };
  const mat = kit.ps2.patch(
    new THREE.MeshStandardMaterial({
      color: 0x1a1a20,
      emissive: colors[kind],
      emissiveIntensity: 0.9,
      roughness: 0.6,
    })
  );
  if (kind === 'spade') {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 10), mat);
    head.rotation.x = Math.PI / 2;
    head.position.y = 0.08;
    group.add(head);
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.24, 4), mat);
    point.rotation.z = Math.PI;
    point.rotation.y = Math.PI / 4;
    point.position.y = -0.1;
    group.add(point);
  } else if (kind === 'diamond') {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.04), mat);
    pane.rotation.z = Math.PI / 4;
    group.add(pane);
  } else {
    for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
      const lobe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 8), mat);
      lobe.rotation.x = Math.PI / 2;
      lobe.position.set(Math.sin(a) * 0.11, Math.cos(a) * 0.11 + 0.04, 0);
      group.add(lobe);
    }
  }
  return group;
}

export const CHAPEL_OF_THE_HOLLOW = {
  id: 'chapel-of-the-hollow', // historical id — saves carry it
  name: 'Graven Church',

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

    // North wall opens into the crossing behind the altar.
    add(kit.wall({ from: [-6, -10], to: [-2.5, -10], height: WALL_H }));
    add(kit.wall({ from: [2.5, -10], to: [6, -10], height: WALL_H }));
    add(kit.wall({ from: [-2.5, -10], to: [2.5, -10], height: WALL_H - 3.4, yBase: 3.4, texture: 'plasterRot' }));
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

    /* ------------------------- THE CROSSING ---------------------------- */
    // The church finally has the floor plan its exterior promised: a
    // crossing behind the altar, two transept arms, and an apse — each
    // ending in a sealed wing door carved with its motif. The wings
    // themselves are the next three phases; until each ships, its door is
    // collapsed and its stone lies in the rubble within arm's reach.
    add(kit.slab({ center: [0, -15], size: [10, 10], y: 0, texture: 'stoneFloor', repeat: [5, 5] }));
    add(kit.slab({ center: [0, -15], size: [10, 10], y: WALL_H, texture: 'plasterRot', flip: true }));
    add(kit.wall({ from: [-5, -20], to: [-5, -17], height: WALL_H }));
    add(kit.wall({ from: [-5, -11], to: [-5, -10], height: WALL_H }));
    add(kit.wall({ from: [5, -20], to: [5, -17], height: WALL_H }));
    add(kit.wall({ from: [5, -11], to: [5, -10], height: WALL_H }));
    add(kit.wall({ from: [-5, -17], to: [-5, -11], height: WALL_H - 3.2, yBase: 3.2, texture: 'plasterRot' }));
    add(kit.wall({ from: [5, -17], to: [5, -11], height: WALL_H - 3.2, yBase: 3.2, texture: 'plasterRot' }));
    add(kit.wall({ from: [-5, -20], to: [-2, -20], height: WALL_H }));
    add(kit.wall({ from: [2, -20], to: [5, -20], height: WALL_H }));
    add(kit.wall({ from: [-2, -20], to: [2, -20], height: WALL_H - 3.0, yBase: 3.0, texture: 'plasterRot' }));
    for (const [cx, cz] of [[-4, -11.2], [4, -11.2], [-4, -18.8], [4, -18.8]]) {
      add(kit.pillar({ position: [cx, cz], height: WALL_H }));
    }
    add(kit.candelabra({ position: [-3.2, -15] }));
    add(kit.candelabra({ position: [3.2, -15] }));
    add(kit.banner({ position: [-3.5, -19.8], rotationY: 0, y: 4.4 }));
    add(kit.banner({ position: [3.5, -19.8], rotationY: 0, y: 4.4 }));

    // Interior stained glass: from inside, always the wrong red.
    const stained = kit.ps2.patch(
      new THREE.MeshStandardMaterial({
        color: 0x1a140e,
        roughness: 0.3,
        emissive: 0x7a1812,
        emissiveIntensity: 1.1,
      })
    );
    for (const [lx, lz, ry] of [
      [-3.5, -19.88, 0],
      [3.5, -19.88, 0],
      [-9, -16.9, 0],
      [9, -16.9, 0],
      [-9, -11.1, 0],
      [9, -11.1, 0],
    ]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.08), stained);
      pane.position.set(lx, 2.6, lz);
      pane.rotation.y = ry;
      root.add(pane);
    }

    /* ------------------------ THE TRANSEPT ARMS ------------------------ */
    // West arm (the Spade — bell tower wing) and east arm (the Diamond —
    // scriptorium wing); the apse holds the Clover (undercroft wing).
    add(kit.slab({ center: [-9, -14], size: [8, 6], y: 0, texture: 'stoneFloor', repeat: [4, 3] }));
    add(kit.slab({ center: [-9, -14], size: [8, 6], y: WALL_H, texture: 'plasterRot', flip: true }));
    add(kit.wall({ from: [-13, -17], to: [-5, -17], height: WALL_H }));
    add(kit.wall({ from: [-13, -11], to: [-5, -11], height: WALL_H }));
    add(kit.wall({ from: [-13, -17], to: [-13, -11], height: WALL_H }));
    add(kit.slab({ center: [9, -14], size: [8, 6], y: 0, texture: 'stoneFloor', repeat: [4, 3] }));
    add(kit.slab({ center: [9, -14], size: [8, 6], y: WALL_H, texture: 'plasterRot', flip: true }));
    add(kit.wall({ from: [5, -17], to: [13, -17], height: WALL_H }));
    add(kit.wall({ from: [5, -11], to: [13, -11], height: WALL_H }));
    add(kit.wall({ from: [13, -17], to: [13, -11], height: WALL_H }));

    /* ----------------------------- THE APSE ---------------------------- */
    add(kit.slab({ center: [0, -22], size: [6, 4], y: 0, texture: 'stoneFloor', repeat: [3, 2] }));
    add(kit.slab({ center: [0, -22], size: [6, 4], y: WALL_H - 1, texture: 'plasterRot', flip: true }));
    add(kit.wall({ from: [-3, -24], to: [-3, -20], height: WALL_H - 1 }));
    add(kit.wall({ from: [3, -24], to: [3, -20], height: WALL_H - 1 }));
    add(kit.wall({ from: [-3, -24], to: [3, -24], height: WALL_H - 1 }));
    add(kit.votives({ position: [-2.2, -22.6], seed: 11 }));

    /* -------------------------- THE WING DOORS ------------------------- */
    // Each: a heavy door, a rubble collapse in front of it, the motif
    // emblem above, and — TEMPORARY until its wing phase ships — that
    // wing's stone pulled loose in the rubble, so the cage stays openable
    // in this build. Wing phases replace the rubble with real transitions
    // and move the stones to the far end of their wings.
    // The Spade Wing is OPEN (phase 2): a real door into the bell tower.
    {
      const mark = buildEmblem(kit, 'spade');
      mark.position.set(-12.7, 3.6, -14);
      mark.rotation.y = Math.PI / 2;
      root.add(mark);
      const spadeLeaf = kit.door({ position: [-12.8, -14], rotationY: Math.PI / 2, width: 1.8, height: 3.0 });
      root.add(spadeLeaf.object); // leaf only — the transition owns passage
      interactables.push(
        makeTransition(
          { story, inventory, events },
          {
            id: 'to-bell-tower',
            position: new THREE.Vector3(-12.2, 1, -14),
            radius: 1.7,
            prompt: 'Enter the Bell Tower — the Spade Wing',
            targetLevel: 'bell-tower',
            targetSpawn: 'fromChurch',
            door: spadeLeaf.object,
          }
        )
      );
    }
    // The Diamond Wing is OPEN (phase 3): a real door into the scriptorium.
    {
      const mark = buildEmblem(kit, 'diamond');
      mark.position.set(12.7, 3.6, -14);
      mark.rotation.y = -Math.PI / 2;
      root.add(mark);
      const diamondLeaf = kit.door({ position: [12.8, -14], rotationY: -Math.PI / 2, width: 1.8, height: 3.0 });
      root.add(diamondLeaf.object);
      interactables.push(
        makeTransition(
          { story, inventory, events },
          {
            id: 'to-scriptorium',
            position: new THREE.Vector3(12.2, 1, -14),
            radius: 1.7,
            prompt: 'Enter the Scriptorium — the Diamond Wing',
            targetLevel: 'scriptorium',
            targetSpawn: 'fromChurch',
            door: diamondLeaf.object,
          }
        )
      );
    }
    // The Clover Wing is OPEN (phase 4): a real stair into the undercroft.
    {
      const mark = buildEmblem(kit, 'clover');
      mark.position.set(0, 3.2, -23.7);
      root.add(mark);
      const cloverLeaf = kit.door({ position: [0, -23.8], rotationY: 0, width: 1.8, height: 3.0 });
      root.add(cloverLeaf.object);
      interactables.push(
        makeTransition(
          { story, inventory, events },
          {
            id: 'to-undercroft',
            position: new THREE.Vector3(0, 1, -23.2),
            radius: 1.7,
            prompt: 'Descend to the Undercroft — the Clover Wing',
            targetLevel: 'undercroft',
            targetSpawn: 'fromChurch',
            door: cloverLeaf.object,
          }
        )
      );
    }

    /* --------------------------- SET DRESSING -------------------------- */
    // Signature landmark: the toppled saint by the south-west pews — the
    // first thing the entrance shot frames.
    add(kit.fallenStatue({ position: [-4.2, 6.8], rotationY: 0.6 }));
    // Candelabra pair flanking the altar.
    add(kit.candelabra({ position: [-1.7, -7.2] }));
    add(kit.candelabra({ position: [1.7, -7.2] }));
    // Processional banners on the north wall, framing the altar.
    add(kit.banner({ position: [-3, -9.8], rotationY: 0, y: 4.6 }));
    add(kit.banner({ position: [3, -9.8], rotationY: 0, y: 4.6 }));
    // Votives at a pillar base; an urn niche in the vestry.
    add(kit.votives({ position: [4.0, -1.6], seed: 7 }));
    add(kit.urnNiche({ position: [-11.85, -2.4], rotationY: Math.PI / 2 }));
    // Grime: soot climbing above the altar candles, damp rot at the
    // entrance, claw gouges where the crypt door was fought over.
    add(kit.wallStain({ position: [0, -9.8], y: 2.8, rotationY: 0, size: 1.6, kind: 'soot' }));
    add(kit.wallStain({ position: [-3.4, 9.8], y: 1.5, rotationY: Math.PI, size: 1.4, kind: 'damp' }));
    add(kit.wallStain({ position: [3.1, 9.8], y: 1.7, rotationY: Math.PI, size: 1.2, kind: 'damp' }));
    add(kit.wallStain({ position: [15.82, 4.6], y: 1.2, rotationY: -Math.PI / 2, size: 0.9, kind: 'scratch' }));
    add(kit.wallStain({ position: [5.82, 1.6], y: 1.3, rotationY: -Math.PI / 2, size: 1.0, kind: 'scratch' }));

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
      // The crossing and its arms — candle-warm center, red wash at the ends.
      new FlickerLight({ position: new THREE.Vector3(0, 2.2, -15), intensity: 13, distance: 12, castShadow: true }),
      new FlickerLight({ position: new THREE.Vector3(-9.5, 2.0, -14), intensity: 8, distance: 8, color: 0xc95a3a }),
      new FlickerLight({ position: new THREE.Vector3(9.5, 2.0, -14), intensity: 8, distance: 8, color: 0xc95a3a }),
      new FlickerLight({ position: new THREE.Vector3(0, 2.0, -22), intensity: 7, distance: 7, color: 0x9fdc7a }),
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

    /* ------------------------- THE WARDEN'S CAGE ----------------------- */
    // The Black Iron Key sits caged on the altar; three stone sockets at
    // the altar's foot open it. Legacy saves that already hold/spent the
    // key build the cage open and empty.
    const keyTaken = Boolean(
      story.get('took:chapel-key') || story.get('hasCryptKey') || inventory?.has('blackIronKey')
    );
    const cageIsOpen = Boolean(story.get('cageOpened') || story.get('cryptDoorOpen') || keyTaken);

    const iron = kit.material('ironDark', { metalness: 0.6, roughness: 0.55 });
    const cage = new THREE.Group();
    cage.position.set(0, 1.18, -8);
    const rim = (y) => {
      for (const [w, d, px, pz] of [[0.84, 0.06, 0, 0.39], [0.84, 0.06, 0, -0.39], [0.06, 0.84, 0.39, 0], [0.06, 0.84, -0.39, 0]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), iron);
        bar.position.set(px, y, pz);
        cage.add(bar);
      }
    };
    rim(0);
    rim(0.78);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), iron);
    top.position.y = 0.83;
    cage.add(top);
    for (const [px, pz] of [[0.39, 0.39], [0.39, -0.39], [-0.39, 0.39], [-0.39, -0.39]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), iron);
      post.position.set(px, 0.39, pz);
      cage.add(post);
    }
    // Bars: back and sides always; the front is a separate group so the
    // opened cage can lose it (live, via the flag watcher below).
    const barsFor = (face) => {
      const g = new THREE.Group();
      for (const off of [-0.2, 0, 0.2]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.74, 0.045), iron);
        if (face === 'n' || face === 's') bar.position.set(off, 0.39, face === 'n' ? -0.39 : 0.39);
        else bar.position.set(face === 'e' ? 0.39 : -0.39, 0.39, off);
        g.add(bar);
      }
      return g;
    };
    cage.add(barsFor('n'), barsFor('e'), barsFor('w'));
    const cageFront = barsFor('s');
    if (!cageIsOpen) cage.add(cageFront);
    cage.traverse((n) => (n.castShadow = true));
    root.add(cage);
    updatables.push({
      update: () => {
        if (cageFront.parent && story.get('cageOpened')) {
          cageFront.removeFromParent();
          events.emit('audio/sfx', { id: 'doorUnlock' });
        }
      },
    });

    // The key itself, visible through the bars until taken.
    const cagedKey = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 0),
      kit.material('ironDark', { emissive: 0x30303a, emissiveIntensity: 0.9 })
    );
    cagedKey.position.set(0, 1.55, -8);
    if (!keyTaken) root.add(cagedKey);
    updatables.push({
      update: (dt) => {
        if (cagedKey.parent) cagedKey.rotation.y += dt * 0.9;
      },
    });

    // Socket pedestals at the altar's foot.
    for (const px of [-1.1, 0, 1.1]) {
      const pedestal = kit.pillar({ position: [px, -7.1], radius: 0.16, height: 0.7, texture: 'stoneWall' });
      add(pedestal);
    }
    const STONES = [
      { itemId: 'stoneOfTheHour', flag: 'stoneSeated:hour', x: -1.1, name: 'the Stone of the Hour' },
      { itemId: 'stoneOfTheWord', flag: 'stoneSeated:word', x: 0, name: 'the Stone of the Word' },
      { itemId: 'stoneOfTheGround', flag: 'stoneSeated:ground', x: 1.1, name: 'the Stone of the Ground' },
    ];
    if (!cageIsOpen) {
      for (const stone of STONES) {
        interactables.push(
          makeItemSocket(
            { story, inventory, events },
            {
              id: `socket-${stone.flag}`,
              itemId: stone.itemId,
              flag: stone.flag,
              position: new THREE.Vector3(stone.x, 1, -7.1),
              radius: 1.2,
              prompt: `Seat ${stone.name}`,
              missingText: `The socket is cut for ${stone.name}. You do not have it.`,
              placedText: `${stone.name.charAt(0).toUpperCase() + stone.name.slice(1)} settles in with the sound of a held breath released.`,
              onPlaced: () => {
                if (STONES.every((st) => story.get(st.flag)) && !story.get('stonesSeated')) {
                  story.set('stonesSeated', true); // GameplayState plays the cage scene
                }
              },
            }
          )
        );
      }
    }
    interactables.push(
      {
        id: 'cage-plaque',
        position: new THREE.Vector3(-0.6, 1, -7.4),
        radius: 1.1,
        prompt: 'Read the cage’s rubric',
        onInteract: () => readDocument(events, story, 'cagePlaque'),
      },
      {
        id: 'cage-key',
        position: new THREE.Vector3(0.5, 1, -7.6),
        radius: 1.2,
        prompt: 'Take the Black Iron Key',
        canInteract: () =>
          Boolean(story.get('cageOpened') || story.get('cryptDoorOpen')) &&
          !story.get('took:chapel-key') &&
          !inventory?.has('blackIronKey'),
        onInteract: () => {
          if (inventory && !inventory.canFit('blackIronKey')) {
            events.emit('ui/toast', { text: 'Your satchel is full. The key waits. It is good at that.' });
            return;
          }
          inventory?.add('blackIronKey');
          story.set('took:chapel-key', true);
          cagedKey.removeFromParent();
          events.emit('audio/sfx', { id: 'pickup' });
          events.emit('ui/toast', { text: 'Taken — BLACK IRON KEY. It is colder than the room.' });
        },
      }
    );

    /* --------------------------- INTERACTABLES ------------------------- */
    interactables.push(
      {
        id: 'entrance-door',
        position: new THREE.Vector3(0, 1, 9.4),
        radius: 1.4,
        prompt: 'The barred doors',
        onInteract: () => {
          events.emit('ui/toast', {
            text: 'Your bar holds. Against the far side of the wood: palms, flat and patient. No knocking anymore.',
          });
        },
      },
      {
        id: 'warden-note',
        position: new THREE.Vector3(-2.6, 1, 0.7),
        radius: 1.2,
        prompt: 'Read the warden’s note',
        onInteract: () => readDocument(events, story, 'wardenNote'),
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
          if (inventory && !inventory.canFit('hollowIcon')) {
            events.emit('ui/toast', { text: 'Your satchel is full. It will not be carried loosely.' });
            return;
          }
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
      // TEMPORARY (until wing phases 2–4): each wing's stone lies loose in
      // the rubble of its collapsed door so the cage stays openable in this
      // build. The wing phases move these to the far end of their wings.
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
      makeItemPickup(pickupCtx, {
        id: 'crypt-moss',
        itemId: 'graveMoss',
        qty: 2,
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(18.4, 0.25, 6.6),
          color: 0x8fae72,
          emissive: 0x2a3a1a,
        }),
        glowColor: 0xb8e0a0,
        position: new THREE.Vector3(18.4, 1, 6.6),
        prompt: 'Gather grave moss',
        flavor: 'Taken — GRAVE MOSS ×2, growing thickest over row five.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'vestry-linen',
        itemId: 'linenStrips',
        qty: 2,
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(-9.6, 0.3, -2.2),
          color: 0xc9bd9e,
          emissive: 0x4a4232,
        }),
        position: new THREE.Vector3(-9.6, 1, -2.2),
        prompt: 'Take the altar linen',
        flavor: 'Taken — LINEN STRIPS ×2, already torn to width.',
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

    cameraZones.push(
      // The crossing: high from over the altar arch, columns framing.
      defineCameraZone({
        id: 'crossing',
        min: [-5, -1, -20],
        max: [5, 4, -10],
        camera: [-4.1, 2.5, -10.9],
        trackTarget: true,
        trackStiffness: 3,
        rollDeg: -2,
        fovOverride: 60,
      }),
      // Transept arms: one-point shots toward their sealed doors.
      defineCameraZone({
        id: 'west-transept',
        min: [-13, -1, -17],
        max: [-5, 3, -11],
        camera: [-5.4, 2.0, -11.8],
        lookAt: [-13, 1.8, -14],
        fovOverride: 50,
      }),
      defineCameraZone({
        id: 'east-transept',
        min: [5, -1, -17],
        max: [13, 3, -11],
        camera: [5.4, 2.0, -16.2],
        lookAt: [13, 1.8, -14],
        fovOverride: 50,
      }),
      // The apse: tight, low, the clover door looming.
      defineCameraZone({
        id: 'apse',
        min: [-3, -1, -24],
        max: [3, 3, -20],
        camera: [0, 2.1, -19.4],
        lookAt: [0, 1.5, -24],
        fovOverride: 54,
        priority: 1,
      })
    );

    return {
      root,
      colliders,
      cameraZones,
      interactables,
      updatables,
      spawn: { position: new THREE.Vector3(0, 0, 8), rotationY: Math.PI },
      spawnPoints: {
        fromCloister: { position: new THREE.Vector3(21.5, 0, 6.2), rotationY: -Math.PI / 2 },
        fromBellTower: { position: new THREE.Vector3(-11.2, 0, -14), rotationY: Math.PI / 2 },
        fromScriptorium: { position: new THREE.Vector3(11.2, 0, -14), rotationY: -Math.PI / 2 },
        fromUndercroft: { position: new THREE.Vector3(0, 0, -22.4), rotationY: 0 },
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
      map: {
        rooms: [
          { id: 'vestry', label: 'Vestry', min: [-12, -7], max: [-6, -1] },
          { id: 'corridor', label: 'Passage', min: [6, 2.5], max: [16, 5.5] },
          { id: 'crypt', label: 'Crypt', min: [16, -2], max: [24, 8] },
          { id: 'nave', label: 'Nave', min: [-6, -10], max: [6, 10] },
          { id: 'crossing', label: 'The Crossing', min: [-5, -20], max: [5, -10] },
          { id: 'west-arm', label: 'West Transept', min: [-13, -17], max: [-5, -11] },
          { id: 'east-arm', label: 'East Transept', min: [5, -17], max: [13, -11] },
          { id: 'apse', label: 'Apse', min: [-3, -24], max: [3, -20] },
        ],
        markers: [
          { type: 'shrine', position: [-11.2, -4] },
          { type: 'door', position: [16, 4] },
          { type: 'door', position: [22.5, 7] },
        ],
      },
    };
  },
};
