import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { MenuList } from '../components/MenuList.js';

/** GameOverScreen — the death card. */
export class GameOverScreen extends Screen {
  #menu;

  /**
   * @param {{ events: object, ui: object, hasSaves: boolean,
   *           onLoadLast: () => void, onQuit: () => void }} deps
   */
  constructor({ events, ui, hasSaves, onLoadLast, onQuit }) {
    super();
    this.#menu = new MenuList(
      [
        { label: 'Rise Again', action: onLoadLast, disabled: !hasSaves },
        { label: 'Return to Title', action: onQuit },
      ],
      events,
      () => ui.isTop(this)
    );
  }

  build() {
    return el(
      'div.screen.gameover-screen',
      {},
      el('h1', {}, 'THE GROUND TOOK YOU'),
      this.#menu.element
    );
  }

  onShow() {
    this.#menu.attach();
  }

  onHide() {
    this.#menu.detach();
  }
}
