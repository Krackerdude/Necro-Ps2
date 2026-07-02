/**
 * Cinematic scripts — pure data for CinematicState.
 *
 * Coordinates are in the scene the script plays over: the opening runs on
 * the menu vista (graveyard), the bell toll runs inside the ossuary.
 */

/** New Game: a slow pass over the graveyard toward the sealed doors. */
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
    '— END OF THIS BUILD OF NECRO. Your saves will carry forward. —',
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
