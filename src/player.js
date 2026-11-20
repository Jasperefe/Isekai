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
  A: { clip: 'Sword_Regular_A', ts: 1.2, hits: [0.24], dmg: 10, reach: 2.6, arc: 1.8, lunge: 2.4, rec: 'Sword_Regular_A_Rec', next: 'B' },
  B: { clip: 'Sword_Regular_B', ts: 1.2, hits: [0.24], dmg: 12, reach: 2.6, arc: 1.8, lunge: 2.4, rec: 'Sword_Regular_B_Rec', next: 'C' },
  C: { clip: 'Sword_Regular_C', ts: 1.3, hits: [0.63], dmg: 20, reach: 3.0, arc: 2.8, lunge: 3.2, end: 1.15, knock: 9, wide: true, color: 0x7ff3ff },
  heavy: { clip: 'Sword_Attack', ts: 1.15, hits: [0.38], dmg: 26, reach: 3.2, arc: 3.2, lunge: 2.6, end: 1.05, knock: 10, wide: true, color: 0xffe28a, shock: true },
  dashAtk: { clip: 'Sword_Dash', ts: 1.25, hits: [0.3], dmg: 22, reach: 3.2, arc: 2.4, lunge: 8, lungeT: 0.15, end: 0.95, knock: 8, wide: true },
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
    this.queued = false; this.invuln = 0; this.patchCd = 0; this.skillCd = 0; this.current = null;
    this.play('Sword_Idle', 0);
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

  #toMove() { this.state = 'move'; this.stateT = 0; this.queued = false; this.move = null; this.#locomotion(); }

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
    this.#aim(input, camYaw);
    this.state = 'act'; this.move = m; this.moveKey = key; this.stateT = 0; this.queued = false; this.hitIdx = 0;
    this.action = this.play(m.clip, 0.07, m.ts);
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
    this.state = 'block'; this.stateT = 0;
    this.play('Sword_Block', 0.06, 1.6);
  }

  #startAirAttack() {
    this.state = 'air'; this.stateT = 0; this.velY = Math.min(this.velY, 2) - 6;
    this.action = this.play('Sword_Attack', 0.06, 1.3, 0.12);
  }

  #startPatch() {
    if (this.patchCd > 0) return;
    let best = null, bestD = CFG.patchRange;
    for (const e of this.ctx.enemies) {
      if (!e.glitchedActive || !e.alive) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) { this.ctx.hud.system('> PATCH: no glitch in range'); return; }
    this.facing = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
    this.state = 'cast'; this.stateT = 0; this.patchCd = CFG.patchCooldown;
    this.play('Spell_Simple_Shoot', 0.08, 1.5);
    this.patchTarget = best; this.patchFired = false;
  }

  #locomotion() {
    if (!this.onGround) return this.play('Jump_Loop', 0.15);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp < 0.3) this.play('Sword_Idle', 0.2);
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

  gainXp(n) {
    this.xp += n;
    while (this.xp >= this.level * 100) {
      this.xp -= this.level * 100; this.level++;
      this.maxHp += 10; this.hp = this.maxHp;
      this.ctx.hud.system(`> LEVEL UP: LV ${this.level}\n> MAX HP +10`);
      this.ctx.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 24, [0, 2, 3], 5);
    }
  }

  respawn() {
    this.hp = this.maxHp; this.stamina = 100; this.pos.set(0, heightAt(0, 0), 0); this.vel.set(0, 0, 0);
    this.state = 'move'; this.invuln = 1.5; this.ctx.hud.death(false);
    this.current?.stop(); this.current = null; this.play('Sword_Idle', 0);
    this.ctx.hud.system('> RESPAWN: save crystal restored');
  }

  // Deal damage in a cone (or circle) in front of Jasper.
  #strike(m, noSlash) {
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    if (!noSlash) this.ctx.effects.slash(this.pos, this.facing + (m.arc > 6 ? this.hitIdx * 1.7 : 0), m.color ?? 0x29e6ff, m.wide);
    if (m.shock) this.ctx.effects.shockwave(this.pos.clone().addScaledVector(fwd, 1.6), 3.2);
    let landed = false;
    for (const e of this.ctx.enemies) {
      if (!e.alive) continue;
      const to = e.pos.clone().sub(this.pos).setY(0);
      const d = to.length();
      if (d > m.reach) continue;
      if (m.arc < 6 && d > 0.4 && Math.acos(THREE.MathUtils.clamp(to.normalize().dot(fwd), -1, 1)) > m.arc / 2) continue;
      const frozen = e.frozen > 0;
      const dmg = e.takeHit(m.dmg + Math.floor(Math.random() * 4) + (this.level - 1) * 2, this.pos);
      if (m.knock && !frozen) e.knock.multiplyScalar(m.knock / 6);
      const at = e.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
      this.ctx.hud.float(at, String(dmg), frozen ? 'crit' : '');
      if (e.glitchedActive && !frozen) this.ctx.hud.float(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 'RESIST - use PATCH', 'hurt');
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
    const regen = this.state === 'move' ? 1 : this.state === 'block' ? 0.25 : 0.45;
    if (this.state !== 'dash') this.stamina = Math.min(100, this.stamina + CFG.staminaRegen * dt * regen);

    if (this.state === 'dead') {
      if (this.stateT > 3.2) this.respawn();
      this.mixer.update(dt); this.#applyTransform(); return;
    }

    const free = this.state === 'move' || this.state === 'recover';
    const moving = Math.hypot(input.move.x, input.move.y) > 0.15;

    // --- Actions ---
    if (input.consume('dash') && (free || this.state === 'act' || this.state === 'hit' || this.state === 'block') && this.onGround) {
      if (this.state !== 'act' || this.stateT > 0.12) this.#startDash(input, camYaw);
    }
    if (input.consume('patch') && free) this.#startPatch();
    if (input.consume('skill') && free && this.onGround) this.#startMove('skill', input, camYaw);
    if (input.consume('heavy') && free && this.onGround) this.#startMove('heavy', input, camYaw);
    if (input.blocking && free && this.onGround) this.#startBlock();
    if (input.consume('attack')) {
      if (!this.onGround && this.state === 'move') this.#startAirAttack();
      else if (this.state === 'dash' && this.stateT > this.dashDur * 0.35) this.#startMove('dashAtk', input, camYaw);
      else if (this.state === 'move' && this.onGround && input.sprint && Math.hypot(this.vel.x, this.vel.z) > 5.5) this.#startMove('dashAtk', input, camYaw);
      else if (this.state === 'move' && this.onGround) this.#startMove('A', input, camYaw);
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
      const end = m.end ?? this.action.getClip().duration;
      if (t >= end || !this.action.isRunning()) {
        if (this.queued && m.next) this.#startMove(m.next, input, camYaw);
        else if (m.rec) {
          this.state = 'recover'; this.stateT = 0; this.recoverNext = m.next;
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
        const e = this.patchTarget;
        const from = this.char.cursor ? this.char.cursor.getWorldPosition(new THREE.Vector3()) : this.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
        this.ctx.effects.beam(from, e.pos.clone().add(new THREE.Vector3(0, 0.6, 0)));
        if (e.patch()) {
          this.ctx.hud.system('> PATCH APPLIED: glitch removed\n> frozen 3s, takes DOUBLE damage - attack now!');
          this.ctx.effects.burst(e.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 18, [0, 2], 4);
        }
      }
      if (this.stateT > 0.9) this.#toMove();
    } else if (this.state === 'hit') {
      if (this.stateT > 0.45) this.#toMove();
    }

    const k = Math.min(1, CFG.accel * dt);
    this.vel.x += (desired.x - this.vel.x) * k;
    this.vel.z += (desired.z - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    world.resolve(this.pos, 0.45);

    // --- Vertical ---
    const gy = heightAt(this.pos.x, this.pos.z);
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
    this.char.grip?.(); // keep the fingers closed around the sword
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
