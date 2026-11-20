// GUIDE: the floating tutorial cube that follows Jasper. Its face is drawn on a canvas.
import * as THREE from 'three';

export class Guide {
  constructor(scene) {
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = 128;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    const body = new THREE.MeshStandardMaterial({ color: 0xdfe9f5, metalness: 0.3, roughness: 0.35 });
    const face = new THREE.MeshBasicMaterial({ map: this.tex });
    // Face on +Z, plain body elsewhere.
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), [body, body, body, body, face, body]);
    this.mesh.castShadow = true;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.44, 0.44, 0.44)), new THREE.LineBasicMaterial({ color: 0x29e6ff }));
    this.mesh.add(edge);
    this.light = new THREE.PointLight(0x29e6ff, 1.5, 4); this.mesh.add(this.light);
    this.group = new THREE.Group(); this.group.add(this.mesh); scene.add(this.group);
    this.pos = new THREE.Vector3(); this.talking = false; this.mood = 'happy'; this.blinkT = 0;
    this.#draw();
  }

  #draw() {
    const g = this.canvas.getContext('2d');
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#29e6ff';
    const blink = this.blinkT > 0;
    for (const x of [38, 90]) {
      if (blink) g.fillRect(x - 12, 52, 24, 5);
      else if (this.mood === 'worried') { g.fillRect(x - 10, 44, 20, 20); g.fillStyle = '#0b1020'; g.fillRect(x - 10, 44, 20, 7); g.fillStyle = '#29e6ff'; }
      else g.fillRect(x - 10, 42, 20, 22);
    }
    if (this.talking && Math.floor(performance.now() / 120) % 2) g.fillRect(48, 82, 32, 14);
    else if (this.mood === 'worried') g.fillRect(50, 88, 28, 5);
    else { g.fillRect(44, 80, 6, 6); g.fillRect(50, 86, 28, 6); g.fillRect(78, 80, 6, 6); }
    this.tex.needsUpdate = true;
  }

  teleport(p) { this.pos.copy(p).add(new THREE.Vector3(0.9, 2.2, 0)); this.group.position.copy(this.pos); }

  update(dt, t, playerPos, playerFacing, camera) {
    // Float just behind Jasper's right shoulder.
    const side = new THREE.Vector3(Math.cos(playerFacing), 0, -Math.sin(playerFacing));
    const back = new THREE.Vector3(-Math.sin(playerFacing), 0, -Math.cos(playerFacing));
    const target = playerPos.clone().addScaledVector(side, -0.9).addScaledVector(back, this.talking ? 0.4 : 0).add(new THREE.Vector3(0, 2.25 + Math.sin(t * 2.2) * 0.12, 0));
    this.pos.lerp(target, 1 - Math.pow(0.02, dt));
    this.group.position.copy(this.pos);
    // Face the camera, with a little wobble when talking.
    this.mesh.lookAt(camera.position.x, this.pos.y, camera.position.z);
    if (this.talking) this.mesh.rotation.z = Math.sin(t * 12) * 0.12;
    // Occasional glitch jitter (it's an unfinished game after all).
    if (Math.sin(t * 3.1) > 0.995) this.mesh.position.x = (Math.random() - 0.5) * 0.2; else this.mesh.position.x *= 0.8;
    this.blinkT -= dt;
    if (this.blinkT < -3 - Math.random() * 3) this.blinkT = 0.12;
    this.#draw();
  }
}
