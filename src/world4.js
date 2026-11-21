// Zone 4: The Unfinished Zone. Floating islands of developer test tiles in an endless void.
// Islands: The Placeholder (start), the Asset Graveyard (west, reached by an unfinished bridge)
// and NOVA's Core (north, reached by jumping up floating tiles). Fall off and you are put back.
// Same interface as the other worlds: colliders, crystals, groundAt, resolve, insideBuilding, update, setBarrier.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const VOID = -200;
export const ISLANDS = {
  A: { c: new THREE.Vector3(0, 0, 0), y: 0, r: 34 },        // The Placeholder
  B: { c: new THREE.Vector3(-78, 0, -40), y: 4, r: 24 },    // Asset Graveyard
  C: { c: new THREE.Vector3(22, 0, -88), y: 12, r: 20 },    // NOVA's Core
};
export const Z4 = {
  spawn: new THREE.Vector3(0, 0, 24), arrive: new THREE.Vector3(0, 0, 21),
  town: new THREE.Vector3(0, 0, 0),
  bridgeEnd: null, // set below
  graveyard: ISLANDS.B.c.clone(),
  stairsBase: null,
  core: ISLANDS.C.c.clone(), arenaR: 15,
  novaHome: ISLANDS.C.c.clone(),
};
export const WORLD4_RADIUS = 120;

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const MAGENTA = 0xff2bd6, CYAN = 0x29e6ff;

