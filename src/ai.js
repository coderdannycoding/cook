// AI: A* grid pathfinding with string-pulling, demand analysis for open orders, and the
// staff brains (Sous-Chef, Waiter, Dishwasher). Brains run their jobs as generator
// coroutines so multi-step behaviour reads like a recipe: walk -> take -> chop -> cook...

import {
  DISHES, chainFor, itemKey, chopInfo, cookRule, isCookOutput, matchDish, canTop,
} from './recipes.js';
import { clamp, rand } from './utils.js';

// ---------------------------------------------------------------------------
// A*

class MinHeap {
  constructor() { this.items = []; this.prio = []; }
  get size() { return this.items.length; }
  push(item, p) {
    const a = this.items, pr = this.prio;
    a.push(item); pr.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= pr[i]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      [pr[parent], pr[i]] = [pr[i], pr[parent]];
      i = parent;
    }
  }
  pop() {
    const a = this.items, pr = this.prio;
    const top = a[0];
    const last = a.pop(), lp = pr.pop();
    if (a.length) {
      a[0] = last; pr[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && pr[l] < pr[m]) m = l;
        if (r < a.length && pr[r] < pr[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [pr[m], pr[i]] = [pr[i], pr[m]];
        i = m;
      }
    }
    return top;
  }
}

const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

// goals: [{x, z}] tiles. Goal tiles may be solid (e.g. a chair). Returns waypoints [{x, z}] or null.
export function findPath(grid, sx, sz, goals, opts = {}) {
  const W = grid.W, H = grid.H;
  if (!goals.length) return null;
  const st = { x: clamp(Math.floor(sx), 0, W - 1), z: clamp(Math.floor(sz), 0, H - 1) };
  const startI = st.z * W + st.x;
  const goalSet = new Set(goals.filter((g) => grid.inBounds(g.x, g.z)).map((g) => g.z * W + g.x));
  if (!goalSet.size) return null;
  const end = (i) => (opts.endX !== undefined ? { x: opts.endX, z: opts.endZ } : { x: (i % W) + 0.5, z: Math.floor(i / W) + 0.5 });
  if (goalSet.has(startI)) return [end(startI)];

  const N = W * H;
  const gs = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heur = (i) => {
    const x = i % W, z = (i / W) | 0;
    let best = Infinity;
    for (const g of goals) {
      const dx = Math.abs(g.x - x), dz = Math.abs(g.z - z);
      const h = Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
      if (h < best) best = h;
    }
    return best;
  };
  const walk = (x, z) => grid.inBounds(x, z) && !grid.solid[z * W + x];
  const heap = new MinHeap();
  gs[startI] = 0;
  heap.push(startI, heur(startI));
  let found = -1;
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (goalSet.has(cur)) { found = cur; break; }
    const cx = cur % W, cz = (cur / W) | 0;
    for (const [dx, dz, cost] of NB) {
      const nx = cx + dx, nz = cz + dz;
      if (!grid.inBounds(nx, nz)) continue;
      const ni = nz * W + nx;
      if (closed[ni]) continue;
      const isGoal = goalSet.has(ni);
      if (!isGoal && !walk(nx, nz)) continue;
      if (dx && dz && (!walk(cx + dx, cz) || !walk(cx, cz + dz))) continue;
      const ng = gs[cur] + cost;
      if (ng < gs[ni]) {
        gs[ni] = ng;
        came[ni] = cur;
        heap.push(ni, ng + heur(ni));
      }
    }
  }
  if (found < 0) return null;
  const tiles = [];
  for (let i = found; i !== -1; i = came[i]) tiles.push(i);
  tiles.reverse();
  const pts = tiles.map((i) => ({ x: (i % W) + 0.5, z: Math.floor(i / W) + 0.5 }));
  pts[0] = { x: sx, z: sz };
  pts[pts.length - 1] = end(found);
  // String pulling
  const out = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !grid.lineClear(pts[i].x, pts[i].z, pts[j].x, pts[j].z, 0.26)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Demand analysis

export function openOrders(game) {
  return game.customers.allCustomers().filter((c) => c.state === 'waiting' && c.order);
}

