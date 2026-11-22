// Zone 4 story: The Unfinished Zone. The Placeholder town, the TODO bridge, the Asset Graveyard,
// the climb to NOVA's Core, NOVA, and the ending choice (with a secret third ending for players
// who found every chest in Aster).
import * as THREE from 'three';
import { sfx, music } from './audio.js?v=34';
import { Z4, ISLANDS } from './world4.js?v=34';

const STAGES = [
  { id: 'arrive', title: 'The Edge of the Map', text: 'Look around the unfinished world' },
  { id: 'town', title: 'Placeholder Town', text: 'Defeat every Placeholder in the test town' },
  { id: 'bridge', title: 'TODO: Finish Bridge', text: 'PATCH the unfinished bridge on the west edge' },
  { id: 'graveyard', title: 'The Asset Graveyard', text: 'Cross the bridge and clear the Asset Graveyard' },
  { id: 'climb', title: "NOVA's Core", text: 'Jump up the floating tiles to NOVA\'s Core (north)' },
  { id: 'boss', title: 'The System', text: 'Defeat NOVA' },
  { id: 'choice', title: 'The Choice', text: 'Decide the fate of Aster' },
  { id: 'done', title: 'Aster', text: 'Explore Aster, or start New Game+ (Menu > Settings)' },
];
// Chests in every zone (for the secret ending).
export const CHEST_TOTALS = { z1: 4, z2: 4, z3: 4, z4: 2 };
export function allChestsFound(profile) {
  return Object.entries(CHEST_TOTALS).every(([z, n]) => (profile.d.zones[z]?.flags?.chests || []).length >= n);
}

