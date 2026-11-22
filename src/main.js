// ISEKAI game core: renderer, camera, player, HUD, menus. Zones load from zone1.js / zone2.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Input, isTouch } from './input.js?v=32';
import { buildCharacter, captureGrip } from './characters.js?v=32';
import { Player } from './player.js?v=32';
import { Guide } from './guide.js?v=32';
import { Dialogue } from './dialogue.js?v=32';
import { Effects } from './effects.js?v=32';
import { Hud } from './hud.js?v=32';
import { Profile } from './profile.js?v=32';
import { Loot } from './loot.js?v=32';
import { Menu } from './menu.js?v=32';
import { Console } from './console.js?v=32';
import { Pet } from './pet.js?v=32';
import { unlockAudio, music, sfx, setVolumes, volumes, setListener } from './audio.js?v=32';
import { capturePortrait, systemPortrait } from './portraits.js?v=32';
import { ZoneMap, MapView, Minimap } from './map.js?v=32';
import * as Zone1 from './zone1.js?v=32';
import * as Zone2 from './zone2.js?v=32';
import * as Zone3 from './zone3.js?v=32';
import * as Zone4 from './zone4.js?v=32';
import { Endings } from './endings.js?v=32';
import { DIFFICULTY, applyAll } from './difficulty.js?v=32';
import { ads } from './ads.js?v=32';

