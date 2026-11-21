// ISEKAI game core: renderer, camera, player, HUD, menus. Zones load from zone1.js / zone2.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Input, isTouch } from './input.js?v=12';
import { buildCharacter, captureGrip } from './characters.js?v=12';
import { Player } from './player.js?v=12';
import { Guide } from './guide.js?v=12';
import { Dialogue } from './dialogue.js?v=12';
import { Effects } from './effects.js?v=12';
import { Hud } from './hud.js?v=12';
import { Profile } from './profile.js?v=12';
import { Loot } from './loot.js?v=12';
import { Menu } from './menu.js?v=12';
import { Console } from './console.js?v=12';
import { Pet } from './pet.js?v=12';
import * as Zone1 from './zone1.js?v=12';
import * as Zone2 from './zone2.js?v=12';

// Zone registry. Each zone is loaded on its own page load (gates save and reload).
const ZONES = { z1: Zone1, z2: Zone2 };
const ZONE_NAMES = { z1: 'Starter Meadow', z2: 'Glitchwood Forest' };

const quality = isTouch
  ? { pixelRatio: Math.min(devicePixelRatio, 1.5), shadows: true, shadowSize: 1024, dense: false }
  : { pixelRatio: Math.min(devicePixelRatio, 2), shadows: true, shadowSize: 2048, dense: true };

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Third-person orbit camera with smoothing and screen shake.
class CameraRig {
  constructor(cam, world) { this.cam = cam; this.world = world; this.yaw = 0; this.pitch = 0.32; this.dist = isTouch ? 6.2 : 5.6; this.shakeT = 0; this.target = new THREE.Vector3(); this.zoom = 1; }
  shake(a) { this.shakeT = Math.max(this.shakeT, a); }
  update(dt, input, focus, wantZoom = 1, talk = null) {
    this.yaw -= input.look.dx; this.pitch = THREE.MathUtils.clamp(this.pitch + input.look.dy, -0.15, 1.05);
    if (talk) {
      // Conversation shot: look across both speakers from the side.
      const mid = focus.clone().lerp(talk, 0.5);
      const side = Math.atan2(talk.x - focus.x, talk.z - focus.z) + Math.PI / 2;
      let d = side - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > Math.PI / 2) d = Math.atan2(Math.sin(d + Math.PI), Math.cos(d + Math.PI)); // pick the nearer side
      this.yaw += d * Math.min(1, dt * 4); this.pitch += (0.18 - this.pitch) * Math.min(1, dt * 4);
      focus = mid; wantZoom = 0.8;
    }
    this.zoom += (wantZoom - this.zoom) * Math.min(1, dt * 2);
    this.target.lerp(focus.clone().add(new THREE.Vector3(0, 1.5, 0)), 1 - Math.pow(0.0001, dt));
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.dist * this.zoom);
    // Pull the camera in if a building sits between it and Jasper.
    let k = 1;
    for (let i = 1; i <= 12; i++) {
      const f = i / 12, q = this.target.clone().addScaledVector(off, f);
      if (this.world.insideBuilding(q.x, q.y, q.z)) { k = Math.max(0.25, (i - 1.5) / 12); break; }
    }
    this.camK = (this.camK ?? 1) + (k - (this.camK ?? 1)) * Math.min(1, dt * (k < (this.camK ?? 1) ? 20 : 3));
    const p = this.target.clone().addScaledVector(off, this.camK);
    p.y = Math.max(p.y, this.world.groundAt(p.x, p.z) + 0.4);
    this.cam.position.copy(p);
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const s = this.shakeT * 0.6;
      this.cam.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    }
    this.cam.lookAt(this.target);
  }
}

// Input stand-in used while dialogue/cutscenes are on screen.
const NO_INPUT = { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, sprint: false, blocking: false, consume: () => false };

const loadFill = document.getElementById('load-fill');
const loadText = document.getElementById('load-text');
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => { loadFill.style.width = (loaded / total * 100) + '%'; };
const loader = new GLTFLoader(manager);
loader.setMeshoptDecoder(MeshoptDecoder);

