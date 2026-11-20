// Jasper: movement, sword combat, Debug Dash, block/parry, Blade Storm, Patch
// and the animation state machine.
import * as THREE from 'three';
import { heightAt } from './world.js';

const CFG = {
  walk: 2.2, jog: 4.6, sprint: 7.2, accel: 14, turn: 12,
  gravity: 22, jumpVel: 7.5,
  dashSpeed: 9.5, dashCost: 25, heavyCost: 20, skillCost: 40,
  staminaRegen: 28, patchCooldown: 8, patchRange: 10, skillCooldown: 6,
  parryWindow: 0.28,
};

// Attack moves. hits = clip times (seconds) when the blade connects; end = when the move can chain/finish.
const MOVES = {
  // Bare-handed chain (before Bram gives Jasper the sword).
  p1: { clip: 'Punch_Jab', ts: 1.5, hits: [0.16], dmg: 6, reach: 2.0, arc: 1.6, lunge: 2.0, end: 0.42, next: 'p2', noSlash: true, punch: true, step: 1 },
  p2: { clip: 'Punch_Cross', ts: 1.5, hits: [0.18], dmg: 7, reach: 2.0, arc: 1.6, lunge: 2.2, end: 0.5, next: 'p3', noSlash: true, punch: true, step: 2 },
  p3: { clip: 'Melee_Hook', ts: 1.1, hits: [0.25], dmg: 10, reach: 2.1, arc: 1.8, lunge: 2.2, end: 0.47, noSlash: true, punch: true, knock: 6, step: 3 },
  // Light chain: keep tapping attack to flow through 8 moves.
  A: { clip: 'Sword_Regular_A', ts: 1.2, hits: [0.24], dmg: 10, reach: 2.6, arc: 1.8, lunge: 2.4, rec: 'Sword_Regular_A_Rec', next: 'B', branch: 'bash', step: 1 },
  B: { clip: 'Sword_Regular_B', ts: 1.2, hits: [0.24], dmg: 11, reach: 2.6, arc: 1.8, lunge: 2.4, rec: 'Sword_Regular_B_Rec', next: 'jab', branch: 'breaker', step: 2 },
  jab: { clip: 'Punch_Jab', ts: 1.5, hits: [0.16], dmg: 7, reach: 2.0, arc: 1.6, lunge: 2.0, end: 0.42, next: 'hook', noSlash: true, punch: true, step: 3 },
  hook: { clip: 'Melee_Hook', ts: 1.1, hits: [0.25], dmg: 9, reach: 2.1, arc: 1.8, lunge: 2.2, end: 0.47, next: 'spin1', noSlash: true, punch: true, stun: 0.5, step: 4 },
  spin1: { clip: 'Sword_Heavy_Combo', ts: 1.35, from: 0.85, hits: [1.17], dmg: 13, reach: 2.8, arc: 2.6, lunge: 2.4, end: 1.45, next: 'spin2', wide: true, color: 0x7ff3ff, step: 5 },
  spin2: { clip: 'Sword_Heavy_Combo', ts: 1.35, from: 1.5, hits: [1.78], dmg: 14, reach: 2.8, arc: 2.6, lunge: 2.4, end: 2.05, next: 'stab', wide: true, color: 0x7ff3ff, step: 6 },
  stab: { clip: 'Sword_Dash', ts: 1.3, hits: [0.3], dmg: 16, reach: 3.2, arc: 1.4, lunge: 8, lungeT: 0.15, end: 0.75, next: 'C', knock: 6, step: 7 },
  C: { clip: 'Sword_Regular_C', ts: 1.3, hits: [0.63], dmg: 24, reach: 3.2, arc: 3.0, lunge: 3.2, end: 1.15, knock: 10, wide: true, color: 0xffe28a, shatter: true, shock: true, step: 8, name: 'FINISHER!' },
  heavy: { clip: 'Sword_Attack', ts: 1.15, hits: [0.38], dmg: 26, reach: 3.2, arc: 3.2, lunge: 2.6, end: 1.05, knock: 10, wide: true, color: 0xffe28a, shock: true, shatter: true },
  dashAtk: { clip: 'Sword_Dash', ts: 1.25, hits: [0.3], dmg: 22, reach: 3.2, arc: 2.4, lunge: 8, lungeT: 0.15, end: 0.95, knock: 8, wide: true },
  bash: { clip: 'Melee_Hook', ts: 1.0, hits: [0.24], dmg: 8, reach: 2.2, arc: 1.8, lunge: 2.0, end: 0.47, stun: 1.4, color: 0xffffff, name: 'POMMEL BASH' },
  breaker: { clip: 'Sword_Attack', ts: 1.3, hits: [0.38], dmg: 24, reach: 3.0, arc: 2.4, lunge: 2.6, end: 1.0, knock: 9, wide: true, color: 0xff2bd6, pierce: true, shatter: true, name: 'GLITCH BREAKER' },
  riposte: { clip: 'Sword_Regular_C', ts: 1.7, hits: [0.63], dmg: 34, reach: 3.0, arc: 3.0, lunge: 3.0, end: 1.0, knock: 11, wide: true, color: 0xffe28a, shatter: true, name: 'COUNTER!' },
  slide: { clip: 'Slide_Start', ts: 1.2, hits: [0.12, 0.3, 0.48], dmg: 6, reach: 1.8, arc: 2.2, lunge: 9.5, lungeT: 0.75, end: 0.7, stun: 1.0, invuln: true, noSlash: true, then: 'Slide_Exit' },
  throw: { clip: 'OverhandThrow', ts: 1.4, hits: [], end: 0.75, lunge: 0, release: 0.36 },
  skill: { clip: 'Sword_Heavy_Combo', ts: 1.4, hits: [0.38, 1.17, 1.78, 2.6], dmg: 15, reach: 3.3, arc: Math.PI * 2, lunge: 1.2, end: 3.0, knock: 6, wide: true, color: 0xff2bd6, armor: true },
};