// ---- Bridge A -> B (8 tiles, the last 4 are "TODO" until patched) and the stairs A -> C ----
const dirAB = ISLANDS.B.c.clone().sub(ISLANDS.A.c).normalize();
const startAB = ISLANDS.A.c.clone().addScaledVector(dirAB, ISLANDS.A.r - 1.5);
const endAB = ISLANDS.B.c.clone().addScaledVector(dirAB, -(ISLANDS.B.r - 1.5));
const lenAB = startAB.distanceTo(endAB), NB = Math.ceil(lenAB / 4);
export const BRIDGE = Array.from({ length: NB }, (_, i) => {
  const k = (i + 0.5) / NB, p = startAB.clone().lerp(endAB, k);
  return { x: p.x, z: p.z, hx: 2.2, hz: lenAB / NB / 2 + 0.05, ry: Math.atan2(dirAB.x, dirAB.z), top: ISLANDS.A.y + (ISLANDS.B.y - ISLANDS.A.y) * k, todo: i >= NB / 2 };
});
Z4.bridgeEnd = new THREE.Vector3(BRIDGE[Math.floor(NB / 2) - 1].x, 0, BRIDGE[Math.floor(NB / 2) - 1].z);
const dirAC = ISLANDS.C.c.clone().sub(ISLANDS.A.c).normalize();
const startAC = ISLANDS.A.c.clone().addScaledVector(dirAC, ISLANDS.A.r - 1);
const endAC = ISLANDS.C.c.clone().addScaledVector(dirAC, -(ISLANDS.C.r - 0.5));
const NS = 13;
export const STAIRS = Array.from({ length: NS }, (_, i) => {
  const k = (i + 1) / (NS + 1), p = startAC.clone().lerp(endAC, k);
  const side = Math.sin(i * 1.3) * 1.4; // a little zig-zag
  return { x: p.x + dirAC.z * side, z: p.z - dirAC.x * side, hx: 1.4, hz: 1.4, ry: 0.3 * i, top: ISLANDS.A.y + (ISLANDS.C.y - ISLANDS.A.y) * (i + 1) / (NS + 1) + 0.2 };
});
Z4.stairsBase = startAC.clone();
// A secret floating path off the east of the Placeholder (3 jumps to a lone test platform).
export const SECRET = [
  { x: 37, z: 8, hx: 1.3, hz: 1.3, ry: 0.2, top: 0.6 },
  { x: 40.5, z: 11.5, hx: 1.3, hz: 1.3, ry: 0.5, top: 1.4 },
  { x: 44, z: 15, hx: 1.3, hz: 1.3, ry: 0.1, top: 2.2 },
  { x: 48.5, z: 18.5, hx: 2.6, hz: 2.6, ry: 0.0, top: 2.6, pad: true },
];

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const gridTex = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#b9bcc6'; g.fillRect(0, 0, s, s);
  g.strokeStyle = '#8e929e'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, s); g.moveTo(0, i * 64); g.lineTo(s, i * 64); g.stroke(); }
  g.strokeStyle = '#6b7080'; g.lineWidth = 6; g.strokeRect(0, 0, s, s);
  g.fillStyle = '#ff8a3d'; g.font = 'bold 22px monospace'; g.fillText('4m', 8, 26);
});
export const missingTex = (() => { const t = canvasTex(64, (g) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#000' : '#ff00ff'; g.fillRect(x * 32, y * 32, 32, 32); } }); t.magFilter = THREE.NearestFilter; t.repeat.set(2, 2); return t; })();
export function label(text, color = '#ffffff', w = 6, bg = 'rgba(10,12,24,0.75)') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 96); g.strokeStyle = color; g.lineWidth = 4; g.strokeRect(2, 2, 508, 92);
  g.fillStyle = color; g.font = 'bold 44px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 512), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, fog: false }));
}

export class World4 {
  constructor(scene, quality) {
    this.scene = scene; this.quality = quality;
    this.colliders = []; this.platforms = []; this.barrier = null; this.r = rng(4404);
    this.gridMat = new THREE.MeshStandardMaterial({ map: gridTex(), roughness: 0.9 });
    this.sideMat = new THREE.MeshStandardMaterial({ color: 0x5d6272, roughness: 1, flatShading: true });
    this.missMat = new THREE.MeshStandardMaterial({ map: missingTex, roughness: 0.8 });
    this.greyMat = new THREE.MeshStandardMaterial({ color: 0xa8acb8, roughness: 0.85, flatShading: true });
    this.wireMat = new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.5 });
    this.#sky(); this.#lights(quality);
    for (const [id, is] of Object.entries(ISLANDS)) this.#island(id, is);
    this.#bridge(); this.#stairs(); this.#secret(); this.#town(); this.#graveyard(); this.#arena();
    this.crystals = [new THREE.Vector3(6, 0, 16), new THREE.Vector3(ISLANDS.B.c.x + 8, 0, ISLANDS.B.c.z + 10), new THREE.Vector3(ISLANDS.C.c.x - 8, 0, ISLANDS.C.c.z + 14)].map(p => this.#crystal(p));
    this.setBridge(false); this.setStairs(false);
  }

  // ---------------- Void sky ----------------
  #sky() {
    const s = this.scene;
    s.background = new THREE.Color(0x05060f); s.fog = new THREE.Fog(0x0a0c1e, 70, 190);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){
        float t = vP.y;
        vec3 c = mix(vec3(0.10,0.06,0.20), vec3(0.01,0.01,0.04), smoothstep(-0.1, 0.6, t));
        c = mix(c, vec3(0.0), smoothstep(0.0, -0.5, t));
        vec2 uv = vec2(atan(vP.x, vP.z) * 6.0, asin(vP.y) * 12.0);
        vec2 gr = abs(fract(uv) - 0.5);
        float line = smoothstep(0.48, 0.5, max(gr.x, gr.y)) * smoothstep(0.75, 0.05, abs(t));
        c += vec3(0.16, 0.5, 0.75) * line * 0.35;
        float st = step(0.9985, fract(sin(dot(floor(vP.xy * 260.0), vec2(12.9898, 78.233))) * 43758.5453));
        gl_FragColor = vec4(c + st * vec3(0.8), 1.0); }`,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), mat); s.add(this.skyDome);
    const bar = label('LOADING ASTER... 99%', '#29e6ff', 70, 'rgba(5,8,20,0.8)'); bar.position.set(0, 95, -200); s.add(bar); this.loadBar = bar;
  }
  #lights(quality) {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xc8d4ff, 0x20123a, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    if (quality.shadows) {
      sun.castShadow = true; sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      const c = sun.shadow.camera; c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 1; c.far = 140;
      sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
    }
    s.add(sun); s.add(sun.target); this.sun = sun;
    const rim = new THREE.DirectionalLight(MAGENTA, 0.9); rim.position.set(-50, 20, -80); s.add(rim);
  }

  // ---------------- Islands: tile tops (grid texture), crumbling sides, falling bits ----------------
  #island(id, is) {
    const r = this.r, tops = [], miss = [], sides = [], bits = [], n = Math.ceil((is.r + 6) / 4);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const x = i * 4, z = j * 4, d = Math.hypot(x, z);
      if (d > is.r + 2.5) continue;
      const depth = 2 + r() * 3 + Math.max(0, is.r - d) * 0.22, sink = d > is.r - 2 ? -r() * 0.5 : 0;
      const top = new THREE.PlaneGeometry(4, 4); top.rotateX(-Math.PI / 2); top.translate(is.c.x + x, is.y + sink + 0.001, is.c.z + z);
      (r() < 0.05 && d > 6 ? miss : tops).push(top);
      const b = new THREE.BoxGeometry(4, depth, 4); b.translate(is.c.x + x, is.y + sink - depth / 2 - 0.01, is.c.z + z); sides.push(b);
    }
    for (let k = 0; k < is.r * 1.1; k++) {
      const a = r() * Math.PI * 2, d = r() * is.r, s = 0.6 + r() * 2.2;
      const b = new THREE.BoxGeometry(s, s, s); b.rotateX(r() * 3); b.rotateY(r() * 3); b.translate(is.c.x + Math.cos(a) * d, is.y - 7 - r() * 26, is.c.z + Math.sin(a) * d); bits.push(b);
    }
    const add = (geos, mat, shadow) => { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.receiveShadow = true; m.castShadow = shadow; this.scene.add(m); return m; };
    add(tops, this.gridMat, false);
    if (miss.length) add(miss, this.missMat, false);
    add(sides, this.sideMat, false);
    add(bits, this.sideMat, false);
  }

  #tileMesh(list, mat, top = true) {
    const meshes = list.map(t => {
      const g = new THREE.Group(); g.position.set(t.x, 0, t.z); g.rotation.y = t.ry;
      const b = new THREE.Mesh(new THREE.BoxGeometry(t.hx * 2, 0.6, t.hz * 2), [this.sideMat, this.sideMat, mat, this.sideMat, this.sideMat, this.sideMat]);
      b.position.y = t.top - 0.3; b.castShadow = true; b.receiveShadow = true; g.add(b);
      this.scene.add(g); this.platforms.push(t); t.group = g; return g;
    });
    return meshes;
  }
  #bridge() {
    const m = new THREE.MeshStandardMaterial({ map: gridTex(), roughness: 0.9 });
    this.#tileMesh(BRIDGE, m);
    // Ghost outline where the missing tiles should be, and the TODO sign.
    this.bridgeGhosts = BRIDGE.filter(t => t.todo).map(t => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(t.hx * 2, 0.6, t.hz * 2), this.wireMat); w.position.set(t.x, t.top - 0.3, t.z); w.rotation.y = t.ry; this.scene.add(w); return w;
    });
    const sign = label('TODO: finish bridge', '#ffcc4d', 7); sign.position.set(Z4.bridgeEnd.x, BRIDGE[0].top + 4.2, Z4.bridgeEnd.z); sign.rotation.y = Math.atan2(dirAB.x, dirAB.z) + Math.PI; this.scene.add(sign); this.todoSign = sign;
  }
  setBridge(done) {
    this.bridgeDone = done;
    for (const t of BRIDGE) if (t.todo) { t.off = !done; t.group.visible = done; }
    for (const w of this.bridgeGhosts) w.visible = !done;
    this.todoSign.visible = !done;
  }
  #stairs() {
    this.#tileMesh(STAIRS, this.gridMat);
    this.stairGhosts = STAIRS.map(t => { const w = new THREE.Mesh(new THREE.BoxGeometry(t.hx * 2, 0.6, t.hz * 2), this.wireMat); w.position.set(t.x, t.top - 0.3, t.z); w.rotation.y = t.ry; this.scene.add(w); return w; });
  }
  setStairs(on) {
    this.stairsOn = on;
    for (const t of STAIRS) { t.off = !on; t.group.visible = on; }
    for (const w of this.stairGhosts) w.visible = !on;
  }
  #secret() { this.#tileMesh(SECRET, this.missMat); }

  // ---------------- The Placeholder: grey test town ----------------
  #greyHouse(geos, wires, x, z, w, d, h, ry, y = 0, opts = {}) {
    const P = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    const body = new THREE.BoxGeometry(w, h, d); body.translate(0, h / 2, 0); body.applyMatrix4(P); geos.push(body);
    if (opts.roof !== false) {
      const roof = new THREE.CylinderGeometry(0.01, w * 0.75, h * 0.6, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1, 1, d / w); roof.translate(0, h * 1.3, 0); roof.applyMatrix4(P);
      (opts.missingRoof ? this.missRoofs : geos).push(roof);
    }
    const door = new THREE.BoxGeometry(1.2, 2.2, 0.1); door.translate(0, 1.1, d / 2 + 0.05); door.applyMatrix4(P); this.doorGeos.push(door);
    if (opts.wire) { const wire = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 2.2, d * 1.02), this.wireMat); wire.position.set(x, y + h * 1.1, z); wire.rotation.y = ry; this.scene.add(wire); }
    if (opts.label) { const l = label(opts.label, '#ffcc4d', 5); l.position.set(x, y + h * 1.75 + 1.4, z); l.rotation.y = ry; this.scene.add(l); }
    this.colliders.push({ box: true, x, z, hx: w / 2 + 0.1, hz: d / 2 + 0.1, ry, h: h + y + 1, y });
  }
  #tree(geos, x, z, h, y = 0, name) {
    const t = new THREE.CylinderGeometry(0.35, 0.45, h * 0.4, 6); t.translate(x, y + h * 0.2, z); geos.push(t);
    const c = new THREE.ConeGeometry(h * 0.32, h * 0.7, 6); c.translate(x, y + h * 0.62, z); geos.push(c);
    if (name) { const l = label(name, '#9fb0d0', 3.4, 'rgba(10,12,24,0.55)'); l.position.set(x, y + h + 0.8, z); this.scene.add(l); }
    this.colliders.push({ x, z, r: 0.6 });
  }
  #gizmo(x, y, z, s = 1.6) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.scene.add(g);
    for (const [c, rot] of [[0xff3b3b, [0, 0, -Math.PI / 2]], [0x5dff6b, [0, 0, 0]], [0x3b8bff, [Math.PI / 2, 0, 0]]]) {
      const m = new THREE.MeshBasicMaterial({ color: c }), a = new THREE.Group(); a.rotation.set(...rot);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, s, 6), m); stem.position.y = s / 2; a.add(stem);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8), m); tip.position.y = s + 0.2; a.add(tip); g.add(a);
    }
  }
  #town() {
    const geos = [], trees = []; this.missRoofs = []; this.doorGeos = [];
    for (const [x, z, w, d, h, ry, o] of [[-14, -8, 8, 6, 5, 0.3, { label: 'house_v0.1' }], [12, -14, 6, 6, 7, -0.4, { missingRoof: true }], [-20, 12, 7, 5, 4, 1.2, {}], [17, 10, 9, 6, 6, -1.3, { wire: true, label: 'collision: ???' }], [-2, -24, 10, 7, 9, 0, { label: 'castle (TODO)' }], [-26, -12, 5, 5, 4, 0.8, { roof: false }], [24, -4, 5, 5, 5, 2.2, {}]]) this.#greyHouse(geos, null, x, z, w, d, h, ry, 0, o);
    for (const [x, z, h, n] of [[-6, -16, 6, 'tree_placeholder_02'], [7, -4, 5], [-26, 2, 7, 'tree_placeholder_07'], [26, 4, 6], [-9, 24, 5], [22, 20, 7, 'tree_final_FINAL_v3'], [-30, 18, 5], [10, 26, 6]]) this.#tree(trees, x, z, h, 0, n);
    this.#gizmo(-14, 9, -8); this.#gizmo(17, 13, 10);
    for (const [x, z, w] of [[0, 31, 24]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 5, 0.3), this.wireMat); b.position.set(x, 2.5, z); this.scene.add(b); }
    this.townGeos = geos; this.townTrees = trees;
    // Spawn pad (the way back to the Capital).
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 32), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.5 })); pad.position.set(Z4.spawn.x, 0.1, Z4.spawn.z); this.scene.add(pad); this.pad = pad;
    const sp = label('PLAYER_SPAWN', '#29e6ff', 2.6); sp.position.set(Z4.spawn.x + 3.2, 1.2, Z4.spawn.z + 1.2); sp.rotation.y = Math.PI / 2; this.scene.add(sp);
  }
  #graveyard() {
    const B = ISLANDS.B, r = rng(77), geos = this.townGeos, trees = this.townTrees;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + r() * 0.4, d = 8 + r() * 10, x = B.c.x + Math.cos(a) * d, z = B.c.z + Math.sin(a) * d;
      if (i % 2) this.#greyHouse(geos, null, x, z, 4 + r() * 3, 4, 3 + r() * 3, r() * 3, B.y, { wire: r() < 0.5, roof: r() < 0.6, missingRoof: r() < 0.3 });
      else this.#tree(trees, x, z, 4 + r() * 3, B.y, 'cut_content_' + i);
    }
    const gl = label('ASSET GRAVEYARD', '#ff2bd6', 9); gl.position.set(B.c.x, B.y + 14, B.c.z); gl.rotation.y = 1.0; this.scene.add(gl);
    // Merge all grey geometry once both islands are placed.
    const add = (list, mat) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g)), mat); m.castShadow = true; m.receiveShadow = true; this.scene.add(m); };
    add([...geos, ...trees], this.greyMat);
    add(this.missRoofs, this.missMat);
    add(this.doorGeos, new THREE.MeshStandardMaterial({ color: 0x6b7080 }));
  }
  #arena() {
    const C = ISLANDS.C;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Z4.arenaR, 0.12, 6, 96), new THREE.MeshBasicMaterial({ color: MAGENTA })); ring.rotation.x = Math.PI / 2; ring.position.set(C.c.x, C.y + 0.15, C.c.z); this.scene.add(ring);
    const geos = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2, h = 6 + (i % 3) * 2; const p = new THREE.BoxGeometry(1.4, h, 1.4); p.translate(C.c.x + Math.cos(a) * 18, C.y + h / 2, C.c.z + Math.sin(a) * 18); geos.push(p); this.colliders.push({ x: C.c.x + Math.cos(a) * 18, z: C.c.z + Math.sin(a) * 18, r: 1.0 }); }
    const m = new THREE.Mesh(mergeGeometries(geos), this.greyMat); m.castShadow = true; this.scene.add(m);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(Z4.arenaR, Z4.arenaR, 6, 48, 3, true), new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.16, wireframe: true, side: THREE.DoubleSide, depthWrite: false }));
    wall.position.set(C.c.x, C.y + 3, C.c.z); wall.visible = false; this.scene.add(wall); this.barrierMesh = wall;
  }
  setBarrier(on) { this.barrier = on; this.barrierMesh.visible = !!on; }

  #crystal(p) {
    const y = this.groundAt(p.x, p.z), g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8ff4ff, emissive: CYAN, emissiveIntensity: 1.4, transparent: true, opacity: 0.9 });
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), mat); c.scale.y = 1.7; c.position.y = 1.6; g.add(c);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.3, 8), this.greyMat); base.position.y = 0.15; g.add(base);
    g.position.set(p.x, y, p.z); this.scene.add(g);
    this.colliders.push({ x: p.x, z: p.z, r: 0.9 });
    return { group: g, gem: c, pos: new THREE.Vector3(p.x, 0, p.z) };
  }

  // ---------------- Ground: islands and floating tiles; nothing below = the void ----------------
  #islandAt(x, z) { for (const is of Object.values(ISLANDS)) if (Math.hypot(x - is.c.x, z - is.c.z) < is.r + 2) return is; return null; }
  #inTile(t, x, z, pad = 0) {
    const cs = Math.cos(t.ry), sn = Math.sin(t.ry), dx = x - t.x, dz = z - t.z;
    return Math.abs(dx * cs - dz * sn) < t.hx + pad && Math.abs(dx * sn + dz * cs) < t.hz + pad;
  }
  groundAt(x, z, y) {
    let h = VOID;
    const is = this.#islandAt(x, z); if (is) h = is.y;
    for (const t of this.platforms) if (!t.off && this.#inTile(t, x, z) && (y === undefined || t.top <= y + 0.7)) h = Math.max(h, t.top);
    return h;
  }

  insideBuilding(x, y, z) {
    for (const c of this.colliders) {
      if (!c.box || !c.h) continue;
      const cs = Math.cos(c.ry), sn = Math.sin(c.ry), dx = x - c.x, dz = z - c.z;
      if (Math.abs(dx * cs - dz * sn) < c.hx + 0.4 && Math.abs(dx * sn + dz * cs) < c.hz + 0.4 && y < c.h && y > (c.y || 0) - 1) return true;
    }
    return false;
  }

  resolve(p, radius) {
    for (let pass = 0; pass < 2; pass++) for (const c of this.colliders) {
      if (c.box) {
        if (p.y !== undefined && c.y !== undefined && Math.abs((p.y || 0) - c.y) > 3 && p === this.playerPos) continue;
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
    if (p === this.playerPos) {
      // Tiles that rise more than a step above Jasper are solid: jump onto them.
      for (const t of this.platforms) {
        if (t.off || t.top <= (p.y || 0) + 0.6) continue;
        if (!this.#inTile(t, p.x, p.z, radius * 0.6)) continue;
        const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz) || 1, push = Math.max(t.hx, t.hz) + radius * 0.6;
        p.x = t.x + dx / d * push; p.z = t.z + dz / d * push;
      }
      if (this.barrier) {
        const C = ISLANDS.C.c, dx = p.x - C.x, dz = p.z - C.z, d = Math.hypot(dx, dz), max = Z4.arenaR - 0.6;
        if (d > max) { p.x = C.x + dx / d * max; p.z = C.z + dz / d * max; }
      }
      return; // Jasper can walk off the edge (and fall)
    }
    // Everything else stays on its island.
    let best = null, bd = 1e9;
    for (const is of Object.values(ISLANDS)) { const d = Math.hypot(p.x - is.c.x, p.z - is.c.z) - is.r; if (d < bd) { bd = d; best = is; } }
    const dx = p.x - best.c.x, dz = p.z - best.c.z, d = Math.hypot(dx, dz), max = best.r - 1.5;
    if (d > max) { p.x = best.c.x + dx / d * max; p.z = best.c.z + dz / d * max; }
  }

  update(dt, t, focus) {
    for (const c of this.crystals) { c.gem.rotation.y += dt * 1.2; c.gem.position.y = 1.6 + Math.sin(t * 2) * 0.12; }
    this.pad.material.opacity = 0.35 + Math.sin(t * 3) * 0.15;
    if (this.barrierMesh.visible) this.barrierMesh.rotation.y += dt * 0.2;
    const pulse = 0.35 + Math.sin(t * 4) * 0.2;
    for (const w of this.bridgeGhosts) w.material.opacity = pulse;
    if (focus) {
      if (this.sun) { this.sun.position.set(focus.x + 30, (focus.y || 0) + 60, focus.z + 24); this.sun.target.position.copy(focus); }
      if (this.skyDome) this.skyDome.position.set(focus.x, 0, focus.z);
    }
  }
}
