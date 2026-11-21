// Zone 2 enemies: Null Wolves (packs that circle and pounce) and Static Sprites (floating TVs
// that zap from range and teleport away). Same interface as Zone 1 slimes.
import * as THREE from 'three';
import { sfx } from './audio.js?v=19';
import { buildNullWolf, buildStaticSprite, bake } from './monsters2.js?v=19';

const CYAN = 0x29e6ff, MAGENTA = 0xff2bd6;
let DETAIL = true; // false on phones: no outline lines, no real shadows
const iceMat = new THREE.MeshStandardMaterial({ color: 0x9feeff, transparent: true, opacity: 0.4, emissive: CYAN, emissiveIntensity: 0.6, depthWrite: false });
const starMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
const BLOB_GEO = new THREE.CircleGeometry(1, 16), BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

function makeTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(20,0,30,0.65)'; g.fillRect(8, 10, 240, 44);
  g.fillStyle = color; g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(1.3, 0.33, 1); sp.renderOrder = 10;
  return sp;
}

// Shared behaviour: health, glitch resistance, Patch freeze, parry stun, death and respawn.
class Enemy2 {
  constructor(scene, home, effects, { glitched = false, level = 6, radius = 0.6 } = {}) {
    this.scene = scene; this.home = home.clone(); this.effects = effects;
    this.glitched = glitched; this.level = level; this.radius = radius;
    this.group = new THREE.Group(); scene.add(this.group);
    this.mat = { opacity: 1 }; // the camera fade in main.js writes here; these models stay solid
    this.lootMul = 2;
  }

  initCommon(height) {
    // Phones: a soft dark circle instead of a real shadow (1 draw call instead of ~9).
    if (!DETAIL) {
      this.m.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
      const blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.04; blob.scale.setScalar(this.radius * 1.6);
      this.group.add(blob);
    }
    this.ice = new THREE.Mesh(new THREE.IcosahedronGeometry(this.radius * 1.5, 1), iceMat);
    this.ice.position.y = height * 0.45; this.ice.scale.y = 1.2; this.ice.visible = false; this.group.add(this.ice);
    if (this.glitched) {
      this.tag = makeTag('GLITCHED', '#ff2bd6'); this.tag.position.y = height + 0.35; this.group.add(this.tag);
      this.tagFixed = makeTag('x2 DAMAGE', '#29e6ff'); this.tagFixed.position.y = height + 0.35; this.tagFixed.visible = false; this.group.add(this.tagFixed);
    }
    this.stars = new THREE.Group();
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), starMat); st.userData.a = i / 3 * Math.PI * 2; this.stars.add(st); }
    this.stars.position.y = height + 0.1; this.stars.visible = false; this.group.add(this.stars);
    this.tagH = height;
  }

  spawnCommon() {
    this.hp = this.maxHp; this.dead = false; this.gone = false; this.patched = false; this.frozen = 0; this.stunned = 0; this.patchMult = 2;
    this.pos = this.home.clone(); this.knock = new THREE.Vector3(); this.facing = Math.random() * Math.PI * 2;
    this.deathT = 0; this.hitFlash = 0; this.alert = false;
    this.group.visible = true; this.group.scale.setScalar(1);
    if (this.tag) { this.tag.visible = true; this.tagFixed.visible = false; }
    this.ice.visible = false;
  }

  get alive() { return !this.dead; }
  get glitchedActive() { return this.glitched && !this.patched && !this.dead; }

  takeHit(amount, fromPos, opts = {}) {
    if (this.dead) return 0;
    let dmg = amount;
    if (this.glitchedActive && this.frozen <= 0 && !opts.pierce) dmg = Math.round(amount * 0.35);
    if (this.frozen > 0) dmg = Math.round(amount * this.patchMult);
    this.hp -= dmg; this.hitFlash = 0.15; this.alert = true;
    const away = this.pos.clone().sub(fromPos).setY(0).normalize();
    this.knock.copy(away).multiplyScalar(this.frozen > 0 ? 0 : this.knockPower ?? 5);
    this.onHurt?.();
    if (this.hp <= 0) {
      this.dead = true; this.deathT = 0; this.respawnT = 25;
      this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 22, [0, 1, 2], 5); sfx('enemyDie', this.pos);
    }
    return dmg;
  }

  patch(bonus = 0) {
    if (this.dead || !this.glitchedActive) return false;
    this.patched = true; this.frozen = 3 + bonus; this.patchMult = 2;
    this.ice.visible = true;
    if (this.tag) { this.tag.visible = false; this.tagFixed.visible = true; }
    this.onPatch?.();
    return true;
  }

  stun(t, fromPos) {
    if (this.dead) return;
    this.stunned = Math.max(this.stunned, t);
    this.knock.copy(this.pos.clone().sub(fromPos).setY(0).normalize()).multiplyScalar(8);
    this.onStun?.();
  }

  // Returns true while dead (caller skips its AI).
  updateCommon(dt, t, player, world) {
    if (this.dead) {
      this.deathT += dt;
      const k = Math.max(0, 1 - this.deathT / 0.5);
      this.group.scale.setScalar(Math.max(0.01, k));
      if (k <= 0) this.group.visible = false;
      if (this.noRespawn && this.deathT > 1) { this.gone = true; return true; }
      this.respawnT -= dt;
      if (this.respawnT <= 0 && !this.holdRespawn && player.pos.distanceTo(this.home) > 24) this.spawn(); // held until the boss falls
      return true;
    }
    this.stars.visible = this.stunned > 0;
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.stars.children.forEach(st => { const a = st.userData.a + t * 5; st.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45); });
    }
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) { this.ice.visible = false; if (this.tagFixed) this.tagFixed.visible = false; }
    }
    this.hitFlash -= dt;
    // Far away: hide to save draw calls (the fog hides them anyway).
    this.group.visible = player.pos.distanceTo(this.pos) < 34;
    return false;
  }
}