export function canBecome(item, key) {
  if (!item || item.kind !== 'ing' || item.state === 'burnt') return false;
  if (itemKey(item) === key) return true;
  const c = chainFor(key);
  if (c.ing !== item.id) return false;
  if (item.state === 'raw') return !item.toppings;
  if (c.chop && (item.state === 'chopped' || item.state === 'base')) {
    if (c.toppings.length) {
      const t = item.toppings || [];
      return t.every((x) => c.toppings.includes(x));
    }
    return !!c.cooker;
  }
  return false;
}

// Every item currently in the world with where it is
function worldItems(game) {
  const out = [];
  for (const st of game.grid.stations()) {
    if (st.item) out.push({ item: st.item, st });
    if (st.kind === 'grabber' && st.holding) out.push({ item: st.holding, st: null });
  }
  for (const ch of game.allWorkers()) if (ch.held) out.push({ item: ch.held, st: null, holder: ch });
  return out;
}

export function computeNeeds(game, exclude = null) {
  const needs = new Map();
  const add = (k, n = 1) => needs.set(k, (needs.get(k) || 0) + n);
  const orders = openOrders(game);
  const items = worldItems(game);
  const plates = items.filter((w) => w.item.kind === 'plate' && !w.item.dirty);
  const used = new Set();
  for (const o of orders) {
    const p = plates.find((w) => !used.has(w) && matchDish(w.item) === o.order);
    if (p) { used.add(p); continue; }
    for (const part of DISHES[o.order].parts) add(part);
  }
  for (const w of plates) {
    if (used.has(w)) continue;
    for (const c of w.item.contents) {
      const k = itemKey(c);
      if ((needs.get(k) || 0) > 0) needs.set(k, needs.get(k) - 1);
    }
  }
  for (const w of items) {
    if (w.item.kind !== 'ing') continue;
    for (const [k, n] of needs) {
      if (n > 0 && canBecome(w.item, k)) { needs.set(k, n - 1); break; }
    }
  }
  for (const s of game.staff.members) {
    const b = s.brain;
    if (!b || b === exclude || !b.target) continue;
    if ((needs.get(b.target) || 0) > 0) needs.set(b.target, needs.get(b.target) - 1);
  }
  for (const [k, n] of [...needs]) if (n <= 0) needs.delete(k);
  return needs;
}

// ---------------------------------------------------------------------------
// Brains

class JobFail extends Error {}
const fail = (msg) => { throw new JobFail(msg); };

class Brain {
  constructor(staff, game) {
    this.s = staff;
    this.g = game;
    this.task = null;
    this.claims = [];
    this.idleT = 0;
    this.wanderT = rand(1, 3);
    this.target = null;
    this.failCool = 0;
  }

  get grid() { return this.g.grid; }
  get ia() { return this.g.interact; }

  update(dt) {
    const s = this.s;
    this.failCool -= dt;
    if (!this.task) {
      if (s.held) { this.task = this.disposeHeld(); this.taskName = 'dispose'; }
      else if (this.failCool <= 0) this.task = this.fireTask() || this.pickTask();
      if (!this.task) { this.idle(dt); return; }
      this.idleT = 0;
    }
    try {
      const r = this.task.next(dt);
      if (r.done) this.finish(false);
    } catch (e) {
      if (!(e instanceof JobFail)) console.warn('[staff AI]', e);
      if (window.__aiStats) {
        const k = `${this.s.role}:${this.taskName || '?'}:${e.message}`;
        window.__aiStats[k] = (window.__aiStats[k] || 0) + 1;
      }
      this.finish(true);
    }
  }

  finish(failed) {
    this.task = null;
    for (const c of this.claims) {
      if (c.reservedBy === this.s) c.reservedBy = null;
      if (c.claimedBy === this.s) c.claimedBy = null;
      if (c.platedBy === this.s) c.platedBy = null;
    }
    this.claims = [];
    this.target = null;
    this.firefighting = false;
    this.s.path = null;
    this.s.vel.set(0, 0, 0);
    if (failed) {
      this.failCool = 0.6;
      this.s.status = 'question';
    } else this.s.status = '';
  }

  reset() {
    this.finish(false);
    this.s.status = '';
  }

  claim(st) {
    st.reservedBy = this.s;
    this.claims.push(st);
  }
  release(st) {
    if (st.reservedBy === this.s) st.reservedBy = null;
    this.claims = this.claims.filter((c) => c !== st);
  }
  free(st) { return !st.reservedBy || st.reservedBy === this.s; }

  dist(st) { return Math.hypot(st.x - this.s.pos.x, st.z - this.s.pos.z); }

