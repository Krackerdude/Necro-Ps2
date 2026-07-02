/**
 * Husk pose clips. Joints per Husk.joints: torso (carries head + arms),
 * armL, armR, legL, legR. Base pose: torso pitched 0.35 forward, arms
 * hanging at -0.5 — clips return to that, not to zero.
 */
const BASE_TORSO = 0.35;
const BASE_ARM = -0.5;

export const HUSK_CLIPS = {
  /** Shot reaction: whipped back off balance, then slumps forward again. */
  stagger: {
    duration: 0.5,
    tracks: {
      torso: [
        { t: 0.0, rot: [BASE_TORSO, 0, 0] },
        { t: 0.08, rot: [-0.45, 0.25, 0.12] },   // snapped upright & back
        { t: 0.3, rot: [-0.15, 0.1, -0.06] },
        { t: 0.5, rot: [BASE_TORSO, 0, 0] },
      ],
      armL: [
        { t: 0.0, rot: [BASE_ARM, 0, 0] },
        { t: 0.08, rot: [-1.6, 0, 0.7] },        // arms thrown wide
        { t: 0.5, rot: [BASE_ARM, 0, 0] },
      ],
      armR: [
        { t: 0.0, rot: [BASE_ARM, 0, 0] },
        { t: 0.08, rot: [-1.4, 0, -0.8] },
        { t: 0.5, rot: [BASE_ARM, 0, 0] },
      ],
      legL: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.12, rot: [-0.5, 0, 0] },          // a step of lost balance
        { t: 0.5, rot: [0, 0, 0] },
      ],
    },
  },

  /** Heavy hit: arms pinwheel as it goes over backwards (root pitch is
   *  driven by the Husk's knockdown state, not this clip). */
  fall: {
    duration: 0.55,
    tracks: {
      torso: [
        { t: 0.0, rot: [BASE_TORSO, 0, 0] },
        { t: 0.15, rot: [-0.6, 0.3, 0] },
        { t: 0.55, rot: [-0.2, 0, 0] },
      ],
      armL: [
        { t: 0.0, rot: [BASE_ARM, 0, 0] },
        { t: 0.2, rot: [-2.6, 0, 0.9] },
        { t: 0.55, rot: [-2.2, 0, 0.6] },
      ],
      armR: [
        { t: 0.0, rot: [BASE_ARM, 0, 0] },
        { t: 0.25, rot: [-2.4, 0, -1.0] },
        { t: 0.55, rot: [-2.0, 0, -0.7] },
      ],
    },
  },

  /** The genre image: it gets back up. Slow, wrong, joint by joint. */
  rise: {
    duration: 1.1,
    tracks: {
      torso: [
        { t: 0.0, rot: [-0.2, 0, 0] },
        { t: 0.4, rot: [0.9, 0.2, 0.15] },       // folds forward over itself
        { t: 0.8, rot: [0.55, -0.1, -0.05] },
        { t: 1.1, rot: [BASE_TORSO, 0, 0] },
      ],
      armL: [
        { t: 0.0, rot: [-2.2, 0, 0.6] },
        { t: 0.4, rot: [-1.0, 0, 0.3] },         // pushes off the ground
        { t: 1.1, rot: [BASE_ARM, 0, 0] },
      ],
      armR: [
        { t: 0.0, rot: [-2.0, 0, -0.7] },
        { t: 0.5, rot: [-0.8, 0, -0.2] },
        { t: 1.1, rot: [BASE_ARM, 0, 0] },
      ],
      legL: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.5, rot: [-0.8, 0, 0] },           // one knee under itself
        { t: 1.1, rot: [0, 0, 0] },
      ],
      legR: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.7, rot: [-0.5, 0, 0] },
        { t: 1.1, rot: [0, 0, 0] },
      ],
    },
  },
};
