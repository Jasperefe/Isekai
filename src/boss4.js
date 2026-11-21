// NOVA: the final boss. The game's own system, trying to close Aster for good.
// It floats out of reach and attacks with its own interface:
// - ERROR RAIN: red squares on the ground, then error windows crash down on them.
// - DELETE BEAM: a red line sweeps round the arena at ankle height. JUMP over it.
// - SUMMON (at 75%, 50% and 25%): Placeholders drop in. Defeat them to bring NOVA down sooner.
// After each attack cycle NOVA sinks to the floor to "reload": that is the moment to hit its eye.
// When the eye flickers (GLITCHED) PATCH it: stunned, x2 damage. Below 33% it is ENRAGED.
import * as THREE from 'three';
import { sfx } from './audio.js?v=31';
import { label } from './world4.js?v=31';
import { Placeholder } from './enemies4.js?v=31';

const MAGENTA = 0xff2bd6, CYAN = 0x29e6ff;

function novaModel() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4ff, roughness: 0.25, metalness: 0.3, flatShading: true, emissive: 0x20243a });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), white); core.castShadow = true; body.add(core);
  const panels = new THREE.Group(); body.add(panels);
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.9 + Math.random() * 0.8, 0.14, 0.9 + Math.random() * 0.5), white);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    p.position.copy(dir.multiplyScalar(3.2 + Math.random())); p.lookAt(0, 0, 0); p.castShadow = true; panels.add(p);
  }
  const eyeBg = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ color: 0x0a0614 })); eyeBg.position.z = 2.32; body.add(eyeBg);
  const irisM = new THREE.MeshBasicMaterial({ color: MAGENTA });
  const iris = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.05, 32), irisM); iris.position.z = 2.35; body.add(iris);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ color: 0xffffff })); pupil.position.z = 2.37; body.add(pupil);
  // Orbiting windows.
  const windows = new THREE.Group(); g.add(windows);
  const texts = ['ERROR', 'SAVE?', 'END GAME', 'DELETE ASTER?', 'NULL', '404', 'QUIT', 'Y / N'];
  texts.forEach((tx, i) => {
    const a = i / texts.length * Math.PI * 2, w = label(tx, i % 3 ? '#29e6ff' : '#ff2bd6', 2.4, 'rgba(8,10,30,0.85)');
    w.position.set(Math.cos(a) * 5.5, Math.sin(i * 1.7) * 0.8, Math.sin(a) * 5.5); w.lookAt(w.position.clone().multiplyScalar(2)); windows.add(w);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: CYAN })); ring.rotation.x = Math.PI / 2; windows.add(ring);
  const light = new THREE.PointLight(MAGENTA, 30, 22); light.position.z = 4; body.add(light);
  return { root: g, body, panels, windows, irisM, light };
}

