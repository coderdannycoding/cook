// Pandemonium Bistro — game bootstrap, phase machine (title → day → summary → night),
// economy, ratings and the main loop that wires every module together.

import * as THREE from 'three';
import { DAY, FLOOR_LEVELS, ECON, CAMERA } from './config.js';
import { EventBus, clamp, formatMoney } from './utils.js';
import { AudioEngine } from './audio.js';
import { Renderer, ThumbnailBaker } from './renderer.js';
import { Particles } from './particles.js';
import { Input } from './input.js';
import { Grid } from './grid.js';
import { FireSystem } from './stations.js';
import { Interactions } from './interactions.js';
import { OrderManager } from './orders.js';
import { CustomerManager } from './customers.js';
import { StaffManager } from './staff.js';
import { BuildMode } from './build.js';
import { UI } from './ui.js';
import { Tutorial } from './tutorial.js';
import { Player } from './entities.js';
import { newGameState, saveGame, loadGame, loadSettings, saveSettings } from './state.js';
import {
  DISHES, CUISINES, CUISINE_ORDER, INGREDIENTS, COOKER_INFO, dishRequirements, allThumbKeys, itemFromKey,
} from './recipes.js';
import { CATALOG, UPGRADES, FLOOR_THEMES, WALL_THEMES, PLAYER_SPAWN, STARTER_LAYOUT } from './catalog.js';
import { buildItem, buildDishPreview, buildAppliance } from './models.js';
import { floorTexture, wallTexture } from './textures.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function blankDay(rating) {
  return {
    served: 0, lost: 0, turnedAway: 0, revenue: 0, tips: 0, ingredients: 0, criticBonus: 0, critic: null,
    burnt: 0, fires: 0, extinguished: 0, washed: 0, wasted: 0, staffServed: 0, ratingStart: rating,
  };
}

