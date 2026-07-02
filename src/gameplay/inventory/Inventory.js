import { getItem } from './itemCatalog.js';

/**
 * Inventory — the player's belongings for one game session.
 *
 * A list of stacks plus one equipped-weapon slot. Pure model: no DOM, no
 * three.js. The inventory screen renders it; WeaponSystem reads the equipped
 * weapon and draws ammo from it.
 *
 * Emits 'inventory/changed' after any mutation (single coarse event — UI
 * re-renders are cheap at this scale).
 */
export class Inventory {
  #events;
  /** @type {Array<{ id: string, qty: number }>} */
  #stacks = [];
  /** @type {string | null} */
  #equippedWeaponId = null;

  constructor(events) {
    this.#events = events;
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
