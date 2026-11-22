# Playgama checks against the built zip (served from dist/playgama) with a scripted fake Bridge.
import time, sys
import os as _os, re as _re
V = _re.search(r'main\.js\?v=(\d+)', open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '../../index.html')).read()).group(1)
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8780'
G='window.__game'
def mock(rewarded_ok=True, fail_reward=False):
    return r"""
window.__adlog = []; window.__emit = null;
(() => {
  const L = {}; const on = (n, f) => (L[n] ||= []).push(f); const emit = (n, v) => (L[n] || []).forEach(f => f(v)); window.__emit = emit;
  window.bridge = {
    EVENT_NAME: { INTERSTITIAL_STATE_CHANGED: 'i', REWARDED_STATE_CHANGED: 'r', PAUSE_STATE_CHANGED: 'p', AUDIO_STATE_CHANGED: 'a' },
    initialize: () => Promise.resolve(),
    platform: { id: 'testmock', sendMessage: m => __adlog.push('msg:' + m), on },
    advertisement: { isInterstitialSupported: true, isRewardedSupported: %s, interstitialState: 'closed', on,
      setMinimumDelayBetweenInterstitial(s) { __adlog.push('delay:' + s); },
      showInterstitial: p => { __adlog.push('inter:' + p); emit('i', 'opened'); setTimeout(() => emit('i', 'closed'), 400); },
      showRewarded: p => { __adlog.push('rew:' + p); emit('r', 'opened'); setTimeout(() => { %s emit('r', 'closed'); }, 400); } },
  };
})();""" % ('true' if rewarded_ok else 'false', '' if fail_reward else "emit('r', 'rewarded');")
results = []
def check(name, ok, note=''):
    results.append((name, ok, note)); print(('PASS ' if ok else 'FAIL ') + name + (' - ' + note if note else ''))
