// Zone 3: Capital of Aster. Same shape as zone1.js / zone2.js so the game core can load it.
import * as THREE from 'three';
import { sfx } from './audio.js?v=30';
import { World3, Z3, HALL, WORLD3_RADIUS } from './world3.js?v=30';
import { initKnights, spawnZone3, setZone3Detail } from './enemies3.js?v=30';
import { SirDuplicate } from './boss3.js?v=30';
import { NPC } from './npc.js?v=30';
import { Ally } from './ally.js?v=30';
import { Shop } from './shop.js?v=30';
import { Story3 } from './story3.js?v=30';
import { makeChest } from './loot.js?v=30';
import { makeItem } from './items.js?v=30';

export const ZONE_ID = 'z3';
export const ZONE_NAME = 'Capital of Aster';

const CHESTS = [
  { id: 'c1', pos: [-27, 47], ry: 0.8 },
  { id: 'c2', pos: [47, 20], ry: -2.0 },
  { id: 'c3', ghost: 'g1', ry: 0 },
  { id: 'c4', ghost: 'g2', ry: 0, debugPoint: true },
];

// Short black fade used when walking through the keep door.
function fadeOverlay() {
  let el = document.getElementById('fade');
  if (!el) { el = document.createElement('div'); el.id = 'fade'; document.body.appendChild(el); }
  return async mid => {
    el.classList.add('on'); await new Promise(r => setTimeout(r, 380));
    mid(); await new Promise(r => setTimeout(r, 120));
    el.classList.remove('on'); await new Promise(r => setTimeout(r, 300));
  };
}

