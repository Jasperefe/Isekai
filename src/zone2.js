// Zone 2: Glitchwood Forest. Same shape as zone1.js so the game core can load either.
import * as THREE from 'three';
import { sfx, music } from './audio.js?v=29';
import { World2, Z2, PATHS2, WORLD2_RADIUS } from './world2.js?v=29';
import { VillageKit } from './village.js?v=29';
import { spawnZone2 } from './enemies2.js?v=29';
import { Thornwraith } from './boss2.js?v=29';
import { NPC } from './npc.js?v=29';
import { Story2 } from './story2.js?v=29';
import { makeChest } from './loot.js?v=29';
import { makeItem } from './items.js?v=29';

export const ZONE_ID = 'z2';
export const ZONE_NAME = 'Glitchwood Forest';
// After the Thornwraith falls, the crypt door in Root Hollow opens onto the road to the Capital.
const CAPITAL_DOOR = new THREE.Vector3(Z2.hollow.x, 0, Z2.hollow.z - Z2.hollowR + 5.2);

const CHESTS = [
  { id: 'c1', pos: [-18, 34], ry: 1.2 },
  { id: 'c2', pos: [52, 20], ry: -2.0 },
  { id: 'c3', pos: [Z2.secret.x, Z2.secret.z - 0.4], ry: 0, debugPoint: true, secret: 'noclip' },
  { id: 'c4', pos: [Z2.ledge.x, Z2.ledge.z], ry: 0.6, debugPoint: true, secret: 'ledge' },
];

