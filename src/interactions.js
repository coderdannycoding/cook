// The single source of truth for "what happens when X is put on / taken from station Y".
// Player input, staff AI, conveyor belts and grabber arms all go through here.

import {
  canAddToPlate, addToPlate, canTop, addTopping, itemLabel, matchDish, ingredientName, INGREDIENTS, COOKER_INFO, chopInfo,
  cookRule, DISHES,
} from './recipes.js';

const SPECIAL = new Set(['trash', 'crate', 'platerack', 'sink', 'autowasher', 'extinguisher', 'table', 'drivethru']);

export class Interactions {
  constructor(game) {
    this.game = game;
  }

  // checks
  canTransfer(st, item) {
    if (!st || !item || st.fire > 0) return false;
    if (st.kind === 'grabber') return false;
    if (SPECIAL.has(st.kind)) return st.canAccept(item);
    if (!st.item) return st.accepts(item);
    return this.canMerge(st.item, item);
  }

  canMerge(target, item) {
    if (target.kind === 'plate' && canAddToPlate(target, item)) return true;
    if (canTop(target, item)) return true;
    if (target.kind === 'plate' && target.dirty && item.kind === 'plate' && item.dirty) return true;
    return false;
  }

  // Held container scooping the station's item into itself
  canScoop(held, st) {
    if (!held || !st || !st.hasSlot || !st.item || !st.canTake()) return false;
    const it = st.item;
    if (held.kind === 'plate' && canAddToPlate(held, it)) return true;
    if (canTop(held, it)) return true;
    if (held.kind === 'plate' && held.dirty && it.kind === 'plate' && it.dirty) return true;
    return false;
  }

  // mutations
  // Move `item` into station. Returns false if impossible, otherwise what remains in hand (null or item).
  transferInto(st, item, actor = null) {
    if (!this.canTransfer(st, item)) return false;
    if (st.kind === 'trash') {
      if (item.kind === 'plate') {
        st.binIt(item.contents.length);
        item.contents = [];
        item.ver++;
        return item;
      }
      st.binIt(1);
      return null;
    }
    if (SPECIAL.has(st.kind)) {
      st.put(item, actor);
      return null;
    }
    if (!st.item) {
      st.put(item);
      return null;
    }
    const t = st.item;
    if (t.kind === 'plate' && canAddToPlate(t, item)) {
      addToPlate(t, item);
      st.changed();
      this._plateFeedback(st, t);
      return null;
    }
    if (canTop(t, item)) {
      addTopping(t, item);
      st.changed();
      return null;
    }
    if (t.kind === 'plate' && t.dirty && item.kind === 'plate' && item.dirty) {
      t.stack += item.stack;
      t.ver++;
      st.changed();
      return null;
    }
    return false;
  }

  scoop(held, st) {
    const it = st.take();
    if (held.kind === 'plate' && !held.dirty) {
      addToPlate(held, it);
      this._plateFeedback(st, held);
    } else if (held.kind === 'plate' && held.dirty) {
      held.stack += it.stack;
      held.ver++;
    } else addTopping(held, it);
  }

  _plateFeedback(st, plate) {
    const dish = matchDish(plate);
    if (dish) {
      this.game.audio.complete();
      const p = st.worldPos ? st.worldPos() : null;
      if (p) this.game.particles.sparkle(p.x, p.y + 0.2, p.z, '#fff3a0');
      this.game.events.emit('plated', { dish, plate });
    }
  }

  // actor actions
  // The "E" action. Returns { ok, kind, msg }
  pickDrop(actor, st) {
    const held = actor.held;
    if (!st) return { ok: false };
    if (st.fire > 0) return { ok: false, msg: "It's on fire" };

    if (st.kind === 'table') {
      if (held && held.kind === 'plate' && !held.dirty) {
        if (!held.contents.length) return { ok: false, msg: 'That plate is empty' };
        if (st.canAccept(held)) {
          st.put(held, actor);
          actor.held = null;
          return { ok: true, kind: 'serve' };
        }
        return { ok: false, msg: matchDish(held) ? 'Nobody at this table ordered that' : "That's not a finished dish yet" };
      }
      if (!held || (held.kind === 'plate' && held.dirty)) {
        if (st.canTake()) {
          const got = st.take(actor);
          if (got) {
            if (held) { held.stack += got.stack; held.ver++; } else actor.held = got;
          }
          return { ok: true, kind: 'clear' };
        }
      }
      return { ok: false, msg: held ? null : 'Nothing to clear here' };
    }

    if (!held) {
      if (st.canTake(actor)) {
        actor.held = st.take(actor);
        return { ok: true, kind: 'take' };
      }
      return { ok: false, msg: this._emptyReason(st) };
    }

    if (this.canScoop(held, st)) {
      this.scoop(held, st);
      return { ok: true, kind: 'scoop' };
    }
    const res = this.transferInto(st, held, actor);
    if (res !== false) {
      actor.held = res;
      return { ok: true, kind: st.kind === 'trash' ? 'trash' : 'put' };
    }
    return { ok: false, msg: this._putReason(st, held) };
  }

