// Home panel: a bottom dock in the style of the night build dock (House / Yard / Pets / Garage
// tabs, shop cards with baked thumbnails, prices, perk tags and owned states), a "Back to the
// restaurant" button and a small title badge naming the current home. While a piece of yard
// furniture is being placed or edited, the card row turns into its toolbar.

import { icon, badge } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TABS = [['house', 'home', 'House'], ['yard', 'plant', 'Yard'], ['pets', 'paw', 'Pets'], ['garage', 'car', 'Garage']];
// What the two paint rows recolour on each kind of home
const PAINT_PARTS = [['Canvas', 'Stripe'], ['Logs', 'Roof'], ['Walls', 'Roof'], ['Walls', 'Trim'], ['Walls', 'Roof']];

export class HomePanel {
  // data: catalogs and helpers from home.js (passed in to keep the modules free of import cycles)
  constructor(mode, data) {
    this.mode = mode;
    this.d = data;
    this.tab = 'house';
    this.group = 'garden';
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
    clearTimeout(this._soon);
    this.el?.remove();
    this.top?.remove();
  }

  // Re-render shortly (several quick changes in a row, like patting pets, render once)
  renderSoon() {
    clearTimeout(this._soon);
    this._soon = setTimeout(() => { if (this.el?.isConnected) this.render(); }, 150);
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
    const { HOME_TIERS, TIER_IDS } = this.d, h = this.mode.home, cash = this.mode.game.state.cash;
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
    return `${tiers}${this.paintCard('house')}${this.fenceCard()}${this.extrasCard()}<div class="hm-label">Helpers</div>${this.helperCards()}`;
  }

  fenceCard() {
    const { FENCES, FENCE_PRICE } = this.d, cur = this.mode.home.fence ?? null;
    const chips = [[null, 'Standard'], ...Object.entries(FENCES).map(([id, f]) => [id, f.name])]
      .map(([id, n]) => `<button class="hm-mini ${cur === id ? 'ok' : ''}" data-fence="${id ?? ''}">${esc(n)}</button>`).join('');
    return `<div class="card hm-card hm-paint hm-fence"><div class="hm-txt"><div class="c-name">${icon('home')}Fence <small>${badge('coin')}${this.price(FENCE_PRICE)}</small></div><div class="hm-fchips">${chips}</div></div></div>`;
  }

  // House extras: price chips until bought, then on/off toggles
  extrasCard() {
    const { HOUSE_EXTRAS } = this.d, ex = this.mode.home.extras;
    const chips = Object.entries(HOUSE_EXTRAS).map(([id, t]) => {
      const owned = id in ex;
      return `<button class="hm-mini ${ex[id] ? 'ok' : ''}" data-extra="${id}" title="${esc(t.desc)} (+${t.comfort} comfort)">${esc(t.name)}${owned ? '' : ` <small>${badge('coin')}${this.price(t.price)}</small>`}</button>`;
    }).join('');
    return `<div class="card hm-card hm-paint hm-fence hm-extras"><div class="hm-txt"><div class="c-name">${icon('star')}House extras <small class="hm-long">tap one you own to show or hide it</small></div><div class="hm-fchips">${chips}</div></div></div>`;
  }

  helperCards() {
    const { HOME_STAFF } = this.d, h = this.mode.home;
    return Object.entries(HOME_STAFF).map(([id, t]) => {
      const on = h.staff.includes(id);
      const meta = `${on ? `<span class="hm-tag on">${icon('check')}Hired</span>` : ''}<b>${badge('coin')}${this.price(t.wage)}</b><span>a day</span>`;
      return this.card(`data-helper="${id}"`, `helper:${id}`, t.name, t.desc, `<div class="c-perk hm-plain">${esc(t.desc)}</div><div class="c-meta">${meta}</div>`, on ? 'owned selected' : '');
    }).join('');
  }

  // Swatch card: repaint the house (two rows) or your ride (one row)
  paintCard(kind) {
    const { PAINT, CARS } = this.d, h = this.mode.home;
    const row = (label, list, cur, attr) => `<div class="hm-swrow"><span>${label}</span>${[null, ...list].map((c) => `<button class="hm-sw ${(cur ?? null) === c ? 'on' : ''} ${c ? '' : 'none'}" ${attr}="${c ?? ''}" ${c ? `style="background:${c}"` : ''} title="${c ? 'Paint' : 'Original colour'}">${c ? '' : icon('x')}</button>`).join('')}</div>`;
    if (kind === 'house') {
      const [a, b] = PAINT_PARTS[h.tier];
      return `<div class="card hm-card hm-paint"><div class="hm-txt"><div class="c-name">${icon('brush')}Paint the house <small>${badge('coin')}${this.price(PAINT.house)} a coat</small></div>
        ${row(a, PAINT.wall, h.paint.wall, 'data-paint-wall')}${row(b, PAINT.roof, h.paint.roof, 'data-paint-roof')}</div></div>`;
    }
    if (!h.favCar) return '';
    return `<div class="card hm-card hm-paint"><div class="hm-txt"><div class="c-name">${icon('brush')}Paint the ${esc(CARS[h.favCar].name)} <small>${badge('coin')}${this.price(PAINT.carPrice)}</small></div>
      ${row('Body', PAINT.car, h.carPaint[h.favCar], 'data-carpaint')}</div></div>`;
  }

