// Difficulty per zone (release tuning). Every enemy's HP and damage is multiplied once when a zone loads.
// Zone 1: Medium · Zone 2: Medium-Hard · Zone 3: Hard · Zone 4: Hell.
export const DIFFICULTY = {
  // Raised again in build 34 (about +30% over build 30).
  z1: { name: 'MEDIUM', hp: 1.5, dmg: 1.45, bossHp: 1.7, bossDmg: 1.6 },
  z2: { name: 'MEDIUM-HARD', hp: 1.75, dmg: 1.7, bossHp: 2.0, bossDmg: 1.85 },
  z3: { name: 'HARD', hp: 2.1, dmg: 2.0, bossHp: 2.6, bossDmg: 2.2 },
  z4: { name: 'HELL', hp: 2.5, dmg: 2.4, bossHp: 3.1, bossDmg: 2.7 },
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
