import { Vector2 } from 'three';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  LensDistortionEffect,
  LUT3DEffect,
  NoiseEffect,
  SSAOEffect,
  VignetteEffect,
} from 'postprocessing';
import { getLut } from './luts/lutLibrary.js';

/**
 * Effect registry — the extension point of the render pipeline.
 *
 * Each entry declares:
 *   id          — matches the toggle key under settings 'graphics.effects'.
 *   group       — which EffectPass it joins. Convolution effects (bloom, DoF)
 *                 must live in their own pass; 'composite' effects share one.
 *                 Groups render in GROUP_ORDER.
 *   needsNormals— pipeline will provide a NormalPass texture in ctx.
 *   build(ctx)  — returns a postprocessing Effect. ctx: { camera, scene,
 *                 normalTexture, settings }.
 *
 * Adding a new screen effect = adding one entry here + one settings default.
 * The pipeline, options menu, and save system pick it up automatically.
 *
 * TODO(SSR): Screen-space reflections. postprocessing has no built-in SSR;
 * the plan is a custom Effect (depth + normal march in view space) inserted
 * as its own group between 'ssao' and 'dof'. Not stubbed with fake output —
 * it simply doesn't exist yet and is not listed in settings.
 */
export const GROUP_ORDER = Object.freeze(['ssao', 'dof', 'bloom', 'composite']);

export const EFFECT_REGISTRY = Object.freeze([
  {
    id: 'ssao',
    group: 'ssao',
    needsNormals: true,
    build: ({ camera, normalTexture }) =>
      new SSAOEffect(camera, normalTexture, {
        blendFunction: BlendFunction.MULTIPLY,
        samples: 16,
        rings: 4,
        luminanceInfluence: 0.6,
        radius: 0.1,
        intensity: 2.0,
        bias: 0.02,
        fade: 0.01,
        resolutionScale: 0.5,
      }),
  },
  {
    id: 'depthOfField',
    group: 'dof',
    build: ({ camera }) =>
      new DepthOfFieldEffect(camera, {
        focusDistance: 0.01,
        focalLength: 0.05,
        bokehScale: 2.0,
      }),
  },
  {
    id: 'bloom',
    group: 'bloom',
    build: () =>
      new BloomEffect({
        intensity: 0.55,
        luminanceThreshold: 0.72,
        luminanceSmoothing: 0.2,
        mipmapBlur: true,
      }),
  },
  {
    id: 'chromaticAberration',
    group: 'composite',
    build: () =>
      new ChromaticAberrationEffect({
        offset: new Vector2(0.0012, 0.0008),
        radialModulation: true,
        modulationOffset: 0.4,
      }),
  },
  {
    id: 'lensDistortion',
    group: 'composite',
    build: () =>
      new LensDistortionEffect({
        distortion: new Vector2(-0.08, -0.08),
        focalLength: new Vector2(0.96, 0.96),
      }),
  },
  {
    id: 'colorGrading',
    group: 'composite',
    build: ({ settings }) => new LUT3DEffect(getLut(settings.get('graphics.colorGradingLut'))),
  },
  {
    id: 'filmGrain',
    group: 'composite',
    build: () => {
      const noise = new NoiseEffect({ blendFunction: BlendFunction.COLOR_DODGE, premultiply: true });
      noise.blendMode.opacity.value = 0.35;
      return noise;
    },
  },
  {
    id: 'vignette',
    group: 'composite',
    build: () => new VignetteEffect({ offset: 0.32, darkness: 0.68 }),
  },
]);
