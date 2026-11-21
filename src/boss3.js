// Sir Duplicate: Zone 3 boss (Hard). The royal knight, copied by the Null.
// - Sword combos, a shield charge and a leaping slam with a shockwave (jump over it).
// - Raises his shield: hits from the front bounce off unless they are HEAVY.
// - At 70% and 35% HP he becomes FIVE knights that copy Jasper's every move. The real one is
//   always a little LATE. Hit the real one to break the trick; hitting a copy hurts.
//   PATCH during the trick inspects them: the real one glows gold for a moment.
// - Below 35% he is ENRAGED: faster combos, two charges in a row.
import * as THREE from 'three';
import { sfx } from './audio.js?v=23';
import { KnightBody, arcDecal } from './enemies3.js?v=23';

const SCALE = 1.4;

// A copy made during the mirror trick: one hit and it shatters.
class MirrorCopy {
  constructor(scene, boss) {
    this.boss = boss; this.minion = true; this.noRespawn = true; this.isClone = true; this.glitched = true;
    this.radius = 0.8; this.mat = { opacity: 1 }; this.name = 'SIR DUPLICATE?'; this.xp = 0;
    this.body = new KnightBody('duke', SCALE);
    this.group = new THREE.Group(); this.group.add(this.body.root); scene.add(this.group); this.group.visible = false;
    this.dead = true; this.gone = false; this.frozen = 0; this.stunned = 0; this.knock = new THREE.Vector3();
    this.pos = new THREE.Vector3(); this.hp = 1; this.maxHp = 1; this.facing = 0;
  }
  get alive() { return !this.dead; }
  get glitchedActive() { return false; }
  appear(pos) { this.pos.copy(pos); this.dead = false; this.group.visible = true; }
  vanish(burst = true) {
    if (this.dead) return;
    this.dead = true; this.group.visible = false;
    if (burst) { sfx('shatter', this.pos); this.boss.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), 30, [1, 2, 0], 7); }
  }
  takeHit() { if (this.dead) return 0; this.vanish(); this.boss.onWrongCopy(this); return 0; }
  patch() { return false; }
  stun() {}
  update() { return null; }
}

