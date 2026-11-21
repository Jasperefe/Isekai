// Zone 1 story: quests, cutscenes, objective markers, unlocks and save/load.
import * as THREE from 'three';
import { Z1 } from './world.js?v=7';
import { Slime } from './enemies.js?v=7';

const SAVE_KEY = 'isekai_save_v1';

// Quest stages in order.
const STAGES = [
  { id: 'intro', title: 'Wake Up, Player One' },
  { id: 'village', title: 'Wake Up, Player One', text: 'Follow the path to the village' },
  { id: 'bram', title: 'A Loop Too Long', text: 'Talk to Bram the blacksmith' },
  { id: 'patchBram', title: 'A Loop Too Long', text: 'Use PATCH on Bram to fix his dialogue loop' },
  { id: 'slimes', title: 'Slimes in the Field', text: 'Defeat slimes in the east field' },
  { id: 'bridge', title: 'The Broken Bridge', text: 'Go to the old bridge west of the village' },
  { id: 'patchBridge', title: 'The Broken Bridge', text: 'Use PATCH to rebuild the bridge' },
  { id: 'pond', title: 'Big Slime Problem', text: 'Cross the bridge and enter Slime Pond' },
  { id: 'boss', title: 'Big Slime Problem', text: 'Defeat the Slime King' },
  { id: 'done', title: 'Zone 1 Complete', text: 'Explore, or replay the fight with the slimes' },
];
const SLIME_GOAL = 5;

