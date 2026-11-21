// Zone 2 (Glitchwood Forest) enemy models, built in code so they are unique to ISEKAI.
// Each builder returns { root, parts } so the game can animate the parts later.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAGENTA = 0xff2bd6, CYAN = 0x29e6ff;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...o });
const glow = (color, k = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, flatShading: true });

// Box whose front (+Z) and back (-Z) ends can be narrowed, for chunky low-poly animal shapes.
function tbox(w, h, d, { fx = 1, fy = 1, bx = 1, by = 1, lift = 0 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const front = p.getZ(i) > 0;
    p.setX(i, p.getX(i) * (front ? fx : bx));
    p.setY(i, p.getY(i) * (front ? fy : by) + (front ? lift : 0));
  }
  g.computeVertexNormals();
  return g;
}

// Tube that tapers from radius r0 to r1 along a curve (roots, limbs, branches).
function taperTube(points, r0, r1, seg = 14, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const u = i / seg; curve.getPointAt(u, c);
    const r = r0 + (r1 - r0) * Math.pow(u, 0.9);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  g.userData.curve = curve;
  return g;
}

// Sharp thorns sticking out of a curve.
function thorns(curve, count, size, material, seed = 1) {
  const g = new THREE.Group();
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const cone = new THREE.ConeGeometry(size * 0.22, size, 4);
  cone.translate(0, size / 2, 0);
  for (let i = 0; i < count; i++) {
    const u = 0.12 + rnd() * 0.8;
    const p = curve.getPointAt(u), t = curve.getTangentAt(u);
    const side = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(t).normalize();
    const dir = side.addScaledVector(t, 0.35).normalize();
    const m = new THREE.Mesh(cone, material);
    m.position.copy(p).addScaledVector(side, 0.04);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.scale.setScalar(0.6 + rnd() * 0.7);
    g.add(m);
  }
  return g;
}

function edges(mesh, color, opacity) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  mesh.add(l);
  return l;
}

const add = (parent, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; parent.add(m);
  return m;
};

