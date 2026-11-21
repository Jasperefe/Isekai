// Gear: weapons, armor and charms with rarities and random stats.
export const RARITY = {
  common: { name: 'Common', color: '#d8dde6', mult: 1, affixes: 0, weight: 60 },
  rare: { name: 'Rare', color: '#4fa3ff', mult: 1.6, affixes: 0, weight: 28 },
  epic: { name: 'Epic', color: '#b46bff', mult: 2.4, affixes: 1, weight: 10 },
  glitched: { name: 'Glitched', color: '#ff2bd6', mult: 2.0, affixes: 2, weight: 2 },
};

const WEAPONS = ['Pixel Edge', 'Debug Saber', 'Null Cutter', 'Patch Blade', 'Hotfix Sword', 'Lag Slicer'];
const ARMORS = ['Tester Hoodie', 'Firewall Vest', 'Cache Coat', 'Sandbox Mail', 'Kernel Cloak'];
const CHARMS = [
  { name: 'Cooldown Chip', stat: 'patchCdMul', base: 0.9, per: -0.04, fmt: v => `Patch cooldown -${Math.round((1 - v) * 100)}%` },
  { name: 'Stamina Core', stat: 'staminaRegenMul', base: 1.12, per: 0.06, fmt: v => `Stamina regen +${Math.round((v - 1) * 100)}%` },
  { name: 'Lucky Byte', stat: 'lootMul', base: 1.15, per: 0.08, fmt: v => `Loot +${Math.round((v - 1) * 100)}%` },
  { name: 'XP Cache', stat: 'xpMul', base: 1.12, per: 0.06, fmt: v => `XP +${Math.round((v - 1) * 100)}%` },
  { name: 'Crit Module', stat: 'crit', base: 0.05, per: 0.03, fmt: v => `Crit chance +${Math.round(v * 100)}%` },
];
// Extra random bonuses on Epic and Glitched gear.
const AFFIXES = [
  { stat: 'doubleHit', v: r => 0.08 * r, fmt: v => `${Math.round(v * 100)}% chance to hit twice` },
  { stat: 'lifesteal', v: r => 0.03 * r, fmt: v => `Heal ${Math.round(v * 100)}% of damage dealt` },
  { stat: 'crit', v: r => 0.04 * r, fmt: v => `Crit chance +${Math.round(v * 100)}%` },
  { stat: 'maxHp', v: r => Math.round(10 * r), fmt: v => `+${v} max HP` },
  { stat: 'flatAtk', v: r => Math.round(3 * r), fmt: v => `+${v} attack` },
];

const pick = a => a[Math.floor(Math.random() * a.length)];

export function rollRarity(luck = 1) {
  const w = Object.entries(RARITY).map(([k, r]) => [k, r.weight * (k === 'common' ? 1 : luck)]);
  let t = Math.random() * w.reduce((a, [, x]) => a + x, 0);
  for (const [k, x] of w) { t -= x; if (t <= 0) return k; }
  return 'common';
}

// level: zone power level; rarity optional; slot optional.
export function makeItem(level = 1, rarity = rollRarity(), slot = pick(['weapon', 'armor', 'charm'])) {
  const R = RARITY[rarity], m = R.mult * (1 + (level - 1) * 0.15);
  const item = { slot, rarity, level, stats: {}, lines: [] };
  if (slot === 'weapon') {
    item.name = pick(WEAPONS);
    const atk = Math.round(3 * m + Math.random() * 2);
    item.stats.flatAtk = atk; item.lines.push(`+${atk} attack`);
  } else if (slot === 'armor') {
    item.name = pick(ARMORS);
    const hp = Math.round(12 * m), def = Math.min(0.3, +(0.03 * m).toFixed(2));
    item.stats.maxHp = hp; item.stats.def = def; item.lines.push(`+${hp} max HP`, `-${Math.round(def * 100)}% damage taken`);
  } else {
    const c = pick(CHARMS);
    item.name = c.name;
    const v = +(c.base + c.per * (R.mult - 1) * 1.5).toFixed(3);
    item.stats[c.stat] = v; item.lines.push(c.fmt(v));
  }
  const used = new Set();
  for (let i = 0; i < R.affixes; i++) {
    let a; do { a = pick(AFFIXES); } while (used.has(a.stat)); used.add(a.stat);
    const v = +a.v(R.mult).toFixed(3);
    item.stats[a.stat] = (item.stats[a.stat] || 0) + v; item.lines.push(a.fmt(v));
  }
  if (rarity === 'glitched') item.name = item.name.replace(/[aeio]/, c => ({ a: '4', e: '3', i: '1', o: '0' })[c]) + '.exe';
  item.scrap = { common: 1, rare: 3, epic: 8, glitched: 12 }[rarity];
  return item;
}

// Small SVG icon per slot, tinted by rarity.
export function itemIcon(slot, color) {
  const paths = {
    weapon: '<path d="M22 4l6 0 0 6-12 12-3-3z" fill="C"/><path d="M8 18l6 6-2 2-2-2-4 4-2-2 4-4-2-2z" fill="C" opacity=".8"/>',
    armor: '<path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="C"/>',
    charm: '<circle cx="16" cy="17" r="9" fill="none" stroke="C" stroke-width="3"/><path d="M16 4l3 5h-6z" fill="C"/><circle cx="16" cy="17" r="3" fill="C"/>',
  };
  return `<svg viewBox="0 0 32 32" width="100%" height="100%">${paths[slot].replaceAll('"C"', `"${color}"`)}</svg>`;
}
