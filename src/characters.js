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

function jasperExtras(root, opts = {}) {
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
  if (opts.hero === 'victory') victoryExtras(root); // New Game+: Victory carries the Debug Blade, keeps her circlet
  else attachAt(root, hp, 'Head', new THREE.Vector3(head.x, head.y + 0.085, head.z - 0.01), new THREE.Euler(-0.12, 0, 0));

  // Debug Blade, built in hand-bone space: the grip runs along +Z (pinky -> index side),
  // the cutting edge points along +Y (knuckles), palm faces -X.
  const hand = findBone(root, 'hand_r');
  const blade = new THREE.Group();
  const len = 0.95;
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, len), MAT.steel); b1.position.z = 0.1 + len / 2; blade.add(b1);
  const tipM = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 4), MAT.steel); tipM.rotation.x = Math.PI / 2; tipM.scale.set(1, 1, 0.5); tipM.position.z = 0.1 + len + 0.05; blade.add(tipM);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.01, len * 0.92), MAT.cyan); edge.position.set(0, 0.028, 0.1 + len * 0.48); blade.add(edge);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.03), MAT.dark); guard.position.z = 0.085; blade.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.2, 10), MAT.dark); grip.rotation.x = Math.PI / 2; grip.position.z = -0.02; blade.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), MAT.cyan); pommel.position.z = -0.13; blade.add(pommel);
  for (let i = 0; i < 5; i++) {
    const px = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), MAT.cyan);
    px.position.set(0, 0.045 + (i % 2) * 0.02, 0.3 + i * 0.15); blade.add(px);
  }
  blade.traverse(o => { o.castShadow = true; });
  blade.position.set(-0.035, 0.095, 0);
  hand.add(blade);
  const tip = new THREE.Object3D(); tip.position.z = 0.1 + len; blade.add(tip);
  const handMount = { parent: hand, pos: blade.position.clone(), quat: blade.quaternion.clone() };

  // Back mount: handle over the right shoulder, blade running diagonally down the back.
  // Built in world space (model faces +Z, back is -Z) at the current pose, then parented to spine_03.
  const spine = findBone(root, 'spine_03');
  const sp = spine.getWorldPosition(new THREE.Vector3());
  const zAxis = new THREE.Vector3(-0.55, -0.9, 0).normalize();     // blade direction (down-left)
  const xAxis = new THREE.Vector3(0, 0, 1);                         // flat of the blade faces the back
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  xAxis.crossVectors(yAxis, zAxis).normalize();
  const back = new THREE.Object3D();
  back.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
  back.position.set(sp.x + 0.2, sp.y + 0.28, sp.z - 0.17);
  root.add(back); root.updateMatrixWorld(true); spine.attach(back);
  const backMount = { parent: spine, pos: back.position.clone(), quat: back.quaternion.clone() };
  spine.remove(back);
  const mountTo = m => { m.parent.add(blade); blade.position.copy(m.pos); blade.quaternion.copy(m.quat); };
  const sheathe = () => mountTo(backMount);
  const draw = () => mountTo(handMount);

  // Floating cursor icon (follows the left hand).
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(0, -0.12); shape.lineTo(0.03, -0.09); shape.lineTo(0.055, -0.14);
  shape.lineTo(0.07, -0.13); shape.lineTo(0.045, -0.085); shape.lineTo(0.085, -0.085); shape.closePath();
  const cursor = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false }), MAT.cyan);
  const lh = wp('hand_l');
  attachAt(root, cursor, 'hand_l', new THREE.Vector3(lh.x - 0.1, lh.y + 0.12, lh.z + 0.08));
  return { blade, tip, cursor, sheathe, draw };
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
export function buildCharacter(gltf, kind, idleClip, opts = {}) {
  const root = gltf.scene;
  const hairColor = opts.hair ?? (kind === 'jasper' ? 0x241a14 : 0xe9c27a);
  const skeleton = unifySkeleton(root);
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (/superhero/i.test(o.name) && o.isSkinnedMesh && !/eye/i.test(o.name)) trimToHead(o);
    if (o.material && /Hair/i.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set(hairColor); }
    if (opts.tint && o.material && !/Hair|Eye|Superhero|Regular/i.test(o.material.name)) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(opts.tint)); }
  });
  // Pose once in idle so props line up with the hands, then attach.
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(idleClip).play(); mixer.update(0.6);
  root.updateMatrixWorld(true);
  const extras = kind === 'jasper' ? jasperExtras(root, opts) : kind === 'victory' ? victoryExtras(root) : {};
  mixer.stopAllAction(); mixer.uncacheRoot(root);
  return { root, skeleton, ...extras };
}

// Right-hand finger pose taken from a sword clip, re-applied every frame so the grip never opens.
export function captureGrip(root, gripClip) {
  const fingers = [];
  root.traverse(o => { if (o.isBone && /^(thumb|index|middle|ring|pinky)_0[1-3]_r$/.test(o.name)) fingers.push(o); });
  const saved = fingers.map(b => b.quaternion.clone());
  const mixer = new THREE.AnimationMixer(root);
  const a = mixer.clipAction(gripClip); a.play(); mixer.update(0.5);
  const pose = fingers.map(b => b.quaternion.clone());
  mixer.stopAllAction(); mixer.uncacheRoot(root);
  fingers.forEach((b, i) => b.quaternion.copy(saved[i]));
  return () => fingers.forEach((b, i) => b.quaternion.copy(pose[i]));
}
