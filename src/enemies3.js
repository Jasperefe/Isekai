// Zone 3 enemies: Copy Guards (shield knights, copies of the royal guard) and Error Mages
// (floating glitch casters). Also the shared knight body used by Sir Duplicate.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sfx } from './audio.js?v=34';
import { buildCharacter } from './characters.js?v=34';
import { Enemy2, makeTag } from './enemies2.js?v=34';
import { bake } from './monsters2.js?v=34';

const MAGENTA = 0xff2bd6, CYAN = 0x29e6ff;
let DETAIL = true;
export function setZone3Detail(d) { DETAIL = d; }

// ---------------------------------------------------------------- Knight bodies
// Low-poly props are merged into one vertex-coloured mesh per bone, so a knight costs ~10 draw calls.
const VC = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.4, metalness: 0.55 });
const VC_GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });
function part(geo, color, m) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
function meshOf(parts, glow) {
  const g = new THREE.Group();
  if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts), VC); m.castShadow = DETAIL; g.add(m); }
  if (glow?.length) { const m = new THREE.Mesh(mergeGeometries(glow.map(p => { p.deleteAttribute('normal'); return p; })), VC_GLOW); g.add(m); }
  return g;
}
const findBone = (root, name) => { let b = null; root.traverse(o => { if (!b && o.isBone && o.name === name) b = o; }); return b; };
function attachWorld(root, obj, bone, pos, quat) {
  root.add(obj); obj.position.copy(pos); if (quat) obj.quaternion.copy(quat);
  root.updateMatrixWorld(true); findBone(root, bone).attach(obj);
}

const TEMPL = {};
export function initKnights(gltf, clips, idle) {
  TEMPL.clips = Object.fromEntries(clips.map(c => [c.name, c]));
  TEMPL.guard = makeKnight(gltf, 'guard');
  TEMPL.duke = makeKnight(gltf, 'duke');
}

