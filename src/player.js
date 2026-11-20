// Jasper: movement, combat, Debug Dash, Patch and the animation state machine.
import * as THREE from 'three';
import { heightAt } from './world.js';

const CFG = {
  walk: 2.2, jog: 4.6, sprint: 7.2, accel: 14, turn: 12,
  gravity: 22, jumpVel: 7.5,
  dashSpeed: 9.5, dashCost: 25, heavyCost: 20,
  staminaRegen: 28, patchCooldown: 8, patchRange: 10,
};

export class Player {
  constructor(char, clips, scene, ctx) {
    this.char = char; this.ctx = ctx; // ctx: { world, effects, hud, enemies, camera }
    this.root = char.root;
    this.group = new THREE.Group(); this.group.add(this.root); scene.add(this.group);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const c of clips) {
      // Root position tracks would drag the model; keep only the pelvis bob.
      c.tracks = c.tracks.filter(t => !/^root\.position/.test(t.name));
      this.actions[c.name] = this.mixer.clipAction(c);
    }
    const once = ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Attack', 'Roll', 'Death01', 'Hit_Chest', 'Spell_Simple_Shoot', 'Jump_Start', 'Jump_Land', 'Sword_Dash'];
    for (const n of once) if (this.actions[n]) { this.actions[n].setLoop(THREE.LoopOnce, 1); this.actions[n].clampWhenFinished = true; }
    this.mixer.addEventListener('finished', e => this.#onFinished(e.action));

    this.maxHp = 100; this.hp = 100; this.stamina = 100; this.level = 1; this.xp = 0;
    this.pos = new THREE.Vector3(0, heightAt(0, 0), 0);
    this.vel = new THREE.Vector3(); this.velY = 0; this.onGround = true;
    this.facing = Math.PI; this.state = 'move'; this.stateT = 0;
    this.combo = 0; this.queued = false; this.hitDone = false;
    this.invuln = 0; this.patchCd = 0; this.current = null;
    this.play('Idle_Loop', 0);
  }

  get alive() { return this.state !== 'dead'; }

  play(name, fade = 0.15, timeScale = 1) {
    const next = this.actions[name];
    if (!next) return;
    if (this.current === next && next.loop === THREE.LoopRepeat) { next.timeScale = timeScale; return; }
    next.reset(); next.timeScale = timeScale; next.setEffectiveWeight(1); next.play();
    if (this.current && this.current !== next) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  #onFinished(action) {
    const n = action.getClip().name;
    if (this.state === 'attack' && n.startsWith('Sword_Regular')) {
      if (this.queued && this.combo < 3) this.#startAttack(); else this.#toMove();
    } else if (this.state === 'heavy' && n === 'Sword_Attack') this.#toMove();
    else if (this.state === 'dash' && n === 'Roll') this.#toMove();
    else if (this.state === 'hit' && n === 'Hit_Chest') this.#toMove();
    else if (this.state === 'cast' && n === 'Spell_Simple_Shoot') this.#toMove();
  }

  #toMove() { this.state = 'move'; this.combo = 0; this.queued = false; this.current = this.current; this.#locomotion(true); }

