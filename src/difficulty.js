// Difficulty per zone (release tuning). Every enemy's HP and damage is multiplied once when a zone loads.
// Zone 1: Medium · Zone 2: Medium-Hard · Zone 3: Hard · Zone 4: Hell.
export const DIFFICULTY = {
  z1: { name: 'MEDIUM', hp: 1.2, dmg: 1.2, bossHp: 1.3, bossDmg: 1.25 },
  z2: { name: 'MEDIUM-HARD', hp: 1.35, dmg: 1.35, bossHp: 1.5, bossDmg: 1.4 },
  z3: { name: 'HARD', hp: 1.6, dmg: 1.55, bossHp: 2.0, bossDmg: 1.7 },
  z4: { name: 'HELL', hp: 1.9, dmg: 1.85, bossHp: 2.4, bossDmg: 2.1 },
};

export function applyDifficulty(zoneId, e) {
  const D = DIFFICULTY[zoneId]; if (!D || e.diffApplied) return e;
  e.diffApplied = true;
  const boss = e.isBoss, hp = boss ? D.bossHp : D.hp, dmg = boss ? D.bossDmg : D.dmg;
  if (e.maxHp > 1) { e.maxHp = Math.round(e.maxHp * hp); e.hp = e.maxHp; }
  e.diffDmg = dmg; // damage is multiplied where hits land (main.js), so every attack type is covered
  return e;
}
export function applyAll(zoneId, list) { for (const e of list) applyDifficulty(zoneId, e); return list; }
