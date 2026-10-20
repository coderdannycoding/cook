// Yard furniture for the home: the catalog (size on the yard grid, price, comfort and an optional
// small restaurant perk) and a model builder for every piece. Models face +z and are centred on
// their footprint (1 unit per cell). The six original yard pieces are still built in home.js.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { mat, umat, mesh, box, rbox, cyl, sph, cone, torus, ico, capsule, mergeStatic } from './models.js';

const PI = Math.PI, TAU = PI * 2;

// group: shop section. size: [w, d] cells. comfort: adds to the home comfort score.
// flat: you can walk over it. pet: pets love it (keeps them happier). fx: particles in home.js.
export const HOME_ITEMS = {
  // garden
  flamingos: { group: 'garden', name: 'Lawn Flamingos', price: 100, size: [1, 1], comfort: 2, desc: 'Two pink plastic flamingos. A classic.' },
  flowerbed: { group: 'garden', name: 'Flower Bed', price: 120, size: [2, 1], comfort: 3, desc: 'A raised bed of tulips and daisies.' },
  gardenlamp: { group: 'garden', name: 'Garden Lamp', price: 140, size: [1, 1], comfort: 2, light: true, desc: 'A little lantern on a post for warm evenings.' },
  birdbath: { group: 'garden', name: 'Bird Bath', price: 180, size: [1, 1], comfort: 3, desc: 'A stone bowl where a bluebird stops to splash.' },
  gnomes: { group: 'garden', name: 'Garden Gnomes', price: 200, size: [2, 1], comfort: 3, perk: { review: 0.01 }, desc: 'Three tiny guardians of the flower bed.' },
  veggies: { group: 'garden', name: 'Veggie Patch', price: 260, size: [2, 2], comfort: 4, perk: { tips: 0.01 }, desc: 'Cabbages, carrots and tomatoes for the kitchen.' },
  appletree: { group: 'garden', name: 'Apple Tree', price: 350, size: [1, 1], comfort: 5, desc: 'Shady, leafy and full of shiny red apples.' },
  topiary: { group: 'garden', name: 'Topiary Swan', price: 420, size: [1, 1], comfort: 4, desc: 'A hedge clipped into a very proud swan.' },
  fairyarch: { group: 'garden', name: 'Fairy-Light Arch', price: 380, size: [2, 1], comfort: 5, light: true, desc: 'A rose arch strung with twinkling lights.' },
  pond: { group: 'garden', name: 'Koi Pond', price: 900, size: [2, 2], comfort: 8, perk: { patience: 0.01 }, desc: 'Lily pads and slow, golden koi.' },
  sunflowers: { group: 'garden', name: 'Sunflowers', price: 160, size: [1, 1], comfort: 3, desc: 'Five tall sunflowers turning to the sun.' },
  rosebush: { group: 'garden', name: 'Rose Bush', price: 190, size: [1, 1], comfort: 3, desc: 'A round bush covered in red and pink roses.' },
  stones: { group: 'garden', name: 'Stepping Stones', price: 70, size: [1, 1], comfort: 1, flat: true, desc: 'Flat stones with moss between them.' },
  scarecrow: { group: 'garden', name: 'Scarecrow', price: 240, size: [1, 1], comfort: 3, desc: 'Keeps the crows off the veggies. Mostly.' },
  beehive: { group: 'garden', name: 'Beehive', price: 420, size: [1, 1], comfort: 4, desc: 'Busy bees and a jar of honey to collect each day.' },
  windmill: { group: 'garden', name: 'Garden Windmill', price: 460, size: [1, 1], comfort: 5, desc: 'A little white windmill with spinning sails.' },
  well: { group: 'garden', name: 'Wishing Well', price: 520, size: [1, 1], comfort: 5, perk: { review: 0.01 }, desc: 'Stone, a shingle roof and a bucket on a rope.' },
  greenhouse: { group: 'garden', name: 'Greenhouse', price: 1600, size: [2, 2], comfort: 9, light: true, perk: { tips: 0.01 }, desc: 'Glass walls, tomato vines and fresh herbs to pick daily.' },
  // relax
  picnic: { group: 'relax', name: 'Picnic Blanket', price: 150, size: [2, 2], comfort: 3, flat: true, desc: 'Gingham, a basket and a jug of lemonade.' },
  lounger: { group: 'relax', name: 'Sun Lounger', price: 220, size: [1, 2], comfort: 4, desc: 'Stripy cushions and a cold drink.' },
  patio: { group: 'relax', name: 'Patio Set', price: 480, size: [2, 2], comfort: 6, desc: 'A round table, two chairs and a parasol.' },
  swingbench: { group: 'relax', name: 'Porch Swing', price: 520, size: [2, 1], comfort: 5, desc: 'A gently rocking bench for two.' },
  firepit: { group: 'relax', name: 'Fire Pit', price: 600, size: [2, 2], comfort: 7, light: true, fx: 'fire', desc: 'Stone ring, crackling logs and stump seats.' },
  hammock: { group: 'relax', name: 'Hammock', price: 800, size: [3, 1], comfort: 6, perk: { patience: 0.01 }, desc: 'A striped hammock that sways in the breeze.' },
  hottub: { group: 'relax', name: 'Hot Tub', price: 3000, size: [2, 2], comfort: 12, fx: 'tub', perk: { patience: 0.02 }, desc: 'Bubbly, steamy and very relaxing.' },
  adirondack: { group: 'relax', name: 'Deck Chairs', price: 280, size: [2, 1], comfort: 5, desc: 'Two slatted wooden chairs and a little side table.' },
  tent: { group: 'relax', name: 'Camping Tent', price: 340, size: [2, 2], comfort: 4, light: true, desc: 'For backyard camping, with a lantern inside.' },
  sofa: { group: 'relax', name: 'Outdoor Sofa', price: 900, size: [2, 2], comfort: 8, desc: 'A cushy corner sofa, a coffee table and a rug.' },
  pergola: { group: 'relax', name: 'Pergola', price: 1400, size: [2, 2], comfort: 10, light: true, perk: { patience: 0.01 }, desc: 'Vines, flowers and string lights over a bench.' },
  // play
  sandbox: { group: 'play', name: 'Sandbox', price: 300, size: [2, 2], comfort: 3, desc: 'Buckets, spades and a lopsided castle.' },
  hoop: { group: 'play', name: 'Basketball Hoop', price: 350, size: [1, 1], comfort: 3, desc: 'Swish. Mostly.' },
  minigolf: { group: 'play', name: 'Mini Golf Hole', price: 400, size: [2, 1], comfort: 3, flat: true, desc: 'A windmill-free putting green with a flag.' },
  slide: { group: 'play', name: 'Slide', price: 450, size: [1, 2], comfort: 4, desc: 'A bright yellow slide with a ladder.' },
  bbq: { group: 'play', name: 'BBQ Grill', price: 500, size: [1, 1], comfort: 4, fx: 'smoke', perk: { tips: 0.01 }, desc: 'Weekend burgers, cooked by a pro.' },
  swingset: { group: 'play', name: 'Swing Set', price: 650, size: [3, 1], comfort: 5, desc: 'Two swings that never quite stop.' },
  telescope: { group: 'play', name: 'Telescope', price: 700, size: [1, 1], comfort: 4, desc: 'For stargazing after a long shift.' },
  pizzaoven: { group: 'play', name: 'Pizza Oven', price: 900, size: [1, 1], comfort: 6, light: true, fx: 'smoke', perk: { tips: 0.01 }, desc: 'A brick dome oven for Sunday pizza.' },
  trampoline: { group: 'play', name: 'Trampoline', price: 1200, size: [2, 2], comfort: 6, perk: { queue: 0.02 }, desc: 'Boing. The neighbours can see you over the fence.' },
  movie: { group: 'play', name: 'Movie Screen', price: 1500, size: [2, 1], comfort: 8, light: true, desc: 'Outdoor cinema nights under the stars.' },
  pingpong: { group: 'play', name: 'Ping-Pong Table', price: 550, size: [2, 1], comfort: 4, desc: 'A quick game before the dinner rush.' },
  goal: { group: 'play', name: 'Football Goal', price: 380, size: [2, 1], comfort: 3, desc: 'A net, a ball and endless penalty practice.' },
  skateramp: { group: 'play', name: 'Skate Ramp', price: 700, size: [2, 1], comfort: 4, desc: 'A painted fun box with two ramps.' },
  bouncy: { group: 'play', name: 'Bouncy Castle', price: 1100, size: [2, 2], comfort: 6, perk: { queue: 0.02 }, desc: 'Inflatable towers in every colour.' },
  treehouse: { group: 'play', name: 'Treehouse', price: 2200, size: [2, 2], comfort: 9, perk: { patience: 0.01 }, desc: 'A hut up in the branches with a rope ladder.' },
  // pets
  foodbowls: { group: 'pets', name: 'Food Bowls', price: 90, size: [1, 1], comfort: 1, pet: true, flat: true, desc: 'Always full. Pets get hungry less often.' },
  petbed: { group: 'pets', name: 'Pet Bed', price: 160, size: [1, 1], comfort: 2, pet: true, flat: true, desc: 'A squishy round bed for naps.' },
  agility: { group: 'pets', name: 'Agility Hurdles', price: 300, size: [2, 1], comfort: 2, pet: true, desc: 'Jump, jump, treat!' },
  doghouse: { group: 'pets', name: 'Pet House', price: 350, size: [1, 1], comfort: 3, pet: true, perk: { patience: 0.01 }, desc: 'A cosy kennel with a bone over the door.' },
  cattree: { group: 'pets', name: 'Cat Tree', price: 380, size: [1, 1], comfort: 3, pet: true, desc: 'Scratching posts, perches and a dangling mouse.' },
  birdhouse: { group: 'pets', name: 'Birdhouse', price: 120, size: [1, 1], comfort: 2, pet: true, desc: 'A tiny house on a post. Birds love it.' },
  kiddiepool: { group: 'pets', name: 'Paddling Pool', price: 150, size: [1, 1], comfort: 2, pet: true, flat: true, desc: 'Dogs splash about on warm days.' },
  hutch: { group: 'pets', name: 'Rabbit Hutch', price: 260, size: [2, 1], comfort: 2, pet: true, desc: 'Hay, a ramp and a cosy loft for bunnies.' },
  // fancy
  statue: { group: 'fancy', name: 'Garden Statue', price: 1200, size: [1, 1], comfort: 8, perk: { review: 0.01 }, desc: 'A marble chef holding a ladle aloft.' },
  fountain: { group: 'fancy', name: 'Tiered Fountain', price: 2500, size: [2, 2], comfort: 12, fx: 'spray', perk: { review: 0.02 }, desc: 'Three tiers of splashing water.' },
  gazebo: { group: 'fancy', name: 'Gazebo', price: 4000, size: [3, 3], comfort: 16, light: true, perk: { patience: 0.02 }, desc: 'An airy white gazebo with benches and lanterns.' },
  balloon: { group: 'fancy', name: 'Hot Air Balloon', price: 8000, size: [2, 2], comfort: 20, perk: { arrivals: 0.02 }, desc: 'Tethered in the yard and visible all over town.' },
  donut: { group: 'fancy', name: 'Giant Donut', price: 1800, size: [1, 1], comfort: 8, perk: { tips: 0.01 }, desc: 'A pink-iced sculpture with sprinkles. Very photogenic.' },
  bridge: { group: 'fancy', name: 'Garden Bridge', price: 2800, size: [3, 1], comfort: 12, perk: { patience: 0.01 }, desc: 'A red arched bridge over a little stream.' },
  observatory: { group: 'fancy', name: 'Observatory', price: 6000, size: [2, 2], comfort: 16, light: true, perk: { review: 0.02 }, desc: 'A domed tower with a big telescope.' },
  helipad: { group: 'fancy', name: 'Helipad', price: 15000, size: [3, 3], comfort: 24, light: true, perk: { arrivals: 0.03 }, desc: 'Your own helicopter, rotors turning.' },
};
export const ITEM_GROUPS = [['garden', 'Garden'], ['relax', 'Relax'], ['play', 'Play'], ['pets', 'Pets'], ['fancy', 'Fancy']];

// helpers
const P = (c, r = 0.6, m = 0) => mat(c, { r, m });
function put(parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = mesh(geo, typeof m === 'string' ? P(m) : m, x, y, z);
  if (rx || ry || rz) o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}
