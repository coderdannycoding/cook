// Home: after closing, the chef can visit their own plot. Buy and upgrade the house (a tent up to a
// hilltop mansion), adopt pets that roam the yard and collect cars (up to a gold hypercar) that park
// on the drive. Everything is procedural and lives in its own small scene, shown in place of the
// restaurant while home is open. The DOM panel is in home-ui.js.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { CAMERA, ECON } from './config.js';
import { clamp, damp, dampAngle, rand, pick, TAU, easeOutBack, formatMoney, wrapAngle, MinHeap } from './utils.js';
import {
  mat, mesh, box, rbox, cyl, sph, cone, torus, ico, capsule, mergeStatic, disposeObject, buildCharacter, playerLook, buildStreetLamp, envMats,
} from './models.js';
import { buildGarden, makeBlobShadow } from './look.js';
import { grassTexture, sidewalkTexture, roadTexture } from './textures.js';
import { ThumbnailBaker } from './renderer.js';
import { perkText } from './catalog.js';
import { icon } from './icons.js';
import { HomePanel } from './home-ui.js';
import { HOME_ITEMS, ITEM_GROUPS, buildHomeItem } from './home-items.js';

// catalogs
export const HOME_TIERS = {
  tent: { level: 0, name: 'Camping Tent', price: 0, desc: 'A snug tent and a crackling campfire. Everyone starts somewhere.' },
  cabin: { level: 1, name: 'Cosy Cabin', price: 1500, perk: { tips: 0.02 }, desc: 'A log cabin with a porch, a rocking chair and a smoking chimney.' },
  house: { level: 2, name: 'Suburban House', price: 4000, perk: { tips: 0.04 }, desc: 'Two storeys, a picket fence and a proper garage.' },
  villa: { level: 3, name: 'Modern Villa', price: 9000, perk: { tips: 0.06, patience: 0.03 }, desc: 'Glass walls, a roof terrace and a pool with a flamingo float.' },
  mansion: { level: 4, name: 'Hilltop Mansion', price: 20000, perk: { tips: 0.08, patience: 0.04, review: 0.05 }, desc: 'Columns, a fountain, iron gates and hand-trimmed hedges.' },
};
const TIER_IDS = Object.keys(HOME_TIERS);

// style: how the pet moves about (dog, cat, hop, slow, bird, pony)
export const PETS = {
  bunny: { name: 'Bunny', price: 250, perk: { patience: 0.02 }, style: 'hop', speed: 1.7, desc: 'Hops about the lawn nibbling clover.' },
  turtle: { name: 'Turtle', price: 300, perk: { queue: 0.04 }, style: 'slow', speed: 0.32, desc: 'Slow and steady. Teaches everyone patience.' },
  cat: { name: 'Tabby Cat', price: 400, perk: { tips: 0.02 }, style: 'cat', speed: 1.5, desc: 'Naps in the sun and judges the dogs.' },
  corgi: { name: 'Corgi', price: 500, perk: { queue: 0.03 }, style: 'dog', speed: 2.1, desc: 'Short legs, big ears, endless zoomies.' },
  pig: { name: 'Mini Pig', price: 650, perk: { patience: 0.02 }, style: 'pig', speed: 1.2, desc: 'Loves belly rubs and leftover fries.' },
  parrot: { name: 'Parrot', price: 900, perk: { queue: 0.05 }, style: 'bird', speed: 1.0, desc: 'Squawks hello at everyone who walks past.' },
  dalmatian: { name: 'Dalmatian', price: 1200, perk: { arrivals: 0.01 }, style: 'dog', speed: 2.5, desc: 'A spotty speedster who follows you everywhere.' },
  retriever: { name: 'Golden Retriever', price: 1500, perk: { tips: 0.02 }, style: 'dog', speed: 2.2, desc: 'The goodest of good dogs.' },
  fox: { name: 'Fox', price: 2500, perk: { critic: 0.05 }, style: 'cat', speed: 2.3, desc: 'A clever friend with a fluffy tail. Critics adore it.' },
  unicorn: { name: 'Unicorn Pony', price: 8000, perk: { review: 0.04, arrivals: 0.02 }, style: 'pony', speed: 1.8, lux: true, desc: 'Rainbow mane, golden horn and a trail of sparkles.' },
};
export const PET_LIMITS = { same: 3, total: 12 };
const PET_SCALE = 1.25;
export const PET_BONUS = { count: 3, perk: { review: 0.05 } };
// Pet care: happiness (joy, 0-100) drops a little every working day and comes back with pats and
// treats. Only happy pets give their bonus. Pet furniture in the yard slows the drop.
export const PET_CARE = { happy: 40, treat: 25, treatJoy: 30, pat: 5, pats: 6, drop: 18 };
const PET_NAMES = [
  'Biscuit', 'Mochi', 'Pickles', 'Noodle', 'Waffles', 'Peanut', 'Pepper', 'Tofu', 'Nugget', 'Muffin',
  'Dumpling', 'Sprout', 'Pretzel', 'Bean', 'Taco', 'Toffee', 'Cookie', 'Olive', 'Ziggy', 'Sushi',
];
// Paint jobs: house walls and roof (reset when you move), and the body colour of each car
export const PAINT = {
  wall: ['#f7f5f0', '#f6ead2', '#ffe08a', '#ffc9d6', '#d9c8f0', '#a9d8ec', '#b8e0b0', '#e8a27a', '#b5773f', '#8d99ae'],
  roof: ['#4f5d8c', '#c8443a', '#4f8a4a', '#3a3f4a', '#7a4a2e', '#2f8cf0', '#9b5cf6', '#e8843f', '#f4f1ea', '#2f6f6a'],
  car: ['#e8343f', '#ff8a3a', '#ffc21a', '#4fd1b0', '#2f8cf0', '#9b5cf6', '#ff6fae', '#22232c', '#f4f4f0', '#8d99ae'],
  house: 300,
  carPrice: 250,
};

export const CARS = {
  scooter: { name: 'City Scooter', price: 600, perk: { queue: 0.03 }, desc: 'Zippy, cheap and easy to park.' },
  hatch: { name: 'Compact Hatchback', price: 1500, perk: { patience: 0.02 }, desc: 'A cheerful little runabout.' },
  pickup: { name: 'Pickup Truck', price: 3000, perk: { tips: 0.02 }, desc: 'Hauls crates back from the market.' },
  classic: { name: 'Classic Convertible', price: 5500, perk: { review: 0.02 }, desc: 'Fins, chrome and whitewall tyres.' },
  sports: { name: 'Sports Car', price: 9000, perk: { arrivals: 0.02 }, lux: true, desc: 'Racing stripes and a roaring engine.' },
  limo: { name: 'Stretch Limo', price: 14000, perk: { arrivals: 0.03, critic: 0.1 }, lux: true, desc: 'Critics love being picked up in style.' },
  supercar: { name: 'Supercar', price: 22000, perk: { arrivals: 0.03 }, lux: true, desc: 'Scissor doors and a giant rear wing.' },
  hypercar: { name: 'Golden Hypercar', price: 40000, perk: { arrivals: 0.04, review: 0.03 }, lux: true, desc: 'Plated in gold. The whole town knows your name.' },
};

// Helpers you can hire for the home; wages are paid at the end of each working day
export const HOME_STAFF = {
  gardener: { name: 'Gardener', wage: 30, desc: 'Picks any crops you missed each day and keeps the garden neat (+10 comfort).' },
  sitter: { name: 'Pet Sitter', wage: 25, desc: 'Plays with the pets while you work, so they never miss you.' },
  butler: { name: 'Butler', wage: 45, desc: 'Tea, slippers and a hot bath: you start every day well rested.' },
};
const HELPER_LOOKS = {
  gardener: { skin: '#e0a878', shirt: '#6fbf4a', apron: '#7a5538', hair: '#4a2f1e', hairStyle: 'short', hat: 'cap', hatColor: '#2f6f2a', scale: 0.95 },
  sitter: { skin: '#ffe3cc', shirt: '#ff8fb0', hair: '#d6a24a', hairStyle: 'pony', scarf: '#ffd23f', scale: 0.93 },
  butler: { skin: '#c68a5a', shirt: '#ffffff', vest: '#1d1a2f', bowtie: '#b0263a', hair: '#1c1c24', hairStyle: 'short', mustache: true, scale: 0.97 },
};
// Relaxing at home (or a butler) leaves you well rested for the next day
export const REST_PERK = { tips: 0.03, patience: 0.03 };
// Crops: pick once a day for coins
const HARVEST = { veggies: 40, appletree: 30, beehive: 45, greenhouse: 60 };
// The daily letter in the mailbox
const FAN_LINES = [
  'Your food made my whole week.', 'Best meal in town, no contest.', 'My kids still talk about your desserts.',
  'Thanks for squeezing us in right before closing!', 'The service was lightning fast. Keep it up!',
  'We celebrated our anniversary at your place. Perfect night.', 'I came for one dish and stayed for three.',
];
const FANS = ['Rosa from Maple Street', 'a very full trucker', 'the Nguyen family', 'Grandpa Joe', 'a tired nurse', 'the bakery next door', 'Coach Patel'];

// Comfort: the house, every piece of yard furniture and the pets add to it. Each level gives the
// restaurant a little more patience and tips. Extra copies of the same piece count for half.
const TIER_COMFORT = [0, 10, 20, 35, 50];
export const COMFORT_LEVELS = [
  { at: 0, name: 'Bare' }, { at: 20, name: 'Homely' }, { at: 45, name: 'Cosy' },
  { at: 80, name: 'Lovely' }, { at: 130, name: 'Dreamy' }, { at: 200, name: 'Paradise' },
];

export function defaultHomeState() {
  return {
    tier: 0, pets: [], cars: [], favCar: null, items: [], storage: {}, care: [], paint: { wall: null, roof: null }, carPaint: {},
    staff: [], rested: 0, mailDay: 0,
  };
}
const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
function newPetName(home) {
  const used = new Set((home.care || []).map((c) => c.name));
  return PET_NAMES.find((n) => !used.has(n)) ?? pick(PET_NAMES);
}

// Fills in missing fields and drops anything unknown (old or hand-edited saves), in place
function normalizeHome(h) {
  if (!h || typeof h !== 'object') return defaultHomeState();
  h.tier = clamp(Math.floor(Number(h.tier) || 0), 0, TIER_IDS.length - 1);
  h.pets = Array.isArray(h.pets) ? h.pets.filter((id) => PETS[id]).slice(0, PET_LIMITS.total) : [];
  h.cars = Array.isArray(h.cars) ? [...new Set(h.cars.filter((id) => CARS[id]))] : [];
  if (!h.cars.includes(h.favCar)) h.favCar = h.cars[0] ?? null;
  const int = (v) => Math.floor(Number(v) || 0);
  h.items = Array.isArray(h.items)
    ? h.items.filter((it) => it && HOME_ITEMS[it.id]).map((it) => ({ id: it.id, c: int(it.c), r: int(it.r), rot: ((int(it.rot) % 4) + 4) % 4, ...(it.picked ? { picked: int(it.picked) } : {}) }))
    : [];
  const store = {};
  for (const [id, n] of Object.entries(h.storage && typeof h.storage === 'object' ? h.storage : {})) {
    if (HOME_ITEMS[id] && int(n) > 0) store[id] = Math.min(99, int(n));
  }
  // Yard pieces bought before the yard had a grid wait in storage to be placed
  if (Array.isArray(h.decor)) for (const id of h.decor) if (HOME_ITEMS[id]) store[id] = (store[id] || 0) + 1;
  delete h.decor;
  h.storage = store;
  const care = Array.isArray(h.care) ? h.care : [];
  h.care = [];
  h.pets.forEach((id, i) => {
    const c = care[i] && typeof care[i] === 'object' ? care[i] : {};
    h.care.push({
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 14) : newPetName(h),
      joy: Number.isFinite(c.joy) ? clamp(c.joy, 0, 100) : 80,
      pats: clamp(int(c.pats), 0, 99),
    });
  });
  const pt = h.paint && typeof h.paint === 'object' ? h.paint : {};
  h.paint = { wall: isHex(pt.wall) ? pt.wall : null, roof: isHex(pt.roof) ? pt.roof : null };
  h.fence = FENCES[h.fence] ? h.fence : null;
  const cp = h.carPaint && typeof h.carPaint === 'object' ? h.carPaint : {};
  h.carPaint = {};
  for (const [id, c] of Object.entries(cp)) if (CARS[id] && isHex(c)) h.carPaint[id] = c;
  h.staff = Array.isArray(h.staff) ? [...new Set(h.staff.filter((id) => HOME_STAFF[id]))] : [];
  h.rested = int(h.rested);
  h.mailDay = int(h.mailDay);
  return h;
}

const happyAt = (home, i) => (Number.isFinite(home?.care?.[i]?.joy) ? home.care[i].joy : 80) >= PET_CARE.happy;

// Day `day` of work has ended: pets miss you a little (less with pet furniture, not at all with
// a sitter), the gardener picks any crops you left, and the helpers are paid. Returns the money.
export function homeNewDay(home, day) {
  const out = { income: 0, wages: 0 };
  if (!home || !Array.isArray(home.care)) return out;
  const staff = Array.isArray(home.staff) ? home.staff : [];
  const kinds = new Set((home.items || []).filter((it) => HOME_ITEMS[it?.id]?.pet).map((it) => it.id)).size;
  const drop = staff.includes('sitter') ? 0 : Math.max(6, PET_CARE.drop - kinds * 3);
  for (const c of home.care) {
    c.joy = clamp((Number(c.joy) || 0) - drop, 0, 100);
    c.pats = 0;
  }
  if (staff.includes('gardener')) {
    for (const it of home.items || []) {
      if (!HARVEST[it.id] || (it.picked || 0) >= day) continue;
      it.picked = day;
      out.income += HARVEST[it.id];
    }
  }
  for (const id of staff) out.wages += HOME_STAFF[id]?.wage || 0;
  return out;
}
export function sadPets(home) {
  return Array.isArray(home?.pets) ? home.pets.filter((id, i) => !happyAt(home, i)).length : 0;
}
export { normalizeHome };

export function isRested(home, day) {
  return !!home && ((Array.isArray(home.staff) && home.staff.includes('butler')) || (day > 0 && home.rested === day));
}

export function homeComfort(home) {
  if (!home) return 0;
  let n = TIER_COMFORT[clamp(Math.floor(Number(home.tier) || 0), 0, TIER_COMFORT.length - 1)];
  const seen = new Set();
  for (const it of Array.isArray(home.items) ? home.items : []) {
    const D = HOME_ITEMS[it?.id];
    if (!D) continue;
    n += seen.has(it.id) ? D.comfort / 2 : D.comfort;
    seen.add(it.id);
  }
  n += (Array.isArray(home.pets) ? home.pets.filter((id, i) => happyAt(home, i)).length : 0) * 2;
  if (Array.isArray(home.staff) && home.staff.includes('gardener')) n += 10;
  return Math.round(n);
}
export function comfortLevel(comfort) {
  let i = 0;
  while (i + 1 < COMFORT_LEVELS.length && comfort >= COMFORT_LEVELS[i + 1].at) i++;
  return i;
}

// Restaurant bonuses from the home (fractions, same keys as catalog PERKS). Pets count once per kind.
export function homePerks(home, day = 0) {
  const out = {};
  if (!home) return out;
  const add = (perk) => { for (const [k, v] of Object.entries(perk || {})) out[k] = (out[k] || 0) + v; };
  add(HOME_TIERS[TIER_IDS[clamp(Math.floor(Number(home.tier) || 0), 0, TIER_IDS.length - 1)]].perk);
  const pets = Array.isArray(home.pets) ? home.pets.filter((id, i) => PETS[id] && happyAt(home, i)) : [];
  for (const id of new Set(pets)) add(PETS[id].perk);
  if (pets.length >= PET_BONUS.count) add(PET_BONUS.perk);
  for (const id of new Set(Array.isArray(home.cars) ? home.cars : [])) add(CARS[id]?.perk);
  for (const id of new Set(Array.isArray(home.items) ? home.items.map((it) => it?.id) : [])) add(HOME_ITEMS[id]?.perk);
  const lv = comfortLevel(homeComfort(home));
  if (lv) add({ tips: lv * 0.01, patience: lv * 0.01 });
  if (isRested(home, day)) add(REST_PERK);
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 1000) / 1000;
  return out;
}

// layout (plot coordinates)
const OX = 300, OZ = 0; // the plot sits far away from the restaurant
const HOME_HOUR = 18.3;
const ZOOM = 0.8; // default framing: a little closer than the whole plot
const PLOT = { x0: -9.4, x1: 9.4, z0: -6.4, z1: 6 };
const SITE = { x: -3.4, z: -3.0 }; // house centre; houses face +z
const GATE = { x0: -4.2, x1: -2.6 };
const COURT = { x0: 2.6, x1: 9.4 };
const YARD = { x0: -8.7, x1: 2.0, z0: 0.45, z1: 5.5 };
const WALK = { x0: -8.7, x1: 9.0, z0: 0.45, z1: 5.5 };
const SPOTS = [
  { x: 4.2, z: 3.3, turn: true },
  { x: 6.6, z: 3.3 }, { x: 8.3, z: 3.3 },
  { x: 3.6, z: -0.8 }, { x: 5.2, z: -0.8 }, { x: 6.8, z: -0.8 }, { x: 8.4, z: -0.8 },
  { x: 4.6, z: -4.6 },
];
// The yard grid: 1-unit cells in front of the house. Column GRID.path is the garden path to the gate
// and always stays clear.
// It runs on across the driveway, where the parking bays and the turntable stay clear.
const GRID = { x0: -8.9, z0: -0.3, cols: 18, rows: 6, path: 5 };
// How the chef uses each piece: where (item-local, the item faces +z), seat height, facing.
// Seat kinds (sit, lie, soak, bounce, swing, dig) hop onto the piece; the rest stand at `at`.
const USE = {
  lounger: { kind: 'lie', at: [0, -0.1], y: 0.42, face: 0 },
  hammock: { kind: 'lie', at: [0, 0], y: 0.6, face: -Math.PI / 2, hang: [1.0, 0.4, 1.1, 0.12, 0], sway: true },
  patio: { kind: 'sit', at: [-0.72, 0], y: 0.46, face: Math.PI / 2 },
  swingbench: { kind: 'sit', at: [0.25, 0.02], y: 0.5, face: 0, hang: [1.6, 1.12, 1.1, 0.1, 0] },
  firepit: { kind: 'sit', at: [0.75, 0.55], y: 0.4, face: Math.atan2(-0.75, -0.55) },
  hottub: { kind: 'soak', at: [0, 0], y: 0.16, face: 0 },
  trampoline: { kind: 'bounce', at: [0, 0], y: 0.5, face: 0 },
  swingset: { kind: 'sit', at: [-0.55, 0], y: 0.45, face: 0, hang: [1.8, 1.37, 1.6, 0.35, 0] },
  picnic: { kind: 'sit', at: [-0.15, 0.2], y: 0.06, face: 0 },
  gazebo: { kind: 'sit', at: [0, -0.9], y: 0.52, face: 0 },
  movie: { kind: 'sit', at: [0.45, 0.6], y: 0.26, face: Math.PI },
  sandbox: { kind: 'dig', at: [0.3, 0.2], y: 0.16, face: Math.PI * 0.8 },
  slide: { kind: 'slide', at: [0, -1.2], face: 0 },
  bbq: { kind: 'grill', at: [0, 0.7], face: Math.PI },
  pizzaoven: { kind: 'grill', at: [0, 0.9], face: Math.PI },
  telescope: { kind: 'look', at: [0, -0.62], face: 0 },
  hoop: { kind: 'shoot', at: [0, 1.6], face: Math.PI },
  minigolf: { kind: 'putt', at: [-0.62, -0.3], face: Math.PI / 2 },
  veggies: { kind: 'harvest', at: [0, 1.25], face: Math.PI },
  appletree: { kind: 'harvest', at: [0, 0.8], face: Math.PI },
  beehive: { kind: 'harvest', at: [0, 0.85], face: Math.PI },
  greenhouse: { kind: 'harvest', at: [0, 1.35], face: Math.PI },
  adirondack: { kind: 'sit', at: [-0.52, 0.05], y: 0.36, face: 0 },
  sofa: { kind: 'sit', at: [0, -0.5], y: 0.44, face: 0 },
  pergola: { kind: 'sit', at: [0.2, -0.55], y: 0.47, face: 0 },
  tent: { kind: 'lie', at: [0, -0.1], y: 0.1, face: Math.PI },
  bouncy: { kind: 'bounce', at: [0, 0.1], y: 0.34, face: 0 },
  skateramp: { kind: 'bounce', at: [0, 0], y: 0.32, face: Math.PI / 2 },
  kiddiepool: { kind: 'soak', at: [0, 0], y: 0.02, face: 0 },
  pingpong: { kind: 'grill', at: [1.2, 0], face: -Math.PI / 2 },
  observatory: { kind: 'look', at: [0, 1.4], face: Math.PI },
};
const SEATED = new Set(['sit', 'lie', 'soak', 'bounce', 'dig']);
const MAILBOX = { x: GATE.x1 + 0.55, z: PLOT.z1 + 0.5 };
// Every parking bay (owned car or not) and the turntable are kept free of furniture
const RESERVED = SPOTS.map((s) => (s.turn ? { x: s.x, z: s.z, r: 1.45 } : { x0: s.x - 0.65, z0: s.z - 1.15, x1: s.x + 0.65, z1: s.z + 1.15 }));
const POOL = { x0: -8.6, x1: -5.4, z0: 1.15, z1: 3.45 };
const FOUNTAIN = { x: -3.4, z: 3.1, r: 1.15 };

// tiny modelling helpers
const PI = Math.PI;
const E = (c, r = 0.8) => mat(c, { kind: 'env', r });
const C = (c, r = 0.7) => mat(c, { kind: 'char', r });
const P = (c, r = 0.6, m = 0) => mat(c, { r, m });
function put(parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = mesh(geo, typeof m === 'string' ? E(m) : m, x, y, z);
  if (rx || ry || rz) o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}
const sc = (o, x, y = x, z = x) => { o.scale.set(x, y, z); return o; };
const shade = (c, k) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;
function grp(x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}
const dyn = (g) => { g.userData.dynamic = true; return g; };

// Triangular prism: base w along x, apex h above y=0, extruded d along z
const prismCache = new Map();
function prism(w, h, d) {
  const k = `${w},${h},${d}`;
  let g = prismCache.get(k);
  if (!g) {
    const x = w / 2, z = d / 2;
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      -x, 0, z, x, 0, z, 0, h, z, x, 0, -z, -x, 0, -z, 0, h, -z,
      x, 0, z, x, 0, -z, 0, h, -z, x, 0, z, 0, h, -z, 0, h, z,
      -x, 0, -z, -x, 0, z, 0, h, z, -x, 0, -z, 0, h, z, 0, h, -z,
    ], 3));
    g.computeVertexNormals();
    prismCache.set(k, g);
  }
  return g;
}

// Pitched roof over a w×d block whose walls end at y (ridge along x, or along z)
function roof(g, ox, oz, w, d, y, h, wallCol, roofCol, oh = 0.24, alongX = true) {
  const span = alongX ? d : w, len = alongX ? w : d, half = span / 2;
  put(g, prism(span, h, len), wallCol, ox, y, oz, 0, alongX ? PI / 2 : 0, 0);
  const a = Math.atan2(h, half), sl = Math.hypot(half, h), t = 0.14;
  const off = half / 2 + (Math.cos(a) * oh) / 2 + (Math.sin(a) * t) / 2;
  const cy = y + h / 2 - (Math.sin(a) * oh) / 2 + (Math.cos(a) * t) / 2;
  for (const s of [-1, 1]) {
    if (alongX) put(g, rbox(len + oh * 2, t, sl + oh, 0.05, 1), roofCol, ox, cy, oz + s * off, s * a, 0, 0);
    else put(g, rbox(sl + oh, t, len + oh * 2, 0.05, 1), roofCol, ox + s * off, cy, oz, 0, 0, -s * a);
  }
  const ridge = put(g, cyl(0.11, 0.11, len + oh * 2 + 0.04, 8), roofCol, ox, y + h + 0.08, oz);
  if (alongX) ridge.rotation.z = PI / 2;
  else ridge.rotation.x = PI / 2;
}

// Four-sided hip roof (a square pyramid stretched over w×d)
function hipRoof(g, x, y, z, w, d, h, col) {
  const s = grp(x, y + h / 2, z);
  s.scale.set(w / 1.414, h, d / 1.414);
  put(s, cone(1, 1, 4), mat(col, { kind: 'env', r: 0.8, flat: true }), 0, 0, 0, 0, PI / 4, 0);
  g.add(s);
  return s;
}

// A group whose local +z is the outward normal of a wall (x runs along the wall)
function face(g, ry, x, z, y = 0) {
  const f = grp(x, y, z, ry);
  g.add(f);
  return f;
}

const LIT = () => mat('#ffe7b0', { kind: 'env', r: 0.25, e: '#ffb050', ei: 0.65 });
function win(f, x, y, w = 0.6, h = 0.7, o = {}) {
  const fr = o.frame || '#ffffff';
  put(f, box(w, h, 0.06), LIT(), x, y, 0.01).castShadow = false;
  put(f, box(w + 0.14, 0.08, 0.09), fr, x, y + h / 2, 0.03);
  put(f, box(w + 0.14, 0.08, 0.09), fr, x, y - h / 2, 0.03);
  put(f, box(0.08, h, 0.09), fr, x - w / 2, y, 0.03);
  put(f, box(0.08, h, 0.09), fr, x + w / 2, y, 0.03);
  if (!o.plain) {
    put(f, box(0.045, h, 0.07), fr, x, y, 0.03);
    put(f, box(w, 0.045, 0.07), fr, x, y + h * 0.08, 0.03);
  }
  put(f, box(w + 0.26, 0.07, 0.18), fr, x, y - h / 2 - 0.06, 0.08);
  if (o.shutter) for (const s of [-1, 1]) put(f, box(w * 0.42, h + 0.04, 0.05), o.shutter, x + s * (w * 0.71 + 0.06), y, 0.03);
  if (o.box) flowerBox(f, x, y - h / 2 - 0.17, w + 0.12, o.box);
}

const PETALS = ['#ff7a9a', '#ffd23f', '#ffffff', '#b98cff', '#ff9a4d', '#7ec8ff'];
function flowerBox(f, x, y, w, seed = 0) {
  put(f, box(w, 0.16, 0.2), '#a8673f', x, y, 0.12);
  const n = Math.max(3, Math.round(w / 0.17));
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + (i + 0.5) * (w / n);
    put(f, ico(0.08, 0), '#4f9a45', px, y + 0.11, 0.12);
    put(f, ico(0.05, 0), PETALS[(i + seed) % PETALS.length], px, y + 0.18, 0.16);
  }
}

function door(f, x, w, h, col, o = {}) {
  put(f, box(w + 0.18, h + 0.09, 0.07), o.frame || '#ffffff', x, (h + 0.09) / 2, 0.02);
  put(f, rbox(w, h, 0.08, 0.04, 1), col, x, h / 2, 0.05);
  if (o.glass) put(f, box(w * 0.56, h * 0.42, 0.04), LIT(), x, h * 0.64, 0.09);
  else put(f, box(w * 0.32, w * 0.32, 0.03), '#ffffff', x, h * 0.7, 0.09);
  put(f, sph(0.045, 8, 6), '#f2c94c', x + w * 0.32, h * 0.48, 0.11);
}

function lantern(f, x, y) {
  put(f, box(0.05, 0.05, 0.16), '#3b4a47', x, y + 0.12, 0.08);
  put(f, cone(0.1, 0.09, 6), '#3b4a47', x, y + 0.15, 0.17);
  put(f, sph(0.075, 8, 6), mat('#fff1c4', { kind: 'env', e: '#ffc060', ei: 1.4 }), x, y, 0.17, 0, 0, 0).castShadow = false;
}

function stones(g, pts, gap = 0.48, r = 0.2, col = '#eadcc0') {
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / gap));
    for (let i = k ? 1 : 0; i <= n; i++) put(g, cyl(r, r * 1.05, 0.05, 7), col, ax + ((bx - ax) * i) / n, 0, az + ((bz - az) * i) / n, 0, i * 1.3, 0).castShadow = false;
  }
}

