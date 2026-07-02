import * as THREE from 'three';
import { PickupBeacon } from '../effects/PickupBeacon.js';
import { Townsfolk } from '../../gameplay/npcs/Townsfolk.js';

/**
 * Level-authoring helpers — the shared patterns every level uses:
 * item pickups (with taken-state persistence and the shine beacon) and
 * level transitions (with optional key locks). Keeping these here stops
 * each level from re-inventing flag conventions.
 */

/**
 * Item pickup. Handles: skip-if-taken on build, shine beacon (spins, bobs,
 * glints — pass `updatables` in ctx), inventory add THEN story flag (the
 * flag change triggers autosave, so the item must already be in the bag),
 * mesh removal, toast + sfx.
 *
 * @param {{ root: THREE.Group, story: object, inventory: object,
 *           events: object, updatables?: object[] }} ctx
 * @param {{ id: string, itemId: string, qty?: number, mesh: THREE.Object3D | null,
 *           position: THREE.Vector3, prompt: string, flavor?: string,
 *           glowColor?: number }} def
 * @returns {object | null} interactable (null if already taken)
 */
export function makeItemPickup(ctx, def) {
  const flag = `took:${def.id}`;
  if (ctx.story.get(flag)) return null;

  let beacon = null;
  if (def.mesh) {
    beacon = new PickupBeacon(def.mesh, { color: def.glowColor ?? 0xfff2c8 });
    ctx.root.add(beacon.object);
    ctx.updatables?.push(beacon);
  }

  return {
    id: def.id,
    position: def.position,
    radius: def.radius ?? 1.2,
    prompt: def.prompt,
    canInteract: () => !ctx.story.get(flag),
    onInteract: () => {
      // The satchel has a slot cap: a pickup that doesn't fit stays in the
      // world (beacon and all) until room is made.
      if (!ctx.inventory.canFit(def.itemId, def.qty ?? 1)) {
        ctx.events.emit('ui/toast', { text: 'Your satchel is full. The reliquary waits at a shrine.' });
        ctx.events.emit('audio/sfx', { id: 'uiBack' });
        return;
      }
      // Order matters: the story flag fires autosave, so the inventory must
      // already contain the item when the snapshot is taken.
      ctx.inventory.add(def.itemId, def.qty ?? 1);
      ctx.story.set(flag, true);
      beacon?.vanish();
      ctx.events.emit('audio/sfx', { id: 'pickup' });
      ctx.events.emit('ui/toast', {
        text: def.flavor ?? `Taken — ${def.itemId.toUpperCase()}`,
      });
    },
  };
}

/**
 * Level transition (doorway/stairs), optionally locked behind a key item.
 * The unlock is remembered via a story flag, so the key is a one-time gate.
 *
 * @param {{ story: object, inventory: object, events: object }} ctx
 * @param {{ id: string, position: THREE.Vector3, radius?: number, prompt: string,
 *           targetLevel: string, targetSpawn: string,
 *           door?: THREE.Object3D,
 *           lock?: { keyItem: string, flag: string, lockedText: string, unlockText: string } }} def
 *        `door`: physical door mesh that creaks open a crack before the
 *        fade — the classic "door beat". The level rebuild resets it.
 */
export function makeTransition(ctx, def) {
  return {
    id: def.id,
    position: def.position,
    radius: def.radius ?? 1.5,
    prompt: () => {
      if (def.lock && !ctx.story.get(def.lock.flag)) {
        return ctx.inventory.has(def.lock.keyItem) ? `Unlock — ${def.prompt}` : 'Inspect';
      }
      return def.prompt;
    },
    onInteract: () => {
      if (def.lock && !ctx.story.get(def.lock.flag)) {
        if (!ctx.inventory.has(def.lock.keyItem)) {
          ctx.events.emit('ui/toast', { text: def.lock.lockedText });
          return;
        }
        ctx.story.set(def.lock.flag, true);
        ctx.events.emit('audio/sfx', { id: 'doorUnlock' });
        ctx.events.emit('ui/toast', { text: def.lock.unlockText });
        return; // unlocking and travelling are two beats
      }
      const travel = () =>
        ctx.events.emit('level/transition', {
          levelId: def.targetLevel,
          spawn: def.targetSpawn,
        });
      if (def.door) {
        // The door beat: it creaks open a crack, THEN the fade takes you.
        const startY = def.door.rotation.y;
        const t0 = performance.now();
        const swing = () => {
          const p = Math.min(1, (performance.now() - t0) / 340);
          def.door.rotation.y = startY + 0.42 * p * p;
          if (p < 1) requestAnimationFrame(swing);
        };
        requestAnimationFrame(swing);
        setTimeout(travel, 300);
      } else {
        travel();
      }
    },
  };
}

/**
 * Item socket — the puzzle primitive: a place in the world that accepts one
 * specific item. Placing it consumes the item and sets `flag` (which fires
 * autosave and can gate anything else in the level: doors, spawns, further
 * sockets). Multi-socket puzzles are just several of these whose flags a
 * final interactable checks.
 *
 * @param {{ story: object, inventory: object, events: object }} ctx
 * @param {{ id: string, itemId: string, flag: string, position: THREE.Vector3,
 *           radius?: number, prompt: string, missingText: string,
 *           placedText: string, onPlaced?: () => void }} def
 */
export function makeItemSocket(ctx, def) {
  return {
    id: def.id,
    position: def.position,
    radius: def.radius ?? 1.4,
    prompt: () => (ctx.story.get(def.flag) ? 'It is seated' : def.prompt),
    canInteract: () => !ctx.story.get(def.flag),
    onInteract: () => {
      if (!ctx.inventory.has(def.itemId)) {
        ctx.events.emit('ui/toast', { text: def.missingText });
        return;
      }
      ctx.inventory.remove(def.itemId, 1);
      ctx.story.set(def.flag, true);
      ctx.events.emit('audio/sfx', { id: 'saveChime' });
      ctx.events.emit('ui/toast', { text: def.placedText });
      def.onPlaced?.();
    },
  };
}

/**
 * A talkable townsperson. Builds the Townsfolk entity, registers its idle
 * updatable and body collider, and returns the "Talk" interactable, which
 * routes through the 'dialogue/open' event (GameplayState owns the modal
 * and sets `talked:<id>` on FULL completion — required conversations can't
 * be skimmed with Esc).
 *
 * @param {{ root: THREE.Group, ps2: object, events: object,
 *           updatables: object[], colliders: THREE.Box3[] }} ctx
 * @param {{ id: string, name: string, position: THREE.Vector3, facing?: number,
 *           palette?: object, lines: string[] }} def
 */
export function makeNpc(ctx, def) {
  const npc = new Townsfolk(ctx.ps2, def);
  ctx.root.add(npc.object);
  ctx.updatables.push(npc);
  const p = def.position;
  ctx.colliders.push(
    new THREE.Box3(
      new THREE.Vector3(p.x - npc.radius, 0, p.z - npc.radius),
      new THREE.Vector3(p.x + npc.radius, 1.7, p.z + npc.radius)
    )
  );
  return {
    id: `npc-${def.id}`,
    position: def.position,
    radius: 1.5,
    prompt: `Talk — ${def.name}`,
    onInteract: () => {
      ctx.events.emit('dialogue/open', { npc, def });
    },
  };
}

/** Small floating pickup mesh (shared look for loose items). */
export function makePickupMesh(kit, { position, color = 0xd8cfae, emissive = 0x554a2a }) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12, 0),
    kit.material('boneDust', { color, emissive, emissiveIntensity: 0.7 })
  );
  mesh.position.copy(position);
  return mesh;
}