  nearest(list) {
    let best = null, bd = Infinity;
    for (const st of list) {
      const d = this.dist(st);
      if (d < bd) { bd = d; best = st; }
    }
    return best;
  }

  stations(pred) { return this.grid.stations().filter((st) => st.fire <= 0 && pred(st)); }

  *walkTo(st, opts = {}) {
    const s = this.s;
    const grid = this.grid;
    let attempts = 0;
    for (;;) {
      if (!grid.objects.includes(st.obj)) fail('station gone');
      const tiles = grid.accessTiles(st.obj);
      if (!tiles.length) fail('no access');
      const here = tiles.find((t) => t.x === s.tileX && t.z === s.tileZ);
      if (here) {
        s.vel.set(0, 0, 0);
        s.faceTo(here.fx + 0.5, here.fz + 0.5);
        yield;
        return here;
      }
      const path = findPath(grid, s.pos.x, s.pos.z, tiles);
      if (!path) fail('no path');
      s.setPath(path);
      const goal = path[path.length - 1];
      let best = Infinity, stuckT = 0, arrived = false;
      while (!arrived) {
        const dt = (yield) || 0.016;
        if (st.fire > 0 && !opts.allowFire) fail('fire');
        const r = s.followPath(dt, s.speed);
        if (r === 'arrived' || r === 'none') { arrived = true; break; }
        const d = Math.hypot(goal.x - s.pos.x, goal.z - s.pos.z);
        if (d < best - 0.05) { best = d; stuckT = 0; } else stuckT += dt;
        if (stuckT > 2.2) break;
      }
      if (!arrived) {
        attempts++;
        if (attempts > 3) fail('stuck');
        continue;
      }
      const tile = tiles.find((t) => t.x === s.tileX && t.z === s.tileZ) || tiles.reduce((a, b) => (Math.hypot(a.x + 0.5 - s.pos.x, a.z + 0.5 - s.pos.z) < Math.hypot(b.x + 0.5 - s.pos.x, b.z + 0.5 - s.pos.z) ? a : b));
      s.faceTo(tile.fx + 0.5, tile.fz + 0.5);
      yield;
      return tile;
    }
  }

  *walkToPoint(x, z) {
    const s = this.s;
    const path = findPath(this.grid, s.pos.x, s.pos.z, [{ x: Math.floor(x), z: Math.floor(z) }], { endX: x, endZ: z });
    if (!path) return;
    s.setPath(path);
    let t = 0;
    for (;;) {
      const dt = (yield) || 0.016;
      t += dt;
      const r = s.followPath(dt, s.speed * 0.7);
      if (r !== 'moving' || t > 8) return;
    }
  }

  *pause(seconds) {
    let t = 0;
    while (t < seconds) t += (yield) || 0.016;
  }

  act(st) {
    const r = this.ia.pickDrop(this.s, st);
    if (r.ok) this.s.bounce(0.3);
    return r.ok;
  }

  // Put whatever we're holding somewhere sensible.
  *disposeHeld() {
    this.taskName = 'disposeHeld';
    const s = this.s;
    const it = s.held;
    if (!it) return;
    const ia = this.ia;
    const pref = (st) => {
      if (it.kind === 'plate' && it.dirty) return st.kind === 'sink' || st.kind === 'autowasher' ? 0 : 50;
      if (it.kind === 'plate' && !it.contents.length) return st.kind === 'platerack' ? 0 : st.kind === 'counter' ? 8 : 50;
      if (it.kind === 'plate') return st.kind === 'pass' ? 0 : st.kind === 'counter' ? 4 : 50;
      if (it.kind === 'tool') return st.kind === 'extinguisher' ? 0 : 50;
      if (it.state === 'burnt') return st.kind === 'trash' ? 0 : 50;
      return st.kind === 'counter' ? 0 : st.kind === 'pass' ? 6 : st.kind === 'trash' ? 12 : 50;
    };
    const cands = this.stations((st) => this.free(st) && ia.canTransfer(st, it) && pref(st) < 50 && !(st.kind === 'cooker'));
    if (!cands.length) {
      s.status = 'dots';
      yield* this.pause(1.2);
      return;
    }
    cands.sort((a, b) => pref(a) + this.dist(a) * 0.5 - (pref(b) + this.dist(b) * 0.5));
    const target = cands[0];
    this.claim(target);
    yield* this.walkTo(target);
    if (!this.act(target)) fail('dispose failed');
  }

