// Thornwraith: Zone 2 boss. A forest guardian the developers never finished.
// - Walks after Jasper; claw sweep up close; root spikes erupt under Jasper (red circles warn first).
// - Every so often its unfinished arm "fails to load": it turns GLITCHED and resists damage.
//   PATCH finishes the asset: it is stunned and its heart is exposed (x2 damage).
// - At 60% and 30% HP it splits into 3 copies. Only the real one casts a shadow
//   (dark circle on the ground). Hitting or patching a copy makes it vanish.
import * as THREE from 'three';
import { sfx } from './audio.js?v=33';
import { buildThornwraith, bake } from './monsters2.js?v=33';

const MAGENTA = 0xff2bd6;
const spikeGeo = new THREE.ConeGeometry(0.28, 2.2, 5); spikeGeo.translate(0, 1.1, 0);
const spikeMat = new THREE.MeshStandardMaterial({ color: 0x3e2d24, flatShading: true, roughness: 0.9 });
const tipMat = new THREE.MeshBasicMaterial({ color: MAGENTA });

function model() {
  const { root, parts } = buildThornwraith();
  parts.heart.userData.keep = true;
  root.traverse(o => { if (o.isMesh && o.material.wireframe && o.parent === parts.body) o.userData.keep = true; });
  bake(root, [parts.body, parts.armL, parts.armR, parts.head], { lines: false });
  // Arm materials: the unfinished (wireframe) arm can be "finished" by Patch.
  parts.armRMeshes = [];
  parts.armR.traverse(o => { if (o.isMesh && o.material.wireframe) parts.armRMeshes.push(o); });
  return { root, parts };
}

// Root spikes: warning circle first, then spikes burst out of the ground.
class SpikeField {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.ringGeo = new THREE.RingGeometry(1.2, 1.45, 32); this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1.45, 32); this.discGeo.rotateX(-Math.PI / 2);
  }
  add(pos, delay, world) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.8, depthWrite: false }));
    const disc = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.18, depthWrite: false }));
    g.add(ring, disc);
    const spikes = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(spikeGeo, spikeMat); const a = i / 5 * Math.PI * 2 + Math.random();
      s.position.set(Math.cos(a) * 0.55 * (i ? 1 : 0), 0, Math.sin(a) * 0.55 * (i ? 1 : 0)); s.rotation.set((Math.random() - 0.5) * 0.5, a, (Math.random() - 0.5) * 0.5);
      s.scale.setScalar(i ? 0.75 : 1); s.castShadow = true; spikes.add(s);
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), tipMat); tip.position.y = 2.2; s.add(tip);
    }
    spikes.visible = false; g.add(spikes);
    g.position.set(pos.x, world.groundAt(pos.x, pos.z) + 0.05, pos.z);
    this.scene.add(g);
    this.items.push({ g, ring, disc, spikes, t: -delay, fired: false });
  }
  update(dt, player) {
    let hit = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt;
      if (it.t < 0) { it.g.visible = false; continue; }
      it.g.visible = true;
      if (it.t < 0.95) { it.ring.material.opacity = 0.5 + Math.sin(it.t * 30) * 0.3; it.disc.material.opacity = 0.1 + it.t * 0.25; continue; }
      if (!it.fired) {
        it.fired = true; it.spikes.visible = true; it.ring.visible = false; it.disc.visible = false;
        if (Math.hypot(player.pos.x - it.g.position.x, player.pos.z - it.g.position.z) < 1.55) hit = true;
        sfx('spikes', it.g.position);
      }
      const k = it.t - 0.95;
      it.spikes.scale.y = k < 0.12 ? k / 0.12 : k > 0.9 ? Math.max(0.01, 1 - (k - 0.9) / 0.3) : 1;
      if (k > 1.2) { this.scene.remove(it.g); this.items.splice(i, 1); }
    }
    return hit;
  }
  clear() { for (const it of this.items) this.scene.remove(it.g); this.items = []; }
}

