// Runtime behaviour for every interactive appliance: item slots, chopping, cooking & burning,
// washing, crates, plate racks, trash, extinguisher stands, conveyors, grabber arms, tables
// and the spreading fire system.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { COOK, SURFACE_Y } from './config.js';
import {
  INGREDIENTS, makeIngredient, makePlate, makeExtinguisher, chopInfo, cookRule, isCookOutput, cookerAccepts,
  matchDish, itemLabel, isHotFood,
} from './recipes.js';
import { buildItem, plateBase, mesh, box, cyl, mat } from './models.js';
import { rand, pick, clamp, DIRS8 } from './utils.js';

const _w = new THREE.Vector3();
const ITEM_SCALE = 1.3; // food reads better a little larger than life in the iso view

export class Station {
  constructor(obj, game) {
    this.obj = obj;
    this.game = game;
    this.def = obj.def;
    this.kind = obj.def.station;
    this.item = null;
    this.fire = 0;
    this.smolder = 0;
    this.spreadT = 0;
    this.reservedBy = null;
    this.punch = 0;
    this.workT = 0;
    this.view = { key: '', mesh: null };
    this.parts = obj.mesh.userData.parts || {};
    this.anchor = obj.mesh.userData.anchor || new THREE.Vector3(0, SURFACE_Y, 0);
    this.itemScale = (obj.mesh.userData.itemScale || 1) * ITEM_SCALE;
  }

  get x() { return this.obj.cx; }
  get z() { return this.obj.cz; }
  get name() { return this.def.name; }
  get flammable() { return this.def.flammable; }
  get hasSlot() { return true; }
  get topY() { return this.anchor.y; }

  canTake() { return !!this.item && this.fire <= 0; }
  take() {
    const it = this.item;
    this.item = null;
    this.changed();
    return it;
  }
  accepts() { return true; }
  canAccept(item) { return !this.item && this.fire <= 0 && this.accepts(item); }
  put(item) {
    this.item = item;
    this.changed();
  }

  canWork() { return false; }
  work() { return false; }
  workLabel() { return null; }
  progressInfo() { return null; }

  changed() { this.punch = 1; }

  worldPos(local = this.anchor) {
    _w.copy(local);
    return this.obj.mesh.localToWorld(_w.clone());
  }

  update() {}

  clearForDay() {
    this.item = null;
    this.fire = 0;
    this.smolder = 0;
    this.reservedBy = null;
  }

  syncView() {
    const it = this.item;
    const key = it ? `${it.uid}:${it.ver}` : '';
    if (key === this.view.key) return;
    if (this.view.mesh) this.obj.mesh.remove(this.view.mesh);
    this.view.mesh = null;
    this.view.key = key;
    if (it) {
      const m = buildItem(it);
      m.position.copy(this.anchor);
      m.scale.setScalar(this.itemScale);
      m.userData.pop = 0;
      this.obj.mesh.add(m);
      this.view.mesh = m;
    }
  }

  animate(dt) {
    this.syncView();
    if (this.punch > 0 && this.obj.popT >= 1) {
      const p = this.punch;
      const s = Math.sin(p * Math.PI);
      this.obj.mesh.scale.set(1 + s * 0.04, 1 - s * 0.06, 1 + s * 0.04);
      this.punch = Math.max(0, p - dt * 5);
      if (this.punch === 0) this.obj.mesh.scale.set(1, 1, 1);
    }
    const m = this.view.mesh;
    if (m && m.userData.pop < 1) {
      m.userData.pop = Math.min(1, m.userData.pop + dt * 6);
      const t = m.userData.pop;
      const s = (1 + Math.sin(t * Math.PI) * 0.25) * this.itemScale;
      m.scale.set(s, s * (1 - Math.sin(t * Math.PI) * 0.1), s);
    }
    if (this.workT > 0) this.workT -= dt;
    // Steam from hot food sitting anywhere
    if (this.item && Math.random() < dt * 4) {
      const hot = this.item.kind === 'plate' ? this.item.contents.some((c) => c.hot > this.game.time) : this.item.hot > this.game.time;
      if (hot) {
        const p = this.worldPos();
        this.game.particles.steam(p.x, p.y + 0.15, p.z, 0.6);
      }
    }
  }
}

// ---------------------------------------------------------------------------
export class CounterStation extends Station {}

