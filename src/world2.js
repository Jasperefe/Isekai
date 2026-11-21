// Zone 2: Glitchwood Forest. Dark teal forest with purple Null cracks.
// Areas: Forest Edge (arrival), Mira's Hut (west), Corrupted Grove (east), Root Hollow (boss, north).
// Same interface as the Zone 1 World: colliders, crystals, groundAt, resolve, insideBuilding, update, setBarrier.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const WORLD2_RADIUS = 80;
export const Z2 = {
  gate: new THREE.Vector3(0, 0, 66),        // gate back to Starter Meadow
  arrive: new THREE.Vector3(0, 0, 58),
  edge: new THREE.Vector3(0, 0, 46), edgeR: 9,
  hut: new THREE.Vector3(-38, 0, 12), hutR: 12,
  grove: new THREE.Vector3(34, 0, 2), groveR: 17,
  hollow: new THREE.Vector3(0, 0, -48), hollowR: 16,
  pip: new THREE.Vector3(45, 0, -6),
  secret: new THREE.Vector3(-52, 0, -22),   // glitch wall nook (needs /noclip)
  ledge: new THREE.Vector3(24, 0, -26),     // tall stump with a chest (needs /doublejump)
};
export const PATHS2 = [
  [[0, 66], [0, 46], [-4, 30], [-2, 16], [1, 0], [0, -16], [0, -32]],
  [[-2, 16], [-14, 15], [-26, 13], [-38, 12]],
  [[1, 4], [12, 6], [24, 3], [34, 2]],
];

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function distToPath(x, z) {
  let best = 1e9;
  for (const line of PATHS2) for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1];
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

export function heightAt2(x, z) {
  let h = Math.sin(x * 0.09 + 1) * Math.cos(z * 0.08) * 1.4 + Math.sin((x - z) * 0.04) * 1.8 + Math.cos(x * 0.23) * Math.sin(z * 0.21) * 0.3;
  let flat = 1;
  const flatten = (p, r) => { flat = Math.min(flat, smooth(r, r + 9, Math.hypot(x - p.x, z - p.z))); };
  flatten(Z2.edge, Z2.edgeR); flatten(Z2.gate, 6); flatten(Z2.hut, Z2.hutR - 2); flatten(Z2.grove, Z2.groveR - 4);
  flatten(Z2.secret, 4); flatten(Z2.ledge, 4);
  flat = Math.min(flat, smooth(3, 8, distToPath(x, z)) * 0.7 + 0.3);
  h *= flat;
  // Root Hollow: a flat sunken bowl.
  const dh = Math.hypot(x - Z2.hollow.x, z - Z2.hollow.z);
  h = h * smooth(Z2.hollowR + 1, Z2.hollowR + 10, dh) - smooth(Z2.hollowR + 8, Z2.hollowR - 2, dh) * 1.6;
  h += smooth(WORLD2_RADIUS - 8, WORLD2_RADIUS + 10, Math.hypot(x, z)) * 10;
  return h;
}

const MAGENTA = 0xff2bd6;

