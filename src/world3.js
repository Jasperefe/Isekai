// Zone 3: Capital of Aster. A walled stone city at sunset, taken over by NOVA's copies.
// Areas: Gate District (south, arrival), Market Plaza (centre), Castle Square, the Castle (north),
// Victory's tower (castle courtyard) and the Throne Room (an interior, reached through the keep door).
// Same interface as the other worlds: colliders, crystals, groundAt, resolve, insideBuilding, update, setBarrier.
// Pieces: Kenney Castle Kit + Fantasy Town Kit (recoloured), KayKit Dungeon Pack (CC0).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const WORLD3_RADIUS = 66;
const RAD = 62;          // inside of the city wall
const T = 3, C = 6;      // town kit tile = 3 m, castle kit tile = 6 m
const DS = 1.25;         // KayKit dungeon pieces (4 m) scaled to 5 m
export const HALL = new THREE.Vector3(0, 0, -300); // the throne room interior, far outside the city
export const Z3 = {
  gate: new THREE.Vector3(0, 0, 61),          // south gate (back to Glitchwood)
  arrive: new THREE.Vector3(0, 0, 54),
  plaza: new THREE.Vector3(0, 0, 6), plazaR: 17,
  square: new THREE.Vector3(0, 0, -11),
  castle: new THREE.Vector3(0, 0, -36), castleGate: new THREE.Vector3(0, 0, -18),
  keepDoor: new THREE.Vector3(0, 0, -39.6),
  tower: new THREE.Vector3(15, 0, -47), cage: new THREE.Vector3(15, 0, -42.6),
  rho: new THREE.Vector3(6.5, 0, -13), dot: new THREE.Vector3(-12.5, 0, 9),
  hallEntry: new THREE.Vector3(HALL.x, 0, HALL.z + 16), hallExit: new THREE.Vector3(HALL.x, 0, HALL.z + 19),
  bossHome: new THREE.Vector3(HALL.x, 0, HALL.z - 6),
  rift: new THREE.Vector3(HALL.x, 0, HALL.z - 11), // after Sir Duplicate: the way to the Unfinished Zone
};
// Ghost houses: NOVA's copy-paste glitches. Patch one and a chest drops out of it.
export const GHOSTS = [
  { id: 'g1', x: -36, z: 34, w: 3, f: 2, ry: Math.PI / 2, dx: 1.4, dy: 3.4 },
  { id: 'g2', x: 40, z: -8, w: 2, f: 2, ry: -Math.PI / 2, dx: -1.2, dy: 2.8 },
];

// Meshopt-compressed models store positions as small integers (-1..1 after scaling). Batching moves
// vertices to world space, so every attribute is converted back to plain floats first.
function toFloat(geo) {
  const g = new THREE.BufferGeometry();
  for (const [k, attr] of Object.entries(geo.attributes)) {
    const n = attr.count, sz = attr.itemSize, out = new Float32Array(n * sz);
    for (let i = 0; i < n; i++) for (let c = 0; c < sz; c++) out[i * sz + c] = attr.getComponent(i, c);
    g.setAttribute(k, new THREE.BufferAttribute(out, sz));
  }
  if (geo.index) g.setIndex(Array.from(geo.index.array));
  return g;
}

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const MAGENTA = 0xff2bd6, CYAN = 0x29e6ff;

// Collects static pieces and merges them into a few big meshes per material and per area,
// so the whole city costs a few dozen draw calls.
class Batcher {
  constructor(lib, cell = 40) { this.lib = lib; this.cell = cell; this.buckets = new Map(); this.m = new THREE.Matrix4(); }
  add(name, x, y, z, ry = 0, s = 1, opts = {}) {
    const src = this.lib[name]; if (!src) { console.warn('missing piece', name); return; }
    const sx = opts.sx ?? 1, sz = opts.sz ?? 1;
    const base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s * sx, s, s * sz));
    if (opts.parent) base.premultiply(opts.parent);
    const ex = base.elements[12], ez = base.elements[14];
    const key0 = opts.key || (Math.floor(ex / this.cell) + ',' + Math.floor(ez / this.cell));
    for (const mesh of src.meshes) {
      const k = key0 + '|' + mesh.material.uuid + '|' + (opts.noShadow ? 0 : 1);
      if (!this.buckets.has(k)) this.buckets.set(k, { mat: mesh.material, list: [], shadow: !opts.noShadow });
      this.buckets.get(k).list.push({ geo: mesh.geometry, m: base.clone().multiply(mesh.local) });
    }
  }
  build(scene, shadows) {
    for (const b of this.buckets.values()) {
      const geos = b.list.map(({ geo, m }) => { const g = geo.clone(); g.applyMatrix4(m); return g; });
      // All pieces must share the same attributes to merge.
      const sig = g => Object.keys(g.attributes).sort().join(',') + (g.index ? 'I' : 'N');
      const groups = new Map();
      for (const g of geos) { const s = sig(g); if (!groups.has(s)) groups.set(s, []); groups.get(s).push(g); }
      for (const list of groups.values()) {
        const merged = mergeGeometries(list, false); if (!merged) continue;
        const mesh = new THREE.Mesh(merged, b.mat);
        mesh.castShadow = shadows && b.shadow; mesh.receiveShadow = true;
        scene.add(mesh);
        for (const g of list) g.dispose();
      }
    }
    this.buckets.clear();
  }
}

