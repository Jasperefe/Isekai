// Zone 4: The Unfinished Zone. Same shape as the other zone modules so the game core can load it.
import * as THREE from 'three';
import { sfx } from './audio.js?v=30';
import { World4, Z4, ISLANDS, SECRET, VOID, WORLD4_RADIUS } from './world4.js?v=30';
import { spawnZone4, Placeholder } from './enemies4.js?v=30';
import { Nova } from './boss4.js?v=30';
import { Ally } from './ally.js?v=30';
import { Story4 } from './story4.js?v=30';
import { Endings } from './endings.js?v=30';
import { applyDifficulty } from './difficulty.js?v=30';
import { makeChest } from './loot.js?v=30';
import { makeItem } from './items.js?v=30';

export const ZONE_ID = 'z4';
export const ZONE_NAME = 'The Unfinished Zone';

const pad = SECRET[SECRET.length - 1];
const CHESTS = [
  { id: 'c1', pos: [ISLANDS.B.c.x - 12, ISLANDS.B.c.z - 9], ry: 0.6 },
  { id: 'c2', pos: [pad.x, pad.z], ry: -0.8, debugPoint: true, secret: true },
];

export async function loadZone(core) {
  const { loader, scene, quality, player, hud, effects, profile, guide, dialogue, rig, pet } = core;
  const allyG = core.allyModel || await loader.loadAsync('assets/models/victory.glb');
  const world = new World4(scene, quality);
  world.playerPos = player.pos;
  rig.cam.far = 260; rig.cam.updateProjectionMatrix();
  const enemies = spawnZone4(scene, effects, profile.d.level);
  const novaHome = new THREE.Vector3(Z4.novaHome.x, ISLANDS.C.y, Z4.novaHome.z);
  const spawnMinion = (p, glitched) => {
    const m = new Placeholder(scene, p, effects, { level: profile.d.level, glitched });
    m.minion = true; m.noRespawn = true; m.alert = true; applyDifficulty('z4', m);
    effects.burst(p.clone().add(new THREE.Vector3(0, 1.2, 0)), 20, [0, 1], 5);
    enemies.push(m);
  };
  const boss = new Nova(scene, novaHome, world, effects, profile.d.level, spawnMinion);
  enemies.push(boss);

  const zdata = profile.zone(ZONE_ID);
  zdata.flags ||= {}; zdata.flags.chests ||= [];
  let story = null;
  const ally = new Ally(scene, allyG, core.clips, core.idle, {
    player, effects, hud, world, enemies: () => enemies, onKill: e => core.onKill?.(e), busy: () => dialogue.active || story?.busy,
    ...(core.allyOpts || {}),
  }, Z4.arrive.clone());
  ally.follow();
  const npcs = [ally];

  const chests = CHESTS.map(c => {
    const x = c.pos[0], z = c.pos[1], y = world.groundAt(x, z);
    const g = makeChest(core.props); g.position.set(x, y, z); g.rotation.y = c.ry; scene.add(g);
    const opened = zdata.flags.chests.includes(c.id);
    if (opened) g.userData.open(true);
    world.colliders.push({ x, z, r: 0.7 });
    return { ...c, group: g, opened, pos3: new THREE.Vector3(x, y, z) };
  });
  const openChest = ch => {
    if (ch.opened) return;
    ch.opened = true; ch.group.userData.open(false); sfx('chest');
    zdata.flags.chests.push(ch.id); profile.d.totals.chests++;
    const st = profile.stats(), at = ch.pos3.clone().add(new THREE.Vector3(0, 0.6, 0));
    core.loot.spawn(at, 'gold', Math.round((160 + Math.random() * 80) * st.lootMul));
    core.loot.spawn(at, 'shards', Math.round(14 * st.lootMul));
    core.loot.spawnItem(at, makeItem(profile.d.level + 2, Math.random() < 0.5 ? 'glitched' : 'epic'));
    if (ch.debugPoint) { profile.d.debugPoints++; sfx('unlock'); hud.system('You found a DEBUG POINT!\nSpend it in the CONSOLE', 3); }
    if (ch.secret) setTimeout(() => hud.system('SECRET FOUND!\nA hidden test platform at the edge of the map', 3), 1200);
    effects.burst(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 18, [2, 3], 4);
    story?.save();
  };

  const endings = new Endings({ ...core, get story() { return story; } });
  story = new Story4({ player, guide, dialogue, hud, world, npcs, boss, enemies, effects, scene, rig, profile, pet, ally, travel: core.travel, endings });

  // Falling into the void: back to the last safe ground, minus some HP.
  const safe = Z4.arrive.clone();
  let safeT = 0, fallMsgT = 0;
  const solid = (x, z, y) => world.groundAt(x, z, y) > VOID + 1;
  const trackSafe = dt => {
    if (!player.alive) return;
    if (player.onGround) {
      const { x, y, z } = player.pos, r = 0.9;
      if ([[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dz]) => solid(x + dx, z + dz, y))) { safeT += dt; if (safeT > 0.25) safe.copy(player.pos); }
      else safeT = 0;
    }
    if (player.pos.y < -28) {
      const loss = Math.round(player.maxHp * 0.15);
      player.hp = Math.max(1, player.hp - loss);
      player.spawnAt(safe.clone(), player.facing);
      player.invuln = 1.2;
      ally.teleportTo(safe.clone().add(new THREE.Vector3(1.2, 0, 1.2)));
      guide.teleport(player.pos);
      hud.float(player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), `-${loss}`, 'hurt'); sfx('hurt');
      if (fallMsgT <= 0) { hud.system('You fell into the void!\nThe Guide pulled you back (-15% HP)', 2.4); fallMsgT = 8; }
    }
    fallMsgT -= dt;
  };

  const interactables = () => {
    const list = [];
    if (ally.mode === 'follow' && story.id !== 'boss') list.push({ pos: ally.pos, label: `Talk to ${ally.name}`, button: 'TALK', act: () => story.talk(ally), low: true, range: 2.2 });
    for (const c of chests) if (!c.opened) list.push({ pos: c.pos3, label: 'Open chest', button: 'OPEN', act: () => openChest(c) });
    list.push({ pos: Z4.spawn, range: 3, label: 'Spawn pad: back to the Capital', button: 'GATE', act: () => story.gate() });
    if (story.id === 'choice') list.push({ pos: new THREE.Vector3(Z4.core.x, ISLANDS.C.y, Z4.core.z), range: 6, label: 'Answer NOVA', button: 'CHOOSE', act: () => endings.choose() });
    return list;
  };

  return {
    id: ZONE_ID, name: ZONE_NAME, world, enemies, npcs, boss, story, chests, interactables, endings,
    titleView: { target: new THREE.Vector3(0, 2, -4), radius: 30, height: 12 },
    respawnPoint: () => story.respawnPoint(),
    replayData: () => {
      const f = zdata.flags || {};
      return { stage: story.idx('town'), stageId: 'town', kills: 0, crystal: -1, flags: { chests: f.chests || [], cleared: [] } };
    },
    onKill: e => story.onKill(e),
    start: () => story.start(),
    update(dt, t) {
      for (const n of npcs) n.update(dt, rig.cam);
      for (const c of chests) if (c.pos3.distanceTo(player.pos) < 40) c.group.userData.update(dt);
      trackSafe(dt);
      story.update(dt, t);
    },
    map: {
      radius: WORLD4_RADIUS, paths: [], riverX: null,
      places: [
        { name: 'The Placeholder', p: ISLANDS.A.c, r: 12, color: '#c9d0dc' },
        { name: 'Asset Graveyard', p: ISLANDS.B.c, r: 10, color: '#ff9de2' },
        { name: "NOVA's Core", p: ISLANDS.C.c, r: 9, color: '#ff2bd6' },
      ],
      gates: [{ name: 'To the Capital', p: Z4.spawn, color: '#29e6ff' }],
      lair: Z4.core,
      lock: () => {
        if (story.stage >= story.idx('choice')) return { state: 'defeated' };
        if (story.stage >= story.idx('climb')) return { state: 'open' };
        return { state: 'locked', left: story.guardsLeft };
      },
      cleared: () => story.stage >= story.idx('choice'),
      crystals: () => world.crystals.map(c => c.pos),
      chests: () => chests.filter(c => !c.secret || c.opened || story.stage >= story.idx('choice')).map(c => ({ p: c.pos3, opened: c.opened })),
      objective: () => story.objectivePos(),
    },
  };
}