  // Any staff member will grab the extinguisher and fight a fire (one at a time).
  fireTask() {
    const fires = this.grid.stations().filter((st) => st.fire > 0);
    if (!fires.length) return null;
    if (this.g.staff.members.some((m) => m !== this.s && m.brain && m.brain.firefighting)) return null;
    if (this.g.player.held && this.g.player.held.kind === 'tool') return null;
    const loose = this.grid.stations().find((st) => st.item && st.item.kind === 'tool' && st.fire <= 0);
    const stand = this.nearest(this.grid.stations('extinguisher').filter((st) => st.has));
    const src = loose || stand;
    if (!src) return null;
    this.firefighting = true;
    return this.fightFire(src);
  }

  *fightFire(src) {
    this.taskName = 'fire';
    const s = this.s;
    s.status = 'extinguisher';
    yield* this.walkTo(src);
    if (!this.act(src) || !s.held || s.held.kind !== 'tool') fail('no extinguisher');
    let guard = 0;
    for (;;) {
      const fires = this.grid.stations().filter((st) => st.fire > 0);
      if (!fires.length || guard++ > 12) break;
      const target = this.nearest(fires);
      yield* this.walkTo(target, { allowFire: true });
      let t = 0;
      while (target.fire > 0 && t < 7) {
        const dt = (yield) || 0.016;
        t += dt;
        s.faceTo(target.x, target.z);
        const dx = Math.sin(s.facing), dz = Math.cos(s.facing);
        for (let i = 0; i < 2; i++) this.g.particles.foam(s.pos.x + dx * 0.5, 1.0, s.pos.z + dz * 0.5, dx, dz);
        this.g.fire.spray(s.pos.x, s.pos.z, dx, dz, dt);
        this.g.staffSpraying = true;
      }
    }
    this.firefighting = false;
  }

  idle(dt) {
    const s = this.s;
    this.idleT += dt;
    if (this.idleT > 2.5) s.status = 'zzz';
    this.wanderT -= dt;
    if (s.path && s.pathI < s.path.length) {
      s.followPath(dt, s.speed * 0.5);
      return;
    }
    s.vel.set(0, 0, 0);
    if (this.wanderT <= 0) {
      this.wanderT = rand(3, 7);
      const home = this.home();
      if (!home) return;
      for (let tries = 0; tries < 8; tries++) {
        const x = Math.floor(home.x + rand(-2, 2)), z = Math.floor(home.z + rand(-2, 2));
        if (this.grid.isWalkable(x, z) && !(x === this.grid.doorX && z === this.grid.H - 1)) {
          const p = findPath(this.grid, s.pos.x, s.pos.z, [{ x, z }]);
          if (p) s.setPath(p);
          break;
        }
      }
    }
  }

  home() { return null; }
}

// ---------------------------------------------------------------------------
export class WaiterBrain extends Brain {
  home() {
    const pass = this.grid.stations('pass')[0];
    return pass ? { x: pass.x, z: pass.z + 1 } : { x: this.grid.W - 3, z: this.grid.H / 2 };
  }

  pickTask() {
    const g = this.g;
    // 1. Deliver finished dishes from the pass
    const waiting = openOrders(g).filter((c) => !c.claimedBy);
    for (const pass of this.stations((st) => st.kind === 'pass' && this.free(st) && st.item && st.item.kind === 'plate')) {
      const dish = matchDish(pass.item);
      if (!dish) continue;
      const cands = waiting.filter((c) => c.order === dish);
      if (!cands.length) continue;
      cands.sort((a, b) => (b.critic ? 1 : 0) - (a.critic ? 1 : 0) || a.patience - b.patience);
      return this.deliver(pass, cands[0]);
    }
    // 2. Clear dirty tables
    const dirty = this.stations((st) => st.kind === 'table' && this.free(st) && st.hasDirty());
    if (dirty.length) return this.clearTable(this.nearest(dirty));
    // 3. Collect cash
    const cash = this.stations((st) => st.kind === 'table' && this.free(st) && st.cash > 0);
    if (cash.length) return this.collect(this.nearest(cash));
    return null;
  }

