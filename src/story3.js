// Zone 3 story: Capital of Aster. Captain Rho's loop, the copies in the city, Princess Victory,
// Sir Duplicate and Victory's confession. Side quests: Merchant Dot's Price Glitch, ghost houses.
import * as THREE from 'three';
import { sfx, music } from './audio.js?v=33';
import { Z3, HALL } from './world3.js?v=33';

const STAGES = [
  { id: 'arrive', title: 'Rescue the Princess', text: 'Walk up the main street to the Market Plaza' },
  { id: 'rho', title: 'Rescue the Princess', text: 'Find the captain of the guard by the castle' },
  { id: 'patchRho', title: 'Guard Duty Loop', text: 'Use PATCH on Captain Rho to break his loop' },
  { id: 'purge', title: 'Copy, Paste, Clear', text: 'Defeat every copy in the city' },
  { id: 'tower', title: 'Rescue the Princess', text: 'Go NORTH through the castle gate and PATCH the cage of light' },
  { id: 'throne', title: 'Copy, Paste, Fight', text: 'Go NORTH into the castle: the keep door is at the back of the courtyard' },
  { id: 'boss', title: 'Copy, Paste, Fight', text: 'Defeat Sir Duplicate' },
  { id: 'done', title: 'WHAT NEXT: The Unfinished Zone', text: 'Step into the glitch rift in the throne room (behind where Sir Duplicate stood)' },
];