const sc = (o, x, y = x, z = x) => { o.scale.set(x, y, z); return o; };
function grp(x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}
const dyn = (g) => { g.userData.dynamic = true; return g; };
const UP = new THREE.Vector3(0, 1, 0);
function rod(parent, a, b, r, m) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const o = mesh(cyl(r, r, 1, 8), typeof m === 'string' ? P(m) : m);
  o.scale.y = d.length();
  o.position.copy(A).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(UP, d.normalize());
  parent.add(o);
  return o;
}
function flower(parent, x, y, z, col, r = 0.06) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    sc(put(parent, sph(r * 0.55, 8, 6), col, x + Math.cos(a) * r * 0.75, y, z + Math.sin(a) * r * 0.75), 1, 0.4, 1);
  }
  put(parent, sph(r * 0.4, 8, 6), '#ffcf3a', x, y + 0.01, z);
}
const WOOD = '#a8743f', WHITE = '#fbf8f1', STONE = '#c9c2b5', LEAF = '#4fa35a', LEAF2 = '#7cc95e';
const METAL = () => P('#4a505a', 0.35, 0.6);
const GOLD = () => P('#e8b830', 0.3, 0.85);
const glow = (c, e, ei = 1.4) => umat(c, { e, ei });

// builders
const B = {};

B.flamingos = () => {
  const g = new THREE.Group();
  for (const [x, z, ry, lean] of [[-0.2, 0.05, 0.4, 0.1], [0.22, -0.1, -0.5, -0.05]]) {
    const f = grp(x, 0, z, ry);
    rod(f, [0, 0, 0], [0, 0.42, 0], 0.012, '#3a3a3a');
    sc(put(f, sph(0.13, 14, 10), '#ff7aa8', 0, 0.5, 0), 1, 0.75, 1.4);
    rod(f, [0, 0.55, 0.12], [0, 0.78, 0.08 + lean], 0.025, P('#ff7aa8'));
    put(f, sph(0.055, 10, 8), '#ff7aa8', 0, 0.82, 0.1 + lean);
    put(f, cone(0.025, 0.08, 8), '#2a2a2a', 0, 0.8, 0.17 + lean, PI / 2 + 0.6);
    put(f, sph(0.012, 6, 5), '#1d1a2f', 0.04, 0.84, 0.13 + lean);
    g.add(f);
  }
  return g;
};

B.flowerbed = () => {
  const g = new THREE.Group();
  put(g, rbox(1.85, 0.3, 0.8, 0.05, 1), WOOD, 0, 0.15, 0);
  put(g, box(1.72, 0.04, 0.68), '#6a4a33', 0, 0.3, 0);
  const cols = ['#ff5a7a', '#ffd23f', '#ffffff', '#b98cff', '#ff8a3d', '#ff6fae'];
  for (let i = 0; i < 12; i++) {
    const x = -0.75 + (i % 6) * 0.3, z = i < 6 ? -0.15 : 0.15, h = 0.42 + ((i * 7) % 5) * 0.04;
    rod(g, [x, 0.3, z], [x, h, z], 0.012, P('#4c9a45'));
    if (i % 2) sc(put(g, sph(0.06, 10, 8), cols[i % cols.length], x, h + 0.04, z), 1, 1.3, 1);
    else flower(g, x, h, z, cols[i % cols.length], 0.07);
  }
  for (let i = 0; i < 6; i++) sc(put(g, ico(0.09, 0), LEAF, -0.75 + i * 0.3, 0.36, (i % 2 ? 1 : -1) * 0.28), 1, 0.6, 1);
  return g;
};

B.gardenlamp = () => {
  const g = new THREE.Group();
  put(g, cyl(0.16, 0.2, 0.08, 12), '#3a3f4a', 0, 0.04, 0);
  put(g, cyl(0.035, 0.045, 1.25, 8), METAL(), 0, 0.68, 0);
  put(g, cyl(0.13, 0.1, 0.05, 6), '#3a3f4a', 0, 1.32, 0);
  put(g, cyl(0.1, 0.1, 0.22, 6), glow('#fff3c8', '#ffcf7a', 1.8), 0, 1.45, 0);
  put(g, cone(0.17, 0.16, 6), '#3a3f4a', 0, 1.64, 0);
  put(g, sph(0.03, 8, 6), '#3a3f4a', 0, 1.74, 0);
  for (const s of [-1, 1]) put(g, ico(0.12, 1), LEAF, s * 0.16, 0.12, 0.05);
  g.userData.light = { y: 1.45, color: '#ffc27a', intensity: 2.5, distance: 3.5 };
  return g;
};

B.birdbath = () => {
  const g = new THREE.Group();
  put(g, cyl(0.24, 0.28, 0.08, 14), STONE, 0, 0.04, 0);
  put(g, cyl(0.07, 0.11, 0.62, 12), STONE, 0, 0.39, 0);
  put(g, cyl(0.36, 0.16, 0.14, 18), STONE, 0, 0.75, 0);
  put(g, cyl(0.3, 0.3, 0.02, 18), mat('#7fc8e8', { r: 0.1, m: 0.2, e: '#0a3550', ei: 0.3 }), 0, 0.8, 0);
  const bird = dyn(grp(0.26, 0.82, 0));
  sc(put(bird, sph(0.07, 12, 10), '#3f8fe0', 0, 0.06, 0), 1, 0.85, 1.25);
  put(bird, sph(0.05, 10, 8), '#3f8fe0', 0, 0.12, 0.07);
  put(bird, cone(0.02, 0.05, 6), '#ffb03a', 0, 0.12, 0.13, PI / 2);
  put(bird, sph(0.03, 8, 6), '#ffd8a0', 0, 0.05, 0.06);
  g.add(bird);
  g.userData.animate = (t) => {
    const hop = Math.max(0, Math.sin(t * 2.6)) ** 8;
    bird.position.y = 0.82 + hop * 0.12;
    bird.rotation.y = Math.sin(t * 0.7) * 1.2;
    bird.rotation.x = Math.max(0, Math.sin(t * 1.3)) ** 6 * 0.6;
  };
  return g;
};

B.veggies = () => {
  const g = new THREE.Group();
  put(g, rbox(1.85, 0.12, 1.85, 0.04, 1), '#6a4a33', 0, 0.06, 0);
  for (const z of [-0.6, 0, 0.6]) put(g, box(1.7, 0.06, 0.32), '#7a5538', 0, 0.13, z);
  for (let i = 0; i < 5; i++) {
    const x = -0.7 + i * 0.35;
    sc(put(g, ico(0.14, 1), '#8fd36a', x, 0.24, -0.6), 1, 0.75, 1);
    put(g, ico(0.09, 1), '#b8ec8a', x, 0.3, -0.6);
    put(g, cone(0.04, 0.16, 6), '#ff8a3d', x, 0.2, 0, PI);
    for (let k = 0; k < 3; k++) put(g, cone(0.02, 0.14, 4), '#4fa35a', x + (k - 1) * 0.03, 0.3, 0, (k - 1) * 0.3);
    rod(g, [x, 0.13, 0.6], [x, 0.7, 0.6], 0.015, P(WOOD));
    put(g, ico(0.1, 1), LEAF, x, 0.45, 0.62);
    for (let k = 0; k < 3; k++) put(g, sph(0.05, 8, 6), '#e8343f', x + (k - 1) * 0.06, 0.35 + k * 0.1, 0.68);
  }
  return g;
};

B.appletree = () => {
  const g = new THREE.Group();
  put(g, cyl(0.12, 0.16, 1.1, 8), '#7c5236', 0, 0.55, 0);
  rod(g, [0, 0.9, 0], [0.25, 1.25, 0.05], 0.06, P('#7c5236'));
  rod(g, [0, 0.95, 0], [-0.22, 1.3, -0.05], 0.05, P('#7c5236'));
  const leaf = [P('#4f9a45', 0.85), P('#6cb854', 0.85), P('#86cc62', 0.85)];
  for (const [x, y, z, r, k] of [[0, 1.55, 0, 0.55, 0], [0.32, 1.42, 0.12, 0.38, 1], [-0.3, 1.45, -0.1, 0.4, 1], [0.05, 1.85, 0.05, 0.36, 2], [0.1, 1.4, -0.3, 0.32, 2]]) put(g, ico(r, 1), leaf[k], x, y, z);
  const rnd = (i) => Math.sin(i * 12.9898) * 0.5 + 0.5;
  for (let i = 0; i < 12; i++) {
    const a = rnd(i) * TAU, y = 1.3 + rnd(i + 3) * 0.6, rr = 0.48 - Math.abs(y - 1.55) * 0.3;
    put(g, sph(0.065, 10, 8), '#e8343f', Math.cos(a) * rr, y, Math.sin(a) * rr);
  }
  for (let i = 0; i < 3; i++) put(g, sph(0.065, 10, 8), '#e8343f', -0.3 + i * 0.25, 0.06, 0.35 - i * 0.1);
  return g;
};

B.topiary = () => {
  const g = new THREE.Group();
  put(g, cyl(0.3, 0.24, 0.32, 14), '#c96a43', 0, 0.16, 0);
  put(g, torus(0.3, 0.03, 6, 16), '#b65b38', 0, 0.32, 0, PI / 2);
  const hedge = [P('#3f8f45', 0.9), P('#5aa84e', 0.9)];
  sc(put(g, ico(0.3, 2), hedge[0], 0, 0.62, -0.05), 1, 0.75, 1.35);
  for (const s of [-1, 1]) sc(put(g, ico(0.2, 1), hedge[1], s * 0.2, 0.7, -0.1), 0.6, 0.6, 1.2);
  rod(g, [0, 0.7, 0.25], [0, 1.15, 0.32], 0.07, hedge[0]);
  sc(put(g, ico(0.13, 1), hedge[0], 0, 1.2, 0.36), 1, 0.9, 1.3);
  put(g, cone(0.04, 0.12, 6), '#ffb03a', 0, 1.2, 0.5, PI / 2);
  return g;
};

B.fairyarch = () => {
  const g = new THREE.Group();
  const white = P(WHITE, 0.5);
  for (const s of [-1, 1]) {
    put(g, box(0.1, 1.7, 0.4), white, s * 0.85, 0.85, 0);
    for (let i = 0; i < 6; i++) put(g, box(0.02, 1.6, 0.02), white, s * 0.85, 0.85, -0.18 + i * 0.07);
  }
  put(g, torus(0.85, 0.06, 8, 20, PI), white, 0, 1.7, 0);
  const roses = [P('#ff5a7a'), P('#ffffff'), P('#ff8fb0')];
  for (let i = 0; i < 16; i++) {
    const a = (i / 15) * PI;
    const x = Math.cos(a) * 0.86, y = 1.7 + Math.sin(a) * 0.86;
    put(g, ico(0.09, 1), LEAF, x, y, 0.06);
    if (i % 2) put(g, sph(0.05, 8, 6), roses[i % 3], x, y + 0.03, 0.12);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) put(g, ico(0.08, 1), LEAF2, s * 0.88, 0.3 + i * 0.3, 0.12);
  const bulb = glow('#fff6c8', '#ffd27a', 2);
  for (let i = 0; i < 14; i++) {
    const a = (i / 13) * PI;
    put(g, sph(0.028, 6, 5), bulb, Math.cos(a) * 0.74, 1.7 + Math.sin(a) * 0.74, 0.08, 0, 0, 0).castShadow = false;
  }
  g.userData.light = { y: 2.1, color: '#ffd9a0', intensity: 2.2, distance: 3.5 };
  g.userData.animate = (t) => { bulb.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.6; };
  return g;
};