  *deliver(pass, cust) {
    this.taskName = 'deliver';
    const s = this.s;
    this.claim(pass);
    cust.claimedBy = s;
    this.claims.push(cust);
    s.status = 'cloche';
    yield* this.walkTo(pass);
    if (!pass.item || matchDish(pass.item) !== cust.order || cust.state !== 'waiting') fail('changed');
    if (!this.act(pass)) fail('take');
    this.release(pass);
    const table = cust.table;
    yield* this.walkTo(table);
    if (cust.state !== 'waiting') fail('customer left');
    if (!this.act(table)) fail('serve');
    this.g.today.staffServed++;
  }

  *clearTable(table) {
    this.taskName = 'clearTable';
    this.claim(table);
    this.s.status = 'broom';
    yield* this.walkTo(table);
    if (!this.act(table)) fail('nothing');
    this.release(table);
    if (!this.s.held) return;
    const sinks = this.stations((st) => (st.kind === 'sink' || st.kind === 'autowasher') && this.ia.canTransfer(st, this.s.held));
    const sink = this.nearest(sinks);
    if (!sink) fail('no sink');
    yield* this.walkTo(sink);
    if (!this.act(sink)) fail('sink');
  }

  *collect(table) {
    this.taskName = 'collect';
    this.claim(table);
    this.s.status = 'coin';
    yield* this.walkTo(table);
    table.collectCash();
  }
}

// ---------------------------------------------------------------------------
export class DishwasherBrain extends Brain {
  home() {
    const sink = this.grid.stations('sink')[0];
    return sink ? { x: sink.x, z: sink.z } : null;
  }

  pickTask() {
    const sinks = this.stations((st) => st.kind === 'sink' && this.free(st));
    const dirty = sinks.filter((st) => st.dirty > 0);
    if (dirty.length) return this.wash(this.nearest(dirty));
    const racks = this.stations((st) => st.kind === 'platerack');
    const clean = this.stations((st) => (st.kind === 'sink' || st.kind === 'autowasher') && this.free(st) && st.clean > 0);
    if (clean.length && racks.length) return this.restock(this.nearest(clean));
    const parked = this.stations((st) => (st.kind === 'counter' || st.kind === 'pass') && this.free(st) && st.item && st.item.kind === 'plate' && st.item.dirty);
    if (parked.length) return this.clearTable(this.nearest(parked));
    const hasWaiter = this.g.staff.members.some((m) => m.role === 'waiter');
    if (!hasWaiter) {
      const tables = this.stations((st) => st.kind === 'table' && this.free(st) && st.hasDirty());
      if (tables.length) return this.clearTable(this.nearest(tables));
    }
    return null;
  }

  *wash(sink) {
    this.taskName = 'wash';
    const s = this.s;
    this.claim(sink);
    s.status = 'sponge';
    yield* this.walkTo(sink);
    while (sink.dirty > 0) {
      const dt = (yield) || 0.016;
      if (!this.ia.work(s, sink, dt)) fail('wash');
      s.workingT = 0.2;
    }
    if (sink.clean > 0 && this.grid.stations('platerack').length) {
      s.held = sink.take(s, true);
      s.bounce(0.3);
      this.release(sink);
      const rack = this.nearest(this.stations((st) => st.kind === 'platerack'));
      if (!rack) return;
      yield* this.walkTo(rack);
      this.act(rack);
    }
  }

  *restock(src) {
    this.taskName = 'restock';
    const s = this.s;
    this.claim(src);
    s.status = 'cloche';
    yield* this.walkTo(src);
    if (src.clean <= 0) fail('gone');
    s.held = src.take(s, true);
    s.bounce(0.3);
    this.release(src);
    const rack = this.nearest(this.stations((st) => st.kind === 'platerack'));
    if (!rack) fail('no rack');
    yield* this.walkTo(rack);
    if (!this.act(rack)) fail('rack');
  }

  *clearTable(table) {
    this.taskName = 'clearTable';
    this.claim(table);
    this.s.status = 'broom';
    yield* this.walkTo(table);
    if (!this.act(table)) fail('nothing');
    this.release(table);
    if (!this.s.held) return;
    const sink = this.nearest(this.stations((st) => (st.kind === 'sink' || st.kind === 'autowasher') && this.ia.canTransfer(st, this.s.held)));
    if (!sink) fail('no sink');
    yield* this.walkTo(sink);
    if (!this.act(sink)) fail('sink');
  }
}

// ---------------------------------------------------------------------------
export class ChefBrain extends Brain {
  constructor(staff, game) {
    super(staff, game);
    this.tending = new Set();
  }