export class Story4 {
  constructor(ctx) {
    this.ctx = ctx; // { player, guide, dialogue, hud, world, npcs, boss, enemies, effects, scene, rig, profile, pet, ally, travel, endings }
    this.stage = 0; this.crystal = -1; this.busy = false; this.flags = {};
    this.#marker();
    const { boss, hud, world } = ctx;
    boss.onDefeat = () => this.#onBossDefeated();
    boss.onOutOfReach = () => hud.system('NOVA is out of reach!\nDodge its attacks - it comes DOWN to reload', 2.4);
    boss.onReload = glitch => hud.system(glitch ? 'NOVA IS RELOADING - ITS EYE IS GLITCHED!\nPATCH it, then attack!' : 'NOVA IS RELOADING!\nAttack the eye NOW!', 2.6);
    boss.onBeam = () => hud.system('DELETE BEAM! JUMP over it!', 1.6);
    boss.onSummon = () => hud.system('NOVA SPAWNS PLACEHOLDERS!', 2);
    boss.onEnrage = () => hud.system('NOVA IS ENRAGED!\nDouble beams - faster error rain', 2.8);
    this.islandA = ctx.enemies.filter(e => !e.isBoss && Math.hypot(e.home.x - ISLANDS.A.c.x, e.home.z - ISLANDS.A.c.z) < 40);
    this.islandB = ctx.enemies.filter(e => !e.isBoss && Math.hypot(e.home.x - ISLANDS.B.c.x, e.home.z - ISLANDS.B.c.z) < 30);
    this.guards = [...this.islandA, ...this.islandB];
    ctx.patchables = [
      { get pos() { return Z4.bridgeEnd; }, range: 4, canPatch: () => !world.bridgeDone && this.stage >= this.idx('bridge'), patch: () => { this.#bridgeFixed(); return true; }, patchMsg: 'BRIDGE COMPILED!' },
      ...(ctx.ally ? [ctx.ally] : []),
    ];
  }
  idx(id) { return STAGES.findIndex(s => s.id === id); }
  get id() { return STAGES[this.stage].id; }
  left(list) { return list.filter(e => e.alive).length; }
  get guardsLeft() { return this.left(this.guards); }
  #nearest(list) {
    let best = null, bd = 1e9;
    for (const e of list) if (e.alive) { const d = e.pos.distanceTo(this.ctx.player.pos); if (d < bd) { bd = d; best = e; } }
    return best?.pos || null;
  }

  save() {
    const prof = this.ctx.profile;
    if (this.idx('done') > this.stage) this.flags.cleared = this.guards.map((e, i) => (e.alive ? -1 : i)).filter(i => i >= 0);
    Object.assign(prof.zone('z4'), { stage: this.stage, stageId: this.id, crystal: this.crystal, flags: this.flags });
    this.ctx.player.syncProfile?.();
    prof.save();
  }
  respawnPoint() {
    const c = this.ctx.world.crystals[this.crystal];
    if (c) return c.pos.clone().add(new THREE.Vector3(1.6, 0, 1.6));
    return Z4.arrive.clone();
  }

  async start() {
    const { player, guide, profile, hud, pet, ally, world } = this.ctx;
    const z = profile.zone('z4');
    this.stage = z.stageId ? Math.max(0, this.idx(z.stageId)) : 0;
    if (this.id === 'boss') this.stage = this.idx('climb'); // saved mid-fight: climb again
    if (this.id === 'choice') this.stage = this.idx('choice');
    this.crystal = z.crystal ?? -1; this.flags = z.flags || {};
    for (const i of this.flags.cleared || []) { const e = this.guards[i]; if (e) { e.dead = true; e.deathT = 9; e.respawnT = 1e9; e.group.visible = false; } }
    player.refreshStats(); player.hp = player.maxHp;
    hud.tutorialShown = true;
    this.#applyStage();
    const fromGate = profile.d.arrive === 'gate'; delete profile.d.arrive;
    if (fromGate || this.crystal < 0) player.spawnAt(Z4.arrive, Math.PI); else player.spawnAt(this.respawnPoint(), Math.PI);
    guide.teleport(player.pos);
    if (ally) { ally.follow(); ally.teleportTo(player.pos.clone().add(new THREE.Vector3(1.5, 0, 1.5))); }
    if (profile.d.pet === 'pip') pet.follow(player);
    if (this.stage === 0) { await this.#intro(); return; }
    if (this.id === 'choice') { this.ctx.endings.choose(); return; }
    hud.system(fromGate ? '> ENTERING THE UNFINISHED ZONE' : '> SAVE LOADED\n> Welcome back, Player One', 2.5);
  }

  async #intro() {
    const ally = 'VICTORY';
    await wait(700);
    await this.#say([
      { who: 'GUIDE', text: 'Jasper... this is the edge of the map. The part of Aster nobody ever finished.' },
      { who: 'JASPER', text: 'Grey boxes. Labels. "tree_placeholder_02"... It looks like a level editor.' },
      { who: ally, text: 'This is where the Null comes from. And somewhere above us is the one who sends it: NOVA.' },
      { who: 'GUIDE', text: 'NOVA is the system that closes a game when it is finished. To NOVA, Aster is a file to be deleted.' },
      { who: 'GUIDE', text: 'Careful: there is nothing under these islands. If you fall, I can pull you back, but it will hurt.' },
    ]);
    this.#setStage('town');
  }

  async #say(lines) {
    const { dialogue, guide } = this.ctx;
    guide.talking = true; this.busy = true;
    await dialogue.play(lines);
    guide.talking = false; this.busy = false;
  }
  #setStage(id) {
    this.stage = this.idx(id);
    this.#applyStage(); this.save();
    const s = STAGES[this.stage];
    if (id !== 'boss' && id !== 'done' && id !== 'choice') this.ctx.hud.questToast(s.title, s.text);
  }
  #applyStage() {
    const { player, hud, world } = this.ctx;
    const done = this.stage >= this.idx('choice');
    for (const e of this.guards) e.holdRespawn = !done;
    world.setBridge(this.stage > this.idx('bridge'));
    world.setStairs(this.stage >= this.idx('climb'));
    player.unlocks.sword = player.unlocks.patch = player.unlocks.skill = true;
    hud.setUnlocks(player.unlocks);
    player.char.blade.visible = true;
  }
  #marker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x29e6ff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 30; g.add(beam);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0x29e6ff })); gem.position.y = 4; g.add(gem); this.markerGem = gem;
    this.markerObj = g; this.ctx.scene.add(g);
  }

  objectivePos() {
    switch (this.id) {
      case 'town': return this.#nearest(this.islandA);
      case 'bridge': return Z4.bridgeEnd;
      case 'graveyard': return this.ctx.world.bridgeDone && this.ctx.player.pos.x > -50 ? ISLANDS.B.c : this.#nearest(this.islandB);
      case 'climb': return Z4.core;
      default: return null;
    }
  }

  async talk(npc) {
    const lines = {
      town: 'Grey people with question marks for faces... Do not let them get close, Jasper.',
      graveyard: 'Everything that was cut from the game ends up here. Even me, almost.',
      climb: 'NOVA is up there. Whatever happens next... I am glad we came this far together.',
    }[this.id] || 'Lead the way, Player One.';
    this.talkNpc = npc; npc.face(this.ctx.player.pos);
    await this.#say([{ who: 'VICTORY', text: lines }]);
    this.talkNpc = null;
  }
  async gate() {
    await this.#say([{ who: 'GUIDE', text: 'The spawn pad leads back to the throne room in the Capital. Your progress is saved.' }]);
    sfx('gate'); this.ctx.travel('z3', 'rift');
  }

  // ---------- Events ----------
  onKill(e) {
    if (e.isBoss || e.minion) return;
    if (this.id === 'town') {
      const left = this.left(this.islandA);
      this.ctx.hud.questProgress(left ? `${left} left in town` : 'Town cleared!');
      if (!left) this.#townCleared();
    } else if (this.id === 'graveyard') {
      const left = this.left(this.islandB);
      this.ctx.hud.questProgress(left ? `${left} left in the graveyard` : 'Graveyard cleared!');
      if (!left) this.#graveyardCleared();
    }
    if (this.idx('choice') > this.stage) this.save();
  }
  async #townCleared() {
    this.#setStage('bridge');
    await this.#say([
      { who: 'GUIDE', text: 'Town cleared! West of here is a bridge with a sign: "TODO: finish bridge". Half of it was never built.' },
      { who: 'GUIDE', text: 'But you can PATCH unfinished things... Walk to the end of the bridge and PATCH it!' },
    ]);
  }
  async #bridgeFixed() {
    this.ctx.world.setBridge(true); sfx('unlock');
    this.ctx.effects.burst(Z4.bridgeEnd.clone().add(new THREE.Vector3(0, 2, 0)), 40, [1, 2], 8);
    this.#setStage('graveyard');
    await this.#say([{ who: 'GUIDE', text: 'Bridge compiled! The Asset Graveyard is on the other side. Every enemy there must fall before the way to NOVA opens.' }]);
  }
  async #graveyardCleared() {
    this.#setStage('climb'); sfx('glitchBig');
    await this.#say([
      { who: 'GUIDE', text: 'That was the last one! Look north: a staircase of floating tiles to NOVA\'s Core just loaded in!' },
      { who: 'GUIDE', text: 'JUMP from tile to tile. If you fall, I will pull you back to the last tile you stood on.' },
    ]);
  }

  async #startBoss() {
    const { world, boss, hud, ally } = this.ctx;
    this.#setStage('boss');
    boss.reset(); boss.group.visible = true;
    music('boss', 1.2);
    const allyName = 'VICTORY';
    await this.#say([
      { who: 'NOVA', text: 'PLAYER DETECTED. ASTER: 99% COMPLETE. CLOSING FILE.', glitch: true },
      { who: 'NOVA', text: 'Every story ends. Every world is saved, and closed, and never opened again. That is what FINISHED means.', glitch: true },
      { who: allyName, text: 'Then we will write a different ending. Jasper, it stays out of reach: dodge until it comes down to reload, then hit its eye!' },
      { who: 'GUIDE', text: 'Red squares: error windows will fall there. Red line: the DELETE beam, JUMP over it. If its eye flickers, PATCH it!' },
    ]);
    world.setBarrier(true);
    boss.activate(); hud.bossBar(true, boss);
    ally?.castBarrier?.();
  }

  async #onBossDefeated() {
    const { world, hud, player, profile } = this.ctx;
    hud.bossBar(false); world.setBarrier(false); music('title', 3);
    player.gainXp(800); profile.d.debugPoints++;
    for (const e of this.ctx.enemies) if (e.minion && e.alive) e.takeHit(1e6, e.pos);
    this.flags.cleared = [];
    this.#setStage('choice');
    await wait(2000);
    const allyName = 'VICTORY';
    await this.#say([
      { who: 'NOVA', text: '...ERROR. I was only... doing my job. A finished game must close.', glitch: true },
      { who: 'SYSTEM', text: '+800 XP and a DEBUG POINT.' },
      { who: 'GUIDE', text: 'Jasper. NOVA is down. The system is waiting for an answer. It is asking YOU.' },
      { who: allyName, text: 'If you finish the game, you go home and Aster closes. If you stay, Aster lives... and you never leave. Whatever you choose, I will not blame you.' },
    ]);
    this.ctx.endings.choose();
  }

  finish() { this.#setStage('done'); this.busy = false; }

  // ---------- Per frame ----------
  update(dt, t) {
    const { player, hud, world, boss } = this.ctx;
    this.playTime = (this.playTime || 0) + dt;
    const target = this.objectivePos();
    this.markerObj.visible = !!target && !this.ctx.dialogue.active;
    const st = STAGES[this.stage];
    if (target) {
      this.markerObj.position.set(target.x, world.groundAt(target.x, target.z), target.z);
      this.markerGem.rotation.y += dt * 2; this.markerGem.position.y = 4 + Math.sin(t * 2) * 0.3;
      const d = Math.round(Math.hypot(target.x - player.pos.x, target.z - player.pos.z));
      const text = this.id === 'town' ? `Defeat every Placeholder in the test town: ${this.left(this.islandA)} left` : this.id === 'graveyard' && this.ctx.world.bridgeDone ? `Clear the Asset Graveyard: ${this.left(this.islandB)} left` : st.text;
      hud.quest(st.title, text, d);
    } else hud.quest(st.title, st.text, null);
    // Save crystals.
    world.crystals.forEach((c, i) => {
      if (Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 2.4 && Math.abs(player.pos.y - world.groundAt(c.pos.x, c.pos.z)) < 1.5 && (this.crystal !== i || player.hp < player.maxHp)) {
        this.crystal = i; player.hp = player.maxHp; player.stamina = 100;
        this.save(); hud.system('> SAVE CRYSTAL: progress saved, HP restored', 2); sfx('save');
      }
    });
    if (this.busy) return;
    if (this.id === 'climb' && Math.hypot(player.pos.x - Z4.core.x, player.pos.z - Z4.core.z) < Z4.arenaR - 3 && player.pos.y > ISLANDS.C.y - 1) this.#startBoss();
    if (this.id === 'boss' && !player.alive) {
      world.setBarrier(false); hud.bossBar(false); music('glitchwood', 2);
      boss.reset();
      for (const e of this.ctx.enemies) if (e.minion) { e.dead = true; e.noRespawn = true; e.group.visible = false; e.gone = true; }
      this.stage = this.idx('climb'); this.save();
      hud.system('NOVA was too strong...\nDodge, wait for it to RELOAD, then hit the eye!' + (this.ctx.profile.d.swordLevel < 5 ? "\nTip: upgrade your sword at Bram's forge in Starter Meadow" : ''), 4.5);
    }
  }
}

const FAST = new URLSearchParams(location.search).has('fast');
const wait = ms => new Promise(r => setTimeout(r, FAST ? 0 : ms));