B.pond = () => {
  const g = new THREE.Group();
  const rnd = (i) => Math.sin(i * 78.233) * 0.5 + 0.5;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    sc(put(g, ico(0.16 + rnd(i) * 0.06, 0), P(['#b5ada0', '#c9c2b5', '#a39b8e'][i % 3], 0.9), Math.cos(a) * 0.85, 0.08, Math.sin(a) * 0.75), 1, 0.6, 1);
  }
  const water = put(g, cyl(0.82, 0.82, 0.04, 28), mat('#4fa8d8', { r: 0.08, m: 0.2, e: '#0a3550', ei: 0.35 }), 0, 0.06, 0);
  water.scale.z = 0.88;
  for (const [x, z, s] of [[-0.35, 0.2, 1], [0.3, -0.25, 0.8], [0.1, 0.4, 0.7]]) {
    const pad = put(g, cyl(0.14 * s, 0.14 * s, 0.01, 12, false, 0.3, TAU - 0.5), P('#4fa35a', 0.8), x, 0.085, z);
    pad.castShadow = false;
    if (s === 1) put(g, sph(0.05, 8, 6), '#ff9ac0', x + 0.04, 0.12, z);
  }
  const koi = [];
  for (let i = 0; i < 3; i++) {
    const f = dyn(grp(0, 0.075, 0));
    sc(put(f, sph(0.06, 10, 8), i === 1 ? '#ffffff' : '#ff8a1a', 0, 0, 0, 0, 0, 0), 0.6, 0.4, 1.5);
    put(f, cone(0.04, 0.08, 6), i === 1 ? '#ff8a1a' : '#ffffff', 0, 0, -0.1, -PI / 2);
    g.add(f);
    koi.push(f);
  }
  g.userData.animate = (t) => {
    koi.forEach((f, i) => {
      const a = t * (0.35 + i * 0.08) + i * 2.1, r = 0.45 + i * 0.08;
      f.position.set(Math.cos(a) * r, 0.075, Math.sin(a) * r * 0.85);
      f.rotation.y = -a;
    });
  };
  return g;
};

B.picnic = () => {
  const g = new THREE.Group();
  const tex = gingham();
  const cloth = put(g, box(1.8, 0.02, 1.6), mat('#ffffff', { map: tex, mapKey: 'home-gingham', r: 0.9 }), 0, 0.01, 0);
  cloth.castShadow = false;
  put(g, rbox(0.5, 0.3, 0.34, 0.05, 1), '#c99a5a', 0.4, 0.17, -0.3);
  put(g, torus(0.2, 0.025, 6, 16, PI), '#a8743f', 0.4, 0.32, -0.3);
  put(g, box(0.52, 0.03, 0.36), '#e8483b', 0.4, 0.3, -0.3);
  put(g, cyl(0.1, 0.12, 0.3, 12), mat('#fff6c8', { op: 0.6, r: 0.1 }), -0.35, 0.15, -0.25);
  put(g, cyl(0.09, 0.09, 0.2, 12), '#ffe066', -0.35, 0.11, -0.25);
  for (const [x, z] of [[-0.3, 0.3], [0.1, 0.35]]) {
    put(g, cyl(0.16, 0.16, 0.02, 16), WHITE, x, 0.03, z);
    put(g, sph(0.06, 8, 6), '#e8343f', x, 0.07, z);
  }
  put(g, cyl(0.15, 0.15, 0.06, 16), '#f2b45a', 0.5, 0.06, 0.35);
  return g;
};

let ginghamTex = null;
function gingham() {
  if (ginghamTex) return ginghamTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(232, 72, 59, 0.55)';
  for (let i = 0; i < 64; i += 16) { x.fillRect(i, 0, 8, 64); x.fillRect(0, i, 64, 8); }
  ginghamTex = new THREE.CanvasTexture(c);
  ginghamTex.colorSpace = THREE.SRGBColorSpace;
  ginghamTex.wrapS = ginghamTex.wrapT = THREE.RepeatWrapping;
  ginghamTex.repeat.set(4, 4);
  return ginghamTex;
}

B.lounger = () => {
  const g = new THREE.Group();
  const frame = P(WHITE, 0.4);
  for (const x of [-0.32, 0.32]) {
    rod(g, [x, 0.06, -0.8], [x, 0.3, -0.8], 0.025, frame);
    rod(g, [x, 0.06, 0.55], [x, 0.3, 0.55], 0.025, frame);
    rod(g, [x, 0.3, -0.85], [x, 0.3, 0.3], 0.025, frame);
  }
  const cushion = [P('#3fb6c8', 0.8), P(WHITE, 0.8)];
  for (let i = 0; i < 5; i++) put(g, rbox(0.62, 0.1, 0.24, 0.04, 1), cushion[i % 2], 0, 0.36, -0.75 + i * 0.24);
  const back = grp(0, 0.36, 0.38, 0);
  back.rotation.x = -0.9;
  for (let i = 0; i < 2; i++) put(back, rbox(0.62, 0.1, 0.24, 0.04, 1), cushion[i % 2], 0, 0, 0.12 + i * 0.24);
  g.add(back);
  put(g, cyl(0.15, 0.15, 0.03, 14), WHITE, 0.55, 0.42, -0.4);
  rod(g, [0.55, 0, -0.4], [0.55, 0.42, -0.4], 0.02, frame);
  put(g, cyl(0.04, 0.035, 0.14, 10), mat('#ffb03a', { op: 0.7, r: 0.1 }), 0.55, 0.51, -0.4);
  put(g, cyl(0.004, 0.004, 0.16, 4), '#ff5a7a', 0.57, 0.56, -0.4, 0, 0, 0.3);
  return g;
};

B.patio = () => {
  const g = new THREE.Group();
  put(g, cyl(0.45, 0.45, 0.04, 22), P(WHITE, 0.4), 0, 0.72, 0);
  put(g, cyl(0.04, 0.06, 0.7, 8), METAL(), 0, 0.36, 0);
  put(g, cyl(0.22, 0.25, 0.03, 14), METAL(), 0, 0.015, 0);
  for (const s of [-1, 1]) {
    const ch = grp(s * 0.72, 0, 0, s > 0 ? -PI / 2 : PI / 2);
    put(ch, rbox(0.42, 0.06, 0.42, 0.02, 1), '#3fb6c8', 0, 0.44, 0);
    for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) rod(ch, [x, 0, z], [x, 0.44, z], 0.018, METAL());
    put(ch, rbox(0.42, 0.36, 0.05, 0.03, 1), P(WHITE, 0.5), 0, 0.68, -0.19);
    g.add(ch);
  }
  rod(g, [0, 0.74, 0], [0, 2.1, 0], 0.022, P(WHITE, 0.4));
  for (let i = 0; i < 8; i++) put(g, cyl(0.04, 0.95, 0.32, 3, false, (i / 8) * TAU, TAU / 8), P(i % 2 ? WHITE : '#ff8a3d', 0.6), 0, 2.0, 0);
  put(g, sph(0.04, 8, 6), GOLD(), 0, 2.18, 0);
  put(g, cyl(0.05, 0.04, 0.12, 10), mat('#bfe8ff', { op: 0.6, r: 0.1 }), 0.15, 0.8, 0.1);
  put(g, sph(0.07, 10, 8), '#ffd23f', -0.12, 0.79, -0.08);
  return g;
};

B.swingbench = () => {
  const g = new THREE.Group();
  const wood = P(WOOD, 0.7);
  for (const s of [-1, 1]) {
    rod(g, [s * 0.95, 0, -0.35], [s * 0.85, 1.6, 0], 0.045, wood);
    rod(g, [s * 0.95, 0, 0.35], [s * 0.85, 1.6, 0], 0.045, wood);
  }
  rod(g, [-0.9, 1.6, 0], [0.9, 1.6, 0], 0.05, wood);
  const seat = dyn(grp(0, 1.6, 0));
  for (const s of [-1, 1]) rod(seat, [s * 0.6, 0, 0], [s * 0.6, -1.1, 0], 0.01, P('#3a3a3a'));
  put(seat, rbox(1.3, 0.08, 0.45, 0.03, 1), wood, 0, -1.12, 0);
  put(seat, rbox(1.3, 0.45, 0.06, 0.03, 1), wood, 0, -0.88, -0.21);
  put(seat, rbox(1.2, 0.08, 0.4, 0.04, 1), '#ff8fb0', 0, -1.05, 0.02);
  put(seat, rbox(0.3, 0.3, 0.12, 0.08, 2), '#ffd23f', -0.4, -0.88, -0.12);
  g.add(seat);
  g.userData.animate = (t) => { seat.rotation.x = Math.sin(t * 1.1) * 0.1; };
  return g;
};

B.firepit = () => {
  const g = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    put(g, rbox(0.24, 0.2, 0.16, 0.05, 1), ['#a39b8e', '#b5ada0', '#8f877c'][i % 3], Math.cos(a) * 0.38, 0.1, Math.sin(a) * 0.38, 0, -a, 0);
  }
  put(g, cyl(0.32, 0.32, 0.04, 16), '#2a2220', 0, 0.06, 0);
  for (let i = 0; i < 3; i++) rod(g, [Math.cos(i * 2.1) * 0.22, 0.08, Math.sin(i * 2.1) * 0.22], [-Math.cos(i * 2.1) * 0.1, 0.22, -Math.sin(i * 2.1) * 0.1], 0.045, P('#6b4226', 0.9));
  const flames = [];
  const fm = [glow('#ffd04a', '#ffb020', 2.2), glow('#ff7a2a', '#ff5a1a', 2)];
  for (let i = 0; i < 4; i++) {
    const f = dyn(mesh(cone(0.09 - (i % 2) * 0.02, 0.32, 7), fm[i % 2], Math.cos(i * 1.6) * 0.07, 0.3, Math.sin(i * 1.6) * 0.07, false));
    g.add(f);
    flames.push(f);
  }
  for (const [x, z] of [[-0.75, 0.55], [0.75, 0.55], [0, -0.8]]) {
    put(g, cyl(0.17, 0.19, 0.38, 12), P('#9a6b3c', 0.9), x, 0.19, z);
    put(g, cyl(0.15, 0.15, 0.01, 12), '#e8c690', x, 0.385, z);
  }
  g.userData.light = { y: 0.6, color: '#ff9a40', intensity: 3.5, distance: 4 };
  g.userData.animate = (t) => {
    flames.forEach((f, i) => {
      const k = 0.8 + Math.sin(t * 9 + i * 2.1) * 0.15 + Math.sin(t * 15.3 + i) * 0.1;
      f.scale.set(1 - (k - 0.8) * 0.5, k, 1 - (k - 0.8) * 0.5);
      f.position.y = 0.16 + k * 0.16;
    });
  };
  return g;
};

B.sandbox = () => {
  const g = new THREE.Group();
  for (const [x, z, w, d] of [[0, -0.82, 1.84, 0.16], [0, 0.82, 1.84, 0.16], [-0.84, 0, 0.16, 1.5], [0.84, 0, 0.16, 1.5]]) put(g, rbox(w, 0.22, d, 0.03, 1), WOOD, x, 0.11, z);
  put(g, box(1.52, 0.12, 1.5), '#f4d896', 0, 0.08, 0);
  put(g, cyl(0.22, 0.28, 0.2, 4), '#f0cf86', -0.3, 0.24, -0.2, 0, PI / 4, 0);
  put(g, cyl(0.15, 0.18, 0.18, 4), '#f0cf86', -0.3, 0.42, -0.2, 0, PI / 4, 0);
  put(g, cone(0.04, 0.12, 6), '#e8343f', -0.3, 0.57, -0.2);
  put(g, cyl(0.1, 0.08, 0.14, 12), '#2f8cf0', 0.35, 0.21, 0.3);
  put(g, torus(0.08, 0.008, 4, 12, PI), '#2f8cf0', 0.35, 0.28, 0.3);
  put(g, box(0.05, 0.02, 0.24), '#ffd23f', 0.1, 0.16, 0.4, 0, 0.6, 0);
  sc(put(g, sph(0.08, 8, 6), '#ffd23f', 0.0, 0.16, 0.52), 1, 0.4, 1.2);
  return g;
};

B.hoop = () => {
  const g = new THREE.Group();
  put(g, rbox(0.5, 0.12, 0.5, 0.04, 1), '#2a2c33', 0, 0.06, -0.2);
  rod(g, [0, 0.1, -0.2], [0, 2.3, -0.2], 0.05, METAL());
  rod(g, [0, 2.3, -0.2], [0, 2.3, 0.05], 0.04, METAL());
  put(g, rbox(0.9, 0.6, 0.05, 0.03, 1), P(WHITE, 0.4), 0, 2.5, 0.08);
  put(g, box(0.34, 0.24, 0.02), '#e8483b', 0, 2.42, 0.11).castShadow = false;
  put(g, box(0.3, 0.2, 0.025), WHITE, 0, 2.42, 0.115).castShadow = false;
  put(g, torus(0.17, 0.015, 6, 20), '#ff6a2a', 0, 2.25, 0.3, PI / 2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    rod(g, [Math.cos(a) * 0.17, 2.25, 0.3 + Math.sin(a) * 0.17], [Math.cos(a) * 0.1, 1.98, 0.3 + Math.sin(a) * 0.1], 0.006, P(WHITE));
  }
  put(g, sph(0.12, 14, 10), '#ff8a3d', 0.3, 0.12, 0.35);
  return g;
};

