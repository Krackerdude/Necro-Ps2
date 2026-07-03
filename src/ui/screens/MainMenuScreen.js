import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { MenuList } from '../components/MenuList.js';

/**
 * MainMenuScreen — the 2D layer over the 3D graveyard vista.
 * Cascading sheared menu, big ghosted wordmark. Pure presentation:
 * actions are injected by MainMenuState.
 */
export class MainMenuScreen extends Screen {
  #menu;

  /**
   * @param {{ events: object, ui: object, hasSaves: boolean,
   *           onNewGame: () => void, onLoadGame: () => void,
   *           onOptions: () => void }} deps
   */
  constructor({ events, ui, hasSaves, onNewGame, onLoadGame, onOptions }) {
    super();
    this.#menu = new MenuList(
      [
        { label: 'New Game', action: onNewGame },
        { label: 'Load Game', action: onLoadGame, disabled: !hasSaves },
        { label: 'Options', action: onOptions },
      ],
      events,
      () => ui.isTop(this)
    );
  }

  build() {
    return el(
      'div.screen.title-screen',
      {},
      el(
        'div.title-block',
        {},
        el('div.over', {}, 'THE GROUND REMEMBERS'),
        el('h1', {}, 'GRAVEN'),
        el('div.under', {}, 'A LETTER ・ A TOWN ・ A THING BELOW')
      ),
      this.#menu.element,
      el('div.menu-hint', {}, '↑↓ SELECT ・ ENTER CONFIRM')
    );
  }

  onShow() {
    this.#menu.attach();
  }

  onHide() {
    this.#menu.detach();
  }
}
