/**
 * PlayerStats — the character sheet: health and (later) inventory-adjacent
 * stats. Pure data + rules; no rendering, no input.
 *
 * Condition bands mirror the classic survival-horror readout and are what
 * the HUD displays instead of a numeric bar.
 *
 * Emits 'player/stats-changed' { health, maxHealth, condition } and
 * 'player/died' via the EventBus.
 *
 * Post-hit invulnerability (~0.9 s): without it, an adjacent enemy chains
 * contact damage into a stun-lock — era games all had these i-frames.
 */
const IFRAME_MS = 900;

export class PlayerStats {
  #events;
  #health;
  #maxHealth;
  #lastDamageAt = -Infinity;

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

  /**
   * @param {number} amount
   * @param {{ ignoreIframes?: boolean }} [opts] grab ticks etc. always land
   * @returns {boolean} true if the damage landed (not absorbed by i-frames)
   */
  damage(amount, { ignoreIframes = false } = {}) {
    if (this.#health <= 0) return false;
    if (!ignoreIframes && performance.now() - this.#lastDamageAt < IFRAME_MS) return false;
    this.#lastDamageAt = performance.now();
    this.#health = Math.max(0, this.#health - amount);
    this.#emit();
    if (this.#health === 0) this.#events.emit('player/died');
    return true;
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
