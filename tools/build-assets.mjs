// Builds compressed game assets for ISEKAI from the Quaternius source packs.
// usage: node build-assets.mjs <viewerModelDir> <ual1.glb> <ual2.glb> <natureGltfDir> <outDir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, dedup, prune, resample, textureCompress, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const [, , M, UAL1, UAL2, NATURE, OUT] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});

async function finish(doc, file, texSize = 1024) {
  await doc.transform(
    dedup(), prune(), resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(path.join(OUT, file), doc);
  console.log(file, (fs.statSync(path.join(OUT, file)).size / 1024).toFixed(0) + ' KB');
}

// Merge several glTF files into one document with a single scene.
async function mergeFiles(files) {
  const doc = await io.read(files[0]);
  for (const f of files.slice(1)) mergeDocuments(doc, await io.read(f));
  const root = doc.getRoot();
  const [main, ...rest] = root.listScenes();
  for (const s of rest) { for (const n of s.listChildren()) main.addChild(n); s.dispose(); }
  root.setDefaultScene(main);
  await doc.transform(unpartition());
  return doc;
}

function removeMeshNodes(doc, pattern) {
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh();
    if (m && pattern.test(m.getName() + ' ' + n.getName())) n.setMesh(null);
  }
}

// Characters.
{
  const doc = await mergeFiles([`${M}/Superhero_Male_FullBody.gltf`, `${M}/Jasper_Outfit.gltf`, `${M}/Hair_SimpleParted.gltf`]);
  removeMeshNodes(doc, /Pauldron/);
  await finish(doc, 'jasper.glb', 1024);
}
{
  const doc = await mergeFiles([`${M}/Superhero_Female_FullBody.gltf`, `${M}/VictoryP_Outfit.gltf`, `${M}/Hair_Long.gltf`]);
  await finish(doc, 'victory.glb', 1024);
}

// Animations: keep only the clips the game uses, drop meshes.
async function anims(file, keep, out) {
  const doc = await io.read(file);
  for (const a of doc.getRoot().listAnimations()) if (!keep.includes(a.getName())) a.dispose();
  for (const n of doc.getRoot().listNodes()) n.setMesh(null);
  for (const s of doc.getRoot().listSkins()) s.dispose();
  for (const t of doc.getRoot().listTextures()) t.dispose();
  await doc.transform(dedup(), prune({ keepLeaves: true }), resample({ tolerance: 0.002 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(path.join(OUT, out), doc);
  console.log(out, (fs.statSync(path.join(OUT, out)).size / 1024).toFixed(0) + ' KB', doc.getRoot().listAnimations().map(a => a.getName()).join(','));
}
await anims(UAL1, ['Idle_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Walk_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Roll',
  'Death01', 'Hit_Chest', 'Sword_Attack', 'Sword_Idle', 'Spell_Simple_Shoot'], 'anims1.glb');
await anims(UAL2, ['Sword_Regular_A', 'Sword_Regular_A_Rec', 'Sword_Regular_B', 'Sword_Regular_B_Rec', 'Sword_Regular_C', 'Sword_Dash', 'Sword_Block', 'Sword_Heavy_Combo', 'Melee_Hook', 'Hit_Knockback'], 'anims2.glb');

// Nature props: one file, one top-level node per prop.
{
  const names = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'Pine_1', 'Pine_2', 'TwistedTree_1', 'Rock_Medium_1', 'Rock_Medium_2',
    'Rock_Medium_3', 'Bush_Common', 'Bush_Common_Flowers', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Flower_4_Group', 'Flower_3_Single',
    'Mushroom_Common', 'Fern_1', 'Pebble_Round_2', 'RockPath_Round_Wide'];
  const doc = await io.read(`${NATURE}/${names[0]}.gltf`);
  const label = (d, nm) => { const s = d.getRoot().listScenes()[0]; const kids = s.listChildren(); const g = d.createNode(nm); kids.forEach(k => { s.removeChild(k); g.addChild(k); }); s.addChild(g); };
  label(doc, names[0]);
  for (const nm of names.slice(1)) {
    const d = await io.read(`${NATURE}/${nm}.gltf`); label(d, nm);
    mergeDocuments(doc, d);
  }
  const root = doc.getRoot();
  const [main, ...rest] = root.listScenes();
  for (const s of rest) { for (const n of s.listChildren()) main.addChild(n); s.dispose(); }
  root.setDefaultScene(main);
  await doc.transform(unpartition(), weld());
  await finish(doc, 'nature.glb', 512);
}
