// Builds playable characters from the merged Quaternius models:
// one shared skeleton, head-only base body, hair tint and code-built accessories.
import * as THREE from 'three';

const HEAD_BONES = new Set(['Head', 'neck_01']);

// Rebind every skinned mesh to the first skeleton found, by bone name.
function unifySkeleton(root) {
  const skinned = [];
  root.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  const master = skinned[0].skeleton;
  const byName = new Map(master.bones.map(b => [b.name, b]));
  // GLTFLoader renames duplicate node names ("root" -> "root_1"), so strip that suffix when needed.
  const match = n => byName.get(n) || byName.get(n.replace(/_\d+$/, ''));
  for (const m of skinned) {
    if (m.skeleton === master) continue;
    const bones = m.skeleton.bones.map(b => match(b.name) || b);
    m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
  }
  // Remove the now unused duplicate armatures (bones not in the master skeleton).
  const keep = new Set(master.bones);
  const extra = [];
  root.traverse(o => { if (o.isBone && !keep.has(o) && o.parent && !o.parent.isBone) extra.push(o); });
  for (const b of extra) b.parent.remove(b);
  return master;
}

// Keep only the head of the base body (the outfit covers the rest).
function trimToHead(mesh) {
  const geo = mesh.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const keepV = new Uint8Array(si.count);
  for (let v = 0; v < si.count; v++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } }
    keepV[v] = HEAD_BONES.has(mesh.skeleton.bones[best].name) ? 1 : 0;
  }
  const idx = geo.index.array, out = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (keepV[idx[i]] && keepV[idx[i + 1]] && keepV[idx[i + 2]]) out.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(out);
}

const findBone = (root, name) => { let b = null; root.traverse(o => { if (!b && o.isBone && o.name === name) b = o; }); return b; };

// Place an object in world space at the current pose, then parent it to a bone.
function attachAt(root, obj, boneName, worldPos, rot) {
  root.add(obj); obj.position.copy(worldPos); if (rot) obj.rotation.copy(rot);
  root.updateMatrixWorld(true);
  findBone(root, boneName).attach(obj);
}

export const MAT = {
  cyan: new THREE.MeshStandardMaterial({ color: 0x29e6ff, emissive: 0x18c8ff, emissiveIntensity: 1.4 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1b1f2a, roughness: 0.5, metalness: 0.3 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc9d6e3, metalness: 0.85, roughness: 0.25 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf2c75c, metalness: 0.9, roughness: 0.25 }),
  gem: new THREE.MeshStandardMaterial({ color: 0x8fd3ff, emissive: 0x5ab8ff, emissiveIntensity: 1.2 }),
};

function jasperExtras(root) {
  const wp = n => findBone(root, n).getWorldPosition(new THREE.Vector3());
  // Headphones worn over the hood.
  const head = wp('Head');
  const hp = new THREE.Group();
  const R = 0.155;
  hp.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.014, 8, 32, Math.PI), MAT.dark));
  for (const sx of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 20), MAT.dark);
    cup.rotation.z = Math.PI / 2; cup.position.set(sx * R, 0, 0); hp.add(cup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 20), MAT.cyan);
    ring.rotation.y = Math.PI / 2; ring.position.set(sx * (R + 0.019), 0, 0); hp.add(ring);
  }
  hp.scale.y = 0.86;
  attachAt(root, hp, 'Head', new THREE.Vector3(head.x, head.y + 0.085, head.z - 0.01), new THREE.Euler(-0.12, 0, 0));

  // Debug Blade in the right hand.
  const hand = wp('hand_r');
  const blade = new THREE.Group();
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.85, 0.012), MAT.steel); b1.position.y = -0.52; blade.add(b1);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.8, 0.016), MAT.cyan); edge.position.set(0.026, -0.5, 0); blade.add(edge);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), MAT.dark); guard.position.y = -0.08; blade.add(guard);
  blade.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 10), MAT.dark));
  for (let i = 0; i < 5; i++) {
    const px = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), MAT.cyan);
    px.position.set(0.05 + (i % 2) * 0.02, -0.25 - i * 0.14, 0); blade.add(px);
  }
  blade.traverse(o => { o.castShadow = true; });
  attachAt(root, blade, 'hand_r', new THREE.Vector3(hand.x, hand.y + 0.02, hand.z + 0.02), new THREE.Euler(0.15, 0, 0));

  // Blade tip marker (used for slash trails).
  const tip = new THREE.Object3D(); tip.position.y = -0.95; blade.add(tip);

  // Floating cursor icon (follows the left hand).
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(0, -0.12); shape.lineTo(0.03, -0.09); shape.lineTo(0.055, -0.14);
  shape.lineTo(0.07, -0.13); shape.lineTo(0.045, -0.085); shape.lineTo(0.085, -0.085); shape.closePath();
  const cursor = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false }), MAT.cyan);
  const lh = wp('hand_l');
  attachAt(root, cursor, 'hand_l', new THREE.Vector3(lh.x - 0.1, lh.y + 0.12, lh.z + 0.08));
  return { blade, tip, cursor };
}

function victoryExtras(root) {
  const head = findBone(root, 'Head').getWorldPosition(new THREE.Vector3());
  const c = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.009, 8, 40), MAT.gold);
  ring.rotation.x = Math.PI / 2 - 0.35; ring.scale.set(0.95, 1.05, 1); c.add(ring);
  const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), MAT.gem); g.position.set(0, 0.03, 0.1); c.add(g);
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 6), MAT.gold);
    p.position.set(sx * 0.045, 0.025, 0.088); c.add(p);
  }
  attachAt(root, c, 'Head', new THREE.Vector3(head.x, head.y + 0.16, head.z + 0.03));
  return {};
}

// gltf: loaded GLTF of the merged character. idleClip: pose used while attaching props.
export function buildCharacter(gltf, kind, idleClip) {
  const root = gltf.scene;
  const hairColor = kind === 'jasper' ? 0x241a14 : 0xe9c27a;
  const skeleton = unifySkeleton(root);
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (/superhero/i.test(o.name) && o.isSkinnedMesh && !/eye/i.test(o.name)) trimToHead(o);
    if (o.material && /Hair/i.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set(hairColor); }
  });
  // Pose once in idle so props line up with the hands, then attach.
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(idleClip).play(); mixer.update(0.6);
  root.updateMatrixWorld(true);
  const extras = kind === 'jasper' ? jasperExtras(root) : victoryExtras(root);
  mixer.stopAllAction(); mixer.uncacheRoot(root);
  return { root, skeleton, ...extras };
}