export class Story3 {
  constructor(ctx) {
    this.ctx = ctx; // { player, guide, dialogue, hud, world, npcs, boss, enemies, effects, scene, rig, profile, pet, victory, shop, travel, fade }
    this.stage = 0; this.kills = 0; this.crystal = -1; this.busy = false; this.flags = {};
    this.#marker();
    const { boss, hud, victory } = ctx;
    boss.onDefeat = () => this.#onBossDefeated();
    boss.onMirror = () => { hud.system('FIVE KNIGHTS! They copy your every move.\nThe REAL one is always a little LATE', 3.6); victory.castBarrier(); };
    boss.onFound = () => hud.system('FOUND HIM! He is stunned - x2 DAMAGE!', 2.4);
    boss.onWrong = () => hud.system('WRONG ONE! That was a copy', 1.6);
    boss.onEnrage = () => hud.system('SIR DUPLICATE IS ENRAGED!\nFaster combos, double charges', 2.8);
    boss.onGuardBreak = () => hud.system('GUARD BREAK!', 1.4);
    victory.onFreed = () => this.#victoryFreed();
    this.guards = ctx.enemies.filter(e => !e.isBoss && !e.isClone);
    for (const g of this.guards) {
      g.onBlocked = () => { if (!this.flags.hintShield && !this.busy) { this.flags.hintShield = true; this.#say([{ who: 'GUIDE', text: 'It blocks everything from the FRONT! Get BEHIND it, use a HEAVY attack to break its guard, or PATCH it to drop the shield.' }]); } };
    }
    const rho = ctx.npcs.find(n => n.name === 'RHO'), dot = ctx.npcs.find(n => n.name === 'DOT');
    rho.onPatched = () => this.#rhoFixed();
    dot.onPatched = () => { this.flags.dotFixed = true; this.save(); this.ctx.hud.questToast('Price Glitch', 'Fixed! Dot\'s shop is now 20% off'); };
    ctx.patchables = [
      { get pos() { return rho.pos; }, canPatch: () => rho.bugged && this.stage >= this.idx('rho'), patch: () => rho.patch(), patchMsg: 'LOOP FIXED!' },
      { get pos() { return dot.pos; }, canPatch: () => dot.bugged, patch: () => dot.patch(), patchMsg: 'PRICES FIXED!' },
      victory,
      ...ctx.world.ghosts.map(gh => ({ get pos() { return gh.pos; }, range: 3, canPatch: () => !gh.fixed, patch: () => { this.ctx.onGhostFixed(gh); return true; }, patchMsg: 'COPY DELETED!\nSomething fell out of it' })),
    ];
  }

  get guardsLeft() { return this.guards.filter(e => e.alive).length; }
  #nearestGuard() {
    let best = null, bd = 1e9;
    for (const e of this.guards) if (e.alive) { const d = e.pos.distanceTo(this.ctx.player.pos); if (d < bd) { bd = d; best = e; } }
    return best?.pos || null;
  }
  idx(id) { return STAGES.findIndex(s => s.id === id); }
  get id() { return STAGES[this.stage].id; }
  get inHall() { return this.ctx.world.inHall(this.ctx.player.pos); }

  save() {
    const prof = this.ctx.profile;
    if (this.idx('done') > this.stage) this.flags.cleared = this.guards.map((e, i) => (e.alive ? -1 : i)).filter(i => i >= 0);
    Object.assign(prof.zone('z3'), { stage: this.stage, stageId: this.id, kills: this.kills, crystal: this.crystal, flags: this.flags });
    this.ctx.player.syncProfile?.();
    prof.save();
  }

  respawnPoint() {
    const c = this.ctx.world.crystals[this.crystal];
    if (c) return c.pos.clone().add(new THREE.Vector3(1.6, 0, 1.6));
    return Z3.arrive.clone();
  }

  async start() {
    const { player, guide, profile, hud, pet, victory } = this.ctx;
    const z = profile.zone('z3');
    this.stage = z.stageId ? Math.max(0, this.idx(z.stageId)) : 0;
    if (this.id === 'boss') this.stage = this.idx('throne'); // saved mid-fight: try again from the keep door
    this.kills = z.kills || 0; this.crystal = z.crystal ?? -1; this.flags = z.flags || {};
    for (const i of this.flags.cleared || []) { const e = this.guards[i]; if (e) { e.dead = true; e.deathT = 9; e.respawnT = 1e9; e.group.visible = false; } }
    for (const id of this.flags.ghosts || []) { const gh = this.ctx.world.ghosts.find(g => g.id === id); if (gh) this.ctx.world.fixGhost(gh); }
    if (this.flags.rhoFixed) { const r = this.ctx.npcs.find(n => n.name === 'RHO'); r.bugged = false; r.root.position.set(0, 0, 0); r.play(r.opts.anim); }
    if (this.flags.dotFixed) { const d = this.ctx.npcs.find(n => n.name === 'DOT'); d.bugged = false; d.root.position.set(0, 0, 0); d.play(d.opts.anim); }
    player.refreshStats(); player.hp = player.maxHp;
    hud.tutorialShown = true;
    this.#applyStage();
    const fromGate = profile.d.arrive === 'gate', fromRift = profile.d.arrive === 'rift'; delete profile.d.arrive;
    if (fromRift) player.spawnAt(Z3.rift.clone().add(new THREE.Vector3(0, 0, 3)), 0);
    else if (fromGate || this.crystal < 0) player.spawnAt(Z3.arrive, Math.PI); else player.spawnAt(this.respawnPoint(), Math.PI);
    guide.teleport(player.pos);
    if (this.stage >= this.idx('throne')) { victory.follow(); victory.teleportTo(player.pos.clone().add(new THREE.Vector3(1.5, 0, 1.5))); }
    if (profile.d.pet === 'pip') pet.follow(player);
    if (this.stage === 0 && !this.flags.intro) { await this.#intro(); return; }
    hud.system(fromGate ? '> ENTERING THE CAPITAL OF ASTER' : '> SAVE LOADED\n> Welcome back, Player One', 2.5);
  }

  async #intro() {
    this.flags.intro = true; this.save();
    await wait(600);
    await this.#say([
      { who: 'GUIDE', text: 'The Capital of Aster! The royal city. This is where the main quest was always meant to go: Rescue the Princess.' },
      { who: 'JASPER', text: 'Is it just me, or are half these houses... the same house?' },
      { who: 'GUIDE', text: 'Copy-pasted. Some of them are even floating out of place. The Null has been here too.' },
      { who: 'GUIDE', text: 'And the knights on patrol have no faces. Careful, Jasper: this is the hardest place we have been yet.' },
    ]);
  }

  async #say(lines) {
    const { dialogue, guide } = this.ctx;
    guide.talking = true; this.busy = true;
    await dialogue.play(lines);
    guide.talking = false; this.busy = false;
  }

  #setStage(id) {
    this.stage = this.idx(id);
    this.#applyStage();
    this.save();
    const s = STAGES[this.stage];
    if (id !== 'boss' && id !== 'done') this.ctx.hud.questToast(s.title, s.text);
  }

  #applyStage() {
    const { player, hud, world, victory } = this.ctx;
    const done = this.stage >= this.idx('done');
    for (const e of this.guards) e.holdRespawn = !done;
    world.setGate(this.stage < this.idx('tower'));
    victory.cageOpenable = this.stage === this.idx('tower');
    player.unlocks.sword = player.unlocks.patch = player.unlocks.skill = true;
    hud.setUnlocks(player.unlocks);
    player.char.blade.visible = true;
  }

  #marker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x29e6ff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 30; g.add(beam);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0x29e6ff }));
    gem.position.y = 4; g.add(gem); this.markerGem = gem;
    this.markerObj = g; this.ctx.scene.add(g);
  }

  objectivePos() {
    if (this.id === 'done') {
      const z4 = this.ctx.profile.d.zones.z4?.stageId;
      if (z4 === 'choice' || z4 === 'done') return null;
      return this.inHall ? Z3.rift : Z3.keepDoor;
    }
    if (this.inHall) return null;
    switch (this.id) {
      case 'arrive': return Z3.plaza;
      case 'rho': case 'patchRho': return Z3.rho;
      case 'purge': return this.#nearestGuard();
      case 'tower': return Z3.cage;
      case 'throne': return Z3.keepDoor;
      default: return null;
    }
  }

  // ---------- Talking ----------
  async talk(npc) {
    const { player } = this.ctx;
    this.talkNpc = npc;
    player.facing = Math.atan2(npc.pos.x - player.pos.x, npc.pos.z - player.pos.z);
    npc.face(player.pos); npc.play(npc.talkAnim);
    if (npc.name === 'RHO') await this.#talkRho(npc);
    else if (npc.name === 'DOT') await this.#talkDot(npc);
    else if (npc.name === 'VICTORY') await this.#talkVictory();
    npc.targetRy = null; if (npc.name !== 'VICTORY') npc.play(npc.opts.anim || 'Idle_Loop');
    this.talkNpc = null;
  }

  async #talkRho(rho) {
    if (rho.bugged) {
      await this.#say([
        { who: 'RHO', text: 'HALT! Who goes there? ...HALT! Who goes there? ...HALT! Who goes there?' },
        { who: 'GUIDE', text: 'He is stuck in a loop, just like Bram was. PATCH him!' },
      ]);
      if (this.stage < this.idx('patchRho')) this.#setStage('patchRho');
      return;
    }
    const lines = {
      purge: `The copies keep the castle gate sealed. ${this.guardsLeft} of them still walk my streets.`,
      tower: 'The gate is open! The princess is in the courtyard, behind that cage of light.',
      throne: 'Sir Duplicate waits in the throne room. He was the best of us... before he became so many.',
      done: 'The Capital is ours again. Thank you, Player. The guard will remember your name.',
    }[this.id] || 'Stay sharp, Player.';
    await this.#say([{ who: 'RHO', text: lines }]);
  }

  async #rhoFixed() {
    this.flags.rhoFixed = true; this.save();
    await wait(500);
    await this.#say([
      { who: 'RHO', text: '...Who goes-- Wait. I can stop saying that? Ahem. Captain Rho, commander of the castle guard. What is left of it.' },
      { who: 'RHO', text: 'Our knight-champion, Sir Duplicate, came back from the edge of the map... wrong. Then there were MANY of him.' },
      { who: 'RHO', text: 'His copies took the city. COPY GUARDS with shields, and ERROR MAGES that throw broken code.' },
      { who: 'RHO', text: 'Princess Victory is locked in a cage of light in the castle courtyard, and the gate is sealed while any copy still stands.' },
      { who: 'GUIDE', text: 'Same trick as the Hollow! Defeat every copy in the city and the gate opens. The marker will lead you.' },
    ]);
    this.#setStage('purge');
    if (this.guardsLeft === 0) this.#gateOpened();
  }

  async #talkDot(dot) {
    const fixed = !dot.bugged;
    if (!this.flags.metDot) {
      this.flags.metDot = true; this.save();
      await this.#say([
        { who: 'DOT', text: fixed ? 'Welcome! Fresh gear, fair prices.' : 'W3lcome! Fresh gear! Prices are... let me check... ah. They keep changing. Every time I look. Is that normal?' },
        ...(fixed ? [] : [{ who: 'GUIDE', text: 'Her price tags are glitched. Some are a steal, some are a scam. PATCH her and she will settle on fair prices.' }]),
      ]);
    }
    this.ctx.shop.open(fixed);
  }

  async #talkVictory() {
    const lines = {
      throne: [{ who: 'VICTORY', text: 'The throne room is through the keep door. When he splits, watch who is LATE. That one is real.' }],
      done: [{ who: 'VICTORY', text: 'Whatever you choose at the end, Jasper... I am glad it was you who came.' }],
    }[this.id] || [{ who: 'VICTORY', text: 'Lead the way, Player One.' }];
    await this.#say(lines);
  }

  async gate() {
    await this.#say([{ who: 'GUIDE', text: 'This gate leads back to Glitchwood Forest. Your progress is saved.' }]);
    sfx('gate'); this.ctx.travel('z2', 'capital');
  }

  // Keep door -> throne room; and back out.
  async enterHall() {
    const { player, victory, fade, guide } = this.ctx;
    await fade(() => { player.spawnAt(Z3.hallEntry, Math.PI); guide.teleport(player.pos); victory.teleportTo(Z3.hallEntry.clone().add(new THREE.Vector3(-1.6, 0, 1))); if (this.ctx.pet.mode === 'follow') this.ctx.pet.follow(player); });
    if (this.id === 'throne') this.#startBoss();
  }
  async toRift() {
    await this.#say([{ who: 'GUIDE', text: 'Beyond this rift is the part of Aster nobody finished. Your progress is saved. Ready?' }]);
    sfx('glitchBig'); this.ctx.travel('z4');
  }
  async leaveHall() {
    const { player, victory, fade, guide } = this.ctx;
    await fade(() => { player.spawnAt(Z3.keepDoor.clone().add(new THREE.Vector3(0, 0, 2)), 0); guide.teleport(player.pos); victory.teleportTo(player.pos.clone().add(new THREE.Vector3(1.5, 0, 1))); if (this.ctx.pet.mode === 'follow') this.ctx.pet.follow(player); });
  }

  async #startBoss() {
    const { world, boss, hud, victory } = this.ctx;
    this.#setStage('boss');
    boss.reset();
    boss.group.visible = true;
    music('boss', 1.2);
    await this.#say([
      { who: 'SIR DUPLICATE', text: 'A Player. In MY hall. I was copied a hundred times, Player... and every copy is loyal.', glitch: true },
      { who: 'VICTORY', text: 'That is not our knight anymore. Jasper, I will heal you when you are hurt and shield you when he splits.' },
      { who: 'GUIDE', text: 'His shield stops attacks from the front: use HEAVY attacks or get behind him. And jump his shockwaves!' },
    ]);
    world.setBarrier(true);
    boss.activate(); hud.bossBar(true, boss);
    victory.castBarrier();
  }

  // ---------- Events ----------
  onKill(e) {
    if (e.isBoss || e.minion || e.isClone) return;
    if (this.id === 'purge') {
      const left = this.guardsLeft;
      this.ctx.hud.questProgress(left ? `${left} cop${left === 1 ? 'y' : 'ies'} left` : 'City cleared!');
      if (!left) this.#gateOpened();
    }
    if (this.idx('done') > this.stage) this.save();
  }

  async #gateOpened() {
    if (this.id !== 'purge') return;
    this.#setStage('tower');
    sfx('glitchBig'); this.ctx.effects.burst(Z3.castleGate.clone().add(new THREE.Vector3(0, 4, 0)), 40, [1, 2], 8);
    await this.#say([
      { who: 'GUIDE', text: 'That was the last copy! The castle gate is OPEN!' },
      { who: 'JASPER', text: 'Then let\'s go rescue a princess. Never thought I would say that for real.' },
    ]);
  }

  async #victoryFreed() {
    const { victory, profile, hud } = this.ctx;
    await wait(500);
    victory.face(this.ctx.player.pos);
    await this.#say([
      { who: 'VICTORY', text: 'Finally. Do you know how long I have been standing in that thing? Since the last patch. Which never came.' },
      { who: 'JASPER', text: 'You... know about patches?' },
      { who: 'VICTORY', text: 'I know I am a princess in a game, Jasper. I know my lines. I also know when someone is NOT reading theirs.' },
      { who: 'GUIDE', text: 'She is self-aware! Like Mira. Like... me?' },
      { who: 'VICTORY', text: 'Sir Duplicate is in the throne room. He was my knight once. Let me come with you. I can heal, shield and throw a little STARFALL.' },
      { who: 'SYSTEM', text: 'VICTORY joined you! She heals you when you are low, casts BARRIER in boss fights and attacks with STARFALL.' },
    ]);
    victory.follow();
    this.flags.victory = 'joined'; profile.d.ally = 'victory';
    hud.newAbility('VICTORY JOINED', 'Heal when you are low, Barrier in boss fights, Starfall on nearby enemies.');
    this.#setStage('throne');
  }

  async #onBossDefeated() {
    const { world, hud, player, profile, victory } = this.ctx;
    hud.bossBar(false); music('capital', 3);
    world.setBarrier(false);
    player.gainXp(450);
    profile.d.debugPoints++;
    this.flags.cleared = [];
    this.#setStage('done');
    await wait(1800);
    victory.face(player.pos);
    await this.#say([
      { who: 'SIR DUPLICATE', text: 'Princess... I only wanted... to protect you... from the ending...', glitch: true },
      { who: 'SYSTEM', text: '+450 XP and a DEBUG POINT. He dropped loot: grab it!' },
      { who: 'VICTORY', text: 'Jasper. There is something I have not told you.' },
      { who: 'VICTORY', text: 'When a game is finished, its world stops. Everything in Aster, every person, every memory... gets saved and closed. Forever.' },
      { who: 'JASPER', text: 'You mean if I beat the game, all of you just... end?' },
      { who: 'VICTORY', text: 'I hid it because I wanted you to choose for yourself. Not because a princess asked you to.' },
      { who: 'GUIDE', text: '...I was not given a line for this. I do not have a line for this. Jasper, I think I am talking without a script.' },
      { who: 'VICTORY', text: 'The Null comes from the edge of the map: the UNFINISHED ZONE. Whatever we decide, the answer is there.' },
      { who: 'GUIDE', text: 'Look behind the throne: a GLITCH RIFT just tore open. That is the way to the Unfinished Zone. Step into it when you are ready.' },
    ]);
    hud.zoneComplete({ level: player.level, time: this.playTime, num: 'ZONE 3', title: 'CAPITAL OF ASTER CLEARED', next: 'Next: <b>The Unfinished Zone</b>, through the glitch rift behind the throne' });
  }

  // ---------- Per frame ----------
  update(dt, t) {
    const { player, hud, world, victory } = this.ctx;
    this.playTime = (this.playTime || 0) + dt;
    const target = this.objectivePos();
    this.markerObj.visible = !!target && !this.ctx.dialogue.active;
    const st = STAGES[this.stage];
    if (target) {
      this.markerObj.position.set(target.x, 0, target.z);
      this.markerGem.rotation.y += dt * 2; this.markerGem.position.y = 4 + Math.sin(t * 2) * 0.3;
      const d = Math.round(Math.hypot(target.x - player.pos.x, target.z - player.pos.z));
      hud.quest(st.title, this.id === 'purge' ? `Defeat every copy in the city: ${this.guardsLeft} left` : st.text, d);
    } else hud.quest(st.title, st.text, null);
    // Save crystals.
    world.crystals.forEach((c, i) => {
      if (c.pos.distanceTo(player.pos) < 2.4 && (this.crystal !== i || player.hp < player.maxHp)) {
        this.crystal = i; player.hp = player.maxHp; player.stamina = 100;
        this.save(); hud.system('> SAVE CRYSTAL: progress saved, HP restored', 2); sfx('save');
        this.ctx.effects.burst(c.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), 16, [0, 2], 3);
      }
    });
    if (this.busy) return;
    if (!this.flags.hintForge && this.playTime > 8 && this.stage > 0) {
      this.flags.hintForge = true; this.save();
      this.#say([{ who: 'GUIDE', text: 'Enemies here hit HARD. If your blade feels weak, Bram can upgrade it: MAP, then WORLD, then Starter Meadow. You can come straight back.' }]);
      return;
    }
    if (this.id === 'arrive' && player.pos.distanceTo(Z3.plaza) < 19) {
      this.#setStage('rho');
      this.#say([{ who: 'GUIDE', text: 'The Market Plaza. Nobody here but copies... There! A guard by the castle who is NOT a copy. Let\'s talk to him.' }]);
    }
    if (world.gateClosed && player.pos.distanceTo(Z3.castleGate) < 5 && (this.gateHintT || 0) < this.playTime && this.stage < this.idx('tower')) {
      this.gateHintT = this.playTime + 15;
      hud.system(this.stage < this.idx('purge') ? 'THE CASTLE GATE IS SEALED\nTalk to the guard captain' : `THE CASTLE GATE IS SEALED\n${this.guardsLeft} cop${this.guardsLeft === 1 ? 'y' : 'ies'} still in the city`, 3);
    }
    if (this.id === 'boss' && !player.alive) {
      const { boss } = this.ctx;
      world.setBarrier(false); hud.bossBar(false); music('capital', 2);
      boss.reset();
      this.stage = this.idx('throne'); this.save();
      hud.system('Sir Duplicate was too strong...\nWatch for the LATE knight when he splits!' + (this.ctx.profile.d.swordLevel < 5 ? "\nTip: upgrade your sword at Bram's forge in Starter Meadow" : ''), 4.5);
    }
    victory.cageOpenable = this.id === 'tower';
  }
}

const FAST = new URLSearchParams(location.search).has('fast');
const wait = ms => new Promise(r => setTimeout(r, FAST ? 0 : ms));
export { HALL };