  home() {
    const crates = this.grid.stations('crate');
    if (!crates.length) return null;
    const c = crates[Math.floor(crates.length / 2)];
    return { x: c.x, z: c.z + 1.5 };
  }

  reset() {
    super.reset();
    for (const c of this.tending) if (c.reservedBy === this.s) c.reservedBy = null;
    this.tending.clear();
  }

  pickTask() {
    // 1. Tend cookers: rescue finished food & bin burnt food (fire prevention!)
    for (const ck of this.grid.stations('cooker')) {
      const it = ck.item;
      if (!it) {
        if (this.tending.has(ck)) {
          this.tending.delete(ck);
          if (ck.reservedBy === this.s) ck.reservedBy = null;
        }
        continue;
      }
      if (ck.fire > 0) continue;
      const mine = this.tending.has(ck);
      const other = ck.reservedBy && ck.reservedBy !== this.s ? ck.reservedBy : null;
      // A colleague who is busy elsewhere can't save it in time — step in
      const otherBusy = !other || !other.brain || other.brain.taskName !== 'rescue';
      const done = isCookOutput(ck.cookType, it);
      if (it.state === 'burnt' && otherBusy) return this.rescue(ck);
      if (mine && (done || it.cook > 0.55)) return this.rescue(ck);
      if (done && it.burn > 0.12 && otherBusy) return this.rescue(ck);
    }
    // 2. Free up clogged counters by binning leftovers nobody needs
    if (this.freeCounters().length < 2) {
      const stale = this.findStale();
      if (stale) return this.binStale(stale);
    }
    // 3. Head chefs plate complete dishes
    if (this.s.data.level >= 3) {
      const job = this.findPlating();
      if (job) return this.plate(job);
    }
    // 4. Prep what open orders still need
    const needs = computeNeeds(this.g, this);
    let keys = [...needs.keys()];
    // While something is on the heat, only take short jobs so we're back in time
    if (this.tending.size) keys = keys.filter((k) => { const c = chainFor(k); return !c.cooker && !c.toppings.length; });
    // Prioritise slow cooked items first so they start early
    keys.sort((a, b) => (chainFor(b).cooker ? 1 : 0) - (chainFor(a).cooker ? 1 : 0));
    for (const k of keys) {
      if (this.feasible(k)) return this.prep(k);
    }
    return null;
  }

  // Loose food / partial plates on counters that no open order can use
  findStale() {
    const orders = openOrders(this.g);
    const keys = new Set();
    for (const o of orders) {
      for (const part of DISHES[o.order].parts) {
        keys.add(part);
        for (const t of chainFor(part).toppings) keys.add(`${t}:chopped`);
      }
    }
    let best = null, bd = Infinity;
    for (const st of this.grid.stations()) {
      if ((st.kind !== 'counter' && st.kind !== 'pass') || !st.item || !this.free(st) || st.fire > 0) continue;
      const it = st.item;
      let useful;
      if (it.kind === 'plate') {
        if (it.dirty || !it.contents.length) continue;
        useful = orders.some((o) => it.contents.every((c) => DISHES[o.order].parts.includes(itemKey(c))));
      } else if (it.kind === 'ing') {
        useful = it.state !== 'burnt' && [...keys].some((k) => canBecome(it, k));
      } else continue;
      if (useful) continue;
      const d = this.dist(st);
      if (d < bd) { bd = d; best = st; }
    }
    return best;
  }

  *binStale(st) {
    this.taskName = 'cleanup';
    this.claim(st);
    this.s.status = 'trash';
    yield* this.walkTo(st);
    if (!st.item || !this.act(st)) fail('stale gone');
    this.release(st);
    const bin = this.nearest(this.stations((x) => x.kind === 'trash'));
    if (!bin) fail('no bin');
    yield* this.walkTo(bin);
    this.act(bin);
  }

  feasible(key) {
    const c = chainFor(key);
    const hasLoose = !!this.findLooseFor(key);
    const crates = this.stations((st) => st.kind === 'crate');
    if (!hasLoose && !crates.some((st) => st.ing === c.ing)) return false;
    if (c.chop && !this.stations((st) => st.kind === 'board' && this.free(st) && !st.item).length && !hasLoose) return false;
    if (c.cooker && !this.stations((st) => st.kind === 'cooker' && st.cookType === c.cooker && this.free(st) && !st.item).length) return false;
    for (const t of c.toppings) if (!crates.some((st) => st.ing === t)) return false;
    if (c.toppings.length && !this.freeCounters().length) return false;
    if (!c.cooker && !this.freeCounters().length) return false;
    return true;
  }