// ---------------------------------------------------------------- Null Wolf
// A wolf built from dark blocks, with missing pieces floating off its body.
// fox: true builds Pip, a small orange pixel fox, from the same body plan.
export function buildNullWolf({ pose = 'idle', fox = false } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = mat(fox ? 0xe0782a : 0x252838), under = mat(fox ? 0xf4e6cf : 0x3a3f58), claw = mat(fox ? 0x2b2320 : 0xd9d4c7);
  const eye = glow(fox ? CYAN : MAGENTA, 2.2), crack = glow(fox ? CYAN : MAGENTA, 1.4);
  const parts = { body };
  const blocks = [];
  const B = (...a) => { const m = add(body, ...a); blocks.push(m); return m; };

  B(tbox(0.44, 0.5, 0.95, { fx: 1.15, fy: 1.2, bx: 0.75, by: 0.72 }), fur, 0, 0.8, 0);            // ribcage
  B(tbox(0.4, 0.4, 0.4, { fx: 0.9, fy: 0.95, bx: 0.85, by: 0.8 }), fur, 0, 0.78, -0.62);           // hips
  B(tbox(0.36, 0.2, 0.7, { fx: 1.1, bx: 0.7 }), under, 0, 0.56, 0.05);                              // belly
  const neck = B(tbox(0.36, 0.4, 0.42, { fx: 0.82, fy: 0.85 }), fur, 0, 1.0, 0.52, -0.65);
  const head = new THREE.Group(); head.position.set(0, 1.12, 0.74); body.add(head); parts.head = head;
  blocks.push(add(head, tbox(0.36, 0.3, 0.34, { fx: 0.9, fy: 0.85, lift: -0.02 }), fur));
  blocks.push(add(head, tbox(0.21, 0.16, 0.34, { fx: 0.55, fy: 0.6, lift: -0.02 }), fur, 0, -0.05, 0.3));
  const jaw = add(head, tbox(0.17, 0.06, 0.3, { fx: 0.55 }), under, 0, -0.14, 0.26, pose === 'attack' ? 0.45 : 0.08); parts.jaw = jaw;
  for (const s of [-1, 1]) {
    const ear = add(head, new THREE.ConeGeometry(0.075, 0.22, 4), fur, s * 0.11, 0.22, -0.06, -0.2, Math.PI / 4, s * -0.22);
    if (fox) ear.scale.set(1.6, 1.5, 1.2);
    add(head, new THREE.BoxGeometry(0.1, 0.042, 0.02), eye, s * 0.095, 0.045, 0.176, 0, s * 0.35, s * -0.2);
    for (let k = 0; k < 2; k++) add(head, new THREE.ConeGeometry(0.018, 0.06, 4), claw, s * 0.045 + s * k * 0.03, -0.12, 0.42 - k * 0.05, Math.PI);
  }
  // Mane: shard-like spikes running down the neck and back.
  const mane = [[0, 1.3, 0.55, 0.26, -0.9], [0, 1.22, 0.36, 0.3, -1.1], [0, 1.12, 0.18, 0.26, -1.3], [0, 1.08, 0.0, 0.22, -1.4], [0, 1.05, -0.2, 0.18, -1.5], [0, 0.99, -0.42, 0.14, -1.6]];
  if (!fox) for (const [x, y, z, h, r] of mane) for (const s of [-1, 0, 1]) {
    if (s && h < 0.2) continue;
    add(body, new THREE.ConeGeometry(0.06, h * (s ? 0.75 : 1), 4), fur, x + s * 0.12, y - (s ? 0.05 : 0), z, r, 0, s * 0.4);
  }
  // Chest ruff: shard-like fur hanging under the neck.
  for (const [x, y, z, h, r] of [[0, 0.82, 0.6, 0.26, 2.7], [-0.1, 0.86, 0.55, 0.22, 2.6], [0.1, 0.86, 0.55, 0.22, 2.6], [-0.06, 0.74, 0.42, 0.2, 2.8], [0.06, 0.74, 0.42, 0.2, 2.8]])
    add(body, new THREE.ConeGeometry(0.06, h, 4), fox ? under : fur, x, y, z, r, 0, x * 2);
  // Legs.
  const legs = [];
  const leg = (x, z, back) => {
    const g = new THREE.Group(); g.position.set(x, 0.84, z); g.userData.leg = true; body.add(g);
    const up = add(g, tbox(0.14, 0.5, 0.18, { bx: 0.8 }), fur, 0, -0.21, 0, back ? 0.35 : -0.05);
    blocks.push(up);
    const knee = new THREE.Group(); knee.position.set(0, -0.44, back ? 0.15 : -0.02); g.add(knee);
    blocks.push(add(knee, tbox(0.085, 0.4, 0.1), under, 0, -0.17, 0, back ? -0.42 : 0.06));
    add(knee, new THREE.BoxGeometry(0.12, 0.06, 0.18), fur, 0, -0.36, back ? -0.03 : 0.04);
    for (const s of [-1, 0, 1]) add(knee, new THREE.ConeGeometry(0.014, 0.06, 4), claw, s * 0.04, -0.37, (back ? 0.06 : 0.13), Math.PI / 2);
    legs.push({ g, knee }); return g;
  };
  leg(-0.17, 0.32); leg(0.17, 0.32); leg(-0.16, -0.62, true); leg(0.16, -0.62, true);
  parts.legs = legs;
  // Tail.
  const tail = new THREE.Group(); tail.position.set(0, 0.9, -0.82); body.add(tail); parts.tail = tail;
  let prev = tail;
  const tailSegs = fox ? [[0.2, 0.3, -0.7], [0.24, 0.3, 0.3], [0.18, 0.26, 0.35]] : [[0.14, 0.26, -0.9], [0.11, 0.24, 0.25], [0.08, 0.22, 0.3]];
  tailSegs.forEach(([w, l, r], i) => {
    const seg = new THREE.Group(); seg.rotation.x = r; seg.position.z = i ? -l * 0.9 : 0; prev.add(seg);
    blocks.push(add(seg, tbox(w, w, l, { fx: 1.1, bx: 0.7 }), fox && i === 2 ? under : fur, 0, 0, -l / 2));
    if (!fox) add(seg, new THREE.ConeGeometry(w * 0.4, w * 1.4, 4), fur, 0, w * 0.55, -l * 0.5, -0.9);
    prev = seg;
  });
  // Glitch: magenta circuit cracks on the flank and "missing pixel" blocks drifting off the hips and back.
  for (const s of [-1, 1]) {
    add(body, new THREE.BoxGeometry(0.01, 0.025, 0.42), crack, s * 0.232, 0.86, 0.05, 0.25);
    add(body, new THREE.BoxGeometry(0.01, 0.17, 0.025), crack, s * 0.236, 0.78, 0.22);
    add(body, new THREE.BoxGeometry(0.01, 0.025, 0.18), crack, s * 0.19, 0.76, -0.62, -0.3);
  }
  const bits = new THREE.Group(); body.add(bits); parts.bits = bits;
  [[0.24, 1.0, -0.72, 0.09, 1], [0.34, 1.12, -0.6, 0.06, 0], [-0.3, 0.98, -0.5, 0.07, 1], [0.1, 1.2, -0.9, 0.05, 0], [-0.16, 1.15, -0.82, 0.08, 0], [0.38, 0.86, -0.92, 0.05, 1], [-0.36, 1.18, 0.12, 0.05, 1], [0.2, 1.3, -0.25, 0.06, 0]]
    .forEach(([x, y, z, s, g]) => { const m = add(bits, new THREE.BoxGeometry(s, s, s), g ? crack : fur, x, y, z, x * 3, z * 4, y); m.userData.base = m.position.clone(); });
  if (fox) bits.children.slice(3).forEach(b => (b.visible = false));
  for (const c of body.children) if (!c.userData.leg) c.position.y += 0.16; // taller, lankier wolf
  for (const b of blocks) edges(b, CYAN, fox ? 0.18 : 0.28);
  parts.mats = { fur, under };

  if (pose === 'idle') { head.rotation.x = 0.18; tail.rotation.x = -0.15; } // low, stalking head
  if (pose === 'attack') {
    body.rotation.x = 0.18; body.position.set(0, 0.22, 0);
    legs[0].g.rotation.x = -1.0; legs[1].g.rotation.x = -0.8; legs[0].knee.rotation.x = 0.7; legs[1].knee.rotation.x = 0.5;
    legs[2].g.rotation.x = 0.9; legs[3].g.rotation.x = 0.7; legs[2].knee.rotation.x = -0.4;
    head.rotation.x = -0.15; tail.rotation.x = 0.5;
  }
  root.userData.height = 1.35;
  return { root, parts };
}

