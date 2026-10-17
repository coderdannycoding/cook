// Keyboard, mouse and gamepad input with per-frame "pressed" edges.

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: [false, false, false], clicked: [false, false, false] };
    this.wheel = 0;
    this.pad = { a: false, b: false, x: false, start: false };
    this.padPrev = { a: false, b: false, x: false, start: false };
    this.padAxes = { x: 0, y: 0 };

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (PREVENT.has(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.down = [false, false, false];
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button > 2) return;
      this.mouse.down[e.button] = true;
      this.mouse.clicked[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button <= 2) this.mouse.down[e.button] = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  isDown(...codes) { return codes.some((c) => this.down.has(c)); }
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
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
    x += this.padAxes.x;
    y -= this.padAxes.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  get dashPressed() { return this.wasPressed('ShiftLeft', 'ShiftRight', 'Space') || this.padPressed('b'); }
  get pickPressed() { return this.wasPressed('KeyE') || this.mouse.clicked[0] || this.padPressed('a'); }
  get workPressed() { return this.wasPressed('KeyF') || this.mouse.clicked[2] || this.padPressed('x'); }
  get workHeld() { return this.isDown('KeyF') || this.mouse.down[2] || this.pad.x; }
  get pausePressed() { return this.wasPressed('Escape', 'KeyP') || this.padPressed('start'); }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = [false, false, false];
    this.wheel = 0;
  }
}