export class PassStation extends Station {
  put(item) {
    super.put(item);
    if (item.kind === 'plate' && matchDish(item)) this.game.audio.ding();
  }
  animate(dt) {
    super.animate(dt);
    // Heat lamps keep plated food hot (steam)
    if (this.item && this.item.kind === 'plate') for (const c of this.item.contents) if (isHotFood(c)) c.hot = Math.max(c.hot, this.game.time + 1);
  }
}

// ---------------------------------------------------------------------------
export class BoardStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.auto = !!obj.def.auto;
    this.chopSound = 0;
  }
  accepts(item) { return item.kind === 'ing'; }
  canWork() { return !this.auto && !!chopInfo(this.item) && this.fire <= 0; }
  workLabel() {
    const c = chopInfo(this.item);
    if (!c || this.auto) return null;
    return this.item.id === 'dough' ? 'Knead' : 'Chop';
  }
  work(actor, dt) {
    if (!this.canWork()) return false;
    this._chop(dt * (actor.chopRate ?? 1));
    return true;
  }
  _chop(amount) {
    const it = this.item;
    const info = chopInfo(it);
    if (!info) return;
    it.chop += (amount * this.game.upg('knives')) / info.time;
    this.workT = 0.15;
    this.chopSound -= amount;
    const p = this.worldPos();
    if (this.chopSound <= 0) {
      this.chopSound = 0.24;
      if (it.id === 'dough') this.game.audio.knead();
      else this.game.audio.chop();
      this.game.particles.crumbs(p.x, p.y + 0.05, p.z, INGREDIENTS[it.id].color, it.id === 'dough' ? 2 : 3);
    }
    if (it.chop >= 1) {
      it.state = info.to;
      it.chop = 0;
      it.ver++;
      this.punch = 1;
      this.game.particles.crumbs(p.x, p.y + 0.08, p.z, INGREDIENTS[it.id].color, 8);
      this.game.audio.pickup();
      this.game.events.emit('chopped', { station: this, item: it });
    }
  }
  update(dt) {
    if (this.auto && this.fire <= 0 && chopInfo(this.item)) this._chop(dt * 0.65);
  }
  progressInfo() {
    if (chopInfo(this.item) && this.item.chop > 0) return { value: this.item.chop, color: '#7bd148' };
    return null;
  }
  animate(dt, t) {
    super.animate(dt, t);
    const k = this.parts.knife;
    if (k) {
      if (this.workT > 0) {
        k.position.set(0.05, SURFACE_Y + 0.08 + Math.abs(Math.sin(t * 22)) * 0.1, 0.02);
        k.rotation.z = Math.sin(t * 22) * 0.15;
      } else {
        k.position.set(0.39, SURFACE_Y + 0.02, 0.02);
        k.rotation.z = 0;
      }
    }
    if (this.parts.blade) {
      const active = this.auto && chopInfo(this.item);
      this.parts.blade.rotation.y += dt * (active ? 25 : 1.5);
      this.parts.light.material.emissiveIntensity = active ? 2 : 0.4;
    }
  }
}

