// Ingredients, cooking rules, dishes, cuisines and the item state machine.
// Items are plain objects so stations, characters, conveyors and AI can share them freely.

import { uid } from './utils.js';

export const INGREDIENTS = {
  lettuce:  { name: 'Lettuce',  cost: 1, chop: 1.6, chopTo: 'chopped', color: '#7bd148', cuisine: 'diner' },
  tomato:   { name: 'Tomato',   cost: 1, chop: 1.6, chopTo: 'chopped', color: '#ff4f3f', cuisine: 'diner' },
  bun:      { name: 'Bun',      cost: 1, color: '#e8a75a', cuisine: 'diner' },
  meat:     { name: 'Beef',     cost: 3, chop: 2.2, chopTo: 'chopped', color: '#d9475c', cuisine: 'diner' },
  cheese:   { name: 'Cheese',   cost: 2, chop: 1.4, chopTo: 'chopped', color: '#ffd23f', cuisine: 'diner' },
  dough:    { name: 'Dough',    cost: 2, chop: 2.4, chopTo: 'base', color: '#f3dfb6', cuisine: 'pizzeria' },
  rice:     { name: 'Rice',     cost: 1, color: '#f4f1e6', cuisine: 'japanese' },
  fish:     { name: 'Salmon',   cost: 4, chop: 1.8, chopTo: 'chopped', color: '#ff8c69', cuisine: 'japanese' },
  nori:     { name: 'Nori',     cost: 1, color: '#25432f', cuisine: 'japanese' },
  noodles:  { name: 'Noodles',  cost: 2, color: '#f6e2a1', cuisine: 'japanese' },
  egg:      { name: 'Egg',      cost: 1, color: '#fff7e6', cuisine: 'japanese' },
  tortilla: { name: 'Tortilla', cost: 1, color: '#f1d38f', cuisine: 'taqueria' },
  potato:   { name: 'Potato',   cost: 1, chop: 1.8, chopTo: 'chopped', color: '#c99b5a', cuisine: 'fryshack' },
  shrimp:   { name: 'Shrimp',   cost: 3, color: '#ff9e80', cuisine: 'fryshack' },
  berries:  { name: 'Berries',  cost: 3, chop: 1.4, chopTo: 'chopped', color: '#7b3fc4', cuisine: 'patisserie' },
};

// Specific display names for item keys (id:state)
const NAME_OVERRIDES = {
  'meat:chopped': 'Raw Patty', 'meat:cooked': 'Seared Patty', 'meat:burnt': 'Charred Patty',
  'lettuce:chopped': 'Chopped Lettuce', 'tomato:chopped': 'Sliced Tomato', 'cheese:chopped': 'Cheese Slice',
  'dough:base': 'Pizza Base', 'dough:baked': 'Baked Crust', 'rice:cooked': 'Steamed Rice',
  'fish:chopped': 'Salmon Slices', 'fish:fried': 'Battered Fish', 'noodles:boiled': 'Ramen Noodles',
  'egg:boiled': 'Soft Egg', 'potato:chopped': 'Potato Sticks', 'potato:fried': 'Fries',
  'shrimp:fried': 'Tempura Shrimp', 'berries:chopped': 'Berry Compote',
};

export const STATE_LABEL = {
  raw: 'Raw', chopped: 'Chopped', base: 'Kneaded', cooked: 'Cooked', boiled: 'Boiled',
  fried: 'Fried', baked: 'Baked', burnt: 'Burnt',
};

// cooker type -> input key -> rule
export const COOK_RULES = {
  stove: { 'meat:chopped': { to: 'cooked', time: 7 } },
  pot: {
    'rice:raw': { to: 'cooked', time: 8 },
    'noodles:raw': { to: 'boiled', time: 6.5 },
    'egg:raw': { to: 'boiled', time: 6 },
  },
  fryer: {
    'potato:chopped': { to: 'fried', time: 6 },
    'fish:chopped': { to: 'fried', time: 6.5 },
    'shrimp:raw': { to: 'fried', time: 5.5 },
  },
  oven: { 'dough:base': { to: 'baked', time: 9, needsToppings: true } },
};

export const COOKER_INFO = {
  stove: { name: 'Stove', verb: 'Sear', icon: 'pan' },
  pot: { name: 'Stock Pot', verb: 'Boil', icon: 'pot' },
  fryer: { name: 'Deep Fryer', verb: 'Fry', icon: 'fryer' },
  oven: { name: 'Pizza Oven', verb: 'Bake', icon: 'oven' },
};

