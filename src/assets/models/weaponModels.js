import * as THREE from 'three';
import { getTexture } from '../textures/proceduralTextures.js';

/**
 * Weapon models — detailed low-poly procedural meshes, PS2 budget
 * (~150–300 tris, 64px textures, hard edges).
 *
 * CONVENTION: models are built along -Y with the origin at the grip point.
 * The player rig parents them to a hand anchor at the end of the right arm,
 * so the weapon hangs at the side when the arm hangs and points down-range
 * when the arm raises to aim — no per-pose re-orientation needed.
 *
 * Registry keyed by item id (matches inventory/itemCatalog.js). Used both
 * for the held weapon and for world pickups. When real asset models arrive,
 * they replace these builders one id at a time; callers only ever see
 * `buildWeaponModel(id, ps2)`.
 */
const BUILDERS = {
  rustMachete: buildMachete,
  boneRevolver: buildRevolver,
};

/**
 * @param {string} itemId
 * @param {import('../../rendering/materials/Ps2MaterialSystem.js').Ps2MaterialSystem} ps2
 * @returns {THREE.Group}
 */
export function buildWeaponModel(itemId, ps2) {
  const builder = BUILDERS[itemId];
  if (!builder) throw new Error(`No weapon model for '${itemId}'`);
  const model = builder(ps2);
  model.traverse((n) => {
    n.castShadow = true;
  });
  return model;
}

export function hasWeaponModel(itemId) {
  return Boolean(BUILDERS[itemId]);
}

/**
 * Per-weapon offset from the hand anchor so the GRIP sits in the palm
 * (model origins vary — the revolver's grip rides above its origin).
 *
 * `scale` deliberately oversizes held props: at 448p internal resolution a
 * true-scale handgun is 2–3 pixels. PS2 games oversized weapons for exactly
 * this reason; it's part of the look, not a hack.
 */
const HOLD_TRANSFORMS = {
  // Machete rotates 90° about Y so the blade plane is vertical: edge leads
  // the swing instead of slapping flat.
  rustMachete: { position: [0, -0.02, 0.01], rotation: [0, Math.PI / 2, 0], scale: 1.45 },
  boneRevolver: { position: [0, -0.1, 0.03], rotation: [-0.15, 0, 0], scale: 2.1 },
};

export function getHoldTransform(itemId) {
  return (
    HOLD_TRANSFORMS[itemId] ?? { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }
  );
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
    })
  );
}

/* ------------------------------------------------------------------ */
/*  RUST-EATEN MACHETE                                                 */
/*  Bolo silhouette: blade widens toward the tip, drops to a clipped   */
/*  point. Wood slab grip with iron rivets, stub guard, lanyard ring.  */
/* ------------------------------------------------------------------ */
function buildMachete(ps2) {
  const group = new THREE.Group();
  const steel = mat(ps2, 'rustBlade', { metalness: 0.45, roughness: 0.6 });
  const wood = mat(ps2, 'woodPlanks', { color: 0x8a6a48, repeat: [0.5, 0.5] });
  const iron = mat(ps2, 'ironDark', { metalness: 0.5, roughness: 0.55 });

  // Blade outline in the XY plane (x = width toward the edge, -y = length),
  // extruded flat. Classic bolo: narrow at the guard, bellied near the tip.
  const shape = new THREE.Shape();
  shape.moveTo(-0.012, -0.06);   // spine at the guard
  shape.lineTo(-0.02, -0.3);     // spine runs nearly straight
  shape.lineTo(-0.012, -0.44);   // spine drops toward the clipped tip
  shape.lineTo(0.03, -0.47);     // clipped point
  shape.lineTo(0.055, -0.38);    // the belly
  shape.lineTo(0.042, -0.2);     // edge sweeps back in
  shape.lineTo(0.028, -0.06);    // edge at the guard
  shape.closePath();
  const blade = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }),
    steel
  );
  blade.position.z = -0.006;
  group.add(blade);

  // Grip: two wood slabs over a tang, three iron rivets.
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.15, 0.052), wood);
  grip.position.y = 0.015;
  group.add(grip);
  for (const y of [-0.03, 0.02, 0.06]) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.058, 5), iron);
    rivet.rotation.x = Math.PI / 2;
    rivet.position.set(0, y, 0);
    group.add(rivet);
  }
  // Pommel flare + lanyard ring.
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.03, 0.06), wood);
  pommel.position.y = 0.1;
  group.add(pommel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 4, 6), iron);
  ring.position.y = 0.125;
  group.add(ring);
  // Stub guard between grip and blade.
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.016, 0.062), iron);
  guard.position.y = -0.058;
  group.add(guard);

  return group;
}