// ---------------------------------------------------------------- Static Sprite
// A floating spirit made from a broken old TV screen: noisy static, rabbit-ear antenna, broken casing.
function staticTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    const band = (y % 23 < 3) ? 60 : 0;
    for (let x = 0; x < 128; x++) {
      const v = Math.min(255, 70 + Math.random() * 185 + band), i = (y * 128 + x) * 4;
      img.data[i] = v * 0.85; img.data[i + 1] = v * 0.97; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}
function eyeTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 20;
  const g = c.getContext('2d');
  g.fillStyle = '#05060c'; g.fillRect(0, 0, 32, 20);
  g.fillStyle = '#29e6ff'; g.fillRect(9, 5, 14, 10);
  g.fillStyle = '#ffffff'; g.fillRect(14, 7, 5, 5);
  g.fillStyle = '#05060c'; g.fillRect(9, 5, 2, 2); g.fillRect(21, 5, 2, 2); g.fillRect(9, 13, 2, 2); g.fillRect(21, 13, 2, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}

export function buildStaticSprite({ pose = 'idle' } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); body.position.y = 1.2; root.add(body);
  const tex = staticTexture();
  const parts = { body, tex };
  const casing = mat(0x3a3e56), trim = mat(0x23263a), metal = mat(0x9aa1b5, { metalness: 0.6, roughness: 0.35 }), crack = glow(MAGENTA, 1.8);
  // Old CRT TV: deep box that narrows toward the back.
  const box = add(body, tbox(0.66, 0.5, 0.44, { bx: 0.72, by: 0.7 }), casing); edges(box, CYAN, 0.35);
  // Screen (static noise) with a bezel, left side of the front.
  const scr = add(body, new THREE.PlaneGeometry(0.42, 0.34), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: pose === 'attack' ? 1.4 : 0.6, roughness: 0.3 }), -0.08, 0.01, 0.224);
  scr.castShadow = false;
  for (const [w, h, x, y] of [[0.48, 0.035, -0.08, 0.19], [0.48, 0.035, -0.08, -0.17], [0.035, 0.39, -0.305, 0.01], [0.035, 0.39, 0.145, 0.01]]) add(body, new THREE.BoxGeometry(w, h, 0.03), trim, x, y, 0.228);
  // Pixel eye on the screen.
  parts.eye = add(body, new THREE.PlaneGeometry(0.2, 0.125), new THREE.MeshBasicMaterial({ map: eyeTexture(), transparent: true }), -0.08, 0.02, 0.227);
  // Control panel: two dials and a speaker grille.
  for (const y of [0.11, -0.01]) { const k = add(body, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), metal, 0.24, y, 0.235, Math.PI / 2); k.rotation.y = y * 9; }
  for (let i = 0; i < 4; i++) add(body, new THREE.BoxGeometry(0.1, 0.012, 0.01), trim, 0.24, -0.1 - i * 0.025, 0.226);
  // Crack across the screen corner, and a broken-off casing corner drifting away.
  [[-0.24, 0.12, 0.08, -0.7], [-0.19, 0.08, 0.07, 0.4], [-0.15, 0.05, 0.06, -0.9]].forEach(([x, y, l, r]) => add(body, new THREE.BoxGeometry(l, 0.012, 0.01), crack, x, y, 0.232, 0, 0, r));
  const bits = new THREE.Group(); body.add(bits); parts.bits = bits;
  [[0.38, 0.3, 0.05, 0.08, 0], [0.47, 0.4, -0.05, 0.05, 1], [0.33, 0.43, 0.12, 0.04, 0], [-0.42, -0.24, 0.0, 0.05, 1]]
    .forEach(([x, y, z, sz, g]) => add(bits, new THREE.BoxGeometry(sz, sz, sz), g ? glow(CYAN, 1.8) : casing, x, y, z, x * 4, y * 5, 0));
  // Back vents and the power cord it ripped out of the wall (still sparking).
  for (let i = 0; i < 4; i++) add(body, new THREE.BoxGeometry(0.26, 0.018, 0.01), trim, 0, 0.1 - i * 0.05, -0.222);
  const cord = add(body, taperTube([[0.08, -0.12, -0.2], [0.14, -0.3, -0.32], [0.05, -0.55, -0.3], [-0.06, -0.72, -0.18], [-0.02, -0.86, -0.1]], 0.016, 0.014, 16, 5), trim);
  parts.cord = cord;
  const plug = new THREE.Group(); plug.position.set(-0.02, -0.9, -0.1); body.add(plug);
  add(plug, new THREE.BoxGeometry(0.07, 0.08, 0.05), mat(0x15171f));
  for (const x of [-0.015, 0.015]) add(plug, new THREE.BoxGeometry(0.008, 0.04, 0.008), metal, x, -0.06, 0);
  add(plug, new THREE.OctahedronGeometry(0.035), glow(CYAN, 2.2), 0.04, -0.09, 0.02, 0.4, 0.6, 0);
  // Rabbit-ear antenna.
  add(body, new THREE.CylinderGeometry(0.05, 0.07, 0.05, 8), metal, 0, 0.27, -0.04);
  for (const s2 of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(0, 0.29, -0.04); a.rotation.z = s2 * -0.55; a.rotation.x = -0.2; body.add(a);
    add(a, new THREE.CylinderGeometry(0.011, 0.015, 0.46, 5), metal, 0, 0.23, 0);
    add(a, new THREE.SphereGeometry(0.032, 8, 6), glow(s2 < 0 ? CYAN : MAGENTA, 2), 0, 0.47, 0);
  }
  // Signal trail: scanline strips below it instead of legs (one mesh, colours fade downward).
  const trail = new THREE.Group(); body.add(trail); parts.trail = trail;
  const strips = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BoxGeometry(0.4 - i * 0.08, 0.025, 0.2 - i * 0.04).toNonIndexed();
    g.translate(i % 2 ? 0.03 : -0.03, -0.34 - i * 0.13, -0.04);
    const c = new THREE.Color(i % 2 ? CYAN : 0xc9cfdd).multiplyScalar(1 - i * 0.2), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.deleteAttribute('uv'); g.deleteAttribute('normal');
    strips.push(g);
  }
  const tm = new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 }));
  tm.userData.keep = true; tm.castShadow = false; trail.add(tm);
  if (pose === 'attack') {
    body.rotation.x = 0.12;
    const boltM = new THREE.MeshBasicMaterial({ color: CYAN });
    for (let b2 = 0; b2 < 3; b2++) {
      let p = new THREE.Vector3(-0.08, 0.01, 0.25);
      for (let k = 0; k < 6; k++) {
        const n = p.clone().add(new THREE.Vector3((Math.sin(b2 * 7 + k * 3) * 0.15) + (b2 - 1) * 0.1, Math.cos(b2 * 5 + k * 2) * 0.15, 0.3));
        const len = n.distanceTo(p), seg = add(body, new THREE.BoxGeometry(0.025, 0.025, len), boltM);
        seg.position.copy(p).add(n).multiplyScalar(0.5);
        seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().sub(p).normalize()); seg.castShadow = false;
        p = n;
      }
    }
  }
  root.userData.height = 2.0;
  return { root, parts };
}