B.minigolf = () => {
  const g = new THREE.Group();
  const green = put(g, rbox(1.84, 0.06, 0.8, 0.2, 2), P('#4fc06a', 0.9), 0, 0.03, 0);
  green.castShadow = false;
  put(g, cyl(0.06, 0.06, 0.07, 12), '#1a1a1a', 0.6, 0.04, 0);
  rod(g, [0.6, 0.06, 0], [0.6, 0.8, 0], 0.012, P(WHITE));
  put(g, box(0.02, 0.16, 0.24), '#ff3a5a', 0.6, 0.72, 0.12).castShadow = false;
  put(g, sph(0.035, 10, 8), WHITE, -0.55, 0.1, 0.05);
  rod(g, [-0.7, 0.07, -0.2], [-0.45, 0.6, -0.32], 0.012, P('#bfc5cc', 0.3, 0.6));
  put(g, box(0.12, 0.05, 0.04), '#3a3a3a', -0.72, 0.06, -0.18);
  for (const [x, z] of [[-0.1, -0.25], [0.15, 0.22]]) put(g, cyl(0.12, 0.14, 0.1, 10), '#f4d896', x, 0.06, z);
  return g;
};

B.slide = () => {
  const g = new THREE.Group();
  const metal = P('#2f8cf0', 0.4, 0.3);
  for (const s of [-1, 1]) rod(g, [s * 0.22, 0, -0.85], [s * 0.22, 1.25, -0.85], 0.035, metal);
  for (let i = 0; i < 5; i++) rod(g, [-0.22, 0.2 + i * 0.24, -0.85], [0.22, 0.2 + i * 0.24, -0.85], 0.02, P(WHITE));
  put(g, rbox(0.56, 0.06, 0.5, 0.02, 1), metal, 0, 1.25, -0.65);
  const ch = grp(0, 1.25, -0.4);
  ch.rotation.x = 0.72;
  put(ch, rbox(0.46, 0.04, 1.45, 0.02, 1), P('#ffd23f', 0.3), 0, 0, 0.72);
  for (const s of [-1, 1]) put(ch, rbox(0.04, 0.12, 1.45, 0.02, 1), P('#ffb01a', 0.3), s * 0.23, 0.05, 0.72);
  g.add(ch);
  put(g, rbox(0.5, 0.05, 0.25, 0.02, 1), P('#ffd23f', 0.3), 0, 0.12, 0.9);
  for (const s of [-1, 1]) rod(g, [s * 0.22, 0, 0.75], [s * 0.22, 0.3, 0.75], 0.03, metal);
  return g;
};

B.swingset = () => {
  const g = new THREE.Group();
  const frame = P('#e8483b', 0.4, 0.3);
  for (const s of [-1, 1]) {
    rod(g, [s * 1.4, 0, -0.45], [s * 1.35, 1.8, 0], 0.045, frame);
    rod(g, [s * 1.4, 0, 0.45], [s * 1.35, 1.8, 0], 0.045, frame);
  }
  rod(g, [-1.38, 1.8, 0], [1.38, 1.8, 0], 0.05, frame);
  const swings = [];
  for (const [x, c, ph] of [[-0.55, '#2f8cf0', 0], [0.55, '#ffd23f', 1.7]]) {
    const s = dyn(grp(x, 1.8, 0));
    for (const dx of [-0.2, 0.2]) rod(s, [dx, 0, 0], [dx, -1.35, 0], 0.008, P('#4a4a4a'));
    put(s, rbox(0.5, 0.05, 0.2, 0.02, 1), c, 0, -1.37, 0);
    s.userData.ph = ph;
    g.add(s);
    swings.push(s);
  }
  g.userData.animate = (t) => { for (const s of swings) s.rotation.x = Math.sin(t * 1.6 + s.userData.ph) * 0.35; };
  return g;
};

B.telescope = () => {
  const g = new THREE.Group();
  const leg = P('#5a4030', 0.6);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    rod(g, [Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38], [0, 0.95, 0], 0.025, leg);
  }
  put(g, sph(0.06, 10, 8), GOLD(), 0, 0.98, 0);
  const tube = grp(0, 1.02, 0);
  tube.rotation.x = -0.6;
  put(tube, cyl(0.08, 0.1, 0.9, 16), P('#2b2d5c', 0.3, 0.4), 0, 0, 0.1, PI / 2);
  put(tube, cyl(0.105, 0.105, 0.05, 16), GOLD(), 0, 0, 0.55, PI / 2);
  put(tube, cyl(0.085, 0.085, 0.05, 16), GOLD(), 0, 0, -0.33, PI / 2);
  put(tube, cyl(0.03, 0.03, 0.12, 8), '#1d1a2f', 0, 0, -0.42, PI / 2);
  put(tube, cyl(0.025, 0.025, 0.3, 8), P('#2b2d5c', 0.3), 0, 0.12, 0.05, PI / 2);
  g.add(tube);
  return g;
};

B.pizzaoven = () => {
  const g = new THREE.Group();
  put(g, rbox(0.95, 0.7, 0.95, 0.05, 1), '#b5aa9a', 0, 0.35, 0);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) put(g, rbox(0.21, 0.11, 0.04, 0.02, 1), ['#c8705a', '#b85f4a'][(r + i) % 2], -0.33 + i * 0.22 + (r % 2) * 0.1, 0.12 + r * 0.2, 0.48);
  put(g, sph(0.44, 18, 12, 0, TAU, 0, PI / 2), '#c8705a', 0, 0.7, -0.02);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, el = 0.25 + (i % 3) * 0.35;
    put(g, rbox(0.12, 0.06, 0.03, 0.01, 1), '#a85a45', Math.cos(a) * Math.cos(el) * 0.445, 0.7 + Math.sin(el) * 0.445, Math.sin(a) * Math.cos(el) * 0.445 - 0.02, 0, -a + PI / 2, 0);
  }
  put(g, cyl(0.2, 0.2, 0.2, 16, false, -PI / 2, PI), '#1b1210', 0, 0.7, 0.32, -PI / 2);
  const ember = glow('#ffb04a', '#ff7a1a', 1.8);
  put(g, sph(0.12, 10, 8, 0, TAU, 0, PI / 2), ember, 0, 0.71, 0.3).castShadow = false;
  put(g, cyl(0.07, 0.08, 0.35, 10), '#8f877c', 0.15, 1.2, -0.15);
  rod(g, [0.5, 0.02, 0.5], [0.42, 0.9, 0.62], 0.015, P(WOOD));
  put(g, cyl(0.12, 0.12, 0.02, 12), P(WOOD), 0.42, 0.96, 0.63, 0.4);
  g.userData.light = { y: 0.8, color: '#ff9a40', intensity: 2.5, distance: 3 };
  g.userData.animate = (t) => { ember.emissiveIntensity = 1.6 + Math.sin(t * 7) * 0.3 + Math.sin(t * 13) * 0.2; };
  g.userData.smoke = { x: 0.15, y: 1.4, z: -0.15 };
  return g;
};

B.movie = () => {
  const g = new THREE.Group();
  const frame = P('#2a2c33', 0.4, 0.4);
  for (const s of [-1, 1]) {
    rod(g, [s * 0.9, 0, -0.25], [s * 0.9, 1.9, 0], 0.04, frame);
    rod(g, [s * 0.9, 0, 0.25], [s * 0.9, 1.9, 0], 0.04, frame);
  }
  put(g, rbox(1.9, 1.1, 0.06, 0.03, 1), frame, 0, 1.4, 0);
  const screen = glow('#4a6cc8', '#3f5fd0', 0.9);
  put(g, box(1.76, 0.96, 0.02), screen, 0, 1.4, 0.035).castShadow = false;
  const shapes = dyn(grp(0, 1.4, 0.05));
  const cols = [glow('#ffd23f', '#ffc21a', 1.6), glow('#ff6fae', '#ff3f8a', 1.6), glow('#7fd833', '#5fc21a', 1.6)];
  for (let i = 0; i < 3; i++) shapes.add(mesh(sph(0.12, 12, 8), cols[i], -0.4 + i * 0.4, 0, 0, false));
  g.add(shapes);
  for (const [x, z, c] of [[-0.45, 0.65, '#e8483b'], [0.45, 0.65, '#2f8cf0']]) {
    put(g, rbox(0.55, 0.22, 0.5, 0.12, 2), c, x, 0.11, z);
    put(g, rbox(0.55, 0.25, 0.14, 0.08, 2), c, x, 0.3, z + 0.2);
  }
  put(g, cyl(0.1, 0.08, 0.18, 10), '#e8483b', 0, 0.09, 0.7);
  for (let i = 0; i < 6; i++) put(g, ico(0.035, 0), '#fff6d8', Math.cos(i) * 0.05, 0.2, 0.7 + Math.sin(i) * 0.05);
  g.userData.light = { y: 1.3, color: '#8aa8ff', intensity: 2.5, distance: 3.5 };
  g.userData.animate = (t) => {
    shapes.children.forEach((s, i) => {
      s.position.set(Math.sin(t * (0.8 + i * 0.3) + i * 2) * 0.62, Math.cos(t * (1.1 + i * 0.2) + i) * 0.3, 0);
    });
    screen.emissive.setHSL((t * 0.05) % 1, 0.6, 0.35);
  };
  return g;
};

B.foodbowls = () => {
  const g = new THREE.Group();
  put(g, rbox(0.7, 0.04, 0.42, 0.03, 1), '#e8483b', 0, 0.02, 0);
  for (const [x, c, fill] of [[-0.17, '#2f8cf0', '#7fc8e8'], [0.17, '#ffd23f', '#b5773f']]) {
    put(g, cyl(0.14, 0.11, 0.1, 16), c, x, 0.09, 0);
    put(g, cyl(0.12, 0.12, 0.01, 16), fill, x, 0.135, 0);
  }
  for (let i = 0; i < 5; i++) put(g, sph(0.018, 6, 5), '#8a5a33', 0.15 + (i % 3) * 0.03, 0.15, -0.03 + (i % 2) * 0.05);
  rod(g, [-0.3, 0.05, 0.25], [-0.1, 0.05, 0.3], 0.025, P(WHITE));
  for (const [x, z] of [[-0.3, 0.25], [-0.1, 0.3]]) put(g, sph(0.04, 8, 6), WHITE, x, 0.05, z);
  return g;
};

B.petbed = () => {
  const g = new THREE.Group();
  put(g, torus(0.32, 0.12, 10, 22), P('#9b5cf6', 0.85), 0, 0.12, 0, PI / 2);
  put(g, cyl(0.32, 0.34, 0.08, 20), P('#c9a8ff', 0.9), 0, 0.06, 0);
  for (let i = 0; i < 6; i++) put(g, sph(0.03, 6, 5), WHITE, Math.cos(i) * 0.2, 0.11, Math.sin(i) * 0.2);
  put(g, sph(0.08, 12, 10), '#ff6a4a', 0.15, 0.17, -0.05);
  return g;
};

B.agility = () => {
  const g = new THREE.Group();
  for (const x of [-0.5, 0.5]) {
    for (const s of [-1, 1]) {
      put(g, cyl(0.07, 0.09, 0.06, 10), '#2a2c33', x + s * 0.3, 0.03, 0);
      rod(g, [x + s * 0.3, 0, 0], [x + s * 0.3, 0.55, 0], 0.025, P(WHITE));
    }
    for (let i = 0; i < 4; i++) rod(g, [x - 0.3, 0.12 + i * 0.12, 0], [x + 0.3, 0.12 + i * 0.12, 0], 0.012, P(i % 2 ? '#ff3a5a' : WHITE));
    put(g, cyl(0.025, 0.025, 0.62, 8), P('#ffd23f'), x, 0.4, 0.02, 0, 0, PI / 2);
  }
  return g;
};

