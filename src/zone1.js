// Zone 1: Starter Meadow. Builds the map, villagers, enemies, boss, chests and story.
// Every zone module exports the same shape so the game core can load zones one after another.
import * as THREE from 'three';
import { sfx, music } from './audio.js?v=19';
import { World, Z1, riverX, PATHS, WORLD_RADIUS } from './world.js?v=19';
import { VillageKit } from './village.js?v=19';
import { spawnSlimes } from './enemies.js?v=19';
import { SlimeKing } from './boss.js?v=19';
import { NPC } from './npc.js?v=19';
import { Story } from './story.js?v=19';
import { makeChest } from './loot.js?v=19';
import { makeItem } from './items.js?v=19';

export const ZONE_ID = 'z1';
export const ZONE_NAME = 'Starter Meadow';

// Hidden chests: id, position, what's special inside.
const CHESTS = [
  { id: 'c1', pos: [-17, 14], ry: 0.6, hint: 'Behind Bram\'s house' },
  { id: 'c2', pos: [52, 22], ry: -2.2, hint: 'Far corner of the slime field' },
  { id: 'c3', pos: [-26, 30], ry: 1.4, hint: 'East river bank, south', debugPoint: true },
  { id: 'c4', pos: [-64, -14], ry: 0.4, hint: 'Slime Pond, by the water' },
];