// materials shared by water & fire
let causticTex = null;
function caustics() {
  if (causticTex) return causticTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8fe0ff';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const x = (i * 53) % 128, y = (i * 37) % 128, r = 10 + (i % 4) * 5;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.7, i, 0, TAU * 0.7);
    g.stroke();
    g.beginPath();
    g.ellipse(x - 128, y, r, r * 0.7, i, 0, TAU * 0.7);
    g.stroke();
  }
  causticTex = new THREE.CanvasTexture(c);
  causticTex.colorSpace = THREE.SRGBColorSpace;
  causticTex.wrapS = causticTex.wrapT = THREE.RepeatWrapping;
  return causticTex;
}
let waterM = null;
function waterMat() {
  if (!waterM) {
    waterM = new THREE.MeshStandardMaterial({
      color: '#64d4f6', map: caustics(), roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.9, emissive: '#1d8fd6', emissiveIntensity: 0.32, depthWrite: false,
    });
  }
  return waterM;
}
let stillM = null;
function stillWater() {
  if (!stillM) stillM = new THREE.MeshStandardMaterial({ color: '#7fdcff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, emissive: '#2a9be0', emissiveIntensity: 0.35, depthWrite: false });
  return stillM;
}
const FLAME = () => mat('#ffcc4a', { e: '#ff7a10', ei: 1.6, r: 0.6 });

// pets
function petEyes(hd, h, o = {}) {
  const black = C('#1b1b22', 0.3), white = C('#ffffff', 0.3), blush = C('#ff9aa8', 0.85);
  const ex = o.x ?? 0.4, ey = o.y ?? 0.14, ez = o.ez ?? 0.84, k = o.k ?? 1;
  for (const s of [-1, 1]) {
    sc(put(hd, sph(h * 0.16 * k, 12, 10), black, s * h * ex, h * ey, h * ez), 1, 1.12, 0.62);
    put(hd, sph(h * 0.06 * k, 8, 6), white, s * h * ex + s * h * 0.03, h * (ey + 0.09), h * (ez + 0.08), 0, 0, 0).castShadow = false;
    if (o.blush !== false) sc(put(hd, sph(h * 0.13, 8, 6), blush, s * h * 0.6, -h * 0.16, h * 0.66), 1, 0.55, 0.45).castShadow = false;
  }
}
function dogSnout(hd, h, col, tongue = true) {
  sc(put(hd, sph(h * 0.5, 14, 10), C(col), 0, -h * 0.3, h * 0.7), 1, 0.75, 1);
  sc(put(hd, sph(h * 0.15, 10, 8), C('#2a2228', 0.35), 0, -h * 0.12, h * 1.18), 1.25, 0.9, 0.9);
  if (tongue) sc(put(hd, sph(h * 0.13, 10, 6), C('#ff7088', 0.5), 0, -h * 0.64, h * 1.0), 1, 0.45, 1.15);
}
function catMuzzle(hd, h, col, nose = '#ff8a9a') {
  for (const s of [-1, 1]) sc(put(hd, sph(h * 0.24, 10, 8), C(col), s * h * 0.17, -h * 0.3, h * 0.78), 1, 0.8, 0.8);
  sc(put(hd, sph(h * 0.1, 8, 6), C(nose, 0.4), 0, -h * 0.14, h * 0.98), 1.3, 0.8, 0.8);
}
function pointEars(hd, h, col, inner, k = 1, tip = null, spread = 0.38) {
  for (const s of [-1, 1]) {
    const e = grp(s * h * 0.5, h * 0.68, -h * 0.05);
    e.rotation.set(-0.08, 0, -s * spread);
    sc(put(e, cone(h * 0.3 * k, h * 0.72 * k, 12), C(col), 0, h * 0.3 * k, 0), 1, 1, 0.5);
    sc(put(e, cone(h * 0.17 * k, h * 0.42 * k, 10), C(inner), 0, h * 0.24 * k, h * 0.07), 1, 1, 0.3);
    if (tip) sc(put(e, cone(h * 0.13 * k, h * 0.3 * k, 10), C(tip), 0, h * 0.58 * k, 0), 1, 1, 0.55);
    hd.add(e);
  }
}
function floppyEars(hd, h, col, k = 1) {
  for (const s of [-1, 1]) sc(put(hd, sph(h * 0.36 * k, 12, 10), C(col), s * h * 0.84, -h * 0.1, -h * 0.02, 0, 0, s * 0.32), 0.42, 1.08, 0.74);
}
function stickTail(t, r, len, col, tilt = -0.7, tip = null) {
  const d = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt));
  put(t, capsule(r, len), C(col), d.x, d.y * len * 0.5, d.z * len * 0.5, tilt);
  if (tip) put(t, sph(r * 1.45, 10, 8), C(tip), 0, d.y * len * 1.05, d.z * len * 1.05);
}

// Generic chunky quadruped facing +z. Legs move in two diagonal pairs (a toy trot).
function quad(o) {
  const root = new THREE.Group();
  const r = o.r, L = o.len, leg = o.leg;
  const by = leg + r * 0.92;
  const body = dyn(grp(0, by, 0));
  root.add(body);
  const inner = dyn(new THREE.Group()); // the torso itself, so sitting/lying can tilt it
  inner.rotation.x = o.tilt ?? 0;
  body.add(inner);
  const fur = C(o.fur);
  sc(put(inner, capsule(r, L), fur, 0, 0, 0, PI / 2), 1, 1, o.squash ?? 0.95);
  if (o.belly) sc(put(inner, sph(r * 0.86, 14, 10), C(o.belly), 0, -r * 0.2, L * 0.36), 0.92, 0.86, 0.92);
  const head = dyn(grp(0, r * 0.72 + (o.neck ?? 0), L / 2 + r * 0.5 + (o.headZ ?? 0)));
  body.add(head);
  const h = o.head;
  sc(put(head, sph(h, 18, 14), fur, 0, 0, 0), 1, 0.94, 0.96);
  o.face?.(head, h);
  petEyes(head, h, o.eyes);
  const tail = dyn(grp(0, r * 0.4, -(L / 2 + r * 0.72)));
  inner.add(tail);
  o.tail?.(tail, r);
  const legs = [dyn(new THREE.Group()), dyn(new THREE.Group())];
  const lr = o.legR ?? r * 0.32;
  const legC = C(o.legC ?? o.fur), pawC = C(o.paw ?? o.legC ?? o.fur);
  const hipY = by - r * 0.25;
  for (const [i, sx, sz] of [[0, 1, 1], [0, -1, -1], [1, -1, 1], [1, 1, -1]]) {
    const x = sx * r * 0.56, z = sz * L * 0.5 * (o.legZ ?? 1);
    put(legs[i], cyl(lr, lr * 0.92, hipY, 10), legC, x, hipY / 2, z);
    sc(put(legs[i], sph(lr * 1.22, 10, 8), pawC, x, lr * 0.72, z + lr * 0.3), 1, 0.68, 1.25);
  }
  root.add(...legs);
  o.extra?.({ root, body, inner, head, tail, r, L, h, by });
  return { root, body, inner, head, tail, legs, by, size: L + r * 2, hop: o.hop };
}

const PET_MODELS = {
  corgi: () => quad({
    fur: '#f0a04a', belly: '#fff4e2', r: 0.19, len: 0.36, leg: 0.1, head: 0.18, legC: '#fff4e2',
    face: (hd, h) => {
      dogSnout(hd, h, '#fff4e2');
      sc(put(hd, sph(h * 0.4, 10, 8), C('#fff4e2'), 0, h * 0.25, h * 0.68), 0.45, 1, 0.5);
      pointEars(hd, h, '#f0a04a', '#ffc6bb', 1.3);
    },
    tail: (t, r) => put(t, sph(r * 0.5, 12, 10), C('#fff4e2'), 0, 0, 0.02),
  }),
  dalmatian: () => quad({
    fur: '#fbfbf6', r: 0.19, len: 0.42, leg: 0.24, head: 0.18, legR: 0.055,
    face: (hd, h) => {
      dogSnout(hd, h, '#fbfbf6');
      floppyEars(hd, h, '#26262c');
      sc(put(hd, sph(h * 0.22, 8, 6), C('#26262c'), h * 0.35, h * 0.5, h * 0.55), 1, 0.5, 1);
    },
    tail: (t, r) => stickTail(t, r * 0.16, 0.24, '#fbfbf6', -0.75),
    extra: ({ inner, r, L }) => {
      const spot = C('#26262c');
      for (const [a, z, k] of [[0.3, 0.12, 1], [-0.9, -0.1, 0.8], [1.5, 0.2, 0.9], [-1.6, -0.18, 1], [0.6, -0.22, 0.75], [-0.3, 0.3, 0.7], [2.4, -0.05, 0.8], [-2.3, 0.12, 0.85]]) {
        put(inner, sph(0.055 * k, 8, 6), spot, Math.sin(a) * (r - 0.03), Math.cos(a) * (r - 0.03), z * L * 1.4);
      }
    },
  }),
  retriever: () => quad({
    fur: '#e9b25a', belly: '#f9dfa6', r: 0.22, len: 0.42, leg: 0.2, head: 0.2, legR: 0.07,
    face: (hd, h) => { dogSnout(hd, h, '#f3cc85'); floppyEars(hd, h, '#d39440', 1.05); },
    tail: (t, r) => {
      stickTail(t, r * 0.24, 0.26, '#e9b25a', -0.95);
      sc(put(t, sph(0.08, 10, 8), C('#f5d58f'), 0, 0.12, -0.2), 0.7, 0.8, 1.5);
    },
  }),
  cat: () => quad({
    fur: '#f39a3c', belly: '#fff3e3', r: 0.16, len: 0.3, leg: 0.15, head: 0.17, legR: 0.045, legC: '#f39a3c', paw: '#fff3e3',
    face: (hd, h) => {
      catMuzzle(hd, h, '#fff3e3');
      pointEars(hd, h, '#f39a3c', '#ffc2c8', 0.95, null, 0.3);
      for (const s of [-1, 0, 1]) sc(put(hd, sph(h * 0.12, 8, 6), C('#d06f1f'), s * h * 0.3, h * 0.82, h * 0.25), 0.6, 0.35, 1.6);
    },
    tail: (t) => {
      put(t, capsule(0.035, 0.3), C('#f39a3c'), 0, 0.17, -0.06, -0.35);
      put(t, sph(0.05, 10, 8), C('#d06f1f'), 0, 0.36, -0.12);
    },
    extra: ({ inner, r, L }) => {
      for (let i = 0; i < 4; i++) sc(put(inner, sph(0.06, 10, 6), C('#d06f1f'), 0, r * 0.86, -L * 0.45 + i * L * 0.28), 2.6, 0.5, 0.55);
    },
  }),
  fox: () => quad({
    fur: '#f47a2c', belly: '#fff6ec', r: 0.17, len: 0.38, leg: 0.18, head: 0.17, legR: 0.045, legC: '#3a2a2c',
    face: (hd, h) => {
      put(hd, cone(h * 0.42, h * 0.95, 12), C('#fff6ec'), 0, -h * 0.25, h * 0.9, PI / 2);
      sc(put(hd, sph(h * 0.13, 10, 8), C('#26222a', 0.35), 0, -h * 0.25, h * 1.38), 1.2, 0.9, 0.9);
      for (const s of [-1, 1]) sc(put(hd, sph(h * 0.42, 10, 8), C('#fff6ec'), s * h * 0.4, -h * 0.22, h * 0.45), 0.7, 0.6, 0.8);
      pointEars(hd, h, '#f47a2c', '#fff0e6', 1.35, '#2c2228', 0.3);
    },
    eyes: { y: 0.2, ez: 0.82 },
    tail: (t) => {
      sc(put(t, sph(0.14, 14, 10), C('#f47a2c'), 0, 0.1, -0.2, -0.75), 0.85, 1.9, 0.85);
      sc(put(t, sph(0.08, 12, 8), C('#fff6ec'), 0, 0.24, -0.37), 1, 1, 1);
    },
  }),
  pig: () => quad({
    fur: '#ffafc0', r: 0.22, len: 0.2, leg: 0.09, head: 0.19, legR: 0.06, paw: '#c8607c', squash: 1,
    face: (hd, h) => {
      put(hd, cyl(h * 0.36, h * 0.4, h * 0.3, 16), C('#ff93ac'), 0, -h * 0.18, h * 0.92, PI / 2);
      for (const s of [-1, 1]) {
        put(hd, sph(h * 0.07, 8, 6), C('#b84a6a', 0.4), s * h * 0.13, -h * 0.18, h * 1.07).castShadow = false;
        const e = put(hd, cone(h * 0.2, h * 0.36, 8), C('#ff93ac'), s * h * 0.55, h * 0.72, 0.0, 0.7, 0, -s * 0.5);
        sc(e, 1, 1, 0.5);
      }
    },
    eyes: { y: 0.24, ez: 0.84 },
    tail: (t) => put(t, torus(0.06, 0.018, 6, 14, PI * 1.6), C('#ffafc0'), 0, 0.02, -0.02, 0, PI / 2, 0),
  }),
  bunny: () => quad({
    fur: '#f6f1ea', r: 0.17, len: 0.12, leg: 0.05, head: 0.16, legR: 0.05, tilt: -0.35, hop: true, legZ: 1.6,
    face: (hd, h) => {
      catMuzzle(hd, h, '#ffffff', '#ff8aa6');
      for (const s of [-1, 1]) {
        const e = grp(s * h * 0.34, h * 0.72, -h * 0.1);
        e.rotation.set(-0.18, 0, -s * 0.16);
        sc(put(e, capsule(h * 0.2, h * 1.0), C('#f6f1ea'), 0, h * 0.62, 0), 1, 1, 0.5);
        sc(put(e, capsule(h * 0.11, h * 0.75), C('#ffc3d0'), 0, h * 0.62, h * 0.06), 1, 1, 0.3);
        hd.add(e);
      }
    },
    eyes: { k: 1.1 },
    tail: (t, r) => put(t, sph(r * 0.55, 12, 10), C('#ffffff'), 0, -r * 0.1, 0),
  }),
  unicorn: () => quad({
    fur: '#fffaf6', r: 0.22, len: 0.52, leg: 0.42, head: 0.17, legR: 0.06, paw: '#ffb3d6', neck: 0.36, headZ: 0.12,
    face: (hd, h) => {
      sc(put(hd, sph(h * 0.62, 14, 10), C('#fff0f4'), 0, -h * 0.32, h * 0.62), 0.82, 0.7, 1.15);
      for (const s of [-1, 1]) put(hd, sph(h * 0.06, 6, 5), C('#d76a9a', 0.4), s * h * 0.18, -h * 0.28, h * 1.28).castShadow = false;
      pointEars(hd, h, '#fffaf6', '#ffc6dc', 0.85, null, 0.25);
      const horn = grp(0, h * 0.95, h * 0.2);
      horn.rotation.x = 0.35;
      put(horn, cone(h * 0.16, h * 0.9, 12), P('#ffd24a', 0.25, 0.85), 0, h * 0.4, 0);
      for (let i = 0; i < 3; i++) put(horn, torus(h * (0.12 - i * 0.03), h * 0.025, 6, 12), P('#ffe9a0', 0.3, 0.8), 0, h * (0.12 + i * 0.22), 0, PI / 2);
      hd.add(horn);
    },
    eyes: { y: 0.1, ez: 0.82 },
    tail: (t) => {
      const cols = ['#ff6b8b', '#ffb84a', '#ffe14a', '#7fd86a', '#5cc6ff', '#b07cff'];
      cols.forEach((c, i) => sc(put(t, sph(0.07, 10, 8), C(c), (i % 2 ? 1 : -1) * 0.03, 0.02 - i * 0.07, -0.08 - i * 0.025), 1, 1.3, 1));
    },
    extra: ({ inner, head, r, L }) => {
      put(inner, capsule(r * 0.62, 0.3), C('#fffaf6'), 0, r * 0.45 + 0.12, L / 2 + 0.04, 0.45);
      const cols = ['#ff6b8b', '#ffb84a', '#ffe14a', '#7fd86a', '#5cc6ff', '#b07cff'];
      cols.forEach((c, i) => {
        const t = 0.25 - i * 0.08;
        put(inner, sph(0.08, 10, 8), C(c), 0, 0.27 + 0.9 * t + 0.02, 0.19 + 0.43 * t - 0.02);
      });
      for (let i = 0; i < 3; i++) put(head, sph(0.065, 10, 8), C(cols[i * 2]), 0, 0.15 - i * 0.02, -0.06 - i * 0.05);
    },
  }),
  turtle: () => {
    const root = new THREE.Group();
    const body = dyn(grp(0, 0.1, 0));
    root.add(body);
    const inner = dyn(new THREE.Group());
    body.add(inner);
    sc(put(inner, sph(0.27, 20, 10, 0, TAU, 0, PI / 2), C('#4e9a4a'), 0, 0, 0), 1, 0.78, 1.18);
    sc(put(inner, cyl(0.29, 0.27, 0.06, 20), C('#e8d48a'), 0, 0, 0), 1, 1, 1.18);
    for (const [a, d] of [[0, 0], [0.5, 0.15], [1.55, 0.16], [2.6, 0.15], [3.65, 0.16], [4.7, 0.15], [5.75, 0.16]]) {
      const y = Math.sqrt(Math.max(0, 0.27 * 0.27 - d * d)) * 0.78;
      sc(put(inner, sph(0.075, 8, 6), C('#7cc66a'), Math.sin(a) * d, y - 0.02, Math.cos(a) * d * 1.18), 1, 0.4, 1);
    }
    const head = dyn(grp(0, 0.04, 0.33));
    body.add(head);
    put(head, capsule(0.06, 0.08), C('#a6d46a'), 0, 0, -0.05, PI / 2);
    put(head, sph(0.1, 14, 10), C('#a6d46a'), 0, 0.02, 0.05);
    petEyes(head, 0.1, { y: 0.25, ez: 0.62, k: 1.15, blush: true });
    const tail = dyn(grp(0, 0, -0.32));
    inner.add(tail);
    put(tail, cone(0.04, 0.1, 8), C('#a6d46a'), 0, 0, -0.03, -PI / 2);
    const legs = [dyn(new THREE.Group()), dyn(new THREE.Group())];
    for (const [i, x, z] of [[0, 0.2, 0.2], [0, -0.2, -0.2], [1, -0.2, 0.2], [1, 0.2, -0.2]]) sc(put(legs[i], sph(0.075, 10, 8), C('#a6d46a'), x, 0.05, z), 1, 0.75, 1.2);
    root.add(...legs);
    return { root, body, inner, head, tail, legs, by: 0.1, size: 0.7 };
  },
  parrot: () => {
    const root = new THREE.Group();
    const body = dyn(grp(0, 0.18, 0));
    root.add(body);
    const inner = dyn(new THREE.Group());
    inner.rotation.x = -0.3;
    body.add(inner);
    const red = C('#e8302a', 0.5);
    put(inner, capsule(0.11, 0.16), red, 0, 0.12, 0);
    sc(put(inner, sph(0.09, 10, 8), C('#ffd23f'), 0, 0.06, 0.06), 1, 1.2, 0.7);
    const wings = dyn(new THREE.Group());
    wings.position.set(0, 0.17, -0.02);
    for (const s of [-1, 1]) {
      const w = dyn(grp(s * 0.1, 0, 0));
      w.rotation.set(-0.2, 0, s * 0.1);
      put(w, rbox(0.04, 0.2, 0.17, 0.02), C('#2f8cf0'), s * 0.01, -0.03, -0.01);
      put(w, rbox(0.045, 0.1, 0.15, 0.02), C('#ffd23f'), s * 0.015, 0.06, 0.0);
      wings.add(w);
    }
    inner.add(wings);
    const tail = dyn(grp(0, 0.0, -0.08));
    tail.rotation.x = 0.6;
    put(tail, box(0.06, 0.3, 0.02), C('#2f8cf0'), -0.025, -0.14, 0);
    put(tail, box(0.06, 0.34, 0.02), red, 0.03, -0.16, 0);
    inner.add(tail);
    const head = dyn(grp(0, 0.34, 0.02));
    body.add(head);
    put(head, sph(0.1, 16, 12), red, 0, 0, 0);
    for (const s of [-1, 1]) sc(put(head, sph(0.045, 10, 8), C('#fff6ea'), s * 0.065, 0.0, 0.04), 0.5, 1, 1);
    petEyes(head, 0.1, { x: 0.68, y: 0.12, ez: 0.45, blush: false });
    put(head, cone(0.045, 0.11, 10), C('#f3e3c3', 0.4), 0, -0.02, 0.12, PI / 2 + 0.7);
    put(head, cone(0.03, 0.05, 8), C('#2b2b2b'), 0, -0.06, 0.09, PI / 2 + 1.2);
    const legs = [dyn(new THREE.Group()), dyn(new THREE.Group())];
    for (const [i, x] of [[0, 0.05], [1, -0.05]]) {
      put(legs[i], cyl(0.014, 0.014, 0.14, 6), C('#8a8a8a'), x, 0.07, 0);
      sc(put(legs[i], sph(0.03, 8, 6), C('#8a8a8a'), x, 0.015, 0.03), 1, 0.4, 1.6);
    }
    root.add(...legs);
    return { root, body, inner, head, tail, legs, wings, by: 0.18, size: 0.5 };
  },
};

function buildPet(id) {
  const p = PET_MODELS[id]();
  for (const g of [p.head, p.tail, ...p.legs, ...(p.wings ? p.wings.children : [])]) mergeStatic(g, 'char');
  mergeStatic(p.inner, 'char');
  const blob = makeBlobShadow(1);
  blob.scale.set(p.size * 0.75, 1, p.size * 1.05);
  p.root.add(blob);
  p.root.scale.setScalar(PET_SCALE);
  return p;
}

// cars (all face +z, sit on y = 0)
const TYRE = () => P('#1d1d22', 0.85);
const CHROME = () => P('#dfe4ea', 0.25, 0.85);
const GLASS = () => P('#24324a', 0.12, 0.5);
const TAIL = () => mat('#ff3b3b', { e: '#ff1010', ei: 0.7 });
let CAR_PAINT = null; // body colour override while a repainted car is being built
const body = (c, r = 0.28, m = 0.4) => P(CAR_PAINT ?? c, r, m);

function wheels(g, o) {
  const R = o.R, tw = o.tw ?? 0.18;
  const zf = o.wz ?? o.len / 2 - R - 0.12, zb = o.wzb ?? zf;
  const hub = o.hub ? P(o.hub, 0.3, 0.8) : CHROME();
  for (const x of [-1, 1]) {
    for (const z of [-zb, zf]) {
      const px = x * (o.w / 2 - tw * 0.32);
      put(g, cyl(R, R, tw, 18), TYRE(), px, R, z, 0, 0, PI / 2);
      if (o.whitewall) put(g, cyl(R * 0.78, R * 0.78, tw + 0.01, 18), P('#fbf8f0', 0.5), px, R, z, 0, 0, PI / 2);
      put(g, cyl(R * 0.55, R * 0.55, tw + 0.02, 14), hub, px, R, z, 0, 0, PI / 2);
    }
  }
}

// A toy car body: rounded lower body, a cabin with a glass band, bumpers, lamps and plates
function carKit(o) {
  const g = new THREE.Group();
  const paint = o.paint ?? body(o.col);
  const top = o.ride + o.h;
  put(g, rbox(o.w, o.h, o.len, Math.min(0.15, o.h * 0.42), 2), paint, 0, o.ride + o.h / 2, 0);
  if (o.cab) {
    const c = o.cab, cw = c.w ?? o.w * 0.84;
    put(g, rbox(cw, c.h, c.len, Math.min(0.13, c.h * 0.4), 2), c.paint ?? paint, 0, top + c.h / 2 - 0.03, c.z);
    put(g, box(cw + 0.014, c.h * 0.56, c.len * 0.74), GLASS(), 0, top + c.h * 0.46, c.z);
    put(g, box(cw * 0.8, c.h * 0.56, c.len + 0.014), GLASS(), 0, top + c.h * 0.46, c.z);
  }
  wheels(g, o);
  const bump = o.bumper ?? CHROME();
  for (const s of [-1, 1]) put(g, rbox(o.w * 0.98, 0.1, 0.1, 0.04, 1), bump, 0, o.ride + 0.07, s * (o.len / 2 + 0.01));
  const ly = o.ride + o.h * (o.lampY ?? 0.62);
  for (const s of [-1, 1]) {
    sc(put(g, sph(0.075, 12, 8), envMats.headlight, s * o.w * 0.32, ly, o.len / 2 - 0.02), 1, 0.75, 0.5).castShadow = false;
    put(g, box(0.17, 0.07, 0.03), TAIL(), s * o.w * 0.32, ly, -o.len / 2 + 0.005).castShadow = false;
  }
  if (!o.noGrille) put(g, box(o.w * 0.36, o.h * 0.26, 0.02), P('#2a2c33', 0.5), 0, o.ride + o.h * 0.4, o.len / 2 + 0.005);
  for (const s of [-1, 1]) put(g, box(0.24, 0.08, 0.015), P('#fff8dc', 0.5), 0, o.ride + 0.17, s * (o.len / 2 + 0.06));
  return { g, paint, top };
}

