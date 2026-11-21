// Zone 2 story: Glitchwood Forest. Old Mira, Area Patch, the Console, the Corrupted Grove,
// the Lost Pixel Fox side quest and the Thornwraith.
import * as THREE from 'three';
import { Z2 } from './world2.js?v=13';

const STAGES = [
  { id: 'arrive', title: 'The Spreading Null', text: 'Follow the path into Glitchwood' },
  { id: 'findMira', title: 'The Forgotten Beta', text: 'Follow the lantern light west and find who lives here' },
  { id: 'grove', title: 'The Spreading Null', text: 'Clear the Corrupted Grove east of the path' },
  { id: 'hollow', title: 'Roots of the Null', text: 'Go north to Root Hollow' },
  { id: 'boss', title: 'Roots of the Null', text: 'Defeat the Thornwraith' },
  { id: 'done', title: 'Glitchwood Cleared', text: 'Explore: find the hidden chests and help Pip' },
];
const GROVE_GOAL = 8;

export class Story2 {
  constructor(ctx) {
    this.ctx = ctx; // { player, guide, dialogue, hud, world, npcs, boss, enemies, effects, scene, rig, profile, pet }
    this.stage = 0; this.kills = 0; this.crystal = -1; this.busy = false; this.flags = {};
    this.#marker();
    const { pet, boss, hud } = ctx;
    this.pipTarget = {
      get pos() { return pet.pos; }, range: 0.5, patchMsg: 'PIP FIXED!',
      canPatch: () => pet.mode === 'stuck', patch: () => { this.#onPipFixed(); return true; },
    };
    ctx.patchables = [this.pipTarget];
    boss.onDefeat = () => this.#onBossDefeated();
    boss.onUnfinished = () => hud.system('ITS ARM FAILED TO LOAD!\nIt resists everything - PATCH it!', 3);
    boss.onSplit = () => hud.system('THE THORNWRAITH SPLITS IN THREE!\nOnly the real one casts a shadow', 3.2);
    boss.onReveal = () => hud.system('COPIES DELETED!', 1.6);
  }

  idx(id) { return STAGES.findIndex(s => s.id === id); }
  get id() { return STAGES[this.stage].id; }
  get mira() { return this.ctx.npcs.find(n => n.name === 'MIRA'); }

  save() {
    const prof = this.ctx.profile;
    Object.assign(prof.zone('z2'), { stage: this.stage, kills: this.kills, crystal: this.crystal, flags: this.flags });
    this.ctx.player.syncProfile?.();
    prof.save();
  }

  respawnPoint() {
    const c = this.ctx.world.crystals[this.crystal];
    if (c) return c.pos.clone().add(new THREE.Vector3(1.6, 0, 1.6));
    return Z2.arrive.clone();
  }

  async start() {
    const { player, guide, profile, hud, pet } = this.ctx;
    const z = profile.zone('z2');
    this.stage = z.stage || 0; this.kills = z.kills || 0; this.crystal = z.crystal ?? -1; this.flags = z.flags || {};
    player.refreshStats(); player.hp = player.maxHp;
    hud.tutorialShown = true; // learned in Zone 1
    this.#applyStage();
    const fromGate = profile.d.arrive === 'gate'; delete profile.d.arrive;
    if (fromGate || this.crystal < 0) player.spawnAt(Z2.arrive, Math.PI);
    else player.spawnAt(this.respawnPoint(), Math.PI);
    guide.teleport(player.pos);
    if (this.flags.pip === 'asked') pet.stuckAt(Z2.pip, this.ctx.world);
    if (this.flags.pip === 'found') pet.follow(player);
    if (this.stage === 0) { await this.#intro(); return; }
    hud.system(fromGate ? '> ENTERING GLITCHWOOD FOREST' : '> SAVE LOADED\n> Welcome back, Player One', 2.5);
  }

  async #intro() {
    await wait(600);
    await this.#say([
      { who: 'GUIDE', text: 'Glitchwood Forest. My map data says this place was green and bright. Now look at it...' },
      { who: 'JASPER', text: 'Those purple cracks. It looks like something is eating the textures.' },
      { who: 'GUIDE', text: 'The NULL. Corruption. And it is spreading from deeper in the game.' },
      { who: 'GUIDE', text: 'Careful: creatures here are tougher. NULL WOLVES hunt in packs. Dodge their pounce, then hit back while they recover!' },
      { who: 'GUIDE', text: 'Look, a light to the west. Someone lives here?' },
    ]);
    this.#setStage('findMira');
  }

  #setStage(id) {
    this.stage = this.idx(id);
    this.#applyStage();
    this.save();
    const s = STAGES[this.stage];
    if (id !== 'boss' && id !== 'done') this.ctx.hud.questToast(s.title, s.text);
  }

  #applyStage() {
    const { player, hud } = this.ctx;
    player.unlocks.sword = player.unlocks.patch = player.unlocks.skill = true;
    hud.setUnlocks(player.unlocks);
    player.char.blade.visible = true;
  }

  #marker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x29e6ff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 20; g.add(beam);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0x29e6ff }));
    gem.position.y = 4; g.add(gem); this.markerGem = gem;
    this.markerObj = g; this.ctx.scene.add(g);
  }

  objectivePos() {
    switch (this.id) {
      case 'arrive': return Z2.edge;
      case 'findMira': return this.mira.pos;
      case 'grove': return this.kills >= GROVE_GOAL ? null : Z2.grove;
      case 'hollow': return Z2.hollow;
      default: return this.flags.pip === 'found' ? this.mira.pos : null;
    }
  }

  async #say(lines) {
    const { dialogue, guide } = this.ctx;
    guide.talking = true; this.busy = true;
    await dialogue.play(lines);
    guide.talking = false; this.busy = false;
  }

  // ---------- Talking ----------
  async talk(npc) {
    const { player } = this.ctx;
    this.talkNpc = npc;
    player.facing = Math.atan2(npc.pos.x - player.pos.x, npc.pos.z - player.pos.z);
    npc.face(player.pos); npc.play(npc.talkAnim);
    if (npc.name === 'MIRA') await this.#talkMira();
    npc.targetRy = null; npc.play(npc.opts.anim || 'Idle_Loop');
    this.talkNpc = null;
  }

  async #talkMira() {
    const { hud, profile, player, pet } = this.ctx;
    if (this.id === 'findMira' || this.id === 'arrive') {
      await this.#say([
        { who: 'MIRA', text: 'A Player. Here. After all this time...' },
        { who: 'JASPER', text: 'You know what I am?' },
        { who: 'MIRA', text: 'I am Mira. I was written for the beta. Then the Maker cut me from the story... but he forgot to delete me.' },
        { who: 'MIRA', text: 'So I stayed here in the trees, where nobody looks.' },
        { who: 'GUIDE', text: 'She is not in my database! She is... unlisted!' },
        { who: 'MIRA', text: 'Your Patch is strong, Player, but you fix one bug at a time. Let me show you how to fix many at once.' },
        { who: 'SYSTEM', text: 'You learned AREA PATCH: patching a glitched enemy also fixes every glitched enemy near it.' },
        { who: 'MIRA', text: 'And take this. The Maker\'s own tool. He called it the CONSOLE.' },
        { who: 'SYSTEM', text: 'CONSOLE unlocked! Tap CONSOLE (C on PC) to run cheat commands. Unlock commands with DEBUG POINTS. +1 DEBUG POINT.' },
        { who: 'MIRA', text: 'Some places here are blocked by bad data: walls that should not exist. The Console can take you through them.' },
        { who: 'MIRA', text: 'The Null is strongest in the grove to the east. Clear it, and the forest may breathe again.' },
        { who: 'MIRA', text: 'One more thing... my little fox, PIP, ran into the grove when the Null came. If you find him, bring him home.' },
      ]);
      profile.d.areaPatch = true; profile.d.consoleUnlocked = true; profile.d.debugPoints++;
      this.flags.pip = 'asked'; pet.stuckAt(Z2.pip, this.ctx.world);
      this.ctx.console.refresh();
      hud.newAbility('AREA PATCH + CONSOLE', 'Patch fixes every glitched enemy nearby. CONSOLE runs cheat commands.');
      this.#setStage('grove');
      return;
    }
    if (this.flags.pip === 'found') {
      await this.#say([
        { who: 'MIRA', text: 'Pip! You found him!' },
        { who: 'MIRA', text: '...He won\'t leave your side. I think he chose you, Player. Take him with you. He has a good nose for treasure.' },
        { who: 'SYSTEM', text: 'PIP joined you! He follows you everywhere and fetches loot from further away. +150 XP' },
        { who: 'MIRA', text: 'The Maker left because something in this game scared him. I never learned what. Be careful.' },
      ]);
      this.flags.pip = 'done'; profile.d.pet = 'pip'; player.gainXp(150); this.save();
      return;
    }
    const lines = {
      grove: 'The grove is east of the path. Use Area Patch when the glitched ones bunch up.',
      hollow: 'Root Hollow is north. The guardian there was never finished... like me.',
      boss: 'Go. Be quick.',
      done: 'The forest is quieter now. Thank you, Player. Whatever scared the Maker... it is in the Capital.',
    }[this.id] || 'Be careful out there.';
    await this.#say([{ who: 'MIRA', text: lines }]);
  }

  async #onPipFixed() {
    const { pet, player, hud } = this.ctx;
    this.flags.pip = 'found'; pet.follow(player); this.save();
    await wait(500);
    await this.#say([
      { who: 'GUIDE', text: 'A fox! He was stuck in a glitch loop. He looks... grateful?' },
      { who: 'JASPER', text: 'You must be Pip. Come on, let\'s get you home.' },
    ]);
    hud.questToast('Lost Pixel Fox', 'Bring Pip back to Old Mira');
  }

  async gate() {
    await this.#say([{ who: 'GUIDE', text: 'This gate leads back to Starter Meadow. Your progress is saved.' }]);
    this.ctx.travel('z1');
  }

  // ---------- Events ----------
  onKill(e) {
    if (this.id === 'grove' && !e.isBoss && !e.minion) {
      this.kills++;
      this.ctx.hud.questProgress(`Null enemies defeated: ${Math.min(this.kills, GROVE_GOAL)} / ${GROVE_GOAL}`);
      if (this.kills >= GROVE_GOAL) this.#groveDone();
    }
  }

  async #groveDone() {
    await wait(600);
    await this.#say([
      { who: 'GUIDE', text: 'The cracks are fading here! But my scan says the Null is not coming from the grove.' },
      { who: 'GUIDE', text: 'It comes from the north. A place called ROOT HOLLOW. Something big is down there.' },
    ]);
    this.#setStage('hollow');
  }

  async #startBoss() {
    const { world, boss, hud } = this.ctx;
    this.#setStage('boss');
    world.setBarrier(true);
    // Other monsters leave the arena: this fight is one on one.
    for (const e of this.ctx.enemies) if (!e.isBoss && !e.isClone && e.alive && e.pos.distanceTo(Z2.hollow) < Z2.hollowR + 4) { e.dead = true; e.deathT = 1; e.respawnT = 40; e.group.visible = false; }
    boss.reset(); boss.activate();
    hud.bossBar(true, boss);
    await this.#say([
      { who: 'THORNWRAITH', text: 'Leave... This place... was never... finished...', glitch: true },
      { who: 'GUIDE', text: 'Its right arm is missing its texture! When the arm glitches, use PATCH to finish it and expose the heart!' },
      { who: 'GUIDE', text: 'And watch the ground: red circles mean roots are coming up!' },
    ]);
  }

  async #onBossDefeated() {
    const { world, hud, player, profile } = this.ctx;
    hud.bossBar(false);
    world.setBarrier(false);
    player.gainXp(300);
    profile.d.debugPoints++;
    this.#setStage('done');
    await wait(1600);
    await this.#say([
      { who: 'THORNWRAITH', text: 'I was made... to protect this forest... They left me... half made...', glitch: true },
      { who: 'SYSTEM', text: '+300 XP and a DEBUG POINT. It dropped loot: grab it!' },
      { who: 'GUIDE', text: 'Jasper... the Null did not start here either. The signal comes from the CAPITAL OF ASTER.' },
      { who: 'JASPER', text: 'Then that\'s where we go next.' },
    ]);
    hud.zoneComplete({ level: player.level, time: this.playTime, num: 'ZONE 2', title: 'GLITCHWOOD FOREST CLEARED', next: 'Next: <b>Capital of Aster</b> (coming in the next milestone)' });
  }

  // ---------- Per frame ----------
  update(dt, t) {
    const { player, hud, world } = this.ctx;
    this.playTime = (this.playTime || 0) + dt;
    const target = this.objectivePos();
    this.markerObj.visible = !!target && !this.ctx.dialogue.active;
    const st = STAGES[this.stage];
    if (target) {
      this.markerObj.position.set(target.x, world.groundAt(target.x, target.z), target.z);
      this.markerGem.rotation.y += dt * 2; this.markerGem.position.y = 4 + Math.sin(t * 2) * 0.3;
      const d = Math.round(Math.hypot(target.x - player.pos.x, target.z - player.pos.z));
      const pipBack = this.id === 'done' && this.flags.pip === 'found';
      hud.quest(pipBack ? 'Lost Pixel Fox' : st.title, pipBack ? 'Bring Pip back to Old Mira' : st.text, d);
    } else hud.quest(st.title, this.id === 'grove' ? `Null enemies defeated: ${Math.min(this.kills, GROVE_GOAL)} / ${GROVE_GOAL}` : st.text, null);
    // Save crystals.
    world.crystals.forEach((c, i) => {
      if (c.pos.distanceTo(player.pos) < 2.4 && (this.crystal !== i || player.hp < player.maxHp)) {
        this.crystal = i; player.hp = player.maxHp; player.stamina = 100;
        this.save(); hud.system('> SAVE CRYSTAL: progress saved, HP restored', 2);
        this.ctx.effects.burst(c.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), 16, [0, 2], 3);
      }
    });
    if (this.busy) return;
    // One-time hints near the Console secrets.
    if (!this.flags.hintWall && player.pos.distanceTo(world.glitchWallPos) < 8) {
      this.flags.hintWall = true; this.save();
      this.#say([{ who: 'GUIDE', text: 'A wall of corrupted data. It is solid... unless you run /noclip from the CONSOLE.' }]);
    }
    const lp = new THREE.Vector3(Z2.ledge.x, player.pos.y, Z2.ledge.z);
    if (!this.flags.hintLedge && player.pos.distanceTo(lp) < 7) {
      this.flags.hintLedge = true; this.save();
      this.#say([{ who: 'GUIDE', text: 'A chest on top of that stump! Too high for one jump... /doublejump would do it.' }]);
    }
    if (this.id === 'hollow' && player.pos.distanceTo(Z2.hollow) < Z2.hollowR - 3) this.#startBoss();
    if (this.id === 'boss' && !player.alive) {
      const { boss } = this.ctx;
      world.setBarrier(false); hud.bossBar(false);
      boss.reset();
      this.stage = this.idx('hollow'); this.save();
      hud.system('The Thornwraith was too strong...\nTry again: PATCH its arm when it glitches!', 3.5);
    }
  }
}

const FAST = new URLSearchParams(location.search).has('fast');
const wait = ms => new Promise(r => setTimeout(r, FAST ? 0 : ms));
