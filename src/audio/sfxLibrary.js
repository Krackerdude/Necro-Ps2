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
    const gain = envGain(ctx, bus, 0.005, 0.11, 0.13);
    const noise = noiseSource(ctx, 0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200 + Math.random() * 60;
    noise.connect(filter).connect(gain);
    noise.start();
  },

  footstepWood: (ctx, bus) => {
    // Hollow knock: short low square + a whisper of noise.
    const gain = envGain(ctx, bus, 0.003, 0.1, 0.11);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 105 + Math.random() * 30;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    osc.connect(lp).connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
  },

  footstepWater: (ctx, bus) => {
    // Wade-splash: bright noise burst + a lower slosh tail.
    const splash = envGain(ctx, bus, 0.004, 0.16, 0.12);
    const noise = noiseSource(ctx, 0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520 + Math.random() * 240;
    bp.Q.value = 1.2;
    noise.connect(bp).connect(splash);
    noise.start();
    const slosh = envGain(ctx, bus, 0.05, 0.22, 0.07);
    const noise2 = noiseSource(ctx, 0.26);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    noise2.connect(lp).connect(slosh);
    noise2.start();
  },

  footstepBone: (ctx, bus) => {
    // Dry crunch: bright crackle with a couple of snap transients.
    const gain = envGain(ctx, bus, 0.002, 0.09, 0.1);
    const noise = noiseSource(ctx, 0.1);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 850;
    noise.connect(hp).connect(gain);
    noise.start();
    const t = ctx.currentTime + 0.03 + Math.random() * 0.03;
    const snap = ctx.createGain();
    snap.gain.setValueAtTime(0, t);
    snap.gain.linearRampToValueAtTime(0.05, t + 0.002);
    snap.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    snap.connect(bus);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 2600 + Math.random() * 800;
    osc.connect(snap);
    osc.start(t);
    osc.stop(t + 0.05);
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

  doorTransition: (ctx, bus) => {
    // Heavy hinge creak + a settling wooden knock.
    const creak = envGain(ctx, bus, 0.05, 0.7, 0.25);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.6);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400;
    bp.Q.value = 9;
    osc.connect(bp).connect(creak);
    osc.start();
    osc.stop(ctx.currentTime + 0.75);
    const knockT = ctx.currentTime + 0.7;
    const knock = ctx.createGain();
    knock.gain.setValueAtTime(0, knockT);
    knock.gain.linearRampToValueAtTime(0.4, knockT + 0.005);
    knock.gain.exponentialRampToValueAtTime(0.0001, knockT + 0.2);
    knock.connect(bus);
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.value = 75;
    thud.connect(knock);
    thud.start(knockT);
    thud.stop(knockT + 0.22);
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

  huskGroan: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.12, 1.0, 0.22);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70 + Math.random() * 20, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(55, ctx.currentTime + 1.0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    osc.connect(lp).connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 1.15);
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

  gunshot: (ctx, bus) => {
    // Crack: sharp noise burst through a highpass, plus a low thump.
    const crack = envGain(ctx, bus, 0.001, 0.16, 0.7);
    const noise = noiseSource(ctx, 0.18);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    noise.connect(hp).connect(crack);
    noise.start();
    const thump = envGain(ctx, bus, 0.002, 0.22, 0.5);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.2);
    osc.connect(thump);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  },

  dryFire: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.001, 0.05, 0.3);
    const noise = noiseSource(ctx, 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 8;
    noise.connect(bp).connect(gain);
    noise.start();
  },

  casing: (ctx, bus) => {
    // Brass tick on stone.
    const gain = envGain(ctx, bus, 0.001, 0.07, 0.12);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 3400 + Math.random() * 600;
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  },

  weaponReady: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.002, 0.09, 0.2);
    const noise = noiseSource(ctx, 0.09);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 5;
    noise.connect(bp).connect(gain);
    noise.start();
  },

  macheteSwing: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.01, 0.14, 0.25);
    const noise = noiseSource(ctx, 0.16);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(500, ctx.currentTime);
    bp.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.12);
    bp.Q.value = 2;
    noise.connect(bp).connect(gain);
    noise.start();
  },

  macheteHit: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.002, 0.18, 0.45);
    const noise = noiseSource(ctx, 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    noise.connect(lp).connect(gain);
    noise.start();
  },

  enemyHit: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.004, 0.16, 0.35);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240 + Math.random() * 60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.15);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    osc.connect(lp).connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  },

  enemyDie: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.02, 1.1, 0.4);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 1.0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, ctx.currentTime);
    lp.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 1.0);
    osc.connect(lp).connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 1.15);
  },

  heal: (ctx, bus) => {
    for (const [delay, freq] of [
      [0, 330],
      [0.09, 440],
    ]) {
      const t = ctx.currentTime + delay;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      gain.connect(bus);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.45);
    }
  },

  pickup: (ctx, bus) => {
    const gain = envGain(ctx, bus, 0.003, 0.2, 0.2);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  },

  bellToll: (ctx, bus) => {
    // Inharmonic partials, long decay — a great bronze bell underground.
    for (const [freq, amp] of [
      [98, 0.35],
      [147.3, 0.22],
      [196.8, 0.14],
      [261.1, 0.1],
      [389.7, 0.06],
    ]) {
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(amp, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 6);
      gain.connect(bus);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 6.2);
    }
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