export async function loadZone(core) {
  const { loader, scene, quality, clips, idle, player, hud, effects, profile, guide, dialogue, rig, pet } = core;
  const [forestG, spookG, villageG, miraG, nullTex] = await Promise.all([
    ...['kk_forest', 'kk_halloween', 'village', 'mira'].map(f => loader.loadAsync(`assets/models/${f}.glb`)),
    new THREE.TextureLoader(loader.manager).loadAsync('assets/models/kk_forest_null.png'),
  ]);
  const world = new World2(scene, forestG, spookG, nullTex, new VillageKit(villageG), quality);
  const enemies = spawnZone2(scene, effects, profile.d.level, quality);
  // Nothing beyond the fog needs drawing.
  rig.cam.far = 95; rig.cam.updateProjectionMatrix();
  const boss = new Thornwraith(scene, Z2.hollow.clone(), world, effects, profile.d.level);
  enemies.push(boss, ...boss.clones);

  const mira = new NPC(scene, miraG, clips, idle, { name: 'MIRA', color: '#9cf0ff', pos: Z2.hut.clone().add(new THREE.Vector3(1.5, 0, 2.5)), ry: 0.9, anim: 'Idle_Loop', hair: 0xc9c9d2 }, world);
  mira.talkAnim = 'Idle_Talking_Loop';
  // Mira is a cut beta character: she flickers to wireframe now and then.
  const miraMats = []; mira.root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); miraMats.push(o.material); } });
  const npcs = [mira];

  const zdata = profile.zone(ZONE_ID);
  zdata.flags ||= {}; zdata.flags.chests ||= [];
  const story = new Story2({ player, guide, dialogue, hud, world, npcs, boss, enemies, effects, scene, rig, profile, pet, console: core.console, travel: core.travel });

  // Chests (the ledge chest sits on top of the tall stump).
  const chests = CHESTS.map(c => {
    const g = makeChest(core.props);
    const x = c.pos[0], z = c.pos[1], y = world.groundAt(x, z);
    g.position.set(x, y, z); g.rotation.y = c.ry; scene.add(g);
    if (c.secret !== 'ledge') world.colliders.push({ x, z, r: 0.7 });
    const opened = zdata.flags.chests.includes(c.id);
    if (opened) g.userData.open(true);
    return { ...c, group: g, opened, pos3: new THREE.Vector3(x, y, z) };
  });
  const openChest = ch => {
    if (ch.opened) return;
    ch.opened = true; ch.group.userData.open(false); sfx('chest');
    zdata.flags.chests.push(ch.id); profile.d.totals.chests++;
    const st = profile.stats(), at = ch.pos3.clone().add(new THREE.Vector3(0, 0.6, 0));
    core.loot.spawn(at, 'gold', Math.round((60 + Math.random() * 40) * st.lootMul));
    core.loot.spawn(at, 'shards', Math.round(6 * st.lootMul));
    core.loot.spawnItem(at, makeItem(profile.d.level + 1, Math.random() < 0.35 ? 'epic' : Math.random() < 0.15 ? 'glitched' : 'rare'));
    if (ch.debugPoint) { profile.d.debugPoints++; sfx('unlock'); hud.system('You found a DEBUG POINT!\nSpend it in the CONSOLE', 3); }
    effects.burst(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 18, [2, 3], 4);
    profile.save();
  };

  const interactables = () => [
    ...npcs.map(n => ({ pos: n.pos, label: `Talk to ${n.name}`, button: 'TALK', act: () => story.talk(n) })),
    ...chests.filter(c => !c.opened).map(c => ({ pos: c.pos3, range: c.secret === 'ledge' ? 2.2 : 2.8, label: 'Open chest', button: 'OPEN', act: () => openChest(c) })),
    { pos: Z2.gate, range: 4.5, label: 'Gate to Starter Meadow', button: 'GATE', act: () => story.gate() },
    ...(story.stage >= story.idx('done') ? [{ pos: CAPITAL_DOOR, range: 3.6, label: 'Road to the Capital', button: 'GATE', act: () => story.capitalGate() }] : []),
  ];

  // Golden light in the crypt door (only after the boss).
  const doorMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), doorMat);
  door.position.set(CAPITAL_DOOR.x, world.groundAt(CAPITAL_DOOR.x, CAPITAL_DOOR.z) + 1.6, CAPITAL_DOOR.z - 1.6); scene.add(door);
  const doorLight = new THREE.PointLight(0xffc860, 0, 9); doorLight.position.set(CAPITAL_DOOR.x, door.position.y, CAPITAL_DOOR.z); scene.add(doorLight);
  let miraT = 0;
  return {
    id: ZONE_ID, name: ZONE_NAME, world, enemies, npcs, boss, story, chests, interactables,
    titleView: { target: Z2.hollow.clone().add(new THREE.Vector3(0, 0, -4)), radius: 10, height: 3.6 },
    respawnPoint: () => story.respawnPoint(),
    // Replay: back to the Corrupted Grove quest (Mira's gifts, Pip and opened chests are kept).
    replayData: () => {
      const f = zdata.flags || {};
      return { stage: story.idx('grove'), stageId: 'grove', kills: 0, crystal: -1, flags: { pip: f.pip, hintWall: true, hintLedge: true, chests: f.chests || [], cleared: [] } };
    },
    onKill: e => story.onKill(e),
    start: () => story.start(),
    update(dt, t) {
      mira.update(dt, rig.cam);
      miraT += dt;
      const flick = Math.sin(miraT * 1.7) > 0.985 || (Math.sin(miraT * 1.7) > 0.97 && Math.sin(miraT * 40) > 0);
      for (const m of miraMats) m.wireframe = flick;
      for (const c of chests) if (c.pos3.distanceTo(player.pos) < 40) c.group.userData.update(dt);
      story.update(dt, t);
      const open = story.stage >= story.idx('done');
      door.visible = open; doorLight.intensity = open ? 5 + Math.sin(t * 3) : 0;
      if (open) doorMat.opacity = 0.4 + Math.sin(t * 2.5) * 0.12;
    },
    map: {
      radius: WORLD2_RADIUS, paths: PATHS2, riverX: null,
      places: [
        { name: 'Forest Edge', p: Z2.edge, r: Z2.edgeR, color: '#5f9a7a' },
        { name: "Mira's Hut", p: Z2.hut, r: 6, color: '#ffb35a' },
        { name: 'Corrupted Grove', p: Z2.grove, r: Z2.groveR, color: '#8a4dc2' },
        { name: 'Root Hollow', p: Z2.hollow, r: Z2.hollowR, color: '#6b4a35' },
      ],
      gates: [{ name: 'To Starter Meadow', p: Z2.gate, color: '#3cd6ff' }, ...(story.stage >= story.idx('done') ? [{ name: 'To the Capital', p: CAPITAL_DOOR, color: '#ffd36b' }] : [])],
      lair: Z2.hollow,
      // Boss lair state for the map: sealed until every Null enemy is defeated.
      lock: () => {
        if (story.stage >= story.idx('done')) return { state: 'defeated' };
        if (story.stage >= story.idx('hollow')) return { state: 'open' };
        return { state: 'locked', left: story.guardsLeft };
      },
      cleared: () => story.stage >= story.idx('done'),
      ground: '#2c4a3a',
      crystals: () => world.crystals.map(c => c.pos),
      chests: () => chests.map(c => ({ p: c.pos3, opened: c.opened, need: c.secret === 'noclip' ? 'needs /noclip' : c.secret === 'ledge' ? 'needs /doublejump' : null })),
      objective: () => story.objectivePos(),
    },
  };
}
