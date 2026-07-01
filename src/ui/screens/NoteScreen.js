import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';

/** NoteScreen — a found document. Any confirm/back input closes it. */
export class NoteScreen extends Screen {
  #title;
  #body;
  #onClose;

  constructor({ title, body, onClose }) {
    super();
    this.#title = title;
    this.#body = body;
    this.#onClose = onClose;
  }

  build() {
    return el(
      'div.screen.note-screen',
      { onclick: () => this.#onClose() },
      el(
        'div.note-paper',
        {},
        el('h3', {}, this.#title),
        ...this.#body.split('\n\n').map((paragraph) => el('p', {}, paragraph)),
        el('div.note-close', {}, 'PRESS ANY KEY TO PUT IT DOWN')
      )
    );
  }

  onShow() {
    window.addEventListener('keydown', this.#onKey);
  }

  onHide() {
    window.removeEventListener('keydown', this.#onKey);
  }

  #onKey = (e) => {
    e.preventDefault();
    this.#onClose();
  };
}