  // Yard section chips: beside the cards, or above them on upright phones
  yardChips() {
    const { ITEM_GROUPS } = this.d, h = this.mode.home;
    const stored = Object.values(h.storage).reduce((a, b) => a + b, 0);
    if (this.group === 'storage' && !stored) this.group = 'garden';
    return `<div class="hm-grps">${[...ITEM_GROUPS, ['storage', 'Storage']].map(([id, n]) => `<button class="hm-grp ${this.group === id ? 'on' : ''}" data-grp="${id}">${id === 'storage' ? `${icon('crate')}${n}<i>${stored}</i>` : n}</button>`).join('')}</div>`;
  }

  // Yard: the shop for one section, or the storage shelf
  yardCards() {
    const { HOME_ITEMS } = this.d, h = this.mode.home, cash = this.mode.game.state.cash;
    const placed = (id) => h.items.filter((it) => it.id === id).length;
    let cards;
    if (this.group === 'storage') {
      cards = Object.entries(h.storage).map(([id, n]) => {
        const t = HOME_ITEMS[id];
        const back = this.price(Math.round(t.price * this.d.sellBack));
        return `<div class="card hm-card hm-stored" title="${esc(t.desc)}"><img src="${this.mode.thumb(`item:${id}`)}" data-thumb="item:${id}" alt="">
          <div class="hm-txt"><div class="c-name">${esc(t.name)}${n > 1 ? ` <small>×${n}</small>` : ''}</div>
          <div class="hm-sbtns"><button class="hm-mini ok" data-stored="${id}">${icon('hand')}Place</button><button class="hm-mini" data-sellstored="${id}" title="Sell one for ${back}">${badge('coin')}${back}</button></div></div></div>`;
      }).join('');
    } else {
      cards = Object.entries(HOME_ITEMS).filter(([, t]) => t.group === this.group).map(([id, t]) => {
        const n = placed(id), s = h.storage[id] || 0;
        let meta = s ? `<span class="hm-tag on">${icon('crate')}${s} stored</span>` : `<b>${badge('coin')}${this.price(t.price)}</b>`;
        meta += `<span class="hm-cf" title="Comfort">${icon('heart')}${t.comfort}</span>`;
        if (n) meta += `<span>×${n}</span>`;
        const size = `<span class="hm-size">${t.size[0]}×${t.size[1]}</span>`;
        return this.card(`data-item="${id}"`, `item:${id}`, t.name, t.desc, `${this.perkTag(t.perk, n > 0, t.pet ? 'Pets love it' : t.light ? 'Lights up at night' : `Comfort +${t.comfort}`)}<div class="c-meta">${meta}</div>`, `${n ? 'owned' : ''} ${!s && cash < t.price ? 'poor' : ''}`, size);
      }).join('');
    }
    return cards;
  }

  // The toolbar shown in place of the cards while placing or editing a yard piece
  toolsView() {
    const m = this.mode, P0 = m.placing, it = P0 ? null : m.sel, { HOME_ITEMS } = this.d;
    const id = P0 ? P0.id : it.id, t = HOME_ITEMS[id];
    const touch = m.game.input.touchMode;
    let head, btns;
    if (P0) {
      const cost = P0.from ? 'Moving' : P0.stored ? 'From storage' : `${badge('coin')}${this.price(t.price)}`;
      head = `<b>${esc(t.name)}</b><span class="hm-tmeta">${cost}</span><span class="hm-hint">${touch ? 'Tap a square to move it, tap it again to set it down' : 'Click a green square to place it. R turns it, Esc cancels'}</span>`;
      btns = `<button class="hm-tool" data-tool="rotate">${icon('rotate')}Turn</button>
        <button class="hm-tool ok" data-tool="place" ${P0.ok ? '' : 'disabled'}>${icon('check')}Place here</button>
        <button class="hm-tool" data-tool="cancel">${icon('x')}Cancel</button>`;
    } else {
      const back = this.price(Math.round(t.price * this.d.sellBack));
      head = `<b>${esc(t.name)}</b><span class="hm-tmeta">${icon('heart')}Comfort ${t.comfort}${t.perk ? ` · ${esc(this.d.perkText(t.perk))}` : ''}</span><span class="hm-hint">${touch ? 'Turn, move, store or sell it' : 'R turns it, M moves it, Esc closes'}</span>`;
      btns = `<button class="hm-tool" data-tool="turn">${icon('rotate')}Turn</button>
        <button class="hm-tool" data-tool="move">${icon('hand')}Move</button>
        <button class="hm-tool" data-tool="store">${icon('crate')}Store</button>
        <button class="hm-tool bad" data-tool="sell">${icon('trash')}Sell ${badge('coin')}${back}</button>
        <button class="hm-tool" data-tool="done">${icon('check')}Done</button>`;
    }
    return `<div class="hm-tools"><img src="${m.thumb(`item:${id}`)}" data-thumb="item:${id}" alt=""><div class="hm-thead">${head}</div><div class="hm-tbtns">${btns}</div></div>`;
  }

