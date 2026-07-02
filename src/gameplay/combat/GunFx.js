import * as THREE from 'three';

/**
 * GunFx — the gunshot presentation package, all reacting to 'combat/fired':
 *   - point-light pop + a one-beat white flash sprite at the muzzle
 *   - an ejected shell casing with gravity, floor bounce (tick sfx), despawn
 *   - a smoke wisp that drifts up and fades
 *
 * One instance per gameplay session; `object` goes in the scene, update()
 * runs on the fixed step. Replaces the old MuzzleFlash.
 */
const CASING_LIFE = 1.9;
const SMOKE_LIFE = 1.4;

export class GunFx {
  /** @type {THREE.Group} */
  object = new THREE.Group();

  #light = new THREE.PointLight(0xffc873, 0, 6, 2);
  #flash;
  #lightTimer = 0;
  #casings = [];
  #smokes = [];
  #events;

  constructor(events) {
    this.#events = events;
    this.#light.visible = false;
    this.#flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flashTexture(),
        color: 0xfff4d8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    this.#flash.scale.setScalar(0.55);
    this.object.add(this.#light, this.#flash);

    events.on('combat/fired', ({ position, ranged }) => {
      if (!ranged) return;
      this.#fire(position);
    });
  }

  #fire(position) {
    this.#light.position.copy(position);
    this.#light.intensity = 40;
    this.#light.visible = true;
    this.#flash.position.copy(position);
    this.#flash.material.opacity = 0.95;
    this.#flash.material.rotation = Math.random() * Math.PI;
    this.#lightTimer = 0.07;

    // Shell casing: pops up and to the side, spins, bounces once.
    const casing = new THREE.Mesh(casingGeometry(), casingMaterial());
    casing.position.copy(position);
    this.#casings.push({
      mesh: casing,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 1.6,
        2.2 + Math.random() * 0.8,
        (Math.random() - 0.5) * 1.6
      ),
      spin: new THREE.Vector3(Math.random() * 14, Math.random() * 14, Math.random() * 14),
      life: CASING_LIFE,
      bounced: false,
    });
    this.object.add(casing);

    // Smoke wisp.
    const smoke = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: smokeTexture(),
        color: 0xb8b4ac,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      })
    );
    smoke.position.copy(position).add(new THREE.Vector3(0, 0.08, 0));
    smoke.scale.setScalar(0.3);
    this.#smokes.push({ sprite: smoke, life: SMOKE_LIFE });
    this.object.add(smoke);
  }

  update(dt) {
    if (this.#lightTimer > 0) {
      this.#lightTimer -= dt;
      this.#light.intensity *= 0.55;
      this.#flash.material.opacity *= 0.5;
      if (this.#lightTimer <= 0) {
        this.#light.visible = false;
        this.#flash.material.opacity = 0;
      }
    }

    for (const c of [...this.#casings]) {
      c.life -= dt;
      c.velocity.y -= 9.8 * dt;
      c.mesh.position.addScaledVector(c.velocity, dt);
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
      if (c.mesh.position.y <= 0.02 && c.velocity.y < 0) {
        c.mesh.position.y = 0.02;
        c.velocity.y *= -0.35;
        c.velocity.x *= 0.5;
        c.velocity.z *= 0.5;
        c.spin.multiplyScalar(0.4);
        if (!c.bounced) {
          c.bounced = true;
          this.#events.emit('audio/sfx', { id: 'casing' });
        }
      }
      if (c.life <= 0) {
        c.mesh.removeFromParent();
        this.#casings.splice(this.#casings.indexOf(c), 1);
      }
    }

    for (const s of [...this.#smokes]) {
      s.life -= dt;
      s.sprite.position.y += dt * 0.35;
      s.sprite.scale.multiplyScalar(1 + dt * 0.9);
      s.sprite.material.opacity = 0.4 * Math.max(0, s.life / SMOKE_LIFE);
      if (s.life <= 0) {
        s.sprite.removeFromParent();
        this.#smokes.splice(this.#smokes.indexOf(s), 1);
      }
    }
  }
}

let casingGeo = null;
function casingGeometry() {
  if (!casingGeo) casingGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.035, 5);
  return casingGeo;
}

let casingMat = null;
function casingMaterial() {
  if (!casingMat) {
    casingMat = new THREE.MeshStandardMaterial({
      color: 0xb8963e,
      metalness: 0.8,
      roughness: 0.4,
    });
  }
  return casingMat;
}

let flashTex = null;
function flashTexture() {
  if (flashTex) return flashTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.translate(32, 32);
  // Spiky star burst.
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    const grad = ctx.createLinearGradient(0, 0, 30, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, -2.5, 30, 5);
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(-12, -12, 24, 24);
  flashTex = new THREE.CanvasTexture(c);
  return flashTex;
}

let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 10; i++) {
    const x = 20 + Math.random() * 24;
    const y = 20 + Math.random() * 24;
    const r = 8 + Math.random() * 12;
    const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}
