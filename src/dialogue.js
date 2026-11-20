// Dialogue box: speaker name, typewriter text, tap/click/F to continue.
const COLORS = { GUIDE: '#29e6ff', JASPER: '#ffffff', BRAM: '#ffb35a', NIA: '#ff8ae8', TOMM: '#9cff5a', 'SLIME KING': '#ff2bd6', SYSTEM: '#ff2bd6' };

export class Dialogue {
  constructor() {
    this.el = document.getElementById('dialogue');
    this.nameEl = this.el.querySelector('.dname');
    this.textEl = this.el.querySelector('.dtext');
    this.queue = []; this.active = false; this.shown = 0; this.full = '';
    this.advanceReq = false;
    this.el.addEventListener('pointerdown', e => { e.stopPropagation(); this.advanceReq = true; });
  }

  // lines: [{ who, text, glitch? }]. Returns a promise that resolves when the player finishes reading.
  play(lines) {
    return new Promise(resolve => {
      this.queue = lines.slice(); this.onDone = resolve; this.active = true;
      this.el.classList.remove('hidden');
      this.#next();
    });
  }

  #next() {
    const line = this.queue.shift();
    if (!line) { this.active = false; this.el.classList.add('hidden'); const d = this.onDone; this.onDone = null; d?.(); return; }
    this.nameEl.textContent = line.who;
    this.nameEl.style.color = COLORS[line.who] || '#fff';
    this.full = line.text; this.shown = 0; this.glitch = !!line.glitch;
    this.el.classList.toggle('glitch', this.glitch);
    this.textEl.textContent = '';
  }

  // Called each frame with the game input (consumes advance actions).
  update(dt, input) {
    if (!this.active) return;
    const adv = this.advanceReq || input.consume('talk') || input.consume('attack') || input.consume('jump') || input.consume('dash');
    this.advanceReq = false;
    if (this.shown < this.full.length) {
      if (adv) this.shown = this.full.length;
      else this.shown = Math.min(this.full.length, this.shown + dt * 45);
      let t = this.full.slice(0, Math.floor(this.shown));
      if (this.glitch && Math.random() < 0.15) t = t.replace(/[a-z]/i, c => String.fromCharCode(33 + Math.floor(Math.random() * 60)));
      this.textEl.textContent = t;
    } else if (adv) this.#next();
  }
}