class Game {
  constructor() {
    this.events = new EventBus();
    this.canvas = document.getElementById('game');
    this.settings = loadSettings();
    this.audio = new AudioEngine();
    this.audio.vol = { ...this.audio.vol, ...this.settings.volume };
    this.audio.muted = !!this.settings.muted;
    this.renderer = new Renderer(this.canvas);
    this.charGroup = new THREE.Group();
    this.renderer.scene.add(this.charGroup);
    this.particles = new Particles(this.renderer.scene, document.getElementById('floaters'), (x, y, z) => this.renderer.project(x, y, z));
    this.input = new Input(this.canvas);
    this.interact = new Interactions(this);
    this.grid = new Grid(this);
    this.fire = new FireSystem(this);
    this.orders = new OrderManager(this);
    this.customers = new CustomerManager(this);
    this.staff = new StaffManager(this);
    this.build = new BuildMode(this);
    this.ui = new UI(this);
    this.tutorial = new Tutorial(this);

    this.state = null;
    this.phase = 'boot';
    this.paused = false;
    this.pauseModal = null;
    this.clock = DAY.openHour;
    this.time = 0;
    this.today = blankDay(1);
    this.ambience = 0;
    this._ambVer = -1;
    this.menuVer = 0;
    this._dishCache = { key: '', list: [] };
    this.player = null;
    this.userZoom = 1;
    this.camPan = new THREE.Vector3();
    this.countdownT = 0;
    this.closingAnnounced = false;
    this.last = performance.now();

    window.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === 'day' && !this.paused) this.togglePause(true);
    });
    // Unlock audio on any first gesture
    const unlock = () => { this.audio.init(); this.audio.setMuted(this.audio.muted); };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
  }

  // ======================================================================= boot
  async boot() {
    this.ui.setLoading(0.05, 'Firing up the stoves…');
    await nextFrame();
    await this.bakeThumbnails();
    this.ui.setLoading(1, 'Ready!');
    // Title backdrop: the saved restaurant (or the starter one)
    const save = loadGame();
    this.state = save || newGameState();
    this.applyState(true);
    this.phase = 'title';
    this.renderer.setTimeOfDay(21.5);
    this.ui.showHUD(false);
    this.ui.showTitle();
    this.ui.hideLoading();
    this.loop();
  }

  async bakeThumbnails() {
    const baker = new ThumbnailBaker(128);
    const jobs = [];
    for (const id of Object.keys(DISHES)) jobs.push([`dish:${id}`, () => buildDishPreview(id), { elevation: 0.85, pad: 1.05 }]);
    for (const key of allThumbKeys()) jobs.push([`item:${key}`, () => buildItem(itemFromKey(key)), { elevation: 0.8, pad: 1.1 }]);
    for (const def of Object.values(CATALOG)) jobs.push([`cat:${def.id}`, () => buildAppliance(def), { elevation: 0.6, pad: 1.04 }]);
    for (let i = 0; i < jobs.length; i++) {
      const [key, make, opts] = jobs[i];
      try {
        this.ui.thumbs[key] = baker.bake(make(), opts);
      } catch (e) {
        console.warn('thumbnail failed', key, e);
      }
      if (i % 6 === 0) {
        this.ui.setLoading(0.1 + (i / jobs.length) * 0.85, 'Plating the menu…');
        await nextFrame();
      }
    }
    for (const id of Object.keys(FLOOR_THEMES)) this.ui.thumbs[`floor:${id}`] = floorTexture(id).image.toDataURL('image/jpeg', 0.8);
    for (const id of Object.keys(WALL_THEMES)) this.ui.thumbs[`wall:${id}`] = wallTexture(id).image.toDataURL('image/jpeg', 0.8);
    baker.dispose();
  }

  // ======================================================================= state
  peekSave() { return loadGame(); }

  save() {
    if (!this.state || this.phase === 'day' || this.phase === 'title' || this.phase === 'boot') return;
    this.state.objects = this.grid.serialize();
    saveGame(this.state);
  }

  saveSettings() { saveSettings(this.settings); }

  setMuted(m) {
    this.audio.setMuted(m);
    this.settings.muted = m;
    this.saveSettings();
  }

  get floorSize() { return FLOOR_LEVELS[this.state.upgrades.floor] || FLOOR_LEVELS[0]; }

  applyState(silent = false) {
    const s = this.state;
    const { w, h } = this.floorSize;
    this.customers.clear(false);
    this.orders.clear();
    this.grid.clear();
    this.grid.setSize(w, h);
    this.renderer.buildRoom(w, h, this.grid.doorX, s.floorTheme, s.wallTheme, s.name);
    const objs = Array.isArray(s.objects) && s.objects.length ? s.objects : STARTER_LAYOUT;
    const hardFail = new Set(['Out of bounds', 'Space occupied', 'Keep the doorway clear']);
    for (const o of objs) {
      if (!CATALOG[o.type]) continue;
      // Skip anything that physically no longer fits (corrupt save safety); access issues are tolerated.
      const check = this.grid.canPlace(CATALOG[o.type], o.x, o.z, o.rot || 0);
      if (!check.ok && hardFail.has(check.reason)) continue;
      this.grid.place(o.type, o.x, o.z, o.rot || 0, { silent: true });
    }
    this.staff.load();
    this.spawnPlayer();
    this.updateAmbience(true);
    this.renderer.setCameraTarget(w / 2, h / 2);
    this.renderer.setView(this.renderer.fitViewForRoom(w, h, 1.0));
    if (silent) this.renderer.snapCamera();
  }

  spawnPlayer() {
    if (this.player) this.player.dispose();
    this.player = new Player(this, this.settings.color || '#e74c3c');
    const spot = this.freeTileNear(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
    if (spot) this.player.setPos(spot.x + 0.5, spot.z + 0.5);
    this.player.targetFacing = this.player.facing = Math.PI * 0.75;
  }

  recolorPlayer(color) {
    if (!this.player) return;
    const p = this.player.pos.clone();
    this.spawnPlayer();
    this.player.setPos(p.x, p.z);
    this.player.cheer = 1;
  }

  // Walkable tile reachable from the door, nearest to (x, z)
  freeTileNear(x, z, exclude = []) {
    const grid = this.grid;
    const reach = grid.reachable();
    const door = grid.doorTile;
    let best = null, bd = Infinity;
    for (let tz = 0; tz < grid.H; tz++) {
      for (let tx = 0; tx < grid.W; tx++) {
        if (!reach[grid.idx(tx, tz)]) continue;
        if (tx === door.x && tz === door.z) continue;
        if (exclude.some((e) => e.x === tx && e.z === tz)) continue;
        const d = Math.hypot(tx + 0.5 - x, tz + 0.5 - z);
        if (d < bd) { bd = d; best = { x: tx, z: tz }; }
      }
    }
    return best;
  }

  allWorkers() { return this.player ? [this.player, ...this.staff.members] : [...this.staff.members]; }

  // ======================================================================= economy
  upg(id) {
    const U = UPGRADES[id];
    const lvl = this.state?.upgrades?.[id] || 0;
    return lvl ? U.levels[lvl - 1].value : U.base;
  }

  rent() { return ECON.rentBase + ECON.rentPerLevel * this.state.upgrades.floor; }

  spend(amount) {
    if (this.state.cash < amount) return false;
    this.state.cash -= amount;
    this.ui.flashCash(false);
    return true;
  }

  addCash(amount, x, y, z) {
    if (amount <= 0) return;
    this.state.cash += amount;
    this.state.stats.totalEarned += amount;
    if (x !== undefined) {
      this.particles.cashText(x, y, z, amount);
      this.particles.coinsBurst(x, y - 0.3, z, Math.min(8, 2 + Math.floor(amount / 15)));
    }
    this.audio.cash();
    this.ui.flashCash(true);
  }

  collectCash(amount, pos) {
    this.addCash(amount, pos.x, pos.y + 0.6, pos.z);
    this.events.emit('cash', amount);
  }

  chargeIngredient(cost, pos) {
    this.state.cash -= cost;
    this.today.ingredients += cost;
    if (pos && Math.random() < 0.6) this.particles.costText(pos.x, pos.y + 0.4, pos.z, cost);
  }

  refundIngredient(cost) {
    this.state.cash += cost;
    this.today.ingredients -= cost;
  }

  applyReview(score, weight) {
    const s = this.state;
    const before = s.rating;
    s.rating = clamp(s.rating + (score - s.rating) * weight, 1, 5);
    if (Math.abs(s.rating - before) > 0.005) this.ui.pulseStars();
    for (const id of CUISINE_ORDER) {
      const C = CUISINES[id];
      if (!s.cuisines[id] && before < C.stars && s.rating >= C.stars) {
        this.ui.toast(`⭐ ${C.stars.toFixed(1)} stars! ${C.icon} ${C.name} can be unlocked tonight!`, 'gold');
        this.audio.fanfare();
        this.particles.confetti(this.player.pos.x, 2, this.player.pos.z, 40);
      }
    }
  }

  // Missing requirements for a dish given the current layout
  missingFor(dishId) {
    const req = dishRequirements(dishId);
    const miss = [];
    const crates = new Set(this.grid.stations('crate').map((s) => s.ing));
    for (const ing of req.ings) if (!crates.has(ing)) miss.push(`${INGREDIENTS[ing].name} Crate`);
    if (req.chop && !this.grid.stations('board').length) miss.push('Cutting Board');
    const cookers = new Set(this.grid.stations('cooker').map((s) => s.cookType));
    for (const c of req.cookers) if (!cookers.has(c)) miss.push(COOKER_INFO[c].name);
    return miss;
  }

  availableDishes() {
    const s = this.state;
    const key = `${this.grid.version}:${this.menuVer}`;
    if (this._dishCache.key === key) return this._dishCache.list;
    const list = [];
    for (const cid of CUISINE_ORDER) {
      if (!s.cuisines[cid]) continue;
      for (const did of CUISINES[cid].dishes) {
        if (s.menuOff[did]) continue;
        if (this.missingFor(did).length) continue;
        list.push(did);
      }
    }
    this._dishCache = { key, list };
    return list;
  }

  updateAmbience(force = false) {
    if (!force && this._ambVer === this.grid.version) return;
    this._ambVer = this.grid.version;
    const s = this.state;
    let total = (FLOOR_THEMES[s.floorTheme]?.decor || 0) + (WALL_THEMES[s.wallTheme]?.decor || 0);
    for (const o of this.grid.objects) total += o.def.decor || 0;
    const area = this.grid.W * this.grid.H;
    this.ambience = clamp(1 - Math.exp(-total / (area * 0.3)), 0, 1);
  }

  onLayoutChanged() {
    this.updateAmbience(true);
    this.save();
  }

  buyUpgrade(id) {
    const s = this.state;
    const U = UPGRADES[id];
    const lvl = s.upgrades[id] || 0;
    const next = U.levels[lvl];
    if (!next) return;
    if (!this.spend(next.price)) { this.ui.toast('Not enough cash!', 'warn'); this.audio.error(); return; }
    s.upgrades[id] = lvl + 1;
    this.audio.levelUp();
    this.particles.confetti(this.player.pos.x, 1.8, this.player.pos.z, 26);
    if (id === 'floor') this.expandFloor();
    else this.ui.toast(`${U.icon} ${U.name} → ${U.fmt(next.value)}`, 'good');
    this.save();
  }

  expandFloor() {
    const { w, h } = this.floorSize;
    this.grid.setSize(w, h);
    this.renderer.buildRoom(w, h, this.grid.doorX, this.state.floorTheme, this.state.wallTheme, this.state.name);
    this.updateAmbience(true);
    this.renderer.addShake(0.3);
    this.audio.thud();
    this.ui.toast(`🏗️ The walls come down! Your floor is now ${w} × ${h}.`, 'gold');
  }

  buyTheme(spec) {
    const [kind, id] = spec.split(':');
    const s = this.state;
    const T = kind === 'floor' ? FLOOR_THEMES[id] : WALL_THEMES[id];
    if (!s.ownedThemes.includes(spec)) {
      if (!this.spend(T.price)) { this.ui.toast('Not enough cash!', 'warn'); this.audio.error(); return; }
      s.ownedThemes.push(spec);
      this.audio.levelUp();
    } else this.audio.click();
    if (kind === 'floor') s.floorTheme = id;
    else s.wallTheme = id;
    const { w, h } = this.floorSize;
    this.renderer.buildRoom(w, h, this.grid.doorX, s.floorTheme, s.wallTheme, s.name);
    this.updateAmbience(true);
    this.save();
  }

  buyCuisine(id) {
    const s = this.state;
    const C = CUISINES[id];
    if (s.cuisines[id]) return;
    if (s.rating < C.stars) { this.ui.toast(`Requires ${C.stars.toFixed(1)}★`, 'warn'); this.audio.error(); return; }
    if (!this.spend(C.price)) { this.ui.toast('Not enough cash!', 'warn'); this.audio.error(); return; }
    s.cuisines[id] = true;
    this.menuVer++;
    this.audio.fanfare();
    this.particles.confetti(this.player.pos.x, 2, this.player.pos.z, 50);
    const need = new Set();
    for (const d of C.dishes) for (const m of this.missingFor(d)) need.add(m);
    this.ui.toast(`🎉 ${C.icon} ${C.name} unlocked!${need.size ? ` You'll need: ${[...need].join(', ')}` : ''}`, 'gold');
    this.save();
  }

  toggleDish(id, on) {
    this.state.menuOff[id] = !on;
    if (on) delete this.state.menuOff[id];
    this.menuVer++;
    this.save();
  }

  // ======================================================================= phases
  newGame() {
    this.state = newGameState();
    this.applyState();
    this.ui.showHUD(true);
    this.startDay();
  }

  continueGame() {
    const s = loadGame();
    if (!s) { this.newGame(); return; }
    this.state = s;
    this.applyState();
    this.ui.showHUD(true);
    this.enterNight();
  }

  quitToTitle() {
    this.paused = false;
    this.pauseModal = null;
    for (const m of [...this.ui.modalStack]) this.ui.closeModal(m);
    if (this.phase === 'night') this.save();
    this.build.exit();
    this.ui.showDock(false);
    this.ui.showHUD(false);
    this.ui.setHint(null);
    this.ui.clearWorld();
    this.renderer.setPointer(null);
    this.audio.silenceLoops();
    this.audio.startMusic('night');
    const save = loadGame();
    this.state = save || newGameState();
    this.applyState();
    this.phase = 'title';
    this.ui.showTitle();
  }

  prepareKitchen() {
    // Overnight crew: clear food, wash everything, restock plates, hang extinguishers
    for (const st of this.grid.stations()) st.clearForDay();
    this.fire.clear();
    const racks = this.grid.stations('platerack');
    const plates = this.upg('plates');
    if (racks.length) {
      for (let i = 0; i < plates; i++) racks[i % racks.length].count++;
    } else {
      const sinks = this.grid.stations('sink');
      if (sinks.length) sinks[0].clean = plates;
    }
    const tables = this.grid.stations('table').sort((a, b) => a.obj.z - b.obj.z || a.obj.x - b.obj.x);
    tables.forEach((t, i) => { t.number = i + 1; });
    for (const ch of this.allWorkers()) ch.held = null;
  }

  openRestaurant() {
    const g = this.grid;
    if (!g.stations('table').length) { this.ui.toast('⚠️ You need at least one table!', 'danger'); this.audio.error(); return; }
    if (!g.stations('platerack').length && !g.stations('sink').length) { this.ui.toast('⚠️ You need a Plate Rack to store plates!', 'danger'); this.audio.error(); return; }
    if (!this.availableDishes().length) { this.ui.toast('⚠️ Nothing on the menu can be cooked — check crates & stations in the Menu tab.', 'danger'); this.audio.error(); return; }
    if (!g.stations('sink').length && !g.stations('autowasher').length) this.ui.toast('Heads up: no sink — you won\'t be able to wash plates!', 'warn');
    if (!g.stations('extinguisher').length && !this.upg('fireproof')) this.ui.toast('Heads up: no extinguisher stand — fires will be hard to stop!', 'warn');
    this.save();
    this.startDay();
  }

  startDay() {
    this.audio.init();
    this.build.exit();
    this.ui.showDock(false);
    this.ui.showHUD(true);
    this.prepareKitchen();
    this.orders.clear();
    this.customers.startDay();
    this.staff.startDay();
    const spot = this.freeTileNear(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
    if (spot) this.player.setPos(spot.x + 0.5, spot.z + 0.5);
    this.player.held = null;
    this.player.dashCD = 0;
    this.today = blankDay(this.state.rating);
    this.clock = DAY.openHour - 0.25;
    this.closingAnnounced = false;
    this.camPan.set(0, 0, 0);
    this.phase = 'countdown';
    this.countdownT = 0;
    this.countStep = -1;
    this.renderer.openSignOn = false;
    this.audio.startMusic('day');
    this.ui.banner(`Day ${this.state.day}`, this.state.day === 1 ? 'Grand opening!' : `${this.state.rating.toFixed(1)}★ · ${formatMoney(this.state.cash)}`);
    if (this.state.day === 1) this.tutorial.start();
  }

  endDay() {
    const s = this.state;
    this.phase = 'summary';
    this.player.held = null;
    for (const t of this.grid.stations('table')) {
      if (t.cash > 0) { s.cash += t.cash; t.cash = 0; }
    }
    this.customers.clear(true);
    this.orders.clear();
    this.staff.endDay();
    this.audio.silenceLoops();
    this.renderer.openSignOn = false;
    this.ui.setHint(null);
    this.renderer.setPointer(null);
    const wages = this.staff.totalWages();
    const rent = this.rent();
    s.cash -= wages + rent;
    const t = this.today;
    const net = t.revenue + t.tips + t.criticBonus - t.ingredients - wages - rent;
    const before = t.ratingStart;
    const newCuisines = CUISINE_ORDER.filter((id) => !s.cuisines[id] && before < CUISINES[id].stars && s.rating >= CUISINES[id].stars);
    const rep = {
      day: s.day, served: t.served, lost: t.lost, turnedAway: t.turnedAway, burnt: t.burnt, fires: t.fires,
      revenue: t.revenue, tips: t.tips, criticBonus: t.criticBonus, ingredients: t.ingredients, wages, rent, net,
      ratingBefore: before, ratingAfter: s.rating, critic: t.critic, newCuisines,
    };
    s.stats.totalServed += t.served;
    s.stats.daysPlayed++;
    s.stats.bestDay = Math.max(s.stats.bestDay, net);
    s.day++;
    if (this.tutorial.active) this.tutorial.finish();
    this.audio.startMusic('night');
    this.audio.doorClose();
    this.ui.showSummary(rep, () => this.enterNight());
    this.save();
  }

  enterNight() {
    this.phase = 'night';
    for (const st of this.grid.stations()) st.clearForDay();
    this.fire.clear();
    this.player.held = null;
    this.player.vel.set(0, 0, 0);
    this.player.cheer = 1.2;
    this.camPan.set(0, 0, 0);
    this.renderer.hideHighlight();
    this.build.enter();
    this.ui.showDock(true);
    this.audio.startMusic('night');
    this.save();
  }

  togglePause(force) {
    if (this.phase === 'title' || this.phase === 'summary' || this.phase === 'boot') return;
    const want = force === undefined ? !this.paused : force;
    if (want === this.paused) return;
    this.paused = want;
    if (want) {
      this.pauseModal = this.ui.showPause();
      this.audio.silenceLoops();
    } else {
      if (this.pauseModal) this.ui.closeModal(this.pauseModal);
      this.pauseModal = null;
    }
  }

  // ======================================================================= loop
  loop() {
    const tick = (now) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
    };
    requestAnimationFrame(tick);
  }

  frame(dt) {
    const input = this.input;
    input.pollGamepad();
    if (input.pausePressed && this.phase !== 'title') {
      if (this.phase === 'night' && (this.build.selectedType || this.build.moving)) {
        // build mode consumes Escape
      } else if (this.ui.modalOpen && !this.paused) {
        this.ui.closeModal();
      } else this.togglePause();
    }
    if (!this.paused) {
      this.time += dt;
      this.update(dt);
      this.particles.update(dt);
    }
    this.renderer.update(this.paused ? 0 : dt);
    this.particles.setScale(this.renderer.particleScale);
    this.ui.updateHUD(dt);
    this.ui.updateTickets();
    this.ui.updateWorld();
    this.ui.updatePrompt();
    this.audio.update();
    this.renderer.render();
    input.endFrame();
  }

  update(dt) {
    const r = this.renderer;
    const W = this.grid.W, H = this.grid.H;
    const input = this.input;
    if (input.wheel) this.userZoom = clamp(this.userZoom * (input.wheel > 0 ? 1.08 : 1 / 1.08), 0.65, 1.45);

    switch (this.phase) {
      case 'title': {
        r.targetYaw = CAMERA.yaw + Math.sin(this.time * 0.12) * 0.42;
        r.setCameraTarget(W / 2, H / 2);
        r.setView(r.fitViewForRoom(W, H, 1.05));
        r.setTimeOfDay(19.6 + Math.sin(this.time * 0.07) * 1.9, dt);
        this.grid.update(dt, this.time);
        this.requestAmbientLights(false);
        this.player.updateVisual(dt);
        this.staff.update(dt, false);
        for (const m of this.staff.members) m.updateVisual(dt);
        this.customers.update(dt);
        break;
      }
      case 'countdown': {
        this.countdownT += dt;
        const step = Math.floor(this.countdownT / 0.85);
        if (step !== this.countStep) {
          this.countStep = step;
          if (step >= 1 && step <= 3) { this.ui.countdown(String(4 - step)); this.audio.countdown(false); }
          if (step === 4) {
            this.ui.countdown('OPEN!', true);
            this.audio.countdown(true);
            this.audio.bell();
            this.phase = 'day';
            this.clock = DAY.openHour;
            this.renderer.openSignOn = true;
            this.particles.confetti(this.player.pos.x, 2, this.player.pos.z, 30);
          }
        }
        this.simulate(dt, false);
        break;
      }
      case 'day': {
        this.clock += dt * ((DAY.closeHour - DAY.openHour) / DAY.length);
        if (this.clock >= DAY.closeHour && !this.closingAnnounced) {
          this.closingAnnounced = true;
          this.renderer.openSignOn = false;
          this.audio.doorClose();
          this.ui.toast('🔔 Closing time! Finish serving the guests still inside.', 'info');
        }
        this.simulate(dt, true);
        if (this.clock >= DAY.closeHour && this.customers.isEmpty()) this.endDay();
        break;
      }
      case 'night':
      case 'summary': {
        r.targetYaw = CAMERA.yaw;
        if (this.phase === 'night' && !this.ui.modalOpen) {
          const mv = input.moveVector();
          const yaw = r.yaw;
          const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
          this.camPan.x = clamp(this.camPan.x + (rx * mv.x + fx * mv.y) * dt * 8, -W / 2, W / 2);
          this.camPan.z = clamp(this.camPan.z + (rz * mv.x + fz * mv.y) * dt * 8, -H / 2, H / 2);
          this.build.update(dt);
        }
        // Keep the restaurant centred in the space above the night dock
        const frac = this.phase === 'night' ? this.ui.dockFraction() : 0;
        const view = (r.fitViewForRoom(W, H, 1.06) / (1 - frac * 0.8)) * this.userZoom;
        const shift = ((frac / 2) * view) / Math.sin(CAMERA.elevation);
        r.setCameraTarget(W / 2 + this.camPan.x + Math.sin(r.yaw) * shift, H / 2 + this.camPan.z + Math.cos(r.yaw) * shift);
        r.setView(view);
        r.setTimeOfDay(22.6, dt);
        this.grid.update(dt, this.time);
        this.staff.update(dt, false);
        for (const m of this.staff.members) m.updateVisual(dt);
        this.player.vel.set(0, 0, 0);
        this.player.updateVisual(dt);
        this.customers.update(dt);
        this.requestAmbientLights(true);
        break;
      }
      default:
        break;
    }
    this.tutorial.update(dt);
  }

  // Shared day simulation (countdown lets the player warm up before doors open)
  simulate(dt, open) {
    const r = this.renderer;
    const W = this.grid.W, H = this.grid.H;
    r.targetYaw = CAMERA.yaw;
    r.setTimeOfDay(this.clock, dt);
    r.setClock(this.clock);

    this.player.update(dt);
    if (open) this.customers.update(dt);
    else this.customers.updatePassers(dt);
    this.staff.update(dt, true);
    for (const st of this.grid.stations()) st.update(dt);
    this.fire.update(dt);
    this.grid.update(dt, this.time);
    this.separate(dt);
    this.player.updateVisual(dt);
    for (const m of this.staff.members) m.updateVisual(dt);
    this.updateAmbience();

    // Camera: fit the whole room when possible, otherwise follow the chef
    const fit = r.fitViewForRoom(W, H, 1.08);
    const view = Math.min(fit, CAMERA.dayView + 1) * this.userZoom;
    r.setView(view);
    const p = this.player.pos;
    if (fit <= view * 1.02) r.setCameraTarget(W / 2 + (p.x - W / 2) * 0.12, H / 2 + (p.z - H / 2) * 0.12);
    else r.setCameraTarget(W / 2 + (p.x - W / 2) * 0.75, H / 2 + (p.z - H / 2) * 0.75);

    // Ambient audio loops
    let sizzle = 0, fry = 0, boil = 0;
    for (const st of this.grid.stations('cooker')) {
      if (!st.active) continue;
      if (st.cookType === 'stove') sizzle++;
      else if (st.cookType === 'fryer') fry++;
      else if (st.cookType === 'pot') boil++;
    }
    this.audio.setLoop('sizzle', sizzle * 0.6);
    this.audio.setLoop('fry', fry * 0.6);
    this.audio.setLoop('boil', boil * 0.7);

    // Steam from hot food being carried
    for (const ch of this.allWorkers()) {
      const it = ch.held;
      if (it && it.kind === 'plate' && it.contents.some((c) => c.hot > this.time) && Math.random() < dt * 5) {
        this.particles.steam(ch.pos.x + Math.sin(ch.facing) * 0.4, 0.9, ch.pos.z + Math.cos(ch.facing) * 0.4, 0.6);
      }
    }
    this.requestAmbientLights(false);
  }

  requestAmbientLights(night) {
    const r = this.renderer;
    const lamp = Math.max(r.lampLevel, night ? 1 : 0);
    for (const o of this.grid.objects) {
      const L = o.mesh.userData.light;
      if (L) r.requestLight(o.cx, L.y, o.cz, L.color, L.intensity * (0.4 + lamp * 0.8), L.distance, 4);
      if (o.mesh.userData.heatLamp) r.requestLight(o.cx, 1.7, o.cz, '#ffb060', 1.6, 2.2, 2);
      if (lamp > 0.3 && o.def.station === 'table') r.requestLight(o.cx, 1.6, o.cz, '#ffc27a', 3.2 * lamp, 3.4, 3);
      if (o.mesh.userData.fountain && Math.random() < 0.5) this.particles.splash(o.cx, 1.38, o.cz, 1);
    }
  }

  // Soft character-vs-character separation
  separate() {
    const list = [this.player, ...this.staff.members];
    for (const c of this.customers.allCustomers()) if (!c.sitting && c.state !== 'leaving' && c.pos.z < this.grid.H) list.push(c);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = 0.5;
        if (d >= min || d < 1e-5) continue;
        const push = (min - d) / 2;
        const nx = dx / d, nz = dz / d;
        const wa = a === this.player ? 0.3 : 1, wb = b === this.player ? 0.3 : 1;
        a.pos.x -= nx * push * wa; a.pos.z -= nz * push * wa;
        b.pos.x += nx * push * wb; b.pos.z += nz * push * wb;
      }
    }
    for (const m of this.staff.members) this.grid.collide(m.pos, 0.24);
    this.grid.collide(this.player.pos, this.player.radius);
  }
}

const game = new Game();
window.__game = game;
game.boot().catch((e) => {
  console.error(e);
  const L = document.getElementById('loading');
  if (L) L.querySelector('.load-text').textContent = `Something went wrong: ${e.message}`;
});

