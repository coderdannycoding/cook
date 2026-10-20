// HTML/CSS interface: HUD, order tickets, world-anchored bubbles & progress bars, action prompts,
// toasts, the night-time Build/Staff/Upgrades/Menu dock, and all modal screens (title, results,
// pause, help). Styling lives in styles/*.css; icons come from icons.js.

import { DISHES, CUISINES, CUISINE_ORDER, ticketParts, itemLabel } from './recipes.js';
import {
  CATALOG, CATEGORIES, UPGRADES, STAFF_TYPES, STAFF_LEVELS, MAX_STAFF, FLOOR_THEMES, WALL_THEMES, catalogByCategory, perkText, PERKS,
} from './catalog.js';
import { formatMoney, formatClock, clamp } from './utils.js';
import { DAY } from './config.js';
import { icon, hasIcon, badge } from './icons.js';
import { openAvatarEditor } from './avatar.js';
import { playerLook, staffLook } from './models.js';
import { sadPets } from './home.js';

const $ = (sel, root = document) => root.querySelector(sel);
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// The data-a action of whatever was clicked inside a modal (the click may land on a label inside a button)
const actionOf = (ev) => ev.target.closest && ev.target.closest('[data-a]')?.dataset.a;

// Change-only DOM writes: per-frame UI must not thrash layout/paint when nothing changed.
function setText(node, text) {
  if (node._t !== text) { node._t = text; node.textContent = text; }
}
function setHTML(node, html) {
  if (node._h !== html) { node._h = html; node.innerHTML = html; }
}
function setStyle(node, prop, value) {
  const k = `_s_${prop}`;
  if (node[k] !== value) { node[k] = value; node.style[prop] = value; }
}
function setVar(node, name, value) {
  const k = `_v_${name}`;
  if (node[k] !== value) { node[k] = value; node.style.setProperty(name, value); }
}
function toggle(node, cls, on) {
  const k = `_c_${cls}`;
  if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); }
}

function starsHTML(rating) {
  const pct = clamp((rating / 5) * 100, 0, 100);
  return `<span class="stars"><span class="stars-bg">★★★★★</span><span class="stars-fg" style="width:${pct}%">★★★★★</span></span>`;
}

const ROLE_ICON = { chef: 'chefhat', waiter: 'bowtie', dish: 'sponge', plater: 'cloche', drive: 'car', busser: 'broom', host: 'bell', musician: 'music', mascot: 'megaphone', manager: 'clipboard' };
const ROLE_BLURB = {
  chef: 'Preps and cooks', waiter: 'Serves and clears', dish: 'Washes plates', plater: 'Plates every dish',
  drive: 'Runs the drive-thru', busser: 'Clears tables', host: 'Greets guests',
  musician: 'Plays for diners', mascot: 'Draws a crowd', manager: 'Speeds up the team',
};

export class UI {
  constructor(game) {
    this.game = game;
    this.thumbs = {};
    this.e = {
      hud: $('#hud'), tickets: $('#tickets'), world: $('#world-ui'), prompt: $('#prompt'), toasts: $('#toasts'),
      hint: $('#hint'), dock: $('#night-dock'), modal: $('#modal-root'), title: $('#title-screen'), countdown: $('#countdown'),
      vignette: $('#fire-vignette'), loading: $('#loading'), buildHelp: $('#build-help'),
      buildTools: $('#build-tools'), rotateHint: $('#rotate-hint'), fullscreen: $('#btn-fullscreen'),
    };
    for (const n of document.querySelectorAll('[data-icon]')) n.innerHTML = icon(n.dataset.icon);
    for (const n of document.querySelectorAll('[data-badge]')) n.innerHTML = badge(n.dataset.badge);
    this.rotateDismissed = false;
    this.rotateTimer = 0;
    this.ticketEls = new Map();
    this.worldEls = new Map();
    this.used = new Set();
    this.cashShown = 0;
    this.dockTab = 'build';
    this.buildCat = 'prep';
    this.dockCollapsed = false;
    this._dockFrac = { t: -1, v: 0 };
    this.modalStack = [];
    this.bind();
  }

  // setup
  bind() {
    const g = this.game;
    g.events.on('ticket:add', (t) => this.addTicket(t));
    g.events.on('ticket:done', (t) => this.endTicket(t, 'done'));
    g.events.on('ticket:fail', (t) => this.endTicket(t, 'fail'));
    g.events.on('ticket:clear', () => {
      for (const elx of this.ticketEls.values()) elx.remove();
      this.ticketEls.clear();
    });
    $('#btn-pause').addEventListener('click', () => { g.audio.click(); g.togglePause(); });
    $('#hud-goals').addEventListener('click', (ev) => {
      ev.stopPropagation();
      g.audio.click();
      this.goalsOpenT = this.goalsOpenT > 0 ? 0 : 6;
      this.renderGoalsPop();
    });
    $('#btn-mute').addEventListener('click', () => {
      g.audio.click();
      g.setMuted(!g.audio.muted);
    });
    // Fullscreen is optional: some browsers / embedded viewers refuse it.
    const fsEl = document.documentElement;
    if (document.fullscreenEnabled && fsEl.requestFullscreen) {
      this.e.fullscreen.classList.remove('hidden');
      this.e.fullscreen.addEventListener('click', () => {
        g.audio.click();
        const p = document.fullscreenElement ? document.exitFullscreen() : fsEl.requestFullscreen({ navigationUI: 'hide' });
        Promise.resolve(p).catch(() => this.toast('Fullscreen isn’t available in this browser', 'warn'));
      });
    }
    this.e.rotateHint.addEventListener('click', () => this.dismissRotateHint());
    this.e.dock.addEventListener('click', (ev) => this.onDockClick(ev));
    this.e.dock.addEventListener('change', (ev) => this.onDockChange(ev));
    // A soft blip when the mouse moves onto a new button, never a rattle when sweeping across a row
    let lastHover = null, lastBlip = 0;
    document.addEventListener('mouseover', (ev) => {
      const b = ev.target.closest && ev.target.closest('button, .card');
      if (!b || b === lastHover) return;
      lastHover = b;
      const now = performance.now();
      if (now - lastBlip < 120) return;
      lastBlip = now;
      g.audio.hover();
    });
  }

  setLoading(p, text) {
    const L = this.e.loading;
    const fill = L && $('.load-fill', L);
    if (!fill) return;
    fill.style.width = `${Math.round(p * 100)}%`;
    if (text) $('.load-text', L).textContent = text;
  }
  hideLoading() {
    this.e.loading.classList.add('fade');
    setTimeout(() => this.e.loading.remove(), 600);
  }

  thumb(key) { return this.thumbs[key] || ''; }

