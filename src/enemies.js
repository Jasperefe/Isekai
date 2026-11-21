// Placeholder enemies for the prototype: normal slimes and "glitched" slimes.
// Glitched slimes take reduced damage until Jasper patches them.
import * as THREE from 'three';
import { heightAt } from './world.js?v=6';

const SLIME_GEO = new THREE.SphereGeometry(0.55, 24, 16);
SLIME_GEO.translate(0, 0.55, 0);
const EYE_GEO = new THREE.SphereGeometry(0.075, 10, 8);
const PUPIL_GEO = new THREE.SphereGeometry(0.04, 8, 6);
const SHARD_GEO = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const shardMatA = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
const shardMatB = new THREE.MeshBasicMaterial({ color: 0x29e6ff });
// Floating "GLITCHED" tag above glitched slimes.
function makeTag(text = 'GLITCHED', color = '#ff2bd6') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(20,0,30,0.65)'; g.fillRect(8, 10, 240, 44);
  g.fillStyle = color; g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(1.3, 0.33, 1); sp.position.y = 1.75; sp.renderOrder = 10;
  return sp;
}
const starMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
const STAR_GEO = new THREE.OctahedronGeometry(0.08);

const iceMat = new THREE.MeshStandardMaterial({ color: 0x9feeff, transparent: true, opacity: 0.45, emissive: 0x29e6ff, emissiveIntensity: 0.6 });