function makeKnight(gltf, kind) {
  const duke = kind === 'duke';
  const root = buildCharacter({ scene: skClone(gltf.scene) }, 'npc', TEMPL.clips.Sword_Idle).root;
  // This model has no base body, so the outfit's skeleton (bones renamed "root_1", "Head_1"...) is the one kept.
  root.traverse(o => { if (o.isBone) o.name = o.name.replace(/_1$/, ''); });
  // Armour: the ranger outfit, re-shaded as metal.
  const mats = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    if (!mats.has(o.material.name)) mats.set(o.material.name, new THREE.MeshStandardMaterial({ map: o.material.map, color: duke ? 0xf0c766 : 0xb9c3d6, metalness: 0.62, roughness: 0.38 }));
    o.material = mats.get(o.material.name); o.castShadow = DETAIL;
  });
  // Pose in the sword stance, then fit the props to the bones.
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(TEMPL.clips.Sword_Idle).play(); mixer.update(0.5); root.updateMatrixWorld(true);
  const wp = n => findBone(root, n).getWorldPosition(new THREE.Vector3());
  const steel = duke ? 0xf2cf6e : 0xc7d0e0, dark = 0x23263a, trim = duke ? 0xb3262e : 0x3f4a6a, gold = 0xe7b64a;
  // Closed helmet with a glowing visor slit (copies have magenta eyes).
  const head = wp('Head');
  const helm = [part(new THREE.CylinderGeometry(0.16, 0.175, 0.3, 10), steel), part(new THREE.SphereGeometry(0.163, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), steel, M(0, 0.15)),
    part(new THREE.BoxGeometry(0.33, 0.05, 0.05), trim, M(0, -0.02, 0.15)), part(new THREE.BoxGeometry(0.06, 0.2, 0.05), steel, M(0, -0.03, 0.165))];
  const helmGlow = [part(new THREE.BoxGeometry(0.24, 0.028, 0.02), duke ? 0xffd36b : MAGENTA, M(0, 0.035, 0.172))];
  if (duke) {
    helm.push(part(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 10, 1, true), gold, M(0, 0.22)));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; helm.push(part(new THREE.ConeGeometry(0.035, 0.1, 4), gold, M(Math.cos(a) * 0.16, 0.29, Math.sin(a) * 0.16))); }
    for (let i = 0; i < 5; i++) helm.push(part(new THREE.BoxGeometry(0.07, 0.07, 0.12), 0xc8323c, M(0, 0.3 + i * 0.04 - i * i * 0.012, -0.02 - i * 0.09, 0.3 * i)));
  } else helm.push(part(new THREE.BoxGeometry(0.03, 0.1, 0.32), trim, M(0, 0.28, -0.02)));
  attachWorld(root, meshOf(helm, helmGlow), 'Head', new THREE.Vector3(head.x, head.y + 0.08, head.z));
  // Shoulder plates.
  for (const s of ['l', 'r']) {
    const p = wp('upperarm_' + s), sx = s === 'l' ? 1 : -1;
    attachWorld(root, meshOf([part(new THREE.SphereGeometry(0.12, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), steel, M(0, 0, 0, 0, 0, -sx * 0.5)), part(new THREE.BoxGeometry(0.2, 0.03, 0.2), trim, M(0, 0.01, 0))]), 'upperarm_' + s, new THREE.Vector3(p.x + sx * 0.03, p.y + 0.06, p.z));
  }
  // Shield on the left forearm (character's left is +X; face points outward).
  const la = wp('lowerarm_l'), lh = wp('hand_l'), mid = la.clone().lerp(lh, 0.5);
  const sw = duke ? 0.72 : 0.58, shH = duke ? 0.9 : 0.7;
  const shield = [part(new THREE.BoxGeometry(0.06, shH, sw), steel), part(new THREE.BoxGeometry(0.07, shH * 0.86, sw * 0.8), trim, M(0.01)),
    part(new THREE.BoxGeometry(0.08, shH * 0.5, 0.08), duke ? gold : steel, M(0.02)), part(new THREE.BoxGeometry(0.08, 0.08, sw * 0.5), duke ? gold : steel, M(0.02, 0.05))];
  const shieldGlow = duke ? [] : [part(new THREE.BoxGeometry(0.085, 0.06, 0.06), MAGENTA, M(0.03, 0.05))];
  attachWorld(root, meshOf(shield, shieldGlow), 'lowerarm_l', new THREE.Vector3(mid.x + 0.12, mid.y, mid.z + 0.06), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.25, 0)));
  // Sword in the right hand (same hand-bone space as Jasper's blade).
  const len = duke ? 1.25 : 0.95;
  const blade = [part(new THREE.BoxGeometry(0.014, 0.065, len), 0xdde4ef, M(0, 0, 0.1 + len / 2)), part(new THREE.BoxGeometry(0.05, duke ? 0.3 : 0.22, 0.035), duke ? gold : dark, M(0, 0, 0.085)),
    part(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), dark, M(0, 0, -0.03, Math.PI / 2)), part(new THREE.SphereGeometry(0.035, 8, 6), duke ? gold : steel, M(0, 0, -0.15))];
  const sword = meshOf(blade, [part(new THREE.BoxGeometry(0.018, 0.012, len * 0.9), duke ? 0xffd36b : MAGENTA, M(0, 0.034, 0.1 + len * 0.48))]);
  sword.position.set(-0.035, 0.095, 0); findBone(root, 'hand_r').add(sword);
  if (duke) {
    // Royal cape.
    const sp = wp('spine_03');
    const capeG = new THREE.PlaneGeometry(0.7, 1.25, 1, 4); capeG.translate(0, -0.62, 0);
    const p = capeG.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow(Math.max(0, -p.getY(i)), 1.4) * 0.18);
    const cape = new THREE.Mesh(capeG, new THREE.MeshStandardMaterial({ color: 0x9e1f2c, roughness: 0.9, side: THREE.DoubleSide }));
    cape.castShadow = DETAIL;
    attachWorld(root, cape, 'spine_03', new THREE.Vector3(sp.x, sp.y + 0.22, sp.z - 0.16));
  }
  mixer.stopAllAction(); mixer.uncacheRoot(root);
  return root;
}

