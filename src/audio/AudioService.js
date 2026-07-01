import { playSfx } from './sfxLibrary.js';
import { createAmbientTrack } from './ambientTracks.js';

/**
 * AudioService — WebAudio bus graph + procedural sound.
 *
 * Graph: sfx ─┐
 *             ├─ master ─ destination
 *    music ──┘
 *
 * Bus gains track settings ('audio.*') live. All current sounds are
 * synthesized (see sfxLibrary / ambientTracks); when real recorded assets
 * arrive, they enter through the same two entry points — nothing outside
 * the audio domain changes.
 *
 * Browsers require a user gesture before audio; the context is created
 * lazily on the first gesture and everything degrades silently before that.
 */
export class AudioService {
  #ctx = null;
  #buses = null;
  #settings;
  #currentAmbient = null;
  #currentAmbientId = null;

  constructor(events, settings) {
    this.#settings = settings;

    const unlock = () => {
      this.#ensureContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    events.on('audio/sfx', ({ id }) => this.sfx(id));
    events.on('settings/changed', ({ path }) => {
      if (path.startsWith('audio')) this.#applyVolumes();
    });
  }

  sfx(id) {
    if (!this.#ctx) return;
    playSfx(this.#ctx, this.#buses.sfx, id);
  }

  /** Start (or switch to) a looping ambient bed. */
  playAmbient(id) {
    if (this.#currentAmbientId === id) return;
    this.#currentAmbientId = id;
    if (!this.#ctx) return; // will start on unlock via ensureContext
    this.#startAmbient(id);
  }

  stopAmbient() {
    this.#currentAmbientId = null;
    this.#currentAmbient?.stop();
    this.#currentAmbient = null;
  }

  #startAmbient(id) {
    this.#currentAmbient?.stop();
    this.#currentAmbient = createAmbientTrack(this.#ctx, this.#buses.music, id);
  }

  #ensureContext() {
    if (this.#ctx) return;
    this.#ctx = new AudioContext();
    const master = this.#ctx.createGain();
    master.connect(this.#ctx.destination);
    const music = this.#ctx.createGain();
    music.connect(master);
    const sfx = this.#ctx.createGain();
    sfx.connect(master);
    this.#buses = { master, music, sfx };
    this.#applyVolumes();
    if (this.#currentAmbientId) this.#startAmbient(this.#currentAmbientId);
  }

  #applyVolumes() {
    if (!this.#buses) return;
    this.#buses.master.gain.value = this.#settings.get('audio.masterVolume');
    this.#buses.music.gain.value = this.#settings.get('audio.musicVolume');
    this.#buses.sfx.gain.value = this.#settings.get('audio.sfxVolume');
  }
}
