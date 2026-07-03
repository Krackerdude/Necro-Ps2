import * as THREE from 'three';
import { EnemyHealth } from '../combat/EnemyHealth.js';

/**
 * THE GARDENER — the Undercroft's midpoint boss. The one who plants the
 * given, still making his rounds. A digger grown to the size of the job.
 *
 *   THE GIMMICK — THE ERUPTION: it hunts as a huge wake of turned earth
 *   (invulnerable), marks your position with a ring of disturbed soil,
 *   and ERUPTS there 0.9 s later. The Planting Hall is rows of soft grave
 *   mounds crossed by STONE PATHS — stand on stone when the ring closes
 *   and the eruption wastes itself (and the Gardener surfaces confused,
 *   with a LONGER vulnerable window). Get caught on soil and it costs 30.
 *   Surfaced, it swings long root-arms and can finally be hurt; then the
 *   ground takes it back.
 *
 * The tower taught rhythm, the scriptorium taught footwork; the Planting
 * Hall teaches you to read the floor.
 */
const HP = 300;
const BURROW_SPEED = 2.4;
const SURFACE_WALK = 0.9;
const TELEGRAPH_TIME = 0.9;
const ERUPT_RADIUS = 1.8;
const ERUPT_DAMAGE = 30;
const SURFACE_TIME = 7;
const SURFACE_TIME_WHIFF = 10; // missing you leaves it confused, longer
const BURROW_MIN = 4; // chases at least this long before striking
const CONTACT_RANGE = 1.05;
const CONTACT_DAMAGE = 24;
const CONTACT_COOLDOWN = 1.5;

export class Gardener {
  /** @type {THREE.Group} */
  object = new THREE.Group();
  radius = 0.6;
  /** @type {EnemyHealth} */
  health;

  #physics;
  #events;
  #playerObject;
  #playerStats;
  #story;
  #islands;
  #soft;
  #body;
  #mound;
  #ring;
  #joints;
  /** 'burrowed' | 'telegraph' | 'erupting' | 'surfaced' */
  #state = 'burrowed';
  #timer = BURROW_MIN;
  #ringPos = new THREE.Vector3();
  #surfaceBudget = 0;
  #cooldown = 0;
  #phase = 0;
  #felledFlagSet = false;

