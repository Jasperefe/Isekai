// Placeholder enemies for the prototype: normal slimes and "glitched" slimes.
// Glitched slimes take reduced damage until Jasper patches them.
import * as THREE from 'three';
import { heightAt } from './world.js';

const SLIME_GEO = new THREE.SphereGeometry(0.55, 24, 16);
SLIME_GEO.translate(0, 0.55, 0);
const EYE_GEO = new THREE.SphereGeometry(0.075, 10, 8);
const PUPIL_GEO = new THREE.SphereGeometry(0.04, 8, 6);
const SHARD_GEO = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const shardMatA = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
const shardMatB = new THREE.MeshBasicMaterial({ color: 0x29e6ff });
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
    }
    scene.add(this.group);
    this.spawn();
  }

  spawn() {
    this.hp = this.maxHp; this.dead = false; this.patched = false; this.frozen = 0;
    this.pos = this.home.clone(); this.vel = new THREE.Vector3(); this.facing = Math.random() * Math.PI * 2;
    this.hopT = Math.random(); this.attackCd = 0; this.hitFlash = 0; this.deathT = 0; this.knock = new THREE.Vector3();
    this.group.visible = true; this.group.scale.setScalar(1);
    this.mat.color.set(this.glitched ? 0x7a3cff : 0x5fd35a);
    if (this.shards) this.shards.forEach(s => (s.visible = true));
    if (this.ice) this.ice.visible = false;
    this.wander = this.home.clone();
  }

  get alive() { return !this.dead; }
  get glitchedActive() { return this.glitched && !this.patched; }

  // Returns the damage actually dealt.
  takeHit(amount, fromPos) {
    if (this.dead) return 0;
    let dmg = amount;
    if (this.glitchedActive && this.frozen <= 0) dmg = Math.round(amount * 0.35); // resists until patched
    if (this.frozen > 0) dmg = Math.round(amount * 2);                            // patched + frozen: double
    this.hp -= dmg; this.hitFlash = 0.15;
    const away = this.pos.clone().sub(fromPos).setY(0).normalize();
    this.knock.copy(away).multiplyScalar(this.frozen > 0 ? 0 : 6);
    if (this.hp <= 0) { this.dead = true; this.deathT = 0; this.respawnT = 7; }
    return dmg;
  }

  patch() {
    if (!this.glitchedActive || this.dead) return false;
    this.patched = true; this.frozen = 3;
    this.mat.color.set(0x5fd35a);
    if (this.shards) this.shards.forEach(s => (s.visible = false));
    if (this.ice) this.ice.visible = true;
    return true;
  }

  update(dt, t, player, world) {
    if (this.dead) {
      this.deathT += dt;
      const k = Math.max(0, 1 - this.deathT / 0.35);
      this.group.scale.set(1 + (1 - k) * 0.8, k, 1 + (1 - k) * 0.8);
      if (k <= 0) this.group.visible = false;
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.spawn();
      return null;
    }
    let attack = null;
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0 && this.ice) this.ice.visible = false;
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
      // Hop movement.
      this.hopT += dt * (chase ? 1.8 : 1.1);
      const hopPhase = this.hopT % 1;
      const speed = chase ? 3.4 : 1.4;
      if (hopPhase < 0.55 && dir.lengthSq() > (chase ? 1.4 : 0.2)) this.pos.addScaledVector(dir.normalize(), speed * dt * 1.6);
      // Contact attack.
      this.attackCd -= dt;
      if (chase && dist < 1.35 && this.attackCd <= 0) {
        this.attackCd = 1.3;
        attack = { damage: this.glitchedActive ? 14 : 9, from: this.pos.clone() };
      }
    }
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, 0.5);
    const hop = this.frozen > 0 ? 0 : Math.max(0, Math.sin((this.hopT % 1) * Math.PI)) * 0.55;
    this.group.position.set(this.pos.x, heightAt(this.pos.x, this.pos.z) + hop, this.pos.z);
    this.group.rotation.y = this.facing;
    const squash = this.frozen > 0 ? 1 : 1 + Math.sin(this.hopT * Math.PI * 2) * 0.12;
    this.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

    // Hit flash and glitch flicker.
    this.hitFlash -= dt;
    if (this.hitFlash > 0) this.mat.emissive.set(0xffffff), (this.mat.emissiveIntensity = 1.2);
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

export function spawnSlimes(scene) {
  const spots = [
    [8, 10, false], [-9, 12, false], [12, -6, false], [-14, -4, true], [4, -15, false],
    [-6, -18, true], [20, 8, false], [-20, 14, true],
  ];
  return spots.map(([x, z, g]) => new Slime(scene, new THREE.Vector3(x, 0, z), g));
}