B.cattree = () => {
  const g = new THREE.Group();
  const carpet = [P('#c9b48f', 0.95), P('#a8946f', 0.95)];
  put(g, rbox(0.8, 0.1, 0.8, 0.04, 1), carpet[0], 0, 0.05, 0);
  for (const [x, z, h] of [[-0.25, -0.25, 1.4], [0.25, 0.2, 0.9]]) {
    put(g, cyl(0.07, 0.07, h, 10), P('#e8d8b8', 0.95), x, h / 2, z);
    for (let i = 0; i < 8; i++) put(g, torus(0.071, 0.008, 4, 12), '#b8a27c', x, 0.15 + i * (h / 9), z, PI / 2);
  }
  put(g, rbox(0.55, 0.08, 0.45, 0.04, 1), carpet[1], -0.15, 1.42, -0.2);
  put(g, rbox(0.5, 0.08, 0.45, 0.04, 1), carpet[0], 0.2, 0.92, 0.15);
  put(g, cyl(0.24, 0.24, 0.32, 16), carpet[1], 0.18, 0.45, 0.25);
  put(g, cyl(0.1, 0.1, 0.02, 12), '#3a2a24', 0.18, 0.45, 0.49, PI / 2);
  const toy = dyn(grp(0.45, 0.88, 0.15));
  rod(toy, [0, 0, 0], [0, -0.3, 0], 0.004, P('#3a3a3a'));
  sc(put(toy, sph(0.04, 8, 6), '#9aa3ad', 0, -0.32, 0), 1, 0.8, 1.4);
  g.add(toy);
  g.userData.animate = (t) => { toy.rotation.x = Math.sin(t * 2.2) * 0.25; toy.rotation.z = Math.sin(t * 1.7) * 0.2; };
  return g;
};

B.statue = () => {
  const g = new THREE.Group();
  const marble = P('#efece6', 0.35);
  put(g, rbox(0.7, 0.14, 0.7, 0.03, 1), marble, 0, 0.07, 0);
  put(g, rbox(0.56, 0.5, 0.56, 0.03, 1), marble, 0, 0.39, 0);
  put(g, rbox(0.64, 0.08, 0.64, 0.03, 1), marble, 0, 0.68, 0);
  put(g, box(0.3, 0.1, 0.02), GOLD(), 0, 0.42, 0.29);
  const s = P('#f7f5f0', 0.3);
  put(g, capsule(0.14, 0.24), s, 0, 1.0, 0);
  put(g, sph(0.12, 14, 12), s, 0, 1.32, 0);
  put(g, cyl(0.1, 0.09, 0.1, 14), s, 0, 1.46, 0);
  for (const [x, z] of [[-0.06, 0], [0.06, 0], [0, 0.05], [0, -0.05]]) put(g, sph(0.07, 10, 8), s, x, 1.55, z);
  rod(g, [0.12, 1.05, 0], [0.24, 1.38, 0.05], 0.045, s);
  rod(g, [0.24, 1.38, 0.05], [0.26, 1.72, 0.06], 0.012, s);
  sc(put(g, sph(0.05, 10, 8), s, 0.26, 1.76, 0.07), 1, 1.2, 0.6);
  rod(g, [-0.12, 1.05, 0], [-0.18, 0.86, 0.08], 0.045, s);
  for (const x of [-0.07, 0.07]) put(g, capsule(0.06, 0.16), s, x, 0.8, 0);
  return g;
};

B.fountain = () => {
  const g = new THREE.Group();
  const stone = P('#e3dccf', 0.6), stone2 = P('#cfc6b6', 0.6), water = mat('#59b3e0', { r: 0.08, m: 0.2, e: '#0a3550', ei: 0.4 });
  put(g, cyl(0.9, 0.95, 0.32, 24), stone, 0, 0.16, 0);
  put(g, torus(0.9, 0.06, 8, 28), stone2, 0, 0.32, 0, PI / 2);
  put(g, cyl(0.82, 0.82, 0.03, 24), water, 0, 0.29, 0);
  put(g, cyl(0.14, 0.18, 0.6, 12), stone2, 0, 0.6, 0);
  put(g, cyl(0.5, 0.2, 0.12, 18), stone, 0, 0.92, 0);
  put(g, cyl(0.44, 0.44, 0.02, 18), water, 0, 0.98, 0);
  put(g, cyl(0.08, 0.1, 0.4, 10), stone2, 0, 1.18, 0);
  put(g, cyl(0.28, 0.12, 0.08, 14), stone, 0, 1.4, 0);
  put(g, cyl(0.24, 0.24, 0.02, 14), water, 0, 1.44, 0);
  put(g, sph(0.08, 10, 8), stone2, 0, 1.52, 0);
  g.userData.spray = { y: 1.55 };
  return g;
};

B.gazebo = () => {
  const g = new THREE.Group();
  const white = P(WHITE, 0.5);
  put(g, cyl(1.42, 1.48, 0.16, 8), P('#d9cfc0', 0.8), 0, 0.08, 0);
  put(g, cyl(1.36, 1.36, 0.02, 8), P('#c79a68', 0.7), 0, 0.17, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + PI / 8;
    const x = Math.cos(a) * 1.3, z = Math.sin(a) * 1.3;
    put(g, cyl(0.06, 0.07, 1.9, 10), white, x, 1.12, z);
    if (i !== 1) {
      const b = (i / 8) * TAU + PI / 8 + PI / 8;
      const mx = Math.cos(b) * 1.22, mz = Math.sin(b) * 1.22;
      put(g, box(0.98, 0.06, 0.06), white, mx, 0.6, mz, 0, -b + PI / 2, 0);
      for (let k = -3; k <= 3; k++) put(g, box(0.03, 0.4, 0.03), white, mx + Math.cos(b + PI / 2) * k * 0.13, 0.38, mz + Math.sin(b + PI / 2) * k * 0.13);
    }
  }
  put(g, cyl(1.62, 1.62, 0.1, 8), white, 0, 2.08, 0);
  put(g, cone(1.75, 1.0, 8), P('#7fb8d8', 0.6), 0, 2.6, 0);
  put(g, cyl(0.06, 0.06, 0.4, 8), white, 0, 3.25, 0);
  put(g, sph(0.1, 10, 8), GOLD(), 0, 3.45, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + PI / 8;
    put(g, sph(0.045, 8, 6), glow('#fff3c8', '#ffcf7a', 1.6), Math.cos(a) * 1.5, 1.98, Math.sin(a) * 1.5).castShadow = false;
  }
  for (const a of [PI * 0.9, PI * 1.5]) {
    const x = Math.cos(a) * 0.9, z = Math.sin(a) * 0.9;
    put(g, rbox(0.9, 0.08, 0.36, 0.03, 1), P(WOOD, 0.7), x, 0.48, z, 0, -a + PI / 2, 0);
  }
  for (let i = 0; i < 5; i++) put(g, ico(0.14, 1), LEAF, Math.cos(i * 1.3) * 1.45, 0.3 + (i % 2) * 0.2, Math.sin(i * 1.3) * 1.45);
  g.userData.light = { y: 1.6, color: '#ffd9a0', intensity: 3, distance: 4.5 };
  return g;
};

B.balloon = () => {
  const g = new THREE.Group();
  put(g, rbox(0.6, 0.1, 0.6, 0.04, 1), '#7a5538', 0, 0.05, 0);
  for (const s of [-1, 1]) put(g, cyl(0.05, 0.05, 0.3, 8), '#5b3420', s * 0.6, 0.15, 0.6);
  const lift = dyn(grp(0, 0, 0));
  put(lift, rbox(0.62, 0.48, 0.62, 0.06, 2), P('#b07445', 0.85), 0, 1.0, 0);
  put(lift, torus(0.34, 0.04, 6, 16), P('#7a4a2e'), 0, 1.25, 0, PI / 2);
  for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) rod(lift, [x, 1.25, z], [x * 2.2, 2.0, z * 2.2], 0.01, P('#4a3a2a'));
  put(lift, cyl(0.12, 0.16, 0.12, 10), '#3a3f4a', 0, 1.42, 0);
  const cols = ['#e8343f', '#ffd23f', '#2f8cf0', '#2fbf5f', '#ff8a3d', '#9b5cf6'];
  for (let i = 0; i < 12; i++) {
    const seg = mesh(sph(1.1, 3, 14, (i / 12) * TAU, TAU / 12), P(cols[i % 6], 0.55), 0, 3.0, 0);
    seg.scale.set(1, 1.18, 1);
    lift.add(seg);
  }
  put(lift, cone(0.62, 0.7, 12), P('#e8343f', 0.55), 0, 1.95, 0, PI);
  g.add(lift);
  for (const s of [-1, 1]) rod(g, [s * 0.6, 0.25, 0.6], [s * 0.3, 0.8, 0.3], 0.006, P('#e8dcc0'));
  g.userData.animate = (t) => { lift.position.y = Math.sin(t * 0.7) * 0.12; lift.rotation.y = Math.sin(t * 0.3) * 0.15; };
  return g;
};

// ---- second batch
B.sunflowers = () => {
  const g = new THREE.Group();
  put(g, cyl(0.38, 0.42, 0.1, 14), '#6a4a33', 0, 0.05, 0);
  for (const [x, z, h] of [[-0.18, -0.14, 1.2], [0.16, -0.16, 1.32], [0.02, 0.1, 0.98], [-0.24, 0.16, 0.82], [0.24, 0.12, 0.9]]) {
    rod(g, [x, 0.08, z], [x, h, z], 0.022, P('#4c9a45'));
    for (const s of [-1, 1]) sc(put(g, sph(0.09, 8, 6), LEAF, x + s * 0.08, h * 0.5, z, 0, 0, s * 0.6), 1, 0.3, 0.6);
    const head = grp(x, h, z + 0.02);
    head.rotation.x = -0.35;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      put(head, sph(0.05, 6, 4), '#ffc21a', Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0, 0, 0, a).scale.set(1.6, 0.6, 0.3);
    }
    put(head, cyl(0.085, 0.085, 0.05, 12), '#6b3a1e', 0, 0, 0.012, PI / 2);
    g.add(head);
  }
  return g;
};

B.rosebush = () => {
  const g = new THREE.Group();
  put(g, cyl(0.3, 0.34, 0.08, 14), '#6a4a33', 0, 0.04, 0);
  for (const [x, y, z, r] of [[0, 0.42, 0, 0.36], [-0.18, 0.3, 0.12, 0.24], [0.2, 0.3, -0.1, 0.24], [0.08, 0.6, 0.06, 0.2]]) put(g, ico(r, 1), i2c(x + z, LEAF, '#3f8f4a'), x, y, z);
  const cols = ['#e8343f', '#ff6f8f', '#ff9ab0', '#ffffff'];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, el = 0.2 + (i % 4) * 0.28;
    put(g, sph(0.055, 8, 6), cols[i % cols.length], Math.cos(a) * Math.cos(el) * 0.36, 0.42 + Math.sin(el) * 0.32, Math.sin(a) * Math.cos(el) * 0.36);
  }
  return g;
};
function i2c(k, a, b) { return Math.abs(Math.round(k * 10)) % 2 ? a : b; }

B.stones = () => {
  const g = new THREE.Group();
  for (const [x, z, r] of [[-0.22, 0.24, 0.2], [0.16, -0.04, 0.22], [-0.12, -0.3, 0.17]]) put(g, cyl(r, r * 1.05, 0.05, 9), STONE, x, 0.025, z).castShadow = false;
  for (let i = 0; i < 7; i++) sc(put(g, sph(0.05, 6, 4), LEAF2, Math.cos(i * 2.1) * 0.36, 0.01, Math.sin(i * 2.1) * 0.36), 1, 0.35, 1).castShadow = false;
  return g;
};

B.scarecrow = () => {
  const g = new THREE.Group();
  rod(g, [0, 0, 0], [0, 1.45, 0], 0.035, P(WOOD));
  rod(g, [-0.5, 1.0, 0], [0.5, 1.0, 0], 0.03, P(WOOD));
  put(g, rbox(0.5, 0.48, 0.24, 0.06, 1), '#e8483b', 0, 0.86, 0);
  for (const x of [-0.12, 0.12]) put(g, box(0.02, 0.48, 0.25), '#a8302a', x, 0.86, 0);
  put(g, box(0.5, 0.02, 0.25), '#a8302a', 0, 0.9, 0);
  for (const s of [-1, 1]) {
    put(g, cyl(0.06, 0.06, 0.42, 8), '#e8483b', s * 0.36, 1.0, 0, 0, 0, PI / 2);
    for (let i = 0; i < 3; i++) put(g, cone(0.025, 0.12, 5), '#e8c45a', s * (0.58 + i * 0.01), 0.98 - i * 0.03, -0.03 + i * 0.03, 0, 0, s * (1.8 + i * 0.2));
  }
  put(g, sph(0.17, 12, 10), '#d9b98a', 0, 1.28, 0);
  for (const x of [-0.06, 0.06]) put(g, box(0.035, 0.035, 0.01), '#2a2420', x, 1.32, 0.165);
  put(g, box(0.12, 0.01, 0.01), '#2a2420', 0, 1.22, 0.16);
  put(g, cyl(0.3, 0.3, 0.025, 16), '#e8c45a', 0, 1.42, 0);
  put(g, cyl(0.13, 0.17, 0.16, 12), '#e8c45a', 0, 1.5, 0);
  put(g, cyl(0.172, 0.172, 0.04, 12), '#e8483b', 0, 1.46, 0);
  const crow = grp(0.46, 1.05, 0);
  sc(put(crow, sph(0.07, 8, 6), '#1d1a2f', 0, 0.05, 0), 1, 0.9, 1.3);
  put(crow, sph(0.045, 8, 6), '#1d1a2f', 0, 0.12, 0.07);
  put(crow, cone(0.018, 0.06, 5), '#ffc21a', 0, 0.12, 0.13, PI / 2);
  g.add(crow);
  return g;
};

