import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
from qa_lib import *
HERO = sys.argv[1] if len(sys.argv) > 1 else 'jasper'
SAVE = {'level': 16, 'swordLevel': 4, 'hero': HERO, 'ngPlus': 1 if HERO == 'victory' else 0, 'consoleUnlocked': True, 'zone': 'z3', 'arrive': 'gate', 'zones': {'z1': {'stage': 9, 'stageId': 'done', 'flags': {}}, 'z2': {'stage': 6, 'stageId': 'done', 'flags': {}}}}
P = 'v_' if HERO == 'victory' else ''
with sync_playwright() as pw:
    gm = Game(pw, save=SAVE)
    gm.step(20)
    check(P+'H1 arrive in the Capital', gm.ev(f"{G}.zone.id") == 'z3', gm.stage())
    s, h = bot(gm, ['purge'], log=True)
    check(P+'H2 Rho patched, purge starts', s == 'purge', s)
    s, h = bot(gm, ['tower'], log=True, max_iter=2000)
    check(P+'H3 every copy defeated', s == 'tower', s)
    s, h = bot(gm, ['throne'], log=True)
    check(P+'H6 cage patched, ally joins', s == 'throne' and gm.ev(f"{G}.npcs.find(n => n.mode !== undefined)?.mode") == 'follow', s)
    ally = gm.ev(f"{G}.npcs.find(n => n.mode !== undefined)?.name")
    check(P+'J4 ally name', ally == ('JASPER' if HERO == 'victory' else 'VICTORY'), ally)
    s, h = bot(gm, ['boss'], log=True)
    check(P+'H7 keep door -> throne room boss starts', s == 'boss', s)
    gm.step(30); gm.shot(P+'z3_boss')
    s, h = bot(gm, ['done'], log=True, max_iter=2500)
    check(P+'H8 Sir Duplicate defeated', s == 'done', s)
    gm.step(60)
    labels = gm.ev(f"{G}.zone.interactables().map(i=>i.label)")
    check(P+'H9 rift available in the throne room', any('rift' in l for l in labels), labels)
    gm.shot(P+'z3_rift')
    check(P+'no page errors z3', not gm.errs, gm.errs[:2])
    gm.close()
save_results(P + 'z3')
