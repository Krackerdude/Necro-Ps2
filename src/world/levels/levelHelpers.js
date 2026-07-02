import * as THREE from 'three';

/**
 * Level-authoring helpers — the shared patterns every level uses:
 * item pickups (with taken-state persistence) and level transitions
 * (with optional key locks). Keeping these here stops each level from
 * re-inventing flag conventions.
 */

/**
 * Item pickup. Handles: skip-if-taken on build, story flag on take,
 * inventory add, mesh removal, toast + sfx.
 *
 * @param {{ root: THREE.Group, story: object, inventory: object, events: object }} ctx
 * @param {{ id: string, itemId: string, qty?: number, mesh: THREE.Object3D | null,
 *           position: THREE.Vector3, prompt: string, flavor?: string }} def
 * @returns {object | null} interactable (null if already taken)
 */
export function makeItemPickup(ctx, def) {
  const flag = `took:${def.id}`;
  if (ctx.story.get(flag)) return null;
  if (def.mesh) ctx.root.add(def.mesh);

  return {
    id: def.id,
    position: def.position,
    radius: def.radius ?? 1.2,
    prompt: def.prompt,
    canInteract: () => !ctx.story.get(flag),
    onInteract: () => {
      ctx.story.set(flag, true);
      ctx.inventory.add(def.itemId, def.qty ?? 1);
      def.mesh?.removeFromParent();
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
 *           lock?: { keyItem: string, flag: string, lockedText: string, unlockText: string } }} def
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
      ctx.events.emit('level/transition', {
        levelId: def.targetLevel,
        spawn: def.targetSpawn,
      });
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
