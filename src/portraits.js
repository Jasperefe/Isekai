// Dialogue portraits rendered from the real 3D models (so they always match the game).
// A model is moved into a small studio scene for one render, drawn into a corner of the
// main canvas, copied out as an image, then put back exactly where it was.
import * as THREE from 'three';

const SIZE = 160;
const studio = new THREE.Scene();
studio.add(new THREE.HemisphereLight(0xe8f2ff, 0x2a2f55, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(1.4, 2.2, 2.6); studio.add(key);
const rim = new THREE.DirectionalLight(0x29e6ff, 1.6); rim.position.set(-2.2, 1.2, -1.8); studio.add(rim);
const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
const out = document.createElement('canvas'); out.width = out.height = SIZE;
const g2 = out.getContext('2d');

// obj: Object3D facing +Z. opts: { bg, dist, focus: 'head' | number (0..1 of height), side, reset: [child objects to un-rotate] }
export function capturePortrait(renderer, obj, opts = {}) {
  const { bg = 0x1a2350, dist = 0.95, focus = 'head', side = 0.28, reset = [] } = opts;
  const saved = { parent: obj.parent, pos: obj.position.clone(), quat: obj.quaternion.clone(), vis: obj.visible };
  const kids = reset.map(k => ({ k, q: k.quaternion.clone(), p: k.position.clone() }));
  studio.add(obj); obj.position.set(0, 0, 0); obj.quaternion.identity(); obj.visible = true;
  for (const { k } of kids) { k.quaternion.identity(); k.position.set(0, 0, 0); }
  obj.updateMatrixWorld(true);
  const target = new THREE.Vector3();
  let head = null;
  if (focus === 'head') obj.traverse(o => { if (!head && o.isBone && /^head/i.test(o.name)) head = o; });
  if (head) { head.getWorldPosition(target); target.y += 0.05; }
  else {
    const box = new THREE.Box3().setFromObject(obj);
    box.getCenter(target);
    if (typeof focus === 'number') target.y = box.min.y + (box.max.y - box.min.y) * focus;
  }
  cam.position.set(target.x + dist * side, target.y + dist * 0.1, target.z + dist);
  cam.lookAt(target);
  studio.background = new THREE.Color(bg);

  const vp = renderer.getViewport(new THREE.Vector4()), sc = renderer.getScissor(new THREE.Vector4()), st = renderer.getScissorTest();
  const css = SIZE / renderer.getPixelRatio();
  renderer.setViewport(0, 0, css, css); renderer.setScissor(0, 0, css, css); renderer.setScissorTest(true);
  renderer.render(studio, cam);
  const gl = renderer.domElement;
  g2.drawImage(gl, 0, gl.height - SIZE, SIZE, SIZE, 0, 0, SIZE, SIZE);
  renderer.setScissorTest(st); renderer.setViewport(vp); renderer.setScissor(sc);

  // Put everything back.
  for (const { k, q, p } of kids) { k.quaternion.copy(q); k.position.copy(p); }
  if (saved.parent) saved.parent.add(obj); else studio.remove(obj);
  obj.position.copy(saved.pos); obj.quaternion.copy(saved.quat); obj.visible = saved.vis;
  return out.toDataURL('image/jpeg', 0.88);
}

// SYSTEM speaker: a little terminal icon drawn in 2D.
export function systemPortrait() {
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(80, 70, 10, 80, 80, 90); grd.addColorStop(0, '#3a1450'); grd.addColorStop(1, '#120820');
  g.fillStyle = grd; g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = '#ff2bd6'; g.lineWidth = 6; g.lineJoin = 'round';
  g.strokeRect(30, 42, 100, 76);
  g.beginPath(); g.moveTo(48, 64); g.lineTo(66, 80); g.lineTo(48, 96); g.stroke();
  g.fillStyle = '#29e6ff'; g.fillRect(74, 92, 34, 7);
  for (let y = 0; y < SIZE; y += 4) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y, SIZE, 1); }
  return c.toDataURL('image/jpeg', 0.9);
}
