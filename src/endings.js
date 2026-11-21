// The ending choice after NOVA falls, the three endings, and New Game+.
// 1. FINISH THE GAME: Jasper goes home, Aster closes.
// 2. STAY: Jasper becomes Aster's developer and never goes home.
// 3. PATCH NOVA (secret): only if every chest in all 4 zones was found. Aster is saved AND Jasper goes home.
import { sfx, music } from './audio.js?v=28';
import { CHEST_TOTALS, allChestsFound } from './story4.js?v=28';

const FAST = new URLSearchParams(location.search).has('fast');
const wait = ms => new Promise(r => setTimeout(r, FAST ? 0 : ms));

const ENDINGS = {
  finish: {
    num: 'ENDING 1 OF 3', title: 'GAME COMPLETE',
    cine: ['> Aster_v1.0 ... COMPLETE', '> Saving world ... done', '> Closing file ...', '> Goodbye, Player One.'],
    lines: hero => [
      { who: 'GUIDE', text: `Thank you, ${hero.name}. Because of you, Aster has an ending. Not every world gets one.` },
      { who: hero.ally, text: 'Go home. Wherever that is... remember us.' },
      { who: hero.NAME, text: 'I will. Every single one of you.' },
      { who: 'SYSTEM', text: 'Aster has been saved and closed. You woke up at your desk. On the screen: THANKS FOR PLAYING.' },
    ],
  },
  stay: {
    num: 'ENDING 2 OF 3', title: 'THE NEW DEVELOPER',
    cine: ['> NEW DEVELOPER ASSIGNED: ' + '%HERO%', '> Aster_v1.1 ... in progress', '> Exit door: DELETED', '> The world keeps running.'],
    lines: hero => [
      { who: hero.NAME, text: 'I am not closing Aster. Somebody has to finish the bridges and fix the villagers.' },
      { who: hero.ally, text: 'You would give up your home... for us?' },
      { who: 'GUIDE', text: 'Then you are the developer now. Aster will never be finished. And it will never end.' },
      { who: 'SYSTEM', text: `${hero.name} stayed in Aster. Somewhere, a desk is empty and a monitor is still on.` },
    ],
  },
  patch: {
    num: 'TRUE ENDING', title: 'PATCHED',
    cine: ['> opening NOVA.exe ...', '> rule "a finished game must close" ... DELETED', '> rule "a finished game can still be played" ... ADDED', '> Aster: SAVED', '> Exit door: OPEN'],
    lines: hero => [
      { who: 'NOVA', text: 'I... understand. A finished world does not have to disappear. It can be played again.', glitch: true },
      { who: 'GUIDE', text: `You found every chest and every secret in Aster. You did not just finish the game, ${hero.name}. You fixed it.` },
      { who: hero.ally, text: 'Go home. And when you miss us, press START. We will be here.' },
      { who: 'SYSTEM', text: 'Aster was saved. Player One went home. And the game was never deleted.' },
    ],
  },
};

export class Endings {
  constructor(core) { this.core = core; this.el = null; }