  // Cheap refresh while the piece moves: only the Place button's state changes
  renderTools() {
    const b = this.el?.querySelector('[data-tool="place"]');
    if (b) b.disabled = !this.mode.placing?.ok;
  }

  // Your pets (happiness and treats), then the adoption cards
  petCards() {
    const { PETS, PET_LIMITS, PET_CARE } = this.d, h = this.mode.home, cash = this.mode.game.state.cash;
    const mine = h.pets.map((id, i) => {
      const c = h.care[i], joy = Math.round(c.joy), happy = joy >= PET_CARE.happy;
      const tip = `${c.name} the ${PETS[id].name}: happiness ${joy}%. ${happy ? 'Happy pets help the restaurant.' : 'Sad pets give no bonus.'}`;
      return `<div class="card hm-card hm-mypet ${happy ? '' : 'sad'}" title="${esc(tip)}"><img src="${this.mode.thumb(`pet:${id}`)}" data-thumb="pet:${id}" alt="">
        <div class="hm-txt"><div class="c-name">${esc(c.name)} <small>${esc(PETS[id].name)}</small></div>
        <div class="hm-joy"><span style="width:${joy}%"></span></div>
        <div class="hm-sbtns"><span class="hm-mood">${icon(happy ? 'heart' : 'sad')}${happy ? `${joy}%` : 'Misses you'}</span><button class="hm-mini ok" data-treat="${i}" title="A tasty treat: +${PET_CARE.treatJoy}% happiness">${icon('bone')}${badge('coin')}${PET_CARE.treat}</button></div></div></div>`;
    }).join('');
    const shop = Object.entries(PETS).map(([id, t]) => {
      const n = h.pets.filter((p) => p === id).length;
      const max = n >= PET_LIMITS.same || h.pets.length >= PET_LIMITS.total;
      const meta = max ? `<span class="hm-tag on">${icon('check')}${n ? `${n} at home` : 'Yard full'}</span>` : `<b>${badge('coin')}${this.price(t.price)}</b>${n ? `<span>×${n}</span>` : ''}`;
      const corner = t.lux ? `<span class="hm-lux" title="Luxury">${icon('crown')}</span>` : '';
      return this.card(`data-pet="${id}"`, `pet:${id}`, t.name, t.desc, `${this.perkTag(t.perk, n > 0)}<div class="c-meta">${meta}</div>`, `${n ? 'owned' : ''} ${!max && cash < t.price ? 'poor' : ''}`, corner);
    }).join('');
    return mine ? `<div class="hm-label">Yours</div>${mine}<div class="hm-label">Adopt</div>${shop}` : shop;
  }