export class Nova {
  constructor(scene, home, world, effects, level, spawnMinion) {
    this.scene = scene; this.home = home.clone(); this.world = world; this.effects = effects; this.spawnMinion = spawnMinion;
    this.isBoss = true; this.glitched = true; this.radius = 2.8; this.name = 'NOVA';
    this.mat = { opacity: 1 };
    const L = Math.max(15, level), ref = 100 + 10 * (L - 1);
    this.maxHp = 3600 + 220 * L; this.hp = this.maxHp;
    this.dmg = { window: Math.round(ref * 0.22), beam: Math.round(ref * 0.2), slam: Math.round(ref * 0.25) };
    this.xp = 800;
    this.m = novaModel(); this.group = new THREE.Group(); this.group.add(this.m.root); scene.add(this.group);
    this.portrait = { obj: this.m.root, focus: 0.5, dist: 9, side: 0.1 };
    this.floorY = world.groundAt(home.x, home.z);
    // Telegraph pools.
    this.marks = []; this.drops = [];
    this.markGeo = new THREE.PlaneGeometry(3, 3); this.markGeo.rotateX(-Math.PI / 2);
    this.winGeo = new THREE.BoxGeometry(3, 2, 0.3);
    // Delete beam.
    this.beam = new THREE.Group(); this.beam.position.set(home.x, this.floorY + 0.5, home.z); scene.add(this.beam);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 15), new THREE.MeshBasicMaterial({ color: 0xff2b55 })); bm.position.z = 7.5; this.beam.add(bm);
    this.beam2 = bm.clone(); this.beam2.position.z = -7.5; this.beam.add(this.beam2);
    this.beamMesh = bm; this.beam.visible = false;
    this.reloadTag = label('RELOADING...', '#ffcc4d', 4); this.reloadTag.visible = false; scene.add(this.reloadTag);
    this.stars = new THREE.Group();
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffe28a })); st.userData.a = i / 4 * Math.PI * 2; this.stars.add(st); }
    this.stars.visible = false; this.group.add(this.stars);
    this.clones = [];
    this.reset();
  }

  reset() {
    this.hp = this.maxHp; this.dead = false; this.active = false; this.frozen = 0; this.stunned = 0; this.patchMult = 2;
    this.pos = this.home.clone(); this.pos.y = this.floorY; this.knock = new THREE.Vector3(); this.facing = 0;
    this.state = 'idle'; this.stateT = 0; this.cycle = 0; this.enraged = false; this.summoned = [false, false, false]; this.eyeGlitch = false; this.deathT = 0; this.hitFlash = 0;
    this.y = 6.2; this.group.visible = false; this.group.scale.setScalar(1);
    for (const m of this.marks) this.scene.remove(m.mesh); this.marks = [];
    for (const d of this.drops) this.scene.remove(d.mesh); this.drops = [];
    this.beam.visible = false; this.reloadTag.visible = false;
  }
  activate() { this.active = true; this.group.visible = true; this.state = 'rain'; this.stateT = 0; sfx('bossRoar'); }
  get alive() { return !this.dead && this.active; }
  get down() { return this.state === 'reload' || this.state === 'stunned'; }
  get glitchedActive() { return this.alive && this.eyeGlitch; }
  get patched() { return !this.eyeGlitch; }

  takeHit(amount, fromPos, opts = {}) {
    if (!this.alive) return 0;
    if (!this.down) { if ((this.highMsgT || 0) <= 0 && !opts.pierce) { this.highMsgT = 3; this.onOutOfReach?.(); } return 0; }
    let dmg = this.frozen > 0 ? Math.round(amount * this.patchMult) : this.eyeGlitch ? Math.round(amount * 0.4) : amount;
    this.hp -= dmg; this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.deathT = 0; this.beam.visible = false; this.reloadTag.visible = false;
      for (const m of this.marks) this.scene.remove(m.mesh); this.marks = [];
      sfx('bossDie'); this.onDefeat?.();
    }
    return dmg;
  }
  stun(t) { if (this.alive && this.down) this.stunned = Math.max(this.stunned, t * 0.5); }
  patch(bonus = 0) {
    if (!this.eyeGlitch || !this.down) return false;
    this.eyeGlitch = false; this.frozen = 4 + bonus; this.state = 'stunned'; this.stateT = 0;
    this.effects.burst(this.pos.clone().setY(this.floorY + 3), 34, [0, 2], 7);
    this.patchMsg = 'SYSTEM PATCHED!\nNOVA is stunned - x2 DAMAGE!';
    this.onPatched?.();
    return true;
  }

  #rain(player, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = i === 0 ? 0 : 2.5 + Math.random() * 6;
      const p = player.pos.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
      const c = this.home, dc = Math.hypot(p.x - c.x, p.z - c.z); if (dc > 13.5) { p.x = c.x + (p.x - c.x) / dc * 13.5; p.z = c.z + (p.z - c.z) / dc * 13.5; }
      const mesh = new THREE.Mesh(this.markGeo, new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.4, depthWrite: false }));
      mesh.position.set(p.x, this.floorY + 0.06, p.z); this.scene.add(mesh);
      this.marks.push({ mesh, t: -(i * 0.18), p });
    }
    sfx('warn');
  }

  update(dt, t, player, world) {
    if (!this.active) return null;
    const m = this.m;
    m.windows.rotation.y += dt * (this.enraged ? 0.9 : 0.5); m.panels.rotation.y -= dt * 0.3;
    if (this.dead) {
      this.deathT += dt;
      const k = Math.max(0, 1 - this.deathT / 2.5);
      this.y = Math.max(this.y - dt * 2, 1); this.group.scale.setScalar(Math.max(0.01, 0.4 + k * 0.6));
      if (Math.random() < 0.6) this.effects.burst(this.pos.clone().setY(this.floorY + this.y + (Math.random() - 0.5) * 3), 4, [0, 1, 2], 5);
      this.group.position.set(this.pos.x, this.floorY + this.y, this.pos.z);
      if (k <= 0) this.group.visible = false;
      return null;
    }
    let attack = null;
    this.stateT += dt; this.highMsgT = (this.highMsgT || 0) - dt;
    const hpF = this.hp / this.maxHp;
    if (!this.enraged && hpF < 0.33) { this.enraged = true; sfx('bossRoar'); this.onEnrage?.(); }
    const rage = this.enraged ? 1.35 : 1;
    if (this.frozen > 0) this.frozen -= dt;
    // Error windows: telegraph, then crash down.
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mk = this.marks[i]; mk.t += dt;
      if (mk.t < 0) { mk.mesh.visible = false; continue; }
      mk.mesh.visible = true; mk.mesh.material.opacity = 0.25 + Math.sin(mk.t * 30) * 0.15 + mk.t * 0.2;
      if (mk.t > 1.1 / rage && !mk.fired) {
        mk.fired = true;
        const w = new THREE.Mesh(this.winGeo, new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? MAGENTA : CYAN }));
        w.position.set(mk.p.x, this.floorY + 14, mk.p.z); w.rotation.x = -Math.PI / 2; this.scene.add(w); this.drops.push({ mesh: w, mk, t: 0 });
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t += dt; d.mesh.position.y -= dt * 40;
      if (d.mesh.position.y <= this.floorY + 0.2) {
        this.effects.shockwave(d.mk.p.clone().setY(this.floorY), 1.8); sfx('bossSlam', d.mk.p, 0.5);
        if (player.alive && Math.hypot(player.pos.x - d.mk.p.x, player.pos.z - d.mk.p.z) < 1.8) attack = attack || { damage: this.dmg.window, from: d.mk.p.clone(), enemy: this, direct: true };
        this.scene.remove(d.mesh); this.scene.remove(d.mk.mesh); this.drops.splice(i, 1);
        const k = this.marks.indexOf(d.mk); if (k >= 0) this.marks.splice(k, 1);
      }
    }
    // Phase summons.
    [0.75, 0.5, 0.25].forEach((th, i) => {
      if (!this.summoned[i] && hpF < th) {
        this.summoned[i] = true; this.onSummon?.();
        for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + Math.random(); this.spawnMinion(new THREE.Vector3(this.home.x + Math.cos(a) * 9, this.floorY, this.home.z + Math.sin(a) * 9), k === 0); }
      }
    });
    const wantY = this.down ? 2.6 : 6.2;
    this.y += (wantY - this.y) * Math.min(1, dt * (this.down ? 3 : 1.5));
    switch (this.state) {
      case 'rain':
        if (this.stateT < 0.1 && !this.rained) { this.rained = true; this.#rain(player, this.enraged ? 7 : 5); }
        if (this.stateT > 1.4 / rage && this.rains < (this.enraged ? 4 : 3)) { this.rains++; this.stateT = 0.11; this.#rain(player, this.enraged ? 7 : 5); }
        if (this.rains === undefined) this.rains = 0;
        if (this.stateT > 2.2 && this.rains >= (this.enraged ? 4 : 3)) { this.state = 'beamWind'; this.stateT = 0; this.rains = 0; this.rained = false; this.beam.visible = true; this.beamMesh.material.opacity = 1; this.beam2.visible = this.enraged; sfx('warn'); this.beamA = Math.atan2(player.pos.x - this.home.x, player.pos.z - this.home.z) + Math.PI / 2; }
        break;
      case 'beamWind':
        this.beam.rotation.y = this.beamA; this.beam.scale.y = 0.3 + Math.sin(this.stateT * 30) * 0.2;
        if (this.stateT > 1.0) { this.state = 'beam'; this.stateT = 0; this.beam.scale.y = 1; sfx('sweep'); this.onBeam?.(); }
        break;
      case 'beam': {
        const speed = (this.enraged ? 2.3 : 1.85);
        this.beam.rotation.y = this.beamA + this.stateT * speed;
        // Contact: Jasper on the ground, near the beam line.
        if (player.alive && player.onGround && (this.beamHitT || 0) <= 0) {
          const rel = player.pos.clone().sub(this.home).setY(0), d = rel.length();
          for (const sgn of this.enraged ? [1, -1] : [1]) {
            const dir = new THREE.Vector3(Math.sin(this.beam.rotation.y), 0, Math.cos(this.beam.rotation.y)).multiplyScalar(sgn);
            const along = rel.dot(dir), perp = Math.abs(rel.x * dir.z - rel.z * dir.x);
            if (along > 0 && along < 15 && perp < 0.55 && d > 0.5) { attack = attack || { damage: this.dmg.beam, from: this.home.clone(), enemy: this, direct: true }; this.beamHitT = 0.8; }
          }
        }
        this.beamHitT = (this.beamHitT || 0) - dt;
        if (this.stateT > Math.PI * 2 / speed) { this.beam.visible = false; this.state = 'reload'; this.stateT = 0; this.eyeGlitch = Math.random() < 0.7; this.reloadTag.visible = true; sfx('glitchBig'); this.onReload?.(this.eyeGlitch); }
        break;
      }
      case 'reload':
        this.reloadTag.position.set(this.pos.x, this.floorY + 6.4, this.pos.z); this.reloadTag.lookAt(player.pos.clone().setY(this.floorY + 6.4));
        if (this.stateT > (this.enraged ? 3.8 : 4.8)) { this.reloadTag.visible = false; this.eyeGlitch = false; this.state = 'rain'; this.stateT = 0; this.cycle++;
          // Rising back up: a shockwave pushes Jasper away.
          this.effects.shockwave(this.pos.clone().setY(this.floorY), 5); sfx('bossSlam');
          if (player.alive && player.onGround && Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z) < 5) attack = attack || { damage: this.dmg.slam, from: this.pos.clone(), enemy: this, direct: true };
        }
        break;
      case 'stunned':
        this.reloadTag.visible = false;
        if (this.frozen <= 0) { this.state = 'reload'; this.stateT = 3; this.reloadTag.visible = true; }
        break;
    }
    // Look at Jasper; the eye flickers while glitched.
    const look = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    let dd = look - this.facing; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); this.facing += dd * Math.min(1, dt * 2);
    m.irisM.color.set(this.frozen > 0 ? CYAN : this.eyeGlitch && Math.sin(t * 30) > 0 ? 0xffffff : MAGENTA);
    m.light.intensity = this.down ? 60 : 30;
    m.body.position.x = this.eyeGlitch && Math.sin(t * 41) > 0.85 ? (Math.random() - 0.5) * 0.4 : 0;
    this.stars.visible = this.state === 'stunned';
    if (this.stars.visible) { this.stars.position.y = 3.6; this.stars.children.forEach(st => { const a = st.userData.a + t * 4; st.position.set(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4); }); }
    this.m.root.scale.setScalar(this.hitFlash > 0 ? 1.05 : 1); this.hitFlash -= dt;
    this.group.position.set(this.pos.x, this.floorY + this.y + Math.sin(t * 1.4) * (this.down ? 0.1 : 0.5), this.pos.z);
    this.group.rotation.y = this.facing;
    return attack;
  }
}
export { Placeholder };
