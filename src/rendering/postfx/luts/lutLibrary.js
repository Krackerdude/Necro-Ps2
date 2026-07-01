import { LookupTexture } from 'postprocessing';

/**
 * Procedural color-grading LUTs.
 *
 * Each entry maps an id (referenced by settings 'graphics.colorGradingLut')
 * to a display label and a per-pixel transform applied to a neutral 3D LUT.
 * LUTs are generated once on demand and cached.
 *
 * To add a LUT: add an entry here. Nothing else changes — the Options screen
 * and the pipeline both enumerate this table.
 */
const LUT_SIZE = 32;

export const LUT_DEFINITIONS = Object.freeze({
  neutral: { label: 'Neutral', transform: null },
  crimsonRot: {
    label: 'Crimson Rot',
    // Blood-warm mids, crushed green, lifted blacks — classic survival horror.
    transform: ([r, g, b]) => [
      clamp01(r * 1.12 + 0.02),
      clamp01(g * 0.92),
      clamp01(b * 0.9 + 0.015),
    ],
  },
  coldMorgue: {
    label: 'Cold Morgue',
    // Desaturated, blue-shifted shadows.
    transform: ([r, g, b]) => {
      const l = r * 0.299 + g * 0.587 + b * 0.114;
      const mix = 0.45;
      return [
        clamp01(lerp(r, l, mix) * 0.92),
        clamp01(lerp(g, l, mix) * 0.98),
        clamp01(lerp(b, l, mix) * 1.1 + 0.02),
      ];
    },
  },
  bleachedBone: {
    label: 'Bleached Bone',
    // High-contrast, sun-rotted sepia.
    transform: ([r, g, b]) => {
      const l = r * 0.299 + g * 0.587 + b * 0.114;
      const c = clamp01((l - 0.5) * 1.25 + 0.5);
      return [clamp01(c * 1.05 + 0.03), clamp01(c * 0.97), clamp01(c * 0.82)];
    },
  },
});

/**
 * Generates a fresh LUT per call (LUT3DEffect takes ownership and may
 * dispose it on pipeline rebuild, so caching would hand out dead textures).
 * Generation is a 32³ fill — negligible against a pass rebuild.
 * @returns {import('postprocessing').LookupTexture}
 */
export function getLut(id) {
  const def = LUT_DEFINITIONS[id] ?? LUT_DEFINITIONS.neutral;
  const lut = LookupTexture.createNeutral(LUT_SIZE);
  if (def.transform) {
    const { data } = lut.image;
    const stride = data.length / (LUT_SIZE * LUT_SIZE * LUT_SIZE);
    for (let i = 0; i < data.length; i += stride) {
      const [r, g, b] = def.transform([data[i], data[i + 1], data[i + 2]]);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
    lut.needsUpdate = true;
  }
  return lut;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