// ---------------------------------------------------------------- Thornwraith (Zone 2 boss)
// A forest guardian that was never finished: twisted roots and branches, a bone-wood mask,
// a glowing glitch heart, and a right arm that is still untextured wireframe.
export function buildThornwraith({ pose = 'idle' } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bark = mat(0x4b362b), darkBark = mat(0x2f221c), bone = mat(0xb9ab8f), moss = mat(0x5f7d3a), thorn = mat(0x1e1714);
  const heartM = glow(MAGENTA, 2.4), eyeM = glow(0xfff1fb, 3), crack = glow(MAGENTA, 1.6);
  const wireM = new THREE.MeshBasicMaterial({ color: MAGENTA, wireframe: true });
  const parts = { body };
  const tube = (pts, r0, r1, m = bark, nThorns = 0, parent = body, seed = 1) => {
    const g = taperTube(pts, r0, r1);
    const mesh = add(parent, g, m);
    if (nThorns) parent.add(thorns(g.userData.curve, nThorns, 0.22, thorn, seed));
    return mesh;
  };
  // Roots for legs.
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.3, dx = Math.sin(a), dz = Math.cos(a), R = 1.25 + (i % 2) * 0.3;
    tube([[dx * 0.1, 1.45, dz * 0.1], [dx * R * 0.45, 1.05, dz * R * 0.45], [dx * R * 0.85, 0.45, dz * R * 0.85], [dx * R * 1.1, 0.02, dz * R * 1.1]], 0.24, 0.05, i % 2 ? darkBark : bark, 2, body, i + 3);
  }
  // Twisted trunk: three strands spiralling up into the chest.
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 0.125) {
      const a = k * Math.PI * 2 / 3 + t * 2.4, r = 0.24 + 0.12 * Math.sin(t * Math.PI) + t * 0.12;
      pts.push([Math.cos(a) * r, 1.25 + t * 2.0, Math.sin(a) * r * 0.75]);
    }
    tube(pts, 0.21, 0.17, k === 1 ? darkBark : bark, 3, body, k + 11);
  }
  // Glitch heart, visible between the strands.
  const heart = add(body, new THREE.OctahedronGeometry(0.24), heartM, 0, 2.3, 0.3); heart.scale.y = 1.35; parts.heart = heart;
  add(body, new THREE.OctahedronGeometry(0.36), new THREE.MeshBasicMaterial({ color: MAGENTA, wireframe: true }), 0, 2.3, 0.3).scale.y = 1.35;
  // Rib-like branches caging the heart.
  for (const s2 of [-1, 1]) for (const y of [2.02, 2.3, 2.58]) {
    tube([[s2 * 0.3, y - 0.05, -0.1], [s2 * 0.4, y, 0.2], [s2 * 0.22, y + 0.06, 0.46], [s2 * 0.06, y + 0.08, 0.5]], 0.055, 0.018, darkBark);
  }
  // Glowing cracks in the bark.
  for (const [x, y, z, r] of [[0.18, 1.7, 0.3, 0.3], [-0.2, 2.9, 0.3, -0.4], [0.3, 3.0, 0.22, 0.6], [-0.1, 1.45, 0.28, -0.2]]) add(body, new THREE.BoxGeometry(0.025, 0.26, 0.02), crack, x, y, z, 0, 0, r);
  // Shoulder yoke and neck.
  tube([[-1.0, 3.15, -0.05], [-0.45, 3.35, 0.02], [0.45, 3.35, 0.02], [1.0, 3.15, -0.05]], 0.24, 0.2, bark, 4, body, 21);
  tube([[0, 3.2, 0], [0, 3.45, 0.04], [0.02, 3.62, 0.08]], 0.2, 0.15, darkBark);
  for (const [x, y, z, s] of [[-0.75, 3.36, 0.05, 0.22], [0.55, 3.4, -0.06, 0.18], [-0.25, 3.42, 0.1, 0.14], [0.1, 1.55, 0.3, 0.2]]) {
    const m = add(body, new THREE.IcosahedronGeometry(s, 0), moss, x, y, z); m.scale.y = 0.45;
  }
  // Hanging moss vines.
  for (const [x, z, l] of [[-0.85, 0.12, 0.9], [-0.55, 0.15, 0.6], [0.35, 0.14, 0.75], [0.7, 0.05, 0.5]]) {
    tube([[x, 3.3, z], [x + 0.04, 3.3 - l * 0.5, z + 0.06], [x - 0.02, 3.3 - l, z + 0.03]], 0.035, 0.012, moss);
  }
  // Left arm (finished): long bark arm with three claw branches.
  const arm = (s, unfinished) => {
    const g = new THREE.Group(); g.position.set(s * 0.95, 3.18, 0); body.add(g);
    const raised = pose === 'attack';
    const P = raised
      ? [[0, 0, 0], [s * 0.45, 0.6, 0.1], [s * 0.6, 1.25, 0.35], [s * 0.55, 1.75, 0.55]]
      : [[0, 0, 0], [s * 0.45, -0.55, 0.12], [s * 0.6, -1.25, 0.35], [s * 0.62, -1.75, 0.6]];
    const m = unfinished ? wireM : bark;
    const a = add(g, taperTube(P, 0.18, 0.09), m);
    if (!unfinished) g.add(thorns(a.geometry.userData.curve, 5, 0.22, thorn, s > 0 ? 31 : 37));
    const end = new THREE.Vector3(...P[3]);
    for (let f = -1; f <= 1; f++) {
      const dir = raised ? 1 : -1;
      const c = add(g, taperTube([[end.x, end.y, end.z], [end.x + s * 0.08 + f * 0.12, end.y + dir * 0.3, end.z + 0.15], [end.x + s * 0.05 + f * 0.22, end.y + dir * 0.55, end.z + 0.4]], 0.06, 0.01, 10, 5), unfinished ? wireM : bone);
      c.castShadow = !unfinished;
    }
    // Floating cubes where the unfinished arm "fails to load".
    if (unfinished) for (let i = 0; i < 7; i++) {
      const u = i / 7, p = new THREE.Vector3().lerpVectors(new THREE.Vector3(...P[1]), end, u);
      add(g, new THREE.BoxGeometry(0.09, 0.09, 0.09), i % 2 ? crack : bark, p.x + Math.sin(i * 2.3) * 0.22, p.y + Math.cos(i * 1.7) * 0.15, p.z + Math.sin(i) * 0.2, i, i * 2, 0);
    }
    return g;
  };
  parts.armL = arm(-1, false); parts.armR = arm(1, true);
  // Head: a bone-wood mask with glowing eye slits, crowned with thorny antlers.
  const head = new THREE.Group(); head.position.set(0, 3.9, 0.1); head.scale.setScalar(1.3); body.add(head); parts.head = head;
  const mask = add(head, new THREE.DodecahedronGeometry(0.34, 0), bone); mask.scale.set(1, 1.28, 0.78);
  for (const s of [-1, 1]) {
    add(head, new THREE.BoxGeometry(0.13, 0.04, 0.05), eyeM, s * 0.12, 0.07, 0.25, 0, s * 0.3, s * 0.22);
    add(head, new THREE.BoxGeometry(0.02, 0.2, 0.03), crack, s * 0.05, -0.15, 0.26, 0, 0, s * 0.15);
    // Antlers.
    const base = [s * 0.2, 0.2, -0.02];
    tube([base, [s * 0.42, 0.55, -0.08], [s * 0.55, 0.95, -0.18], [s * 0.5, 1.3, -0.25]], 0.07, 0.015, darkBark, 3, head, s > 0 ? 41 : 43);
    tube([[s * 0.42, 0.55, -0.08], [s * 0.72, 0.72, -0.05], [s * 0.88, 0.98, -0.02]], 0.045, 0.01, darkBark, 0, head);
    tube([[s * 0.52, 0.85, -0.15], [s * 0.3, 1.08, -0.2], [s * 0.28, 1.25, -0.22]], 0.035, 0.008, darkBark, 0, head);
  }
  if (pose === 'attack') { head.rotation.x = -0.2; body.rotation.x = -0.05; }
  root.userData.height = 5.6;
  return { root, parts };
}