// ---------------------------------------------------------------------------
export class CookerStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.cookType = obj.def.cook;
    this.active = false;
    this.warning = 0;
    this.beepT = 0;
    this.glow = 0;
  }
  accepts(item) { return cookerAccepts(this.cookType, item); }
  update(dt) {
    const g = this.game;
    const it = this.item;
    this.active = false;
    this.warning = 0;
    if (this.fire > 0) return;
    if (!it || it.kind !== 'ing') { this.smolder = 0; return; }
    const rule = cookRule(this.cookType, it);
    if (rule) {
      this.active = true;
      it.cook += (dt * g.upg('burners')) / rule.time;
      if (it.cook >= 1) {
        it.state = rule.to;
        it.cook = 0;
        it.burn = 0;
        it.hot = g.time + 30;
        it.ver++;
        this.punch = 1;
        g.audio.cookDone();
        const p = this.worldPos();
        for (let i = 0; i < 6; i++) g.particles.steam(p.x, p.y + 0.1, p.z, 1);
        g.events.emit('cooked', { station: this, item: it });
      }
    } else if (isCookOutput(this.cookType, it)) {
      this.active = true;
      it.hot = g.time + 30;
      it.burn += dt / (COOK.burnWindow * g.upg('timer'));
      this.warning = it.burn;
      if (it.burn > 0.4) {
        this.beepT -= dt;
        if (this.beepT <= 0) {
          this.beepT = it.burn > 0.75 ? 0.25 : 0.5;
          g.audio.warn();
        }
      }
      if (it.burn >= 1) {
        it.state = 'burnt';
        it.burn = 0;
        it.ver++;
        this.smolder = 0;
        g.audio.fail();
        g.today.burnt++;
        g.ui.toast(`🔥 ${this.name}: food burnt! Bin it before it ignites!`, 'warn');
        g.events.emit('burnt', { station: this });
      }
    } else if (it.state === 'burnt') {
      this.active = true;
      this.smolder += dt;
      this.warning = 1;
      if (this.smolder > COOK.igniteDelay && !g.upg('fireproof')) {
        g.fire.ignite(this);
        this.smolder = 0;
      }
    }
  }
  progressInfo() {
    const it = this.item;
    if (!it || this.fire > 0) return null;
    if (it.state === 'burnt') return { value: 1, color: '#2b211d', warn: true };
    if (this.warning > 0) return { value: this.warning, color: '#ff4d3d', warn: this.warning > 0.4 };
    if (it.cook > 0) return { value: it.cook, color: '#ffb02e' };
    return null;
  }
  animate(dt, t) {
    super.animate(dt, t);
    const g = this.game;
    this.glow += ((this.active ? 1 : 0) - this.glow) * Math.min(1, dt * 4);
    const gm = this.parts.glowMat;
    if (gm) {
      if (this.cookType === 'fryer') gm.emissiveIntensity = 0.15 + this.glow * (0.6 + Math.sin(t * 9) * 0.1);
      else if (this.cookType === 'oven') gm.emissiveIntensity = 0.3 + this.glow * (2.2 + Math.sin(t * 7) * 0.4);
      else gm.emissiveIntensity = this.glow * (2.2 + Math.sin(t * 13) * 0.3);
    }
    if (this.parts.water) this.parts.water.position.y = SURFACE_Y + 0.33 + Math.sin(t * 6) * 0.006 * (1 + this.glow * 2);
    if (this.glow > 0.05) {
      const p = this.worldPos();
      g.renderer.requestLight(p.x, p.y + 0.5, p.z, this.cookType === 'pot' ? '#ffd0a0' : '#ff9a4a', 2.5 * this.glow, 2.6, 3);
    }
    if (!this.active) return;
    const p = this.worldPos();
    const r = Math.random();
    if (this.cookType === 'stove') {
      if (r < dt * 10) g.particles.steam(p.x, p.y + 0.08, p.z, 0.6);
      if (r < dt * 6) g.particles.sparks(p.x, p.y + 0.06, p.z, 1);
    } else if (this.cookType === 'pot') {
      if (r < dt * 14) g.particles.bubbles(p.x, p.y + 0.01, p.z, 1);
      if (r < dt * 8) g.particles.steam(p.x, p.y + 0.1, p.z, 1);
    } else if (this.cookType === 'fryer') {
      if (r < dt * 16) g.particles.oilBubbles(p.x, p.y, p.z);
      if (r < dt * 4) g.particles.steam(p.x, p.y + 0.1, p.z, 0.5);
    } else if (this.cookType === 'oven') {
      if (r < dt * 3) g.particles.smoke(p.x + 0.16, SURFACE_Y + 0.9, p.z - 0.4, 0.2);
      if (r < dt * 6) g.particles.sparkle(p.x, p.y + 0.05, p.z, '#ffb060');
    }
    if (this.warning > 0.4 && Math.random() < dt * 14 * this.warning) {
      g.particles.smoke(p.x, p.y + 0.15, p.z, this.warning);
      if (Math.random() < 0.5) g.particles.sparks(p.x, p.y + 0.1, p.z, 2);
    }
  }
}

// ---------------------------------------------------------------------------
export class CrateStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.ing = obj.def.ing;
  }
  get hasSlot() { return false; }
  canTake() { return this.fire <= 0; }
  take(actor) {
    const it = makeIngredient(this.ing);
    const cost = INGREDIENTS[this.ing].cost;
    this.game.chargeIngredient(cost, this.worldPos(), actor);
    this.changed();
    return it;
  }
  accepts(item) { return item.kind === 'ing' && item.id === this.ing && item.state === 'raw' && !item.toppings; }
  canAccept(item) { return this.fire <= 0 && this.accepts(item); }
  put() {
    this.game.refundIngredient(INGREDIENTS[this.ing].cost);
    this.changed();
  }
  clearForDay() { super.clearForDay(); }
}