export const TOPPINGS = ['tomato', 'cheese', 'meat', 'berries'];
export const MAX_TOPPINGS = 3;
export const MAX_PLATE_ITEMS = 5;

export const DISHES = {
  salad:        { name: 'Garden Salad',    cuisine: 'diner', price: 10, parts: ['lettuce:chopped', 'tomato:chopped'] },
  burger:       { name: 'Classic Burger',  cuisine: 'diner', price: 14, parts: ['bun:raw', 'meat:cooked'] },
  cheeseburger: { name: 'Cheeseburger',    cuisine: 'diner', price: 19, parts: ['bun:raw', 'meat:cooked', 'cheese:chopped'] },
  deluxe:       { name: 'Deluxe Burger',   cuisine: 'diner', price: 24, parts: ['bun:raw', 'meat:cooked', 'lettuce:chopped', 'tomato:chopped'] },
  margherita:   { name: 'Margherita',      cuisine: 'pizzeria', price: 26, parts: ['dough:baked+cheese+tomato'] },
  meatlovers:   { name: 'Meat Lovers',     cuisine: 'pizzeria', price: 34, parts: ['dough:baked+cheese+meat+tomato'] },
  nigiri:       { name: 'Salmon Nigiri',   cuisine: 'japanese', price: 20, parts: ['rice:cooked', 'fish:chopped'] },
  maki:         { name: 'Maki Roll',       cuisine: 'japanese', price: 27, parts: ['nori:raw', 'rice:cooked', 'fish:chopped'] },
  ramen:        { name: 'Tonkotsu Ramen',  cuisine: 'japanese', price: 32, parts: ['noodles:boiled', 'egg:boiled', 'meat:cooked'] },
  taco:         { name: 'Street Taco',     cuisine: 'taqueria', price: 20, parts: ['tortilla:raw', 'meat:cooked', 'tomato:chopped'] },
  burrito:      { name: 'Mega Burrito',    cuisine: 'taqueria', price: 29, parts: ['tortilla:raw', 'rice:cooked', 'meat:cooked', 'cheese:chopped'] },
  fries:        { name: 'Golden Fries',    cuisine: 'fryshack', price: 12, parts: ['potato:fried'] },
  fishchips:    { name: 'Fish & Chips',    cuisine: 'fryshack', price: 27, parts: ['fish:fried', 'potato:fried'] },
  tempura:      { name: 'Shrimp Tempura',  cuisine: 'fryshack', price: 30, parts: ['shrimp:fried', 'rice:cooked'] },
  berrytart:    { name: 'Berry Tart',      cuisine: 'patisserie', price: 30, parts: ['dough:baked+berries'] },
  cheesecake:   { name: 'Berry Cheesecake', cuisine: 'patisserie', price: 38, parts: ['dough:baked+berries+cheese'] },
};

export const CUISINES = {
  diner:      { name: 'American Diner',    stars: 1.0, price: 0,   color: '#ff7a45', dishes: ['salad', 'burger', 'cheeseburger', 'deluxe'], blurb: 'Salads and burgers. Patties get seared on the stove.' },
  pizzeria:   { name: 'Italian Pizzeria',  stars: 2.0, price: 200, color: '#e74c3c', dishes: ['margherita', 'meatlovers'], blurb: 'Knead the dough, add toppings, bake it in a pizza oven.' },
  japanese:   { name: 'Japanese Izakaya',  stars: 2.5, price: 300, color: '#ff8c69', dishes: ['nigiri', 'maki', 'ramen'], blurb: 'Boil rice and noodles in a stock pot and slice fresh salmon.' },
  taqueria:   { name: 'Taqueria',          stars: 3.0, price: 350, color: '#f5b041', dishes: ['taco', 'burrito'], blurb: 'Warm tortillas filled with seared meat and fresh tomato.' },
  fryshack:   { name: 'Seaside Fry Shack', stars: 3.5, price: 450, color: '#f7dc6f', dishes: ['fries', 'fishchips', 'tempura'], blurb: 'Fries, fish and shrimp tempura. Needs a deep fryer.' },
  patisserie: { name: 'Patisserie',        stars: 4.0, price: 600, color: '#a569bd', dishes: ['berrytart', 'cheesecake'], blurb: 'Oven-baked tarts and cheesecake with fresh berries.' },
};

export const CUISINE_ORDER = ['diner', 'pizzeria', 'japanese', 'taqueria', 'fryshack', 'patisserie'];

