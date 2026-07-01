import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { OPTIONS_TABS } from './optionsSchema.js';
import { ACTIONS } from '../../input/actions.js';
import { formatKeyCode } from '../../input/keyLabels.js';

/**
 * OptionsScreen — Display / Graphics / Audio / Keybinds.
 *
 * Rendered from optionsSchema.js (keybinds from input/actions.js). Writes go
 * straight to SettingsService, which broadcasts changes; the renderer,
 * pipeline, audio, and input all react on their own. This screen owns zero
 * game logic.
 */
export class OptionsScreen extends Screen {
  #settings;
  #events;
  #input;
  #onBack;
  #activeTab = 'display';
  #listeningAction = null;
  #unsubRawKey = null;

  constructor({ settings, events, input, onBack }) {
    super();
    this.#settings = settings;
    this.#events = events;
    this.#input = input;
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
          el('h2', {}, 'Options'),
          el('div.crumb', {}, 'ESC TO GO BACK')
        ),
        el(
          'div.tab-row',
          {},
          OPTIONS_TABS.map((tab) =>
            el(
              'button',
              {
                className: tab.id === this.#activeTab ? 'active' : '',
                dataset: { tab: tab.id },
                onclick: () => this.#switchTab(tab.id),
              },
              tab.label
            )
          )
        ),
        el('div.panel-body', {}),
        el('div.panel-footer', {}, 'CHANGES APPLY IMMEDIATELY AND ARE SAVED AUTOMATICALLY')
      )
    );
  }

  onShow() {
    window.addEventListener('keydown', this.#onKey);
    this.#renderBody();
  }

  onHide() {
    this.#stopListening();
    window.removeEventListener('keydown', this.#onKey);
  }

  #onKey = (e) => {
    if (e.code === 'Escape' && !this.#listeningAction) {
      e.preventDefault();
      this.#events.emit('audio/sfx', { id: 'uiBack' });
      this.#onBack();
    }
  };

  #switchTab(id) {
    this.#stopListening();
    this.#activeTab = id;
    this.element
      .querySelectorAll('.tab-row button')
      .forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    this.#events.emit('audio/sfx', { id: 'uiMove' });
    this.#renderBody();
  }

  #renderBody() {
    const body = this.element.querySelector('.panel-body');
    if (this.#activeTab === 'keybinds') {
      body.replaceChildren(...this.#buildKeybindRows(), this.#buildResetRow('keybinds'));
      return;
    }
    const tab = OPTIONS_TABS.find((t) => t.id === this.#activeTab);
    body.replaceChildren(...tab.rows.map((row) => this.#buildRow(row)), this.#buildResetRow(tab.id));
  }

  /* ---------- generic setting rows ---------- */

  #buildRow(row) {
    const value = this.#settings.get(row.path);
    const valueEl = this.#buildValue(row, value);
    return el(
      'div.opt-row',
      {},
      el('div.opt-label', {}, row.label, row.note ? el('small', {}, row.note) : null),
      valueEl
    );
  }

  #buildValue(row, value) {
    const set = (v) => {
      this.#settings.set(row.path, v);
      this.#events.emit('audio/sfx', { id: 'uiMove' });
      this.#renderBody();
    };

    if (row.kind === 'toggle') {
      return el(
        'div.opt-value',
        {},
        el('button.arrow', { onclick: () => set(!value) }, '◀'),
        el(`span.val.${value ? 'on' : 'off'}`, {}, value ? 'ON' : 'OFF'),
        el('button.arrow', { onclick: () => set(!value) }, '▶')
      );
    }

    if (row.kind === 'choice') {
      const index = Math.max(0, row.choices.findIndex((c) => c.value === value));
      const cycle = (dir) =>
        set(row.choices[(index + dir + row.choices.length) % row.choices.length].value);
      return el(
        'div.opt-value',
        {},
        el('button.arrow', { onclick: () => cycle(-1) }, '◀'),
        el('span.val', {}, row.choices[index]?.label ?? String(value)),
        el('button.arrow', { onclick: () => cycle(1) }, '▶')
      );
    }

    // range
    const format = row.format ?? ((v) => String(v));
    const step = (dir) => {
      const next = Math.round((value + dir * row.step) * 100) / 100;
      set(Math.min(row.max, Math.max(row.min, next)));
    };
    return el(
      'div.opt-value',
      {},
      el('button.arrow', { onclick: () => step(-1) }, '◀'),
      el('span.val', {}, format(value)),
      el('button.arrow', { onclick: () => step(1) }, '▶')
    );
  }

  /* ---------- keybinds ---------- */

  #buildKeybindRows() {
    const binds = this.#settings.get('keybinds');
    let category = null;
    const rows = [];
    for (const action of ACTIONS) {
      if (action.category !== category) {
        category = action.category;
        rows.push(el('div.opt-row', {}, el('div.opt-label', {}, el('small', {}, category))));
      }
      const codes = binds[action.id] ?? [];
      const listening = this.#listeningAction === action.id;
      rows.push(
        el(
          'div.opt-row',
          {},
          el('div.opt-label', {}, action.label),
          el(
            'div.opt-value',
            {},
            el(
              `button.bind-chip${listening ? '.listening' : ''}`,
              { onclick: () => this.#startListening(action.id) },
              listening ? 'PRESS A KEY…' : codes.map(formatKeyCode).join('  /  ') || '—'
            )
          )
        )
      );
    }
    return rows;
  }

  #startListening(actionId) {
    this.#stopListening();
    this.#listeningAction = actionId;
    this.#input.setCaptureMode(true);
    this.#unsubRawKey = this.#events.on('input/raw-key', ({ code }) => {
      if (code !== 'Escape') {
        // Rebind replaces the primary key, keeps any secondary defaults out
        // of the way (single explicit binding per rebind keeps the UX clear).
        this.#settings.set(`keybinds.${this.#listeningAction}`, [code]);
      }
      this.#stopListening();
      this.#renderBody();
    });
    this.#renderBody();
  }

  #stopListening() {
    if (!this.#listeningAction) return;
    this.#listeningAction = null;
    this.#unsubRawKey?.();
    this.#unsubRawKey = null;
    this.#input.setCaptureMode(false);
  }

  #buildResetRow(tabId) {
    const subtree = tabId === 'keybinds' ? 'keybinds' : tabId;
    return el(
      'div.opt-actions',
      {},
      el(
        'button.text-btn',
        {
          onclick: () => {
            this.#settings.resetToDefaults(subtree);
            this.#events.emit('audio/sfx', { id: 'uiBack' });
            this.#renderBody();
          },
        },
        `Reset ${tabId} to defaults`
      )
    );
  }
}