  carCards() {
    const { CARS } = this.d, h = this.mode.home, cash = this.mode.game.state.cash;
    return this.paintCard('car') + Object.entries(CARS).map(([id, t]) => {
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
      if (!h.pets.length) return `Adopt a pet. ${PET_BONUS.count} happy pets earn the pet lover bonus <b>${esc(perkText(PET_BONUS.perk))}</b>.`;
      const happy = h.pets.length - this.d.sadPets(h);
      return `<b>${happy}</b> of ${h.pets.length} pets happy${happy >= PET_BONUS.count ? `, pet lover bonus <b>${esc(perkText(PET_BONUS.perk))}</b>` : ''}. Tap pets in the yard for a pat, or give a treat. Max ${PET_LIMITS.total}.`;
    }
    if (this.tab === 'garage') return 'Tap a car you own to drive it: your ride takes the turntable. Luxury cars bring <b>more guests</b>.';
    if (this.tab === 'yard') {
      const { COMFORT_LEVELS, homeComfort, comfortLevel } = this.d, c = homeComfort(h), lv = comfortLevel(c), next = COMFORT_LEVELS[lv + 1];
      return `Comfort <b>${c}</b>, ${COMFORT_LEVELS[lv].name}${lv ? ` (+${lv}% tips and patience)` : ''}.${next ? ` ${next.name} at ${next.at}.` : ''} On this tab, tap furniture to edit it.`;
    }
    return 'Tap furniture to use it. A nap or a soak leaves you <b>well rested</b> for tomorrow.';
  }

  render() {
    if (!this.el) return;
    const d = this.d, h = this.mode.home;
    const T = d.HOME_TIERS[d.TIER_IDS[h.tier]];
    const day = this.mode.game.state.day;
    const perks = d.homePerks(h, day);
    const perkLine = Object.keys(perks).length ? d.perkText(perks) : 'none yet';
    const comfort = d.homeComfort(h);
    const sad = d.sadPets(h);
    this.top.innerHTML = `<span class="hm-ic">${icon('home')}</span><div class="hm-tt"><div><b>${esc(T.name)}</b><small>${icon('heart')}${comfort}<i></i>${icon('paw')}${h.pets.length}${sad ? `<em class="hm-sad">${icon('sad')}${sad}</em>` : ''}<i></i>${icon('car')}${h.cars.length}${d.isRested(h, day) ? `<em class="hm-rest">${icon('zzz')}Rested</em>` : ''}</small></div>
      <span class="hm-perks">Restaurant bonus: <em>${esc(perkLine)}</em></span></div>`;
    const tools = !!(this.mode.placing || this.mode.sel);
    const row = this.el.querySelector('.hm-row');
    const view = tools ? 'tools' : `${this.tab}:${this.tab === 'yard' ? this.group : ''}`;
    const keep = this._view === view && row ? row.scrollLeft : 0;
    this._view = view;
    const chips = !tools && this.tab === 'yard' ? this.yardChips() : '';
    const cards = tools ? this.toolsView() : this.tab === 'pets' ? this.petCards() : this.tab === 'garage' ? this.carCards() : this.tab === 'yard' ? this.yardCards() : this.houseCards();
    this.el.innerHTML = `
      <div class="dock-top">
        <div class="dock-tabs">${TABS.map(([id, ic, n]) => `<button class="tab ${this.tab === id ? 'on' : ''}" data-tab="${id}" title="${n}">${icon(ic)}<span class="hm-tl">${n}</span></button>`).join('')}</div>
        <div class="dock-info hm-note">${this.note()}</div>
        <button class="tab collapse" data-act="collapse" title="Show or hide the panel">${this.collapsed ? 'Show' : 'Hide'}</button>
        <button class="big-btn primary open-btn hm-back" data-act="back">${icon('exit')}<span class="hm-long">Back to the restaurant</span><span class="hm-short">Back</span></button>
      </div>
      <div class="hm-body ${this.collapsed && !tools ? 'hidden' : ''}">${chips}<div class="hm-row ${tools ? 'hm-trow' : ''}">${cards}</div></div>`;
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
      if (m.placing) m.cancelPlacing(true);
      m.sel = null;
      if (m.overlay) m.overlay.visible = false;
      this.tab = b.dataset.tab;
      this.render();
      return;
    }
    if (b.dataset.grp) {
      audio.click?.();
      this.group = b.dataset.grp;
      this.render();
      return;
    }
    if (b.dataset.tool) {
      const t = b.dataset.tool;
      if (t === 'rotate') m.rotatePlacing();
      else if (t === 'place') m.commitPlacing();
      else if (t === 'cancel') m.cancelPlacing();
      else if (t === 'turn' && m.sel) m.rotateItem(m.sel);
      else if (t === 'move' && m.sel) m.startPlacing(m.sel.id, { from: m.sel });
      else if (t === 'store' && m.sel) m.storeItem(m.sel);
      else if (t === 'sell' && m.sel) m.sellItem(m.sel);
      else if (t === 'done') m.select(null);
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
    else if (b.dataset.item) m.itemCard(b.dataset.item);
    else if (b.dataset.treat !== undefined) m.treatPet(+b.dataset.treat);
    else if (b.dataset.helper) m.toggleHelper(b.dataset.helper);
    else if (b.dataset.fence !== undefined) m.setFence(b.dataset.fence || null);
    else if (b.dataset.extra) m.setExtra(b.dataset.extra);
    else if (b.dataset.paintWall !== undefined) m.paintHouse('wall', b.dataset.paintWall || null);
    else if (b.dataset.paintRoof !== undefined) m.paintHouse('roof', b.dataset.paintRoof || null);
    else if (b.dataset.carpaint !== undefined) m.paintCar(b.dataset.carpaint || null);
    else if (b.dataset.stored) m.startPlacing(b.dataset.stored, { stored: true });
    else if (b.dataset.sellstored) m.sellStored(b.dataset.sellstored);
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