export async function loadZone(core) {
  const { loader, scene, quality, clips, idle, player, hud, effects, profile, guide, dialogue, rig } = core;
  const names = ['nature', 'village', 'bram', 'villager_f', 'villager_m'];
  const [natureG, villageG, bramG, vfG, vmG] = await Promise.all(names.map(f => loader.loadAsync(`assets/models/${f}.glb`)));

  const world = new World(scene, natureG, new VillageKit(villageG), quality);
  const enemies = spawnSlimes(scene, Z1.field);
  const boss = new SlimeKing(scene, Z1.arena.clone().add(new THREE.Vector3(-4, 0, 0)), world, effects);
  enemies.push(boss);

  const npcs = [
    new NPC(scene, bramG, clips, idle, { name: 'BRAM', color: '#ffb35a', pos: Z1.forge.clone().add(new THREE.Vector3(1.2, 0, 1.4)), ry: -2.4, anim: 'Idle_FoldArms_Loop', hair: 0x6b3a1e, bugged: { anim: 'Idle_Talking_Loop' } }, world),
    new NPC(scene, vfG, clips, idle, { name: 'NIA', color: '#ff8ae8', pos: new THREE.Vector3(-11.4, 0, -8.6), ry: 0.9, anim: 'Idle_Loop', hair: 0x2a1a12, tint: 0xd9c4ff, bugged: { anim: 'Idle_No_Loop' } }, world),
    new NPC(scene, vmG, clips, idle, { name: 'TOMM', color: '#9cff5a', pos: new THREE.Vector3(9, 0, 3), ry: -1.2, anim: 'Farm_Watering', hair: 0xc89a5a, tint: 0xb8ffb0 }, world),
  ];
  npcs[1].root.position.set(0, -0.35, 0); // NIA is half inside a wall while bugged

  const story = new Story({ player, guide, dialogue, hud, world, npcs, boss, enemies, effects, scene, rig, profile, openForge: core.openForge, travel: core.travel });
  const zdata = profile.zone(ZONE_ID);
  zdata.flags.chests ||= [];

  // Chests.
  const chests = CHESTS.map(c => {
    const g = makeChest(core.props);
    const x = c.pos[0], z = c.pos[1];
    g.position.set(x, world.groundAt(x, z), z); g.rotation.y = c.ry;
    scene.add(g);
    world.colliders.push({ x, z, r: 0.7 });
    const opened = zdata.flags.chests.includes(c.id);
    if (opened) g.userData.open(true);
    return { ...c, group: g, opened, pos3: new THREE.Vector3(x, 0, z) };
  });

  const openChest = ch => {
    if (ch.opened) return;
    ch.opened = true; ch.group.userData.open(false); sfx('chest');
    zdata.flags.chests.push(ch.id); profile.d.totals.chests++;
    const st = profile.stats();
    const at = ch.pos3.clone().add(new THREE.Vector3(0, 0.6, 0));
    core.loot.spawn(at, 'gold', Math.round((25 + Math.random() * 20) * st.lootMul));
    core.loot.spawn(at, 'shards', Math.round(3 * st.lootMul));
    core.loot.spawnItem(at, makeItem(profile.d.level + 1, Math.random() < 0.25 ? 'epic' : 'rare'));
    if (ch.debugPoint) { profile.d.debugPoints++; sfx('unlock'); hud.system('You found a DEBUG POINT!\n(used for Console Commands later)', 3); }
    effects.burst(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 18, [2, 3], 4);
    profile.save();
  };

  // Things Jasper can walk up to and use (F / TALK button).
  const interactables = () => [
    ...npcs.map(n => ({ pos: n.pos, label: `Talk to ${n.name}`, button: 'TALK', act: () => story.talk(n) })),
    ...chests.filter(c => !c.opened).map(c => ({ pos: c.pos3, label: 'Open chest', button: 'OPEN', act: () => openChest(c) })),
    { pos: Z1.gate, range: 4.5, label: 'Glitchwood Gate', button: 'GATE', act: () => story.gate() },
  ];

  return {
    id: ZONE_ID, name: ZONE_NAME, world, enemies, npcs, boss, story, chests, interactables,
    titleView: { target: new THREE.Vector3(-2, 0, 4), radius: 17, height: 6 },
    respawnPoint: () => story.respawnPoint(),
    // Replay: back to the slime field (Bram stays fixed, opened chests stay opened).
    replayData: () => {
      const f = zdata.flags || {};
      return { stage: story.idx('slimes'), kills: 0, crystal: -1, flags: { tutorial: true, bramThanked: true, nia: f.nia, gateSeen: f.gateSeen, chests: f.chests || [] } };
    },
    onKill: e => story.onKill(e),
    start: async () => {
      await story.start();
      if (profile.d.arrive === 'gate') {
        delete profile.d.arrive;
        player.spawnAt(Z1.gate.clone().add(new THREE.Vector3(0, 0, 6)), 0); guide.teleport(player.pos);
        hud.system('> ENTERING STARTER MEADOW', 2);
      }
    },
    update(dt, t) {
      for (const n of npcs) n.update(dt, rig.cam);
      for (const c of chests) if (c.pos3.distanceTo(player.pos) < 40) c.group.userData.update(dt);
      story.update(dt, t);
    },
    // Data for the menu map.
    map: {
      radius: WORLD_RADIUS, paths: PATHS, riverX,
      places: [
        { name: 'Village', p: Z1.village, r: 14, color: '#b9a98a' },
        { name: 'Slime Field', p: Z1.field, r: 14, color: '#7cc35a' },
        { name: 'Slime Pond', p: Z1.arena, r: Z1.arenaR, color: '#8a5ac2' },
      ],
      gates: [{ name: 'To Glitchwood', p: Z1.gate, color: '#ff2bd6' }],
      lair: Z1.arena,
      // Boss lair state for the map: locked until the field is clear and the bridge is fixed.
      lock: () => {
        if (story.stage >= story.idx('done')) return { state: 'defeated' };
        if (story.stage >= story.idx('pond')) return { state: 'open' };
        return { state: 'locked', left: story.guards.filter(e => e.alive).length };
      },
      cleared: () => story.stage >= story.idx('done'),
      crystals: () => world.crystals.map(c => c.pos),
      chests: () => chests.map(c => ({ p: c.pos3, opened: c.opened })),
      objective: () => story.objectivePos(),
    },
  };
}
