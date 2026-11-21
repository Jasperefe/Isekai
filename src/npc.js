// Villagers: animated models with a name tag, talk range and an optional "bugged" state
// (looping dialogue, glitch jitter) that Patch can fix.
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { buildCharacter } from './characters.js?v=30';

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

export class NPC {
  // opts: { name, color, pos, ry, anim, hair, tint, bugged: { anim } }
  constructor(scene, gltf, clips, idle, opts, world) {
    this.name = opts.name; this.opts = opts;
    const char = buildCharacter({ scene: skeletonClone(gltf.scene) }, 'npc', idle, { hair: opts.hair, tint: opts.tint });
    this.root = char.root;
    this.group = new THREE.Group(); this.group.add(this.root); scene.add(this.group);
    this.pos = opts.pos.clone(); this.pos.y = world.groundAt(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos); this.group.rotation.y = opts.ry ?? 0;
    this.baseRy = opts.ry ?? 0;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = Object.fromEntries(clips.map(c => [c.name, c]));
    this.tag = nameTag(opts.name, opts.color || '#ffffff'); this.tag.position.y = 2.25; this.group.add(this.tag);
    this.bugged = !!opts.bugged;
    this.talkAnim = opts.talkAnim || 'Idle_Talking_Loop';
    this.play(this.bugged ? opts.bugged.anim : opts.anim || 'Idle_Loop');
    world.colliders.push({ x: this.pos.x, z: this.pos.z, r: 0.45 });
    this.t = Math.random() * 10;
  }

  play(name, fade = 0.25) {
    const clip = this.clips[name]; if (!clip) return;
    const a = this.mixer.clipAction(clip);
    if (this.current === a) return;
    a.reset().play();
    if (this.current) this.current.crossFadeTo(a, fade, false);
    this.current = a;
  }

  canPatch() { return this.bugged; }

  patch() {
    this.bugged = false;
    this.root.position.set(0, 0, 0);
    this.play(this.opts.anim || 'Idle_Loop');
    this.onPatched?.();
    return true;
  }

  // Turn toward a point (used while talking).
  face(p) { this.targetRy = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }

  update(dt, camera) {
    this.t += dt;
    this.mixer.update(this.bugged && Math.sin(this.t * 17) > 0.6 ? dt * 0.1 : dt); // stutter when bugged
    if (this.bugged) {
      // Glitch: jitter and snap back like a broken animation.
      this.root.position.x = Math.sin(this.t * 31) > 0.8 ? (Math.random() - 0.5) * 0.25 : 0;
      if (Math.sin(this.t * 2.3) > 0.97) this.current?.reset();
    }
    const want = this.targetRy ?? this.baseRy;
    let d = want - this.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * Math.min(1, dt * 6);
    this.tag.visible = camera.position.distanceTo(this.pos) < 16;
    this.tag.material.color.set(this.bugged && Math.sin(this.t * 20) > 0 ? 0xff2bd6 : 0xffffff);
  }
}
