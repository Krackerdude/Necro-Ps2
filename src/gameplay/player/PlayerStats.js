/**
 * PlayerStats — the character sheet: health and (later) inventory-adjacent
 * stats. Pure data + rules; no rendering, no input.
 *
 * Condition bands mirror the classic survival-horror readout and are what
 * the HUD displays instead of a numeric bar.
 *
 * Emits 'player/stats-changed' { health, maxHealth, condition } and
 * 'player/died' via the EventBus.
 */
export class PlayerStats {
  #events;
  #health;
  #maxHealth;

  constructor(events, { maxHealth = 100 } = {}) {
    this.#events = events;
    this.#maxHealth = maxHealth;
    this.#health = maxHealth;
  }

  get health() {
    return this.#health;
  }

  get maxHealth() {
    return this.#maxHealth;
  }

  get condition() {
    const ratio = this.#health / this.#maxHealth;
    if (ratio > 0.66) return 'FINE';
    if (ratio > 0.33) return 'CAUTION';
    if (ratio > 0) return 'DANGER';
    return 'DEAD';
  }

  damage(amount) {
    if (this.#health <= 0) return;
    this.#health = Math.max(0, this.#health - amount);
    this.#emit();
    if (this.#health === 0) this.#events.emit('player/died');
  }

  heal(amount) {
    this.#health = Math.min(this.#maxHealth, this.#health + amount);
    this.#emit();
  }

  /* Save participant interface. */
  captureState() {
    return { health: this.#health, maxHealth: this.#maxHealth };
  }

  restoreState(state) {
    this.#maxHealth = state?.maxHealth ?? 100;
    this.#health = state?.health ?? this.#maxHealth;
    this.#emit();
  }

  #emit() {
    this.#events.emit('player/stats-changed', {
      health: this.#health,
      maxHealth: this.#maxHealth,
      condition: this.condition,
    });
  }
}