// ---------------------------------------------------------------- Null Wolf
let WOLF_TEMPLATE = null;
export function setMonsterDetail(dense) { DETAIL = dense; }
function wolfModel() {
  // Build once, then clone (cheap): legs/head/tail/body stay as separate animated nodes.
  if (!WOLF_TEMPLATE) {
    const { root, parts } = buildNullWolf();
    bake(root, [parts.body, parts.head, parts.tail, ...parts.legs.map(l => l.g)], { lines: DETAIL });
    WOLF_TEMPLATE = { root, parts };
  }
  const root = WOLF_TEMPLATE.root.clone(true);
  // Re-find the animated nodes in the clone by their path.
  const path = node => { const p = []; for (let n = node; n && n !== WOLF_TEMPLATE.root; n = n.parent) p.unshift(n.parent.children.indexOf(n)); return p; };
  const at = p => p.reduce((n, i) => n.children[i], root);
  const P = WOLF_TEMPLATE.parts;
  return { root, body: at(path(P.body)), head: at(path(P.head)), tail: at(path(P.tail)), legs: P.legs.map(l => at(path(l.g))) };
}

export class NullWolf extends Enemy2 {
  constructor(scene, home, effects, opts = {}) {
    super(scene, home, effects, { ...opts, radius: 0.6 });
    this.pack = opts.pack || { token: null, cd: 0 };
    this.name = 'NULL WOLF';
    const L = this.level;
    this.maxHp = Math.round((60 + 12 * L) * (this.glitched ? 1.3 : 1));
    this.dmg = Math.round(10 + 1.6 * L);
    this.xp = Math.round((30 + 4 * L) * (this.glitched ? 1.4 : 1));
    this.m = wolfModel(); this.group.add(this.m.root);
    this.m.root.rotation.y = 0;
    // Pounce telegraph: a red arrow on the ground.
    this.arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4.5), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.45, depthWrite: false }));
    this.arrow.geometry.rotateX(-Math.PI / 2); this.arrow.geometry.translate(0, 0.06, 2.6);
    this.arrow.visible = false; this.group.add(this.arrow);
    this.initCommon(1.45);
    this.spawn();
  }

  spawn() {
    this.spawnCommon();
    this.state = 'idle'; this.stateT = 0; this.attackCd = 1 + Math.random() * 2; this.circA = Math.random() * Math.PI * 2;
    this.circDir = Math.random() < 0.5 ? -1 : 1; this.wander = this.home.clone(); this.gait = 0;
    this.arrow.visible = false;
    if (this.pack.token === this) this.pack.token = null;
  }

  onStun() { if (this.pack.token === this) this.pack.token = null; this.state = 'idle'; this.arrow.visible = false; }
  onPatch() { this.onStun(); }

  update(dt, t, player, world) {
    if (this.updateCommon(dt, t, player, world)) { if (this.pack.token === this) this.pack.token = null; return null; }
    this.stateT += dt; this.attackCd -= dt;
    let attack = null, speed = 0;
    const toP = player.pos.clone().sub(this.pos).setY(0), dist = toP.length();
    if (dist < 14 && player.alive) this.alert = true;
    if (!player.alive || dist > 26) this.alert = false;
    const busy = this.frozen > 0 || this.stunned > 0;
    if (busy) { this.state = 'idle'; this.arrow.visible = false; }
    else if (this.state === 'windup') {
      this.facing = Math.atan2(this.leapDir.x, this.leapDir.z);
      this.arrow.visible = true; this.arrow.material.opacity = 0.3 + Math.sin(this.stateT * 30) * 0.2;
      if (this.stateT > 0.6) { this.state = 'leap'; this.stateT = 0; this.bit = false; this.arrow.visible = false; sfx('pounce', this.pos); }
    } else if (this.state === 'leap') {
      const k = this.stateT / 0.42;
      this.pos.addScaledVector(this.leapDir, 13 * dt);
      if (!this.bit && player.pos.distanceTo(this.pos) < 1.5) { this.bit = true; attack = { damage: this.dmg, from: this.pos.clone(), enemy: this, direct: true }; }
      if (k >= 1) { this.state = 'recover'; this.stateT = 0; }
    } else if (this.state === 'recover') {
      // Open to a counter-attack.
      if (this.stateT > 0.9) { this.state = 'idle'; if (this.pack.token === this) this.pack.token = null; this.pack.cd = 0.5 + Math.random() * 0.8; this.attackCd = 2.2 + Math.random(); }
    } else if (this.alert) {
      // Circle Jasper at ~4.5 m, then take turns pouncing.
      this.circA += dt * 0.55 * this.circDir;
      const want = player.pos.clone().add(new THREE.Vector3(Math.cos(this.circA) * 4.5, 0, Math.sin(this.circA) * 4.5));
      const to = want.sub(this.pos).setY(0), d = to.length();
      if (d > 0.4) { this.pos.addScaledVector(to.normalize(), Math.min(d, 6 * dt)); speed = 6; }
      this.facing = Math.atan2(toP.x, toP.z);
      this.pack.cd -= dt / Math.max(1, this.pack.size || 1);
      if (this.attackCd <= 0 && this.pack.cd <= 0 && !this.pack.token && dist < 7.5) {
        this.pack.token = this; this.state = 'windup'; this.stateT = 0; sfx('growl', this.pos);
        this.leapDir = toP.clone().normalize();
      }
    } else {
      if (this.pos.distanceTo(this.wander) < 1) this.wander.set(this.home.x + (Math.random() - 0.5) * 10, 0, this.home.z + (Math.random() - 0.5) * 10);
      const to = this.wander.clone().sub(this.pos).setY(0);
      if (to.lengthSq() > 0.1) { this.pos.addScaledVector(to.normalize(), 1.6 * dt); speed = 1.6; this.facing = Math.atan2(to.x, to.z); }
    }
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, this.radius);
    // Pose.
    const m = this.m;
    this.gait += dt * (speed > 3 ? 11 : speed > 0 ? 6 : 0);
    const swing = speed > 0 ? Math.sin(this.gait) * (speed > 3 ? 0.7 : 0.35) : 0;
    m.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? swing : -swing); });
    const crouch = this.state === 'windup' ? 1 : 0;
    const leapY = this.state === 'leap' ? Math.sin(Math.min(1, this.stateT / 0.42) * Math.PI) * 0.8 : 0;
    m.body.position.y = -0.14 * crouch + (speed > 3 ? Math.abs(Math.sin(this.gait)) * 0.06 : 0);
    m.body.rotation.x = this.state === 'leap' ? -0.15 : crouch * 0.12;
    m.head.rotation.x = this.state === 'windup' ? -0.1 : 0.18;
    m.tail.rotation.x = -0.15 + Math.sin(t * 5 + this.home.x) * 0.15;
    m.tail.rotation.y = Math.sin(t * 3 + this.home.z) * 0.3;
    if (this.glitchedActive) m.root.position.x = Math.sin(t * 37 + this.home.x) > 0.88 ? (Math.random() - 0.5) * 0.2 : 0; else m.root.position.x = 0;
    const s = this.hitFlash > 0 ? 1.08 : 1;
    m.root.scale.set(s, s, s);
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z) + leapY, this.pos.z);
    this.group.rotation.y = this.facing;
    return attack;
  }
}

