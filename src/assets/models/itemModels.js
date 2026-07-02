import * as THREE from 'three';
import { getTexture } from '../textures/proceduralTextures.js';
import { buildWeaponModel, hasWeaponModel } from './weaponModels.js';

/**
 * Examine models — a small 3D model for every inventory item, shown
 * rotating in the satchel's dossier panel. Weapons reuse their real models;
 * the rest are compact bespoke builders in the same PS2 budget.
 */
export function buildItemModel(itemId, ps2) {
  if (hasWeaponModel(itemId)) return buildWeaponModel(itemId, ps2);
  const builder = BUILDERS[itemId];
  if (!builder) return fallbackModel(ps2);
  return builder(ps2);
}

function mat(ps2, textureName, opts = {}) {
  const texture = getTexture(textureName).clone();
  if (opts.repeat) texture.repeat.set(...opts.repeat);
  return ps2.patch(
    new THREE.MeshStandardMaterial({
      map: texture,
      color: opts.color ?? 0xffffff,
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0.1,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
    })
  );
}

const BUILDERS = {
  boneShells: (ps2) => {
    // A wax-paper fold of tallow rounds.
    const group = new THREE.Group();
    const brass = mat(ps2, 'ironDark', { color: 0xb8963e, metalness: 0.7, roughness: 0.4 });
    const paper = mat(ps2, 'clothShroud', { color: 0xc9bd9e });
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.1), paper);
    wrap.position.y = -0.03;
    group.add(wrap);
    for (let i = 0; i < 5; i++) {
      const round = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 5), brass);
      round.position.set(-0.045 + i * 0.023, 0.01, (i % 2) * 0.02 - 0.01);
      group.add(round);
    }
    return group;
  },

  graveTonic: (ps2) => {
    // Sacramental bottle, wax-sealed.
    const group = new THREE.Group();
    const glass = mat(ps2, 'ironDark', { color: 0x6e1616, metalness: 0.2, roughness: 0.25 });
    const wax = mat(ps2, 'carpetRed', { color: 0x9e1616 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.13, 7), glass);
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.045, 0.035, 7), glass);
    shoulder.position.y = 0.082;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.05, 6), glass);
    neck.position.y = 0.125;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), wax);
    cap.position.y = 0.152;
    group.add(body, shoulder, neck, cap);
    return group;
  },

  mossPoultice: (ps2) => {
    // Grave moss packed in linen — a lumpy tied bundle.
    const group = new THREE.Group();
    const linen = mat(ps2, 'clothShroud', { color: 0xb8ac8e });
    const moss = mat(ps2, 'boneDust', { color: 0x6f7d4e, emissive: 0x1a2a10, emissiveIntensity: 0.4 });
    const bundle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), linen);
    bundle.scale.y = 0.7;
    const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), moss);
    tuft.position.set(0.03, 0.05, 0.02);
    group.add(bundle, tuft);
    return group;
  },

  blackIronKey: (ps2) => keyModel(ps2, 0x3a3a44, 0x30303a),
  verdigrisKey: (ps2) => keyModel(ps2, 0x5a8a6a, 0x1a4a2a),

  hollowIcon: (ps2) => {
    const group = new THREE.Group();
    const metal = mat(ps2, 'ironDark', { emissive: 0x6a1a1a, emissiveIntensity: 0.8 });
    const icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), metal);
    group.add(icon);
    return group;
  },
};

function keyModel(ps2, color, emissive) {
  const group = new THREE.Group();
  const iron = mat(ps2, 'ironDark', { color, emissive, emissiveIntensity: 0.4, metalness: 0.5 });
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 4, 6), iron);
  bow.position.y = 0.07;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 5), iron);
  shaft.position.y = -0.02;
  for (const [y, w] of [
    [-0.07, 0.045],
    [-0.05, 0.03],
  ]) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.016, 0.014), iron);
    tooth.position.set(w / 2, y, 0);
    group.add(tooth);
  }
  group.add(bow, shaft);
  return group;
}

function fallbackModel(ps2) {
  return new THREE.Mesh(
    new THREE.OctahedronGeometry(0.08, 0),
    mat(ps2, 'boneDust', { emissive: 0x554a2a, emissiveIntensity: 0.6 })
  );
}
