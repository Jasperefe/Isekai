// Pause menu: Gear (equip/scrap), Skills (tree), Map, Settings. Plus Bram's forge window.
import { RARITY, itemIcon } from './items.js?v=13';
import { SKILLS, BRANCHES } from './skills.js?v=13';

const $ = id => document.getElementById(id);
const SLOT_NAMES = { weapon: 'Weapon', armor: 'Armor', charm: 'Charm' };

export class Menu {
  constructor(core) {
    this.core = core;
    const op = core.onPause; core.onPause = v => { document.body.classList.toggle('paused', v); op(v); }; // { profile, player, hud, onPause(bool) }
    this.el = $('menu'); this.open = false; this.sel = null;
    for (const b of this.el.querySelectorAll('.mtabs button[data-tab]')) b.addEventListener('click', () => this.tab(b.dataset.tab));
    $('menu-close').addEventListener('click', () => this.hide());
    $('menu-btn').addEventListener('click', () => (this.open ? this.hide() : this.show()));
    addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); this.open ? this.hide() : this.show(); } });
    $('forge-close').addEventListener('click', () => this.closeForge());
    $('forge-up').addEventListener('click', () => {
      if (this.core.profile.upgradeSword()) { this.core.player.refreshStats(); this.core.profile.save(); this.core.hud.wallet(this.core.profile.d); this.core.hud.system(`DEBUG BLADE +${this.core.profile.d.swordLevel}!`, 2); }
      this.#renderForge();
    });
  }

  show(tab) {
    this.open = true; this.el.classList.remove('hidden'); document.exitPointerLock?.();
    this.core.onPause(true);
    this.tab(tab || this.curTab || 'gear');
  }
  hide() { this.open = false; this.el.classList.add('hidden'); this.core.onPause(false); this.core.profile.save(); }

  tab(t) {
    this.curTab = t;
    for (const el of this.el.querySelectorAll('[data-tab]')) el.classList.toggle('on', el.dataset.tab === t);
    if (t === 'gear') this.#renderGear();
    if (t === 'skills') this.#renderSkills();
    if (t === 'map') this.#renderMap();
    this.#badge();
  }

  #badge() { const n = this.core.profile.d.skillPoints; $('sp-badge').textContent = n > 0 ? n : ''; }

  // ---------- Gear ----------
  #renderGear() {
    const { profile, player } = this.core, d = profile.d;
    $('slots').innerHTML = ['weapon', 'armor', 'charm'].map(slot => {
      const it = d.equip[slot];
      if (!it) return `<div class="slot empty"><div class="ic">${itemIcon(slot, '#ffffff55')}</div><div class="nm">${SLOT_NAMES[slot]}</div><small>empty</small></div>`;
      return `<div class="slot" data-eq="${slot}" style="border-color:${RARITY[it.rarity].color}"><div class="ic">${itemIcon(slot, RARITY[it.rarity].color)}</div><div class="nm" style="color:${RARITY[it.rarity].color}">${it.name}</div><small>${it.lines[0]}</small></div>`;
    }).join('');
    for (const el of $('slots').querySelectorAll('[data-eq]')) el.addEventListener('click', () => { this.sel = { eq: el.dataset.eq }; this.#renderDetail(); });
    const st = profile.stats();
    $('statsbox').innerHTML = [
      ['Level', d.level], ['Attack', `+${st.flatAtk}`], ['Damage', `x${st.atkMult.toFixed(2)}`], ['Crit', `${Math.round(st.crit * 100)}%`],
      ['Max HP', st.maxHp], ['Defense', `${Math.round((st.def || 0) * 100)}%`], ['Blade', `+${d.swordLevel}`], ['Patch CD', `${(8 * st.patchCdMul).toFixed(1)}s`],
      ['Gold', d.gold], ['Shards', d.shards], ['Debug pts', d.debugPoints], ['Loot', `x${st.lootMul.toFixed(2)}`],
    ].map(([k, v]) => `<div>${k}: <b>${v}</b></div>`).join('');
    $('bag-count').textContent = `${d.bag.length} / 24`;
    $('bag').innerHTML = d.bag.map(it => `<div class="cell${this.sel?.uid === it.uid ? ' sel' : ''}" data-uid="${it.uid}" style="border-color:${RARITY[it.rarity].color}">${itemIcon(it.slot, RARITY[it.rarity].color)}</div>`).join('') || '<small style="opacity:.6">Empty. Defeat enemies and open chests to find gear.</small>';
    for (const el of $('bag').querySelectorAll('.cell')) el.addEventListener('click', () => { this.sel = { uid: +el.dataset.uid }; this.#renderGear(); });
    player.refreshStats();
    this.#renderDetail();
  }

  #renderDetail() {
    const { profile, player, hud } = this.core, d = profile.d;
    const box = $('detail');
    let it = null, equipped = false;
    if (this.sel?.uid) it = d.bag.find(x => x.uid === this.sel.uid);
    if (this.sel?.eq) { it = d.equip[this.sel.eq]; equipped = true; }
    if (!it) { box.innerHTML = '<small style="opacity:.7">Tap an item to see it. Equip gear to get stronger; scrap gear you don\'t need for glitch shards.</small>'; return; }
    const c = RARITY[it.rarity].color, cur = d.equip[it.slot];
    box.innerHTML = `<h4 style="color:${c}">${it.name}</h4><div style="font-size:11px;opacity:.7">${RARITY[it.rarity].name} ${SLOT_NAMES[it.slot]}</div>
      <div class="lines">${it.lines.join('<br>')}</div>
      ${!equipped && cur ? `<div class="cmp">Equipped now: ${cur.name} (${cur.lines.join(', ')})</div>` : ''}
      ${equipped ? '<button id="d-unequip">Unequip</button>' : `<button id="d-equip" class="primary">Equip</button><button id="d-scrap">Scrap (+${it.scrap} shard${it.scrap > 1 ? 's' : ''})</button>`}`;
    $('d-equip')?.addEventListener('click', () => { profile.equip(it.uid); this.sel = null; player.refreshStats(); this.#renderGear(); });
    $('d-scrap')?.addEventListener('click', () => { profile.scrap(it.uid); this.sel = null; hud.wallet(d); this.#renderGear(); });
    $('d-unequip')?.addEventListener('click', () => { profile.unequip(it.slot); this.sel = null; player.refreshStats(); this.#renderGear(); });
  }

  // ---------- Skills ----------
  #renderSkills() {
    const { profile, player } = this.core, d = profile.d;
    $('sp-count').textContent = d.skillPoints;
    $('tree').innerHTML = BRANCHES.map(b => `<div class="branch" style="--c:${b.color}"><h5 style="color:${b.color}">${b.name}</h5>${
      SKILLS.filter(s => s.branch === b.id).map(s => `<div class="node ${d.skills[s.id] ? 'have' : profile.canLearn(s.id) ? 'can' : ''}" data-id="${s.id}"><b>${s.name}</b>${s.text}</div>`).join('')}</div>`).join('');
    for (const el of $('tree').querySelectorAll('.node')) el.addEventListener('click', () => {
      if (profile.learn(el.dataset.id)) { player.refreshStats(); this.core.hud.wallet(d); this.#renderSkills(); this.#badge(); }
    });
  }

  // ---------- Map ----------
  #renderMap() {
    const z = this.core.zone(); if (!z) return;
    const m = z.map, cv = $('mapcv'), g = cv.getContext('2d'), W = cv.width, R = m.radius;
    const toC = (x, zz) => [W / 2 + x / R * W * 0.47, W / 2 + zz / R * W * 0.47];
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, W);
    g.fillStyle = m.ground || '#3f7a35'; g.beginPath(); g.arc(W / 2, W / 2, W * 0.47, 0, Math.PI * 2); g.fill();
    // River.
    if (m.riverX) {
      g.strokeStyle = '#3f8fd6'; g.lineWidth = 9; g.beginPath();
      for (let zz = -R; zz <= R; zz += 4) { const [x, y] = toC(m.riverX(zz), zz); zz === -R ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    // Paths.
    g.strokeStyle = '#c9b27e'; g.lineWidth = 4;
    for (const line of m.paths) { g.beginPath(); line.forEach(([x, zz], i) => { const [a, b] = toC(x, zz); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); }
    // Places.
    g.font = 'bold 12px system-ui'; g.textAlign = 'center';
    for (const p of m.places) {
      const [x, y] = toC(p.p.x, p.p.z); g.fillStyle = p.color + 'aa'; g.beginPath(); g.arc(x, y, Math.max(5, p.r / R * W * 0.47), 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.fillText(p.name, x, y - Math.max(8, p.r / R * W * 0.47) - 3);
    }
    for (const c of m.crystals()) { const [x, y] = toC(c.x, c.z); g.fillStyle = '#29e6ff'; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x, y + 7); g.lineTo(x - 5, y); g.fill(); }
    for (const c of m.chests()) if (c.opened) { const [x, y] = toC(c.p.x, c.p.z); g.fillStyle = '#8a5a2b'; g.fillRect(x - 5, y - 4, 10, 8); }
    const o = m.objective(); if (o) { const [x, y] = toC(o.x, o.z); g.strokeStyle = '#ffe28a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.stroke(); }
    // Jasper.
    const p = this.core.player; const [px, py] = toC(p.pos.x, p.pos.z);
    g.save(); g.translate(px, py); g.rotate(-p.facing + Math.PI); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.fill(); g.restore();
    const found = m.chests().filter(c => c.opened).length;
    $('maplegend').innerHTML = `<b>${z.name}</b><br><span style="color:#fff">&#9650;</span> Jasper<br><span style="color:#ffe28a">&#9711;</span> Objective<br><span style="color:#29e6ff">&#9670;</span> Save crystal<br><span style="color:#c08a4b">&#9632;</span> Chests found: ${found} / ${m.chests().length}`;
  }

  // ---------- Bram's forge ----------
  openForge() { $('forge').classList.remove('hidden'); this.core.onPause(true); this.#renderForge(); }
  closeForge() { $('forge').classList.add('hidden'); this.core.onPause(false); this.core.profile.save(); }
  #renderForge() {
    const p = this.core.profile, d = p.d, c = p.swordCost();
    $('forge-title').textContent = `Debug Blade +${d.swordLevel}`;
    if (d.swordLevel >= 5) { $('forge-text').innerHTML = 'Fully upgraded! "That\'s the finest blade I\'ve ever made," says Bram.'; $('forge-up').disabled = true; return; }
    $('forge-text').innerHTML = `Next: <b>+${d.swordLevel + 1}</b> (+3 attack)<br>Cost: <b style="color:#f5c542">${c.gold} gold</b> and <b style="color:#ff7ae8">${c.shards} shards</b><br>You have ${d.gold} gold, ${d.shards} shards.`;
    $('forge-up').disabled = !p.canUpgradeSword();
    $('forge-up').textContent = p.canUpgradeSword() ? 'Upgrade' : 'Not enough';
  }
}
