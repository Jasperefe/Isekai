// Audio: streamed music with crossfades, and sound effects synthesized with WebAudio
// (no sound files needed, so every effect is unique to ISEKAI).
// Usage: sfx('hit', pos?) · music('meadow') · setVolumes({ music, sfx }) · unlockAudio() on the first tap.

const TRACKS = { title: 'assets/audio/title.mp3', meadow: 'assets/audio/meadow.mp3', glitchwood: 'assets/audio/glitchwood.mp3', boss: 'assets/audio/boss.mp3', capital: 'assets/audio/capital.mp3' };
const KEY = 'isekai_audio';

let ctx = null, master, sfxBus, musicBus, noiseBuf = null, listener = null;
const vol = { music: 0.55, sfx: 0.8 };
try { Object.assign(vol, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const tracks = {};       // name -> { el, gain }
let currentTrack = null, wantTrack = null;
const MUTE = new URLSearchParams(location.search).has('fast'); // tests run silent

function init() {
  if (ctx || MUTE) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  // Gentle limiter so stacked hits never clip.
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6; comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(comp);
  musicBus = ctx.createGain(); musicBus.gain.value = vol.music; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

// Call from a tap/click (browsers only allow audio after a user gesture).
export function unlockAudio() {
  init(); if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume();
  if (wantTrack && wantTrack !== currentTrack) music(wantTrack);
}
// Pause everything while the tab is hidden (phones, ads later).
document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume(); });

export function setVolumes(v) {
  Object.assign(vol, v);
  try { localStorage.setItem(KEY, JSON.stringify(vol)); } catch (e) { /* ignore */ }
  if (sfxBus) sfxBus.gain.setTargetAtTime(vol.sfx, ctx.currentTime, 0.05);
  if (musicBus) musicBus.gain.setTargetAtTime(vol.music, ctx.currentTime, 0.05);
}
export const volumes = () => ({ ...vol });
export function setListener(pos) { listener = pos; }

// ---------------------------------------------------------------- Music
export function music(name, fade = 2) {
  wantTrack = name;
  if (!ctx || ctx.state !== 'running' || name === currentTrack) return;
  const now = ctx.currentTime;
  if (currentTrack && tracks[currentTrack]) {
    const old = tracks[currentTrack];
    old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now); old.gain.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => { if (currentTrack !== old.name) old.el.pause(); }, fade * 1000 + 100);
  }
  currentTrack = name;
  if (!name || !TRACKS[name]) return;
  let t = tracks[name];
  if (!t) {
    const el = new Audio(TRACKS[name]); el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
    const src = ctx.createMediaElementSource(el), gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(gain); gain.connect(musicBus);
    t = tracks[name] = { el, gain, name };
  }
  t.el.play().catch(() => {});
  t.gain.gain.cancelScheduledValues(now); t.gain.gain.setValueAtTime(t.gain.gain.value, now); t.gain.gain.linearRampToValueAtTime(1, now + fade);
}

// ---------------------------------------------------------------- SFX building blocks
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(out, t, { f = 440, to = null, type = 'sine', a = 0.005, d = 0.15, v = 0.3, det = 0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det;
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + a + d);
  env(g, t, a, v, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + 0.05);
}
function noise(out, t, { a = 0.005, d = 0.15, v = 0.3, type = 'bandpass', f = 1200, to = null, q = 1 }) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + a + d);
  env(g, t, a, v, d); s.connect(fl); fl.connect(g); g.connect(out);
  s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05);
}
const arp = (out, t, notes, step, o) => notes.forEach((f, i) => tone(out, t + i * step, { f, ...o }));
const glitch = (out, t, n = 6, v = 0.12) => { for (let i = 0; i < n; i++) tone(out, t + i * 0.035, { f: 200 + Math.random() * 1800, type: 'square', d: 0.03, v }); };

