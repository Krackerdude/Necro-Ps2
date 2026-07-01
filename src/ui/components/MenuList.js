import { el } from './dom.js';

/**
 * MenuList — keyboard + mouse navigable vertical menu (the cascading title
 * and pause menus). Owns its keydown listener; attach()/detach() from the
 * host screen's onShow/onHide.
 *
 * items: [{ label, action, disabled?, hint? }]
 */
export class MenuList {
  element;

  #items;
  #index = 0;
  #events;
  #isActive;
  #buttons = [];

  /**
   * @param {object[]} items
   * @param {import('../../core/EventBus.js').EventBus} events for UI sfx
   * @param {() => boolean} [isActive] gate (e.g. () => ui.isTop(screen))
   */
  constructor(items, events, isActive = () => true) {
    this.#items = items;
    this.#events = events;
    this.#isActive = isActive;

    this.element = el(
      'ul.menu-list',
      {},
      items.map((item, i) =>
        el(
          'li',
          {},
          el(
            `button.display-type${item.disabled ? '.disabled' : ''}`,
            {
              onclick: () => this.#activate(i),
              onmouseenter: () => this.#select(i, false),
            },
            item.label
          )
        )
      )
    );
    this.#buttons = [...this.element.querySelectorAll('li')];
    this.#select(this.#firstEnabled(), true);
  }

  attach() {
    window.addEventListener('keydown', this.#onKey);
  }

  detach() {
    window.removeEventListener('keydown', this.#onKey);
  }

  #onKey = (e) => {
    if (!this.#isActive()) return;
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.#move(-1);
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.#move(1);
        e.preventDefault();
        break;
      case 'Enter':
      case 'KeyE':
      case 'Space':
        this.#activate(this.#index);
        e.preventDefault();
        break;
      default:
    }
  };

  #firstEnabled() {
    const i = this.#items.findIndex((item) => !item.disabled);
    return i === -1 ? 0 : i;
  }

  #move(dir) {
    let next = this.#index;
    for (let n = 0; n < this.#items.length; n++) {
      next = (next + dir + this.#items.length) % this.#items.length;
      if (!this.#items[next].disabled) break;
    }
    this.#select(next, true);
  }

  #select(index, sound) {
    if (this.#items[index]?.disabled && !sound) return;
    this.#index = index;
    this.#buttons.forEach((li, i) => li.classList.toggle('selected', i === index));
    if (sound) this.#events.emit('audio/sfx', { id: 'uiMove' });
  }

  #activate(index) {
    const item = this.#items[index];
    if (!item || item.disabled) return;
    this.#events.emit('audio/sfx', { id: 'uiConfirm' });
    item.action();
  }
}