export class Player {
  constructor(char, clips, scene, ctx) {
    this.char = char; this.ctx = ctx; // ctx: { world, effects, hud, enemies, camera, hitStop }
    this.root = char.root;
    this.group = new THREE.Group(); this.group.add(this.root); scene.add(this.group);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const c of clips) {
      c.tracks = c.tracks.filter(t => !/^root\.position/.test(t.name)); // no root motion
      this.actions[c.name] = this.mixer.clipAction(c);
    }
    const loops = ['Idle_Loop', 'Sword_Idle', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Loop'];
    for (const [n, a] of Object.entries(this.actions)) if (!loops.includes(n)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }

    this.maxHp = 100; this.hp = 100; this.stamina = 100; this.level = 1; this.xp = 0;
    this.pos = new THREE.Vector3(0, heightAt(0, 0), 0);
    this.vel = new THREE.Vector3(); this.velY = 0; this.onGround = true;
    this.facing = Math.PI; this.state = 'move'; this.stateT = 0;
    this.queued = false; this.invuln = 0; this.patchCd = 0; this.skillCd = 0; this.throwCd = 0; this.current = null;
    this.riposteT = 0; this.projectiles = [];
    this.unlocks = { sword: true, patch: true, skill: true };
    this.armed = true; this.combatT = 0; this.comboCount = 0;
    this.#disarm(); this.play('Idle_Loop', 0);
  }

  get alive() { return this.state !== 'dead'; }

  play(name, fade = 0.15, timeScale = 1, from = 0) {
    const next = this.actions[name];
    if (!next) return null;
    if (this.current === next && next.loop === THREE.LoopRepeat) { next.timeScale = timeScale; return next; }
    next.reset(); next.time = from; next.timeScale = timeScale; next.setEffectiveWeight(1); next.play();
    if (this.current && this.current !== next) this.current.crossFadeTo(next, fade, false);
    this.current = next;
    return next;
  }

  #toMove() { this.state = 'move'; this.stateT = 0; this.queued = false; this.move = null; this.ctx.hud.combo(0); this.#locomotion(); }

