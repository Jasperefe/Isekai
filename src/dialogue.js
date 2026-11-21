// Dialogue box: portrait, speaker name plate, typed text with voice blips, tap/click/F to continue.
import { sfx } from './audio.js?v=24';

export const SPEAKER_COLORS = {
  GUIDE: '#29e6ff', JASPER: '#e9f2ff', BRAM: '#ffb35a', NIA: '#ff8ae8', TOMM: '#9cff5a', MIRA: '#9cf0ff',
  'SLIME KING': '#7dff6b', THORNWRAITH: '#ff2bd6', SYSTEM: '#ff2bd6', VICTORY: '#ffd36b',
  RHO: '#7fb2ff', DOT: '#ff9de2', 'SIR DUPLICATE': '#ffcc4d',
};

export class Dialogue {
  constructor() {
    this.el = document.getElementById('dialogue');
    this.nameEl = this.el.querySelector('.dname');
    this.textEl = this.el.querySelector('.dtext');
    this.portEl = this.el.querySelector('.dportrait');
    this.imgEl = this.portEl.querySelector('img');
    this.initEl = this.portEl.querySelector('.dinit');
    this.portraits = {}; // speaker -> image URL (filled by the game core)
    this.queue = []; this.active = false; this.shown = 0; this.full = '';
    this.advanceReq = false; this.blipT = 0;
    this.el.addEventListener('pointerdown', e => { e.stopPropagation(); this.advanceReq = true; });
    const fine = matchMedia('(pointer: fine)').matches;
    this.el.querySelector('.dnext').innerHTML = `${fine ? 'CLICK' : 'TAP'} <b>&#9654;</b>`;
  }

  // lines: [{ who, text, glitch? }]. Resolves when the player finishes reading.
  play(lines) {
    return new Promise(resolve => {
      this.queue = lines.slice(); this.onDone = resolve; this.active = true;
      this.el.classList.remove('hidden');
      this.#next();
    });
  }

  setPortrait(who, url) { this.portraits[who] = url; if (this.who === who) this.#showPortrait(); }

  #showPortrait() {
    const url = this.portraits[this.who];
    this.portEl.classList.toggle('noimg', !url);
    if (url) this.imgEl.src = url; else this.initEl.textContent = (this.who || '?')[0];
  }

  #next() {
    const line = this.queue.shift();
    if (!line) { this.active = false; this.el.classList.add('hidden'); const d = this.onDone; this.onDone = null; d?.(); return; }
    this.who = line.who;
    this.nameEl.textContent = line.who;
    this.el.style.setProperty('--who', SPEAKER_COLORS[line.who] || '#e9f2ff');
    this.#showPortrait();
    this.full = line.text; this.shown = 0; this.glitch = !!line.glitch;
    this.el.classList.toggle('glitch', this.glitch);
    this.el.classList.remove('done');
    this.textEl.textContent = '';
    // Each speaker has their own blip pitch.
    this.pitch = { GUIDE: 1.5, JASPER: 1, BRAM: 0.7, NIA: 1.3, TOMM: 0.9, MIRA: 1.15, SYSTEM: 1.8 }[line.who] ?? 0.8;
  }

  update(dt, input) {
    if (!this.active) return;
    const adv = this.advanceReq || input.consume('talk') || input.consume('attack') || input.consume('jump') || input.consume('dash');
    this.advanceReq = false;
    if (this.shown < this.full.length) {
      if (adv) this.shown = this.full.length;
      else this.shown = Math.min(this.full.length, this.shown + dt * 48);
      let t = this.full.slice(0, Math.floor(this.shown));
      if (this.glitch && Math.random() < 0.15) t = t.replace(/[a-z]/i, c => String.fromCharCode(33 + Math.floor(Math.random() * 60)));
      this.textEl.textContent = t;
      this.blipT -= dt;
      if (this.blipT <= 0 && this.shown < this.full.length) { this.blipT = 0.065; sfx(this.glitch ? 'warn' : 'type', null, 0.8); }
      if (this.shown >= this.full.length) this.el.classList.add('done');
    } else if (adv) { sfx('click'); this.#next(); }
  }
}
