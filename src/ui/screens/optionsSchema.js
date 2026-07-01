import { LUT_DEFINITIONS } from '../../rendering/postfx/luts/lutLibrary.js';

/**
 * Options schema — declarative description of every row on the Options
 * screen, keyed by settings path. OptionsScreen renders this; it contains
 * no layout. Adding a setting = one entry here + a default in
 * config/defaultSettings.js.
 *
 * Control kinds: 'toggle' | 'choice' ({value,label}[]) | 'range' (min/max/step).
 */
export const OPTIONS_TABS = [
  {
    id: 'display',
    label: 'Display',
    rows: [
      {
        path: 'display.resolution',
        label: 'Internal Resolution',
        note: 'Vertical lines rendered before upscale. 448 ≈ PS2.',
        kind: 'choice',
        choices: [
          { value: 240, label: '240p' },
          { value: 336, label: '336p' },
          { value: 448, label: '448p' },
          { value: 720, label: '720p' },
        ],
      },
      {
        path: 'display.resolutionScale',
        label: 'Resolution Scale',
        note: 'Multiplier on internal resolution.',
        kind: 'range',
        min: 0.5,
        max: 2,
        step: 0.25,
        format: (v) => `${Math.round(v * 100)}%`,
      },
      {
        path: 'display.fov',
        label: 'Field of View',
        note: 'Fixed cameras may override per shot.',
        kind: 'range',
        min: 40,
        max: 90,
        step: 5,
        format: (v) => `${v}°`,
      },
      {
        path: 'display.pixelated',
        label: 'Raw Pixel Upscale',
        note: 'Nearest-neighbour stretch. Off = smoothing.',
        kind: 'toggle',
      },
    ],
  },
  {
    id: 'graphics',
    label: 'Graphics',
    rows: [
      { path: 'graphics.ps2Jitter', label: 'Vertex Snapping', note: 'The PS2 wobble itself.', kind: 'toggle' },
      { path: 'graphics.ps2AffineTextures', label: 'Affine Textures', note: 'Era-correct texture warp.', kind: 'toggle' },
      { path: 'graphics.shadows', label: 'Shadow Mapping', kind: 'toggle' },
      { path: 'graphics.dynamicLights', label: 'Dynamic Lights', note: 'Candles, braziers, flicker.', kind: 'toggle' },
      { path: 'graphics.fog', label: 'Fog', note: 'Distance fog and floor haze.', kind: 'toggle' },
      { path: 'graphics.effects.ssao', label: 'Ambient Occlusion (SSAO)', kind: 'toggle' },
      { path: 'graphics.effects.bloom', label: 'Bloom', kind: 'toggle' },
      { path: 'graphics.effects.filmGrain', label: 'Film Grain', kind: 'toggle' },
      { path: 'graphics.effects.vignette', label: 'Vignette', kind: 'toggle' },
      { path: 'graphics.effects.depthOfField', label: 'Depth of Field', kind: 'toggle' },
      { path: 'graphics.effects.chromaticAberration', label: 'Chromatic Aberration', kind: 'toggle' },
      { path: 'graphics.effects.lensDistortion', label: 'Lens Distortion', kind: 'toggle' },
      { path: 'graphics.effects.colorGrading', label: 'Color Grading', kind: 'toggle' },
      {
        path: 'graphics.colorGradingLut',
        label: 'Grading LUT',
        note: 'Applies when Color Grading is on.',
        kind: 'choice',
        choices: Object.entries(LUT_DEFINITIONS).map(([value, def]) => ({
          value,
          label: def.label,
        })),
      },
    ],
  },
  {
    id: 'audio',
    label: 'Audio',
    rows: [
      { path: 'audio.masterVolume', label: 'Master Volume', kind: 'range', min: 0, max: 1, step: 0.05, format: pct },
      { path: 'audio.musicVolume', label: 'Ambience Volume', kind: 'range', min: 0, max: 1, step: 0.05, format: pct },
      { path: 'audio.sfxVolume', label: 'Effects Volume', kind: 'range', min: 0, max: 1, step: 0.05, format: pct },
    ],
  },
  // The keybinds tab is generated from input/actions.js by OptionsScreen.
  { id: 'keybinds', label: 'Keybinds', rows: [] },
];

function pct(v) {
  return `${Math.round(v * 100)}%`;
}