  constructor({ ps2, physics, events, spawn, playerObject, playerStats, story }) {
    this.#physics = physics;
    this.#events = events;
    this.#playerObject = playerObject;
    this.#playerStats = playerStats;
    this.#story = story;
    this.#islands = spawn.islands ?? []; // stone rects: safe from eruptions
    this.#soft = spawn.soft ?? [];

    const soil = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x42301e, roughness: 1 }));
    const rootSkin = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x7a6a48, roughness: 1 }));
    const moss = ps2.patch(new THREE.MeshStandardMaterial({ color: 0x4a5a34, roughness: 1 }));

    // The wake: a rolling hill of soil.
    this.#mound = new THREE.Group();
    const heap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.6, 8), soil);
    heap.position.y = 0.3;
    this.#mound.add(heap);
    this.object.add(this.#mound);

    // The eruption ring: disturbed earth, your last warning.
    this.#ring = new THREE.Mesh(
      new THREE.TorusGeometry(ERUPT_RADIUS, 0.09, 6, 16),
      ps2.patch(
        new THREE.MeshStandardMaterial({
          color: 0x2a1c10,
          emissive: 0x6a3a12,
          emissiveIntensity: 1.2,
        })
      )
    );
    this.#ring.rotation.x = -Math.PI / 2;
    this.#ring.visible = false;
    // ring is parented to the LEVEL-space via object.parent at spawn; keep
    // it on our group and offset in world coords each telegraph instead.
    this.object.add(this.#ring);

    // The body: a giant of roots and grave-soil, spade in hand.
    this.#body = new THREE.Group();
    const torso = new THREE.Group();
    torso.position.y = 1.25;
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.55), moss);
    trunk.position.y = 0.45;
    torso.add(trunk);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.36), rootSkin);
    head.position.y = 1.2;
    torso.add(head);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 6), soil);
    hood.position.y = 1.5;
    torso.add(hood);
    const mkLimb = (w, h, material, parent, x, y, z = 0) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), material);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      pivot.position.set(x, y, z);
      parent.add(pivot);
      return pivot;
    };
    const armL = mkLimb(0.22, 1.05, rootSkin, torso, -0.6, 0.8, 0.08);
    const armR = mkLimb(0.22, 1.05, rootSkin, torso, 0.6, 0.8, 0.08);
    // The spade. Of course the spade.
    const spade = new THREE.Group();
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5),
      ps2.patch(new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 })));
    haft.position.y = -0.6;
    spade.add(haft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.04),
      ps2.patch(new THREE.MeshStandardMaterial({ color: 0x3a3a44, metalness: 0.6, roughness: 0.5 })));
    blade.position.y = -1.3;
    spade.add(blade);
    spade.position.y = -0.95;
    armR.add(spade);
    const legL = mkLimb(0.28, 1.25, moss, this.#body, -0.26, 1.25);
    const legR = mkLimb(0.28, 1.25, moss, this.#body, 0.26, 1.25);
    this.#body.add(torso);
    this.#body.visible = false;
    this.#body.position.y = -2.4;
    this.object.add(this.#body);
    this.#joints = { torso, armL, armR, legL, legR };

    this.object.traverse((n) => (n.castShadow = true));
    this.object.position.copy(spawn.position);
    this.health = new EnemyHealth(events, { hp: HP, root: this.object });
  }

  get alive() {
    return this.health.alive;
  }

  hearNoise() {}

  #onStone(x, z) {
    return this.#islands.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  }

  #inSoft(x, z) {
    return this.#soft.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  }

  takeHit(damage) {
    if (!this.health.alive) return;
    if (this.#state !== 'surfaced') {
      this.#events.emit('audio/sfx', { id: 'uiBack' });
      return;
    }
    this.health.takeHit(damage);
    if (!this.health.alive && !this.#felledFlagSet) {
      this.#felledFlagSet = true;
      this.#story?.set('gardenerFelled', true);
      this.#events.emit('audio/sfx', { id: 'stingerKill' });
      this.#events.emit('ui/toast', {
        text: 'The Gardener folds into his own furrow. The ground, for once, keeps what it is given.',
      });
    }
  }

  update(dt) {
    const dying = this.health.update(dt);
    if (!this.health.alive) {
      this.#joints.torso.rotation.x = Math.min(1.4, this.#joints.torso.rotation.x + dt * 1.2);
      this.object.position.y = -dying * 0.8;
      this.#ring.visible = false;
      return;
    }

    const playerPos = this.#playerObject.position;
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.object.position).setY(0);
    const dist = toPlayer.length();
    toPlayer.normalize();

    if (this.#state === 'burrowed') {
      this.#mound.visible = true;
      this.#body.visible = false;
      this.#phase += dt * 6;
      this.#mound.children[0].scale.setScalar(1 + Math.sin(this.#phase) * 0.12);
      // The wake rolls straight at you; graves are no obstacle to their maker.
      this.object.position.x += toPlayer.x * BURROW_SPEED * dt;
      this.object.position.z += toPlayer.z * BURROW_SPEED * dt;
      this.#timer -= dt;
      if (this.#timer <= 0 && dist < 7) {
        this.#state = 'telegraph';
        this.#timer = TELEGRAPH_TIME;
        // Mark where you ARE. Where you are WHEN IT LANDS is up to you.
        this.#ringPos.copy(playerPos);
        this.#ring.position.set(
          this.#ringPos.x - this.object.position.x,
          0.06,
          this.#ringPos.z - this.object.position.z
        );
        this.#ring.visible = true;
        this.#events.emit('audio/sfx', { id: 'footstepBone' });
      }
      return;
    }

    if (this.#state === 'telegraph') {
      this.#timer -= dt;
      this.#ring.scale.setScalar(1 + Math.sin(this.#timer * 25) * 0.05);
      if (this.#timer <= 0) {
        this.#ring.visible = false;
        // ERUPT at the marked spot.
        this.object.position.x = this.#ringPos.x;
        this.object.position.z = this.#ringPos.z;
        this.#events.emit('audio/sfx', { id: 'bellToll' });
        this.#events.emit('camera/impulse', { strength: 0.7 });
        const playerDist = playerPos.distanceTo(this.#ringPos);
        const safe = this.#onStone(playerPos.x, playerPos.z);
        let hit = false;
        if (playerDist < ERUPT_RADIUS && !safe) {
          hit = this.#playerStats.damage(ERUPT_DAMAGE);
          if (hit) this.#events.emit('audio/sfx', { id: 'hurt' });
        }
        this.#state = 'surfaced';
        this.#surfaceBudget = hit ? SURFACE_TIME : SURFACE_TIME_WHIFF;
        this.#body.visible = true;
        this.#body.position.y = 0;
        this.#mound.visible = false;
        if (!hit) {
          this.#events.emit('ui/toast', {
            text: safe && playerDist < ERUPT_RADIUS
              ? 'The eruption breaks against the paving stones. The Gardener stands in his own crater, confused.'
              : 'The Gardener erupts through an empty row.',
          });
        }
      }
      return;
    }

    // Surfaced: slow, enormous, and finally mortal.
    this.#surfaceBudget -= dt;
    this.object.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    if (dist > CONTACT_RANGE) {
      this.#physics.moveCircle(
        this.object.position,
        toPlayer.x * SURFACE_WALK * dt,
        toPlayer.z * SURFACE_WALK * dt,
        this.radius
      );
    }
    this.#phase += dt * 2.4;
    const swing = Math.sin(this.#phase) * 0.35;
    this.#joints.legL.rotation.x = swing;
    this.#joints.legR.rotation.x = -swing;
    this.#joints.torso.rotation.x += (0.2 - this.#joints.torso.rotation.x) * Math.min(1, 4 * dt);
    const reach = dist < 2.4 ? -1.3 : -0.4;
    this.#joints.armL.rotation.x += (reach - this.#joints.armL.rotation.x) * Math.min(1, 5 * dt);
    this.#joints.armR.rotation.x += (reach - 0.2 - this.#joints.armR.rotation.x) * Math.min(1, 5 * dt);

    this.#cooldown -= dt;
    if (dist <= CONTACT_RANGE && this.#cooldown <= 0) {
      this.#cooldown = CONTACT_COOLDOWN;
      if (this.#playerStats.damage(CONTACT_DAMAGE)) {
        this.#events.emit('audio/sfx', { id: 'hurt' });
        this.#events.emit('camera/impulse', { strength: 0.45 });
      }
    }

    if (this.#surfaceBudget <= 0 && this.#inSoft(this.object.position.x, this.object.position.z)) {
      this.#state = 'burrowed';
      this.#timer = BURROW_MIN;
      this.#body.visible = false;
      this.#body.position.y = -2.4;
      this.#mound.visible = true;
      this.#events.emit('audio/sfx', { id: 'footstepBone' });
      this.#events.emit('camera/impulse', { strength: 0.3 });
    }
  }

  /* Save participant interface. */
  captureState() {
    const { x, y, z } = this.object.position;
    return { position: [x, y, z], hp: this.health.hp };
  }

  restoreState(state) {
    if (state?.position) this.object.position.set(...state.position);
    if (typeof state?.hp === 'number') this.health.hp = state.hp;
  }
}