  // Pick the nearest living enemy in front of the player (soft lock for attacks).
  #autoAim(range = 3.6) {
    let best = null, bestD = range;
    for (const e of this.ctx.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) this.facing = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
  }

  #startAttack() {
    this.state = 'attack'; this.queued = false; this.hitDone = false; this.stateT = 0;
    const names = ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'];
    this.combo = this.combo % 3 + 1;
    this.#autoAim();
    this.play(names[this.combo - 1], 0.08, 1.35);
    this.attackDur = this.current.getClip().duration / 1.35;
  }

  #startHeavy() {
    if (this.stamina < CFG.heavyCost) return this.ctx.hud.flash('st');
    this.stamina -= CFG.heavyCost;
    this.state = 'heavy'; this.hitDone = false; this.stateT = 0; this.combo = 0;
    this.#autoAim();
    this.play('Sword_Attack', 0.1, 1.15);
    this.attackDur = this.current.getClip().duration / 1.15;
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

  #moveDir(input, camYaw) {
    const f = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    return f.multiplyScalar(input.move.y).add(r.multiplyScalar(input.move.x));
  }

  #locomotion(force = false) {
    if (!this.onGround) return this.play('Jump_Loop', 0.15);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp < 0.3) this.play('Idle_Loop', 0.2);
    else if (sp < 3.2) this.play('Walk_Loop', 0.2, Math.max(0.8, sp / CFG.walk));
    else if (sp < 6) this.play('Jog_Fwd_Loop', 0.2, sp / CFG.jog);
    else this.play('Sprint_Loop', 0.2, sp / CFG.sprint);
  }

  damage(amount, from) {
    if (!this.alive || this.invuln > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = 0.6;
    this.ctx.hud.float(this.pos.clone().add(new THREE.Vector3(0, 2.1, 0)), '-' + amount, 'hurt');
    this.ctx.hud.hurt();
    const away = this.pos.clone().sub(from).setY(0).normalize();
    this.vel.addScaledVector(away, 6);
    if (this.hp <= 0) {
      this.state = 'dead'; this.stateT = 0; this.play('Death01', 0.1);
      this.ctx.hud.death(true);
      return;
    }
    if (this.state === 'move') { this.state = 'hit'; this.play('Hit_Chest', 0.05, 1.4); }
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
    this.current?.stop(); this.current = null; this.play('Idle_Loop', 0);
    this.ctx.hud.system('> RESPAWN: save crystal restored');
  }

  #strike(heavy) {
    const reach = heavy ? 3.0 : 2.5, arc = heavy ? 2.4 : 1.6;
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    this.ctx.effects.slash(this.pos, this.facing, heavy ? 0xffe28a : 0x29e6ff, heavy);
    for (const e of this.ctx.enemies) {
      if (!e.alive) continue;
      const to = e.pos.clone().sub(this.pos).setY(0);
      const d = to.length();
      if (d > reach) continue;
      if (d > 0.4 && Math.acos(THREE.MathUtils.clamp(to.normalize().dot(fwd), -1, 1)) > arc / 2) continue;
      const base = heavy ? 26 : [10, 12, 18][Math.max(0, this.combo - 1)];
      const dmg = e.takeHit(base + Math.floor(Math.random() * 4) + (this.level - 1) * 2, this.pos);
      const at = e.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
      const crit = e.frozen > 0;
      this.ctx.hud.float(at, String(dmg), crit ? 'crit' : '');
      if (e.glitchedActive && !crit) this.ctx.hud.float(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 'RESIST', 'hurt');
      this.ctx.effects.burst(at, crit ? 16 : 8, e.glitched ? [0, 1, 2] : [3, 2], 4);
      this.ctx.camera.shake(heavy ? 0.25 : 0.12);
      this.ctx.hitStop(heavy ? 0.08 : 0.045);
      if (!e.alive) {
        this.gainXp(e.glitched ? 35 : 20);
        this.ctx.hud.float(at.clone().add(new THREE.Vector3(0, 0.6, 0)), `+${e.glitched ? 35 : 20} XP`, 'xp');
        this.ctx.onKill?.(e);
      }
    }
  }

  update(dt, input, camYaw) {
    const { world } = this.ctx;
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.patchCd = Math.max(0, this.patchCd - dt);
    if (this.state !== 'dash' && this.state !== 'heavy') this.stamina = Math.min(100, this.stamina + CFG.staminaRegen * dt * (this.state === 'move' ? 1 : 0.4));

    if (this.state === 'dead') {
      if (this.stateT > 3.2) this.respawn();
      this.mixer.update(dt); this.#applyTransform(); return;
    }

    // Actions.
    const free = this.state === 'move';
    if (input.consume('dash') && (free || this.state === 'attack' || this.state === 'hit') && this.onGround) this.#startDash(input, camYaw);
    if (input.consume('patch') && free) this.#startPatch();
    if (input.consume('heavy') && free && this.onGround) this.#startHeavy();
    if (input.consume('attack')) {
      if (free && this.onGround) { this.combo = 0; this.#startAttack(); }
      else if (this.state === 'attack' && this.stateT > this.attackDur * 0.3) this.queued = true;
    }
    if (input.consume('jump') && free && this.onGround) { this.velY = CFG.jumpVel; this.onGround = false; this.play('Jump_Start', 0.08, 1.4); }

    // Movement.
    const desired = new THREE.Vector3();
    if (this.state === 'move') {
      const mv = this.#moveDir(input, camYaw);
      const mag = Math.min(1, mv.length());
      if (mag > 0.05) {
        mv.normalize();
        const speed = input.sprint && this.stamina > 5 ? CFG.sprint : (mag < 0.5 && !('ontouchstart' in window) ? CFG.walk : CFG.jog * Math.max(0.5, mag));
        desired.copy(mv).multiplyScalar(speed);
        const target = Math.atan2(mv.x, mv.z);
        let d = target - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, CFG.turn * dt);
        if (speed === CFG.sprint) this.stamina = Math.max(0, this.stamina - 18 * dt);
      }
    } else if (this.state === 'dash') {
      const k = 1 - Math.min(1, this.stateT / this.dashDur);
      desired.set(Math.sin(this.facing), 0, Math.cos(this.facing)).multiplyScalar(CFG.dashSpeed * (0.35 + k));
      if (this.stateT > this.dashDur * 1.05) this.#toMove();
    } else if (this.state === 'attack' || this.state === 'heavy') {
      const lunge = this.stateT < this.attackDur * 0.35 ? (this.state === 'heavy' ? 3 : 2.2) : 0;
      desired.set(Math.sin(this.facing), 0, Math.cos(this.facing)).multiplyScalar(lunge);
      const hitAt = this.attackDur * (this.state === 'heavy' ? 0.45 : 0.38);
      if (!this.hitDone && this.stateT >= hitAt) { this.hitDone = true; this.#strike(this.state === 'heavy'); }
      // Safety: never get stuck in an attack.
      if (this.stateT > this.attackDur + 0.3) { if (this.queued && this.combo < 3 && this.state === 'attack') this.#startAttack(); else this.#toMove(); }
    } else if (this.state === 'cast') {
      if (!this.patchFired && this.stateT > 0.25) {
        this.patchFired = true;
        const e = this.patchTarget;
        const from = this.char.cursor ? this.char.cursor.getWorldPosition(new THREE.Vector3()) : this.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
        this.ctx.effects.beam(from, e.pos.clone().add(new THREE.Vector3(0, 0.6, 0)));
        if (e.patch()) {
          this.ctx.hud.system('> PATCH APPLIED\n> target frozen: 3.0s  damage x2');
          this.ctx.effects.burst(e.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 18, [0, 2], 4);
        }
      }
      if (this.stateT > 1.4) this.#toMove();
    } else if (this.state === 'hit') {
      if (this.stateT > 0.6) this.#toMove();
    }

    const k = Math.min(1, CFG.accel * dt);
    this.vel.x += (desired.x - this.vel.x) * k;
    this.vel.z += (desired.z - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    world.resolve(this.pos, 0.45);

    // Vertical.
    const gy = heightAt(this.pos.x, this.pos.z);
    if (!this.onGround) {
      this.velY -= CFG.gravity * dt; this.pos.y += this.velY * dt;
      if (this.pos.y <= gy) {
        this.pos.y = gy; this.onGround = true; this.velY = 0;
        if (this.state === 'move') this.play(Math.hypot(this.vel.x, this.vel.z) < 1 ? 'Jump_Land' : 'Jog_Fwd_Loop', 0.08, 1.4);
        this.landT = 0.25;
      }
    } else this.pos.y = gy;

    if (this.state === 'move') {
      this.landT = (this.landT || 0) - dt;
      if (!this.onGround && this.velY < 2) this.play('Jump_Loop', 0.2);
      else if (this.onGround && this.landT <= 0) this.#locomotion();
    }

    this.mixer.update(dt);
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
