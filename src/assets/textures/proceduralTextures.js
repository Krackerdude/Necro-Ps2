import * as THREE from 'three';

/**
 * Procedural PS2-era textures — tiny (64px), noisy, nearest-filtered.
 *
 * Real texture assets can replace these later through the same accessors;
 * callers only ever see THREE.Texture. Generation is canvas-based and cached.
 *
 * All textures use NearestFilter + no mipmap trilinear softness: texel
 * crunch is part of the look.
 */
const SIZE = 64;
const cache = new Map();

export function getTexture(name) {
  if (cache.has(name)) return cache.get(name);
  const generator = GENERATORS[name];
  if (!generator) throw new Error(`Unknown procedural texture '${name}'`);
  const texture = canvasTexture(generator);
  cache.set(name, texture);
  return texture;
}

function canvasTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Deterministic PRNG so textures are identical across sessions. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillNoise(ctx, base, variance, seed) {
  const rand = mulberry32(seed);
  const img = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 2 * variance;
    img.data[i] = clamp255(base[0] + n);
    img.data[i + 1] = clamp255(base[1] + n);
    img.data[i + 2] = clamp255(base[2] + n);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

const clamp255 = (v) => Math.min(255, Math.max(0, Math.round(v)));

const GENERATORS = {
  stoneFloor: (ctx) => {
    fillNoise(ctx, [72, 70, 68], 14, 101);
    ctx.strokeStyle = 'rgba(20, 18, 16, 0.85)';
    ctx.lineWidth = 1;
    // Large flagstone grid with slight per-line offsets.
    const rand = mulberry32(7);
    for (let i = 0; i <= 2; i++) {
      const y = i * 32 + Math.floor(rand() * 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 2; i++) {
      const x = i * 32 + Math.floor(rand() * 3);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SIZE);
      ctx.stroke();
    }
  },

  stoneWall: (ctx) => {
    fillNoise(ctx, [88, 82, 74], 16, 202);
    ctx.strokeStyle = 'rgba(30, 26, 22, 0.8)';
    const rand = mulberry32(11);
    for (let row = 0; row < 4; row++) {
      const y = row * 16;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y);
      ctx.stroke();
      const offset = row % 2 === 0 ? 0 : 16;
      for (let col = 0; col < 2; col++) {
        const x = (offset + col * 32 + Math.floor(rand() * 4)) % SIZE;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 16);
        ctx.stroke();
      }
    }
  },

  woodPlanks: (ctx) => {
    fillNoise(ctx, [74, 52, 36], 10, 303);
    const rand = mulberry32(13);
    ctx.strokeStyle = 'rgba(28, 18, 10, 0.9)';
    for (let i = 0; i <= 4; i++) {
      const x = i * 16;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SIZE);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(40, 26, 14, 0.5)';
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(rand() * SIZE);
      const y = Math.floor(rand() * SIZE);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 4 + rand() * 10);
      ctx.stroke();
    }
  },

  plasterRot: (ctx) => {
    fillNoise(ctx, [96, 92, 80], 12, 404);
    const rand = mulberry32(17);
    // Damp stains.
    for (let i = 0; i < 5; i++) {
      const x = rand() * SIZE;
      const y = rand() * SIZE;
      const r = 6 + rand() * 14;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(44, 46, 32, 0.5)');
      grad.addColorStop(1, 'rgba(44, 46, 32, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  },

  carpetRed: (ctx) => {
    fillNoise(ctx, [92, 22, 24], 12, 505);
    ctx.strokeStyle = 'rgba(140, 108, 40, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, SIZE - 8, SIZE - 8);
  },

  boneDust: (ctx) => {
    fillNoise(ctx, [140, 130, 112], 18, 606);
  },

  ironDark: (ctx) => {
    fillNoise(ctx, [46, 46, 52], 8, 707);
  },

  rustBlade: (ctx) => {
    // Weathered blade steel: grey base, orange rot blooming from the spine,
    // one bright honed line along the edge (x=0 column).
    fillNoise(ctx, [116, 118, 122], 12, 808);
    const rand = mulberry32(23);
    for (let i = 0; i < 9; i++) {
      const x = 20 + rand() * 44;
      const y = rand() * SIZE;
      const r = 4 + rand() * 11;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(122, 62, 24, 0.75)');
      grad.addColorStop(0.6, 'rgba(96, 48, 20, 0.4)');
      grad.addColorStop(1, 'rgba(96, 48, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.fillStyle = 'rgba(215, 218, 222, 0.9)';
    ctx.fillRect(0, 0, 3, SIZE);
    // Nicks in the edge.
    ctx.fillStyle = 'rgba(60, 40, 24, 0.9)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(0, Math.floor(rand() * SIZE), 3, 2 + Math.floor(rand() * 2));
    }
  },

  gunMetal: (ctx) => {
    // Blued steel with holster wear: dark base, lengthwise streaks, bright
    // rubbed patches on the high lines.
    fillNoise(ctx, [52, 55, 62], 7, 909);
    const rand = mulberry32(31);
    ctx.strokeStyle = 'rgba(30, 32, 38, 0.5)';
    for (let i = 0; i < 14; i++) {
      const y = Math.floor(rand() * SIZE);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y + (rand() - 0.5) * 4);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(140, 144, 152, 0.35)';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(Math.floor(rand() * SIZE), Math.floor(rand() * SIZE), 6 + rand() * 14, 2);
    }
  },

  /* --- alpha stains (transparent canvas; used by kit.wallStain) --- */

  stainDamp: (ctx) => {
    // Water damage: dark streaks bleeding downward from a soaked band.
    const rand = mulberry32(41);
    for (let i = 0; i < 7; i++) {
      const x = 6 + rand() * 52;
      const w = 3 + rand() * 7;
      const len = 24 + rand() * 36;
      const grad = ctx.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, 'rgba(18, 26, 22, 0.55)');
      grad.addColorStop(1, 'rgba(18, 26, 22, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, w, len);
    }
    const band = ctx.createLinearGradient(0, 0, 0, 14);
    band.addColorStop(0, 'rgba(14, 20, 18, 0.6)');
    band.addColorStop(1, 'rgba(14, 20, 18, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, SIZE, 14);
  },

  stainSoot: (ctx) => {
    // Candle soot: a black fan blooming upward.
    const rand = mulberry32(43);
    for (let i = 0; i < 9; i++) {
      const x = 32 + (rand() - 0.5) * 26;
      const y = 50 - i * 5;
      const r = 8 + i * 2.2;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(8, 7, 7, 0.5)');
      grad.addColorStop(1, 'rgba(8, 7, 7, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  },

  stainScratch: (ctx) => {
    // Claw gouges: parallel raking lines, dark cut + pale lip.
    const rand = mulberry32(47);
    for (let set = 0; set < 2; set++) {
      const ox = 8 + rand() * 20;
      const oy = 8 + rand() * 16;
      const angle = 0.5 + rand() * 0.5;
      for (let i = 0; i < 3; i++) {
        const x0 = ox + i * 7;
        const y0 = oy + i * 3;
        const len = 26 + rand() * 18;
        const dx = Math.cos(angle) * len;
        const dy = Math.sin(angle) * len;
        ctx.strokeStyle = 'rgba(220, 210, 190, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + 1, y0 + 1);
        ctx.lineTo(x0 + dx + 1, y0 + dy + 1);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(12, 8, 6, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + dx, y0 + dy);
        ctx.stroke();
      }
    }
  },

  bannerCloth: (ctx) => {
    // Processional banner: blood field, bone border, the Hollow sigil (a
    // ring with an empty center), frayed bottom edge.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(SIZE, 0);
    ctx.lineTo(SIZE, 52);
    // jagged fray
    for (let x = SIZE; x >= 0; x -= 8) {
      ctx.lineTo(x - 4, 52 + (x % 16 === 0 ? 9 : 3));
      ctx.lineTo(x - 8, 52);
    }
    ctx.closePath();
    ctx.save();
    ctx.clip();
    // field + weave noise
    ctx.fillStyle = '#5e1010';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const rand = mulberry32(53);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.06 + rand() * 0.08})`;
      ctx.fillRect(Math.floor(rand() * SIZE), Math.floor(rand() * SIZE), 2, 1);
    }
    // bone border
    ctx.strokeStyle = '#cfc2a4';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, SIZE - 8, 56);
    // the Hollow sigil
    ctx.strokeStyle = '#cfc2a4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 28, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(32, 44);
    ctx.lineTo(32, 50);
    ctx.stroke();
    ctx.restore();
  },

  clothShroud: (ctx) => {
    fillNoise(ctx, [120, 116, 104], 8, 808);
    ctx.strokeStyle = 'rgba(80, 76, 66, 0.4)';
    for (let y = 0; y < SIZE; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y);
      ctx.stroke();
    }
  },
};

export const TEXTURE_NAMES = Object.freeze(Object.keys(GENERATORS));
