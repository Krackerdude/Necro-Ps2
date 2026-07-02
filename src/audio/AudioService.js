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
  #musicFilter = null;
  #condition = 'FINE';
  #heartbeatTimer = null;

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

  /**
   * Condition-reactive layer: at DANGER the ambient bed muffles (lowpass)
   * and a heartbeat thumps under everything. The body is the mix.
   */
  setCondition(condition) {
    if (condition === this.#condition) return;
    this.#condition = condition;
    this.#applyCondition();
  }

  #applyCondition() {
    if (!this.#ctx) return;
    const danger = this.#condition === 'DANGER';
    const target = danger ? 480 : 20000;
    this.#musicFilter.frequency.cancelScheduledValues(this.#ctx.currentTime);
    this.#musicFilter.frequency.linearRampToValueAtTime(target, this.#ctx.currentTime + 1.2);

    if (danger && !this.#heartbeatTimer) {
      this.#heartbeatTimer = setInterval(() => this.#heartbeat(), 880);
    } else if (!danger && this.#heartbeatTimer) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
  }

  /** Lub-dub: two low sine thumps straight to the master bus. */
  #heartbeat() {
    if (!this.#ctx || this.#ctx.state !== 'running') return;
    for (const [delay, amp] of [
      [0, 0.22],
      [0.16, 0.15],
    ]) {
      const t = this.#ctx.currentTime + delay;
      const gain = this.#ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(amp, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      gain.connect(this.#buses.master);
      const osc = this.#ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 52;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.24);
    }
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
    // Music routes through a lowpass so DANGER can muffle the world.
    this.#musicFilter = this.#ctx.createBiquadFilter();
    this.#musicFilter.type = 'lowpass';
    this.#musicFilter.frequency.value = 20000;
    this.#musicFilter.connect(master);
    const music = this.#ctx.createGain();
    music.connect(this.#musicFilter);
    const sfx = this.#ctx.createGain();
    sfx.connect(master);
    this.#buses = { master, music, sfx };
    this.#applyVolumes();
    this.#applyCondition();
    if (this.#currentAmbientId) this.#startAmbient(this.#currentAmbientId);
  }

  #applyVolumes() {
    if (!this.#buses) return;
    this.#buses.master.gain.value = this.#settings.get('audio.masterVolume');
    this.#buses.music.gain.value = this.#settings.get('audio.musicVolume');
    this.#buses.sfx.gain.value = this.#settings.get('audio.sfxVolume');
  }
}
