# Shared helpers for the ISEKAI QA runs (Playwright + SwiftShader, phone-sized landscape viewport).
import json, time, os
import os as _os, re as _re
V = _re.search(r'main\.js\?v=(\d+)', open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '../../index.html')).read()).group(1)
from playwright.sync_api import sync_playwright

BASE = os.environ.get('QA_BASE', 'http://localhost:8766')
G = 'window.__game'
OUT = 'qa_out'
os.makedirs(OUT, exist_ok=True)
RESULTS = []

def check(cid, ok, note=''):
    RESULTS.append({'id': cid, 'ok': bool(ok), 'note': str(note)[:240]})
    print(('PASS ' if ok else 'FAIL ') + cid + (' - ' + str(note)[:200] if note else ''), flush=True)

def save_results(name):
    json.dump(RESULTS, open(f'{OUT}/{name}.json', 'w'), indent=1)

MOCK = r"""
window.__adlog = [];
(() => {
  const L = {}; const on = (n, f) => (L[n] ||= []).push(f); const emit = (n, v) => (L[n] || []).forEach(f => f(v)); window.__emit = emit;
  window.bridge = {
    EVENT_NAME: { INTERSTITIAL_STATE_CHANGED: 'i', REWARDED_STATE_CHANGED: 'r', PAUSE_STATE_CHANGED: 'p', AUDIO_STATE_CHANGED: 'a' },
    initialize: () => Promise.resolve(),
    platform: { id: 'testmock', sendMessage: m => __adlog.push('msg:' + m), on },
    advertisement: { isInterstitialSupported: true, isRewardedSupported: true, interstitialState: 'closed', on,
      setMinimumDelayBetweenInterstitial() {},
      showInterstitial: p => { __adlog.push('inter:' + p); emit('i', 'opened'); setTimeout(() => emit('i', 'closed'), 200); },
      showRewarded: p => { __adlog.push('rew:' + p); emit('r', 'opened'); setTimeout(() => { emit('r', 'rewarded'); emit('r', 'closed'); }, 200); } },
  };
})();"""