/* ------------------------------------------------------------------ */
/*  OSSUARY REVOLVER                                                   */
/*  Service revolver interred with its owner: heavy octagonal barrel,  */
/*  fluted cylinder ringed with carved bone "teeth", drooping wood     */
/*  grip, hammer spur, trigger guard, front blade sight.               */
/* ------------------------------------------------------------------ */
function buildRevolver(ps2) {
  const group = new THREE.Group();
  const steel = mat(ps2, 'gunMetal', { metalness: 0.6, roughness: 0.45 });
  const wood = mat(ps2, 'woodPlanks', { color: 0x5a3c28, repeat: [0.5, 0.5] });
  const bone = mat(ps2, 'boneDust', { color: 0xd8ccae, roughness: 0.9 });

  // ORIENTATION: -Y is the muzzle. When the aim pose rotates the arm down
  // -90° about X, model +Z becomes world UP — so everything "on top" of the
  // pistol (topstrap, sight, hammer) lives on +Z, and everything hanging
  // below (grip, trigger guard) lives on -Z.

  // Barrel: octagonal, long, along -Y. Muzzle at y = -0.19.
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.15, 8), steel);
  barrel.position.y = -0.115;
  group.add(barrel);
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 6),
    mat(ps2, 'ironDark', { color: 0x0a0a0a }));
  bore.position.y = -0.1905;
  group.add(bore);
  // Front blade sight — on top.
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.01), steel);
  sight.position.set(0, -0.178, 0.014);
  group.add(sight);

  // Frame: topstrap over the cylinder + standing breech.
  const topstrap = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.085, 0.012), steel);
  topstrap.position.set(0, -0.014, 0.024);
  group.add(topstrap);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.03), steel);
  frame.position.set(0, 0.014, -0.002);
  group.add(frame);

  // Cylinder: six-fluted drum, axis along the barrel.
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.048, 6), steel);
  drum.position.set(0, -0.018, -0.004);
  group.add(drum);
  // Carved bone teeth ringing the drum (the lore detail).
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.014, 0.004), bone);
    tooth.position.set(Math.cos(angle) * 0.021, -0.018, -0.004 + Math.sin(angle) * 0.021);
    tooth.rotation.y = -angle;
    group.add(tooth);
  }

  // Hammer spur, cocked back — top rear.
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.026, 0.008), steel);
  hammer.position.set(0, 0.036, 0.024);
  hammer.rotation.x = 0.6;
  group.add(hammer);

  // Trigger guard: half torus under the frame; trigger stub inside.
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 4, 8, Math.PI), steel);
  guard.position.set(0, 0.028, -0.018);
  guard.rotation.set(0, Math.PI / 2, 0);
  group.add(guard);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.014, 0.005), steel);
  trigger.position.set(0, 0.032, -0.014);
  trigger.rotation.x = -0.3;
  group.add(trigger);

  // Grip: drooping bird's-head profile, angled back-and-down into the palm.
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.075, 0.036), wood);
  grip.position.set(0, 0.056, -0.038);
  grip.rotation.x = -0.55;
  group.add(grip);
  const gripCap = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.018, 0.04), bone);
  gripCap.position.set(0, 0.092, -0.058);
  gripCap.rotation.x = -0.55;
  group.add(gripCap);

  return group;
}
