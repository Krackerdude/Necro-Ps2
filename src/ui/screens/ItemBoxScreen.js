import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { getItem } from '../../gameplay/inventory/itemCatalog.js';

/**
 * ItemBoxScreen — the reliquary: shared storage at every shrine.
 *
 * Two columns; click an item to move it to the other side. The satchel has
 * a slot cap, the reliquary doesn't — the classic RE item-box economy.
 */
export class ItemBoxScreen extends Screen {
  #satchel;
  #box;
  #events;
  #onBack;
  #unsub = null;

  constructor({ satchel, box, events, onBack }) {
    super();
    this.#satchel = satchel;
    this.#box = box;
    this.#events = events;
    this.#onBack = onBack;
  }

  build() {
    return el(
      'div.screen.panel-screen',
      {},
      el(
        'div.panel',
        {},
        el(
          'div.panel-header',
          {},
          el('h2', {}, 'The Reliquary'),
          el('div.crumb', {}, 'CLICK TO MOVE ・ ESC TO GO BACK')
        ),
        el('div.panel-body.box-body', {}),
        el('div.panel-footer', {}, 'WHAT THE BONES HOLD, EVERY SHRINE REMEMBERS')
      )
    );
  }

  onShow() {
    window.addEventListener('keydown', this.#onKey);
    this.#unsub = this.#events.on('inventory/changed', () => this.#render());
    this.#render();
  }

  onHide() {
    window.removeEventListener('keydown', this.#onKey);
    this.#unsub?.();
    this.#unsub = null;
  }

  #onKey = (e) => {
    if (e.code === 'Escape' || e.code === 'Tab') {
      e.preventDefault();
      this.#events.emit('audio/sfx', { id: 'uiBack' });
      this.#onBack();
    }
  };

  #move(from, to, stackIndex) {
    const stack = from.stacks[stackIndex];
    if (!stack) return;
    const qty = Math.min(stack.qty, 1); // move one at a time — deliberate choices
    if (!to.canFit(stack.id, qty)) {
      this.#events.emit('ui/toast', { text: 'No room on that side.' });
      this.#events.emit('audio/sfx', { id: 'uiBack' });
      return;
    }
    from.remove(stack.id, qty);
    to.add(stack.id, qty);
    this.#events.emit('audio/sfx', { id: 'uiMove' });
  }

  #column(title, inv, other) {
    const cap = Number.isFinite(inv.maxSlots) ? ` ${inv.slotsUsed}/${inv.maxSlots}` : '';
    return el(
      'div.box-column',
      {},
      el('div.inv-docs-title', {}, `${title}${cap}`),
      inv.stacks.length === 0
        ? el('div.inv-docs-empty', {}, '— empty —')
        : el(
            'div.box-list',
            {},
            inv.stacks.map((stack, i) => {
              const def = getItem(stack.id);
              return el(
                'button.inv-doc',
                { onclick: () => this.#move(inv, other, i) },
                `${def.glyph} ${def.name}${stack.qty > 1 ? ` ×${stack.qty}` : ''}`
              );
            })
          )
    );
  }

  #render() {
    const body = this.element?.querySelector('.box-body');
    if (!body) return;
    body.replaceChildren(
      this.#column('SATCHEL', this.#satchel, this.#box),
      this.#column('RELIQUARY', this.#box, this.#satchel)
    );
  }
}