// ---------------------------------------------------------------------------
export class PlateRackStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.count = 0;
  }
  get hasSlot() { return false; }
  canTake() { return this.count > 0 && this.fire <= 0; }
  take() {
    this.count--;
    this.changed();
    this.game.audio.clink();
    return makePlate();
  }
  accepts(item) { return item.kind === 'plate' && !item.dirty && item.contents.length === 0; }
  canAccept(item) { return this.fire <= 0 && this.accepts(item); }
  put(item) {
    this.count += item.stack;
    this.changed();
    this.game.audio.clink();
  }
  clearForDay() { super.clearForDay(); this.count = 0; }
  syncView() {
    const key = `rack:${Math.min(this.count, 7)}`;
    if (key === this.view.key) return;
    this.view.key = key;
    const g = this.parts.plates;
    while (g.children.length) g.remove(g.children[0]);
    const n = Math.min(this.count, 7);
    for (let i = 0; i < n; i++) {
      const p = plateBase(false);
      p.rotation.x = Math.PI / 2;
      p.position.set(0, 0.3, -0.21 + i * 0.07);
      p.scale.setScalar(0.85);
      g.add(p);
    }
  }
}

// ---------------------------------------------------------------------------
function plateStack(n, dirty) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const p = plateBase(dirty);
    p.position.y = i * 0.04;
    p.rotation.y = i * 0.9;
    g.add(p);
  }
  return g;
}

export class SinkStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.dirty = 0;
    this.clean = 0;
    this.wash = 0;
    this.washSound = 0;
    this.auto = obj.def.station === 'autowasher';
    this.capacity = this.auto ? 8 : 99;
  }
  get hasSlot() { return false; }
  canTake() { return this.clean > 0 && this.fire <= 0; }
  take(actor, all = false) {
    const n = all ? this.clean : 1;
    this.clean -= n;
    this.changed();
    this.game.audio.clink();
    return makePlate(false, n);
  }
  accepts(item) { return item.kind === 'plate' && item.dirty && this.dirty + item.stack <= this.capacity; }
  canAccept(item) { return this.fire <= 0 && this.accepts(item); }
  put(item) {
    this.dirty += item.stack;
    this.changed();
    this.game.audio.splash();
  }
  canWork() { return !this.auto && this.dirty > 0 && this.fire <= 0; }
  workLabel() { return this.canWork() ? 'Wash' : null; }
  work(actor, dt) {
    if (!this.canWork()) return false;
    this._wash(dt * (actor.washRate ?? 1));
    return true;
  }
  _wash(amount) {
    this.wash += amount / COOK.washTime;
    this.workT = 0.15;
    this.washSound -= amount;
    const p = this.worldPos(new THREE.Vector3(-0.14, SURFACE_Y + 0.05, 0.03));
    if (this.washSound <= 0) {
      this.washSound = 0.3;
      this.game.audio.wash();
      this.game.particles.splash(p.x, p.y, p.z, 3);
    }
    if (Math.random() < 0.3) this.game.particles.bubbles(p.x, p.y, p.z, 1);
    if (this.wash >= 1) {
      this.wash = 0;
      this.dirty--;
      this.clean++;
      this.punch = 1;
      this.game.audio.clink();
      this.game.particles.splash(p.x, p.y + 0.05, p.z, 8);
      this.game.today.washed++;
      this.game.events.emit('washed', { station: this });
    }
  }
  update(dt) {
    if (this.auto && this.dirty > 0 && this.fire <= 0) {
      this.wash += dt / 3.2;
      this.workT = 0.2;
      if (this.wash >= 1) {
        this.wash = 0;
        this.dirty--;
        this.clean++;
        this.punch = 0.5;
        this.game.audio.clink();
        this.game.events.emit('washed', { station: this });
      }
    }
  }
  progressInfo() {
    if (this.dirty > 0 && this.wash > 0) return { value: this.wash, color: '#4fc3f7' };
    return null;
  }
  clearForDay() { super.clearForDay(); this.dirty = 0; this.clean = 0; this.wash = 0; }
  syncView() {
    const key = `sink:${Math.min(this.dirty, 6)}:${Math.min(this.clean, 6)}`;
    if (key === this.view.key) return;
    this.view.key = key;
    for (const [grp, n, dirty] of [[this.parts.dirty, this.dirty, true], [this.parts.clean, this.clean, false]]) {
      while (grp.children.length) grp.remove(grp.children[0]);
      if (n > 0) grp.add(plateStack(Math.min(n, 6), dirty));
    }
  }
  animate(dt, t) {
    super.animate(dt, t);
    if (this.auto) {
      const on = this.dirty > 0;
      this.parts.lightMat.emissiveIntensity = on ? 1.5 + Math.sin(t * 6) : 0.2;
      this.parts.suds.visible = on;
      if (on) this.parts.suds.rotation.z += dt * 4;
    }
  }
}

