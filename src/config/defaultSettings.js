/**
 * Default settings — the single source of truth for every user-configurable
 * value. The Options UI is generated FROM this shape; adding a setting here
 * (plus a descriptor in OptionsScreen's section tables) is all that's needed
 * to surface it.
 *
 * Notes:
 * - `display.resolution` picks the internal render height (PS2-style, 4:3-ish
 *   feel at low res); the canvas is always stretched to the window.
 * - `display.fov` drives the gameplay cameras. The game is fixed-camera
 *   third person, so there is no viewmodel FOV; if a first-person mode is
 *   ever added, add `display.viewmodelFov` alongside it.
 * - Everything under `graphics.effects` maps 1:1 to a post-processing effect
 *   id in PostFxPipeline.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  display: {
    /** Internal vertical resolution. 448 ≈ PS2 (512x448). */
    resolution: 448,
    /** Extra multiplier on top of `resolution` (0.5–2.0). */
    resolutionScale: 1.0,
    /** Camera field of view in degrees. */
    fov: 55,
    /** Nearest-neighbour upscale for the authentic chunky look. */
    pixelated: true,
  },
  graphics: {
    /** Vertex snapping + affine texture warp (the PS2 look itself). */
    ps2Jitter: true,
    ps2AffineTextures: true,
    shadows: true,
    shadowMapSize: 1024,
    dynamicLights: true,
    fog: true,
    effects: {
      ssao: true,
      bloom: true,
      filmGrain: true,
      vignette: true,
      depthOfField: false,
      chromaticAberration: false,
      lensDistortion: false,
      colorGrading: false,
      // TODO(SSR): screen-space reflections are stubbed in PostFxPipeline and
      // intentionally not exposed until implemented.
    },
    /** Active LUT when colorGrading is enabled. See rendering/postfx/luts. */
    colorGradingLut: 'neutral',
  },
  audio: {
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.9,
  },
  /**
   * Keybinds: action id -> array of KeyboardEvent.code values.
   * Actions, not keys, are what gameplay code reads (see input/actions.js).
   */
  keybinds: {
    moveForward: ['KeyW', 'ArrowUp'],
    moveBackward: ['KeyS', 'ArrowDown'],
    turnLeft: ['KeyA', 'ArrowLeft'],
    turnRight: ['KeyD', 'ArrowRight'],
    run: ['ShiftLeft', 'ShiftRight'],
    interact: ['KeyE', 'Enter'],
    aim: ['KeyQ'],
    pause: ['Escape'],
    quickTurn: ['KeyC'],
    debugOverlay: ['F3'],
  },
});

/** Deep-clone helper so callers never mutate the frozen defaults. */
export function cloneDefaultSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}