  freeCounters() {
    return this.stations((st) => st.kind === 'counter' && !st.item && this.free(st));
  }

  bestCounter() {
    const list = this.freeCounters();
    if (!list.length) return null;
    const passes = this.grid.stations('pass');
    const anchor = passes.length ? passes[0] : this.s.pos;
    return list.reduce((a, b) => {
      const da = Math.hypot(a.x - anchor.x, a.z - anchor.z) + this.dist(a) * 0.4;
      const db = Math.hypot(b.x - anchor.x, b.z - anchor.z) + this.dist(b) * 0.4;
      return da <= db ? a : b;
    });
  }

  // A loose item somewhere (counter / finished board) that can become `key`.
  // Items already in their final form only count when we want them as-is (e.g. pizza toppings) —
  // otherwise they're already counted as supply and moving them achieves nothing.
  findLooseFor(key, allowFinal = false) {
    let best = null, bestScore = Infinity;
    for (const st of this.grid.stations()) {
      if (!st.item || st.fire > 0 || !this.free(st)) continue;
      if (!['counter', 'board', 'pass', 'conveyor'].includes(st.kind)) continue;
      if (st.kind === 'board' && (chopInfo(st.item) || st.workT > 0)) continue;
      if (!canBecome(st.item, key)) continue;
      if (!allowFinal && itemKey(st.item) === key) continue;
      const progress = st.item.state === 'raw' ? 1 : 0;
      const score = this.dist(st) + progress * 3;
      if (score < bestScore) { bestScore = score; best = st; }
    }
    return best;
  }

  *obtain(key, allowFinal = false) {
    // Leaves the chef holding an item that can become `key`
    const c = chainFor(key);
    const loose = this.findLooseFor(key, allowFinal);
    if (loose) {
      this.claim(loose);
      yield* this.walkTo(loose);
      if (!loose.item || !canBecome(loose.item, key)) fail('loose gone');
      if (!this.act(loose)) fail('take loose');
      this.release(loose);
      return;
    }
    const crate = this.nearest(this.stations((st) => st.kind === 'crate' && st.ing === c.ing));
    if (!crate) fail('no crate');
    yield* this.walkTo(crate);
    if (!this.act(crate)) fail('crate');
  }

  *chopHeld() {
    const s = this.s;
    const boards = this.stations((st) => st.kind === 'board' && !st.item && this.free(st));
    const board = this.nearest(boards);
    if (!board) fail('no board');
    this.claim(board);
    s.status = 'knife';
    yield* this.walkTo(board);
    if (!this.act(board)) fail('board put');
    if (board.auto) {
      while (board.item && chopInfo(board.item)) yield;
    } else {
      while (board.item && chopInfo(board.item)) {
        const dt = (yield) || 0.016;
        if (!this.ia.work(s, board, dt)) fail('chop');
        s.workingT = 0.2;
      }
    }
    if (!board.item) fail('board emptied');
    if (!this.act(board)) fail('board take');
    this.release(board);
  }

  *prep(key) {
    this.taskName = 'prep';
    const s = this.s;
    const c = chainFor(key);
    this.target = key;
    s.status = c.cooker ? 'pan' : 'knife';
    yield* this.obtain(key);
    if (c.chop && chopInfo(s.held)) yield* this.chopHeld();
    if (c.toppings.length && s.held && s.held.state === 'base') {
      const counter = this.bestCounter();
      if (!counter) fail('no counter');
      this.claim(counter);
      yield* this.walkTo(counter);
      if (!this.act(counter)) fail('base down');
      for (const t of c.toppings) {
        if (!counter.item) fail('base stolen');
        if ((counter.item.toppings || []).includes(t)) continue;
        yield* this.obtain(`${t}:chopped`, true);
        if (chopInfo(s.held)) yield* this.chopHeld();
        yield* this.walkTo(counter);
        if (!counter.item || !canTop(counter.item, s.held)) fail('topping');
        if (!this.act(counter)) fail('topping put');
      }
      yield* this.walkTo(counter);
      if (!this.act(counter)) fail('base take');
      this.release(counter);
    }
    if (c.cooker && cookRule(c.cooker, s.held)) {
      const cookers = this.stations((st) => st.kind === 'cooker' && st.cookType === c.cooker && !st.item && this.free(st));
      const ck = this.nearest(cookers);
      if (!ck) fail('no cooker');
      this.claim(ck);
      s.status = 'pan';
      yield* this.walkTo(ck);
      if (!this.act(ck)) fail('cook put');
      // keep the reservation while it cooks — we'll be back
      this.claims = this.claims.filter((x) => x !== ck);
      this.tending.add(ck);
      return;
    }
    yield* this.deposit();
  }