// ---------------------------------------------------------------- Static Sprite
let SPRITE_TEMPLATE = null;
function spriteModel() {
  if (!SPRITE_TEMPLATE) {
    const { root, parts } = buildStaticSprite();
    bake(root, [parts.body, parts.bits, parts.trail], { lines: DETAIL });
    SPRITE_TEMPLATE = { root, parts };
  }
  const root = SPRITE_TEMPLATE.root.clone(true);
  const body = root.children[0];
  // Each sprite gets its own screen material so it can light up when charging.
  let screen = null;
  body.traverse(o => { if (o.isMesh && o.material.emissiveMap && !screen) { o.material = o.material.clone(); screen = o.material; } });
  const P = SPRITE_TEMPLATE.parts;
  return { root, body, screen, bits: body.children[P.body.children.indexOf(P.bits)], trail: body.children[P.body.children.indexOf(P.trail)] };
}
const boltGeo = new THREE.BoxGeometry(0.09, 0.09, 0.7), boltMat = new THREE.MeshBasicMaterial({ color: CYAN });

export class StaticSprite extends Enemy2 {
  constructor(scene, home, effects, opts = {}) {
    super(scene, home, effects, { ...opts, glitched: true, radius: 0.5 });
    this.name = 'STATIC SPRITE';
    const L = this.level;
    this.maxHp = Math.round(40 + 8 * L);
    this.dmg = Math.round(8 + 1.1 * L);
    this.xp = Math.round(35 + 4 * L);
    this.knockPower = 3;
    this.m = spriteModel(); this.group.add(this.m.root);
    this.bolts = [];
    this.initCommon(2.0);
    this.ice.position.y = 0.45;
    this.spawn();
  }

