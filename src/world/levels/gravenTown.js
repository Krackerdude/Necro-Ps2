import * as THREE from 'three';
import { defineCameraZone } from '../CameraZone.js';
import { TownKit } from '../builders/TownKit.js';
import { createInstancedScatter } from '../../rendering/instancing/InstancedScatter.js';
import { makeNpc, makeItemPickup, makePickupMesh } from './levelHelpers.js';
import { Townsfolk } from '../../gameplay/npcs/Townsfolk.js';
import { FlickerLight } from '../effects/FlickerLight.js';
import { readDocument } from '../../gameplay/story/documents.js';

/**
 * GRAVEN — the harbor town, at dusk. Act I in full.
 *
 * Six districts, one continuous map (top-down, +x east, +z south; the sea
 * lies south beyond the boardwalk):
 *
 *                       z=-34 ┌────────┐  ┌──────────────┐
 *                             │  INN   │  │  CHURCHYARD  │
 *                             └──┬─────┘  │   (church,   │
 *                    MAIN STREET │  path  │    graves)   │
 *                     (houses)   ├────────┤              │
 *                             ┌──┴──┐     └──────────────┘
 *   GATE ROAD        z=0 ┌────┤bakery├────┐
 *   (the car) ───gate────┤    SQUARE      ├─┐
 *                        │   (fountain)   │ │ LANE ──► LIGHTHOUSE
 *                   z=20 └────────────────┘ │            POINT
 *                          BOARDWALK ───────┘
 *                       z=28 ═╦═══╦═  sea wall
 *                            PIERS      ~ ~ sea ~ ~
 *
 * Act I is pure exploration — no combat, no enemies, ever. The photo quest
 * threads the districts: Rosa → the inn → the harbormaster → the lighthouse
 * keeper → Father Callum → your room at the inn. Everything else is texture:
 * fourteen people, lit windows, gulls, bread. Count how kind it all is.
 */

