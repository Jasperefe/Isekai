// Slime King (Unscaled): Zone 1 boss.
// - Hops after Jasper, telegraphs big jump slams with a red ring on the ground.
// - Summons minions at 66% and 33% HP.
// - Every so often his bug kicks in: he grows HUGE ("Unscaled") and takes almost no damage.
//   PATCH shrinks him back and leaves him stunned and taking double damage.
import * as THREE from 'three';
import { sfx } from './audio.js?v=18';

export class SlimeKing {
  constructor(scene, home, world, effects) {
    this.scene = scene; this.home = home.clone(); this.world = world; this.effects = effects;
    this.isBoss = true; this.glitched = true; this.radius = 1.6; this.name = 'SLIME KING';
    this.maxHp = 700; this.hp = this.maxHp;
    this.mat = new THREE.MeshStandardMaterial({ color: 0x47c94a, roughness: 0.2, transparent: true, opacity: 0.9, emissive: 0x0c3a0c, emissiveIntensity: 0.5 });
    this.group = new THREE.Group();
    const geo = new THREE.SphereGeometry(1, 32, 24); geo.translate(0, 1, 0);
    this.body = new THREE.Mesh(geo, this.mat); this.body.castShadow = true; this.group.add(this.body);
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff }), eyeB = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), eyeW); e.position.set(sx * 0.35, 1.3, 0.85); this.body.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeB); p.position.set(sx * 0.35, 1.3, 1.0); this.body.add(p);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), eyeB); brow.position.set(sx * 0.35, 1.52, 0.92); brow.rotation.z = sx * 0.4; this.body.add(brow);
    }
    // Crown.
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2c75c, metalness: 0.9, roughness: 0.25 });
    const crown = new THREE.Group();
    crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.25, 12, 1, true), gold));
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), gold); const a = i / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.45, 0.25, Math.sin(a) * 0.45); crown.add(sp); }
    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 1 })); jewel.position.set(0, 0.1, 0.48); crown.add(jewel);
    crown.position.y = 1.95; crown.rotation.z = 0.12; this.body.add(crown);
    // Glitch shards (visible while Unscaled).
    this.shards = [];
    const sm = [new THREE.MeshBasicMaterial({ color: 0xff2bd6 }), new THREE.MeshBasicMaterial({ color: 0x29e6ff })];
    for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), sm[i % 2]); s.visible = false; this.group.add(s); this.shards.push(s); }
    // Telegraph ring for slams.
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
    this.stars = new THREE.Group();
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0xffe28a })); st.userData.a = i / 4 * Math.PI * 2; this.stars.add(st); }
    this.stars.visible = false; this.group.add(this.stars);
    this.group.visible = false;
    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.hp = this.maxHp; this.dead = false; this.active = false; this.frozen = 0; this.stunned = 0; this.patchMult = 2;
    this.pos = this.home.clone(); this.knock = new THREE.Vector3(); this.facing = Math.PI / 2;
    this.state = 'idle'; this.stateT = 0; this.scale = 1.6; this.targetScale = 1.6; this.unscaled = false;
    this.hopT = 0; this.nextSpecial = 4; this.summoned = [false, false]; this.unscaledCount = 0; this.hitFlash = 0; this.deathT = 0;
    this.group.visible = false; this.ring.visible = false; this.group.scale.setScalar(1);
  }

  activate() { this.active = true; this.group.visible = true; this.state = 'chase'; this.stateT = 0; }

  get alive() { return !this.dead && this.active; }
  get glitchedActive() { return this.alive && this.unscaled; }
  get patched() { return !this.unscaled; }

  takeHit(amount, fromPos, opts = {}) {
    if (!this.alive) return 0;
    let dmg = amount;
    if (this.unscaled) dmg = Math.max(1, Math.round(amount * 0.05));       // Unscaled: nearly immune
    else if (this.frozen > 0) dmg = Math.round(amount * this.patchMult);   // patched: double damage
    this.hp -= dmg; this.hitFlash = 0.12;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deathT = 0; this.ring.visible = false; sfx('bossDie'); this.onDefeat?.(); }
    return dmg;
  }

  stun(t) { if (!this.unscaled && this.alive) { this.stunned = Math.max(this.stunned, t * 0.6); } }

  // PATCH: fix the scale bug.
  patch(bonus = 0) {
    if (!this.unscaled) return false;
    this.unscaled = false; this.targetScale = 1.6;
    this.frozen = 5 + bonus; this.stunned = 5 + bonus; this.state = 'stunned'; this.stateT = 0; this.ring.visible = false;
    this.shards.forEach(s => (s.visible = false));
    this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 2, 0)), 30, [0, 2], 6);
    this.onPatched?.();
    return true;
  }

  #goUnscaled() {
    sfx('glitchBig'); this.unscaled = true; this.targetScale = 3.6; this.state = 'chase'; this.stateT = 0; this.unscaledCount++;
    this.shards.forEach(s => (s.visible = true));
    this.onUnscaled?.();
  }

  update(dt, t, player, world) {
    if (!this.active) return null;
    if (this.dead) {
      this.deathT += dt;
      const k = Math.max(0, 1 - this.deathT / 1.2);
      this.group.scale.set(1 + (1 - k), k, 1 + (1 - k));
      if (Math.random() < 0.5) this.effects.burst(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 1, (Math.random() - 0.5) * 3)), 3, [3, 2, 0], 4);
      if (k <= 0) this.group.visible = false;
      return null;
    }
    this.stateT += dt;
    this.scale += (this.targetScale - this.scale) * Math.min(1, dt * 3);
    this.radius = this.scale;
    const toP = player.pos.clone().sub(this.pos).setY(0), dist = toP.length();
    let attack = null;

    // Phase events.
    const hpF = this.hp / this.maxHp;
    [0.66, 0.33].forEach((th, i) => { if (!this.summoned[i] && hpF < th && this.state !== 'air') { this.summoned[i] = true; this.onSummon?.(i); } });
    if (this.frozen > 0) this.frozen -= dt;
    if (this.stunned > 0) this.stunned -= dt;

    switch (this.state) {
      case 'stunned':
        if (this.stunned <= 0) { this.state = 'chase'; this.stateT = 0; this.nextSpecial = 3; }
        break;
      case 'chase': {
        if (dist > 0.1) this.facing = Math.atan2(toP.x, toP.z);
        this.hopT += dt * (this.unscaled ? 1.6 : 1.1);
        const phase = this.hopT % 1;
        const speed = (this.unscaled ? 5.2 : 3.2);
        if (phase < 0.5 && dist > this.radius + 0.6) this.pos.addScaledVector(toP.normalize(), speed * dt * 1.8);
        this.contactCd = (this.contactCd || 0) - dt;
        if (dist < this.radius + 0.8 && this.contactCd <= 0) { this.contactCd = 1.0; attack = { damage: this.unscaled ? 16 : 10, from: this.pos.clone(), enemy: this, aoe: this.radius + 1.0 }; }
        this.nextSpecial -= dt;
        if (this.nextSpecial <= 0) {
          this.nextSpecial = this.unscaled ? 2.2 : 3.5;
          // First Unscaled after 10s, then whenever enough time has passed.
          if (!this.unscaled && (this.unscaledCount === 0 ? this.stateTotal > 10 : this.sinceUnscaled > 16) && player.alive) this.#goUnscaled();
          else { this.state = 'crouch'; this.stateT = 0; this.slamTarget = player.pos.clone(); }
        }
        break;
      }
      case 'crouch':
        if (this.stateT > 0.75) { // longer wind-up: more time to react
          this.state = 'air'; this.stateT = 0; this.jumpFrom = this.pos.clone();
          this.slamTarget = player.pos.clone(); // aim where Jasper is when he jumps
          this.ring.visible = true; sfx('pounce', this.pos);
        }
        break;
      case 'air': {
        const dur = 1.2, k = Math.min(1, this.stateT / dur);
        this.pos.lerpVectors(this.jumpFrom, this.slamTarget, k);
        this.airY = Math.sin(k * Math.PI) * 6;
        const aoe = this.unscaled ? 5.5 : 4.0;
        this.ring.position.set(this.slamTarget.x, world.groundAt(this.slamTarget.x, this.slamTarget.z) + 0.08, this.slamTarget.z);
        this.ring.scale.setScalar(aoe * (0.4 + k * 0.6));
        this.ring.material.opacity = 0.4 + Math.sin(this.stateT * 30) * 0.3;
        if (k >= 1) {
          this.ring.visible = false; this.airY = 0;
          this.state = 'land'; this.stateT = 0;
          this.effects.shockwave(this.pos.clone(), aoe);
          this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 24, [3, 2], 6);
          this.onSlam?.(aoe); sfx('bossSlam');
          attack = { damage: this.unscaled ? 26 : 20, from: this.pos.clone(), enemy: this, aoe, unblockable: false };
        }
        break;
      }
      case 'land':
        if (this.stateT > 0.6) { this.state = 'chase'; this.stateT = 0; }
        break;
    }
    this.stateTotal = (this.stateTotal || 0) + dt;
    this.sinceUnscaled = this.unscaled ? 0 : (this.sinceUnscaled || 0) + dt;
    // Unscaled wears off after 14s if not patched (he heals a little: punish ignoring Patch).
    if (this.unscaled) {
      this.unscaledT = (this.unscaledT || 0) + dt;
      if (this.unscaledT > 14) { this.unscaled = false; this.unscaledT = 0; this.targetScale = 1.6; this.hp = Math.min(this.maxHp, this.hp + 40); this.shards.forEach(s => (s.visible = false)); }
    } else this.unscaledT = 0;

    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, this.radius * 0.8);
    const hop = this.state === 'chase' ? Math.max(0, Math.sin((this.hopT % 1) * Math.PI)) * 0.6 : 0;
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z) + hop + (this.airY || 0), this.pos.z);
    this.group.rotation.y = this.facing;
    const squash = this.state === 'crouch' ? 0.65 : this.state === 'stunned' ? 0.85 + Math.sin(t * 6) * 0.05 : 1 + Math.sin(this.hopT * Math.PI * 2) * 0.1;
    this.body.scale.set(this.scale / Math.sqrt(squash), this.scale * squash, this.scale / Math.sqrt(squash));
    // Visuals.
    this.hitFlash -= dt;
    if (this.hitFlash > 0) { this.mat.emissive.set(0xffffff); this.mat.emissiveIntensity = 1; }
    else if (this.state === 'crouch') { this.mat.emissive.set(0xff7a1a); this.mat.emissiveIntensity = 1.2; }
    else if (this.unscaled) {
      const flick = Math.sin(t * 37) > 0.7;
      this.mat.color.set(flick ? 0xff2bd6 : 0x7a3cff); this.mat.emissive.set(0x3a0f80); this.mat.emissiveIntensity = 0.8;
      this.body.position.x = flick ? (Math.random() - 0.5) * 0.4 : 0;
    } else { this.mat.color.set(this.frozen > 0 ? 0x9feeff : 0x47c94a); this.mat.emissive.set(this.frozen > 0 ? 0x29e6ff : 0x0c3a0c); this.mat.emissiveIntensity = this.frozen > 0 ? 0.5 : 0.4; this.body.position.x = 0; }
    this.shards.forEach((s, i) => { if (!s.visible) return; const a = i / 10 * Math.PI * 2 + t * 1.5; s.position.set(Math.cos(a) * this.scale * 1.2, this.scale * (0.8 + Math.sin(t * 3 + i) * 0.4), Math.sin(a) * this.scale * 1.2); s.rotation.set(t * 2 + i, t * 3, 0); });
    this.stars.visible = this.state === 'stunned';
    if (this.stars.visible) { this.stars.position.y = this.scale * 2.1; this.stars.children.forEach(st => { const a = st.userData.a + t * 4; st.position.set(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8); }); }
    return attack;
  }
}
