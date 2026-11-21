// Pip: a small glitched pixel fox. Before the side quest he is stuck glitching in the
// Corrupted Grove (Patch fixes him); after it he follows Jasper in every zone and fetches loot.
import * as THREE from 'three';
import { buildNullWolf, bake } from './monsters2.js?v=15';

export class Pet {
  constructor(scene) {
    const { root, parts } = buildNullWolf({ fox: true });
    bake(root, [parts.body, parts.head, parts.tail, parts.bits, ...parts.legs.map(l => l.g)], { lines: false });
    this.parts = parts;
    root.scale.setScalar(0.62);
    this.root = root;
    this.group = new THREE.Group(); this.group.add(root); scene.add(this.group);
    this.pos = new THREE.Vector3(); this.facing = 0; this.gait = 0; this.t = 0;
    this.mode = 'hidden'; // 'stuck' (glitching in the grove) | 'follow' | 'hidden'
    this.group.visible = false;
  }

  // Stuck in a glitch loop at a spot until patched.
  stuckAt(pos, world) {
    this.mode = 'stuck'; this.pos.copy(pos); this.pos.y = world.groundAt(pos.x, pos.z); this.group.visible = true;
  }

  follow(player) {
    this.mode = 'follow'; this.group.visible = true;
    if (this.pos.distanceTo(player.pos) > 6 || this.pos.lengthSq() === 0) this.pos.copy(player.pos).add(new THREE.Vector3(1, 0, 1));
  }

  update(dt, player, world) {
    if (this.mode === 'hidden') return;
    this.t += dt;
    const p = this.parts;
    let speed = 0;
    if (this.mode === 'stuck') {
      // Snaps between two poses and flickers, like a broken animation.
      const flick = Math.sin(this.t * 23) > 0.5;
      this.root.position.x = flick ? (Math.random() - 0.5) * 0.15 : 0;
      this.facing += Math.sin(this.t * 7) > 0.95 ? Math.PI / 2 : 0;
      this.root.visible = Math.sin(this.t * 41) > -0.8;
    } else {
      this.root.visible = true; this.root.position.x = 0;
      // Trot behind Jasper's left shoulder.
      const side = new THREE.Vector3(Math.sin(player.facing + 2.4), 0, Math.cos(player.facing + 2.4)).multiplyScalar(1.6);
      const want = player.pos.clone().add(side), to = want.sub(this.pos).setY(0), d = to.length();
      if (d > 12) { this.pos.copy(player.pos).add(side); }
      else if (d > 0.4) {
        speed = Math.min(9, d * 3);
        this.pos.addScaledVector(to.normalize(), speed * dt);
        this.facing = Math.atan2(to.x, to.z);
      } else {
        const toP = player.pos.clone().sub(this.pos);
        this.facing += (Math.atan2(toP.x, toP.z) - this.facing) * Math.min(1, dt * 3);
      }
      world.resolve(this.pos, 0.25);
    }
    this.gait += dt * (speed > 2 ? 14 : speed > 0 ? 8 : 0);
    const swing = speed > 0 ? Math.sin(this.gait) * 0.6 : 0;
    p.legs.forEach((l, i) => { l.g.rotation.x = (i === 0 || i === 3 ? swing : -swing); });
    p.tail.rotation.y = Math.sin(this.t * 6) * 0.4;
    p.head.rotation.x = 0.1 + Math.sin(this.t * 1.5) * 0.05;
    this.group.position.set(this.pos.x, world.groundAt(this.pos.x, this.pos.z) + (speed > 2 ? Math.abs(Math.sin(this.gait)) * 0.06 : 0), this.pos.z);
    this.group.rotation.y = this.facing;
  }
}
