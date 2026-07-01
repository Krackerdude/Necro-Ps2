/**
 * DebugOverlay — F3 developer readout: fps, frame time, draw calls,
 * triangles, active camera zone, top game state. DOM-based, zero cost when
 * hidden beyond the toggle listener.
 */
export class DebugOverlay {
  #el;
  #visible = false;
  #frames = 0;
  #accum = 0;
  #renderService;
  #zone = '—';
  #state = '—';

  constructor(events, renderService) {
    this.#renderService = renderService;

    this.#el = document.createElement('pre');
    this.#el.id = 'debug-overlay';
    this.#el.style.cssText = [
      'position:fixed', 'top:8px', 'left:8px', 'z-index:1000',
      'color:#9fdc7a', 'background:rgba(0,0,0,0.75)', 'padding:8px 12px',
      'font:12px/1.5 monospace', 'pointer-events:none', 'display:none',
      'white-space:pre',
    ].join(';');
    document.body.appendChild(this.#el);

    events.on('input/action-pressed', ({ action }) => {
      if (action === 'debugOverlay') this.toggle();
    });
    events.on('camera/zone-changed', ({ id }) => (this.#zone = id));
    events.on('state/changed', ({ top }) => (this.#state = top ?? '—'));
  }

  toggle() {
    this.#visible = !this.#visible;
    this.#el.style.display = this.#visible ? 'block' : 'none';
  }

  /** Called from the engine's render callback. */
  tick(frameDelta) {
    if (!this.#visible) return;
    this.#frames++;
    this.#accum += frameDelta;
    if (this.#accum < 0.5) return;

    const fps = this.#frames / this.#accum;
    const info = this.#renderService.renderer.info;
    const { width, height } = this.#renderService.getInternalSize();
    this.#el.textContent = [
      `fps        ${fps.toFixed(1)} (${((this.#accum / this.#frames) * 1000).toFixed(1)}ms)`,
      `internal   ${width}x${height}`,
      `draw calls ${info.render.calls}`,
      `triangles  ${info.render.triangles}`,
      `geometries ${info.memory.geometries}  textures ${info.memory.textures}`,
      `state      ${this.#state}`,
      `cam zone   ${this.#zone}`,
    ].join('\n');
    this.#frames = 0;
    this.#accum = 0;
  }
}
