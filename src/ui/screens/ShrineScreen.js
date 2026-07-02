import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { MenuList } from '../components/MenuList.js';

/**
 * ShrineScreen — praying at the bones offers two rites:
 * committing your progress (save) or opening the reliquary (item box).
 */
export class ShrineScreen extends Screen {
  #menu;

  constructor({ events, ui, onSave, onBox, onLeave }) {
    super();
    this.#menu = new MenuList(
      [
        { label: 'Commit to Bone', action: onSave },
        { label: 'The Reliquary', action: onBox },
        { label: 'Rise', action: onLeave },
      ],
      events,
      () => ui.isTop(this)
    );
  }

  build() {
    return el(
      'div.screen.pause-screen',
      {},
      el('div.pause-tag.ghosted', {}, 'AT THE BONES'),
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
