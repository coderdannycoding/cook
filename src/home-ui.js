// Home panel: a bottom dock in the style of the night build dock (House / Pets / Garage tabs,
// shop cards with baked thumbnails, prices, perk tags and owned states), a "Back to the
// restaurant" button and a small title badge naming the current home.

import { icon, badge } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TABS = [['house', 'home', 'House'], ['pets', 'paw', 'Pets'], ['garage', 'car', 'Garage']];

export class HomePanel {
  // data: catalogs and helpers from home.js (passed in to keep the modules free of import cycles)
  constructor(mode, data) {
    this.mode = mode;
    this.d = data;
    this.tab = 'house';
    this.collapsed = false;
    this.el = null;
    this.top = null;
    this._frac = { t: -1, v: 0 };
  }

  show() {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'home-dock';
      this.el.className = 'board';
      this.el.addEventListener('click', (ev) => this.onClick(ev));
      // A mouse wheel scrolls the card row sideways
      this.el.addEventListener('wheel', (ev) => {
        const row = ev.target.closest && ev.target.closest('.hm-row');
        if (!row || row.scrollWidth <= row.clientWidth || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
        row.scrollLeft += ev.deltaY;
        ev.preventDefault();
      }, { passive: false });
      this.top = document.createElement('div');
      this.top.id = 'home-title';
      this.top.className = 'board';
    }
    this._view = '';
    document.body.append(this.top, this.el);
    this.render();
    this._frac.t = -1;
  }

  hide() {
    this.el?.remove();
    this.top?.remove();
  }

  price(n) { return this.d.formatMoney(n).replace('$', ''); }

  perkTag(perk, on, fallback = '') {
    if (!perk) return fallback ? `<div class="c-perk hm-plain">${esc(fallback)}</div>` : '';
    return `<div class="c-perk ${on ? 'on' : ''}">${on ? icon('check') : icon('star')}<span>${esc(this.d.perkText(perk))}</span></div>`;
  }

  // A shop tile: thumbnail on the left; name, perk and price (or state) on the right
  card(attr, key, name, desc, body, cls = '', corner = '') {
    return `<button class="card hm-card ${cls}" ${attr} title="${esc(desc)}">
      ${corner}<img src="${this.mode.thumb(key)}" data-thumb="${key}" alt="">
      <div class="hm-txt"><div class="c-name">${esc(name)}</div>${body}</div></button>`;
  }

  houseCards() {
    const { HOME_TIERS, TIER_IDS, HOME_DECOR } = this.d, h = this.mode.home, cash = this.mode.game.state.cash;
    const tiers = TIER_IDS.map((id) => {
      const t = HOME_TIERS[id], cur = t.level === h.tier, past = t.level < h.tier, next = t.level === h.tier + 1;
      let meta;
      if (cur) meta = `<span class="hm-tag on">${icon('check')}Home</span>`;
      else if (past) meta = `<span class="hm-tag">${icon('check')}Outgrown</span>`;
      else meta = `<b>${badge('coin')}${this.price(t.price)}</b>`;
      const locked = t.level > h.tier + 1;
      if (locked) meta += `<span class="hm-after">${badge('lock')}After the ${esc(HOME_TIERS[TIER_IDS[t.level - 1]].name.replace(/^\S+ /, ''))}</span>`;
      const cls = `${cur ? 'selected' : ''} ${past ? 'past' : ''} ${locked ? 'locked' : ''} ${next && cash < t.price ? 'poor' : ''}`;
      return this.card(`data-tier="${id}"`, `tier:${id}`, t.name, t.desc, `${this.perkTag(t.perk, cur, 'Starter home')}<div class="c-meta">${meta}</div>`, cls);
    }).join('');
    const decor = Object.entries(HOME_DECOR).map(([id, t]) => {
      const owned = h.decor.includes(id);
      const meta = owned ? `<span class="hm-tag on">${icon('check')}In the yard</span>` : `<b>${badge('coin')}${this.price(t.price)}</b>`;
      return this.card(`data-decor="${id}"`, `decor:${id}`, t.name, t.desc, `${this.perkTag(t.perk, owned)}<div class="c-meta">${meta}</div>`, `${!owned && cash < t.price ? 'poor' : ''}`);
    }).join('');
    return `<div class="hm-label">Homes</div>${tiers}<div class="hm-label">Yard</div>${decor}`;
  }

  petCards() {
    const { PETS, PET_LIMITS } = this.d, h = this.mode.home, cash = this.mode.game.state.cash;
    return Object.entries(PETS).map(([id, t]) => {
      const n = h.pets.filter((p) => p === id).length;
      const max = n >= PET_LIMITS.same || h.pets.length >= PET_LIMITS.total;
      const meta = max ? `<span class="hm-tag on">${icon('check')}${n ? `${n} at home` : 'Yard full'}</span>` : `<b>${badge('coin')}${this.price(t.price)}</b>${n ? `<span>×${n}</span>` : ''}`;
      const corner = t.lux ? `<span class="hm-lux" title="Luxury">${icon('crown')}</span>` : '';
      return this.card(`data-pet="${id}"`, `pet:${id}`, t.name, t.desc, `${this.perkTag(t.perk, n > 0)}<div class="c-meta">${meta}</div>`, `${n ? 'owned' : ''} ${!max && cash < t.price ? 'poor' : ''}`, corner);
    }).join('');
  }

