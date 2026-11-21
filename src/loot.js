// Loot: gold coins and glitch shards that fly to Jasper, item drops, and treasure chests.
import * as THREE from 'three';
import { sfx } from './audio.js?v=31';
import { makeItem, rollRarity, RARITY } from './items.js?v=31';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

const COIN_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14);
COIN_GEO.rotateX(Math.PI / 2);
const SHARD_GEO = new THREE.OctahedronGeometry(0.14);
const BAG_GEO = new THREE.BoxGeometry(0.38, 0.38, 0.38);
const COIN_MAT = new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.9, roughness: 0.25, emissive: 0x7a5200, emissiveIntensity: 0.4 });
const SHARD_MAT = new THREE.MeshStandardMaterial({ color: 0xff7ae8, emissive: 0xff2bd6, emissiveIntensity: 1 });

export class Loot {
  constructor(scene, ctx, props) {
    this.scene = scene; this.ctx = ctx; // ctx: { player, profile, hud, effects, world }
    this.items = [];
    // Models from the Fantasy Props MegaKit.
    const find = n => props?.scene.getObjectByName(n);
    this.coinTpl = find('Coin'); this.bagTpl = find('Bag');
    if (this.coinTpl) { this.coinTpl.position.set(0, 0, 0); this.coinTpl.scale.setScalar(3.4); this.coinTpl.traverse(o => { if (o.isMesh) o.material = COIN_MAT; }); }
    if (this.bagTpl) { this.bagTpl.position.set(0, 0, 0); this.bagTpl.scale.setScalar(0.85); }
  }

  // Drop loot for a defeated enemy.
  enemyDrop(e) {
    if (e.isClone) return;
    const st = this.ctx.profile.stats(), luck = st.lootMul * (e.lootMul || 1);
    const pos = e.pos.clone();
    if (e.isBoss) {
      this.spawn(pos, 'gold', Math.round(120 * luck));
      this.spawn(pos, 'shards', Math.round(12 * luck));
      this.spawnItem(pos, makeItem(3, Math.random() < 0.3 ? 'glitched' : 'epic', 'weapon'));
      return;
    }
    if (e.glitched && !e.minion && Math.random() < 0.05) {
      this.ctx.profile.d.debugPoints++; this.ctx.profile.save(); sfx('unlock');
      this.ctx.hud.system('+1 DEBUG POINT!\nGlitched enemies sometimes drop them.\nSpend them in the CONSOLE', 3);
    }
    this.spawn(pos, 'gold', Math.round((3 + Math.random() * 4) * luck));
    if (e.glitched || Math.random() < 0.3 * luck) this.spawn(pos, 'shards', e.glitched ? 2 : 1);
    if (Math.random() < 0.09 * luck) this.spawnItem(pos, makeItem(this.ctx.profile.d.level, rollRarity(luck)));
  }

