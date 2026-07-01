import * as THREE from 'three';

/**
 * PhysicsService — minimal collision world for a fixed-camera horror game.
 *
 * Scope (deliberate): static AABB colliders + circle-vs-AABB resolution on
 * the ground plane. Characters are circles in XZ; verticality is authored
 * (no gravity sim — floors are flat per room, PS2-horror style).
 *
 * This is intentionally not a physics engine. If the game ever needs rigid
 * bodies, this service's API (addStaticBox / moveCircle / raycastXZ) is the
 * seam where a real backend (e.g. Rapier) slots in without touching callers.
 */
export class PhysicsService {
  /** @type {THREE.Box3[]} */
  #staticColliders = [];

  /** Replace all static geometry (called on level load). */
  setStaticColliders(boxes) {
    this.#staticColliders = boxes;
  }

  addStaticBox(box) {
    this.#staticColliders.push(box);
  }

  /**
   * Move a circle (XZ) with wall sliding. Mutates and returns `position`.
   * @param {THREE.Vector3} position
   * @param {number} dx desired X displacement
   * @param {number} dz desired Z displacement
   * @param {number} radius
   */
  moveCircle(position, dx, dz, radius) {
    // Axis-separated resolution gives natural wall sliding.
    position.x += dx;
    this.#resolveAxis(position, radius, 'x');
    position.z += dz;
    this.#resolveAxis(position, radius, 'z');
    return position;
  }

  /**
   * 2D segment test against colliders (line of sight / interaction reach).
   * @returns {boolean} true if the segment is blocked
   */
  segmentBlockedXZ(from, to) {
    const box2 = new THREE.Box2();
    const min = new THREE.Vector2(Math.min(from.x, to.x), Math.min(from.z, to.z));
    const max = new THREE.Vector2(Math.max(from.x, to.x), Math.max(from.z, to.z));
    const segBounds = new THREE.Box2(min, max);
    for (const box of this.#staticColliders) {
      box2.min.set(box.min.x, box.min.z);
      box2.max.set(box.max.x, box.max.z);
      if (!box2.intersectsBox(segBounds)) continue;
      if (segmentIntersectsBox2(from.x, from.z, to.x, to.z, box2)) return true;
    }
    return false;
  }

  #resolveAxis(position, radius, axis) {
    for (const box of this.#staticColliders) {
      // Ignore colliders entirely above/below the character's midsection.
      if (box.max.y < position.y - 0.1 || box.min.y > position.y + 1.4) continue;

      const nearestX = clamp(position.x, box.min.x, box.max.x);
      const nearestZ = clamp(position.z, box.min.z, box.max.z);
      const dx = position.x - nearestX;
      const dz = position.z - nearestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;

      if (axis === 'x') {
        position.x = dx >= 0 ? nearestX + radius : nearestX - radius;
        if (dx === 0 && dz === 0) position.x += radius; // degenerate: push out +x
      } else {
        position.z = dz >= 0 ? nearestZ + radius : nearestZ - radius;
        if (dx === 0 && dz === 0) position.z += radius;
      }
    }
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function segmentIntersectsBox2(x1, z1, x2, z2, box) {
  // Liang-Barsky style slab test in 2D.
  const dx = x2 - x1;
  const dz = z2 - z1;
  let tMin = 0;
  let tMax = 1;
  for (const [p, q] of [
    [-dx, x1 - box.min.x],
    [dx, box.max.x - x1],
    [-dz, z1 - box.min.y],
    [dz, box.max.y - z1],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > tMax) return false;
      if (t > tMin) tMin = t;
    } else {
      if (t < tMin) return false;
      if (t < tMax) tMax = t;
    }
  }
  return true;
}
