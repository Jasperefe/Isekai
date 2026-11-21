// Builds assets/models/mira.glb: female base (head) + hooded Ranger outfit + long hair.
import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, dedup, prune, resample, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
const [, , M, OUT] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const files = [`${M}/Superhero_Female_FullBody.gltf`, `${M}/Female_Ranger.gltf`, `${M}/Hair_Long.gltf`];
const doc = await io.read(files[0]);
for (const f of files.slice(1)) mergeDocuments(doc, await io.read(f));
const root = doc.getRoot();
const [main, ...rest] = root.listScenes();
for (const s of rest) { for (const n of s.listChildren()) main.addChild(n); s.dispose(); }
root.setDefaultScene(main);
await doc.transform(unpartition(), dedup(), prune(), resample(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(path.join(OUT, 'mira.glb'), doc);
console.log('mira.glb', (fs.statSync(path.join(OUT, 'mira.glb')).size / 1024).toFixed(0) + ' KB');