// ---------------------------------------------------------------------------
export class TrashStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.lid = 0;
  }
  get hasSlot() { return false; }
  canTake() { return false; }
  accepts(item) { return item.kind === 'ing' || (item.kind === 'plate' && !item.dirty && item.contents.length > 0); }
  canAccept(item) { return this.fire <= 0 && this.accepts(item); }
  binIt(n = 1) {
    this.lid = 1;
    this.changed();
    this.game.audio.trash();
    const p = this.worldPos();
    this.game.particles.poof(p.x, p.y + 0.1, p.z, '#cfc6b8', 8);
    this.game.today.wasted += n;
  }
  animate(dt, t) {
    super.animate(dt, t);
    this.lid = Math.max(0, this.lid - dt * 2);
    if (this.parts.lid) this.parts.lid.rotation.x = -Math.sin(Math.min(1, this.lid * 1.5) * Math.PI / 2) * 1.2;
  }
}

// ---------------------------------------------------------------------------
export class ExtinguisherStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.has = true;
  }
  get hasSlot() { return false; }
  get flammable() { return false; }
  canTake() { return this.has; }
  take() {
    this.has = false;
    this.changed();
    return makeExtinguisher();
  }
  accepts(item) { return item.kind === 'tool' && !this.has; }
  canAccept(item) { return this.accepts(item); }
  put() {
    this.has = true;
    this.changed();
  }
  clearForDay() { super.clearForDay(); this.has = true; }
  syncView() { if (this.parts.ext) this.parts.ext.visible = this.has; }
}

// ---------------------------------------------------------------------------
function frontDir(rot) {
  const th = rot * (Math.PI / 2);
  return [Math.round(Math.sin(th)), Math.round(Math.cos(th))];
}

export class ConveyorStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.timer = 0;
    this.moveTime = 1.1;
  }
  put(item) {
    super.put(item);
    this.timer = 0;
  }
  take() {
    this.timer = 0;
    return super.take();
  }
  update(dt) {
    if (!this.item || this.fire > 0) return;
    this.timer += dt;
    if (this.timer < this.moveTime) return;
    const [fx, fz] = frontDir(this.obj.rot);
    const target = this.game.grid.stationAt(this.obj.x + fx, this.obj.z + fz);
    if (!target || target === this) return;
    const res = this.game.interact.transferInto(target, this.item, null);
    if (res !== false) {
      this.item = res;
      this.timer = 0;
      this.changed();
    }
  }
  animate(dt, t) {
    super.animate(dt, t);
    const m = this.view.mesh;
    if (m) {
      const p = clamp(this.timer / this.moveTime, 0, 1);
      m.position.set(this.anchor.x, this.anchor.y, -0.3 + p * 0.6);
    }
  }
}

