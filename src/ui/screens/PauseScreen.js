import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { MenuList } from '../components/MenuList.js';

/** PauseScreen — sheared cascade over a darkened, blood-washed frame. */
export class PauseScreen extends Screen {
  #menu;

  /**
   * @param {{ events: object, ui: object, hasSaves: boolean,
   *           onResume: () => void, onLoadGame: () => void,
   *           onOptions: () => void, onQuit: () => void }} deps
   */
  constructor({ events, ui, hasSaves, onResume, onLoadGame, onOptions, onQuit }) {
    super();
    this.#menu = new MenuList(
      [
        { label: 'Resume', action: onResume },
        { label: 'Load Game', action: onLoadGame, disabled: !hasSaves },
        { label: 'Options', action: onOptions },
        { label: 'Quit to Title', action: onQuit },
      ],
      events,
      () => ui.isTop(this)
    );
  }

  build() {
    return el(
      'div.screen.pause-screen',
      {},
      el('div.pause-tag.ghosted', {}, 'HELD BREATH'),
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
