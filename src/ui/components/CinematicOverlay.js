/**
 * CinematicOverlay — letterbox bars + caption line for scripted sequences.
 *
 * Event-driven like FadeOverlay (constructed once by the Engine):
 *   'ui/letterbox' { on }      — bars slide in/out
 *   'ui/caption'   { text }    — bottom-center caption (null clears)
 */
export class CinematicOverlay {
  #top;
  #bottom;
  #caption;
  #skipHint;

  constructor(events, uiRoot) {
    const bar = (edge) => {
      const el = document.createElement('div');
      el.style.cssText = [
        'position:absolute',
        'left:0',
        'right:0',
        `${edge}:0`,
        'height:0',
        'background:#000',
        'transition:height 0.5s steps(6)',
        'pointer-events:none',
        'z-index:850',
      ].join(';');
      uiRoot.appendChild(el);
      return el;
    };
    this.#top = bar('top');
    this.#bottom = bar('bottom');

    this.#caption = document.createElement('div');
    this.#caption.className = 'cine-caption';
    uiRoot.appendChild(this.#caption);

    this.#skipHint = document.createElement('div');
    this.#skipHint.className = 'cine-skip';
    this.#skipHint.textContent = 'E ・ SKIP';
    uiRoot.appendChild(this.#skipHint);

    events.on('ui/letterbox', ({ on }) => {
      this.#top.style.height = on ? '11vh' : '0';
      this.#bottom.style.height = on ? '11vh' : '0';
      this.#skipHint.style.opacity = on ? '1' : '0';
      if (!on) this.#caption.textContent = '';
    });
    events.on('ui/caption', ({ text }) => {
      this.#caption.textContent = text ?? '';
      this.#caption.classList.toggle('visible', Boolean(text));
    });
  }
}
