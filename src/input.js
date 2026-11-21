// Keyboard, mouse and touch input, merged into one state object.
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };       // -1..1, y = forward
    this.look = { dx: 0, dy: 0 };     // accumulated camera delta this frame
    this.pressed = new Set();         // one-shot actions this frame
    this.held = new Set();
    this.pointerLocked = false;

    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const map = { Space: 'dash', KeyE: 'patch', KeyF: 'talk', Enter: 'talk', KeyJ: 'attack', KeyK: 'heavy', KeyR: 'skill', KeyX: 'sheathe' };
      if (map[e.code]) this.pressed.add(map[e.code]);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', e => {
      if (isTouch) return;
      if (!this.pointerLocked) { canvas.requestPointerLock?.(); return; }
      if (e.button === 0) this.pressed.add('attack');
      if (e.button === 2) this.pressed.add('heavy');
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', e => {
      if (!this.pointerLocked) return;
      this.look.dx += e.movementX * 0.0025;
      this.look.dy += e.movementY * 0.0025;
    });

    if (isTouch) this.#setupTouch();
  }

  #setupTouch() {
    document.getElementById('touch').classList.remove('hidden');
    const zone = document.getElementById('stick-zone');
    const base = document.getElementById('stick-base');
    const knob = document.getElementById('stick-knob');
    let stickId = null, cx = 0, cy = 0;
    const R = 52;
    zone.addEventListener('touchstart', e => {
      const t = e.changedTouches[0]; stickId = t.identifier;
      // Floating stick: move the base under the thumb (kept fully on screen).
      const zr = zone.getBoundingClientRect(), half = base.offsetWidth / 2;
      cx = Math.min(Math.max(t.clientX, zr.left + half + 6), zr.right - half);
      cy = Math.min(Math.max(t.clientY, zr.top + half), zr.bottom - half - 6);
      base.style.left = (cx - zr.left - half) + 'px'; base.style.bottom = (zr.bottom - cy - half) + 'px';
      base.classList.add('active');
      this.#moveStick(t, cx, cy, R, knob); e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) if (t.identifier === stickId) this.#moveStick(t, cx, cy, R, knob);
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) if (t.identifier === stickId) {
        stickId = null; this.move.x = 0; this.move.y = 0; knob.style.transform = '';
        base.classList.remove('active'); base.style.left = ''; base.style.bottom = ''; // back to its resting spot
      }
    };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);

    // Camera drag anywhere that is not the stick or a button.
    const lookTouches = new Map();
    this.canvas.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) lookTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      e.preventDefault();
    }, { passive: false });
    this.canvas.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        const p = lookTouches.get(t.identifier); if (!p) continue;
        this.look.dx += (t.clientX - p.x) * 0.006; this.look.dy += (t.clientY - p.y) * 0.006;
        p.x = t.clientX; p.y = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const lend = e => { for (const t of e.changedTouches) lookTouches.delete(t.identifier); };
    this.canvas.addEventListener('touchend', lend); this.canvas.addEventListener('touchcancel', lend);

    const bind = (id, action, hold) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', e => { this.pressed.add(action); if (hold) this.held.add(action); e.preventDefault(); e.stopPropagation(); }, { passive: false });
      el.addEventListener('touchend', e => { this.held.delete(action); e.preventDefault(); }, { passive: false });
    };
    bind('btn-attack', 'attack'); bind('btn-heavy', 'heavy'); bind('btn-dash', 'dash');
    bind('btn-patch', 'patch'); bind('btn-jump', 'jump');
    bind('btn-block', 'block', true); bind('btn-skill', 'skill'); bind('btn-talk', 'talk');
  }

  #moveStick(t, cx, cy, R, knob) {
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.move.x = dx / R; this.move.y = -dy / R;
  }

  // Called once per frame by the game.
  update() {
    if (!isTouch) {
      const k = this.keys;
      this.move.x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      this.move.y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    }
  }

  get sprint() {
    if (isTouch) return Math.hypot(this.move.x, this.move.y) > 0.88;
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  get blocking() { return this.keys.has('KeyQ') || this.held.has('block') || this.rightHeld; }

  consume(action) { const had = this.pressed.has(action); this.pressed.delete(action); return had; }

  endFrame() { this.pressed.clear(); this.look.dx = 0; this.look.dy = 0; }
}
