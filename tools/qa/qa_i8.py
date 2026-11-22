import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
from qa_lib import *
with sync_playwright() as pw:
    gm = Game(pw, save={'level': 20, 'zone': 'z4', 'zones': {'z4': {'stage': 4, 'stageId': 'climb', 'flags': {}}}})
    gm.step(10)
    gm.ev(f"{G}.player.spawnAt({{x:22,y:0,z:-82}},Math.PI)")
    for i in range(80):
        gm.step(10)
        if gm.ev(f"{G}.boss.active && !{G}.story.busy"): break
    check('I8a NOVA fight started', gm.stage() == 'boss' and gm.ev(f"{G}.boss.active"))
    gm.ev(f"(()=>{{const p={G}.player; p.barrier=0; p.invuln=0; p.damage(1e6, p.pos.clone().add(new p.pos.constructor(1,0,0)), null, {{}});}})()"); gm.step(5)
    check('I8 dying vs NOVA resets the fight (back to climb)', gm.stage() == 'climb' and not gm.ev(f"{G}.boss.active"), gm.stage())
    gm.step(150)
    check('I8b respawn after NOVA death', gm.ev(f"{G}.player.alive"), gm.ev(f"{G}.player.pos.toArray().map(v=>+v.toFixed(1))"))
    check('no page errors i8', not gm.errs, gm.errs[:2])
    gm.close()
save_results('i8')
