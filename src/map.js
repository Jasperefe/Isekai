// Maps: a top-down picture of the real zone (rendered once from the 3D world), fog of war,
// the full Map screen (zone + World of Aster) and the round minimap on the HUD.
import * as THREE from 'three';
import { sfx } from './audio.js?v=20';

const $ = id => document.getElementById(id);
const FOG_N = 64;          // fog grid cells per side
const REVEAL = 15;         // metres around Jasper that get revealed
const FOG_PX = 256;       // fog picture size (soft edges)
const FOG_ALPHA = 0.86;    // unexplored land still shows a faint silhouette
const BG = '#060914';

// The four zones of Aster, placed on the World map (0..1 of the map box).
export const WORLD_ZONES = [
  { id: 'z1', num: 1, name: 'Starter Meadow', x: 0.27, y: 0.70, color: '#7cc35a' },
  { id: 'z2', num: 2, name: 'Glitchwood Forest', x: 0.31, y: 0.29, color: '#a35ae6' },
  { id: 'z3', num: 3, name: 'Capital of Aster', x: 0.63, y: 0.52, color: '#ffcc4d' },
  { id: 'z4', num: 4, name: 'The Unfinished Zone', x: 0.84, y: 0.24, color: '#ff2bd6' },
];

// Zone progress straight from the save (works for zones that aren't loaded).
export function zoneStatus(profile, id) {
  const z = profile.d.zones[id];
  const reached = id === 'z1' || !!z;
  let cleared = false;
  if (z) cleared = id === 'z1' ? z.stage >= 9 : z.stageId ? z.stageId === 'done' : z.stage >= 5;
  return { reached, cleared };
}

