/**
 * FadeOverlay — full-screen black fade for level transitions and death.
 *
 * Driven by events so any system can request it without a UI reference:
 *   'ui/fade' { opacity: 0..1, duration: seconds }
 *
 * Constructed once by the Engine; sits above screens, below scanlines.
 */
export class FadeOverlay {
  #el;

  constructor(events, uiRoot) {
    this.#el = document.createElement('div');
    this.#el.style.cssText = [
      'position:absolute',
      'inset:0',
      'background:#000',
      'opacity:0',
      'pointer-events:none',
      'z-index:900',
    ].join(';');
    uiRoot.appendChild(this.#el);

    events.on('ui/fade', ({ opacity, duration = 0.4 }) => {
      this.#el.style.transition = `opacity ${duration}s steps(6)`;
      this.#el.style.opacity = String(opacity);
    });
  }
}
