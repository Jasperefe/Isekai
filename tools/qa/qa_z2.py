import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
from qa_lib import *
HERO = sys.argv[1] if len(sys.argv) > 1 else 'jasper'
P = 'v_' if HERO == 'victory' else ''
SAVE = {'hero': HERO, 'level': 9, 'swordLevel': 2, 'zone': 'z2', 'arrive': 'gate', 'zones': {'z1': {'stage': 9, 'stageId': 'done', 'flags': {'chests': []}}}}
with sync_playwright() as pw:
    gm = Game(pw, save=SAVE)
    gm.step(20)
    check(P+'G1 arrive in Glitchwood', gm.ev(f"{G}.zone.id") == 'z2', gm.stage())
    s, h = bot(gm, ['grove', 'purge'], log=True)
    check(P+'G2 Mira met, Console unlocked', gm.ev(f"{G}.profile.d.consoleUnlocked") and gm.vis('#btn-console'), s)
    check(P+'B7 console button visible after Mira', gm.vis('#btn-console'))
    s, h = bot(gm, ['purge', 'hollow'], log=True)
    check(P+'G3 grove cleared', s in ('purge', 'hollow'), s)
    s, h = bot(gm, ['hollow', 'boss'], log=True, max_iter=1500)
    check(P+'G4 seal broken (all Null enemies)', s in ('hollow', 'boss'), s)
    gm.shot('z2_hollow')
    s, h = bot(gm, ['done'], log=True, max_iter=1500)
    check(P+'G5 Thornwraith defeated', s == 'done', s)
    labels = gm.ev(f"{G}.zone.interactables().map(i=>i.label)")
    check(P+'G7 Road to the Capital available', any('Capital' in l for l in labels), labels)
    check(P+'no page errors z2', not gm.errs, gm.errs[:2])
    gm.close()
save_results(P+'z2')
