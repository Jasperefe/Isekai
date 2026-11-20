// Builds village houses from the Quaternius Medieval Village modular pieces.
// Wall pieces are 2 m wide and 3.12 m tall; their outer face points +Z.
import * as THREE from 'three';

const WALL_H = 3.12;

export class VillageKit {
  constructor(gltf) {
    this.lib = {};
    for (const c of gltf.scene.children) this.lib[c.name] = c;
  }

  piece(name) {
    const src = this.lib[name];
    if (!src) { console.warn('missing piece', name); return new THREE.Group(); }
    const o = src.clone(true);
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0);
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return o;
  }

  // style: 'plaster' | 'brick'. w, d: wall segments (2 m each) along X and Z. floors: 1 or 2.
  house({ w = 2, d = 2, style = 'plaster', floors = 1, door = 0, chimney = true, vines = false } = {}) {
    const g = new THREE.Group();
    const hx = w, hz = d;
    const kind = style === 'brick' ? 'UnevenBrick' : 'Plaster';
    const add = (name, x, y, z, ry = 0) => {
      const p = this.piece(name); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
      if (name.includes('Window')) { const w = this.piece('Window_Wide_Round1'); w.position.set(x, y, z); w.rotation.y = ry; g.add(w); }
      return p;
    };
    for (let f = 0; f < floors; f++) {
      const y = f * WALL_H;
      const plain = f === 0 ? `Wall_${kind}_Straight` : 'Wall_Plaster_WoodGrid';
      const win = `Wall_${kind}_Window_Wide_Round`;
      // Front (+Z): door on the ground floor.
      for (let i = 0; i < w; i++) {
        const x = -hx + 1 + i * 2;
        const isDoor = f === 0 && i === door;
        add(isDoor ? `Wall_${kind}_Door_Round` : (i % 2 ? plain : win), x, y, hz, 0);
        if (isDoor) add('Door_1_Round', x - 0.53, y, hz - 0.05, 0);
      }
      // Back (-Z).
      for (let i = 0; i < w; i++) add(i % 2 ? win : plain, hx - 1 - i * 2, y, -hz, Math.PI);
      // Sides.
      for (let i = 0; i < d; i++) {
        add(i % 2 ? plain : win, hx, y, hz - 1 - i * 2, Math.PI / 2);
        add(i % 2 ? win : plain, -hx, y, -hz + 1 + i * 2, -Math.PI / 2);
      }
      for (const [cx, cz] of [[hx, hz], [-hx, hz], [hx, -hz], [-hx, -hz]]) add(`Corner_Exterior_${style === 'brick' ? 'Brick' : 'Wood'}`, cx, y, cz, Math.atan2(cx, cz) - Math.PI / 4);
    }
    // Dark interior so window glass doesn't show the ground through the house.
    const inner = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 - 0.75, floors * WALL_H - 0.1, hz * 2 - 0.75), new THREE.MeshBasicMaterial({ color: 0x1c140f }));
    inner.position.y = floors * WALL_H / 2; g.add(inner);
    const top = floors * WALL_H;
    add(d >= 3 ? 'Roof_RoundTiles_4x6' : 'Roof_RoundTiles_4x4', 0, top, 0, 0);
    add('Roof_Front_Brick4', 0, top, hz, 0);
    add('Roof_Front_Brick4', 0, top, -hz, Math.PI);
    if (chimney) add('Prop_Chimney', hx - 0.7, top - 0.2, -hz + 1.2, 0);
    if (vines) add('Prop_Vine1', -hx + 1, 0, hz + 0.05, 0);
    g.userData.footprint = { hx: hx + 0.3, hz: hz + 0.3 };
    return g;
  }

  // Wooden plank bridge along +Z, `len` metres long, 4 m wide.
  bridge(len) {
    const g = new THREE.Group();
    const n = Math.ceil(len / 2);
    const planks = [];
    for (let i = 0; i < n; i++) for (const x of [-1, 1]) {
      const p = this.piece('Floor_WoodDark'); p.position.set(x, 0, -len / 2 + 1 + i * 2); g.add(p); planks.push(p);
    }
    for (let i = 0; i < n; i++) for (const x of [-2, 2]) {
      const f = this.piece('Prop_WoodenFence_Single'); f.position.set(x, 0, -len / 2 + 1 + i * 2); f.rotation.y = Math.PI / 2; g.add(f); planks.push(f);
    }
    g.userData.planks = planks;
    return g;
  }
}
