/**
 * Player pose clips. Angles in radians; joints per PlayerRig.joints:
 *   torso (carries head + arms), head, armL, armR, legL, legR.
 *
 * The melee swing is the reference for "weight": a slow coil you can see
 * coming, a violent strike over ~5 frames, and a long recovery you're
 * committed to. The hit lands ON the strike key via the 'hit' event, never
 * on button press.
 */
export const PLAYER_CLIPS = {
  macheteSwing: {
    duration: 0.78,
    tracks: {
      torso: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.26, rot: [-0.08, 0.55, 0.06] },   // coil: shoulders wind right
        { t: 0.38, rot: [0.18, -0.65, -0.08] },  // strike: whip through
        { t: 0.52, rot: [0.12, -0.5, -0.05] },   // follow-through hangs
        { t: 0.78, rot: [0, 0, 0] },
      ],
      armR: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.26, rot: [-2.5, 0, -0.5] },       // raised high behind the head
        { t: 0.38, rot: [-0.7, 0, 0.35] },       // slashed down and across
        { t: 0.52, rot: [-0.45, 0, 0.3] },
        { t: 0.78, rot: [0, 0, 0] },
      ],
      armL: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.26, rot: [0.5, 0, 0.25] },        // counterbalance
        { t: 0.38, rot: [-0.35, 0, -0.15] },
        { t: 0.78, rot: [0, 0, 0] },
      ],
      head: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.26, rot: [0, 0.35, 0] },          // eyes track the target
        { t: 0.38, rot: [0.1, -0.15, 0] },
        { t: 0.78, rot: [0, 0, 0] },
      ],
    },
    events: [
      { t: 0.02, id: 'windup' },
      { t: 0.3, id: 'lunge' },
      { t: 0.37, id: 'hit' },
    ],
  },

  revolverFire: {
    duration: 0.32,
    tracks: {
      armR: [
        { t: 0.0, rot: [-1.57, 0, 0] },          // level aim
        { t: 0.06, rot: [-1.95, 0, 0.12] },      // muzzle kicks up
        { t: 0.32, rot: [-1.57, 0, 0] },         // settles back on target
      ],
      torso: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.06, rot: [-0.07, 0.08, 0] },      // recoil rocks the shoulders
        { t: 0.32, rot: [0, 0, 0] },
      ],
      head: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.06, rot: [-0.08, 0, 0] },
        { t: 0.32, rot: [0, 0, 0] },
      ],
    },
    events: [{ t: 0.02, id: 'fire' }],
  },

  hurtFlinch: {
    duration: 0.34,
    tracks: {
      torso: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.07, rot: [-0.4, 0.12, 0.1] },     // doubled over, twisted
        { t: 0.34, rot: [0, 0, 0] },
      ],
      armL: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.07, rot: [-0.9, 0, 0.5] },        // arms come up reflexively
        { t: 0.34, rot: [0, 0, 0] },
      ],
      armR: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.07, rot: [-0.9, 0, -0.5] },
        { t: 0.34, rot: [0, 0, 0] },
      ],
      head: [
        { t: 0.0, rot: [0, 0, 0] },
        { t: 0.07, rot: [0.3, 0, 0] },
        { t: 0.34, rot: [0, 0, 0] },
      ],
    },
  },
};