export class GrabberStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.holding = null;
    this.phase = 0; // 0 idle, 1 swinging to front
    this.t = 0;
    this.cool = 0;
    this.angle = Math.PI;
    this.heldView = { key: '', mesh: null };
  }
  get hasSlot() { return false; }
  get flammable() { return false; }
  canTake() { return false; }
  canAccept() { return false; }
  _neighbors() {
    const [fx, fz] = frontDir(this.obj.rot);
    const grid = this.game.grid;
    return {
      back: grid.stationAt(this.obj.x - fx, this.obj.z - fz),
      front: grid.stationAt(this.obj.x + fx, this.obj.z + fz),
    };
  }
  // What would we get from `st` (without taking)?
  _offer(st) {
    if (!st || st.fire > 0 || st === this) return null;
    if (st.kind === 'crate') return makeIngredient(st.ing);
    if (st.kind === 'platerack') return st.count > 0 ? makePlate() : null;
    if (st.kind === 'sink' || st.kind === 'autowasher') return st.clean > 0 ? makePlate() : null;
    if (st.kind === 'cooker') return st.item && isCookOutput(st.cookType, st.item) ? st.item : null;
    if (st.kind === 'table' || st.kind === 'grabber' || st.kind === 'trash' || st.kind === 'extinguisher') return null;
    if (st.kind === 'board' && st.item && chopInfo(st.item)) return null; // wait until chopped
    return st.canTake() ? st.item : null;
  }
  update(dt) {
    if (this.fire > 0) return;
    const ia = this.game.interact;
    if (this.phase === 0) {
      this.angle += (Math.PI - this.angle) * Math.min(1, dt * 8);
      this.cool -= dt;
      if (this.cool > 0) return;
      this.cool = 0.4;
      const { back, front } = this._neighbors();
      if (!back || !front) return;
      const offer = this._offer(back);
      if (!offer || !ia.canTransfer(front, offer)) return;
      this.holding = back.kind === 'sink' || back.kind === 'autowasher' ? back.take(null, false) : back.take(null);
      this.phase = 1;
      this.t = 0;
    } else {
      this.t += dt;
      this.angle += (0 - this.angle) * Math.min(1, dt * 8);
      if (this.t < 0.55) return;
      const { back, front } = this._neighbors();
      let res = front ? ia.transferInto(front, this.holding, null) : false;
      if (res === false && back) res = ia.transferInto(back, this.holding, null);
      if (res !== false) {
        this.holding = res;
        if (!this.holding) {
          this.phase = 0;
          this.cool = 0.3;
        }
      }
    }
  }
  clearForDay() { super.clearForDay(); this.holding = null; this.phase = 0; }
  animate(dt, t) {
    super.animate(dt, t);
    if (this.parts.turret) this.parts.turret.rotation.y = this.angle;
    const it = this.holding;
    const key = it ? `${it.uid}:${it.ver}` : '';
    if (key !== this.heldView.key) {
      if (this.heldView.mesh) this.parts.hold.remove(this.heldView.mesh);
      this.heldView.mesh = it ? buildItem(it) : null;
      if (this.heldView.mesh) {
        this.heldView.mesh.scale.setScalar(0.7);
        this.parts.hold.add(this.heldView.mesh);
      }
      this.heldView.key = key;
    }
  }
}

// ---------------------------------------------------------------------------
export class TableStation extends Station {
  constructor(obj, game) {
    super(obj, game);
    this.cash = 0;
    this.group = null;
    this.seats = [];
    this.seatViews = [];
    this.cashView = { key: '', mesh: null };
    this.computeSeats();
  }
  get hasSlot() { return false; }
  get flammable() { return false; }

  computeSeats() {
    const o = this.obj;
    const tableCells = o.cells.filter((c) => c.role === 'table');
    this.seats = o.cells.filter((c) => c.role === 'seat').map((c) => {
      let best = null, bd = Infinity;
      for (const t of tableCells) {
        const d = Math.abs(t.x - c.x) + Math.abs(t.z - c.z);
        if (d < bd) { bd = d; best = t; }
      }
      const sx = c.x + 0.5, sz = c.z + 0.5;
      const tx = best.x + 0.5, tz = best.z + 0.5;
      const dx = tx - sx, dz = tz - sz;
      return {
        cell: c, x: sx, z: sz, face: Math.atan2(dx, dz),
        plateX: tx - dx * 0.2, plateZ: tz - dz * 0.2,
        customer: null, plate: null,
      };
    });
    for (const v of this.seatViews) if (v.mesh) this.game.grid.group.remove(v.mesh);
    this.seatViews = this.seats.map(() => ({ key: '', mesh: null }));
  }
  onMoved() { this.computeSeats(); }

  get topY() { return this.obj.mesh.userData.tableTop ?? 0.78; }

  isFree(n) {
    return !this.group && this.fire <= 0 && this.seats.length >= n && this.seats.every((s) => !s.plate && !s.customer);
  }

  hasDirty() { return this.seats.some((s) => s.plate && s.plate.dirty && (!s.customer || s.customer.state === 'leaving')); }

  waitingCustomers() {
    return this.seats.filter((s) => s.customer && s.customer.state === 'waiting' && !s.plate).map((s) => s.customer);
  }