export class World2 {
  constructor(scene, natureGltf, villageKit, quality) {
    this.scene = scene; this.quality = quality;
    this.colliders = []; this.platforms = [];
    this.barrier = null; this.bridgeRepaired = true;
    this.lib = {};
    for (const c of natureGltf.scene.children) this.lib[c.name] = c;
    this.#sky(); this.#lights(quality); this.#terrain();
    this.#hut(villageKit);
    this.#hollow();
    this.#gate();
    this.#secrets(villageKit);
    this.crystals = [new THREE.Vector3(6, 0, 50), new THREE.Vector3(-30, 0, 6), new THREE.Vector3(6, 0, -24)].map(p => this.#crystal(p));
    this.#cracks();
    this.#props(quality);
  }

  // ---- Sky, fog, light: dim teal forest under a purple-tinted sky ----
  #sky() {
    const s = this.scene;
    s.background = new THREE.Color(0x203f48);
    s.fog = new THREE.Fog(0x24464f, 16, 72);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x2a1d4a) }, bottom: { value: new THREE.Color(0x2d5a63) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(vP.y*1.5+0.1,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, t),1.0); }',
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), mat); s.add(this.skyDome);
    // Drifting glitch motes (fireflies made of pixels).
    const n = 160, pos = new Float32Array(n * 3), r = rng(99);
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = r() * 70; pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = 0.5 + r() * 6; pos[i * 3 + 2] = Math.sin(a) * d; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9cffe8, size: 0.14, transparent: true, opacity: 0.8, depthWrite: false }));
    s.add(this.motes);
  }

  #lights(quality) {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x9fd6d0, 0x23352a, 1.15));
    const sun = new THREE.DirectionalLight(0xcfe6ff, 1.7);
    if (quality.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      const c = sun.shadow.camera; c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 90;
      sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
    }
    s.add(sun); s.add(sun.target);
    this.sun = sun;
  }

  #terrain() {
    const size = 176, seg = 140;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = [];
    const c1 = new THREE.Color(0x2f5a3c), c2 = new THREE.Color(0x3d6b46), c3 = new THREE.Color(0x2a4f4c);
    const dirt = new THREE.Color(0x5e4c3a), null_ = new THREE.Color(0x4a2a5e), hollow = new THREE.Color(0x3b3226);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heightAt2(x, z);
      pos.setY(i, h);
      const n = (Math.sin(x * 0.31) * Math.cos(z * 0.27) + Math.sin(x * 0.09 + z * 0.12)) * 0.5 + 0.5;
      tmp.copy(c1).lerp(c2, n * 0.6).lerp(c3, Math.max(0, Math.sin(x * 0.06 + z * 0.05)) * 0.7);
      const pd = distToPath(x, z);
      if (pd < 2.2) tmp.lerp(dirt, (1 - pd / 2.2) * 0.85);
      // Corruption spreads around the grove and the hollow.
      const corr = Math.max(smooth(Z2.groveR + 6, Z2.groveR - 6, Math.hypot(x - Z2.grove.x, z - Z2.grove.z)), smooth(Z2.hollowR + 10, Z2.hollowR - 4, Math.hypot(x - Z2.hollow.x, z - Z2.hollow.z)) * 0.7);
      tmp.lerp(null_, corr * 0.55 * (0.6 + n * 0.4));
      const dh = Math.hypot(x - Z2.hollow.x, z - Z2.hollow.z);
      if (dh < Z2.hollowR) tmp.lerp(hollow, 0.45);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }));
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  // Bake static meshes into one mesh per material.
  #mergeStatic(root) {
    root.updateMatrixWorld(true);
    const buckets = new Map();
    root.traverse(o => {
      if (!o.isMesh) return;
      const src = o.geometry, geo = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv']) {
        const a = src.attributes[name]; if (!a) continue;
        const arr = new Float32Array(a.count * a.itemSize), get = [a.getX, a.getY, a.getZ, a.getW];
        for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = get[k].call(a, i);
        geo.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
      }
      if (src.index) geo.setIndex(Array.from(src.index.array));
      geo.applyMatrix4(o.matrixWorld);
      if (geo.attributes.normal) geo.normalizeNormals();
      const sig = o.material.uuid + '|' + Object.keys(geo.attributes).sort().join(',') + '|' + (geo.index ? 'i' : 'n');
      if (!buckets.has(sig)) buckets.set(sig, { mat: o.material, geos: [] });
      buckets.get(sig).geos.push(geo);
    });
    for (const { mat, geos } of buckets.values()) {
      const merged = mergeGeometries(geos, false); if (!merged) continue;
      const m = new THREE.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
    }
  }

  // ---- Mira's hut: a mossy stone cottage in a clearing, lantern by the door ----
  #hut(kit) {
    const statics = new THREE.Group();
    const h = kit.house({ w: 2, d: 2, style: 'brick', floors: 1, door: 0, chimney: true, vines: true });
    const hx = Z2.hut.x - 4, hz = Z2.hut.z - 3, ry = Math.atan2(Z2.hut.x - hx + 4, Z2.hut.z - hz + 6);
    h.position.set(hx, heightAt2(hx, hz) - 0.1, hz); h.rotation.y = ry; statics.add(h);
    const f = h.userData.footprint;
    this.colliders.push({ box: true, x: hx, z: hz, hx: f.hx, hz: f.hz, ry });
    const prop = (name, x, z, r = 0) => { const p = kit.piece(name); p.position.set(x, heightAt2(x, z), z); p.rotation.y = r; statics.add(p); return p; };
    for (const [x, z] of [[Z2.hut.x + 3, Z2.hut.z - 4], [Z2.hut.x + 3.8, Z2.hut.z - 3.3]]) { prop('Prop_Crate', x, z, x); this.colliders.push({ x, z, r: 0.7 }); }
    this.#mergeStatic(statics);
    // Lantern with a warm light: the only warm colour in the forest.
    const lantern = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x3b2a1e })); post.position.y = 1.1; lantern.add(post);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.3), new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xffa236, emissiveIntensity: 2 })); glass.position.y = 2.3; lantern.add(glass);
    this.hutLight = new THREE.PointLight(0xffb060, 8, 10); this.hutLight.position.y = 2.3; lantern.add(this.hutLight);
    const lx = Z2.hut.x - 1, lz = Z2.hut.z + 4.5;
    lantern.position.set(lx, heightAt2(lx, lz), lz); this.scene.add(lantern);
    this.colliders.push({ x: lx, z: lz, r: 0.25 });
  }

  // ---- Root Hollow: sunken arena ringed by giant roots; barrier during the boss ----
  #hollow() {
    const bark = new THREE.MeshStandardMaterial({ color: 0x3e2d24, roughness: 0.9, flatShading: true });
    const geos = [];
    const r = rng(4242);
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.35) continue; // gap facing south (+z)
      const R = Z2.hollowR + 2 + r() * 1.5, cx = Z2.hollow.x + Math.cos(a) * R, cz = Z2.hollow.z + Math.sin(a) * R;
      const tx = Math.cos(a + Math.PI / 2), tz = Math.sin(a + Math.PI / 2);
      const span = 3 + r() * 2, hgt = 3 + r() * 3;
      const pts = [new THREE.Vector3(cx - tx * span, heightAt2(cx - tx * span, cz - tz * span) - 0.5, cz - tz * span), new THREE.Vector3(cx - tx * span * 0.4, hgt, cz - tz * span * 0.4), new THREE.Vector3(cx + tx * span * 0.4, hgt * 0.9, cz + tz * span * 0.4), new THREE.Vector3(cx + tx * span, heightAt2(cx + tx * span, cz + tz * span) - 0.5, cz + tz * span)];
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.45 + r() * 0.25, 6, false));
      for (const s of [-1, -0.4, 0.4, 1]) this.colliders.push({ x: cx + tx * span * s * 0.9, z: cz + tz * span * s * 0.9, r: 0.9 });
    }
    const roots = new THREE.Mesh(mergeGeometries(geos), bark); roots.castShadow = true; roots.receiveShadow = true;
    this.scene.add(roots);
    const mat = new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.22, side: THREE.DoubleSide, wireframe: true, depthWrite: false });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(Z2.hollowR, Z2.hollowR, 7, 48, 4, true), mat);
    b.position.set(Z2.hollow.x, heightAt2(Z2.hollow.x, Z2.hollow.z) + 3, Z2.hollow.z); b.visible = false;
    this.scene.add(b); this.barrierMesh = b;
  }

  setBarrier(on) { this.barrier = on; this.barrierMesh.visible = on; }

  // ---- Gate back to Starter Meadow ----
  #gate() {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x6c7380, roughness: 0.9, flatShading: true });
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), stone); pillar.position.set(sx * 3, 3, 0); g.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), stone); cap.position.set(sx * 3, 6.2, 0); g.add(cap);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1, 1.4), stone); lintel.position.y = 6.8; g.add(lintel);
    this.portalMat = new THREE.MeshBasicMaterial({ color: 0x3cd6ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 6), this.portalMat); portal.position.y = 3; g.add(portal);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(Z2.gate.x, heightAt2(Z2.gate.x, Z2.gate.z), Z2.gate.z);
    this.scene.add(g);
    this.colliders.push({ box: true, x: Z2.gate.x, z: Z2.gate.z, hx: 3.6, hz: 0.7, ry: 0 });
  }

  // ---- Console secrets: a glitch wall (/noclip) and a tall stump (/doublejump) ----
  #secrets(kit) {
    // Nook of rocks with a wall of corrupted data across the opening.
    const s = Z2.secret, rockMat = new THREE.MeshStandardMaterial({ color: 0x55606a, flatShading: true, roughness: 0.95 });
    const rocks = [];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + 0.55 + i / 8 * (Math.PI * 2 - 1.1); // opening faces +z (toward the path)
      const x = s.x + Math.cos(a) * 3.4, z = s.z + Math.sin(a) * 3.4;
      const geo = new THREE.DodecahedronGeometry(1.5, 0); geo.scale(1, 1.6, 1);
      geo.rotateY(i); geo.translate(x, heightAt2(x, z) + 1.4, z); rocks.push(geo);
      this.colliders.push({ x, z, r: 1.45 });
    }
    const rm = new THREE.Mesh(mergeGeometries(rocks), rockMat); rm.castShadow = true; rm.receiveShadow = true; this.scene.add(rm);
    const wallMat = new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.4, 12, 10), wallMat);
    wall.position.set(s.x, heightAt2(s.x, s.z + 3.2) + 1.7, s.z + 3.2); this.scene.add(wall);
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.4, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 }));
    grid.position.copy(wall.position).add(new THREE.Vector3(0, 0, 0.02)); this.scene.add(grid);
    this.glitchWall = wall; this.glitchWallPos = wall.position.clone();
    this.colliders.push({ box: true, x: s.x, z: s.z + 3.2, hx: 1.9, hz: 0.35, ry: 0, glitch: true });
    // Tall broken stump: top at 2.3 m, only reachable with a double jump.
    const l = Z2.ledge, top = 1.85;
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.7, top + 1, 9), new THREE.MeshStandardMaterial({ color: 0x4a3628, flatShading: true, roughness: 0.9 }));
    stump.position.set(l.x, heightAt2(l.x, l.z) + (top - 1) / 2, l.z); stump.castShadow = true; stump.receiveShadow = true; this.scene.add(stump);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.05, 9), new THREE.MeshStandardMaterial({ color: 0x8a6a48, flatShading: true }));
    ring.position.set(l.x, heightAt2(l.x, l.z) + top + 0.0, l.z); this.scene.add(ring);
    this.platforms.push({ x: l.x, z: l.z, r: 1.3, top: heightAt2(l.x, l.z) + top });
  }

  // ---- Save crystals ----
  #crystal(p) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8ff4ff, emissive: 0x29e6ff, emissiveIntensity: 1.4, transparent: true, opacity: 0.9, metalness: 0.2, roughness: 0.1 });
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), mat); c.scale.y = 1.7; c.position.y = 1.6; g.add(c);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x6c7380, flatShading: true })); base.position.y = 0.15; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: 0x29e6ff })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; g.add(ring);
    g.position.set(p.x, heightAt2(p.x, p.z), p.z);
    this.scene.add(g);
    this.colliders.push({ x: p.x, z: p.z, r: 0.9 });
    return { group: g, gem: c, pos: g.position.clone() };
  }

  // ---- Null cracks: glowing purple fissures in the ground ----
  #cracks() {
    const r = rng(777), quads = [];
    const crack = (cx, cz, len) => {
      let x = cx, z = cz, a = r() * Math.PI * 2;
      for (let i = 0; i < len; i++) {
        a += (r() - 0.5) * 1.3;
        const nx = x + Math.cos(a) * 0.9, nz = z + Math.sin(a) * 0.9, w = 0.045 + r() * 0.06;
        const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
        const y0 = heightAt2(x, z) + 0.04, y1 = heightAt2(nx, nz) + 0.04;
        quads.push(x + px, y0, z + pz, x - px, y0, z - pz, nx + px, y1, nz + pz, nx + px, y1, nz + pz, x - px, y0, z - pz, nx - px, y1, nz - pz);
        if (r() < 0.25) crack(nx, nz, Math.floor(len * 0.4)); // branch
        x = nx; z = nz;
      }
    };
    for (let i = 0; i < 16; i++) { const a = r() * Math.PI * 2, d = r() * Z2.groveR; crack(Z2.grove.x + Math.cos(a) * d, Z2.grove.z + Math.sin(a) * d, 6 + Math.floor(r() * 6)); }
    for (let i = 0; i < 12; i++) { const a = r() * Math.PI * 2, d = Z2.hollowR * (0.3 + r() * 0.9); crack(Z2.hollow.x + Math.cos(a) * d, Z2.hollow.z + Math.sin(a) * d, 5 + Math.floor(r() * 6)); }
    for (let i = 0; i < 6; i++) crack((r() - 0.5) * 8, -6 - r() * 22, 5);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(quads, 3));
    this.crackMat = new THREE.MeshBasicMaterial({ color: MAGENTA, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g, this.crackMat); this.scene.add(m);
    // Floating corrupted cubes over the grove.
    const n = 26, cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0x9a4dff }), n);
    this.cubes = { mesh: cubes, data: [] };
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = r() * Z2.groveR, x = Z2.grove.x + Math.cos(a) * d, z = Z2.grove.z + Math.sin(a) * d;
      this.cubes.data.push({ x, z, y: heightAt2(x, z) + 1 + r() * 3, s: 0.5 + r() * 1.2, ph: r() * 6 });
    }
    this.scene.add(cubes);
  }

  // ---- Instanced forest ----
  #instance(template, transforms, shadow) {
    template.updateMatrixWorld(true);
    const meshes = [];
    template.traverse(o => { if (o.isMesh) meshes.push(o); });
    const m4 = new THREE.Matrix4(), local = new THREE.Matrix4(), inv = new THREE.Matrix4().copy(template.matrixWorld).invert();
    const CELL = 60, cells = new Map();
    for (const t of transforms) { const key = Math.floor(t.p.x / CELL) + ',' + Math.floor(t.p.z / CELL); if (!cells.has(key)) cells.set(key, []); cells.get(key).push(t); }
    for (const src of meshes) {
      if (/Leaves/i.test(src.material.name) && src.material.vertexColors) { src.material.vertexColors = false; src.material.needsUpdate = true; }
      local.multiplyMatrices(inv, src.matrixWorld);
      for (const list of cells.values()) {
        const im = new THREE.InstancedMesh(src.geometry, src.material, list.length);
        list.forEach((t, i) => { m4.compose(t.p, t.q, t.s).multiply(local); im.setMatrixAt(i, m4); });
        im.castShadow = shadow && this.quality.dense; im.receiveShadow = true;
        im.computeBoundingSphere(); this.scene.add(im);
      }
    }
  }

  #footprint(template, maxY) {
    template.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(template.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3();
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, n = 0;
    template.traverse(o => {
      if (!o.isMesh || /Leaves|Leaf|Grass|Flower/i.test(o.material.name)) return;
      m.multiplyMatrices(inv, o.matrixWorld);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); if (v.y > maxY) continue; minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z); n++; }
    });
    return n ? { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, r: Math.max(maxX - minX, maxZ - minZ) / 2 } : null;
  }

  #blocked(x, z, pad) {
    const near = (p, r) => Math.hypot(x - p.x, z - p.z) < r + pad;
    if (near(Z2.edge, Z2.edgeR + 2) || near(Z2.gate, 8) || near(Z2.hut, Z2.hutR) || near(Z2.grove, Z2.groveR - 3) || near(Z2.hollow, Z2.hollowR + 5)) return true;
    if (near(Z2.secret, 9) || near(Z2.ledge, 6) || near(Z2.pip, 4)) return true;
    if (this.crystals?.some(c => near(c.pos, 3))) return true;
    return distToPath(x, z) < 3 + pad;
  }

  #props(quality) {
    const lib = this.lib, r = rng(2024);
    // Darker, bluer leaves for a deep forest look (only Zone 2 is loaded, so materials can change).
    for (const c of Object.values(lib)) c.traverse(o => {
      if (!o.isMesh) return;
      if (/Leaves|Leaf|Grass|Fern|Bush|Flower/i.test(o.material.name + o.name)) o.material.color.multiply(new THREE.Color(0.62, 0.8, 0.78));
      else if (/Bark|Wood|Trunk/i.test(o.material.name)) o.material.color.multiply(new THREE.Color(0.7, 0.68, 0.72));
    });
    const place = (name, count, opts = {}) => {
      if (!lib[name]) return;
      const fp = opts.collide ? this.#footprint(lib[name], 1.4) : null;
      const list = []; let tries = 0;
      const [sMin, sMax] = opts.scale;
      while (list.length < count && tries++ < count * 50) {
        let x, z;
        if (opts.area) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * opts.area.r; x = opts.area.x + Math.cos(a) * d; z = opts.area.z + Math.sin(a) * d; }
        else if (opts.ringR) { const a = r() * Math.PI * 2, d = opts.ringR + (r() - 0.5) * 8; x = Math.cos(a) * d; z = Math.sin(a) * d; }
        else { x = (r() - 0.5) * 2 * (WORLD2_RADIUS - 6); z = (r() - 0.5) * 2 * (WORLD2_RADIUS - 6); if (Math.hypot(x, z) > WORLD2_RADIUS - 5) continue; }
        if (!opts.ringR && this.#blocked(x, z, opts.pad ?? 0)) continue;
        if (opts.spacing && this.colliders.some(c => !c.box && Math.hypot(c.x - x, c.z - z) < opts.spacing + c.r)) continue;
        const s = sMin + r() * (sMax - sMin), yaw = r() * Math.PI * 2;
        list.push({ p: new THREE.Vector3(x, heightAt2(x, z) - 0.05, z), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), s: new THREE.Vector3(s, s, s) });
        if (fp && !opts.ringR) {
          const c = Math.cos(yaw), sn = Math.sin(yaw);
          this.colliders.push({ x: x + (fp.cx * c + fp.cz * sn) * s, z: z + (-fp.cx * sn + fp.cz * c) * s, r: Math.max(0.3, fp.r * s * 0.9) });
        }
      }
      this.#instance(lib[name], list, opts.shadow !== false);
    };
    const k = quality.dense ? 1 : 0.7;
    // Dense wall of pines at the edge of the map (no colliders needed: rim hills block the player).
    place('Pine_1', Math.round(26 * k), { scale: [1.5, 2.1], ringR: WORLD2_RADIUS - 2, shadow: false });
    place('Pine_2', Math.round(20 * k), { scale: [1.5, 2.1], ringR: WORLD2_RADIUS - 6, shadow: false });
    // Forest interior.
    place('Pine_1', Math.round(26 * k), { scale: [1.2, 1.8], collide: true, spacing: 4.5 });
    place('Pine_2', Math.round(20 * k), { scale: [1.2, 1.8], collide: true, spacing: 4.5 });
    place('TwistedTree_1', 3, { scale: [1.1, 1.4], collide: true, spacing: 6 });
    place('CommonTree_3', Math.round(5 * k), { scale: [1.1, 1.4], collide: true, spacing: 7 });
    place('Pine_2', Math.round(12 * k), { scale: [1.0, 1.5], collide: true, spacing: 4 });
    place('TwistedTree_1', 5, { scale: [1.2, 1.6], collide: true, spacing: 5, area: { x: Z2.grove.x, z: Z2.grove.z, r: Z2.groveR + 6 }, pad: -14 });
    place('Rock_Medium_1', 10, { scale: [0.8, 1.5], collide: true, spacing: 3 });
    place('Rock_Medium_2', 8, { scale: [0.8, 1.5], collide: true, spacing: 3 });
    place('Bush_Common', 26, { scale: [0.6, 0.9], spacing: 1 });
    place('Fern_1', 50, { scale: [0.5, 0.85], shadow: false, pad: -2 });
    place('Mushroom_Common', 30, { scale: [0.5, 0.9], shadow: false, pad: -2 });
    place('Grass_Wispy_Short', quality.dense ? 120 : 50, { scale: [0.35, 0.55], shadow: false, pad: -4 });
    place('Pebble_Round_2', 24, { scale: [0.4, 0.8], shadow: false, pad: -3 });
    // Glowing mushrooms: emissive caps around the hut and along paths.
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x17a894, emissive: 0x14d9bd, emissiveIntensity: 1.1 });
    const capG = new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), stemG = new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6);
    const caps = [], stems = [];
    for (let i = 0; i < 40; i++) {
      const base = i < 16 ? Z2.hut : i < 30 ? Z2.edge : Z2.hollow;
      const a = r() * Math.PI * 2, d = i >= 30 ? Z2.hollowR + 2.5 + r() * 3 : 4 + r() * 11;
      const x = base.x + Math.cos(a) * d, z = base.z + Math.sin(a) * d, y = heightAt2(x, z), s = 0.6 + r() * 0.9;
      caps.push(capG.clone().scale(s, s, s).translate(x, y + 0.3 * s, z)); stems.push(stemG.clone().scale(s, s, s).translate(x, y + 0.15 * s, z));
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(caps), glowMat));
    this.scene.add(new THREE.Mesh(mergeGeometries(stems), new THREE.MeshStandardMaterial({ color: 0xd8e6df })));
  }

  // Keep the camera out of the hut.
  insideBuilding(x, y, z) {
    for (const c of this.colliders) {
      if (!c.box || c.hx < 1.5 || c.glitch) continue;
      const cs = Math.cos(c.ry), sn = Math.sin(c.ry), dx = x - c.x, dz = z - c.z;
      const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      if (Math.abs(lx) < c.hx + 0.6 && Math.abs(lz) < c.hz + 0.6 && y < heightAt2(c.x, c.z) + 10) return true;
    }
    return false;
  }

  groundAt(x, z) {
    let h = heightAt2(x, z);
    for (const p of this.platforms) if (Math.hypot(x - p.x, z - p.z) < p.r) h = Math.max(h, p.top);
    return h;
  }

  // Push a circle out of obstacles. `noclip` lets Jasper walk through glitch walls (/noclip).
  resolve(p, radius, noclip = false) {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.colliders) {
        if (c.glitch && (noclip || this.glitchOpen || p.z < c.z)) continue; // one-way: never trapped inside the nook
        if (c.box) {
          const cs = Math.cos(c.ry), sn = Math.sin(c.ry);
          const dx = p.x - c.x, dz = p.z - c.z;
          let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
          const ex = c.hx + radius, ez = c.hz + radius;
          if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
            if (ex - Math.abs(lx) < ez - Math.abs(lz)) lx = Math.sign(lx || 1) * ex; else lz = Math.sign(lz || 1) * ez;
            p.x = c.x + lx * cs + lz * sn; p.z = c.z - lx * sn + lz * cs;
          }
          continue;
        }
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + radius;
        if (d < min && d > 1e-4) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
      }
      // Platforms are solid unless you are already above their top.
      for (const pl of this.platforms) {
        if ((p.y ?? 0) > pl.top - 0.35) continue;
        const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz), min = pl.r + radius;
        if (d < min && d > 1e-4) { p.x = pl.x + dx / d * min; p.z = pl.z + dz / d * min; }
      }
    }
    if (this.barrier) {
      const dx = p.x - Z2.hollow.x, dz = p.z - Z2.hollow.z, d = Math.hypot(dx, dz), max = Z2.hollowR - 0.8;
      if (d > max && d < Z2.hollowR + 4) { p.x = Z2.hollow.x + dx / d * max; p.z = Z2.hollow.z + dz / d * max; }
    }
    const d = Math.hypot(p.x, p.z), max = WORLD2_RADIUS - 6;
    if (d > max) { p.x *= max / d; p.z *= max / d; }
  }

  update(dt, t, focus) {
    for (const c of this.crystals) { c.gem.rotation.y += dt * 1.2; c.gem.position.y = 1.6 + Math.sin(t * 2) * 0.12; }
    this.crackMat.color.setHSL(0.85, 1, 0.42 + Math.sin(t * 2.2) * 0.08 + (Math.sin(t * 31) > 0.9 ? 0.12 : 0));
    if (this.barrierMesh.visible) this.barrierMesh.rotation.y += dt * 0.2;
    if (this.portalMat) this.portalMat.opacity = 0.42 + Math.sin(t * 3) * 0.1;
    if (this.glitchWall) {
      this.glitchWall.visible = !this.glitchOpen;
      this.glitchWall.material.opacity = 0.35 + (Math.sin(t * 27) > 0.7 ? 0.25 : 0);
      this.glitchWall.position.x = this.glitchWallPos.x + (Math.sin(t * 41) > 0.85 ? 0.12 : 0);
    }
    if (this.hutLight) this.hutLight.intensity = 7 + Math.sin(t * 9) * 0.6;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    this.cubes.data.forEach((c, i) => {
      q.setFromEuler(new THREE.Euler(t * 0.7 + c.ph, t * 0.9 + c.ph, 0));
      v.set(c.x, c.y + Math.sin(t * 1.3 + c.ph) * 0.4, c.z); s.setScalar(c.s * (Math.sin(t * 17 + c.ph * 5) > 0.95 ? 0.2 : 1));
      this.cubes.mesh.setMatrixAt(i, m4.compose(v, q, s));
    });
    this.cubes.mesh.instanceMatrix.needsUpdate = true;
    if (this.motes && focus) this.motes.position.set(focus.x * 0.0, Math.sin(t * 0.3) * 0.3, 0);
    if (this.sun && focus) { this.sun.position.set(focus.x + 14, focus.y + 30, focus.z + 10); this.sun.target.position.copy(focus); }
    if (this.skyDome && focus) this.skyDome.position.set(focus.x, 0, focus.z);
  }
}
