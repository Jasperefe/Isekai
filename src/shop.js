// Merchant Dot's shop. While Dot is bugged her prices glitch every time you look;
// once patched they settle at a fair 20% discount (the "Price Glitch" side quest).
import { sfx } from './audio.js?v=29';
import { RARITY, makeItem, itemIcon } from './items.js?v=29';

const $ = id => document.getElementById(id);

export class Shop {
  // core: { profile, hud, player, pause(bool) }
  constructor(core) {
    this.core = core; this.stock = [];
    if (!$('shop')) {
      const el = document.createElement('div'); el.id = 'shop'; el.className = 'hidden';
      el.innerHTML = `<div class="sbox"><small>MERCHANT DOT</small><h2>Dot's Goods</h2><p id="shop-note"></p><div class="sitems" id="shop-items"></div><div class="fbtns"><button id="shop-close">Leave</button></div><div class="sgold" id="shop-gold"></div></div>`;
      document.body.appendChild(el);
    }
    $('shop-close').addEventListener('click', () => this.close());
    $('shop-items').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) this.#buy(+b.dataset.i); });
  }

  #restock() {
    const L = this.core.profile.d.level;
    const slots = ['weapon', 'armor', 'charm'];
    this.stock = slots.map((slot, i) => ({ item: makeItem(L + 1, i === 0 ? 'epic' : Math.random() < 0.3 ? 'epic' : 'rare', slot), sold: false }));
    if (Math.random() < 0.35) this.stock[1 + Math.floor(Math.random() * 2)].item = makeItem(L + 1, 'glitched');
  }
  #price(it) {
    const base = Math.round((50 + 14 * this.core.profile.d.level) * RARITY[it.item.rarity].mult);
    return this.fixed ? Math.round(base * 0.8) : Math.max(1, Math.round(base * it.glitch));
  }

  open(fixed) {
    this.fixed = fixed;
    if (!this.stock.length || this.stock.every(s => s.sold)) this.#restock();
    for (const s of this.stock) s.glitch = [0.3, 0.6, 1.4, 2.2, 3.1][Math.floor(Math.random() * 5)];
    sfx('open'); $('shop').classList.remove('hidden'); this.core.pause(true);
    this.#render();
  }
  close() { sfx('close'); $('shop').classList.add('hidden'); this.core.pause(false); this.core.profile.save(); }

  #render() {
    const d = this.core.profile.d;
    $('shop-note').innerHTML = this.fixed ? 'Fair prices, 20% off for my favourite Player!' : '<span class="glitchy">PR1CES M4Y V4RY.</span> Dot\'s price tags keep glitching. Maybe PATCH her?';
    $('shop-items').innerHTML = this.stock.map((s, i) => {
      const it = s.item, r = RARITY[it.rarity], p = this.#price(s);
      return `<div class="sitem${s.sold ? ' sold' : ''}" style="--c:${r.color}"><div class="sic">${itemIcon(it.slot, r.color)}</div><b>${it.name}</b><em style="color:${r.color}">${r.name}</em><span>${it.lines.join('<br>')}</span>
        <button data-i="${i}" ${s.sold || d.gold < p ? 'disabled' : ''}>${s.sold ? 'SOLD' : `<i class="coin"></i> ${p}`}</button></div>`;
    }).join('');
    $('shop-gold').innerHTML = `You have <b>${d.gold}</b> gold &middot; bag ${d.bag.length} / 24`;
  }

  #buy(i) {
    const s = this.stock[i], d = this.core.profile.d; if (!s || s.sold) return;
    const p = this.#price(s);
    if (d.gold < p) { sfx('error'); return; }
    if (!this.core.profile.addItem(s.item)) { sfx('error'); this.core.hud.system('Your bag is full!\nScrap something in GEAR first', 2.2); return; }
    d.gold -= p; s.sold = true; sfx('coin'); sfx('item');
    this.core.hud.wallet(d);
    this.#render();
  }
}
