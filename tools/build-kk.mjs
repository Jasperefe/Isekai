// Builds kk_forest.glb and kk_halloween.glb (KayKit packs, CC0): one top-level node per prop.
import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, dedup, prune, resample, textureCompress, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
const [, , WORK, OUT] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const label = (d, nm) => { const s = d.getRoot().listScenes()[0]; const kids = s.listChildren(); const g = d.createNode(nm); kids.forEach(k => { s.removeChild(k); g.addChild(k); }); s.addChild(g); };
async function lib(dir, names, out, alias = n => n) {
  const doc = await io.read(`${dir}/${names[0]}.gltf`); label(doc, alias(names[0]));
  for (const nm of names.slice(1)) { const d = await io.read(`${dir}/${nm}.gltf`); label(d, alias(nm)); mergeDocuments(doc, d); }
  const root = doc.getRoot(); const [main, ...rest] = root.listScenes();
  for (const s of rest) { for (const n of s.listChildren()) main.addChild(n); s.dispose(); }
  root.setDefaultScene(main);
  await doc.transform(unpartition(), weld(), dedup(), prune(), resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [256, 256], quality: 90 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path.join(OUT, out), doc);
  console.log(out, (fs.statSync(path.join(OUT, out)).size / 1024).toFixed(0) + ' KB');
}
const F = ['Tree_1_B', 'Tree_1_C', 'Tree_2_B', 'Tree_2_C', 'Tree_3_B', 'Tree_4_B', 'Tree_4_C', 'Tree_Bare_1_B', 'Tree_Bare_1_C', 'Tree_Bare_2_B', 'Tree_Bare_2_C',
  'Bush_1_C', 'Bush_2_C', 'Bush_3_B', 'Bush_4_C', 'Bush_4_E', 'Rock_1_D', 'Rock_1_H', 'Rock_1_J', 'Rock_1_O', 'Rock_1_Q', 'Rock_2_C', 'Rock_2_F', 'Rock_3_E', 'Rock_3_K', 'Rock_3_R', 'Grass_1_B', 'Grass_2_B'].map(n => n + '_Color1');
await lib(`${WORK}/forest`, F, 'kk_forest.glb', n => n.replace('_Color1', ''));
const H = ['arch', 'arch_gate', 'crypt', 'grave_A', 'grave_A_destroyed', 'grave_B', 'gravestone', 'gravemarker_A', 'gravemarker_B', 'fence', 'fence_broken', 'fence_pillar', 'fence_pillar_broken',
  'lantern_standing', 'post_lantern', 'candle_triple', 'candle', 'skull', 'skull_candle', 'bone_A', 'bone_C', 'ribcage', 'shrine_candles', 'tree_dead_large', 'tree_dead_medium', 'tree_dead_small', 'pillar', 'floor_dirt_grave', 'coffin'];
await lib(`${WORK}/halloween`, H, 'kk_halloween.glb');
