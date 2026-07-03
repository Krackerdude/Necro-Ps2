/**
 * Cinematic scripts — pure data for CinematicState.
 *
 * Coordinates are in the scene the script plays over: the opening runs on
 * the menu vista (graveyard), the bell toll runs inside the ossuary.
 */

/**
 * New Game: the drive. Plays over the COAST_ROAD treadmill set — the car
 * sits at the origin facing +x, so every shot here is authored around it.
 * Roughly two minutes; E/Esc skips, and the town is waiting either way.
 */
export const DRIVE_SCRIPT = [
  { fade: { opacity: 0, duration: 1.6 } },
  // High and wide: one car, one road, one very patient sea.
  { camera: { from: [-8, 7, 14], to: [-2, 5.5, 12], lookAt: [2, 0.5, 0], duration: 7 } },
  { caption: { text: 'Mike’s handwriting hasn’t changed since we were twelve. Big, hopeful, no margins.', duration: 4.4 } },
  // Side profile, guardrail posts strobing past.
  { camera: { from: [1, 1.15, 5.5], to: [-2, 1.1, 5.4], lookAt: [0, 1, 0], duration: 7 } },
  { caption: { text: '“You’ll think I’ve lost it,” he wrote. “Maybe. But I found the place from grandad’s stories.”', duration: 4.8 } },
  // Front quarter, low — headlights on before dark, like a careful person.
  { camera: { from: [5, 0.8, 3.4], to: [4.2, 0.9, 2.2], lookAt: [0.4, 0.9, 0], duration: 7 } },
  { caption: { text: '“GRAVEN. It’s real. And it’s on no map printed after ’51.”', duration: 4.2 } },
  // Behind the car: the road pours out ahead.
  { camera: { from: [-5.5, 1.5, -0.5], to: [-4.8, 1.4, 0], lookAt: [10, 1, 0.5], duration: 7.5 } },
  { caption: { text: 'A year of letters after that. Bread, weather, kindness. A town that sounds the way a warm bath feels.', duration: 4.8 } },
  // Close on the window; your silhouette, his letter on the dash.
  { camera: { from: [1.4, 1.25, 2.4], to: [0.9, 1.2, 1.7], lookAt: [-0.2, 1.1, 0], duration: 6.5 } },
  { caption: { text: 'Then the letters changed.', duration: 3.2 } },
  { caption: { text: 'Then the letters stopped.', duration: 3.4 } },
  // Low by the wheel, gravel hissing.
  { camera: { from: [2.2, 0.5, 2.6], to: [1.4, 0.45, 2.2], lookAt: [0.6, 0.5, -0.4], duration: 6 } },
  { caption: { text: '“They ring the bell at dusk and everyone goes inside,”', duration: 3.8 } },
  { caption: { text: '“and I have started to want to go with them.”', duration: 4.0 } },
  // Sweep out over the sea and back.
  { camera: { from: [3, 4.5, 13], to: [-3, 6, 14.5], lookAt: [0, 0.6, -2], duration: 8 } },
  { caption: { text: '“Come before I stop writing letters.” Signed M. Eleven months ago.', duration: 4.6 } },
  // Head-on, the road swallowing itself under the bumper.
  { camera: { from: [7, 1.0, 0], to: [4.6, 0.95, 0], lookAt: [-2, 1, 0], duration: 7 } },
  { caption: { text: 'Nobody at work knows where I am. Nobody anywhere knows where I am.', duration: 4.2 } },
  { caption: { text: 'That’s the kind of thing you only notice once it’s already true.', duration: 4.0 } },
  // Into the sun, lens full of gold.
  { camera: { from: [0, 0.8, 4.8], to: [-1.6, 0.9, 4.4], lookAt: [0.4, 1.1, -0.6], duration: 7 } },
  { caption: { text: 'The road turned to gravel an hour ago. The sea keeps pace like an escort.', duration: 4.4 } },
  { impulse: { strength: 0.15 } },
  // Last: high behind, the implied town somewhere in the haze ahead.
  { camera: { from: [-7, 3.2, 2], to: [-6, 2.6, 1], lookAt: [12, 0.8, 0], duration: 7 } },
  { caption: { text: 'And there — past the headland. Chimney smoke. Lit windows. A lighthouse clearing its throat.', duration: 4.8 } },
  { caption: { text: 'Graven. Exactly where no map says it is.', duration: 3.8 } },
  { fade: { opacity: 1, duration: 1.4 } },
  { wait: { duration: 1.6 } },
];

/** Retired opening (pre-town builds); kept for the Phase D/E night stitch. */
export const OPENING_SCRIPT = [
  { fade: { opacity: 0, duration: 1.2 } },
  {
    camera: { from: [14, 2.2, 16], to: [7, 1.7, 9], lookAt: [0, 2.4, -14], duration: 6 },
  },
  { caption: { text: 'The chapel sealed itself in the year of the wet winter.', duration: 3.6 } },
  {
    camera: { from: [7, 1.7, 9], to: [2.2, 1.3, 2.5], lookAt: [0, 2.8, -14], duration: 5.5 },
  },
  { caption: { text: 'The congregation stayed. The singing, eventually, stopped.', duration: 3.6 } },
  {
    camera: { from: [2.2, 1.3, 2.5], to: [0.4, 1.5, -8.5], lookAt: [0, 2.6, -14], duration: 5 },
  },
  { caption: { text: 'Someone has to tell the ground the hour.', duration: 3.2 } },
  { fade: { opacity: 1, duration: 0.8 } },
  { wait: { duration: 1.0 } },
];

/** Shown after the bell cinematic — the build's closing note. */
export const END_NOTE = {
  title: 'THE HOUR IS TOLD',
  body:
    'The toll moves through the floor, up the bone walls, out into the ' +
    'drowned garth and the nave above.\n\n' +
    'Everything that was standing lies down.\n\n' +
    'The ground, satisfied, remembers it is only ground.\n\n' +
    '— END OF THIS BUILD OF GRAVEN. Your saves will carry forward. —',
};

/** The bell toll: played in the ossuary the moment the hour is rung. */
export const BELL_SCRIPT = [
  { sfx: { id: 'bellToll' } },
  { impulse: { strength: 1.0 } },
  {
    camera: { from: [-5.5, 1.2, 12.8], to: [-2.6, 2.2, 12.2], lookAt: [0, 2.2, 10.5], duration: 3.4 },
  },
  { caption: { text: 'The toll moves through the floor, up the bone walls,', duration: 3.0 } },
  {
    camera: { from: [-2.6, 2.2, 12.2], to: [2.8, 1.0, 11.6], lookAt: [0, 2.4, 10.5], duration: 3.4 },
  },
  { caption: { text: 'out into the drowned garth, and the nave above.', duration: 3.0 } },
  { impulse: { strength: 0.4 } },
  {
    camera: { from: [2.8, 1.0, 11.6], to: [0, 1.6, 13.4], lookAt: [0, 2.0, 10.5], duration: 3.0 },
  },
  { caption: { text: 'Everything that was standing lies down.', duration: 3.0 } },
];
