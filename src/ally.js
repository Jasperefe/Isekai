// Princess Victory: held in a cage of light in the castle, then Jasper's AI ally.
// - Follows Jasper, never takes damage.
// - STARFALL: a bolt of light at the nearest enemy every few seconds.
// - HEAL: restores 30% HP when Jasper is low (long cooldown).
// - BARRIER: a bubble that absorbs one hit (cast in boss fights).
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { buildCharacter } from './characters.js?v=25';
import { sfx } from './audio.js?v=25';

const GOLD = 0xffd36b, MAGENTA = 0xff2bd6;

function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(11,16,32,0.6)'; g.beginPath(); g.roundRect(28, 12, 200, 40, 8); g.fill();
  g.fillStyle = color; g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(1.4, 0.35, 1); sp.renderOrder = 9;
  return sp;
}

export class Ally {
  // ctx: { player, effects, hud, world, enemies: () => [], onKill(e) }
  constructor(scene, gltf, clips, idle, ctx, cagePos) {
    this.ctx = ctx; this.scene = scene;
    this.name = 'VICTORY'; this.opts = { color: '#ffd36b', anim: 'Idle_Loop' }; this.talkAnim = 'Idle_Talking_Loop';
    const ch = buildCharacter({ scene: skClone(gltf.scene) }, 'victory', idle);
    this.root = ch.root;
    this.group = new THREE.Group(); this.group.add(this.root); scene.add(this.group);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = Object.fromEntries(clips.map(c => [c.name, c]));
    this.tag = nameTag('VICTORY', '#ffd36b'); this.tag.position.y = 2.15; this.group.add(this.tag);
    this.pos = cagePos.clone(); this.cagePos = cagePos.clone(); this.vel = new THREE.Vector3(); this.facing = 0;
    this.mode = 'caged';
    this.starCd = 2; this.healCd = 0; this.barrierCd = 0; this.t = 0;
    // Cage of light.
    const cage = new THREE.Group(), barM = new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 5), barM); b.position.set(Math.cos(a) * 0.9, 1.3, Math.sin(a) * 0.9); cage.add(b); }
    for (const y of [0.05, 2.6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 28), barM); r.rotation.x = Math.PI / 2; r.position.y = y; cage.add(r); }
    cage.position.copy(cagePos); scene.add(cage); this.cage = cage; this.cageMat = barM;
    ctx.world.colliders.push(this.cageCol = { x: cagePos.x, z: cagePos.z, r: 1.0 });
    // Barrier bubble (shown around Jasper).
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 12), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.18, depthWrite: false }));
    this.bubble.visible = false; scene.add(this.bubble);
    this.bolts = [];
    this.play('Idle_Loop');
    this.place();
  }

  play(name, fade = 0.25) {
    const clip = this.clips[name]; if (!clip) return;
    const a = this.mixer.clipAction(clip);
    if (this.current === a) return;
    a.reset().play();
    if (this.current) this.current.crossFadeTo(a, fade, false);
    this.current = a;
  }
  face(p) { this.targetRy = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }

  // Patch opens the cage.
  canPatch() { return this.mode === 'caged' && !!this.cageOpenable; }
  patch() {
    this.cage.visible = false;
    const i = this.ctx.world.colliders.indexOf(this.cageCol); if (i >= 0) this.ctx.world.colliders.splice(i, 1);
    this.ctx.effects.burst(this.cagePos.clone().add(new THREE.Vector3(0, 1.4, 0)), 40, [1, 2, 0], 7);
    this.patchMsg = 'CAGE DELETED!';
    this.mode = 'free';
    this.onFreed?.();
    return true;
  }
  freeNow() { this.cage.visible = false; const i = this.ctx.world.colliders.indexOf(this.cageCol); if (i >= 0) this.ctx.world.colliders.splice(i, 1); this.mode = 'free'; }
  follow() { this.freeNow(); this.mode = 'follow'; }
  teleportTo(p) { this.pos.copy(p); this.place(); }
  place() { this.group.position.copy(this.pos); this.group.position.y = this.ctx.world.groundAt(this.pos.x, this.pos.z); this.group.rotation.y = this.facing; }

  #nearestEnemy(range) {
    let best = null, bd = range;
    for (const e of this.ctx.enemies()) {
      if (!e.alive || e.isClone || (e.isBoss && e.mirroring)) continue;
      const d = e.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  #starfall(e) {
    const from = this.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: GOLD }));
    mesh.position.copy(from); this.scene.add(mesh);
    this.bolts.push({ mesh, target: e, t: 0 });
    this.play('Spell_Simple_Shoot', 0.1); this.castT = 0.6;
    sfx('patch', this.pos, 0.5);
  }

  update(dt, camera) {
    this.t += dt;
    const { player } = this.ctx;
    // Light bolts.
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i], tgt = b.target.pos.clone().add(new THREE.Vector3(0, 1.0, 0));
      b.t += dt; const to = tgt.sub(b.mesh.position), d = to.length();
      b.mesh.position.addScaledVector(to.normalize(), Math.min(d, 22 * dt)); b.mesh.rotation.y += dt * 10;
      if (d < 0.4 || b.t > 1.5) {
        this.scene.remove(b.mesh); this.bolts.splice(i, 1);
        const e = b.target;
        if (e.alive && !(e.isBoss && e.mirroring)) {
          const lvl = player.level || 10, dmg = Math.round(14 + lvl * 2.2);
          const was = e.alive; e.takeHit(dmg, this.pos, { pierce: true });
          this.ctx.hud.float(e.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), String(dmg), 'xp');
          this.ctx.effects.burst(e.pos.clone().add(new THREE.Vector3(0, 1, 0)), 10, [2], 4);
          if (was && !e.alive && !e.isClone) { player.gainXp(e.xp ?? 30); this.ctx.onKill(e); }
        }
      }
    }
    // Bubble follows Jasper while the Barrier is up.
    this.bubble.visible = (player.barrier || 0) > 0;
    if (this.bubble.visible) { this.bubble.position.copy(player.pos).add(new THREE.Vector3(0, 1, 0)); this.bubble.material.opacity = 0.14 + Math.sin(this.t * 5) * 0.05; }

    if (this.mode === 'caged' || this.mode === 'free') {
      this.cageMat.opacity = 0.7 + Math.sin(this.t * 6) * 0.15;
      if (this.targetRy != null) { let d = this.targetRy - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); this.facing += d * Math.min(1, dt * 6); }
      this.place(); this.mixer.update(dt);
      return;
    }
    // Follow Jasper: stay a little behind and to his left.
    const busy = this.ctx.busy?.();
    const back = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    const want = player.pos.clone().addScaledVector(back, -1.8).add(new THREE.Vector3(back.z, 0, -back.x).multiplyScalar(1.4));
    const to = want.sub(this.pos).setY(0), d = to.length();
    if (player.pos.distanceTo(this.pos) > 18) { this.pos.copy(player.pos).addScaledVector(back, -1.5); this.ctx.world.resolve(this.pos, 0.4); }
    let speed = 0;
    if (d > 0.6 && !busy) { speed = Math.min(7.5, d * 2.2); this.pos.addScaledVector(to.normalize(), speed * dt); this.facing = Math.atan2(to.x, to.z); }
    else if (this.targetRy != null) { let dd = this.targetRy - this.facing; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); this.facing += dd * Math.min(1, dt * 6); }
    this.ctx.world.resolve(this.pos, 0.4);
    // Abilities.
    this.starCd -= dt; this.healCd -= dt; this.barrierCd -= dt; this.castT = (this.castT || 0) - dt;
    if (!busy && player.alive) {
      if (this.healCd <= 0 && player.hp < player.maxHp * 0.35) {
        this.healCd = 24; const amt = Math.round(player.maxHp * 0.3);
        player.hp = Math.min(player.maxHp, player.hp + amt);
        this.ctx.hud.float(player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), `+${amt} HEAL`, 'xp');
        this.ctx.effects.burst(player.pos.clone().add(new THREE.Vector3(0, 1, 0)), 24, [2, 0], 4); sfx('levelUp', player.pos, 0.5);
        this.play('Spell_Simple_Shoot', 0.1); this.castT = 0.6;
        this.onHeal?.();
      } else if (this.starCd <= 0) {
        const e = this.#nearestEnemy(14);
        if (e) { this.starCd = 3.2; this.#starfall(e); this.facing = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z); }
      }
    }
    if (this.castT <= 0) this.play(speed > 3.5 ? 'Jog_Fwd_Loop' : speed > 0.3 ? 'Walk_Loop' : 'Idle_Loop', 0.2);
    this.place(); this.mixer.update(dt);
  }

  castBarrier() {
    const p = this.ctx.player;
    if (this.mode !== 'follow' || !p.alive) return;
    p.barrier = 1; this.barrierCd = 20;
    this.ctx.effects.burst(p.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 20, [2], 4); sfx('unlock', p.pos, 0.6);
    this.play('Spell_Simple_Shoot', 0.1); this.castT = 0.6;
  }
}