const CAR_MODELS = {
  scooter: () => {
    const g = new THREE.Group();
    const shell = body('#ff7a8a', 0.3, 0.35), cream = P('#fff4e0', 0.5);
    for (const z of [-0.42, 0.44]) {
      put(g, cyl(0.17, 0.17, 0.1, 16), TYRE(), 0, 0.17, z, 0, 0, PI / 2);
      put(g, cyl(0.09, 0.09, 0.12, 12), CHROME(), 0, 0.17, z, 0, 0, PI / 2);
    }
    sc(put(g, sph(0.27, 16, 12), shell, 0, 0.38, -0.3), 0.85, 0.7, 1.15);
    put(g, rbox(0.3, 0.06, 0.5, 0.02), P('#3a3a42', 0.7), 0, 0.22, 0.12);
    put(g, rbox(0.34, 0.6, 0.12, 0.05), shell, 0, 0.5, 0.42, -0.25);
    sc(put(g, sph(0.2, 12, 8), shell, 0, 0.36, 0.45), 0.7, 0.55, 1);
    put(g, cyl(0.03, 0.03, 0.4, 8), CHROME(), 0, 0.78, 0.5, 0, 0, PI / 2);
    put(g, cyl(0.025, 0.025, 0.3, 8), CHROME(), 0, 0.68, 0.48, -0.3);
    for (const s of [-1, 1]) put(g, sph(0.04, 8, 6), P('#2a2c33'), s * 0.2, 0.78, 0.5);
    sc(put(g, sph(0.07, 12, 8), envMats.headlight, 0, 0.8, 0.6), 1, 1, 0.6).castShadow = false;
    sc(put(g, capsule(0.12, 0.3), P('#7a4a32', 0.6), 0, 0.6, -0.25, PI / 2), 1.1, 1, 0.5);
    put(g, box(0.36, 0.04, 0.28), CHROME(), 0, 0.66, -0.62);
    put(g, rbox(0.3, 0.2, 0.26, 0.05), cream, 0, 0.78, -0.62);
    put(g, box(0.12, 0.05, 0.03), TAIL(), 0, 0.45, -0.66).castShadow = false;
    g.rotation.z = 0.06;
    const w = new THREE.Group();
    w.add(g);
    return w;
  },
  hatch: () => {
    const { g } = carKit({ len: 1.72, w: 0.98, h: 0.44, ride: 0.13, col: '#4fd1b0', R: 0.19, cab: { len: 1.12, h: 0.44, z: -0.12 } });
    put(g, rbox(0.6, 0.06, 0.7, 0.03, 1), P('#2a2c33', 0.6), 0, 1.02, -0.12);
    return g;
  },
  pickup: () => {
    const { g, paint, top } = carKit({ len: 2.1, w: 1.04, h: 0.5, ride: 0.2, col: '#e8483b', R: 0.25, tw: 0.22, cab: { len: 0.78, h: 0.48, z: 0.35 }, bumper: P('#3a3c44', 0.6) });
    const bed = P('#3a3c44', 0.6);
    put(g, box(0.92, 0.04, 0.95), bed, 0, top + 0.01, -0.5);
    for (const s of [-1, 1]) put(g, rbox(0.08, 0.26, 1.0, 0.03, 1), paint, s * 0.48, top + 0.12, -0.5);
    put(g, rbox(1.0, 0.26, 0.08, 0.03, 1), paint, 0, top + 0.12, -1.0);
    for (const [x, z, c] of [[-0.2, -0.35, '#ff6a4a'], [0.22, -0.6, '#7cc85a']]) {
      put(g, box(0.36, 0.2, 0.3), E('#c98a4e'), x, top + 0.12, z);
      for (let i = 0; i < 4; i++) put(g, ico(0.07, 0), P(c, 0.6), x - 0.09 + (i % 2) * 0.18, top + 0.25, z - 0.06 + Math.floor(i / 2) * 0.12);
    }
    put(g, rbox(0.7, 0.06, 0.12, 0.02), P('#ffcf3a', 0.4), 0, top + 0.5, 0.35);
    put(g, box(1.06, 0.06, 1.6), P('#ffffff', 0.4), 0, 0.2 + 0.5 * 0.55, 0.05);
    return g;
  },
  classic: () => {
    const { g, paint, top } = carKit({ len: 2.12, w: 1.0, h: 0.4, ride: 0.12, col: '#6fd6d2', R: 0.18, whitewall: true, lampY: 0.55 });
    put(g, box(1.012, 0.06, 2.0), CHROME(), 0, 0.12 + 0.4 * 0.42, 0);
    put(g, rbox(0.86, 0.05, 1.0, 0.02, 1), P('#c23a3a', 0.7), 0, top + 0.005, -0.15);
    for (const z of [0.15, -0.42]) {
      put(g, rbox(0.8, 0.12, 0.3, 0.05, 1), P('#fff2dc', 0.6), 0, top + 0.08, z);
      put(g, rbox(0.8, 0.28, 0.1, 0.05, 1), P('#fff2dc', 0.6), 0, top + 0.18, z - 0.14);
    }
    put(g, torus(0.1, 0.02, 6, 16), P('#fff2dc', 0.5), -0.2, top + 0.22, 0.32, -1.1);
    put(g, box(0.82, 0.24, 0.02), P('#bfe8ff', 0.1, 0.2), 0, top + 0.13, 0.45, -0.3);
    for (const s of [-1, 1]) {
      const fin = put(g, box(0.06, 0.22, 0.5), paint, s * 0.44, top + 0.04, -0.82, 0.35);
      fin.scale.set(1, 1, 1);
    }
    return g;
  },
  sports: () => {
    const { g, top } = carKit({ len: 2.0, w: 1.02, h: 0.32, ride: 0.11, col: '#ffc21a', R: 0.2, hub: '#2a2c33', cab: { len: 0.95, h: 0.32, z: -0.15, w: 0.82 }, bumper: P('#2a2c33', 0.5), noGrille: true });
    const black = P('#2a2c33', 0.4);
    for (const s of [-1, 1]) {
      put(g, box(0.1, 0.012, 2.0), black, s * 0.12, top + 0.004, 0);
      put(g, box(0.1, 0.012, 0.98), black, s * 0.12, top + 0.29, -0.15);
      put(g, box(0.05, 0.16, 0.05), black, s * 0.36, top + 0.08, -0.9);
    }
    put(g, rbox(1.0, 0.04, 0.22, 0.02, 1), black, 0, top + 0.17, -0.9);
    put(g, box(0.5, 0.05, 0.02), black, 0, 0.11 + 0.32 * 0.35, 1.006);
    return g;
  },
  limo: () => {
    const { g, top, paint } = carKit({ len: 2.9, w: 1.0, h: 0.42, ride: 0.14, col: '#22232c', paint: body('#22232c', 0.18, 0.5), R: 0.19, cab: { len: 1.95, h: 0.4, z: -0.12 }, whitewall: true });
    put(g, box(1.012, 0.04, 2.8), CHROME(), 0, 0.14 + 0.42 * 0.55, 0);
    for (let i = 0; i < 3; i++) put(g, box(0.86, 0.36 * 0.6, 0.04), paint, 0, top + 0.17, -0.7 + i * 0.5);
    put(g, sph(0.06, 10, 8), CHROME(), 0, 0.14 + 0.42 + 0.02, 1.38);
    for (const s of [-1, 1]) {
      put(g, cyl(0.008, 0.008, 0.24, 6), CHROME(), s * 0.42, top + 0.12, 1.25);
      put(g, box(0.003, 0.08, 0.12), P(s < 0 ? '#ff5d73' : '#ffd23f', 0.6), s * 0.42, top + 0.2, 1.19);
    }
    return g;
  },
  supercar: () => {
    const shell = body('#8f4dff', 0.24, 0.45);
    const { g, top } = carKit({ len: 2.05, w: 1.08, h: 0.28, ride: 0.08, col: '#8f4dff', paint: shell, R: 0.21, tw: 0.22, hub: '#ffcc33', cab: { len: 0.9, h: 0.27, z: -0.05, w: 0.8 }, bumper: P('#2a2c33', 0.5), noGrille: true, lampY: 0.7 });
    const black = P('#22232a', 0.4);
    put(g, rbox(1.0, 0.12, 0.7, 0.05, 1), shell, 0, top + 0.02, 0.62, 0.18);
    for (const s of [-1, 1]) {
      put(g, box(0.02, 0.12, 0.42), black, s * 0.545, 0.08 + 0.14, -0.35);
      put(g, box(0.06, 0.2, 0.06), black, s * 0.38, top + 0.1, -0.88);
    }
    put(g, rbox(1.12, 0.05, 0.28, 0.02, 1), black, 0, top + 0.22, -0.9);
    put(g, box(0.7, 0.06, 0.03), P('#ff4a6a', 0.4, 0.2), 0, 0.08 + 0.28 * 0.6, -1.03);
    return g;
  },
  hypercar: () => {
    const gold = body('#f4c13a', 0.2, 0.92);
    const black = P('#1f2026', 0.35, 0.3);
    const { g, top } = carKit({ len: 2.12, w: 1.1, h: 0.3, ride: 0.08, col: '#f4c13a', paint: gold, R: 0.21, tw: 0.22, hub: '#1f2026', cab: { len: 0.95, h: 0.28, z: -0.08, w: 0.8, paint: black }, bumper: black, noGrille: true, lampY: 0.68 });
    put(g, rbox(1.02, 0.12, 0.72, 0.05, 1), gold, 0, top + 0.02, 0.64, 0.16);
    for (const s of [-1, 1]) {
      put(g, box(0.02, 0.1, 1.5), black, s * 0.555, 0.08 + 0.1, 0);
      put(g, box(0.05, 0.22, 0.05), black, s * 0.36, top + 0.1, -0.92);
      put(g, box(0.3, 0.025, 0.03), mat('#cfefff', { e: '#9fdcff', ei: 1.6 }), s * 0.3, 0.08 + 0.3 * 0.72, 1.062).castShadow = false;
    }
    put(g, rbox(1.16, 0.05, 0.3, 0.02, 1), black, 0, top + 0.24, -0.92);
    put(g, rbox(0.06, 0.14, 0.7, 0.02, 1), gold, 0, top + 0.3, -0.35);
    return g;
  },
};
const CAR_SIZE = { scooter: [0.5, 1.4], limo: [1.05, 2.95] };

// A car model by catalog id: faces +z, sits on y = 0 and is about 2 units long (the limo is longer).
// Static parts are merged; free it with models.disposeObject when done.
export function buildLuxuryCar(id, paint = null) {
  CAR_PAINT = isHex(paint) ? paint : null;
  try {
    const g = (CAR_MODELS[id] || CAR_MODELS.hatch)();
    mergeStatic(g, 'prop');
    return g;
  } finally {
    CAR_PAINT = null;
  }
}

// houses (front faces +z)
function tent(c) {
  const g = new THREE.Group();
  const pt = c.paint || {};
  put(g, box(2.9, 0.03, 3.0), '#5d8fd6', 0, 0.015, 0.15).castShadow = false;
  put(g, prism(2.5, 1.7, 2.6), pt.wall ?? '#ff8a3d', 0, 0, 0);
  put(g, prism(2.56, 1.74, 0.06), pt.roof ?? '#ffd23f', 0, 0, -1.3);
  put(g, prism(1.0, 1.05, 0.04), '#5a3524', 0, 0, 1.31);
  for (const s of [-1, 1]) put(g, box(0.6, 0.9, 0.03), pt.wall ? shade(pt.wall, 1.25) : '#ffb36b', s * 0.46, 0.5, 1.42, 0, s * 0.5, s * 0.55);
  put(g, cyl(0.035, 0.035, 2.9, 6), '#8a5a33', 0, 1.72, 0, PI / 2);
  for (const z of [-1.35, 1.35]) put(g, cyl(0.035, 0.035, 1.75, 6), '#8a5a33', 0, 0.87, z);
  for (const [x, z] of [[-1.5, -1.45], [1.5, -1.45], [-1.5, 1.45], [1.5, 1.45]]) {
    put(g, cyl(0.03, 0.02, 0.2, 5), '#c9a070', x, 0.1, z);
    const len = Math.hypot(1.5 - 1.25, 1.7);
    put(g, box(0.015, len, 0.015), '#fff4e0', x * 0.92, 0.85, z, 0, 0, -Math.sign(x) * 0.15).castShadow = false;
  }
  sc(put(g, capsule(0.28, 0.7), '#3cb4a4', 0.55, 0.16, 1.55, PI / 2, 0.4), 1, 1, 0.45);
  // Campfire with log seats, a cooler and a camping chair
  const fx = 2.0, fz = 2.1;
  for (let i = 0; i < 9; i++) put(g, ico(0.12, 0), '#9a9590', fx + Math.sin((i / 9) * TAU) * 0.42, 0.06, fz + Math.cos((i / 9) * TAU) * 0.42);
  for (let i = 0; i < 3; i++) put(g, cyl(0.055, 0.055, 0.6, 6), '#7a4a2e', fx, 0.08, fz, PI / 2, (i / 3) * PI, 0);
  const flames = dyn(grp(fx, 0.1, fz));
  for (const [x, z, s] of [[0, 0, 1], [0.1, 0.06, 0.7], [-0.09, -0.05, 0.75]]) put(flames, cone(0.13 * s, 0.42 * s, 8), FLAME(), x, 0.2 * s, z).castShadow = false;
  g.add(flames);
  put(g, cyl(0.3, 0.32, 0.36, 10), '#a0683e', fx + 1.0, 0.18, fz - 0.4);
  put(g, cyl(0.12, 0.12, 1.3, 8), '#8a5a33', fx - 0.3, 0.13, fz + 0.95, 0, 0.3, PI / 2);
  put(g, rbox(0.55, 0.36, 0.38, 0.05, 1), '#4fb3e8', fx - 1.3, 0.18, fz + 0.2);
  put(g, rbox(0.57, 0.08, 0.4, 0.03, 1), '#ffffff', fx - 1.3, 0.38, fz + 0.2);
  const chair = grp(fx + 0.55, 0, fz + 0.85, -2.4);
  put(chair, box(0.5, 0.04, 0.42), '#3cb46e', 0, 0.32, 0);
  put(chair, box(0.5, 0.42, 0.04), '#3cb46e', 0, 0.52, -0.2, -0.25);
  for (const s of [-1, 1]) put(chair, box(0.03, 0.4, 0.5), '#555b66', s * 0.25, 0.2, 0, 0.6);
  g.add(chair);
  // Picnic blanket with a basket, and a washing line between two poles
  const pb = grp(-1.9, 0, 2.0, 0.3);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) put(pb, box(0.36, 0.02, 0.36), (i + k) % 2 ? '#ff6b6b' : '#fff4e8', -0.54 + i * 0.36, 0.012, -0.54 + k * 0.36).castShadow = false;
  put(pb, rbox(0.42, 0.26, 0.3, 0.05, 1), '#c98a4e', 0.3, 0.14, -0.2);
  put(pb, torus(0.16, 0.025, 6, 12, PI), '#9a6a3e', 0.3, 0.27, -0.2);
  put(pb, ico(0.08, 0), '#e8302a', -0.25, 0.08, 0.25);
  g.add(pb);
  for (const x of [-2.2, -0.4]) put(g, cyl(0.035, 0.04, 1.4, 6), '#8a5a33', x, 0.7, -1.95);
  put(g, box(1.8, 0.015, 0.015), '#fff4e0', -1.3, 1.32, -1.95).castShadow = false;
  [['#5cc6ff', -1.85], ['#ffd23f', -1.35], ['#ff8ab0', -0.85]].forEach(([col, x]) => put(g, box(0.34, 0.4, 0.03), col, x, 1.1, -1.95, 0, 0, (x + 1.3) * 0.08));
  c.anim.push((t) => {
    flames.children.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 13 + i) * 0.12, 1 + Math.sin(t * 9 + i * 2) * 0.22, 1 + Math.cos(t * 11 + i) * 0.12); });
  });
  c.fire = { x: SITE.x + fx, z: SITE.z + fz };
  c.obstacles.push({ x: c.fire.x, z: c.fire.z, r: 1.25 });
  c.front = 1.5;
  return g;
}

function cabin(c) {
  const g = new THREE.Group();
  const pt = c.paint || {};
  const w = 4.2, d = 3.0, wh = 2.0, log = pt.wall ?? '#b5773f', log2 = pt.wall ? shade(pt.wall, 0.86) : '#a5672f', roofC = pt.roof ?? '#4f8a4a';
  put(g, rbox(w + 0.2, 0.22, d + 0.2, 0.04, 1), '#9a8f86', 0, 0.11, 0);
  put(g, box(w, wh, d), log, 0, wh / 2 + 0.2, 0);
  for (let i = 0; i < 8; i++) {
    const y = 0.32 + i * 0.25;
    put(g, cyl(0.13, 0.13, w + 0.3, 8), i % 2 ? log : log2, 0, y, d / 2 + 0.02, 0, 0, PI / 2);
    put(g, cyl(0.13, 0.13, d + 0.3, 8), i % 2 ? log2 : log, w / 2 + 0.02, y, 0, PI / 2);
  }
  roof(g, 0, 0, w, d, wh + 0.2, 1.3, log, roofC, 0.32);
  put(g, box(0.55, 1.7, 0.55), '#9a8f86', -1.2, wh + 1.2, -0.55);
  put(g, box(0.65, 0.12, 0.65), '#7b716a', -1.2, wh + 2.08, -0.55);
  // Porch: deck, posts, a sloping roof, steps, a rocking chair
  const pd = 1.3, pz = d / 2 + pd / 2;
  put(g, box(w + 0.3, 0.2, pd), '#c9925a', 0, 0.2, pz);
  for (let i = 0; i < 9; i++) put(g, box(0.02, 0.21, pd), '#a8743e', -w / 2 + i * (w / 8), 0.2, pz).castShadow = false;
  for (const x of [-w / 2, w / 2]) put(g, cyl(0.08, 0.08, 1.9, 8), log2, x, 1.25, d / 2 + pd - 0.12);
  put(g, rbox(w + 0.6, 0.1, pd + 0.4, 0.03, 1), roofC, 0, 2.25, d / 2 + pd / 2 + 0.05, 0.18);
  put(g, box(1.0, 0.1, 0.35), '#c9925a', -0.6, 0.05, d / 2 + pd + 0.15);
  const f = face(g, 0, 0, d / 2 + 0.16);
  door(f, -0.6, 0.66, 1.35, '#8a3a2a', { frame: '#6e4228' });
  f.children.forEach((m) => { m.position.y += 0.2; });
  win(f, 1.1, 1.35, 0.8, 0.7, { frame: '#c8443a', box: 1 });
  const s = face(g, PI / 2, w / 2 + 0.16, 0);
  win(s, 0, 1.35, 0.7, 0.66, { frame: '#c8443a', box: 3 });
  lantern(f, 0.1, 1.55);
  const rc = grp(1.2, 0.3, d / 2 + 0.75, -0.4);
  put(rc, box(0.5, 0.05, 0.45), '#8a5a33', 0, 0.38, 0);
  put(rc, box(0.5, 0.55, 0.05), '#8a5a33', 0, 0.68, -0.22, -0.15);
  for (const x of [-0.24, 0.24]) put(rc, torus(0.32, 0.025, 4, 12, PI * 0.6), '#7a4a2e', x, 0.32, -0.02, 0, PI / 2, PI * 1.2);
  put(rc, rbox(0.4, 0.08, 0.36, 0.03, 1), '#d8504a', 0, 0.43, 0);
  g.add(rc);
  // Woodpile by the side wall
  for (let i = 0; i < 9; i++) put(g, cyl(0.1, 0.1, 0.6, 7), i % 2 ? log : log2, w / 2 + 0.45, 0.1 + Math.floor(i / 3) * 0.19, -0.9 + (i % 3) * 0.21, PI / 2);
  c.lights.push({ x: SITE.x + 0.1, y: 1.8, z: SITE.z + d / 2 + 0.5, color: '#ffc27a', intensity: 3, distance: 4 });
  c.chimney = { x: SITE.x - 1.2, y: wh + 2.3, z: SITE.z - 0.55 };
  c.front = d / 2 + pd + 0.3;
  return g;
}

function house(c) {
  const g = new THREE.Group();
  const pt = c.paint || {};
  const w = 5.2, d = 3.6, f1 = 2.0, f2 = 1.8, wall = pt.wall ?? '#a9d8ec', trim = '#ffffff', roofC = pt.roof ?? '#4f5d8c';
  put(g, rbox(w + 0.2, 0.2, d + 0.2, 0.04, 1), '#d9cfc0', 0, 0.1, 0);
  put(g, box(w, f1, d), wall, 0, 0.2 + f1 / 2, 0);
  put(g, rbox(w + 0.16, 0.14, d + 0.16, 0.03, 1), trim, 0, 0.2 + f1, 0);
  put(g, box(w, f2, d), wall, 0, 0.2 + f1 + f2 / 2, 0);
  const top = 0.2 + f1 + f2;
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) put(g, box(0.14, f1 + f2, 0.14), trim, x, 0.2 + (f1 + f2) / 2, z);
  roof(g, 0, 0, w, d, top, 1.6, wall, roofC, 0.28);
  // Dormer
  const dm = grp(0.9, top + 0.15, d / 2 - 0.55);
  put(dm, box(1.0, 0.8, 0.9), wall, 0, 0.4, 0);
  roof(dm, 0, 0, 1.0, 0.9, 0.8, 0.45, wall, roofC, 0.1, false);
  win(face(dm, 0, 0, 0.46), 0, 0.42, 0.5, 0.45, { plain: true });
  g.add(dm);
  put(g, box(0.5, 1.6, 0.5), '#c8735a', -1.8, top + 0.9, -0.6);
  // Porch with columns, railing and steps
  const pd = 1.2, pz = d / 2 + pd / 2;
  put(g, box(w * 0.75, 0.24, pd), '#e9e2d6', -0.6, 0.12, pz);
  for (const x of [-2.4, -1.3, 0.1, 1.2]) put(g, cyl(0.07, 0.08, f1, 10), trim, x, 0.24 + f1 / 2, d / 2 + pd - 0.12);
  put(g, rbox(w * 0.78, 0.12, pd + 0.2, 0.03, 1), roofC, -0.6, f1 + 0.3, pz + 0.05, 0.08);
  for (let i = 0; i < 12; i++) {
    const x = -2.4 + i * 0.12;
    put(g, box(0.04, 0.4, 0.04), trim, x, 0.44, d / 2 + pd - 0.12);
    put(g, box(0.04, 0.4, 0.04), trim, 1.2 - i * 0.1, 0.44, d / 2 + pd - 0.12);
  }
  put(g, box(1.1, 0.12, 0.35), '#e9e2d6', -0.6, 0.06, d / 2 + pd + 0.17);
  const f = face(g, 0, 0, d / 2);
  door(f, -0.6, 0.7, 1.5, '#e8483b');
  f.children.forEach((m) => { m.position.y += 0.24; });
  win(f, -1.9, 1.3, 0.62, 0.8, { shutter: '#3d5d9a' });
  win(f, 1.5, 1.3, 0.9, 0.8, { shutter: '#3d5d9a', box: 2 });
  for (const x of [-1.6, 0, 1.6]) win(f, x, 0.2 + f1 + 0.9, 0.62, 0.72, { shutter: '#3d5d9a' });
  const s = face(g, PI / 2, w / 2, 0);
  for (const z of [-0.8, 0.8]) {
    win(s, z, 1.3, 0.62, 0.78, {});
    win(s, z, 0.2 + f1 + 0.9, 0.62, 0.72, {});
  }
  lantern(f, 0.0, 1.75);
  c.lights.push({ x: SITE.x, y: 2.0, z: SITE.z + d / 2 + 0.6, color: '#ffc27a', intensity: 3, distance: 4.5 });
  c.front = d / 2 + pd + 0.35;
  return g;
}

function villa(c) {
  const g = new THREE.Group();
  const pt = c.paint || {};
  const white = pt.wall ?? '#f7f5f0', dark = pt.roof ?? '#3a3f4a', wood = '#b98552';
  const glass = mat('#9fd0e4', { kind: 'env', r: 0.08, m: 0.3, e: '#ffbf70', ei: 0.4 });
  const w = 7.0, d = 4.2;
  put(g, rbox(w + 0.4, 0.16, d + 0.5, 0.03, 1), '#dcd6cc', 0, 0.08, 0.1);
  put(g, rbox(w, 2.1, d, 0.04, 1), white, 0, 0.16 + 1.05, 0);
  put(g, box(w + 0.24, 0.14, d + 0.24), '#4a505c', 0, 2.3, 0);
  put(g, box(w + 0.08, 0.06, d + 0.08), '#e9e6de', 0, 2.38, 0);
  // Upper box cantilevered over the entrance
  const ux = 1.0, uw = 4.4, ud = 3.6, uz = 0.35;
  put(g, rbox(uw, 1.85, ud, 0.04, 1), white, ux, 2.38 + 0.93, uz);
  put(g, box(uw + 0.24, 0.14, ud + 0.24), '#4a505c', ux, 4.3, uz);
  put(g, box(uw + 0.08, 0.06, ud + 0.08), '#efece4', ux, 4.38, uz);
  for (let i = 0; i < 6; i++) put(g, box(0.5, 0.04, 0.9), '#2c3e66', ux - 1.3 + (i % 3) * 0.62, 4.43, uz - 0.6 + Math.floor(i / 3) * 1.0, 0.12);
  put(g, box(uw * 0.92, 0.9, 0.06), glass, ux, 3.3, uz + ud / 2 + 0.01).castShadow = false;
  for (let i = 0; i <= 6; i++) put(g, box(0.05, 0.92, 0.08), dark, ux - uw * 0.46 + i * (uw * 0.92 / 6), 3.3, uz + ud / 2 + 0.02);
  put(g, box(0.06, 0.9, ud * 0.7), glass, ux + uw / 2 + 0.01, 3.3, uz).castShadow = false;
  // Timber cladding, floor-to-ceiling glass, entrance canopy
  const f = face(g, 0, 0, d / 2);
  put(f, box(1.8, 2.05, 0.06), wood, -2.4, 1.2, 0.02);
  for (let i = 0; i < 9; i++) put(f, box(0.04, 2.05, 0.08), '#9a6a3e', -3.2 + i * 0.2, 1.2, 0.04);
  put(f, box(3.0, 1.7, 0.05), glass, 0.6, 1.1, 0.02).castShadow = false;
  for (let i = 0; i <= 4; i++) put(f, box(0.05, 1.72, 0.07), dark, -0.9 + i * 0.75, 1.1, 0.04);
  door(f, 2.75, 0.75, 1.75, '#2f3440', { glass: true, frame: dark });
  f.children.slice(-4).forEach((m) => { m.position.y += 0.16; });
  put(f, box(1.4, 0.08, 0.9), dark, 2.75, 2.12, 0.45);
  const s = face(g, PI / 2, w / 2, 0);
  put(s, box(2.6, 1.4, 0.05), glass, 0, 1.25, 0.02).castShadow = false;
  // Roof terrace: glass railing, planters and a parasol
  for (const [x0, x1, z] of [[-w / 2 + 0.1, -1.2, d / 2 - 0.05]]) put(g, box(x1 - x0, 0.45, 0.04), mat('#cfefff', { kind: 'env', r: 0.05, op: 0.35 }), (x0 + x1) / 2, 2.62, z);
  for (const x of [-3.0, -1.7]) {
    put(g, rbox(0.4, 0.35, 0.4, 0.05, 1), '#e7e2d8', x, 2.55, d / 2 - 0.4);
    put(g, ico(0.28, 1), '#4f9a45', x, 2.9, d / 2 - 0.4);
  }
  put(g, cyl(0.03, 0.03, 1.3, 6), '#8a8a8a', -2.35, 3.0, -0.5);
  put(g, cone(0.85, 0.35, 10), '#ff7a59', -2.35, 3.7, -0.5);
  for (const [x, z] of [[-2.0, -1.2], [-2.8, -1.0]]) put(g, rbox(0.5, 0.1, 0.9, 0.03, 1), '#ffffff', x, 2.43, z);
  c.lights.push({ x: SITE.x + 2.75, y: 2.0, z: SITE.z + d / 2 + 0.6, color: '#ffd29a', intensity: 3, distance: 4.5 });
  c.front = d / 2 + 0.4;
  return g;
}

function mansion(c) {
  const g = new THREE.Group();
  const pt = c.paint || {};
  const wall = pt.wall ?? '#f6ead2', trim = '#ffffff', roofC = pt.roof ?? '#5a6fa8', stone = '#e3d6c0', gold = P('#e8b830', 0.3, 0.85);
  put(g, rbox(9.4, 0.4, 5.6, 0.05, 1), stone, 0, 0.2, -0.2);
  for (let i = 0; i < 3; i++) put(g, box(3.0 - i * 0.2, 0.14, 0.4), stone, 0, 0.07 + i * 0.14, 2.75 - i * 0.3);
  const cw = 4.0, cd = 4.4, ch = 3.8, base = 0.4;
  put(g, box(cw, ch, cd), wall, 0, base + ch / 2, -0.4);
  put(g, box(cw + 0.2, 0.18, cd + 0.2), trim, 0, base + ch, -0.4);
  hipRoof(g, 0, base + ch + 0.09, -0.4, cw + 0.5, cd + 0.5, 1.6, roofC);
  // Cupola
  put(g, cyl(0.45, 0.5, 0.7, 12), trim, 0, base + ch + 1.55, -0.4);
  put(g, sph(0.5, 14, 10, 0, TAU, 0, PI / 2), gold, 0, base + ch + 1.9, -0.4);
  put(g, cone(0.06, 0.5, 8), gold, 0, base + ch + 2.6, -0.4);
  // Wings
  for (const s of [-1, 1]) {
    const wx = s * 3.3;
    put(g, box(2.6, 2.9, 3.6), wall, wx, base + 1.45, -0.7);
    put(g, box(2.8, 0.15, 3.8), trim, wx, base + 2.9, -0.7);
    hipRoof(g, wx, base + 2.97, -0.7, 3.0, 4.0, 1.2, roofC);
    const wf = face(g, 0, wx, -0.7 + 1.8);
    for (const x of [-0.6, 0.6]) {
      win(wf, x, base + 0.95, 0.6, 1.0, { frame: trim, box: s > 0 ? 2 : 4 });
      win(wf, x, base + 2.2, 0.55, 0.7, { frame: trim });
    }
  }
  const sf = face(g, PI / 2, 3.3 + 1.3, -0.7);
  for (const z of [-0.8, 0.8]) win(sf, z, base + 1.4, 0.6, 1.0, { frame: trim });
  // Portico: columns, entablature, pediment, grand door
  const fz = -0.4 + cd / 2;
  for (const x of [-1.5, -0.55, 0.55, 1.5]) {
    put(g, cyl(0.17, 0.19, 2.9, 14), trim, x, base + 1.45 + 0.1, fz + 0.75);
    put(g, box(0.42, 0.14, 0.42), trim, x, base + 0.07, fz + 0.75);
    put(g, box(0.42, 0.14, 0.42), trim, x, base + 3.0, fz + 0.75);
  }
  put(g, box(3.7, 0.3, 1.0), trim, 0, base + 3.22, fz + 0.45);
  put(g, prism(3.8, 0.9, 0.9), wall, 0, base + 3.37, fz + 0.45);
  put(g, box(3.6, 0.12, 0.92), trim, 0, base + 3.42, fz + 0.45);
  put(g, sph(0.18, 12, 10), gold, 0, base + 3.75, fz + 0.92);
  const f = face(g, 0, 0, fz);
  for (const x of [-0.34, 0.34]) {
    put(f, rbox(0.62, 2.0, 0.08, 0.04, 1), '#2f6f6a', x, base + 1.0, 0.05);
    put(f, sph(0.05, 8, 6), gold, x + (x < 0 ? 0.2 : -0.2), base + 1.0, 0.11);
  }
  put(f, box(1.6, 2.15, 0.06), trim, 0, base + 1.07, 0.01);
  put(f, cyl(0.7, 0.7, 0.06, 16, false, -PI / 2, PI), LIT(), 0, base + 2.15, 0.02, -PI / 2);
  for (const x of [-1.25, 1.25]) {
    win(f, x, base + 1.1, 0.55, 1.1, { frame: trim });
    win(f, x, base + 2.75, 0.5, 0.75, { frame: trim });
  }
  win(f, 0, base + 2.75, 0.6, 0.75, { frame: trim });
  // Topiary pots by the steps
  for (const s of [-1, 1]) {
    put(g, rbox(0.5, 0.45, 0.5, 0.05, 1), '#c9a070', s * 1.9, 0.62, 2.55);
    put(g, sph(0.34, 14, 10), '#3f8a3c', s * 1.9, 1.15, 2.55);
    put(g, sph(0.22, 12, 8), '#4f9a45', s * 1.9, 1.6, 2.55);
  }
  c.lights.push({ x: SITE.x, y: 2.5, z: SITE.z + 2.6, color: '#ffd29a', intensity: 4, distance: 5 });
  c.front = 3.0;
  return g;
}