// One animated knight (Copy Guard or Sir Duplicate and his copies).
export class KnightBody {
  constructor(kind = 'guard', scale = 1) {
    this.root = skClone(TEMPL[kind]); this.root.scale.setScalar(scale);
    this.root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
  }
  action(name) { return (this.actions[name] ||= this.mixer.clipAction(TEMPL.clips[name])); }
  play(name, { fade = 0.18, ts = 1, once = false } = {}) {
    const a = this.action(name);
    if (this.cur === a && !once) { a.timeScale = ts; return a; }
    a.reset(); a.timeScale = ts; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.play();
    if (this.cur && this.cur !== a) this.cur.crossFadeTo(a, fade, false);
    this.cur = a; return a;
  }
  // Show exactly the frame of another character's animation (used by the mirror copies).
  mirror(name, time) {
    const a = this.action(name);
    if (this.cur !== a) { this.mixer.stopAllAction(); a.reset(); a.play(); this.cur = a; }
    a.time = time; a.timeScale = 0; a.weight = 1;
  }
  update(dt) { this.mixer.update(dt); }
}
export function hasClip(name) { return !!TEMPL.clips?.[name]; }

// Ground decals for telegraphs.
export function arcDecal(radius, angle, color = 0xff3b3b) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 24, Math.PI / 2 - angle / 2, angle), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.visible = false; return m;
}

const iceMat = new THREE.MeshStandardMaterial({ color: 0x9feeff, transparent: true, opacity: 0.4, emissive: CYAN, emissiveIntensity: 0.6, depthWrite: false });
const starMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
const BLOB_GEO = new THREE.CircleGeometry(1, 16), BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