  carCards() {
    const { CARS } = this.d, h = this.mode.home, cash = this.mode.game.state.cash;
    return Object.entries(CARS).map(([id, t]) => {
      const owned = h.cars.includes(id), fav = h.favCar === id;
      let meta = `<b>${badge('coin')}${this.price(t.price)}</b>`;
      if (fav) meta = `<span class="hm-tag on">${icon('crown')}Your ride</span>`;
      else if (owned) meta = `<span class="hm-tag">${icon('car')}Drive it</span>`;
      const corner = t.lux ? `<span class="hm-lux" title="Luxury">${icon('crown')}</span>` : '';
      return this.card(`data-car="${id}"`, `car:${id}`, t.name, t.desc, `${this.perkTag(t.perk, owned)}<div class="c-meta">${meta}</div>`, `${fav ? 'selected' : ''} ${owned ? 'owned' : ''} ${!owned && cash < t.price ? 'poor' : ''}`, corner);
    }).join('');
  }

  note() {
    const { PET_LIMITS, PET_BONUS, perkText } = this.d, h = this.mode.home;
    if (this.tab === 'pets') {
      const bonus = h.pets.length >= PET_BONUS.count ? `pet lover bonus <b>${esc(perkText(PET_BONUS.perk))}</b>` : `adopt ${PET_BONUS.count} for <b>${esc(perkText(PET_BONUS.perk))}</b>`;
      return `<b>${h.pets.length}</b> of ${PET_LIMITS.total} pets, ${bonus}. Tap a pet in the yard for a cuddle.`;
    }
    if (this.tab === 'garage') return 'Tap a car you own to drive it: your ride takes the turntable. Luxury cars bring <b>more guests</b>.';
    return 'Buy the next home to move in. Pets and cars come along. Tap the lawn to stroll around.';
  }

  render() {
    if (!this.el) return;
    const d = this.d, h = this.mode.home;
    const T = d.HOME_TIERS[d.TIER_IDS[h.tier]];
    const perks = d.homePerks(h);
    const perkLine = Object.keys(perks).length ? d.perkText(perks) : 'none yet';
    this.top.innerHTML = `<span class="hm-ic">${icon('home')}</span><div class="hm-tt"><div><b>${esc(T.name)}</b><small>${icon('paw')}${h.pets.length}<i></i>${icon('car')}${h.cars.length}</small></div>
      <span class="hm-perks">Restaurant bonus: <em>${esc(perkLine)}</em></span></div>`;
    const row = this.el.querySelector('.hm-row');
    const keep = this._view === this.tab && row ? row.scrollLeft : 0;
    this._view = this.tab;
    const cards = this.tab === 'pets' ? this.petCards() : this.tab === 'garage' ? this.carCards() : this.houseCards();
    this.el.innerHTML = `
      <div class="dock-top">
        <div class="dock-tabs">${TABS.map(([id, ic, n]) => `<button class="tab ${this.tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic)}${n}</button>`).join('')}</div>
        <div class="dock-info hm-note">${this.note()}</div>
        <button class="tab collapse" data-act="collapse" title="Show or hide the panel">${this.collapsed ? 'Show' : 'Hide'}</button>
        <button class="big-btn primary open-btn hm-back" data-act="back">${icon('exit')}<span class="hm-long">Back to the restaurant</span><span class="hm-short">Back</span></button>
      </div>
      <div class="hm-row ${this.collapsed ? 'hidden' : ''}">${cards}</div>`;
    if (keep) this.el.querySelector('.hm-row').scrollLeft = keep;
    this._frac.t = -1;
  }

  setThumb(key, url) {
    if (!this.el) return;
    for (const img of this.el.querySelectorAll(`img[data-thumb="${key}"]`)) img.src = url;
  }

  onClick(ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    const m = this.mode, audio = m.game.audio;
    if (b.dataset.tab) {
      audio.click?.();
      this.tab = b.dataset.tab;
      this.render();
      return;
    }
    if (b.dataset.act === 'collapse') {
      audio.click?.();
      this.collapsed = !this.collapsed;
      this.render();
      return;
    }
    if (b.dataset.act === 'back') { m.leave(); return; }
    if (b.dataset.tier) m.buyTier(b.dataset.tier);
    else if (b.dataset.pet) m.adoptPet(b.dataset.pet);
    else if (b.dataset.car) m.carClick(b.dataset.car);
    else if (b.dataset.decor) m.buyDecor(b.dataset.decor);
  }

  // Share of the screen height covered by the dock (cached, cheap to call every frame)
  fraction() {
    const now = performance.now();
    if (now - this._frac.t > 300) {
      const h = this.el && this.el.isConnected ? this.el.getBoundingClientRect().height + 12 : 0;
      this._frac = { t: now, v: Math.min(0.6, h / Math.max(1, window.innerHeight)) };
    }
    return this._frac.v;
  }

  // The HUD counters and the title badge along the top
  topFraction() {
    return Math.min(0.2, 64 / Math.max(1, window.innerHeight));
  }
}