const HOUSE_BUILDERS = [tent, cabin, house, villa, mansion];

// plot dressing per tier
function picketFence(g, x0, z0, x1, z1, col = '#ffffff') {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.22)), ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
    put(g, box(0.09, 0.46, 0.04), col, x, 0.23, z, 0, -ang, 0);
    put(g, box(0.064, 0.064, 0.04), col, x, 0.46, z, 0, -ang, PI / 4);
  }
  for (const y of [0.15, 0.34]) put(g, box(len, 0.05, 0.03), col, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, -ang, 0);
}
function railFence(g, x0, z0, x1, z1, col = '#9a6a3e') {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.3)), ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) put(g, cyl(0.07, 0.08, 0.7, 6), col, x0 + ((x1 - x0) * i) / n, 0.35, z0 + ((z1 - z0) * i) / n);
  for (const y of [0.28, 0.56]) put(g, box(len, 0.08, 0.06), col, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, -ang, 0.01);
}
function ropeFence(g, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.8)), ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) put(g, cyl(0.04, 0.05, 0.45, 5), '#b08458', x0 + ((x1 - x0) * i) / n, 0.22, z0 + ((z1 - z0) * i) / n);
  put(g, box(len, 0.025, 0.025), '#efe0c0', (x0 + x1) / 2, 0.38, (z0 + z1) / 2, 0, -ang, 0).castShadow = false;
}
function lowWall(g, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
  put(g, box(len, 0.5, 0.22), '#f4f1ea', (x0 + x1) / 2, 0.25, (z0 + z1) / 2, 0, -ang, 0);
  put(g, box(len + 0.02, 0.06, 0.28), '#b98552', (x0 + x1) / 2, 0.53, (z0 + z1) / 2, 0, -ang, 0);
}
function hedge(g, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
  put(g, rbox(len, 0.8, 0.55, 0.2, 2), '#3f8a3c', (x0 + x1) / 2, 0.4, (z0 + z1) / 2, 0, -ang, 0);
  const n = Math.max(1, Math.round(len / 0.7));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    put(g, ico(0.22, 1), '#4f9a45', x0 + (x1 - x0) * t, 0.78, z0 + (z1 - z0) * t);
  }
}
function pillar(g, x, z, gold) {
  put(g, box(0.5, 1.2, 0.5), '#e3d6c0', x, 0.6, z);
  put(g, box(0.6, 0.12, 0.6), '#f4ead6', x, 1.26, z);
  put(g, sph(0.16, 10, 8), gold, x, 1.45, z);
}
function ironGate(g, x0, x1, z, gold) {
  const len = x1 - x0, n = Math.round(len / 0.16);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (len * i) / n, h = 0.95 + Math.sin((i / n) * PI) * 0.3;
    put(g, cyl(0.022, 0.022, h, 5), '#2e3436', x, h / 2, z);
    put(g, cone(0.04, 0.1, 5), gold, x, h + 0.05, z);
  }
  for (const y of [0.15, 0.85]) put(g, box(len, 0.05, 0.04), '#2e3436', (x0 + x1) / 2, y, z);
}

function ironFence(g, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.24)), ang = Math.atan2(z1 - z0, x1 - x0);
  const iron = P('#2e3436', 0.4, 0.5), gold = P('#e8b830', 0.3, 0.85);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
    put(g, cyl(0.018, 0.018, 0.8, 5), iron, x, 0.4, z);
    put(g, cone(0.035, 0.09, 5), gold, x, 0.84, z);
  }
  for (const y of [0.12, 0.66]) put(g, box(len, 0.04, 0.035), iron, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, -ang, 0);
}
function bambooFence(g, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.09)), ang = Math.atan2(z1 - z0, x1 - x0);
  const canes = [P('#c9b45a', 0.6), P('#b8a24a', 0.6), P('#d6c46a', 0.6)];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n, h = 0.78 + (i % 3) * 0.05;
    put(g, cyl(0.035, 0.035, h, 5), canes[i % 3], x, h / 2, z);
  }
  for (const y of [0.25, 0.6]) put(g, box(len, 0.03, 0.09), P('#7a5538'), (x0 + x1) / 2, y, (z0 + z1) / 2, 0, -ang, 0);
}
// Fence styles you can choose for the plot (otherwise each home has its own)
export const FENCES = {
  rope: { name: 'Rope', build: ropeFence },
  rail: { name: 'Ranch rail', build: railFence },
  picket: { name: 'White picket', build: picketFence },
  pastel: { name: 'Pink picket', build: (g, ...a) => picketFence(g, ...a, '#ffb8cf') },
  wall: { name: 'Low wall', build: lowWall },
  hedge: { name: 'Hedge', build: hedge },
  bamboo: { name: 'Bamboo', build: bambooFence },
  iron: { name: 'Iron railings', build: ironFence },
};
export const FENCE_PRICE = 250;

function perimeter(g, tier, gold, fence = null) {
  const { x0, x1, z0, z1 } = PLOT;
  const fronts = [[x0, GATE.x0], [GATE.x1, COURT.x0]];
  const line = FENCES[fence]?.build ?? [ropeFence, railFence, picketFence, lowWall, hedge][tier];
  const sides = [[x0, z0, x1, z0], [x0, z0, x0, z1], [x1, z0, x1, z1]];
  for (const [a, b] of fronts) line(g, a, z1, b, z1);
  for (const s of sides) line(g, ...s);
  if (tier === 4) {
    for (const x of [GATE.x0, GATE.x1, COURT.x0, x1]) pillar(g, x, z1, gold);
    ironGate(g, GATE.x0 + 0.25, GATE.x1 - 0.25, z1 + 0.02, gold);
    ironGate(g, COURT.x0 + 0.25, COURT.x0 + 1.4, z1 + 0.02, gold);
    ironGate(g, x1 - 1.4, x1 - 0.25, z1 + 0.02, gold);
  } else if (tier >= 2) {
    for (const x of [GATE.x0, GATE.x1]) put(g, box(0.16, 0.8, 0.16), tier === 3 ? '#b98552' : '#ffffff', x, 0.4, z1);
  }
}

function mailbox(g, tier) {
  const m = grp(GATE.x1 + 0.55, 0, PLOT.z1 + 0.5, 0);
  put(m, box(0.08, 0.8, 0.08), tier >= 3 ? '#3a3f4a' : '#9a6a3e', 0, 0.4, 0);
  put(m, rbox(0.28, 0.26, 0.46, 0.11, 1), ['#5b8def', '#c8443a', '#e8483b', '#3a3f4a', '#2f6f6a'][tier], 0, 0.9, 0);
  put(m, box(0.03, 0.22, 0.07), '#ffd23f', 0.16, 1.0, -0.12);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), new THREE.MeshStandardMaterial({ map: nameTexture(), roughness: 0.6 }));
  plate.geometry.userData.own = true;
  plate.material.userData.unique = true;
  plate.position.set(0, 0.62, 0.05);
  m.add(plate);
  put(m, box(0.46, 0.18, 0.03), '#5a3420', 0, 0.62, 0.035);
  g.add(m);
}
let nameTex = null;
function nameTexture() {
  if (nameTex) return nameTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 84;
  const g = c.getContext('2d');
  g.fillStyle = '#fff6e0';
  g.fillRect(0, 0, 256, 84);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '44px "Lilita One", system-ui, sans-serif';
  g.lineWidth = 7;
  g.strokeStyle = '#1d1a2f';
  g.strokeText('Sizzle Shack', 128, 45);
  g.fillStyle = '#ff8a3d';
  g.fillText('Sizzle Shack', 128, 45);
  nameTex = new THREE.CanvasTexture(c);
  nameTex.colorSpace = THREE.SRGBColorSpace;
  return nameTex;
}

function garage(g, tier) {
  if (tier === 0) return;
  if (tier === 1) {
    const s = grp(7.8, 0, -5.2);
    put(s, box(2.0, 1.6, 1.6), '#b5773f', 0, 0.8, 0);
    roof(s, 0, 0, 2.0, 1.6, 1.6, 0.7, '#b5773f', '#4f8a4a', 0.15);
    const f = face(s, 0, 0, 0.8);
    put(f, box(0.9, 1.2, 0.05), '#7a4a2e', -0.3, 0.6, 0.02);
    put(f, box(0.06, 0.6, 0.04), '#9aa3ad', 0.55, 0.9, 0.05, 0, 0, 0.3);
    g.add(s);
    return;
  }
  const x0 = 3.4, x1 = 8.2, z0 = -6.2, z1 = -3.2, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const wall = ['', '', '#a9d8ec', '#f7f5f0', '#f6ead2'][tier], roofC = ['', '', '#4f5d8c', '#3a3f4a', '#5a6fa8'][tier];
  const s = grp(cx, 0, cz);
  const h = 1.95;
  // Walls around an open left bay (spot 7) and a closed right door
  put(s, box(w, h, 0.2), wall, 0, h / 2, -d / 2 + 0.1);
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1, 0]) put(s, box(0.2, h, d), wall, x, h / 2, 0);
  put(s, box(w, 0.5, 0.2), wall, 0, h - 0.25, d / 2 - 0.1);
  put(s, box(w / 2 - 0.4, 1.5, 0.08), '#3a332e', -w / 4, 0.75, d / 2 - 0.25).castShadow = false;
  put(s, box(w / 2 - 0.4, 1.5, 0.08), tier === 3 ? '#b98552' : '#ffffff', w / 4, 0.75, d / 2 - 0.1);
  for (let i = 1; i < 5; i++) put(s, box(w / 2 - 0.42, 0.03, 0.1), tier === 3 ? '#9a6a3e' : '#dcd6cc', w / 4, i * 0.3, d / 2 - 0.08).castShadow = false;
  if (tier === 3) {
    put(s, box(w + 0.3, 0.14, d + 0.3), '#3a3f4a', 0, h + 0.07, 0);
    put(s, box(w, 0.06, d), '#f7f5f0', 0, h + 0.17, 0);
  } else if (tier === 4) hipRoof(s, 0, h, 0, w + 0.4, d + 0.4, 0.9, roofC);
  else roof(s, 0, 0, w, d, h, 0.8, wall, roofC, 0.2);
  if (tier === 2) {
    put(s, box(0.6, 0.4, 0.04), '#ffffff', w / 4, h - 0.2, d / 2 + 0.04);
    put(s, torus(0.16, 0.02, 6, 14), '#ff6a3d', w / 4, h - 0.42, d / 2 + 0.22, PI / 2);
  }
  g.add(s);
}

function palm(g, x, z, s = 1) {
  for (let i = 0; i < 6; i++) put(g, cyl(0.1 * s, 0.12 * s, 0.4 * s, 7), i % 2 ? '#a07a4e' : '#8a6640', x + i * 0.04 * s, 0.2 * s + i * 0.38 * s, z);
  const top = 2.4 * s;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const l = put(g, box(0.28 * s, 0.04, 1.3 * s), '#4fae4a', x + 0.24 * s + Math.sin(a) * 0.55 * s, top - 0.15 * s, z + Math.cos(a) * 0.55 * s, 0.45, a, 0);
    l.rotation.order = 'YXZ';
  }
  put(g, sph(0.16 * s, 8, 6), '#7a5a32', x + 0.24 * s, top, z);
}

function pool(c, g) {
  const { x0, x1, z0, z1 } = POOL, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (const [x, z, ww, dd] of [[cx, z0 - 0.15, w + 0.6, 0.3], [cx, z1 + 0.15, w + 0.6, 0.3], [x0 - 0.15, cz, 0.3, d], [x1 + 0.15, cz, 0.3, d]]) put(g, box(ww, 0.12, dd), '#f0ebe0', x, 0.06, z);
  put(g, box(w, 0.04, d), '#3aa6d8', cx, 0.01, cz).castShadow = false;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMat());
  water.geometry.userData.own = true;
  water.rotation.x = -PI / 2;
  water.position.set(cx, 0.09, cz);
  water.receiveShadow = true;
  g.add(water);
  for (const s of [-0.12, 0.12]) put(g, torus(0.16, 0.025, 6, 12, PI), '#dfe4ea', x1 - 0.35 + s, 0.16, z0 - 0.02, 0, PI / 2, 0);
  for (const x of [x0 + 0.5, x0 + 1.6]) {
    const l = grp(x, 0, z1 + 0.85, 0);
    put(l, rbox(0.55, 0.1, 1.15, 0.03, 1), '#ffffff', 0, 0.24, 0);
    put(l, rbox(0.5, 0.06, 0.5, 0.03, 1), '#ff9ab0', 0, 0.42, -0.42, -0.6);
    put(l, rbox(0.5, 0.06, 0.7, 0.03, 1), '#ff9ab0', 0, 0.31, 0.15);
    for (const z of [-0.45, 0.45]) put(l, box(0.5, 0.2, 0.05), '#dcd6cc', 0, 0.1, z);
    g.add(l);
  }
  put(g, cyl(0.03, 0.03, 1.6, 6), '#ffffff', x1 + 0.45, 0.8, z1 + 0.9);
  put(g, cone(0.8, 0.32, 10), '#ff6b57', x1 + 0.45, 1.6, z1 + 0.9);
  palm(g, x0 - 0.35, z0 - 0.4, 1);
  // Flamingo float bobbing on the water
  const fl = dyn(grp(cx + 0.4, 0.1, cz));
  put(fl, torus(0.3, 0.11, 8, 18), P('#ff8ab0', 0.4), 0, 0, 0, PI / 2);
  put(fl, cyl(0.05, 0.06, 0.45, 8), P('#ff8ab0', 0.4), 0, 0.28, -0.25, -0.2);
  put(fl, sph(0.09, 10, 8), P('#ff8ab0', 0.4), 0, 0.52, -0.3);
  put(fl, cone(0.035, 0.12, 6), P('#2a2228'), 0, 0.5, -0.19, PI / 2);
  mergeStatic(fl, 'prop');
  g.add(fl);
  c.anim.push((t) => {
    fl.position.set(cx + 0.4 + Math.sin(t * 0.3) * 0.5, 0.1 + Math.sin(t * 1.6) * 0.03, cz + Math.cos(t * 0.25) * 0.35);
    fl.rotation.y = t * 0.15;
  });
  c.obstacles.push({ x0: x0 - 0.3, z0: z0 - 0.3, x1: x1 + 0.3, z1: z1 + 1.5 }, { x: x1 + 0.45, z: z1 + 0.9, r: 0.2 });
  c.lights.push({ x: cx, y: 0.6, z: cz, color: '#7fd4ff', intensity: 1.5, distance: 3.5 });
}

function fountain(c, g, gold) {
  const { x, z } = FOUNTAIN;
  put(g, cyl(1.15, 1.2, 0.35, 24), '#e3d6c0', x, 0.17, z);
  put(g, torus(1.12, 0.08, 6, 28), '#f4ead6', x, 0.36, z, PI / 2);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.06, 24), stillWater());
  water.geometry.userData.own = true;
  water.rotation.x = -PI / 2;
  water.position.set(x, 0.37, z);
  g.add(water);
  put(g, cyl(0.16, 0.24, 0.9, 12), '#f4ead6', x, 0.75, z);
  put(g, cyl(0.55, 0.2, 0.2, 18), '#f4ead6', x, 1.2, z);
  put(g, cyl(0.1, 0.14, 0.5, 10), '#f4ead6', x, 1.5, z);
  put(g, sph(0.12, 10, 8), gold, x, 1.82, z);
  put(g, torus(0.53, 0.04, 6, 20), '#f4ead6', x, 1.32, z, PI / 2);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.52, 18), stillWater());
  top.geometry.userData.own = true;
  top.rotation.x = -PI / 2;
  top.position.set(x, 1.32, z);
  g.add(top);
  c.spray = { x, z };
  c.obstacles.push({ x, z, r: 1.35 });
}

function lampPost(c, g, x, z, gold) {
  put(g, cyl(0.06, 0.08, 1.8, 8), '#2e3436', x, 0.9, z);
  put(g, cyl(0.12, 0.12, 0.08, 8), '#2e3436', x, 0.04, z);
  put(g, sph(0.16, 10, 8), mat('#fff1c4', { kind: 'env', e: '#ffc060', ei: 1.4 }), x, 1.95, z).castShadow = false;
  put(g, cone(0.2, 0.18, 8), gold, x, 2.18, z);
  c.lights.push({ x, y: 2.0, z, color: '#ffd08a', intensity: 2.2, distance: 3.6 });
  c.obstacles.push({ x, z, r: 0.25 });
}

// Lawn with mowing stripes (grass texture tinted per vertex), paving for the drive and the path
function lawnMesh(tier, own) {
  const { x0, x1, z0, z1 } = PLOT;
  const n = 18, k = [0, 0.04, 0.07, 0.09, 0.1][tier];
  const pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n, b = x0 + ((x1 - x0) * (i + 1)) / n, v = i % 2 ? 1 : 1 - k * 2;
    const base = pos.length / 3;
    for (const [x, z] of [[a, z0], [b, z0], [b, z1], [a, z1]]) {
      pos.push(x, 0, z);
      uv.push(x / 4, -z / 4);
      col.push(v, v * (1 + k * 0.3), v);
    }
    idx.push(base, base + 3, base + 2, base, base + 2, base + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = grassTexture().clone();
  tex.needsUpdate = true;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }));
  own.push(geo, tex, m.material);
  m.position.y = 0.004;
  m.receiveShadow = true;
  return m;
}

function pavingMesh(rects, tint, own, y = 0.012) {
  const pos = [], uv = [], idx = [];
  for (const [x0, z0, x1, z1] of rects) {
    const b = pos.length / 3;
    pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
    uv.push(x0 / 2, -z0 / 2, x1 / 2, -z0 / 2, x1 / 2, -z1 / 2, x0 / 2, -z1 / 2);
    idx.push(b, b + 3, b + 2, b, b + 2, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = sidewalkTexture().clone();
  tex.needsUpdate = true;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: 0.95 }));
  own.push(geo, tex, m.material);
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

// Everything that changes with the house tier: lawn, paving, fence, garage, house and extras
function buildTier(tier, paint = null, fence = null) {
  const c = { anim: [], lights: [], obstacles: [], own: [], front: 1, paint };
  const root = new THREE.Group();
  const stat = new THREE.Group();
  root.add(stat);
  const gold = P('#e8b830', 0.3, 0.85);
  root.add(lawnMesh(tier, c.own));
  const pathRects = tier >= 2 ? [[SITE.x - 0.55, 0.0, SITE.x + 0.55, PLOT.z1 + 0.3]] : [];
  if (tier === 4) pathRects.length = 0;
  root.add(pavingMesh([[COURT.x0, PLOT.z0 + 0.1, COURT.x1 - 0.1, PLOT.z1 + 0.3], ...pathRects], tier < 2 ? '#efe6d6' : '#ffffff', c.own));
  if (tier < 2) stones(stat, [[SITE.x, -0.2], [SITE.x, PLOT.z1 + 0.1]], 0.5, 0.22);
  if (tier === 4) {
    const ring = [];
    for (let i = 0; i <= 20; i++) ring.push([FOUNTAIN.x + Math.sin((i / 20) * TAU) * 1.7, FOUNTAIN.z + Math.cos((i / 20) * TAU) * 1.7]);
    stones(stat, ring, 0.42, 0.3, '#efe4cc');
    stones(stat, [[SITE.x, 0.2], [SITE.x, FOUNTAIN.z - 1.7]], 0.42, 0.3, '#efe4cc');
    stones(stat, [[SITE.x, FOUNTAIN.z + 1.7], [SITE.x, PLOT.z1 + 0.2]], 0.42, 0.3, '#efe4cc');
  }
  // Parking bay lines; the first bay is a showroom turntable
  const line = '#fdf8ec';
  for (const s of SPOTS.slice(1, 7)) {
    for (const dx of [-0.75, 0.75]) put(stat, box(0.06, 0.02, 2.3), line, s.x + dx, 0.02, s.z).castShadow = false;
  }
  perimeter(stat, tier, gold, fence);
  mailbox(stat, tier);
  garage(stat, tier);
  const h = HOUSE_BUILDERS[tier](c);
  h.position.set(SITE.x, 0, SITE.z);
  mergeStatic(h, 'env');
  root.add(dyn(h));
  c.house = h;
  if (tier >= 3) pool(c, stat);
  if (tier === 4) {
    fountain(c, stat, gold);
    for (const z of [1.0, 5.2]) for (const s of [-1, 1]) lampPost(c, stat, SITE.x + s * 1.1 + (z > 3 ? s * 0.5 : 0), z, gold);
  }
  if (tier === 3) palm(stat, 1.6, -1.2, 0.9);
  c.obstacles.push({ x0: -9.6, z0: -7, x1: 2.3, z1: SITE.z + c.front });
  mergeStatic(stat, 'env');
  root.userData = c;
  return root;
}

function turntable() {
  const g = grp(SPOTS[0].x, 0, SPOTS[0].z);
  put(g, cyl(1.32, 1.38, 0.1, 32), '#3a3f4a', 0, 0.05, 0);
  put(g, torus(1.32, 0.05, 6, 40), P('#e8b830', 0.3, 0.85), 0, 0.1, 0, PI / 2);
  const plate = dyn(grp(0, 0.1, 0));
  put(plate, cyl(1.18, 1.18, 0.05, 32), '#dfe2e8', 0, 0.025, 0);
  for (let i = 0; i < 8; i++) put(plate, box(0.04, 0.012, 2.2), '#c4c9d2', 0, 0.055, 0, 0, (i / 8) * PI, 0).castShadow = false;
  g.add(plate);
  mergeStatic(plate, 'env');
  mergeStatic(g, 'env');
  g.userData.plate = plate;
  return g;
}

// Trees, bushes and flowers around the plot, the street out front (static for every tier)
function buildSurroundings(own) {
  const g = new THREE.Group();
  const grass = grassTexture().clone();
  grass.needsUpdate = true;
  grass.repeat.set(35, 35);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  own.push(grass, ground.geometry, ground.material);
  ground.rotation.x = -PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  g.add(ground);
  const sw = sidewalkTexture().clone();
  sw.needsUpdate = true;
  sw.repeat.set(30, 1);
  const swMat = new THREE.MeshStandardMaterial({ map: sw, roughness: 0.95 });
  const swGeo = new THREE.PlaneGeometry(60, 2.1);
  own.push(sw, swMat, swGeo);
  for (const z of [7.4, 15.6]) {
    const s = new THREE.Mesh(swGeo, swMat);
    s.rotation.x = -PI / 2;
    s.position.set(0, 0.006, z);
    s.receiveShadow = true;
    g.add(s);
  }
  const rt = roadTexture().clone();
  rt.needsUpdate = true;
  rt.repeat.set(15, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.9 }));
  own.push(rt, road.geometry, road.material);
  road.rotation.x = -PI / 2;
  road.position.set(0, -0.02, 11.5);
  road.receiveShadow = true;
  g.add(road);
  const props = new THREE.Group();
  put(props, box(60, 0.12, 0.2), '#b9b2a6', 0, 0, 8.45);
  for (const x of [-7, 0.5, 9]) {
    const l = buildStreetLamp();
    l.position.set(x, 0, 8.1);
    props.add(l);
  }
  g.add(mergeStatic(props, 'env'));
  let seed = 4242;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const trees = [], bushes = [], flowers = [], tufts = [];
  for (let x = -14; x < 15; x += 2.3 + rnd() * 0.8) trees.push({ x, z: -8.0 - rnd() * 1.2, s: 0.95 + rnd() * 0.35, kind: rnd() < 0.15 ? 'blossom' : undefined });
  for (let x = -16; x < 17; x += 2.8 + rnd()) trees.push({ x, z: -11.2 - rnd() * 1.5, s: 1.05 + rnd() * 0.3 });
  for (let z = -5; z < 6; z += 2.2 + rnd() * 0.8) {
    trees.push({ x: -11.2 - rnd() * 0.8, z, s: 0.95 + rnd() * 0.3, kind: rnd() < 0.12 ? 'autumn' : undefined });
    trees.push({ x: 11.4 + rnd() * 0.8, z: z - 0.5, s: 0.9 + rnd() * 0.3 });
  }
  for (let x = -14; x < 15; x += 3.4 + rnd() * 1.5) trees.push({ x, z: 17.8 + rnd() * 1.2, s: 0.95 + rnd() * 0.3 });
  for (let x = -9; x < 9.5; x += 1.6 + rnd() * 0.5) bushes.push({ x, z: -7.0 - rnd() * 0.2, s: 0.8 + rnd() * 0.3, flowers: rnd() < 0.4 });
  for (let z = -6; z < 6; z += 1.7 + rnd() * 0.5) bushes.push({ x: -10.1 - rnd() * 0.2, z, s: 0.8 + rnd() * 0.25, flowers: rnd() < 0.4 });
  for (const x of [-8.2, -6.4, -1.4, 0.8]) flowers.push({ x, z: 5.6, n: 6 });
  for (let i = 0; i < 160; i++) {
    const x = (rnd() - 0.5) * 50, z = -16 + rnd() * 40;
    const inPlot = x > PLOT.x0 - 0.3 && x < PLOT.x1 + 0.3 && z > PLOT.z0 - 0.3 && z < PLOT.z1 + 0.3;
    if (!inPlot && !(z > 6.2 && z < 16.8)) tufts.push({ x, z, s: 0.8 + rnd() * 0.5 });
  }
  for (let i = 0; i < 26; i++) tufts.push({ x: YARD.x0 + rnd() * (YARD.x1 - YARD.x0), z: YARD.z0 + rnd() * (YARD.z1 - YARD.z0), s: 0.7 + rnd() * 0.3 });
  g.add(buildGarden({ trees, bushes, flowers, tufts, caster: (x, z) => z < 9 && Math.abs(x) < 14 }, 777));
  return g;
}

