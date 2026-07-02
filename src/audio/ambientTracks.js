/**
 * ambientTracks — looping synthesized beds, one per mood.
 *
 * Each factory returns { stop() }. Tracks are built from detuned drones,
 * slow LFOs, and filtered noise — the goal is unease, not melody.
 */
export function createAmbientTrack(ctx, bus, id) {
  const factory = TRACKS[id];
  if (!factory) return { stop() {} };
  return factory(ctx, bus);
}

function drone(ctx, out, { freq, detune = 0, type = 'sine', gain = 0.05 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const g = ctx.createGain();
  g.gain.value = gain;
  osc.connect(g).connect(out);
  osc.start();
  return osc;
}

function breathNoise(ctx, out, { cutoff = 240, gain = 0.02, lfoRate = 0.07 }) {
  const seconds = 4;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = gain;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = lfoRate;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = gain * 0.7;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(filter).connect(g).connect(out);
  src.start();
  lfo.start();
  return [src, lfo];
}

const TRACKS = {
  /** Main menu: hollow two-note drone, distant and cold. */
  menu: (ctx, bus) => {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);
    out.connect(bus);
    const nodes = [
      drone(ctx, out, { freq: 55, type: 'sine', gain: 0.07 }),
      drone(ctx, out, { freq: 55, detune: 9, type: 'sine', gain: 0.06 }),
      drone(ctx, out, { freq: 82.4, type: 'triangle', gain: 0.02 }),
      ...breathNoise(ctx, out, { cutoff: 200, gain: 0.02 }),
    ];
    // A bell, far away, on no schedule you can trust.
    const bell = setInterval(() => {
      for (const [freq, amp] of [[98, 0.05], [147.3, 0.03]]) {
        const t = ctx.currentTime;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
        g.connect(out);
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 4.6);
      }
    }, 12000 + Math.random() * 6000);
    return {
      stop() {
        clearInterval(bell);
        out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
        setTimeout(() => nodes.forEach((n) => n.stop?.()), 1400);
      },
    };
  },

  /** Cloister: waterlogged — higher breath noise, hollow fourths. */
  cloister: (ctx, bus) => {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 4);
    out.connect(bus);
    const nodes = [
      drone(ctx, out, { freq: 49, type: 'sine', gain: 0.07 }),
      drone(ctx, out, { freq: 65.4, type: 'sine', gain: 0.045 }),
      drone(ctx, out, { freq: 49, detune: 11, type: 'triangle', gain: 0.02 }),
      ...breathNoise(ctx, out, { cutoff: 520, gain: 0.03, lfoRate: 0.11 }),
    ];
    return {
      stop() {
        out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
        setTimeout(() => nodes.forEach((n) => n.stop?.()), 1400);
      },
    };
  },

  /** Ossuary: deepest bed — sub drone, minor second grind, dry air. */
  ossuary: (ctx, bus) => {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 5);
    out.connect(bus);
    const nodes = [
      drone(ctx, out, { freq: 32.7, type: 'sine', gain: 0.09 }),
      drone(ctx, out, { freq: 34.6, type: 'sine', gain: 0.05 }),
      drone(ctx, out, { freq: 98, type: 'triangle', gain: 0.012 }),
      ...breathNoise(ctx, out, { cutoff: 180, gain: 0.02, lfoRate: 0.04 }),
    ];
    return {
      stop() {
        out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
        setTimeout(() => nodes.forEach((n) => n.stop?.()), 1400);
      },
    };
  },

  /** Chapel: lower, closer, with a slow dissonant beat between drones. */
  chapel: (ctx, bus) => {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 4);
    out.connect(bus);
    const nodes = [
      drone(ctx, out, { freq: 41.2, type: 'sine', gain: 0.08 }),
      drone(ctx, out, { freq: 41.2, detune: 14, type: 'sine', gain: 0.07 }),
      drone(ctx, out, { freq: 61.7, type: 'triangle', gain: 0.018 }),
      ...breathNoise(ctx, out, { cutoff: 300, gain: 0.025, lfoRate: 0.05 }),
    ];
    return {
      stop() {
        out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
        setTimeout(() => nodes.forEach((n) => n.stop?.()), 1400);
      },
    };
  },
};