export class SirDuplicate {
  constructor(scene, home, world, effects, level) {
    this.scene = scene; this.home = home.clone(); this.world = world; this.effects = effects;
    this.isBoss = true; this.glitched = false; this.radius = 0.95; this.name = 'SIR DUPLICATE';
    this.mat = { opacity: 1 };
    const L = Math.max(10, level), ref = 100 + 10 * (L - 1); // ref = Jasper's base HP at this level
    this.maxHp = 2200 + 180 * L; this.hp = this.maxHp;
    this.dmg = { swing: Math.round(ref * 0.2), charge: Math.round(ref * 0.3), slam: Math.round(ref * 0.3), wave: Math.round(ref * 0.14), wrong: Math.round(ref * 0.12), finale: Math.round(ref * 0.35) };
    this.xp = 450;
    this.body = new KnightBody('duke', SCALE);
    this.group = new THREE.Group(); this.group.add(this.body.root); scene.add(this.group);
    this.portrait = { obj: this.group, focus: 0.88, dist: 2.6, side: 0.2 };
    // Telegraphs.
    this.arc = arcDecal(3.9, 2.0); this.group.add(this.arc);
    this.lane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 16), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
    this.lane.geometry.rotateX(-Math.PI / 2); this.lane.geometry.translate(0, 0.07, 8); this.lane.visible = false; this.group.add(this.lane);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
    this.waveMesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffb03b, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.waveMesh.rotation.x = -Math.PI / 2; this.waveMesh.visible = false; scene.add(this.waveMesh);
    // Gold glow ring under the real knight when inspected with Patch.
    this.reveal = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 32), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.reveal.rotation.x = -Math.PI / 2; this.reveal.position.y = 0.08; this.reveal.visible = false; this.group.add(this.reveal);
    this.stars = new THREE.Group();
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffe28a })); st.userData.a = i / 4 * Math.PI * 2; this.stars.add(st); }
    this.stars.position.y = 3.2; this.stars.visible = false; this.group.add(this.stars);
    this.clones = [0, 1, 2, 3].map(() => new MirrorCopy(scene, this));
    this.history = []; // Jasper's recent animation frames and positions (the real knight replays them late)
    this.reset();
  }

  reset() {
    this.hp = this.maxHp; this.dead = false; this.active = false; this.frozen = 0; this.stunned = 0; this.patchMult = 2;
    this.pos = this.home.clone(); this.knock = new THREE.Vector3(); this.facing = 0;
    this.state = 'idle'; this.stateT = 0; this.cd = 1.5; this.mirrors = [false, false]; this.enraged = false; this.wave = null;
    this.hitFlash = 0; this.deathT = 0; this.mirroring = false; this.revealT = 0; this.charges = 0;
    this.group.visible = false; this.group.scale.setScalar(1); this.body.root.rotation.set(0, 0, 0);
    for (const o of [this.arc, this.lane, this.ring, this.waveMesh, this.reveal]) o.visible = false;
    this.clones.forEach(c => c.vanish(false));
    this.body.play('Sword_Idle');
  }

  activate() { this.active = true; this.group.visible = true; this.state = 'chase'; this.stateT = 0; this.cd = 1.2; sfx('bossRoar'); }
  get alive() { return !this.dead && this.active; }
  get glitchedActive() { return this.alive && this.mirroring; }
  get patched() { return !this.mirroring; }

  takeHit(amount, fromPos, opts = {}) {
    if (!this.alive) return 0;
    let dmg = amount;
    if (this.mirroring) { this.#found(); return Math.round(amount); }
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const front = fwd.dot(fromPos.clone().sub(this.pos).setY(0).normalize()) > 0.3;
    if (this.frozen > 0) dmg = Math.round(amount * this.patchMult);
    else if (this.state === 'guard' && front) {
      if (opts.heavy) { this.stunned = 1.4; this.state = 'stunned'; this.stateT = 0; dmg = Math.round(amount * 0.8); sfx('shatter', this.pos); this.onGuardBreak?.(); }
      else { dmg = Math.max(1, Math.round(amount * 0.12)); sfx('block', this.pos); this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1.8, 0)).addScaledVector(fwd, 0.7), 6, [2], 3); }
    } else dmg = Math.round(amount * 0.85); // plate armour
    this.hp -= dmg; this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.deathT = 0; this.clearTelegraphs();
      this.body.play('Death01', { once: true, fade: 0.15 }); sfx('bossDie');
      this.onDefeat?.();
    }
    return dmg;
  }

  stun(t) { if (this.alive && !this.mirroring) this.stunned = Math.max(this.stunned, t * 0.5); }

  // PATCH during the mirror trick: inspect. The real knight glows gold for a moment.
  patch() {
    if (!this.mirroring) return false;
    this.revealT = 2.6; this.reveal.visible = true;
    this.patchMsg = 'INSPECTED!\nThe real one glows GOLD - hit him!';
    return true;
  }

  clearTelegraphs() { for (const o of [this.arc, this.lane, this.ring, this.reveal]) o.visible = false; }

  // ---- The mirror trick ----
  #startMirror(player) {
    this.mirroring = true; this.mirrorT = 0; this.state = 'mirror'; this.stateT = 0; this.clearTelegraphs();
    this.center = player.pos.clone(); this.anchor = player.pos.clone();
    const base = Math.random() * Math.PI * 2, real = Math.floor(Math.random() * 5);
    this.slots = [];
    let ci = 0;
    for (let i = 0; i < 5; i++) {
      const a = base + i / 5 * Math.PI * 2, spot = this.center.clone().add(new THREE.Vector3(Math.cos(a) * 7.5, 0, Math.sin(a) * 7.5));
      this.world.resolve(spot, 1);
      const who = i === real ? this : this.clones[ci++];
      this.slots.push({ who, a, home: spot });
      if (who === this) this.pos.copy(spot); else who.appear(spot);
    }
    this.effects.burst(this.center.clone().add(new THREE.Vector3(0, 2, 0)), 40, [1, 2, 0], 9);
    sfx('teleport'); sfx('glitchBig');
    this.onMirror?.();
  }
  #endMirror() {
    this.mirroring = false; this.revealT = 0; this.reveal.visible = false; this.ring.visible = false;
    this.clones.forEach(c => c.vanish());
    this.state = 'chase'; this.stateT = 0; this.cd = 1.5;
  }
  #found() {
    this.#endMirror();
    this.frozen = 4; this.stunned = 4; this.state = 'stunned'; this.stateT = 0;
    this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 2, 0)), 34, [0, 2], 8); sfx('shatter');
    this.onFound?.();
  }
  onWrongCopy(copy) {
    this.pendingHit = { damage: this.dmg.wrong, from: copy.pos.clone(), enemy: this, direct: true };
    this.onWrong?.();
  }

  #mirrorUpdate(dt, player) {
    this.mirrorT += dt;
    // Everyone copies Jasper: same animation frame, same moves (turned around the circle).
    const now = { clip: player.current?.getClip().name || 'Idle_Loop', time: player.current?.time || 0, pos: player.pos.clone(), facing: player.facing, y: player.pos.y - this.world.groundAt(player.pos.x, player.pos.z) };
    this.history.push({ t: this.mirrorT, ...now });
    while (this.history.length > 2 && this.history[1].t < this.mirrorT - 0.75) this.history.shift();
    const late = this.history[0];
    for (const s of this.slots) {
      const f = s.who === this ? late : now;
      const off = f.pos.clone().sub(this.anchor).setY(0).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.a);
      const p = s.home.clone().add(off.multiplyScalar(0.8));
      this.world.resolve(p, 0.9);
      s.who.pos.copy(p);
      const toJ = player.pos.clone().sub(p).setY(0);
      const facing = Math.atan2(toJ.x, toJ.z) + (f.facing - Math.atan2(this.center.x - f.pos.x, this.center.z - f.pos.z)) * 0.0;
      s.who.facing = facing;
      const body = s.who.body;
      body.mirror(body === this.body ? f.clip : f.clip, f.time);
      body.update(0);
      s.who.group.position.set(p.x, this.world.groundAt(p.x, p.z) + Math.max(0, f.y), p.z);
      s.who.group.rotation.y = facing;
    }
    if (this.revealT > 0) { this.revealT -= dt; this.reveal.visible = this.revealT > 0; this.reveal.material.opacity = 0.6 + Math.sin(this.mirrorT * 14) * 0.3; }
    // Too slow: all five close in on Jasper.
    const limit = this.enraged ? 11 : 14;
    if (this.mirrorT > limit - 1.3) {
      this.ring.visible = true; this.ring.position.set(player.pos.x, this.world.groundAt(player.pos.x, player.pos.z) + 0.08, player.pos.z);
      this.ring.scale.setScalar(2.6); this.ring.material.opacity = 0.4 + Math.sin(this.mirrorT * 30) * 0.3;
    }
    if (this.mirrorT > limit) {
      const hit = player.alive && player.onGround;
      this.effects.shockwave(player.pos.clone(), 3); sfx('bossSlam');
      this.#endMirror();
      this.pos.copy(player.pos.clone().add(new THREE.Vector3(0, 0, -3))); this.world.resolve(this.pos, 1);
      return hit ? { damage: this.dmg.finale, from: player.pos.clone().add(new THREE.Vector3(0, 0, 1)), enemy: this, direct: true } : null;
    }
    return null;
  }

  update(dt, t, player, world) {
    if (!this.active) return null;
    if (this.dead) {
      this.deathT += dt; this.body.update(dt);
      if (this.deathT > 1.6) { const k = Math.max(0, 1 - (this.deathT - 1.6) / 0.8); this.group.scale.setScalar(Math.max(0.01, k)); if (k <= 0) this.group.visible = false; }
      if (Math.random() < 0.4) this.effects.burst(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2)), 3, [1, 2], 4);
      return null;
    }
    let attack = null;
    if (this.pendingHit) { attack = this.pendingHit; this.pendingHit = null; }
    this.stateT += dt;
    const toP = player.pos.clone().sub(this.pos).setY(0), dist = toP.length();
    const hpF = this.hp / this.maxHp;
    if (!this.enraged && hpF < 0.35) { this.enraged = true; this.onEnrage?.(); }
    const rage = this.enraged ? 1.25 : 1;
    if (this.mirroring) return this.#mirrorUpdate(dt, player) || attack;
    [0.7, 0.35].forEach((th, i) => { if (!this.mirrors[i] && hpF < th && (this.state === 'chase' || this.state === 'stunned') && this.frozen <= 0) { this.mirrors[i] = true; this.#startMirror(player); } });
    if (this.mirroring) return attack;
    if (this.frozen > 0) this.frozen -= dt;
    if (this.stunned > 0) this.stunned -= dt;
    this.cd -= dt * rage;
    const turn = (target, rate) => { let d = target - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); this.facing += Math.sign(d) * Math.min(Math.abs(d), rate * dt); };
    const fwd = () => new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    let anim = null;
    switch (this.state) {
      case 'stunned':
        anim = 'Hit_Chest';
        if (this.stunned <= 0) { this.state = 'chase'; this.stateT = 0; this.cd = 0.8; }
        break;
      case 'chase': {
        turn(Math.atan2(toP.x, toP.z), 3.2 * rage);
        if (dist > 3.2) { this.pos.addScaledVector(toP.clone().normalize(), 2.7 * rage * dt); anim = 'Walk_Loop'; } else anim = 'Sword_Idle';
        if (this.cd <= 0) {
          const r = Math.random();
          if (dist > 8) { this.state = 'chargeWind'; this.charges = this.enraged ? 2 : 1; }
          else if (dist < 4.5 && r < 0.62) { this.state = 'comboWind'; this.combo = 0; }
          else if (r < 0.8 && hpF < 0.7) this.state = 'slamWind';
          else if (dist < 6) this.state = 'guard';
          else { this.state = 'chargeWind'; this.charges = 1; }
          this.stateT = 0;
          if (this.state === 'comboWind') { this.arc.visible = true; this.body.play('Sword_Block', { fade: 0.1 }); sfx('growl', this.pos, 1.2); }
          if (this.state === 'chargeWind') { this.lane.visible = true; this.body.play('Sword_Block', { fade: 0.1 }); sfx('warn'); }
          if (this.state === 'slamWind') { this.body.play('Sword_Block', { fade: 0.1 }); }
          if (this.state === 'guard') { this.body.play('Sword_Block', { fade: 0.1 }); }
        }
        break;
      }
      case 'guard':
        anim = 'Sword_Block'; turn(Math.atan2(toP.x, toP.z), 4);
        if (this.stateT > 1.6) { this.state = 'chase'; this.stateT = 0; this.cd = 0.6; }
        break;
      case 'comboWind':
        this.arc.material.opacity = 0.25 + Math.sin(this.stateT * 28) * 0.15; turn(Math.atan2(toP.x, toP.z), 2);
        if (this.stateT > (this.enraged ? 0.42 : 0.58)) { this.arc.visible = false; this.state = 'combo'; this.stateT = 0; this.combo = 0; this.hitDone = false; this.body.play('Sword_Regular_A', { once: true, ts: 1.3, fade: 0.06 }); sfx('swingHeavy', this.pos); }
        break;
      case 'combo': {
        const step = 0.46, n = this.enraged ? 4 : 3;
        if (!this.hitDone && this.stateT > 0.2) {
          this.hitDone = true;
          if (dist < 4.0 && fwd().dot(toP.clone().normalize()) > 0.2) attack = attack || { damage: this.dmg.swing, from: this.pos.clone(), enemy: this, direct: true };
          this.effects.slash(this.pos, this.facing + (this.combo % 2 ? 0.6 : -0.6), 0xffb03b, true);
        }
        if (this.stateT > step) {
          this.combo++;
          if (this.combo >= n) { this.state = 'recover'; this.stateT = 0; this.body.play('Sword_Idle', { fade: 0.2 }); }
          else {
            this.stateT = 0; this.hitDone = false; turn(Math.atan2(toP.x, toP.z), 20);
            this.pos.addScaledVector(fwd(), 0.9);
            this.body.play(['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Regular_B'][this.combo], { once: true, ts: 1.3, fade: 0.06 }); sfx('swingHeavy', this.pos);
          }
        }
        break;
      }
      case 'chargeWind':
        turn(Math.atan2(toP.x, toP.z), 2.4);
        this.lane.material.opacity = 0.22 + Math.sin(this.stateT * 26) * 0.12;
        if (this.stateT > 0.8) { this.lane.visible = false; this.state = 'charge'; this.stateT = 0; this.hitDone = false; this.body.play('Sword_Dash', { fade: 0.06 }); sfx('pounce', this.pos); }
        break;
      case 'charge':
        anim = 'Sword_Dash';
        this.pos.addScaledVector(fwd(), 17 * dt);
        if (!this.hitDone && player.pos.distanceTo(this.pos) < 1.9) { this.hitDone = true; attack = attack || { damage: this.dmg.charge, from: this.pos.clone(), enemy: this, direct: true }; }
        if (this.stateT > 0.85) {
          this.charges--;
          if (this.charges > 0) { this.state = 'chargeWind'; this.stateT = 0.25; this.lane.visible = true; }
          else { this.state = 'recover'; this.stateT = 0; this.body.play('Sword_Idle', { fade: 0.2 }); }
        }
        break;
      case 'slamWind':
        if (this.stateT > 0.35) { this.state = 'air'; this.stateT = 0; this.jumpFrom = this.pos.clone(); this.slamTo = player.pos.clone(); this.ring.visible = true; sfx('pounce', this.pos); }
        break;
      case 'air': {
        const dur = 0.95, k = Math.min(1, this.stateT / dur);
        this.pos.lerpVectors(this.jumpFrom, this.slamTo, k); this.airY = Math.sin(k * Math.PI) * 5;
        this.ring.position.set(this.slamTo.x, world.groundAt(this.slamTo.x, this.slamTo.z) + 0.08, this.slamTo.z);
        this.ring.scale.setScalar(3.6 * (0.4 + k * 0.6)); this.ring.material.opacity = 0.4 + Math.sin(this.stateT * 30) * 0.3;
        if (k >= 1) {
          this.ring.visible = false; this.airY = 0; this.state = 'recover'; this.stateT = 0;
          this.effects.shockwave(this.pos.clone(), 3.6); sfx('bossSlam');
          if (player.pos.distanceTo(this.pos) < 3.6) attack = attack || { damage: this.dmg.slam, from: this.pos.clone(), enemy: this, direct: true };
          this.wave = { c: this.pos.clone(), r: 2.6, max: 14, hit: false }; this.waveMesh.visible = true;
        }
        break;
      }
      case 'recover':
        anim = 'Sword_Idle';
        if (this.stateT > (this.enraged ? 0.7 : 1.0)) { this.state = 'chase'; this.stateT = 0; this.cd = this.enraged ? 0.9 : 1.4; }
        break;
    }
    // Shockwave after a slam: jump over it or dodge through it.
    if (this.wave) {
      const w = this.wave; w.r += 10 * dt;
      this.waveMesh.position.set(w.c.x, world.groundAt(w.c.x, w.c.z) + 0.1, w.c.z); this.waveMesh.scale.setScalar(w.r);
      this.waveMesh.material.opacity = 0.85 * Math.max(0, 1 - w.r / w.max);
      const pd = Math.hypot(player.pos.x - w.c.x, player.pos.z - w.c.z);
      if (!w.hit && player.onGround && Math.abs(pd - w.r) < 0.7) { w.hit = true; attack = attack || { damage: this.dmg.wave, from: w.c.clone(), enemy: this, direct: true }; }
      if (w.r > w.max) { this.wave = null; this.waveMesh.visible = false; }
    }
    if (anim) this.body.play(anim, { fade: 0.2 });
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, this.radius);
    this.body.update(this.stunned > 0 ? dt * 0.4 : dt);
    this.stars.visible = this.state === 'stunned';
    if (this.stars.visible) this.stars.children.forEach(st => { const a = st.userData.a + t * 4; st.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); });
    this.hitFlash -= dt; this.body.root.scale.setScalar(SCALE * (this.hitFlash > 0 ? 1.04 : 1));
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z) + (this.airY || 0), this.pos.z);
    this.group.rotation.y = this.facing;
    return attack;
  }
}
