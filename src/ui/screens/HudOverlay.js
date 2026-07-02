import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';
import { formatKeyCode } from '../../input/keyLabels.js';
import { getItem } from '../../gameplay/inventory/itemCatalog.js';
import { getCurrentObjective } from '../../gameplay/story/objectives.js';

/**
 * HudOverlay — minimal in-game readout: condition tag, weapon/ammo tag,
 * interaction prompt, toast feed, damage flash. Purely reactive: everything
 * arrives via events (plus the inventory model for the weapon readout).
 */
export class HudOverlay extends Screen {
  #events;
  #settings;
  #inventory;
  #story;
  #unsubs = [];
  #lastHealth = Infinity;
  #aiming = false;
  #objectiveId = null;

  constructor({ events, settings, inventory = null, story = null }) {
    super();
    this.#events = events;
    this.#settings = settings;
    this.#inventory = inventory;
    this.#story = story;
  }

  build() {
    return el(
      'div.hud',
      {},
      el('div.hud-damage', {}),
      el('div.hud-objective', { style: 'display:none' }),
      el(
        'div.hud-condition',
        {},
        el('div.tag', {}, 'CONDITION'),
        el('div.value.FINE', {}, 'FINE')
      ),
      el('div.hud-prompt', { style: 'display:none' }),
      el('div.hud-weapon', { style: 'display:none' }),
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
      this.#events.on('inventory/changed', () => {
        this.#renderWeapon();
        this.#renderObjective();
      }),
      this.#events.on('story/flag-changed', () => this.#renderObjective()),
      this.#events.on('combat/aim-changed', ({ aiming }) => {
        this.#aiming = aiming;
        this.#renderWeapon();
      }),
      this.#events.on('save/saved', ({ auto }) => {
        this.#toast(auto ? 'AUTOSAVED' : 'GAME SAVED');
        this.#events.emit('audio/sfx', { id: 'saveChime' });
      }),
    ];
    this.#renderWeapon();
    this.#renderObjective();
  }

  #renderObjective() {
    const node = this.element?.querySelector('.hud-objective');
    if (!node || !this.#story) return;
    const objective = getCurrentObjective({ story: this.#story, inventory: this.#inventory });
    if (objective.id === this.#objectiveId) return;
    this.#objectiveId = objective.id;
    node.style.display = '';
    node.replaceChildren(
      el('div.tag', {}, 'OBJECTIVE'),
      el('div.value', {}, objective.text)
    );
    // Restart the slash-in animation on every change.
    node.classList.remove('changed');
    void node.offsetWidth;
    node.classList.add('changed');
  }

  onHide() {
    for (const unsub of this.#unsubs) unsub();
    this.#unsubs = [];
  }

  #renderWeapon() {
    const node = this.element?.querySelector('.hud-weapon');
    if (!node) return;
    const weaponId = this.#inventory?.equippedWeaponId;
    if (!weaponId) {
      node.style.display = 'none';
      return;
    }
    const def = getItem(weaponId);
    node.style.display = '';
    node.classList.toggle('aiming', this.#aiming);
    const ammoText =
      def.weapon.type === 'ranged'
        ? String(this.#inventory.count(def.weapon.usesAmmo)).padStart(2, '0')
        : '—';
    node.replaceChildren(
      el('div.tag', {}, this.#aiming ? 'READY' : 'ARMED'),
      el('div.value', {}, `${def.name.toUpperCase()}  ${ammoText}`)
    );
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