export const GRAVEN_TOWN = {
  id: 'graven-town',
  name: 'Graven',

  build({ kit, story, inventory, events }) {
    // One map, two truths. The night build is the same town with the warmth
    // subtracted: dark windows, dead lamps, cold moon, nobody home.
    const night = Boolean(story.get('nightfall'));
    const town = new TownKit(kit, { windowsLit: !night, lampsLit: !night });
    const root = new THREE.Group();
    const colliders = [];
    const updatables = [];
    const interactables = [];

    const add = (piece) => {
      root.add(piece.object);
      colliders.push(...piece.colliders);
      return piece.object;
    };
    // Backdrop pieces render but never collide (they're beyond the walls).
    const backdrop = (piece) => root.add(piece.object);

    /* ------------------------------ GROUND ----------------------------- */
    const GRASS = { texture: 'boneDust' };
    const grassSlab = (center, size) => {
      const piece = kit.slab({ center, size, y: 0, texture: GRASS.texture, repeat: [size[0] / 2, size[1] / 2] });
      piece.object.traverse((n) => {
        if (n.material) n.material = kit.material('boneDust', { color: 0x76855c, repeat: [size[0] / 2, size[1] / 2] });
      });
      return piece;
    };
    const dirtSlab = (center, size) => {
      const piece = kit.slab({ center, size, y: 0, texture: 'stoneFloor', repeat: [size[0] / 2.5, size[1] / 2.5] });
      piece.object.traverse((n) => {
        if (n.material) n.material = kit.material('stoneFloor', { color: 0xb09a78, repeat: [size[0] / 2.5, size[1] / 2.5] });
      });
      return piece;
    };

    // Base terrain: one giant meadow under everything, so no camera ever
    // sees void past a fence — beyond it, only more Graven, then the sea.
    const meadow = grassSlab([0, -12], [160, 76]); // stops at the shoreline (z=26)
    meadow.object.position.y = -0.08;
    root.add(meadow.object);

    add(dirtSlab([-30, 11], [32, 10]));                     // gate road
    add(kit.slab({ center: [-1, 10], size: [26, 20], y: 0, texture: 'stoneFloor', repeat: [13, 10] })); // square
    add(grassSlab([-1, -3.5], [26, 7]));                    // bakery row strip
    add(kit.slab({ center: [0, -14], size: [10, 28], y: 0, texture: 'stoneFloor', repeat: [5, 14] })); // main street
    add(grassSlab([-9, -14], [8, 28]));                     // west yards
    add(grassSlab([9, -14], [8, 28]));                      // east yards
    add(kit.slab({ center: [0, -30], size: [16, 9], y: 0, texture: 'stoneFloor', repeat: [8, 4.5] })); // inn court
    add(dirtSlab([10.5, -17.5], [11, 5]));                  // church path
    add(grassSlab([25, -22], [18, 20]));                    // churchyard
    add(kit.slab({ center: [1, 24], size: [30, 8], y: 0, texture: 'stoneFloor', repeat: [15, 4] })); // boardwalk
    add(dirtSlab([24, 20], [16, 8]));                       // east lane
    add(grassSlab([39, 17], [14, 18]));                     // lighthouse point
    // Piers — barely above the tide.
    add(kit.slab({ center: [5, 34], size: [6, 12], y: 0.02, texture: 'woodPlanks', repeat: [3, 6] }));
    add(kit.slab({ center: [-6, 31], size: [4, 6], y: 0.02, texture: 'woodPlanks', repeat: [2, 3] }));

    // The sea. It is very patient.
    root.add(kit.water({ center: [10, 44], size: [140, 36], y: -0.15 }).object);
    root.add(kit.water({ center: [52, 17], size: [16, 60], y: -0.15 }).object);

    /* ---------------------------- BOUNDARIES --------------------------- */
    const fieldstone = (from, to, height = 1.15) =>
      add(kit.wall({ from, to, height, thickness: 0.35, texture: 'stoneWall' }));

    // Gate road: fences, west cap, then the gate itself.
    add(town.fence({ from: [-46, 6], to: [-14.6, 6] }));
    add(town.fence({ from: [-46, 16], to: [-14.6, 16] }));
    fieldstone([-46, 6], [-46, 16]);
    add(kit.pillar({ position: [-14, 6.8], radius: 0.5, height: 3.6 }));
    add(kit.pillar({ position: [-14, 15.2], radius: 0.5, height: 3.6 }));
    add(kit.wall({ from: [-14, 6.3], to: [-14, 15.7], height: 0.9, yBase: 3.1, texture: 'stoneWall' })); // lintel

    // Square perimeter (west + fill walls to the north row).
    fieldstone([-14, 0], [-14, 6], 2.2);
    fieldstone([-14, 16], [-14, 20], 2.2);
    fieldstone([-14, 0], [-12, 0], 2.2);
    fieldstone([-4, 0], [-2, 0], 2.2);
    // East side of the square: two houses and their fills.
    fieldstone([12, 0], [12, 2.2], 2.2);
    fieldstone([12, 7.8], [12, 10.2], 2.2);
    fieldstone([12, 15.8], [12, 20], 2.2);

    // Boardwalk edges + sea wall (gaps where the piers leave).
    fieldstone([-14, 20], [-14, 28]);
    fieldstone([-14, 28], [-8.4, 28], 0.95);
    fieldstone([-3.6, 28], [1.6, 28], 0.95);
    fieldstone([8.4, 28], [16, 28], 0.95);
    fieldstone([16, 24], [16, 28]);
    // Pier rails so nobody swims. Nobody swims here.
    add(town.fence({ from: [2.2, 28], to: [2.2, 40] }));
    add(town.fence({ from: [7.8, 28], to: [7.8, 40] }));
    add(town.fence({ from: [2.2, 40], to: [7.8, 40] }));
    add(town.fence({ from: [-7.8, 28], to: [-7.8, 34] }));
    add(town.fence({ from: [-4.2, 28], to: [-4.2, 34] }));
    add(town.fence({ from: [-7.8, 34], to: [-4.2, 34] }));

    // East lane + lighthouse point enclosure.
    add(town.fence({ from: [16, 16], to: [32, 16] }));
    fieldstone([16, 16], [16, 20]);
    fieldstone([16, 24], [32, 24], 0.95);
    fieldstone([32, 8], [32, 16]);
    add(town.fence({ from: [32, 8], to: [46, 8] }));
    add(town.fence({ from: [46, 8], to: [46, 26] }));
    fieldstone([32, 24], [32, 26]);
    fieldstone([32, 26], [46, 26], 0.95);

    // Street / inn / churchyard enclosure.
    fieldstone([-12, -28], [-12, 0], 1.3);
    fieldstone([12, -15], [12, 0], 1.3);
    fieldstone([-14, -34], [16, -34], 1.6);
    fieldstone([-12, -28], [-6.5, -28], 1.3);
    fieldstone([6.5, -28], [12, -28], 1.3);
    fieldstone([12, -28], [12, -20], 1.3);
    // Churchyard fieldstone ring (the path breaches it at z −20..−15).
    fieldstone([16, -32], [16, -20]);
    fieldstone([16, -15], [16, -12]);
    fieldstone([16, -12], [34, -12]);
    fieldstone([34, -32], [34, -12]);
    fieldstone([16, -32], [34, -32]);
    // Path walls — low, mossy, one-point-shot bait.
    fieldstone([5, -20], [16, -20], 0.85);
    fieldstone([5, -15], [16, -15], 0.85);

    /* --------------------------- THE DISTRICTS ------------------------- */

    // — Gate road: the car, and the first thing Graven shows you.
    const car = town.car({ position: [-36, 11], rotationY: Math.PI / 2, paint: 0x6e3a30 });
    add(car);
    add(town.tree({ position: [-40, 4], scale: 1.2, lean: 0.2 }));
    add(town.tree({ position: [-28, 18.5], scale: 1.05, lean: -0.14 }));
    add(town.tree({ position: [-20, 3.6], scale: 0.9, lean: 0.1 }));

    // — Town square: fountain, benches, market, the notice board.
    const basin = add(kit.pillar({ position: [-1, 10], radius: 1.7, height: 0.6, texture: 'stoneWall' }));
    basin.position.y = 0.3;
    const spire = add(kit.pillar({ position: [-1, 10], radius: 0.28, height: 2.0, texture: 'stoneWall' }));
    spire.position.y = 1.0;
    root.add(kit.water({ center: [-1, 10], size: [2.8, 2.8], y: 0.62 }).object);
    add(kit.pew({ position: [-4.4, 10], rotationY: Math.PI / 2 }));
    add(kit.pew({ position: [2.4, 10], rotationY: -Math.PI / 2 }));
    add(kit.pew({ position: [-1, 13.4], rotationY: 0 }));
    add(town.stall({ position: [5.5, 14.5], rotationY: -0.4, canopy: 0xa8493c }));
    add(town.stall({ position: [-6.5, 16.5], rotationY: 0.5, canopy: 0x4a6a52 }));
    add(town.noticeBoard({ position: [-10.5, 13.5], rotationY: Math.PI / 3 }));
    add(town.streetLamp({ position: [-5, 5], lit: true }));
    add(town.streetLamp({ position: [4, 16], lit: true }));
    add(town.tree({ position: [-11, 17.5], scale: 1.1, lean: 0.08 }));

    // The bakery — Rosa's, north side, awning and a bread stall out front.
    add(town.house({ position: [-8, -3.5], size: [8, 6], height: 3.2, tint: 0xd8c8a8, roofTint: 0x8a5240, windows: 3 }));
    add(town.stall({ position: [-4.6, 1.6], rotationY: 0.15, canopy: 0xc9a35a }));
    add(kit.banner({ position: [-8, -0.4], rotationY: 0, y: 2.9, width: 0.7, length: 1.4 }));
    // Its neighbor across the street mouth.
    add(town.house({ position: [8, -3.5], size: [8, 6], height: 3.4, tint: 0xc4b494, roofTint: 0x6a4a3a, windows: 3 }));
    // Square east houses.
    add(town.house({ position: [9.5, 5], size: [5, 5], height: 3, rotationY: -Math.PI / 2, tint: 0xcab8a2, windows: 2 }));
    add(town.house({ position: [9.5, 13], size: [5.5, 5], height: 3.3, rotationY: -Math.PI / 2, tint: 0xd2bfa0, roofTint: 0x7a4436, windows: 2 }));

    // — Boardwalk & piers.
    add(town.crates({ position: [11, 22.5], count: 5, seed: 12 }));
    add(town.crates({ position: [-11, 25.5], count: 4, seed: 41 }));
    add(town.crates({ position: [0.5, 26.6], count: 2, seed: 8 }));
    add(town.streetLamp({ position: [-2, 21], lit: true }));
    add(town.bollard({ position: [3, 39] }));
    add(town.bollard({ position: [7, 33] }));
    add(town.bollard({ position: [-5, 33.5] }));
    backdrop(town.boat({ position: [10.8, 33], rotationY: 0.35, hull: 0x5a6a72 }));
    backdrop(town.boat({ position: [-1.4, 34.5], rotationY: -0.2, hull: 0x7a5a48 }));
    backdrop(town.boat({ position: [11.5, 39.5], rotationY: 2.8, hull: 0x4a5a52 }));
    // Harbormaster's shack, door to the pier.
    add(town.house({ position: [12.8, 23.8], size: [4, 3.4], height: 2.5, rotationY: -Math.PI / 2, tint: 0x9aa4a8, roofTint: 0x4a4a52, windows: 1 }));

    // — Main street: three and two, lamps, a bench, laundry-warm windows.
    add(town.house({ position: [-8.5, -8], size: [6, 5.5], height: 3.2, rotationY: Math.PI / 2, tint: 0xd0bc9c, windows: 2 }));
    add(town.house({ position: [-8.5, -15], size: [6.5, 5.5], height: 3.6, rotationY: Math.PI / 2, tint: 0xc2ae90, roofTint: 0x8a5240, windows: 3 }));
    add(town.house({ position: [-8.5, -22], size: [6, 5.5], height: 3.1, rotationY: Math.PI / 2, tint: 0xd8c4a4, windows: 2 }));
    add(town.house({ position: [8.5, -8], size: [7, 5.5], height: 3.4, rotationY: -Math.PI / 2, tint: 0xccb694, roofTint: 0x6a4a3a, windows: 3 }));
    add(town.house({ position: [8.5, -24], size: [6, 5], height: 3, rotationY: -Math.PI / 2, tint: 0xc8b89a, windows: 2 }));
    add(kit.pew({ position: [3.6, -8.5], rotationY: -Math.PI / 2 }));
    add(town.streetLamp({ position: [-4.2, -6], lit: true }));
    add(town.streetLamp({ position: [4.2, -19] }));
    add(town.tree({ position: [-4.5, -25], scale: 0.95, lean: 0.06 }));

    // — The inn: the biggest, warmest building in town. Your room is up
    //   under the west gable. You will not spend a whole night in it.
    add(town.house({ position: [0, -31], size: [13, 7], height: 4.4, tint: 0xd8c6a2, roofTint: 0x7a4436, windows: 4 }));
    add(kit.banner({ position: [-2.6, -27.3], rotationY: 0, y: 3.8, width: 0.8, length: 1.8 }));
    add(town.streetLamp({ position: [3.2, -26.4], lit: true }));

    // — Church path & churchyard.
    add(town.tree({ position: [14, -13.4], scale: 1.15, lean: -0.1 }));
    add(town.tree({ position: [18.5, -30], scale: 1.25, lean: 0.12 }));
    add(town.tree({ position: [31.5, -14.5], scale: 1.0, lean: -0.08 }));
    // The church: tall, patient, facing west down its own yard.
    add(town.house({
      position: [27, -24], size: [9, 13], height: 5.2, rotationY: -Math.PI / 2,
      tint: 0xcfc4ae, roofTint: 0x54443c, windows: 3, lit: !night,
    }));
    const tower = add(kit.pillar({ position: [21.5, -29.5], radius: 1.1, height: 10, texture: 'plasterRot' }));
    tower.castShadow = true;
    const towerCap = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 1.8, 6),
      kit.material('woodPlanks', { color: 0x54443c })
    );
    towerCap.position.set(21.5, 10.9, -29.5);
    root.add(towerCap);
    // Tall lancet windows either side of the doors, lit from evensong.
    const lancetGlass = kit.ps2.patch(
      new THREE.MeshStandardMaterial({
        color: 0x241d16,
        roughness: 0.35,
        emissive: night ? 0x7a1812 : 0xd98d3a,
        emissiveIntensity: night ? 1.3 : 0.9,
      })
    );
    for (const z of [-21.2, -26.8]) {
      const lancet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.8), lancetGlass);
      lancet.position.set(20.45, 3.1, z);
      root.add(lancet);
    }
    add(kit.votives({ position: [20.6, -22], seed: 3 }));
    add(kit.wallStain({ position: [20.44, -24], y: 4.2, rotationY: -Math.PI / 2, size: 1.4, kind: 'damp' }));
    // Graves. Read the dates later, when you know what to look for.
    const grave = kit.gravestoneTemplate();
    root.add(
      createInstancedScatter(
        grave.geometry,
        grave.material,
        [
          { position: new THREE.Vector3(18.5, 0, -17.5), rotationY: 0.15 },
          { position: new THREE.Vector3(20.2, 0, -16.2), rotationY: -0.1, scale: 0.9 },
          { position: new THREE.Vector3(22.4, 0, -17.8), rotationY: 0.3 },
          { position: new THREE.Vector3(25.0, 0, -16.0), rotationY: -0.25, scale: 1.1 },
          { position: new THREE.Vector3(27.6, 0, -17.2), rotationY: 0.08, scale: 0.85 },
          { position: new THREE.Vector3(30.2, 0, -16.4), rotationY: -0.2 },
          { position: new THREE.Vector3(31.8, 0, -18.6), rotationY: 0.4, scale: 0.95 },
          { position: new THREE.Vector3(18.8, 0, -20.8), rotationY: -0.12, scale: 1.05 },
        ],
        { castShadow: true }
      )
    );

    // — East lane & lighthouse point.
    add(town.crates({ position: [18, 22.6], count: 3, seed: 77 }));
    add(town.streetLamp({ position: [26, 17.4] }));
    add(kit.rubble({ position: [34.5, 10], seed: 19, count: 7, solid: true }));
    add(kit.rubble({ position: [43.5, 22.5], seed: 5, count: 5, solid: true }));
    add(town.lighthouse({ position: [39, 14.5] }));
    add(town.house({ position: [33.5, 20.5], size: [4.5, 4], height: 2.6, rotationY: Math.PI / 2, tint: 0xd8d0c0, roofTint: 0x9c3a30, windows: 2 }));
    add(town.tree({ position: [44, 11], scale: 0.85, lean: 0.3 }));

    // — Backdrop: rooftops beyond the walls, so the town keeps going.
    backdrop(town.house({ position: [-19, -8], size: [7, 6], height: 3.4, tint: 0xbcae92, windows: 0, door: false }));
    backdrop(town.house({ position: [16.5, 3], size: [7, 6], height: 3.8, rotationY: 0.3, tint: 0xc8b89a, windows: 0, door: false }));
    backdrop(town.house({ position: [-18, 24], size: [6, 5], height: 3, rotationY: -0.2, tint: 0xb4a68c, windows: 0, door: false }));
    backdrop(town.house({ position: [24, 8], size: [6, 8], height: 3.6, rotationY: 0.1, tint: 0xd0bc9c, windows: 0, door: false }));
    backdrop(town.tree({ position: [-16, -20], scale: 1.3 }));
    backdrop(town.tree({ position: [14, -35.5], scale: 1.2 }));

    /* ---------------------------- LIGHTING ----------------------------- */
    if (!night) {
      root.add(new THREE.AmbientLight(0x9a8878, 2.2));
      root.add(new THREE.HemisphereLight(0x87a3c9, 0xa07850, 1.6));
      const sun = new THREE.DirectionalLight(0xffc27d, 3.0);
      sun.position.set(-34, 20, 18);
      sun.target.position.set(8, 0, -8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -55;
      sun.shadow.camera.right = 55;
      sun.shadow.camera.top = 55;
      sun.shadow.camera.bottom = -55;
      root.add(sun, sun.target);
    } else {
      root.add(new THREE.AmbientLight(0x232a3a, 1.8));
      root.add(new THREE.HemisphereLight(0x2a3448, 0x14121a, 1.1));
      const moon = new THREE.DirectionalLight(0x63719b, 2.0);
      moon.position.set(24, 26, 8);
      moon.target.position.set(0, 0, -8);
      moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      moon.shadow.camera.left = -55;
      moon.shadow.camera.right = 55;
      moon.shadow.camera.top = 55;
      moon.shadow.camera.bottom = -55;
      root.add(moon, moon.target);
    }

    /* ---------------------------- TOWNSFOLK ---------------------------- */
    const npcCtx = { root, ps2: kit.ps2, events, updatables, colliders };
    const q = (flag) => Boolean(story.get(flag));
    const setOnce = (flag) => () => {
      if (!story.get(flag)) story.set(flag, true);
    };
    const hasPhoto = () => Boolean(inventory?.has('mikesPhotograph'));

    if (!night) interactables.push(
      /* ------------------------ THE QUEST FIVE ----------------------- */
      makeNpc(npcCtx, {
        id: 'rosa',
        name: 'Rosa, the baker',
        position: new THREE.Vector3(-4.8, 0, 2.6),
        facing: Math.PI * 0.85,
        outfit: 'dress',
        apron: true,
        hair: 'bun',
        build: 1.12,
        palette: { coat: 0xc9b78a, skin: 0xd0a888, skirt: 0x8a5a48, apron: 0xe8e0cc, hair: 0x6a5644 },
        lines: () => {
          if (q('quest:rosa'))
            return [
              'The inn, love. Straight up the street, the big place with the red roof. Tobias will remember your friend — Tobias remembers everyone’s breakfast order from the last ten years.',
              'And take a loaf with you. You’ve the look of a man who forgets to eat when he’s worried.',
            ];
          if (!hasPhoto())
            return [
              'Off the evening boat, are you? No — the road? Nobody comes by the road anymore. Well. Almost nobody.',
              'You’ve the look of a man searching for something. When you find your tongue, come back and see Rosa.',
            ];
          return [
            'Off the road, are you? You have the look — half salt, half paper. Here, stand in the light.',
            '...',
            'Oh. Oh, I know this face. The camera boy! Michael. He stood right where you’re standing and photographed my bread like it was a bride.',
            'Near a year ago, that was. He took the corner room at the inn — the one with the harbor view. Ask Tobias, the innkeeper. Up the street, red roof, can’t miss it.',
            'Such a sweet boy. He said he was only staying the week.',
          ];
        },
        onComplete: () => {
          if (hasPhoto() && !q('quest:rosa')) story.set('quest:rosa', true);
        },
      }),
      makeNpc(npcCtx, {
        id: 'tobias',
        name: 'Tobias, the innkeeper',
        position: new THREE.Vector3(1.8, 0, -26.4),
        facing: Math.PI,
        hair: 'bald',
        beard: true,
        vest: true,
        build: 1.18,
        palette: { coat: 0x8a7458, skin: 0xc9a082, legs: 0x3a3028, vest: 0x5c2c30, beard: 0x9a9088 },
        lines: () => {
          if (q('quest:priest'))
            return [
              'There you are. Rosa sent bread up, the fire’s lit, and the corner room is yours — same one your friend had. The harbor view.',
              'Sleep well, friend. The bell will ring at dusk. Pay it no mind. It’s only custom.',
            ];
          if (q('quest:inn'))
            return [
              'Aldous will be down on the long pier — he practically sleeps standing up down there. Go on, I’ll air out your room while you’re about it.',
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
            'His things are still boxed in my cellar. Nobody came for them. Until now, I suppose.',
          ];
        },
        onComplete: () => {
          if (q('quest:rosa') && !q('quest:inn')) story.set('quest:inn', true);
        },
      }),
      makeNpc(npcCtx, {
        id: 'aldous',
        name: 'Aldous, harbormaster',
        position: new THREE.Vector3(5, 0, 31.5),
        facing: Math.PI,
        hair: 'hat',
        beard: true,
        palette: { coat: 0x3a4a5c, skin: 0xb89878, legs: 0x2a2a30, hat: 0x1e222a, beard: 0xb0a898 },
        lines: () => {
          if (q('quest:harbor'))
            return [
              'The lighthouse walk is east off the boardwalk, past the lane. Edda keeps the light. Mind the sea wall as you go — tide’s coming up.',
            ];
          if (!q('quest:inn'))
            return [
              'Mind the sea wall. Tide comes up fast after dark, and nobody swims here. Nobody has for years.',
              'Your car’s the last thing in until Thursday’s boat. Whatever business you came for, you’ve got the week for it.',
            ];
          return [
            'Tobias sent you about the camera fellow. Aye. I’ve been waiting a year for someone to ask.',
            'Every soul that leaves Graven leaves through this harbor, and I write every one of them down. I wrote your friend IN. I never wrote him OUT. The ledger doesn’t lie — you can read it yourself, it’s in the shack.',
            'Last I saw him, he’d given up on boats altogether. Spent his days out on the point, by the lighthouse, with that camera of his aimed back at the town. At the church, mostly.',
            'Edda keeps the light. She fed him tea for a week. If anyone knows his mind, it’s her.',
          ];
        },
        onComplete: () => {
          if (q('quest:inn') && !q('quest:harbor')) story.set('quest:harbor', true);
        },
      }),
      makeNpc(npcCtx, {
        id: 'edda',
        name: 'Edda, the keeper',
        position: new THREE.Vector3(36.8, 0, 17.6),
        facing: -Math.PI / 2,
        outfit: 'dress',
        hair: 'long',
        build: 0.94,
        palette: { coat: 0x8a8296, skin: 0xcaa88c, skirt: 0x5a5a6c, hair: 0xb8b4ac },
        lines: () => {
          if (q('quest:lighthouse'))
            return [
              'The church, love. Up the path off the main street. Ask Father Callum what your friend’s camera saw. Watch his hands while he answers you.',
            ];
          if (!q('quest:harbor'))
            return [
              'Careful on the rocks. The light’s for ships, not for feet.',
              'Fine evening, though. They’re all fine evenings here. That’s the thing about Graven — the weather minds its manners.',
            ];
          return [
            'So you’re the one he wrote to. He said you’d come. He said it like an apology.',
            'Michael sat where you’re standing for six days with his lens on the town. Not the sea, mind — the town. The church, mostly. He’d wait for dusk, for the bell, and photograph the folk walking up the hill to it.',
            'The seventh day he came up here white as a gull and asked me what the church does AFTER the doors shut. I told him nothing. Singing. He showed me a photograph and asked me again, and I told him to burn it.',
            'He went to put his questions to Father Callum instead. That was the last conversation I ever had with him.',
            'Go to the church if you must. But when the bell rings tonight — be indoors, and be nobody’s guest but the inn’s.',
          ];
        },
        onComplete: () => {
          if (q('quest:harbor') && !q('quest:lighthouse')) story.set('quest:lighthouse', true);
        },
      }),
      makeNpc(npcCtx, {
        id: 'callum',
        name: 'Father Callum',
        position: new THREE.Vector3(19.8, 0, -23.6),
        facing: -Math.PI / 2,
        outfit: 'robe',
        hair: 'bald',
        build: 0.88,
        palette: { coat: 0x26222a, skin: 0xd8b494 },
        lines: () => {
          if (q('quest:priest'))
            return [
              'Rest, friend. The inn keeps a good room and Tobias keeps a better fire. Whatever your friend was to you, let the night hold it a while.',
              'The bell will tell you when it’s time.',
            ];
          if (!q('quest:lighthouse'))
            return [
              'Evensong is done, but the doors of the heart keep no hours. Walk in the yard as long as you like.',
              'A visitor is a gift. Graven has always been generous with its gifts, and generosity must be answered.',
            ];
          return [
            'Ah. Edda’s pilgrim. Yes, she would send you up the hill — she’s never trusted a building taller than her light.',
            'Michael. I’ll speak plainly, since you’ve walked the whole town for it. He came to me with photographs of my own congregation and asked me what they were walking INTO. As if a church were a mouth.',
            'I told him what I’ll tell you: the bell rings, the town gathers, the town gives thanks, the town goes home. It is the oldest kindness we have.',
            'He left on the coast road the next morning, before the light. No boat, no goodbye. Young men are like that — they arrive like weather and leave like it too.',
            '...Though his car never left, did it. Forgive me. It’s late. Take your rest at the inn, friend — the room will hold answers better than the yard will. And when the bell rings, be where warm things are.',
          ];
        },
        onComplete: () => {
          if (q('quest:lighthouse') && !q('quest:priest')) story.set('quest:priest', true);
        },
      }),

      /* ------------------------- THE TEXTURE NINE -------------------- */
      makeNpc(npcCtx, {
        id: 'maren',
        name: 'Maren',
        position: new THREE.Vector3(-3.2, 0, 12.2),
        facing: -0.5,
        outfit: 'dress',
        hair: 'bun',
        build: 0.92,
        palette: { coat: 0x4a3a4c, skin: 0xc9a68a, skirt: 0x3c3040, hair: 0xa8a4a0 },
        lines: [
          'I sit here every evening. My husband is in the churchyard, my son is — my son is with the church. There’s a difference. You’ll learn it.',
          'The fountain used to run clear as glass. Now look. Every year the water remembers a little less about being water.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'petr',
        name: 'Petr, fisherman',
        position: new THREE.Vector3(5.6, 0, 38),
        facing: Math.PI,
        hair: 'cap',
        beard: true,
        build: 1.08,
        palette: { coat: 0x6a6a52, skin: 0xb89070, legs: 0x3a4048, hat: 0x3a3e34, beard: 0x5a4634 },
        lines: [
          'Caught nothing all week. Doesn’t worry me. The fish come back after the thanksgiving — fat, too. Always do.',
          'Funny thing, the sea here. Never takes a boat, never takes a swimmer. Like it’s been told we’re spoken for.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'signe',
        name: 'Signe',
        position: new THREE.Vector3(-6, 0, 31.5),
        facing: 0.4,
        outfit: 'dress',
        hair: 'long',
        palette: { coat: 0x7a4a52, skin: 0xd0a888, skirt: 0x5c3a40, hair: 0x2e2620 },
        lines: [
          'Mending nets, always mending. The holes come back bigger every season and nobody asks what makes them.',
          'You’re staying the night? Good. The inn’s the warmest roof in town. Shut the shutters anyway. For the draught, I mean. The draught.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'ilsa',
        name: 'Ilsa, at the stall',
        position: new THREE.Vector3(5.8, 0, 13.2),
        facing: -2.4,
        outfit: 'dress',
        apron: true,
        hair: 'bun',
        palette: { coat: 0x8a6a3c, skin: 0xc9a68a, skirt: 0x6a5230, apron: 0x4a6a52, hair: 0x38302a },
        lines: [
          'Preserves, candles, wool. Everything a body needs to be comfortable, and comfort is the whole art of living here.',
          'Take a candle for your room, no charge. The inn’s lamps are fine but a flame you lit yourself is better company. My mother used to say that. Everyone’s mother here used to say that.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'brammel',
        name: 'Old Brammel',
        position: new THREE.Vector3(3.2, 0, -9.4),
        facing: -Math.PI / 2,
        hair: 'cap',
        beard: true,
        vest: true,
        build: 0.86,
        palette: { coat: 0x4a4438, skin: 0xb89878, legs: 0x3a352c, hat: 0x4c463c, vest: 0x3a3428, beard: 0xd8d4cc },
        lines: [
          'Eighty-one years in this town, boy. Eighty-one thanksgivings. You know what I’ve learned? Gratitude keeps you. Gratitude keeps you a long, long time.',
          'My father made it to a hundred and four. His father, older still. Good ground here. Good, generous ground. It only asks the once a year.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'yuri',
        name: 'Yuri, dockhand',
        position: new THREE.Vector3(9.6, 0, 24.8),
        facing: -1.2,
        hair: 'cap',
        vest: true,
        build: 1.16,
        palette: { coat: 0x3c4a3e, skin: 0xc0a080, legs: 0x2e2e34, hat: 0x2a2e2a, vest: 0x50423a },
        lines: [
          'Crates in, crates in, never crates out. Town eats well for a place that sells nothing to anybody.',
          'Don’t lift with your back. And don’t be out past the bell — the boss docks pay for it. Everyone docks something for it.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'wren',
        name: 'Wren, the sexton',
        position: new THREE.Vector3(26, 0, -15.8),
        facing: Math.PI,
        hair: 'hat',
        build: 0.88,
        palette: { coat: 0x38342e, skin: 0xb8987c, legs: 0x2c2a26, hat: 0x1c1a16 },
        lines: [
          'Mind the plots. Fresh-turned, some of them. We plant shallow in Graven — old custom. The ground prefers it.',
          'You’ll notice the stones only carry birth years. Saves carving. Around here the other date is more of a... communal arrangement.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'ana',
        name: 'Ana',
        position: new THREE.Vector3(1.6, 0, 7.6),
        facing: 2.6,
        scale: 0.62,
        outfit: 'dress',
        hair: 'long',
        palette: { coat: 0xa85a4c, skin: 0xd8b494, skirt: 0x8a4038, hair: 0x2e2018 },
        lines: [
          'We’re playing bell. I ring, and Piet has to lie down in the grass and be thankful. Then it’s my turn to be thankful.',
          'You can play too if you want! Everyone plays on thanksgiving. Even the grown-ups. ESPECIALLY the grown-ups.',
        ],
      }),
      makeNpc(npcCtx, {
        id: 'piet',
        name: 'Piet',
        position: new THREE.Vector3(3.2, 0, 8.4),
        facing: -2.8,
        scale: 0.58,
        hair: 'short',
        palette: { coat: 0x4a5a7c, skin: 0xd0a888, legs: 0x4a4a52, hair: 0xc9b070 },
        lines: [
          'I’m ALWAYS thankful, that’s why I’m best at the game. Ana peeks. You’re not supposed to peek when the bell rings.',
          'Grandma says if you peek, the church notices you. I want to be noticed! Ana says I don’t. Ana peeked once and cried.',
        ],
      }),
    );

    /* -------------------------- INTERACTABLES -------------------------- */
    const pickupCtx = { root, story, inventory, events, updatables };

    interactables.push(
      // Your things, on the passenger seat. Everything starts here.
      makeItemPickup(pickupCtx, {
        id: 'car-photograph',
        itemId: 'mikesPhotograph',
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(-36, 0.95, 12.4),
          color: 0xd8cfae,
          emissive: 0x554a2a,
        }),
        position: new THREE.Vector3(-36, 1, 12.4),
        radius: 1.6,
        prompt: 'Take Mike’s photograph from the seat',
        flavor: 'Taken — MIKE’S PHOTOGRAPH. The corners have gone soft.',
      }),
      {
        id: 'car-letter',
        position: new THREE.Vector3(-37.5, 1, 11),
        radius: 1.7,
        prompt: 'Read Mike’s letter again',
        onInteract: () => readDocument(events, story, 'mikesLetter'),
      },
      {
        id: 'notice-board',
        position: new THREE.Vector3(-10.5, 1, 13.5),
        radius: 1.5,
        prompt: 'Read the parish notice',
        onInteract: () => readDocument(events, story, 'townNotice'),
      },
      {
        id: 'harbor-ledger',
        position: new THREE.Vector3(11.4, 1, 23.8),
        radius: 1.5,
        prompt: 'Read the harbor ledger',
        onInteract: () => readDocument(events, story, 'harborLedger'),
      },
      {
        id: 'fountain',
        position: new THREE.Vector3(-1, 1, 12.4),
        radius: 1.8,
        prompt: 'Look into the fountain',
        onInteract: () => {
          events.emit('ui/toast', {
            text: 'Dark water for such a bright evening. Coins on the bottom — none of them silver.',
          });
        },
      },
      {
        id: 'bakery-door',
        position: new THREE.Vector3(-8, 1, -0.2),
        radius: 1.4,
        prompt: 'The bakery door',
        onInteract: () => {
          events.emit('ui/toast', { text: 'The ovens are banked for the night. Rosa is right there anyway.' });
        },
      },
      {
        id: 'church-door',
        position: new THREE.Vector3(22.2, 1, -24),
        radius: night ? 2.2 : 1.6,
        prompt: () => (night ? (q('chaseStarted') ? 'THE DOORS' : 'The church doors') : 'The church doors'),
        onInteract: () => {
          if (!night) {
            events.emit('ui/toast', {
              text: 'Shut, and warmer than wood should be. Inside, very faintly: singing. Evensong ended an hour ago.',
            });
            return;
          }
          if (!q('chaseStarted')) {
            events.emit('ui/toast', { text: 'Shut fast. The singing has stopped. Everything has stopped.' });
            return;
          }
          // Inside. Bar them. (The barring plays over the chapel arrival.)
          story.set('doorsBarred', true);
          events.emit('level/transition', { levelId: 'chapel-of-the-hollow' });
        },
      },
      {
        id: 'keeper-door',
        position: new THREE.Vector3(35.8, 1, 20.5),
        radius: 1.4,
        prompt: 'The keeper’s cottage',
        onInteract: () => {
          events.emit('ui/toast', { text: 'Edda’s door. Her kettle is already singing for two.' });
        },
      },
      // The inn door — Act I ends here, on purpose, in a warm bed.
      {
        id: 'inn-door',
        position: new THREE.Vector3(0, 1, -27),
        radius: 1.7,
        prompt: () =>
          night ? 'The inn' : q('quest:priest') ? 'Turn in for the night' : 'The Gull & Anchor',
        onInteract: () => {
          if (night) {
            events.emit('ui/toast', {
              text: 'Locked. Behind the door, where the fire was: nothing at all.',
            });
            return;
          }
          if (!q('quest:priest')) {
            events.emit('ui/toast', {
              text: 'Tobias, through the doorway: “Room’s airing out, friend! See the town — I’ll wave you in when it’s ready.”',
            });
            return;
          }
          // Act I ends in a warm bed. What happens next is not Act I.
          story.set('sleptAtInn', true);
          story.set('nightfall', true);
          events.emit('level/transition', { levelId: 'graven-town', spawn: 'innDoor' });
        },
      },
      // Optional sustenance.
      makeItemPickup(pickupCtx, {
        id: 'bakery-bread',
        itemId: 'freshBread',
        qty: 2,
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(-4.6, 1.25, 1.6),
          color: 0xc9a35a,
          emissive: 0x4a3210,
        }),
        glowColor: 0xffe0a0,
        position: new THREE.Vector3(-4.6, 1, 1.6),
        radius: 1.3,
        prompt: 'Take the loaves Rosa nods at',
        flavor: 'Taken — FRESH BREAD ×2. “For the road,” she says. Which road?',
      }),
      makeItemPickup(pickupCtx, {
        id: 'boardwalk-poultice',
        itemId: 'mossPoultice',
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(-10.6, 0.4, 24.4),
          color: 0x6f7d4e,
          emissive: 0x2a3a1a,
        }),
        position: new THREE.Vector3(-10.6, 1, 24.4),
        prompt: 'Take the fisherman’s kit',
        flavor: 'Taken — MOSS POULTICE, wedged behind the crates with someone’s initials on it.',
      }),
      makeItemPickup(pickupCtx, {
        id: 'keeper-tonic',
        itemId: 'graveTonic',
        mesh: makePickupMesh(kit, {
          position: new THREE.Vector3(34.6, 0.4, 22.6),
          color: 0x8a4a42,
          emissive: 0x3a1210,
        }),
        glowColor: 0xffb0a0,
        position: new THREE.Vector3(34.6, 1, 22.6),
        prompt: 'Take the bottle from the sill',
        flavor: 'Taken — GRAVE TONIC. The label says, in a careful hand: FOR THE VISITOR.',
      })
    );

    /* ------------------------------ NIGHT ------------------------------ */
    if (night) {
      // The pit. It was not in the churchyard this afternoon.
      const pit = new THREE.Mesh(
        new THREE.CircleGeometry(1.9, 12),
        kit.ps2.patch(new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 1 }))
      );
      pit.rotation.x = -Math.PI / 2;
      pit.position.set(25, 0.03, -20.5);
      root.add(pit);
      root.add(kit.rubble({ position: [25, -20.5], seed: 66, count: 9, spread: 2.3 }).object);

      if (!story.get('windowSceneSeen')) {
        // The congregation, mid-thanksgiving. Subjects of the window scene;
        // the re-transition after it clears them away.
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const x = 25 + Math.cos(a) * 3.7;
          const z = -20.5 + Math.sin(a) * 3.7;
          const witness = new Townsfolk(kit.ps2, {
            position: new THREE.Vector3(x, 0, z),
            facing: Math.atan2(25 - x, -20.5 - z),
            hair: i % 3 === 0 ? 'bun' : i % 2 === 0 ? 'short' : 'bald',
            outfit: i % 2 === 0 ? 'dress' : 'coat',
            palette: { coat: [0x3a3440, 0x443a34, 0x343e3a, 0x3e3644][i % 4], skin: 0xb0a090 },
          });
          root.add(witness.object);
          updatables.push(witness);
        }
        for (const [x, z] of [[22.2, -18.6], [27.8, -22.4]]) {
          const torch = new FlickerLight({
            position: new THREE.Vector3(x, 1.6, z),
            intensity: 11,
            distance: 9,
            color: 0xd9803a,
          });
          root.add(torch.light);
          updatables.push(torch);
        }
      }

      // Mike. Or the shape the town lets you have of him.
      if (story.get('windowSceneSeen') && !story.get('mikeSeen')) {
        const mike = new Townsfolk(kit.ps2, {
          position: new THREE.Vector3(-1, 0, 5.4),
          facing: Math.PI * 0.9,
          hair: 'short',
          palette: { coat: 0x9ab0c9, skin: 0xdde8f0, legs: 0x8a9ab0, hair: 0x4a5866 },
        });
        const ghostMats = [];
        mike.object.traverse((n) => {
          if (n.material) {
            n.material.transparent = true;
            n.material.opacity = 0.55;
            n.material.emissive = new THREE.Color(0x50687f);
            n.material.emissiveIntensity = 0.45;
            ghostMats.push(n.material);
          }
        });
        root.add(mike.object);
        let mikePhase = 0;
        let mikeBeat = -1; // -1 waiting; >= 0 seconds since the approach
        updatables.push({
          update: (dt) => {
            if (!mike.object.parent) return;
            mike.update(dt);
            mikePhase += dt;
            const flicker = 0.45 + Math.sin(mikePhase * 9) * 0.08 + Math.sin(mikePhase * 1.3) * 0.08;
            for (const m of ghostMats) m.opacity = flicker;
            if (mikeBeat < 0) return;
            mikeBeat += dt;
            if (mikeBeat > 1.4 && mikeBeat - dt <= 1.4) {
              events.emit('ui/caption', { text: 'He is pointing at the church.' });
            }
            if (mikeBeat > 3.6) {
              events.emit('ui/caption', { text: null });
              events.emit('audio/sfx', { id: 'stingerKill' });
              mike.object.removeFromParent();
              story.set('mikeSeen', true);
            }
          },
        });
        interactables.push({
          id: 'mike-apparition',
          position: new THREE.Vector3(-1, 1, 5.4),
          radius: 4.2,
          prompt: '— Mike?',
          canInteract: () => mikeBeat < 0,
          onInteract: () => {
            mikeBeat = 0;
            mike.pointAt(new THREE.Vector3(20, 1, -18));
            events.emit('audio/sfx', { id: 'stingerDetect' });
            events.emit('ui/caption', { text: 'MIKE —' });
          },
        });
      }

      // Rosa, at the mouth of the church path, facing the wrong way.
      if (story.get('windowSceneSeen') && !story.get('chaseStarted')) {
        const rosaNight = new Townsfolk(kit.ps2, {
          position: new THREE.Vector3(7, 0, -17.5),
          facing: Math.PI / 2, // her back to the street
          outfit: 'dress',
          apron: true,
          hair: 'bun',
          build: 1.12,
          palette: { coat: 0x8a7c62, skin: 0xb0a090, skirt: 0x5c4038, apron: 0x9a9484, hair: 0x5a4a3c },
        });
        root.add(rosaNight.object);
        updatables.push(rosaNight);
        let revealBeat = -1;
        let jawAttached = false;
        updatables.push({
          update: (dt) => {
            if (revealBeat < 0 || !rosaNight.object.parent) return;
            revealBeat += dt;
            if (revealBeat > 0.9 && !jawAttached) {
              jawAttached = true;
              // The smile goes all the way down.
              const jaw = new THREE.Mesh(
                new THREE.BoxGeometry(0.16, 0.22, 0.08),
                kit.ps2.patch(
                  new THREE.MeshStandardMaterial({
                    color: 0x2a0505,
                    emissive: 0x6a0a0a,
                    emissiveIntensity: 0.9,
                    roughness: 1,
                  })
                )
              );
              jaw.position.set(0, -0.12, 0.1);
              rosaNight.head.add(jaw);
              events.emit('audio/sfx', { id: 'wraithShriek' });
              events.emit('camera/impulse', { strength: 0.6 });
              events.emit('ui/caption', { text: '“You looked.”' });
            }
            if (revealBeat > 2.6) {
              events.emit('ui/caption', { text: null });
              rosaNight.object.removeFromParent();
              story.set('chaseStarted', true); // the roster re-checks onlyIf live
            }
          },
        });
        interactables.push({
          id: 'rosa-night',
          position: new THREE.Vector3(7, 1, -17.5),
          radius: 2.6,
          prompt: '…Rosa?',
          canInteract: () => q('mikeSeen') && revealBeat < 0,
          onInteract: () => {
            revealBeat = 0;
            rosaNight.faceToward(new THREE.Vector3(4, 0, -17.5));
          },
        });
      }
    }

    /* -------------------------- CAMERA ZONES --------------------------- */
    // The town is shot kindly: higher, warmer, wider than the chapel ever
    // will be. Same grammar, different intent — postcards, not surveillance.
    const cameraZones = [
      // One-point down the coast road: car foreground, gate waiting.
      defineCameraZone({
        id: 'gate-road',
        min: [-46, -1, 6],
        max: [-14, 4, 16],
        camera: [-43.5, 1.9, 8.6],
        lookAt: [-14, 1.6, 12],
        fovOverride: 52,
      }),
      // Arrival: the square opens up, fountain center, bakery beyond.
      defineCameraZone({
        id: 'square-west',
        min: [-14, -1, 0],
        max: [-4, 4, 20],
        camera: [-3, 3.6, 17],
        trackTarget: true,
        trackStiffness: 3,
        fovOverride: 60,
      }),
      defineCameraZone({
        id: 'square-east',
        min: [-4, -1, 0],
        max: [12, 4, 20],
        camera: [1.5, 5.2, 22.5], // high over the sea wall — nothing tall south
        trackTarget: true,
        trackStiffness: 3,
        fovOverride: 56,
      }),
      // Bakery row: low and close, awnings overhead.
      defineCameraZone({
        id: 'bakery-row',
        min: [-14, -1, -8],
        max: [12, 4, 0],
        camera: [1.6, 2.3, 4.2],
        trackTarget: true,
        trackStiffness: 3.5,
        rollDeg: -2,
        fovOverride: 60,
      }),
      // Boardwalk: wide from the west end, sea and masts behind the player.
      defineCameraZone({
        id: 'boardwalk',
        min: [-14, -1, 20],
        max: [16, 4, 28],
        camera: [-11.5, 3.4, 21.2],
        trackTarget: true,
        trackStiffness: 3,
        fovOverride: 62,
      }),
      // Long pier: one-point straight down the planks, low, boats flanking.
      defineCameraZone({
        id: 'pier-main',
        min: [1, -1, 28],
        max: [9, 4, 41],
        camera: [2.7, 1.7, 28.2],
        lookAt: [5.8, 0.9, 40],
        fovOverride: 50,
      }),
      defineCameraZone({
        id: 'pier-stub',
        min: [-9, -1, 28],
        max: [-3, 4, 35],
        camera: [-2.4, 1.9, 28.6],
        lookAt: [-6.4, 0.8, 33.5],
        fovOverride: 56,
      }),
      // Main street in two shots — south half looks up toward the inn.
      defineCameraZone({
        id: 'street-south',
        min: [-5, -1, -13],
        max: [5, 4, 0],
        camera: [-2.2, 3.3, 1.4],
        trackTarget: true,
        trackStiffness: 3,
        fovOverride: 54,
      }),
      defineCameraZone({
        id: 'street-north',
        min: [-5, -1, -28],
        max: [5, 4, -13],
        camera: [3.8, 2.9, -11.6],
        trackTarget: true,
        trackStiffness: 3,
        rollDeg: 1.5,
        fovOverride: 56,
      }),
      // Inn forecourt: the warm facade owns the frame.
      defineCameraZone({
        id: 'inn-court',
        min: [-8, -1, -34],
        max: [8, 4, -26],
        camera: [-5.8, 2.5, -25.2],
        lookAt: [0.6, 2.0, -30],
        fovOverride: 58,
        priority: 1,
      }),
      // Church path: one-point between the low walls.
      defineCameraZone({
        id: 'church-path',
        min: [5, -1, -20],
        max: [16, 4, -14],
        camera: [5.4, 2.1, -17.4],
        lookAt: [16, 1.6, -17.6],
        fovOverride: 50,
      }),
      // Churchyard: fixed frame from the yard gate — the church front, the
      // tower, the graves. The composition owns this one, not the player.
      defineCameraZone({
        id: 'churchyard',
        min: [16, -1, -32],
        max: [34, 4, -12],
        camera: [16.6, 4.2, -12.6],
        lookAt: [21.8, 3.0, -24.5],
        rollDeg: 2,
        fovOverride: 58,
      }),
      // East lane: tracking shot along the sea wall.
      defineCameraZone({
        id: 'east-lane',
        min: [16, -1, 16],
        max: [32, 4, 24],
        camera: [17.4, 2.6, 17.2],
        trackTarget: true,
        trackStiffness: 3,
        fovOverride: 58,
      }),
      // The point: low and wide; the lighthouse does the talking.
      defineCameraZone({
        id: 'lighthouse-point',
        min: [32, -1, 8],
        max: [46, 4, 26],
        camera: [33, 1.3, 24.4],
        trackTarget: true,
        trackStiffness: 2.6,
        fovOverride: 64,
      }),
      // At the tower's foot: the up-shot. Small zone, high priority.
      defineCameraZone({
        id: 'lighthouse-base',
        min: [36.2, -1, 11.5],
        max: [42.5, 4, 18.5],
        camera: [37.2, 0.9, 18.2],
        lookAt: [39.2, 8.0, 14.0],
        fovOverride: 70,
        priority: 2,
      }),
    ];

    return {
      root,
      colliders,
      cameraZones,
      interactables,
      updatables,
      spawn: { position: new THREE.Vector3(-33.2, 0, 13), rotationY: Math.PI / 2 },
      spawnPoints: {
        arrival: { position: new THREE.Vector3(-33.2, 0, 13), rotationY: Math.PI / 2 },
        innDoor: { position: new THREE.Vector3(0, 0, -25.5), rotationY: Math.PI },
      },
      // Daytime Graven has no combat, ever. Night Graven has the neighbors,
      // held behind 'chaseStarted' — the roster re-checks onlyIf live, so
      // Rosa's reveal is what lets them out.
      enemySpawns: night
        ? [
            [13.5, -17.5], // the path ahead of you
            [26, -14.5],   // the churchyard gap
            [0, -24],      // the inn court
            [0, -8],       // main street
            [-6, 3],       // bakery row
            [4, 12],       // the square
            [-11, 12],     // square west
            [1, 22],       // boardwalk
            [22, 20],      // east lane
          ].map(([x, z]) => ({
            type: 'husk',
            variant: 'neighbor',
            position: new THREE.Vector3(x, 0, z),
            homeRadius: 8,
            onlyIf: 'chaseStarted',
          }))
        : [],
      fog: night ? { color: 0x090b12, density: 0.026 } : { color: 0xd9a878, density: 0.012 },
      ambientTrack: night ? 'townNight' : 'townDay',
      hudMinimal: !night,
      surfaces: {
        default: 'stone',
        regions: [
          { min: [1, 28], max: [9, 41], type: 'wood' },   // long pier
          { min: [-9, 28], max: [-3, 35], type: 'wood' }, // stub pier
        ],
      },
      map: {
        rooms: [
          { id: 'gate-road', label: 'Coast Road', min: [-46, 6], max: [-14, 16] },
          { id: 'square', label: 'Town Square', min: [-14, 0], max: [12, 20] },
          { id: 'boardwalk', label: 'Boardwalk', min: [-14, 20], max: [16, 28] },
          { id: 'piers', label: 'The Piers', min: [-9, 28], max: [9, 41] },
          { id: 'street', label: 'Main Street', min: [-5, -28], max: [5, 0] },
          { id: 'inn', label: 'The Gull & Anchor', min: [-8, -34], max: [8, -26] },
          { id: 'church-path', label: 'Church Path', min: [5, -20], max: [16, -14] },
          { id: 'churchyard', label: 'Churchyard', min: [16, -32], max: [34, -12] },
          { id: 'lane', label: 'East Lane', min: [16, 16], max: [32, 24] },
          { id: 'point', label: 'Lighthouse Point', min: [32, 8], max: [46, 26] },
        ],
        markers: [
          { type: 'door', position: [0, -27] },     // the inn
          { type: 'door', position: [22.2, -24] },  // the church
          { type: 'door', position: [-14, 11] },    // the gate
        ],
      },
    };
  },
};