export class World3 {
  // capitalGltf: capital.glb (one node per piece, named t_*, c_*, d_*).
  constructor(scene, capitalGltf, quality) {
    this.scene = scene; this.quality = quality;
    this.colliders = []; this.platforms = []; this.barrier = null; this.bridgeRepaired = true;
    this.lib = {};
    for (const c of capitalGltf.scene.children) {
      c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.updateMatrixWorld(true);
      const meshes = [];
      c.traverse(o => { if (o.isMesh) meshes.push({ geometry: toFloat(o.geometry), material: o.material, local: o.matrixWorld.clone() }); });
      for (const m of meshes) { m.material.metalness = 0; m.material.roughness = 0.9; }
      this.lib[c.name] = { meshes };
    }
    this.r = rng(3303);
    this.batch = new Batcher(this.lib);
    this.#sky(); this.#lights(quality); this.#ground();
    this.#streets();
    this.#city();
    this.#castle();
    this.#cityWall();
    this.#outside();
    this.#hall();
    this.batch.build(scene, quality.shadows);
    this.#gate();
    this.ghosts = GHOSTS.map(g => this.#ghost(g));
    this.crystals = [new THREE.Vector3(5, 0, 44), new THREE.Vector3(14, 0, 18), new THREE.Vector3(-14, 0, -27)].map(p => this.#crystal(p));
    this.#cubes();
    this.setGate(true);
  }

  // ---------------- Sky and light: golden sunset ----------------
  #sky() {
    const s = this.scene;
    s.background = new THREE.Color(0x3a2448);
    s.fog = new THREE.Fog(0x8a5a78, 45, 120);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){
        float t = clamp(vP.y, 0.0, 1.0);
        vec3 hor = vec3(1.0, 0.62, 0.38), mid = vec3(0.78, 0.42, 0.55), top = vec3(0.17, 0.13, 0.32);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, t)); c = mix(c, top, smoothstep(0.18, 0.7, t));
        c = mix(c, vec3(0.54, 0.35, 0.47), smoothstep(0.02, -0.2, vP.y));
        float sun = pow(max(0.0, dot(vP, normalize(vec3(-0.75, 0.12, -0.55)))), 60.0);
        gl_FragColor = vec4(c + vec3(1.0, 0.75, 0.45) * sun * 0.7, 1.0); }`,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(220, 24, 12), mat); s.add(this.skyDome);
  }

  #lights(quality) {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xffc9a8, 0x3e3558, 1.3));
    const sun = new THREE.DirectionalLight(0xffb27a, 2.6);
    if (quality.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      const c = sun.shadow.camera; c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 1; c.far = 120;
      sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
    }
    s.add(sun); s.add(sun.target); this.sun = sun;
    const fill = new THREE.DirectionalLight(0x9db4ff, 0.5); fill.position.set(60, 30, 80); s.add(fill);
    // Two torches for the throne room (dark until Jasper is inside).
    this.hallLights = [-1, 1].map(sx => { const l = new THREE.PointLight(0xff9a4a, 0, 24, 1.4); l.position.set(HALL.x + sx * 7, 4.5, HALL.z - 8); s.add(l); return l; });
  }

  #ground() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = rng(51);
    g.fillStyle = '#6f6d74'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 256 + 8; x += 16) {
      const v = 118 + Math.floor(r() * 34); g.fillStyle = `rgb(${v},${v - 3},${v + 5})`; g.fillRect(x + 1, y + 1, 14, 14);
    }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(44, 44); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const cob = new THREE.Mesh(new THREE.CircleGeometry(RAD + 6, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    cob.rotation.x = -Math.PI / 2; cob.position.y = 0.01; cob.receiveShadow = true; this.scene.add(cob);
    const grass = new THREE.Mesh(new THREE.RingGeometry(RAD + 5, 340, 64, 1), new THREE.MeshStandardMaterial({ color: 0x5b7548, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; this.scene.add(grass);
  }

  // ---------------- Roads ----------------
  #streets() {
    const B = this.batch;
    for (let z = -15; z <= RAD; z += T) for (const x of [-3, 0, 3]) if (Math.hypot(x, z - Z3.plaza.z) > 16) B.add('t_road', x, 0.03, z, 0, T, { noShadow: true });
    for (let x = -RAD; x <= RAD; x += T) if (Math.abs(x) > 16) for (const z of [3, 6, 9]) B.add('t_road', x, 0.03, z, 0, T, { noShadow: true });
    for (let a = 0; a < 360; a += 9) for (let r = 4.5; r < 17; r += T) { const rr = a * Math.PI / 180; B.add('t_road', Math.cos(rr) * r, 0.04, Z3.plaza.z + Math.sin(rr) * r, rr, T, { noShadow: true }); }
  }

  // ---------------- Houses ----------------
  house(x, z, w, floors, ry, opts = {}) {
    const B = this.batch, r = this.r, pick = a => a[Math.floor(r() * a.length)];
    const P = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(T, T, T));
    const put = (n, px, py, pz, pr, o = {}) => (opts.into || B).add(n, px, py, pz, pr, 1, { parent: P, ...o });
    const win = ['t_wall-window-shutters', 't_wall-window-glass', 't_wall-window-round', 't_wall-window-stone', 't_wall'];
    const x0 = -(w - 1) / 2;
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < w; i++) {
        const xi = x0 + i;
        const front = f === 0 && i === Math.floor((w - 1) / 2) ? 't_wall-door' : f === 0 ? pick(['t_wall-window-shutters', 't_wall', 't_wall-window-small']) : pick(win);
        put(front, xi, f, 0.5, -Math.PI / 2);
        put(f === 0 ? 't_wall' : pick(win), xi, f, -0.5, Math.PI / 2);
      }
      for (const zz of [-0.5, 0.5]) { put(f ? pick(win) : 't_wall', x0, f, zz, Math.PI); put(f ? pick(win) : 't_wall', x0 + w - 1, f, zz, 0); }
    }
    for (let i = 0; i < w; i++) { put('t_roof-high', x0 + i, floors, 0.5, Math.PI / 2); put('t_roof-high', x0 + i, floors, -0.5, -Math.PI / 2); }
    put('t_wall-slope', x0 + w - 1, floors, -0.5, 0);
    put('t_wall-slope', x0 + w - 1, floors, 0.5, 0, { sz: -1 });
    put('t_wall-slope', x0, floors, -0.5, 0, { sx: -1 });
    put('t_wall-slope', x0, floors, 0.5, Math.PI);
    if (w > 1 && r() < 0.7) put('t_chimney', x0 + w - 1, floors + 0.2, -0.3, 0);
    if (opts.banner) put('t_banner-red', x0 + (w - 1) / 2 + 0.5, floors - 1, 0.55, 0);
    if (!opts.noCollide) this.colliders.push({ box: true, x, z, hx: w * T / 2 + 0.1, hz: T + 0.1, ry, h: (floors + 1.2) * T });
  }

  #city() {
    const r = this.r, lots = [];
    const free = (x, z) => lots.every(l => Math.hypot(l.x - x, l.z - z) > 9);
    for (const g of GHOSTS) lots.push({ x: g.x, z: g.z });
    for (let gx = -56; gx <= 56; gx += 10) for (let gz = -16; gz <= 56; gz += 10) {
      const x = gx + (r() - 0.5) * 2, z = gz + (r() - 0.5) * 2;
      if (Math.hypot(x, z) > RAD - 8) continue;
      if (Math.hypot(x - Z3.plaza.x, z - Z3.plaza.z) < 22) continue;
      if (Math.abs(x) < 9.5 || Math.abs(z - 6) < 9) continue;            // main street + cross street
      if (z < -2 && Math.abs(x) < 33) continue;                             // castle + castle square
      if (Math.hypot(x - Z3.gate.x, z - Z3.gate.z) < 12) continue;
      if (!free(x, z)) continue;
      if (r() < 0.16) { this.#tree(x, z); continue; }
      const ry = Math.abs(x) < Math.abs(z - 6) ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : (z > 6 ? Math.PI : 0);
      const near = Math.abs(x) < 20 || Math.abs(z - 6) < 20;
      this.house(x, z, r() < 0.5 ? 2 : 3, near ? 2 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2), ry, { banner: near && r() < 0.3 });
      lots.push({ x, z });
    }
    for (const g of GHOSTS) this.house(g.x, g.z, g.w, g.f, g.ry);
    // Market plaza: fountain, stalls (Merchant Dot's is the red one in the west), lanterns, trees.
    const B = this.batch, P = Z3.plaza;
    B.add('t_fountain-round-detail', P.x, 0.02, P.z, 0, T * 2.2);
    this.colliders.push({ x: P.x, z: P.z, r: 6.4 });
    for (const [x, z, ry, k] of [[-12.5, 6, Math.PI / 2, 't_stall-red'], [-10, -4, 0.7, 't_stall-green'], [11, -4, -0.7, 't_stall'], [12.5, 8, -Math.PI / 2, 't_stall-red'], [-7, 15, 2.6, 't_stall-green'], [7.5, 15.5, -2.6, 't_stall']]) {
      B.add(k, P.x + x, 0, P.z + z, ry, T); this.colliders.push({ x: P.x + x, z: P.z + z, r: 1.6 });
    }
    for (const [x, z] of [[-6, 22], [6, 22], [-6, 34], [6, 34], [-6, 46], [6, 46], [-18, 3], [18, 3], [-18, 10], [18, 10], [-6, -12], [6, -9]]) { B.add('t_lantern', x, 0, z, 0, T * 0.9); this.colliders.push({ x, z, r: 0.35 }); }
    for (const [x, z] of [[-15, 19], [15, 19], [-14, -6], [14, -6]]) this.#tree(x, z, 't_tree-high-round');
    B.add('t_cart', 7, 0, 28, 0.4, T); this.colliders.push({ x: 7, z: 28, r: 1.6 });
    // Hedges along the castle square.
    for (let x = -30; x <= 30; x += 3) if (Math.abs(x) > 6) B.add('t_hedge', x, 0, -3, 0, T);
    this.colliders.push({ box: true, x: -18, z: -3, hx: 12.2, hz: 0.6, ry: 0 }, { box: true, x: 18, z: -3, hx: 12.2, hz: 0.6, ry: 0 });
  }

  #tree(x, z, kind) {
    const r = this.r;
    this.batch.add(kind || ['t_tree', 't_tree-high', 't_tree-high-round'][Math.floor(r() * 3)], x, 0, z, r() * 6, T * (1 + r() * 0.25));
    this.colliders.push({ x, z, r: 0.8 });
  }

  // ---------------- Castle: 9 x 7 tiles of 6 m, gate in the south wall ----------------
  #castle() {
    const B = this.batch, cz = Z3.castle.z, W = 9, D = 7, hx = (W - 1) / 2, hz = (D - 1) / 2;
    const P = new THREE.Matrix4().compose(new THREE.Vector3(0, 0, cz), new THREE.Quaternion(), new THREE.Vector3(C, C, C));
    const put = (n, x, y, z, ry = 0, o = {}) => B.add(n, x, y, z, ry, 1, { parent: P, ...o });
    for (let i = 0; i < W; i++) for (const zz of [-hz, hz]) {
      const xx = -hx + i;
      if (Math.abs(xx) === hx) continue;
      if (zz === hz && xx === 0) { put('c_wall-doorway', 0, 0, zz); put('c_wall-doorway', 0, 0, zz, 0, { sx: -1 }); continue; }
      put('c_wall', xx, 0, zz);
      if (zz === hz && Math.abs(xx) === 1) put('c_flag-banner-long', xx, 0.1, zz + 0.5, -Math.PI / 2);
    }
    for (let j = 1; j < D - 1; j++) for (const xx of [-hx, hx]) put('c_wall', xx, 0, -hz + j, Math.PI / 2);
    for (const [xx, zz] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) {
      put('c_tower-square-base', xx, 0, zz); put('c_tower-square-mid-windows', xx, 1.01, zz); put('c_tower-square-mid', xx, 2.02, zz);
      put('c_tower-square-top-roof-high', xx, 3.03, zz); put('c_flag', xx, 4.3, zz, 0.4);
    }
    // Keep (throne hall outside): 3 x 2 tiles at the back of the courtyard.
    for (let i = -1; i <= 1; i++) for (let j = 0; j <= 1; j++) {
      const zz = -1.5 - j;
      put('c_tower-square-base', i, 0, zz); put('c_tower-square-mid-windows', i, 1.01, zz);
      put(i === 0 ? 'c_tower-square-mid' : 'c_tower-square-top', i, 2.02, zz);
    }
    put('c_tower-square-mid-windows', 0, 3.03, -1.5); put('c_tower-square-mid', 0, 3.03, -2.5);
    put('c_tower-square-roof', 0, 4.04, -1.5); put('c_tower-square-roof', 0, 4.04, -2.5); put('c_flag', 0, 6.0, -1.5, 0.2);
    put('c_door', 0, 0, -0.98, Math.PI / 2);
    // Victory's tower.
    const tx = Z3.tower.x / C, tz = (Z3.tower.z - cz) / C;
    put('c_tower-hexagon-base', tx, 0, tz); put('c_tower-hexagon-base', tx, 1.31, tz); put('c_tower-hexagon-base', tx, 2.62, tz);
    put('c_tower-hexagon-mid', tx, 3.93, tz); put('c_tower-hexagon-roof', tx, 4.39, tz);
    // Colliders: four walls (front split by the gate), keep, tower.
    const wx = hx * C, z0 = cz - hz * C, z1 = cz + hz * C, th = C / 2 + 0.3;
    this.colliders.push(
      { box: true, x: 0, z: z0, hx: wx + th, hz: th, ry: 0, h: 9 },
      { box: true, x: -wx, z: cz, hx: th, hz: hz * C + th, ry: 0, h: 9 }, { box: true, x: wx, z: cz, hx: th, hz: hz * C + th, ry: 0, h: 9 },
      { box: true, x: -(wx + th + C / 2) / 2, z: z1, hx: (wx + th - C / 2) / 2, hz: th, ry: 0, h: 9 }, { box: true, x: (wx + th + C / 2) / 2, z: z1, hx: (wx + th - C / 2) / 2, hz: th, ry: 0, h: 9 },
      { box: true, x: 0, z: cz - 2 * C, hx: 1.5 * C + 0.2, hz: C + 0.2, ry: 0, h: 30 },
      { x: Z3.tower.x, z: Z3.tower.z, r: 3.0 },
    );
    this.gateCollider = { box: true, x: 0, z: z1, hx: C / 2, hz: 1.2, ry: 0, h: 9 };
    // The castle gate: a portcullis that opens once the city is cleared.
    const gate = this.lib['c_metal-gate'];
    const gm = new THREE.Group();
    for (const m of gate.meshes) { const mesh = new THREE.Mesh(m.geometry, m.material); mesh.applyMatrix4(m.local); mesh.castShadow = true; gm.add(mesh); }
    gm.scale.setScalar(C); gm.rotation.y = Math.PI / 2; gm.position.set(0, 0, z1 + 0.4);
    this.scene.add(gm); this.portcullis = gm;
    this.gateSeal = new THREE.Mesh(new THREE.PlaneGeometry(C - 0.6, C * 0.85), new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    this.gateSeal.position.set(0, C * 0.42, z1 + 1.3); this.scene.add(this.gateSeal);
  }

  // Sealed: the castle gate stays shut until every copy in the city is defeated.
  setGate(closed) {
    this.gateClosed = closed;
    const i = this.colliders.indexOf(this.gateCollider);
    if (closed && i < 0) this.colliders.push(this.gateCollider);
    if (!closed && i >= 0) this.colliders.splice(i, 1);
    this.portcullis.position.y = closed ? 0 : C * 0.8;
    this.gateSeal.visible = closed;
  }

  // ---------------- City wall with towers; the south gate is a gap ----------------
  #cityWall() {
    const S = C * 0.75, B = this.batch, r = (RAD + 3) / S, step = 1 / r;
    const P = new THREE.Matrix4().makeScale(S, S, S);
    let k = 0;
    for (let a = step * 1.5; a < Math.PI * 2 - step * 1.5; a += step, k++) {
      const x = Math.sin(a) * r, z = Math.cos(a) * r, tower = k % 7 === 0;
      B.add(tower ? 'c_tower-base' : 'c_wall', x, 0, z, a, 1, { parent: P });
      if (tower) B.add('c_tower-top', x, 1.31, z, a, 1, { parent: P });
    }
    for (const sx of [-1, 1]) {
      const x = sx * 1.5, z = r;
      B.add('c_tower-square-base', x, 0, z, 0, 1, { parent: P }); B.add('c_tower-square-mid-windows', x, 1.01, z, 0, 1, { parent: P }); B.add('c_tower-square-top-roof-high', x, 2.02, z, 0, 1, { parent: P });
      this.colliders.push({ box: true, x: x * S, z: z * S, hx: S / 2, hz: S / 2, ry: 0, h: 12 });
    }
  }

  // ---------------- Outside: hills and forest ----------------
  #outside() {
    const r = rng(71), hillM = new THREE.MeshStandardMaterial({ color: 0x5a7048, flatShading: true, roughness: 1 }), geos = [];
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2 + r() * 0.2, d = 150 + r() * 50, h = 25 + r() * 40;
      const g = new THREE.ConeGeometry(40 + r() * 30, h, 7); g.rotateY(r() * 3); g.translate(Math.cos(a) * d, h / 2 - 4, Math.sin(a) * d); geos.push(g);
    }
    const hills = new THREE.Mesh(mergeGeometries(geos), hillM); this.scene.add(hills);
    for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, d = RAD + 9 + r() * 45; this.batch.add(['t_tree', 't_tree-high', 't_tree-crooked'][i % 3], Math.cos(a) * d, 0, Math.sin(a) * d, r() * 6, T * (1 + r() * 0.5)); }
  }

  // ---------------- Throne room (interior far away; Jasper is moved here through the keep door) ----------------
  #hall() {
    const B = this.batch, H = HALL, key = 'hall';
    const P = new THREE.Matrix4().compose(H.clone(), new THREE.Quaternion(), new THREE.Vector3(DS, DS, DS));
    const put = (n, x, y, z, ry = 0) => B.add(n, x, y, z, ry, 1, { parent: P, key });
    for (let i = -2; i <= 2; i++) for (let j = 0; j < 8; j++) put('d_floor_tile_large', i * 4, 0, 14 - j * 4);
    for (let j = 0; j < 8; j++) { const k = j % 2 ? 'd_wall_archedwindow_gated' : 'd_wall'; put(k, -10, 0, 14 - j * 4, Math.PI / 2); put(k, 10, 0, 14 - j * 4, -Math.PI / 2); }
    for (let i = -2; i <= 2; i++) { put('d_wall', i * 4, 0, -16); put(i === 0 ? 'd_wall_doorway' : 'd_wall', i * 4, 0, 16, Math.PI); }
    for (let j = 0; j < 4; j++) for (const x of [-5.5, 5.5]) {
      put('d_pillar_decorated', x, 0, 10 - j * 6.5);
      put('d_torch_mounted', x + (x < 0 ? 0.8 : -0.8), 2.4, 10 - j * 6.5, x < 0 ? Math.PI / 2 : -Math.PI / 2);
      this.colliders.push({ x: H.x + x * DS, z: H.z + (10 - j * 6.5) * DS, r: 1.0 });
      (this.hallPillars ||= []).push({ x: H.x + x * DS, z: H.z + (10 - j * 6.5) * DS });
    }
    for (const x of [-6, -2, 2, 6]) put(x === -2 || x === 2 ? 'd_banner_patternA_blue' : 'd_banner_shield_blue', x, 1.5, -15.4);
    for (const [x, z, k] of [[-8, -12, 'd_barrel_large'], [8.2, -12.5, 'd_crates_stacked'], [-8.5, 12, 'd_box_stacked'], [8.4, 12, 'd_keg_decorated'], [-8.4, -4, 'd_candle_triple'], [8.4, 3, 'd_candle_triple'], [-8.5, 5, 'd_sword_shield'], [8.5, -6, 'd_rubble_large']]) put(k, x, 0, z, 0);
    // Carpet, dais and throne.
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 34), new THREE.MeshStandardMaterial({ color: 0x7a1a3a, roughness: 0.95 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(H.x, 0.08, H.z + 1); carpet.receiveShadow = true; this.scene.add(carpet);
    const stone = new THREE.MeshStandardMaterial({ color: 0x6d6a78, roughness: 0.9 });
    const dais = new THREE.Mesh(new THREE.BoxGeometry(15, 1.1, 5.5), stone); dais.position.set(H.x, 0.55, H.z - 17.2); dais.receiveShadow = true; this.scene.add(dais);
    const gold = new THREE.MeshStandardMaterial({ color: 0xe0b14a, metalness: 0.8, roughness: 0.3 });
    const throne = new THREE.Group(); throne.position.set(H.x, 1.1, H.z - 18.2);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.7), gold); seat.position.y = 0.7; throne.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4, 0.35), gold); back.position.set(0, 2.4, -0.7); throne.add(back);
    const cush = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3, 0.1), new THREE.MeshStandardMaterial({ color: 0x2c3fa8 })); cush.position.set(0, 2.4, -0.5); throne.add(cush);
    this.scene.add(throne);
    this.colliders.push({ box: true, x: H.x, z: H.z - 17.2, hx: 7.5, hz: 2.8, ry: 0 });
    // Dark ceiling (no shadow, so the sun still lights the floor like a skylight).
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(26, 42), new THREE.MeshBasicMaterial({ color: 0x120d1c }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(H.x, 6.4, H.z); this.scene.add(ceil);
    // Glowing Null cracks in the floor.
    const r = rng(9), geos = [];
    for (let i = 0; i < 16; i++) { const g = new THREE.BoxGeometry(0.08, 0.02, 1.4 + r() * 2.4); g.rotateY(r() * 3); g.translate(H.x + (r() - 0.5) * 18, 0.1, H.z - 12 + r() * 24); geos.push(g); }
    this.scene.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ color: MAGENTA })));
    // A sealing ring for the boss fight.
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 6, 48, 3, true), new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.18, wireframe: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.set(H.x, 3, H.z - 2); ring.visible = false; this.scene.add(ring); this.barrierMesh = ring;
  }
  inHall(p) { return p.z < HALL.z + 60; }

  setBarrier(on) { this.barrier = on; this.barrierMesh.visible = !!on; }

  // ---------------- Gate back to Glitchwood (inside the south gate) ----------------
  #gate() {
    const g = new THREE.Group();
    this.portalMat = new THREE.MeshBasicMaterial({ color: 0x9a4dff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 6.5), this.portalMat); portal.position.y = 3.25; g.add(portal);
    g.position.set(Z3.gate.x, 0, Z3.gate.z + 2.6); this.scene.add(g);
  }

  // ---------------- Ghost houses ----------------
  #ghost(gd) {
    const g = new THREE.Group();
    const tmp = new Batcher(this.lib, 999);
    this.house(gd.x, gd.z, gd.w, gd.f, gd.ry, { into: tmp, noCollide: true });
    const before = this.scene.children.length;
    tmp.build(this.scene, false);
    const added = this.scene.children.splice(before);
    const mat = new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.22, depthWrite: false });
    for (const m of added) { m.material = mat; m.castShadow = false; m.receiveShadow = false; g.add(m); }
    const off = new THREE.Vector3(gd.dx, gd.dy, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), gd.ry);
    g.position.copy(off); this.scene.add(g);
    // The chest falls out in front of the house door.
    const front = new THREE.Vector3(0, 0, T + 2.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), gd.ry);
    return { ...gd, group: g, mat, pos: new THREE.Vector3(gd.x + front.x, 0, gd.z + front.z), fixed: false };
  }
  fixGhost(gh) { gh.fixed = true; gh.group.visible = false; }

  // ---------------- Save crystals ----------------
  #crystal(p) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8ff4ff, emissive: CYAN, emissiveIntensity: 1.4, transparent: true, opacity: 0.9, metalness: 0.2, roughness: 0.1 });
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), mat); c.scale.y = 1.7; c.position.y = 1.6; g.add(c);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x8a8794, flatShading: true })); base.position.y = 0.15; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: CYAN })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; g.add(ring);
    g.position.set(p.x, 0, p.z); this.scene.add(g);
    this.colliders.push({ x: p.x, z: p.z, r: 0.9 });
    return { group: g, gem: c, pos: g.position.clone() };
  }

  // Floating copy cubes over the castle (NOVA's mark).
  #cubes() {
    const r = rng(404), n = 30;
    const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    this.cubes = { mesh: cubes, data: [] };
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = r() * 24, top = i < 22;
      this.cubes.data.push({ x: (top ? 0 : Z3.plaza.x) + Math.cos(a) * d, z: (top ? Z3.castle.z : Z3.plaza.z + 10) + Math.sin(a) * d, y: (top ? 26 : 16) + r() * 20, s: 0.4 + r() * 1.2, ph: r() * 6 });
      cubes.setColorAt(i, new THREE.Color(i % 3 ? MAGENTA : CYAN));
    }
    this.scene.add(cubes);
  }

  groundAt() { return 0; }

  // Keep the camera out of houses and towers.
  insideBuilding(x, y, z) {
    for (const c of this.colliders) {
      if (!c.box || !c.h || c.hx < 1.5) continue;
      const cs = Math.cos(c.ry), sn = Math.sin(c.ry), dx = x - c.x, dz = z - c.z;
      const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      if (Math.abs(lx) < c.hx + 0.4 && Math.abs(lz) < c.hz + 0.4 && y < c.h) return true;
    }
    if (this.inHall({ z })) {
      // Keep the camera inside the throne room (under the ceiling, inside the walls).
      if (y > 6) return true;
      if (Math.abs(x - HALL.x) > 11.6 || z > HALL.z + 19.4 || z < HALL.z - 15.2) return true;
      // Pillars block the view too (the camera slides in front of them).
      for (const p of this.hallPillars || []) if (Math.hypot(x - p.x, z - p.z) < 1.25) return true;
    }
    return false;
  }

  resolve(p, radius) {
    for (let pass = 0; pass < 2; pass++) for (const c of this.colliders) {
      if (c.box) {
        const cs = Math.cos(c.ry), sn = Math.sin(c.ry), dx = p.x - c.x, dz = p.z - c.z;
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
    if (this.inHall(p)) {
      // Throne room walls.
      const minX = HALL.x - 11.3, maxX = HALL.x + 11.3, minZ = HALL.z - 14.4, maxZ = HALL.z + 18.6;
      p.x = Math.min(maxX, Math.max(minX, p.x)); p.z = Math.min(maxZ, Math.max(minZ, p.z));
      if (this.barrier) {
        const dx = p.x - HALL.x, dz = p.z - (HALL.z - 2), d = Math.hypot(dx, dz), max = 14.2;
        if (d > max) { p.x = HALL.x + dx / d * max; p.z = HALL.z - 2 + dz / d * max; }
      }
      return;
    }
    // City wall (the south gate gap is closed by the portal).
    const d = Math.hypot(p.x, p.z), max = RAD - 1;
    if (d > max) { p.x *= max / d; p.z *= max / d; }
  }

  update(dt, t, focus) {
    for (const c of this.crystals) { c.gem.rotation.y += dt * 1.2; c.gem.position.y = 1.6 + Math.sin(t * 2) * 0.12; }
    if (this.portalMat) this.portalMat.opacity = 0.4 + Math.sin(t * 3) * 0.1;
    if (this.gateSeal.visible) this.gateSeal.material.opacity = 0.22 + Math.sin(t * 4) * 0.08 + (Math.sin(t * 29) > 0.85 ? 0.15 : 0);
    if (this.barrierMesh.visible) this.barrierMesh.rotation.y += dt * 0.2;
    for (const gh of this.ghosts) if (!gh.fixed) {
      gh.mat.opacity = 0.18 + Math.sin(t * 2.3 + gh.x) * 0.06 + (Math.sin(t * 31 + gh.z) > 0.9 ? 0.18 : 0);
      gh.group.position.x = new THREE.Vector3(gh.dx, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), gh.ry).x + (Math.sin(t * 43 + gh.x) > 0.93 ? 0.4 : 0);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    this.cubes.data.forEach((c, i) => {
      q.setFromEuler(new THREE.Euler(t * 0.5 + c.ph, t * 0.7 + c.ph, 0));
      v.set(c.x, c.y + Math.sin(t * 0.9 + c.ph) * 1.2, c.z); s.setScalar(c.s * (Math.sin(t * 13 + c.ph * 5) > 0.96 ? 0.2 : 1));
      this.cubes.mesh.setMatrixAt(i, m4.compose(v, q, s));
    });
    this.cubes.mesh.instanceMatrix.needsUpdate = true;
    if (focus) {
      const inside = this.inHall(focus);
      for (const l of this.hallLights) l.intensity = inside ? 60 : 0;
      if (this.sun) { this.sun.position.set(focus.x - 30, focus.y + 34, focus.z - 22); this.sun.target.position.copy(focus); }
      if (this.skyDome) this.skyDome.position.set(focus.x, 0, focus.z);
    }
  }
}
