// Buildable appliance / furniture catalog, starter layout, upgrades, staff & cosmetic themes.

import { SURFACE_Y, FLOOR_LEVELS } from './config.js';
import { INGREDIENTS } from './recipes.js';

export const CATEGORIES = [
  { id: 'supplies', name: 'Supplies', icon: '📦' },
  { id: 'prep', name: 'Prep', icon: '🔪' },
  { id: 'cooking', name: 'Cooking', icon: '🍳' },
  { id: 'dining', name: 'Dining', icon: '🍽️' },
  { id: 'decor', name: 'Decor', icon: '🪴' },
  { id: 'auto', name: 'Automation', icon: '⚙️' },
  { id: 'style', name: 'Style', icon: '🎨' },
];

export const CATALOG = {};

function add(id, o) {
  CATALOG[id] = {
    id,
    size: [1, 1],
    solid: true,
    flammable: true,
    decor: 0,
    layer: 'main',
    surface: SURFACE_Y,
    station: null,
    req: null,
    desc: '',
    ...o,
  };
}

// --- Prep -----------------------------------------------------------------
add('counter', { name: 'Counter', cat: 'prep', price: 20, station: 'counter', desc: 'A trusty surface. Assemble plates & park ingredients.' });
add('board', { name: 'Cutting Board', cat: 'prep', price: 40, station: 'board', desc: 'Chop, slice & knead ingredients. Hold F to work.' });
add('platerack', { name: 'Plate Rack', cat: 'prep', price: 35, station: 'platerack', desc: 'Clean plates are stored here at the start of each day.' });
add('sink', { name: 'Sink', cat: 'prep', price: 110, station: 'sink', flammable: false, desc: 'Drop dirty plates in, hold F to wash them.' });
add('trash', { name: 'Trash Can', cat: 'prep', price: 15, station: 'trash', flammable: false, desc: 'Bin burnt or unwanted food. Empties plates too.' });
add('pass', { name: 'Serving Pass', cat: 'prep', price: 45, station: 'pass', desc: 'Heat-lamped hand-off point. Waiters deliver dishes left here.' });
add('extinguisher', { name: 'Extinguisher Stand', cat: 'prep', price: 40, station: 'extinguisher', flammable: false, desc: 'Grab the extinguisher and hold F to blast fires.' });

// --- Cooking --------------------------------------------------------------
add('stove', { name: 'Stove', cat: 'cooking', price: 90, station: 'cooker', cook: 'stove', desc: 'Sears patties. Watch out — food burns if left too long!' });
add('pot', { name: 'Stock Pot', cat: 'cooking', price: 100, station: 'cooker', cook: 'pot', desc: 'Boils rice, noodles & eggs.' });
add('oven', { name: 'Pizza Oven', cat: 'cooking', price: 180, station: 'cooker', cook: 'oven', desc: 'Bakes topped pizza bases & tarts.' });
add('fryer', { name: 'Deep Fryer', cat: 'cooking', price: 160, station: 'cooker', cook: 'fryer', desc: 'Fries potatoes, fish & shrimp to golden perfection.' });

// --- Supplies (one crate per ingredient) ----------------------------------
const CRATE_PRICES = { lettuce: 25, tomato: 25, bun: 25, meat: 35, cheese: 30, dough: 35, rice: 30, fish: 45, nori: 25, noodles: 35, egg: 25, tortilla: 30, potato: 25, shrimp: 45, berries: 40 };
for (const [ing, def] of Object.entries(INGREDIENTS)) {
  add(`crate_${ing}`, {
    name: `${def.name} Crate`, cat: 'supplies', price: CRATE_PRICES[ing] || 30, station: 'crate', ing,
    req: def.cuisine === 'diner' ? null : def.cuisine,
    desc: `Endless ${def.name.toLowerCase()} — $${def.cost} each.`,
  });
}

// --- Dining ---------------------------------------------------------------
// cells: [cx, cz, role] in unrotated local coordinates
add('table2', {
  name: 'Bistro Table', cat: 'dining', price: 60, size: [3, 1], station: 'table', flammable: false, decor: 1,
  cells: [[0, 0, 'seat'], [1, 0, 'table'], [2, 0, 'seat']], seats: 2,
  desc: 'Seats two. Customers sit on the chairs either side.',
});
add('table4', {
  name: 'Family Table', cat: 'dining', price: 130, size: [3, 2], station: 'table', flammable: false, decor: 2,
  cells: [[0, 0, 'seat'], [1, 0, 'table'], [2, 0, 'seat'], [0, 1, 'seat'], [1, 1, 'table'], [2, 1, 'seat']], seats: 4,
  desc: 'Seats four — lets bigger groups visit.',
});
add('booth', {
  name: 'Cozy Booth', cat: 'dining', price: 190, size: [3, 1], station: 'table', flammable: false, decor: 6,
  cells: [[0, 0, 'seat'], [1, 0, 'table'], [2, 0, 'seat']], seats: 2, patience: 1.15,
  desc: 'Plush velvet booth. Guests here are 15% more patient.',
});