  #moveDir(input, camYaw) {
    const f = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    return f.multiplyScalar(input.move.y).add(r.multiplyScalar(input.move.x));
  }

  // Face the stick direction if held, otherwise the nearest enemy in range.
  #aim(input, camYaw, range = 4) {
    const mv = this.#moveDir(input, camYaw);
    if (mv.lengthSq() > 0.09) { this.facing = Math.atan2(mv.x, mv.z); return; }
    let best = null, bestD = range;
    for (const e of this.ctx.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) this.facing = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
  }

  #startMove(key, input, camYaw) {
    const m = MOVES[key];
    if (key === 'heavy' && this.stamina < CFG.heavyCost) return this.ctx.hud.flash('st');
    if (key === 'skill') {
      if (this.skillCd > 0) return;
      if (this.stamina < CFG.skillCost) return this.ctx.hud.flash('st');
      this.stamina -= CFG.skillCost; this.skillCd = CFG.skillCooldown;
      this.ctx.hud.system('> BLADE STORM.exe', 1.2);
    }
    if (key === 'heavy') this.stamina -= CFG.heavyCost;
    if (key === 'breaker' || key === 'bash') { if (this.stamina < 12) return this.ctx.hud.flash('st'); this.stamina -= 12; }
    if (key === 'slide') { if (this.stamina < CFG.dashCost) return this.ctx.hud.flash('st'); this.stamina -= CFG.dashCost; }
    if (key === 'throw') {
      if (this.throwCd > 0) return;
      if (this.stamina < 10) return this.ctx.hud.flash('st');
      this.stamina -= 10; this.throwCd = 1.0; this.thrown = false;
    }
    if (key === 'slide') { const mv = this.#moveDir(input, camYaw); if (mv.lengthSq() > 0.01) this.facing = Math.atan2(mv.x, mv.z); }
    else this.#aim(input, camYaw, key === 'throw' ? 20 : 4);
    if (m.name) this.ctx.hud.float(this.pos.clone().add(new THREE.Vector3(0, 2.3, 0)), m.name, 'xp');
    if (m.invuln) this.invuln = 0.6;
    this.state = 'act'; this.move = m; this.moveKey = key; this.stateT = 0; this.queued = false; this.queuedBranch = false; this.hitIdx = 0;
    this.action = this.play(m.clip, 0.07, m.ts, m.from || 0);
    if (m.step) { this.comboCount = m.step; this.ctx.hud.combo(m.step); }
    this.#arm();
  }

  // Sword in hand vs. on the back.
  #arm() {
    this.combatT = 4;
    if (this.armed || !this.unlocks.sword) return;
    this.armed = true; this.char.draw?.();
    this.ctx.effects.burst(this.char.tip.getWorldPosition(new THREE.Vector3()), 8, [0, 2], 2);
  }

  #disarm() {
    if (!this.armed) return;
    this.armed = false; this.char.sheathe?.();
    if (this.state === 'move') this.#locomotion();
  }

  #startDash(input, camYaw) {
    if (this.stamina < CFG.dashCost) return this.ctx.hud.flash('st');
    this.stamina -= CFG.dashCost;
    const mv = this.#moveDir(input, camYaw);
    if (mv.lengthSq() > 0.01) this.facing = Math.atan2(mv.x, mv.z);
    this.state = 'dash'; this.stateT = 0; this.invuln = 0.45;
    this.play('Roll', 0.06, 1.45);
    this.dashDur = Math.min(0.6, this.current.getClip().duration / 1.45);
    this.ctx.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 8, [0, 1], 3);
  }

  #startBlock() {
    this.#arm();
    this.state = 'block'; this.stateT = 0;
    this.play('Sword_Block', 0.06, 1.6);
  }

  #startAirAttack() {
    this.#arm();
    this.state = 'air'; this.stateT = 0; this.velY = Math.min(this.velY, 2) - 6;
    this.action = this.play('Sword_Attack', 0.06, 1.3, 0.12);
  }

  // Patch has one job: fix a GLITCHED (purple) enemy. Fixed enemies freeze and take double damage.
  patchTarget() {
    if (!this.unlocks.patch) return null;
    let best = null, bestD = CFG.patchRange;
    for (const e of this.ctx.enemies) {
      if (!e.glitchedActive || !e.alive) continue;
      const d = e.pos.distanceTo(this.pos) - (e.radius || 0.5);
      if (d < bestD) { bestD = d; best = e; }
    }
    for (const o of this.ctx.patchables || []) {
      if (!o.canPatch()) continue;
      const d = o.pos.distanceTo(this.pos) - (o.range || 0);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  #startPatch() {
    if (this.patchCd > 0) return;
    const best = this.patchTarget();
    if (!best) { this.ctx.hud.system('Nothing glitched nearby to patch'); return; }
    this.facing = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
    this.state = 'cast'; this.stateT = 0; this.patchCd = CFG.patchCooldown;
    this.play('Spell_Simple_Shoot', 0.08, 1.5);
    this.patchTarget_ = best; this.patchFired = false;
  }

  #locomotion() {
    if (!this.onGround) return this.play('Jump_Loop', 0.15);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp < 0.3) this.play(this.armed ? 'Sword_Idle' : 'Idle_Loop', 0.3);
    else if (sp < 3.2) this.play('Walk_Loop', 0.2, Math.max(0.8, sp / CFG.walk));
    else if (sp < 6) this.play('Jog_Fwd_Loop', 0.2, sp / CFG.jog);
    else this.play('Sprint_Loop', 0.2, sp / CFG.sprint);
  }

  damage(amount, from, enemy) {
    if (!this.alive || this.invuln > 0) return;
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const toEnemy = from.clone().sub(this.pos).setY(0).normalize();
    const facingIt = fwd.dot(toEnemy) > -0.1;
    if (this.state === 'block' && facingIt) {
      const at = this.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).addScaledVector(toEnemy, 0.6);
      if (this.stateT < CFG.parryWindow) {
        // Perfect timing: parry.
        enemy?.stun(1.8, this.pos);
        this.stamina = Math.min(100, this.stamina + 15);
        this.riposteT = 1.2;
        this.ctx.hud.system('> PARRY! Attack now to COUNTER', 1.2);
        this.ctx.hud.float(at, 'PARRY!', 'crit');
        this.ctx.effects.burst(at, 18, [2, 0], 5);
        this.ctx.effects.slash(this.pos, this.facing, 0xffe28a, true);
        this.ctx.camera.shake(0.2); this.ctx.hitStop(0.12);
        return;
      }
      this.stamina -= 14;
      if (this.stamina > 0) {
        const chip = Math.max(1, Math.round(amount * 0.15));
        this.hp = Math.max(1, this.hp - chip);
        this.ctx.hud.float(at, 'BLOCK', '');
        this.ctx.effects.burst(at, 6, [2], 3);
        this.vel.addScaledVector(toEnemy, -3);
        this.ctx.camera.shake(0.08);
        return;
      }
      this.stamina = 0;
      this.ctx.hud.float(at, 'GUARD BREAK', 'hurt');
    }
    this.combatT = 4;
    const armor = this.state === 'act' && this.move?.armor;
    const dmg = armor ? Math.ceil(amount * 0.5) : amount;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = 0.6;
    this.ctx.hud.float(this.pos.clone().add(new THREE.Vector3(0, 2.1, 0)), '-' + dmg, 'hurt');
    this.ctx.hud.hurt();
    this.vel.addScaledVector(toEnemy, -6);
    if (this.hp <= 0) {
      this.state = 'dead'; this.stateT = 0; this.play('Death01', 0.1);
      this.ctx.hud.death(true);
      return;
    }
    if (!armor && (this.state === 'move' || this.state === 'block' || this.state === 'recover')) {
      this.state = 'hit'; this.stateT = 0; this.play('Hit_Chest', 0.05, 1.2);
    }
  }

  // Debug Shard: a thrown pixel that homes slightly toward its target.
  #throwShard() {
    const from = this.pos.clone().add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)), 0.5);
    let target = null, bestD = 22;
    for (const e of this.ctx.enemies) { if (!e.alive) continue; const d = e.pos.distanceTo(this.pos); if (d < bestD) { bestD = d; target = e; } }
    const dir = new THREE.Vector3(Math.sin(this.facing), -0.03, Math.cos(this.facing));
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0x29e6ff }));
    mesh.position.copy(from); this.ctx.effects.scene.add(mesh);
    this.projectiles.push({ mesh, dir, target, life: 1.4, speed: 24 });
  }

  #updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.target?.alive) {
        const want = pr.target.pos.clone().add(new THREE.Vector3(0, 0.6, 0)).sub(pr.mesh.position).normalize();
        pr.dir.lerp(want, Math.min(1, dt * 6)).normalize();
      }
      pr.mesh.position.addScaledVector(pr.dir, pr.speed * dt);
      pr.mesh.rotation.x += dt * 15; pr.mesh.rotation.y += dt * 11;
      if (Math.random() < 0.6) this.ctx.effects.burst(pr.mesh.position.clone(), 1, [0, 1], 0.5);
      let hit = null;
      for (const e of this.ctx.enemies) if (e.alive && e.pos.clone().setY(pr.mesh.position.y - 0.6).distanceTo(pr.mesh.position) < 0.8 && Math.abs(pr.mesh.position.y - (e.group.position.y + 0.6)) < 1) { hit = e; break; }
      if (hit) {
        const frozen = hit.frozen > 0;
        const dmg = hit.takeHit(14 + (this.level - 1) * 2, this.pos);
        const at = hit.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
        this.ctx.hud.float(at, String(dmg), frozen ? 'crit' : '');
        this.ctx.effects.burst(at, 10, [0, 1, 2], 4);
        if (!hit.alive) { const xp = hit.glitched ? 35 : 20; this.gainXp(xp); this.ctx.hud.float(at.clone().add(new THREE.Vector3(0, 0.6, 0)), `+${xp} XP`, 'xp'); this.ctx.onKill?.(hit); }
      }
      if (hit || pr.life <= 0) { this.ctx.effects.scene.remove(pr.mesh); pr.mesh.geometry.dispose(); this.projectiles.splice(i, 1); }
    }
  }

  gainXp(n) {
    this.xp += n;
    while (this.xp >= this.level * 100) {
      this.xp -= this.level * 100; this.level++;
      this.maxHp += 10; this.hp = this.maxHp;
      this.ctx.hud.system(`> LEVEL UP: LV ${this.level}\n> MAX HP +10`);
      this.ctx.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 24, [0, 2, 3], 5);
    }
  }

  // Play a story animation; input is ignored until it ends.
  playCut(name, ts = 1, from = 0) {
    this.state = 'cut'; this.stateT = 0; this.vel.set(0, 0, 0);
    const a = this.play(name, 0.0, ts, from);
    this.cutDur = a ? (a.getClip().duration - from) / ts : 0.5;
  }

  spawnAt(p, facing = this.facing) {
    this.pos.set(p.x, this.ctx.world.groundAt(p.x, p.z), p.z); this.vel.set(0, 0, 0); this.facing = facing; this.velY = 0; this.onGround = true;
    this.#applyTransform();
  }

  respawn() {
    const sp = this.ctx.respawnPoint ? this.ctx.respawnPoint() : new THREE.Vector3();
    this.hp = this.maxHp; this.stamina = 100; this.spawnAt(sp);
    this.state = 'move'; this.invuln = 1.5; this.ctx.hud.death(false);
    this.current?.stop(); this.current = null; this.#disarm(); this.play('Idle_Loop', 0);
    this.ctx.hud.system('> RESPAWN: save crystal restored');
  }

  // Deal damage in a cone (or circle) in front of Jasper.
  #strike(m, noSlash) {
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    if (!noSlash && !m.noSlash) this.ctx.effects.slash(this.pos, this.facing + (m.arc > 6 ? this.hitIdx * 1.7 : 0), m.color ?? 0x29e6ff, m.wide);
    if (m.shock) this.ctx.effects.shockwave(this.pos.clone().addScaledVector(fwd, 1.6), 3.2);
    let landed = false;
    for (const e of this.ctx.enemies) {
      if (!e.alive) continue;
      const to = e.pos.clone().sub(this.pos).setY(0);
      const d = to.length() - ((e.radius || 0.5) - 0.5);
      if (d > m.reach) continue;
      if (m.arc < 6 && d > 0.4 && Math.acos(THREE.MathUtils.clamp(to.normalize().dot(fwd), -1, 1)) > m.arc / 2) continue;
      const frozen = e.frozen > 0;
      let base = m.dmg + Math.floor(Math.random() * 4) + (this.level - 1) * 2;
      const shatter = frozen && m.shatter;
      if (shatter) base = Math.round(base * 1.25);
      const dmg = e.takeHit(base, this.pos, { pierce: m.pierce });
      if (shatter) {
        // SHATTER: break the ice, splash damage around the target.
        if (!e.isBoss) { e.frozen = 0; if (e.ice) e.ice.visible = false; if (e.tagFixed) e.tagFixed.visible = false; }
        this.ctx.effects.shockwave(e.pos.clone(), 3.0);
        this.ctx.effects.burst(e.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 26, [0, 2], 6);
        this.ctx.hud.float(e.pos.clone().add(new THREE.Vector3(0, 2.0, 0)), 'SHATTER!', 'crit');
        for (const o of this.ctx.enemies) if (o !== e && o.alive && o.pos.distanceTo(e.pos) < 3.2) {
          const sd = o.takeHit(14, e.pos); this.ctx.hud.float(o.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), String(sd), '');
        }
      }
      if (m.stun && e.alive) e.stun(m.stun, this.pos);
      if (m.knock && !frozen) e.knock.multiplyScalar(m.knock / 6);
      const at = e.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
      this.ctx.hud.float(at, String(dmg), frozen ? 'crit' : '');
      if (e.glitchedActive && !frozen && !m.pierce) this.ctx.hud.float(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 'RESIST - use PATCH', 'hurt');
      this.ctx.effects.burst(at, frozen ? 16 : 8, e.glitched ? [0, 1, 2] : [3, 2], 4);
      landed = true;
      if (!e.alive) {
        const xp = e.glitched ? 35 : 20;
        this.gainXp(xp);
        this.ctx.hud.float(at.clone().add(new THREE.Vector3(0, 0.6, 0)), `+${xp} XP`, 'xp');
        this.ctx.onKill?.(e);
      }
    }
    if (landed) { this.ctx.camera.shake(m.wide ? 0.22 : 0.12); this.ctx.hitStop(m.wide ? 0.07 : 0.045); }
  }

  update(dt, input, camYaw) {
    const { world } = this.ctx;
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.patchCd = Math.max(0, this.patchCd - dt);
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.throwCd = Math.max(0, this.throwCd - dt);
    if (this.armed && this.state === 'move') {
      // Auto-sheathe 4s after the last attack, unless a slime is right next to Jasper.
      const close = this.ctx.enemies.some(e => e.alive && e.pos.distanceTo(this.pos) < 3.5);
      if (close) this.combatT = Math.max(this.combatT, 1);
      this.combatT -= dt;
      if (this.combatT <= 0) this.#disarm();
    }
    this.riposteT = Math.max(0, this.riposteT - dt);
    this.#updateProjectiles(dt);
    const regen = this.state === 'move' ? 1 : this.state === 'block' ? 0.25 : 0.45;
    if (this.state !== 'dash') this.stamina = Math.min(100, this.stamina + CFG.staminaRegen * dt * regen);

    if (this.state === 'cut') {
      if (this.stateT >= this.cutDur) this.#toMove();
      this.mixer.update(dt); this.#applyTransform(); return;
    }
    if (this.state === 'dead') {
      if (this.stateT > 3.2) this.respawn();
      this.mixer.update(dt); this.#applyTransform(); return;
    }

    const free = this.state === 'move' || this.state === 'recover';
    const moving = Math.hypot(input.move.x, input.move.y) > 0.15;

    // --- Actions ---
    if (input.consume('dash') && (free || this.state === 'act' || this.state === 'hit' || this.state === 'block') && this.onGround) {
      const sprinting = this.state === 'move' && input.sprint && Math.hypot(this.vel.x, this.vel.z) > 5.5;
      if (sprinting && this.unlocks.sword) this.#startMove('slide', input, camYaw);
      else if (this.state !== 'act' || this.stateT > 0.12) this.#startDash(input, camYaw);
    }
    if (!this.unlocks.sword) { input.consume('heavy'); input.consume('sheathe'); input.consume('skill'); if (input.blocking) {} }
    if (!this.unlocks.patch) input.consume('patch');
    if (!this.unlocks.skill) input.consume('skill');
    if (input.consume('sheathe') && free) {
      if (this.armed) { this.combatT = 0; this.#disarm(); this.ctx.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1.5, -0.2)), 6, [0, 2], 1.5); }
      else this.#arm();
      this.#locomotion();
    }
    if (input.consume('patch') && free) this.#startPatch();
    if (input.consume('skill') && free && this.onGround) this.#startMove('skill', input, camYaw);
    if (input.consume('heavy')) {
      if (this.state === 'recover' && this.recoverBranch) this.#startMove(this.recoverBranch, input, camYaw);
      else if (this.state === 'act' && this.move.branch && this.stateT > 0.08) this.queuedBranch = true;
      else if (free && this.onGround) this.#startMove('heavy', input, camYaw);
    }
    if (input.blocking && free && this.onGround && this.unlocks.sword) this.#startBlock();
    if (input.consume('attack')) {
      if (!this.onGround && this.state === 'move' && this.unlocks.sword) this.#startAirAttack();
      else if (this.state === 'dash' && this.stateT > this.dashDur * 0.35 && this.unlocks.sword) this.#startMove('dashAtk', input, camYaw);
      else if (this.state === 'move' && this.onGround && input.sprint && Math.hypot(this.vel.x, this.vel.z) > 5.5 && this.unlocks.sword) this.#startMove('dashAtk', input, camYaw);
      else if (this.state === 'move' && this.onGround && this.riposteT > 0) { this.riposteT = 0; this.#startMove('riposte', input, camYaw); }
      else if (this.state === 'block' && this.riposteT > 0) { this.riposteT = 0; this.current.timeScale = 1; this.#startMove('riposte', input, camYaw); }
      else if (this.state === 'move' && this.onGround) this.#startMove(this.unlocks.sword ? 'A' : 'p1', input, camYaw);
      else if (this.state === 'recover' && this.recoverNext) this.#startMove(this.recoverNext, input, camYaw);
      else if (this.state === 'act' && this.move.next && this.stateT > 0.08) this.queued = true;
    }
    if (input.consume('jump') && free && this.onGround) { this.state = 'move'; this.velY = CFG.jumpVel; this.onGround = false; this.play('Jump_Start', 0.08, 1.4); }

    // --- State logic ---
    const desired = new THREE.Vector3();
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    if (this.state === 'move' || this.state === 'recover') {
      if (this.state === 'recover' && (moving || this.stateT > this.recoverDur)) this.#toMove();
      const mv = this.#moveDir(input, camYaw);
      const mag = Math.min(1, mv.length());
      if (mag > 0.05 && this.state === 'move') {
        mv.normalize();
        const touch = 'ontouchstart' in window;
        const speed = input.sprint && this.stamina > 5 ? CFG.sprint : (mag < 0.5 && !touch ? CFG.walk : CFG.jog * Math.max(0.5, mag));
        desired.copy(mv).multiplyScalar(speed);
        const target = Math.atan2(mv.x, mv.z);
        let d = target - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, CFG.turn * dt);
        if (speed === CFG.sprint) this.stamina = Math.max(0, this.stamina - 18 * dt);
      }
    } else if (this.state === 'dash') {
      const k = 1 - Math.min(1, this.stateT / this.dashDur);
      desired.copy(fwd).multiplyScalar(CFG.dashSpeed * (0.35 + k));
      if (this.stateT > this.dashDur * 1.05) this.#toMove();
    } else if (this.state === 'act') {
      const m = this.move, t = this.action ? this.action.time : this.stateT;
      const lungeT = m.lungeT ?? 0.22;
      if (m.hits.length && t < lungeT + (m.hits[0] - 0.2)) desired.copy(fwd).multiplyScalar(m.lunge);
      while (this.hitIdx < m.hits.length && t >= m.hits[this.hitIdx]) { this.#strike(m); this.hitIdx++; }
      if (m.release && !this.thrown && t >= m.release) { this.thrown = true; this.#throwShard(); }
      const end = m.end ?? this.action.getClip().duration;
      if (t >= end || !this.action.isRunning()) {
        if (this.queuedBranch && m.branch) this.#startMove(m.branch, input, camYaw);
        else if (this.queued && m.next) this.#startMove(m.next, input, camYaw);
        else if (m.then) { this.state = 'recover'; this.stateT = 0; this.recoverNext = null; this.recoverBranch = null; this.play(m.then, 0.08, 1.3); this.recoverDur = 0.35; }
        else if (m.rec) {
          this.state = 'recover'; this.stateT = 0; this.recoverNext = m.next; this.recoverBranch = m.branch;
          this.play(m.rec, 0.08, 1.3); this.recoverDur = this.current.getClip().duration / 1.3 * 0.8;
        } else this.#toMove();
      }
    } else if (this.state === 'block') {
      if (this.current && this.current.time > 0.38) this.current.timeScale = 0; // hold the guard pose
      if (!input.blocking && this.stateT > 0.15) { this.current.timeScale = 1; this.#toMove(); }
    } else if (this.state === 'air') {
      if (this.action.time > 0.3) this.action.timeScale = 0; // hold the raised blade until landing
    } else if (this.state === 'cast') {
      if (!this.patchFired && this.stateT > 0.25) {
        this.patchFired = true;
        const e = this.patchTarget_;
        const from = this.char.cursor ? this.char.cursor.getWorldPosition(new THREE.Vector3()) : this.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
        this.ctx.effects.beam(from, e.pos.clone().add(new THREE.Vector3(0, 0.6, 0)));
        e.patch();
        this.ctx.effects.burst(e.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 18, [0, 2], 4);
        this.ctx.hud.system(e.patchMsg || (e.isBoss ? 'SCALE BUG FIXED!\nHe is stunned - x2 DAMAGE!' : 'BUG FIXED!\nx2 DAMAGE for 3s - attack!'), 2.4);
      }
      if (this.stateT > 0.55) this.#toMove();
    } else if (this.state === 'hit') {
      if (this.stateT > 0.45) this.#toMove();
    }

    const k = Math.min(1, CFG.accel * dt);
    this.vel.x += (desired.x - this.vel.x) * k;
    this.vel.z += (desired.z - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    world.resolve(this.pos, 0.45);

    // --- Vertical ---
    const gy = world.groundAt(this.pos.x, this.pos.z);
    if (!this.onGround) {
      this.velY -= CFG.gravity * (this.state === 'air' ? 2.2 : 1) * dt; this.pos.y += this.velY * dt;
      if (this.pos.y <= gy) {
        this.pos.y = gy; this.onGround = true; this.velY = 0;
        if (this.state === 'air') {
          // Slam landing: area hit around Jasper.
          this.action.timeScale = 1.2;
          this.#strike({ dmg: 24, reach: 3.2, arc: Math.PI * 2, knock: 10, wide: true }, true);
          this.ctx.effects.shockwave(this.pos.clone(), 3.4);
          this.ctx.camera.shake(0.3);
          this.state = 'act'; this.move = { hits: [], end: 1.0, lunge: 0 }; this.hitIdx = 0;
        } else if (this.state === 'move') {
          this.play(Math.hypot(this.vel.x, this.vel.z) < 1 ? 'Jump_Land' : 'Jog_Fwd_Loop', 0.08, 1.4);
          this.landT = 0.25;
        }
      }
    } else this.pos.y = gy;

    if (this.state === 'move') {
      this.landT = (this.landT || 0) - dt;
      if (!this.onGround && this.velY < 2) this.play('Jump_Loop', 0.2);
      else if (this.onGround && this.landT <= 0) this.#locomotion();
    }

    this.mixer.update(dt);
    if (this.armed) this.char.grip?.(); // keep the fingers closed around the sword
    this.#applyTransform();
    // Blink while invulnerable after taking a hit.
    this.root.visible = !(this.invuln > 0 && this.state !== 'dash' && Math.floor(this.invuln * 20) % 2 === 0 && this.hp < this.maxHp);
    if (this.char.cursor) this.char.cursor.rotation.y += dt * 2;
  }

  #applyTransform() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
  }
}
