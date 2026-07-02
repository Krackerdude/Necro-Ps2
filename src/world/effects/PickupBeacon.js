import * as THREE from 'three';

/**
 * PickupBeacon — the RPG "there's loot here" language: the item mesh slowly
 * spins and bobs, a soft glow sprite breathes behind it, and every couple of
 * seconds a star-shaped glint flashes. Additive sprites read through fog and
 * low light, which is exactly the point.
 *
 * Owns: { object } to add to the level and { update(dt) } for updatables.
 * Call vanish() when the item is taken.
 */
export class PickupBeacon {
  /** @type {THREE.Group} */
  object = new THREE.Group();

  #item;
  #glow;
  #glint;
  #time = Math.random() * 10;
  #baseY;
  #gone = false;

  /**
   * @param {THREE.Object3D} itemMesh positioned in world space
   * @param {{ color?: number }} [opts] glow tint
   */
  constructor(itemMesh, { color = 0xfff2c8 } = {}) {
    this.#item = itemMesh;
    this.#baseY = itemMesh.position.y;
    this.object.position.copy(itemMesh.position);
    itemMesh.position.set(0, 0, 0);
    this.object.add(itemMesh);

    this.#glow = makeSprite(glowTexture(), color, 0.55);
    this.#glow.scale.setScalar(0.65);
    this.#glint = makeSprite(glintTexture(), 0xffffff, 0);
    this.#glint.scale.setScalar(0.5);
    this.object.add(this.#glow, this.#glint);

    this.object.position.y = 0;
    this.#item.position.y = this.#baseY;
    this.#glow.position.y = this.#baseY;
    this.#glint.position.y = this.#baseY + 0.08;
  }

  update(dt) {
    if (this.#gone) return;
    this.#time += dt;

    this.#item.rotation.y += dt * 1.6;
    this.#item.position.y = this.#baseY + Math.sin(this.#time * 2.2) * 0.05;
    this.#glow.position.y = this.#item.position.y;

    // Breathing glow.
    this.#glow.material.opacity = 0.4 + Math.sin(this.#time * 2.8) * 0.18;

    // Periodic star glint: sharp attack, quick decay, slight rotation.
    const cycle = this.#time % 2.4;
    if (cycle < 0.5) {
      const p = cycle / 0.5;
      this.#glint.material.opacity = Math.sin(p * Math.PI) * 0.95;
      this.#glint.material.rotation = p * 0.8;
      const s = 0.35 + Math.sin(p * Math.PI) * 0.3;
      this.#glint.scale.setScalar(s);
    } else {
      this.#glint.material.opacity = 0;
    }
  }

  vanish() {
    this.#gone = true;
    this.object.removeFromParent();
  }
}

function makeSprite(texture, color, opacity) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Sprite(material);
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(canvas);
  return glowTex;
}

let glintTex = null;
function glintTexture() {
  if (glintTex) return glintTex;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // Four-point star: two crossed tapered lines + hot core.
  ctx.translate(32, 32);
  for (const [w, l] of [
    [2.2, 30],
    [1.4, 18],
  ]) {
    for (const rot of [0, Math.PI / 2]) {
      ctx.save();
      ctx.rotate(rot + (l === 18 ? Math.PI / 4 : 0));
      const grad = ctx.createLinearGradient(-l, 0, l, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-l, -w / 2, l * 2, w);
      ctx.restore();
    }
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(-8, -8, 16, 16);
  glintTex = new THREE.CanvasTexture(canvas);
  return glintTex;
}