  // Split an amount into several coins/shards that pop out.
  spawn(pos, kind, amount) {
    const n = Math.min(8, Math.max(1, Math.ceil(amount / (kind === 'gold' ? 6 : 2))));
    let left = amount;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.floor(amount / n); left -= v;
      if (v <= 0) continue;
      const m = kind === 'gold' && this.coinTpl ? this.coinTpl.clone() : new THREE.Mesh(kind === 'gold' ? COIN_GEO : SHARD_GEO, kind === 'gold' ? COIN_MAT : SHARD_MAT);
      m.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0));
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 2.5;
      this.items.push({ mesh: m, kind, value: v, vel: new THREE.Vector3(Math.cos(a) * sp, 5 + Math.random() * 2, Math.sin(a) * sp), age: 0, grounded: false });
    }
  }

  spawnItem(pos, item) {
    const color = new THREE.Color(RARITY[item.rarity].color);
    const g = new THREE.Group();
    let box;
    if (this.bagTpl) {
      box = this.bagTpl.clone(); box.position.y = -0.3;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color }));
      ring.rotation.x = Math.PI / 2; ring.position.y = -0.28; g.add(ring);
    } else box = new THREE.Mesh(BAG_GEO, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
    g.add(box);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 2; g.add(beam);
    g.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0));
    this.scene.add(g);
    const a = Math.random() * Math.PI * 2;
    this.items.push({ mesh: g, box, kind: 'item', item, vel: new THREE.Vector3(Math.cos(a) * 1.5, 4, Math.sin(a) * 1.5), age: 0, grounded: false });
  }

  #collect(it) {
    const { profile, hud, player } = this.ctx;
    const at = player.pos.clone().add(new THREE.Vector3(0, 2, 0));
    if (it.kind === 'gold') { profile.d.gold += it.value; hud.float(at, `+${it.value} gold`, 'gold'); sfx('coin'); }
    else if (it.kind === 'shards') { profile.d.shards += it.value; hud.float(at, `+${it.value} shard${it.value > 1 ? 's' : ''}`, 'shard'); sfx('shard'); }
    else if (it.kind === 'item') {
      if (!profile.addItem(it.item)) {
        // Bag full: no pop-ups. The weakest piece (the old one or the new one) turns into shards automatically.
        const R = { common: 0, rare: 1, epic: 2, glitched: 3 }, score = x => R[x.rarity] * 1000 + (x.level || 0);
        const bag = profile.d.bag;
        let wi = 0; for (let i = 1; i < bag.length; i++) if (score(bag[i]) < score(bag[wi])) wi = i;
        let gone = it.item;
        if (bag.length && score(bag[wi]) < score(it.item)) { gone = bag[wi]; bag.splice(wi, 1); profile.addItem(it.item); }
        profile.d.shards += gone.scrap || 1;
        hud.float(at, `+${gone.scrap || 1} shards (auto-scrap)`, 'shard'); sfx('shard');
        if (!this.bagTold) { this.bagTold = true; hud.system('Bag full: your weakest gear is now scrapped into shards automatically', 2.5); }
        if (gone !== it.item) hud.itemToast(it.item);
        hud.wallet(profile.d);
        return true;
      }
      hud.itemToast(it.item); sfx('item');
    }
    hud.wallet(profile.d);
    return true;
  }

  update(dt, t) {
    const { player, world } = this.ctx;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      const m = it.mesh;
      const ground = world.groundAt(m.position.x, m.position.z) + (it.kind === 'item' ? 0.45 : 0.25);
      const toP = player.pos.clone().add(new THREE.Vector3(0, 1, 0)).sub(m.position), d = toP.length();
      const magnet = it.kind === 'item' ? (this.ctx.profile.d.pet ? 4.5 : 2.5) : (this.ctx.profile.d.pet ? 7 : 3.5); // Pip fetches from further
      if (it.age > (it.kind === 'item' ? 0.9 : 0.5) && d < magnet && player.alive) {
        // Magnet toward Jasper.
        m.position.addScaledVector(toP.normalize(), Math.min(d, dt * (8 + (magnet - d) * 6)));
      } else if (!it.grounded) {
        it.vel.y -= 18 * dt; m.position.addScaledVector(it.vel, dt);
        if (m.position.y <= ground) { m.position.y = ground; if (it.vel.y < -2) it.vel.y *= -0.35; else { it.grounded = true; } it.vel.x *= 0.6; it.vel.z *= 0.6; }
      } else m.position.y = ground + Math.sin(t * 3 + i) * 0.08;
      m.rotation.y += dt * 3;
      const reach = it.kind === 'item' ? 1.3 : 0.7;
      if (d < reach && it.age > 0.4 && player.alive) {
        if (this.#collect(it)) { this.scene.remove(m); this.items.splice(i, 1); }
      } else if (it.kind !== 'item' && it.age > 90) { this.scene.remove(m); this.items.splice(i, 1); } // gear never despawns
    }
  }
}

// Treasure chest from the Fantasy Props MegaKit, with its own open animation.
export function makeChest(props) {
  const tpl = props.scene.getObjectByName('Chest_Wood');
  const g = new THREE.Group();
  const c = skeletonClone(tpl); c.position.set(0, 0, 0); g.add(c);
  c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(c);
  const clip = n => props.animations.find(a => a.name === n);
  const play = (n, once) => {
    mixer.stopAllAction();
    const a = mixer.clipAction(clip(n)); if (once) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    a.reset().play();
  };
  play('Chest_Closed');
  g.userData.open = instant => play(instant ? 'Chest_Opened' : 'Chest_Open', true);
  g.userData.update = dt => mixer.update(dt);
  return g;
}