export async function loadZone(core) {
  const { loader, scene, quality, clips, idle, player, hud, effects, profile, guide, dialogue, rig, pet } = core;
  const [capG, guardG, victoryG, vmG, vfG] = await Promise.all(['capital', 'guard', 'victory', 'villager_m', 'villager_f'].map(f => loader.loadAsync(`assets/models/${f}.glb`)));
  setZone3Detail(!!quality.dense);
  initKnights(guardG, clips, idle);
  const world = new World3(scene, capG, quality);
  rig.cam.far = 240; rig.cam.updateProjectionMatrix();
  const enemies = spawnZone3(scene, effects, profile.d.level);
  const boss = new SirDuplicate(scene, Z3.bossHome.clone(), world, effects, profile.d.level);
  enemies.push(boss, ...boss.clones);

  const rho = new NPC(scene, vmG, clips, idle, { name: 'RHO', color: '#7fb2ff', pos: Z3.rho, ry: -0.4, anim: 'Idle_FoldArms_Loop', hair: 0x2a2a30, tint: 0x9fb4e8, bugged: { anim: 'Idle_No_Loop' } }, world);
  const dot = new NPC(scene, vfG, clips, idle, { name: 'DOT', color: '#ff9de2', pos: Z3.dot, ry: Math.PI / 2, anim: 'Idle_Loop', hair: 0x6a2a8a, tint: 0xe3b8ff, bugged: { anim: 'Idle_Talking_Loop' } }, world);
  const zdata = profile.zone(ZONE_ID);
  zdata.flags ||= {}; zdata.flags.chests ||= []; zdata.flags.ghosts ||= [];
  let story = null;
  const victory = new Ally(scene, core.allyModel || victoryG, clips, idle, {
    player, effects, hud, world, enemies: () => enemies, onKill: e => core.onKill?.(e), busy: () => dialogue.active || story?.busy,
    ...(core.allyOpts || {}),
  }, Z3.cage);
  const npcs = [rho, dot, victory];
  const shop = new Shop({ profile, hud, player, pause: v => core.pause(v) });
  const fade = fadeOverlay();

  // Chests: two in the streets, two drop out of the ghost houses when they are patched.
  const chests = CHESTS.map(c => {
    const gh = c.ghost ? world.ghosts.find(g => g.id === c.ghost) : null;
    const x = gh ? gh.pos.x : c.pos[0], z = gh ? gh.pos.z : c.pos[1];
    const g = makeChest(core.props); g.position.set(x, 0, z); g.rotation.y = c.ry; scene.add(g);
    const opened = zdata.flags.chests.includes(c.id);
    if (opened) g.userData.open(true);
    const hidden = !!gh && !zdata.flags.ghosts.includes(gh.id);
    g.visible = !hidden;
    const col = { x, z, r: 0.7 };
    if (!hidden) world.colliders.push(col);
    return { ...c, gh, group: g, opened, hidden, col, pos3: new THREE.Vector3(x, 0, z) };
  });
  const openChest = ch => {
    if (ch.opened) return;
    ch.opened = true; ch.group.userData.open(false); sfx('chest');
    zdata.flags.chests.push(ch.id); profile.d.totals.chests++;
    const st = profile.stats(), at = ch.pos3.clone().add(new THREE.Vector3(0, 0.6, 0));
    core.loot.spawn(at, 'gold', Math.round((110 + Math.random() * 60) * st.lootMul));
    core.loot.spawn(at, 'shards', Math.round(10 * st.lootMul));
    core.loot.spawnItem(at, makeItem(profile.d.level + 1, Math.random() < 0.45 ? 'epic' : Math.random() < 0.2 ? 'glitched' : 'rare'));
    if (ch.debugPoint) { profile.d.debugPoints++; sfx('unlock'); hud.system('You found a DEBUG POINT!\nSpend it in the CONSOLE', 3); }
    effects.burst(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 18, [2, 3], 4);
    profile.save();
  };
  const onGhostFixed = gh => {
    world.fixGhost(gh); zdata.flags.ghosts.push(gh.id); profile.save();
    effects.burst(gh.pos.clone().add(new THREE.Vector3(0, 3, 0)), 40, [1, 2], 8); sfx('glitchBig');
    const ch = chests.find(c => c.gh === gh);
    if (ch) { ch.hidden = false; ch.group.visible = true; world.colliders.push(ch.col); ch.dropT = 0.6; }
  };

  story = new Story3({ player, guide, dialogue, hud, world, npcs, boss, enemies, effects, scene, rig, profile, pet, victory, shop, travel: core.travel, fade, console: core.console, onGhostFixed });

  // The glitch rift to the Unfinished Zone (opens in the throne room once Sir Duplicate falls).
  const rift = new THREE.Group();
  {
    const mk = (c, r, o) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.y = 1.9; return m; };
    rift.add(mk(0xff2bd6, 1.5, 0.55), mk(0x29e6ff, 1.05, 0.5), mk(0xffffff, 0.45, 0.6));
    for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff2bd6 : 0x29e6ff })); b.userData.a = i / 14 * Math.PI * 2; b.userData.r = 1.7 + (i % 3) * 0.2; rift.add(b); }
    rift.add(new THREE.PointLight(0xff2bd6, 14, 10));
    rift.position.copy(Z3.rift); scene.add(rift);
  }
  const interactables = () => {
    const inHall = world.inHall(player.pos), list = [];
    for (const n of npcs) {
      if (n === victory && (victory.mode !== 'follow' || story.id === 'boss')) continue;
      list.push({ pos: n.pos, label: n === dot ? 'Shop with DOT' : `Talk to ${n.name}`, button: n === dot ? 'SHOP' : 'TALK', act: () => story.talk(n), low: n === victory, range: n === victory ? 2.2 : undefined });
    }
    for (const c of chests) if (!c.opened && !c.hidden) list.push({ pos: c.pos3, label: 'Open chest', button: 'OPEN', act: () => openChest(c) });
    if (!inHall) list.push({ pos: Z3.gate, range: 4.5, label: 'Gate to Glitchwood', button: 'GATE', act: () => story.gate() });
    if (!inHall && story.stage >= story.idx('throne')) list.push({ pos: Z3.keepDoor, range: 3.2, label: 'Enter the throne room', button: 'ENTER', act: () => story.enterHall() });
    if (inHall && story.stage >= story.idx('done')) list.push({ pos: Z3.rift, range: 3, label: 'Enter the rift: The Unfinished Zone', button: 'ENTER', act: () => story.toRift() });
    if (inHall && story.id !== 'boss') list.push({ pos: Z3.hallExit, range: 3.4, label: 'Leave the throne room', button: 'EXIT', act: () => story.leaveHall() });
    return list;
  };

  return {
    id: ZONE_ID, name: ZONE_NAME, world, enemies, npcs, boss, story, chests, interactables,
    titleView: { target: Z3.plaza.clone().add(new THREE.Vector3(0, 2, -8)), radius: 24, height: 9 },
    respawnPoint: () => story.respawnPoint(),
    // Replay: back to the purge (Rho stays fixed, Victory waits in her cage again, opened chests stay opened).
    replayData: () => {
      const f = zdata.flags || {};
      return { stage: story.idx('purge'), stageId: 'purge', kills: 0, crystal: -1, flags: { intro: true, rhoFixed: true, metDot: f.metDot, dotFixed: f.dotFixed, hintForge: true, hintShield: true, chests: f.chests || [], ghosts: f.ghosts || [], cleared: [] } };
    },
    onKill: e => story.onKill(e),
    start: () => story.start(),
    update(dt, t) {
      for (const n of npcs) n.update(dt, rig.cam);
      for (const c of chests) {
        if (c.dropT > 0) { c.dropT = Math.max(0, c.dropT - dt); c.group.position.y = c.dropT * c.dropT * 12; }
        if (!c.hidden && c.pos3.distanceTo(player.pos) < 40) c.group.userData.update(dt);
      }
      rift.visible = story.stage >= story.idx('done');
      if (rift.visible) {
        rift.rotation.y = Math.PI; rift.children.forEach((c, i) => {
          if (c.userData.a != null) { const a = c.userData.a + t * 1.4; c.position.set(Math.cos(a) * c.userData.r, 1.9 + Math.sin(a) * c.userData.r, 0); c.rotation.set(t * 2, t * 3, 0); }
          else if (c.isMesh) { c.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.06); c.rotation.z = t * (i % 2 ? 1 : -1); }
        });
      }
      story.update(dt, t);
    },
    map: {
      radius: WORLD3_RADIUS, paths: [], riverX: null,
      places: [
        { name: 'Gate District', p: new THREE.Vector3(0, 0, 44), r: 9, color: '#c9b6a0' },
        { name: 'Market Plaza', p: Z3.plaza, r: Z3.plazaR, color: '#ffcc4d' },
        { name: 'Castle Square', p: Z3.square, r: 7, color: '#7fb2ff' },
        { name: 'Castle', p: new THREE.Vector3(0, 0, -30), r: 11, color: '#b9c3d6' },
        { name: "Victory's Tower", p: Z3.tower, r: 4, color: '#ffd36b' },
      ],
      get gates() { return [{ name: 'To Glitchwood', p: Z3.gate, color: '#a35ae6' }, ...(story.stage >= story.idx('done') ? [{ name: 'Rift to the Unfinished Zone', p: Z3.keepDoor, color: '#ff2bd6' }] : [])]; },
      lair: Z3.keepDoor,
      lock: () => {
        if (story.stage >= story.idx('done')) return { state: 'defeated' };
        if (story.stage >= story.idx('throne')) return { state: 'open' };
        return { state: 'locked', left: story.guardsLeft };
      },
      cleared: () => story.stage >= story.idx('done'),
      crystals: () => world.crystals.map(c => c.pos),
      chests: () => chests.filter(c => !c.hidden).map(c => ({ p: c.pos3, opened: c.opened })),
      objective: () => story.objectivePos(),
    },
  };
}
export { HALL };
