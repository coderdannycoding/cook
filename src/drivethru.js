// Drive-thru: cars turn in from the road, queue along the right side of the shop, order at the
// window, pay when handed their food (or honk and drive off), then loop back out to the road.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { DAY } from './config.js';
import { DISHES, dishBasePatience } from './recipes.js';
import { buildCar } from './models.js';
import { REVIEW_WEIGHT } from './customers.js';
import { rand, pick, clamp } from './utils.js';

const COLORS = ['#ff5a4a', '#ffc93c', '#3fcf7a', '#a66cff', '#f4f6f8', '#ff9142', '#4aa3f0', '#ff6fae', '#2f3a4f'];
const GAP = 2.6; // bumper to bumper spacing in the queue
const MAX_QUEUE = 3;

// Lane layout for a window on cell (W - 1, wz). Shared with the renderer, which paints it.
export function driveLane(W, H, wz) {
  const inX = W + 1.0, outX = W + 3.2;
  const stopZ = wz + 0.5;
  return { inX, outX, midX: (inX + outX) / 2, stopZ, topZ: stopZ - 1.9, x0: W + 0.25, x1: W + 3.95 };
}

function curve(points) {
  const c = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  c.len = c.getLength();
  return c;
}

export class DriveThru {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.spawnT = 0;
    this.nextId = 1;
    this.key = '';
    this.paths = null;
    this.group = new THREE.Group();
    game.renderer.world.add(this.group);
  }

  get window() { return this.game.grid.stations('drivethru')[0] || null; }

  // The car parked at the window (ordering, waiting or just paid)
  carAt() { return this.cars.find((c) => c.atWindow) || null; }

  waiting() { return this.cars.filter((c) => c.state === 'waiting'); }

  // True once every car has been served or turned away (leaving cars don't hold up closing)
  isEmpty() { return this.cars.every((c) => c.state === 'leaving'); }

  _layout(win) {
    const { W, H } = this.game.grid;
    const key = `${W}|${H}|${win.obj.z}`;
    if (key === this.key) return this.paths;
    this.clear();
    const L = driveLane(W, H, win.obj.z);
    const r = (L.outX - L.inX) / 2;
    const into = curve([[W + 30, H + 4.7], [W + 9, H + 4.7], [L.inX + 2.4, H + 4.6], [L.inX + 0.3, H + 2.8], [L.inX, H + 1.2], [L.inX, L.stopZ]]);
    const out = curve([
      [L.inX, L.stopZ], [L.inX, L.topZ], [L.inX + r * 0.3, L.topZ - r * 0.72], [L.midX, L.topZ - r], [L.outX - r * 0.3, L.topZ - r * 0.72], [L.outX, L.topZ],
      [L.outX, H + 1.4], [L.outX + 0.6, H + 5.9], [L.outX + 3.2, H + 7.6], [W + 30, H + 7.6],
    ]);
    // Queue spots stay on the paving beside the shop, never out on the sidewalk
    let slots = 1;
    while (slots < MAX_QUEUE && into.getPointAt(clamp((into.len - slots * GAP) / into.len, 0, 1)).z < H + 0.3) slots++;
    this.paths = { into, out, slots, L };
    this.key = key;
    return this.paths;
  }

  startDay() {
    this.clear();
    this.spawnT = rand(7, 11);
    this.toldToday = false;
  }

  clear() {
    for (const c of this.cars) this.group.remove(c.root);
    this.cars = [];
  }

  spawnInterval() {
    const g = this.game;
    let t = 30 - 3.5 * (g.state.rating - 1);
    t *= 1 - 0.15 * g.ambience;
    t /= 1 + g.perks.arrivals;
    return Math.max(11, t);
  }

  spawn(paths) {
    const root = buildCar(pick(COLORS));
    this.group.add(root);
    const car = {
      id: this.nextId++, root, pos: root.position, path: paths.into, s: 0, v: 6, state: 'driving', atWindow: false,
      order: null, patience: 1, patienceMax: 1, ticket: null, claimedBy: null, platedBy: null, critic: false, table: null,
      window: null, timer: 0, idle: 0,
    };
    this.cars.push(car);
    this._place(car);
    return car;
  }

  _place(car) {
    const u = clamp(car.s / car.path.len, 0, 1);
    car.path.getPointAt(u, car.pos);
    const t = car.path.getTangentAt(u);
    car.root.rotation.y = Math.atan2(-t.z, t.x);
  }

  // Send a car off down the exit lane
  leave(car) {
    car.state = 'leaving';
    car.atWindow = false;
    car.claimedBy = null;
    car.platedBy = null;
    car.path = this.paths.out;
    car.s = 0;
    car.v = 1;
  }

  serve(car, plate) {
    const g = this.game;
    if (car.state !== 'waiting') return;
    const used = 1 - car.patience;
    let score = used < 0.4 ? 5 : used < 0.65 ? 4 : used < 0.85 ? 3 : 2;
    score = Math.min(5, score + Math.max(0, g.ambience - 0.3) * 1.5 + g.perks.review);
    const price = DISHES[car.order].price;
    const tip = Math.round(price * clamp((score - 2.5) * 0.09 + g.ambience * 0.08 + g.perks.tips, 0, 0.5));
    g.today.revenue += price;
    g.today.tips += tip;
    g.today.served++;
    g.today.driveThru = (g.today.driveThru || 0) + 1;
    g.applyReview(score, REVIEW_WEIGHT.served);
    g.orders.complete(car.ticket);
    g.addCash(price + tip, car.pos.x - 0.8, 2.2, car.pos.z);
    g.particles.emote(car.pos.x, 1.9, car.pos.z, score >= 4.5 ? 'Wow, fast!' : score >= 4 ? 'Thanks!' : 'Finally', score >= 4 ? 'love' : 'meh', true);
    g.particles.sparkle(car.pos.x, 1.2, car.pos.z);
    g.audio.cash();
    car.state = 'paid';
    car.timer = 0.9;
    car.claimedBy = null;
    g.events.emit('served', { customer: car, dish: car.order, plate });
  }

  update(dt) {
    const g = this.game;
    const win = this.window;
    if (!win) {
      if (this.cars.length) this.clear();
      return;
    }
    const paths = this._layout(win);
    const seating = g.phase === 'day' && g.clock < DAY.lastSeatingHour;
    const queued = this.cars.filter((c) => c.path === paths.into);
    // Arrivals
    if (seating) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = this.spawnInterval() * rand(0.8, 1.25);
        if (queued.length < paths.slots && g.availableDishes().length) {
          const last = queued[queued.length - 1];
          if (!last || last.s > GAP + 1) queued.push(this.spawn(paths));
        }
      }
    }
    if (g.clock >= DAY.closeHour) {
      // Late cars that haven't ordered roll past the window without stopping
      for (const c of queued) if (c.state === 'driving') c.state = 'passing';
    }
    if (g.clock >= DAY.forceLeaveHour) {
      for (const c of queued) {
        if (c.state !== 'waiting' && c.state !== 'ordering') continue;
        if (c.ticket) g.orders.fail(c.ticket);
        g.today.lost++;
        g.applyReview(2, REVIEW_WEIGHT.closing);
        this.leave(c);
      }
    }
    // Queue: each car creeps up to its slot behind the one ahead
    queued.forEach((c, i) => {
      const target = paths.into.len - i * GAP;
      const gap = target - c.s;
      const want = gap > 0.02 ? Math.min(6, 0.6 + gap * 1.6) : 0;
      c.v += (want - c.v) * Math.min(1, dt * 4);
      c.s = Math.min(target, c.s + Math.max(0, c.v) * dt);
      const there = i === 0 && gap < 0.05;
      c.atWindow = there;
      if (there && c.state === 'driving') {
        c.state = 'ordering';
        c.timer = 1.1;
        g.particles.emote(c.pos.x, 1.9, c.pos.z, pick(['Hi there!', 'Hello!', 'One sec…']), 'good', true);
        g.audio.bell();
      } else if (there && c.state === 'passing') this.leave(c);
    });
    for (const c of [...this.cars]) {
      if (c.state === 'ordering') {
        c.timer -= dt;
        if (c.timer <= 0) this.placeOrder(c, win);
      } else if (c.state === 'waiting') {
        const before = c.patience;
        c.patience -= (dt / c.patienceMax) * (g.fire.count > 0 ? 1.5 : 1);
        if (before > 0.25 && c.patience <= 0.25) {
          g.particles.emote(c.pos.x, 1.9, c.pos.z, 'Hurry up!', 'bad');
          g.audio.honk();
        }
        if (c.patience <= 0) {
          g.particles.emote(c.pos.x, 1.9, c.pos.z, '#@%!', 'bad', true);
          g.audio.honk(true);
          g.applyReview(1, REVIEW_WEIGHT.angry);
          g.today.lost++;
          g.orders.fail(c.ticket);
          this.leave(c);
        }
      } else if (c.state === 'paid') {
        c.timer -= dt;
        if (c.timer <= 0) this.leave(c);
      } else if (c.state === 'leaving') {
        c.v = Math.min(7, c.v + dt * 4);
        c.s += c.v * dt;
        if (c.s >= c.path.len) {
          this.group.remove(c.root);
          this.cars = this.cars.filter((x) => x !== c);
          continue;
        }
      }
      this._place(c);
    }
  }

  placeOrder(car, win) {
    const g = this.game;
    const dish = g.customers.pickDish(false);
    if (!dish) {
      g.particles.emote(car.pos.x, 1.9, car.pos.z, 'Nothing I like', 'meh', true);
      this.leave(car);
      return;
    }
    car.order = dish;
    car.window = win;
    car.patienceMax = dishBasePatience(dish) * g.customers.patienceMult(car) * 0.9;
    car.patience = 1;
    car.state = 'waiting';
    g.orders.add(car);
    g.audio.pickup();
    g.events.emit('ordered', car);
    if (!this.toldToday) {
      this.toldToday = true;
      g.ui.toast('A car is waiting at the drive-thru. Hand their order through the window.', 'info', 'car');
    }
  }
}