  // Seat index of a waiting customer who ordered this plate's dish
  matchSeat(plate) {
    const dish = matchDish(plate);
    if (!dish) return -1;
    let best = -1;
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      if (s.customer && s.customer.state === 'waiting' && !s.plate && s.customer.order === dish) {
        if (best < 0 || s.customer.critic) best = i;
      }
    }
    return best;
  }

  accepts(item) { return item.kind === 'plate' && !item.dirty && this.matchSeat(item) >= 0; }
  canAccept(item) { return this.fire <= 0 && this.accepts(item); }
  put(item) {
    const i = this.matchSeat(item);
    if (i < 0) return;
    const s = this.seats[i];
    s.plate = item;
    this.changed();
    this.game.audio.clink();
    s.customer.onServed(item);
  }

  canTake() { return this.hasDirty() || this.cash > 0; }
  // Collect every dirty plate as one stack (+cash)
  take(actor) {
    let n = 0;
    for (const s of this.seats) {
      if (s.plate && s.plate.dirty && (!s.customer || s.customer.state === 'leaving')) {
        n += s.plate.stack;
        s.plate = null;
      }
    }
    this.collectCash(actor);
    this.changed();
    if (n > 0) {
      this.game.audio.clink();
      this.game.events.emit('cleared', { station: this, n });
      return makePlate(true, n);
    }
    return null;
  }

  collectCash() {
    if (this.cash <= 0) return 0;
    const amt = this.cash;
    this.cash = 0;
    const p = this.worldPos();
    this.game.collectCash(amt, p);
    return amt;
  }

  canWork() { return this.cash > 0; }
  workLabel() { return this.cash > 0 ? 'Collect cash' : null; }
  work() {
    if (this.cash <= 0) return false;
    this.collectCash();
    return true;
  }

  clearForDay() {
    super.clearForDay();
    this.cash = 0;
    this.group = null;
    for (const s of this.seats) { s.customer = null; s.plate = null; }
  }

  syncView() {
    const grp = this.game.grid.group;
    this.seats.forEach((s, i) => {
      const v = this.seatViews[i];
      const it = s.plate;
      const key = it ? `${it.uid}:${it.ver}:${it.eaten ?? 0}` : '';
      if (key === v.key) return;
      if (v.mesh) grp.remove(v.mesh);
      v.mesh = null;
      v.key = key;
      if (it) {
        const m = buildItem(it);
        m.position.set(s.plateX, this.topY + 0.02, s.plateZ);
        m.scale.setScalar(0.95);
        grp.add(m);
        v.mesh = m;
      }
    });
    const ckey = this.cash > 0 ? `cash:${Math.min(5, Math.ceil(this.cash / 15))}` : '';
    if (ckey !== this.cashView.key) {
      if (this.cashView.mesh) grp.remove(this.cashView.mesh);
      this.cashView.mesh = null;
      this.cashView.key = ckey;
      if (this.cash > 0) {
        const g = new THREE.Group();
        const n = Math.min(5, Math.ceil(this.cash / 15));
        for (let i = 0; i < n; i++) {
          const bill = mesh(box(0.2, 0.012, 0.11), mat('#5fbf6a', { r: 0.8 }), 0, i * 0.014, 0);
          bill.rotation.y = i * 0.4;
          g.add(bill);
        }
        for (let i = 0; i < 3; i++) g.add(mesh(cyl(0.04, 0.04, 0.012, 12), mat('#f5c542', { m: 0.8, r: 0.3 }), 0.1 + i * 0.02, i * 0.013, 0.08));
        const p = this.worldPos();
        g.position.set(p.x, this.topY + 0.03, p.z);
        grp.add(g);
        this.cashView.mesh = g;
      }
    }
  }

  animate(dt, t) {
    super.animate(dt, t);
    if (this.cashView.mesh) this.cashView.mesh.rotation.y = Math.sin(t * 2) * 0.2;
    // Eating: shrink served food
    this.seats.forEach((s, i) => {
      const v = this.seatViews[i].mesh;
      if (v && s.customer && s.customer.state === 'eating' && s.plate && !s.plate.dirty) {
        const k = 1 - s.customer.eatProgress * 0.7;
        const food = v.children[v.children.length - 1];
        if (food && v.children.length > 1) food.scale.set(k, k, k);
      }
    });
  }

  dispose() {
    for (const v of this.seatViews) if (v.mesh) this.game.grid.group.remove(v.mesh);
    if (this.cashView.mesh) this.game.grid.group.remove(this.cashView.mesh);
  }
}