B.beehive = () => {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) rod(g, [x, 0, z], [x, 0.3, z], 0.025, P(WOOD));
  put(g, box(0.62, 0.05, 0.5), WOOD, 0, 0.3, 0);
  for (let i = 0; i < 3; i++) put(g, rbox(0.56, 0.2, 0.44, 0.02, 1), i % 2 ? '#fff6dc' : WHITE, 0, 0.43 + i * 0.205, 0);
  put(g, rbox(0.66, 0.06, 0.54, 0.02, 1), '#d9a441', 0, 1.06, 0);
  put(g, box(0.18, 0.025, 0.02), '#2a2420', 0, 0.36, 0.22);
  put(g, cyl(0.07, 0.07, 0.12, 10), mat('#ffc21a', { op: 0.85, r: 0.15 }), 0.18, 0.39, 0.32);
  const bees = dyn(new THREE.Group());
  bees.position.set(0, 0.6, 0);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    sc(put(b, sph(0.03, 6, 4), '#ffc21a', 0, 0, 0), 1, 1, 1.3);
    put(b, box(0.062, 0.012, 0.012), '#1d1a2f', 0, 0, 0);
    bees.add(b);
  }
  g.add(bees);
  g.userData.animate = (t) => {
    bees.children.forEach((b, i) => {
      const a = t * (1.6 + i * 0.3) + i * 1.7;
      b.position.set(Math.cos(a) * (0.42 + (i % 2) * 0.12), Math.sin(t * 3 + i) * 0.12 + i * 0.05, Math.sin(a) * (0.36 + (i % 2) * 0.1));
      b.rotation.y = -a;
    });
  };
  return g;
};

B.windmill = () => {
  const g = new THREE.Group();
  put(g, cyl(0.2, 0.32, 1.1, 8), WHITE, 0, 0.55, 0);
  put(g, cone(0.27, 0.36, 8), '#c8443a', 0, 1.28, 0);
  put(g, rbox(0.14, 0.24, 0.03, 0.02, 1), '#4a6fa5', 0, 0.16, 0.29);
  for (const y of [0.5, 0.8]) put(g, rbox(0.1, 0.12, 0.03, 0.02, 1), '#7fc3e8', 0, y, 0.25 - (y - 0.5) * 0.12);
  const sails = dyn(grp(0, 1.12, 0.28));
  put(sails, cyl(0.045, 0.045, 0.08, 8), '#3a3f4a', 0, 0, 0, PI / 2);
  for (let i = 0; i < 4; i++) {
    const arm = grp(0, 0, 0.04);
    arm.rotation.z = (i / 4) * TAU;
    put(arm, box(0.03, 0.62, 0.02), WOOD, 0, 0.32, 0);
    put(arm, box(0.14, 0.44, 0.012), '#fff6e8', 0.08, 0.38, 0);
    sails.add(arm);
  }
  g.add(sails);
  g.userData.animate = (t) => { sails.rotation.z = t * 1.2; };
  return g;
};

B.well = () => {
  const g = new THREE.Group();
  put(g, cyl(0.38, 0.4, 0.5, 14), STONE, 0, 0.25, 0);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    put(g, rbox(0.17, 0.09, 0.08, 0.02, 1), i % 2 ? '#b5ada0' : '#d8d1c4', Math.cos(a) * 0.39, 0.12 + (i % 3) * 0.13, Math.sin(a) * 0.39, 0, -a, 0);
  }
  put(g, cyl(0.31, 0.31, 0.02, 14), '#2c5a7a', 0, 0.44, 0).castShadow = false;
  for (const s of [-1, 1]) rod(g, [s * 0.36, 0.5, 0], [s * 0.36, 1.25, 0], 0.035, P(WOOD));
  rod(g, [-0.38, 1.05, 0], [0.38, 1.05, 0], 0.025, P('#7a5538'));
  for (const s of [-1, 1]) put(g, box(0.92, 0.04, 0.42), '#8a4a35', 0, 1.33 + 0.0, s * 0.17, s * 0.55, 0, 0);
  rod(g, [0.05, 1.04, 0], [0.05, 0.75, 0], 0.006, P('#efe0c0'));
  put(g, cyl(0.08, 0.06, 0.12, 10), '#8a5a33', 0.05, 0.7, 0);
  return g;
};

B.greenhouse = () => {
  const g = new THREE.Group();
  const frame = P(WHITE, 0.4);
  const glass = mat('#d9f2ff', { op: 0.28, r: 0.05 });
  put(g, rbox(1.8, 0.16, 1.7, 0.03, 1), STONE, 0, 0.08, 0);
  for (const [x, z] of [[-0.86, -0.8], [0.86, -0.8], [-0.86, 0.8], [0.86, 0.8]]) put(g, box(0.05, 1.0, 0.05), frame, x, 0.66, z);
  for (const x of [-0.43, 0, 0.43]) for (const z of [-0.8, 0.8]) put(g, box(0.03, 1.0, 0.03), frame, x, 0.66, z);
  for (const z of [-0.4, 0, 0.4]) for (const x of [-0.86, 0.86]) put(g, box(0.03, 1.0, 0.03), frame, x, 0.66, z);
  for (const y of [0.16, 1.16]) {
    put(g, box(1.76, 0.04, 0.04), frame, 0, y, 0.8);
    put(g, box(1.76, 0.04, 0.04), frame, 0, y, -0.8);
    put(g, box(0.04, 0.04, 1.6), frame, 0.86, y, 0);
    put(g, box(0.04, 0.04, 1.6), frame, -0.86, y, 0);
  }
  for (const [w, x, z, ry] of [[1.72, 0, 0.8, 0], [1.72, 0, -0.8, 0], [1.56, 0.86, 0, PI / 2], [1.56, -0.86, 0, PI / 2]]) put(g, box(w, 1.0, 0.01), glass, x, 0.66, z, 0, ry, 0).castShadow = false;
  for (const s of [-1, 1]) {
    put(g, box(1.8, 0.012, 0.95), glass, 0, 1.42, s * 0.4, s * 0.58, 0, 0).castShadow = false;
    put(g, box(1.8, 0.04, 0.04), frame, 0, 1.68, 0);
    for (const x of [-0.86, 0, 0.86]) rod(g, [x, 1.16, s * 0.8], [x, 1.68, 0], 0.018, frame);
  }
  put(g, box(1.4, 0.06, 0.4), WOOD, 0, 0.55, -0.45);
  for (const x of [-0.5, 0.5]) put(g, box(0.05, 0.4, 0.38), WOOD, x, 0.35, -0.45);
  for (let i = 0; i < 5; i++) {
    const x = -0.56 + i * 0.28;
    put(g, cyl(0.08, 0.06, 0.12, 10), '#c8705a', x, 0.64, -0.45);
    put(g, ico(0.1, 0), i % 2 ? LEAF : LEAF2, x, 0.78, -0.45);
    if (i % 2 === 0) put(g, sph(0.035, 6, 5), '#e8343f', x + 0.05, 0.8, -0.38);
  }
  for (const x of [-0.4, 0.4]) {
    rod(g, [x, 0.16, 0.45], [x, 1.0, 0.45], 0.012, P('#7a5538'));
    for (let k = 0; k < 4; k++) {
      put(g, ico(0.08, 0), LEAF, x + (k % 2 ? 0.06 : -0.06), 0.35 + k * 0.17, 0.45);
      if (k % 2) put(g, sph(0.04, 6, 5), '#e8343f', x, 0.38 + k * 0.17, 0.5);
    }
  }
  g.userData.light = { y: 1.0, color: '#ffe3a8', intensity: 2.2, distance: 3.5 };
  return g;
};

B.adirondack = () => {
  const g = new THREE.Group();
  for (const x of [-0.52, 0.52]) {
    const c = grp(x, 0, 0.05, 0);
    const wood = P(x < 0 ? '#3fb6c8' : '#ff8a3d', 0.6);
    put(c, box(0.5, 0.04, 0.5), wood, 0, 0.33, 0.02, -0.12, 0, 0);
    for (const s of [-1, 1]) {
      put(c, box(0.05, 0.36, 0.05), wood, s * 0.24, 0.18, 0.22);
      put(c, box(0.05, 0.5, 0.05), wood, s * 0.24, 0.25, -0.18, -0.35, 0, 0);
      put(c, box(0.1, 0.03, 0.56), wood, s * 0.3, 0.5, 0.02);
    }
    const back = grp(0, 0.36, -0.22);
    back.rotation.x = -0.32;
    for (let i = 0; i < 5; i++) put(back, box(0.08, 0.62 - Math.abs(i - 2) * 0.06, 0.03), wood, -0.2 + i * 0.1, 0.3 - Math.abs(i - 2) * 0.03, 0);
    c.add(back);
    g.add(c);
  }
  put(g, cyl(0.15, 0.15, 0.03, 12), WOOD, 0, 0.42, 0.12);
  rod(g, [0, 0, 0.12], [0, 0.42, 0.12], 0.025, P(WOOD));
  put(g, cyl(0.035, 0.03, 0.11, 10), mat('#ff9ac2', { op: 0.75, r: 0.1 }), -0.05, 0.49, 0.12);
  put(g, cyl(0.035, 0.03, 0.11, 10), mat('#ffd23f', { op: 0.75, r: 0.1 }), 0.05, 0.49, 0.14);
  return g;
};

B.tent = () => {
  const g = new THREE.Group();
  put(g, box(1.7, 0.02, 1.6), '#4f8f4a', 0, 0.01, 0).castShadow = false;
  const fab = P('#ffb03a', 0.75), fab2 = P('#ff8a3d', 0.75);
  for (const s of [-1, 1]) put(g, box(1.02, 0.03, 1.5), s < 0 ? fab : fab2, s * 0.36, 0.5, -0.05, 0, 0, s * -0.95);
  put(g, cyl(0.025, 0.025, 1.6, 6), '#8a5a33', 0, 1.0, -0.05, PI / 2);
  for (const z of [-0.78, 0.68]) rod(g, [0, 0, z], [0, 1.0, z], 0.02, P('#8a5a33'));
  const back = new THREE.Shape([new THREE.Vector2(-0.72, 0), new THREE.Vector2(0.72, 0), new THREE.Vector2(0, 1.0)]);
  const bg = new THREE.ShapeGeometry(back);
  bg.userData.own = true;
  put(g, bg, P('#e8783a', 0.75), 0, 0, -0.79);
  for (const s of [-1, 1]) put(g, box(0.5, 0.75, 0.02), fab, s * 0.27, 0.37, 0.72, 0, s * 0.5, s * -0.6);
  put(g, rbox(0.7, 0.12, 0.6, 0.05, 1), '#3f6fb8', 0, 0.06, -0.15);
  const lamp = glow('#fff1c4', '#ffb050', 1.8);
  put(g, cyl(0.06, 0.06, 0.14, 8), lamp, 0.35, 0.09, 0.3).castShadow = false;
  put(g, cyl(0.07, 0.07, 0.02, 8), '#3a3f4a', 0.35, 0.17, 0.3);
  g.userData.light = { y: 0.4, color: '#ffc27a', intensity: 1.8, distance: 2.6 };
  return g;
};

