import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { MANUAL_SLOTS, AUTO_SLOT } from '../../save/SaveService.js';

/**
 * SaveLoadScreen — slot picker for both saving (at shrines) and loading
 * (title / pause / game over). Mode decides which slots are actionable:
 *   'save' — manual slots only (autosave is the engine's).
 *   'load' — any slot with data.
 */
export class SaveLoadScreen extends Screen {
  #mode;
  #save;
  #events;
  #onPick;
  #onBack;

  /**
   * @param {{ mode: 'save'|'load', save: object, events: object,
   *           onPick: (slot: string) => void, onBack: () => void }} deps
   */
  constructor({ mode, save, events, onPick, onBack }) {
    super();
    this.#mode = mode;
    this.#save = save;
    this.#events = events;
    this.#onPick = onPick;
    this.#onBack = onBack;
  }

  build() {
    const slots = this.#mode === 'save' ? MANUAL_SLOTS : [AUTO_SLOT, ...MANUAL_SLOTS];
    return el(
      'div.screen.panel-screen',
      {},
      el(
        'div.panel',
        {},
        el(
          'div.panel-header',
          {},
          el('h2', {}, this.#mode === 'save' ? 'Commit to Bone' : 'Recall'),
          el('div.crumb', {}, 'ESC TO GO BACK')
        ),
        el('div.panel-body', {}, el('div.slot-list', {}, slots.map((slot) => this.#buildSlot(slot)))),
        el(
          'div.panel-footer',
          {},
          this.#mode === 'save'
            ? 'SAVING OVERWRITES THE CHOSEN SLOT'
            : 'LOADING DISCARDS UNSAVED PROGRESS'
        )
      )
    );
  }

  #buildSlot(slot) {
    const record = this.#save.getSave(slot);
    const empty = !record;
    const disabled = this.#mode === 'load' && empty;

    const name = slot === AUTO_SLOT ? 'AUTO' : `SLOT ${slot.slice(-1)}`;
    const meta = record
      ? el(
          'div.slot-meta',
          {},
          record.meta.levelName ?? record.meta.levelId,
          el(
            'small',
            {},
            `${new Date(record.meta.timestamp).toLocaleString()} ・ ${formatPlaytime(record.meta.playtime)}`
          )
        )
      : el('div.slot-meta', {}, '— EMPTY —');

    return el(
      `button.slot${empty ? '.empty' : ''}`,
      {
        onclick: () => {
          if (disabled) return;
          this.#events.emit('audio/sfx', { id: 'uiConfirm' });
          this.#onPick(slot);
        },
        onmouseenter: (e) => {
          if (disabled) return;
          this.element.querySelectorAll('.slot').forEach((s) => s.classList.remove('selected'));
          e.currentTarget.classList.add('selected');
        },
      },
      el('div.slot-id', {}, name),
      meta,
      record ? el(`div.slot-cond.${record.meta.condition}`, {}, record.meta.condition) : el('div', {})
    );
  }

  onShow() {
    window.addEventListener('keydown', this.#onKey);
  }

  onHide() {
    window.removeEventListener('keydown', this.#onKey);
  }

  #onKey = (e) => {
    if (e.code === 'Escape') {
      e.preventDefault();
      this.#events.emit('audio/sfx', { id: 'uiBack' });
      this.#onBack();
    }
  };
}

function formatPlaytime(seconds = 0) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}