class Game:
    def __init__(self, pw, save=None, fast=True, mobile=True, ads=False, autostart=True, w=844, h=390):
        self.b = pw.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        self.ctx = self.b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
        self.ctx.route('**/playgama-bridge.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK if ads else 'window.bridge = undefined;'))
        self.p = self.ctx.new_page(); self.errs = []
        self.p.on('pageerror', lambda e: self.errs.append(str(e)))
        self.p.goto(BASE + '/index.html')
        self.p.evaluate("localStorage.clear(); sessionStorage.clear();")
        if save is not None: self.p.evaluate("s => localStorage.setItem('isekai_save_v2', JSON.stringify(s))", save)
        if autostart: self.p.evaluate("sessionStorage.setItem('isekai_autostart','1')")
        self.p.goto(BASE + '/index.html' + ('?fast' if fast else ''))
        self.p.wait_for_function('window.__game && window.__game.zone', timeout=120000)
        time.sleep(1.0)
        self.p.evaluate(f"{G}.input.update = () => {{}}")
    def ev(self, js, arg=None):
        return self.p.evaluate(js, arg) if arg is not None else self.p.evaluate(js)
    def step(self, n=30, dt=1/30, talk=True):
        self.ev(f"(()=>{{const g={G}; for(let i=0;i<{n};i++){{ if({str(talk).lower()} && g.dialogue.active) g.dialogue.advanceReq = true; window.__step({dt}); }} }})()")
    def shot(self, name):
        time.sleep(0.25); self.p.screenshot(path=f'{OUT}/{name}.png')
    def vis(self, sel):
        return self.ev("s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !e.closest('.hidden') && getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }", sel)
    def click(self, sel):
        self.ev("s => document.querySelector(s).click()", sel)
    def stage(self):
        return self.ev(f"{G}.story.id")
    def heal(self):
        self.ev(f"(()=>{{const p={G}.player; p.hp = p.maxHp; p.stamina = 100;}})()")
    def close(self):
        self.b.close()

# Generic story bot: follows the objective, talks, patches, kills what the stage needs, fights the boss.
BOT_JS = r"""
(opts) => {
  const g = window.__game, p = g.player, z = g.zone, st = g.story;
  const V = p.pos.constructor;
  if (g.dialogue.active) { g.dialogue.advanceReq = true; return 'talk'; }
  for (const id of ['forge', 'shop']) { const el = document.getElementById(id); if (el && !el.classList.contains('hidden')) { el.querySelector('button:last-child')?.click(); } }
  if (document.getElementById('ending') ) return 'ending';
  if (document.getElementById('zone-done') && !document.getElementById('zone-done').classList.contains('hidden')) document.getElementById('zone-continue').click();
  p.hp = p.maxHp; p.stamina = 100;
  if (st.busy) return 'busy';
  const boss = g.boss;
  if (boss && boss.alive) {
    // Stay near the boss; patch when possible; hit when hittable.
    if (p.pos.distanceTo(boss.pos) > 4) { const d = boss.pos.clone().sub(p.pos).setY(0).normalize(); p.spawnAt(boss.pos.clone().addScaledVector(d, -3), Math.atan2(d.x, d.z)); }
    if ((boss.glitchedActive || boss.patchable) && p.patchCd <= 0 && p.state === 'move') { p.patchCd = 0; g.input.pressed.add('patch'); return 'boss-patch'; }
    if (boss.mirroring && boss.slots) { const real = (boss.clones || []).length ? null : null; }
    const dmg = boss.takeHit(Math.ceil(boss.maxHp * 0.06), p.pos, { heavy: true });
    if (boss.clones) for (const c of boss.clones) if (c.alive && !c.dead && boss.mirroring) { c.takeHit?.(1, p.pos); }
    return 'boss ' + dmg;
  }
  // Kill minions/targets the stage needs.
  const need = opts.kill;
  if (need) {
    const list = g.enemies.filter(e => e.alive && !e.isBoss && !e.isClone);
    let best = null, bd = 1e9; for (const e of list) { const d = e.pos.distanceTo(p.pos); if (d < bd) { bd = d; best = e; } }
    const oo = z.map.objective?.(), atObj = oo && oo.distanceTo(p.pos.clone().setY(oo.y)) < 3;
    if (best && (bd < (opts.killRange || 6) || (atObj && bd < 30))) {
      if (best.glitchedActive && best.patch) best.patch(0);
      const was = best.alive; best.takeHit(1e6, p.pos, { pierce: true });
      if (was && !best.alive) { p.gainXp(best.xp ?? 20); g.ctx.onKill(best); }
      return 'kill';
    }
  }
  // Patch targets in range (story objects, NPCs).
  const t = p.patchTarget();
  if (t && !t.takeHit && p.state === 'move') { p.patchCd = 0; g.input.pressed.add('patch'); return 'patch'; }
  // Interact (talk / doors / chests), but never gates, shops, rifts or spawn pads unless asked.
  const allow = opts.allow || /^(Talk|Open chest|Enter the throne|Answer NOVA)/;
  const obj = z.map.objective?.();
  for (const it of z.interactables()) {
    if (!new RegExp(allow).test(it.label)) continue;
    if (obj && it.pos.distanceTo(obj) > 3.5 && !/^Enter|^Answer/.test(it.label)) continue; // only what the quest points at
    if (it.pos.distanceTo(p.pos) < (it.range || 2.8) + 0.5) { it.act(); return 'act ' + it.label; }
  }
  // Go to the objective.
  const o = z.map.objective?.();
  if (o) {
    const d = o.clone().sub(p.pos).setY(0), L = d.length();
    if (L > 2.2) { const k = Math.min(L - 1.6, opts.hop || 12); const q = p.pos.clone().addScaledVector(d.normalize(), k); p.spawnAt(q, Math.atan2(d.x, d.z)); }
    return 'move ' + L.toFixed(1);
  }
  return 'idle';
}
"""

def bot(gm, until, max_iter=900, kill=True, allow=None, hop=12, kill_range=6, every=6, log=False):
    last = None; hist = []
    for i in range(max_iter):
        s = gm.stage()
        if s in until: return s, hist
        r = gm.ev(BOT_JS, {'kill': kill, 'allow': allow, 'hop': hop, 'killRange': kill_range})
        hist.append((s, r))
        if log and r != last: print('  bot', s, r)
        last = r
        if r == 'ending': return 'ending', hist
        gm.step(every)
    return gm.stage(), hist