// ---------------------------------------------------------------- Copy Guard
// Blocks hits from the front with its shield. Attack from behind, use a HEAVY attack to break the
// guard, or PATCH it to drop the shield.
export class CopyGuard {
  constructor(scene, home, effects, level) {
    this.scene = scene; this.home = home.clone(); this.effects = effects;
    const L = Math.max(10, level);
    this.name = 'COPY GUARD'; this.radius = 0.55; this.isGuard = true; this.glitched = false;
    this.maxHp = Math.round(110 + 16 * L); this.dmg = Math.round(16 + 2.3 * L); this.xp = Math.round(45 + 5 * L); this.lootMul = 2.2;
    this.mat = { opacity: 1 };
    this.group = new THREE.Group(); scene.add(this.group);
    this.body = new KnightBody('guard'); this.group.add(this.body.root);
    if (!DETAIL) { const b = new THREE.Mesh(BLOB_GEO, BLOB_MAT); b.rotation.x = -Math.PI / 2; b.position.y = 0.04; b.scale.setScalar(0.8); this.group.add(b); }
    this.arc = arcDecal(2.9, 1.6); this.group.add(this.arc);
    this.ice = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), iceMat); this.ice.position.y = 0.95; this.ice.scale.y = 1.35; this.ice.visible = false; this.group.add(this.ice);
    this.tagOpen = makeTag('SHIELD DOWN', '#29e6ff'); this.tagOpen.position.y = 2.25; this.tagOpen.visible = false; this.group.add(this.tagOpen);
    this.stars = new THREE.Group();
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), starMat); st.userData.a = i / 3 * Math.PI * 2; this.stars.add(st); }
    this.stars.position.y = 2.1; this.stars.visible = false; this.group.add(this.stars);
    this.patchMsg = 'SHIELD BROKEN!\nIt is wide open - attack!';
    this.spawn();
  }

  spawn() {
    this.hp = this.maxHp; this.dead = false; this.gone = false; this.frozen = 0; this.stunned = 0; this.patchMult = 2; this.shieldDown = 0;
    this.pos = this.home.clone(); this.knock = new THREE.Vector3(); this.facing = Math.random() * Math.PI * 2;
    this.state = 'idle'; this.stateT = 0; this.attackCd = 1 + Math.random() * 2; this.blocks = 0; this.alert = false; this.deathT = 0; this.hitFlash = 0;
    this.wander = this.home.clone(); this.group.visible = true; this.group.scale.setScalar(1); this.arc.visible = false; this.ice.visible = false;
    this.body.play('Sword_Idle');
  }

  get alive() { return !this.dead; }
  get glitchedActive() { return false; }
  get patchable() { return !this.dead && this.shieldDown <= 0; }
  get shieldUp() { return this.shieldDown <= 0 && this.frozen <= 0 && this.stunned <= 0 && this.state !== 'recover' && this.state !== 'swing'; }

  takeHit(amount, fromPos, opts = {}) {
    if (this.dead) return 0;
    let dmg = amount;
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const to = fromPos.clone().sub(this.pos).setY(0).normalize();
    const front = fwd.dot(to) > 0.35;
    if (this.frozen > 0) dmg = Math.round(amount * this.patchMult);
    else if (front && this.shieldUp) {
      if (opts.heavy) { // GUARD BREAK
        this.shieldDown = 2.5; this.stunned = 1.1; this.state = 'idle'; this.arc.visible = false; dmg = Math.round(amount * 0.6);
        sfx('shatter', this.pos); this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(fwd, 0.5), 16, [2, 0], 5);
        this.onGuardBreak?.(this);
      } else {
        dmg = Math.max(1, Math.round(amount * 0.12)); this.blocks++;
        sfx('block', this.pos); this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(fwd, 0.5), 6, [2], 3);
        this.onBlocked?.(this);
        if (this.blocks >= 3 && this.state !== 'windup') { this.blocks = 0; this.attackCd = 0; } // counter-attack after a few blocked hits
      }
    }
    this.hp -= dmg; this.hitFlash = 0.15; this.alert = true;
    this.knock.copy(this.pos.clone().sub(fromPos).setY(0).normalize()).multiplyScalar(this.frozen > 0 ? 0 : front && this.shieldUp ? 1.5 : 4);
    if (this.hp <= 0) {
      this.dead = true; this.deathT = 0; this.respawnT = 30; this.arc.visible = false; this.ice.visible = false; this.tagOpen.visible = false;
      this.body.play('Death01', { once: true, fade: 0.1 });
      this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 22, [0, 1, 2], 5); sfx('enemyDie', this.pos);
    }
    return dmg;
  }

  patch(bonus = 0) {
    if (!this.patchable) return false;
    this.shieldDown = 5 + bonus; this.frozen = 2 + bonus * 0.5; this.patchMult = 2;
    this.state = 'idle'; this.arc.visible = false; this.ice.visible = true; this.tagOpen.visible = true;
    return true;
  }

  stun(t, fromPos) {
    if (this.dead) return;
    this.stunned = Math.max(this.stunned, t); this.state = 'idle'; this.arc.visible = false;
    this.knock.copy(this.pos.clone().sub(fromPos).setY(0).normalize()).multiplyScalar(6);
  }

  update(dt, t, player, world) {
    if (this.dead) {
      this.deathT += dt;
      if (this.deathT < 1.2) this.body.update(dt);
      const k = Math.max(0, 1 - Math.max(0, this.deathT - 0.9) / 0.5);
      this.group.scale.setScalar(Math.max(0.01, k));
      if (k <= 0) this.group.visible = false;
      if (this.noRespawn && this.deathT > 1.5) { this.gone = true; return null; }
      this.respawnT -= dt;
      if (this.respawnT <= 0 && !this.holdRespawn && player.pos.distanceTo(this.home) > 26) this.spawn();
      return null;
    }
    const near = player.pos.distanceTo(this.pos) < 36;
    this.group.visible = near;
    if (!near && !this.alert) return null;
    this.stateT += dt; this.attackCd -= dt;
    if (this.frozen > 0) { this.frozen -= dt; if (this.frozen <= 0) this.ice.visible = false; }
    if (this.shieldDown > 0) { this.shieldDown -= dt; if (this.shieldDown <= 0) this.tagOpen.visible = false; }
    this.stars.visible = this.stunned > 0;
    if (this.stunned > 0) { this.stunned -= dt; this.stars.children.forEach(st => { const a = st.userData.a + t * 5; st.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45); }); }
    let attack = null, speed = 0;
    const toP = player.pos.clone().sub(this.pos).setY(0), dist = toP.length();
    if (dist < 13 && player.alive) this.alert = true;
    if (!player.alive || dist > 28) this.alert = false;
    const busy = this.frozen > 0 || this.stunned > 0;
    const turn = (target, rate) => { let d = target - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); this.facing += Math.sign(d) * Math.min(Math.abs(d), rate * dt); };
    if (busy) { this.state = 'idle'; this.arc.visible = false; }
    else if (this.state === 'windup') {
      this.arc.visible = true; this.arc.material.opacity = 0.25 + Math.sin(this.stateT * 28) * 0.15;
      turn(Math.atan2(toP.x, toP.z), 1.2);
      if (this.stateT > 0.6) { this.state = 'swing'; this.stateT = 0; this.hit = false; this.arc.visible = false; this.body.play('Sword_Regular_A', { once: true, ts: 1.25, fade: 0.08 }); sfx('swing', this.pos); }
    } else if (this.state === 'swing') {
      if (!this.hit && this.stateT > 0.22) {
        this.hit = true;
        const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
        if (dist < 3.0 && fwd.dot(toP.clone().normalize()) > 0.3) attack = { damage: this.dmg, from: this.pos.clone(), enemy: this, direct: true };
        this.effects.slash(this.pos, this.facing, 0xff3b3b, false);
      }
      if (this.stateT > 0.55) { this.state = 'recover'; this.stateT = 0; this.body.play('Sword_Idle', { fade: 0.25 }); }
    } else if (this.state === 'recover') {
      // Shield lowered: the opening to punish.
      if (this.stateT > 0.8) { this.state = 'idle'; this.attackCd = 1.6 + Math.random() * 1.2; }
    } else if (this.alert) {
      turn(Math.atan2(toP.x, toP.z), 2.3);
      if (dist > 2.2) { this.pos.addScaledVector(toP.clone().normalize(), 2.9 * dt); speed = 2.9; }
      if (this.attackCd <= 0 && dist < 3.0) { this.state = 'windup'; this.stateT = 0; sfx('growl', this.pos, 0.6); this.body.play('Sword_Block', { fade: 0.12 }); }
    } else {
      if (this.pos.distanceTo(this.wander) < 1) this.wander.set(this.home.x + (Math.random() - 0.5) * 8, 0, this.home.z + (Math.random() - 0.5) * 8);
      const to = this.wander.clone().sub(this.pos).setY(0);
      if (to.lengthSq() > 0.1) { this.pos.addScaledVector(to.normalize(), 1.4 * dt); speed = 1.4; turn(Math.atan2(to.x, to.z), 3); }
    }
    if (this.state !== 'windup' && this.state !== 'swing') this.body.play(busy ? 'Hit_Chest' : speed > 2 ? 'Jog_Fwd_Loop' : speed > 0 ? 'Walk_Loop' : 'Sword_Idle', { fade: 0.2, ts: speed > 2 ? 0.8 : 1 });
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, this.radius);
    this.body.update(busy ? dt * 0.3 : dt);
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z), this.pos.z);
    this.group.rotation.y = this.facing;
    this.hitFlash -= dt; this.body.root.scale.setScalar(this.hitFlash > 0 ? 1.04 : 1);
    return attack;
  }
}

