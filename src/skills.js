// Skill tree: 3 branches x 4 nodes. Each node needs the one above it (req).
export const BRANCHES = [
  { id: 'blade', name: 'BLADE', color: '#ffe28a', desc: 'Sword power' },
  { id: 'patch', name: 'PATCH', color: '#29e6ff', desc: 'Debug powers' },
  { id: 'debug', name: 'DEBUG', color: '#ff8ae8', desc: 'Body & luck' },
];

export const SKILLS = [
  { id: 'b1', branch: 'blade', name: 'Sharp Edge', text: '+12% sword damage', apply: s => { s.atkMult *= 1.12; } },
  { id: 'b2', branch: 'blade', req: 'b1', name: 'Critical Code', text: '+10% critical hit chance', apply: s => { s.crit += 0.10; } },
  { id: 'b3', branch: 'blade', req: 'b2', name: 'Big Finish', text: 'Finisher and heavy hits deal +50% damage', apply: s => { s.finisherMul *= 1.5; } },
  { id: 'b4', branch: 'blade', req: 'b3', name: 'Storm Lite', text: 'Blade Storm costs 15 less stamina', apply: s => { s.skillCost -= 15; } },
  { id: 'p1', branch: 'patch', req: null, name: 'Long Freeze', text: 'Patched enemies stay frozen +1.5 s', apply: s => { s.freezeBonus += 1.5; } },
  { id: 'p2', branch: 'patch', req: 'p1', name: 'Quick Patch', text: 'Patch cooldown -30%', apply: s => { s.patchCdMul *= 0.7; } },
  { id: 'p3', branch: 'patch', req: 'p2', name: 'Long Range', text: 'Patch reaches 4 m further', apply: s => { s.patchRange += 4; } },
  { id: 'p4', branch: 'patch', req: 'p3', name: 'Big Shatter', text: 'Shatter splash damage x2', apply: s => { s.shatterMul *= 2; } },
  { id: 'd1', branch: 'debug', req: null, name: 'Iron Body', text: '+20 max HP', apply: s => { s.maxHp += 20; } },
  { id: 'd2', branch: 'debug', req: 'd1', name: 'Light Feet', text: 'Dodge costs 10 less stamina, longer invincibility', apply: s => { s.dashCost -= 10; s.iframe += 0.15; } },
  { id: 'd3', branch: 'debug', req: 'd2', name: 'Second Wind', text: 'Stamina regenerates 35% faster', apply: s => { s.staminaRegenMul *= 1.35; } },
  { id: 'd4', branch: 'debug', req: 'd3', name: 'Lucky Byte', text: '+40% gold, shards and item drops', apply: s => { s.lootMul *= 1.4; } },
];