  spawn() {
    this.spawnCommon();
    this.state = 'drift'; this.stateT = 0; this.fireCd = 1.5 + Math.random() * 1.5; this.blinkCd = 3; this.hover = 1;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
  }

  #blink(player, world) {
    this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 14, [0, 2], 4);
    const a = Math.random() * Math.PI * 2;
    this.pos.copy(player.pos).add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6));
    world.resolve(this.pos, this.radius);
    this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 14, [0, 2], 4);
    // Dizzy after teleporting: no moving or shooting for a moment (a chance to hit it).
    sfx('teleport', this.pos); this.blinkCd = 9; this.state = 'dazed'; this.stateT = 0; this.fireCd = Math.max(this.fireCd, 2);
  }

  update(dt, t, player, world) {
    let attack = null;
    // Bolts keep flying even if the sprite dies.
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt; b.mesh.position.addScaledVector(b.vel, dt);
      const chest = player.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
      if (player.alive && b.mesh.position.distanceTo(chest) < 0.85) {
        attack = { damage: this.dmg, from: this.pos.clone(), enemy: this, direct: true, drain: 18 };
        this.effects.burst(b.mesh.position.clone(), 10, [0, 2], 3); b.life = 0;
      }
      if (b.life <= 0) { this.scene.remove(b.mesh); this.bolts.splice(i, 1); }
    }
    if (this.updateCommon(dt, t, player, world)) return attack;
    this.stateT += dt; this.fireCd -= dt; this.blinkCd -= dt;
    const toP = player.pos.clone().sub(this.pos).setY(0), dist = toP.length();
    if (dist < 15 && player.alive) this.alert = true;
    if (!player.alive || dist > 28) this.alert = false;
    const grounded = this.frozen > 0;
    if (grounded || this.stunned > 0) { this.state = 'drift'; }
    else if (this.alert) {
      this.facing = Math.atan2(toP.x, toP.z);
      if (this.state === 'dazed') { if (this.stateT > 1.5) { this.state = 'drift'; this.stateT = 0; } }
      else if (this.state === 'warn') { if (this.stateT > 0.9) this.#blink(player, world); }   // flickers, then vanishes
      else if (dist < 3.2 && this.blinkCd <= 0 && !this.patched) { this.state = 'warn'; this.stateT = 0; sfx('warn', this.pos); } // patched TVs can't teleport
      else if (this.state === 'charge') {
        if (this.stateT > 0.7) {
          // Fire a static bolt at where Jasper is now.
          const from = this.pos.clone().add(new THREE.Vector3(0, 1.25, 0));
          const to = player.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
          const dir = to.sub(from).normalize();
          const mesh = new THREE.Mesh(boltGeo, boltMat); mesh.position.copy(from); mesh.lookAt(from.clone().add(dir));
          this.scene.add(mesh); this.bolts.push({ mesh, vel: dir.multiplyScalar(13), life: 1.6 }); sfx('tvZap', this.pos);
          this.state = 'drift'; this.stateT = 0; this.fireCd = 2.4 + Math.random() * 1.2;
        }
      } else {
        // Keep a 6-10 m distance and strafe sideways.
        const side = new THREE.Vector3(-toP.z, 0, toP.x).normalize().multiplyScalar(this.strafe);
        const move = side.multiplyScalar(1.6);
        if (dist < 6) move.addScaledVector(toP.clone().normalize(), -3);
        if (dist > 10) move.addScaledVector(toP.clone().normalize(), 3);
        this.pos.addScaledVector(move, dt);
        if (Math.random() < dt * 0.3) this.strafe *= -1;
        if (this.fireCd <= 0 && dist < 16) { this.state = 'charge'; this.stateT = 0; sfx('tvCharge', this.pos); }
      }
    } else {
      const to = this.home.clone().add(new THREE.Vector3(Math.sin(t * 0.3 + this.home.x) * 4, 0, Math.cos(t * 0.25 + this.home.z) * 4)).sub(this.pos).setY(0);
      this.pos.addScaledVector(to, Math.min(1, dt * 0.5));
    }
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, this.radius);
    // Hover; when patched it drops to the ground (signal lost).
    this.hover += ((grounded ? -0.85 : 0) - (this.hover - 1) - 1) * Math.min(1, dt * 4) + 0;
    const hoverY = grounded ? -0.85 : Math.sin(t * 2.2 + this.home.x) * 0.15;
    this.m.body.position.y += ((1.2 + hoverY) - this.m.body.position.y) * Math.min(1, dt * (grounded ? 8 : 4));
    this.m.body.rotation.z = grounded ? 0.35 : Math.sin(t * 1.7) * 0.08;
    this.m.body.rotation.x = this.state === 'charge' ? 0.15 : 0;
    if (this.m.screen) this.m.screen.emissiveIntensity = this.state === 'charge' ? 1.2 + Math.sin(this.stateT * 40) * 0.5 : grounded ? 0.1 : 0.55;
    if (this.m.screen?.emissiveMap) this.m.screen.emissiveMap.offset.y = (t * 3.7) % 1;
    this.m.bits.rotation.y += dt * 1.5;
    this.m.trail.visible = !grounded;
    this.m.root.position.x = this.glitchedActive && Math.sin(t * 31 + this.home.z) > 0.9 ? (Math.random() - 0.5) * 0.2 : 0;
    this.m.root.visible = this.state !== 'warn' || Math.sin(this.stateT * 45) > -0.3; // warning flicker before a teleport
    if (this.state === 'dazed') this.m.body.rotation.z = Math.sin(t * 14) * 0.25;
    this.m.root.scale.setScalar(this.hitFlash > 0 ? 1.1 : 1);
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z), this.pos.z);
    this.group.rotation.y = this.facing;
    this.tag && (this.tag.position.y = this.m.body.position.y + 0.95);
    return attack;
  }
}

// Zone 2 enemy placement. `level` follows Jasper's level (Glitchwood is tuned for 6-12).
export function spawnZone2(scene, effects, level, quality) {
  setMonsterDetail(!!quality?.dense);
  const L = Math.max(6, Math.min(12, level));
  const list = [];
  const pack = (cx, cz, spots) => {
    const p = { token: null, cd: 0, size: spots.length };
    for (const [x, z, g] of spots) list.push(new NullWolf(scene, new THREE.Vector3(cx + x, 0, cz + z), effects, { glitched: g, level: L, pack: p }));
  };
  pack(4, 30, [[-2, 0, false], [2, 2, true]]);                       // path below the fork
  pack(16, 12, [[0, 0, false], [3, -2, false], [-2, -3, true]]);      // road to the grove
  pack(36, -2, [[0, 0, true], [4, 3, false], [-3, 4, true]]);        // Corrupted Grove
  pack(-8, -26, [[0, 0, false], [3, 2, true]]);                       // before Root Hollow
  for (const [x, z] of [[30, 10], [40, -4], [28, -8], [-20, 22], [10, -22], [-10, -18]]) list.push(new StaticSprite(scene, new THREE.Vector3(x, 0, z), effects, { level: L }));
  return list;
}
