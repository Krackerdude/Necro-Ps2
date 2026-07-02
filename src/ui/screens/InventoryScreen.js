import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { ExamineView } from '../components/ExamineView.js';
import { getItem } from '../../gameplay/inventory/itemCatalog.js';
import { DOCUMENTS, collectedDocuments } from '../../gameplay/story/documents.js';

/**
 * InventoryScreen — the satchel. A tile grid on the left, the selected
 * item's dossier on the right, actions below (Use / Equip / Unequip).
 *
 * Pure view over the Inventory model: every action goes through the model,
 * which emits 'inventory/changed', which re-renders. No game logic here.
 */
export class InventoryScreen extends Screen {
  #inventory;
  #stats;
  #events;
  #ps2;
  #onClose;
  #selected = 0;
  #unsub = null;
  #examine = null;
  #examineItemId = null;

  #story;

  constructor({ inventory, stats, events, ps2 = null, story = null, onClose }) {
    super();
    this.#inventory = inventory;
    this.#stats = stats;
    this.#events = events;
    this.#ps2 = ps2;
    this.#story = story;
    this.#onClose = onClose;
  }

  build() {
    return el(
      'div.screen.panel-screen',
      {},
      el(
        'div.panel.inventory-panel',
        {},
        el(
          'div.panel-header',
          {},
          el('h2', {}, 'Satchel'),
          el('div.crumb', {}, 'TAB / ESC TO CLOSE')
        ),
        el('div.panel-body.inv-body', {}),
        el('div.panel-footer', {}, 'WEAPONS MUST BE EQUIPPED ・ HOLD Q TO READY ・ SPACE TO ATTACK')
      )
    );
  }

  onShow() {
    window.addEventListener('keydown', this.#onKey);
    this.#unsub = this.#events.on('inventory/changed', () => this.#render());
    if (this.#ps2) this.#examine = new ExamineView(this.#ps2);
    this.#render();
  }

  onHide() {
    window.removeEventListener('keydown', this.#onKey);
    this.#unsub?.();
    this.#unsub = null;
    this.#examine?.dispose();
    this.#examine = null;
    this.#examineItemId = null;
  }

  #onKey = (e) => {
    const stacks = this.#inventory.stacks;
    switch (e.code) {
      case 'Escape':
      case 'Tab':
      case 'KeyI':
        e.preventDefault();
        this.#events.emit('audio/sfx', { id: 'uiBack' });
        this.#onClose();
        break;
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        this.#select(Math.max(0, this.#selected - 1));
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        this.#select(Math.min(Math.max(0, stacks.length - 1), this.#selected + 1));
        break;
      case 'Enter':
      case 'KeyE':
        e.preventDefault();
        this.#primaryAction();
        break;
      default:
    }
  };

  #select(index) {
    if (index !== this.#selected) this.#events.emit('audio/sfx', { id: 'uiMove' });
    this.#selected = index;
    this.#render();
  }

  #primaryAction() {
    const stack = this.#inventory.stacks[this.#selected];
    if (!stack) return;
    const def = getItem(stack.id);
    if (def.kind === 'weapon') {
      const equipped = this.#inventory.equippedWeaponId === stack.id;
      this.#inventory.equip(equipped ? null : stack.id);
      this.#events.emit('audio/sfx', { id: 'uiConfirm' });
    } else if (def.kind === 'consumable') {
      if (this.#inventory.use(stack.id, { stats: this.#stats, events: this.#events })) {
        this.#events.emit('audio/sfx', { id: 'uiConfirm' });
      } else {
        this.#events.emit('ui/toast', { text: 'No need. Not yet.' });
      }
    }
  }

  #render() {
    const body = this.element?.querySelector('.inv-body');
    if (!body) return;
    const stacks = this.#inventory.stacks;
    this.#selected = Math.min(this.#selected, Math.max(0, stacks.length - 1));

    if (stacks.length === 0) {
      body.replaceChildren(
        el('div.inv-empty', {}, 'Nothing but lint and church dust.'),
        this.#buildDocumentsShelf()
      );
      return;
    }

    const grid = el(
      'div.inv-grid',
      {},
      stacks.map((stack, i) => {
        const def = getItem(stack.id);
        const equipped = this.#inventory.equippedWeaponId === stack.id;
        return el(
          `button.inv-tile${i === this.#selected ? '.selected' : ''}${equipped ? '.equipped' : ''}`,
          {
            onclick: () => this.#select(i),
            ondblclick: () => this.#primaryAction(),
          },
          el('div.inv-glyph', {}, def.glyph),
          el('div.inv-name', {}, def.name),
          stack.qty > 1 ? el('div.inv-qty', {}, `×${stack.qty}`) : null,
          equipped ? el('div.inv-equip-tag', {}, 'EQUIPPED') : null
        );
      })
    );

    const stack = stacks[this.#selected];
    const def = getItem(stack.id);
    const equipped = this.#inventory.equippedWeaponId === stack.id;
    const actionLabel =
      def.kind === 'weapon' ? (equipped ? 'Unequip' : 'Equip') : def.kind === 'consumable' ? 'Use' : null;

    if (this.#examine && this.#examineItemId !== stack.id) {
      this.#examineItemId = stack.id;
      this.#examine.setItem(stack.id);
    }

    const dossier = el(
      'div.inv-dossier',
      {},
      this.#examine ? this.#examine.canvas : null,
      el('h3', {}, def.name),
      el('div.inv-kind', {}, def.kind.toUpperCase()),
      el('p', {}, def.description),
      def.weapon
        ? el(
            'div.inv-stats',
            {},
            `DMG ${def.weapon.damage} ・ ${def.weapon.type === 'ranged' ? `RANGE ${def.weapon.range}m ・ USES ${getItem(def.weapon.usesAmmo).name.toUpperCase()}` : `REACH ${def.weapon.range}m`}`
          )
        : null,
      actionLabel
        ? el('div.opt-actions', {}, el('button.text-btn', { onclick: () => this.#primaryAction() }, actionLabel))
        : el('div.inv-kind', {}, 'Its use will present itself.')
    );

    body.replaceChildren(grid, dossier, this.#buildDocumentsShelf());
  }

  /** Every document you've read, re-readable. The lore is a collection. */
  #buildDocumentsShelf() {
    const read = this.#story ? collectedDocuments(this.#story) : [];
    return el(
      'div.inv-docs',
      {},
      el('div.inv-docs-title', {}, `DOCUMENTS ・ ${read.length}/${Object.keys(DOCUMENTS).length}`),
      read.length === 0
        ? el('div.inv-docs-empty', {}, 'No papers collected. The dead wrote things down.')
        : el(
            'div.inv-docs-list',
            {},
            read.map((id) =>
              el(
                'button.inv-doc',
                {
                  onclick: () => {
                    this.#events.emit('audio/sfx', { id: 'uiConfirm' });
                    this.#events.emit('ui/show-note', DOCUMENTS[id]);
                  },
                },
                DOCUMENTS[id].title
              )
            )
          )
    );
  }
}