B.sofa = () => {
  const g = new THREE.Group();
  put(g, box(1.8, 0.015, 1.5), '#e8dcc0', 0, 0.008, 0.05).castShadow = false;
  for (let i = 0; i < 5; i++) put(g, box(1.8, 0.016, 0.06), '#d4664a', 0, 0.012, -0.55 + i * 0.25).castShadow = false;
  const base = P('#8a6a4a', 0.7), cush = P('#f4f1ea', 0.85);
  put(g, rbox(1.7, 0.3, 0.6, 0.05, 1), base, 0, 0.15, -0.55);
  put(g, rbox(0.6, 0.3, 0.9, 0.05, 1), base, -0.55, 0.15, 0.2);
  put(g, rbox(1.6, 0.14, 0.5, 0.06, 2), cush, 0, 0.37, -0.53);
  put(g, rbox(0.5, 0.14, 0.86, 0.06, 2), cush, -0.55, 0.37, 0.22);
  put(g, rbox(1.7, 0.42, 0.14, 0.06, 2), cush, 0, 0.55, -0.8);
  put(g, rbox(0.14, 0.42, 1.0, 0.06, 2), cush, -0.82, 0.55, 0.12);
  for (const [x, z, c, r] of [[-0.6, -0.65, '#3fb6c8', 0.2], [0.55, -0.65, '#ffd23f', -0.2], [-0.7, 0.5, '#ff6f8f', 0.6]]) put(g, rbox(0.3, 0.3, 0.1, 0.05, 2), c, x, 0.56, z, 0.25, r, 0);
  put(g, rbox(0.6, 0.06, 0.45, 0.02, 1), WOOD, 0.35, 0.32, 0.25);
  for (const [x, z] of [[0.1, 0.07], [0.6, 0.07], [0.1, 0.43], [0.6, 0.43]]) put(g, box(0.04, 0.3, 0.04), WOOD, x, 0.15, z);
  put(g, cyl(0.06, 0.05, 0.12, 10), '#ffffff', 0.25, 0.41, 0.2);
  put(g, ico(0.09, 0), LEAF, 0.25, 0.52, 0.2);
  put(g, cyl(0.12, 0.12, 0.02, 12), '#c8705a', 0.48, 0.36, 0.3);
  return g;
};

B.pergola = () => {
  const g = new THREE.Group();
  const wood = P('#c8935a', 0.7);
  put(g, box(1.85, 0.04, 1.8), '#d8cbb6', 0, 0.02, 0).castShadow = false;
  for (const [x, z] of [[-0.82, -0.8], [0.82, -0.8], [-0.82, 0.8], [0.82, 0.8]]) put(g, box(0.1, 1.9, 0.1), wood, x, 0.95, z);
  for (const z of [-0.8, 0.8]) put(g, box(1.95, 0.1, 0.08), wood, 0, 1.9, z);
  for (let i = 0; i < 6; i++) put(g, box(0.05, 0.06, 1.9), wood, -0.8 + i * 0.32, 1.98, 0);
  for (let i = 0; i < 16; i++) put(g, ico(0.12, 0), i % 3 ? LEAF : LEAF2, -0.85 + ((i * 7) % 16) * 0.11, 2.04, -0.85 + ((i * 5) % 16) * 0.11);
  for (let i = 0; i < 6; i++) put(g, sph(0.05, 6, 5), i % 2 ? '#d9a3ff' : '#ff9ac2', -0.75 + i * 0.3, 1.92, i % 2 ? 0.7 : -0.7);
  for (const x of [-0.82, 0.82]) for (let k = 0; k < 5; k++) put(g, ico(0.07, 0), LEAF, x + (k % 2 ? 0.05 : -0.05), 0.3 + k * 0.35, 0.8);
  const bulb = glow('#fff6c8', '#ffd27a', 1.8);
  for (let i = 0; i < 9; i++) {
    const t = i / 8, x = -0.8 + t * 1.6, y = 1.82 - Math.sin(t * PI) * 0.18;
    put(g, sph(0.035, 6, 5), bulb, x, y, 0, 0, 0, 0).castShadow = false;
  }
  put(g, rbox(1.2, 0.08, 0.36, 0.03, 1), wood, 0, 0.42, -0.55);
  put(g, rbox(1.2, 0.36, 0.06, 0.03, 1), wood, 0, 0.66, -0.72);
  for (const x of [-0.5, 0.5]) put(g, box(0.06, 0.4, 0.3), wood, x, 0.2, -0.55);
  put(g, rbox(0.5, 0.1, 0.3, 0.04, 1), '#3fb6c8', -0.25, 0.51, -0.55);
  g.userData.light = { y: 1.7, color: '#ffd9a0', intensity: 2.4, distance: 3.8 };
  g.userData.animate = (t) => { bulb.emissiveIntensity = 1.5 + Math.sin(t * 2.4) * 0.4; };
  return g;
};

B.pingpong = () => {
  const g = new THREE.Group();
  put(g, box(1.7, 0.04, 0.9), '#2f7a5c', 0, 0.72, 0);
  put(g, box(1.7, 0.042, 0.02), WHITE, 0, 0.721, 0.44);
  put(g, box(1.7, 0.042, 0.02), WHITE, 0, 0.721, -0.44);
  put(g, box(0.02, 0.042, 0.9), WHITE, 0.84, 0.721, 0);
  put(g, box(0.02, 0.042, 0.9), WHITE, -0.84, 0.721, 0);
  put(g, box(1.7, 0.043, 0.01), WHITE, 0, 0.722, 0);
  put(g, box(0.01, 0.14, 0.96), mat('#ffffff', { op: 0.7, r: 0.8 }), 0, 0.81, 0);
  for (const z of [-0.48, 0.48]) put(g, cyl(0.012, 0.012, 0.16, 6), '#3a3f4a', 0, 0.8, z);
  for (const [x, z] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) put(g, box(0.05, 0.7, 0.05), '#3a3f4a', x, 0.35, z);
  for (const [x, c] of [[-0.5, '#e8343f'], [0.55, '#2b2d5c']]) {
    put(g, cyl(0.08, 0.08, 0.015, 12), c, x, 0.75, 0.2);
    put(g, box(0.03, 0.02, 0.1), WOOD, x, 0.75, 0.32);
  }
  put(g, sph(0.025, 8, 6), '#ffffff', 0.15, 0.76, -0.15);
  return g;
};

B.goal = () => {
  const g = new THREE.Group();
  const post = P(WHITE, 0.4);
  for (const x of [-0.9, 0.9]) rod(g, [x, 0, 0.3], [x, 1.0, 0.3], 0.035, post);
  rod(g, [-0.9, 1.0, 0.3], [0.9, 1.0, 0.3], 0.035, post);
  for (const x of [-0.9, 0.9]) rod(g, [x, 1.0, 0.3], [x * 0.95, 0, -0.35], 0.02, post);
  rod(g, [-0.86, 0.02, -0.35], [0.86, 0.02, -0.35], 0.02, post);
  const net = P('#e8eef2', 0.9);
  for (let i = 0; i <= 8; i++) rod(g, [-0.9 + i * 0.225, 0.98, 0.28], [-0.86 + i * 0.215, 0.02, -0.34], 0.006, net);
  for (let k = 1; k < 5; k++) { const t = k / 5; rod(g, [-0.89, 1 - t, 0.3 - t * 0.64], [0.89, 1 - t, 0.3 - t * 0.64], 0.006, net); }
  const ball = put(g, ico(0.11, 1), '#ffffff', 0.3, 0.11, 0.55);
  ball.material = P('#ffffff');
  for (let i = 0; i < 5; i++) put(g, sph(0.03, 6, 4), '#1d1a2f', 0.3 + Math.cos(i * 1.26) * 0.09, 0.11 + Math.sin(i * 1.26) * 0.09, 0.6);
  return g;
};

B.skateramp = () => {
  const g = new THREE.Group();
  const top = P('#3f6fb8', 0.6), side = P('#ffd23f', 0.5);
  put(g, box(0.7, 0.3, 0.8), side, 0, 0.15, 0);
  put(g, box(0.72, 0.02, 0.82), top, 0, 0.31, 0);
  for (const s of [-1, 1]) {
    const r = put(g, box(0.62, 0.025, 0.8), top, s * 0.62, 0.15, 0, 0, 0, s * -0.47);
    r.castShadow = true;
    const w = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.57, 0), new THREE.Vector2(0, 0.3)]);
    const wg = new THREE.ShapeGeometry(w);
    wg.userData.own = true;
    for (const z of [-0.4, 0.4]) put(g, wg, side, s * 0.35, 0, z, 0, s > 0 ? 0 : PI, 0);
  }
  rod(g, [-0.35, 0.33, -0.4], [-0.35, 0.33, 0.4], 0.018, METAL());
  put(g, rbox(0.5, 0.03, 0.14, 0.02, 1), '#e8343f', 0.15, 0.34, 0.15, 0, 0.4, 0);
  for (const [x, z] of [[-0.05, 0.1], [0.32, 0.22]]) put(g, cyl(0.025, 0.025, 0.04, 8), '#fff6dc', x, 0.33, z, 0, 0, PI / 2);
  return g;
};

B.bouncy = () => {
  const g = new THREE.Group();
  const top = dyn(new THREE.Group());
  put(top, rbox(1.8, 0.3, 1.7, 0.12, 2), '#e8343f', 0, 0.15, 0);
  put(top, rbox(1.6, 0.06, 1.5, 0.03, 1), '#3f6fb8', 0, 0.31, 0);
  for (const [w, d, x, z] of [[1.7, 0.16, 0, -0.78], [0.16, 1.6, -0.82, 0], [0.16, 1.6, 0.82, 0]]) put(top, rbox(w, 0.7, d, 0.07, 2), '#ffd23f', x, 0.6, z);
  for (const [x, z] of [[-0.82, -0.78], [0.82, -0.78], [-0.82, 0.72], [0.82, 0.72]]) {
    put(top, cyl(0.16, 0.18, 1.0, 12), '#2fbf5f', x, 0.8, z);
    put(top, cone(0.2, 0.36, 12), '#e8343f', x, 1.48, z);
    put(top, sph(0.05, 8, 6), '#ffd23f', x, 1.68, z);
  }
  put(top, rbox(0.7, 0.35, 0.16, 0.08, 2), '#ff8ac0', 0, 1.08, -0.78);
  g.add(top);
  g.userData.animate = (t) => { const k = Math.abs(Math.sin(t * 3)) * 0.04; top.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5); };
  return g;
};

B.treehouse = () => {
  const g = new THREE.Group();
  put(g, cyl(0.18, 0.26, 1.6, 10), '#8a5a33', -0.25, 0.8, -0.2);
  for (const [x, y, z, r] of [[-0.25, 2.55, -0.25, 0.6], [0.3, 2.3, -0.4, 0.45], [-0.7, 2.25, 0.1, 0.42], [0.2, 2.65, 0.2, 0.4]]) put(g, ico(r, 1), r > 0.5 ? LEAF : LEAF2, x, y, z);
  put(g, box(1.3, 0.08, 1.2), WOOD, 0, 1.55, 0);
  for (const [x, z] of [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.5], [0.55, 0.5]]) put(g, box(0.07, 1.55, 0.07), '#7a5538', x, 0.78, z);
  const hut = grp(0.05, 1.59, -0.1);
  put(hut, box(0.8, 0.6, 0.7), '#e8a24a', 0, 0.3, 0);
  for (const s of [-1, 1]) put(hut, box(0.95, 0.04, 0.5), '#c8443a', 0, 0.78, s * 0.2, s * 0.6, 0, 0);
  put(hut, box(0.24, 0.4, 0.02), '#5a3524', -0.18, 0.2, 0.36);
  put(hut, box(0.2, 0.2, 0.02), '#bfe8ff', 0.2, 0.36, 0.36);
  g.add(hut);
  for (const x of [-0.6, 0.6]) put(g, box(0.04, 0.3, 1.2), WOOD, x, 1.74, 0);
  put(g, box(1.24, 0.3, 0.04), WOOD, 0, 1.74, 0.58);
  for (const s of [-1, 1]) rod(g, [0.4 + s * 0.12, 0, 0.75], [0.4 + s * 0.12, 1.55, 0.55], 0.012, P('#efe0c0'));
  for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6; put(g, box(0.28, 0.025, 0.04), WOOD, 0.4, t * 1.55, 0.75 - t * 0.2); }
  rod(g, [0.5, 1.88, -0.4], [0.5, 2.4, -0.4], 0.012, P('#3a3f4a'));
  put(g, box(0.22, 0.14, 0.01), '#2f8cf0', 0.62, 2.32, -0.4);
  return g;
};

