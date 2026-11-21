// Playgama Bridge: platform lifecycle, pause/audio events, interstitial ads at natural breaks,
// and rewarded ads behind an "offer card". Works without the SDK too (no ads, no offers).
//
// WHERE THE ADS ARE
//  Rewarded (the player chooses to watch):
//   1. REVIVE: when you die outside a boss fight, "Revive here" brings you back on the spot with full HP.
//   2. OFFER CARD: about every 4 minutes of play, a small card on the left offers ONE boost:
//      2x XP for 3 minutes, a pile of gold, glitch shards, or a full heal (only when hurt).
//      It hides by itself after 15 s and never shows in boss fights, dialogue or menus.
//  Interstitial (between scenes, the platform decides the minimum gap, at least 90 s here):
//   3. Travelling between zones (gates, the world map, rifts).
//   4. Respawning at a crystal after a death.
//  Never at game start, never during a fight.
import { sfx, setMuted } from './audio.js?v=31';

const $ = id => document.getElementById(id);
const B = () => window.bridge;

export class Ads {
  constructor() {
    this.ready = false; this.paused = false; this.platformPaused = false;
    this.offerT = 150; this.offerOn = false; this.xpBoostUntil = 0; this.busy = false;
    this.onPause = () => {};
  }

  // Called once at boot, before anything heavy.
  async init() {
    const b = B(); if (!b) return;
    try {
      await b.initialize();
      this.ready = true;
      try { b.advertisement.setMinimumDelayBetweenInterstitial(90); } catch (e) { /* ignore */ }
      b.advertisement.on(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, s => this.#adState(s));
      b.advertisement.on(b.EVENT_NAME.REWARDED_STATE_CHANGED, s => this.#rewardState(s));
      b.platform.on(b.EVENT_NAME.PAUSE_STATE_CHANGED, p => { this.platformPaused = !!p; this.#apply(); });
      b.platform.on(b.EVENT_NAME.AUDIO_STATE_CHANGED, on => { this.platformMuted = !on; this.#apply(); });
      if (b.advertisement.interstitialState === 'opened') this.#adState('opened');
    } catch (e) { console.warn('Playgama Bridge not available', e); }
  }
  get platform() { try { return B()?.platform?.id || 'none'; } catch (e) { return 'none'; } }
  get rewardedOk() { return this.ready && !!B()?.advertisement?.isRewardedSupported; }
  message(m) { try { if (this.ready) B().platform.sendMessage(m); } catch (e) { /* ignore */ } }

  #apply() {
    const pause = this.adOpen || this.platformPaused;
    if (pause !== this.paused) { this.paused = pause; this.onPause(pause); }
    setMuted(!!(this.adOpen || this.platformMuted || this.platformPaused));
  }
  #adState(s) {
    if (s === 'opened') { this.adOpen = true; this.#apply(); }
    if (s === 'closed' || s === 'failed') { this.adOpen = false; this.#apply(); this.afterInterstitial?.(); this.afterInterstitial = null; }
  }
  #rewardState(s) {
    if (s === 'opened') { this.adOpen = true; this.#apply(); }
    if (s === 'rewarded') this.gotReward = true;
    if (s === 'closed' || s === 'failed') {
      this.adOpen = false; this.#apply();
      const cb = this.rewardCb; this.rewardCb = null; this.busy = false;
      cb?.(this.gotReward); this.gotReward = false;
    }
  }

  // Interstitial at a natural break. `then` always runs (ad shown, skipped or failed).
  interstitial(placement, then) {
    const b = B();
    if (!this.ready || !b.advertisement.isInterstitialSupported) return then?.();
    this.afterInterstitial = then;
    const before = b.advertisement.interstitialState;
    try { b.advertisement.showInterstitial(placement); } catch (e) { this.afterInterstitial = null; return then?.(); }
    // If the platform skips it (too soon since the last one), carry on.
    setTimeout(() => { if (this.afterInterstitial === then && !this.adOpen) { this.afterInterstitial = null; then?.(); } }, before === 'opened' ? 30000 : 1500);
  }

  // Rewarded ad. cb(true) only when the platform confirms the reward.
  rewarded(placement, cb) {
    if (!this.rewardedOk || this.busy) return cb(false);
    this.busy = true; this.rewardCb = cb; this.gotReward = false;
    try { B().advertisement.showRewarded(placement); } catch (e) { this.busy = false; this.rewardCb = null; cb(false); }
  }

  // ---------------- Offer card ----------------
  // game: { player, profile, hud, canOffer(): bool }
  bind(game) { this.g = game; }
  #offers() {
    const { player, profile } = this.g, L = profile.d.level;
    const list = [
      { id: 'xp2', title: '2x XP', text: 'Double XP for 3 minutes', grant: () => { this.xpBoostUntil = performance.now() + 180000; this.g.hud.system('2x XP for 3 minutes!', 2.5); } },
      { id: 'gold', title: `+${150 + L * 25} GOLD`, text: 'Spend it at Bram\'s forge or Dot\'s shop', grant: () => { profile.d.gold += 150 + L * 25; this.g.hud.wallet(profile.d); } },
      { id: 'shards', title: `+${10 + L} SHARDS`, text: 'Glitch shards for sword upgrades', grant: () => { profile.d.shards += 10 + L; this.g.hud.wallet(profile.d); } },
    ];
    if (player.hp < player.maxHp * 0.6) list.push({ id: 'heal', title: 'FULL HEAL', text: 'HP and stamina back to full', grant: () => { player.hp = player.maxHp; player.stamina = 100; } });
    return list;
  }
  update(dt) {
    if (!this.g || !this.rewardedOk) return;
    if (this.xpBoostUntil) {
      const left = Math.max(0, (this.xpBoostUntil - performance.now()) / 1000);
      const el = $('xp-boost'); el.classList.toggle('hidden', left <= 0);
      if (left > 0) el.textContent = `2x XP ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; else this.xpBoostUntil = 0;
    }
    if (this.offerOn) { this.offerLeft -= dt; if (this.offerLeft <= 0 || !this.g.canOffer()) this.hideOffer(); return; }
    if (!this.g.canOffer()) return;
    this.offerT -= dt;
    if (this.offerT <= 0) { this.offerT = 240; this.showOffer(); }
  }
  showOffer(pick) {
    const list = this.#offers(), o = pick ? list.find(x => x.id === pick) || list[0] : list[Math.floor(Math.random() * list.length)];
    const el = $('offer');
    el.innerHTML = `<button class="ox" aria-label="Close">&#10005;</button><small>FREE BOOST</small><b>${o.title}</b><span>${o.text}</span><button class="ogo"><i>&#9654;</i> WATCH AD</button><em class="obar"></em>`;
    el.classList.remove('hidden'); this.offerOn = true; this.offerLeft = 15; sfx('open');
    el.style.setProperty('--t', '15s'); el.classList.remove('run'); void el.offsetWidth; el.classList.add('run');
    el.querySelector('.ox').onclick = e => { e.stopPropagation(); this.hideOffer(); };
    el.querySelector('.ogo').onclick = e => {
      e.stopPropagation(); this.hideOffer();
      this.rewarded('offer_' + o.id, ok => { if (ok) { o.grant(); sfx('levelUp'); this.g.hud.float?.(this.g.player.pos.clone().setY(this.g.player.pos.y + 2.4), o.title, 'xp'); } });
    };
  }
  hideOffer() { this.offerOn = false; $('offer')?.classList.add('hidden'); }
  get xpMul() { return this.xpBoostUntil > performance.now() ? 2 : 1; }

  // ---------------- Revive card (death screen) ----------------
  // Returns true if the card is shown (the caller waits for choose(revive)).
  deathOffer(onRevive, onRespawn) {
    if (!this.rewardedOk) return false;
    const el = $('revive');
    el.classList.remove('hidden');
    let done = false;
    const finish = revive => { if (done) return; done = true; el.classList.add('hidden'); clearTimeout(this.reviveTO); (revive ? onRevive : onRespawn)(); };
    $('rv-ad').onclick = () => { this.rewarded('revive', ok => finish(ok)); };
    $('rv-no').onclick = () => finish(false);
    this.reviveTO = setTimeout(() => { if (!this.busy) finish(false); }, 10000);
    return true;
  }
}
export const ads = new Ads();