// ---------------------------------------------------------------- Error Mage
// A floating robe with a hole where its face should be. Fires slow glitch orbs, raises glitch walls,
// and blinks away (not often) when Jasper gets close. GLITCHED: Patch it first.
let MAGE_TEMPLATE = null;
function buildMage() {
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });
  const glow = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, flatShading: true });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const add = (g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, p = body) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; p.add(o); return o; };
  const robe = mat(0x2b2146), robe2 = mat(0x3d2f63), voidM = mat(0x05030a), gold = mat(0xd9a84a, { metalness: 0.6, roughness: 0.4 });
  add(new THREE.ConeGeometry(0.55, 1.5, 7, 1, true), robe, 0, 0.75, 0);
  add(new THREE.CylinderGeometry(0.56, 0.6, 0.12, 7), robe2, 0, 0.06, 0);
  add(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 7), glow(MAGENTA), 0, 0.01, 0);
  add(new THREE.BoxGeometry(0.62, 0.2, 0.34), robe2, 0, 1.28, 0);
  add(new THREE.SphereGeometry(0.3, 8, 6), robe, 0, 1.55, -0.02);
  add(new THREE.ConeGeometry(0.22, 0.4, 6), robe, 0, 1.86, -0.08, -0.4);
  add(new THREE.CircleGeometry(0.18, 10), voidM, 0, 1.53, 0.24);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.04, 0.02), glow(MAGENTA), sx * 0.07, 1.56, 0.26);
  add(new THREE.BoxGeometry(0.06, 0.3, 0.06), gold, 0, 1.15, 0.18);
  for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.14, 0.42, 6), robe2, sx * 0.4, 1.12, 0.06, 0, 0, sx * 0.5);
  // Staff with a crystal.
  const staff = new THREE.Group(); staff.position.set(0.5, 0.95, 0.15); body.add(staff);
  add(new THREE.CylinderGeometry(0.025, 0.03, 1.6, 6), mat(0x4a3424), 0, 0, 0, 0, 0, 0, staff);
  const orb = add(new THREE.OctahedronGeometry(0.13), glow(MAGENTA), 0, 0.92, 0, 0, 0, 0, staff);
  const bits = new THREE.Group(); bits.position.y = 1.1; body.add(bits);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; add(new THREE.BoxGeometry(0.08, 0.08, 0.08), glow(i % 2 ? CYAN : MAGENTA), Math.cos(a) * 0.7, Math.sin(i) * 0.2, Math.sin(a) * 0.7, 0, 0, 0, bits); }
  orb.userData.keep = true;
  return { root, body, bits, orb };
}
function mageModel() {
  if (!MAGE_TEMPLATE) { const m = buildMage(); bake(m.root, [m.body, m.bits]); MAGE_TEMPLATE = m; }
  const root = MAGE_TEMPLATE.root.clone(true), body = root.children[0];
  const bits = body.children[MAGE_TEMPLATE.body.children.indexOf(MAGE_TEMPLATE.bits)];
  let orb = null; body.traverse(o => { if (o.isMesh && o.geometry.type === 'OctahedronGeometry' && !orb) { o.material = o.material.clone(); orb = o; } });
  return { root, body, bits, orb };
}
const orbGeo = new THREE.IcosahedronGeometry(0.22, 0), orbMat = new THREE.MeshBasicMaterial({ color: MAGENTA });
const wallMat = new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });

