// Staff roster: hiring, firing, levelling and the per-frame update of AI employees.

import { Staff } from './entities.js';
import { createBrain } from './ai.js';
import { STAFF_TYPES, STAFF_UPGRADE_COST, MAX_STAFF, ROLE_BOOST } from './catalog.js';
import { FIRST_NAMES, pick, randInt } from './utils.js';

export class StaffManager {
  constructor(game) {
    this.game = game;
    this.members = [];
  }

  get roster() { return this.game.state.staff; }

  load() {
    this.clear();
    for (const d of this.roster) this.spawn(d);
  }

  clear() {
    for (const m of this.members) m.dispose();
    this.members = [];
  }

  spawn(d) {
    const s = new Staff(this.game, d);
    s.brain = createBrain(s, this.game);
    this.members.push(s);
    const spot = this.game.freeTileNear(this.game.grid.W / 2, this.game.grid.H / 2);
    if (spot) s.setPos(spot.x + 0.5, spot.z + 0.5);
    return s;
  }

  // A support role's bonus (musician, mascot, manager), from the best-trained one on the team
  boost(role, key) {
    let lv = 0;
    for (const d of this.roster) if (d.role === role) lv = Math.max(lv, d.level);
    return lv ? ROLE_BOOST[role][key][lv - 1] : 0;
  }

  wage(d) {
    return Math.round(STAFF_TYPES[d.role].wage * (1 + (d.level - 1) * 0.35));
  }

  totalWages() {
    return this.roster.reduce((a, d) => a + this.wage(d), 0);
  }

  upgradeCost(d) {
    return d.level >= 3 ? null : Math.round(STAFF_UPGRADE_COST[d.level] * (STAFF_TYPES[d.role].hire / 200));
  }

  hire(role) {
    const g = this.game;
    const T = STAFF_TYPES[role];
    if (this.roster.length >= MAX_STAFF) return { ok: false, msg: `Staff room is full (max ${MAX_STAFF})` };
    if (!g.spend(T.hire)) return { ok: false, msg: 'Not enough cash' };
    const used = new Set(this.roster.map((d) => d.name));
    const names = FIRST_NAMES.filter((n) => !used.has(n));
    const d = { id: `s${Date.now().toString(36)}${randInt(0, 999)}`, role, name: pick(names.length ? names : FIRST_NAMES), level: 1, seed: randInt(1, 99999) };
    this.roster.push(d);
    const s = this.spawn(d);
    s.cheer = 1.5;
    g.audio.levelUp();
    g.particles.confetti(s.pos.x, 1.2, s.pos.z, 24);
    g.save();
    return { ok: true, member: d };
  }

  // Rebuild a worker's character after their look changed, in the same spot
  restyle(id) {
    const i = this.members.findIndex((s) => s.data.id === id);
    if (i < 0) return;
    const old = this.members[i];
    const s = new Staff(this.game, old.data);
    s.brain = createBrain(s, this.game);
    s.setPos(old.pos.x, old.pos.z);
    s.facing = s.targetFacing = old.facing;
    s.cheer = 1.2;
    old.dispose();
    this.members[i] = s;
  }

  fire(id) {
    const i = this.roster.findIndex((d) => d.id === id);
    if (i < 0) return;
    this.roster.splice(i, 1);
    const m = this.members.find((s) => s.data.id === id);
    if (m) {
      this.game.particles.poof(m.pos.x, 0.6, m.pos.z, '#ffffff', 12);
      m.dispose();
      this.members = this.members.filter((s) => s !== m);
    }
    this.game.save();
  }

  upgrade(id) {
    const g = this.game;
    const d = this.roster.find((x) => x.id === id);
    if (!d) return { ok: false };
    const cost = this.upgradeCost(d);
    if (cost === null) return { ok: false, msg: 'Already a Master' };
    if (!g.spend(cost)) return { ok: false, msg: 'Not enough cash' };
    d.level++;
    const m = this.members.find((s) => s.data.id === id);
    if (m) {
      m.applyLevel();
      m.cheer = 1.5;
      g.particles.confetti(m.pos.x, 1.2, m.pos.z, 30);
    }
    g.audio.levelUp();
    g.save();
    return { ok: true };
  }

  startDay() {
    const g = this.game;
    const taken = [];
    for (const m of this.members) {
      m.brain.reset();
      m.held = null;
      m.sitting = false;
      const home = m.brain.home() || { x: g.grid.W / 2, z: g.grid.H / 2 };
      const spot = g.freeTileNear(home.x, home.z, taken);
      if (spot) {
        taken.push(spot);
        m.setPos(spot.x + 0.5, spot.z + 0.5);
      }
    }
  }

  endDay() {
    for (const m of this.members) {
      m.brain.reset();
      m.held = null;
      m.cheer = 2;
    }
  }

  update(dt, active) {
    const g = this.game;
    const rush = 1 + this.boost('manager', 'speed');
    for (const m of this.members) {
      const k = m.role === 'manager' ? 1 : rush;
      m.speed = m.baseSpeed * k;
      m.chopRate = m.washRate = m.baseWork * k;
      if (active) m.brain.update(dt);
      else {
        m.vel.set(0, 0, 0);
        if (g.grid.isSolid(m.tileX, m.tileZ)) {
          const spot = g.freeTileNear(m.pos.x, m.pos.z);
          if (spot) m.setPos(spot.x + 0.5, spot.z + 0.5);
        }
      }
    }
  }
}