// ---------------------------------------------------------------------------
export function createStation(obj, game) {
  switch (obj.def.station) {
    case 'counter': return new CounterStation(obj, game);
    case 'pass': return new PassStation(obj, game);
    case 'board': return new BoardStation(obj, game);
    case 'cooker': return new CookerStation(obj, game);
    case 'crate': return new CrateStation(obj, game);
    case 'platerack': return new PlateRackStation(obj, game);
    case 'sink': return new SinkStation(obj, game);
    case 'autowasher': return new SinkStation(obj, game);
    case 'trash': return new TrashStation(obj, game);
    case 'extinguisher': return new ExtinguisherStation(obj, game);
    case 'conveyor': return new ConveyorStation(obj, game);
    case 'grabber': return new GrabberStation(obj, game);
    case 'table': return new TableStation(obj, game);
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Fire: ignites from burnt food, grows, spreads to neighbouring flammable stations,
// and is beaten back by extinguisher foam.
export class FireSystem {
  constructor(game) {
    this.game = game;
    this.count = 0;
    this.sprayHit = false;
  }

  ignite(st) {
    if (!st || st.fire > 0 || !st.flammable) return;
    const g = this.game;
    st.fire = 0.3;
    st.spreadT = 0;
    g.audio.ignite();
    g.renderer.addShake(0.25);
    g.today.fires++;
    const p = st.worldPos();
    for (let i = 0; i < 10; i++) g.particles.fire(p.x, p.y, p.z, 1);
    g.ui.toast(`🔥 FIRE at the ${st.name}! Grab the extinguisher!`, 'danger');
    g.events.emit('fire', { station: st });
  }

  neighbors(st) {
    const out = new Set();
    const grid = this.game.grid;
    for (const c of st.obj.cells) {
      for (const [dx, dz] of DIRS8) {
        const n = grid.stationAt(c.x + dx, c.z + dz);
        if (n && n !== st && n.flammable && n.fire <= 0) out.add(n);
      }
    }
    return [...out];
  }

  update(dt) {
    const g = this.game;
    let count = 0;
    let total = 0;
    for (const st of g.grid.stations()) {
      if (st.fire <= 0) continue;
      count++;
      total += st.fire;
      st.fire = Math.min(1, st.fire + dt * COOK.fireGrowth * 0.35);
      const it = st.item;
      if (it && it.kind === 'ing' && it.state !== 'burnt') { it.state = 'burnt'; it.ver++; }
      if (it && it.kind === 'plate' && it.contents.length) {
        for (const c of it.contents) if (c.state !== 'burnt') { c.state = 'burnt'; it.ver++; }
      }
      const p = st.worldPos();
      const n = Math.ceil(dt * 75 * (0.35 + st.fire));
      for (let i = 0; i < n; i++) g.particles.fire(p.x, Math.max(p.y, 0.9), p.z, st.fire);
      if (Math.random() < dt * 6) g.particles.smoke(p.x, 1.9, p.z, 1);
      g.renderer.requestLight(p.x, 1.6, p.z, '#ff7a2a', 7 * st.fire * (0.8 + Math.random() * 0.4), 5, 10);
      st.spreadT += dt;
      if (st.spreadT > COOK.spreadInterval * rand(0.8, 1.3) && st.fire > 0.6) {
        st.spreadT = 0;
        const nb = this.neighbors(st);
        if (nb.length) this.ignite(pick(nb));
      }
    }
    this.count = count;
    g.audio.setLoop('fire', total);
    g.audio.setAlarm(count > 0);
  }

  // Spray foam from origin along dir (normalised xz). Returns true if any fire was hit.
  spray(ox, oz, dx, dz, dt) {
    const g = this.game;
    let hit = false;
    for (const st of g.grid.stations()) {
      if (st.fire <= 0) continue;
      const vx = st.x - ox, vz = st.z - oz;
      const d = Math.hypot(vx, vz);
      if (d > 2.8) continue;
      const cos = d < 0.01 ? 1 : (vx * dx + vz * dz) / d;
      if (cos < 0.62) continue;
      hit = true;
      st.fire -= COOK.extinguishRate * dt * (d < 1.4 ? 1.3 : 1);
      if (Math.random() < dt * 20) g.particles.steam(st.x, 1.1, st.z, 1.2);
      if (st.fire <= 0) {
        st.fire = 0;
        st.smolder = -4;
        g.audio.extinguish();
        g.particles.poof(st.x, 1.0, st.z, '#ffffff', 14);
        g.today.extinguished++;
        g.ui.toast(`🧯 Fire out at the ${st.name}!`, 'good');
        g.events.emit('extinguished', { station: st });
      }
    }
    return hit;
  }

  clear() {
    for (const st of this.game.grid.stations()) st.fire = 0;
    this.count = 0;
  }
}

export { itemLabel };