  // Lines are written from Jasper's side; in New Game+ as Victory the dialogue box swaps the names.
  heroInfo() { return { name: 'Jasper', NAME: 'JASPER', ally: 'VICTORY' }; }
  heroName() { return this.core.profile.d.hero === 'victory' ? 'VICTORY' : 'JASPER'; }
  chestCount() {
    const z = this.core.profile.d.zones;
    let got = 0, total = 0;
    for (const [id, n] of Object.entries(CHEST_TOTALS)) { total += n; got += Math.min(n, (z[id]?.flags?.chests || []).length); }
    return { got, total };
  }
  #overlay(html) {
    this.close();
    const el = document.createElement('div'); el.id = 'ending'; el.innerHTML = html; document.body.appendChild(el);
    el.addEventListener('pointerdown', e => e.stopPropagation());
    this.el = el; return el;
  }
  close() { this.el?.remove(); this.el = null; }

  // The choice screen.
  choose() {
    const story = this.core.story; if (story) story.busy = true;
    const { got, total } = this.chestCount(), secret = allChestsFound(this.core.profile);
    const el = this.#overlay(`
      <div class="ebox">
        <small>NOVA IS WAITING FOR AN ANSWER</small>
        <h1>THE CHOICE</h1>
        <button data-e="finish"><b>FINISH THE GAME</b><span>Go home. Aster is saved and closed forever.</span></button>
        <button data-e="stay"><b>STAY</b><span>Become Aster's developer. Aster lives, but you never go home.</span></button>
        ${secret
    ? '<button data-e="patch" class="secret"><b>PATCH NOVA</b><span>SECRET: fix the system itself. Save Aster AND go home.</span></button>'
    : `<button class="locked" disabled><b>??? LOCKED</b><span>A third choice exists. Open every chest in Aster to unlock it: ${got} / ${total} found.</span></button>`}
        <button data-e="later" class="later">Not yet: keep exploring (come back to NOVA's Core to choose)</button>
      </div>`);
    sfx('open');
    el.querySelectorAll('button[data-e]').forEach(b => b.addEventListener('click', () => {
      sfx('click'); const id = b.dataset.e;
      if (id === 'later') { this.close(); if (story) story.busy = false; this.core.hud.system(`${total - got > 0 ? `Chests found: ${got} / ${total}. Check the MAP in every zone.\n` : ''}Return to NOVA's Core to make your choice`, 3.5); return; }
      const name = { finish: 'FINISH THE GAME', stay: 'STAY IN ASTER', patch: 'PATCH NOVA' }[id];
      if (!FAST && !confirm(`${name}?\nYou can still play on afterwards and start New Game+.`)) return;
      this.play(id);
    }));
  }

  async play(id) {
    const { hud, dialogue, profile, player } = this.core, story = this.core.story, E = ENDINGS[id], hero = this.heroInfo();
    this.close();
    if (story) story.busy = true;
    music('title', 2);
    await hud.cinematic(E.cine.map(l => l.replace('%HERO%', this.heroName())));
    await dialogue.play(E.lines(hero));
    profile.d.endings = [...new Set([...(profile.d.endings || []), id])];
    profile.d.ending = id;
    story?.finish?.();
    player.syncProfile?.(); profile.save();
    await wait(300);
    this.card(id);
  }

  card(id) {
    const E = ENDINGS[id], seen = (this.core.profile.d.endings || []).length;
    const ng = this.core.profile.d.ngPlus || 0;
    const el = this.#overlay(`
      <div class="ebox">
        <small>${E.num}</small>
        <h1>${E.title}</h1>
        <p>Endings seen: ${seen} / 3${ng ? ` · New Game+ ${ng}` : ''}</p>
        <p class="ehint">${this.core.profile.d.hero === 'victory' ? 'You finished the game as VICTORY.' : 'NEW GAME+ unlocked: play the whole story again as VICTORY, and keep your level, gear and gold.'}</p>
        <button data-e="ng" class="primary"><b>NEW GAME+</b><span>Play again as ${this.core.profile.d.hero === 'victory' ? 'JASPER or VICTORY' : 'VICTORY'}. Keep level, gear and gold.</span></button>
        <button data-e="credits"><b>CREDITS</b></button>
        <button data-e="stay" class="later">Keep exploring Aster</button>
      </div>`);
    sfx('zoneClear');
    el.querySelector('[data-e=ng]').addEventListener('click', () => { sfx('click'); this.newGamePlus(); });
    el.querySelector('[data-e=credits]').addEventListener('click', () => { sfx('open'); document.getElementById('credits').classList.remove('hidden'); });
    el.querySelector('[data-e=stay]').addEventListener('click', () => { sfx('click'); this.close(); const s = this.core.story; if (s) s.busy = false; });
  }

  // New Game+: keep level, gear, gold, skills and the console; every zone's story resets.
  newGamePlus(hero) {
    const { profile, player } = this.core;
    const cur = profile.d.hero || 'jasper';
    const pick = hero || (cur === 'victory' ? (confirm('Play as VICTORY again?\nOK = Victory, Cancel = Jasper') ? 'victory' : 'jasper') : 'victory');
    if (!FAST && !hero && !confirm(`Start NEW GAME+ as ${pick.toUpperCase()}?\nThe story restarts from Starter Meadow. Your level, gear, gold and skills stay.`)) return;
    player.syncProfile?.();
    const d = profile.d;
    d.ngPlus = (d.ngPlus || 0) + 1; d.hero = pick;
    d.zones = {}; d.zone = 'z1'; delete d.arrive; delete d.ally;
    profile.save();
    try { sessionStorage.setItem('isekai_autostart', '1'); } catch (e) { /* ignore */ }
    location.reload();
  }
}
