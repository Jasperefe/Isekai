// Zone 1: Starter Meadow. Terrain, river, village, bridge, Slime Pond arena,
// save crystals, lighting, sky and instanced nature props.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const WORLD_RADIUS = 82;

// ---- Layout ----------------------------------------------------------------
export const Z1 = {
  wake: new THREE.Vector3(0, 0, 34),
  village: new THREE.Vector3(0, 0, 0), villageR: 15,
  field: new THREE.Vector3(36, 0, 4), fieldR: 16,
  bridgeZ: -4, bridgeHalfW: 1.8,
  arena: new THREE.Vector3(-56, 0, -4), arenaR: 15,
  forge: new THREE.Vector3(-8, 0, 4),
  gate: new THREE.Vector3(12, 0, -54),
};
export const riverX = z => -29 + Math.sin(z * 0.045) * 3;
const PATH = [
  [[0, 34], [0, 22], [1, 12], [0, 0]],
  [[0, 0], [12, 2], [24, 4], [36, 4]],
  [[0, 0], [-12, -3], [-22, -4], [-36, -4], [-46, -4], [-56, -4]],
  [[0, 0], [5, -8], [5, -22], [10, -38], [12, -52]],
];
export const PATHS = PATH;

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function distToPath(x, z) {
  let best = 1e9;
  for (const line of PATH) for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1];
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// Terrain height: rolling hills, flattened where things happen, with a river channel.
export function heightAt(x, z) {
  let h = Math.sin(x * 0.07) * Math.cos(z * 0.06) * 1.6 + Math.sin((x + z) * 0.035) * 2.0 + Math.cos(x * 0.19 + 1.3) * Math.sin(z * 0.15) * 0.35;
  let flat = 1;
  const flatten = (cx, cz, r) => { flat = Math.min(flat, smooth(r, r + 10, Math.hypot(x - cx, z - cz))); };
  flatten(Z1.village.x, Z1.village.z, Z1.villageR + 2);
  flatten(Z1.wake.x, Z1.wake.z, 6);
  flatten(Z1.arena.x, Z1.arena.z, Z1.arenaR + 1);
  flatten(Z1.field.x, Z1.field.z, 8);
  flatten(Z1.gate.x, Z1.gate.z, 6);
  flat = Math.min(flat, smooth(3, 9, distToPath(x, z)) * 0.7 + 0.3);
  h *= flat;
  // Banks near the bridge are level with the deck.
  const rd = Math.abs(x - riverX(z));
  const nearBridge = smooth(6, 2, Math.abs(z - Z1.bridgeZ));
  h *= 1 - nearBridge * smooth(14, 5, rd);
  // River channel.
  h -= smooth(5.2, 2.2, rd) * 3.2;
  // Rim hills keep the player inside.
  h += smooth(WORLD_RADIUS - 8, WORLD_RADIUS + 10, Math.hypot(x, z)) * 9;
  return h;
}

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