// Item factories

export function makeIngredient(id) {
  return { kind: 'ing', uid: uid(), id, state: 'raw', chop: 0, cook: 0, burn: 0, toppings: null, ver: 0, hot: 0 };
}

export function makePlate(dirty = false, stack = 1) {
  return { kind: 'plate', uid: uid(), dirty, stack, contents: [], ver: 0 };
}

export function makeExtinguisher() {
  return { kind: 'tool', id: 'extinguisher', uid: uid(), ver: 0 };
}

export function itemFromKey(key) {
  const [base, ...tops] = key.split('+');
  const [id, state] = base.split(':');
  const it = makeIngredient(id);
  it.state = state;
  if (tops.length) it.toppings = tops.slice().sort();
  return it;
}

export function bump(item) { if (item) item.ver++; }

// Keys & naming

export const baseKey = (item) => `${item.id}:${item.state}`;

export function itemKey(item) {
  if (!item) return '';
  if (item.kind === 'plate') return item.dirty ? 'plate:dirty' : 'plate:clean';
  if (item.kind === 'tool') return `tool:${item.id}`;
  let k = baseKey(item);
  if (item.toppings && item.toppings.length) k += '+' + item.toppings.slice().sort().join('+');
  return k;
}

export function ingredientName(item) {
  const def = INGREDIENTS[item.id];
  const k = baseKey(item);
  if (item.id === 'dough' && item.toppings && item.toppings.length) {
    if (item.state === 'base') return item.toppings.includes('berries') ? 'Raw Tart' : 'Raw Pizza';
    if (item.state === 'baked') return matchDishByKey(itemKey(item))?.name || 'Baked Pizza';
  }
  if (NAME_OVERRIDES[k]) return NAME_OVERRIDES[k];
  if (item.state === 'raw') return def.name;
  return `${STATE_LABEL[item.state] || item.state} ${def.name}`;
}

export function itemLabel(item) {
  if (!item) return '';
  if (item.kind === 'tool') return 'Fire Extinguisher';
  if (item.kind === 'plate') {
    if (item.dirty) return item.stack > 1 ? `Dirty Plates ×${item.stack}` : 'Dirty Plate';
    if (!item.contents.length) return item.stack > 1 ? `Clean Plates ×${item.stack}` : 'Clean Plate';
    const d = matchDish(item);
    if (d) return DISHES[d].name;
    return 'Plate: ' + item.contents.map(ingredientName).join(' + ');
  }
  return ingredientName(item);
}

// Processing rules

export function chopInfo(item) {
  if (!item || item.kind !== 'ing' || item.state !== 'raw') return null;
  const def = INGREDIENTS[item.id];
  if (!def.chopTo) return null;
  return { time: def.chop, to: def.chopTo };
}

export function cookRule(cookType, item) {
  if (!item || item.kind !== 'ing') return null;
  const r = COOK_RULES[cookType]?.[baseKey(item)];
  if (!r) return null;
  if (r.needsToppings && !(item.toppings && item.toppings.length)) return null;
  return r;
}

export function isCookOutput(cookType, item) {
  if (!item || item.kind !== 'ing') return false;
  const rules = COOK_RULES[cookType];
  if (!rules) return false;
  for (const k in rules) {
    if (k.split(':')[0] === item.id && rules[k].to === item.state) return true;
  }
  return false;
}

export function cookerAccepts(cookType, item) {
  if (!item || item.kind !== 'ing') return false;
  return !!cookRule(cookType, item) || isCookOutput(cookType, item);
}

export function isHotFood(item) {
  return item && item.kind === 'ing' && ['cooked', 'boiled', 'fried', 'baked'].includes(item.state);
}

// Plates, toppings & dish matching

const DISH_BY_SIG = new Map();
export const PLATEABLE = new Set();
for (const [id, d] of Object.entries(DISHES)) {
  DISH_BY_SIG.set(d.parts.slice().sort().join('|'), id);
  for (const p of d.parts) PLATEABLE.add(p);
}

export function isPlateable(item) {
  if (!item || item.kind !== 'ing' || item.state === 'burnt') return false;
  if (PLATEABLE.has(itemKey(item))) return true;
  return item.id === 'dough' && item.state === 'baked';
}

export function canAddToPlate(plate, item) {
  if (!plate || plate.kind !== 'plate' || plate.dirty || plate.stack !== 1) return false;
  if (plate.contents.length >= MAX_PLATE_ITEMS) return false;
  if (!isPlateable(item)) return false;
  const k = itemKey(item);
  return !plate.contents.some((c) => itemKey(c) === k);
}

