// Customer flow: street arrivals, the queue outside, seating via A*, ordering with patience,
// eating, paying & tipping, reviews, VIP food critics, and ambient passers-by.

import { Customer, Character } from './entities.js';
import { findPath } from './ai.js';
import { DISHES, dishBasePatience } from './recipes.js';
import { randomCustomerLook } from './models.js';
import { rand, pick, weightedPick, clamp } from './utils.js';
import { DAY } from './config.js';

export class CustomerManager {
  constructor(game) {
    this.game = game;
    this.groups = [];
    this.queue = [];
    this.passersby = [];
    this.spawnT = 4;
    this.passT = 1;
    this.forced = [];
    this.criticTime = null;
    this.criticSpawned = false;
    this.warnedMenu = 0;
    this.nextId = 1;
  }

  get grid() { return this.game.grid; }
  get sidewalkZ() { return this.grid.H + 1.55; }
  get doorOut() { return { x: this.grid.doorX + 0.5, z: this.grid.H + 0.7 }; }
  get doorIn() { return { x: this.grid.doorX + 0.5, z: this.grid.H - 0.5 }; }

  allCustomers() {
    const out = [];
    for (const gr of this.groups) for (const c of gr.members) if (!c.gone) out.push(c);
    return out;
  }

  get presentGroups() { return this.groups.filter((g) => g.state !== 'leaving').length; }
  isEmpty() { return this.groups.length === 0; }
  insideCount() { return this.groups.filter((g) => g.state === 'seated').length; }

  startDay() {
    this.clear(false);
    const g = this.game;
    this.spawnT = g.state.day === 1 ? 4 : 2.5;
    this.forced = g.state.day === 1 && !g.state.settings.tutorialDone ? ['salad', 'salad'] : [];
    this.criticSpawned = false;
    this.criticTime = g.state.day >= 2 && g.state.rating >= 1.6 && Math.random() < 0.65 ? rand(11.5, 18.5) : null;
    this.warnedMenu = 0;
  }

  clear(keepPassers = true) {
    for (const gr of this.groups) for (const c of gr.members) c.dispose();
    this.groups = [];
    this.queue = [];
    if (!keepPassers) {
      for (const p of this.passersby) p.dispose();
      this.passersby = [];
    }
  }

  spawnInterval() {
    const g = this.game;
    const r = g.state.rating;
    let t = 15 - 1.6 * (r - 1);
    const h = g.clock;
    if (h > 11.5 && h < 13.5) t *= 0.72;
    if (h > 17.5 && h < 19.5) t *= 0.65;
    t *= 1 - 0.15 * g.ambience;
    if (g.state.day === 1) t *= 1.3;
    else if (g.state.day === 2) t *= 1.1;
    return Math.max(5, t);
  }