// --- Decor ----------------------------------------------------------------
add('plant', { name: 'Potted Plant', cat: 'decor', price: 25, decor: 3, desc: 'A leafy friend. +Ambience' });
add('palm', { name: 'Lucky Palm', cat: 'decor', price: 60, decor: 6, desc: 'Tropical vibes. ++Ambience' });
add('rug', { name: 'Fancy Rug', cat: 'decor', price: 45, decor: 4, size: [2, 2], layer: 'floor', solid: false, flammable: false, desc: 'Walkable woven rug. Can go under furniture.' });
add('lamp', { name: 'Mood Lamp', cat: 'decor', price: 55, decor: 5, light: true, desc: 'Warm glow. Nearby guests are calmer. +Ambience' });
add('jukebox', { name: 'Jukebox', cat: 'decor', price: 200, decor: 10, desc: 'Plays the hits. +++Ambience' });
add('fishtank', { name: 'Aquarium', cat: 'decor', price: 240, decor: 14, size: [2, 1], flammable: false, desc: 'Mesmerising fish. Huge ambience boost.' });
add('fountain', { name: 'Fountain', cat: 'decor', price: 380, decor: 20, size: [2, 2], flammable: false, desc: 'The pinnacle of fine dining décor.' });

// --- Automation -----------------------------------------------------------
add('conveyor', { name: 'Conveyor Belt', cat: 'auto', price: 70, station: 'conveyor', desc: 'Moves items forward onto the next station. Rotate with R.' });
add('grabber', { name: 'Grabber Arm', cat: 'auto', price: 130, station: 'grabber', desc: 'Takes from the station behind it and places in front.' });
add('autochopper', { name: 'Auto-Chopper', cat: 'auto', price: 240, station: 'board', auto: true, desc: 'Chops anything placed on it, hands-free.' });
add('autowasher', { name: 'Auto-Dishwasher', cat: 'auto', price: 320, station: 'autowasher', flammable: false, desc: 'Washes up to 8 dirty plates by itself.' });

export function catalogByCategory(cat) {
  return Object.values(CATALOG).filter((d) => d.cat === cat);
}

// ---------------------------------------------------------------------------
// Starting restaurant (12 x 9). Door is at (10, 8).
export const STARTER_LAYOUT = [
  { type: 'plant', x: 0, z: 0, rot: 0 },
  { type: 'crate_lettuce', x: 1, z: 0, rot: 0 },
  { type: 'crate_tomato', x: 2, z: 0, rot: 0 },
  { type: 'crate_bun', x: 3, z: 0, rot: 0 },
  { type: 'crate_meat', x: 4, z: 0, rot: 0 },
  { type: 'stove', x: 5, z: 0, rot: 0 },
  { type: 'counter', x: 6, z: 0, rot: 0 },
  { type: 'pass', x: 6, z: 1, rot: 1 },
  { type: 'pass', x: 6, z: 2, rot: 1 },
  { type: 'counter', x: 6, z: 3, rot: 0 },
  { type: 'board', x: 0, z: 1, rot: 1 },
  { type: 'board', x: 0, z: 2, rot: 1 },
  { type: 'counter', x: 0, z: 3, rot: 1 },
  { type: 'trash', x: 0, z: 4, rot: 1 },
  { type: 'extinguisher', x: 0, z: 5, rot: 1 },
  { type: 'sink', x: 0, z: 6, rot: 1 },
  { type: 'platerack', x: 0, z: 7, rot: 1 },
  { type: 'counter', x: 0, z: 8, rot: 1 },
  { type: 'counter', x: 2, z: 3, rot: 0 },
  { type: 'counter', x: 3, z: 3, rot: 0 },
  { type: 'rug', x: 8, z: 2, rot: 0 },
  { type: 'table2', x: 8, z: 1, rot: 0 },
  { type: 'table2', x: 8, z: 4, rot: 0 },
  { type: 'table2', x: 7, z: 7, rot: 0 },
  { type: 'plant', x: 11, z: 0, rot: 0 },
  { type: 'lamp', x: 11, z: 8, rot: 0 },
];

export const PLAYER_SPAWN = { x: 3.5, z: 1.6 };

