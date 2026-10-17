// First-day guided tutorial: contextual hints plus a bouncing 3D pointer over the next station.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { matchDish } from './recipes.js';

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.step = 0;
    this.t = 0;
    this.flags = {};
    const ev = game.events;
    ev.on('dash', () => { this.flags.dash = true; });
    ev.on('chopped', (e) => { this.flags[`chop:${e.item.id}`] = true; });
    ev.on('served', () => { this.flags.served = true; });
    ev.on('washed', () => { this.flags.washed = true; });
    ev.on('cleared', () => { this.flags.cleared = true; });
  }

  start() {
    const s = this.game.state;
    if (s.settings.tutorialDone) return;
    this.active = true;
    this.step = 0;
    this.t = 0;
    this.flags = {};
  }

  skip() {
    this.finish();
    this.game.audio.click();
  }

  finish() {
    this.active = false;
    this.game.state.settings.tutorialDone = true;
    this.game.ui.setHint(null);
    this.game.renderer.setPointer(null);
  }

  stationPos(pred) {
    const g = this.game;
    const list = g.grid.stations().filter(pred);
    if (!list.length) return null;
    const pl = g.player.pos;
    list.sort((a, b) => Math.hypot(a.x - pl.x, a.z - pl.z) - Math.hypot(b.x - pl.x, b.z - pl.z));
    const st = list[0];
    return new THREE.Vector3(st.x, Math.max(1.1, st.topY + 0.5), st.z);
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    if (g.phase !== 'day' && g.phase !== 'countdown') {
      g.ui.setHint(null);
      g.renderer.setPointer(null);
      return;
    }
    this.t += dt;
    const pl = g.player;
    const held = pl.held;
    let hint = null;
    let ptr = null;
    const next = () => { this.step++; this.t = 0; g.audio.pickup(); };
    switch (this.step) {
      case 0:
        hint = '👋 Welcome, Chef! Move with <kbd>WASD</kbd> and dash with <kbd>Shift</kbd> or <kbd>Space</kbd>.';
        if ((pl.moved > 3 && this.flags.dash) || this.t > 14) next();
        break;
      case 1:
        hint = '🛎️ Customers are on their way! Their orders appear as tickets at the top of the screen.';
        ptr = new THREE.Vector3(g.grid.doorX + 0.5, 2.7, g.grid.H - 0.5);
        if (g.orders.tickets.length) next();
        break;
      case 2:
        hint = '🥗 A <b>Garden Salad</b>! Face the <b>Lettuce</b> crate and press <kbd>E</kbd> to grab one.';
        ptr = this.stationPos((s) => s.kind === 'crate' && s.ing === 'lettuce');
        if ((held && held.id === 'lettuce') || this.flags['chop:lettuce']) next();
        break;
      case 3:
        hint = '🔪 Drop it on a <b>Cutting Board</b> with <kbd>E</kbd>, then press <kbd>F</kbd> to chop!';
        ptr = this.stationPos((s) => s.kind === 'board' && (!s.item || s.item.id === 'lettuce'));
        if (this.flags['chop:lettuce']) next();
        break;
      case 4:
        hint = '🍅 Nice knife work! Now grab a <b>Tomato</b> and chop it too.';
        ptr = held && held.id === 'tomato'
          ? this.stationPos((s) => s.kind === 'board' && !s.item)
          : this.stationPos((s) => s.kind === 'crate' && s.ing === 'tomato');
        if (this.flags['chop:tomato']) next();
        break;
      case 5:
        hint = '🍽️ Grab a clean <b>Plate</b> from the plate rack (<kbd>E</kbd>).';
        ptr = this.stationPos((s) => s.kind === 'platerack');
        if (held && held.kind === 'plate' && !held.dirty) next();
        break;
      case 6:
        hint = '✨ Holding the plate, face each chopped ingredient and press <kbd>E</kbd> to scoop it on.';
        ptr = this.stationPos((s) => s.item && s.item.kind === 'ing' && s.item.state === 'chopped' && (s.item.id === 'lettuce' || s.item.id === 'tomato') && !(held && held.contents?.some((c) => c.id === s.item.id)));
        if (held && held.kind === 'plate' && matchDish(held) === 'salad') next();
        if (!held && this.t > 2) this.step = 5;
        break;
      case 7: {
        hint = "🏃 Perfect! Carry it to the customer's table and press <kbd>E</kbd> to serve.";
        const c = g.customers.allCustomers().find((x) => x.state === 'waiting' && x.order === 'salad');
        if (c) ptr = new THREE.Vector3(c.table.x, 1.4, c.table.z);
        if (this.flags.served) next();
        break;
      }
      case 8:
        hint = '🧼 When guests leave, grab their <b>dirty plates</b> (<kbd>E</kbd>), drop them in the <b>Sink</b> and hold <kbd>F</kbd> to wash. Walk past tables to pocket the cash 💵';
        if (this.flags.cleared) ptr = this.stationPos((s) => s.kind === 'sink');
        else {
          const t = g.grid.stations('table').find((s) => s.hasDirty());
          if (t) ptr = new THREE.Vector3(t.x, 1.4, t.z);
        }
        if (this.flags.washed || this.t > 60) next();
        break;
      case 9:
        hint = "🍔 You're a natural! Burgers need a <b>seared patty</b>: chop <b>Beef</b>, then cook it on the <b>Stove</b>. Take it off before it burns! 🔥";
        if (this.t > 12) next();
        break;
      default:
        this.finish();
        return;
    }
    g.ui.setHint(hint);
    g.renderer.setPointer(ptr);
  }
}