  // The "F" action (continuous). Returns true while work is happening.
  work(actor, st, dt) {
    if (!st || st.fire > 0) return false;
    if (st.kind === 'table') return st.work(actor, dt);
    if (actor.held) return false;
    if (!st.canWork(actor)) return false;
    return st.work(actor, dt);
  }

  // Labels for the on-screen action prompt
  describe(actor, st) {
    const out = { e: null, f: null, warn: null };
    const held = actor.held;
    if (held && held.kind === 'tool') out.f = 'Spray';
    if (!st) return out;
    if (st.fire > 0) { out.warn = 'On fire'; return out; }
    if (st.kind === 'table') {
      if (held && held.kind === 'plate' && !held.dirty && held.contents.length) {
        out.e = st.canAccept(held) ? `Serve ${itemLabel(held)}` : null;
        if (!out.e) out.warn = matchDish(held) ? 'Not ordered here' : 'Unfinished dish';
      } else if ((!held || (held.kind === 'plate' && held.dirty)) && st.canTake()) {
        out.e = st.hasDirty() ? 'Clear plates' : 'Collect cash';
      }
      if (st.cash > 0 && !out.f) out.f = 'Collect cash';
      return out;
    }
    if (!held) {
      if (st.canTake(actor)) out.e = `Take ${this._takeLabel(st)}`;
      if (st.canWork(actor)) out.f = st.workLabel(actor);
      return out;
    }
    if (this.canScoop(held, st)) {
      out.e = held.kind === 'plate' && !held.dirty ? `Plate ${itemLabel(st.item)}` : held.kind === 'plate' ? 'Stack plates' : `Add ${itemLabel(st.item)}`;
    } else if (this.canTransfer(st, held)) {
      out.e = this._putLabel(st, held);
    }
    if (!out.e && st.canWork(actor)) out.warn = 'Hands full';
    return out;
  }

  _takeLabel(st) {
    switch (st.kind) {
      case 'crate': return `${INGREDIENTS[st.ing].name} ($${INGREDIENTS[st.ing].cost})`;
      case 'platerack': return `Plate (${st.count})`;
      case 'sink': case 'autowasher': return 'Clean Plate';
      case 'extinguisher': return 'Extinguisher';
      case 'drivethru': return 'dirty plates';
      default: return st.item ? itemLabel(st.item) : '';
    }
  }

  _putLabel(st, held) {
    switch (st.kind) {
      case 'trash': return held.kind === 'plate' ? 'Empty plate' : 'Bin it';
      case 'crate': return 'Put back (refund)';
      case 'platerack': return 'Rack plate';
      case 'sink': case 'autowasher': return 'Load dirty plates';
      case 'extinguisher': return 'Hang extinguisher';
      case 'drivethru': return `Hand over ${itemLabel(held)}`;
      case 'cooker': {
        const r = cookRule(st.cookType, held);
        return r ? `${COOKER_INFO[st.cookType].verb} ${ingredientName(held)}` : 'Put back on heat';
      }
      case 'board': return chopInfo(held) ? 'Place on board' : 'Place';
      default:
        if (st.item && st.item.kind === 'plate') return 'Add to plate';
        if (st.item) return 'Add topping';
        return 'Place';
    }
  }

  _emptyReason(st) {
    if (st.kind === 'platerack') return 'No clean plates! Wash some dishes.';
    if (st.kind === 'sink' || st.kind === 'autowasher') return st.dirty ? 'Wash the dirty plates first (F)' : 'No clean plates here';
    if (st.kind === 'extinguisher') return 'Extinguisher is out';
    if (st.kind === 'trash') return null;
    if (st.kind === 'drivethru') return st.car?.state === 'waiting' ? `Bring them a ${DISHES[st.car.order].name}` : 'No car at the window';
    return null;
  }

  _putReason(st, held) {
    if (st.kind === 'drivethru') {
      const car = st.car;
      if (!car || car.state !== 'waiting') return 'No car at the window';
      return held.kind === 'plate' && !held.dirty ? `They ordered a ${DISHES[car.order].name}` : 'Hand over a finished dish';
    }
    if (st.kind === 'cooker') return `Can't ${COOKER_INFO[st.cookType].verb.toLowerCase()} that here`;
    if (st.kind === 'board' && held.kind !== 'ing') return 'Boards are for ingredients';
    if (st.kind === 'crate') return "That doesn't go in this crate";
    if (st.kind === 'trash') return held.kind === 'plate' ? 'Wash dirty plates in the sink' : "Can't bin that";
    if (st.kind === 'sink' || st.kind === 'autowasher') return held.kind === 'plate' && held.dirty ? 'Washer is full' : 'Only dirty plates go here';
    if (st.kind === 'platerack') return 'Only clean, empty plates';
    if (st.item && st.item.kind === 'plate' && held.kind === 'ing') return held.state === 'raw' && chopInfo(held) ? 'Chop it first' : "That doesn't go on a plate";
    if (st.item && held.kind === 'plate' && st.item.kind === 'ing') return st.item.state === 'raw' && chopInfo(st.item) ? 'Chop it first' : 'Plate is full or that doesn\'t fit';
    if (st.item) return 'Something is already here';
    return "Can't put that here";
  }
}