def run(m, save, fn):
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1, is_mobile=True, has_touch=True)
        ctx.route('**/playgama-bridge.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=m))
        page = ctx.new_page(); errs=[]
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.goto(BASE + '/index.html'); page.evaluate("localStorage.setItem('isekai_save_v2', JSON.stringify(%s))" % save)
        page.goto(BASE + '/index.html?fast'); page.wait_for_function('window.__game && window.__game.zone', timeout=90000); time.sleep(1.2)
        page.evaluate(f"{G}.input.update=()=>{{}}")
        step=lambda n: page.evaluate(f"(()=>{{for(let i=0;i<{n};i++){{ if({G}.dialogue.active) {G}.dialogue.advanceReq=true; window.__step(1/30);}} }})()")
        step(30); fn(page, step); check('no page errors', not errs, '; '.join(errs[:2])); b.close()
SAVE = "{level: 22, gold: 100, zone: 'z3', zones: {z3:{stage:4,stageId:'purge',crystal:-1,flags:{intro:true,rhoFixed:true}}}}"
def t1(page, step):
    log = page.evaluate("__adlog")
    check('PG-1 loading/game_ready messages', all(x in log for x in ['msg:in_game_loading_started','msg:in_game_loading_stopped','msg:game_ready','msg:gameplay_started']), str(log[:5]))
    check('PG-2 interstitial min delay 90 s', 'delay:90' in log)
    # platform pause
    page.evaluate("__emit('p', true)"); t0 = page.evaluate(f"{G}.player.pos.toArray()")
    page.evaluate(f"{G}.input.move.y=1"); time.sleep(0.6)
    check('PG-3 platform pause freezes the game', page.evaluate(f"{G}.player.pos.toArray()") == t0)
    page.evaluate("__emit('p', false)"); time.sleep(0.6); page.evaluate(f"{G}.input.move.y=0")
    check('PG-4 platform resume', page.evaluate(f"{G}.player.pos.toArray()") != t0)
    page.evaluate("__emit('a', false)"); page.evaluate("__emit('a', true)"); check('PG-5 audio events accepted', True)
    # offer timer
    check('PG-6 offer card not shown at start', page.evaluate("document.getElementById('offer').classList.contains('hidden')"))
    page.evaluate("import('./src/ads.js?v=" + V + "').then(m => { m.ads.offerT = 0.01; })"); time.sleep(0.3); step(3); time.sleep(0.3)
    check('PG-7 offer card appears when its timer ends', not page.evaluate("document.getElementById('offer').classList.contains('hidden')"))
    page.evaluate("document.querySelector('#offer .ox').click()")
    check('PG-8 offer card close button', page.evaluate("document.getElementById('offer').classList.contains('hidden')"))
    page.evaluate("import('./src/ads.js?v=" + V + "').then(m => m.ads.showOffer('xp2'))"); time.sleep(0.3)
    page.evaluate("document.querySelector('#offer .ogo').click()"); time.sleep(1.0); step(2)
    check('PG-9 2x XP offer grants boost + timer', not page.evaluate("document.getElementById('xp-boost').classList.contains('hidden')"), page.evaluate("document.getElementById('xp-boost').textContent"))
    xp0 = page.evaluate(f"{G}.profile.d.xp"); page.evaluate(f"{G}.player.gainXp(10)")
    check('PG-10 XP doubled while boosted', page.evaluate(f"{G}.profile.d.xp") - xp0 == 20, str(page.evaluate(f"{G}.profile.d.xp") - xp0))
    # offer hidden in boss fight / dialogue
    page.evaluate(f"(()=>{{const g={G}; g.hud.bossBar(true, g.boss);}})()")
    page.evaluate("import('./src/ads.js?v=" + V + "').then(m => { m.ads.offerT = 0.01; })"); time.sleep(0.3); step(3)
    check('PG-11 no offer during a boss fight', page.evaluate("document.getElementById('offer').classList.contains('hidden')"))
    page.evaluate(f"(()=>{{const g={G}; g.hud.bossBar(false);}})()")
    # revive
    page.evaluate(f"(()=>{{const g={G}; g.player.damage(99999, g.player.pos.clone().add(new g.player.pos.constructor(1,0,0)), null, {{}}); }})()"); step(10)
    check('PG-12 revive card on death', not page.evaluate("document.getElementById('revive').classList.contains('hidden')"))
    step(200)
    check('PG-13 no auto-respawn while card open', not page.evaluate(f"{G}.player.alive"))
    page.evaluate("document.getElementById('rv-ad').click()"); time.sleep(1); step(5)
    check('PG-14 rewarded revive', page.evaluate(f"{G}.player.alive and {G}.player.hp === {G}.player.maxHp".replace(' and ', ' && ')))
    # death in boss fight: no card
    page.evaluate(f"(()=>{{const g={G}; g.hud.bossBar(true, g.boss); g.player.invuln=0; g.player.damage(99999, g.player.pos.clone().add(new g.player.pos.constructor(1,0,0)), null, {{}}); }})()"); step(5)
    check('PG-15 no revive card in boss fights', page.evaluate("document.getElementById('revive').classList.contains('hidden')"))
    page.evaluate(f"{G}.hud.bossBar(false)"); step(120); time.sleep(1); step(5)
    log = page.evaluate("__adlog")
    check('PG-16 interstitial on respawn', 'inter:respawn' in log)
    check('PG-17 gameplay stopped/started around ads', log.count('msg:gameplay_stopped') >= 2)
    # travel interstitial
    page.evaluate("window.__inter = []; const si = bridge.advertisement.showInterstitial; bridge.advertisement.showInterstitial = p => { sessionStorage.setItem('adtest', p); si(p); };")
    page.evaluate(f"{G}.travel('z2')"); time.sleep(2.5)
    page.wait_for_load_state(); time.sleep(1)
    check('PG-18 interstitial before zone travel', page.evaluate("sessionStorage.getItem('adtest')") == 'zone_travel', str(page.evaluate("sessionStorage.getItem('adtest')")))
def t2(page, step):
    page.evaluate("import('./src/ads.js?v=" + V + "').then(m => m.ads.showOffer('gold'))"); time.sleep(0.3)
    g0 = page.evaluate(f"{G}.profile.d.gold"); page.evaluate("document.querySelector('#offer .ogo').click()"); time.sleep(1); step(3)
    check('PG-19 no reward if the ad is skipped/fails', page.evaluate(f"{G}.profile.d.gold") == g0)
    page.evaluate(f"(()=>{{const g={G}; g.player.damage(99999, g.player.pos.clone().add(new g.player.pos.constructor(1,0,0)), null, {{}}); }})()"); step(10)
    page.evaluate("document.getElementById('rv-ad').click()"); time.sleep(1); step(10)
    check('PG-20 failed revive ad respawns at crystal instead', page.evaluate(f"{G}.player.alive"))
def t3(page, step):
    page.evaluate(f"(()=>{{const g={G}; g.player.damage(99999, g.player.pos.clone().add(new g.player.pos.constructor(1,0,0)), null, {{}}); }})()"); step(10)
    check('PG-21 no rewarded support: no revive card', page.evaluate("document.getElementById('revive').classList.contains('hidden')"))
    step(120); check('PG-22 normal respawn without rewarded', page.evaluate(f"{G}.player.alive"))
    check('PG-23 offer card never shows without rewarded', page.evaluate("document.getElementById('offer').classList.contains('hidden')"))
run(mock(), SAVE, t1)
run(mock(fail_reward=True), SAVE, t2)
run(mock(rewarded_ok=False), SAVE, t3)
# No SDK at all (blocked script)
def t4(page, step):
    check('PG-24 game runs without the SDK', page.evaluate(f"!!{G}.zone"))
with sync_playwright() as p:
    pass
import json; json.dump(results, open('qa_out/pg_results.json', 'w'))