// ---------------------------------------------------------------------------
// Upgrades. `value` is the effect at that level; `base` is the effect at level 0.
export const UPGRADES = {
  dash:      { name: 'Turbo Sneakers', icon: '👟', desc: 'Dash recharges faster.', base: 1.1, levels: [{ price: 120, value: 0.8 }, { price: 260, value: 0.55 }, { price: 480, value: 0.35 }], fmt: (v) => `${v}s dash cooldown` },
  speed:     { name: 'Comfy Clogs', icon: '🥿', desc: 'Walk faster around the kitchen.', base: 1, levels: [{ price: 180, value: 1.1 }, { price: 380, value: 1.2 }], fmt: (v) => `${Math.round(v * 100)}% move speed` },
  knives:    { name: 'Sharpened Knives', icon: '🔪', desc: 'Chop and knead faster (you & staff).', base: 1, levels: [{ price: 150, value: 1.35 }, { price: 320, value: 1.7 }, { price: 600, value: 2.1 }], fmt: (v) => `${Math.round(v * 100)}% chop speed` },
  burners:   { name: 'High-Speed Burners', icon: '♨️', desc: 'Every cooker cooks faster.', base: 1, levels: [{ price: 220, value: 1.25 }, { price: 480, value: 1.5 }], fmt: (v) => `${Math.round(v * 100)}% cook speed` },
  timer:     { name: 'Smart Timers', icon: '⏲️', desc: 'Finished food takes longer to burn.', base: 1, levels: [{ price: 140, value: 1.45 }, { price: 300, value: 2 }], fmt: (v) => `${Math.round(v * 100)}% burn window` },
  fireproof: { name: 'Fireproof Stoves', icon: '🧯', desc: 'Burnt food never ignites. Peace of mind!', base: 0, levels: [{ price: 520, value: 1 }], fmt: (v) => (v ? 'No more fires' : 'Fires possible') },
  plates:    { name: 'More Plates', icon: '🍽️', desc: '+2 plates in circulation.', base: 5, levels: [{ price: 60, value: 7 }, { price: 120, value: 9 }, { price: 200, value: 11 }, { price: 320, value: 13 }], fmt: (v) => `${v} plates` },
  capacity:  { name: 'Marketing Campaign', icon: '📣', desc: 'More customer groups at once.', base: 3, levels: [{ price: 150, value: 4 }, { price: 350, value: 5 }, { price: 650, value: 6 }, { price: 1000, value: 8 }], fmt: (v) => `${v} groups at once` },
  patience:  { name: 'Free Breadsticks', icon: '🥖', desc: 'Customers wait longer for food.', base: 1, levels: [{ price: 160, value: 1.15 }, { price: 360, value: 1.3 }], fmt: (v) => `${Math.round(v * 100)}% patience` },
  floor:     { name: 'Restaurant Expansion', icon: '🏗️', desc: 'Knock down walls for more floor space.', base: 0, levels: [{ price: 600, value: 1 }, { price: 1300, value: 2 }, { price: 2400, value: 3 }], fmt: (v) => `${FLOOR_LEVELS[v].w} × ${FLOOR_LEVELS[v].h} floor` },
};

// ---------------------------------------------------------------------------
// Staff
export const STAFF_TYPES = {
  chef:   { name: 'Sous-Chef', icon: '🧑‍🍳', hire: 250, wage: 30, desc: 'Fetches, chops & cooks ingredients for open orders. Rescues food before it burns. Lv3 plates complete dishes onto the Pass.' },
  waiter: { name: 'Waiter', icon: '🤵', hire: 180, wage: 22, desc: 'Delivers finished dishes from the Serving Pass, clears tables and collects cash.' },
  dish:   { name: 'Dishwasher', icon: '🧽', hire: 130, wage: 16, desc: 'Scrubs dirty plates at the sink and restocks the plate rack.' },
};
export const STAFF_LEVELS = [
  { speed: 2.7, work: 0.75, label: 'Trainee' },
  { speed: 3.3, work: 1.0, label: 'Pro' },
  { speed: 4.0, work: 1.35, label: 'Master' },
];
export const STAFF_UPGRADE_COST = [0, 220, 450];
export const MAX_STAFF = 6;

// ---------------------------------------------------------------------------
// Cosmetic themes
export const FLOOR_THEMES = {
  wood:       { name: 'Oak Planks', price: 0, decor: 0 },
  checker:    { name: 'Diner Checker', price: 120, decor: 3 },
  terracotta: { name: 'Terracotta', price: 160, decor: 4 },
  mint:       { name: 'Mint Retro', price: 190, decor: 5 },
  marble:     { name: 'Royal Marble', price: 420, decor: 10 },
};
export const WALL_THEMES = {
  cream:  { name: 'Cream Stripes', price: 0, decor: 0 },
  brick:  { name: 'Rustic Brick', price: 140, decor: 3 },
  sage:   { name: 'Sage Damask', price: 180, decor: 5 },
  navy:   { name: 'Navy Wainscot', price: 230, decor: 6 },
  sunset: { name: 'Sunset Tiles', price: 320, decor: 8 },
};
