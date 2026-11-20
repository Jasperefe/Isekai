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
    cp.textContent = p.patchCd > 0 ? `E PATCH ${Math.ceil(p.patchCd)}s` : 'E PATCH READY'; cp.classList.toggle('cool', p.patchCd > 0);
    cs.textContent = p.skillCd > 0 ? `R BLADE STORM ${Math.ceil(p.skillCd)}s` : 'R BLADE STORM'; cs.classList.toggle('cool', p.skillCd > 0 || p.stamina < 40);
    if (this.msgTimer > 0) { this.msgTimer -= dt; if (this.msgTimer <= 0) $('system-msg').classList.remove('show'); }
  }

  system(text, time = 2.4) {
    const m = $('system-msg'); m.textContent = text; m.classList.add('show'); this.msgTimer = time;
  }

  objective(text) { $('objective').innerHTML = text; }

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
