/**
 * InteractionSystem — proximity prompts and the interact action.
 *
 * Reads the level's interactable list (world/levels), finds the nearest one
 * in range that passes its `canInteract` gate, and:
 *   - emits 'interaction/prompt-changed' { prompt | null } for the HUD
 *   - fires `onInteract()` when the interact action is pressed.
 *
 * Interactables are plain data owned by the level; this system holds no
 * state about them beyond "which one is focused".
 */
export class InteractionSystem {
  #events;
  #input;
  #interactables = [];
  #playerObject = null;
  #focused = null;

  constructor(events, input) {
    this.#events = events;
    this.#input = input;
  }

  bind(interactables, playerObject) {
    this.#interactables = interactables;
    this.#playerObject = playerObject;
    this.#setFocused(null);
  }

  update() {
    if (!this.#playerObject) return;
    const pos = this.#playerObject.position;

    let best = null;
    let bestDistSq = Infinity;
    for (const item of this.#interactables) {
      if (item.canInteract && !item.canInteract()) continue;
      const dx = item.position.x - pos.x;
      const dz = item.position.z - pos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= item.radius * item.radius && distSq < bestDistSq) {
        best = item;
        bestDistSq = distSq;
      }
    }

    if (best !== this.#focused) this.#setFocused(best);

    if (best && this.#input.wasPressed('interact')) {
      this.#events.emit('audio/sfx', { id: 'uiConfirm' });
      best.onInteract();
      // Re-evaluate immediately: the interaction may have gated itself off.
      this.#setFocused(null);
    }
  }

  #setFocused(item) {
    this.#focused = item;
    const prompt = item ? (typeof item.prompt === 'function' ? item.prompt() : item.prompt) : null;
    this.#events.emit('interaction/prompt-changed', { prompt });
  }
}
