// Player profile: everything that travels with Jasper from zone to zone
// (level, gold, gear, skills, upgrades), plus each zone's own story progress.
import { SKILLS } from './skills.js?v=23';

const KEY = 'isekai_save_v2';
const OLD_KEY = 'isekai_save_v1';

const DEFAULTS = () => ({
  version: 2,
  level: 1, xp: 0, gold: 0, shards: 0, debugPoints: 0, skillPoints: 0,
  skills: {}, swordLevel: 0,
  bag: [], equip: { weapon: null, armor: null, charm: null },
  zone: 'z1', zones: {},
  areaPatch: false, consoleUnlocked: false, console: {}, pet: null,
  totals: { kills: 0, playTime: 0, chests: 0 },
  nextItemId: 1,
});

export class Profile {
  constructor(data) { this.d = Object.assign(DEFAULTS(), data || {}); }

  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return new Profile(JSON.parse(raw));
      // Migrate a Milestone 2 save.
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (old) {
        const p = new Profile({ level: old.level || 1, xp: old.xp || 0, debugPoints: old.flags?.debugPoints || 0, skillPoints: Math.max(0, (old.level || 1) - 1) });
        p.d.zones.z1 = { stage: old.stage, kills: old.kills, crystal: old.crystal, flags: old.flags || {} };
        p.save();
        return p;
      }
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return new Profile();
  }

  static clear() { try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch (e) { /* ignore */ } }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ } }

  zone(id) { return (this.d.zones[id] ||= { stage: 0, kills: 0, crystal: -1, flags: {} }); }

  // ---- Items ----
  addItem(item) {
    item.uid = this.d.nextItemId++;
    if (this.d.bag.length >= 24) return false;
    this.d.bag.push(item);
    return true;
  }
  equip(uid) {
    const i = this.d.bag.findIndex(x => x.uid === uid); if (i < 0) return;
    const item = this.d.bag[i], old = this.d.equip[item.slot];
    this.d.bag.splice(i, 1);
    if (old) this.d.bag.push(old);
    this.d.equip[item.slot] = item;
  }
  unequip(slot) {
    const it = this.d.equip[slot]; if (!it || this.d.bag.length >= 24) return;
    this.d.equip[slot] = null; this.d.bag.push(it);
  }
  scrap(uid) {
    const i = this.d.bag.findIndex(x => x.uid === uid); if (i < 0) return 0;
    const v = this.d.bag[i].scrap; this.d.bag.splice(i, 1); this.d.shards += v; return v;
  }

  // ---- Skills ----
  canLearn(id) {
    const s = SKILLS.find(x => x.id === id);
    if (!s || this.d.skills[id] || this.d.skillPoints < 1) return false;
    return !s.req || !!this.d.skills[s.req];
  }
  learn(id) { if (!this.canLearn(id)) return false; this.d.skills[id] = true; this.d.skillPoints--; return true; }

  // ---- Sword upgrades at Bram's forge ----
  swordCost() { const n = this.d.swordLevel; return { gold: 30 + n * 35, shards: 3 + n * 3 }; }
  canUpgradeSword() { const c = this.swordCost(); return this.d.swordLevel < 5 && this.d.gold >= c.gold && this.d.shards >= c.shards; }
  upgradeSword() {
    if (!this.canUpgradeSword()) return false;
    const c = this.swordCost(); this.d.gold -= c.gold; this.d.shards -= c.shards; this.d.swordLevel++; return true;
  }

  // ---- Derived combat stats from level, gear, upgrades and skills ----
  stats() {
    const s = {
      flatAtk: this.d.swordLevel * 3 + (this.d.level - 1) * 2, atkMult: 1, crit: 0.05, critMult: 1.6,
      maxHp: 100 + (this.d.level - 1) * 10, def: 0,
      patchCdMul: 1, freezeBonus: 0, patchRange: 10, shatterMul: 1,
      staminaRegenMul: 1, dashCost: 25, iframe: 0.45, skillCost: 40,
      lootMul: 1, xpMul: 1, finisherMul: 1, doubleHit: 0, lifesteal: 0,
    };
    for (const it of Object.values(this.d.equip)) if (it) for (const [k, v] of Object.entries(it.stats)) {
      if (k === 'atkMult' || k === 'patchCdMul' || k === 'staminaRegenMul' || k === 'lootMul' || k === 'xpMul') s[k] *= v; else s[k] = (s[k] || 0) + v;
    }
    for (const sk of SKILLS) if (this.d.skills[sk.id]) sk.apply(s);
    return s;
  }
}