  update(dt) {
    const g = this.game;
    if (g.phase === 'day') {
      const seating = g.clock < DAY.lastSeatingHour;
      if (seating) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = this.spawnInterval() * rand(0.75, 1.25);
          if (this.presentGroups < g.upg('capacity')) this.spawnGroup(false);
        }
        if (this.criticTime !== null && !this.criticSpawned && g.clock >= this.criticTime) {
          this.criticSpawned = true;
          this.spawnGroup(true);
        }
      }
      if (g.clock >= DAY.closeHour) {
        for (const gr of [...this.groups]) if (gr.state === 'arriving' || gr.state === 'queue') this.leaveGroup(gr, 'closing');
      }
      if (g.clock >= DAY.forceLeaveHour) {
        for (const gr of [...this.groups]) if (gr.state === 'seated') this.finishGroup(gr, true);
      }
    }
    for (const gr of [...this.groups]) this.updateGroup(gr, dt);
    this.updateQueue(dt);
    this.updatePassers(dt);
    for (const c of this.allCustomers()) {
      c.updateVisual(dt);
      if (c.critic && Math.random() < dt * 10) g.particles.sparkle(c.pos.x, c.sitting ? 0.9 : 0.6, c.pos.z, '#ffd700');
      if (c.aura) c.aura.rotation.y += dt;
    }
    // Door animation
    const d = this.doorOut;
    let near = false;
    for (const c of this.allCustomers()) {
      if (Math.abs(c.pos.x - d.x) < 0.9 && Math.abs(c.pos.z - (this.grid.H)) < 1.1) { near = true; break; }
    }
    g.renderer.setDoorOpen(near);
  }

  // ------------------------------------------------------------- spawning
  pickDish(critic) {
    const g = this.game;
    const dishes = g.availableDishes();
    if (!dishes.length) return null;
    while (this.forced.length && !dishes.includes(this.forced[0])) this.forced.shift();
    if (!critic && this.forced.length) return this.forced.shift();
    if (critic) {
      const sorted = dishes.slice().sort((a, b) => DISHES[b].price - DISHES[a].price);
      return pick(sorted.slice(0, 2));
    }
    const r = g.state.rating;
    return weightedPick(dishes, (d) => 1 + (DISHES[d].price / 40) * (r - 1) * 0.4);
  }

  spawnGroup(critic) {
    const g = this.game;
    if (!g.availableDishes().length) {
      if (g.time - this.warnedMenu > 20) {
        this.warnedMenu = g.time;
        g.ui.toast('⚠️ Nothing on your menu can be made! Check crates & stations.', 'danger');
      }
      return;
    }
    const tables = this.grid.stations('table');
    if (!tables.length) return;
    const maxSeats = Math.max(...tables.map((t) => t.seats.length));
    let size = 1;
    if (!critic) {
      const opts = [1, 2, 3, 4].filter((n) => n <= maxSeats);
      size = weightedPick(opts, (n) => ({ 1: 0.5, 2: 0.36, 3: 0.08, 4: 0.08 })[n]);
    }
    const gr = { id: this.nextId++, members: [], table: null, state: 'arriving', critic, queueT: 0, queueMax: 32, fromLeft: Math.random() < 0.5 };
    const startX = gr.fromLeft ? -10 : this.grid.W + 10;
    for (let i = 0; i < size; i++) {
      const c = new Customer(g, gr, critic);
      c.setPos(startX + (gr.fromLeft ? -i * 0.7 : i * 0.7), this.sidewalkZ + rand(-0.25, 0.25));
      c.targetFacing = c.facing = gr.fromLeft ? Math.PI / 2 : -Math.PI / 2;
      gr.members.push(c);
    }
    this.groups.push(gr);
    if (critic) {
      g.audio.critic();
      g.ui.toast('🧐 A VIP FOOD CRITIC is on the way! Impress them for a huge bonus!', 'gold');
      g.events.emit('critic');
    }
  }

  findTable(n) {
    const tables = this.grid.stations('table').filter((t) => t.isFree(n));
    if (!tables.length) return null;
    tables.sort((a, b) => a.seats.length - b.seats.length || Math.random() - 0.5);
    return tables[0];
  }

  // ------------------------------------------------------------- movement
  steer(c, x, z, dt, speed = c.speed) {
    const dx = x - c.pos.x, dz = z - c.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.06) {
      c.vel.set(0, 0, 0);
      return true;
    }
    const sp = speed * Math.min(1, d / 0.4 + 0.25);
    c.vel.x = (dx / d) * sp;
    c.vel.z = (dz / d) * sp;
    c.pos.x += c.vel.x * dt;
    c.pos.z += c.vel.z * dt;
    c.targetFacing = Math.atan2(dx, dz);
    return d < 0.15;
  }

  updateGroup(gr, dt) {
    if (gr.state === 'arriving') {
      const base = this.doorOut;
      let leaderNear = false;
      gr.members.forEach((c, i) => {
        const tx = base.x + (gr.fromLeft ? -1 : 1) * (0.6 + i * 0.55), tz = this.sidewalkZ - 0.2;
        const arrived = this.steer(c, tx, tz, dt);
        if (i === 0 && arrived) leaderNear = true;
      });
      if (leaderNear) this.decide(gr);
    }
    for (const c of gr.members) this.updateCustomer(c, gr, dt);
    if (gr.state === 'seated') {
      const done = gr.members.every((c) => c.state === 'done');
      if (done) this.finishGroup(gr, false);
    }
    if (gr.state === 'leaving' && gr.members.every((c) => c.gone)) {
      for (const c of gr.members) c.dispose();
      this.groups = this.groups.filter((x) => x !== gr);
    }
  }

  decide(gr) {
    const table = this.findTable(gr.members.length);
    if (table && this.queue.length === 0) this.seatGroup(gr, table);
    else if (this.queue.length < 4) {
      gr.state = 'queue';
      gr.queueT = 0;
      this.queue.push(gr);
      const c = gr.members[0];
      this.game.particles.emoji(c.pos.x, 2.1, c.pos.z, '⏳');
    } else {
      this.game.today.turnedAway += gr.members.length;
      const c = gr.members[0];
      this.game.particles.emoji(c.pos.x, 2.1, c.pos.z, '😞');
      this.leaveGroup(gr, 'full');
    }
  }

  updateQueue(dt) {
    const g = this.game;
    this.queue = this.queue.filter((gr) => gr.state === 'queue');
    this.queue.forEach((gr, qi) => {
      gr.queueT += dt;
      const bx = this.grid.doorX + 0.5 - 1.4 - qi * 1.3;
      gr.members.forEach((c, i) => {
        this.steer(c, bx - (i % 2) * 0.48, this.sidewalkZ - 0.1 + (i > 1 ? 0.5 : 0), dt);
        c.targetFacing = Math.PI / 2;
        c.setMood(gr.queueT > gr.queueMax * 0.6 ? 'frown' : 'smile');
      });
      if (gr.queueT > gr.queueMax) {
        g.today.lost += gr.members.length;
        for (const c of gr.members) g.particles.emoji(c.pos.x, 2.1, c.pos.z, '😤');
        for (let i = 0; i < gr.members.length; i++) g.applyReview(2, 0.012);
        this.leaveGroup(gr, 'impatient');
      }
    });
    const first = this.queue[0];
    if (first && g.phase === 'day') {
      const table = this.findTable(first.members.length);
      if (table) {
        this.queue.shift();
        this.seatGroup(first, table);
      }
    }
  }

  seatGroup(gr, table) {
    const g = this.game;
    gr.state = 'seated';
    gr.table = table;
    table.group = gr;
    const out = this.doorOut, inn = this.doorIn;
    let ok = true;
    gr.members.forEach((c, i) => {
      const seat = table.seats[i];
      seat.customer = c;
      c.seat = seat;
      c.table = table;
      const p = findPath(this.grid, inn.x, inn.z, [{ x: seat.cell.x, z: seat.cell.z }], { endX: seat.x, endZ: seat.z });
      if (!p) { ok = false; return; }
      c.setPath([{ x: out.x + (i - (gr.members.length - 1) / 2) * 0.3, z: out.z + 0.3 }, { x: out.x, z: out.z - 0.2 }, inn, ...p]);
      c.state = 'entering';
    });
    if (!ok) {
      this.leaveGroup(gr, 'blocked');
      g.ui.toast("⚠️ Customers couldn't reach a table — check your layout!", 'danger');
      return;
    }
    g.audio.bell();
    g.events.emit('seated', gr);
  }

  patienceMult(c) {
    const g = this.game;
    let m = g.upg('patience') * (1 + g.ambience * 0.35) * (c.table?.def.patience || 1);
    if (g.state.day === 1) m *= 1.35;
    else if (g.state.day === 2) m *= 1.15;
    if (c.critic) m *= 0.85;
    for (const o of this.grid.objects) {
      if (o.type === 'lamp' && Math.hypot(o.cx - c.pos.x, o.cz - c.pos.z) < 2.6) { m *= 1.1; break; }
    }
    for (const o of this.grid.objects) {
      if (o.type === 'jukebox' && Math.hypot(o.cx - c.pos.x, o.cz - c.pos.z) < 4) { m *= 1.05; break; }
    }
    return m;
  }

  updateCustomer(c, gr, dt) {
    const g = this.game;
    switch (c.state) {
      case 'entering': {
        const r = c.followPath(dt, c.speed);
        if (r === 'arrived') {
          c.sitting = true;
          c.setPos(c.seat.x, c.seat.z);
          c.targetFacing = c.facing = c.seat.face;
          c.state = 'seated';
          c.thinkT = rand(1.2, 2.6);
          c.bounce(0.4);
        }
        break;
      }
      case 'seated': {
        c.thinkT -= dt;
        c.targetFacing = c.seat.face;
        if (c.thinkT <= 0) this.placeOrder(c);
        break;
      }
      case 'waiting': {
        const drain = g.fire.count > 0 ? 1.5 : 1;
        const before = c.patience;
        c.patience -= (dt / c.patienceMax) * drain;
        if (before > 0.5 && c.patience <= 0.5) g.particles.emoji(c.pos.x, 2.0, c.pos.z, '😐');
        if (before > 0.25 && c.patience <= 0.25) {
          g.particles.emoji(c.pos.x, 2.0, c.pos.z, '😠');
          g.audio.angry();
        }
        c.setMood(c.patience > 0.5 ? 'smile' : c.patience > 0.25 ? 'open' : 'frown');
        c.emoteT -= dt;
        if (c.patience <= 0) this.leaveGroup(gr, 'angry');
        break;
      }
      case 'eating': {
        c.eatProgress += dt / c.eatTime;
        c.eatAnim = 1;
        if (Math.random() < dt * 3) g.audio.munch();
        if (c.eatProgress >= 1) {
          c.eatAnim = 0;
          const pl = c.seat?.plate;
          if (pl) {
            pl.dirty = true;
            pl.contents = [];
            pl.ver++;
          }
          c.state = 'done';
          c.ate = true;
          c.setMood('smile');
          g.particles.emoji(c.pos.x, 2.0, c.pos.z, pick(['😋', '🤤', '👌', '💯']));
        }
        break;
      }
      case 'leaving': {
        const r = c.followPath(dt, c.speed * 1.05);
        if (r === 'arrived' || r === 'none') c.gone = true;
        c.root.visible = !c.gone;
        break;
      }
      default:
        break;
    }
  }

  placeOrder(c) {
    const g = this.game;
    const dish = this.pickDish(c.critic);
    if (!dish) {
      this.leaveGroup(c.group, 'menu');
      return;
    }
    c.order = dish;
    c.patienceMax = dishBasePatience(dish) * this.patienceMult(c);
    c.patience = 1;
    c.state = 'waiting';
    g.orders.add(c);
    g.audio.pickup();
    g.events.emit('ordered', c);
  }

  onServed(c, plate) {
    const g = this.game;
    if (c.state !== 'waiting') return;
    const used = 1 - c.patience;
    let score = used < 0.3 ? 5 : used < 0.55 ? 4 : used < 0.8 ? 3 : 2;
    if (score < 5 && g.ambience > 0.55) score += 0.5;
    c.review = score;
    c.state = 'eating';
    c.eatProgress = 0;
    c.eatTime = rand(4.5, 6.5);
    c.claimedBy = null;
    for (const ct of plate.contents) ct.hot = Math.max(ct.hot || 0, g.time + 6);
    g.orders.complete(c.ticket);
    g.today.served++;
    g.particles.emoji(c.pos.x, 2.0, c.pos.z, score >= 4.5 ? '😍' : score >= 4 ? '😋' : '🙂', true);
    g.particles.sparkle(c.pos.x, 1.2, c.pos.z);
    g.audio.happy();
    c.setMood('open');
    c.bounce(0.6);
    g.events.emit('served', { customer: c, dish: c.order });
  }

  finishGroup(gr, forced) {
    const g = this.game;
    if (gr.state !== 'seated') return;
    let total = 0;
    for (const c of gr.members) {
      if (c.state === 'eating' && forced) { c.ate = true; }
      if (!c.ate) {
        if (forced && c.order) {
          // Kicked out at closing time without their food
          g.today.lost++;
          g.applyReview(2, 0.02);
        }
        continue;
      }
      const price = DISHES[c.order].price;
      const tipPct = clamp((c.review - 2.5) * 0.09 + g.ambience * 0.12 + (g.state.rating - 1) * 0.02, 0, 0.6);
      const tip = Math.round(price * tipPct);
      total += price + tip;
      g.today.revenue += price;
      g.today.tips += tip;
      g.particles.starsText(c.pos.x, 2.25, c.pos.z, c.review);
      g.applyReview(c.review, c.critic ? 0.15 : 0.025);
      if (c.critic) this.criticVerdict(c, true);
    }
    if (total > 0 && gr.table) {
      gr.table.cash += total;
      g.audio.coin();
    }
    this.leaveGroup(gr, forced ? 'closing' : 'happy');
  }

  criticVerdict(c, served) {
    const g = this.game;
    if (served && c.review >= 4) {
      const bonus = 100 + 25 * g.state.day;
      g.addCash(bonus, c.pos.x, 2.4, c.pos.z);
      g.today.criticBonus += bonus;
      g.today.critic = 'wowed';
      g.state.stats.criticsWowed++;
      g.particles.confetti(c.pos.x, 1.6, c.pos.z, 50);
      g.audio.fanfare();
      g.ui.toast(`🌟 The critic RAVED! +$${bonus} bonus & a glowing review!`, 'gold');
    } else if (served) {
      g.today.critic = 'meh';
      g.ui.toast('🧐 The critic was... unimpressed. Faster service next time!', 'warn');
    } else {
      g.today.critic = 'angry';
      g.ui.toast('😤 The critic stormed out! That review is going to sting.', 'danger');
    }
  }

  leaveGroup(gr, reason) {
    const g = this.game;
    if (gr.state === 'leaving') return;
    const wasSeated = gr.state === 'seated';
    gr.state = 'leaving';
    this.queue = this.queue.filter((x) => x !== gr);
    const H = this.grid.H;
    const out = this.doorOut;
    const edgeX = gr.fromLeft ? this.grid.W + 12 : -12;
    if (reason === 'angry' && gr.table) {
      // Guests who already got their food still pay for it (no tip) before storming out with the group
      let paid = 0;
      for (const c of gr.members) {
        if (!c.order || !(c.ate || c.state === 'eating' || c.state === 'done')) continue;
        paid += DISHES[c.order].price;
        g.applyReview(c.review, c.critic ? 0.15 : 0.025);
      }
      if (paid) {
        gr.table.cash += paid;
        g.today.revenue += paid;
      }
    }
    gr.members.forEach((c, i) => {
      if (c.ticket && c.ticket.state === 'open') g.orders.fail(c.ticket);
      if (reason === 'angry' && (c.state === 'waiting' || c.state === 'seated')) {
        g.particles.emoji(c.pos.x, 2.0, c.pos.z, '💢', true);
        g.applyReview(1, c.critic ? 0.2 : 0.035);
        g.today.lost++;
        c.setMood('frown');
        if (c.critic) this.criticVerdict(c, false);
      } else if (reason === 'happy' || reason === 'closing') {
        if (reason === 'happy' && Math.random() < 0.5) g.particles.emoji(c.pos.x, 2.0, c.pos.z, pick(['💖', '👋', '🥰']));
      }
      if (c.seat) {
        const pl = c.seat.plate;
        if (pl && !pl.dirty) {
          pl.dirty = true;
          pl.contents = [];
          pl.ver++;
        }
        c.seat.customer = null;
      }
      c.claimedBy = null;
      c.platedBy = null;
      c.sitting = false;
      c.eatAnim = 0;
      const tail = [
        { x: out.x, z: out.z + 0.2 },
        { x: out.x + (gr.fromLeft ? 1 : -1) * 1.2, z: this.sidewalkZ + rand(-0.2, 0.3) },
        { x: edgeX + (gr.fromLeft ? i : -i) * 0.6, z: this.sidewalkZ + rand(-0.3, 0.3) },
      ];
      let path = tail.slice(1);
      if (wasSeated && c.pos.z < H) {
        const inn = this.doorIn;
        const p = findPath(this.grid, c.pos.x, c.pos.z, [{ x: this.grid.doorX, z: H - 1 }], { endX: inn.x, endZ: inn.z });
        path = [...(p || [inn]), ...tail];
      }
      c.setPath(path);
      c.state = 'leaving';
    });
    if (gr.table) {
      gr.table.group = null;
      gr.table = null;
    }
    if (wasSeated) g.audio.doorClose();
  }

  // ------------------------------------------------------------- ambience
  updatePassers(dt) {
    const g = this.game;
    this.passT -= dt;
    const max = g.phase === 'day' ? 5 : 2;
    if (this.passT <= 0) {
      this.passT = g.phase === 'day' ? rand(2.5, 6) : rand(6, 12);
      if (this.passersby.length < max) {
        const p = new Character(g, randomCustomerLook());
        const left = Math.random() < 0.5;
        const z = this.grid.H + rand(2.0, 2.5);
        p.setPos(left ? -14 : this.grid.W + 14, z);
        p.setPath([{ x: left ? this.grid.W + 14 : -14, z: z + rand(-0.2, 0.2) }]);
        p.speed = rand(1.4, 2.2);
        this.passersby.push(p);
      }
    }
    for (const p of [...this.passersby]) {
      const r = p.followPath(dt, p.speed);
      p.updateVisual(dt);
      if (r !== 'moving') {
        p.dispose();
        this.passersby = this.passersby.filter((x) => x !== p);
      }
    }
  }
}