export class Slime {
  constructor(scene, home, glitched) {
    this.scene = scene; this.home = home.clone(); this.glitched = glitched;
    this.maxHp = glitched ? 70 : 40;
    this.mat = new THREE.MeshStandardMaterial({
      color: glitched ? 0x7a3cff : 0x5fd35a, roughness: 0.25, transparent: true, opacity: 0.92,
      emissive: glitched ? 0x3a0f80 : 0x0c3a0c, emissiveIntensity: 0.6,
    });
    this.group = new THREE.Group();
    this.body = new THREE.Mesh(SLIME_GEO, this.mat); this.body.castShadow = true;
    this.group.add(this.body);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(EYE_GEO, eyeMat); e.position.set(sx * 0.18, 0.72, 0.43); this.body.add(e);
      const p = new THREE.Mesh(PUPIL_GEO, pupilMat); p.position.set(sx * 0.18, 0.72, 0.5); this.body.add(p);
    }
    if (glitched) {
      this.shards = [];
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(SHARD_GEO, i % 2 ? shardMatA : shardMatB);
        s.userData.a = i / 5 * Math.PI * 2; this.group.add(s); this.shards.push(s);
      }
      this.ice = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), iceMat);
      this.ice.position.y = 0.55; this.ice.visible = false; this.group.add(this.ice);
      this.tag = makeTag(); this.group.add(this.tag);
      this.tagFixed = makeTag('x2 DAMAGE', '#29e6ff'); this.tagFixed.visible = false; this.group.add(this.tagFixed);
    }
    // Stun stars (shown after a parry).
    this.stars = new THREE.Group();
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(STAR_GEO, starMat); st.userData.a = i / 3 * Math.PI * 2; this.stars.add(st); }
    this.stars.position.y = 1.35; this.stars.visible = false; this.group.add(this.stars);
    scene.add(this.group);
    this.spawn();
  }

  spawn() {
    this.hp = this.maxHp; this.dead = false; this.patched = false; this.frozen = 0; this.stunned = 0; this.patchMult = 2;
    if (this.tag) this.tag.visible = true;
    if (this.tagFixed) this.tagFixed.visible = false;
    this.pos = this.home.clone(); this.vel = new THREE.Vector3(); this.facing = Math.random() * Math.PI * 2;
    this.hopT = Math.random(); this.attackCd = 0; this.windup = 0; this.hitFlash = 0; this.deathT = 0; this.knock = new THREE.Vector3();
    this.group.visible = true; this.group.scale.setScalar(1);
    this.mat.color.set(this.glitched ? 0x7a3cff : 0x5fd35a);
    if (this.shards) this.shards.forEach(s => (s.visible = true));
    if (this.ice) this.ice.visible = false;
    this.wander = this.home.clone();
  }

  get alive() { return !this.dead; }
  get glitchedActive() { return this.glitched && !this.patched; }

  // Returns the damage actually dealt.
  takeHit(amount, fromPos, opts = {}) {
    if (this.dead) return 0;
    let dmg = amount;
    if (this.glitchedActive && this.frozen <= 0 && !opts.pierce) dmg = Math.round(amount * 0.35); // resists until patched
    if (this.frozen > 0) dmg = Math.round(amount * this.patchMult);                               // patched + frozen
    this.hp -= dmg; this.hitFlash = 0.15;
    const away = this.pos.clone().sub(fromPos).setY(0).normalize();
    this.knock.copy(away).multiplyScalar(this.frozen > 0 ? 0 : 6);
    if (this.hp <= 0) { this.dead = true; this.deathT = 0; this.respawnT = 7; }
    return dmg;
  }

  // Fix the glitch: no more resistance, frozen for 3s, double damage while frozen.
  patch() {
    if (this.dead || !this.glitchedActive) return false;
    this.patched = true; this.frozen = 3; this.patchMult = 2; this.windup = 0;
    this.mat.color.set(0x5fd35a);
    if (this.shards) this.shards.forEach(s => (s.visible = false));
    if (this.ice) this.ice.visible = true;
    if (this.tag) this.tag.visible = false;
    if (this.tagFixed) this.tagFixed.visible = true;
    return true;
  }

  #ensureIce() {
    if (this.ice) return;
    this.ice = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), iceMat);
    this.ice.position.y = 0.55; this.ice.visible = false; this.group.add(this.ice);
  }

  stun(t, fromPos) {
    if (this.dead) return;
    this.stunned = Math.max(this.stunned, t);
    const away = this.pos.clone().sub(fromPos).setY(0).normalize();
    this.knock.copy(away).multiplyScalar(9);
  }

  update(dt, t, player, world) {
    if (this.dead) {
      if (this.noRespawn && this.deathT > 1) { this.group.visible = false; this.gone = true; return null; }
      this.deathT += dt;
      const k = Math.max(0, 1 - this.deathT / 0.35);
      this.group.scale.set(1 + (1 - k) * 0.8, k, 1 + (1 - k) * 0.8);
      if (k <= 0) this.group.visible = false;
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.spawn();
      return null;
    }
    let attack = null;
    this.stars.visible = this.stunned > 0;
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.stars.children.forEach(st => { const a = st.userData.a + t * 5; st.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45); });
    }
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0 && this.ice) this.ice.visible = false;
      if (this.frozen <= 0 && this.tagFixed) this.tagFixed.visible = false;
    } else if (this.stunned > 0) {
      // Dazed: no movement or attacks.
    } else {
      const toP = player.pos.clone().sub(this.pos).setY(0);
      const dist = toP.length();
      const chase = player.alive && dist < 13;
      let target = null;
      if (chase) target = player.pos;
      else {
        if (this.pos.distanceTo(this.wander) < 1) this.wander.set(this.home.x + (Math.random() - 0.5) * 8, 0, this.home.z + (Math.random() - 0.5) * 8);
        target = this.wander;
      }
      const dir = target.clone().sub(this.pos).setY(0);
      if (dir.lengthSq() > 0.01) this.facing = Math.atan2(dir.x, dir.z);
      this.attackCd -= dt;
      if (this.windup > 0) {
        // Telegraphed attack: crouch, then lunge.
        this.windup -= dt;
        if (this.windup <= 0) {
          this.attackCd = 1.5;
          this.knock.copy(dir.normalize()).multiplyScalar(5); // small lunge toward the player
          if (dist < 2.0) attack = { damage: this.glitchedActive ? 14 : 9, from: this.pos.clone(), enemy: this };
        }
      } else {
        // Hop movement.
        this.hopT += dt * (chase ? 1.8 : 1.1);
        const hopPhase = this.hopT % 1;
        const speed = chase ? 3.4 : 1.4;
        if (hopPhase < 0.55 && dir.lengthSq() > (chase ? 1.4 : 0.2)) this.pos.addScaledVector(dir.clone().normalize(), speed * dt * 1.6);
        if (chase && dist < 1.7 && this.attackCd <= 0) this.windup = 0.5;
      }
    }
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, 0.5);
    const hop = this.frozen > 0 || this.stunned > 0 ? 0 : Math.max(0, Math.sin((this.hopT % 1) * Math.PI)) * 0.55;
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z) + hop, this.pos.z);
    this.group.rotation.y = this.facing;
    const squash = this.frozen > 0 ? 1 : this.windup > 0 ? 0.7 : 1 + Math.sin(this.hopT * Math.PI * 2) * 0.12;
    this.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

    // Hit flash and glitch flicker.
    this.hitFlash -= dt;
    if (this.hitFlash > 0) this.mat.emissive.set(0xffffff), (this.mat.emissiveIntensity = 1.2);
    else if (this.windup > 0) { this.mat.emissive.set(0xff7a1a); this.mat.emissiveIntensity = 1.3; }
    else if (this.glitchedActive) {
      const flick = Math.sin(t * 37 + this.home.x) > 0.85;
      this.mat.emissive.set(flick ? 0xff2bd6 : 0x3a0f80); this.mat.emissiveIntensity = flick ? 1.4 : 0.6;
      this.body.position.x = flick ? (Math.random() - 0.5) * 0.15 : 0;
    } else { this.mat.emissive.set(0x0c3a0c); this.mat.emissiveIntensity = 0.5; this.body.position.x = 0; }
    if (this.shards && this.glitchedActive) this.shards.forEach((s, i) => {
      const a = s.userData.a + t * 1.6;
      s.position.set(Math.cos(a) * 0.85, 0.6 + Math.sin(t * 3 + i) * 0.3, Math.sin(a) * 0.85);
      s.rotation.set(t * 2 + i, t * 3, 0);
    });
    return attack;
  }
}

export function spawnSlimes(scene, center) {
  const spots = [
    [-6, 3, false], [5, 5, false], [8, -4, false], [-3, -7, true], [0, 9, false], [12, 6, true], [-10, -2, false],
  ];
  return spots.map(([x, z, g]) => new Slime(scene, new THREE.Vector3(center.x + x, 0, center.z + z), g));
}