// ---------------------------------------------------------------------------------------------
// ZoneMap: the picture + fog of war for the zone that is loaded.
// ---------------------------------------------------------------------------------------------
export class ZoneMap {
  // core: { renderer, scene, zone, profile, player, hide: () => [objects to hide in the picture] }
  constructor(core) {
    this.c = core;
    const z = core.zone;
    this.id = z.id; this.R = z.map.radius; this.M = this.R + 4;
    this.img = document.createElement('canvas'); this.img.width = this.img.height = 4;
    this.ready = false;
    this.fogC = document.createElement('canvas'); this.fogC.width = this.fogC.height = FOG_PX;
    this.brush = document.createElement('canvas'); const bs = this.brush.width = this.brush.height = Math.ceil(FOG_PX / FOG_N * 4);
    const bg2 = this.brush.getContext('2d'), grd = bg2.createRadialGradient(bs / 2, bs / 2, 0, bs / 2, bs / 2, bs / 2);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.9)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    bg2.fillStyle = grd; bg2.fillRect(0, 0, bs, bs);
    this.fog = new Uint8Array(FOG_N * FOG_N);
    const saved = core.profile.d.mapFog?.[this.id];
    if (saved) this.#decode(saved);
    else if (zoneStatus(core.profile, this.id).cleared) this.fog.fill(1); // already explored before maps existed
    this.#paintFog();
    this.revealT = 0; this.saveT = 0; this.changed = false;
  }

  // ---- Fog of war ----
  cell(x, z) {
    const M = this.M, i = Math.floor((x + M) / (2 * M) * FOG_N), j = Math.floor((z + M) / (2 * M) * FOG_N);
    return i < 0 || j < 0 || i >= FOG_N || j >= FOG_N ? -1 : j * FOG_N + i;
  }
  explored(x, z) { const k = this.cell(x, z); return k >= 0 && this.fog[k] === 1; }
  exploredPct() {
    // Only cells inside the playable circle count.
    let n = 0, on = 0; const M = this.M, R = this.R;
    for (let j = 0; j < FOG_N; j++) for (let i = 0; i < FOG_N; i++) {
      const x = (i + 0.5) / FOG_N * 2 * M - M, z = (j + 0.5) / FOG_N * 2 * M - M;
      if (x * x + z * z > R * R) continue;
      n++; on += this.fog[j * FOG_N + i];
    }
    return n ? Math.round(on / n * 100) : 0;
  }
  reveal(pos) {
    const M = this.M, cs = 2 * M / FOG_N, r = Math.ceil(REVEAL / cs);
    const ci = Math.floor((pos.x + M) / cs), cj = Math.floor((pos.z + M) / cs);
    let changed = false;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || j < 0 || i >= FOG_N || j >= FOG_N) continue;
      const x = (i + 0.5) * cs - M, z = (j + 0.5) * cs - M;
      if ((x - pos.x) ** 2 + (z - pos.z) ** 2 > REVEAL * REVEAL) continue;
      const k = j * FOG_N + i; if (!this.fog[k]) { this.fog[k] = 1; changed = true; this.#punch(i, j); }
    }
    if (changed) this.changed = true;
  }
  revealAll() { this.fog.fill(1); this.#paintFog(); this.changed = true; }
  update(dt, pos) {
    this.revealT -= dt;
    if (this.revealT <= 0) { this.revealT = 0.25; this.reveal(pos); }
    this.saveT -= dt;
    if (this.changed && this.saveT <= 0) {
      this.saveT = 2; this.changed = false;
      (this.c.profile.d.mapFog ||= {})[this.id] = this.#encode(); // written with the next save
    }
  }
  #paintFog() {
    const g = this.fogC.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, FOG_PX, FOG_PX);
    g.fillStyle = BG; g.globalAlpha = FOG_ALPHA; g.fillRect(0, 0, FOG_PX, FOG_PX); g.globalAlpha = 1;
    for (let j = 0; j < FOG_N; j++) for (let i = 0; i < FOG_N; i++) if (this.fog[j * FOG_N + i]) this.#punch(i, j);
  }
  // Clear one explored cell with a soft round brush.
  #punch(i, j) {
    const g = this.fogC.getContext('2d'), cs = FOG_PX / FOG_N, b = this.brush.width;
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(this.brush, (i + 0.5) * cs - b / 2, (j + 0.5) * cs - b / 2);
    g.globalCompositeOperation = 'source-over';
  }
  #encode() {
    let s = '';
    for (let k = 0; k < this.fog.length; k += 4) s += ((this.fog[k] << 3) | (this.fog[k + 1] << 2) | (this.fog[k + 2] << 1) | this.fog[k + 3]).toString(16);
    return s;
  }
  #decode(s) {
    for (let k = 0; k < s.length && k * 4 < this.fog.length; k++) {
      const v = parseInt(s[k], 16) || 0;
      this.fog[k * 4] = (v >> 3) & 1; this.fog[k * 4 + 1] = (v >> 2) & 1; this.fog[k * 4 + 2] = (v >> 1) & 1; this.fog[k * 4 + 3] = v & 1;
    }
  }

  // ---- The picture: the zone seen from straight above, in tiles, drawn into a corner of the
  //      main canvas and copied out (same trick as the dialogue portraits). ----
  capture() {
    const { renderer: r, scene, zone } = this.c;
    const M = this.M, gl = r.domElement, pr = r.getPixelRatio();
    const Tc = Math.floor(Math.min(gl.width, gl.height, 512) / pr), T = Math.floor(Tc * pr);
    if (T < 64) return false;
    const n = Math.max(1, Math.round(1024 / T));
    this.img.width = this.img.height = n * T;
    const g = this.img.getContext('2d');

    // Hide everything that moves, push the fog far away, light the whole zone evenly.
    const hidden = this.c.hide().filter(o => o && o.visible); for (const o of hidden) o.visible = false;
    const fog = scene.fog, fogNF = fog && [fog.near, fog.far]; if (fog) { fog.near = 1e4; fog.far = 2e4; }
    const bg = scene.background; scene.background = new THREE.Color(BG);
    const sun = zone.world.sun; let sv = null;
    if (sun) {
      const sc = sun.shadow.camera;
      sv = { p: sun.position.clone(), t: sun.target.position.clone(), b: [sc.left, sc.right, sc.top, sc.bottom, sc.near, sc.far] };
      // No shadows in the picture: an empty shadow camera far away leaves everything lit.
      Object.assign(sc, { near: 5000, far: 5001 }); sc.updateProjectionMatrix();
    }
    // Shiny water reflects the sun straight up into the camera: make it matte for the picture.
    const water = zone.world.waterMat, wr = water?.roughness; if (water) water.roughness = 0.95;
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 800);
    cam.up.set(0, 0, -1); cam.position.set(0, 300, 0); cam.lookAt(0, 0, 0);
    const vp = r.getViewport(new THREE.Vector4()), scs = r.getScissor(new THREE.Vector4()), st = r.getScissorTest();
    r.setViewport(0, 0, Tc, Tc); r.setScissor(0, 0, Tc, Tc); r.setScissorTest(true);
    const step = 2 * M / n, au = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = true; // one shadow pass for all tiles
    try {
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        cam.left = -M + i * step; cam.right = cam.left + step; cam.top = M - j * step; cam.bottom = cam.top - step;
        cam.updateProjectionMatrix();
        r.render(scene, cam);
        g.drawImage(gl, 0, gl.height - T, T, T, i * T, j * T, T, T);
      }
    } finally {
      r.setScissorTest(st); r.setViewport(vp); r.setScissor(scs);
      r.shadowMap.autoUpdate = au; r.shadowMap.needsUpdate = true;
      for (const o of hidden) o.visible = true;
      if (fog) { fog.near = fogNF[0]; fog.far = fogNF[1]; }
      scene.background = bg;
      if (water) water.roughness = wr;
      if (sun) {
        const sc = sun.shadow.camera;
        [sc.left, sc.right, sc.top, sc.bottom, sc.near, sc.far] = sv.b; sc.updateProjectionMatrix();
      }
    }
    this.#stylize();
    this.ready = true; this.stage = zone.story.stage;
    return true;
  }

  // Brighten dark zones, tint toward the game's cyan, cut to the zone circle, add a survey grid.
  #stylize() {
    const c = this.img, g = c.getContext('2d'), S = c.width, M = this.M, R = this.R;
    const im = g.getImageData(0, 0, S, S), d = im.data, mid = S / 2, rPx = (R + 2) / M * mid;
    let sum = 0, cnt = 0;
    for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) {
      if ((x - mid) ** 2 + (y - mid) ** 2 > rPx * rPx) continue;
      const k = (y * S + x) * 4; sum += 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]; cnt++;
    }
    const gain = Math.min(2.2, Math.max(0.85, 105 / Math.max(1, sum / cnt)));
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = (y * S + x) * 4, rr = Math.hypot(x - mid, y - mid);
      if (rr > rPx + 1.5) { d[k + 3] = 0; continue; }
      let R0 = d[k] * gain, G0 = d[k + 1] * gain, B0 = d[k + 2] * gain;
      const l = 0.3 * R0 + 0.59 * G0 + 0.11 * B0;
      R0 = R0 * 0.86 + l * 0.14 * 0.55; G0 = G0 * 0.86 + l * 0.14 * 1.1; B0 = B0 * 0.86 + l * 0.14 * 1.35;
      const scan = (y & 3) === 0 ? 0.9 : 1;
      d[k] = Math.min(255, R0 * scan); d[k + 1] = Math.min(255, G0 * scan); d[k + 2] = Math.min(255, B0 * scan);
      d[k + 3] = rr > rPx ? Math.round(255 * (rPx + 1.5 - rr) / 1.5) : 255;
    }
    g.putImageData(im, 0, 0);
    // Survey grid every 10 m, clipped to the circle.
    g.save(); g.beginPath(); g.arc(mid, mid, rPx, 0, Math.PI * 2); g.clip();
    g.strokeStyle = 'rgba(41,230,255,0.10)'; g.lineWidth = Math.max(1, S / 1024);
    const px = S / (2 * M);
    for (let v = -Math.floor(M / 10) * 10; v <= M; v += 10) {
      const p = mid + v * px;
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
    }
    const vg = g.createRadialGradient(mid, mid, rPx * 0.7, mid, mid, rPx);
    vg.addColorStop(0, 'rgba(6,9,20,0)'); vg.addColorStop(1, 'rgba(6,9,20,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, S, S);
    g.restore();
  }
}