export class World {
  constructor(scene, natureGltf, villageKit, quality) {
    this.scene = scene; this.quality = quality;
    this.colliders = []; // circles { x, z, r } and boxes { box: true, x, z, hx, hz, ry }
    this.bridgeRepaired = false;
    this.barrier = null;
    this.#sky(); this.#lights(quality); this.#terrain(); this.#water();
    this.lib = {};
    for (const c of natureGltf.scene.children) this.lib[c.name] = c;
    this.#village(villageKit);
    this.#bridge(villageKit);
    this.#arena();
    this.#gate();
    this.crystals = [new THREE.Vector3(5, 0, -5), new THREE.Vector3(-40, 0, -9)].map(p => this.#crystal(p));
    this.#props(quality);
  }

  // ---- Sky & lights ----
  #sky() {
    const s = this.scene;
    s.background = new THREE.Color(0x9fd4ff);
    s.fog = new THREE.Fog(0xbfe3ff, 40, 110);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x4f9be8) }, bottom: { value: new THREE.Color(0xd8efff) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(vP.y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, t),1.0); }',
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), mat); s.add(this.skyDome);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8f9c, flatShading: true });
    const r = rng(7);
    this.floaters = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + r() * 2, 0), rockMat);
      const a = r() * Math.PI * 2, d = 35 + r() * 35;
      m.position.set(Math.cos(a) * d, 16 + r() * 12, Math.sin(a) * d);
      m.userData.spin = 0.1 + r() * 0.3; m.userData.baseY = m.position.y;
      s.add(m); this.floaters.push(m);
    }
  }

  #lights(quality) {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xdff2ff, 0x5c7a3a, 1.25));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    if (quality.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      const c = sun.shadow.camera; c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 90;
      sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
    }
    s.add(sun); s.add(sun.target);
    this.sun = sun;
  }

  // ---- Terrain & water ----
  #terrain() {
    const size = 180, seg = 150;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = [];
    const c1 = new THREE.Color(0x6fb04a), c2 = new THREE.Color(0x8cc25a), c3 = new THREE.Color(0x5a9a3e);
    const dirt = new THREE.Color(0xc9b27e), mud = new THREE.Color(0x7a6a4a), plaza = new THREE.Color(0xb9a98a);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      const n = (Math.sin(x * 0.35) * Math.cos(z * 0.29) + Math.sin(x * 0.11 + z * 0.13)) * 0.5 + 0.5;
      tmp.copy(c1).lerp(c2, n * 0.7).lerp(c3, Math.max(0, Math.sin(x * 0.05 - z * 0.07)) * 0.5);
      const pd = distToPath(x, z);
      if (pd < 2) tmp.lerp(dirt, (1 - pd / 2) * 0.85);
      const vd = Math.hypot(x - Z1.village.x, z - Z1.village.z);
      if (vd < 7) tmp.lerp(plaza, smooth(7, 4, vd) * 0.9);
      if (h < -0.6) tmp.lerp(mud, Math.min(1, (-0.6 - h) * 0.8));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  #water() {
    const geo = new THREE.PlaneGeometry(14, 180, 8, 90);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + riverX(pos.getZ(i)));
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x3f8fd6, transparent: true, opacity: 0.82, roughness: 0.15, metalness: 0.1 });
    const w = new THREE.Mesh(geo, this.waterMat);
    w.position.y = -1.3; w.receiveShadow = true;
    this.scene.add(w);
    // Small pond inside the arena.
    const pond = new THREE.Mesh(new THREE.CircleGeometry(4, 32), this.waterMat);
    pond.rotation.x = -Math.PI / 2; pond.position.set(Z1.arena.x - 9, heightAt(Z1.arena.x - 9, Z1.arena.z + 8) + 0.05, Z1.arena.z + 8);
    this.scene.add(pond);
    this.colliders.push({ x: pond.position.x, z: pond.position.z, r: 3.8 });
  }

  // ---- Village ----
  // Bake many static meshes into one mesh per material (far fewer draw calls).
  #mergeStatic(root) {
    root.updateMatrixWorld(true);
    const buckets = new Map();
    root.traverse(o => {
      if (!o.isMesh || o.userData.keep) return;
      // Compressed (quantized) attributes must become plain floats before baking/merging.
      const src = o.geometry, geo = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv']) {
        const a = src.attributes[name]; if (!a) continue;
        const arr = new Float32Array(a.count * a.itemSize);
        const get = [a.getX, a.getY, a.getZ, a.getW];
        for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = get[k].call(a, i); // getX/Y/Z de-normalize
        geo.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
      }
      if (src.index) geo.setIndex(Array.from(src.index.array));
      geo.applyMatrix4(o.matrixWorld);
      if (geo.attributes.normal) geo.normalizeNormals();
      const sig = o.material.uuid + '|' + Object.keys(geo.attributes).sort().join(',') + '|' + (geo.index ? 'i' : 'n');
      if (!buckets.has(sig)) buckets.set(sig, { mat: o.material, geos: [] });
      buckets.get(sig).geos.push(geo);
    });
    const out = new THREE.Group();
    for (const { mat, geos } of buckets.values()) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true;
      out.add(m);
    }
    this.scene.add(out);
    return out;
  }

  #village(kit) {
    const statics = new THREE.Group();
    const spots = [
      { x: 10, z: -11, w: 2, d: 2, style: 'plaster', floors: 2 },
      { x: -2, z: -15, w: 2, d: 3, style: 'brick', floors: 2, vines: true },
      { x: -13, z: -11, w: 2, d: 2, style: 'plaster', floors: 1 },
      { x: 12, z: 11, w: 2, d: 2, style: 'brick', floors: 1, vines: true },
      { x: -14, z: 9, w: 2, d: 3, style: 'brick', floors: 1 },   // Bram's house
      { x: 17, z: -3, w: 2, d: 2, style: 'plaster', floors: 1 },
    ];
    for (const sp of spots) {
      const h = kit.house(sp);
      const ry = Math.atan2(-sp.x, -sp.z); // front door faces the plaza
      h.position.set(sp.x, heightAt(sp.x, sp.z) - 0.1, sp.z); h.rotation.y = ry;
      statics.add(h);
      const f = h.userData.footprint;
      this.colliders.push({ box: true, x: sp.x, z: sp.z, hx: f.hx, hz: f.hz, ry });
    }
    // Props.
    const prop = (name, x, z, ry = 0) => { const p = kit.piece(name); p.position.set(x, heightAt(x, z), z); p.rotation.y = ry; statics.add(p); return p; };
    prop('Prop_Wagon', 6, 6, 0.6); this.colliders.push({ box: true, x: 6 - 0.6, z: 6 - 0.9, hx: 1.0, hz: 2.0, ry: 0.6 });
    for (const [x, z] of [[-4, -8], [-3.2, -8.6], [8, -5], [-10, 1]]) { prop('Prop_Crate', x, z, x); this.colliders.push({ x, z, r: 0.7 }); }
    // Fence along the slime field.
    for (let i = 0; i < 8; i++) prop('Prop_WoodenFence_Single', 22 + i * 2.05, -6.5, 0);
    // Solid fence: one thin box along its whole length (each piece is ~2.06 m wide).
    this.colliders.push({ box: true, x: 22 + 3.5 * 2.05, z: -6.5, hx: 4 * 2.05 + 0.05, hz: 0.2, ry: 0 });
    // Well in the plaza (code-built).
    const well = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.8 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 16, 1, true), stone); ring.position.y = 0.45; well.add(ring);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16), this.waterMat); water.rotation.x = -Math.PI / 2; water.position.y = 0.3; well.add(water);
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), wood); post.position.set(sx * 1.05, 1.1, 0); well.add(post); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0xb5482e })); roof.position.y = 2.6; roof.rotation.y = Math.PI / 4; well.add(roof);
    well.traverse(o => { if (o.isMesh) o.castShadow = true; });
    well.position.set(-3, heightAt(-3, 3), 3); statics.add(well);
    this.colliders.push({ x: -3, z: 3, r: 1.3, cam: 1.8, h: 3.3 });
    // Bram's forge: anvil + glowing furnace.
    const forge = new THREE.Group();
    const iron = new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.7, roughness: 0.4 });
    const anvil = new THREE.Group();
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.35), iron); a1.position.y = 0.25; anvil.add(a1);
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.4), iron); a2.position.y = 0.62; anvil.add(a2);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), iron); horn.rotation.z = Math.PI / 2; horn.position.set(0.68, 0.62, 0); anvil.add(horn);
    forge.add(anvil);
    const furnace = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x6d5f55, roughness: 0.95 })); furnace.position.set(-2.2, 0.7, -0.8); forge.add(furnace);
    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), new THREE.MeshBasicMaterial({ color: 0xff7a1a })); fire.position.set(-2.2, 0.55, -0.07); forge.add(fire);
    this.fireLight = new THREE.PointLight(0xff7a1a, 6, 6); this.fireLight.position.set(-2.2, 1, 0.3); forge.add(this.fireLight);
    forge.traverse(o => { if (o.isMesh) o.castShadow = true; });
    forge.position.set(Z1.forge.x, heightAt(Z1.forge.x, Z1.forge.z), Z1.forge.z); forge.rotation.y = 0.5;
    this.scene.add(forge);
    this.#mergeStatic(statics);
    this.colliders.push({ x: Z1.forge.x, z: Z1.forge.z, r: 0.8 }, { x: Z1.forge.x - 2.3, z: Z1.forge.z + 0.3, r: 1.0 });
  }

  // ---- Bridge (broken until patched) ----
  #bridge(kit) {
    const len = 16;
    const b = kit.bridge(len);
    const cx = riverX(Z1.bridgeZ);
    this.bridgeDeckY = 0.12;
    b.position.set(cx, this.bridgeDeckY, Z1.bridgeZ); b.rotation.y = Math.PI / 2;
    this.scene.add(b);
    this.bridgeCX = cx; this.bridgeHalfLen = len / 2;
    // The middle section is missing: those planks/rails start hidden.
    const planks = b.userData.planks;
    this.missing = planks.filter(p => Math.abs(p.position.z) < 4);
    for (const p of this.missing) { p.userData.home = p.position.clone(); p.visible = false; }
    // Glitch shimmer where the planks should be.
    const gm = new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.35, wireframe: true });
    this.bridgeGlitch = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 4, 8, 2, 4), gm);
    this.bridgeGlitch.position.set(cx, this.bridgeDeckY + 0.4, Z1.bridgeZ);
    this.scene.add(this.bridgeGlitch);
    this.bridgePos = new THREE.Vector3(cx, 0, Z1.bridgeZ);
  }

  repairBridge(effects) {
    if (this.bridgeRepaired) return;
    this.bridgeRepaired = true;
    this.bridgeGlitch.visible = false;
    this.missing.forEach((p, i) => {
      p.visible = true; p.position.copy(p.userData.home).add(new THREE.Vector3(0, 6 + i * 0.4, 0));
      p.userData.dropT = -i * 0.08;
    });
    this.dropping = true;
    effects?.burst(this.bridgePos.clone().add(new THREE.Vector3(0, 1, 0)), 30, [0, 2], 5);
  }

  // ---- Arena ----
  #arena() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.22, side: THREE.DoubleSide, wireframe: true, depthWrite: false });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(Z1.arenaR, Z1.arenaR, 6, 48, 4, true), mat);
    b.position.set(Z1.arena.x, heightAt(Z1.arena.x, Z1.arena.z) + 2.5, Z1.arena.z); b.visible = false;
    this.scene.add(b);
    this.barrierMesh = b;
  }

  // ---- Zone gate (to Glitchwood Forest) ----
  #gate() {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x7d8290, roughness: 0.9, flatShading: true });
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), stone); pillar.position.set(sx * 3, 3, 0); g.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), stone); cap.position.set(sx * 3, 6.2, 0); g.add(cap);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1, 1.4), stone); lintel.position.y = 6.8; g.add(lintel);
    this.portalMat = new THREE.MeshBasicMaterial({ color: 0x7a3cff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 6, 12, 12), this.portalMat); portal.position.y = 3; g.add(portal);
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 6, 10, 12), new THREE.MeshBasicMaterial({ color: 0xff2bd6, wireframe: true, transparent: true, opacity: 0.5 })); grid.position.set(0, 3, 0.02); g.add(grid);
    this.portal = portal;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(Z1.gate.x, heightAt(Z1.gate.x, Z1.gate.z), Z1.gate.z); g.rotation.y = 0.15;
    this.scene.add(g);
    this.colliders.push({ box: true, x: Z1.gate.x, z: Z1.gate.z, hx: 3.6, hz: 0.7, ry: 0.15 });
  }

  setBarrier(on) { this.barrier = on; this.barrierMesh.visible = on; }

  // ---- Save crystals ----
  #crystal(p) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8ff4ff, emissive: 0x29e6ff, emissiveIntensity: 1.2, transparent: true, opacity: 0.9, metalness: 0.2, roughness: 0.1 });
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), mat); c.scale.y = 1.7; c.position.y = 1.6; g.add(c);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x8a8f9c, flatShading: true })); base.position.y = 0.15; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: 0x29e6ff })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; g.add(ring);
    g.position.set(p.x, heightAt(p.x, p.z), p.z);
    this.scene.add(g);
    this.colliders.push({ x: p.x, z: p.z, r: 0.9 });
    return { group: g, gem: c, pos: g.position.clone() };
  }

  // ---- Instanced props ----
  // Each prop type becomes InstancedMeshes split into 40 m map sections, so sections
  // off-screen (or outside the shadow area) are skipped entirely.
  #instance(template, transforms, { shadow = true } = {}) {
    template.updateMatrixWorld(true);
    const meshes = [];
    template.traverse(o => { if (o.isMesh) meshes.push(o); });
    const m4 = new THREE.Matrix4(), local = new THREE.Matrix4(), inv = new THREE.Matrix4().copy(template.matrixWorld).invert();
    const CELL = 60, cells = new Map();
    for (const t of transforms) {
      const key = Math.floor(t.p.x / CELL) + ',' + Math.floor(t.p.z / CELL);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(t);
    }
    for (const src of meshes) {
      if (/Leaves/i.test(src.material.name) && src.material.vertexColors) { src.material.vertexColors = false; src.material.needsUpdate = true; }
      local.multiplyMatrices(inv, src.matrixWorld);
      for (const list of cells.values()) {
        const im = new THREE.InstancedMesh(src.geometry, src.material, list.length);
        list.forEach((t, i) => { m4.compose(t.p, t.q, t.s).multiply(local); im.setMatrixAt(i, m4); });
        im.castShadow = shadow && this.quality.dense; // phones: only characters/buildings cast shadows
        im.receiveShadow = true;
        im.computeBoundingSphere();
        this.scene.add(im);
      }
    }
  }

  #footprint(template, includeLeaves, maxY) {
    template.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(template.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3();
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, n = 0;
    template.traverse(o => {
      if (!o.isMesh) return;
      if (!includeLeaves && /Leaves|Leaf|Grass|Flower/i.test(o.material.name)) return;
      m.multiplyMatrices(inv, o.matrixWorld);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        if (v.y > maxY) continue;
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z); n++;
      }
    });
    if (!n) return null;
    return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, r: Math.max(maxX - minX, maxZ - minZ) / 2 };
  }

  // Keep big props out of the places where the story happens.
  #blocked(x, z, pad) {
    if (Math.hypot(x - Z1.village.x, z - Z1.village.z) < Z1.villageR + 4 + pad) return true;
    if (Math.hypot(x - Z1.wake.x, z - Z1.wake.z) < 7 + pad) return true;
    if (Math.hypot(x - Z1.gate.x, z - Z1.gate.z) < 9 + pad) return true;
    if (Math.hypot(x - Z1.field.x, z - Z1.field.z) < Z1.fieldR - 2 + pad) return true;
    if (Math.hypot(x - Z1.arena.x, z - Z1.arena.z) < Z1.arenaR + 1 + pad) return true;
    if (Math.abs(x - riverX(z)) < 6.5 + pad) return true;
    if (distToPath(x, z) < 3 + pad) return true;
    return false;
  }

  #props(quality) {
    const lib = this.lib, r = rng(1234);
    const place = (name, count, opts = {}) => {
      if (!lib[name]) return;
      const fp = opts.collide ? this.#footprint(lib[name], opts.collide === 'leafy', opts.collide === 'leafy' ? 1.0 : 1.4) : null;
      const list = [];
      let tries = 0;
      const [sMin, sMax] = opts.scale;
      while (list.length < count && tries++ < count * 40) {
        let x, z;
        if (opts.ring) { const a = r() * Math.PI * 2; const rr = opts.ring.r + (r() - 0.5) * opts.ring.w; x = opts.ring.cx + Math.cos(a) * rr; z = opts.ring.cz + Math.sin(a) * rr; if (opts.ring.gap !== undefined && Math.abs(Math.atan2(Math.sin(a - opts.ring.gap), Math.cos(a - opts.ring.gap))) < 0.45) continue; }
        else { x = (r() - 0.5) * 2 * (WORLD_RADIUS - 6); z = (r() - 0.5) * 2 * (WORLD_RADIUS - 6); if (Math.hypot(x, z) > WORLD_RADIUS - 4) continue; if (this.#blocked(x, z, opts.pad ?? 0)) continue; }
        if (opts.spacing && this.colliders.some(c => !c.box && Math.hypot(c.x - x, c.z - z) < opts.spacing + c.r)) continue;
        const s = sMin + r() * (sMax - sMin), yaw = r() * Math.PI * 2;
        list.push({ p: new THREE.Vector3(x, heightAt(x, z) - 0.05, z), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), s: new THREE.Vector3(s, s, s) });
        if (fp) {
          const c = Math.cos(yaw), sn = Math.sin(yaw);
          const ox = (fp.cx * c + fp.cz * sn) * s, oz = (-fp.cx * sn + fp.cz * c) * s;
          this.colliders.push({ x: x + ox, z: z + oz, r: Math.max(0.25, fp.r * s * (opts.collide === 'leafy' ? 0.6 : 0.9)) });
        }
      }
      this.#instance(lib[name], list, { shadow: opts.shadow !== false });
    };
    const dense = quality.dense;
    // Rocks ring the arena; the gap faces the bridge (east, angle 0).
    const ring = { cx: Z1.arena.x, cz: Z1.arena.z, r: Z1.arenaR + 2.5, w: 2, gap: 0 };
    place('Rock_Medium_1', 9, { scale: [1.0, 1.6], collide: 'solid', ring, spacing: 1 });
    place('Rock_Medium_2', 9, { scale: [1.0, 1.6], collide: 'solid', ring, spacing: 1 });
    place('Pine_2', 8, { scale: [1.0, 1.4], collide: 'solid', ring: { ...ring, r: Z1.arenaR + 7, w: 4 }, spacing: 2 });
    const k = dense ? 1 : 0.7;
    place('CommonTree_1', Math.round(4 * k), { scale: [1.0, 1.35], collide: 'solid', spacing: 7 });
    place('CommonTree_2', Math.round(3 * k), { scale: [1.0, 1.35], collide: 'solid', spacing: 7 });
    place('CommonTree_3', Math.round(3 * k), { scale: [1.0, 1.35], collide: 'solid', spacing: 7 });
    place('Pine_1', Math.round(20 * k), { scale: [0.9, 1.5], collide: 'solid', spacing: 5 });
    place('Pine_2', Math.round(16 * k), { scale: [0.9, 1.5], collide: 'solid', spacing: 5 });
    place('TwistedTree_1', 4, { scale: [0.9, 1.1], collide: 'solid', spacing: 6 });
    place('Rock_Medium_3', 10, { scale: [0.6, 1.2], collide: 'solid', spacing: 3 });
    place('Bush_Common', 24, { scale: [0.55, 0.85], collide: 'leafy', spacing: 1 });
    place('Bush_Common_Flowers', 20, { scale: [0.55, 0.85], collide: 'leafy', spacing: 1 });
    place('Fern_1', 22, { scale: [0.45, 0.7], shadow: false, pad: -2 });
    place('Mushroom_Common', 14, { scale: [0.4, 0.7], shadow: false, pad: -2 });
    place('Flower_4_Group', dense ? 45 : 22, { scale: [0.3, 0.45], shadow: false, pad: -5 });
    place('Flower_3_Single', dense ? 35 : 18, { scale: [0.3, 0.45], shadow: false, pad: -5 });
    place('Grass_Common_Tall', dense ? 140 : 60, { scale: [0.3, 0.5], shadow: false, pad: -5 });
    place('Grass_Wispy_Short', dense ? 140 : 60, { scale: [0.35, 0.55], shadow: false, pad: -5 });
    place('Pebble_Round_2', 30, { scale: [0.4, 0.8], shadow: false, pad: -3 });
  }

  // Is a point inside a house volume (used to keep the camera out of buildings)?
  insideBuilding(x, y, z) {
    for (const c of this.colliders) {
      if (c.cam) { if (Math.hypot(x - c.x, z - c.z) < c.cam && y < heightAt(c.x, c.z) + c.h) return true; continue; }
      if (!c.box || c.hx < 1.5) continue;
      const cs = Math.cos(c.ry), sn = Math.sin(c.ry), dx = x - c.x, dz = z - c.z;
      const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      if (Math.abs(lx) < c.hx + 0.6 && Math.abs(lz) < c.hz + 0.6 && y < heightAt(c.x, c.z) + 10) return true;
    }
    return false;
  }

  // Ground height including the bridge deck.
  groundAt(x, z) {
    const h = heightAt(x, z);
    if (this.bridgeRepaired && Math.abs(z - Z1.bridgeZ) < Z1.bridgeHalfW + 0.3 && Math.abs(x - this.bridgeCX) < this.bridgeHalfLen) return Math.max(h, this.bridgeDeckY);
    return h;
  }

  // Push a circle (x, z, radius) out of obstacles and keep it inside the playable area.
  resolve(p, radius) {
    for (let pass = 0; pass < 2; pass++) for (const c of this.colliders) {
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
    // River: only crossable on the repaired bridge, and you stay between the rails.
    const rx = riverX(p.z), rd = p.x - rx;
    if (Math.abs(rd) < 4.2) {
      const onDeck = this.bridgeRepaired && Math.abs(p.x - this.bridgeCX) < this.bridgeHalfLen && Math.abs(p.z - Z1.bridgeZ) < Z1.bridgeHalfW + 1.5;
      if (onDeck) p.z = Z1.bridgeZ + THREE.MathUtils.clamp(p.z - Z1.bridgeZ, -Z1.bridgeHalfW + radius * 0.5, Z1.bridgeHalfW - radius * 0.5);
      else p.x = rx + Math.sign(rd || 1) * 4.2;
    }
    // Boss barrier.
    if (this.barrier) {
      const dx = p.x - Z1.arena.x, dz = p.z - Z1.arena.z, d = Math.hypot(dx, dz), max = Z1.arenaR - 0.8;
      if (d > max && d < Z1.arenaR + 4) { p.x = Z1.arena.x + dx / d * max; p.z = Z1.arena.z + dz / d * max; }
    }
    const d = Math.hypot(p.x, p.z), max = WORLD_RADIUS - 6;
    if (d > max) { p.x *= max / d; p.z *= max / d; }
  }

  update(dt, t, focus) {
    for (const f of this.floaters) {
      f.rotation.y += f.userData.spin * dt; f.rotation.x += f.userData.spin * 0.5 * dt;
      f.position.y = f.userData.baseY + Math.sin(t * 0.6 + f.userData.spin * 10) * 0.6;
    }
    for (const c of this.crystals) { c.gem.rotation.y += dt * 1.2; c.gem.position.y = 1.6 + Math.sin(t * 2) * 0.12; }
    if (this.fireLight) this.fireLight.intensity = 5 + Math.sin(t * 13) * 1.2 + Math.sin(t * 7.3);
    if (this.bridgeGlitch?.visible) { this.bridgeGlitch.rotation.x = Math.sin(t * 9) * 0.03; this.bridgeGlitch.material.opacity = 0.25 + (Math.sin(t * 23) > 0.6 ? 0.3 : 0); }
    if (this.barrierMesh.visible) this.barrierMesh.rotation.y += dt * 0.2;
    if (this.portalMat) this.portalMat.opacity = 0.45 + Math.sin(t * 3) * 0.12 + (Math.sin(t * 29) > 0.8 ? 0.2 : 0);
    if (this.dropping) {
      let busy = false;
      for (const p of this.missing) {
        p.userData.dropT += dt;
        if (p.userData.dropT < 0) { busy = true; continue; }
        const k = Math.min(1, p.userData.dropT / 0.45);
        p.position.y = p.userData.home.y + (1 - k * k) * 6;
        if (k < 1) busy = true;
      }
      this.dropping = busy;
    }
    if (this.sun && focus) {
      this.sun.position.set(focus.x + 18, focus.y + 30, focus.z + 12);
      this.sun.target.position.copy(focus);
    }
    if (this.skyDome && focus) this.skyDome.position.set(focus.x, 0, focus.z);
  }
}
