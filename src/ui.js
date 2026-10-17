// HTML/CSS glassmorphic interface: HUD, animated order tickets, world-anchored bubbles &
// progress bars, action prompts, toasts, the night-time Build/Staff/Upgrades/Menu dock,
// and all modal screens (title, summary, pause, help).

import { DISHES, CUISINES, CUISINE_ORDER, ticketParts, itemLabel } from './recipes.js';
import {
  CATALOG, CATEGORIES, UPGRADES, STAFF_TYPES, STAFF_LEVELS, MAX_STAFF, FLOOR_THEMES, WALL_THEMES, catalogByCategory,
} from './catalog.js';
import { formatMoney, formatClock, clamp } from './utils.js';
import { DAY } from './config.js';

const $ = (sel, root = document) => root.querySelector(sel);
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

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

const ROLE_BLURB = { chef: '🔪 Preps & cooks', waiter: '🍽️ Serves & clears', dish: '🧽 Washes plates' };

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
    this.rotateDismissed = false;
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

  // ------------------------------------------------------------- setup
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
        Promise.resolve(p).catch(() => this.toast('Fullscreen is not available here', 'warn'));
      });
    }
    this.e.rotateHint.addEventListener('click', () => {
      this.rotateDismissed = true;
      this.e.rotateHint.classList.add('hidden');
    });
    this.e.dock.addEventListener('click', (ev) => this.onDockClick(ev));
    this.e.dock.addEventListener('change', (ev) => this.onDockChange(ev));
    // hover blip on buttons
    document.addEventListener('mouseover', (ev) => {
      if (ev.target.closest && ev.target.closest('button, .card')) g.audio.hover();
    });
  }

  setLoading(p, text) {
    const L = this.e.loading;
    if (!L) return;
    $('.load-fill', L).style.width = `${Math.round(p * 100)}%`;
    if (text) $('.load-text', L).textContent = text;
  }
  hideLoading() {
    this.e.loading.classList.add('fade');
    setTimeout(() => this.e.loading.remove(), 700);
  }

  thumb(key) { return this.thumbs[key] || ''; }

  // ------------------------------------------------------------- title
  showTitle() {
    const g = this.game;
    const save = g.peekSave();
    const T = this.e.title;
    T.classList.remove('hidden');
    const colors = ['#e74c3c', '#3d9be9', '#2ecc71', '#f39c12', '#9b59b6', '#ff6fa8'];
    const cur = g.settings.color || colors[0];
    T.innerHTML = `
      <div class="title-card glass">
        <div class="logo"><span class="logo-pan">🍳</span><h1>Pandemonium<br><span>Bistro</span></h1></div>
        <p class="tagline">A frantic kitchen-chaos tycoon. Cook, serve, build, expand — don't burn the place down.</p>
        <div class="title-buttons">
          ${save ? `<button class="big-btn primary" data-act="continue">▶ Continue <small>Day ${save.day} · ${formatMoney(save.cash)} · ${save.rating.toFixed(1)}★</small></button>` : ''}
          <button class="big-btn ${save ? '' : 'primary'}" data-act="new">✨ New Restaurant</button>
          <button class="big-btn ghost" data-act="help">📖 How to Play</button>
        </div>
        <div class="apron">
          <span>Chef apron</span>
          ${colors.map((c) => `<button class="swatch ${c === cur ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="apron ${c}"></button>`).join('')}
        </div>
        <div class="title-keys">${this.game.input.touchMode
          ? '<span>🕹️ Left thumb: move</span><span>✋ Grab · 🔪 Use · 💨 Dash buttons</span><span>Pinch to zoom</span>'
          : '<span><kbd>WASD</kbd> move</span><span><kbd>Shift</kbd>/<kbd>Space</kbd> dash</span><span><kbd>E</kbd> pick / drop</span><span><kbd>F</kbd> chop · wash · spray</span><span><kbd>Esc</kbd> pause</span>'}
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
          this.confirm('Start a new restaurant?', 'Your current save will be overwritten.', 'Start fresh', () => { this.hideTitle(); g.newGame(); });
        } else { this.hideTitle(); g.newGame(); }
      }
      if (act === 'help') this.showHelp();
    };
  }

  hideTitle() {
    this.e.title.classList.add('hidden');
  }

  // ------------------------------------------------------------- HUD
  showHUD(v) { this.e.hud.classList.toggle('hidden', !v); }

  updateHUD(dt) {
    const g = this.game;
    const s = g.state;
    if (!s) return;
    if (!this.h) {
      this.h = {
        cash: $('#hud-cash'), day: $('#hud-day'), clock: $('#hud-clock'), fill: $('#hud-clock-fill'), sun: $('#hud-sun'),
        stars: $('#hud-stars'), next: $('#hud-next'), amb: $('#hud-amb'), dash: $('#hud-dash'), mute: $('#btn-mute'),
      };
    }
    const h = this.h;
    this.cashShown += (s.cash - this.cashShown) * Math.min(1, dt * 8);
    if (Math.abs(s.cash - this.cashShown) < 0.5) this.cashShown = s.cash;
    setText(h.cash, formatMoney(this.cashShown));
    setText(h.day, `Day ${g.phase === 'summary' ? s.day - 1 : s.day}`);
    const night = g.phase === 'night' || g.phase === 'summary';
    setText(h.clock, night ? 'Closed' : formatClock(Math.min(g.clock, DAY.closeHour + 0.99)));
    const prog = clamp((g.clock - DAY.openHour) / (DAY.closeHour - DAY.openHour), 0, 1);
    setStyle(h.fill, 'width', `${night ? 100 : Math.round(prog * 200) / 2}%`);
    setText(h.sun, night ? '🌙' : g.clock >= 19 ? '🌇' : g.clock >= 17.5 ? '🌆' : '☀️');
    setHTML(h.stars, `${starsHTML(Math.round(s.rating * 100) / 100)}<b>${s.rating.toFixed(2)}</b>`);
    const next = CUISINE_ORDER.map((id) => CUISINES[id]).find((c) => c.stars > s.rating);
    setText(h.next, next ? `Next: ${next.icon} ${next.stars.toFixed(1)}★` : 'All cuisines unlocked!');
    setText(h.amb, `${Math.round(g.ambience * 100)}%`);
    const dash = g.player ? clamp(1 - g.player.dashCD / g.upg('dash'), 0, 1) : 1;
    setVar(h.dash, '--p', String(Math.round(dash * 40) / 40));
    toggle(h.dash, 'ready', dash >= 1);
    toggle(this.e.vignette, 'on', g.fire.count > 0);
    setText(h.mute, g.audio.muted ? '🔇' : '🔊');
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

  // ------------------------------------------------------------- tickets
  addTicket(t) {
    const d = DISHES[t.dish];
    const parts = ticketParts(t.dish);
    const node = el(`
      <div class="ticket ${t.critic ? 'critic' : ''}">
        ${t.critic ? '<div class="t-crown">👑 CRITIC</div>' : ''}
        <div class="t-head"><span class="t-table">T${t.table}</span><span class="t-price">$${d.price}</span></div>
        <div class="t-dish"><img src="${this.thumb(`dish:${t.dish}`)}" alt=""></div>
        <div class="t-name">${esc(d.name)}</div>
        <div class="t-parts">${parts.map((p) => `<div class="t-part"><img src="${this.thumb(`item:${p.key}`)}" alt="">${p.badge ? `<span class="badge">${p.badge}</span>` : ''}</div>`).join('')}</div>
        <div class="t-bar"><div class="t-fill"></div></div>
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
    const room = this.e.tickets.clientWidth || window.innerWidth * 0.6;
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

  // ------------------------------------------------------------- world overlays
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
    if (showWorld || g.phase === 'title') {
      // Customers
      for (const c of g.customers.allCustomers()) {
        const y = c.sitting ? 1.95 : 1.75;
        if (c.state === 'waiting') {
          const key = `c${c.root.id}`;
          const node = this.w(key, `bubble ${c.critic ? 'critic' : ''}`, `
            <svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="ring-bg"/><circle cx="22" cy="22" r="19" class="ring-fg"/></svg>
            <img src="${this.thumb(`dish:${c.order}`)}" alt="">${c.critic ? '<span class="crown">👑</span>' : ''}`);
          const p = clamp(c.patience, 0, 1);
          this.ring(node, p, p > 0.5 ? '#5ee07a' : p > 0.25 ? '#ffc93c' : '#ff4d4d');
          toggle(node, 'urgent', p <= 0.25);
          this.place(node, c.pos.x, y, c.pos.z);
        } else if (c.state === 'seated') {
          const node = this.w(`t${c.root.id}`, 'bubble think', '<span>💭</span>');
          this.place(node, c.pos.x, y, c.pos.z);
        } else if (c.group.state === 'queue' && c === c.group.members[0]) {
          const node = this.w(`q${c.root.id}`, 'bubble queue', '<svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="ring-bg"/><circle cx="22" cy="22" r="19" class="ring-fg"/></svg><span>⏳</span>');
          const p = clamp(1 - c.group.queueT / c.group.queueMax, 0, 1);
          this.ring(node, p, p > 0.4 ? '#9ad0ff' : '#ff8a5c');
          this.place(node, c.pos.x, y, c.pos.z);
        }
      }
      // Stations
      for (const st of g.grid.stations()) {
        if (st.fire > 0) {
          const node = this.w(`f${st.obj.uid}`, 'st-icon fire', '🔥');
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
        setText(node, m.status);
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

  // ------------------------------------------------------------- prompt
  updatePrompt() {
    const g = this.game;
    const P = this.e.prompt;
    if (g.phase !== 'day' || !g.player) { toggle(P, 'hidden', true); return; }
    const pl = g.player;
    const d = g.interact.describe(pl, pl.target);
    const parts = [];
    const touch = g.input.touchMode;
    if (pl.held) parts.push(`<span class="holding">✋ ${esc(itemLabel(pl.held))}</span>`);
    // Touch players see the actions on the buttons themselves
    if (d.e && !touch) parts.push(`<span><kbd>E</kbd> ${esc(d.e)}</span>`);
    if (d.f && !touch) parts.push(`<span><kbd>F</kbd> ${esc(d.f)}</span>`);
    if (d.warn) parts.push(`<span class="pwarn-text">⚠ ${esc(d.warn)}</span>`);
    const html = parts.join('');
    if (P.dataset.h !== html) {
      P.dataset.h = html;
      P.innerHTML = html;
    }
    toggle(P, 'hidden', !html);
  }

  // ------------------------------------------------------------- toasts
  toast(text, type = 'info') {
    const node = el(`<div class="toast ${type}">${esc(text)}</div>`);
    this.e.toasts.appendChild(node);
    while (this.e.toasts.children.length > 4) this.e.toasts.firstChild.remove();
    requestAnimationFrame(() => node.classList.add('in'));
    setTimeout(() => {
      node.classList.remove('in');
      node.classList.add('out');
      setTimeout(() => node.remove(), 400);
    }, type === 'danger' || type === 'gold' ? 4200 : 3200);
  }

  // ------------------------------------------------------------- hint (tutorial)
  // Rewrite keyboard instructions for touch players
  touchify(html) {
    if (!this.game.input.touchMode) return html;
    return html
      .replace(/<kbd>WASD<\/kbd>/g, 'the <b>joystick</b>')
      .replace(/<kbd>Shift<\/kbd> or <kbd>Space<\/kbd>/g, 'the <b>💨 Dash</b> button')
      .replace(/(press |with |\()?<kbd>E<\/kbd>\)?/g, (m, pre) => `${pre === '(' ? '(' : pre || ''}<b>✋ Grab</b>${m.endsWith(')') ? ')' : ''}`)
      .replace(/(press |hold )?<kbd>F<\/kbd>/g, (m, pre) => `${pre || ''}<b>🔪 Use</b>`);
  }

  onInputModeChanged() {
    if (!this.e.title.classList.contains('hidden')) this.showTitle();
    this.game.build.lastHelp = '';
    this.e.hint.dataset.h = '';
  }

  updateRotateHint() {
    const g = this.game;
    const show = g.input.touchMode && !this.rotateDismissed && window.innerHeight > window.innerWidth * 1.05 && g.phase !== 'boot';
    toggle(this.e.rotateHint, 'hidden', !show);
  }

  setHint(html) {
    const H = this.e.hint;
    if (!html) { H.classList.add('hidden'); return; }
    html = this.touchify(html);
    if (H.dataset.h !== html) {
      H.dataset.h = html;
      H.innerHTML = `${html}<button class="hint-skip" data-act="skip-tut">Skip tutorial</button>`;
      H.classList.remove('pop');
      void H.offsetWidth;
      H.classList.add('pop');
    }
    H.classList.remove('hidden');
    H.onclick = (ev) => {
      if (ev.target.dataset.act === 'skip-tut') this.game.tutorial.skip();
    };
  }

  // ------------------------------------------------------------- countdown
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

  // ------------------------------------------------------------- night dock
  showDock(v) {
    this.e.dock.classList.toggle('hidden', !v);
    this.e.buildHelp.classList.toggle('hidden', !v || this.dockTab !== 'build');
    if (v) this.renderDock();
  }

  renderDock() {
    const g = this.game;
    const D = this.e.dock;
    const tabs = [['build', '🔨 Build'], ['staff', '👥 Staff'], ['upgrades', '⚡ Upgrades'], ['menu', '📜 Menu']];
    const wages = g.staff.totalWages();
    D.innerHTML = `
      <div class="dock-top">
        <div class="dock-tabs">${tabs.map(([id, n]) => `<button class="tab ${this.dockTab === id ? 'on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>
        <div class="dock-info">Wages <b>${formatMoney(wages)}</b>/day · Rent <b>${formatMoney(g.rent())}</b>/day</div>
        <button class="tab collapse" data-act="collapse" title="Show / hide the panel">${this.dockCollapsed ? '▴ Show' : '▾ Hide'}</button>
        <button class="big-btn primary open-btn" data-act="open">☀️ Open for Day ${g.state.day}</button>
      </div>
      <div class="dock-panel ${this.dockCollapsed ? 'hidden' : ''}">${this.renderPanel()}</div>`;
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
    const cats = CATEGORIES.map((c) => `<button class="chip ${this.buildCat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.icon} ${c.name}</button>`).join('');
    let cards = '';
    if (this.buildCat === 'style') {
      const fl = Object.entries(FLOOR_THEMES).map(([id, t]) => {
        const owned = s.ownedThemes.includes(`floor:${id}`);
        const on = s.floorTheme === id;
        return `<button class="card style ${on ? 'selected' : ''}" data-theme="floor:${id}">
          <div class="swatch-img" style="background-image:url(${this.thumb(`floor:${id}`)})"></div>
          <div class="c-name">${t.name}</div>
          <div class="c-meta">${on ? '✔ Applied' : owned ? 'Owned' : formatMoney(t.price)}${t.decor ? ` · +${t.decor}✨` : ''}</div>
        </button>`;
      }).join('');
      const wl = Object.entries(WALL_THEMES).map(([id, t]) => {
        const owned = s.ownedThemes.includes(`wall:${id}`);
        const on = s.wallTheme === id;
        return `<button class="card style ${on ? 'selected' : ''}" data-theme="wall:${id}">
          <div class="swatch-img tall" style="background-image:url(${this.thumb(`wall:${id}`)})"></div>
          <div class="c-name">${t.name}</div>
          <div class="c-meta">${on ? '✔ Applied' : owned ? 'Owned' : formatMoney(t.price)}${t.decor ? ` · +${t.decor}✨` : ''}</div>
        </button>`;
      }).join('');
      cards = `<div class="card-label">Flooring</div>${fl}<div class="card-label">Wallpaper</div>${wl}`;
    } else {
      cards = catalogByCategory(this.buildCat).map((d) => {
        const locked = d.req && !s.cuisines[d.req];
        const afford = s.cash >= d.price;
        const sel = g.build.selectedType === d.id;
        const count = g.grid.countType(d.id);
        return `<button class="card ${locked ? 'locked' : ''} ${!afford ? 'poor' : ''} ${sel ? 'selected' : ''}" data-buy="${d.id}" title="${esc(d.desc)}">
          <img src="${this.thumb(`cat:${d.id}`)}" alt="">
          <div class="c-name">${esc(d.name)}</div>
          <div class="c-meta"><b>${formatMoney(d.price)}</b>${d.decor ? ` · +${d.decor}✨` : ''}${count ? ` · ×${count}` : ''}</div>
          ${locked ? `<div class="lock">🔒 ${CUISINES[d.req].icon} ${esc(CUISINES[d.req].name)}</div>` : ''}
        </button>`;
      }).join('');
    }
    const floorNext = UPGRADES.floor.levels[s.upgrades.floor];
    return `<div class="chips">${cats}</div><div class="cards">${cards}</div>
      ${floorNext ? `<div class="expand-tip">🏗️ Need more space? <button class="mini-btn" data-upg="floor">Expand floor — ${formatMoney(floorNext.price)}</button></div>` : ''}`;
  }

  renderStaff() {
    const g = this.game;
    const roster = g.state.staff;
    const cards = roster.map((d) => {
      const T = STAFF_TYPES[d.role];
      const L = STAFF_LEVELS[d.level - 1];
      const up = g.staff.upgradeCost(d);
      return `<div class="card staff">
        <div class="portrait role-${d.role}">${T.icon}</div>
        <div class="c-name">${esc(d.name)}</div>
        <div class="c-role">${T.name} · <span class="lvl">${L.label}</span></div>
        <div class="pips">${[1, 2, 3].map((i) => `<i class="${i <= d.level ? 'on' : ''}"></i>`).join('')}</div>
        <div class="c-meta">Speed ${L.speed.toFixed(1)} · Skill ${Math.round(L.work * 100)}%</div>
        <div class="c-meta">Wage ${formatMoney(g.staff.wage(d))}/day</div>
        <div class="row">
          ${up !== null ? `<button class="mini-btn ${g.state.cash < up ? 'poor' : ''}" data-staff-up="${d.id}">⬆ ${formatMoney(up)}</button>` : '<span class="maxed">MAX</span>'}
          <button class="mini-btn danger" data-staff-fire="${d.id}">Fire</button>
        </div>
      </div>`;
    }).join('');
    const hires = Object.entries(STAFF_TYPES).map(([role, T]) => `
      <button class="card hire ${g.state.cash < T.hire || roster.length >= MAX_STAFF ? 'poor' : ''}" data-hire="${role}" title="${esc(T.desc)}">
        <div class="portrait role-${role}">${T.icon}</div>
        <div class="c-name">Hire ${T.name}</div>
        <div class="c-meta">${ROLE_BLURB[role]}</div>
        <div class="c-meta"><b>${formatMoney(T.hire)}</b> + ${formatMoney(T.wage)}/day</div>
        <div class="c-desc">${esc(T.desc)}</div>
      </button>`).join('');
    return `<div class="card-label">Your team (${roster.length}/${MAX_STAFF})</div>
      <div class="cards">${cards || '<div class="empty">No staff yet — it\'s just you and the stove. Hire some help!</div>'}</div>
      <div class="card-label">Recruit</div><div class="cards">${hires}</div>`;
  }

  renderUpgrades() {
    const g = this.game;
    const s = g.state;
    return `<div class="cards upgrades">${Object.entries(UPGRADES).map(([id, U]) => {
      const lvl = s.upgrades[id] || 0;
      const next = U.levels[lvl];
      const cur = lvl === 0 ? U.base : U.levels[lvl - 1].value;
      return `<div class="card upgrade">
        <div class="u-icon">${U.icon}</div>
        <div class="c-name">${esc(U.name)}</div>
        <div class="c-desc">${esc(U.desc)}</div>
        <div class="pips">${U.levels.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        <div class="c-meta">Now: ${esc(U.fmt(cur))}</div>
        ${next ? `<button class="mini-btn ${s.cash < next.price ? 'poor' : ''}" data-upg="${id}">${esc(U.fmt(next.value))} — ${formatMoney(next.price)}</button>` : '<span class="maxed">MAXED</span>'}
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
          <span class="d-status">${owned ? (miss.length ? `Needs: ${esc(miss.join(', '))}` : '✓ Ready') : ''}</span>
        </label>`;
      }).join('');
      let action = '';
      if (owned) action = '<span class="owned">✔ On the menu</span>';
      else if (!starOk) action = `<span class="locked-txt">🔒 Requires ${C.stars.toFixed(1)}★</span>`;
      else action = `<button class="mini-btn ${s.cash < C.price ? 'poor' : ''}" data-cuisine="${cid}">Unlock — ${formatMoney(C.price)}</button>`;
      return `<div class="cuisine ${owned ? 'owned' : ''} ${!starOk && !owned ? 'locked' : ''}" style="--accent:${C.color}">
        <div class="cu-head"><span class="cu-icon">${C.icon}</span><div><div class="c-name">${esc(C.name)}</div><div class="c-desc">${esc(C.blurb)}</div></div>${action}</div>
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
    if (b.dataset.act === 'collapse') { this.dockCollapsed = !this.dockCollapsed; this.renderDock(); return; }
    if (b.dataset.buy) {
      const d = CATALOG[b.dataset.buy];
      if (d.req && !g.state.cuisines[d.req]) { this.toast(`Unlock ${CUISINES[d.req].name} in the Menu tab first`, 'warn'); g.audio.error(); return; }
      if (g.state.cash < d.price) { this.toast('Not enough cash!', 'warn'); g.audio.error(); return; }
      g.build.select(d.id);
      this.renderDock();
      return;
    }
    if (b.dataset.theme) { g.buyTheme(b.dataset.theme); this.renderDock(); return; }
    if (b.dataset.hire) {
      const r = g.staff.hire(b.dataset.hire);
      if (!r.ok) { this.toast(r.msg, 'warn'); g.audio.error(); } else this.toast(`👋 ${r.member.name} joined the team!`, 'good');
      this.renderDock();
      return;
    }
    if (b.dataset.staffUp) {
      const r = g.staff.upgrade(b.dataset.staffUp);
      if (!r.ok) { this.toast(r.msg || 'Cannot upgrade', 'warn'); g.audio.error(); }
      this.renderDock();
      return;
    }
    if (b.dataset.staffFire) {
      const d = g.state.staff.find((x) => x.id === b.dataset.staffFire);
      this.confirm(`Let ${d.name} go?`, 'They will leave immediately. No refunds on training!', 'Fire', () => { g.staff.fire(d.id); this.renderDock(); });
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

  setBuildHelp(text) {
    this.e.buildHelp.innerHTML = text;
  }

  // ------------------------------------------------------------- modals
  modal(html, cls = '') {
    const wrap = el(`<div class="modal-wrap"><div class="modal glass ${cls}">${html}</div></div>`);
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
      const a = ev.target.dataset.a;
      if (!a) return;
      this.game.audio.click();
      this.closeModal(w);
      if (a === 'yes') onOk();
    };
  }

  showHelp() {
    const w = this.modal(`
      <h2>📖 How to Play</h2>
      <div class="help-grid">
        <div><h3>☀️ Day Shift</h3>
          <ul>
            <li>Customers sit and order. Tickets show each dish & its steps: 🔪 chop, 🍳 sear, ♨️ boil, 🫧 fry, 🔥 bake.</li>
            <li>Grab ingredients from crates <kbd>E</kbd>, chop on boards <kbd>F</kbd>, cook on the right station.</li>
            <li>Take a clean plate, scoop the prepared parts onto it, carry it to the table and <kbd>E</kbd> to serve.</li>
            <li>Pizza & tarts: knead dough into a base, add chopped toppings onto it, then bake.</li>
            <li>Clear dirty plates <kbd>E</kbd> → sink → hold <kbd>F</kbd> to wash. Walk near tables to pocket cash.</li>
            <li>Food left on the heat burns, then catches fire 🔥 — grab the extinguisher and hold <kbd>F</kbd>!</li>
          </ul></div>
        <div><h3>🌙 Night Phase</h3>
          <ul>
            <li><b>Build:</b> buy & place stations, tables and decor. <kbd>R</kbd> rotates, click a placed item to move it, <kbd>X</kbd>/right-click sells.</li>
            <li><b>Staff:</b> hire Sous-Chefs, Waiters and Dishwashers and level them up.</li>
            <li><b>Upgrades:</b> faster dash, sharper knives, fireproof stoves, more plates, bigger floor.</li>
            <li><b>Menu:</b> earn stars to unlock new cuisines, then toggle dishes on & off.</li>
            <li>Décor raises ✨ Ambience → more patience & bigger tips. Lamps calm nearby guests.</li>
            <li>👑 Food critics demand speed — wow them for a big bonus.</li>
          </ul></div>
      </div>
      <div class="help-keys"><span><kbd>WASD</kbd>/<kbd>Arrows</kbd> move</span><span><kbd>Shift</kbd>/<kbd>Space</kbd> dash</span><span><kbd>E</kbd>/Left-click pick & drop</span><span><kbd>F</kbd>/Right-click chop, wash, spray</span><span><kbd>Esc</kbd> pause</span><span>Mouse wheel zoom</span></div>
      <div class="help-keys"><span>📱 On touch screens: left thumb moves the chef, <b>✋ Grab</b> / <b>🔪 Use</b> / <b>💨 Dash</b> buttons on the right · drag to pan and pinch to zoom at night</span></div>
      <div class="m-actions"><button class="big-btn primary" data-a="ok">Got it!</button></div>`, 'wide');
    w.onclick = (ev) => {
      if (ev.target.dataset.a === 'ok') { this.game.audio.click(); this.closeModal(w); }
    };
  }

  showPause() {
    const g = this.game;
    const v = g.audio.vol;
    const w = this.modal(`
      <h2>⏸ Paused</h2>
      <div class="settings">
        <label>Master <input type="range" min="0" max="1" step="0.05" value="${v.master}" data-vol="master"></label>
        <label>Effects <input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-vol="sfx"></label>
        <label>Music <input type="range" min="0" max="1" step="0.05" value="${v.music}" data-vol="music"></label>
      </div>
      <div class="m-actions col">
        <button class="big-btn primary" data-a="resume">▶ Resume</button>
        <button class="big-btn ghost" data-a="help">📖 How to Play</button>
        <button class="big-btn ghost" data-a="quit">🏠 Save & Quit to Title</button>
      </div>`);
    w.oninput = (ev) => {
      const k = ev.target.dataset.vol;
      if (k) { g.audio.setVolumes({ [k]: parseFloat(ev.target.value) }); g.settings.volume = { ...g.audio.vol }; g.saveSettings(); }
    };
    w.onclick = (ev) => {
      const a = ev.target.dataset.a;
      if (!a) return;
      g.audio.click();
      if (a === 'resume') g.togglePause(false);
      if (a === 'help') this.showHelp();
      if (a === 'quit') { this.closeModal(w); g.quitToTitle(); }
    };
    return w;
  }

  showSummary(rep, onContinue) {
    const g = this.game;
    const line = (label, v, cls = '') => `<div class="sum-line ${cls}"><span>${label}</span><b>${v > 0 ? '+' : ''}${formatMoney(v)}</b></div>`;
    const criticTxt = rep.critic === 'wowed' ? '🌟 The critic loved you!' : rep.critic === 'meh' ? '🧐 The critic was lukewarm' : rep.critic === 'angry' ? '😤 The critic walked out' : '';
    const unlocks = rep.newCuisines.map((c) => `<div class="unlock">🔓 ${CUISINES[c].icon} <b>${CUISINES[c].name}</b> can now be unlocked in the Menu!</div>`).join('');
    const grade = rep.net > 400 ? 'S' : rep.net > 250 ? 'A' : rep.net > 120 ? 'B' : rep.net > 0 ? 'C' : 'D';
    const w = this.modal(`
      <div class="sum-head"><div class="grade g-${grade}">${grade}</div><div><h2>Day ${rep.day} complete!</h2><p>${starsHTML(rep.ratingAfter)} ${rep.ratingBefore.toFixed(2)} → <b>${rep.ratingAfter.toFixed(2)}</b> ${rep.ratingAfter >= rep.ratingBefore ? '📈' : '📉'}</p></div></div>
      <div class="sum-stats">
        <div><b>${rep.served}</b><span>served</span></div>
        <div><b>${rep.lost}</b><span>walked out</span></div>
        <div><b>${rep.turnedAway}</b><span>turned away</span></div>
        <div><b>${rep.burnt}</b><span>burnt</span></div>
        <div><b>${rep.fires}</b><span>fires</span></div>
      </div>
      <div class="sum-money">
        ${line('Food sales', rep.revenue)}
        ${line('Tips', rep.tips)}
        ${rep.criticBonus ? line('Critic bonus', rep.criticBonus, 'gold') : ''}
        ${line('Ingredients', -rep.ingredients, 'neg')}
        ${line('Staff wages', -rep.wages, 'neg')}
        ${line('Rent & utilities', -rep.rent, 'neg')}
        <div class="sum-line total"><span>Net profit</span><b class="${rep.net >= 0 ? 'pos' : 'neg'}">${rep.net > 0 ? '+' : ''}${formatMoney(rep.net)}</b></div>
      </div>
      ${criticTxt ? `<div class="critic-line">${criticTxt}</div>` : ''}
      ${unlocks}
      <div class="m-actions"><button class="big-btn primary" data-a="go">🌙 Continue to Night</button></div>`, 'summary');
    w.onclick = (ev) => {
      if (ev.target.dataset.a === 'go') {
        g.audio.click();
        this.closeModal(w);
        onContinue();
      }
    };
    return w;
  }
}
