// Zone 4 enemies: PLACEHOLDER (grey test mannequins that T-pose and lunge) and MISSING TEXTURE
// (hopping magenta-checker cubes with teeth that leave pink error puddles).
import * as THREE from 'three';
import { sfx } from './audio.js?v=32';
import { Enemy2, makeTag } from './enemies2.js?v=32';
import { missingTex } from './world4.js?v=32';

const MAGENTA = 0xff2bd6;
function faceTag() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ff2bd6'; g.font = 'bold 54px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 32, 36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, transparent: true });
}
const FACE = faceTag();
const DUMMY = new THREE.MeshStandardMaterial({ color: 0xd8dbe4, roughness: 0.6, flatShading: true });

// ---------------------------------------------------------------- Placeholder
// Walks stiffly in a T-pose. Telegraphs (red lane) then lunges arms-first. Glitched variants copy
// Jasper's position a moment later (they appear where he WAS).
export class Placeholder extends Enemy2 {
  constructor(scene, home, effects, opts = {}) {
    super(scene, home, effects, { ...opts, radius: 0.5 });
    this.name = 'PLACEHOLDER';
    const L = Math.max(14, this.level);
    this.maxHp = Math.round((90 + 14 * L) * (this.glitched ? 1.25 : 1)); this.dmg = Math.round(16 + 2.4 * L); this.xp = Math.round(60 + 6 * L);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const add = (geo, x, y, z, p = body) => { const o = new THREE.Mesh(geo, DUMMY); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    add(new THREE.CapsuleGeometry(0.3, 0.68, 3, 8), 0, 1.22, 0);
    add(new THREE.SphereGeometry(0.25, 10, 8), 0, 1.95, 0);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), FACE); face.position.set(0, 1.95, 0.255); body.add(face);
    this.arms = [-1, 1].map(sx => { const a = new THREE.Group(); a.position.set(sx * 0.32, 1.55, 0); body.add(a); const m = add(new THREE.CapsuleGeometry(0.085, 0.6, 3, 6), sx * 0.38, 0, 0, a); m.rotation.z = Math.PI / 2; return a; });
    this.legs = [-1, 1].map(sx => { const l = new THREE.Group(); l.position.set(sx * 0.15, 0.85, 0); body.add(l); add(new THREE.CapsuleGeometry(0.1, 0.62, 3, 6), 0, -0.42, 0, l); return l; });
    this.m = { root, body }; this.group.add(root);
    this.lane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.35, depthWrite: false }));
    this.lane.geometry.rotateX(-Math.PI / 2); this.lane.geometry.translate(0, 0.06, 3); this.lane.visible = false; this.group.add(this.lane);
    this.initCommon(2.2);
    this.spawn();
  }
  spawn() { this.spawnCommon(); this.state = 'idle'; this.stateT = 0; this.cd = 1 + Math.random() * 2; this.wander = this.home.clone(); this.walkT = 0; this.lane.visible = false; }
  onStun() { this.state = 'idle'; this.lane.visible = false; }
  onPatch() { this.onStun(); }

  update(dt, t, player, world) {
    if (this.updateCommon(dt, t, player, world)) return null;
    this.stateT += dt; this.cd -= dt;
    let attack = null, speed = 0;
    const toP = player.pos.clone().sub(this.pos).setY(0), dist = toP.length();
    const sameLevel = Math.abs(player.pos.y - world.groundAt(this.pos.x, this.pos.z)) < 2;
    if (dist < 14 && player.alive && sameLevel) this.alert = true;
    if (!player.alive || dist > 26 || !sameLevel) this.alert = false;
    const busy = this.frozen > 0 || this.stunned > 0;
    if (busy) { this.state = 'idle'; this.lane.visible = false; }
    else if (this.state === 'wind') {
      this.lane.visible = true; this.lane.material.opacity = 0.25 + Math.sin(this.stateT * 28) * 0.15;
      if (this.stateT > 0.65) { this.state = 'lunge'; this.stateT = 0; this.hit = false; this.lane.visible = false; sfx('pounce', this.pos); }
    } else if (this.state === 'lunge') {
      const f = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.pos.addScaledVector(f, 12 * dt);
      if (!this.hit && player.pos.distanceTo(this.pos.clone().setY(player.pos.y)) < 1.3) { this.hit = true; attack = { damage: this.dmg, from: this.pos.clone(), enemy: this, direct: true }; }
      if (this.stateT > 0.42) { this.state = 'recover'; this.stateT = 0; }
    } else if (this.state === 'recover') {
      if (this.stateT > 0.9) { this.state = 'idle'; this.cd = 1.8 + Math.random() * 1.2; }
    } else if (this.alert) {
      this.facing = Math.atan2(toP.x, toP.z);
      if (dist > 3.2) { this.pos.addScaledVector(toP.clone().normalize(), 3.3 * dt); speed = 3.3; }
      if (this.cd <= 0 && dist < 6.5) {
        // Glitched ones blink to where Jasper was a moment ago, then lunge.
        if (this.glitchedActive && Math.random() < 0.5) {
          this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 10, [1, 0], 4); sfx('teleport', this.pos);
          this.pos.copy(player.pos).addScaledVector(toP.clone().normalize(), 4); world.resolve(this.pos, this.radius);
          this.facing = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        }
        this.state = 'wind'; this.stateT = 0;
      }
    } else {
      if (this.pos.distanceTo(this.wander) < 1) this.wander.set(this.home.x + (Math.random() - 0.5) * 8, this.home.y, this.home.z + (Math.random() - 0.5) * 8);
      const to = this.wander.clone().sub(this.pos).setY(0);
      if (to.lengthSq() > 0.1) { this.pos.addScaledVector(to.normalize(), 1.3 * dt); this.facing = Math.atan2(to.x, to.z); speed = 1.3; }
    }
    // Stiff walk: legs swing, arms stay out in a T.
    this.walkT += dt * speed * 2.2;
    const sw = speed > 0 ? Math.sin(this.walkT) * 0.6 : 0;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
    const reach = this.state === 'wind' || this.state === 'lunge' ? -1.3 : 0;
    for (const a of this.arms) a.rotation.y = reach * Math.sign(a.position.x) * -1;
    this.m.body.rotation.x = this.state === 'lunge' ? 0.4 : this.state === 'wind' ? -0.15 : 0;
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, this.radius); this.pos.y = world.groundAt(this.pos.x, this.pos.z);
    if (this.glitchedActive) this.m.root.position.x = Math.sin(t * 37 + this.home.x) > 0.9 ? (Math.random() - 0.5) * 0.25 : 0; else this.m.root.position.x = 0;
    this.m.root.scale.setScalar(this.hitFlash > 0 ? 1.06 : 1);
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z), this.pos.z);
    this.group.rotation.y = this.facing;
    return attack;
  }
}