B.birdhouse = () => {
  const g = new THREE.Group();
  rod(g, [0, 0, 0], [0, 1.0, 0], 0.03, P(WOOD));
  put(g, box(0.32, 0.03, 0.28), WOOD, 0, 1.0, 0);
  put(g, box(0.24, 0.26, 0.24), '#7fc3e8', 0, 1.15, 0);
  for (const s of [-1, 1]) put(g, box(0.32, 0.025, 0.2), '#c8443a', s * 0.1, 1.33, 0, 0, 0, s * -0.65);
  put(g, cyl(0.04, 0.04, 0.02, 10), '#2a2420', 0, 1.18, 0.121, PI / 2);
  rod(g, [0, 1.08, 0.12], [0, 1.08, 0.2], 0.008, P(WOOD));
  const bird = dyn(grp(0.1, 1.0, 0.1, 0.6));
  sc(put(bird, sph(0.05, 8, 6), '#e8343f', 0, 0.05, 0), 1, 0.85, 1.3);
  const head = put(bird, sph(0.035, 8, 6), '#e8343f', 0, 0.1, 0.045);
  put(bird, cone(0.012, 0.035, 5), '#ffc21a', 0, 0.1, 0.085, PI / 2);
  g.add(bird);
  g.userData.animate = (t) => { head.position.y = 0.1 + Math.max(0, Math.sin(t * 5)) ** 8 * 0.03; bird.rotation.y = 0.6 + Math.sin(t * 0.7) * 0.4; };
  return g;
};

B.kiddiepool = () => {
  const g = new THREE.Group();
  put(g, torus(0.36, 0.08, 8, 20), '#ff8ac0', 0, 0.08, 0, PI / 2);
  put(g, torus(0.36, 0.06, 8, 20), '#7fd4ff', 0, 0.2, 0, PI / 2);
  put(g, cyl(0.36, 0.36, 0.02, 20), '#2f8cf0', 0, 0.01, 0).castShadow = false;
  put(g, cyl(0.33, 0.33, 0.01, 20), mat('#7fd4ff', { op: 0.75, r: 0.05 }), 0, 0.16, 0).castShadow = false;
  const duck = dyn(grp(0.12, 0.17, -0.05));
  sc(put(duck, sph(0.06, 8, 6), '#ffd23f', 0, 0.03, 0), 1.2, 0.8, 1);
  put(duck, sph(0.04, 8, 6), '#ffd23f', 0.05, 0.08, 0);
  put(duck, cone(0.015, 0.04, 5), '#ff8a3d', 0.09, 0.08, 0, 0, 0, -PI / 2);
  g.add(duck);
  g.userData.animate = (t) => { duck.position.set(Math.cos(t * 0.4) * 0.15, 0.17 + Math.sin(t * 2) * 0.01, Math.sin(t * 0.4) * 0.15); duck.rotation.y = -t * 0.4; };
  return g;
};

B.hutch = () => {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]]) put(g, box(0.06, 0.3, 0.06), '#7a5538', x, 0.15, z);
  put(g, box(1.7, 0.6, 0.65), WOOD, 0, 0.6, -0.02);
  put(g, box(0.75, 0.48, 0.02), '#d9c8a0', -0.38, 0.6, 0.31);
  for (let i = 0; i < 8; i++) put(g, box(0.012, 0.48, 0.012), '#9aa3ad', -0.72 + i * 0.1, 0.6, 0.325);
  for (let k = 0; k < 4; k++) put(g, box(0.72, 0.012, 0.012), '#9aa3ad', -0.38, 0.4 + k * 0.13, 0.325);
  put(g, box(0.7, 0.48, 0.02), '#c8935a', 0.42, 0.6, 0.31);
  put(g, cyl(0.03, 0.03, 0.02, 8), '#3a3f4a', 0.68, 0.6, 0.33, PI / 2);
  for (const s of [-1, 1]) put(g, box(1.85, 0.04, 0.42), '#8a4a35', 0, 1.02, s * 0.17, s * 0.5, 0, 0);
  put(g, box(0.3, 0.02, 0.5), WOOD, -0.6, 0.18, 0.45, -0.6, 0, 0);
  const bun = grp(-0.4, 0.33, 0.15, 0.5);
  sc(put(bun, sph(0.09, 8, 6), '#ffffff', 0, 0.06, 0), 1, 0.85, 1.25);
  put(bun, sph(0.06, 8, 6), '#ffffff', 0, 0.13, 0.08);
  for (const s of [-1, 1]) sc(put(bun, sph(0.025, 6, 4), '#ffd0dc', s * 0.025, 0.22, 0.07), 0.6, 2, 0.6);
  g.add(bun);
  for (let i = 0; i < 6; i++) sc(put(g, sph(0.05, 6, 4), '#e8c45a', -0.6 + i * 0.07, 0.33, -0.1), 1.6, 0.4, 1);
  return g;
};

B.donut = () => {
  const g = new THREE.Group();
  put(g, rbox(0.7, 0.3, 0.7, 0.04, 1), '#f4f1ea', 0, 0.15, 0);
  put(g, rbox(0.76, 0.05, 0.76, 0.02, 1), '#e3d6c0', 0, 0.32, 0);
  const d = grp(0, 0.82, 0);
  put(d, torus(0.32, 0.16, 12, 24), '#e8a24a', 0, 0, 0);
  put(d, torus(0.32, 0.165, 10, 24, PI * 2), mat('#ff8ac0', { r: 0.35 }), 0, 0, 0.02).scale.set(1, 1, 0.75);
  const cols = ['#ffffff', '#ffd23f', '#2f8cf0', '#2fbf5f', '#9b5cf6'];
  for (let i = 0; i < 22; i++) {
    const a = i * 0.9, r = 0.24 + (i % 3) * 0.08;
    put(d, box(0.05, 0.014, 0.014), cols[i % cols.length], Math.cos(a) * r, Math.sin(a) * r, 0.155, 0, 0, a * 2.3);
  }
  g.add(d);
  return g;
};

B.bridge = () => {
  const g = new THREE.Group();
  put(g, box(0.5, 0.02, 1.0), '#2f8cf0', 0, 0.012, 0).castShadow = false;
  put(g, box(0.4, 0.022, 1.0), '#7fd4ff', 0, 0.014, 0).castShadow = false;
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) put(g, ico(0.08, 0), STONE, s * (0.3 + (i % 2) * 0.06), 0.04, -0.4 + i * 0.27);
  const red = P('#d8352a', 0.5);
  const N = 9;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const x0 = -1.35 + t0 * 2.7, x1 = -1.35 + t1 * 2.7;
    const y0 = Math.sin(t0 * PI) * 0.5 + 0.08, y1 = Math.sin(t1 * PI) * 0.5 + 0.08;
    const len = Math.hypot(x1 - x0, y1 - y0);
    put(g, box(len + 0.02, 0.06, 0.62), P('#a8743f', 0.7), (x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 0, Math.atan2(y1 - y0, x1 - x0));
    for (const z of [-0.3, 0.3]) {
      put(g, box(len + 0.02, 0.05, 0.05), red, (x0 + x1) / 2, (y0 + y1) / 2 + 0.38, z, 0, 0, Math.atan2(y1 - y0, x1 - x0));
      put(g, box(0.05, 0.4, 0.05), red, x0, y0 + 0.2, z);
    }
  }
  for (const z of [-0.3, 0.3]) put(g, box(0.05, 0.4, 0.05), red, 1.35, 0.28, z);
  for (const x of [-1.35, 1.35]) for (const z of [-0.3, 0.3]) put(g, sph(0.05, 8, 6), GOLD(), x, 0.52, z);
  return g;
};

B.observatory = () => {
  const g = new THREE.Group();
  put(g, cyl(0.82, 0.86, 1.1, 20), WHITE, 0, 0.55, 0);
  put(g, cyl(0.86, 0.86, 0.08, 20), '#c9c2b5', 0, 1.12, 0);
  put(g, rbox(0.36, 0.6, 0.06, 0.03, 1), '#4a6fa5', 0, 0.3, 0.83);
  for (const a of [0.8, -0.8]) put(g, rbox(0.22, 0.22, 0.04, 0.05, 1), '#bfe8ff', Math.sin(a) * 0.83, 0.7, Math.cos(a) * 0.83, 0, a, 0);
  const dome = dyn(grp(0, 1.16, 0));
  put(dome, sph(0.8, 20, 12, 0, TAU, 0, PI / 2), P('#cfd6de', 0.3, 0.7), 0, 0, 0);
  put(dome, box(0.26, 0.85, 0.2), '#2b2d5c', 0, 0.42, 0.62, -0.75, 0, 0);
  const scope = grp(0, 0.4, 0.3);
  scope.rotation.x = -0.75;
  put(scope, cyl(0.1, 0.13, 0.8, 12), '#2b2d5c', 0, 0.3, 0);
  put(scope, cyl(0.135, 0.135, 0.06, 12), GOLD(), 0, 0.68, 0);
  dome.add(scope);
  g.add(dome);
  g.userData.light = { y: 0.8, color: '#a8c8ff', intensity: 1.8, distance: 3 };
  g.userData.animate = (t) => { dome.rotation.y = Math.sin(t * 0.15) * 0.8; };
  return g;
};

B.helipad = () => {
  const g = new THREE.Group();
  put(g, cyl(1.42, 1.45, 0.06, 28), '#3a3f4a', 0, 0.03, 0);
  put(g, torus(1.3, 0.035, 4, 32), '#ffd23f', 0, 0.065, 0, PI / 2).castShadow = false;
  for (const x of [-0.32, 0.32]) put(g, box(0.1, 0.012, 0.8), WHITE, x, 0.066, 0).castShadow = false;
  put(g, box(0.64, 0.012, 0.1), WHITE, 0, 0.066, 0).castShadow = false;
  const bulb = glow('#d8ffd8', '#3fff7a', 1.6);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; put(g, sph(0.04, 6, 5), bulb, Math.cos(a) * 1.38, 0.08, Math.sin(a) * 1.38).castShadow = false; }
  const heli = grp(0, 0.06, 0, 0.6);
  for (const s of [-1, 1]) {
    put(heli, box(0.04, 0.04, 0.9), '#2a2c33', s * 0.3, 0.05, 0);
    for (const z of [-0.25, 0.25]) put(heli, box(0.03, 0.18, 0.03), '#2a2c33', s * 0.25, 0.14, z, 0, 0, s * 0.4);
  }
  sc(put(heli, sph(0.42, 18, 12), P('#e8343f', 0.3, 0.3), 0, 0.55, 0.05), 0.85, 0.8, 1.25);
  sc(put(heli, sph(0.3, 16, 10), mat('#24324a', { r: 0.1, m: 0.5 }), 0, 0.62, 0.32), 0.9, 0.7, 0.8);
  rod(heli, [0, 0.6, -0.4], [0, 0.72, -1.25], 0.06, P('#e8343f', 0.3, 0.3));
  put(heli, box(0.03, 0.3, 0.2), '#e8343f', 0, 0.82, -1.22);
  put(heli, cyl(0.04, 0.04, 0.2, 8), '#2a2c33', 0, 0.98, 0.0);
  const rotor = dyn(grp(0, 1.08, 0.0));
  for (let i = 0; i < 4; i++) put(rotor, box(0.12, 0.015, 1.15), '#2a2c33', 0, 0, 0, 0, (i / 4) * TAU, 0).position.set(Math.sin((i / 4) * TAU) * 0.55, 0, Math.cos((i / 4) * TAU) * 0.55);
  heli.add(rotor);
  const tail = dyn(grp(0.05, 0.82, -1.22));
  put(tail, box(0.01, 0.32, 0.04), '#2a2c33', 0, 0, 0);
  heli.add(tail);
  g.add(heli);
  g.userData.light = { y: 0.4, color: '#7fffa0', intensity: 1.6, distance: 3.2 };
  g.userData.animate = (t) => { rotor.rotation.y = t * 2.2; tail.rotation.x = t * 9; bulb.emissiveIntensity = 0.8 + (Math.sin(t * 4) > 0 ? 1 : 0); };
  return g;
};

export function buildHomeItem(id) {
  const g = B[id]();
  const ud = { ...g.userData };
  mergeStatic(g, 'prop');
  Object.assign(g.userData, ud);
  return g;
}

export const HAS_ITEM_MODEL = (id) => !!B[id];
