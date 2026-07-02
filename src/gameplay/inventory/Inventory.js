import { getItem } from './itemCatalog.js';
import { findRecipe } from './recipes.js';

/**
 * Inventory — a container of item stacks (the satchel AND the shrine
 * reliquary are both instances; only the satchel has a slot cap and an
 * equipped weapon).
 *
 * Capacity is measured in STACKS (a weapon is one slot, thirty rounds is
 * one slot) — the classic carry-pressure model. Pure model: no DOM, no
 * three.js.
 *
 * Emits 'inventory/changed' after any mutation (single coarse event — UI
 * re-renders are cheap at this scale).
 */
export class Inventory {
  #events;
  #maxSlots;
  /** @type {Array<{ id: string, qty: number }>} */
  #stacks = [];
  /** @type {string | null} */
  #equippedWeaponId = null;

  /** @param {object} events @param {{ maxSlots?: number }} [opts] */
  constructor(events, { maxSlots = Infinity } = {}) {
    this.#events = events;
    this.#maxSlots = maxSlots;
  }

  get maxSlots() {
    return this.#maxSlots;
  }

  get slotsUsed() {
    return this.#stacks.length;
  }

  /** Would `qty` of item fit without exceeding the slot cap? */
  canFit(id, qty = 1) {
    const def = getItem(id);
    const stackMax = def.stack ?? 1;
    let remaining = qty;
    if (stackMax > 1) {
      for (const stack of this.#stacks) {
        if (stack.id === id) remaining -= Math.min(stackMax - stack.qty, remaining);
      }
    }
    const newSlots = Math.ceil(Math.max(0, remaining) / stackMax);
    return this.#stacks.length + newSlots <= this.#maxSlots;
  }

  get stacks() {
    return this.#stacks.map((s) => ({ ...s }));
  }

  get equippedWeaponId() {
    return this.#equippedWeaponId;
  }

  /** Full catalog def of the equipped weapon, or null. */
  get equippedWeapon() {
    return this.#equippedWeaponId ? getItem(this.#equippedWeaponId) : null;
  }

  has(id) {
    return this.count(id) > 0;
  }

  count(id) {
    return this.#stacks.filter((s) => s.id === id).reduce((sum, s) => sum + s.qty, 0);
  }

  add(id, qty = 1) {
    const def = getItem(id);
    let remaining = qty;
    const stackMax = def.stack ?? 1;
    if (stackMax > 1) {
      for (const stack of this.#stacks) {
        if (stack.id !== id || stack.qty >= stackMax) continue;
        const take = Math.min(stackMax - stack.qty, remaining);
        stack.qty += take;
        remaining -= take;
        if (remaining === 0) break;
      }
    }
    while (remaining > 0) {
      const take = Math.min(stackMax, remaining);
      this.#stacks.push({ id, qty: take });
      remaining -= take;
    }
    this.#changed();
  }

  /** Remove up to qty; returns how many were actually removed. */
  remove(id, qty = 1) {
    let toRemove = qty;
    for (const stack of [...this.#stacks].reverse()) {
      if (stack.id !== id || toRemove === 0) continue;
      const take = Math.min(stack.qty, toRemove);
      stack.qty -= take;
      toRemove -= take;
    }
    this.#stacks = this.#stacks.filter((s) => s.qty > 0);
    if (this.#equippedWeaponId && !this.has(this.#equippedWeaponId)) {
      this.#equippedWeaponId = null;
    }
    this.#changed();
    return qty - toRemove;
  }

  /**
   * Use a consumable. ctx: { stats, events }.
   * @returns {boolean} true if consumed
   */
  use(id, ctx) {
    const def = getItem(id);
    if (def.kind !== 'consumable' || !this.has(id)) return false;
    if (!def.use(ctx)) return false;
    this.remove(id, 1);
    return true;
  }

  /**
   * Combine two items per the recipes registry. Consumes one of each and
   * yields the result (which always fits: two slots freed, one gained).
   * @returns {{ ok: boolean, recipe?: object }}
   */
  combine(idA, idB) {
    const recipe = findRecipe(idA, idB);
    if (!recipe || !this.has(idA) || !this.has(idB)) return { ok: false };
    if (idA === idB && this.count(idA) < 2) return { ok: false };
    this.remove(idA, 1);
    this.remove(idB, 1);
    this.add(recipe.result, 1);
    return { ok: true, recipe };
  }

  /** Equip a weapon (or null to unequip). No-op if not owned. */
  equip(id) {
    if (id !== null && (!this.has(id) || getItem(id).kind !== 'weapon')) return;
    this.#equippedWeaponId = id;
    this.#changed();
  }

  /* Save participant interface. */
  captureState() {
    return { stacks: this.stacks, equipped: this.#equippedWeaponId };
  }

  restoreState(state) {
    this.#stacks = (state?.stacks ?? []).map((s) => ({ ...s }));
    this.#equippedWeaponId = state?.equipped ?? null;
    this.#changed();
  }

  #changed() {
    this.#events.emit('inventory/changed', {
      stacks: this.stacks,
      equipped: this.#equippedWeaponId,
    });
  }
}
