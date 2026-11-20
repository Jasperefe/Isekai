// Starter Meadow test area: terrain, lighting, sky and instanced nature props.
import * as THREE from 'three';

export const WORLD_RADIUS = 55;

// Gentle rolling hills, flat near the spawn point.
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const flat = THREE.MathUtils.smoothstep(d, 8, 22);
  const h = Math.sin(x * 0.09) * Math.cos(z * 0.075) * 1.2 + Math.sin((x + z) * 0.045) * 1.6 + Math.cos(x * 0.21 + 1.3) * Math.sin(z * 0.17) * 0.35;
  const rim = THREE.MathUtils.smoothstep(d, WORLD_RADIUS - 6, WORLD_RADIUS + 12) * 7;
  return h * flat + rim;
}

// Seeded random so the meadow looks the same every visit.
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

export class World {
  constructor(scene, natureGltf, quality) {
    this.scene = scene;
    this.colliders = []; // { x, z, r }
    this.#sky(); this.#lights(quality); this.#terrain();
    this.#props(natureGltf, quality);
  }

  #sky() {
    const s = this.scene;
    s.background = new THREE.Color(0x9fd4ff);
    s.fog = new THREE.Fog(0xbfe3ff, 35, 95);
    const geo = new THREE.SphereGeometry(300, 24, 12);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x4f9be8) }, bottom: { value: new THREE.Color(0xd8efff) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(vP.y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, t),1.0); }',
    });
    this.skyDome = new THREE.Mesh(geo, mat); s.add(this.skyDome);
    // A few floating rocks: a "glitch" in the sky that hints at the bugged world.
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8f9c, flatShading: true });
    const r = rng(7);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + r() * 2, 0), rockMat);
      const a = r() * Math.PI * 2, d = 30 + r() * 25;
      m.position.set(Math.cos(a) * d, 14 + r() * 10, Math.sin(a) * d);
      m.userData.spin = 0.1 + r() * 0.3; m.userData.baseY = m.position.y;
      s.add(m); (this.floaters ||= []).push(m);
    }
  }

  #lights(quality) {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xdff2ff, 0x5c7a3a, 1.25));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    sun.position.set(18, 30, 12);
    if (quality.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      const c = sun.shadow.camera; c.left = -22; c.right = 22; c.top = 22; c.bottom = -22; c.near = 1; c.far = 80;
      sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
    }
    s.add(sun); s.add(sun.target);
    this.sun = sun;
  }

  #terrain() {
    const size = 160, seg = 96;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = [];
    const c1 = new THREE.Color(0x6fb04a), c2 = new THREE.Color(0x8cc25a), c3 = new THREE.Color(0x5a9a3e), path = new THREE.Color(0xc9b27e);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      const n = (Math.sin(x * 0.35) * Math.cos(z * 0.29) + Math.sin(x * 0.11 + z * 0.13)) * 0.5 + 0.5;
      tmp.copy(c1).lerp(c2, n * 0.7).lerp(c3, Math.max(0, Math.sin(x * 0.05 - z * 0.07)) * 0.5);
      // A worn dirt path winding through the meadow.
      const pd = Math.abs(z - Math.sin(x * 0.08) * 6 - 4);
      if (pd < 1.6 && Math.abs(x) < 50) tmp.lerp(path, (1 - pd / 1.6) * 0.85);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;
  }

  // Each prop becomes one InstancedMesh per sub-mesh (few draw calls).
  #instance(template, transforms, { shadow = true, collide = 0 } = {}) {
    template.updateMatrixWorld(true);
    const meshes = [];
    template.traverse(o => { if (o.isMesh) meshes.push(o); });
    const m4 = new THREE.Matrix4(), local = new THREE.Matrix4(), inv = new THREE.Matrix4().copy(template.matrixWorld).invert();
    for (const src of meshes) {
      // Leaf meshes carry autumn vertex tints; use the green texture colours instead.
      if (/Leaves/i.test(src.material.name) && src.material.vertexColors) { src.material.vertexColors = false; src.material.needsUpdate = true; }
      local.multiplyMatrices(inv, src.matrixWorld);
      const im = new THREE.InstancedMesh(src.geometry, src.material, transforms.length);
      transforms.forEach((t, i) => { m4.compose(t.p, t.q, t.s).multiply(local); im.setMatrixAt(i, m4); });
      im.castShadow = shadow; im.receiveShadow = true;
      im.computeBoundingSphere();
      this.scene.add(im);
    }
    if (collide) for (const t of transforms) this.colliders.push({ x: t.p.x, z: t.p.z, r: collide * t.s.x });
  }

  #props(gltf, quality) {
    const lib = {};
    for (const c of gltf.scene.children) lib[c.name] = c;
    const r = rng(1234);
    const place = (name, count, minD, maxD, sMin, sMax, opts = {}) => {
      if (!lib[name]) return;
      const list = [];
      let tries = 0;
      while (list.length < count && tries++ < count * 30) {
        const a = r() * Math.PI * 2, d = minD + r() * (maxD - minD);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (opts.avoidPath && Math.abs(z - Math.sin(x * 0.08) * 6 - 4) < 3) continue;
        if (opts.spacing && this.colliders.some(c => Math.hypot(c.x - x, c.z - z) < opts.spacing)) continue;
        const s = sMin + r() * (sMax - sMin);
        list.push({ p: new THREE.Vector3(x, heightAt(x, z) - 0.05, z), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2), s: new THREE.Vector3(s, s, s) });
        if (opts.collide) this.colliders.push({ x, z, r: opts.collide * s });
      }
      this.#instance(lib[name], list, { shadow: opts.shadow !== false });
    };
    const dense = quality.dense;
    place('CommonTree_1', 9, 14, 52, 0.85, 1.2, { collide: 0.6, avoidPath: true, spacing: 5 });
    place('CommonTree_2', 9, 14, 52, 0.85, 1.2, { collide: 0.6, avoidPath: true, spacing: 5 });
    place('CommonTree_3', 7, 18, 52, 0.85, 1.2, { collide: 0.6, avoidPath: true, spacing: 5 });
    place('Pine_1', 10, 30, 56, 0.9, 1.4, { collide: 0.5, avoidPath: true, spacing: 4 });
    place('Pine_2', 8, 30, 56, 0.9, 1.4, { collide: 0.5, avoidPath: true, spacing: 4 });
    place('TwistedTree_1', 3, 20, 45, 0.9, 1.1, { collide: 0.6, avoidPath: true, spacing: 6 });
    place('Rock_Medium_1', 6, 10, 50, 0.6, 1.2, { collide: 0.8, avoidPath: true, spacing: 3 });
    place('Rock_Medium_2', 6, 10, 50, 0.6, 1.2, { collide: 0.8, avoidPath: true, spacing: 3 });
    place('Rock_Medium_3', 5, 10, 50, 0.6, 1.2, { collide: 0.8, avoidPath: true, spacing: 3 });
    place('Bush_Common', 14, 7, 52, 0.55, 0.85, { avoidPath: true });
    place('Bush_Common_Flowers', 12, 7, 52, 0.55, 0.85, { avoidPath: true });
    place('Fern_1', 14, 6, 50, 0.45, 0.7, { shadow: false });
    place('Mushroom_Common', 10, 6, 45, 0.4, 0.7, { shadow: false });
    place('Flower_4_Group', dense ? 50 : 25, 3, 50, 0.3, 0.45, { shadow: false });
    place('Flower_3_Single', dense ? 40 : 20, 3, 50, 0.3, 0.45, { shadow: false });
    place('Grass_Common_Tall', dense ? 160 : 70, 2, 52, 0.3, 0.5, { shadow: false });
    place('Grass_Wispy_Short', dense ? 160 : 70, 2, 52, 0.35, 0.55, { shadow: false });
    place('Pebble_Round_2', 20, 3, 45, 0.4, 0.8, { shadow: false });
  }

  // Push a circle (x, z, radius) out of trees/rocks and keep it inside the meadow.
  resolve(p, radius) {
    for (const c of this.colliders) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 1e-4) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
    }
    const d = Math.hypot(p.x, p.z), max = WORLD_RADIUS - 4;
    if (d > max) { p.x *= max / d; p.z *= max / d; }
  }

  update(dt, t, focus) {
    if (this.floaters) for (const f of this.floaters) {
      f.rotation.y += f.userData.spin * dt; f.rotation.x += f.userData.spin * 0.5 * dt;
      f.position.y = f.userData.baseY + Math.sin(t * 0.6 + f.userData.spin * 10) * 0.6;
    }
    // Keep the shadow camera centred on the player.
    if (this.sun && focus) {
      this.sun.position.set(focus.x + 18, focus.y + 30, focus.z + 12);
      this.sun.target.position.copy(focus);
    }
    if (this.skyDome && focus) this.skyDome.position.set(focus.x, 0, focus.z);
  }
}
