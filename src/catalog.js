// Buildable appliance / furniture catalog, starter layout, upgrades, staff & cosmetic themes.

import { SURFACE_Y, FLOOR_LEVELS } from './config.js';
import { INGREDIENTS } from './recipes.js';

export const CATEGORIES = [
  { id: 'supplies', name: 'Supplies', icon: 'crate' },
  { id: 'prep', name: 'Prep', icon: 'knife' },
  { id: 'cooking', name: 'Cooking', icon: 'pan' },
  { id: 'dining', name: 'Dining', icon: 'cloche' },
  { id: 'decor', name: 'Decor', icon: 'plant' },
  { id: 'show', name: 'Showpieces', icon: 'crown' },
  { id: 'auto', name: 'Automation', icon: 'conveyor' },
  { id: 'style', name: 'Style', icon: 'roller' },
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
add('stove', { name: 'Stove', cat: 'cooking', price: 90, station: 'cooker', cook: 'stove', desc: 'Sears patties and meat. Food left on it too long burns.' });
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
add('parasol', {
  name: 'Parasol Table', cat: 'dining', price: 110, size: [3, 1], station: 'table', flammable: false, decor: 4, style: 'parasol',
  cells: [[0, 0, 'seat'], [1, 0, 'table'], [2, 0, 'seat']], seats: 2, patience: 1.05,
  desc: 'Café table under a striped sunshade. Guests here are 5% more patient.',
});
add('bar', {
  name: 'Diner Counter', cat: 'dining', price: 150, size: [3, 2], station: 'table', flammable: false, decor: 3, style: 'bar',
  cells: [[0, 0, 'table'], [1, 0, 'table'], [2, 0, 'table'], [0, 1, 'seat'], [1, 1, 'seat'], [2, 1, 'seat']], seats: 3,
  desc: 'Three spinning stools at a chrome counter. Great for solo diners and pairs.',
});
add('roundtable', {
  name: 'Round Table', cat: 'dining', price: 170, size: [3, 3], station: 'table', flammable: false, decor: 4, style: 'round',
  cells: [[1, 0, 'seat'], [0, 1, 'seat'], [1, 1, 'table'], [2, 1, 'seat'], [1, 2, 'seat']], seats: 4,
  desc: 'Seats four around one big round top. The corners stay free to walk through.',
});
add('lounge', {
  name: 'Velvet Lounge', cat: 'dining', price: 360, size: [3, 2], station: 'table', flammable: false, decor: 10, style: 'lounge', stars: 2.5,
  cells: [[0, 0, 'seat'], [1, 0, 'table'], [2, 0, 'seat'], [0, 1, 'seat'], [1, 1, 'table'], [2, 1, 'seat']], seats: 4, patience: 1.25,
  desc: 'Four armchairs around a marble top. Guests here are 25% more patient.',
});

// --- Decor ----------------------------------------------------------------
// perk: a bonus the first copy of an item gives the whole restaurant (copies don't stack it).
// stars: rating needed before it can be bought.
add('cactus', { name: 'Cactus Pot', cat: 'decor', price: 20, decor: 2, desc: 'Low effort, high charm.' });
add('plant', { name: 'Potted Plant', cat: 'decor', price: 25, decor: 3, desc: 'A leafy friend. +Ambience' });
add('flowers', { name: 'Tulip Vase', cat: 'decor', price: 30, decor: 3, desc: 'Fresh tulips on a little pedestal.' });
add('coatrack', { name: 'Coat Rack', cat: 'decor', price: 35, decor: 2, desc: 'Somewhere for hats and scarves.' });
add('barrel', { name: 'Barrel Planter', cat: 'decor', price: 40, decor: 3, desc: 'An old barrel full of daisies.' });
add('runner', { name: 'Runner Rug', cat: 'decor', price: 40, decor: 3, size: [3, 1], layer: 'floor', solid: false, flammable: false, desc: 'A long woven runner. Walkable, goes under furniture.' });
add('rug', { name: 'Fancy Rug', cat: 'decor', price: 45, decor: 4, size: [2, 2], layer: 'floor', solid: false, flammable: false, desc: 'Walkable woven rug. Can go under furniture.' });
add('roundrug', { name: 'Round Rug', cat: 'decor', price: 50, decor: 4, size: [2, 2], layer: 'floor', solid: false, flammable: false, desc: 'A soft round rug in sunny stripes. Walkable.' });
add('gumball', { name: 'Gumball Machine', cat: 'decor', price: 45, decor: 3, flammable: false, perk: { arrivals: 0.03 }, desc: 'Kids drag their parents in for one.' });
add('easel', { name: 'Specials Board', cat: 'decor', price: 50, decor: 3, perk: { arrivals: 0.04 }, desc: "Chalkboard with today's specials. Tempts people walking by." });
add('lamp', { name: 'Mood Lamp', cat: 'decor', price: 55, decor: 5, light: true, desc: 'Warm glow. Nearby guests are calmer. +Ambience' });
add('palm', { name: 'Lucky Palm', cat: 'decor', price: 60, decor: 6, desc: 'Tropical vibes. ++Ambience' });
add('lavalamp', { name: 'Lava Lamp', cat: 'decor', price: 65, decor: 4, light: true, desc: 'Slow purple blobs on a side table.' });
add('painting', { name: 'Art Easel', cat: 'decor', price: 75, decor: 5, desc: 'A sunny landscape, still drying.' });
add('sunflowers', { name: 'Sunflower Box', cat: 'decor', price: 80, decor: 6, size: [2, 1], desc: 'A long planter of tall sunflowers.' });
add('globe', { name: 'Old Globe', cat: 'decor', price: 85, decor: 5, desc: 'Spins slowly on a brass stand.' });
add('bonsai', { name: 'Bonsai Stand', cat: 'decor', price: 90, decor: 6, desc: 'A patient little tree on a low table.' });
add('luckycat', { name: 'Lucky Cat', cat: 'decor', price: 95, decor: 5, flammable: false, perk: { tips: 0.03 }, desc: 'Waves guests in and their tips up.' });
add('bookshelf', { name: 'Bookshelf', cat: 'decor', price: 110, decor: 7, size: [2, 1], desc: 'Packed with cookbooks and comics.' });
add('lantern', { name: 'Lantern Post', cat: 'decor', price: 120, decor: 7, light: true, desc: 'Paper lanterns that sway and glow.' });
add('neon', { name: 'Neon Heart', cat: 'decor', price: 140, decor: 8, light: true, flammable: false, perk: { arrivals: 0.05 }, desc: 'A buzzing pink sign that pulls in passers-by.' });
add('clock', { name: 'Grandfather Clock', cat: 'decor', price: 150, decor: 8, perk: { patience: 0.03 }, desc: 'Its slow tick makes waiting feel shorter.' });

// --- Showpieces (big statement pieces with restaurant-wide perks) ----------
add('cat', { name: 'Shop Cat', cat: 'show', price: 160, decor: 9, stars: 1.5, perk: { review: 0.1 }, desc: 'Naps in a basket all day. Everyone loves the cat.' });
add('parrot', { name: 'Chatty Parrot', cat: 'show', price: 180, decor: 9, stars: 1.5, perk: { queue: 0.25 }, desc: 'Chats to the queue, so it waits longer.' });
add('popcorn', { name: 'Popcorn Cart', cat: 'show', price: 190, decor: 9, stars: 1.8, perk: { arrivals: 0.05 }, desc: 'The smell drifts out into the street.' });
add('jukebox', { name: 'Jukebox', cat: 'show', price: 200, decor: 10, perk: { tips: 0.03 }, desc: 'Plays the hits. Happy diners tip a bit more.' });
add('sodafridge', { name: 'Soda Cooler', cat: 'show', price: 220, decor: 8, stars: 2, light: true, flammable: false, perk: { tips: 0.04 }, desc: 'Glowing glass fridge of fizzy drinks.' });
add('fishtank', { name: 'Aquarium', cat: 'show', price: 240, decor: 14, size: [2, 1], flammable: false, perk: { patience: 0.05 }, desc: 'Mesmerising fish. Guests wait more calmly.' });
add('arcade', { name: 'Arcade Cabinet', cat: 'show', price: 260, decor: 11, stars: 2, light: true, flammable: false, perk: { queue: 0.3 }, desc: 'Something to play while waiting for a table.' });
add('cakecase', { name: 'Cake Display', cat: 'show', price: 300, decor: 13, size: [2, 1], stars: 2.2, flammable: false, perk: { tips: 0.05 }, desc: 'A glass case of towering cakes.' });
add('trophy', { name: 'Trophy Case', cat: 'show', price: 320, decor: 14, size: [2, 1], stars: 2.5, perk: { critic: 0.3 }, desc: 'Show off your awards. Critics pay 30% more.' });
add('fountain', { name: 'Fountain', cat: 'show', price: 380, decor: 20, size: [2, 2], flammable: false, perk: { review: 0.1 }, desc: 'The pinnacle of fine dining décor.' });
add('wishingwell', { name: 'Wishing Well', cat: 'show', price: 400, decor: 18, size: [2, 2], stars: 2.8, flammable: false, perk: { tips: 0.05 }, desc: 'Guests toss in a coin for luck, and tip on the way out.' });
add('piano', { name: 'Grand Piano', cat: 'show', price: 450, decor: 20, size: [2, 2], stars: 3, perk: { patience: 0.06 }, desc: 'Soft live music keeps everyone relaxed.' });
add('fireplace', { name: 'Stone Fireplace', cat: 'show', price: 480, decor: 20, size: [2, 1], stars: 3.2, light: true, flammable: false, perk: { patience: 0.06 }, desc: 'A crackling fire. Cosy and calming.' });
add('sakura', { name: 'Blossom Tree', cat: 'show', price: 520, decor: 24, size: [2, 2], stars: 3.5, perk: { review: 0.15 }, desc: 'An indoor cherry tree in full bloom.' });
add('statue', { name: 'Golden Chef', cat: 'show', price: 650, decor: 26, stars: 4, flammable: false, perk: { arrivals: 0.08, critic: 0.2 }, desc: 'A gleaming statue of you. People come just to see it.' });

// --- Automation -----------------------------------------------------------
add('conveyor', { name: 'Conveyor Belt', cat: 'auto', price: 70, station: 'conveyor', desc: 'Moves items forward onto the next station. Rotate with R.' });
add('grabber', { name: 'Grabber Arm', cat: 'auto', price: 130, station: 'grabber', desc: 'Takes from the station behind it and places in front.' });
add('autochopper', { name: 'Auto-Chopper', cat: 'auto', price: 240, station: 'board', auto: true, desc: 'Chops anything placed on it, hands-free.' });
add('autowasher', { name: 'Auto-Dishwasher', cat: 'auto', price: 320, station: 'autowasher', flammable: false, desc: 'Washes up to 8 dirty plates by itself.' });

export function catalogByCategory(cat) {
  return Object.values(CATALOG).filter((d) => d.cat === cat);
}

// Restaurant-wide perks, capped so stacking every showpiece can't break the game.
const pct = (v) => `+${Math.round(v * 100)}%`;
export const PERKS = {
  tips:     { cap: 0.2, label: (v) => `${pct(v)} tips` },
  patience: { cap: 0.2, label: (v) => `${pct(v)} patience` },
  queue:    { cap: 0.6, label: (v) => `${pct(v)} queue time` },
  arrivals: { cap: 0.25, label: (v) => `${pct(v)} guests` },
  review:   { cap: 0.4, label: (v) => `+${v.toFixed(2).replace(/0$/, '')}★ reviews` },
  critic:   { cap: 0.6, label: (v) => `${pct(v)} critic bonus` },
};

export function perkText(perk) {
  return Object.entries(perk || {}).map(([k, v]) => PERKS[k].label(v)).join(', ');
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
  dash:      { name: 'Running Shoes', icon: 'wind', desc: 'Your dash recharges faster.', base: 1.1, levels: [{ price: 120, value: 0.8 }, { price: 260, value: 0.55 }, { price: 480, value: 0.35 }], fmt: (v) => `${v}s dash cooldown` },
  speed:     { name: 'Kitchen Clogs', icon: 'shoe', desc: 'You walk faster.', base: 1, levels: [{ price: 180, value: 1.1 }, { price: 380, value: 1.2 }], fmt: (v) => `${Math.round(v * 100)}% move speed` },
  knives:    { name: 'Whetstone', icon: 'knife', desc: 'You and your staff chop and knead faster.', base: 1, levels: [{ price: 150, value: 1.35 }, { price: 320, value: 1.7 }, { price: 600, value: 2.1 }], fmt: (v) => `${Math.round(v * 100)}% chop speed` },
  burners:   { name: 'Bigger Burners', icon: 'fire', desc: 'Every stove, pot, fryer and oven cooks faster.', base: 1, levels: [{ price: 220, value: 1.25 }, { price: 480, value: 1.5 }], fmt: (v) => `${Math.round(v * 100)}% cook speed` },
  timer:     { name: 'Egg Timers', icon: 'timer', desc: 'Finished food takes longer to burn.', base: 1, levels: [{ price: 140, value: 1.45 }, { price: 300, value: 2 }], fmt: (v) => `${Math.round(v * 100)}% burn window` },
  fireproof: { name: 'Flame-Guard Stoves', icon: 'extinguisher', desc: 'Burnt food never catches fire.', base: 0, levels: [{ price: 520, value: 1 }], fmt: (v) => (v ? 'No more fires' : 'Fires possible') },
  plates:    { name: 'Extra Plates', icon: 'plate', desc: 'Two more plates in circulation.', base: 5, levels: [{ price: 60, value: 7 }, { price: 120, value: 9 }, { price: 200, value: 11 }, { price: 320, value: 13 }], fmt: (v) => `${v} plates` },
  capacity:  { name: 'Flyers Around Town', icon: 'megaphone', desc: 'More groups of guests at once.', base: 3, levels: [{ price: 150, value: 4 }, { price: 350, value: 5 }, { price: 650, value: 6 }, { price: 1000, value: 8 }], fmt: (v) => `${v} groups at once` },
  patience:  { name: 'Free Bread Basket', icon: 'bread', desc: 'Guests wait longer for their food.', base: 1, levels: [{ price: 160, value: 1.15 }, { price: 360, value: 1.3 }], fmt: (v) => `${Math.round(v * 100)}% patience` },
  floor:     { name: 'Knock Through a Wall', icon: 'floor', desc: 'More floor space.', base: 0, levels: [{ price: 600, value: 1 }, { price: 1300, value: 2 }, { price: 2400, value: 3 }], fmt: (v) => `${FLOOR_LEVELS[v].w} × ${FLOOR_LEVELS[v].h} floor` },
};

// ---------------------------------------------------------------------------
// Staff
export const STAFF_TYPES = {
  chef:   { name: 'Sous-Chef', hire: 150, wage: 20, desc: 'Fetches, chops and cooks ingredients for open orders, and pulls food off the heat before it burns. At level 3 they plate whole dishes onto the serving pass.' },
  waiter: { name: 'Waiter', hire: 90, wage: 12, desc: 'Carries finished dishes from the serving pass, clears tables and collects payment.' },
  dish:   { name: 'Dishwasher', hire: 60, wage: 8, desc: 'Washes dirty plates at the sink and refills the plate rack.' },
};
export const STAFF_LEVELS = [
  { speed: 3.0, work: 0.8, label: 'Trainee' },
  { speed: 3.6, work: 1.1, label: 'Pro' },
  { speed: 4.3, work: 1.45, label: 'Master' },
];
export const STAFF_UPGRADE_COST = [0, 300, 600];
export const MAX_STAFF = 6;

// ---------------------------------------------------------------------------
// Cosmetic themes
export const FLOOR_THEMES = {
  wood:       { name: 'Oak Planks', price: 0, decor: 0 },
  checker:    { name: 'Diner Checker', price: 120, decor: 3 },
  terracotta: { name: 'Terracotta', price: 160, decor: 4 },
  mint:       { name: 'Mint Retro', price: 190, decor: 5 },
  parquet:    { name: 'Parquet', price: 220, decor: 6 },
  cherry:     { name: 'Strawberry Milk', price: 260, decor: 7 },
  terrazzo:   { name: 'Terrazzo', price: 300, decor: 8 },
  marble:     { name: 'Royal Marble', price: 420, decor: 10 },
  starry:     { name: 'Starry Night', price: 480, decor: 12 },
};
export const WALL_THEMES = {
  cream:  { name: 'Cream Stripes', price: 0, decor: 0 },
  brick:  { name: 'Rustic Brick', price: 140, decor: 3 },
  sage:   { name: 'Sage Damask', price: 180, decor: 5 },
  navy:   { name: 'Navy Wainscot', price: 230, decor: 6 },
  candy:  { name: 'Candy Stripes', price: 160, decor: 4 },
  cabin:  { name: 'Log Cabin', price: 210, decor: 6 },
  subway: { name: 'Subway Tiles', price: 240, decor: 6 },
  sunset: { name: 'Sunset Tiles', price: 320, decor: 8 },
  jungle: { name: 'Jungle Leaves', price: 340, decor: 9 },
  galaxy: { name: 'Galaxy Mural', price: 520, decor: 13 },
};
