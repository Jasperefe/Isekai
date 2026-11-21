import { sfx } from './audio.js?v=28';
// CONSOLE: Jasper's cheat menu (taught by Old Mira). Opens a radial menu and slows time.
// Commands are unlocked with Debug Points and each has a cooldown.
const $ = id => document.getElementById(id);

export const COMMANDS = [
  { id: 'speed', name: '/speed', text: 'Run 2x faster for 5 s', cost: 1, cd: 30, dur: 5 },
  { id: 'doublejump', name: '/doublejump', text: 'Jump again in mid-air (always on)', cost: 1, passive: true },
  { id: 'noclip', name: '/noclip', text: 'Walk through glitch walls for 4 s', cost: 2, cd: 45, dur: 4 },
  { id: 'slowmo', name: '/slowmo', text: 'Enemies move at half speed for 5 s', cost: 2, cd: 40, dur: 5 },
  { id: 'godmode', name: '/godmode', text: 'Invincible for 5 s', cost: 3, cd: 90, dur: 5 },
];

export class Console {
  constructor(core) {
    this.core = core; // { profile, hud, player, effects }
    this.open = false; this.cd = {}; this.active = {};
    this.el = $('console');
    $('btn-console').addEventListener('click', () => this.toggle());
    $('console-close').addEventListener('click', () => this.hide());
    addEventListener('keydown', e => { if (e.code === 'KeyC' && this.available) { e.preventDefault(); this.toggle(); } });
    this.refresh();
  }

  get d() { return this.core.profile.d; }
  get available() { return !!this.d.consoleUnlocked; }
  has(id) { return !!this.d.console?.[id]; }

  refresh() { $('btn-console').classList.toggle('hidden', !this.available); $('chip-console').classList.toggle('hidden', !this.available); }

  toggle() { this.open ? this.hide() : this.show(); }
  show() {
    if (!this.available || this.core.paused?.()) return;
    this.open = true; this.el.classList.remove('hidden'); document.body.classList.add('console'); sfx('consoleOpen');
    document.exitPointerLock?.();
    this.render();
  }
  hide() { if (this.open) sfx('close'); this.open = false; this.el.classList.add('hidden'); document.body.classList.remove('console'); }

  render() {
    const wrap = $('console-cmds'); wrap.innerHTML = ''; this.btns = [];
    COMMANDS.forEach((c, i) => {
      const a = -Math.PI / 2 + i / COMMANDS.length * Math.PI * 2;
      const b = document.createElement('button');
      b.className = 'cmd'; b.style.left = `calc(50% + ${Math.cos(a) * 178}px)`; b.style.top = `calc(50% + ${Math.sin(a) * 104}px)`;
      b.innerHTML = `<b>${c.name}</b><small>${c.text}</small><i></i>`;
      b.addEventListener('click', () => this.#pick(c));
      wrap.appendChild(b); this.btns.push(b);
    });
    this.#states();
  }

  // Update labels in place (never rebuild while a finger may be on a button).
  #states() {
    $('console-points').textContent = this.d.debugPoints;
    COMMANDS.forEach((c, i) => {
      const b = this.btns?.[i]; if (!b) return;
      let state, cls;
      if (!this.has(c.id)) {
        const need = c.cost - this.d.debugPoints;
        if (need > 0) { state = `LOCKED · NEED ${need} MORE PT${need > 1 ? 'S' : ''}`; cls = 'locked'; }
        else { state = `TAP TO UNLOCK · ${c.cost} PT${c.cost > 1 ? 'S' : ''}`; cls = 'ready'; }
      }
      else if (c.passive) { state = 'ALWAYS ON'; cls = 'on'; }
      else if (this.active[c.id] > 0) { state = `ACTIVE ${Math.ceil(this.active[c.id])}s`; cls = 'on'; }
      else if (this.cd[c.id] > 0) { state = `READY IN ${Math.ceil(this.cd[c.id])}s`; cls = 'wait'; }
      else { state = 'TAP TO RUN'; cls = 'ready'; }
      b.className = 'cmd ' + cls; b.querySelector('i').textContent = state;
    });
  }

  #pick(c) {
    const { hud, profile } = this.core;
    if (!this.has(c.id)) {
      if (this.d.debugPoints < c.cost) { sfx('error'); hud.system(`${c.name} needs ${c.cost} DEBUG POINT${c.cost > 1 ? 'S' : ''}. You have ${this.d.debugPoints}.\nGet them from BOSSES, special CHESTS\nand sometimes GLITCHED enemies`, 3.5); return; }
      this.d.debugPoints -= c.cost; (this.d.console ||= {})[c.id] = true; profile.save();
      hud.system(c.passive ? `> ${c.name} UNLOCKED\nIt is always on now` : `> ${c.name} UNLOCKED\nTap it again to RUN it`, 2.4); sfx('unlock');
      this.#states(); return;
    }
    if (c.passive || this.cd[c.id] > 0) return;
    this.cd[c.id] = c.cd; this.active[c.id] = c.dur;
    hud.system(`> ${c.name}`, 1.2); sfx('consoleRun');
    this.core.effects.burst(this.core.player.pos.clone().setY(this.core.player.pos.y + 1.2), 16, [0, 2], 3);
    this.hide();
  }

  // Effects the rest of the game reads.
  get speedMul() { return this.active.speed > 0 ? 2 : 1; }
  get enemyTimeScale() { return this.active.slowmo > 0 ? 0.5 : 1; }
  get noclip() { return this.active.noclip > 0; }
  get god() { return this.active.godmode > 0; }
  get doubleJump() { return this.has('doublejump'); }

  update(dt) {
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    for (const k in this.active) this.active[k] = Math.max(0, this.active[k] - dt);
    const on = COMMANDS.filter(c => this.active[c.id] > 0).map(c => `${c.name} ${Math.ceil(this.active[c.id])}s`);
    const el = $('cmd-active'); el.textContent = on.join('   '); el.classList.toggle('hidden', !on.length);
    if (this.open) { this.renderT = (this.renderT || 0) - dt; if (this.renderT <= 0) { this.renderT = 0.25; this.#states(); } }
  }
}
