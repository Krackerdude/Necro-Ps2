import * as THREE from 'three';

/**
 * FogCards — era-authentic "volumetric" fog: layered, slowly drifting
 * translucent planes hugging the floor. PS2 horror did exactly this, and it
 * reads better through the low-res pipeline than a modern raymarch would.
 *
 * TODO(volumetrics): if a true raymarched volumetric pass is ever wanted, it
 * belongs in rendering/postfx as its own effect group; this module stays as
 * the cheap tier.
 */
export class FogCards {
  /** @type {THREE.Group} */
  object = new THREE.Group();

  #cards = [];

  /**
   * @param {{ center: [number, number], size: [number, number], count?: number,
   *           color?: number, opacity?: number, height?: number }} opts
   */
  constructor({ center, size, count = 3, color = 0x9aa4b0, opacity = 0.06, height = 0.5 }) {
    const texture = makeFogTexture();
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: opacity * (1 - i * 0.2),
        color,
        depthWrite: false,
        fog: false,
      });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
      card.rotation.x = -Math.PI / 2;
      card.position.set(center[0], height * (0.4 + i * 0.5), center[1]);
      card.renderOrder = 10;
      this.#cards.push({ mesh: card, speed: 0.008 + i * 0.005, phase: i * 2.1 });
      this.object.add(card);
    }
  }

  update(dt) {
    for (const card of this.#cards) {
      card.phase += dt * 0.1;
      const map = card.mesh.material.map;
      map.offset.x += card.speed * dt;
      map.offset.y += card.speed * 0.6 * dt;
      card.mesh.material.opacity += Math.sin(card.phase) * 0.0004;
    }
  }
}

let fogTexture = null;
function makeFogTexture() {
  if (fogTexture) return fogTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 12 + Math.random() * 30;
    const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.20)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  fogTexture = new THREE.CanvasTexture(canvas);
  fogTexture.wrapS = THREE.RepeatWrapping;
  fogTexture.wrapT = THREE.RepeatWrapping;
  return fogTexture;
}