export class Story {
  constructor(ctx) {
    this.ctx = ctx; // { player, guide, dialogue, hud, world, npcs, boss, enemies, effects, scene, rig }
    this.stage = 0; this.kills = 0; this.crystal = -1; this.busy = false; this.flags = {};
    this.#marker();
    // Patchable world objects.
    const w = ctx.world;
    this.bridgeTarget = { pos: w.bridgePos.clone(), range: 4, patchMsg: 'BRIDGE RESTORED!', canPatch: () => this.stage === this.idx('patchBridge') && !w.bridgeRepaired, patch: () => { w.repairBridge(ctx.effects); this.#onBridgeFixed(); return true; } };
    ctx.patchables = [...ctx.npcs.filter(n => n.opts.bugged), this.bridgeTarget];
    for (const n of ctx.npcs) n.patchMsg = `${n.name} FIXED!`;
    ctx.npcs.find(n => n.name === 'BRAM').onPatched = () => this.#onBramFixed();
    ctx.npcs.find(n => n.name === 'NIA').onPatched = () => this.#onNiaFixed();
    ctx.boss.onDefeat = () => this.#onBossDefeated();
    ctx.boss.onUnscaled = () => { ctx.hud.system('SLIME KING IS UNSCALED!\nHe resists everything - use PATCH!', 3); };
    ctx.boss.onSummon = i => this.#summon(i);
  }

  idx(id) { return STAGES.findIndex(s => s.id === id); }
  get id() { return STAGES[this.stage].id; }

  // ---------- Save / load ----------
  save() {
    const p = this.ctx.player;
    this.flags.tutorial = this.flags.tutorial || !!this.ctx.hud.tutorialShown;
    const data = { stage: this.stage, kills: this.kills, crystal: this.crystal, level: p.level, xp: p.xp, maxHp: p.maxHp, flags: this.flags };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }

  load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  }

  static clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  respawnPoint() {
    const c = this.ctx.world.crystals[this.crystal];
    if (c) return c.pos.clone().add(new THREE.Vector3(1.6, 0, 1.6));
    return this.stage <= 1 ? Z1.wake.clone() : Z1.village.clone().add(new THREE.Vector3(2, 0, 6));
  }

  // ---------- Start ----------
  async start() {
    const data = this.load();
    const { player, guide, world } = this.ctx;
    if (data && data.stage > 0) {
      this.stage = data.stage; this.kills = data.kills || 0; this.crystal = data.crystal ?? -1; this.flags = data.flags || {};
      this.ctx.hud.tutorialShown = !!this.flags.tutorial || this.stage > this.idx('slimes');
      player.level = data.level || 1; player.xp = data.xp || 0; player.maxHp = data.maxHp || 100; player.hp = player.maxHp;
      this.#applyStage(true);
      player.spawnAt(this.respawnPoint(), Math.PI);
      guide.teleport(player.pos);
      this.ctx.hud.system('> SAVE LOADED\n> Welcome back, Player One', 2.5);
      return;
    }
    // New game: intro cutscene.
    this.stage = 0; this.#applyStage();
    player.spawnAt(Z1.wake, Math.PI);
    guide.teleport(player.pos.clone().add(new THREE.Vector3(0, 0, -3)));
    await this.#intro();
  }

  async #intro() {
    const { player, hud } = this.ctx;
    this.busy = true;
    if (!FAST) await hud.cinematic(['> loading build: Aster_v0.9 ...', '> ERROR: final_chapter.dat not found', '> PLAYER ONE DETECTED', '> Welcome home.']);
    player.playCut('LayToIdle', FAST ? 20 : 0.8);
    await wait(player.cutDur * 1000 + 200);
    await this.#say([
      { who: 'JASPER', text: 'Ugh... where am I? I was testing that weird build, and then...' },
      { who: 'GUIDE', text: 'HELLO, PLAYER ONE! Welcome to the world of ASTER! I am GUIDE, your tutorial assistant!' },
      { who: 'JASPER', text: 'A talking cube. Great. Am I... inside the game?' },
      { who: 'GUIDE', text: 'Affirmative! Please complete the FINAL QUEST to win! Error: final quest not found. Error: error not found.' },
      { who: 'GUIDE', text: 'Let\'s start small. There is a village up this path. Follow the marker!' },
    ]);
    this.busy = false;
    this.#setStage('village');
  }

  // ---------- Stage handling ----------
  #setStage(id) {
    this.stage = this.idx(id);
    this.#applyStage();
    this.save();
    const s = STAGES[this.stage];
    if (s.text && id !== 'boss' && id !== 'done') this.ctx.hud.questToast(s.title, s.text);
  }

  // Unlocks and world state that follow from the current stage (also used after loading).
  #applyStage(loading = false) {
    const st = this.stage, { player, world, npcs } = this.ctx;
    player.unlocks.sword = st >= this.idx('slimes');
    player.unlocks.patch = st >= this.idx('patchBram');
    player.unlocks.skill = st >= this.idx('bridge');
    this.ctx.hud.setUnlocks(player.unlocks);
    if (loading) {
      const quietFix = n => { n.bugged = false; n.root.position.set(0, 0, 0); n.play(n.opts.anim || 'Idle_Loop'); };
      if (st > this.idx('patchBram')) quietFix(npcs.find(n => n.name === 'BRAM'));
      if (this.flags.nia) quietFix(npcs.find(n => n.name === 'NIA'));
      if (st > this.idx('patchBridge')) { world.repairBridge(); }
    }
    if (!player.unlocks.sword && player.armed) player.char.sheathe();
    player.char.blade.visible = player.unlocks.sword;
  }

  #marker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x29e6ff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 20; g.add(beam);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0x29e6ff }));
    gem.position.y = 4; g.add(gem); this.markerGem = gem;
    this.markerObj = g; this.ctx.scene.add(g);
  }

  #objectivePos() {
    const { npcs, world } = this.ctx;
    switch (this.id) {
      case 'village': return Z1.village;
      case 'bram': case 'patchBram': return npcs.find(n => n.name === 'BRAM').pos;
      case 'slimes': return this.kills >= SLIME_GOAL ? null : Z1.field;
      case 'bridge': case 'patchBridge': return world.bridgePos;
      case 'pond': return Z1.arena;
      case 'boss': return null;
      default: return null;
    }
  }

  async #say(lines, noBlock = false) {
    const { dialogue, guide } = this.ctx;
    guide.talking = true;
    if (noBlock) { this.ctx.hud.subtitle(lines.map(l => l.text).join(' ')); guide.talking = false; return; }
    this.busy = true;
    await dialogue.play(lines);
    guide.talking = false; this.busy = false;
  }

  // ---------- Talking ----------
  async talk(npc) {
    const { player } = this.ctx;
    this.talkNpc = npc;
    player.facing = Math.atan2(npc.pos.x - player.pos.x, npc.pos.z - player.pos.z);
    npc.face(player.pos); npc.play(npc.bugged ? npc.opts.bugged.anim : npc.talkAnim);
    if (npc.name === 'BRAM') await this.#talkBram(npc);
    else if (npc.name === 'NIA') await this.#talkNia(npc);
    else if (npc.name === 'TOMM') await this.#talkTomm(npc);
    npc.targetRy = null; if (!npc.bugged) npc.play(npc.opts.anim || 'Idle_Loop');
    this.talkNpc = null;
  }

  async #talkBram(npc) {
    if (npc.bugged) {
      await this.#say([
        { who: 'BRAM', text: 'Welcome to my forge, trav— Welcome to my forge, trav— Welcome to my forge, trav—', glitch: true },
        { who: 'BRAM', text: 'Welcome to my forge, trav— Welcome to my forge, trav—', glitch: true },
        { who: 'JASPER', text: '...He\'s stuck. Like a broken NPC in a bad build.' },
        { who: 'GUIDE', text: 'Dialogue loop detected! Wait... YOU can see the bug? Players are not supposed to see bugs!' },
        { who: 'GUIDE', text: 'Try this: point at him and press PATCH. It is a debug command. It fixes broken things!' },
      ]);
      if (this.id === 'bram') this.#setStage('patchBram');
      return;
    }
    if (this.id === 'patchBram' || !this.flags.bramThanked) return;
    await this.#say([{ who: 'BRAM', text: this.id === 'done' ? 'You beat the Slime King? Ha! I knew that blade was in good hands.' : 'Keep that blade sharp, friend. The slimes have been nasty since the "glitch" started.' }]);
  }

  async #onBramFixed() {
    this.flags.bramThanked = true;
    const { player, hud } = this.ctx;
    await wait(700);
    await this.#say([
      { who: 'BRAM', text: '—eler! Whoa. My head is clear for the first time in... years? I\'ve been saying the same line forever!' },
      { who: 'BRAM', text: 'You fixed me, stranger. Take this. I forged it the day the sky started tearing. Never knew who it was for.' },
      { who: 'SYSTEM', text: 'You got the DEBUG BLADE!' },
      { who: 'GUIDE', text: 'A weapon! Slimes are taking over the east field. Let\'s test it on them!' },
    ]);
    player.char.blade.visible = true;
    player.unlocks.sword = true; hud.setUnlocks(player.unlocks);
    hud.newAbility('DEBUG BLADE', 'Tap ATK to chain up to 8 moves. HVY, BLOCK and SWORD unlocked.');
    this.#setStage('slimes');
  }

  async #talkNia(npc) {
    if (npc.bugged) {
      await this.#say([
        { who: 'NIA', text: 'Help! I walked into this wall and now I can\'t get out! My legs are INSIDE the wall!', glitch: true },
        { who: 'GUIDE', text: 'Clipping bug! Classic. If PATCH works on people... try it!' },
      ]);
      return;
    }
    await this.#say([{ who: 'NIA', text: 'Thanks again! I\'m never leaning on a wall again.' }]);
  }

  async #onNiaFixed() {
    this.flags.nia = true;
    const npc = this.ctx.npcs.find(n => n.name === 'NIA');
    npc.root.position.set(0, 0, 0); npc.group.position.copy(npc.pos);
    await wait(500);
    await this.#say([{ who: 'NIA', text: 'I\'m free! Thank you! Here, take this, I found it stuck in the wall with me.' }, { who: 'SYSTEM', text: '+60 XP' }]);
    this.ctx.player.gainXp(60);
    this.save();
  }

  async #talkTomm() {
    this.tommCount = (this.tommCount || 0) + 1;
    const lines = [{ who: 'TOMM', text: 'Nice weather today!' }];
    if (this.tommCount === 2) lines.push({ who: 'GUIDE', text: 'He only has one line. Not a bug. Just... budget.' });
    if (this.tommCount >= 4) lines.push({ who: 'TOMM', text: '...Nice weather today?' });
    await this.#say(lines);
  }

  // ---------- Events ----------
  onKill(e) {
    if (this.id === 'slimes' && !e.isBoss && !e.minion) {
      this.kills++;
      this.ctx.hud.questProgress(`Slimes defeated: ${Math.min(this.kills, SLIME_GOAL)} / ${SLIME_GOAL}`);
      if (this.kills >= SLIME_GOAL) this.#slimesDone();
    }
  }

  async #slimesDone() {
    await wait(600);
    await this.#say([
      { who: 'GUIDE', text: 'Field cleared! You learn fast for a... what are you? A tester?' },
      { who: 'JASPER', text: 'I test games for a living. Find bugs, write reports. Never thought I\'d be IN one.' },
      { who: 'GUIDE', text: 'The villagers say a GIANT slime lives at Slime Pond, past the old bridge west of here. The glitch comes from there.' },
      { who: 'GUIDE', text: 'New skill unlocked: BLADE STORM. Use it when you are surrounded!' },
    ]);
    this.ctx.player.unlocks.skill = true; this.ctx.hud.setUnlocks(this.ctx.player.unlocks);
    this.ctx.hud.newAbility('BLADE STORM', 'SKILL button / R: a 4-hit spin. Costs 40 stamina.');
    this.#setStage('bridge');
  }

  async #onBridgeFixed() {
    await wait(900);
    await this.#say([
      { who: 'GUIDE', text: 'You restored deleted data! I have never seen that before. Who ARE you?' },
      { who: 'JASPER', text: 'Just a guy who reads crash logs. Come on, let\'s find this slime.' },
    ]);
    this.#setStage('pond');
  }

  async #startBoss() {
    const { world, boss, hud } = this.ctx;
    this.#setStage('boss');
    world.setBarrier(true);
    boss.reset(); boss.activate();
    hud.bossBar(true, boss);
    await this.#say([
      { who: 'SLIME KING', text: 'BLORP! Who dares enter MY pond?! I am the SLIME KING! Bow before my... my... HITBOX!', glitch: true },
      { who: 'GUIDE', text: 'Watch the red ring when he jumps: get out of it! And if he grows huge, use PATCH!' },
    ]);
  }

  #summon(i) {
    const { boss, scene, enemies, hud } = this.ctx;
    hud.system('THE KING CALLS HIS MINIONS!', 2);
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = new Slime(scene, boss.pos.clone().add(new THREE.Vector3(Math.cos(a) * 4, 0, Math.sin(a) * 4)), k === 2 && i === 1);
      s.noRespawn = true; s.minion = true;
      enemies.push(s);
    }
  }

  async #onBossDefeated() {
    const { world, hud, player, enemies } = this.ctx;
    hud.bossBar(false);
    world.setBarrier(false);
    for (const e of enemies) if (e.minion && e.alive) e.takeHit(999, e.pos);
    player.gainXp(150);
    this.flags.debugPoints = (this.flags.debugPoints || 0) + 1;
    this.#setStage('done');
    await wait(1500);
    await this.#say([
      { who: 'SLIME KING', text: 'Blorp... my... crown... it was never... meant to... scale...', glitch: true },
      { who: 'SYSTEM', text: '+150 XP. You found a DEBUG POINT (used for Console Commands later).' },
      { who: 'GUIDE', text: 'Jasper... I scanned his data. The glitch was not HIS fault. Something is corrupting this world from far away.' },
      { who: 'GUIDE', text: 'And the only way home for you is to finish the FINAL QUEST... but the final quest was never finished.' },
      { who: 'JASPER', text: 'Then I guess I\'ll have to finish it myself.' },
    ]);
    hud.zoneComplete({ level: player.level, time: this.playTime });
  }

  // ---------- Per frame ----------
  update(dt, t) {
    const { player, hud, world, guide } = this.ctx;
    this.playTime = (this.playTime || 0) + dt;
    // Objective marker + tracker.
    const target = this.#objectivePos();
    this.markerObj.visible = !!target && !this.ctx.dialogue.active;
    if (target) {
      this.markerObj.position.set(target.x, world.groundAt(target.x, target.z), target.z);
      this.markerGem.rotation.y += dt * 2; this.markerGem.position.y = 4 + Math.sin(t * 2) * 0.3;
      const d = Math.round(Math.hypot(target.x - player.pos.x, target.z - player.pos.z));
      hud.quest(STAGES[this.stage].title, STAGES[this.stage].text, d);
    } else hud.quest(STAGES[this.stage].title, this.id === 'slimes' ? `Slimes defeated: ${Math.min(this.kills, SLIME_GOAL)} / ${SLIME_GOAL}` : STAGES[this.stage].text, null);
    // Save crystals: touch to save and heal.
    world.crystals.forEach((c, i) => {
      if (c.pos.distanceTo(player.pos) < 2.4) {
        if (this.crystal !== i || player.hp < player.maxHp) {
          this.crystal = i; player.hp = player.maxHp; player.stamina = 100;
          this.save(); hud.system('> SAVE CRYSTAL: progress saved, HP restored', 2);
          this.ctx.effects.burst(c.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), 16, [0, 2], 3);
        }
      }
    });
    if (this.busy) return;
    // Stage triggers by position.
    if (this.id === 'village' && player.pos.distanceTo(Z1.village) < 12) {
      this.#say([{ who: 'GUIDE', text: 'A village! These NPCs might know something. The blacksmith BRAM is by the forge. Walk up to him and TALK.' }]);
      this.#setStage('bram');
    }
    if (this.id === 'bridge' && player.pos.distanceTo(world.bridgePos) < 11) {
      this.#setStage('patchBridge');
      this.#say([{ who: 'GUIDE', text: 'The middle of the bridge is... gone. Not broken. DELETED. Can PATCH restore deleted data? Try it!' }]);
    }
    if (this.id === 'pond' && player.pos.distanceTo(Z1.arena) < Z1.arenaR - 3) this.#startBoss();
    if (this.id === 'boss' && !player.alive) {
      // Lost the fight: reset the boss right away; Jasper respawns at the crystal outside the arena.
      const { boss, enemies } = this.ctx;
      world.setBarrier(false); hud.bossBar(false);
      boss.reset();
      for (const e of enemies) if (e.minion) { e.dead = true; e.noRespawn = true; e.group.visible = false; e.gone = true; }
      this.stage = this.idx('pond'); this.save();
      hud.system('The Slime King was too strong...\nTry again: PATCH him when he grows!', 3.5);
    }
  }
}

const FAST = new URLSearchParams(location.search).has('fast');
const wait = ms => new Promise(r => setTimeout(r, FAST ? 0 : ms));
