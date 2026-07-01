/**
 * GameLoop — fixed-timestep simulation with variable-rate rendering.
 *
 * Gameplay/physics update at a fixed step (deterministic, save-friendly);
 * rendering runs every animation frame with an interpolation alpha so future
 * smoothing can be added per-system without touching the loop.
 *
 * The loop owns no game logic. Consumers register callbacks:
 *   loop.onUpdate((dt) => ...)   — fixed step, dt is constant
 *   loop.onRender((alpha, dt) => ...) — once per frame
 */
export class GameLoop {
  static FIXED_STEP = 1 / 60;
  /** Clamp huge frame deltas (tab was backgrounded) so we don't spiral. */
  static MAX_FRAME_DELTA = 0.25;

  #updateCallbacks = [];
  #renderCallbacks = [];
  #running = false;
  #accumulator = 0;
  #lastTime = 0;
  #rafId = 0;

  onUpdate(fn) {
    this.#updateCallbacks.push(fn);
    return () => {
      this.#updateCallbacks = this.#updateCallbacks.filter((f) => f !== fn);
    };
  }

  onRender(fn) {
    this.#renderCallbacks.push(fn);
    return () => {
      this.#renderCallbacks = this.#renderCallbacks.filter((f) => f !== fn);
    };
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#lastTime = performance.now();
    this.#accumulator = 0;
    const frame = (now) => {
      if (!this.#running) return;
      this.#rafId = requestAnimationFrame(frame);
      this.#tick(now);
    };
    this.#rafId = requestAnimationFrame(frame);
  }

  stop() {
    this.#running = false;
    cancelAnimationFrame(this.#rafId);
  }

  #tick(now) {
    const step = GameLoop.FIXED_STEP;
    let frameDelta = (now - this.#lastTime) / 1000;
    this.#lastTime = now;
    if (frameDelta > GameLoop.MAX_FRAME_DELTA) frameDelta = GameLoop.MAX_FRAME_DELTA;

    this.#accumulator += frameDelta;
    while (this.#accumulator >= step) {
      for (const fn of this.#updateCallbacks) fn(step);
      this.#accumulator -= step;
    }

    const alpha = this.#accumulator / step;
    for (const fn of this.#renderCallbacks) fn(alpha, frameDelta);
  }
}