  // title
  showTitle() {
    const g = this.game;
    const save = g.peekSave();
    const T = this.e.title;
    T.classList.remove('hidden');
    const colors = ['#f2493d', '#2f8cf0', '#2fbf5f', '#ffbb1f', '#9b5cf6', '#ff6fae'];
    const cur = g.settings.color || colors[0];
    T.innerHTML = `
      <div class="title-card">
        <div class="logo">${badge('logo', 'logo-mark')}<h1 aria-label="Sizzle Shack"><span data-t="Sizzle">Sizzle</span><span data-t="Shack">Shack</span></h1></div>
        <p class="tagline">Chop, cook and serve against the clock, then grow your tiny shack into the busiest restaurant in town.</p>
        <div class="title-buttons">
          ${save ? `<button class="big-btn primary" data-act="continue">Continue <small>Day ${save.day} · ${formatMoney(save.cash)} · ${save.rating.toFixed(1)}★</small></button>` : ''}
          <button class="big-btn ${save ? 'gold' : 'primary'}" data-act="new">${save ? 'New game' : 'Play'}</button>
          <button class="big-btn" data-act="help">How to play</button>
        </div>
        <div class="apron">
          <span>Apron</span>
          ${colors.map((c) => `<button class="swatch ${c === cur ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="Apron colour ${c}" title="Apron colour"></button>`).join('')}
          <button class="style-btn" data-act="avatar">${icon('shirt')}Style</button>
        </div>
        <div class="title-keys">${this.game.input.touchMode
          ? `<span>${icon('joystick')} Left thumb moves</span><span>${icon('hand')} Grab</span><span>${icon('knife')} Use</span><span>${icon('wind')} Dash</span>`
          : '<span><kbd>WASD</kbd> move</span><span><kbd>Shift</kbd>/<kbd>Space</kbd> dash</span><span><kbd>E</kbd> pick up / put down</span><span><kbd>F</kbd> chop, wash, spray</span><span><kbd>Esc</kbd> pause</span>'}
        </div>
      </div>`;
    T.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      g.audio.init();
      g.audio.click();
      if (b.dataset.color) {
        g.settings.color = b.dataset.color;
        g.saveSettings();
        T.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === b));
        g.recolorPlayer(b.dataset.color);
        return;
      }
      const act = b.dataset.act;
      if (act === 'continue') { this.hideTitle(); g.continueGame(); }
      if (act === 'new') {
        if (save) {
          this.confirm('Start a new restaurant?', `This replaces your saved restaurant (day ${save.day}).`, 'Start over', () => { this.hideTitle(); g.newGame(); });
        } else { this.hideTitle(); g.newGame(); }
      }
      if (act === 'help') this.showHelp();
      if (act === 'avatar') this.editPlayerLook();
    };
  }

  // Today's goals, dropped down from the day box for a few seconds
  renderGoalsPop() {
    const g = this.game;
    const pop = $('#goals-pop');
    this.goalsPopT = 0.5;
    const open = this.goalsOpenT > 0 && g.goals.list.length;
    pop.classList.toggle('hidden', !open);
    if (!open) return;
    pop.innerHTML = `<div class="gp-title">Today's goals</div>${g.goals.list.map((x) => {
      const p = g.goals.progress(x);
      const val = x.end ? (x.state === 'done' ? 'Done' : x.state === 'failed' ? 'Missed' : 'Until closing') : `${Math.min(x.target, Math.floor(x.value(g.today)))}/${x.target}`;
      return `<div class="gp-row ${x.state}">${icon(x.state === 'done' ? 'check' : x.state === 'failed' ? 'x' : x.icon)}<div class="gp-txt"><span>${esc(x.text)}</span><div class="gp-bar"><i style="width:${Math.round(p * 100)}%"></i></div></div><b>${val}<small>+${formatMoney(x.reward)}</small></b></div>`;
    }).join('')}`;
  }

  editPlayerLook() {
    const g = this.game;
    openAvatarEditor(g, {
      title: 'Your chef',
      base: playerLook(g.settings.color || '#c8442b'),
      look: g.settings.avatar || {},
      onSave: (out) => {
        g.settings.avatar = out;
        g.saveSettings();
        g.recolorPlayer();
        if (g.phase !== 'title') this.toast('Looking sharp, chef', 'good', 'shirt');
        if (this.dockTab === 'staff') this.renderDock();
      },
    });
  }

  editStaffLook(id) {
    const g = this.game;
    const d = g.state.staff.find((x) => x.id === id);
    if (!d) return;
    openAvatarEditor(g, {
      title: STAFF_TYPES[d.role].name,
      base: staffLook(d.role, d.seed),
      look: d.look || {},
      name: d.name,
      onSave: (out, name) => {
        d.look = out;
        if (name) d.name = name;
        g.staff.restyle(d.id);
        g.save();
        this.renderDock();
      },
    });
  }

  hideTitle() {
    this.e.title.classList.add('hidden');
  }

  // HUD
  showHUD(v) { this.e.hud.classList.toggle('hidden', !v); }

  updateHUD(dt) {
    const g = this.game;
    const s = g.state;
    if (!s) return;
    if (!this.h) {
      this.h = {
        cash: $('#hud-cash'), day: $('#hud-day'), clock: $('#hud-clock'), fill: $('#hud-clock-fill'), sun: $('#hud-sun'),
        stars: $('#hud-stars'), next: $('#hud-next'), dash: $('#hud-dash'), mute: $('#btn-mute'),
      };
    }
    const h = this.h;
    this.cashShown += (s.cash - this.cashShown) * Math.min(1, dt * 8);
    if (Math.abs(s.cash - this.cashShown) < 0.5) this.cashShown = s.cash;
    setText(h.cash, formatMoney(this.cashShown).replace('$', ''));
    setText(h.day, `Day ${g.phase === 'summary' ? s.day - 1 : s.day}`);
    const night = g.phase === 'night' || g.phase === 'summary';
    setText(h.clock, night ? 'Closed' : formatClock(Math.min(g.clock, DAY.closeHour + 0.99)));
    const prog = clamp((g.clock - DAY.openHour) / (DAY.closeHour - DAY.openHour), 0, 1);
    setStyle(h.fill, 'width', `${night ? 100 : Math.round(prog * 200) / 2}%`);
    setHTML(h.sun, badge(night ? 'moon' : g.clock >= 17.5 ? 'sunset' : 'sun'));
    setHTML(h.stars, `${starsHTML(Math.round(s.rating * 100) / 100)}<b>${s.rating.toFixed(2)}</b>`);
    const next = CUISINE_ORDER.map((id) => CUISINES[id]).find((c) => c.stars > s.rating);
    setText(h.next, next ? `${next.name.replace(/^(American|Italian|Japanese|Seaside) /, '')} at ${next.stars.toFixed(1)}★` : 'Every cuisine unlocked');
    if (g.goals.ver !== this._goalsVer) {
      this._goalsVer = g.goals.ver;
      const list = g.goals.list;
      const pips = $('#hud-goals');
      pips.classList.toggle('hidden', !list.length);
      pips.innerHTML = list.map((x) => `<i class="${x.state}">${icon(x.state === 'done' ? 'check' : x.state === 'failed' ? 'x' : x.icon)}</i>`).join('');
      if (!list.length) this.goalsOpenT = 0;
      this.renderGoalsPop();
    }
    if (this.goalsOpenT > 0) {
      this.goalsOpenT -= dt;
      this.goalsPopT = (this.goalsPopT || 0) - dt;
      if (this.goalsPopT <= 0 || this.goalsOpenT <= 0) this.renderGoalsPop();
    }
    const dash = g.player ? clamp(1 - g.player.dashCD / g.upg('dash'), 0, 1) : 1;
    setVar(h.dash, '--p', String(Math.round(dash * 40) / 40));
    toggle(h.dash, 'ready', dash >= 1);
    toggle(this.e.vignette, 'on', g.fire.count > 0);
    setHTML(h.mute, icon(g.audio.muted ? 'mute' : 'sound'));
  }

  flashCash(good = true) {
    const c = $('#hud-cash-box');
    c.classList.remove('flash-good', 'flash-bad');
    void c.offsetWidth;
    c.classList.add(good ? 'flash-good' : 'flash-bad');
  }

  pulseStars() {
    const s = $('#hud-stars-box');
    s.classList.remove('pulse');
    void s.offsetWidth;
    s.classList.add('pulse');
  }

  // tickets
  addTicket(t) {
    const d = DISHES[t.dish];
    const parts = ticketParts(t.dish);
    // Slips never hang perfectly straight on the rail
    const tilt = (((t.id * 37) % 7) - 3) * 0.7;
    const node = el(`
      <div class="ticket ${t.critic ? 'critic' : ''} ${t.vip ? 'critic vip' : ''}" style="--tilt:${tilt}deg">
        ${t.critic ? `<div class="t-crown">${icon('crown')}Critic</div>` : t.vip ? `<div class="t-crown">${icon('star')}Celebrity</div>` : ''}
        <div class="t-bar"><div class="t-fill"></div></div>
        <div class="t-head"><span class="t-table">${t.table === 'DT' ? `${icon('car')}Drive` : `T${t.table}`}</span><span class="t-price">$${d.price}</span></div>
        <div class="t-dish"><img src="${this.thumb(`dish:${t.dish}`)}" alt=""></div>
        <div class="t-name">${esc(d.name)}</div>
        <div class="t-parts">${parts.map((p) => `<div class="t-part"><img src="${this.thumb(`item:${p.key}`)}" alt="">${p.badge ? `<span class="badge">${icon(p.badge)}</span>` : ''}</div>`).join('')}</div>
      </div>`);
    this.e.tickets.appendChild(node);
    this.ticketEls.set(t.id, node);
    requestAnimationFrame(() => node.classList.add('in'));
  }

  endTicket(t, how) {
    const node = this.ticketEls.get(t.id);
    if (!node) return;
    this.ticketEls.delete(t.id);
    node.classList.add(how);
    if (how === 'fail') this.game.audio.fail();
    setTimeout(() => node.remove(), how === 'done' ? 650 : 900);
  }

  updateTickets() {
    const n = this.ticketEls.size;
    // Measuring the bar forces a layout, so only do it when the count or the window size changes
    const key = `${n}|${window.innerWidth}|${window.innerHeight}`;
    if (this._tkKey !== key) {
      this._tkKey = key;
      this._tkRoom = this.e.tickets.clientWidth || window.innerWidth * 0.6;
    }
    const room = this._tkRoom;
    const per = n ? room / n : 999;
    toggle(this.e.tickets, 'compact', per < 122 && per >= 86);
    toggle(this.e.tickets, 'tiny', per < 86);
    for (const t of this.game.orders.tickets) {
      const node = this.ticketEls.get(t.id);
      if (!node) continue;
      const p = clamp(t.customer.patience, 0, 1);
      if (!node._fill) node._fill = node.querySelector('.t-fill');
      setStyle(node._fill, 'width', `${Math.round(p * 200) / 2}%`);
      toggle(node, 'warn', p <= 0.5 && p > 0.25);
      toggle(node, 'danger', p <= 0.25);
    }
  }

  // world overlays
  w(key, cls, html) {
    let node = this.worldEls.get(key);
    if (!node) {
      node = document.createElement('div');
      node.className = cls;
      if (html !== undefined) node.innerHTML = html;
      this.e.world.appendChild(node);
      this.worldEls.set(key, node);
    }
    this.used.add(key);
    return node;
  }

  place(node, x, y, z) {
    const p = this.game.renderer.project(x, y, z);
    setStyle(node, 'transform', `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`);
    setStyle(node, 'display', p.visible ? '' : 'none');
  }

  ring(node, p, color) {
    if (!node._ring) node._ring = node.querySelector('.ring-fg');
    setStyle(node._ring, 'strokeDashoffset', `${Math.round(119.4 * (1 - p))}`);
    setStyle(node._ring, 'stroke', color);
  }

  updateWorld() {
    const g = this.game;
    this.used.clear();
    const showWorld = g.phase === 'day' || g.phase === 'countdown';
    const RING = '<svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="ring-bg"/><circle cx="22" cy="22" r="19" class="ring-fg"/></svg>';
    if (showWorld || g.phase === 'title') {
      // Customers
      for (const c of g.customers.allCustomers()) {
        const y = c.sitting ? 1.95 : 1.75;
        if (c.state === 'waiting') {
          const key = `c${c.root.id}`;
          const node = this.w(key, `bubble ${c.critic ? 'critic' : ''} ${c.vip ? 'vip' : ''}`, `
            ${RING}<img src="${this.thumb(`dish:${c.order}`)}" alt="">${c.critic ? `<span class="crown">${icon('crown')}</span>` : c.vip ? `<span class="crown">${icon('star')}</span>` : ''}`);
          const p = clamp(c.patience, 0, 1);
          this.ring(node, p, p > 0.5 ? '#3f8f5a' : p > 0.25 ? '#e0a020' : '#d8452c');
          toggle(node, 'urgent', p <= 0.25);
          this.place(node, c.pos.x, y, c.pos.z);
        } else if (c.state === 'seated') {
          const node = this.w(`t${c.root.id}`, 'bubble think', icon('dots'));
          this.place(node, c.pos.x, y, c.pos.z);
        } else if (c.group.state === 'queue' && c === c.group.members[0]) {
          const node = this.w(`q${c.root.id}`, 'bubble queue', `${RING}${icon('timer')}`);
          const p = clamp(1 - c.group.queueT / g.customers.queueLimit(c.group), 0, 1);
          this.ring(node, p, p > 0.4 ? '#3f8f5a' : '#d8452c');
          this.place(node, c.pos.x, y, c.pos.z);
        }
      }
      // Drive-thru cars
      for (const c of g.drive.cars) {
        if (c.state !== 'waiting') continue;
        const node = this.w(`d${c.id}`, 'bubble drive', `${RING}<img src="${this.thumb(`dish:${c.order}`)}" alt=""><span class="crown">${icon('car')}</span>`);
        const p = clamp(c.patience, 0, 1);
        this.ring(node, p, p > 0.5 ? '#3f8f5a' : p > 0.25 ? '#e0a020' : '#d8452c');
        toggle(node, 'urgent', p <= 0.25);
        this.place(node, c.pos.x, 1.85, c.pos.z);
      }
      // Stations
      for (const st of g.grid.stations()) {
        if (st.fire > 0) {
          const node = this.w(`f${st.obj.uid}`, 'st-icon fire', icon('fire'));
          this.place(node, st.x, 1.9, st.z);
          continue;
        }
        const info = st.progressInfo();
        if (!info) continue;
        const node = this.w(`p${st.obj.uid}`, 'progress', '<div class="pfill"></div><span class="pwarn">!</span>');
        const fill = node.firstChild;
        setStyle(fill, 'width', `${Math.round(clamp(info.value, 0, 1) * 50) * 2}%`);
        setStyle(fill, 'background', info.color);
        toggle(node, 'warn', !!info.warn);
        this.place(node, st.x, st.topY + 0.75, st.z);
      }
      // Staff status
      for (const m of g.staff.members) {
        if (!m.status) continue;
        const node = this.w(`s${m.data.id}`, 'staff-tag', '');
        if (hasIcon(m.status)) setHTML(node, icon(m.status));
        else setText(node, m.status);
        this.place(node, m.pos.x, 1.75, m.pos.z);
      }
    }
    for (const [k, node] of this.worldEls) {
      if (!this.used.has(k)) {
        node.remove();
        this.worldEls.delete(k);
      }
    }
  }

  clearWorld() {
    for (const node of this.worldEls.values()) node.remove();
    this.worldEls.clear();
  }

  // prompt
  updatePrompt() {
    const g = this.game;
    const P = this.e.prompt;
    if (g.phase !== 'day' || !g.player) { toggle(P, 'hidden', true); return; }
    const pl = g.player;
    const d = g.interact.describe(pl, pl.target);
    const parts = [];
    const touch = g.input.touchMode;
    if (pl.held) parts.push(`<span class="holding">${icon('hand')}${esc(itemLabel(pl.held))}</span>`);
    // Touch players see the actions on the buttons themselves
    if (d.e && !touch) parts.push(`<span><kbd>E</kbd> ${esc(d.e)}</span>`);
    if (d.f && !touch) parts.push(`<span><kbd>F</kbd> ${esc(d.f)}</span>`);
    if (d.warn) parts.push(`<span class="pwarn-text">${icon('warn')}${esc(d.warn)}</span>`);
    const html = parts.join('');
    if (P.dataset.h !== html) {
      P.dataset.h = html;
      P.innerHTML = html;
    }
    toggle(P, 'hidden', !html);
  }

  // toasts
  // Short messages down the right edge. A repeat of a message already on screen just stays up
  // longer instead of stacking a copy, and at most three show at once.
  toast(text, type = 'info', ic = '') {
    const T = this.e.toasts;
    const life = type === 'danger' || type === 'gold' ? 4000 : 2800;
    for (const n of T.children) {
      if (n._text === text && !n.classList.contains('out')) {
        clearTimeout(n._timer);
        n._timer = setTimeout(() => this.dropToast(n), life);
        return;
      }
    }
    const node = el(`<div class="toast ${type}" role="status">${ic ? icon(ic) : ''}<span>${esc(text)}</span></div>`);
    node._text = text;
    T.appendChild(node);
    const live = [...T.children].filter((n) => !n.classList.contains('out'));
    const max = window.innerHeight < 560 ? 2 : 3;
    for (const n of live.slice(0, Math.max(0, live.length - max))) this.dropToast(n);
    requestAnimationFrame(() => node.classList.add('in'));
    node._timer = setTimeout(() => this.dropToast(node), life);
  }

  dropToast(node) {
    clearTimeout(node._timer);
    node.classList.remove('in');
    node.classList.add('out');
    setTimeout(() => node.remove(), 300);
  }

  // hint (tutorial)
  // Rewrite keyboard instructions for touch players
  touchify(html) {
    if (!this.game.input.touchMode) return html;
    return html
      .replace(/<kbd>WASD<\/kbd>/g, 'the <b>joystick</b>')
      .replace(/<kbd>Shift<\/kbd> or <kbd>Space<\/kbd>/g, 'the <b>Dash</b> button')
      .replace(/(press |with |\()?<kbd>E<\/kbd>\)?/g, (m, pre) => `${pre === '(' ? '(' : pre || ''}<b>Grab</b>${m.endsWith(')') ? ')' : ''}`)
      .replace(/(press |hold )?<kbd>F<\/kbd>/g, (m, pre) => `${pre || ''}<b>Use</b>`);
  }

  onInputModeChanged() {
    if (!this.e.title.classList.contains('hidden')) this.showTitle();
    this.game.build.lastHelp = '';
    this.e.hint.dataset.h = '';
  }

  // Phones held upright get a one-off nudge to turn sideways; tablets have room either way.
  updateRotateHint() {
    const g = this.game;
    const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
    const show = g.input.touchMode && phone && !this.rotateDismissed && window.innerHeight > window.innerWidth * 1.05 && g.phase !== 'boot';
    toggle(this.e.rotateHint, 'hidden', !show);
    if (show && !this.rotateTimer) this.rotateTimer = setTimeout(() => this.dismissRotateHint(), 7000);
  }

  dismissRotateHint() {
    this.rotateDismissed = true;
    this.e.rotateHint.classList.add('hidden');
  }

  setHint(html) {
    const H = this.e.hint;
    if (!html) { H.classList.add('hidden'); return; }
    html = this.touchify(html);
    if (H.dataset.h !== html) {
      H.dataset.h = html;
      H.innerHTML = `<span class="hint-chef">${badge('chef')}</span>${html}<button class="hint-skip" data-act="skip-tut">Skip the tutorial</button>`;
      H.classList.remove('pop');
      void H.offsetWidth;
      H.classList.add('pop');
    }
    H.classList.remove('hidden');
    H.onclick = (ev) => {
      if (ev.target.closest('[data-act="skip-tut"]')) this.game.tutorial.skip();
    };
  }

  // countdown
  countdown(text, big = false) {
    const C = this.e.countdown;
    C.innerHTML = `<span class="${big ? 'go' : ''}">${text}</span>`;
    C.classList.remove('show');
    void C.offsetWidth;
    C.classList.add('show');
  }

  banner(title, sub) {
    const C = this.e.countdown;
    C.innerHTML = `<div class="banner"><b>${esc(title)}</b><small>${esc(sub)}</small></div>`;
    C.classList.remove('show');
    void C.offsetWidth;
    C.classList.add('show');
  }

  // night dock
  showDock(v) {
    this.e.dock.classList.toggle('hidden', !v);
    this.e.buildHelp.classList.toggle('hidden', !v || this.dockTab !== 'build');
    if (v) this.renderDock();
  }

  renderDock() {
    const g = this.game;
    const D = this.e.dock;
    const tabs = [['build', 'hammer', 'Build'], ['staff', 'people', 'Staff'], ['upgrades', 'chevrons', 'Upgrades'], ['menu', 'menu', 'Menu']];
    const wages = g.staff.totalWages();
    // Re-rendering after a purchase must not throw the player back to the top or start of a list
    const view = `${this.dockTab}|${this.buildCat}`;
    const keep = view === this._dockViewShown ? [...D.querySelectorAll('.dock-panel, .dock-panel .cards, .dock-panel .chips')].map((n) => [n.scrollTop, n.scrollLeft]) : [];
    this._dockViewShown = view;
    const sad = sadPets(g.state.home);
    D.innerHTML = `
      <div class="dock-top">
        <div class="dock-tabs">${tabs.map(([id, ic, n]) => `<button class="tab ${this.dockTab === id ? 'on' : ''}" data-tab="${id}">${icon(ic)}${n}</button>`).join('')}</div>
        <div class="dock-info">Ambience <b>${Math.round(g.ambience * 100)}%</b>, wages <b>${formatMoney(wages)}</b> and rent <b>${formatMoney(g.rent())}</b> a day</div>
        <button class="tab collapse" data-act="collapse" title="Show or hide the panel">${this.dockCollapsed ? 'Show' : 'Hide'}</button>
        <button class="tab home-btn" data-act="home" title="${sad ? `${sad === 1 ? 'A pet misses' : `${sad} pets miss`} you. ` : ''}Visit your home: house, yard, pets and cars">${icon('home')}Home${sad ? `<i class="hb-dot">${icon('sad')}</i>` : ''}</button>
        <button class="big-btn primary open-btn" data-act="open">Open for day ${g.state.day}</button>
      </div>
      <div class="dock-panel ${this.dockCollapsed ? 'hidden' : ''}">${this.renderPanel()}</div>`;
    [...D.querySelectorAll('.dock-panel, .dock-panel .cards, .dock-panel .chips')].forEach((n, i) => {
      if (keep[i]) [n.scrollTop, n.scrollLeft] = keep[i];
    });
    // a fresh category in a scrolling chip row: keep its chip in sight
    if (!keep.length) {
      const chip = D.querySelector('.chips .chip.on');
      const row = chip?.parentElement;
      if (row && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, chip.offsetLeft - row.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2);
    }
    this.e.buildHelp.classList.toggle('hidden', this.dockTab !== 'build');
  }

  renderPanel() {
    switch (this.dockTab) {
      case 'build': return this.renderBuild();
      case 'staff': return this.renderStaff();
      case 'upgrades': return this.renderUpgrades();
      case 'menu': return this.renderMenu();
      default: return '';
    }
  }

  renderBuild() {
    const g = this.game;
    const s = g.state;
    const stored = Object.entries(s.storage || {}).filter(([id, n]) => CATALOG[id] && n > 0);
    const nStored = stored.reduce((a, [, n]) => a + n, 0);
    const cats = CATEGORIES.map((c) => `<button class="chip ${this.buildCat === c.id ? 'on' : ''}" data-cat="${c.id}">${icon(c.icon)}${c.name}</button>`).join('')
      + `<button class="chip ${this.buildCat === 'storage' ? 'on' : ''}" data-cat="storage">${icon('crate')}Storage${nStored ? ` <i class="chip-n">${nStored}</i>` : ''}</button>`;
    const decor = (n) => (n ? `<span title="Ambience">${icon('lamp')}+${n}</span>` : '');
    let cards = '';
    if (this.buildCat === 'storage') {
      cards = stored.length ? stored.map(([id, n]) => {
        const d = CATALOG[id];
        const sel = g.build.selectedType === id && g.build.fromStore;
        return `<button class="card ${sel ? 'selected' : ''}" data-stored="${id}" title="${esc(d.desc)}">
          <img src="${this.thumb(`cat:${id}`)}" alt="">
          <div class="c-name">${esc(d.name)}</div>
          <div class="c-meta"><span class="free-tag">Free to place</span>${n > 1 ? `<span>×${n}</span>` : ''}</div>
        </button>`;
      }).join('') : `<div class="perk-sum">Nothing in storage yet. Pick up a placed item and press <b>Store</b> (or <kbd>C</kbd>) to keep it here, then place it again for free whenever you like.</div>`;
    } else if (this.buildCat === 'style') {
      const theme = (kind, id, t, tall) => {
        const owned = s.ownedThemes.includes(`${kind}:${id}`);
        const on = (kind === 'floor' ? s.floorTheme : s.wallTheme) === id;
        return `<button class="card style ${on ? 'selected' : ''}" data-theme="${kind}:${id}">
          <div class="swatch-img ${tall ? 'tall' : ''}" style="background-image:url(${this.thumb(`${kind}:${id}`)})"></div>
          <div class="c-name">${t.name}</div>
          <div class="c-meta">${on ? `${icon('check')}In use` : owned ? 'Owned' : `<b>${badge('coin')}${t.price}</b>`}${decor(t.decor)}</div>
        </button>`;
      };
      const fl = Object.entries(FLOOR_THEMES).map(([id, t]) => theme('floor', id, t, false)).join('');
      const wl = Object.entries(WALL_THEMES).map(([id, t]) => theme('wall', id, t, true)).join('');
      cards = `<div class="card-label">Flooring</div>${fl}<div class="card-label">Wallpaper</div>${wl}`;
    } else {
      cards = catalogByCategory(this.buildCat).map((d) => {
        const needsCuisine = d.req && !s.cuisines[d.req];
        const needsStars = d.stars && s.rating < d.stars;
        const locked = needsCuisine || needsStars;
        const afford = s.cash >= d.price;
        const sel = g.build.selectedType === d.id;
        const count = g.grid.countType(d.id);
        const perk = d.perk ? `<div class="c-perk ${count ? 'on' : ''}">${count ? icon('check') : icon('star')}${esc(perkText(d.perk))}</div>` : '';
        return `<button class="card ${locked ? 'locked' : ''} ${!afford ? 'poor' : ''} ${sel ? 'selected' : ''}" data-buy="${d.id}" title="${esc(d.desc)}">
          <img src="${this.thumb(`cat:${d.id}`)}" alt="">
          <div class="c-name">${esc(d.name)}</div>
          ${perk}
          <div class="c-meta"><b>${badge('coin')}${d.price}</b>${decor(d.decor)}${count ? `<span>×${count}</span>` : ''}</div>
          ${needsCuisine ? `<div class="lock">${badge('lock')}${esc(CUISINES[d.req].name)}</div>` : needsStars ? `<div class="lock">${badge('lock')}${d.stars.toFixed(1)}★</div>` : ''}
        </button>`;
      }).join('');
      if (this.buildCat === 'decor' || this.buildCat === 'show') {
        const active = Object.entries(g.perks).filter(([, v]) => v > 0).map(([k, v]) => PERKS[k].label(v));
        cards = `<div class="perk-sum">${active.length ? `Restaurant perks: <b>${esc(active.join(', '))}</b>` : 'Items with a star tag add a bonus for the whole restaurant. Each kind counts once.'}</div>${cards}`;
      }
    }
    const floorNext = UPGRADES.floor.levels[s.upgrades.floor];
    return `<div class="chips">${cats}</div><div class="cards">${cards}</div>
      ${floorNext ? `<div class="expand-tip">Need more room? <button class="mini-btn" data-upg="floor">Expand the floor (${formatMoney(floorNext.price)})</button></div>` : ''}`;
  }

  renderStaff() {
    const g = this.game;
    const roster = g.state.staff;
    const cards = roster.map((d) => {
      const T = STAFF_TYPES[d.role];
      const L = STAFF_LEVELS[d.level - 1];
      const up = g.staff.upgradeCost(d);
      return `<div class="card staff">
        <div class="portrait role-${d.role}">${icon(ROLE_ICON[d.role])}<button class="restyle" data-staff-style="${d.id}" title="Change their look" aria-label="Change their look">${icon('shirt')}</button></div>
        <div class="c-name">${esc(d.name)}</div>
        <div class="c-role">${T.name} · <span class="lvl">${L.label}</span></div>
        <div class="pips">${[1, 2, 3].map((i) => `<i class="${i <= d.level ? 'on' : ''}"></i>`).join('')}</div>
        <div class="c-meta">Speed ${L.speed.toFixed(1)} · Skill ${Math.round(L.work * 100)}%</div>
        <div class="c-meta">Wage ${formatMoney(g.staff.wage(d))}/day</div>
        <div class="row">
          ${up !== null ? `<button class="mini-btn ${g.state.cash < up ? 'poor' : ''}" data-staff-up="${d.id}">${icon('chevrons')}${formatMoney(up)}</button>` : '<span class="maxed">Fully trained</span>'}
          <button class="mini-btn danger" data-staff-fire="${d.id}">Let go</button>
        </div>
      </div>`;
    }).join('');
    const hires = Object.entries(STAFF_TYPES).map(([role, T]) => `
      <button class="card hire ${g.state.cash < T.hire || roster.length >= MAX_STAFF ? 'poor' : ''}" data-hire="${role}" title="${esc(T.desc)}">
        <div class="portrait role-${role}">${icon(ROLE_ICON[role])}</div>
        <div class="c-name">Hire a ${T.name.toLowerCase()}</div>
        <div class="c-meta">${ROLE_BLURB[role]}</div>
        <div class="c-meta"><b>${badge('coin')}${T.hire}</b> + ${formatMoney(T.wage)}/day</div>
        <div class="c-desc">${esc(T.desc)}</div>
      </button>`).join('');
    const you = `<div class="card staff you">
        <div class="portrait role-you">${icon('chefhat')}</div>
        <div class="c-name">You</div>
        <div class="c-role">Head chef</div>
        <div class="c-meta">Hats, hair, outfits and more</div>
        <div class="row"><button class="mini-btn" data-act="avatar">${icon('shirt')}Change your look</button></div>
      </div>`;
    return `<div class="card-label">Your team, ${roster.length} of ${MAX_STAFF}</div>
      <div class="cards">${you}${cards || '<div class="empty">No staff yet. It’s just you and the stove.</div>'}</div>
      <div class="card-label">Hire</div><div class="cards">${hires}</div>`;
  }

  renderUpgrades() {
    const g = this.game;
    const s = g.state;
    // A kitchen supplier's price list: one line per item, current level ticked off
    return `<div class="pricelist">${Object.entries(UPGRADES).map(([id, U]) => {
      const lvl = s.upgrades[id] || 0;
      const next = U.levels[lvl];
      const cur = lvl === 0 ? U.base : U.levels[lvl - 1].value;
      return `<div class="pl-row">
        <span class="pl-ic">${icon(U.icon)}</span>
        <div class="pl-txt"><b>${esc(U.name)}</b><small>${esc(U.desc)}</small><small class="pl-now">Now: ${esc(U.fmt(cur))}</small></div>
        <span class="pips" title="Level ${lvl} of ${U.levels.length}">${U.levels.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>
        ${next ? `<button class="mini-btn ${s.cash < next.price ? 'poor' : ''}" data-upg="${id}" title="Upgrade to ${esc(U.fmt(next.value))}"><span>${esc(U.fmt(next.value))}</span><b>${badge('coin')}${next.price}</b></button>` : '<span class="maxed">MAX</span>'}
      </div>`;
    }).join('')}</div>`;
  }

  renderMenu() {
    const g = this.game;
    const s = g.state;
    return `<div class="cuisines">${CUISINE_ORDER.map((cid) => {
      const C = CUISINES[cid];
      const owned = !!s.cuisines[cid];
      const starOk = s.rating >= C.stars;
      const dishes = C.dishes.map((did) => {
        const D = DISHES[did];
        const miss = g.missingFor(did);
        const on = !s.menuOff[did];
        return `<label class="dish ${miss.length ? 'missing' : ''}">
          <input type="checkbox" data-dish="${did}" ${on ? 'checked' : ''} ${owned ? '' : 'disabled'}>
          <img src="${this.thumb(`dish:${did}`)}" alt="">
          <span class="d-name">${esc(D.name)} <b>$${D.price}</b></span>
          <span class="d-status">${owned ? (miss.length ? `Needs ${esc(miss.join(', '))}` : 'Ready to cook') : ''}</span>
        </label>`;
      }).join('');
      let action = '';
      if (owned) action = `<span class="owned">${icon('check')}On the menu</span>`;
      else if (!starOk) action = `<span class="locked-txt">${badge('lock')}${C.stars.toFixed(1)}★</span>`;
      else action = `<button class="mini-btn ${s.cash < C.price ? 'poor' : ''}" data-cuisine="${cid}">Unlock ${badge('coin')}${C.price}</button>`;
      return `<div class="cuisine ${!starOk && !owned ? 'locked' : ''}" style="--cu:${C.color}">
        <div class="cu-head"><img class="cu-icon" src="${this.thumb(`dish:${C.dishes[0]}`)}" alt=""><div><div class="c-name">${esc(C.name)}</div><div class="c-desc">${esc(C.blurb)}</div></div>${action}</div>
        <div class="dishes">${dishes}</div>
      </div>`;
    }).join('')}</div>`;
  }

  onDockClick(ev) {
    const g = this.game;
    const b = ev.target.closest('button');
    if (!b) return;
    g.audio.click();
    if (b.dataset.tab) {
      this.dockTab = b.dataset.tab;
      if (this.dockTab !== 'build') g.build.cancel();
      this.renderDock();
      return;
    }
    if (b.dataset.cat) {
      this.buildCat = b.dataset.cat;
      g.build.cancel();
      this.renderDock();
      return;
    }
    if (b.dataset.act === 'open') { g.openRestaurant(); return; }
    if (b.dataset.act === 'home') { g.enterHome(); return; }
    if (b.dataset.act === 'collapse') { this.dockCollapsed = !this.dockCollapsed; this.renderDock(); return; }
    if (b.dataset.buy) {
      const d = CATALOG[b.dataset.buy];
      if (d.req && !g.state.cuisines[d.req]) { this.toast(`Unlock ${CUISINES[d.req].name} in the Menu tab first`, 'warn', 'lock'); g.audio.error(); return; }
      if (d.stars && g.state.rating < d.stars) { this.toast(`${d.name} needs a ${d.stars.toFixed(1)}★ rating`, 'warn', 'lock'); g.audio.error(); return; }
      if (g.state.cash < d.price) { this.toast(`You need ${formatMoney(d.price)} for that`, 'warn', 'coin'); g.audio.error(); return; }
      g.build.select(d.id);
      this.renderDock();
      return;
    }
    if (b.dataset.theme) { g.buyTheme(b.dataset.theme); this.renderDock(); return; }
    if (b.dataset.stored) { g.build.select(b.dataset.stored, true); this.renderDock(); return; }
    if (b.dataset.hire) {
      const r = g.staff.hire(b.dataset.hire);
      if (!r.ok) { this.toast(r.msg, 'warn'); g.audio.error(); } else this.toast(`${r.member.name} joined the team`, 'good', 'people');
      this.renderDock();
      return;
    }
    if (b.dataset.staffUp) {
      const r = g.staff.upgrade(b.dataset.staffUp);
      if (!r.ok) { this.toast(r.msg || 'Can’t train them any further', 'warn'); g.audio.error(); }
      this.renderDock();
      return;
    }
    if (b.dataset.staffStyle) { this.editStaffLook(b.dataset.staffStyle); return; }
    if (b.dataset.act === 'avatar') { this.editPlayerLook(); return; }
    if (b.dataset.staffFire) {
      const d = g.state.staff.find((x) => x.id === b.dataset.staffFire);
      this.confirm(`Let ${d.name} go?`, 'They leave right away, and their training isn’t refunded.', 'Let go', () => { g.staff.fire(d.id); this.renderDock(); });
      return;
    }
    if (b.dataset.upg) { g.buyUpgrade(b.dataset.upg); this.renderDock(); return; }
    if (b.dataset.cuisine) { g.buyCuisine(b.dataset.cuisine); this.renderDock(); }
  }

  onDockChange(ev) {
    const t = ev.target;
    if (t.dataset.dish) {
      this.game.toggleDish(t.dataset.dish, t.checked);
      this.game.audio.click();
      this.renderDock();
    }
  }

  // Fraction of the screen height covered by the night dock (cached, cheap to call per frame)
  dockFraction() {
    const now = performance.now();
    if (now - this._dockFrac.t > 300) {
      const d = this.e.dock;
      const h = d.classList.contains('hidden') ? 0 : d.getBoundingClientRect().height + 12;
      this._dockFrac = { t: now, v: Math.min(0.6, h / Math.max(1, window.innerHeight)) };
    }
    return this._dockFrac.v;
  }

  // Fraction of the screen height taken by the HUD and order tickets at the top, so the day camera
  // can keep the kitchen below them. Estimated from the layout (stable: doesn't jump as tickets come and go).
  hudFraction() {
    const w = window.innerWidth, h = window.innerHeight;
    const c = this._hudFrac;
    if (c && c.w === w && c.h === h) return c.v;
    const px = w <= 640 && h > w ? 268 : h <= 520 || w <= 640 ? 124 : 204;
    const v = Math.min(0.42, px / Math.max(1, h));
    this._hudFrac = { w, h, v };
    return v;
  }

  setDockPeek(on) {
    if (!!this._peek === on) return;
    this._peek = on;
    this.e.dock.classList.toggle('peek', on);
    document.body.classList.toggle('dock-peek', on);
    // the placing toolbar sits just above the folded dock, however tall its tab row wrapped
    if (on) document.body.style.setProperty('--dock-h', `${Math.round(this.e.dock.getBoundingClientRect().height + 12)}px`);
    this._dockFrac.t = -1;
  }

  setBuildHelp(text) {
    this.e.buildHelp.innerHTML = text;
  }

  // modals
  modal(html, cls = '') {
    const wrap = el(`<div class="modal-wrap"><div class="modal ${cls}">${html}</div></div>`);
    this.e.modal.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    this.modalStack.push(wrap);
    return wrap;
  }

  closeModal(wrap) {
    if (!wrap) wrap = this.modalStack[this.modalStack.length - 1];
    if (!wrap) return;
    this.modalStack = this.modalStack.filter((m) => m !== wrap);
    wrap.classList.remove('in');
    setTimeout(() => wrap.remove(), 250);
  }

  get modalOpen() { return this.modalStack.length > 0; }

  confirm(title, text, okText, onOk) {
    const w = this.modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p>
      <div class="m-actions"><button class="big-btn ghost" data-a="no">Cancel</button><button class="big-btn primary" data-a="yes">${esc(okText)}</button></div>`);
    w.onclick = (ev) => {
      const a = actionOf(ev);
      if (!a) return;
      this.game.audio.click();
      this.closeModal(w);
      if (a === 'yes') onOk();
    };
  }

  showHelp() {
    const touch = this.game.input.touchMode;
    const key = (k, t) => (touch ? `<b>${t}</b>` : `<kbd>${k}</kbd>`);
    const w = this.modal(`
      <h2>How to play</h2>
      <div class="help-grid">
        <div><h3>${icon('sun')}Service, 10 AM to 10 PM</h3>
          <ul>
            <li>Guests sit down and order. Each ticket shows the dish, what goes on the plate, and how to prepare each part: ${icon('knife')} chop, ${icon('pan')} sear, ${icon('pot')} boil, ${icon('fryer')} fry, ${icon('oven')} bake.</li>
            <li>Take ingredients from the crates (${key('E', 'Grab')}), chop them on a board (${key('F', 'Use')}), then cook them on the right station.</li>
            <li>Pick up a clean plate, add each finished part, carry it to the table and press ${key('E', 'Grab')} to serve.</li>
            <li>Pizza and tarts start as dough. Knead it into a base, add the chopped toppings, then bake.</li>
            <li>When guests leave, take their dirty plates to the sink and hold ${key('F', 'Use')} to wash them. Walk past a paid table to collect the money.</li>
            <li>Food left on the heat burns, then catches fire. Grab the extinguisher and hold ${key('F', 'Use')} to put it out.</li>
          </ul></div>
        <div><h3>${icon('moon')}After closing</h3>
          <ul>
            <li><b>Build:</b> buy and place stations, tables and decorations. ${touch ? 'Tap a placed item to move or sell it.' : '<kbd>R</kbd> rotates, click a placed item to move it, <kbd>X</kbd> or right-click sells it.'}</li>
            <li><b>Staff:</b> hire sous-chefs, waiters and dishwashers, and train them up.</li>
            <li><b>Upgrades:</b> faster dash, sharper knives, fireproof stoves, more plates, a bigger floor.</li>
            <li><b>Menu:</b> earn stars to unlock new cuisines, then choose which dishes to serve.</li>
            <li>Decorations raise ambience, so guests wait longer and tip more. Lamps calm the guests sitting near them.</li>
            <li>Showpieces and some decor add a bonus for the whole restaurant, like bigger tips or more guests. Each kind counts once.</li>
            <li>As your rating climbs, new shops and sights open around town.</li>
            <li>Food critics wear a gold crown. Serve them quickly for a big bonus.</li>
            <li>Celebrities in sunglasses pay triple but won't wait long. Each day also brings three goals with cash rewards: tap the pips under the clock to see them.</li>
            <li>Build a drive-thru window on the right-hand wall and cars will queue outside to order.</li>
          </ul></div>
      </div>
      ${touch
        ? '<div class="help-keys"><span>Left thumb: move</span><span><b>Grab</b>: pick up, put down, serve</span><span><b>Use</b>: chop, wash, spray</span><span><b>Dash</b>: sprint</span><span>At night, drag to pan and pinch to zoom</span></div>'
        : '<div class="help-keys"><span><kbd>WASD</kbd>/<kbd>Arrows</kbd> move</span><span><kbd>Shift</kbd>/<kbd>Space</kbd> dash</span><span><kbd>E</kbd>/left-click pick up and put down</span><span><kbd>F</kbd>/right-click chop, wash, spray</span><span><kbd>Esc</kbd> pause</span><span>Mouse wheel zooms</span></div>'}
      <div class="m-actions"><button class="big-btn primary" data-a="ok">Back to the kitchen</button></div>`, 'wide');
    w.onclick = (ev) => {
      if (actionOf(ev) === 'ok') { this.game.audio.click(); this.closeModal(w); }
    };
  }

  showPause() {
    const g = this.game;
    const v = g.audio.vol;
    const w = this.modal(`
      <h2>Paused</h2>
      <div class="settings">
        <label>Master <input type="range" min="0" max="1" step="0.05" value="${v.master}" data-vol="master"></label>
        <label>Effects <input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-vol="sfx"></label>
        <label>Music <input type="range" min="0" max="1" step="0.05" value="${v.music}" data-vol="music"></label>
      </div>
      <div class="m-actions col">
        <button class="big-btn primary" data-a="resume">Resume</button>
        <button class="big-btn ghost" data-a="help">How to play</button>
        <button class="big-btn ghost" data-a="quit">Save and quit to title</button>
      </div>`);
    w.oninput = (ev) => {
      const k = ev.target.dataset.vol;
      if (k) { g.audio.setVolumes({ [k]: parseFloat(ev.target.value) }); g.settings.volume = { ...g.audio.vol }; g.saveSettings(); }
    };
    w.onclick = (ev) => {
      const a = actionOf(ev);
      if (!a) return;
      g.audio.click();
      if (a === 'resume') g.togglePause(false);
      if (a === 'help') this.showHelp();
      if (a === 'quit') { this.closeModal(w); g.quitToTitle(); }
    };
    return w;
  }

  // End-of-day results: a medal for the day, the rating change, what happened and the money
  showSummary(rep, onContinue) {
    const g = this.game;
    const money = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`;
    const row = (ic, label, v, cls = '') => `<div class="r-row ${cls}">${icon(ic)}<span>${label}</span><b>${v}</b></div>`;
    const critic = {
      wowed: ['gold', badge('trophy'), 'The critic loved it. Expect a glowing review.'],
      meh: ['', icon('dots'), 'The critic left unimpressed.'],
      angry: ['', icon('warn'), 'The critic walked out before eating.'],
    }[rep.critic];
    const unlocks = rep.newCuisines.map((c) => `<div class="r-note gold">${badge('star')}<span><b>${CUISINES[c].name}</b> is ready to unlock in the Menu tab.</span></div>`).join('');
    const grade = rep.net > 400 ? 'S' : rep.net > 250 ? 'A' : rep.net > 120 ? 'B' : rep.net > 0 ? 'C' : 'D';
    const title = { S: 'Amazing day!', A: 'Great day!', B: 'Good day!', C: 'Not bad!', D: 'Tough day' }[grade];
    const delta = Math.round((rep.ratingAfter - rep.ratingBefore) * 100);
    const w = this.modal(`
      <h2>Day ${rep.day}: ${title}</h2>
      <div class="res-medal g-${grade}" title="Grade for the day">${grade}</div>
      <div class="res-rating">${starsHTML(rep.ratingAfter)} ${rep.ratingBefore.toFixed(2)} → ${rep.ratingAfter.toFixed(2)}${delta ? `<span class="${delta > 0 ? 'up' : 'down'}">${icon(delta > 0 ? 'trendup' : 'trenddown')}</span>` : ''}</div>
      <div class="res-cols">
        <div class="res-sec">
          ${row('check', 'Guests served', rep.served)}
          ${row('exit', 'Walked out', rep.lost, rep.lost ? 'neg' : '')}
          ${row('people', 'Turned away', rep.turnedAway, rep.turnedAway ? 'neg' : '')}
          ${row('fire', 'Burnt dishes', rep.burnt, rep.burnt ? 'neg' : '')}
        </div>
        <div class="res-sec">
          ${row('cloche', 'Food sales', money(rep.revenue))}
          ${row('heart', 'Tips', money(rep.tips))}
          ${rep.criticBonus ? row('crown', 'Critic bonus', money(rep.criticBonus), 'gold') : ''}
          ${rep.goalCash ? row('check', 'Goal rewards', money(rep.goalCash), 'gold') : ''}
          ${rep.homeIncome ? row('plant', 'Garden crops', money(rep.homeIncome), 'gold') : ''}
          ${row('crate', 'Ingredients', money(-rep.ingredients), rep.ingredients ? 'neg' : '')}
          ${rep.wages ? row('people', 'Staff wages', money(-rep.wages), 'neg') : ''}
          ${row('floor', 'Rent', money(-rep.rent), rep.rent ? 'neg' : '')}
          ${rep.homeWages ? row('home', 'Home helpers', money(-rep.homeWages), 'neg') : ''}
        </div>
      </div>
      <div class="r-total">${badge('coin')}<b class="${rep.net >= 0 ? 'pos' : 'neg'}">${money(rep.net)}</b></div>
      ${critic ? `<div class="r-note ${critic[0]}">${critic[1]}<span>${critic[2]}</span></div>` : ''}
      ${rep.goals?.length ? `<div class="res-goals">${rep.goals.map((x) => `<div class="rg ${x.state}">${icon(x.state === 'done' ? 'check' : 'x')}<span>${esc(x.text)}</span><b>${x.state === 'done' ? `+${formatMoney(x.reward)}` : ''}</b></div>`).join('')}</div>` : ''}
      ${unlocks}
      <div class="m-actions"><button class="big-btn primary" data-a="go">Continue</button></div>`, 'results');
    w.onclick = (ev) => {
      if (actionOf(ev) === 'go') {
        g.audio.click();
        this.closeModal(w);
        onContinue();
      }
    };
    return w;
  }
}
