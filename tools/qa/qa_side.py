import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
from qa_lib import *
Z1DONE = {'stage': 9, 'stageId': 'done', 'flags': {}}
with sync_playwright() as pw:
    # ---- Zone 1: forge, Nia, respawn timer in a cleared zone ----
    gm = Game(pw, save={'level': 8, 'gold': 500, 'shards': 40, 'zone': 'z1', 'zones': {'z1': {'stage': 4, 'stageId': 'slimes', 'flags': {'bramFixed': True}}}})
    gm.step(20)
    nia = gm.ev(f"(()=>{{const g={G}; const n=g.npcs.find(n=>n.name==='NIA'); if(!n) return null; g.player.spawnAt(n.pos.clone().add(new g.player.pos.constructor(0,0,2)), Math.PI); return n.bugged;}})()")
    gm.step(5); t = gm.ev(f"{G}.player.patchTarget()?.name")
    gm.ev(f"{G}.player.patchCd=0; {G}.input.pressed.add('patch')"); gm.step(60)
    check('F3 Nia stuck in the wall can be patched', nia and t == 'NIA' and not gm.ev(f"{G}.npcs.find(n=>n.name==='NIA').bugged"), (nia, t))
    sl0 = gm.ev(f"{G}.profile.d.swordLevel")
    gm.ev(f"{G}.menu.openForge()"); gm.step(1); gm.shot('F_forge')
    gm.click('#forge-up'); check('F8 forge upgrade spends gold and shards', gm.ev(f"{G}.profile.d.swordLevel") == sl0 + 1)
    gm.ev(f"{G}.profile.d.gold = 0"); gm.click('#forge-up')
    check('F8b forge refuses without gold', gm.ev(f"{G}.profile.d.swordLevel") == sl0 + 1, gm.ev("document.getElementById('forge-text').textContent"))
    gm.click('#forge-close'); gm.step(2)
    check('F8c forge closes and resumes', not gm.vis('#forge .fbox') and not gm.ev("document.body.classList.contains('paused')"))
    check('no page errors side z1', not gm.errs, gm.errs[:2]); gm.close()

    gm = Game(pw, save={'level': 8, 'zone': 'z1', 'zones': {'z1': Z1DONE}})
    gm.step(20)
    r = gm.ev(f"(()=>{{const g={G}; const e=g.enemies.find(e=>e.alive&&!e.isBoss); if(!e) return 'none'; e.takeHit(1e6, g.player.pos); g.ctx.onKill(e); for(let i=0;i<5;i++) window.__step(1/30); return e.respawnT;}})()")
    check('K5 cleared zone: enemies come back after about 3 minutes', r == 'none' or r >= 170, r)
    check('K5b boss stays defeated', not gm.ev(f"{G}.boss.alive"))
    gm.close()

    # ---- Zone 2: Pip, secret chest labels ----
    gm = Game(pw, save={'level': 10, 'consoleUnlocked': True, 'zone': 'z2', 'zones': {'z1': Z1DONE, 'z2': {'stage': 3, 'stageId': 'purge', 'flags': {'metMira': True, 'pip': 'asked'}}}})
    gm.step(20)
    gm.ev(f"(()=>{{const g={G}; g.player.spawnAt(g.pet.pos.clone().add(new g.player.pos.constructor(0,0,1.5)), Math.PI);}})()"); gm.step(5)
    gm.ev(f"{G}.player.patchCd=0; {G}.input.pressed.add('patch')"); gm.step(60)
    check('G3a Pip patched (found)', gm.ev(f"{G}.story.flags.pip") == 'found', gm.ev(f"{G}.story.flags.pip"))
    gm.ev(f"(()=>{{const g={G}; const m=g.npcs.find(n=>n.name==='MIRA'); g.player.spawnAt(m.pos.clone().add(new g.player.pos.constructor(0,0,2)), Math.PI); g.story.talk(m);}})()"); gm.step(60)
    check('G3b Pip returned to Mira, joins you', gm.ev(f"{G}.profile.d.pet") == 'pip' and gm.ev(f"{G}.pet.mode") == 'follow', gm.ev(f"{G}.pet.mode"))
    needs = gm.ev(f"{G}.zone.map.chests().map(c=>c.need).filter(Boolean)")
    check('G6 secret chests marked (needs /noclip, /doublejump)', sorted(needs) == ['needs /doublejump', 'needs /noclip'], needs)
    check('no page errors side z2', not gm.errs, gm.errs[:2]); gm.close()

    # ---- Zone 3: Dot's shop, ghost house chest ----
    gm = Game(pw, save={'level': 16, 'gold': 2000, 'zone': 'z3', 'zones': {'z3': {'stage': 4, 'stageId': 'purge', 'flags': {'intro': True, 'rhoFixed': True}}}})
    gm.step(20)
    gm.ev(f"(()=>{{const g={G}; const d=g.npcs.find(n=>n.name==='DOT'); g.player.spawnAt(d.pos.clone().add(new g.player.pos.constructor(0,0,2)), Math.PI); g.zone.interactables().find(i=>/Shop/.test(i.label)).act();}})()")
    for i in range(40):
        gm.step(5)
        if gm.vis('#shop .sbox'): break
    check('H4a Dot\'s shop opens', gm.vis('#shop .sbox')); gm.shot('H_shop')
    g0 = gm.ev(f"{G}.profile.d.gold"); gm.ev("document.querySelector('#shop-items button[data-i]')?.click()"); gm.step(1)
    check('H4b buying spends gold', gm.ev(f"{G}.profile.d.gold") < g0, (g0, gm.ev(f"{G}.profile.d.gold")))
    gm.ev(f"{G}.profile.d.gold = 0"); n0 = gm.ev(f"{G}.profile.d.bag.length"); gm.ev("[...document.querySelectorAll('#shop-items button[data-i]')].pop()?.click()"); gm.step(1)
    check('H4c cannot buy without gold', gm.ev(f"{G}.profile.d.bag.length") == n0)
    gm.ev("document.getElementById('shop-close')?.click()"); gm.step(2)
    gh = gm.ev(f"(()=>{{const g={G}; const gh=g.world.ghosts[0]; g.player.spawnAt(gh.pos.clone().add(new g.player.pos.constructor(0,0,3)), Math.PI); return gh.id;}})()"); gm.step(5)
    pt = gm.ev(f"{G}.player.patchTarget() ? 'yes' : 'no'")
    gm.ev(f"{G}.player.patchCd=0; {G}.input.pressed.add('patch')"); gm.step(60)
    vis_chests = gm.ev(f"{G}.zone.chests.filter(c=>!c.hidden).length")
    check('H5 patching a ghost house drops a chest', vis_chests == 3, (gh, pt, vis_chests))
    check('no page errors side z3', not gm.errs, gm.errs[:2]); gm.close()

    # ---- Zone 4: secret pad chest, true ending unlock ----
    ALLC = {'z1': {'stage': 9, 'stageId': 'done', 'flags': {'chests': ['a', 'b', 'c', 'd']}}, 'z2': {'stage': 6, 'stageId': 'done', 'flags': {'chests': ['c1', 'c2', 'c3', 'c4']}}, 'z3': {'stage': 7, 'stageId': 'done', 'flags': {'chests': ['c1', 'c2', 'c3', 'c4']}}}
    gm = Game(pw, save={'level': 20, 'zone': 'z4', 'zones': dict(ALLC, z4={'stage': 1, 'stageId': 'town', 'flags': {'chests': ['c1']}})})
    gm.step(20)
    dp0 = gm.ev(f"{G}.profile.d.debugPoints")
    gm.ev(f"{G}.player.spawnAt({{x:47.5,y:0,z:18.5}}, 0)"); gm.step(5)
    y = gm.ev(f"{G}.player.pos.y")
    it = gm.ev(f"(()=>{{const i={G}.zone.interactables().find(i=>i.label==='Open chest'); if(i) i.act(); return !!i;}})()"); gm.step(5)
    check('I6 secret pad chest (Debug Point)', it and gm.ev(f"{G}.profile.d.debugPoints") == dp0 + 1 and y > 2, (it, y))
    gm.ev(f"{G}.zone.endings.choose()"); gm.step(2)
    check('I12 all 14 chests: PATCH NOVA available', gm.vis('#ending [data-e=patch]'))
    gm.shot('I_true_choice')
    gm.ev("window.confirm = () => true"); gm.click('#ending [data-e=patch]')
    for i in range(200):
        gm.step(6); time.sleep(0.25)
        if gm.vis('#ending [data-e=ngv]'): break
    check('I12b true ending card', 'PATCHED' in (gm.ev("document.querySelector('#ending h1')?.textContent") or ''))
    check('no page errors side z4', not gm.errs, gm.errs[:2]); gm.close()

    # ---- L4/D10/J1: New Game+ from Settings ----
    gm = Game(pw, save={'level': 20, 'gold': 777, 'endings': ['finish'], 'zone': 'z4', 'zones': {'z4': {'stage': 7, 'stageId': 'done', 'flags': {}}}})
    gm.step(10)
    gm.ev(f"{G}.menu.show('settings')"); gm.step(1)
    check('D10 New Game+ buttons after an ending', gm.vis('#menu-ngv') and gm.vis('#menu-ngj'))
    gm.ev("window.confirm = () => true"); gm.click('#menu-ngv'); time.sleep(3)
    gm.p.wait_for_function('window.__game && window.__game.zone', timeout=120000); time.sleep(1)
    d = gm.ev("JSON.parse(localStorage.getItem('isekai_save_v2'))")
    check('J1 New Game+ keeps level and gold, resets zones, hero Victory', d['hero'] == 'victory' and d['level'] == 20 and d['gold'] == 777 and d['zone'] == 'z1' and not d['zones'].get('z4'), (d['hero'], d['level'], d['gold'], d['zone']))
    check('J1b HUD says VICTORY / PLAYER TWO', gm.ev("document.getElementById('pp-hero').textContent") == 'VICTORY' and gm.ev("document.body.classList.contains('hero-v')"))
    check('no page errors NG+', not gm.errs, gm.errs[:2]); gm.close()
save_results('side')