export function addToPlate(plate, item) {
  plate.contents.push(item);
  plate.ver++;
}

export function canTop(base, item) {
  if (!base || !item || base.kind !== 'ing' || item.kind !== 'ing') return false;
  if (base.id !== 'dough' || base.state !== 'base') return false;
  if (!TOPPINGS.includes(item.id) || item.state !== 'chopped') return false;
  const t = base.toppings || [];
  return t.length < MAX_TOPPINGS && !t.includes(item.id);
}

export function addTopping(base, item) {
  base.toppings = [...(base.toppings || []), item.id].sort();
  base.ver++;
}

export function plateSignature(plate) {
  return plate.contents.map(itemKey).sort().join('|');
}

export function matchDish(plate) {
  if (!plate || plate.kind !== 'plate' || plate.dirty || !plate.contents.length) return null;
  return DISH_BY_SIG.get(plateSignature(plate)) || null;
}

export function matchDishByKey(key) {
  const id = DISH_BY_SIG.get(key);
  return id ? DISHES[id] : null;
}

// Does this plate contain only parts of the dish (i.e. is it a valid partial assembly)?
export function plateProgressToward(plate, dishId) {
  if (!plate || plate.kind !== 'plate' || plate.dirty) return -1;
  const parts = DISHES[dishId].parts;
  let n = 0;
  for (const c of plate.contents) {
    if (!parts.includes(itemKey(c))) return -1;
    n++;
  }
  return n;
}

// Production chains (used by staff AI, menu availability & tickets)

// Returns { ing, chop, cooker, toppings: [ingredient ids] }
export function chainFor(key) {
  const [base, ...tops] = key.split('+');
  const [id, state] = base.split(':');
  if (state === 'raw') return { ing: id, chop: false, cooker: null, toppings: [] };
  if (state === 'chopped' || state === 'base') return { ing: id, chop: true, cooker: null, toppings: tops };
  for (const [cooker, rules] of Object.entries(COOK_RULES)) {
    for (const [inKey, rule] of Object.entries(rules)) {
      const [inId, inState] = inKey.split(':');
      if (inId === id && rule.to === state) {
        return { ing: id, chop: inState !== 'raw', cooker, toppings: tops, inState };
      }
    }
  }
  return { ing: id, chop: false, cooker: null, toppings: [] };
}

export function dishRequirements(dishId) {
  const ings = new Set();
  const cookers = new Set();
  let chop = false;
  for (const part of DISHES[dishId].parts) {
    const c = chainFor(part);
    ings.add(c.ing);
    if (c.chop) chop = true;
    if (c.cooker) cookers.add(c.cooker);
    for (const t of c.toppings) { ings.add(t); chop = true; }
  }
  return { ings, chop, cookers };
}

export function dishComplexity(dishId) {
  let n = 0;
  const cookers = new Set();
  for (const part of DISHES[dishId].parts) {
    const c = chainFor(part);
    n += 1 + c.toppings.length;
    if (c.cooker) cookers.add(c.cooker);
  }
  return { steps: n, cookers: cookers.size };
}

export function dishBasePatience(dishId) {
  const c = dishComplexity(dishId);
  return 36 + c.steps * 8 + c.cookers * 8;
}

// Ticket breakdown: list of { key, badge } for the components a player must prepare.
export function ticketParts(dishId) {
  const out = [];
  for (const part of DISHES[dishId].parts) {
    const c = chainFor(part);
    if (c.toppings.length) {
      out.push({ key: `${c.ing}:base`, badge: COOKER_INFO[c.cooker]?.icon || '' });
      for (const t of c.toppings) out.push({ key: `${t}:chopped`, badge: 'knife' });
    } else {
      let badge = '';
      if (c.cooker) badge = COOKER_INFO[c.cooker].icon;
      else if (c.chop) badge = 'knife';
      out.push({ key: part, badge });
    }
  }
  return out;
}

// All item keys we might want thumbnails for
export function allThumbKeys() {
  const keys = new Set();
  for (const id of Object.keys(INGREDIENTS)) keys.add(`${id}:raw`);
  for (const d of Object.values(DISHES)) {
    for (const p of d.parts) {
      keys.add(p);
      const c = chainFor(p);
      if (c.toppings.length) keys.add(`${c.ing}:base`);
      for (const t of c.toppings) keys.add(`${t}:chopped`);
    }
  }
  return [...keys];
}