async function boot() {
  const [jasperG, a1, a2, propsG] = await Promise.all(['jasper', 'anims1', 'anims2', 'props'].map(f => loader.loadAsync(`assets/models/${f}.glb`)));
  const clips = [...a1.animations, ...a2.animations];
  const idle = clips.find(c => c.name === 'Idle_Loop');

  const profile = Profile.load();
  if (profile.d.zone !== 'z1' && ZONES[profile.d.zone]) loadText.textContent = `Entering ${ZONE_NAMES[profile.d.zone]}...`;
  const effects = new Effects(scene);
  const rig = new CameraRig(camera, null);
  const hud = new Hud(camera);
  let hitStop = 0, zone = null, paused = false;
  // Shared context used by the player; zone-specific parts are filled in when a zone loads.
  const ctx = {
    effects, hud, camera: rig, scene, profile,
    enemies: [], npcs: [], world: null,
    hitStop: t => { hitStop = Math.max(hitStop, t); },
    onKill: e => { profile.d.totals.kills++; loot.enemyDrop(e); zone?.onKill(e); },
    respawnPoint: () => zone.respawnPoint(),
  };
  Object.defineProperty(ctx, 'patchables', { get: () => zone?.story.ctx.patchables || [] });
  const jasper = buildCharacter(jasperG, 'jasper', idle);
  jasper.grip = captureGrip(jasper.root, clips.find(c => c.name === 'Sword_Idle'));
  const player = new Player(jasper, clips, scene, ctx);
  const guide = new Guide(scene);
  const dialogue = new Dialogue();
  const loot = new Loot(scene, { player, profile, hud, effects, get world() { return ctx.world; } }, propsG);
  const menu = new Menu({ profile, player, hud, onPause: v => { paused = v; }, zone: () => zone });
  const cons = new Console({ profile, hud, player, effects, paused: () => paused });
  ctx.console = cons;
  const pet = new Pet(scene);
  // Travel through a zone gate: save, then reload into the other zone.
  const travel = id => {
    profile.d.zone = id; profile.d.arrive = 'gate'; player.syncProfile?.(); profile.save();
    document.getElementById('load-text').textContent = `Entering ${ZONE_NAMES[id]}...`;
    document.getElementById('load-fill').style.width = '0%';
    document.getElementById('loading').classList.remove('hidden');
    setTimeout(() => location.reload(), 350);
  };

  // Load a zone (Zone 1 for now; the profile remembers which zone you're in).
  const core = { pet, console: cons, travel, props: propsG, loader, scene, quality, clips, idle, player, hud, effects, profile, guide, dialogue, rig, loot, openForge: () => menu.openForge() };
  zone = await ZONES[profile.d.zone in ZONES ? profile.d.zone : 'z1'].loadZone(core);
  ctx.world = zone.world; ctx.enemies = zone.enemies; ctx.npcs = zone.npcs; rig.world = zone.world;

  const input = new Input(canvas);
  document.getElementById('loading').classList.add('hidden');
  hud.show(); hud.wallet(profile.d);
  rig.yaw = 0;
  document.getElementById('menu-restart').addEventListener('click', () => { if (confirm('Erase all progress and restart?')) { Profile.clear(); location.reload(); } });

  zone.start();
  if (profile.d.pet === 'pip') pet.follow(player);
  if (!isTouch) setTimeout(() => hud.system('> Click the screen to look around', 2.5), 9000);
  setInterval(() => { if (!paused) { profile.d.totals.playTime += 5; } }, 5000);

  const clock = new THREE.Clock();
  let t = 0;
  const frame = (rawDt, doRender = true) => {
    let dt = Math.min(rawDt, 1 / 20);
    if (paused) { if (doRender) renderer.render(scene, camera); return; }
    cons.update(dt);
    if (cons.open) dt *= 0.12; // the Console slows time while open
    t += dt;
    input.update();
    if (hitStop > 0) { hitStop -= dt; dt *= 0.08; }
    const { story, enemies, boss, world } = zone;

    // Using things: F / TALK near a villager, chest or gate; otherwise F jumps.
    const talking = dialogue.active || story.busy;
    let near = null;
    if (!talking && player.state === 'move') {
      let bd = 99;
      for (const it of zone.interactables()) { const d = it.pos.distanceTo(player.pos) - (it.range || 2.8); if (d < 0 && d < bd) { bd = d; near = it; } }
    }
    hud.talkPrompt(near ? near.label : null, near?.button);
    if (!talking && input.pressed.has('talk')) {
      input.pressed.delete('talk');
      if (near) near.act(); else input.pressed.add('jump');
    }
    dialogue.update(dt, input);
    const pIn = dialogue.active || story.busy ? NO_INPUT : input;

    player.update(dt, pIn, rig.yaw);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.gone) { scene.remove(e.group); enemies.splice(i, 1); continue; }
      const atk = dialogue.active ? null : e.update(dt * cons.enemyTimeScale, t, player, world);
      if (atk && (atk.direct || player.pos.distanceTo(e.pos) < (atk.aoe || 2.1))) player.damage(atk.damage, atk.from, atk.enemy, atk);
    }
    // Bodies don't overlap: push Jasper and enemies apart.
    for (const e of enemies) {
      if (!e.alive || !player.alive) continue;
      const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z, d = Math.hypot(dx, dz), min = (e.radius || 0.5) + 0.5;
      if (d < min && d > 1e-4) {
        const push = (min - d) / 2, nx = dx / d, nz = dz / d;
        player.pos.x += nx * push; player.pos.z += nz * push;
        if (e.frozen <= 0 && !e.isBoss) { e.pos.x -= nx * push; e.pos.z -= nz * push; } else { player.pos.x += nx * push; player.pos.z += nz * push; }
      }
    }
    zone.update(dt, t);
    loot.update(dt, t);
    pet.update(dt, player, world);
    guide.update(dt, t, player.pos, player.facing, camera);
    effects.update(dt);
    world.update(dt, t, player.pos);
    rig.update(dt, input, player.pos, boss.alive ? 1.45 : 1, dialogue.active && story.talkNpc ? story.talkNpc.pos : null);
    // Fade enemies that get between the camera and Jasper.
    for (const e of enemies) {
      const near2 = camera.position.distanceTo(e.group.position) < 3.2 + (e.radius || 0);
      e.mat.opacity += ((near2 ? 0.25 : 0.92) - e.mat.opacity) * Math.min(1, dt * 10);
    }
    hud.update(dt, player);
    document.getElementById('hint').style.visibility = dialogue.active ? 'hidden' : '';
    input.endFrame();
    if (doRender) renderer.render(scene, camera);
  };
  // Graphics: Auto (default) adjusts to the phone's FPS; High/Medium/Low are fixed.
  const LEVELS = ['high', 'medium', 'low'];
  const applyLevel = lvl => {
    const pr = lvl === 'high' ? quality.pixelRatio : lvl === 'medium' ? Math.min(devicePixelRatio, 1) : 0.75;
    renderer.setPixelRatio(pr);
    const shadows = lvl !== 'low';
    if (renderer.shadowMap.enabled !== shadows) { renderer.shadowMap.enabled = shadows; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => (m.needsUpdate = true)); }); }
    renderer.setSize(innerWidth, innerHeight);
    curLevel = lvl;
  };
  let setting = 'auto', curLevel = 'high';
  try { setting = localStorage.getItem('isekai_gfx') || 'auto'; } catch (e) { /* ignore */ }
  if (setting !== 'auto') applyLevel(setting);
  const gfxBtn = document.getElementById('menu-gfx');
  const labelGfx = () => { gfxBtn.textContent = `Graphics: ${setting === 'auto' ? 'Auto (' + curLevel + ')' : setting[0].toUpperCase() + setting.slice(1)}`; };
  gfxBtn.addEventListener('click', () => {
    const order = ['auto', 'high', 'medium', 'low'];
    setting = order[(order.indexOf(setting) + 1) % order.length];
    try { localStorage.setItem('isekai_gfx', setting); } catch (e) { /* ignore */ }
    applyLevel(setting === 'auto' ? 'high' : setting); lowCount = 0; labelGfx();
  });
  let fpsFrames = 0, fpsTime = 0, lowCount = 0, highCount = 0;
  const fpsEl = document.getElementById('menu-fps');
  const adapt = rawDt => {
    fpsFrames++; fpsTime += rawDt;
    if (fpsTime < 2) return;
    const fps = fpsFrames / fpsTime; fpsFrames = 0; fpsTime = 0;
    if (fpsEl) fpsEl.textContent = `${Math.round(fps)} FPS`;
    labelGfx();
    if (setting !== 'auto' || paused) return;
    // Only step down after 2 slow checks in a row (4 s below 30 FPS); step back up when smooth.
    lowCount = fps < 30 ? lowCount + 1 : 0;
    highCount = fps > 55 ? highCount + 1 : 0;
    const i = LEVELS.indexOf(curLevel);
    if (lowCount >= 2 && i < 2) { applyLevel(LEVELS[i + 1]); lowCount = 0; }
    if (highCount >= 4 && i > 0) { applyLevel(LEVELS[i - 1]); highCount = 0; }
  };
  renderer.setAnimationLoop(() => { const d = clock.getDelta(); adapt(d); frame(d); });
  window.__step = (dt, n = 1) => { for (let i = 0; i < n; i++) frame(dt, false); }; // test hook
  window.__game = { player, get enemies() { return zone.enemies; }, rig, scene, renderer, get story() { return zone.story; }, get npcs() { return zone.npcs; }, get world() { return zone.world; }, get boss() { return zone.boss; }, dialogue, hud, guide, input, ctx, profile, loot, menu, console: cons, pet, travel, get zone() { return zone; } };
}

boot().catch(err => {
  console.error(err);
  loadText.textContent = 'Failed to load: ' + err.message;
});
