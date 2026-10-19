// Daily goals: three small targets each service with cash rewards, plus a bonus for all three.
// Progress goals pay out the moment they're reached; "keep it clean" goals pay at closing.

import { DISHES } from './recipes.js';
import { pick, rand } from './utils.js';

export class Goals {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.ver = 0;
    this.dishCount = {};
    game.events.on('served', (e) => {
      if (!e || !e.dish) return;
      this.dishCount[e.dish] = (this.dishCount[e.dish] || 0) + 1;
    });
  }

  start() {
    const g = this.game;
    const day = g.state.day;
    const reward = (k) => Math.round((25 + day * 7) * k / 5) * 5;
    const pool = [];
    const serve = Math.min(30, 5 + Math.round(day * 1.6));
    pool.push({ id: 'serve', icon: 'check', text: `Serve ${serve} guests`, target: serve, value: (t) => t.served, reward: reward(1) });
    const earn = Math.round((60 + day * 30) / 10) * 10;
    pool.push({ id: 'revenue', icon: 'coin', text: `Sell $${earn} of food`, target: earn, value: (t) => t.revenue, reward: reward(1.1) });
    const tips = Math.round((12 + day * 6) / 5) * 5;
    pool.push({ id: 'tips', icon: 'heart', text: `Earn $${tips} in tips`, target: tips, value: (t) => t.tips, reward: reward(1) });
    if (g.grid.stations('drivethru').length) {
      const n = Math.min(10, 2 + Math.floor(day / 3));
      pool.push({ id: 'drive', icon: 'car', text: `Serve ${n} drive-thru cars`, target: n, value: (t) => t.driveThru || 0, reward: reward(1.2) });
    }
    const dishes = g.availableDishes();
    if (dishes.length > 1) {
      const d = pick(dishes);
      const n = Math.min(8, 2 + Math.floor(day / 2));
      pool.push({ id: 'dish', icon: 'cloche', text: `Serve ${n} ${DISHES[d].name}`, target: n, value: () => this.dishCount[d] || 0, reward: reward(1.1) });
    }
    if (day >= 2) pool.push({ id: 'nofire', icon: 'fire', text: 'No kitchen fires', end: true, fails: (t) => t.fires > 0, reward: reward(0.9) });
    if (day >= 2) pool.push({ id: 'nolost', icon: 'exit', text: 'At most 1 guest walks out', end: true, fails: (t) => t.lost > 1, reward: reward(1.2) });
    // Always one "serve" style goal, then two others at random
    const first = pool[0];
    const rest = pool.slice(1).sort(() => rand(-1, 1));
    this.list = [first, ...rest.slice(0, 2)].map((x) => ({ ...x, state: 'open' }));
    this.dishCount = {};
    this.bonusPaid = false;
    this.ver++;
  }

  clear() {
    this.list = [];
    this.ver++;
  }

  progress(goal) {
    const t = this.game.today;
    if (goal.end) return goal.state === 'done' ? 1 : goal.state === 'failed' ? 0 : 0.5;
    return Math.min(1, goal.value(t) / goal.target);
  }

  update() {
    const g = this.game;
    const t = g.today;
    for (const goal of this.list) {
      if (goal.state !== 'open') continue;
      if (goal.end) {
        if (goal.fails(t)) {
          goal.state = 'failed';
          this.ver++;
          g.ui.toast(`Goal missed: ${goal.text}`, 'warn', goal.icon);
        }
      } else if (goal.value(t) >= goal.target) this.complete(goal);
    }
  }

  complete(goal) {
    const g = this.game;
    goal.state = 'done';
    this.ver++;
    g.state.cash += goal.reward;
    g.today.goalCash = (g.today.goalCash || 0) + goal.reward;
    g.audio.complete();
    g.ui.toast(`Goal done: ${goal.text}. +$${goal.reward}`, 'gold', goal.icon);
    this.checkBonus();
  }

  checkBonus() {
    const g = this.game;
    if (this.bonusPaid || !this.list.length || !this.list.every((x) => x.state === 'done')) return;
    this.bonusPaid = true;
    const bonus = Math.round(this.list.reduce((a, x) => a + x.reward, 0) * 0.5 / 5) * 5;
    g.state.cash += bonus;
    g.today.goalCash = (g.today.goalCash || 0) + bonus;
    g.particles.confetti(g.player.pos.x, 2, g.player.pos.z, 60);
    g.audio.fanfare();
    g.ui.toast(`All three goals done! Bonus +$${bonus}`, 'gold', 'crown');
  }

  // At closing: the "keep it clean" goals that never failed are won
  finish() {
    for (const goal of this.list) if (goal.state === 'open' && goal.end) this.complete(goal);
  }
}