// A copy made during the clone phase: no shadow, one hit (or a Patch) and it is gone.
class ThornClone {
  constructor(scene, boss) {
    this.boss = boss; this.minion = true; this.noRespawn = true; this.isClone = true; this.glitched = true;
    this.radius = 1.4; this.mat = { opacity: 1 }; this.name = 'THORNWRAITH?'; this.xp = 0;
    this.patchMsg = 'COPY DELETED!\nThe real one has a shadow';
    this.m = model(); this.group = new THREE.Group(); this.group.add(this.m.root);
    this.m.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
    this.m.parts.heart.visible = false;
    scene.add(this.group); this.group.visible = false;
    this.dead = true; this.gone = false; this.frozen = 0; this.stunned = 0; this.knock = new THREE.Vector3();
    this.pos = new THREE.Vector3(); this.hp = 1; this.maxHp = 1;
  }
  get alive() { return !this.dead; }
  get glitchedActive() { return !this.dead; }
  appear(pos) { this.pos.copy(pos); this.dead = false; this.group.visible = true; this.t = 0; this.spikeCd = 2 + Math.random() * 2; }
  vanish() {
    if (this.dead) return;
    this.dead = true; this.group.visible = false; sfx('enemyDie', this.pos);
    this.boss.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 30, [0, 1, 2], 6);
  }
  takeHit() { this.vanish(); this.boss.onCloneGone?.(this); return 0; }
  patch() { this.boss.revealClones(); return true; }
  stun() {}
  update(dt, t, player, world) {
    if (this.dead) return null;
    this.t += dt; this.spikeCd -= dt;
    const toP = player.pos.clone().sub(this.pos).setY(0);
    this.group.rotation.y = Math.atan2(toP.x, toP.z);
    this.boss.pose(this.m.parts, t + 1.3, 'walk');
    if (toP.length() > 5) this.pos.addScaledVector(toP.normalize(), 1.2 * dt);
    world.resolve(this.pos, this.radius);
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z), this.pos.z);
    if (this.spikeCd <= 0) {
      this.spikeCd = 2.8 + Math.random(); this.boss.spikes.add(player.pos.clone(), 0, world);
      this.boss.spikes.add(player.pos.clone().addScaledVector(player.vel.clone().setY(0), 0.6), 0.2, world);
    }
    return null;
  }
}

