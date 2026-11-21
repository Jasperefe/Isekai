// Builds assets/models/props.glb from the Fantasy Props MegaKit (chest, coins, loot bag, potion).
// Usage: node tools/build-props.mjs <MegaKit>/Exports/glTF assets/models
import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, dedup, prune, resample, textureCompress, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , DIR, OUT] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const names = ['Chest_Wood', 'Coin', 'Coin_Pile', 'Bag', 'Potion_1'];
const label = (d, nm) => { const s = d.getRoot().listScenes()[0]; const kids = s.listChildren(); const g = d.createNode(nm); kids.forEach(k => { s.removeChild(k); g.addChild(k); }); s.addChild(g); };
const doc = await io.read(`${DIR}/${names[0]}.gltf`); label(doc, names[0]);
for (const nm of names.slice(1)) { const d = await io.read(`${DIR}/${nm}.gltf`); label(d, nm); mergeDocuments(doc, d); }
const root = doc.getRoot();
const [main, ...rest] = root.listScenes();
for (const s of rest) { for (const n of s.listChildren()) main.addChild(n); s.dispose(); }
root.setDefaultScene(main);
await doc.transform(unpartition(), weld(), dedup(), prune(), resample(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(path.join(OUT, 'props.glb'), doc);
console.log('props.glb', (fs.statSync(path.join(OUT, 'props.glb')).size / 1024).toFixed(0) + ' KB');