// Zone registry. Each zone is loaded on its own page load (gates save and reload).
const ZONES = { z1: Zone1, z2: Zone2, z3: Zone3, z4: Zone4 };
const ZONE_NAMES = { z1: 'Starter Meadow', z2: 'Glitchwood Forest', z3: 'Capital of Aster', z4: 'The Unfinished Zone' };
const ZONE_MUSIC = { z1: 'meadow', z2: 'glitchwood', z3: 'capital', z4: 'glitchwood' };
const FAST = new URLSearchParams(location.search).has('fast');

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
  // Playgama Bridge first (never wait more than 5 s for it).
  await Promise.race([ads.init(), new Promise(r => setTimeout(r, 5000))]);
  ads.message('in_game_loading_started');
  const [jasperG, a1, a2, propsG] = await Promise.all(['jasper', 'anims1', 'anims2', 'props'].map(f => loader.loadAsync(`assets/models/${f}.glb`)));
  const clips = [...a1.animations, ...a2.animations];
  const idle = clips.find(c => c.name === 'Idle_Loop');

  const profile = Profile.load();
  // New Game+ as Victory: she becomes the player (with the Debug Blade) and Jasper becomes the ally.
  const heroV = profile.d.hero === 'victory';
  const heroG = heroV ? await loader.loadAsync('assets/models/victory.glb') : jasperG;
  if (profile.d.zone !== 'z1' && ZONES[profile.d.zone]) loadText.textContent = `Entering ${ZONE_NAMES[profile.d.zone]}...`;
  const effects = new Effects(scene);
  const rig = new CameraRig(camera, null);
  const hud = new Hud(camera);
  let hitStop = 0, zone = null, paused = false, lookIdle = 0, autoTurn = 0, adPaused = false;
  // Shared context used by the player; zone-specific parts are filled in when a zone loads.
  const ctx = {
    effects, hud, camera: rig, scene, profile,
    enemies: [], npcs: [], world: null,
    hitStop: t => { hitStop = Math.max(hitStop, t); },
    onKill: e => { profile.d.totals.kills++; loot.enemyDrop(e); zone?.onKill(e); },
    respawnPoint: () => zone.respawnPoint(),
    xpMul: () => ads.xpMul,
  };
  Object.defineProperty(ctx, 'patchables', { get: () => zone?.story.ctx.patchables || [] });
  const jasper = buildCharacter(heroG, 'jasper', idle, heroV ? { hair: 0xe9c27a, hero: 'victory' } : {});
  jasper.grip = captureGrip(jasper.root, clips.find(c => c.name === 'Sword_Idle'));
  const player = new Player(jasper, clips, scene, ctx);
  const guide = new Guide(scene);
  const dialogue = new Dialogue();
  dialogue.swap = heroV; hud.swap = heroV;
  const loot = new Loot(scene, { player, profile, hud, effects, get world() { return ctx.world; } }, propsG);
  const menu = new Menu({ profile, player, hud, onPause: v => { paused = v; ads.message(v ? 'gameplay_stopped' : 'gameplay_started'); }, zone: () => zone });
  const cons = new Console({ profile, hud, player, effects, paused: () => paused });
  ctx.console = cons;
  const pet = new Pet(scene);
  // Travel through a zone gate: save, then reload into the other zone.
  const travel = (id, arrive = 'gate') => {
    profile.d.zone = id; profile.d.arrive = arrive; player.syncProfile?.(); profile.save();
    document.getElementById('load-text').textContent = `Entering ${ZONE_NAMES[id]}...`;
    document.getElementById('load-fill').style.width = '0%';
    document.getElementById('loading').classList.remove('hidden');
    try { sessionStorage.setItem('isekai_autostart', '1'); } catch (e) { /* ignore */ }
    // Natural break: an interstitial may play before the next zone loads.
    setTimeout(() => ads.interstitial('zone_travel', () => location.reload()), 350);
  };

  // Load a zone (Zone 1 for now; the profile remembers which zone you're in).
  const core = { allyModel: heroV ? jasperG : null, allyOpts: heroV ? { name: 'JASPER', kind: 'jasper', color: '#29e6ff' } : null, pet, console: cons, travel, props: propsG, loader, scene, quality, clips, idle, player, hud, effects, profile, guide, dialogue, rig, loot, openForge: () => menu.openForge(), pause: v => menu.core.onPause(v), onKill: e => ctx.onKill(e) };
  zone = await ZONES[profile.d.zone in ZONES ? profile.d.zone : 'z1'].loadZone(core);
  applyAll(zone.id, zone.enemies);
  ctx.world = zone.world; ctx.enemies = zone.enemies; ctx.npcs = zone.npcs; rig.world = zone.world;

  const input = new Input(canvas);
  document.getElementById('loading').classList.add('hidden');
  ads.message('in_game_loading_stopped'); ads.message('game_ready');
  ads.bind({ player, profile, hud, canOffer: () => !paused && !titleMode && !dialogue.active && !zone.story.busy && player.alive && !hud.boss && !cons.open && !portrait });
  ads.onPause = v => { adPaused = v; ads.message(v ? 'gameplay_stopped' : 'gameplay_started'); };
  // Death: offer a rewarded revive (not in boss fights); otherwise respawn at the crystal.
  player.onRespawn = () => ads.interstitial('respawn');
  let wasDead = false;
  hud.wallet(profile.d);
  rig.yaw = 0;
  // Every spawn (arriving through a gate, respawning, entering the throne room) puts the camera
  // straight behind Jasper, so he never starts out facing the camera.
  const spawnAt = player.spawnAt.bind(player);
  player.spawnAt = (p, facing) => { spawnAt(p, facing); rig.yaw = player.facing + Math.PI; rig.camK = 1; };
  setListener(player.pos);
  const $ = id => document.getElementById(id);
  // Landscape only: in portrait a "rotate your device" screen covers the game and time stops.
  const portraitMQ = matchMedia('(orientation: portrait)');
  let portrait = portraitMQ.matches;
  portraitMQ.addEventListener?.('change', e => { portrait = e.matches; if (portrait) input.endFrame?.(); });
  const lockLandscape = () => { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* not supported (iPhone) */ } };
  addEventListener('pointerdown', lockLandscape, { once: true });

  // Guide arrow: a glowing chevron on the ground next to Jasper, pointing at the objective.
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.75); arrowShape.lineTo(0.55, 0.05); arrowShape.lineTo(0.2, 0.05); arrowShape.lineTo(0.2, -0.55); arrowShape.lineTo(-0.2, -0.55); arrowShape.lineTo(-0.2, 0.05); arrowShape.lineTo(-0.55, 0.05); arrowShape.closePath();
  const arrowGeo = new THREE.ShapeGeometry(arrowShape); arrowGeo.rotateX(-Math.PI / 2); arrowGeo.rotateY(Math.PI);
  const guideArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0x29e6ff, transparent: true, opacity: 0.85, depthWrite: false }));
  guideArrow.renderOrder = 3; guideArrow.visible = false; scene.add(guideArrow);
  // Maps: the zone picture is rendered from the 3D world on the first frame.
  const zmap = new ZoneMap({
    renderer, scene, zone, profile, player,
    hide: () => [player.group, guide.group, pet.group, loot.group, zone.world.skyDome, zone.world.barrierMesh, zone.world.motes, ...zone.enemies.map(e => e.group), ...zone.npcs.map(n => n.group)],
  });
  zmap.wantCapture = true;
  menu.mapView = new MapView({ zmap, zone, player, profile, travel, menu });
  const minimap = new Minimap({ zmap, zone, player, rig, onTap: () => menu.show('map') });
  $('mm-toggle').classList.toggle('on', minimap.on);
  $('mm-toggle').addEventListener('click', () => { minimap.setOn(!minimap.on); $('mm-toggle').classList.toggle('on', minimap.on); sfx('click'); });
  const autostart = () => { try { sessionStorage.setItem('isekai_autostart', '1'); } catch (e) { /* ignore */ } };
  $('menu-restart').addEventListener('click', () => { if (confirm('Erase all progress and restart?')) { Profile.clear(); autostart(); location.reload(); } });
  $('menu-replay').addEventListener('click', () => {
    if (!confirm(`Replay ${ZONE_NAMES[zone.id]}? Enemies, quests and the boss reset. Your level, gear, skills, gold and Pip stay.`)) return;
    player.syncProfile?.();
    profile.d.zones[zone.id] = zone.replayData();
    profile.save(); autostart(); location.reload();
  });
  // New Game+ (after any ending).
  if (heroV) {
    $('pp-hero').textContent = 'VICTORY'; $('pp-tag').textContent = 'PLAYER TWO'; document.body.classList.add('hero-v');
    // Victory's own buttons.
    for (const [id, l] of [['btn-heavy', 'LUNGE'], ['btn-dash', 'BLINK'], ['btn-block', 'AEGIS'], ['btn-patch', 'STARFALL'], ['btn-skill', 'RADIANCE']]) { const em = $(id)?.querySelector('em'); if (em) em.textContent = l; }
    $('btn-skill')?.querySelector('svg')?.replaceChildren(...new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4M4.6 4.6l2.8 2.8M16.6 16.6l2.8 2.8M4.6 19.4l2.8-2.8M16.6 7.4l2.8-2.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', 'image/svg+xml').documentElement.childNodes);
    $('btn-patch')?.querySelector('svg')?.replaceChildren(...new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" fill="currentColor"/></svg>', 'image/svg+xml').documentElement.childNodes);
    $('hint').textContent = $('hint').textContent.replace('R Blade Storm', 'R Radiance').replace('E Patch', 'E Starfall (long range)').replace('Q block / parry', 'Q Aegis / reflect').replace('Space dodge', 'Space Blink');
  }
  for (const [id, hero] of [['menu-ngv', 'victory'], ['menu-ngj', 'jasper']]) {
    $(id).classList.toggle('hidden', !(profile.d.endings || []).length);
    $(id).addEventListener('click', () => { menu.hide(); new Endings({ profile, player }).newGamePlus(hero); });
  }
  // Sound settings.
  const bindVol = (id, key) => {
    const el = $(id), val = $(id + '-v');
    el.value = Math.round(volumes()[key] * 100); val.textContent = el.value + '%';
    el.addEventListener('input', () => { setVolumes({ [key]: el.value / 100 }); val.textContent = el.value + '%'; });
    el.addEventListener('change', () => sfx(key === 'sfx' ? 'coin' : 'click'));
  };
  bindVol('vol-music', 'music'); bindVol('vol-sfx', 'sfx');
  const showCredits = on => { $('credits').classList.toggle('hidden', !on); sfx(on ? 'open' : 'close'); };
  $('menu-credits').addEventListener('click', () => showCredits(true));
  $('t-credits').addEventListener('click', () => showCredits(true));
  $('c-close').addEventListener('click', () => showCredits(false));
  // Browsers only allow sound after the first tap or key press.
  const unlock = () => { unlockAudio(); $('title').classList.add('audio-on'); };
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock);

  // Portraits for the dialogue box and the HUD, rendered from the models (done between frames).
  const portraitJobs = [];
  const queuePortraits = () => {
    const color = { JASPER: 0x1d2550, GUIDE: 0x0f2a3a, BRAM: 0x3a2412, NIA: 0x3a1430, TOMM: 0x1c3a14, MIRA: 0x123a3a, 'SLIME KING': 0x163a18, THORNWRAITH: 0x3a0f34, RHO: 0x16244a, DOT: 0x3a1438, VICTORY: 0x3a2c10, 'SIR DUPLICATE': 0x3a2a0c, NOVA: 0x2a0a30 };
    const heroName = heroV ? 'VICTORY' : 'JASPER';
    portraitJobs.push([heroName, player.group, { bg: color[heroName] }]);
    portraitJobs.push(['GUIDE', guide.group, { bg: color.GUIDE, focus: 0.5, dist: 0.85, side: 0.12, reset: [guide.mesh] }]);
    for (const n of zone.npcs) portraitJobs.push([n.name, n.group, { bg: color[n.name] ?? 0x1d2550 }]);
    if (zone.boss) {
      const b = zone.boss, big = b.name === 'THORNWRAITH';
      if (b.portrait) portraitJobs.push([b.name, b.portrait.obj, { bg: color[b.name] ?? 0x2a1030, focus: b.portrait.focus ?? 'head', dist: b.portrait.dist ?? 1.45, side: b.portrait.side ?? 0.25 }]);
      else portraitJobs.push([b.name, big ? b.m.root : b.group, { bg: color[b.name] ?? 0x2a1030, focus: big ? 0.72 : 0.6, dist: big ? 2.6 : 4.2, side: 0.2 }]);
    }
    dialogue.setPortrait('SYSTEM', systemPortrait());
  };
  queuePortraits();
  const runPortraits = () => {
    while (portraitJobs.length) {
      const [name, obj, opts] = portraitJobs.shift();
      try { const url = capturePortrait(renderer, obj, opts); dialogue.setPortrait(name, url); if (obj === player.group) hud.setPortrait(url); }
      catch (e) { console.warn('portrait failed', name, e); }
    }
  };

  // ---------------- Title screen (skipped after zone travel, replay or new game) ----------------
  let titleMode = false;
  const hasProgress = () => profile.d.level > 1 || Object.values(profile.d.zones || {}).some(z => (z.stage || 0) > 0);
  const startGame = () => {
    titleMode = false; document.body.classList.remove('title'); $('title').classList.add('hidden');
    hud.show(); zone.start();
    ads.message('gameplay_started');
    if (profile.d.pet === 'pip') pet.follow(player);
    music(ZONE_MUSIC[zone.id], 2.5);
    if (!isTouch) setTimeout(() => hud.system('> Click the screen to look around', 2.5), 9000);
  };
  let skip = FAST;
  try { skip = skip || sessionStorage.getItem('isekai_autostart') === '1'; sessionStorage.removeItem('isekai_autostart'); } catch (e) { /* ignore */ }
  if (skip) startGame();
  else {
    titleMode = true; document.body.classList.add('title'); $('title').classList.remove('hidden');
    $('t-build').textContent = $('build').textContent;
    const cont = $('t-continue');
    if (hasProgress()) $('t-save').textContent = `Level ${profile.d.level} · ${ZONE_NAMES[zone.id]}`;
    else { cont.classList.add('hidden'); $('t-new').classList.add('primary'); }
    music('title', 1.5);
    cont.addEventListener('click', () => { unlock(); sfx('ability'); startGame(); });
    $('t-new').addEventListener('click', () => {
      unlock();
      if (hasProgress()) {
        if (!confirm('Start a new game? This erases your current progress.')) return;
        Profile.clear(); autostart(); location.reload(); return;
      }
      sfx('ability'); startGame();
    });
    $('t-settings').addEventListener('click', () => { unlock(); menu.show('settings'); });
  }
  setInterval(() => { if (!paused && !titleMode) { profile.d.totals.playTime += 5; } }, 5000);

  const clock = new THREE.Clock();
  let t = 0;
  const frame = (rawDt, doRender = true) => {
    let dt = Math.min(rawDt, 1 / 20);
    if (doRender && portraitJobs.length) runPortraits();
    if (doRender && zmap.wantCapture) { zmap.wantCapture = false; try { zmap.capture(); } catch (e) { console.warn('map capture failed', e); } }
    if (titleMode) {
      // Slow orbit around the zone's showcase spot behind the title screen.
      t += dt;
      const v = zone.titleView || { target: new THREE.Vector3(0, 0, 0), radius: 14, height: 5 };
      const a = t * 0.06 + 0.6, tg = v.target;
      camera.position.set(tg.x + Math.sin(a) * v.radius, zone.world.groundAt(tg.x, tg.z) + v.height, tg.z + Math.cos(a) * v.radius);
      camera.lookAt(tg.x, zone.world.groundAt(tg.x, tg.z) + 1.5, tg.z);
      zone.world.update(dt, t, tg); effects.update(dt);
      for (const n of zone.npcs) n.update(dt, camera);
      if (doRender) renderer.render(scene, camera);
      return;
    }
    if (paused || portrait || adPaused) { if (doRender) renderer.render(scene, camera); return; }
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
      // Doors, gates and chests win over low-priority things (talking to an ally who follows you).
      for (const it of zone.interactables()) { const d = it.pos.distanceTo(player.pos) - (it.range || 2.8) + (it.low ? 100 : 0); if (d < (it.low ? 100 : 0) && d < bd) { bd = d; near = it; } }
    }
    hud.talkPrompt(near ? near.label : null, near?.button);
    if (!talking && input.pressed.has('talk')) {
      input.pressed.delete('talk');
      if (near) near.act(); else input.pressed.add('jump');
    }
    dialogue.update(dt, input);
    const pIn = dialogue.active || story.busy ? NO_INPUT : input;

    // The stick keeps its world direction while the camera swings round on its own, so Jasper never
    // curves when the camera turns to get behind him (only manual camera turns change the stick).
    const stickOn = Math.hypot(pIn.move.x, pIn.move.y) > 0.15;
    if (!stickOn || pIn.look.dx || pIn.look.dy) autoTurn = 0;
    player.update(dt, pIn, rig.yaw - autoTurn);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.gone) { scene.remove(e.group); enemies.splice(i, 1); continue; }
      if (e.dead && !e.deathSeen) { e.deathSeen = true; if (!e.isBoss && zone.map.cleared?.()) e.respawnT = Math.max(e.respawnT || 0, 180); } // cleared zone: back after 3 minutes
      else if (!e.dead) e.deathSeen = false;
      const atk = dialogue.active ? null : e.update(dt * cons.enemyTimeScale, t, player, world);
      if (atk && (atk.direct || player.pos.distanceTo(e.pos) < (atk.aoe || 2.1))) player.damage(Math.round(atk.damage * (e.diffDmg || DIFFICULTY[zone.id]?.dmg || 1)), atk.from, atk.enemy, atk);
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
    // Ads: revive offer on death, boost offer card now and then.
    if (!player.alive && !wasDead) {
      wasDead = true;
      if (!hud.boss && ads.deathOffer(() => { player.revive(); document.body.classList.remove('revive'); }, () => { document.body.classList.remove('revive'); player.respawn(); })) { player.deathHeld = true; document.body.classList.add('revive'); }
    } else if (player.alive) wasDead = false;
    ads.update(dt);
    loot.update(dt, t);
    pet.update(dt, player, world);
    guide.update(dt, t, player.pos, player.facing, camera);
    effects.update(dt);
    world.update(dt, t, player.pos);
    // Camera follow: while Jasper runs (and the player isn't turning the camera by hand) the camera swings
    // gently round behind him, so he runs away from the camera instead of sideways or toward it.
    if (input.look.dx || input.look.dy) lookIdle = 0; else lookIdle += dt;
    const runSpeed = Math.hypot(player.vel.x, player.vel.z);
    if (lookIdle > 0.6 && runSpeed > 2 && player.state === 'move' && !dialogue.active) {
      // Swing round behind Jasper, even when he runs toward the camera (he must never run "backwards" on screen).
      let d = player.facing + Math.PI - rig.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = d * Math.min(1, dt * (Math.abs(d) > 1.6 ? 3.2 : 2.2));
      rig.yaw += turn; autoTurn += turn;
    }
    rig.update(dt, input, player.pos, boss.alive ? (world.inHall?.(player.pos) ? 1.12 : 1.45) : 1, dialogue.active && story.talkNpc ? story.talkNpc.pos : null);
    // Fade enemies that get between the camera and Jasper.
    for (const e of enemies) {
      const near2 = camera.position.distanceTo(e.group.position) < 3.2 + (e.radius || 0);
      e.mat.opacity += ((near2 ? 0.25 : 0.92) - e.mat.opacity) * Math.min(1, dt * 10);
    }
    hud.update(dt, player);
    zmap.update(dt, player.pos); minimap.update(dt);
    {
      const o = zone.map.objective?.(), far = o && Math.hypot(o.x - player.pos.x, o.z - player.pos.z);
      guideArrow.visible = !!o && far > 7 && !dialogue.active && player.alive;
      if (guideArrow.visible) {
        const a = Math.atan2(o.x - player.pos.x, o.z - player.pos.z), k = 1.7 + Math.sin(t * 5) * 0.15;
        guideArrow.position.set(player.pos.x + Math.sin(a) * k, world.groundAt(player.pos.x + Math.sin(a) * k, player.pos.z + Math.cos(a) * k) + 0.08, player.pos.z + Math.cos(a) * k);
        guideArrow.rotation.y = a; guideArrow.material.opacity = 0.6 + Math.sin(t * 5) * 0.25;
      }
    }
    document.body.classList.toggle('talking', dialogue.active);
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
  const labelGfx = () => {
    for (const b of document.querySelectorAll('#gfx-seg button')) {
      b.classList.toggle('on', b.dataset.gfx === setting);
      if (b.dataset.gfx === 'auto') b.textContent = setting === 'auto' ? `Auto (${curLevel})` : 'Auto';
    }
  };
  for (const b of document.querySelectorAll('#gfx-seg button')) b.addEventListener('click', () => {
    setting = b.dataset.gfx; sfx('click');
    try { localStorage.setItem('isekai_gfx', setting); } catch (e) { /* ignore */ }
    applyLevel(setting === 'auto' ? 'high' : setting); lowCount = 0; labelGfx();
  });
  labelGfx();
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
  window.__game = { zmap, minimap, player, get enemies() { return zone.enemies; }, rig, scene, renderer, get story() { return zone.story; }, get npcs() { return zone.npcs; }, get world() { return zone.world; }, get boss() { return zone.boss; }, dialogue, hud, guide, input, ctx, profile, loot, menu, console: cons, pet, travel, get zone() { return zone; } };
}

boot().catch(err => {
  console.error(err);
  loadText.textContent = 'Failed to load: ' + err.message;
});
