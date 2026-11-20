// DOM-based HUD: bars, floating numbers, system messages and death screen.
import * as THREE from 'three';

const $ = id => document.getElementById(id);

export class Hud {
  constructor(camera) {
    this.camera = camera;
    this.el = $('hud');
    this.layer = $('float-layer');
    this.msgTimer = 0;
    this.v = new THREE.Vector3();
  }

  show() { this.el.classList.remove('hidden'); }

  update(dt, p) {
    $('hp-fill').style.width = (p.hp / p.maxHp * 100) + '%';
    $('hp-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('st-fill').style.width = p.stamina + '%';
    $('xp-fill').style.width = (p.xp / (p.level * 100) * 100) + '%';
    $('lvl').textContent = 'LV ' + p.level;
    const cd = $('patch-cd'); if (cd) cd.style.height = (p.patchCd / 8 * 100) + '%';
    const sc = $('skill-cd'); if (sc) sc.style.height = (p.skillCd / 6 * 100) + '%';
    const cp = $('chip-patch'), cs = $('chip-skill');
    const target = p.patchTarget(), ready = !!target && p.patchCd <= 0;
    cp.textContent = p.patchCd > 0 ? `E PATCH ${Math.ceil(p.patchCd)}s` : ready ? 'PRESS E: PATCH IT!' : 'E PATCH';
    cp.classList.toggle('cool', p.patchCd > 0 || !target); cp.classList.toggle('ready', ready);
    $('btn-patch')?.classList.toggle('ready', ready);
    // First time a glitched enemy comes close: explain Patch once.
    if (target && target.takeHit && !target.isBoss && !this.tutorialShown && target.pos.distanceTo(p.pos) < 9) { this.tutorialShown = true; this.tutorial(); }
    if (this.tutT > 0) { this.tutT -= dt; if (this.tutT <= 0) $('tutorial').classList.add('hidden'); }
    cs.textContent = p.skillCd > 0 ? `R BLADE STORM ${Math.ceil(p.skillCd)}s` : 'R BLADE STORM'; cs.classList.toggle('cool', p.skillCd > 0 || p.stamina < 40);
    if (this.boss) $('boss-fill').style.width = (this.boss.hp / this.boss.maxHp * 100) + '%';
    if (this.msgTimer > 0) { this.msgTimer -= dt; if (this.msgTimer <= 0) $('system-msg').classList.remove('show'); }
  }

  system(text, time = 2.4) {
    const m = $('system-msg'); m.textContent = text; m.classList.add('show'); this.msgTimer = time;
  }

  tutorial() {
    const el = $('tutorial');
    el.innerHTML = `<b>GLITCHED ENEMY</b>
      <ol><li>Purple enemies are <i>bugged</i>: your attacks barely hurt them.</li>
      <li>Press <span class="k">PATCH</span> to fix the bug.</li>
      <li>The fixed enemy <span class="k">freezes</span> and takes <span class="k">DOUBLE damage</span>. Attack!</li></ol>`;
    el.classList.remove('hidden'); this.tutT = 7;
  }

  combo(n) {
    const el = $('combo');
    if (!n || n < 2) { el.classList.remove('show'); return; }
    el.innerHTML = `<b>${n}</b> HIT${n >= 8 ? '<small>FINISHER</small>' : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  objective(text) { this.quest('', text); }

  quest(title, text, dist) {
    const key = title + '|' + text + '|' + dist;
    if (key === this.qKey) return; this.qKey = key;
    $('quest-title').textContent = title || '';
    $('quest-text').innerHTML = (text || '') + (dist != null ? `<span class="qd">${dist} m</span>` : '');
  }

  questProgress(text) { this.system(text, 1.6); }

  questToast(title, text) { this.toast('NEW OBJECTIVE', title, text, 3.2); }
  newAbility(name, text) { this.toast('NEW ABILITY', name, text, 4.5); }

  toast(kicker, title, text, time) {
    $('toast-kicker').textContent = kicker; $('toast-title').textContent = title; $('toast-text').textContent = text;
    const el = $('toast'); el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this.toastTO); this.toastTO = setTimeout(() => el.classList.add('hidden'), time * 1000);
  }

  subtitle(text) {
    const el = $('subtitle'); el.textContent = text; el.classList.remove('hidden');
    clearTimeout(this.subTO); this.subTO = setTimeout(() => el.classList.add('hidden'), 4500);
  }

  setUnlocks(u) {
    const show = (id, on) => $(id)?.classList.toggle('hidden', !on);
    show('btn-heavy', u.sword); show('btn-block', u.sword); show('btn-sword', u.sword);
    show('btn-patch', u.patch); show('btn-skill', u.skill);
    show('chip-patch', u.patch); show('chip-skill', u.skill);
  }

  talkPrompt(name) {
    const p = $('talk-prompt'), b = $('btn-talk');
    if (name) { p.innerHTML = `<b>F</b> Talk to ${name}`; p.classList.remove('hidden'); b.classList.remove('hidden'); }
    else { p.classList.add('hidden'); b.classList.add('hidden'); }
  }

  bossBar(on, boss) { this.boss = on ? boss : null; $('bossbar').classList.toggle('hidden', !on); }

  cinematic(lines) {
    return new Promise(resolve => {
      const el = $('cinematic'), pre = $('cine-text');
      el.classList.remove('hidden'); el.style.opacity = 1; pre.textContent = '';
      let i = 0, c = 0;
      const tick = () => {
        if (i >= lines.length) { setTimeout(() => { el.style.opacity = 0; setTimeout(() => { el.classList.add('hidden'); resolve(); }, 800); }, 700); return; }
        c++; pre.textContent = lines.slice(0, i).join('\n') + (i ? '\n' : '') + lines[i].slice(0, c);
        if (c >= lines[i].length) { i++; c = 0; setTimeout(tick, 380); } else setTimeout(tick, 28);
      };
      tick();
    });
  }

  zoneComplete(stats) {
    const m = Math.floor((stats.time || 0) / 60), s = Math.floor((stats.time || 0) % 60);
    $('zone-stats').textContent = `Level ${stats.level} · Time ${m}m ${s}s`;
    $('zone-done').classList.remove('hidden');
    $('zone-continue').onclick = () => $('zone-done').classList.add('hidden');
  }

  float(worldPos, text, cls = '') {
    this.v.copy(worldPos).project(this.camera);
    if (this.v.z > 1) return;
    const d = document.createElement('div');
    d.className = 'float ' + cls; d.textContent = text;
    d.style.left = ((this.v.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 30) + 'px';
    d.style.top = ((-this.v.y * 0.5 + 0.5) * innerHeight) + 'px';
    this.layer.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  flash(which) {
    const el = which === 'st' ? $('st-fill').parentElement : $('hp-fill').parentElement;
    el.animate([{ outline: '2px solid #ff5b6b' }, { outline: '2px solid transparent' }], { duration: 400 });
  }

  hurt() {
    document.body.animate([{ boxShadow: 'inset 0 0 80px #ff000090' }, { boxShadow: 'inset 0 0 0 transparent' }], { duration: 350 });
  }

  death(on) { $('death').classList.toggle('hidden', !on); }
}
