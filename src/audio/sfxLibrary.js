/**
 * sfxLibrary — synthesized one-shot sound effects.
 *
 * Each entry is a small recipe run against the shared AudioContext. These are
 * deliberately lo-fi (short envelopes, filtered noise, detuned oscillators) —
 * era-appropriate and asset-free. Recorded samples can replace individual
 * ids later without changing callers, who only know `playSfx(ctx, bus, id)`.
 */
export function playSfx(ctx, bus, id) {
  const recipe = RECIPES[id];
  if (!recipe) return; // unknown ids are silent, not fatal
  recipe(ctx, bus);
}

function envGain(ctx, bus, attack, decay, peak = 1) {
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  gain.connect(bus);
  return gain;
}

function noiseSource(ctx, duration) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
}

const RECIPES = {
  footstep: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.005, 0.11, 0.35);
    const noise = noiseSource(ctx, 0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320 + Math.random() * 120;
    noise.connect(filter).connect(gain);
    noise.start();
  },

  uiMove: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.002, 0.05, 0.18);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 660;
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  },

  uiConfirm: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.004, 0.18, 0.22);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(392, ctx.currentTime);
    osc.frequency.setValueAtTime(523, ctx.currentTime + 0.07);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  },

  uiBack: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.004, 0.14, 0.2);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(349, ctx.currentTime + 0.06);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  },

  doorUnlock: (ctx, bus) => {
    for (const [delay, freq] of [
      [0, 180],
      [0.12, 90],
    ]) {
      const gain = ctx.createGain();
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      gain.connect(bus);
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.16);
    }
  },

  wraithShriek: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.08, 1.4, 0.3);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 1.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 6;
    osc.connect(filter).connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  },

  hurt: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.005, 0.3, 0.5);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  },

  saveChime: (ctx, bus) => {
    for (const [delay, freq] of [
      [0, 523],
      [0.15, 659],
      [0.3, 784],
    ]) {
      const t = ctx.currentTime + delay;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      gain.connect(bus);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.65);
    }
  },
};
