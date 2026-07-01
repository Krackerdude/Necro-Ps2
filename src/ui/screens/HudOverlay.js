import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { formatKeyCode } from '../../input/keyLabels.js';

/**
 * HudOverlay — minimal in-game readout: condition tag, interaction prompt,
 * toast feed, damage flash. Purely reactive: everything arrives via events.
 */
export class HudOverlay extends Screen {
  #events;
  #settings;
  #unsubs = [];
  #lastHealth = Infinity;

  constructor({ events, settings }) {
    super();
    this.#events = events;
    this.#settings = settings;
  }

  build() {
    return el(
      'div.hud',
      {},
      el('div.hud-damage', {}),
      el(
        'div.hud-condition',
        {},
        el('div.tag', {}, 'CONDITION'),
        el('div.value.FINE', {}, 'FINE')
      ),
      el('div.hud-prompt', { style: 'display:none' }),
      el('div.hud-toasts', {})
    );
  }

  onShow() {
    this.#unsubs = [
      this.#events.on('player/stats-changed', ({ health, condition }) => {
        const value = this.element.querySelector('.hud-condition .value');
        value.textContent = condition;
        value.className = `value ${condition}`;
        if (health < this.#lastHealth) this.#flashDamage();
        this.#lastHealth = health;
      }),
      this.#events.on('interaction/prompt-changed', ({ prompt }) => {
        const node = this.element.querySelector('.hud-prompt');
        if (!prompt) {
          node.style.display = 'none';
          return;
        }
        node.style.display = '';
        node.replaceChildren(
          el('span.key', {}, formatKeyCode(this.#settings.get('keybinds.interact')?.[0])),
          prompt
        );
      }),
      this.#events.on('ui/toast', ({ text }) => this.#toast(text)),
      this.#events.on('save/saved', ({ auto }) => {
        this.#toast(auto ? 'AUTOSAVED' : 'GAME SAVED');
        this.#events.emit('audio/sfx', { id: 'saveChime' });
      }),
    ];
  }

  onHide() {
    for (const unsub of this.#unsubs) unsub();
    this.#unsubs = [];
  }

  #toast(text) {
    const feed = this.element.querySelector('.hud-toasts');
    const node = el('div.toast', {}, text);
    feed.appendChild(node);
    setTimeout(() => node.classList.add('leaving'), 3200);
    setTimeout(() => node.remove(), 3600);
  }

  #flashDamage() {
    const flash = this.element.querySelector('.hud-damage');
    flash.classList.remove('active');
    void flash.offsetWidth; // restart the animation
    flash.classList.add('active');
  }
}