// ---------------------------------------------------------------- Missing Texture
// Hops at Jasper. Every landing leaves a pink error puddle that hurts for a few seconds.
const puddleMat = new THREE.MeshBasicMaterial({ map: missingTex, transparent: true, opacity: 0.75, depthWrite: false });
export class MissingCube extends Enemy2 {
  constructor(scene, home, effects, opts = {}) {
    super(scene, home, effects, { ...opts, radius: 0.75 });
    this.name = 'MISSING TEXTURE';
    const L = Math.max(14, this.level);
    this.maxHp = Math.round(70 + 11 * L); this.dmg = Math.round(13 + 2 * L); this.xp = Math.round(50 + 5 * L);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshStandardMaterial({ map: missingTex, roughness: 0.5 })); cube.position.y = 0.7; cube.castShadow = true; body.add(cube);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.05), white); e.position.set(sx * 0.3, 0.95, 0.72); body.add(e); }
    for (let i = 0; i < 5; i++) { const tth = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), white); tth.rotation.x = Math.PI; tth.position.set(-0.4 + i * 0.2, 0.5, 0.72); body.add(tth); }
    this.m = { root, body }; this.group.add(root);
    this.initCommon(1.6);
    this.puddles = [];
    this.spawn();
  }
  spawn() { this.spawnCommon(); this.hopT = Math.random(); this.cd = 1; this.airY = 0; this.wander = this.home.clone(); }
  update(dt, t, player, world) {
    let attack = null;
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i]; p.t -= dt; p.mesh.material.opacity = Math.min(0.75, p.t);
      if (p.t > 0.3 && player.onGround && player.pos.distanceTo(p.mesh.position.clone().setY(player.pos.y)) < 1.2 && (this.puddleHitT || 0) <= 0) { attack = { damage: Math.round(this.dmg * 0.45), from: p.mesh.position.clone(), enemy: this, direct: true }; this.puddleHitT = 0.8; }
      if (p.t <= 0) { this.scene.remove(p.mesh); this.puddles.splice(i, 1); }
    }
    this.puddleHitT = (this.puddleHitT || 0) - dt;
    if (this.updateCommon(dt, t, player, world)) return attack;
    const toP = player.pos.clone().sub(this.pos).setY(0), dist = toP.length();
    const sameLevel = Math.abs(player.pos.y - world.groundAt(this.pos.x, this.pos.z)) < 2;
    if (dist < 13 && player.alive && sameLevel) this.alert = true;
    if (!player.alive || dist > 24 || !sameLevel) this.alert = false;
    const busy = this.frozen > 0 || this.stunned > 0;
    if (!busy) {
      const prev = this.hopT % 1;
      this.hopT += dt * (this.alert ? 1.25 : 0.7);
      const ph = this.hopT % 1;
      const target = this.alert ? player.pos : this.wander;
      const to = target.clone().sub(this.pos).setY(0);
      if (ph < 0.55 && to.length() > 0.8) { this.pos.addScaledVector(to.normalize(), (this.alert ? 5.2 : 1.8) * dt); this.facing = Math.atan2(to.x, to.z); }
      this.airY = ph < 0.55 ? Math.sin(ph / 0.55 * Math.PI) * (this.alert ? 1.6 : 0.6) : 0;
      if (ph < prev) { // landed
        if (this.alert) {
          sfx('slime', this.pos, 0.8);
          if (player.pos.distanceTo(this.pos.clone().setY(player.pos.y)) < 1.7) attack = attack || { damage: this.dmg, from: this.pos.clone(), enemy: this, direct: true };
          const mesh = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), puddleMat.clone()); mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z) + 0.05, this.pos.z); this.scene.add(mesh);
          this.puddles.push({ mesh, t: this.glitchedActive ? 4 : 2.5 });
        }
        if (!this.alert && this.pos.distanceTo(this.wander) < 1.2) this.wander.set(this.home.x + (Math.random() - 0.5) * 8, this.home.y, this.home.z + (Math.random() - 0.5) * 8);
      }
    } else this.airY = 0;
    const sq = 1 + (this.airY > 0 ? 0.12 : -0.12);
    this.m.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, this.radius); this.pos.y = world.groundAt(this.pos.x, this.pos.z);
    this.m.root.scale.setScalar(this.hitFlash > 0 ? 1.08 : 1);
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z) + this.airY, this.pos.z);
    this.group.rotation.y = this.facing;
    return attack;
  }
}

// Placement: the Placeholder town (island A) and the Asset Graveyard (island B).
export function spawnZone4(scene, effects, level) {
  const L = Math.max(14, level), list = [];
  for (const [x, z, g] of [[-6, 6, false], [6, 4, true], [0, -6, false], [-16, -2, false], [14, -2, true], [-4, -16, false]]) list.push(new Placeholder(scene, new THREE.Vector3(x, 0, z), effects, { level: L, glitched: g }));
  for (const [x, z] of [[-10, 14], [10, 12], [18, -12], [-22, -14]]) list.push(new MissingCube(scene, new THREE.Vector3(x, 0, z), effects, { level: L }));
  const B = { x: -78, z: -40 };
  for (const [x, z, g] of [[4, 6, true], [-6, -4, false], [8, -8, true], [-10, 8, false]]) list.push(new Placeholder(scene, new THREE.Vector3(B.x + x, 4, B.z + z), effects, { level: L, glitched: g }));
  for (const [x, z] of [[0, 0], [-4, 12], [12, 2]]) list.push(new MissingCube(scene, new THREE.Vector3(B.x + x, 4, B.z + z), effects, { level: L }));
  return list;
}
export { makeTag };
