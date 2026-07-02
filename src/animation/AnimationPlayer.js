/**
 * AnimationPlayer — the engine's pose-clip system.
 *
 * A clip is plain data (see gameplay/animation/ for authored clips):
 *   {
 *     duration: seconds,
 *     loop?: boolean,
 *     tracks: { jointName: [{ t, rot: [x, y, z] }, ...] },  // t in seconds,
 *                                                            // keys sorted
 *     events?: [{ t, id }],
 *   }
 *
 * The player owns a joints map (name -> Object3D pivot) supplied by a rig.
 * While a clip plays it drives joint local rotations (lerped between keys,
 * with a short fade-in blend from whatever pose the rig was in); when it
 * ends, the rig's procedural layer simply overwrites again next frame.
 *
 * Frame events fire through the onEvent callback exactly once as playback
 * crosses their time — this is how "the hit connects on the strike frame"
 * works everywhere.
 *
 * Deliberately NOT three.js AnimationMixer: our rigs are pivot groups, our
 * clips are ~6 tracks of Euler keys, and gameplay needs frame events and
 * "am I acting" as first-class. 150 lines beats an adapter layer.
 */
export class AnimationPlayer {
  #joints;
  #clip = null;
  #time = 0;
  #onEvent = null;
  #onComplete = null;
  #firedEvents = new Set();
  #fadeDuration = 0;
  #startPose = new Map();

  /** @param {Record<string, import('three').Object3D>} joints */
  constructor(joints) {
    this.#joints = joints;
  }

  /** True while a non-looping clip is in flight (gameplay "acting" lock). */
  get isActing() {
    return this.#clip !== null && !this.#clip.loop;
  }

  get currentClip() {
    return this.#clip;
  }

  /**
   * @param {object} clip
   * @param {{ onEvent?: (id: string) => void, onComplete?: () => void,
   *           fade?: number }} [opts]
   */
  play(clip, { onEvent = null, onComplete = null, fade = 0.07 } = {}) {
    this.#clip = clip;
    this.#time = 0;
    this.#onEvent = onEvent;
    this.#onComplete = onComplete;
    this.#firedEvents.clear();
    this.#fadeDuration = fade;
    this.#startPose.clear();
    for (const name of Object.keys(clip.tracks)) {
      const joint = this.#joints[name];
      if (joint) this.#startPose.set(name, joint.rotation.clone());
    }
  }

  stop() {
    this.#clip = null;
    this.#onEvent = null;
    this.#onComplete = null;
  }

  update(dt) {
    if (!this.#clip) return;
    this.#time += dt;

    // Fire events whose time we've crossed.
    for (const event of this.#clip.events ?? []) {
      if (this.#time >= event.t && !this.#firedEvents.has(event)) {
        this.#firedEvents.add(event);
        this.#onEvent?.(event.id);
      }
    }

    const clipTime = Math.min(this.#time, this.#clip.duration);
    const blend =
      this.#fadeDuration > 0 ? Math.min(1, this.#time / this.#fadeDuration) : 1;

    for (const [name, keys] of Object.entries(this.#clip.tracks)) {
      const joint = this.#joints[name];
      if (!joint) continue;
      const [x, y, z] = sampleTrack(keys, clipTime);
      if (blend >= 1) {
        joint.rotation.set(x, y, z);
      } else {
        const start = this.#startPose.get(name);
        joint.rotation.set(
          lerp(start.x, x, blend),
          lerp(start.y, y, blend),
          lerp(start.z, z, blend)
        );
      }
    }

    if (this.#time >= this.#clip.duration) {
      if (this.#clip.loop) {
        this.#time -= this.#clip.duration;
        this.#firedEvents.clear();
      } else {
        const done = this.#onComplete;
        this.stop();
        done?.();
      }
    }
  }
}

function sampleTrack(keys, t) {
  if (t <= keys[0].t) return keys[0].rot;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.rot;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      const f = (t - a.t) / (b.t - a.t);
      // Smoothstep between keys: authored poses read as accelerating into
      // and easing out of each key — free "weight" on every clip.
      const s = f * f * (3 - 2 * f);
      return [
        lerp(a.rot[0], b.rot[0], s),
        lerp(a.rot[1], b.rot[1], s),
        lerp(a.rot[2], b.rot[2], s),
      ];
    }
  }
  return last.rot;
}

const lerp = (a, b, t) => a + (b - a) * t;
