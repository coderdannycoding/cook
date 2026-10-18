// On-screen controls for phones & tablets: a floating joystick on the left half of the screen
// and Grab / Use / Dash buttons on the right. Buttons show the action they'll perform right now.

import { icon } from './icons.js';

const STICK_RADIUS = 54;

function el(tag, cls, html = '') {
  const n = document.createElement(tag);
  n.className = cls;
  n.innerHTML = html;
  return n;
}

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.root = document.getElementById('touch-ui');
    this.visible = false;
    this.stickId = null;
    this.origin = { x: 0, y: 0 };
    this.labels = { pick: '', work: '' };

    this.zone = el('div', 'stick-zone');
    this.base = el('div', 'stick-base', '<div class="stick-knob"></div>');
    this.knob = this.base.firstChild;
    this.zone.appendChild(this.base);
    this.buttons = el('div', 'tbtns');
    this.btn = {
      dash: el('button', 'tbtn dash', `<i>${icon('wind')}</i><span>Dash</span><b class="cd"></b>`),
      work: el('button', 'tbtn work', `<i>${icon('knife')}</i><span>Use</span>`),
      pick: el('button', 'tbtn pick', `<i>${icon('hand')}</i><span>Grab</span>`),
    };
    for (const [k, b] of Object.entries(this.btn)) {
      b.type = 'button';
      b.dataset.k = k;
      b.setAttribute('aria-label', k);
      this.buttons.appendChild(b);
    }
    this.root.append(this.zone, this.buttons);

    this.zone.addEventListener('pointerdown', (e) => this.stickDown(e));
    this.zone.addEventListener('pointermove', (e) => this.stickMove(e));
    this.zone.addEventListener('pointerup', (e) => this.stickUp(e));
    this.zone.addEventListener('pointercancel', (e) => this.stickUp(e));
    for (const b of Object.values(this.btn)) {
      b.addEventListener('pointerdown', (e) => this.press(e, b.dataset.k));
      b.addEventListener('pointerup', (e) => this.release(e, b.dataset.k));
      b.addEventListener('pointercancel', (e) => this.release(e, b.dataset.k));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  stickDown(e) {
    if (this.stickId !== null) return;
    e.preventDefault();
    this.stickId = e.pointerId;
    try { this.zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const r = this.zone.getBoundingClientRect();
    this.origin = { x: e.clientX, y: e.clientY };
    this.base.style.left = `${e.clientX - r.left}px`;
    this.base.style.top = `${e.clientY - r.top}px`;
    this.base.classList.add('on');
    this.stickMove(e);
  }

  stickMove(e) {
    if (e.pointerId !== this.stickId) return;
    let dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_RADIUS) { dx *= STICK_RADIUS / d; dy *= STICK_RADIUS / d; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // small dead zone, full speed near the rim
    const m = Math.min(1, d / STICK_RADIUS);
    const k = m < 0.15 ? 0 : (m - 0.15) / 0.85 / Math.max(m, 1e-6);
    this.input.virtual.x = (dx / STICK_RADIUS) * k;
    this.input.virtual.y = -(dy / STICK_RADIUS) * k;
  }

  stickUp(e) {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.input.virtual.x = this.input.virtual.y = 0;
    this.knob.style.transform = '';
    this.base.classList.remove('on');
  }

  press(e, k) {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.currentTarget.classList.add('down');
    const v = this.input.virtual;
    if (k === 'pick') v.pick = true;
    if (k === 'dash') v.dash = true;
    if (k === 'work') { v.work = true; v.workHeld = true; }
    this.game.audio.init();
  }

  release(e, k) {
    e.currentTarget.classList.remove('down');
    if (k === 'work') this.input.virtual.workHeld = false;
  }

  setVisible(v) {
    if (v === this.visible) return;
    this.visible = v;
    this.root.classList.toggle('hidden', !v);
    document.body.classList.toggle('touch-play', v);
    if (!v) {
      this.input.virtual.x = this.input.virtual.y = 0;
      this.input.virtual.workHeld = false;
      this.stickId = null;
      this.base.classList.remove('on');
      this.knob.style.transform = '';
    }
  }

  setLabel(k, text, ic) {
    const key = `${text}|${ic}`;
    if (this.labels[k] === key) return;
    this.labels[k] = key;
    const b = this.btn[k];
    b.querySelector('i').innerHTML = icon(ic);
    b.querySelector('span').textContent = text;
  }

  update() {
    const g = this.game;
    const show = this.input.touchMode && (g.phase === 'day' || g.phase === 'countdown') && !g.paused && !g.ui.modalOpen;
    this.setVisible(show);
    if (!show || !g.player) return;
    const pl = g.player;
    const d = g.interact.describe(pl, pl.target);
    const short = (s, fallback) => {
      if (!s) return fallback;
      // Buttons are small: drop any price in brackets but keep the verb, so "Grab" still reads as an action
      const t = s.replace(/\s*\(.*\)$/, '');
      return t.length > 15 ? `${t.slice(0, 14)}…` : t;
    };
    const holdingTool = pl.held && pl.held.kind === 'tool';
    this.setLabel('pick', short(d.e, pl.held ? 'Drop' : 'Grab'), pl.held ? 'drop' : 'hand');
    this.setLabel('work', short(d.f, holdingTool ? 'Spray' : 'Use'), holdingTool ? 'extinguisher' : d.f && /Wash/.test(d.f) ? 'sponge' : d.f && /cash/i.test(d.f) ? 'coin' : 'knife');
    this.btn.pick.classList.toggle('idle', !d.e);
    this.btn.work.classList.toggle('idle', !d.f);
    const cd = Math.max(0, pl.dashCD);
    this.btn.dash.classList.toggle('cooling', cd > 0);
    this.btn.dash.style.setProperty('--cd', String(Math.min(1, cd / g.upg('dash'))));
  }
}