  *deposit() {
    const counter = this.bestCounter();
    if (!counter) fail('no counter');
    this.claim(counter);
    yield* this.walkTo(counter);
    if (!this.act(counter)) fail('deposit');
  }

  *rescue(ck) {
    this.taskName = 'rescue';
    const s = this.s;
    ck.reservedBy = s;
    this.tending.add(ck);
    this.claims.push(ck);
    s.status = 'timer';
    yield* this.walkTo(ck);
    let wait = 0;
    while (ck.item && ck.item.state !== 'burnt' && !isCookOutput(ck.cookType, ck.item)) {
      wait += (yield) || 0.016;
      if (wait > 12) fail('slow cook');
    }
    this.tending.delete(ck);
    if (!ck.item) return;
    if (!this.act(ck)) fail('take cooked');
    this.release(ck);
    if (s.held && s.held.state === 'burnt') {
      const bin = this.nearest(this.stations((st) => st.kind === 'trash'));
      if (!bin) fail('no bin');
      yield* this.walkTo(bin);
      this.act(bin);
      return;
    }
    yield* this.deposit();
  }

  findPlating() {
    const g = this.g;
    const orders = openOrders(g).filter((c) => !c.platedBy && !c.claimedBy);
    if (!orders.length) return null;
    const plates = worldItems(g).filter((w) => w.item.kind === 'plate' && !w.item.dirty && w.item.contents.length);
    orders.sort((a, b) => (b.critic ? 1 : 0) - (a.critic ? 1 : 0) || a.patience - b.patience);
    const passes = this.stations((st) => st.kind === 'pass' && !st.item && this.free(st));
    if (!passes.length) return null;
    const plateSrc = this.nearest(this.stations((st) => (st.kind === 'platerack' && st.count > 0) || ((st.kind === 'sink' || st.kind === 'autowasher') && st.clean > 0)));
    if (!plateSrc) return null;
    for (const cust of orders) {
      if (plates.some((w) => matchDish(w.item) === cust.order)) continue;
      const used = new Set();
      const sources = [];
      let ok = true;
      for (const part of DISHES[cust.order].parts) {
        let found = null;
        for (const st of this.grid.stations()) {
          if (used.has(st) || !st.item || st.fire > 0 || !this.free(st)) continue;
          if (!['counter', 'board', 'cooker', 'conveyor'].includes(st.kind)) continue;
          if (itemKey(st.item) !== part) continue;
          if (st.kind === 'cooker' && !isCookOutput(st.cookType, st.item)) continue;
          if (!found || this.dist(st) < this.dist(found)) found = st;
        }
        if (!found) { ok = false; break; }
        used.add(found);
        sources.push(found);
      }
      if (ok) return { cust, sources, plateSrc, pass: this.nearest(passes) };
    }
    return null;
  }

  *plate(job) {
    this.taskName = 'plate';
    const s = this.s;
    const { cust, sources, plateSrc, pass } = job;
    cust.platedBy = s;
    this.claims.push(cust);
    for (const st of sources) this.claim(st);
    this.claim(pass);
    s.status = 'cloche';
    yield* this.walkTo(plateSrc);
    if (!this.act(plateSrc)) fail('no plate');
    for (const st of sources) {
      yield* this.walkTo(st);
      if (!this.ia.canScoop(s.held, st)) fail('part gone');
      if (!this.act(st)) fail('scoop');
      this.release(st);
      this.tending.delete(st);
    }
    yield* this.walkTo(pass);
    if (!this.act(pass)) fail('pass');
  }
}

export function createBrain(staff, game) {
  if (staff.role === 'chef') return new ChefBrain(staff, game);
  if (staff.role === 'waiter') return new WaiterBrain(staff, game);
  return new DishwasherBrain(staff, game);
}

