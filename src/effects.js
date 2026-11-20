// Lightweight visual effects: slash arcs, pixel bursts and the Patch beam.
import * as THREE from 'three';

const PIXEL = new THREE.BoxGeometry(0.09, 0.09, 0.09);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pixMats = [0x29e6ff, 0xff2bd6, 0xffffff, 0x9cff5a].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true }));
  }

  // Curved slash ribbon in front of the player.
  slash(pos, facing, color = 0x29e6ff, wide = false) {
    const len = Math.PI * (wide ? 1.3 : 0.9);
    const geo = new THREE.RingGeometry(0.9, wide ? 2.2 : 1.8, 28, 1, -Math.PI / 2 - len / 2, len);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.order = 'YXZ';
    m.rotation.set(0, facing, (Math.random() - 0.5) * 0.6);
    m.position.copy(pos).add(new THREE.Vector3(0, 1.0, 0));
    this.scene.add(m);
    this.items.push({ obj: m, life: 0.22, max: 0.22, update: (it, k) => { mat.opacity = 0.75 * k; m.scale.setScalar(1 + (1 - k) * 0.25); } });
  }

  burst(pos, count = 10, palette = [0, 1, 2], speed = 4) {
    for (let i = 0; i < count; i++) {
      const mat = this.pixMats[palette[i % palette.length]];
      const m = new THREE.Mesh(PIXEL, mat);
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.4 + 0.3, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.scene.add(m);
      this.items.push({ obj: m, life: 0.6, max: 0.6, update: (it, k, dt) => {
        v.y -= 12 * dt; m.position.addScaledVector(v, dt); m.rotation.x += dt * 8; m.scale.setScalar(k);
      } });
    }
  }

  beam(from, to) {
    const dir = to.clone().sub(from), len = dir.length();
    const geo = new THREE.CylinderGeometry(0.05, 0.05, len, 8, 1, true);
    geo.translate(0, len / 2, 0); geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x29e6ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from); m.lookAt(to);
    this.scene.add(m);
    this.items.push({ obj: m, life: 0.35, max: 0.35, update: (it, k) => { mat.opacity = 0.9 * k; m.scale.set(1 + (1 - k) * 3, 1 + (1 - k) * 3, 1); } });
    // Cursor ring at the target.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 32), mat.clone());
    ring.rotation.x = Math.PI / 2; ring.position.copy(to);
    this.scene.add(ring);
    this.items.push({ obj: ring, life: 0.6, max: 0.6, update: (it, k) => { ring.material.opacity = k; ring.scale.setScalar(0.5 + (1 - k)); } });
  }

  // Expanding ground ring for heavy hits and slams.
  shockwave(pos, radius = 3) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), mat);
    m.rotation.x = -Math.PI / 2; m.position.copy(pos).add(new THREE.Vector3(0, 0.12, 0));
    this.scene.add(m);
    this.items.push({ obj: m, life: 0.4, max: 0.4, update: (it, k) => { m.scale.setScalar(0.3 + (1 - k) * radius); mat.opacity = 0.85 * k; } });
    this.burst(pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 12, [2, 3], 5);
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const k = Math.max(0, it.life / it.max);
      it.update(it, k, dt);
      if (it.life <= 0) {
        this.scene.remove(it.obj);
        if (it.obj.geometry !== PIXEL) it.obj.geometry.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
