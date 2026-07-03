import * as THREE from 'three';
import { FlickerLight } from '../effects/FlickerLight.js';
import { FogCards } from '../effects/FogCards.js';
import { createInstancedScatter } from '../../rendering/instancing/InstancedScatter.js';
import { TownKit } from '../builders/TownKit.js';

/**
 * MENU VISTA — the 3D diorama behind the main menu: GRAVEN's gothic church
 * at night, seen across its graveyard — the same building the game ends up
 * barring you inside. No player, no colliders; the camera is driven
 * manually by MainMenuState using `menuCamera`.
 */
export const MENU_VISTA = {
  id: 'menu-vista',
  name: 'Menu Vista',

  build({ kit }) {
    const root = new THREE.Group();
    const updatables = [];

    // Ground.
    root.add(kit.slab({ center: [0, 0], size: [60, 60], y: 0, texture: 'boneDust', repeat: [18, 18] }).object);

    // The church of Graven, night-lit: the same gothic build the town uses,
    // stained glass burning that low wrong red, facing the camera path.
    const town = new TownKit(kit, { windowsLit: false, lampsLit: false });
    root.add(
      town.church({ position: [0, -20.5], rotationY: Math.PI, width: 10, depth: 15, height: 7 }).object
    );

    // Graveyard rows, slightly drunken.
    const grave = kit.gravestoneTemplate();
    const stones = [];
    let s = 5;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        stones.push({
          position: new THREE.Vector3(-9 + col * 3 + rand() * 1.2, 0, -7 + row * 3.4 + rand() * 1.4),
          rotationY: (rand() - 0.5) * 0.7,
          scale: 0.75 + rand() * 0.5,
        });
      }
    }
    root.add(createInstancedScatter(grave.geometry, grave.material, stones, { castShadow: true }));

    // Dead tree — cheap cone-limb silhouette against the moon.
    const bark = kit.material('woodPlanks', { color: 0x555049 });
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 5, 5), bark);
    trunk.position.y = 2.5;
    tree.add(trunk);
    for (let i = 0; i < 4; i++) {
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 2.6, 4), bark);
      limb.position.set(Math.sin(i * 2.1) * 0.9, 3.6 + i * 0.4, Math.cos(i * 2.1) * 0.9);
      limb.rotation.z = 0.7 + i * 0.5;
      limb.rotation.y = i * 1.7;
      tree.add(limb);
    }
    tree.position.set(8.5, 0, 2);
    tree.traverse((n) => (n.castShadow = true));
    root.add(tree);

    /* Lighting: moon + two grave candles. */
    root.add(new THREE.AmbientLight(0x232636, 2.2));
    root.add(new THREE.HemisphereLight(0x2a3048, 0x0e0c0a, 1.1));
    const moon = new THREE.DirectionalLight(0x7080ac, 1.8);
    moon.position.set(-14, 18, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -25;
    moon.shadow.camera.right = 25;
    moon.shadow.camera.top = 25;
    moon.shadow.camera.bottom = -25;
    root.add(moon);

    const candles = [
      new FlickerLight({ position: new THREE.Vector3(-4, 0.5, -2), intensity: 12, distance: 7 }),
      new FlickerLight({ position: new THREE.Vector3(4.5, 0.5, 3.5), intensity: 9, distance: 7 }),
    ];
    for (const c of candles) {
      root.add(c.light);
      updatables.push(c);
    }

    const fog = new FogCards({ center: [0, 0], size: [50, 50], count: 4, opacity: 0.08, height: 0.8 });
    root.add(fog.object);
    updatables.push(fog);

    return {
      root,
      colliders: [],
      cameraZones: [],
      interactables: [],
      updatables,
      spawn: { position: new THREE.Vector3(0, 0, 0), rotationY: 0 },
      fog: { color: 0x0a0c11, density: 0.035 },
      ambientTrack: 'menu',
      /** Slow push-in past the graves toward the chapel door. */
      menuCamera: {
        from: new THREE.Vector3(6.5, 1.6, 14),
        to: new THREE.Vector3(2.5, 1.3, 6),
        lookAt: new THREE.Vector3(0, 3.4, -14),
        duration: 40,
      },
    };
  },
};
