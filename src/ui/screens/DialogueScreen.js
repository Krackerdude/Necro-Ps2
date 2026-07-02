import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';

/**
 * DialogueScreen — NPC conversation: a bottom-anchored box in the design
 * language with a name plate and paged typewriter text.
 *
 * E / Enter / click: first press completes the typewriter, next advances
 * the page; past the last page the conversation closes. Esc closes early
 * (the talked flag is only set on FULL completion — required conversations
 * can't be skimmed).
 */
const CHARS_PER_SECOND = 44;

export class DialogueScreen extends Screen {
  #name;
  #lines;
  #events;
  #onClose;
  #page = 0;
  #shown = 0;
  #timer = null;

  /**
   * @param {{ name: string, lines: string[], events: object,
   *           onClose: (completed: boolean) => void }} deps
   */
  constructor({ name, lines, events, onClose }) {
    super();
    this.#name = name;
    this.#lines = lines;
    this.#events = events;
    this.#onClose = onClose;
  }

  build() {
    return el(
      'div.screen.dialogue-screen',
      { onclick: () => this.#advance() },
      el(
        'div.dialogue-box',
        {},
        el('div.dialogue-name', {}, this.#name),
        el('div.dialogue-text', {}),
        el('div.dialogue-more', {}, '▸')
      )
    );
  }

  onShow() {
    window.addEventListener('keydown', this.#onKey);
    this.#startPage();
  }

  onHide() {
    window.removeEventListener('keydown', this.#onKey);
    clearInterval(this.#timer);
  }

  #onKey = (e) => {
    if (e.code === 'Escape') {
      e.preventDefault();
      this.#events.emit('audio/sfx', { id: 'uiBack' });
      this.#onClose(false);
      return;
    }
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      this.#advance();
    }
  };

  #startPage() {
    clearInterval(this.#timer);
    this.#shown = 0;
    const text = this.#lines[this.#page];
    const node = this.element.querySelector('.dialogue-text');
    const more = this.element.querySelector('.dialogue-more');
    more.classList.remove('ready');
    this.#timer = setInterval(() => {
      this.#shown += 1;
      node.textContent = text.slice(0, this.#shown);
      if (this.#shown % 3 === 0) this.#events.emit('audio/sfx', { id: 'dialogueTick' });
      if (this.#shown >= text.length) {
        clearInterval(this.#timer);
        more.classList.add('ready');
      }
    }, 1000 / CHARS_PER_SECOND);
  }

  #advance() {
    const text = this.#lines[this.#page];
    if (this.#shown < text.length) {
      // First press: reveal the full page.
      clearInterval(this.#timer);
      this.#shown = text.length;
      this.element.querySelector('.dialogue-text').textContent = text;
      this.element.querySelector('.dialogue-more').classList.add('ready');
      return;
    }
    this.#events.emit('audio/sfx', { id: 'uiMove' });
    this.#page += 1;
    if (this.#page >= this.#lines.length) {
      this.#onClose(true);
      return;
    }
    this.#startPage();
  }
}