export class Thornwraith {
  constructor(scene, home, world, effects, level) {
    this.scene = scene; this.home = home.clone(); this.world = world; this.effects = effects;
    this.isBoss = true; this.glitched = true; this.radius = 1.5; this.name = 'THORNWRAITH';
    this.mat = { opacity: 1 };
    // Difficulty: Medium-Hard. HP and damage grow with Jasper's level (ref = his base HP at this level).
    const L = Math.max(7, level), ref = 100 + 10 * (L - 1);
    this.maxHp = 1500 + 150 * L; this.hp = this.maxHp;
    this.dmgClaw = Math.round(ref * 0.24); this.dmgSpike = Math.round(ref * 0.17);
    this.xp = 300;
    this.m = model(); this.group = new THREE.Group(); this.group.add(this.m.root);
    // Fake shadow (always visible, even with shadows off): only the real Thornwraith has it.
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.06; this.group.add(this.blob);
    // Light from the heart.
    this.heartLight = new THREE.PointLight(MAGENTA, 0, 6); this.heartLight.position.set(0, 2.3, 0.6); this.group.add(this.heartLight);
    this.armRMat = this.m.parts.armRMeshes[0]?.material;
    this.finishedArmMat = new THREE.MeshStandardMaterial({ color: 0x6b4a35, flatShading: true, roughness: 0.85 });
    this.stars = new THREE.Group();
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffe28a })); st.userData.a = i / 4 * Math.PI * 2; this.stars.add(st); }
    this.stars.position.y = 5.4; this.stars.visible = false; this.group.add(this.stars);
    // Sweep telegraph: red arc in front.
    this.arc = new THREE.Mesh(new THREE.CircleGeometry(4.6, 24, -Math.PI / 2 - 0.9, 1.8), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    this.arc.rotation.x = -Math.PI / 2; this.arc.position.y = 0.07; this.arc.visible = false; this.group.add(this.arc);
    this.spikes = new SpikeField(scene);
    this.clones = [new ThornClone(scene, this), new ThornClone(scene, this)];
    this.group.visible = false;
    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.hp = this.maxHp; this.dead = false; this.active = false; this.frozen = 0; this.stunned = 0; this.patchMult = 2;
    this.pos = this.home.clone(); this.knock = new THREE.Vector3(); this.facing = 0;
    this.state = 'idle'; this.stateT = 0; this.unfinished = false; this.nextGlitch = 10; this.spikeCd = 3; this.sweepCd = 2;
    this.split = [false, false]; this.enraged = false; this.pattern = 0; this.hitFlash = 0; this.deathT = 0; this.walkT = 0;
    this.group.visible = false; this.group.scale.setScalar(1); this.arc.visible = false;
    this.spikes.clear(); this.clones.forEach(c => c.vanish());
    this.#setArm(false);
  }

  activate() { this.active = true; this.group.visible = true; this.state = 'chase'; this.stateT = 0; sfx('bossRoar'); }

  get alive() { return !this.dead && this.active; }
  get glitchedActive() { return this.alive && this.unfinished; }
  get patched() { return !this.unfinished; }

  #setArm(finished) {
    for (const m of this.m.parts.armRMeshes) m.material = finished ? this.finishedArmMat : this.armRMat;
  }

  takeHit(amount, fromPos) {
    if (!this.alive) return 0;
    let dmg = amount;
    if (this.unfinished) dmg = Math.max(1, Math.round(amount * 0.1));      // glitched: nearly immune
    else if (this.frozen > 0) dmg = Math.round(amount * this.patchMult);    // heart exposed: double damage
    else dmg = Math.round(amount * 0.75);                                    // thick bark
    this.hp -= dmg; this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.deathT = 0; this.arc.visible = false;
      this.spikes.clear(); this.clones.forEach(c => c.vanish()); this.heartLight.intensity = 0; sfx('bossDie');
      this.onDefeat?.();
    }
    return dmg;
  }

  stun(t) { if (!this.unfinished && this.alive) this.stunned = Math.max(this.stunned, t * 0.5); }

  // PATCH: finish the missing asset. Stunned, heart exposed.
  patch(bonus = 0) {
    if (!this.unfinished) return false;
    this.unfinished = false; this.#setArm(true);
    this.frozen = 4 + bonus; this.stunned = 4 + bonus; this.state = 'stunned'; this.stateT = 0; this.arc.visible = false;
    this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 3, 0)), 34, [0, 2], 7);
    this.patchMsg = 'ASSET LOADED!\nHeart exposed - x2 DAMAGE!';
    this.onPatched?.();
    return true;
  }

  revealClones() {
    this.clones.forEach(c => c.vanish());
    this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 3, 0)), 20, [0, 2], 5);
    this.onReveal?.();
  }

  #split(player) {
    // Real one and two copies stand on a triangle around Jasper.
    const base = Math.random() * Math.PI * 2, spots = [0, 1, 2].map(i => {
      const a = base + i / 3 * Math.PI * 2;
      const p = this.home.clone().add(new THREE.Vector3(Math.cos(a) * 8, 0, Math.sin(a) * 8));
      return p;
    });
    this.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 3, 0)), 40, [0, 1, 2], 8);
    this.pos.copy(spots[0]);
    this.clones[0].appear(spots[1]); this.clones[1].appear(spots[2]);
    this.state = 'chase'; this.stateT = 0; sfx('teleport'); sfx('bossRoar');
    this.onSplit?.();
  }

  // Shared animation for the boss and its copies.
  pose(p, t, mode, k = 0) {
    const sway = Math.sin(t * 1.6) * 0.06;
    p.body.rotation.z = sway; p.body.rotation.x = mode === 'stunned' ? 0.25 : 0;
    p.head.rotation.x = mode === 'stunned' ? 0.5 : Math.sin(t * 0.9) * 0.08;
    p.head.rotation.y = Math.sin(t * 0.7) * 0.15;
    const walk = mode === 'walk' ? Math.sin(t * 3) * 0.25 : 0;
    if (mode === 'raise') { p.armL.rotation.z = -1.6 * k; p.armR.rotation.z = 1.6 * k; p.armL.rotation.x = -0.5 * k; p.armR.rotation.x = -0.5 * k; }
    else if (mode === 'sweep') { p.armL.rotation.x = -1.2 + k * 2.4; p.armL.rotation.z = -0.5; p.armR.rotation.x = -1.2 + k * 2.4; p.armR.rotation.z = 0.5; }
    else { p.armL.rotation.set(walk, 0, Math.sin(t * 1.3) * 0.05); p.armR.rotation.set(-walk, 0, -Math.sin(t * 1.3) * 0.05); }
  }

  update(dt, t, player, world) {
    if (!this.active) return null;
    if (this.dead) {
      this.deathT += dt;
      const k = Math.max(0, 1 - this.deathT / 1.6);
      this.m.root.scale.set(1, Math.max(0.01, k), 1); this.m.root.rotation.z = (1 - k) * 0.4;
      if (Math.random() < 0.5) this.effects.burst(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 3, (Math.random() - 0.5) * 3)), 3, [0, 1, 2], 4);
      if (k <= 0) this.group.visible = false;
      return null;
    }
    this.stateT += dt;
    let attack = null;
    const toP = player.pos.clone().sub(this.pos).setY(0), dist = toP.length();
    const hpF = this.hp / this.maxHp;
    [0.6, 0.3].forEach((th, i) => { if (!this.split[i] && hpF < th && this.state === 'chase') { this.split[i] = true; this.#split(player); } });
    if (!this.enraged && hpF < 0.25) { this.enraged = true; sfx('bossRoar'); this.onEnrage?.(); }
    const rage = this.enraged ? 1.3 : 1;
    if (this.frozen > 0) this.frozen -= dt;
    if (this.stunned > 0) this.stunned -= dt;
    let mode = 'idle', k = 0;
    switch (this.state) {
      case 'stunned':
        mode = 'stunned';
        if (this.stunned <= 0) { this.state = 'chase'; this.stateT = 0; this.nextGlitch = 12; }
        break;
      case 'chase': {
        if (dist > 0.1) { let d = Math.atan2(toP.x, toP.z) - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); this.facing += d * Math.min(1, dt * 3); }
        if (dist > 3.4) { this.pos.addScaledVector(toP.clone().normalize(), (this.unfinished ? 2.6 : 1.9) * rage * dt); mode = 'walk'; this.walkT += dt; }
        this.sweepCd -= dt * rage; this.spikeCd -= dt * rage; this.nextGlitch -= dt;
        if (dist < 4.6 && this.sweepCd <= 0) { this.state = 'sweepWind'; this.stateT = 0; this.arc.visible = true; sfx('growl', this.pos, 1.4); }
        else if (this.spikeCd <= 0 && player.alive) {
          // Three root patterns in turn: under + ahead of Jasper, a line from the boss, a ring around Jasper.
          const P = player.pos.clone(), pat = this.pattern++ % 3;
          if (pat === 0) {
            this.spikes.add(P, 0, world); this.spikes.add(P.clone().addScaledVector(player.vel.clone().setY(0), 0.7), 0.25, world);
            if (this.hp / this.maxHp < 0.6) { const a = Math.random() * Math.PI * 2; this.spikes.add(P.clone().add(new THREE.Vector3(Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6)), 0.5, world); }
          } else if (pat === 1) {
            const dir = toP.clone().normalize();
            for (let i = 1; i <= 6; i++) this.spikes.add(this.pos.clone().addScaledVector(dir, 1.6 + i * 2.2), i * 0.12, world);
          } else {
            const a0 = Math.random() * Math.PI;
            for (let i = 0; i < 6; i++) { const a = a0 + i / 6 * Math.PI * 2; this.spikes.add(P.clone().add(new THREE.Vector3(Math.cos(a) * 2.8, 0, Math.sin(a) * 2.8)), 0.05 * i, world); }
            this.spikes.add(P, 0.55, world); // then the middle: get out through a gap
          }
          this.spikeCd = this.unfinished ? 2.4 : 3.6;
          this.state = 'raise'; this.stateT = 0;
        } else if (this.nextGlitch <= 0 && !this.unfinished) {
          this.unfinished = true; this.#setArm(false); this.glitchT = 0; sfx('glitchBig');
          this.onUnfinished?.();
        }
        break;
      }
      case 'raise':
        mode = 'raise'; k = Math.min(1, this.stateT / 0.35) * (this.stateT > 0.8 ? Math.max(0, 1 - (this.stateT - 0.8) / 0.3) : 1);
        if (this.stateT > 1.1) { this.state = 'chase'; this.stateT = 0; }
        break;
      case 'sweepWind':
        mode = 'sweep'; k = 0;
        this.arc.material.opacity = 0.25 + Math.sin(this.stateT * 28) * 0.15;
        if (this.stateT > (this.enraged ? 0.5 : 0.7)) { this.state = 'sweep'; this.stateT = 0; this.arc.visible = false; this.swept = false; }
        break;
      case 'sweep': {
        mode = 'sweep'; k = Math.min(1, this.stateT / 0.25);
        if (!this.swept && k > 0.5) {
          this.swept = true;
          const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
          if (dist < 5 && fwd.dot(toP.clone().normalize()) > 0.2) attack = { damage: this.dmgClaw, from: this.pos.clone(), enemy: this, direct: true };
          this.effects.slash(this.pos, this.facing, 0xff3b3b, true); sfx('sweep');
        }
        if (this.stateT > 0.8) { this.state = 'chase'; this.stateT = 0; this.sweepCd = this.enraged ? 1.6 + Math.random() * 0.6 : 2.3 + Math.random(); }
        break;
      }
    }
    // The unfinished arm fixes itself after 12 s if ignored, and the forest hits back hard.
    if (this.unfinished) {
      this.glitchT += dt;
      if (this.glitchT > 8) { // less time to Patch
        this.unfinished = false; this.#setArm(false); this.nextGlitch = 12;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; this.spikes.add(player.pos.clone().add(new THREE.Vector3(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2)), 0.1 * i, world); }
      }
    }
    if (this.spikes.update(dt, player) && player.alive) attack = attack || { damage: this.dmgSpike, from: player.pos.clone().add(new THREE.Vector3(0, 0, 0.5)), enemy: this, direct: true };
    this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.pow(0.02, dt));
    world.resolve(this.pos, this.radius);
    this.pose(this.m.parts, t, mode, k);
    // Visuals.
    const heart = this.m.parts.heart;
    const exposed = this.frozen > 0;
    heart.scale.setScalar((exposed ? 1.6 : 1) * (1 + Math.sin(t * (this.unfinished ? 12 : 4)) * 0.12)); heart.scale.y *= 1.35;
    this.heartLight.intensity = exposed ? 14 : this.unfinished ? 6 + Math.sin(t * 20) * 3 : this.enraged ? 5 + Math.sin(t * 9) * 2 : 2;
    if (this.unfinished) this.m.root.position.x = Math.sin(t * 33) > 0.8 ? (Math.random() - 0.5) * 0.3 : 0; else this.m.root.position.x = 0;
    this.m.root.scale.setScalar(this.hitFlash > 0 ? 1.04 : 1); this.hitFlash -= dt;
    this.stars.visible = this.state === 'stunned';
    if (this.stars.visible) this.stars.children.forEach(st => { const a = st.userData.a + t * 4; st.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); });
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z), this.pos.z);
    this.group.rotation.y = this.facing;
    return attack;
  }
}