// yard decor
const DECOR_MODELS = {
  gnomes: () => {
    const g = new THREE.Group();
    [['#e8483b', '#3c7bd6', -0.6], ['#3cb46e', '#e8a03b', 0], ['#7a5cd6', '#e8483b', 0.6]].forEach(([hat, coat, x], i) => {
      const n = grp(x, 0, (i % 2) * 0.12, -0.3 + i * 0.3);
      put(n, cyl(0.12, 0.15, 0.28, 10), P(coat), 0, 0.14, 0);
      put(n, sph(0.1, 10, 8), P('#ffd9b8'), 0, 0.36, 0);
      put(n, sph(0.11, 10, 8, 0, TAU, PI / 2, PI / 2), P('#ffffff'), 0, 0.33, 0.03);
      put(n, cone(0.12, 0.3, 10), P(hat), 0, 0.56, 0, -0.15);
      put(n, sph(0.035, 6, 5), P('#ff9a9a'), 0, 0.36, 0.1);
      g.add(n);
    });
    return g;
  },
  doghouse: () => {
    const g = new THREE.Group();
    put(g, box(0.9, 0.7, 1.0), P('#e8a03b'), 0, 0.35, 0);
    put(g, prism(1.1, 0.5, 1.15), P('#c8443a'), 0, 0.7, 0);
    put(g, box(0.4, 0.5, 0.04), P('#3a2a24'), 0, 0.3, 0.5).castShadow = false;
    put(g, capsule(0.04, 0.22), P('#ffffff'), 0, 0.92, 0.56, 0, 0, PI / 2);
    for (const s of [-1, 1]) put(g, sph(0.06, 8, 6), P('#ffffff'), s * 0.14, 0.92, 0.56);
    put(g, cyl(0.12, 0.1, 0.06, 12), P('#4fb3e8'), 0.5, 0.03, 0.55);
    return g;
  },
  bbq: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) put(g, cyl(0.025, 0.025, 0.7, 6), P('#3a3f4a', 0.4, 0.5), Math.sin((i / 3) * TAU) * 0.18, 0.33, Math.cos((i / 3) * TAU) * 0.18, Math.cos((i / 3) * TAU) * 0.25, 0, -Math.sin((i / 3) * TAU) * 0.25);
    put(g, sph(0.3, 16, 10, 0, TAU, PI / 2, PI / 2), P('#2a2c33', 0.35, 0.5), 0, 0.72, 0);
    put(g, cyl(0.3, 0.3, 0.02, 16), P('#9aa3ad', 0.3, 0.8), 0, 0.73, 0);
    for (const [x, z, c] of [[-0.1, 0.05, '#7a3a24'], [0.12, -0.06, '#7a3a24'], [0.05, 0.14, '#e8483b']]) put(g, cyl(0.07, 0.07, 0.04, 10), P(c), x, 0.76, z);
    const lid = grp(0, 0.73, -0.28);
    lid.rotation.x = -1.4;
    put(lid, sph(0.3, 16, 10, 0, TAU, 0, PI / 2), P('#2a2c33', 0.35, 0.5), 0, 0, 0.28);
    g.add(lid);
    return g;
  },
  hammock: () => {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      put(g, cyl(0.07, 0.08, 1.3, 8), P('#8a5a33'), s * 1.3, 0.65, 0);
      put(g, box(0.03, 0.02, 0.5), P('#efe0c0'), s * 1.12, 0.95, 0, 0, 0, s * 0.6);
    }
    const sway = dyn(grp(0, 1.0, 0));
    for (let i = 0; i < 7; i++) {
      const t = i / 6 - 0.5, y = -0.45 + t * t * 1.3;
      put(sway, box(0.3, 0.04, 0.62), P(i % 2 ? '#ffffff' : '#ff7a59', 0.8), t * 1.9, y, 0, 0, 0, Math.atan(t * 2.6) * 0.9);
    }
    mergeStatic(sway, 'prop');
    g.add(sway);
    g.userData.sway = sway;
    return g;
  },
  trampoline: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) put(g, cyl(0.03, 0.03, 0.5, 6), P('#3a3f4a', 0.4, 0.4), Math.sin((i / 6) * TAU) * 0.82, 0.25, Math.cos((i / 6) * TAU) * 0.82);
    put(g, torus(0.85, 0.07, 8, 32), P('#3cb4e8'), 0, 0.5, 0, PI / 2);
    put(g, cyl(0.78, 0.78, 0.02, 28), P('#2a2c33', 0.8), 0, 0.48, 0);
    for (let i = 0; i < 8; i++) put(g, cyl(0.015, 0.015, 0.9, 5), P('#dfe4ea', 0.4, 0.5), Math.sin((i / 8) * TAU) * 0.85, 0.95, Math.cos((i / 8) * TAU) * 0.85);
    put(g, torus(0.85, 0.02, 6, 32), P('#dfe4ea', 0.4, 0.5), 0, 1.4, 0, PI / 2);
    return g;
  },
  hottub: () => {
    const g = new THREE.Group();
    put(g, cyl(0.75, 0.75, 0.55, 20), P('#a0683e'), 0, 0.27, 0);
    for (let i = 0; i < 16; i++) put(g, box(0.04, 0.56, 0.02), P('#7a4a2e'), Math.sin((i / 16) * TAU) * 0.75, 0.27, Math.cos((i / 16) * TAU) * 0.75, 0, (i / 16) * TAU, 0);
    put(g, torus(0.73, 0.06, 6, 24), P('#7a4a2e'), 0, 0.57, 0, PI / 2);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), stillWater());
    water.geometry.userData.own = true;
    water.rotation.x = -PI / 2;
    water.position.y = 0.56;
    g.add(water);
    put(g, box(0.5, 0.2, 0.4), P('#7a4a2e'), 0, 0.1, 0.9);
    return g;
  },
};

function buildDecor(id) {
  const g = DECOR_MODELS[id]();
  mergeStatic(g, 'prop');
  return g;
}
const itemModel = (id) => (DECOR_MODELS[id] ? buildDecor(id) : buildHomeItem(id));

// A home helper: a character with the tool of the job in the right hand
function buildHelper(id) {
  const m = buildCharacter(HELPER_LOOKS[id]);
  const tool = new THREE.Group();
  if (id === 'gardener') {
    put(tool, rbox(0.2, 0.17, 0.12, 0.04, 1), P('#3fae5a', 0.5), 0, 0.02, 0.06);
    put(tool, cyl(0.018, 0.026, 0.22, 6), P('#3fae5a', 0.5), 0, 0.06, 0.2, 1.1);
    put(tool, torus(0.07, 0.014, 5, 10, PI), P('#2d8a47'), 0, 0.11, 0.04, 0, PI / 2);
  } else if (id === 'butler') {
    put(tool, cyl(0.17, 0.17, 0.02, 18), P('#dfe4ea', 0.25, 0.85), 0, 0.07, 0);
    put(tool, cyl(0.045, 0.035, 0.07, 10), P('#ffffff', 0.4), -0.05, 0.12, 0.02);
    put(tool, cyl(0.05, 0.06, 0.1, 10), P('#ffffff', 0.4), 0.07, 0.13, -0.03);
    put(tool, cone(0.02, 0.06, 6), P('#ffffff', 0.4), 0.13, 0.15, -0.03, 0, 0, -1.2);
  } else {
    put(tool, sph(0.09, 12, 8), P('#ff4a5a', 0.5), 0, 0.04, 0.06);
    put(tool, torus(0.09, 0.012, 5, 14), P('#ffffff'), 0, 0.04, 0.06, PI / 2);
  }
  mergeStatic(tool, 'char');
  m.handR.add(tool);
  return m;
}

// Yard grid maths. Items are stored by the cell of their footprint's low corner and a quarter turn.
const footprint = (id, rot) => {
  const [w, d] = HOME_ITEMS[id].size;
  return rot % 2 ? [d, w] : [w, d];
};
function cellRect(c, r, w, d, inset = 0) {
  return { x0: GRID.x0 + c + inset, z0: GRID.z0 + r + inset, x1: GRID.x0 + c + w - inset, z1: GRID.z0 + r + d - inset };
}
function itemRect(it, inset = 0) {
  const [w, d] = footprint(it.id, it.rot);
  return cellRect(it.c, it.r, w, d, inset);
}
function rectHits(list, q) {
  for (const o of list) {
    if (o.r !== undefined) {
      const x = clamp(o.x, q.x0, q.x1), z = clamp(o.z, q.z0, q.z1);
      if (Math.hypot(x - o.x, z - o.z) < o.r) return true;
    } else if (q.x0 < o.x1 && q.x1 > o.x0 && q.z0 < o.z1 && q.z1 > o.z0) return true;
  }
  return false;
}

// geometry helpers for the yard
function inRect(o, x, z, pad) { return x > o.x0 - pad && x < o.x1 + pad && z > o.z0 - pad && z < o.z1 + pad; }
function blocked(list, x, z, pad) {
  for (const o of list) {
    if (o.r !== undefined ? Math.hypot(x - o.x, z - o.z) < o.r + pad : inRect(o, x, z, pad)) return true;
  }
  return false;
}
function pathClear(list, x0, z0, x1, z1, pad) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25);
  for (let i = 1; i <= n; i++) if (blocked(list, x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, pad)) return false;
  return true;
}
function pushOut(list, p, pad) {
  for (const o of list) {
    if (o.r !== undefined) {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + pad;
      if (d < m) {
        if (d < 1e-4) { p.x += m; continue; }
        p.x = o.x + (dx / d) * m;
        p.z = o.z + (dz / d) * m;
      }
    } else if (inRect(o, p.x, p.z, pad)) {
      const l = p.x - (o.x0 - pad), r = o.x1 + pad - p.x, t = p.z - (o.z0 - pad), b = o.z1 + pad - p.z, m = Math.min(l, r, t, b);
      if (m === l) p.x = o.x0 - pad;
      else if (m === r) p.x = o.x1 + pad;
      else if (m === t) p.z = o.z0 - pad;
      else p.z = o.z1 + pad;
    }
  }
}

// Walking along waypoints: the next point to head for (via = not the last one)
function followPath(w) {
  while (w.path && w.path.length > 1 && Math.hypot(w.path[0].x - w.x, w.path[0].z - w.z) < 0.22) w.path.shift();
  const p = w.path?.[0] ?? { x: w.tx, z: w.tz };
  return { x: p.x, z: p.z, via: !!w.path && w.path.length > 1 };
}
function pathLength(w, path) {
  let n = 0, x = w.x, z = w.z;
  for (const p of path) { n += Math.hypot(p.x - x, p.z - z); x = p.x; z = p.z; }
  return n;
}

// thumbnails (baked once, lazily)
const THUMBS = {};
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
function thumbJobs() {
  const jobs = [];
  TIER_IDS.forEach((id, i) => jobs.push([`tier:${id}`, () => { const g = HOUSE_BUILDERS[i]({ anim: [], lights: [], obstacles: [] }); mergeStatic(g, 'env'); return g; }, { elevation: 0.6, pad: 1.04 }]));
  for (const id of Object.keys(PETS)) jobs.push([`pet:${id}`, () => buildPet(id).root, { elevation: 0.35, yaw: 0.55, pad: 1.08 }]);
  for (const id of Object.keys(CARS)) jobs.push([`car:${id}`, () => buildLuxuryCar(id), { elevation: 0.5, yaw: 0.75, pad: 1.04 }]);
  for (const id of Object.keys(HOME_ITEMS)) jobs.push([`item:${id}`, () => itemModel(id), { elevation: 0.55, yaw: 0.6, pad: 1.08 }]);
  for (const id of Object.keys(HOME_STAFF)) jobs.push([`helper:${id}`, () => buildHelper(id).root, { elevation: 0.22, yaw: 0.5, pad: 1.06 }]);
  return jobs.filter(([k]) => !THUMBS[k]);
}

