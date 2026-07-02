import * as THREE from 'three';

/**
 * BloodFx — floor splatter decals, era-style (flat quads, not projected
 * geometry — this is how the classics did it and it reads perfectly through
 * the low-res pipeline).
 *
 * Listens:
 *   'enemy/damaged' { position } — small splatter under the hit
 *   'enemy/died'    { position } — large pool where it fell
 *   'player/damaged'{ from }     — small splatter at the player's feet is
 *                                  handled by GameplayState passing player
 *                                  position via 'blood/splat'
 *   'blood/splat'   { position, size? }
 *
 * Splats persist for the room visit, capped FIFO so a long fight can't
 * accumulate unbounded draw calls. reset() on level transitions.
 *
 * TODO(decals): wall sprays via DecalFactory (projected onto wall meshes)
 * when a hit's shot direction is known — the floor tier stays regardless.
 */
const MAX_SPLATS = 48;

export class BloodFx {
  /** @type {THREE.Group} */
  object = new THREE.Group();

  #splats = [];
  #materialSmall;
  #materialPool;

  constructor(events) {
    this.#materialSmall = new THREE.MeshBasicMaterial({
      map: splatTexture(0),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      color: 0x7e1616,
    });
    this.#materialPool = new THREE.MeshBasicMaterial({
      map: splatTexture(1),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      color: 0x5e1010,
    });

    events.on('enemy/damaged', ({ position }) => {
      if (position) this.splat(position, 0.3 + Math.random() * 0.25, this.#materialSmall);
    });
    events.on('enemy/died', ({ position }) => {
      if (position) this.splat(position, 0.9 + Math.random() * 0.4, this.#materialPool);
    });
    events.on('blood/splat', ({ position, size = 0.35 }) => {
      if (position) this.splat(position, size, this.#materialSmall);
    });
  }

  splat(position, size, material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    // Slight per-splat lift avoids z-fighting between overlapping stains.
    mesh.position.set(position.x, 0.012 + this.#splats.length * 0.0004, position.z);
    mesh.renderOrder = 2;
    this.object.add(mesh);
    this.#splats.push(mesh);
    if (this.#splats.length > MAX_SPLATS) {
      const oldest = this.#splats.shift();
      oldest.geometry.dispose();
      oldest.removeFromParent();
    }
  }

  /** Clear all splats (level transition). */
  reset() {
    for (const splat of this.#splats) {
      splat.geometry.dispose();
      splat.removeFromParent();
    }
    this.#splats = [];
  }
}

/* Two variants: 0 = spray (blob + satellite droplets), 1 = pool (heavy
 * irregular blob). Nearest-filtered so it crunches like everything else. */
const textures = {};
function splatTexture(variant) {
  if (textures[variant]) return textures[variant];
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const blob = (x, y, r) => {
    ctx.beginPath();
    // Lumpy circle: radius jitters around the ring.
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += Math.PI / 8) {
      const rr = r * (0.7 + Math.random() * 0.5);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  if (variant === 0) {
    blob(32, 32, 12);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 14;
      blob(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 1.5 + Math.random() * 3);
    }
  } else {
    blob(32, 32, 22);
    blob(24, 40, 10);
    blob(42, 26, 8);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  textures[variant] = texture;
  return texture;
}