// Each recipe: (out, t, r) where r is a random 0..1 for small variations.
const R = {
  swing: (o, t, r) => noise(o, t, { f: 900 + r * 300, to: 3200, d: 0.13, v: 0.22, q: 2 }),
  swingHeavy: (o, t) => { noise(o, t, { f: 350, to: 1600, d: 0.24, v: 0.35, q: 1.5 }); tone(o, t, { f: 120, to: 70, d: 0.2, v: 0.12 }); },
  hit: (o, t, r) => { noise(o, t, { type: 'lowpass', f: 1400, d: 0.09, v: 0.45 }); tone(o, t, { f: 160 + r * 40, to: 55, d: 0.12, v: 0.5 }); },
  crit: (o, t) => { R.hit(o, t, 0.5); tone(o, t + 0.01, { f: 1600, to: 2200, type: 'triangle', d: 0.16, v: 0.18 }); },
  shatter: (o, t) => { noise(o, t, { type: 'highpass', f: 2500, d: 0.35, v: 0.35 }); arp(o, t, [2093, 2637, 3136], 0.04, { type: 'triangle', d: 0.25, v: 0.12 }); },
  block: (o, t) => { tone(o, t, { f: 820, type: 'square', d: 0.06, v: 0.12 }); noise(o, t, { f: 2600, d: 0.07, v: 0.25, q: 4 }); },
  parry: (o, t) => { tone(o, t, { f: 1320, type: 'triangle', d: 0.5, v: 0.25 }); tone(o, t, { f: 1980, type: 'sine', d: 0.6, v: 0.15 }); noise(o, t, { type: 'highpass', f: 3000, d: 0.12, v: 0.2 }); },
  dash: (o, t) => noise(o, t, { f: 900, to: 250, d: 0.2, v: 0.25, q: 1.2 }),
  jump: (o, t) => tone(o, t, { f: 240, to: 480, d: 0.1, v: 0.1, type: 'triangle' }),
  doubleJump: (o, t) => { tone(o, t, { f: 480, to: 960, d: 0.12, v: 0.12, type: 'triangle' }); glitch(o, t, 3, 0.05); },
  land: (o, t) => noise(o, t, { type: 'lowpass', f: 320, d: 0.09, v: 0.25 }),
  step: (o, t, r) => noise(o, t, { type: 'lowpass', f: 380 + r * 200, d: 0.045, v: 0.09 }),
  hurt: (o, t) => { tone(o, t, { f: 190, to: 85, type: 'sawtooth', d: 0.2, v: 0.2 }); noise(o, t, { type: 'lowpass', f: 700, d: 0.12, v: 0.3 }); },
  death: (o, t) => { tone(o, t, { f: 320, to: 50, type: 'sawtooth', d: 1.0, v: 0.25 }); glitch(o, t + 0.2, 10, 0.06); },
  patch: (o, t) => { arp(o, t, [660, 880, 1320, 1760], 0.045, { type: 'square', d: 0.05, v: 0.08 }); noise(o, t + 0.12, { type: 'highpass', f: 4000, d: 0.3, v: 0.15 }); tone(o, t + 0.18, { f: 1760, to: 2640, type: 'sine', d: 0.3, v: 0.15 }); },
  patchFail: (o, t) => { tone(o, t, { f: 220, type: 'square', d: 0.08, v: 0.08 }); tone(o, t + 0.11, { f: 180, type: 'square', d: 0.1, v: 0.08 }); },
  coin: (o, t, r) => { tone(o, t, { f: 1568 + r * 60, type: 'triangle', d: 0.06, v: 0.16 }); tone(o, t + 0.06, { f: 2093 + r * 80, type: 'triangle', d: 0.16, v: 0.16 }); },
  shard: (o, t) => { tone(o, t, { f: 2637, d: 0.25, v: 0.14 }); tone(o, t + 0.05, { f: 3520, d: 0.3, v: 0.1 }); },
  item: (o, t) => arp(o, t, [523, 659, 784, 1047], 0.07, { type: 'triangle', d: 0.25, v: 0.15 }),
  chest: (o, t) => { tone(o, t, { f: 110, to: 190, type: 'sawtooth', d: 0.35, v: 0.06 }); noise(o, t, { f: 600, d: 0.3, v: 0.08, q: 6 }); arp(o, t + 0.3, [1319, 1568, 2093, 2637], 0.05, { d: 0.3, v: 0.1 }); },
  levelUp: (o, t) => { arp(o, t, [523, 659, 784, 1047, 1319], 0.08, { type: 'triangle', d: 0.35, v: 0.17 }); noise(o, t + 0.35, { type: 'highpass', f: 5000, d: 0.6, v: 0.1 }); },
  save: (o, t) => { tone(o, t, { f: 880, d: 0.8, v: 0.15 }); tone(o, t + 0.12, { f: 1320, d: 0.9, v: 0.12 }); tone(o, t + 0.24, { f: 1760, d: 1.0, v: 0.08 }); },
  quest: (o, t) => { tone(o, t, { f: 784, type: 'triangle', d: 0.15, v: 0.14 }); tone(o, t + 0.12, { f: 1175, type: 'triangle', d: 0.3, v: 0.14 }); },
  ability: (o, t) => { arp(o, t, [392, 587, 784, 1175], 0.09, { type: 'triangle', d: 0.4, v: 0.16 }); tone(o, t + 0.36, { f: 1568, d: 0.8, v: 0.08 }); },
  click: (o, t) => tone(o, t, { f: 1100, d: 0.03, v: 0.08, type: 'triangle' }),
  open: (o, t) => tone(o, t, { f: 520, to: 880, d: 0.09, v: 0.08, type: 'triangle' }),
  close: (o, t) => tone(o, t, { f: 880, to: 520, d: 0.09, v: 0.07, type: 'triangle' }),
  error: (o, t) => { tone(o, t, { f: 300, type: 'square', d: 0.07, v: 0.06 }); tone(o, t + 0.09, { f: 250, type: 'square', d: 0.09, v: 0.06 }); },
  consoleOpen: (o, t) => { tone(o, t, { f: 1000, type: 'square', d: 0.03, v: 0.06 }); tone(o, t + 0.05, { f: 1500, type: 'square', d: 0.04, v: 0.06 }); tone(o, t, { f: 200, to: 90, d: 0.4, v: 0.1 }); },
  consoleRun: (o, t) => { tone(o, t, { f: 400, to: 1800, type: 'square', d: 0.16, v: 0.08 }); glitch(o, t + 0.12, 4, 0.05); },
  unlock: (o, t) => { arp(o, t, [880, 1175, 1760], 0.06, { type: 'square', d: 0.08, v: 0.07 }); tone(o, t + 0.2, { f: 2349, d: 0.5, v: 0.1 }); },
  type: (o, t, r) => tone(o, t, { f: 520 + r * 160, type: 'square', d: 0.018, v: 0.025 }),
  slime: (o, t, r) => tone(o, t, { f: 420 + r * 80, to: 140, d: 0.16, v: 0.2 }),
  slimeDie: (o, t) => { tone(o, t, { f: 700, to: 90, d: 0.35, v: 0.25 }); noise(o, t, { type: 'lowpass', f: 900, d: 0.2, v: 0.2 }); },
  growl: (o, t, r) => { tone(o, t, { f: 78 + r * 10, to: 64, type: 'sawtooth', d: 0.55, v: 0.14 }); noise(o, t, { type: 'lowpass', f: 380, d: 0.5, v: 0.15 }); },
  pounce: (o, t) => { noise(o, t, { f: 600, to: 2000, d: 0.18, v: 0.25 }); tone(o, t, { f: 140, to: 260, type: 'sawtooth', d: 0.12, v: 0.08 }); },
  tvCharge: (o, t) => { tone(o, t, { f: 180, to: 900, type: 'square', d: 0.65, v: 0.05 }); noise(o, t, { type: 'highpass', f: 3000, d: 0.65, v: 0.08 }); },
  tvZap: (o, t) => { tone(o, t, { f: 1300, to: 260, type: 'square', d: 0.18, v: 0.1 }); noise(o, t, { type: 'highpass', f: 2200, d: 0.2, v: 0.2 }); },
  teleport: (o, t) => { glitch(o, t, 7, 0.07); noise(o, t, { f: 3000, to: 400, d: 0.25, v: 0.12, q: 3 }); },
  enemyDie: (o, t) => { glitch(o, t, 6, 0.06); noise(o, t, { type: 'lowpass', f: 1200, to: 200, d: 0.35, v: 0.25 }); },
  bossSlam: (o, t) => { tone(o, t, { f: 70, to: 28, d: 0.7, v: 0.6 }); noise(o, t, { type: 'lowpass', f: 260, d: 0.6, v: 0.5 }); },
  bossRoar: (o, t) => { tone(o, t, { f: 110, to: 62, type: 'sawtooth', d: 1.0, v: 0.18 }); tone(o, t, { f: 113, to: 60, type: 'sawtooth', d: 1.0, v: 0.14 }); noise(o, t, { type: 'lowpass', f: 600, d: 0.9, v: 0.18 }); },
  spikes: (o, t) => { noise(o, t, { f: 700, d: 0.22, v: 0.35, q: 2 }); tone(o, t, { f: 90, to: 50, d: 0.25, v: 0.3 }); },
  warn: (o, t) => tone(o, t, { f: 330, to: 300, type: 'triangle', d: 0.2, v: 0.07 }),
  sweep: (o, t) => noise(o, t, { f: 250, to: 1400, d: 0.32, v: 0.32, q: 1 }),
  glitchBig: (o, t) => { glitch(o, t, 12, 0.08); tone(o, t, { f: 60, to: 40, type: 'sawtooth', d: 0.6, v: 0.12 }); },
  bossDie: (o, t) => { tone(o, t, { f: 200, to: 30, type: 'sawtooth', d: 2.0, v: 0.25 }); glitch(o, t + 0.3, 20, 0.06); noise(o, t, { type: 'lowpass', f: 500, to: 100, d: 1.8, v: 0.3 }); },
  zoneClear: (o, t) => { arp(o, t, [392, 523, 659, 784, 1047], 0.11, { type: 'triangle', d: 0.6, v: 0.15 }); tone(o, t + 0.55, { f: 1568, d: 1.4, v: 0.1 }); },
  gate: (o, t) => { tone(o, t, { f: 110, to: 440, d: 0.9, v: 0.15 }); noise(o, t, { f: 400, to: 3000, d: 0.9, v: 0.12, q: 2 }); },
};

const last = {};
// Play a sound. `at` (optional world position) makes far-away sounds quieter.
export function sfx(name, at = null, gain = 1) {
  if (!ctx || ctx.state !== 'running' || !R[name]) return;
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < 0.035) return; // avoid machine-gun stacking
  last[name] = now;
  let v = gain;
  if (at && listener) { const d = Math.hypot(at.x - listener.x, at.z - listener.z); if (d > 40) return; v *= Math.max(0.12, 1 - d / 40); }
  const out = ctx.createGain(); out.gain.value = v; out.connect(sfxBus);
  R[name](out, now + 0.005, Math.random());
  setTimeout(() => out.disconnect(), 3000);
}
