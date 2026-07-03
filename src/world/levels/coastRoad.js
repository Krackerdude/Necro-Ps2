import * as THREE from 'three';
import { TownKit } from '../builders/TownKit.js';

/**
 * COAST ROAD — the drive-in cinematic set. Not a playable level: no spawn
 * you'll ever stand on, no interactables, no zones. The DRIVE_SCRIPT plays
 * over it (MainMenuState loads this on New Game).
 *
 * The trick is a treadmill: the car never moves — the world does. Guardrail
 * posts, fence posts, trees and rocks flow past on a conveyor and wrap; the
 * wheels spin; the body rides its suspension. Every camera in the script is
 * authored relative to a car that is conveniently always at the origin.
 * PS2 games shipped this exact lie for a decade, and it still works.
 */

const FLOW_SPEED = 9; // m/s of implied travel
const WRAP = 90; // conveyor band length

export const COAST_ROAD = {
  id: 'coast-road',
  name: 'The Coast Road',

  build({ kit }) {
    const town = new TownKit(kit);
    const root = new THREE.Group();
    const updatables = [];

    /* ------------------------------ SET -------------------------------- */
    // Gravel road, grass shoulder against the cliff, sand falling to the sea.
    const road = kit.slab({ center: [0, 0], size: [WRAP + 20, 7], y: 0, texture: 'stoneFloor', repeat: [40, 3] });
    road.object.traverse((n) => {
      if (n.material) n.material = kit.material('stoneFloor', { color: 0x8a8078, repeat: [40, 3] });
    });
    root.add(road.object);
    const shoulder = kit.slab({ center: [0, -6.5], size: [WRAP + 20, 6], y: -0.02, texture: 'boneDust', repeat: [40, 3] });
    shoulder.object.traverse((n) => {
      if (n.material) n.material = kit.material('boneDust', { color: 0x76855c, repeat: [40, 3] });
    });
    root.add(shoulder.object);
    const sand = kit.slab({ center: [0, 6], size: [WRAP + 20, 5], y: -0.04, texture: 'boneDust', repeat: [40, 2] });
    sand.object.traverse((n) => {
      if (n.material) n.material = kit.material('boneDust', { color: 0xb8a888, repeat: [40, 2] });
    });
    root.add(sand.object);

    // The sea, keeping pace like an escort.
    root.add(kit.water({ center: [0, 28], size: [WRAP + 60, 40], y: -0.5 }).object);

    // Cliff face along the north side.
    root.add(kit.wall({ from: [-(WRAP / 2 + 10), -9.5], to: [WRAP / 2 + 10, -9.5], height: 7, thickness: 1.2 }).object);

    /* ---------------------------- TREADMILL ---------------------------- */
    const flow = new THREE.Group();
    root.add(flow);
    const place = (obj, x, z) => {
      obj.position.x = x;
      obj.position.z = z;
      flow.add(obj);
    };
    // Guardrail posts on the sea side.
    for (let x = -WRAP / 2; x < WRAP / 2; x += 6) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.8, 0.14),
        kit.material('woodPlanks', { color: 0x9a8a72 })
      );
      post.position.y = 0.4;
      place(post, x, 3.8);
    }
    // Fence posts against the cliff.
    for (let x = -WRAP / 2 + 3; x < WRAP / 2; x += 9) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.1, 0.12),
        kit.material('woodPlanks', { color: 0x6a5844 })
      );
      post.position.y = 0.55;
      place(post, x, -4.2);
    }
    // Windswept trees and rocks, irregular.
    for (const [x, z, s] of [[-38, -6.2, 1.1], [-16, -5.8, 0.9], [7, -6.5, 1.2], [31, -6.0, 0.95]]) {
      const tree = town.tree({ position: [0, 0], scale: s, lean: 0.28 });
      place(tree.object, x, z);
    }
    for (const [x, z] of [[-27, 5.2], [2, 5.6], [22, 5.0], [41, 5.4]]) {
      const rock = kit.rubble({ position: [0, 0], seed: Math.abs(x) + 3, count: 3 });
      place(rock.object, x, z);
    }
    updatables.push({
      update: (dt) => {
        for (const child of flow.children) {
          child.position.x -= FLOW_SPEED * dt;
          if (child.position.x < -WRAP / 2) child.position.x += WRAP;
        }
      },
    });

    /* ------------------------------ CAR -------------------------------- */
    const car = town.car({ position: [0, 0], rotationY: 0, headlights: true });
    root.add(car.object);
    let time = 0;
    updatables.push({
      update: (dt) => {
        time += dt;
        // Wheels roll about their axle; the body rides its tired suspension.
        for (const wheel of car.wheels) wheel.rotateY(-(FLOW_SPEED / 0.34) * dt);
        car.object.position.y = Math.sin(time * 6.3) * 0.012 + Math.sin(time * 17.7) * 0.005;
        car.object.rotation.z = Math.sin(time * 5.1) * 0.004;
      },
    });

    /* ---------------------------- LIGHTING ----------------------------- */
    // The sun is dying behind the car; Graven is somewhere in the gold ahead.
    root.add(new THREE.AmbientLight(0x9a8070, 2.0));
    root.add(new THREE.HemisphereLight(0x8798c0, 0xa07048, 1.5));
    const sun = new THREE.DirectionalLight(0xffb060, 3.4);
    sun.position.set(-26, 9, 8);
    sun.target.position.set(10, 0, -2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    root.add(sun, sun.target);

    return {
      root,
      colliders: [],
      cameraZones: [],
      interactables: [],
      updatables,
      spawn: { position: new THREE.Vector3(0, 0, 0), rotationY: 0 }, // never used
      spawnPoints: {},
      enemySpawns: [],
      fog: { color: 0xd9905e, density: 0.022 },
      ambientTrack: 'coastDrive',
      surfaces: { default: 'stone', regions: [] },
    };
  },
};