// the mode
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class HomeMode {
  constructor(game, { onExit } = {}) {
    this.game = game;
    this.onExit = onExit;
    this._active = false;
    this.pan = { x: 0, z: 0 };
    this.zoom = 1;
    this.panel = new HomePanel(this, {
      HOME_TIERS, TIER_IDS, PETS, CARS, HOME_ITEMS, ITEM_GROUPS, PET_LIMITS, PET_BONUS, PET_CARE, PAINT, COMFORT_LEVELS,
      perkText, formatMoney, homePerks, homeComfort, comfortLevel, sadPets, isRested, HOME_STAFF, REST_PERK, FENCES, FENCE_PRICE,
      sellBack: ECON.sellRefund,
    });
    this.placing = null; // { id, rot, c, r, from (a placed item being moved), stored, ok }
    this.sel = null; // the yard item picked for the item toolbar
    this.helpers = [];
  }

  get active() { return this._active; }
  get home() { return this.game.state.home; }
  // Placing or editing furniture: Escape belongs to the yard, not the pause menu
  get busy() { return !!(this.placing || this.sel); }
  thumb(key) { return THUMBS[key] || BLANK; }

  // enter / exit
  enter() {
    if (this._active) return;
    const g = this.game, r = g.renderer;
    g.state.home = normalizeHome(g.state.home ?? defaultHomeState());
    this._phase = g.phase;
    const sc0 = r.sun.shadow.camera;
    this.saved = {
      camTarget: r.camTarget.clone(), camSmooth: r.camSmooth.clone(), viewSize: r.viewSize, targetView: r.targetView,
      yaw: r.yaw, targetYaw: r.targetYaw, shadow: [sc0.left, sc0.right, sc0.top, sc0.bottom], hour: this.restaurantHour(),
    };
    // Hide everything the restaurant put in the scene (world, characters, grid objects, build
    // helpers...) except the lights and the particle pools, and the restaurant's own UI.
    const p = g.particles;
    const keep = new Set([p.soft?.points, p.glow?.points, p.chunks?.mesh, p.coins?.mesh, r.sun.target, r.fill.target]);
    this.hiddenObjs = [];
    for (const o of r.scene.children) {
      if (o.isLight || keep.has(o) || !o.visible) continue;
      o.visible = false;
      this.hiddenObjs.push(o);
    }
    this.hiddenEls = [];
    for (const sel of ['#night-dock', '#build-help', '#build-tools', '#hint', '#prompt', '#world-ui']) {
      const el = document.querySelector(sel);
      if (el && !el.classList.contains('hidden')) {
        el.classList.add('hidden');
        this.hiddenEls.push(el);
      }
    }
    this.buildScene();
    r.scene.add(this.root);
    this._active = true;
    this.t = 0;
    this.pan = { x: 0, z: 0 };
    this.zoom = 1;
    this.panel.show();
    this.frameCamera(0);
    r.yaw = r.targetYaw = CAMERA.yaw;
    r.shake = 0;
    r.snapCamera();
    r.updateCamera(0);
    r.setTimeOfDay(HOME_HOUR);
    this.applySun();
    this.thumbQueue = thumbJobs();
    g.audio.swoosh?.();
  }

  exit(restore = true) {
    if (!this._active) return;
    this._active = false;
    const g = this.game, r = g.renderer;
    if (this.placing) this.cancelPlacing(true);
    this.sel = null;
    this.panel.hide();
    for (const el of this.hiddenEls) el.classList.remove('hidden');
    for (const o of this.hiddenObjs) o.visible = true;
    this.hiddenEls = [];
    this.hiddenObjs = [];
    g.canvas.style.cursor = '';
    this.disposeScene();
    if (this.baker) { this.baker.dispose(); this.baker = null; }
    const s = this.saved;
    const sc0 = r.sun.shadow.camera;
    [sc0.left, sc0.right, sc0.top, sc0.bottom] = s.shadow;
    sc0.updateProjectionMatrix();
    if (!restore) return;
    r.targetView = s.viewSize;
    r.snapCamera();
    r.targetView = s.targetView;
    r.camTarget.copy(s.camTarget);
    r.camSmooth.copy(s.camSmooth);
    r.yaw = s.yaw;
    r.targetYaw = s.targetYaw;
    r.updateCamera(0);
    r.setTimeOfDay(s.hour);
  }

  // The hour main.js lights the restaurant at in the current phase
  restaurantHour() {
    const g = this.game;
    if (g.phase === 'night' || g.phase === 'summary') return 22.6;
    if (g.phase === 'title') return 21.5;
    return g.clock;
  }

  leave() {
    this.game.audio.click?.();
    if (this.onExit) this.onExit();
    if (this._active) this.exit();
  }

  // scene
  buildScene() {
    this.root = grp(OX, 0, OZ);
    this.own = [];
    this.root.add(buildSurroundings(this.own));
    this.tt = turntable();
    this.root.add(this.tt);
    this.tierObj = null;
    this.setTier(this.home.tier, false);
    this.anims = [];
    this.itemObjs = new Map();
    this.fitItems(false);
    this.syncItems();
    this.overlay = this.makeOverlay();
    this.root.add(this.overlay);
    this.carObjs = new Map();
    this.syncCars(false);
    this.pets = [];
    this.syncPets(false);
    this.chef = this.makeChef();
    this.helpers = [];
    this.syncHelpers(false);
    this.marks = this.makeMarks();
    this.root.add(this.marks.group);
  }

  disposeScene() {
    if (!this.root) return;
    this.game.renderer.scene.remove(this.root);
    disposeObject(this.root);
    for (const o of this.own) o.dispose();
    if (this.tierObj) for (const o of this.tierObj.userData.own) o.dispose();
    this.root = null;
    this.tierObj = null;
    this.pets = [];
    this.helpers = [];
    this.marks = null;
    this.carObjs = null;
    this.itemObjs = null;
    this.overlay = null;
    this.placing = null;
    this.sel = null;
    this.chef = null;
    this.ball = null;
  }

  setTier(tier, animate = true) {
    const old = this.tierObj;
    const t = buildTier(tier, this.home.paint, this.home.fence);
    this.tierObj = t;
    this.root.add(t);
    this.refreshObstacles();
    if (!old) return;
    const house = t.userData.house;
    if (animate === 'paint') {
      // A fresh coat: splashes of the new colours and a little squash
      const cols = [this.home.paint.wall, this.home.paint.roof].filter(Boolean);
      for (let i = 0; i < 4; i++) this.fx('splash', SITE.x + rand(-2, 2), 1.5 + rand(0, 1.5), SITE.z + rand(-1, 1.5), 6);
      this.fx('confetti', SITE.x, 3.2, SITE.z + 1, 50, cols.length ? cols : undefined);
      this.root.remove(old);
      this.disposeTier(old);
      this.tween(0.5, (k) => { const e = Math.sin(k * PI) * 0.06; house.scale.set(1 + e, 1 - e, 1 + e); }, () => house.scale.set(1, 1, 1));
    } else if (animate) {
      // Old home shrinks away in a puff, the new one springs up
      const x = SITE.x, z = SITE.z;
      this.fx('poof', x, 1.2, z, '#ffffff', 26);
      for (let i = 0; i < 6; i++) this.fx('dust', x + rand(-2.5, 2.5), z + rand(-1.5, 1.5), 4, '#f4ead6');
      this.fx('confetti', x, 3.5, z + 1, 70);
      this.game.renderer.addShake?.(0.3);
      this.root.remove(old);
      this.disposeTier(old);
      house.scale.set(1, 0.05, 1);
      this.tween(0.9, (k) => { const e = easeOutBack(k); house.scale.set(0.85 + e * 0.15, Math.max(0.05, e), 0.85 + e * 0.15); }, () => house.scale.set(1, 1, 1));
    } else {
      this.root.remove(old);
      this.disposeTier(old);
    }
    if (this.itemObjs) {
      this.fitItems(true);
      this.syncItems();
    }
    for (const p of this.pets || []) this.unstick(p);
  }

  disposeTier(t) {
    disposeObject(t);
    for (const o of t.userData.own) o.dispose();
  }

  refreshObstacles() {
    const list = [...(this.tierObj?.userData.obstacles || [])];
    for (const it of this.home.items) if (!HOME_ITEMS[it.id].flat) list.push(itemRect(it, 0.12));
    list.push({ x: SPOTS[0].x, z: SPOTS[0].z, r: 1.4 });
    for (const s of SPOTS.slice(1, this.home.cars.length)) list.push({ x0: s.x - 0.6, z0: s.z - 1.1, x1: s.x + 0.6, z1: s.z + 1.1 });
    this.obstacles = list;
  }

  // yard furniture
  // Is there room for this piece with its low corner on cell (c, r)? `ignore` is the item being moved.
  canPlace(id, c, r, rot, ignore = null) {
    const [w, d] = footprint(id, rot);
    if (c < 0 || r < 0 || c + w > GRID.cols || r + d > GRID.rows) return false;
    if (c <= GRID.path && GRID.path < c + w) return false;
    const q = cellRect(c, r, w, d, 0.1);
    if (rectHits(this.tierObj.userData.obstacles, q) || rectHits(RESERVED, q)) return false;
    for (const it of this.home.items) {
      if (it === ignore) continue;
      const [w2, d2] = footprint(it.id, it.rot);
      if (c < it.c + w2 && it.c < c + w && r < it.r + d2 && it.r < r + d) return false;
    }
    return true;
  }

  // Free cell nearest to a yard point for this piece (null when the yard is full)
  nearestFree(id, rot, x, z, ignore = null) {
    const [w, d] = footprint(id, rot);
    let best = null, bd = Infinity;
    for (let r = 0; r + d <= GRID.rows; r++) {
      for (let c = 0; c + w <= GRID.cols; c++) {
        const dd = Math.hypot(GRID.x0 + c + w / 2 - x, GRID.z0 + r + d / 2 - z);
        if (dd < bd && this.canPlace(id, c, r, rot, ignore)) { bd = dd; best = { c, r }; }
      }
    }
    return best;
  }

  // After a move to a new house: anything that no longer fits goes back into storage
  fitItems(tell) {
    const h = this.home, keep = [];
    let moved = 0;
    for (const it of h.items) {
      const prev = h.items;
      h.items = keep;
      const ok = this.canPlace(it.id, it.c, it.r, it.rot);
      h.items = prev;
      if (ok) keep.push(it);
      else { h.storage[it.id] = (h.storage[it.id] || 0) + 1; moved++; }
    }
    h.items = keep;
    if (moved && tell) this.game.ui.toast(`${moved === 1 ? 'One piece' : `${moved} pieces`} of yard furniture went into storage`, 'warn', 'crate');
  }

  syncItems(drop = null) {
    const live = new Set(this.home.items);
    for (const [it, g] of this.itemObjs) {
      if (live.has(it)) continue;
      this.root.remove(g);
      disposeObject(g);
      this.itemObjs.delete(it);
    }
    for (const it of this.home.items) {
      let g = this.itemObjs.get(it);
      if (!g) {
        g = itemModel(it.id);
        this.root.add(g);
        this.itemObjs.set(it, g);
      }
      const q = itemRect(it);
      g.position.set((q.x0 + q.x1) / 2, 0, (q.z0 + q.z1) / 2);
      g.rotation.y = -it.rot * (PI / 2);
      if (it === drop) this.dropIn(g, g.position.x, g.position.z);
    }
    this.refreshObstacles();
    for (const p of this.pets || []) this.unstick(p);
    if (this.chef) pushOut(this.obstacles, this.chef, 0.25);
  }

  // Grid squares shown while placing: one instanced tile per free cell
  makeOverlay() {
    const g = new THREE.Group();
    g.visible = false;
    const tileGeo = new THREE.PlaneGeometry(0.9, 0.9);
    tileGeo.rotateX(-PI / 2);
    const tileMat = new THREE.MeshBasicMaterial({ color: '#8dffa8', transparent: true, opacity: 0.32, depthWrite: false });
    const tiles = new THREE.InstancedMesh(tileGeo, tileMat, GRID.cols * GRID.rows);
    tiles.renderOrder = 2;
    g.add(tiles);
    // Footprint: a soft fill with a bright border (four strips, resized in showFoot)
    const footGeo = new THREE.PlaneGeometry(1, 1);
    footGeo.rotateX(-PI / 2);
    const footMat = new THREE.MeshBasicMaterial({ color: '#3fd46a', transparent: true, opacity: 0.35, depthWrite: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color: '#3fd46a', transparent: true, opacity: 0.95, depthWrite: false });
    const foot = new THREE.Group();
    const fill = new THREE.Mesh(footGeo, footMat);
    fill.renderOrder = 3;
    foot.add(fill);
    const edges = [0, 1, 2, 3].map(() => {
      const e = new THREE.Mesh(footGeo, edgeMat);
      e.renderOrder = 4;
      foot.add(e);
      return e;
    });
    g.add(foot);
    // A bobbing gold arrow over the selected piece
    const markMat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
    const markGeo = new THREE.ConeGeometry(0.3, 0.5, 4);
    markGeo.rotateX(PI);
    const marker = new THREE.Mesh(markGeo, markMat);
    marker.visible = false;
    g.add(marker);
    this.own.push(tileGeo, tileMat, footGeo, footMat, edgeMat, markMat, markGeo);
    g.userData = { tiles, foot, fill, edges, marker };
    return g;
  }

  refreshOverlay() {
    const { tiles } = this.overlay.userData;
    const P0 = this.placing;
    const m = new THREE.Matrix4();
    let n = 0;
    for (let r = 0; r < GRID.rows; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        if (!this.canPlace('flamingos', c, r, 0, P0?.from ?? null)) continue;
        m.makeTranslation(GRID.x0 + c + 0.5, 0.035, GRID.z0 + r + 0.5);
        tiles.setMatrixAt(n++, m);
      }
    }
    tiles.count = n;
    tiles.instanceMatrix.needsUpdate = true;
  }

  // Footprint highlight under the piece being placed (green / red) or the selected piece (gold)
  showFoot(it, col) {
    const { foot, fill, edges } = this.overlay.userData;
    const q = itemRect(it), w = q.x1 - q.x0 - 0.06, d = q.z1 - q.z0 - 0.06, t = 0.07;
    foot.position.set((q.x0 + q.x1) / 2, 0.045, (q.z0 + q.z1) / 2);
    fill.scale.set(w, 1, d);
    edges[0].scale.set(w, 1, t); edges[0].position.set(0, 0.002, -d / 2 + t / 2);
    edges[1].scale.set(w, 1, t); edges[1].position.set(0, 0.002, d / 2 - t / 2);
    edges[2].scale.set(t, 1, d); edges[2].position.set(-w / 2 + t / 2, 0.002, 0);
    edges[3].scale.set(t, 1, d); edges[3].position.set(w / 2 - t / 2, 0.002, 0);
    fill.material.color.set(col);
    edges[0].material.color.set(col);
    foot.visible = true;
  }

  // The chef stops using (or walking over to) a piece that is being moved, turned, stored or sold
  releaseChef(it) {
    const c = this.chef;
    if (!c || !it) return;
    if (c.pending?.it === it) { c.pending = null; c.state = 'idle'; c.timer = 1; }
    if (c.use?.it === it) this.endUse(c, true);
  }

  // Start placing: a new piece from the shop, one from storage, or (from) a placed one being moved
  startPlacing(id, { stored = false, from = null } = {}) {
    const D = HOME_ITEMS[id];
    if (!D || !this._active) return;
    this.releaseChef(from);
    if (this.placing) this.cancelPlacing(true);
    if (!stored && !from && !this.canAfford(D.price)) return;
    this.sel = null;
    const rot = from ? from.rot : 0;
    const r = this.game.renderer;
    const mid = r.screenToGround(r.width / 2, r.height * 0.4);
    const near = from ? { x: (itemRect(from).x0 + itemRect(from).x1) / 2, z: (itemRect(from).z0 + itemRect(from).z1) / 2 }
      : mid ? { x: mid.x - OX, z: mid.z - OZ } : { x: -3, z: 3 };
    const spot = from ? { c: from.c, r: from.r } : this.nearestFree(id, rot, near.x, near.z);
    if (!spot) {
      this.game.ui.toast('The yard is full. Store or sell something first', 'warn', 'crate');
      this.game.audio.error?.();
      return;
    }
    const ghost = from ? this.itemObjs.get(from) : itemModel(id);
    if (!from) this.root.add(ghost);
    this.placing = { id, rot, c: spot.c, r: spot.r, from, stored, ghost, ok: true, lift: 0 };
    if (from) this.refreshObstacles();
    this.game.audio.click?.();
    this.overlay.visible = true;
    this.overlay.userData.marker.visible = false;
    this.refreshOverlay();
    this.movePlacing(spot.c, spot.r);
    this.panel.render();
  }

  movePlacing(c, r) {
    const P0 = this.placing;
    const [w, d] = footprint(P0.id, P0.rot);
    P0.c = clamp(c, 0, GRID.cols - w);
    P0.r = clamp(r, 0, GRID.rows - d);
    P0.ok = this.canPlace(P0.id, P0.c, P0.r, P0.rot, P0.from);
    const q = cellRect(P0.c, P0.r, w, d);
    P0.ghost.position.x = (q.x0 + q.x1) / 2;
    P0.ghost.position.z = (q.z0 + q.z1) / 2;
    P0.ghost.rotation.y = -P0.rot * (PI / 2);
    this.showFoot({ id: P0.id, c: P0.c, r: P0.r, rot: P0.rot }, P0.ok ? '#3fd46a' : '#ff4a4a');
    this.panel.renderTools();
  }

  // Follow a ground point with the piece's centre
  aimPlacing(x, z) {
    const P0 = this.placing;
    const [w, d] = footprint(P0.id, P0.rot);
    const c = Math.round(x - GRID.x0 - w / 2), r = Math.round(z - GRID.z0 - d / 2);
    if (c !== P0.c || r !== P0.r) this.movePlacing(c, r);
  }

  rotatePlacing() {
    const P0 = this.placing;
    if (!P0) return;
    const [w, d] = footprint(P0.id, P0.rot);
    const cx = P0.c + w / 2, cz = P0.r + d / 2;
    P0.rot = (P0.rot + 1) % 4;
    this.game.audio.click?.();
    this.movePlacing(Math.round(cx - d / 2), Math.round(cz - w / 2));
  }

  commitPlacing() {
    const P0 = this.placing, h = this.home;
    if (!P0) return;
    if (!P0.ok) {
      this.game.audio.error?.();
      this.game.ui.toast('That spot is taken. Try a green square', 'warn', 'crate');
      return;
    }
    const D = HOME_ITEMS[P0.id];
    if (P0.from) {
      Object.assign(P0.from, { c: P0.c, r: P0.r, rot: P0.rot });
      P0.ghost.position.y = 0;
      this.placing = null;
      this.syncItems();
      this.fx('dust', P0.ghost.position.x, P0.ghost.position.z, 6);
      this.game.audio.place?.();
    } else {
      if (P0.stored) {
        if (!h.storage[P0.id]) { this.cancelPlacing(); return; }
        h.storage[P0.id]--;
        if (!h.storage[P0.id]) delete h.storage[P0.id];
      } else if (!this.game.spend(D.price)) {
        this.canAfford(D.price);
        return;
      }
      const it = { id: P0.id, c: P0.c, r: P0.r, rot: P0.rot };
      // a crop taken out of storage has to grow back first, so storing it can't reset the daily pick
      if (P0.stored && HARVEST[P0.id]) it.picked = this.game.state.day;
      h.items.push(it);
      this.root.remove(P0.ghost);
      disposeObject(P0.ghost);
      this.placing = null;
      this.syncItems(it);
      this.game.audio.place?.();
      if (!P0.stored) this.game.ui.toast(`${D.name} added to the yard`, 'good', 'home');
    }
    this.overlay.visible = false;
    this.afterPurchase();
  }

  cancelPlacing(silent = false) {
    const P0 = this.placing;
    if (!P0) return;
    this.placing = null;
    if (P0.from) {
      P0.ghost.position.y = 0;
      this.syncItems();
    } else {
      this.root.remove(P0.ghost);
      disposeObject(P0.ghost);
    }
    if (this.overlay) this.overlay.visible = false;
    if (!silent) {
      this.game.audio.click?.();
      this.panel.render();
    }
  }

  select(it) {
    if (this.placing) this.cancelPlacing(true);
    this.sel = it;
    this.overlay.visible = !!it;
    const { tiles, marker } = this.overlay.userData;
    marker.visible = !!it;
    if (it) {
      tiles.count = 0;
      this.showFoot(it, '#ffd23f');
      const g = this.itemObjs.get(it);
      if (g) {
        g.userData.wob = 1;
        g.userData.top ??= new THREE.Box3().setFromObject(g).max.y;
      }
    }
    this.game.audio.click?.();
    this.panel.render();
  }

  rotateItem(it) {
    this.releaseChef(it);
    const [w, d] = footprint(it.id, it.rot), rot = (it.rot + 1) % 4;
    const cx = it.c + w / 2, cz = it.r + d / 2;
    const tries = [[Math.round(cx - d / 2), Math.round(cz - w / 2)], [Math.floor(cx - d / 2), Math.floor(cz - w / 2)], [Math.ceil(cx - d / 2), Math.ceil(cz - w / 2)], [it.c, it.r]];
    const spot = tries.find(([c, r]) => this.canPlace(it.id, c, r, rot, it));
    if (!spot) {
      this.game.audio.error?.();
      this.game.ui.toast('No room to turn it here. Move it first', 'warn', 'rotate');
      return;
    }
    Object.assign(it, { c: spot[0], r: spot[1], rot });
    this.syncItems();
    const g = this.itemObjs.get(it);
    if (g) g.userData.wob = 1;
    this.showFoot(it, '#ffd23f');
    this.game.audio.click?.();
    this.game.save();
  }

  storeItem(it) {
    const h = this.home;
    this.releaseChef(it);
    h.items = h.items.filter((x) => x !== it);
    h.storage[it.id] = (h.storage[it.id] || 0) + 1;
    const q = itemRect(it);
    this.fx('poof', (q.x0 + q.x1) / 2, 0.5, (q.z0 + q.z1) / 2, '#ffffff', 14);
    this.sel = null;
    this.overlay.visible = false;
    this.syncItems();
    this.game.audio.swoosh?.();
    this.game.ui.toast(`${HOME_ITEMS[it.id].name} put in storage`, 'info', 'crate');
    this.afterPurchase();
  }

  sellItem(it) {
    const h = this.home, D = HOME_ITEMS[it.id];
    this.releaseChef(it);
    const back = Math.round(D.price * ECON.sellRefund);
    h.items = h.items.filter((x) => x !== it);
    const q = itemRect(it);
    this.fx('poof', (q.x0 + q.x1) / 2, 0.5, (q.z0 + q.z1) / 2, '#ffffff', 14);
    this.sel = null;
    this.overlay.visible = false;
    this.syncItems();
    this.game.addCash(back, OX + (q.x0 + q.x1) / 2, 1.2, OZ + (q.z0 + q.z1) / 2);
    this.game.audio.sell?.();
    this.afterPurchase();
  }

  sellStored(id) {
    const h = this.home, D = HOME_ITEMS[id];
    if (!h.storage[id]) return;
    h.storage[id]--;
    if (!h.storage[id]) delete h.storage[id];
    const back = Math.round(D.price * ECON.sellRefund);
    this.game.addCash(back);
    this.game.audio.sell?.();
    this.game.ui.toast(`Sold the ${D.name} for ${formatMoney(back)}`, 'good', 'coin');
    this.afterPurchase();
  }

  // Shop and storage cards
  itemCard(id) {
    const h = this.home;
    if (h.storage[id]) { this.startPlacing(id, { stored: true }); return; }
    this.startPlacing(id);
  }

  // Favourite on the turntable, then the rest by price (fanciest nearest the street)
  carOrder() {
    const h = this.home;
    const rest = h.cars.filter((id) => id !== h.favCar).sort((a, b) => CARS[b].price - CARS[a].price);
    return h.favCar ? [h.favCar, ...rest] : rest;
  }

  syncCars(animate = true) {
    const order = this.carOrder();
    order.forEach((id, i) => {
      const s = SPOTS[i] ?? SPOTS[SPOTS.length - 1];
      let c = this.carObjs.get(id);
      if (!c) {
        const g = buildLuxuryCar(id, this.home.carPaint[id]);
        const [w, l] = CAR_SIZE[id] ?? [1.05, 2.15];
        const blob = makeBlobShadow(1);
        blob.scale.set(w * 1.35, 1, l * 1.1);
        g.add(blob);
        c = { id, g, x: s.x, z: s.z, rot: 0, hop: null, bounce: 0 };
        g.position.set(s.x, s.turn ? 0.13 : 0, s.z);
        this.root.add(g);
        this.carObjs.set(id, c);
        if (animate) this.dropIn(g, s.x, s.z, s.turn ? 0.13 : 0, () => { this.game.audio.honk?.(); });
      } else if (c.spot !== i) {
        c.hop = { t: 0, x0: c.g.position.x, z0: c.g.position.z, r0: wrapAngle(c.g.rotation.y) };
      }
      c.spot = i;
      c.x = s.x;
      c.z = s.z;
    });
  }

  syncPets(animate = true) {
    const want = this.home.pets;
    while (this.pets.length < want.length) {
      const id = want[this.pets.length];
      const p = this.makePet(id, this.pets.length);
      this.pets.push(p);
      if (animate) {
        const sp = this.freeSpot(YARD, 0.4, this.chef ? { x: this.chef.x, z: this.chef.z + 0.8 } : null);
        p.x = sp.x;
        p.z = sp.z;
        p.y = 1.2;
        p.vy = 2;
        this.fx('poof', p.x, 0.4, p.z, '#ffffff', 14);
        this.fx('confetti', p.x, 1.2, p.z, 30);
        this.setPetState(p, 'happy', 1.6);
        this.emote(p, 'heart');
      }
    }
  }

  makePet(id, idx) {
    const m = buildPet(id);
    const sp = this.freeSpot(YARD, 0.4);
    const p = {
      id, idx, def: PETS[id], m, x: sp.x, z: sp.z, y: 0, vy: 0, face: rand(-PI, PI), dir: 0, v: 0, phase: rand(0, 10), t: rand(0, 10),
      state: 'idle', timer: rand(0.5, 3), tx: 0, tz: 0, wag: 1, hopT: 0,
    };
    p.dir = p.face;
    m.root.position.set(p.x, 0, p.z);
    this.root.add(m.root);
    return p;
  }

  makeChef() {
    const g = this.game;
    const look = g.player?.look ?? playerLook(g.settings?.color);
    const m = buildCharacter(look);
    m.root.rotation.order = 'YXZ';
    const c = { m, x: SITE.x + 0.6, z: 1.0, face: 0.4, dir: 0.4, v: 0, phase: 0, t: 0, state: 'idle', timer: 1.5, tx: 0, tz: 0, blink: 2, target: null, pending: null, use: null };
    m.root.position.set(c.x, 0, c.z);
    this.root.add(m.root);
    return c;
  }

  freeSpot(area, pad, near = null) {
    for (let i = 0; i < 40; i++) {
      const x = near && i < 20 ? near.x + rand(-1.2, 1.2) : rand(area.x0, area.x1);
      const z = near && i < 20 ? near.z + rand(-1, 1) : rand(area.z0, area.z1);
      if (x < area.x0 || x > area.x1 || z < area.z0 || z > area.z1) continue;
      if (!blocked(this.obstacles, x, z, pad)) return { x, z };
    }
    return { x: (area.x0 + area.x1) / 2, z: area.z1 - 0.3 };
  }

  unstick(p) {
    if (blocked(this.obstacles, p.x, p.z, 0.3)) {
      const s = this.freeSpot(YARD, 0.4);
      p.x = s.x;
      p.z = s.z;
      this.fx('poof', p.x, 0.3, p.z, '#ffffff', 8);
    }
  }

  // purchases
  confirmBuy(price, title, text, ok, run) {
    if (price >= 2000) this.game.ui.confirm(title, text, ok, run);
    else run();
  }

  canAfford(price) {
    if (this.game.state.cash >= price) return true;
    this.game.ui.toast(`You need ${formatMoney(price)} for that`, 'warn', 'coin');
    this.game.audio.error?.();
    return false;
  }

  afterPurchase() {
    this.game.save();
    if (typeof this.game.updateAmbience === 'function') this.game.updateAmbience(true);
    this.panel.render();
  }

  buyTier(id) {
    const T = HOME_TIERS[id], h = this.home;
    if (!T || T.level <= h.tier) { this.game.audio.click?.(); return; }
    if (T.level > h.tier + 1) {
      this.game.ui.toast(`Move into the ${HOME_TIERS[TIER_IDS[T.level - 1]].name} first`, 'warn', 'lock');
      this.game.audio.error?.();
      return;
    }
    if (!this.canAfford(T.price)) return;
    const cur = HOME_TIERS[TIER_IDS[h.tier]];
    this.confirmBuy(T.price, `Move into the ${T.name}?`, `It replaces your ${cur.name}. Your pets and cars come along.`, `Buy for ${formatMoney(T.price)}`, () => {
      if (!this._active || h.tier !== T.level - 1 || !this.game.spend(T.price)) return;
      h.tier = T.level;
      h.paint = { wall: null, roof: null };
      this.setTier(h.tier, true);
      this.game.audio.levelUp?.();
      this.game.ui.toast(`Welcome home to your ${T.name}!`, 'gold', 'home');
      this.chefCheer();
      this.afterPurchase();
    });
  }

  adoptPet(id) {
    const D = PETS[id], h = this.home;
    if (!D) return;
    const n = h.pets.filter((p) => p === id).length;
    if (n >= PET_LIMITS.same || h.pets.length >= PET_LIMITS.total) {
      this.game.ui.toast(n >= PET_LIMITS.same ? `You already have ${PET_LIMITS.same} of those` : 'The yard is full of pets already', 'warn', 'paw');
      this.game.audio.error?.();
      return;
    }
    if (!this.canAfford(D.price)) return;
    this.confirmBuy(D.price, `Adopt the ${D.name}?`, D.desc, `Adopt for ${formatMoney(D.price)}`, () => {
      if (!this._active || !this.game.spend(D.price)) return;
      h.care.push({ name: newPetName(h), joy: 90, pats: 0 });
      h.pets.push(id);
      this.syncPets(true);
      this.game.audio.happy?.();
      const bonus = h.pets.length === PET_BONUS.count ? ` Pet lover bonus: ${perkText(PET_BONUS.perk)}.` : '';
      this.game.ui.toast(`${h.care[h.care.length - 1].name} the ${D.name.toLowerCase()} joined the family!${bonus}`, 'good', 'paw');
      this.afterPurchase();
    });
  }

  carClick(id) {
    const D = CARS[id], h = this.home;
    if (!D) return;
    if (h.cars.includes(id)) {
      if (h.favCar === id) { this.game.audio.click?.(); this.honkCar(id); return; }
      h.favCar = id;
      this.syncCars(true);
      this.game.audio.click?.();
      this.game.ui.toast(`The ${D.name} is your ride now`, 'good', 'car');
      this.game.save();
      this.panel.render();
      return;
    }
    if (!this.canAfford(D.price)) return;
    this.confirmBuy(D.price, `Buy the ${D.name}?`, `${D.desc} It parks on your drive and becomes your ride.`, `Buy for ${formatMoney(D.price)}`, () => {
      if (!this._active || h.cars.includes(id) || !this.game.spend(D.price)) return;
      h.cars.push(id);
      h.favCar = id;
      this.syncCars(true);
      this.refreshObstacles();
      this.game.audio.levelUp?.();
      this.game.ui.toast(`The ${D.name} is yours!`, D.lux ? 'gold' : 'good', 'car');
      this.afterPurchase();
    });
  }

  // paint jobs
  paintHouse(part, col) {
    const h = this.home;
    if (!['wall', 'roof'].includes(part) || (col && !PAINT[part].includes(col))) return;
    if ((h.paint[part] ?? null) === (col ?? null)) { this.game.audio.click?.(); return; }
    const price = col ? PAINT.house : 0;
    if (price && !this.canAfford(price)) return;
    if (price && !this.game.spend(price)) return;
    h.paint[part] = col;
    this.setTier(h.tier, 'paint');
    this.game.audio.place?.();
    this.afterPurchase();
  }

  setFence(id) {
    const h = this.home;
    if (id && !FENCES[id]) return;
    if ((h.fence ?? null) === (id ?? null)) { this.game.audio.click?.(); return; }
    if (id && !this.canAfford(FENCE_PRICE)) return;
    if (id && !this.game.spend(FENCE_PRICE)) return;
    h.fence = id;
    this.setTier(h.tier, 'paint');
    this.game.audio.place?.();
    this.afterPurchase();
  }

  paintCar(col) {
    const h = this.home, id = h.favCar;
    if (!id || (col && !PAINT.car.includes(col))) return;
    if ((h.carPaint[id] ?? null) === (col ?? null)) { this.game.audio.click?.(); return; }
    const price = col ? PAINT.carPrice : 0;
    if (price && !this.canAfford(price)) return;
    if (price && !this.game.spend(price)) return;
    if (col) h.carPaint[id] = col;
    else delete h.carPaint[id];
    const c = this.carObjs.get(id);
    if (c) {
      const rot = c.g.rotation.y;
      this.root.remove(c.g);
      disposeObject(c.g);
      this.carObjs.delete(id);
      this.syncCars(false);
      const n = this.carObjs.get(id);
      n.g.rotation.y = rot;
      n.bounce = 1;
      this.fx('confetti', n.g.position.x, 1.6, n.g.position.z, 40, col ? [col, '#ffffff'] : undefined);
      for (let i = 0; i < 3; i++) this.fx('splash', n.g.position.x + rand(-0.6, 0.6), 0.7, n.g.position.z + rand(-1, 1), 5);
    }
    this.game.audio.place?.();
    if (typeof this.game.syncParkedCar === 'function') this.game.syncParkedCar();
    this.afterPurchase();
  }

  // pet care
  petJoy(i, n) {
    const c = this.home.care[i];
    if (!c) return;
    const was = c.joy >= PET_CARE.happy;
    c.joy = clamp(c.joy + n, 0, 100);
    if (!was && c.joy >= PET_CARE.happy) {
      this.game.ui.toast(`${c.name} is happy again`, 'good', 'heart');
      if (typeof this.game.updateAmbience === 'function') this.game.updateAmbience(true);
    }
  }

  treatPet(i) {
    const h = this.home, c = h.care[i], p = this.pets[i];
    if (!c || !p) return;
    if (c.joy >= 100) {
      this.game.ui.toast(`${c.name} is as happy as can be`, 'info', 'heart');
      this.game.audio.click?.();
      return;
    }
    if (!this.canAfford(PET_CARE.treat) || !this.game.spend(PET_CARE.treat)) return;
    this.petJoy(i, PET_CARE.treatJoy);
    this.setPetState(p, 'eat', 2.4);
    p.vy = 2.2;
    this.emote(p, 'heart');
    this.fx('confetti', p.x, 0.9, p.z, 16);
    this.game.audio.munch?.();
    if (this.chef) this.chefVisit(p);
    this.afterPurchase();
  }

  // Pet furniture this pet can use: where to stand and what to do there
  petSpots(p) {
    const out = [];
    const ACT = { foodbowls: 'eat', petbed: 'nap', doghouse: 'nap', agility: 'zoom', cattree: 'sit', birdhouse: 'sit', hutch: 'nap', kiddiepool: 'sit' };
    for (const it of this.home.items) {
      const D = HOME_ITEMS[it.id], act = ACT[it.id];
      if (!D.pet || !act) continue;
      if (it.id === 'cattree' && p.def.style !== 'cat') continue;
      if (it.id === 'birdhouse' && p.def.style !== 'bird') continue;
      if (it.id === 'hutch' && p.def.style !== 'hop') continue;
      if (it.id === 'kiddiepool' && p.def.style !== 'dog' && p.def.style !== 'pig') continue;
      if (it.id === 'agility' && p.def.style !== 'dog') continue;
      const q = itemRect(it), cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
      // beds and pools are climbed into, bowls are eaten from just in front; the rest are used from
      // the front, or failing that from whichever side is open
      const [w, d] = D.size;
      const inside = it.id === 'petbed' || it.id === 'kiddiepool';
      const sides = inside ? [[0, 0]] : it.id === 'foodbowls' ? [[0, 0.48]] : [[0, d / 2 + 0.4], [-(w / 2 + 0.4), 0], [w / 2 + 0.4, 0], [0, -(d / 2 + 0.4)]];
      for (const [lx, lz] of sides) {
        const p = this.itemPoint(it, lx, lz);
        if (p.x < YARD.x0 || p.x > YARD.x1 || p.z < YARD.z0 || p.z > YARD.z1 || (!inside && blocked(this.obstacles, p.x, p.z, 0.2))) continue;
        out.push({ x: p.x, z: p.z, act, cx, cz, it });
        break;
      }
    }
    return out;
  }

  // little effects
  fx(name, x, ...a) {
    const p = this.game.particles;
    if (name === 'dust') p.dust(OX + x, OZ + a[0], a[1], a[2]);
    else p[name](OX + x, a[0], OZ + a[1], ...a.slice(2));
  }

  emote(p, ic, mood = 'love') {
    this.game.particles.emote(OX + p.x, (p.m.by || 0.3) + 0.75, OZ + p.z, icon(ic), mood);
  }

  tween(dur, fn, done) { this.anims.push({ t: 0, dur, fn, done }); }

  dropIn(g, x, z, y0 = 0, done = null) {
    g.position.set(x, 7, z);
    this.tween(0.75, (k) => {
      const b = k < 0.7 ? (k / 0.7) ** 2 : 1 - Math.sin(((k - 0.7) / 0.3) * PI) * 0.12;
      g.position.y = y0 + (1 - b) * 7;
    }, () => {
      g.position.y = y0;
      this.fx('dust', x, z, 10);
      this.fx('confetti', x, 1.6, z, 36);
      done?.();
    });
  }

  honkCar(id) {
    const c = this.carObjs.get(id);
    if (!c) return;
    c.bounce = 1;
    this.game.audio.honk?.();
    this.fx('sparkle', c.g.position.x, 0.8, c.g.position.z);
  }

  chefCheer() {
    if (!this.chef) return;
    this.chef.state = 'cheer';
    this.chef.timer = 1.6;
  }

  // frame
  update(dt) {
    if (!this._active) return;
    const g = this.game;
    if (g.phase !== this._phase) { this.exit(false); return; }
    this.t += dt;
    this.handleInput(dt);
    this.frameCamera(dt);
    g.renderer.setTimeOfDay(HOME_HOUR, dt);
    this.applySun();
    this.bakeSome();
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.fn(k);
      if (k >= 1) { this.anims.splice(i, 1); a.done?.(); }
    }
    const tc = this.tierObj.userData;
    for (const f of tc.anim) f(this.t, dt);
    if (tc.fire) {
      g.renderer.requestLight(OX + tc.fire.x, 0.6, OZ + tc.fire.z, '#ff9a40', 3.2 + Math.sin(this.t * 17) * 0.5, 4.5, 5);
      if (Math.random() < dt * 4) this.fx('sparks', tc.fire.x, 0.4, tc.fire.z, 1);
      if (Math.random() < dt * 2) this.fx('smoke', tc.fire.x, 0.7, tc.fire.z, 0.2);
    }
    if (tc.chimney && Math.random() < dt * 2.5) this.fx('smoke', tc.chimney.x, tc.chimney.y, tc.chimney.z, 0.1);
    if (tc.spray && Math.random() < dt * 14) this.fx('splash', tc.spray.x, 1.85, tc.spray.z, 2);
    for (const l of tc.lights) g.renderer.requestLight(OX + l.x, l.y, OZ + l.z, l.color, l.intensity, l.distance, 4);
    if (waterM?.map) { waterM.map.offset.x = (this.t * 0.02) % 1; waterM.map.offset.y = (this.t * 0.013) % 1; }
    this.updateItems(dt);
    this.updateCars(dt);
    for (const p of this.pets) this.updatePet(p, dt);
    for (const hp of this.helpers) this.updateHelper(hp, dt);
    this.separate();
    this.updateChef(dt);
    this.updateMarks();
  }

  // Furniture animations, lights and little particle effects
  updateItems(dt) {
    const r = this.game.renderer, t = this.t;
    let lights = 0;
    for (const [it, g] of this.itemObjs) {
      const ud = g.userData, D = HOME_ITEMS[it.id];
      const x = g.position.x, z = g.position.z, rot = g.rotation.y;
      const at = (o) => ({ x: x + o.x * Math.cos(rot) + o.z * Math.sin(rot), z: z - o.x * Math.sin(rot) + o.z * Math.cos(rot) });
      ud.animate?.(t + x * 0.37);
      if (ud.sway) ud.sway.rotation.x = Math.sin(t * 1.1 + x) * 0.12;
      if (ud.wob > 0) {
        ud.wob = Math.max(0, ud.wob - dt * 2.5);
        const k = Math.sin(ud.wob * PI * 3) * ud.wob * 0.08;
        g.scale.set(1 - k, 1 + k, 1 - k);
      }
      if (ud.light && lights < 6) {
        lights++;
        const fl = D.fx === 'fire' ? Math.sin(t * 17 + x) * 0.5 : 0;
        r.requestLight(OX + x, ud.light.y, OZ + z, ud.light.color, ud.light.intensity + fl, ud.light.distance, 3);
      }
      if (D.fx === 'fire') {
        if (Math.random() < dt * 4) this.fx('sparks', x, 0.4, z, 1);
        if (Math.random() < dt * 1.5) this.fx('smoke', x, 0.8, z, 0.2);
      } else if (D.fx === 'tub') {
        if (Math.random() < dt * 6) this.fx('bubbles', x + rand(-0.4, 0.4), 0.52, z + rand(-0.4, 0.4), 1);
        if (Math.random() < dt * 2) this.fx('steam', x, 0.6, z, 1.2);
      } else if (D.fx === 'smoke' && Math.random() < dt * 3) {
        const s = ud.smoke ? at(ud.smoke) : { x, z };
        this.fx('steam', s.x, ud.smoke?.y ?? 0.95, s.z, 0.9);
      } else if (D.fx === 'spray' && Math.random() < dt * 10) this.fx('splash', x, ud.spray?.y ?? 1.5, z, 2);
    }
    if (this.sel) {
      const g = this.itemObjs.get(this.sel), mk = this.overlay.userData.marker;
      if (g) {
        mk.position.set(g.position.x, (g.userData.top ?? 1) + 0.45 + Math.abs(Math.sin(t * 4)) * 0.2, g.position.z);
        mk.rotation.y = t * 2;
      }
    }
    const P0 = this.placing;
    if (P0) {
      P0.lift = damp(P0.lift, 1, 10, dt);
      P0.ghost.position.y = P0.lift * (0.18 + Math.sin(t * 5) * 0.05);
    }
  }

  // Placing furniture: the piece follows the pointer (or the last tap), a click/tap places it
  handlePlacing(input, tap) {
    const r = this.game.renderer, P0 = this.placing;
    if (input.wasPressed('KeyR')) this.rotatePlacing();
    if (input.wasPressed('Escape')) { this.cancelPlacing(); return; }
    if (!this.placing) return;
    // Follow the mouse while it is over the yard (not over the dock)
    const hx = input.hover.x, hy = input.hover.y;
    if (!input.touchMode && !input.dragging && (hx !== P0.hx || hy !== P0.hy)) {
      P0.hx = hx;
      P0.hy = hy;
      const p = document.elementFromPoint(hx, hy) === this.game.canvas ? r.screenToGround(hx, hy) : null;
      if (p) this.aimPlacing(p.x - OX, p.z - OZ);
    }
    if (tap) {
      const p = r.screenToGround(tap.x, tap.y);
      if (!p) return;
      const before = `${P0.c},${P0.r}`;
      this.aimPlacing(p.x - OX, p.z - OZ);
      // On touch the first tap moves the piece and a tap on it (or the Place button) sets it down
      if (!input.touchMode || before === `${P0.c},${P0.r}`) this.commitPlacing();
    }
  }

  // The yard item under a screen point (by its footprint on the ground)
  itemAt(sx, sy) {
    const p = this.game.renderer.screenToGround(sx, sy);
    if (!p) return null;
    const x = p.x - OX, z = p.z - OZ;
    for (const it of this.home.items) {
      const q = itemRect(it, -0.1);
      if (x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1) return it;
    }
    return null;
  }

  handleInput(dt) {
    const g = this.game, input = g.input, r = g.renderer;
    if (g.ui.modalOpen) return;
    if (input.wheel) this.zoom = clamp(this.zoom * (input.wheel > 0 ? 1.08 : 1 / 1.08), 0.55, 1.5);
    if (input.pinch !== 1) this.zoom = clamp(this.zoom * input.pinch, 0.5, 1.6);
    const mv = input.moveVector();
    const yaw = r.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const upp = r.viewSize / Math.max(1, r.height);
    const gx = -input.dragX * upp, gy = (input.dragY * upp) / Math.sin(CAMERA.elevation);
    this.pan.x = clamp(this.pan.x + (rx * mv.x + fx * mv.y) * dt * 8 + rx * gx + fx * gy, -9, 9);
    this.pan.z = clamp(this.pan.z + (rz * mv.x + fz * mv.y) * dt * 8 + rz * gx + fz * gy, -7, 7);
    const tap = input.tap && input.tap.button === 0 ? input.tap : null;
    if (input.tap && input.tap.button === 2 && this.placing) { this.cancelPlacing(); return; }
    if (this.placing) { this.handlePlacing(input, tap); return; }
    if (this.sel) {
      if (input.wasPressed('Escape')) { this.select(null); return; }
      if (input.wasPressed('KeyR')) this.rotateItem(this.sel);
      if (input.wasPressed('KeyM')) { this.startPlacing(this.sel.id, { from: this.sel }); return; }
    }
    if (tap) {
      const hit = this.pick(tap.x, tap.y, tap.touch ? 56 : 42);
      const it = hit ? null : this.itemAt(tap.x, tap.y);
      if (hit?.pet) this.petTapped(hit.pet);
      else if (hit?.car) this.honkCar(hit.car.id);
      else if (hit?.mail) this.goToMail();
      else if (it && (this.panel.tab === 'yard' || this.sel)) this.select(it === this.sel ? null : it);
      else if (it) this.chefUse(it);
      else if (this.sel) this.select(null);
      else {
        const p = r.screenToGround(tap.x, tap.y);
        if (p) this.chefGoTo(p.x - OX, p.z - OZ, true);
      }
    }
    if (!input.touchMode) {
      const hov = input.dragging ? null : this.pick(input.hover.x, input.hover.y, 42) || this.itemAt(input.hover.x, input.hover.y);
      const cur = hov ? 'pointer' : '';
      if (g.canvas.style.cursor !== cur) g.canvas.style.cursor = cur;
    }
  }

  pick(sx, sy, radius) {
    const r = this.game.renderer;
    let best = null, bd = radius;
    for (const p of this.pets) {
      const s = r.project(OX + p.x, p.y + (p.m.by || 0.2) + 0.15, OZ + p.z);
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d < bd) { bd = d; best = { pet: p }; }
    }
    for (const c of this.carObjs.values()) {
      const s = r.project(OX + c.g.position.x, 0.5, OZ + c.g.position.z);
      const d = Math.hypot(s.x - sx, s.y - sy) * 0.8;
      if (d < bd) { bd = d; best = { car: c }; }
    }
    const mb = r.project(OX + MAILBOX.x, 0.9, OZ + MAILBOX.z);
    if (Math.hypot(mb.x - sx, mb.y - sy) < bd) best = { mail: true };
    return best;
  }

  petTapped(p) {
    this.setPetState(p, 'happy', 1.4);
    p.vy = 2.6;
    this.emote(p, 'heart');
    this.game.audio.happy?.();
    const c = this.home.care[p.idx];
    if (c && c.pats < PET_CARE.pats) {
      c.pats++;
      this.petJoy(p.idx, PET_CARE.pat);
      this.panel.renderSoon();
    }
    if (this.chef && Math.hypot(this.chef.x - p.x, this.chef.z - p.z) > 1) this.chefVisit(p);
  }

  // Fit the plot above the dock, plus the player's pan & zoom (same isometric camera as the restaurant)
  frameCamera(dt) {
    const r = this.game.renderer;
    const aspect = r.width / Math.max(1, r.height);
    const dir = _v.set(Math.sin(CAMERA.yaw) * Math.cos(CAMERA.elevation), Math.sin(CAMERA.elevation), Math.cos(CAMERA.yaw) * Math.cos(CAMERA.elevation));
    const right = _r.crossVectors(UP, dir).normalize();
    const camUp = _u.crossVectors(dir, right).normalize();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    // On the Yard tab (and while placing) the camera moves in on the front yard
    const yard = !!(this.placing || this.sel || this.panel.tab === 'yard');
    const top = yard ? 1.2 : [1.8, 2.6, 3.6, 3.6, 4.6][this.home.tier];
    const xs = yard ? [-9.2, 6.4] : [-8.8, 9.2], zs = yard ? [-1.2, 6.3] : [-5.6, 6.2];
    for (const x of xs) for (const z of zs) for (const y of [0, top]) {
      _w.set(x, y, z);
      const px = _w.dot(right), py = _w.dot(camUp);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    const fit = Math.max(maxY - minY, (maxX - minX) / aspect) * 1.02;
    const fb = this.panel.fraction(), ft = this.panel.topFraction();
    const view = clamp((fit / (1 - (fb + ft) * 0.85)) * this.zoom * ZOOM, 6, 24 / Math.min(1, aspect));
    r.targetView = view;
    const shift = (((fb - ft) / 2) * view) / Math.sin(CAMERA.elevation);
    // the ground point under the middle of the box's projection
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const a = right.x, b = right.z, c2 = camUp.x, d = camUp.z, det = a * d - b * c2;
    const gx = (cx * d - b * cy) / det, gz = (a * cy - c2 * cx) / det;
    r.setCameraTarget(OX + gx + this.pan.x + Math.sin(CAMERA.yaw) * shift, OZ + gz + this.pan.z + Math.cos(CAMERA.yaw) * shift);
    if (dt === 0) r.snapCamera();
  }

  // The sun follows the time of day but aims at the plot, with a shadow box sized to it
  applySun() {
    const r = this.game.renderer;
    _v.subVectors(r.sun.position, r.sun.target.position);
    r.sun.target.position.set(OX, 0, OZ);
    r.sun.position.set(OX + _v.x, _v.y, OZ + _v.z);
    r.fill.intensity = 0;
    const sc0 = r.sun.shadow.camera;
    if (sc0.right !== 15) {
      sc0.left = -15; sc0.right = 15; sc0.top = 15; sc0.bottom = -15;
      sc0.updateProjectionMatrix();
    }
  }

  // A few thumbnails per frame (the open tab's first) so entering home never stalls
  bakeSome() {
    if (!this.thumbQueue?.length) return;
    const t0 = performance.now();
    if (!this.baker) this.baker = new ThumbnailBaker(128);
    const want = { house: ['tier:', 'helper:'], yard: ['item:'], pets: ['pet:'], garage: ['car:'] }[this.panel.tab] || [];
    if (this._bakeTab !== this.panel.tab) {
      this._bakeTab = this.panel.tab;
      this.thumbQueue.sort((a, b) => (want.some((w) => b[0].startsWith(w)) ? 1 : 0) - (want.some((w) => a[0].startsWith(w)) ? 1 : 0));
    }
    while (this.thumbQueue.length && performance.now() - t0 < 7) {
      const [key, make, opts] = this.thumbQueue.shift();
      try {
        THUMBS[key] = this.baker.bake(make(), opts);
        this.panel.setThumb(key, THUMBS[key]);
      } catch (e) {
        console.warn('home thumbnail failed', key, e);
      }
    }
    if (!this.thumbQueue.length) { this.baker.dispose(); this.baker = null; }
  }

  // cars
  updateCars(dt) {
    const turn = this.home.favCar;
    const plate = this.tt.userData.plate;
    if (turn) plate.rotation.y += dt * 0.45;
    for (const c of this.carObjs.values()) {
      const g = c.g;
      const onTurn = c.spot === 0 && SPOTS[0].turn;
      if (c.hop) {
        c.hop.t = Math.min(1, c.hop.t + dt / 0.8);
        const k = c.hop.t, e = k * k * (3 - 2 * k);
        g.position.x = c.hop.x0 + (c.x - c.hop.x0) * e;
        g.position.z = c.hop.z0 + (c.z - c.hop.z0) * e;
        g.position.y = Math.sin(k * PI) * 1.4 + (onTurn ? 0.13 * k : 0);
        g.rotation.y = onTurn ? c.hop.r0 + wrapAngle(plate.rotation.y - c.hop.r0) * e : c.hop.r0 * (1 - e);
        if (k >= 1) { c.hop = null; this.fx('dust', c.x, c.z, 6); }
      } else if (g.position.y < 2) {
        g.position.x = c.x;
        g.position.z = c.z;
      }
      if (onTurn && !c.hop) g.rotation.y = plate.rotation.y;
      if (c.bounce > 0) {
        c.bounce = Math.max(0, c.bounce - dt * 2.5);
        const s = Math.sin(c.bounce * PI * 3) * c.bounce * 0.08;
        g.scale.set(1 - s, 1 + s, 1 - s);
      }
      if (CARS[c.id].lux && Math.random() < dt * (c.id === 'hypercar' ? 3 : 0.8)) this.fx('sparkle', g.position.x + rand(-0.4, 0.4), 0.6, g.position.z + rand(-0.8, 0.8), c.id === 'hypercar' ? '#fff3a0' : '#ffffff');
    }
  }

  // pets
  setPetState(p, s, timer) {
    p.state = s;
    p.timer = timer;
  }

  pickPetGoal(p, far = 1) {
    const area = p.state === 'follow' ? WALK : YARD;
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU), d = rand(0.8, 3.2) * far;
      const x = clamp(p.x + Math.sin(a) * d, area.x0, area.x1), z = clamp(p.z + Math.cos(a) * d, area.z0, area.z1);
      if (!blocked(this.obstacles, x, z, 0.3) && pathClear(this.obstacles, p.x, p.z, x, z, 0.2)) { p.tx = x; p.tz = z; return true; }
    }
    return false;
  }

  nextPetState(p) {
    const st = p.def.style, r = Math.random();
    const chef = this.chef;
    const sad = (this.home.care[p.idx]?.joy ?? 80) < PET_CARE.happy;
    if (sad && r < 0.45) return this.setPetState(p, Math.random() < 0.5 ? 'nap' : 'sit', rand(3, 6));
    if (Math.random() < 0.3) {
      const spots = this.petSpots(p);
      if (spots.length) {
        const s = pick(spots);
        if (pathClear(this.obstacles, p.x, p.z, s.x, s.z, 0.15)) {
          p.tx = s.x;
          p.tz = s.z;
          p.visit = s.act;
          p.visitAt = { x: s.cx, z: s.cz };
          p.flying = false;
          return this.setPetState(p, 'walk', 9);
        }
      }
    }
    if (st === 'dog' && chef && r < 0.22) return this.setPetState(p, 'follow', rand(5, 10));
    if (r < 0.5) {
      if (this.pickPetGoal(p, st === 'bird' && Math.random() < 0.4 ? 2 : 1)) {
        p.flyD = Math.hypot(p.tx - p.x, p.tz - p.z);
        p.flying = st === 'bird' && p.flyD > 2.6;
        return this.setPetState(p, 'walk', 8);
      }
    }
    if ((st === 'cat' || st === 'pig' || st === 'slow') && r < 0.68) return this.setPetState(p, 'nap', rand(4, 8));
    if (r < 0.75) return this.setPetState(p, 'sit', rand(2, 4));
    if (r < 0.9) return this.setPetState(p, 'sniff', rand(1.5, 3));
    if (st === 'dog' && r < 0.97) {
      p.zoomA = Math.atan2(p.x - (YARD.x0 + YARD.x1) / 2, p.z - 3);
      return this.setPetState(p, 'zoom', rand(2, 3.5));
    }
    this.setPetState(p, 'idle', rand(1, 3));
  }

  updatePet(p, dt) {
    const m = p.m, st = p.def.style;
    p.t += dt;
    p.timer -= dt;
    let speed = 0;
    const full = p.def.speed;
    if (p.state === 'walk' || p.state === 'follow' || p.state === 'zoom') {
      let tx = p.tx, tz = p.tz, near = 0.12, run = full;
      if (p.state === 'follow' && this.chef) {
        const c = this.chef;
        tx = c.x - Math.sin(c.face) * 0.9 + Math.sin(p.t * 0.3) * 0.4;
        tz = c.z - Math.cos(c.face) * 0.9;
        near = 0.5;
        run = full * 1.2;
      } else if (p.state === 'zoom') {
        p.zoomA += dt * 2.6;
        const cx = clamp(p.x, YARD.x0 + 1.4, YARD.x1 - 1.4), cz = clamp(p.z, YARD.z0 + 1.2, YARD.z1 - 1.2);
        tx = cx + Math.sin(p.zoomA) * 1.1;
        tz = cz + Math.cos(p.zoomA) * 1.1;
        run = full * 1.6;
        near = 0;
      }
      if (p.flying) run = 2.6;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d > near) {
        p.dir = Math.atan2(dx, dz);
        speed = run * clamp(d / 0.4, 0.3, 1);
      } else if (p.state === 'walk') {
        p.flying = false;
        if (p.visit) {
          // Arrived at a piece of pet furniture
          const act = p.visit;
          p.visit = null;
          if (act === 'zoom') p.zoomA = 0;
          if (act === 'eat' || act === 'sit') p.dir = Math.atan2(p.visitAt.x - p.x, p.visitAt.z - p.z);
          this.setPetState(p, act, act === 'nap' ? rand(5, 9) : rand(2.5, 4));
          if (act === 'eat' || act === 'nap') this.petJoy(p.idx, 1);
        } else this.nextPetState(p);
      }
      if (p.timer <= 0) { p.flying = false; p.visit = null; this.nextPetState(p); }
    } else if (p.timer <= 0) this.nextPetState(p);
    // Hoppers only move while in the air
    if (p.m.hop || st === 'hop') {
      if (speed > 0 || p.hopT > 0) {
        p.hopT += dt / 0.42;
        if (p.hopT >= 1) { p.hopT = speed > 0 ? p.hopT - 1 : 0; }
        p.y = Math.sin(p.hopT * PI) * 0.22;
        speed *= p.hopT > 0 ? 1.6 : 0;
      }
    }
    if (st === 'slow') speed = Math.min(speed, full);
    p.v = damp(p.v, speed, 10, dt);
    p.face = dampAngle(p.face, p.dir, speed > 0.05 ? 9 : 4, dt);
    if (p.v > 0.01) {
      const nx = p.x + Math.sin(p.face) * p.v * dt, nz = p.z + Math.cos(p.face) * p.v * dt;
      p.x = nx;
      p.z = nz;
    }
    // Hop/jump physics (happy jumps, landing from adoption); birds glide in an arc
    if (p.flying) {
      p.y = Math.sin(clamp(1 - Math.hypot(p.tx - p.x, p.tz - p.z) / p.flyD, 0, 1) * PI) * 1.2;
      p.vy = 0;
    } else if (p.vy || p.y > 0) {
      if (!(p.m.hop || st === 'hop') || p.vy) {
        p.vy -= 12 * dt;
        p.y += p.vy * dt;
        if (p.y <= 0) {
          p.y = 0;
          p.vy = p.state === 'happy' && p.timer > 0.4 ? 2.4 : 0;
          if (!p.vy) this.fx('dust', p.x, p.z, 2);
        }
      }
    }
    // Pose
    const moving = clamp(p.v / Math.max(0.2, full), 0, 1);
    if (moving > 0.05) p.phase += dt * (8 + p.v * 5);
    const stride = (m.size || 0.6) * 0.12, lift = 0.05;
    const [A, B] = m.legs;
    const flying = p.flying && p.y > 0.2;
    A.position.set(0, flying ? 0.05 : Math.max(0, Math.cos(p.phase)) * lift * moving, Math.sin(p.phase) * stride * moving);
    B.position.set(0, flying ? 0.05 : Math.max(0, -Math.cos(p.phase)) * lift * moving, -Math.sin(p.phase) * stride * moving);
    let bodyY = 0, tiltX = 0, legS = 1, headX = 0, headY = 0;
    if (p.state === 'sit') { tiltX = -0.32; bodyY = -0.03; }
    if (p.state === 'nap') { bodyY = -m.by * 0.42; legS = 0.3; headX = 0.25; }
    if (p.state === 'sniff') headX = 0.4 + Math.sin(p.t * 14) * 0.08;
    if (p.state === 'eat') headX = 0.55 + Math.abs(Math.sin(p.t * 9)) * 0.18;
    if (p.state === 'idle' || p.state === 'sit') headY = Math.sin(p.t * 0.9) * 0.5;
    if (p.state === 'happy') tiltX = -0.15;
    m.inner.rotation.x = damp(m.inner.rotation.x, (st === 'hop' ? -0.35 : st === 'bird' ? -0.3 : 0) + tiltX, 8, dt);
    p.bodyY = damp(p.bodyY ?? m.by, m.by + bodyY, 8, dt);
    m.body.position.y = p.bodyY + (moving > 0.05 && st !== 'hop' ? Math.abs(Math.sin(p.phase)) * 0.025 * moving : Math.sin(p.t * 2.2) * 0.006);
    for (const L of m.legs) L.scale.y = damp(L.scale.y, legS, 8, dt);
    m.head.rotation.x = damp(m.head.rotation.x, headX, 8, dt);
    m.head.rotation.y = damp(m.head.rotation.y, headY, 4, dt);
    if (st === 'slow') m.head.position.z = 0.33 + Math.sin(p.t * 0.8) * 0.04;
    const wagSpeed = p.state === 'happy' || p.state === 'follow' ? 22 : st === 'cat' ? 2.5 : 9;
    const wagAmp = st === 'cat' ? 0.25 : p.state === 'happy' || p.state === 'follow' ? 0.6 : 0.3;
    m.tail.rotation.y = Math.sin(p.t * wagSpeed) * wagAmp;
    if (m.wings) {
      const flap = flying || p.state === 'happy' ? Math.sin(p.t * 30) * 0.9 : Math.max(0, Math.sin(p.t * 2)) ** 20 * 0.6;
      m.wings.children[0].rotation.z = -0.1 - flap;
      m.wings.children[1].rotation.z = 0.1 + flap;
    }
    if (p.state === 'nap' && Math.random() < dt * 0.35) this.game.particles.emote(OX + p.x, 0.7, OZ + p.z, icon('zzz'), 'meh');
    if (p.state === 'eat' && Math.random() < dt * 2) this.fx('crumbs', p.x + Math.sin(p.face) * 0.25, 0.15, p.z + Math.cos(p.face) * 0.25, '#c98a4e', 2);
    if (p.state !== 'nap' && (this.home.care[p.idx]?.joy ?? 80) < PET_CARE.happy && Math.random() < dt * 0.12) this.emote(p, 'sad', 'bad');
    if (st === 'pony' && Math.random() < dt * (moving > 0.1 ? 6 : 1.5)) this.fx('sparkle', p.x, 0.5 + p.y, p.z, pick(['#ffd6f0', '#fff3a0', '#bfe8ff']));
    m.root.position.set(p.x, p.y, p.z);
    m.root.rotation.y = p.face;
  }

  separate() {
    const list = [...this.pets, ...this.helpers];
    if (this.chef && this.chef.state !== 'use') list.push(this.chef);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.55;
        if (d >= min || d < 1e-5) continue;
        const push = (min - d) / 2, nx = dx / d, nz = dz / d;
        const wa = a === this.chef ? 0.2 : 1, wb = b === this.chef ? 0.2 : 1;
        a.x -= nx * push * wa; a.z -= nz * push * wa;
        b.x += nx * push * wb; b.z += nz * push * wb;
      }
    }
    for (const a of list) {
      const area = a === this.chef || a.state === 'follow' || a.role ? WALK : YARD;
      pushOut(this.obstacles, a, 0.22);
      a.x = clamp(a.x, area.x0, area.x1);
      a.z = clamp(a.z, area.z0, area.z1);
    }
  }

  // the chef
  chefGoTo(x, z, user = false) {
    const c = this.chef;
    if (!c) return false;
    if (c.state === 'use') this.endUse(c, true);
    c.pending = null;
    const p = { x: clamp(x, WALK.x0, WALK.x1), z: clamp(z, WALK.z0, WALK.z1) };
    pushOut(this.obstacles, p, 0.3);
    p.x = clamp(p.x, WALK.x0, WALK.x1);
    p.z = clamp(p.z, WALK.z0, WALK.z1);
    const path = this.findPath(c.x, c.z, p.x, p.z);
    if (!path && !user) return false;
    c.path = path || [p];
    c.tx = p.x;
    c.tz = p.z;
    c.state = 'walk';
    c.timer = 6 + pathLength(c, c.path) / 1.6;
    c.target = null;
    if (user) {
      this.fx('dust', p.x, p.z, 3, '#fff6dd');
      for (const pet of this.pets) if (pet.def.style === 'dog' && Math.random() < 0.6) this.setPetState(pet, 'follow', rand(4, 7));
    }
    return true;
  }

  // A* over a 0.25-unit grid of the walkable yard, then trimmed to the corners that matter.
  // Returns waypoints ending at (x1, z1), or null when the spot can't be reached.
  findPath(x0, z0, x1, z1) {
    const obs = this.obstacles;
    if (pathClear(obs, x0, z0, x1, z1, 0.2)) return [{ x: x1, z: z1 }];
    const S = 0.25, W = Math.round((WALK.x1 - WALK.x0) / S) + 1, H = Math.round((WALK.z1 - WALK.z0) / S) + 1;
    if (this._navFor !== obs) {
      this._navFor = obs;
      this._nav = new Uint8Array(W * H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) this._nav[j * W + i] = blocked(obs, WALK.x0 + i * S, WALK.z0 + j * S, 0.2) ? 1 : 0;
    }
    const nav = this._nav;
    const cell = (x, z) => [clamp(Math.round((x - WALK.x0) / S), 0, W - 1), clamp(Math.round((z - WALK.z0) / S), 0, H - 1)];
    const [si, sj] = cell(x0, z0);
    let [gi, gj] = cell(x1, z1);
    if (nav[gj * W + gi]) {
      // nearest open cell to the goal
      let best = null, bd = Infinity;
      for (let j = Math.max(0, gj - 4); j <= Math.min(H - 1, gj + 4); j++) {
        for (let i = Math.max(0, gi - 4); i <= Math.min(W - 1, gi + 4); i++) {
          const d = (i - gi) ** 2 + (j - gj) ** 2;
          if (!nav[j * W + i] && d < bd) { bd = d; best = [i, j]; }
        }
      }
      if (!best) return null;
      [gi, gj] = best;
    }
    const start = sj * W + si, goal = gj * W + gi;
    const gs = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), done = new Uint8Array(W * H);
    const hs = (n) => { const dx = Math.abs((n % W) - gi), dz = Math.abs(((n / W) | 0) - gj); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
    const open = new MinHeap();
    gs[start] = 0;
    open.push(start, hs(start));
    while (open.size) {
      const n = open.pop();
      if (n === goal) break;
      if (done[n]) continue;
      done[n] = 1;
      const ni = n % W, nj = (n / W) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const i = ni + di, j = nj + dj;
          if (i < 0 || j < 0 || i >= W || j >= H) continue;
          const m = j * W + i;
          if (nav[m] || done[m]) continue;
          if (di && dj && (nav[nj * W + i] || nav[j * W + ni])) continue;
          const g = gs[n] + (di && dj ? 1.414 : 1);
          if (g < gs[m]) { gs[m] = g; from[m] = n; open.push(m, g + hs(m)); }
        }
      }
    }
    if (goal !== start && from[goal] < 0) return null;
    const cells = [];
    for (let n = goal; n !== start && n >= 0; n = from[n]) cells.push({ x: WALK.x0 + (n % W) * S, z: WALK.z0 + Math.floor(n / W) * S });
    cells.reverse();
    if (cells.length) cells[cells.length - 1] = { x: x1, z: z1 };
    // Keep only the turns: skip ahead while the straight line stays on open cells
    const clear = (ax, az, bx, bz) => {
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (S * 0.5));
      for (let k = 1; k < steps; k++) {
        const [ci, cj] = cell(ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps);
        if (nav[cj * W + ci]) return false;
      }
      return true;
    };
    const out = [];
    let cx = x0, cz = z0, k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) if (clear(cx, cz, cells[m].x, cells[m].z)) { far = m; break; }
      out.push(cells[far]);
      cx = cells[far].x;
      cz = cells[far].z;
      k = far + 1;
    }
    return out.length ? out : [{ x: x1, z: z1 }];
  }

  chefVisit(p) {
    const c = this.chef;
    if (!c) return;
    const a = Math.atan2(c.x - p.x, c.z - p.z);
    if (this.chefGoTo(p.x + Math.sin(a) * 0.65, p.z + Math.cos(a) * 0.65, true)) c.target = p;
  }

  updateChef(dt) {
    const c = this.chef;
    if (!c) return;
    const m = c.m;
    c.t += dt;
    c.timer -= dt;
    if (c.state === 'use') {
      this.updateUse(c, dt);
      this.blinkChef(c, dt);
      return;
    }
    let speed = 0;
    if (c.state === 'walk') {
      const wp = followPath(c);
      const dx = wp.x - c.x, dz = wp.z - c.z, d = Math.hypot(dx, dz);
      if (d > 0.08 || wp.via) {
        c.dir = Math.atan2(dx, dz);
        speed = 2.2 * (wp.via ? 1 : clamp(d / 0.35, 0.35, 1));
      } else if (c.pending) {
        this.startUse(c);
      } else if (c.target) {
        const p = c.target;
        c.dir = Math.atan2(p.x - c.x, p.z - c.z);
        c.state = 'pat';
        c.timer = 1.6;
        this.setPetState(p, 'happy', 1.6);
        p.dir = Math.atan2(c.x - p.x, c.z - p.z);
        this.emote(p, 'heart');
        c.target = null;
      } else {
        c.state = 'idle';
        c.timer = rand(2, 4);
      }
      if (c.timer <= 0) { c.state = 'idle'; c.timer = 2; }
    } else if (c.timer <= 0) {
      c.state = 'idle';
      c.timer = rand(2.5, 5);
      const r = Math.random();
      if (this.pets.length && r < 0.3) this.chefVisit(pick(this.pets));
      else if (this.home.items.length && r < 0.55) this.chefUse(pick(this.home.items), true);
      else if (this.home.favCar && r < 0.65) {
        if (this.chefGoTo(SPOTS[0].x - 0.6, SPOTS[0].z + 1.8)) c.admire = true;
      } else if (r < 0.9) {
        const s = this.freeSpot(WALK, 0.4);
        this.chefGoTo(s.x, s.z);
      }
    }
    if (c.state === 'idle' && c.admire) {
      c.admire = false;
      c.dir = Math.atan2(SPOTS[0].x - c.x, SPOTS[0].z - c.z);
      c.state = 'cheer';
      c.timer = 1.4;
    }
    c.v = damp(c.v, speed, 10, dt);
    c.face = dampAngle(c.face, c.dir, 10, dt);
    c.x += Math.sin(c.face) * c.v * dt;
    c.z += Math.cos(c.face) * c.v * dt;
    // Walk cycle & gestures (a light version of the restaurant's character animation)
    const moving = clamp(c.v / 2.2, 0, 1);
    if (moving > 0.05) c.phase += dt * (5 + c.v * 2.6);
    const bob = moving > 0.05 ? Math.abs(Math.sin(c.phase)) * 0.075 * moving : Math.sin(c.t * 2.4) * 0.012;
    m.root.position.set(c.x, 0, c.z);
    m.root.rotation.set(0, c.face, 0);
    m.head.rotation.x = 0;
    m.pivot.position.y = bob;
    m.pivot.rotation.x = moving * 0.13 + (c.state === 'pat' ? 0.35 : 0);
    m.head.rotation.z = moving > 0.05 ? Math.sin(c.phase) * 0.05 : Math.sin(c.t * 1.3) * 0.03;
    const sw = Math.sin(c.phase) * 0.13 * moving;
    m.footL.position.set(-0.11, 0.06 + Math.max(0, Math.cos(c.phase)) * 0.06 * moving, 0.02 + sw);
    m.footR.position.set(0.11, 0.06 + Math.max(0, -Math.cos(c.phase)) * 0.06 * moving, 0.02 - sw);
    const hl = m.handL.position, hr = m.handR.position;
    if (c.state === 'cheer') {
      const w = Math.sin(c.t * 14) * 0.08;
      hl.set(-0.32, 1.25 + w, 0.05);
      hr.set(0.32, 1.25 - w, 0.05);
    } else if (c.state === 'pat') {
      const k = Math.abs(Math.sin(c.t * 8)) * 0.08;
      hl.set(-0.15, 0.42 + k, 0.45);
      hr.set(0.15, 0.42 + (0.08 - k), 0.45);
    } else {
      const s2 = Math.sin(c.phase) * 0.14 * moving;
      hl.set(-0.33, 0.5 + bob * 0.6, 0.05 - s2);
      hr.set(0.33, 0.5 + bob * 0.6, 0.05 + s2);
    }
    this.blinkChef(c, dt);
  }

  blinkChef(c, dt) {
    c.blink -= dt;
    c.m.eyes.scale.y = c.blink < 0 ? 0.15 : 1;
    if (c.blink < -0.12) c.blink = rand(2, 5);
  }

  // things to do at home
  // Item-local point [x, z] in yard coordinates (and the item's turn)
  itemPoint(it, x, z) {
    const g = this.itemObjs.get(it);
    const rot = g ? g.rotation.y : -it.rot * (PI / 2);
    const q = itemRect(it), cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
    return { x: cx + x * Math.cos(rot) + z * Math.sin(rot), z: cz - x * Math.sin(rot) + z * Math.cos(rot), rot };
  }

  // Walk over and use a piece of furniture (sit, lie, soak, grill, shoot hoops...); auto when the
  // chef is just pottering about (no harvest or rest bonus then)
  chefUse(it, auto = false) {
    const c = this.chef;
    if (!c || !this.itemObjs.has(it)) return false;
    const U = USE[it.id] ?? { kind: 'admire', face: PI };
    const [w, d] = HOME_ITEMS[it.id].size, hx = w / 2, hz = d / 2;
    const at = U.at ?? [0, hz + 0.55];
    const seat = SEATED.has(U.kind) || !!U.hang;
    // Where to stand: the usual spot, else the nearest open side of the piece
    const cands = [];
    if (!seat) cands.push({ p: this.itemPoint(it, at[0], at[1]), main: true });
    for (const [dx, dz] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const lx = dx ? dx * (hx + 0.45) : seat ? at[0] : 0, lz = dz ? dz * (hz + 0.45) : seat ? at[1] : 0;
      cands.push({ p: this.itemPoint(it, lx, lz), main: false });
    }
    let ap = null, main = false;
    for (const k of cands) {
      const { x, z } = k.p;
      if (x < WALK.x0 || x > WALK.x1 || z < WALK.z0 || z > WALK.z1 || blocked(this.obstacles, x, z, 0.26)) continue;
      if (!this.findPath(c.x, c.z, x, z)) continue;
      ap = k.p;
      main = k.main;
      break;
    }
    if (!ap) {
      if (!auto) {
        this.game.ui.toast('No way through to that. Make a gap around it', 'warn', 'crate');
        this.game.audio.error?.();
      }
      return false;
    }
    if (!this.chefGoTo(ap.x, ap.z, !auto)) return false;
    const q = itemRect(it);
    const spot = seat ? this.itemPoint(it, at[0], at[1]) : { x: c.tx, z: c.tz };
    c.pending = { it, U, auto, spot, seat, face: seat || main ? null : Math.atan2((q.x0 + q.x1) / 2 - c.tx, (q.z0 + q.z1) / 2 - c.tz) };
    return true;
  }

  startUse(c) {
    const P0 = c.pending, it = P0.it;
    c.pending = null;
    if (P0.mail) { c.state = 'idle'; c.timer = 2; this.readMail(); return; }
    const g = this.itemObjs.get(it);
    if (!g) { c.state = 'idle'; c.timer = 1; return; }
    const D = HOME_ITEMS[it.id];
    const rest = !P0.auto && (D.group === 'relax' || it.id === 'gazebo' || it.id === 'movie');
    c.use = {
      it, g, U: P0.U, kind: P0.U.kind, from: { x: c.x, z: c.z }, spot: P0.seat ? P0.spot : { x: c.x, z: c.z }, seat: P0.seat, face: P0.face, t: 0, phase: P0.seat ? 'in' : 'on',
      dur: P0.U.kind === 'slide' ? 2.6 : rest ? 9 : P0.auto ? 3.5 : 5, rest, auto: P0.auto, did: false, shot: -1,
    };
    c.state = 'use';
    c.timer = 5;
    if (P0.U.kind === 'harvest' && !P0.auto) this.harvest(it);
    if (P0.U.kind === 'bounce' || P0.U.kind === 'slide') this.game.audio.swoosh?.();
  }

  endUse(c, now = false) {
    const u = c.use;
    c.use = null;
    c.state = 'idle';
    c.timer = rand(1.5, 3);
    if (!u) return;
    if (u.kind === 'slide') {
      const e = this.itemPoint(u.it, 0, 1.35);
      c.x = e.x;
      c.z = e.z;
    } else if (now && u.seat) this.fx('poof', c.x, 0.4, c.z, '#ffffff', 6);
    const m = c.m;
    m.root.rotation.set(0, c.face, 0);
    m.head.rotation.x = 0;
    m.pivot.rotation.x = 0;
    if (this.ball) this.ball.visible = false;
  }

  updateUse(c, dt) {
    const u = c.use, U = u.U, m = c.m, g = u.g;
    if (!g.parent || !this.home.items.includes(u.it)) { this.endUse(c, true); return; }
    u.t += dt;
    const rot = g.rotation.y;
    let face = u.face ?? (U.face ?? 0) + rot;
    // Where the seat is right now (swings and hammocks move)
    let sx = u.spot.x, sz = u.spot.z, sy = U.y ?? 0, tilt = 0;
    if (U.hang) {
      const [py, len, f, amp, ph] = U.hang;
      const T = U.sway ? this.t : this.t + g.position.x * 0.37;
      const a = Math.sin(T * f + (U.sway ? g.position.x : ph)) * amp;
      const dz = -len * Math.sin(a);
      sx += dz * Math.sin(rot);
      sz += dz * Math.cos(rot);
      sy = py - len * Math.cos(a) + (U.y - (py - len));
      tilt = U.kind === 'lie' ? 0 : a;
    }
    // Hop on, stay, hop off
    let x = sx, z = sz, y = sy, k = 1;
    if (u.phase === 'in' || u.phase === 'out') {
      const dist = Math.hypot(sx - u.from.x, sz - u.from.z), dur = Math.max(0.35, dist / 2.4);
      k = Math.min(1, u.t / dur);
      const e = k * k * (3 - 2 * k), a = u.phase === 'in' ? e : 1 - e;
      x = u.from.x + (sx - u.from.x) * a;
      z = u.from.z + (sz - u.from.z) * a;
      y = sy * a + Math.sin(a * PI) * (dist < 1.4 ? 0.35 : 0.15);
      if (u.phase === 'in') face = dampAngle(c.face, face, 14, dt);
      if (k >= 1) {
        if (u.phase === 'in') { u.phase = 'on'; u.t = 0; } else { c.x = u.from.x; c.z = u.from.z; this.endUse(c); return; }
      }
    } else if (u.t > u.dur) {
      if (u.seat) { u.phase = 'out'; u.t = 0; } else { this.endUse(c); return; }
    }
    c.face = face;
    const on = u.phase === 'on' || k > 0.6;
    const t = u.t;
    let rx = tilt, ry = face, bodyX = 0, headX = 0;
    let fl = [-0.11, 0.06, 0.02], fr = [0.11, 0.06, 0.02], hl = [-0.33, 0.5, 0.05], hr = [0.33, 0.5, 0.05];
    const sitPose = () => {
      y -= 0.06;
      fl = [-0.11, -0.22, 0.24];
      fr = [0.11, -0.22, 0.24];
      hl = [-0.2, 0.32, 0.22];
      hr = [0.2, 0.32, 0.22];
      if ((U.y ?? 0) < 0.12) { y -= 0.04; fl = [-0.12, 0.02, 0.42]; fr = [0.12, 0.02, 0.42]; }
    };
    switch (on ? u.kind : 'walk') {
      case 'sit':
        sitPose();
        if (u.phase === 'on' && Math.random() < dt * 0.25) this.game.particles.emote(OX + x, y + 1.5, OZ + z, icon('heart'), 'love');
        break;
      case 'soak':
        sitPose();
        hl = [-0.42, 0.44, 0.02];
        hr = [0.42, 0.44, 0.02];
        headX = -0.2;
        break;
      case 'dig': {
        sitPose();
        const d = Math.abs(Math.sin(t * 7));
        hl = [-0.15, 0.1 + d * 0.2, 0.4];
        hr = [0.15, 0.3 - d * 0.2, 0.4];
        bodyX = 0.3;
        if (Math.random() < dt * 4) this.fx('dust', x + Math.sin(face) * 0.4, z + Math.cos(face) * 0.4, 2, '#f4d896');
        break;
      }
      case 'lie': {
        rx = -PI / 2;
        ry = face + PI;
        x -= Math.sin(face) * 0.55;
        z -= Math.cos(face) * 0.55;
        y += 0.25;
        hl = [-0.14, 0.6, 0.24];
        hr = [0.14, 0.6, 0.24];
        if (u.phase === 'on' && Math.random() < dt * 0.4) this.game.particles.emote(OX + x + Math.sin(face) * 1.1, y + 0.7, OZ + z + Math.cos(face) * 1.1, icon('zzz'), 'meh');
        break;
      }
      case 'bounce': {
        const b = Math.abs(Math.sin(t * 4.2));
        y += b * 0.95;
        hl = [-0.36, 0.85 + b * 0.45, 0.05];
        hr = [0.36, 0.85 + b * 0.45, 0.05];
        fl = [-0.11, 0.06 + b * 0.14, 0.1];
        fr = [0.11, 0.06 + b * 0.14, 0.1];
        if (b < 0.08 && Math.random() < 0.5) this.fx('dust', x, z, 1, '#ffffff');
        break;
      }
      case 'grill': {
        const f = Math.abs(Math.sin(t * 5));
        hl = [-0.16, 0.74, 0.4];
        hr = [0.18, 0.76 + f * 0.2, 0.42];
        bodyX = 0.12;
        break;
      }
      case 'look':
        headX = -0.45;
        hl = [-0.1, 1.0, 0.32];
        hr = [0.1, 1.0, 0.32];
        if (Math.random() < dt * 1.5) this.fx('sparkle', x + Math.sin(face) * 3 + rand(-1, 1), 4 + rand(0, 1.5), z + Math.cos(face) * 3 + rand(-1, 1), '#fff3a0');
        break;
      case 'putt': {
        const sw = Math.sin(t * 2.4) * 0.16;
        hl = [-0.03 + sw, 0.4, 0.3];
        hr = [0.03 + sw, 0.42, 0.3];
        headX = 0.35;
        bodyX = 0.2;
        break;
      }
      case 'harvest': {
        const f = Math.abs(Math.sin(t * 6));
        hl = [-0.16, 0.7 + f * 0.25, 0.42];
        hr = [0.16, 0.95 - f * 0.25, 0.42];
        bodyX = 0.15;
        break;
      }
      case 'shoot':
        ({ hl, hr } = this.shootHoops(c, u, x, z, face, dt));
        break;
      case 'slide':
        ({ x, y, z, hl, hr, fl, fr } = this.slidePose(u, sitPose));
        break;
      case 'walk':
        break;
      default: {
        const cl = Math.abs(Math.sin(t * 10));
        hl = [-0.06 - cl * 0.07, 0.78, 0.32];
        hr = [0.06 + cl * 0.07, 0.78, 0.32];
        if (Math.random() < dt * 0.5) this.game.particles.emote(OX + x, 1.6, OZ + z, icon('star'), 'good');
      }
    }
    m.root.position.set(x, y, z);
    m.root.rotation.set(rx, ry, 0);
    m.pivot.position.y = 0;
    m.pivot.rotation.x = bodyX;
    m.head.rotation.x = headX;
    m.head.rotation.z = Math.sin(c.t * 1.3) * 0.03;
    m.footL.position.set(...fl);
    m.footR.position.set(...fr);
    m.handL.position.set(...hl);
    m.handR.position.set(...hr);
    // A rest on the furniture: well rested for tomorrow
    if (u.rest && !u.did && u.phase === 'on' && u.t > 4) {
      u.did = true;
      const h = this.home, day = this.game.state.day;
      if (h.rested !== day) {
        h.rested = day;
        this.game.ui.toast(`Well rested: ${perkText(REST_PERK)} tomorrow`, 'good', 'zzz');
        this.game.audio.happy?.();
        if (typeof this.game.updateAmbience === 'function') this.game.updateAmbience(true);
        this.panel.render();
        this.game.save();
      }
    }
  }

  // Dribble, jump shot, swish (most of the time)
  shootHoops(c, u, x, z, face, dt) {
    if (!this.ball) {
      this.ball = mesh(sph(0.11, 14, 10), P('#ff8a3d', 0.6), 0, 0, 0);
      this.root.add(this.ball);
    }
    const b = this.ball, cyc = u.t % 1.9, n = Math.floor(u.t / 1.9);
    b.visible = true;
    const hand = { x: x + Math.sin(face) * 0.35 + Math.cos(face) * 0.2, z: z + Math.cos(face) * 0.35 - Math.sin(face) * 0.2 };
    let hl = [-0.25, 0.55, 0.2], hr;
    if (cyc < 0.7) {
      const d = Math.abs(Math.sin(cyc * 14));
      hr = [0.25, 0.42 + d * 0.15, 0.32];
      b.position.set(hand.x, 0.11 + d * 0.32, hand.z);
    } else if (cyc < 0.85) {
      hl = [-0.12, 1.15, 0.28];
      hr = [0.12, 1.15, 0.28];
      b.position.set(x + Math.sin(face) * 0.3, 1.45, z + Math.cos(face) * 0.3);
    } else {
      hl = [-0.12, 1.2, 0.3];
      hr = [0.12, 1.2, 0.3];
      const rim = this.itemPoint(u.it, 0, 0.3), k = Math.min(1, (cyc - 0.85) / 0.6);
      const sx = x + Math.sin(face) * 0.3, sz = z + Math.cos(face) * 0.3;
      if (u.shot !== n) {
        u.shot = n;
        u.make = Math.random() < 0.65;
      }
      const miss = u.make ? 0 : 0.28;
      b.position.set(sx + (rim.x - sx + miss) * k, 1.45 + (2.3 - 1.45) * k + Math.sin(k * PI) * 1.1, sz + (rim.z - sz) * k);
      if (k >= 1 && !u.scored) {
        u.scored = true;
        if (u.make) {
          this.fx('confetti', rim.x, 2.2, rim.z, 10);
          this.game.audio.ding?.();
        } else this.game.audio.thud?.();
      }
      if (k < 1) u.scored = false;
    }
    return { hl, hr };
  }

  // Up the ladder, a moment at the top, whee down the chute
  slidePose(u, sitPose) {
    const t = Math.min(u.t, 2.5);
    const L = (lx, ly, lz) => { const p = this.itemPoint(u.it, lx, lz); return [p.x, ly, p.z]; };
    const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    let pos, sit = false;
    const hl0 = [-0.2, 0.9, 0.2], hr0 = [0.2, 0.9, 0.2];
    if (t < 1.0) pos = lerp(L(0, 0, -1.2), L(0, 1.28, -0.66), t / 1.0);
    else if (t < 1.3) { pos = L(0, 1.32, -0.55); sit = true; }
    else if (t < 2.0) { pos = lerp(L(0, 1.32, -0.45), L(0, 0.34, 0.68), (t - 1.3) / 0.7); sit = true; }
    else { pos = lerp(L(0, 0.34, 0.68), L(0, 0, 1.3), (t - 2.0) / 0.5); }
    const o = { x: pos[0], y: pos[1], z: pos[2], hl: hl0, hr: hr0, fl: [-0.11, 0.06, 0.02], fr: [0.11, 0.06, 0.02] };
    if (t < 1.0) {
      const c = Math.sin(t * 14);
      o.hl = [-0.18, 0.95 + c * 0.1, 0.18];
      o.hr = [0.18, 0.95 - c * 0.1, 0.18];
    } else if (sit) {
      o.fl = [-0.11, -0.22, 0.3];
      o.fr = [0.11, -0.22, 0.3];
      o.hl = [-0.36, 1.05, 0.05];
      o.hr = [0.36, 1.05, 0.05];
      o.y -= 0.06;
    }
    if (u.t > 1.35 && u.t < 1.4 && !u.wee) { u.wee = true; this.game.particles.emote(OX + o.x, o.y + 1.5, OZ + o.z, icon('heart'), 'love'); }
    return o;
  }

  harvest(it) {
    const g = this.itemObjs.get(it), day = this.game.state.day;
    if ((it.picked || 0) >= day) {
      this.game.ui.toast('Already picked today. More tomorrow', 'info', 'plant');
      return;
    }
    it.picked = day;
    const v = HARVEST[it.id];
    this.game.addCash(v, OX + g.position.x, 1.5, OZ + g.position.z);
    this.fx('confetti', g.position.x, 1.2, g.position.z, 18, it.id === 'appletree' ? ['#e8343f', '#7cc95e', '#ffd23f'] : ['#ff8a3a', '#7cc95e', '#e8343f']);
    this.game.audio.pickup?.();
    this.game.save();
  }

  // the mailbox
  goToMail() {
    const c = this.chef;
    if (!c) return;
    if (this.chefGoTo(MAILBOX.x, PLOT.z1 - 0.55, true)) c.pending = { mail: true, it: null };
  }

  readMail() {
    const h = this.home, g = this.game, day = g.state.day;
    if (this.chef) { this.chef.dir = 0; this.chef.state = 'cheer'; this.chef.timer = 1; }
    if (h.mailDay >= day) {
      g.ui.toast('No new mail. The post comes every morning', 'info', 'mail');
      g.audio.click?.();
      return;
    }
    h.mailDay = day;
    const r = Math.random();
    let title, body;
    if (r < 0.2 && h.pets.length) {
      h.care.forEach((c, i) => this.petJoy(i, 15));
      for (const p of this.pets) { this.setPetState(p, 'happy', 1.5); p.vy = 2.4; }
      title = 'A parcel for the pets';
      body = 'A neighbour dropped off a box of treats. Every pet is a little happier.';
    } else if (r < 0.4) {
      const id = pick(['flowerbed', 'flamingos', 'gardenlamp', 'birdbath', 'topiary', 'gnomes']);
      h.storage[id] = (h.storage[id] || 0) + 1;
      title = 'A gift from the garden club';
      body = `They sent you a ${HOME_ITEMS[id].name}. It is waiting in storage on the Yard tab.`;
    } else {
      const amt = Math.min(150, 20 + day * 3 + Math.round(rand(0, 20)));
      g.addCash(amt, OX + MAILBOX.x, 1.4, OZ + MAILBOX.z);
      title = 'Fan mail!';
      body = `"${pick(FAN_LINES)}" Signed, ${pick(FANS)}. A ${formatMoney(amt)} tip was tucked inside.`;
    }
    g.audio.happy?.();
    const w = g.ui.modal(`<div class="hm-letter"><div class="hm-stamp">${icon('mail')}</div><h2>${title}</h2><p>${body}</p></div>
      <div class="m-actions"><button class="big-btn primary" data-a="ok">Lovely</button></div>`, 'letter');
    w.onclick = (ev) => {
      if (!ev.target.closest('[data-a="ok"]')) return;
      g.audio.click?.();
      g.ui.closeModal(w);
    };
    this.afterPurchase();
  }

  // Bobbing markers: a coin over crops ready to pick, an envelope over the mailbox
  makeMarks() {
    const group = new THREE.Group();
    const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20);
    coinGeo.rotateX(PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({ color: '#ffcf3a', emissive: '#c88a00', emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 });
    const env = new THREE.Group();
    const envMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.6 });
    const sealMat = new THREE.MeshStandardMaterial({ color: '#e8343f', roughness: 0.5 });
    const envGeo = new THREE.BoxGeometry(0.42, 0.28, 0.04), sealGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12);
    sealGeo.rotateX(PI / 2);
    env.add(new THREE.Mesh(envGeo, envMat));
    const seal = new THREE.Mesh(sealGeo, sealMat);
    seal.position.z = 0.03;
    env.add(seal);
    env.position.set(MAILBOX.x, 1.7, MAILBOX.z);
    group.add(env);
    this.own.push(coinGeo, coinMat, envMat, sealMat, envGeo, sealGeo);
    return { group, coinGeo, coinMat, env, coins: new Map() };
  }

  updateMarks() {
    const M = this.marks, day = this.game.state.day, t = this.t;
    M.env.visible = this.home.mailDay < day;
    M.env.position.y = 1.7 + Math.sin(t * 3) * 0.1;
    M.env.rotation.y = Math.sin(t * 1.5) * 0.5;
    const want = new Set();
    for (const it of this.home.items) {
      if (!HARVEST[it.id] || (it.picked || 0) >= day) continue;
      want.add(it);
      let coin = M.coins.get(it);
      const g = this.itemObjs.get(it);
      if (!g) continue;
      if (!coin) {
        coin = new THREE.Mesh(M.coinGeo, M.coinMat);
        M.group.add(coin);
        M.coins.set(it, coin);
        g.userData.top ??= new THREE.Box3().setFromObject(g).max.y;
      }
      coin.position.set(g.position.x, (g.userData.top ?? 1) + 0.45 + Math.sin(t * 3 + g.position.x) * 0.08, g.position.z);
      coin.rotation.y = t * 2.5;
    }
    for (const [it, coin] of M.coins) if (!want.has(it)) { M.group.remove(coin); M.coins.delete(it); }
  }

  // helpers (gardener, pet sitter, butler)
  toggleHelper(id) {
    const D = HOME_STAFF[id], h = this.home, ui = this.game.ui;
    if (!D) return;
    if (h.staff.includes(id)) {
      ui.confirm(`Let the ${D.name.toLowerCase()} go?`, 'You can hire them again any time.', 'Let them go', () => {
        if (!this._active) return;
        h.staff = h.staff.filter((x) => x !== id);
        this.syncHelpers(true);
        this.afterPurchase();
      });
      return;
    }
    ui.confirm(`Hire a ${D.name.toLowerCase()}?`, `${D.desc} Wages are ${formatMoney(D.wage)} a day, paid after each working day.`, `Hire for ${formatMoney(D.wage)} a day`, () => {
      if (!this._active || h.staff.includes(id)) return;
      h.staff.push(id);
      this.syncHelpers(true);
      this.game.audio.happy?.();
      this.game.ui.toast(`Your ${D.name.toLowerCase()} starts today`, 'good', 'people');
      this.afterPurchase();
    });
  }

  syncHelpers(animate) {
    for (const hp of [...this.helpers]) {
      if (this.home.staff.includes(hp.role)) continue;
      this.fx('poof', hp.x, 0.6, hp.z, '#ffffff', 12);
      this.root.remove(hp.m.root);
      disposeObject(hp.m.root);
      this.helpers.splice(this.helpers.indexOf(hp), 1);
    }
    for (const role of this.home.staff) {
      if (this.helpers.some((hp) => hp.role === role)) continue;
      const m = buildHelper(role);
      const sp = role === 'butler' ? { x: SITE.x + 1.0, z: 0.9 } : this.freeSpot(YARD, 0.4);
      const hp = { role, m, x: sp.x, z: sp.z, face: 0, dir: 0, v: 0, phase: 0, t: rand(0, 5), state: 'idle', timer: rand(0.5, 2), tx: sp.x, tz: sp.z, pet: null };
      m.root.position.set(hp.x, 0, hp.z);
      this.root.add(m.root);
      this.helpers.push(hp);
      if (animate) {
        this.fx('poof', hp.x, 0.6, hp.z, '#ffffff', 14);
        this.fx('confetti', hp.x, 1.6, hp.z, 24);
      }
    }
  }

  helperNext(hp) {
    const r = Math.random();
    const go = (x, z, act) => {
      const p = { x: clamp(x, WALK.x0, WALK.x1), z: clamp(z, WALK.z0, WALK.z1) };
      pushOut(this.obstacles, p, 0.3);
      hp.path = this.findPath(hp.x, hp.z, p.x, p.z) || [p];
      hp.tx = p.x;
      hp.tz = p.z;
      hp.act = act;
      hp.state = 'walk';
      hp.timer = 6 + pathLength(hp, hp.path) / 1.4;
    };
    if (hp.role === 'gardener') {
      const plants = this.home.items.filter((it) => HOME_ITEMS[it.id].group === 'garden');
      if (plants.length && r < 0.75) {
        const it = pick(plants), q = itemRect(it), half = (it.rot % 2 ? q.x1 - q.x0 : q.z1 - q.z0) / 2;
        const p = this.itemPoint(it, 0, half + 0.5);
        go(p.x, p.z, { water: { x: (q.x0 + q.x1) / 2, z: (q.z0 + q.z1) / 2 } });
      } else {
        const s = this.freeSpot(YARD, 0.4);
        go(s.x, s.z, { water: { x: s.x + rand(-0.6, 0.6), z: s.z + 0.6 } });
      }
    } else if (hp.role === 'sitter' && this.pets.length && r < 0.8) {
      const p = pick(this.pets);
      go(p.x + rand(-0.5, 0.5), p.z + 0.6, { pet: p });
    } else if (hp.role === 'butler') {
      if (this.chef && r < 0.45) go(this.chef.x + 0.6, this.chef.z + 0.4, { serve: true });
      else go(SITE.x + 1.0 + rand(-0.2, 0.2), Math.max(YARD.z0, SITE.z + this.tierObj.userData.front + 0.5), { wait: true });
    } else {
      const s = this.freeSpot(YARD, 0.4);
      go(s.x, s.z, null);
    }
  }

  updateHelper(hp, dt) {
    const m = hp.m;
    hp.t += dt;
    hp.timer -= dt;
    let speed = 0;
    if (hp.state === 'walk') {
      const wp = followPath(hp);
      const dx = wp.x - hp.x, dz = wp.z - hp.z, d = Math.hypot(dx, dz);
      if ((d > 0.1 || wp.via) && hp.timer > 0) {
        hp.dir = Math.atan2(dx, dz);
        speed = 1.7 * (wp.via ? 1 : clamp(d / 0.35, 0.35, 1));
      } else {
        hp.state = 'work';
        hp.timer = hp.act?.wait ? rand(4, 7) : rand(2.5, 4.5);
        const a = hp.act;
        if (a?.water) hp.dir = Math.atan2(a.water.x - hp.x, a.water.z - hp.z);
        if (a?.pet) {
          hp.dir = Math.atan2(a.pet.x - hp.x, a.pet.z - hp.z);
          this.setPetState(a.pet, 'happy', 1.6);
          a.pet.vy = 2.2;
          this.emote(a.pet, 'heart');
        }
        if (a?.serve && this.chef) {
          hp.dir = Math.atan2(this.chef.x - hp.x, this.chef.z - hp.z);
          this.game.particles.emote(OX + hp.x, 1.6, OZ + hp.z, icon('heart'), 'love');
        }
        if (a?.wait) hp.dir = 0;
      }
    } else if (hp.timer <= 0) this.helperNext(hp);
    hp.v = damp(hp.v, speed, 10, dt);
    hp.face = dampAngle(hp.face, hp.dir, 8, dt);
    hp.x += Math.sin(hp.face) * hp.v * dt;
    hp.z += Math.cos(hp.face) * hp.v * dt;
    const moving = clamp(hp.v / 1.7, 0, 1);
    if (moving > 0.05) hp.phase += dt * (5 + hp.v * 2.6);
    const bob = moving > 0.05 ? Math.abs(Math.sin(hp.phase)) * 0.07 * moving : Math.sin(hp.t * 2.4) * 0.012;
    m.root.position.set(hp.x, 0, hp.z);
    m.root.rotation.y = hp.face;
    m.pivot.position.y = bob;
    m.pivot.rotation.x = moving * 0.12;
    const sw = Math.sin(hp.phase) * 0.13 * moving;
    m.footL.position.set(-0.11, 0.06 + Math.max(0, Math.cos(hp.phase)) * 0.06 * moving, 0.02 + sw);
    m.footR.position.set(0.11, 0.06 + Math.max(0, -Math.cos(hp.phase)) * 0.06 * moving, 0.02 - sw);
    const working = hp.state === 'work';
    const s2 = Math.sin(hp.phase) * 0.14 * moving;
    m.handL.position.set(-0.33, 0.5 + bob * 0.6, 0.05 - s2);
    if (hp.role === 'butler') m.handR.position.set(0.3, 0.82 + bob * 0.3, 0.26);
    else if (working && hp.act?.water) {
      m.handR.position.set(0.28, 0.62, 0.4);
      m.handR.rotation.x = 0.5;
      if (Math.random() < dt * 8) this.fx('splash', hp.x + Math.sin(hp.face) * 0.7, 0.25, hp.z + Math.cos(hp.face) * 0.7, 1);
    } else if (working && hp.act?.pet) {
      const k = Math.abs(Math.sin(hp.t * 8)) * 0.08;
      m.handL.position.set(-0.15, 0.42 + k, 0.45);
      m.handR.position.set(0.15, 0.42 + (0.08 - k), 0.45);
      m.pivot.rotation.x = 0.35;
    } else {
      m.handR.position.set(0.33, 0.5 + bob * 0.6, 0.05 + s2);
      m.handR.rotation.x = 0;
    }
    if (hp.role !== 'gardener' || !working) m.handR.rotation.x = 0;
  }
}