// ---------------------------------------------------------------------------------------------
// Shared drawing helpers (sizes are in device pixels; u = one CSS pixel).
// ---------------------------------------------------------------------------------------------
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const ICON = {
  crystal(g, x, y, u) {
    g.shadowColor = '#29e6ff'; g.shadowBlur = 6 * u;
    g.fillStyle = '#29e6ff'; g.beginPath(); g.moveTo(x, y - 6 * u); g.lineTo(x + 4 * u, y); g.lineTo(x, y + 6 * u); g.lineTo(x - 4 * u, y); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#d9fbff'; g.beginPath(); g.moveTo(x, y - 6 * u); g.lineTo(x + 1.5 * u, y - 1 * u); g.lineTo(x, y); g.closePath(); g.fill();
  },
  gate(g, x, y, u, color, t) {
    g.shadowColor = color; g.shadowBlur = 8 * u;
    g.strokeStyle = color; g.lineWidth = 2.4 * u; g.beginPath(); g.ellipse(x, y, 5.5 * u, 7 * u, 0, 0, Math.PI * 2); g.stroke();
    g.shadowBlur = 0; g.fillStyle = color + '55'; g.beginPath(); g.ellipse(x, y, 3.5 * u, 5 * u, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.2 * u; g.beginPath(); g.arc(x, y, (2 + (t * 2 % 1) * 3) * u, 0, Math.PI * 2); g.globalAlpha = 1 - (t * 2 % 1); g.stroke(); g.globalAlpha = 1;
  },
  npc(g, x, y, u, color, letter) {
    g.fillStyle = 'rgba(10,14,30,0.92)'; g.strokeStyle = color; g.lineWidth = 2 * u;
    g.beginPath(); g.arc(x, y, 7 * u, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = color; g.font = `900 ${8 * u}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, x, y + 0.5 * u);
  },
  lair(g, x, y, u, state) {
    const col = state === 'defeated' ? '#6f7894' : state === 'locked' ? '#ff5d7a' : '#ff2b55';
    if (state === 'open') { g.shadowColor = '#ff2b55'; g.shadowBlur = 10 * u; }
    g.fillStyle = 'rgba(10,14,30,0.92)'; g.strokeStyle = col; g.lineWidth = 2 * u;
    g.beginPath(); g.arc(x, y, 10 * u, 0, Math.PI * 2); g.fill(); g.stroke(); g.shadowBlur = 0;
    // Skull.
    g.fillStyle = col; g.beginPath(); g.arc(x, y - 1.5 * u, 4.6 * u, 0, Math.PI * 2); g.fill();
    g.fillRect(x - 2.8 * u, y + 1.5 * u, 5.6 * u, 3.4 * u);
    g.fillStyle = 'rgba(10,14,30,1)';
    g.beginPath(); g.arc(x - 1.8 * u, y - 1.4 * u, 1.3 * u, 0, Math.PI * 2); g.arc(x + 1.8 * u, y - 1.4 * u, 1.3 * u, 0, Math.PI * 2); g.fill();
    g.fillRect(x - 0.5 * u, y + 2.2 * u, 1 * u, 2.7 * u);
    if (state === 'locked') {
      // Padlock badge.
      const bx = x + 7.5 * u, by = y + 6.5 * u;
      g.strokeStyle = '#ffcc4d'; g.lineWidth = 1.6 * u; g.beginPath(); g.arc(bx, by - 2 * u, 2.4 * u, Math.PI, 0); g.stroke();
      g.fillStyle = '#ffcc4d'; rrect(g, bx - 3.6 * u, by - 2 * u, 7.2 * u, 5.6 * u, 1.2 * u); g.fill();
    }
    if (state === 'defeated') {
      g.strokeStyle = '#7dff9a'; g.lineWidth = 2.2 * u; g.beginPath(); g.moveTo(x + 4 * u, y + 7 * u); g.lineTo(x + 6.5 * u, y + 9.5 * u); g.lineTo(x + 11 * u, y + 4 * u); g.stroke();
    }
  },
  chest(g, x, y, u, opened) {
    const col = opened ? '#7a6248' : '#ffcc4d';
    if (!opened) { g.shadowColor = '#ffcc4d'; g.shadowBlur = 6 * u; }
    g.fillStyle = 'rgba(10,14,30,0.85)'; rrect(g, x - 6 * u, y - 5 * u, 12 * u, 10 * u, 2 * u); g.fill(); g.shadowBlur = 0;
    g.fillStyle = col; rrect(g, x - 4.5 * u, y - 3 * u, 9 * u, 6.5 * u, 1.2 * u); g.fill();
    g.fillStyle = 'rgba(10,14,30,0.8)'; g.fillRect(x - 4.5 * u, y - 0.6 * u, 9 * u, 1.1 * u); g.fillRect(x - 0.8 * u, y - 1.2 * u, 1.6 * u, 2.4 * u);
  },
  enemy(g, x, y, u) {
    g.fillStyle = '#ff3b5c'; g.strokeStyle = 'rgba(10,14,30,0.9)'; g.lineWidth = 1.2 * u;
    g.beginPath(); g.arc(x, y, 3 * u, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  jasper(g, x, y, u, ang, t) {
    g.strokeStyle = 'rgba(41,230,255,' + (0.6 * (1 - (t % 1.2) / 1.2)) + ')'; g.lineWidth = 1.5 * u;
    g.beginPath(); g.arc(x, y, (6 + (t % 1.2) / 1.2 * 10) * u, 0, Math.PI * 2); g.stroke();
    g.save(); g.translate(x, y); g.rotate(ang);
    g.shadowColor = '#29e6ff'; g.shadowBlur = 8 * u;
    g.fillStyle = '#fff'; g.strokeStyle = '#0b1530'; g.lineWidth = 1.5 * u;
    g.beginPath(); g.moveTo(0, -9 * u); g.lineTo(6.5 * u, 7 * u); g.lineTo(0, 3.5 * u); g.lineTo(-6.5 * u, 7 * u); g.closePath(); g.fill(); g.shadowBlur = 0; g.stroke();
    g.restore();
  },
  objective(g, x, y, u, t) {
    const p = (Math.sin(t * 4) + 1) / 2;
    g.strokeStyle = '#ffcc4d'; g.lineWidth = 2.5 * u; g.shadowColor = '#ffcc4d'; g.shadowBlur = 8 * u;
    g.beginPath(); g.arc(x, y, (7 + p * 2) * u, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#ffcc4d'; g.beginPath(); g.arc(x, y, 2.5 * u, 0, Math.PI * 2); g.fill();
  },
};

// ---------------------------------------------------------------------------------------------
// MapView: the MAP tab (zone map with pan/zoom, and the World map of Aster).
// ---------------------------------------------------------------------------------------------
export class MapView {
  // core: { zmap, zone, player, profile, travel, menu }
  constructor(core) {
    this.c = core; this.cv = $('mapcv'); this.g = this.cv.getContext('2d');
    this.mode = 'zone'; this.zoom = 1; this.cx = 0; this.cz = 0; this.on = false;
    this.ptrs = new Map(); this.t = 0;
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.tap = this.ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    });
    cv.addEventListener('pointermove', e => {
      const p = this.ptrs.get(e.pointerId); if (!p) return;
      const prev = [...this.ptrs.values()].map(q => ({ ...q }));
      p.x = e.clientX; p.y = e.clientY;
      if (this.tap && Math.hypot(e.clientX - this.tap.x, e.clientY - this.tap.y) > 8) this.tap = null;
      if (this.mode !== 'zone') return;
      const s = this.scale() / devicePixelRatio;
      if (this.ptrs.size === 1) { this.cx -= (p.x - prev[0].x) / s; this.cz -= (p.y - prev[0].y) / s; }
      else if (this.ptrs.size === 2) {
        const now = [...this.ptrs.values()];
        const d0 = Math.hypot(prev[0].x - prev[1].x, prev[0].y - prev[1].y), d1 = Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y);
        if (d0 > 10) this.setZoom(this.zoom * d1 / d0);
        this.cx -= ((now[0].x + now[1].x) - (prev[0].x + prev[1].x)) / 2 / s; this.cz -= ((now[0].y + now[1].y) - (prev[0].y + prev[1].y)) / 2 / s;
      }
      this.clamp();
    });
    const up = e => {
      this.ptrs.delete(e.pointerId);
      if (this.tap && performance.now() - this.tap.t < 400) this.#tapAt(e);
      this.tap = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { this.ptrs.delete(e.pointerId); this.tap = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); if (this.mode === 'zone') { this.setZoom(this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); this.clamp(); } }, { passive: false });
    $('map-zin').addEventListener('click', () => { sfx('click'); this.setZoom(this.zoom * 1.4); this.clamp(); });
    $('map-zout').addEventListener('click', () => { sfx('click'); this.setZoom(this.zoom / 1.4); this.clamp(); });
    $('map-me').addEventListener('click', () => { sfx('click'); this.centerOnJasper(); });
    for (const b of document.querySelectorAll('#map-mode button')) b.addEventListener('click', () => { sfx('click'); this.setMode(b.dataset.mm); });
  }

  setZoom(z) { this.zoom = Math.min(5, Math.max(1, z)); }
  clamp() { const lim = this.c.zmap.R * (1 - 1 / this.zoom); this.cx = Math.max(-lim, Math.min(lim, this.cx)); this.cz = Math.max(-lim, Math.min(lim, this.cz)); }
  centerOnJasper() { if (this.zoom < 2.2) this.zoom = 2.2; this.cx = this.c.player.pos.x; this.cz = this.c.player.pos.z; this.clamp(); }
  scale() { return Math.min(this.W, this.H) / (2 * this.c.zmap.R + 12) * this.zoom; }

  setMode(m) {
    this.mode = m;
    for (const b of document.querySelectorAll('#map-mode button')) b.classList.toggle('on', b.dataset.mm === m);
    $('mapwrap').classList.toggle('world', m === 'world');
    this.#side();
  }

  open() {
    if (!this.c.zmap.ready) this.c.zmap.wantCapture = true;
    else if (this.c.zmap.stage !== this.c.zone.story.stage) this.c.zmap.wantCapture = true; // the zone changed (bridge fixed...)
    if (!this.opened) { this.opened = true; this.zoom = 1.5; this.cx = this.c.player.pos.x; this.cz = this.c.player.pos.z; this.clamp(); }
    this.on = true; this.setMode(this.mode);
    const loop = now => {
      if (!this.on) return;
      this.t = now / 1000; this.draw(); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  close() { this.on = false; }

  #fit() {
    const cv = this.cv, r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2.5);
    const w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    this.W = w; this.H = h; this.u = dpr;
  }

  draw() {
    this.#fit();
    if (this.mode === 'world') return this.#drawWorld();
    const g = this.g, { W, H, u, t } = this, zm = this.c.zmap, zone = this.c.zone, m = zone.map, R = zm.R, M = zm.M;
    const s = this.scale();
    const toS = (x, z) => [W / 2 + (x - this.cx) * s, H / 2 + (z - this.cz) * s];
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.shadowBlur = 0;
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    // Faint dotted backdrop.
    g.fillStyle = 'rgba(41,230,255,0.07)';
    const gs = 22 * u; for (let y = (H / 2) % gs; y < H; y += gs) for (let x = (W / 2) % gs; x < W; x += gs) g.fillRect(x, y, 1.2 * u, 1.2 * u);
    const [ax, ay] = toS(-M, -M);
    if (zm.ready) g.drawImage(zm.img, ax, ay, 2 * M * s, 2 * M * s);
    else { g.fillStyle = '#9fb0d0'; g.font = `700 ${12 * u}px system-ui`; g.textAlign = 'center'; g.fillText('Scanning zone...', W / 2, H / 2); }
    g.imageSmoothingEnabled = true; g.drawImage(zm.fogC, ax, ay, 2 * M * s, 2 * M * s);
    // Zone border.
    const [ox, oy] = toS(0, 0);
    g.strokeStyle = 'rgba(41,230,255,0.55)'; g.lineWidth = 1.5 * u; g.shadowColor = '#29e6ff'; g.shadowBlur = 10 * u;
    g.beginPath(); g.arc(ox, oy, (R + 2) * s, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;

    const labels = [], boxes = [];
    // Keep name tags off the on-map buttons.
    const cr = this.cv.getBoundingClientRect();
    for (const id of ['map-mode', 'map-zin', 'map-zout', 'map-me']) {
      const b = $(id).getBoundingClientRect();
      boxes.push({ x: (b.left - cr.left - 4) * u, y: (b.top - cr.top - 4) * u, w: (b.width + 8) * u, h: (b.height + 8) * u });
    }
    const ex = p => zm.explored(p.x, p.z);
    // Areas: a dashed outline once explored.
    for (const pl of m.places) {
      const [x, y] = toS(pl.p.x, pl.p.z), known = ex(pl.p);
      if (known && pl.r > 4) {
        g.setLineDash([5 * u, 5 * u]); g.lineDashOffset = -t * 6 * u; g.strokeStyle = pl.color + 'bb'; g.lineWidth = 1.6 * u;
        g.beginPath(); g.arc(x, y, pl.r * s, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      }
      labels.push({ text: known ? pl.name : '? ? ?', x, y, off: known && pl.r > 4 ? Math.min(pl.r * s, 26 * u) : 10 * u, color: known ? pl.color : '#55607a', prio: 2, dim: !known });
    }
    // Route to the objective.
    const P = this.c.player.pos, [px, py] = toS(P.x, P.z);
    const obj = m.objective();
    if (obj) {
      const [qx, qy] = toS(obj.x, obj.z);
      g.setLineDash([2 * u, 6 * u]); g.lineDashOffset = -t * 20 * u; g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,204,77,0.85)'; g.lineWidth = 2.5 * u;
      g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke(); g.setLineDash([]); g.lineCap = 'butt';
    }
    // Icons.
    const lock = m.lock();
    const lair = m.lair; if (lair && ex(lair)) { const [x, y] = toS(lair.x, lair.z); ICON.lair(g, x, y, u, lock.state); boxes.push(box(x, y, 12 * u)); }
    for (const c of m.chests()) if (ex(c.p)) { const [x, y] = toS(c.p.x, c.p.z); ICON.chest(g, x, y, u, c.opened); boxes.push(box(x, y, 7 * u)); }
    for (const c of m.crystals()) if (ex(c)) { const [x, y] = toS(c.x, c.z); ICON.crystal(g, x, y, u); boxes.push(box(x, y, 6 * u)); }
    for (const gt of m.gates) if (ex(gt.p)) {
      const [x, y] = toS(gt.p.x, gt.p.z); ICON.gate(g, x, y, u, gt.color, t); boxes.push(box(x, y, 8 * u));
      labels.push({ text: gt.name, x, y, off: 10 * u, color: gt.color, prio: 1 });
    }
    for (const n of zone.npcs) if (ex(n.pos)) {
      const [x, y] = toS(n.pos.x, n.pos.z); ICON.npc(g, x, y, u, n.opts.color || '#fff', n.name[0]); boxes.push(box(x, y, 8 * u));
      labels.push({ text: n.name[0] + n.name.slice(1).toLowerCase(), x, y, off: 9 * u, color: n.opts.color || '#fff', prio: 3, small: true });
    }
    for (const e of zone.enemies) if (e.alive && !e.isBoss && ex(e.pos)) { const [x, y] = toS(e.pos.x, e.pos.z); ICON.enemy(g, x, y, u); }
    if (obj) { const [qx, qy] = toS(obj.x, obj.z); ICON.objective(g, qx, qy, u, t); boxes.push(box(qx, qy, 10 * u)); }
    ICON.jasper(g, px, py, u, -this.c.player.facing + Math.PI, t); boxes.push(box(px, py, 10 * u));
    placeLabels(g, labels.sort((a, b) => a.prio - b.prio), boxes, u, W, H);
  }

  #drawWorld() {
    const g = this.g, { W, H, u, t } = this, prof = this.c.profile;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.shadowBlur = 0;
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    const pad = 10 * u, bw = W - pad * 2, bh = H - pad * 2;
    const P = (x, y) => [pad + x * bw, pad + y * bh];
    // Sea grid.
    g.strokeStyle = 'rgba(41,230,255,0.06)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 26 * u) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 26 * u) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // The continent: a fixed wobbly outline, drawn as contour rings.
    const coast = k => {
      g.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = i / 72 * Math.PI * 2;
        const w = 1 + 0.07 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7 + 2) + 0.025 * Math.sin(a * 13);
        const x = 0.53 + Math.cos(a) * 0.45 * w * k, y = 0.5 + Math.sin(a) * 0.44 * w * k;
        const [sx, sy] = P(x, y); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy);
      }
      g.closePath();
    };
    coast(1); g.fillStyle = '#0e1a26'; g.fill();
    g.save(); coast(1); g.clip();
    for (const z of WORLD_ZONES) {
      const [x, y] = P(z.x, z.y), rg = g.createRadialGradient(x, y, 0, x, y, Math.min(bw, bh) * 0.36);
      rg.addColorStop(0, z.color + '40'); rg.addColorStop(1, z.color + '00');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    // The Unfinished Zone: missing pixels.
    const [ux, uy] = P(0.86, 0.22);
    for (let i = 0; i < 40; i++) {
      const sx = ux + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 70 * u, sy = uy + (Math.sin(i * 78.233) * 12345.678 % 1) * 50 * u, sz = (6 + (i % 3) * 4) * u;
      g.fillStyle = i % 5 === 0 ? 'rgba(255,43,214,0.35)' : BG; g.fillRect(sx, sy, sz, sz);
    }
    g.restore();
    for (const k of [0.94, 0.86, 0.76]) { coast(k); g.strokeStyle = 'rgba(41,230,255,0.08)'; g.lineWidth = 1 * u; g.stroke(); }
    coast(1); g.strokeStyle = 'rgba(41,230,255,0.5)'; g.lineWidth = 1.5 * u; g.shadowColor = '#29e6ff'; g.shadowBlur = 8 * u; g.stroke(); g.shadowBlur = 0;
    // Roads between zones.
    g.setLineDash([3 * u, 6 * u]); g.lineCap = 'round'; g.lineWidth = 2 * u;
    for (let i = 0; i < WORLD_ZONES.length - 1; i++) {
      const a = WORLD_ZONES[i], b = WORLD_ZONES[i + 1], open = zoneStatus(prof, b.id).reached;
      const [x1, y1] = P(a.x, a.y), [x2, y2] = P(b.x, b.y);
      g.strokeStyle = open ? 'rgba(232,240,255,0.65)' : 'rgba(120,130,160,0.35)';
      g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2 + (y2 - y1) * 0.15, (y1 + y2) / 2 - (x2 - x1) * 0.15, x2, y2); g.stroke();
    }
    g.setLineDash([]); g.lineCap = 'butt';
    // Zone nodes.
    this.nodes = [];
    for (const z of WORLD_ZONES) {
      const [x, y] = P(z.x, z.y), st = zoneStatus(prof, z.id), here = this.c.zone.id === z.id, r = 15 * u;
      this.nodes.push({ z, x, y, r: r * 1.8, st, here });
      g.fillStyle = 'rgba(10,14,30,0.95)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      if (!st.reached) {
        // Static.
        g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
        for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${150 + (i * 37 + (t * 60 | 0) * 13) % 100},${120 + (i * 53) % 80},${170 + (i * 29) % 80},0.55)`; g.fillRect(x - r + ((i * 7 + (t * 47 | 0) * 11) % 30) / 30 * 2 * r, y - r + ((i * 13 + (t * 31 | 0) * 5) % 30) / 30 * 2 * r, 3 * u, 2 * u); }
        g.restore();
        g.strokeStyle = '#5a6280'; g.lineWidth = 2 * u; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#c8cfe6'; g.lineWidth = 1.8 * u; g.beginPath(); g.arc(x, y - 2 * u, 3.6 * u, Math.PI, 0); g.stroke();
        g.fillStyle = '#c8cfe6'; rrect(g, x - 5 * u, y - 2 * u, 10 * u, 8 * u, 1.5 * u); g.fill();
      } else {
        g.shadowColor = z.color; g.shadowBlur = (here ? 16 : 8) * u;
        g.strokeStyle = z.color; g.lineWidth = 3 * u; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
        g.fillStyle = z.color; g.font = `900 ${13 * u}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(z.num), x, y + 0.5 * u);
        if (st.cleared) {
          g.fillStyle = '#7dff9a'; g.beginPath(); g.arc(x + r * 0.75, y - r * 0.75, 6 * u, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#0a1a10'; g.lineWidth = 1.8 * u; g.beginPath(); g.moveTo(x + r * 0.75 - 3 * u, y - r * 0.75); g.lineTo(x + r * 0.75 - 0.8 * u, y - r * 0.75 + 2.4 * u); g.lineTo(x + r * 0.75 + 3.2 * u, y - r * 0.75 - 2.4 * u); g.stroke();
        }
        if (here) {
          const k = (t % 1.4) / 1.4; g.strokeStyle = `rgba(41,230,255,${1 - k})`; g.lineWidth = 2 * u;
          g.beginPath(); g.arc(x, y, r + k * 14 * u, 0, Math.PI * 2); g.stroke();
        }
      }
      // Name tag below.
      g.font = `800 ${11 * u}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const name = st.reached ? z.name : z.id === 'z4' ? '? ? ?' : z.name, sub = here ? 'YOU ARE HERE' : !st.reached ? 'LOCKED' : st.cleared ? 'CLEARED' : 'IN PROGRESS';
      const tw = Math.max(g.measureText(name).width, 60 * u) + 16 * u;
      g.fillStyle = 'rgba(6,10,24,0.85)'; rrect(g, x - tw / 2, y + r + 5 * u, tw, 30 * u, 7 * u); g.fill();
      g.fillStyle = st.reached ? '#fff' : '#8a93b0'; g.fillText(name, x, y + r + 18 * u);
      g.font = `900 ${8.5 * u}px system-ui, sans-serif`; g.fillStyle = here ? '#29e6ff' : st.reached ? (st.cleared ? '#7dff9a' : '#ffcc4d') : '#5a6280';
      g.fillText(sub, x, y + r + 30 * u);
    }
  }

  #tapAt(e) {
    if (this.mode !== 'world' || !this.nodes) return;
    const r = this.cv.getBoundingClientRect(), x = (e.clientX - r.left) * this.u, y = (e.clientY - r.top) * this.u;
    const n = this.nodes.find(n => Math.hypot(n.x - x, n.y - y) < n.r); if (!n) return;
    const msg = $('map-msg');
    if (n.here) { sfx('click'); this.setMode('zone'); return; }
    if (!n.st.reached) { sfx('error'); msg.textContent = `${n.z.id === 'z4' ? 'This zone' : n.z.name} is locked. Keep following the story.`; return; }
    if (this.c.zone.story.id === 'boss') { sfx('error'); msg.textContent = "You can't leave during a boss fight!"; return; }
    sfx('click');
    if (confirm(`Travel to ${n.z.name}? Your progress is saved.`)) { this.c.menu.hide(); this.c.travel(n.z.id); }
  }

  // Right-hand panel: what this zone still holds, or the zone list for the World map.
  #side() {
    const el = $('mapside'), zone = this.c.zone, m = zone.map, zm = this.c.zmap, prof = this.c.profile;
    if (this.mode === 'world') {
      el.innerHTML = `<small class="ms-kick">THE WORLD OF</small><h4>ASTER</h4>
        <div class="ms-list">${WORLD_ZONES.map(z => {
          const st = zoneStatus(prof, z.id), here = zone.id === z.id;
          return `<div class="ms-zone ${st.reached ? '' : 'locked'}" style="--c:${z.color}"><b>${z.num}</b><span>${st.reached || z.id !== 'z4' ? z.name : '? ? ?'}</span><em class="${here ? 'here' : st.cleared ? 'ok' : st.reached ? 'go' : ''}">${here ? 'HERE' : st.cleared ? 'CLEARED' : st.reached ? 'OPEN' : 'LOCKED'}</em></div>`;
        }).join('')}</div>
        <p class="ms-note" id="map-msg">Tap a zone you've reached to travel there.</p>`;
      return;
    }
    const lock = m.lock(), chests = m.chests(), opened = chests.filter(c => c.opened).length;
    const qt = $('quest-title')?.textContent || '', qx = $('quest-text')?.childNodes[0]?.textContent || $('quest-text')?.textContent || '';
    const lockLine = lock.state === 'defeated' ? '<em class="ok">DEFEATED</em>' : lock.state === 'open' ? '<em class="go">OPEN</em>' : lock.left ? `<em class="bad">${lock.left} enem${lock.left === 1 ? 'y' : 'ies'} left</em>` : '<em class="bad">LOCKED</em>';
    el.innerHTML = `<small class="ms-kick">ZONE ${zone.id.slice(1)}</small><h4>${zone.name}</h4>
      ${qt ? `<div class="ms-obj"><small>OBJECTIVE</small><b>${qt}</b><span>${qx}</span></div>` : ''}
      <div class="ms-rows">
        <div><i class="lg lair"></i>Boss lair ${lockLine}</div>
        <div><i class="lg chest"></i>Chests <em>${opened} / ${chests.length}</em></div>
        <div><i class="lg fog"></i>Explored <em id="ms-pct">${zm.exploredPct()}%</em></div>
      </div>
      <div class="ms-legend"><span><i class="lg me"></i>Jasper</span><span><i class="lg obj"></i>Objective</span><span><i class="lg cry"></i>Save</span><span><i class="lg foe"></i>Enemy</span><span><i class="lg gate"></i>Gate</span></div>`;
  }
}
const box = (x, y, r) => ({ x: x - r, y: y - r, w: r * 2, h: r * 2 });
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Name tags placed above/below/beside their spot without covering icons or each other.
function placeLabels(g, labels, boxes, u, W, H) {
  const taken = [...boxes];
  for (const L of labels) {
    const fs = (L.small ? 10 : 11) * u;
    g.font = `800 ${fs}px system-ui, sans-serif`;
    const w = g.measureText(L.text).width + 14 * u, h = fs + 9 * u, o = L.off;
    const tries = [[-w / 2, -o - h - 2 * u], [-w / 2, o + 2 * u], [o + 3 * u, -h / 2], [-o - w - 3 * u, -h / 2]];
    let pick = null;
    for (const [dx, dy] of tries) {
      const b = { x: L.x + dx, y: L.y + dy, w, h };
      if (b.x < 2 || b.y < 2 || b.x + w > W - 2 || b.y + h > H - 2) continue;
      if (!taken.some(t => hit(b, t))) { pick = b; break; }
    }
    if (!pick) continue;
    taken.push(pick);
    g.globalAlpha = L.dim ? 0.75 : 1;
    g.fillStyle = 'rgba(6,10,24,0.86)'; rrect(g, pick.x, pick.y, w, h, 5 * u); g.fill();
    g.fillStyle = L.color; rrect(g, pick.x, pick.y, 3 * u, h, 1.5 * u); g.fill();
    g.fillStyle = L.dim ? '#8a93b0' : '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(L.text, pick.x + 8 * u, pick.y + h / 2 + 0.5 * u);
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Minimap: a small round map on the HUD that turns with the camera. Tap it to open the Map.
// ---------------------------------------------------------------------------------------------
const VIEW = 30; // metres from the centre to the rim
export class Minimap {
  constructor(core) { // { zmap, zone, player, rig, onTap }
    this.c = core; this.el = $('minimap'); this.cv = this.el.querySelector('canvas'); this.g = this.cv.getContext('2d');
    this.el.addEventListener('click', () => { sfx('click'); core.onTap(); });
    this.t = 0; this.acc = 0;
    let on = true; try { on = localStorage.getItem('isekai_minimap') !== '0'; } catch (e) { /* ignore */ }
    this.setOn(on);
  }
  setOn(on) {
    this.on = on; this.el.classList.toggle('hidden', !on); document.body.classList.toggle('mm-off', !on);
    try { localStorage.setItem('isekai_minimap', on ? '1' : '0'); } catch (e) { /* ignore */ }
  }
  // Shrink the minimap if it would touch the Jump button (short screens, Safari bars).
  layout() {
    if (!this.on) return;
    const jump = $('btn-jump'), jr = jump?.getBoundingClientRect();
    if (!jr || !jr.height) return;
    const mr = this.el.getBoundingClientRect(), top = mr.top || 8;
    let size = 84;
    if (jr.right > mr.left - 4 && jr.left < mr.left + 92) size = Math.max(52, Math.min(84, Math.floor(jr.top - top - 8)));
    if (size !== this.size) { this.size = size; document.documentElement.style.setProperty('--mm', size + 'px'); }
  }
  update(dt) {
    this.t += dt; this.acc += dt;
    this.layoutT = (this.layoutT || 0) - dt;
    if (this.layoutT <= 0) { this.layoutT = 1; this.layout(); }
    if (!this.on || this.acc < 1 / 15) return;
    this.acc = 0; this.draw();
  }
  draw() {
    const cv = this.cv, dpr = Math.min(devicePixelRatio || 1, 2.5), css = this.el.clientWidth || 96, S = Math.round(css * dpr);
    if (cv.width !== S) { cv.width = cv.height = S; }
    const g = this.g, u = dpr, zm = this.c.zmap, zone = this.c.zone, m = zone.map, P = this.c.player.pos, yaw = this.c.rig.yaw;
    const c = S / 2, rad = c - 2 * u, s = rad / VIEW, M = zm.M, cos = Math.cos(yaw), sin = Math.sin(yaw);
    const toS = (x, z) => { const dx = (x - P.x) * s, dz = (z - P.z) * s; return [c + dx * cos - dz * sin, c + dx * sin + dz * cos]; };
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S); g.shadowBlur = 0;
    g.save(); g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.clip();
    g.fillStyle = BG; g.fillRect(0, 0, S, S);
    g.save(); g.translate(c, c); g.rotate(yaw); g.scale(s, s); g.translate(-P.x, -P.z);
    if (zm.ready) g.drawImage(zm.img, -M, -M, 2 * M, 2 * M);
    g.imageSmoothingEnabled = true; g.drawImage(zm.fogC, -M, -M, 2 * M, 2 * M);
    g.restore();
    const inView = p => Math.hypot(p.x - P.x, p.z - P.z) < VIEW - 2;
    const lock = m.lock();
    if (m.lair && inView(m.lair) && zm.explored(m.lair.x, m.lair.z)) { const [x, y] = toS(m.lair.x, m.lair.z); ICON.lair(g, x, y, u * 0.8, lock.state); }
    for (const cr of m.crystals()) if (inView(cr)) { const [x, y] = toS(cr.x, cr.z); ICON.crystal(g, x, y, u * 0.85); }
    for (const gt of m.gates) if (inView(gt.p)) { const [x, y] = toS(gt.p.x, gt.p.z); ICON.gate(g, x, y, u * 0.8, gt.color, this.t); }
    for (const ch of m.chests()) if (!ch.opened && inView(ch.p) && zm.explored(ch.p.x, ch.p.z)) { const [x, y] = toS(ch.p.x, ch.p.z); ICON.chest(g, x, y, u * 0.75, false); }
    for (const n of zone.npcs) if (inView(n.pos)) { const [x, y] = toS(n.pos.x, n.pos.z); g.fillStyle = n.opts.color || '#fff'; g.strokeStyle = '#0a0e1e'; g.lineWidth = 1.2 * u; g.beginPath(); g.arc(x, y, 3.6 * u, 0, Math.PI * 2); g.fill(); g.stroke(); }
    for (const e of zone.enemies) if (e.alive && inView(e.pos)) { const [x, y] = toS(e.pos.x, e.pos.z); if (e.isBoss) { g.fillStyle = '#ff2b55'; g.beginPath(); g.arc(x, y, 5 * u, 0, Math.PI * 2); g.fill(); } else ICON.enemy(g, x, y, u * 0.85); }
    g.restore();
    // Objective: a dot inside the circle, or an arrow on the rim pointing at it.
    const obj = m.objective();
    if (obj) {
      const [x, y] = toS(obj.x, obj.z), dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
      if (d < rad - 6 * u) ICON.objective(g, x, y, u * 0.75, this.t);
      else {
        const a = Math.atan2(dy, dx), ex = c + Math.cos(a) * (rad - 6 * u), ey = c + Math.sin(a) * (rad - 6 * u);
        g.save(); g.translate(ex, ey); g.rotate(a + Math.PI / 2);
        g.fillStyle = '#ffcc4d'; g.shadowColor = '#ffcc4d'; g.shadowBlur = 6 * u; g.strokeStyle = '#0a0e1e'; g.lineWidth = 1.2 * u;
        g.beginPath(); g.moveTo(0, -6 * u); g.lineTo(5 * u, 4 * u); g.lineTo(-5 * u, 4 * u); g.closePath(); g.fill(); g.shadowBlur = 0; g.stroke();
        g.restore();
      }
    }
    // Rim, north marker, Jasper.
    g.strokeStyle = 'rgba(41,230,255,0.7)'; g.lineWidth = 2 * u; g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.stroke();
    const nx = c + Math.sin(yaw) * (rad - 7 * u), ny = c - Math.cos(yaw) * (rad - 7 * u);
    g.fillStyle = '#ff5d7a'; g.beginPath(); g.arc(nx, ny, 6.5 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = `900 ${8 * u}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny + 0.5 * u);
    ICON.jasper(g, c, c, u * 0.8, -this.c.player.facing + Math.PI + yaw, this.t);
  }
}
