import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
from qa_lib import *
HERO = sys.argv[1] if len(sys.argv) > 1 else 'jasper'
END = sys.argv[2] if len(sys.argv) > 2 else 'finish'
SAVE = {'level': 20, 'swordLevel': 5, 'hero': HERO, 'ngPlus': 1 if HERO == 'victory' else 0, 'consoleUnlocked': True, 'zone': 'z4', 'arrive': 'gate',
        'zones': {'z1': {'stage': 9, 'stageId': 'done', 'flags': {}}, 'z2': {'stage': 6, 'stageId': 'done', 'flags': {}}, 'z3': {'stage': 7, 'stageId': 'done', 'flags': {}}}}
P = 'v_' if HERO == 'victory' else ''
with sync_playwright() as pw:
    gm = Game(pw, save=SAVE, ads=True)
    gm.step(20)
    check(P+'I1 arrive on the spawn pad', gm.ev(f"{G}.zone.id") == 'z4' and gm.stage() == 'town', gm.stage())
    s, h = bot(gm, ['bridge'], log=True, hop=200)
    check(P+'I2 town cleared', s == 'bridge', s)
    s, h = bot(gm, ['graveyard'], log=True, hop=200)
    check(P+'I3 TODO bridge patched', s == 'graveyard' and gm.ev(f"{G}.world.bridgeDone"), s)
    s, h = bot(gm, ['climb'], log=True, hop=200)
    check(P+'I4 graveyard cleared, stairs on', s == 'climb', s)
    # I5 fall
    gm.ev(f"{G}.player.spawnAt({{x:0,y:0,z:5}},0)"); gm.step(20)
    hp0 = gm.ev(f"{G}.player.hp"); gm.ev(f"(()=>{{const p={G}.player; p.pos.set(0,0,45); p.onGround=false;}})()"); gm.step(120)
    check(P+'I5 fall into the void: back on safe ground, -15% HP', gm.ev(f"{G}.player.pos.y") > -1 and gm.ev(f"{G}.player.hp") < hp0, gm.ev(f"{G}.player.pos.toArray().map(v=>+v.toFixed(1))"))
    # I8 die in the boss fight -> back to climb
    s, h = bot(gm, ['boss'], log=True, hop=200)
    for i in range(60):
        gm.step(10)
        if gm.ev(f"{G}.boss.active && !{G}.story.busy"): break
    gm.ev(f"(()=>{{const p={G}.player; p.invuln=0; p.damage(1e6, p.pos.clone().add(new p.pos.constructor(1,0,0)), null, {{}});}})()"); gm.step(20)
    check(P+'I8 dying vs NOVA resets the fight (back to climb)', gm.stage() == 'climb' and not gm.vis('#revive .rv-box'), gm.stage())
    gm.step(150)
    s, h = bot(gm, ['choice'], log=True, hop=200, max_iter=3000)
    check(P+'I7 NOVA defeated', s in ('choice', 'ending'), s)
    gm.step(30)
    check(P+'I9 choice screen', gm.vis('#ending'), '')
    gm.shot(P+'z4_choice')
    btns = gm.ev("[...document.querySelectorAll('#ending button')].map(b=>b.dataset.e||b.className)")
    check(P+'I9b choice buttons', btns, btns)
    gm.click('#ending [data-e=later]'); gm.step(10)
    check(P+'I10 Not yet closes the choice', not gm.vis('#ending'))
    gm.ev(f"{G}.player.spawnAt({{x:22,y:0,z:-86}},0)"); gm.step(10)
    labels = gm.ev(f"{G}.zone.interactables().map(i=>i.label)")
    check(P+'I10b Answer NOVA reopens', 'Answer NOVA' in labels, labels)
    gm.ev(f"{G}.zone.interactables().find(i=>i.label==='Answer NOVA').act()"); gm.step(5)
    gm.ev("window.confirm = () => true")
    gm.click(f'#ending [data-e={END}]')
    for i in range(200):
        gm.step(6); time.sleep(0.25)
        if gm.vis('#ending [data-e=ngv]'): break
    check(P+'I11 ending scene then card ('+END+')', gm.vis('#ending [data-e=ngv]') and gm.vis('#ending [data-e=ngj]'), gm.ev("document.querySelector('#ending h1')?.textContent"))
    gm.shot(P+'z4_card_'+END)
    check(P+'I11b ending saved', END in (gm.ev(f"{G}.profile.d.endings") or []), gm.ev(f"{G}.profile.d.endings"))
    if gm.vis('#ending [data-e=stay]'): gm.click('#ending [data-e=stay]'); gm.step(5)
    check(P+'I11c Keep exploring closes the card', not gm.vis('#ending'))
    check(P+'no page errors z4', not gm.errs, gm.errs[:2])
    gm.close()
save_results(P + 'z4_' + END)
