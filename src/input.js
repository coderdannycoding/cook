// Keyboard, mouse, touch (pointer events) and gamepad input with per-frame "pressed" edges.
// Touch players drive the chef through a virtual joystick + buttons (see touch.js), which
// write into `virtual`; taps, drags and pinches on the canvas drive build mode and the camera.

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
const TAP_SLOP = 10; // px a finger may wander and still count as a tap
const TAP_TIME = 700; // ms

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: [false, false, false], clicked: [false, false, false] };
    // Where the build-mode ghost should be: follows a hovering mouse, or jumps to the last tap.
    this.hover = { x: this.mouse.x, y: this.mouse.y };
    this.wheel = 0;
    this.tap = null;
    this.dragX = 0;
    this.dragY = 0;
    this.pinch = 1;
    this.pointers = new Map();
    this.pinchDist = 0;
    this.virtual = { x: 0, y: 0, pick: false, work: false, workHeld: false, dash: false };
    this.pad = { a: false, b: false, x: false, start: false };
    this.padPrev = { a: false, b: false, x: false, start: false };
    this.padAxes = { x: 0, y: 0 };
    this.touchMode = false;
    this.onTouchMode = null;
    try {
      this.touchMode = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
    } catch {
      this.touchMode = false;
    }

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (PREVENT.has(e.code)) e.preventDefault();
      if (this.touchMode && !e.repeat) this.setTouchMode(false);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.releaseAll());

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e, false));
    window.addEventListener('pointercancel', (e) => this.onUp(e, true));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  setTouchMode(on) {
    if (this.touchMode === on) return;
    this.touchMode = on;
    if (this.onTouchMode) this.onTouchMode(on);
  }

  releaseAll() {
    this.down.clear();
    this.mouse.down = [false, false, false];
    this.pointers.clear();
    this.virtual.x = this.virtual.y = 0;
    this.virtual.workHeld = false;
  }

  onDown(e) {
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (touch) this.setTouchMode(true);
    else if (e.pointerType === 'mouse' && this.touchMode) this.setTouchMode(false);
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    // Event timestamps reflect when the finger actually moved, not when a busy main thread got to it
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: e.timeStamp, drag: false, button: e.button, touch });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      for (const p of this.pointers.values()) p.drag = true; // a pinch is never a tap
    }
    if (!touch && e.button <= 2) {
      this.mouse.down[e.button] = true;
      this.mouse.clicked[e.button] = true;
    }
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (e.pointerType === 'mouse' || !p) {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (e.pointerType === 'mouse' && !(p && p.drag)) {
        this.hover.x = e.clientX;
        this.hover.y = e.clientY;
      }
    }
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0 && d > 0) this.pinch *= this.pinchDist / d;
      this.pinchDist = d;
      return;
    }
    if (!p.drag && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > TAP_SLOP) p.drag = true;
    if (p.drag && (p.touch || p.button === 0)) {
      this.dragX += dx;
      this.dragY += dy;
    }
  }

  onUp(e, cancelled) {
    const p = this.pointers.get(e.pointerId);
    if (e.pointerType === 'mouse' && e.button <= 2) this.mouse.down[e.button] = false;
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (cancelled || p.drag || e.timeStamp - p.t > TAP_TIME) return;
    this.tap = { x: e.clientX, y: e.clientY, button: p.touch ? 0 : p.button, touch: p.touch };
    if (p.touch) {
      this.hover.x = e.clientX;
      this.hover.y = e.clientY;
    }
  }

  get dragging() {
    for (const p of this.pointers.values()) if (p.drag) return true;
    return false;
  }

  isDown(...codes) { return codes.some((c) => this.down.has(c)); }
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }

  pollGamepad() {
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch { pads = []; }
    const gp = pads && [...pads].find((p) => p && p.connected);
    this.padPrev = { ...this.pad };
    if (!gp) {
      this.pad = { a: false, b: false, x: false, start: false };
      this.padAxes = { x: 0, y: 0 };
      return;
    }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    this.padAxes = { x: dz(gp.axes[0] || 0), y: dz(gp.axes[1] || 0) };
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    this.pad = { a: b(0), b: b(1) || b(5) || b(7), x: b(2), start: b(9) };
  }

  padPressed(k) { return this.pad[k] && !this.padPrev[k]; }

  moveVector() {
    let x = 0, y = 0;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.isDown('KeyW', 'ArrowUp')) y += 1;
    if (this.isDown('KeyS', 'ArrowDown')) y -= 1;
    x += this.padAxes.x + this.virtual.x;
    y += -this.padAxes.y + this.virtual.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  // Left mouse clicks act as "E" during the day; touches never do (the Grab button does).
  get dashPressed() { return this.wasPressed('ShiftLeft', 'ShiftRight', 'Space') || this.padPressed('b') || this.virtual.dash; }
  get pickPressed() { return this.wasPressed('KeyE') || this.mouse.clicked[0] || this.padPressed('a') || this.virtual.pick; }
  get workPressed() { return this.wasPressed('KeyF') || this.mouse.clicked[2] || this.padPressed('x') || this.virtual.work; }
  get workHeld() { return this.isDown('KeyF') || this.mouse.down[2] || this.pad.x || this.virtual.workHeld; }
  get pausePressed() { return this.wasPressed('Escape', 'KeyP') || this.padPressed('start'); }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = [false, false, false];
    this.wheel = 0;
    this.tap = null;
    this.dragX = 0;
    this.dragY = 0;
    this.pinch = 1;
    this.virtual.pick = false;
    this.virtual.work = false;
    this.virtual.dash = false;
  }
}