// Merge every mesh under each animated node into as few meshes as possible, so a whole
// monster costs ~10 draw calls instead of ~100. Plain coloured parts share one vertex-coloured
// material, glowing parts share one unlit material; textured/transparent parts stay separate.
// `keep` = nodes that animate.
const VC_STD = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0.1 });
const VC_GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });
function matClass(m) {
  if (m.map || m.transparent || m.wireframe || m.side === THREE.DoubleSide) return null;
  if (m.isMeshBasicMaterial) return ['glow', m.color];
  if (m.isMeshStandardMaterial) {
    if (m.emissiveIntensity > 0.9 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.3) return ['glow', m.emissive.clone().multiplyScalar(Math.min(1.25, m.emissiveIntensity * 0.75))];
    return ['std', m.color];
  }
  return null;
}
export function bake(root, keep, { lines = true } = {}) {
  const keepSet = new Set([root, ...keep.filter(Boolean)]);
  root.updateMatrixWorld(true);
  const buckets = new Map(), remove = [];
  root.traverse(o => {
    if (!(o.isMesh || o.isLineSegments) || o.userData.keep || keepSet.has(o)) return;
    let K = o.parent, skip = false;
    while (K && !keepSet.has(K)) { if (K.userData.keep) skip = true; K = K.parent; }
    if (skip || !K) return;
    remove.push(o);
    if (!o.visible) return;
    if (o.isLineSegments && !lines) return;
    const m = new THREE.Matrix4().copy(K.matrixWorld).invert().multiply(o.matrixWorld);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(m);
    const cls = o.isLineSegments ? null : matClass(o.material);
    for (const name of Object.keys(g.attributes)) {
      if (name === 'position') continue;
      const keepUv = name === 'uv' && !cls && o.material.map;
      if (o.isLineSegments || !(name === 'normal' || keepUv)) g.deleteAttribute(name);
    }
    if (!o.isLineSegments && !g.attributes.normal) g.computeVertexNormals();
    let mat = o.material, key;
    if (cls) {
      const [kind, color] = cls, n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      if (kind === 'glow') g.deleteAttribute('normal');
      mat = kind === 'glow' ? VC_GLOW : VC_STD; key = K.uuid + '|' + kind;
    } else key = K.uuid + '|' + o.material.uuid + '|' + (o.isLineSegments ? 'L' : 'M');
    if (!buckets.has(key)) buckets.set(key, { K, mat, line: o.isLineSegments, geos: [], shadow: false });
    const bk = buckets.get(key); bk.geos.push(g); bk.shadow ||= o.castShadow && !(mat === VC_GLOW);
  });
  for (const o of remove) o.parent?.remove(o);
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false); if (!merged) { console.warn('bake: merge failed', b.mat.type); continue; }
    const obj = b.line ? new THREE.LineSegments(merged, b.mat) : new THREE.Mesh(merged, b.mat);
    if (!b.line) obj.castShadow = b.shadow;
    b.K.add(obj);
  }
  return root;
}