export class ErrorMage extends Enemy2 {
  constructor(scene, home, effects, opts = {}) {
    super(scene, home, effects, { ...opts, glitched: true, radius: 0.55 });
    this.name = 'ERROR MAGE';
    const L = Math.max(10, this.level);
    this.maxHp = Math.round(70 + 10 * L); this.dmg = Math.round(14 + 2 * L); this.xp = Math.round(50 + 5 * L); this.knockPower = 2.5;
    this.m = mageModel(); this.group.add(this.m.root);
    this.initCommon(2.0);
    this.orbs = []; this.walls = [];
    this.spawn();
  }
  spawn() {
    this.spawnCommon();
    this.state = 'idle'; this.stateT = 0; this.castCd = 2 + Math.random() * 2; this.blinkCd = 3; this.next = Math.random() < 0.5 ? 'volley' : 'wall';
    this.wander = this.home.clone();
  }
  onStun() { this.state = 'idle'; }
  onPatch() { this.state = 'idle'; }

  #blink(player, world) {
    this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 16, [1, 0], 5); sfx('teleport', this.pos);
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2, p = player.pos.clone().add(new THREE.Vector3(Math.cos(a) * 10, 0, Math.sin(a) * 10));
      const q = p.clone(); world.resolve(q, this.radius);
      if (q.distanceTo(p) < 0.5 && q.distanceTo(this.home) < 22) { this.pos.copy(q); break; }
    }
    this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 16, [1, 0], 5);
  }

  #wall(player, world) {
    const dir = player.pos.clone().sub(this.pos).setY(0), d = dir.length(); dir.normalize();
    const c = this.pos.clone().addScaledVector(dir, Math.max(2.5, d * 0.5));
    const ry = Math.atan2(dir.x, dir.z) + Math.PI / 2;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), wallMat); mesh.position.set(c.x, 1.5, c.z); mesh.rotation.y = ry; this.scene.add(mesh);
    const col = { box: true, x: c.x, z: c.z, hx: 3, hz: 0.25, ry: ry, glitch: true };
    world.colliders.push(col);
    this.walls.push({ mesh, col, t: 5, world });
    sfx('glitchBig', c, 0.5);
  }

  update(dt, t, player, world) {
    // Orbs and walls live on even if the mage dies.
    let attack = null;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i]; o.t -= dt; o.mesh.position.addScaledVector(o.v, dt); o.mesh.rotation.x += dt * 6;
      if (player.alive && o.mesh.position.distanceTo(player.pos.clone().setY(o.mesh.position.y)) < 0.8) { attack = { damage: this.dmg, from: o.mesh.position.clone(), enemy: this, direct: true }; o.t = 0; this.effects.burst(o.mesh.position.clone(), 8, [1], 3); }
      if (o.t <= 0) { this.scene.remove(o.mesh); this.orbs.splice(i, 1); }
    }
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i]; w.t -= dt; w.mesh.material.opacity = 0.3 + Math.sin(t * 20) * 0.08;
      if (w.t <= 0) { this.scene.remove(w.mesh); const k = w.world.colliders.indexOf(w.col); if (k >= 0) w.world.colliders.splice(k, 1); this.walls.splice(i, 1); }
    }
    if (this.updateCommon(dt, t, player, world)) return attack;
    this.stateT += dt; this.castCd -= dt; this.blinkCd -= dt;
    const toP = player.pos.clone().sub(this.pos).setY(0), dist = toP.length();
    if (dist < 16 && player.alive) this.alert = true;
    if (!player.alive || dist > 28) this.alert = false;
    const busy = this.frozen > 0 || this.stunned > 0;
    const m = this.m;
    if (busy) { this.state = 'idle'; m.orb.material.emissiveIntensity = 1.2; }
    else if (this.state === 'charge') {
      m.orb.material.emissiveIntensity = 1.6 + this.stateT * 6; m.orb.scale.setScalar(1 + this.stateT * 1.2);
      this.facing = Math.atan2(toP.x, toP.z);
      if (this.stateT > 0.8) {
        m.orb.scale.setScalar(1); m.orb.material.emissiveIntensity = 1.6;
        if (this.next === 'volley') {
          const base = Math.atan2(toP.x, toP.z);
          for (const da of [-0.22, 0, 0.22]) {
            const mesh = new THREE.Mesh(orbGeo, orbMat); mesh.position.copy(this.pos).add(new THREE.Vector3(0, 1.3, 0)); this.scene.add(mesh);
            this.orbs.push({ mesh, v: new THREE.Vector3(Math.sin(base + da), 0, Math.cos(base + da)).multiplyScalar(8.5), t: 2.6 });
          }
          sfx('tvZap', this.pos);
        } else this.#wall(player, world);
        this.next = this.next === 'volley' ? (Math.random() < 0.6 ? 'wall' : 'volley') : 'volley';
        this.state = 'idle'; this.castCd = 2.8 + Math.random() * 1.4;
      }
    } else if (this.state === 'blinkWarn') {
      m.root.visible = Math.sin(this.stateT * 40) > -0.3;
      if (this.stateT > 0.6) { m.root.visible = true; this.#blink(player, world); this.state = 'idle'; this.blinkCd = 9; }
    } else if (this.alert) {
      this.facing = Math.atan2(toP.x, toP.z);
      const want = dist < 7 ? -1 : dist > 12 ? 1 : 0;
      if (want) this.pos.addScaledVector(toP.clone().normalize(), want * 2.4 * dt);
      if (dist < 3.2 && this.blinkCd <= 0) { this.state = 'blinkWarn'; this.stateT = 0; }
      else if (this.castCd <= 0 && dist < 16) { this.state = 'charge'; this.stateT = 0; sfx('tvCharge', this.pos); }
    } else {
      if (this.pos.distanceTo(this.wander) < 1) this.wander.set(this.home.x + (Math.random() - 0.5) * 8, 0, this.home.z + (Math.random() - 0.5) * 8);
      const to = this.wander.clone().sub(this.pos).setY(0);
      if (to.lengthSq() > 0.1) { this.pos.addScaledVector(to.normalize(), 1.2 * dt); this.facing = Math.atan2(to.x, to.z); }
    }
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, this.radius);
    m.body.position.y = 0.35 + Math.sin(t * 2 + this.home.x) * 0.12;
    m.bits.rotation.y += dt * 2;
    if (this.glitchedActive) m.root.position.x = Math.sin(t * 37 + this.home.x) > 0.88 ? (Math.random() - 0.5) * 0.2 : 0; else m.root.position.x = 0;
    m.root.scale.setScalar(this.hitFlash > 0 ? 1.08 : 1);
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z), this.pos.z);
    this.group.rotation.y = this.facing;
    return attack;
  }
}

// Zone 3 placement. Level follows Jasper (the Capital is tuned for 10-15 and keeps growing).
export function spawnZone3(scene, effects, level) {
  const L = Math.max(10, level), list = [];
  for (const [x, z] of [[0, 44], [3, 30], [-30, 6], [-44, 7], [30, 5], [45, 6], [-10, -12], [14, -9], [9, -1], [-6, 21]]) list.push(new CopyGuard(scene, new THREE.Vector3(x, 0, z), effects, L));
  for (const [x, z] of [[-52, 6], [52, 5], [-3, -14], [5, 25]]) list.push(new ErrorMage(scene, new THREE.Vector3(x, 0, z), effects, { level: L }));
  return list;
}
