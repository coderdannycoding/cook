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
  // relax
  picnic: { group: 'relax', name: 'Picnic Blanket', price: 150, size: [2, 2], comfort: 3, flat: true, desc: 'Gingham, a basket and a jug of lemonade.' },
  lounger: { group: 'relax', name: 'Sun Lounger', price: 220, size: [1, 2], comfort: 4, desc: 'Stripy cushions and a cold drink.' },
  patio: { group: 'relax', name: 'Patio Set', price: 480, size: [2, 2], comfort: 6, desc: 'A round table, two chairs and a parasol.' },
  swingbench: { group: 'relax', name: 'Porch Swing', price: 520, size: [2, 1], comfort: 5, desc: 'A gently rocking bench for two.' },
  firepit: { group: 'relax', name: 'Fire Pit', price: 600, size: [2, 2], comfort: 7, light: true, fx: 'fire', desc: 'Stone ring, crackling logs and stump seats.' },
  hammock: { group: 'relax', name: 'Hammock', price: 800, size: [3, 1], comfort: 6, perk: { patience: 0.01 }, desc: 'A striped hammock that sways in the breeze.' },
  hottub: { group: 'relax', name: 'Hot Tub', price: 3000, size: [2, 2], comfort: 12, fx: 'tub', perk: { patience: 0.02 }, desc: 'Bubbly, steamy and very relaxing.' },
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
  // pets
  foodbowls: { group: 'pets', name: 'Food Bowls', price: 90, size: [1, 1], comfort: 1, pet: true, flat: true, desc: 'Always full. Pets get hungry less often.' },
  petbed: { group: 'pets', name: 'Pet Bed', price: 160, size: [1, 1], comfort: 2, pet: true, flat: true, desc: 'A squishy round bed for naps.' },
  agility: { group: 'pets', name: 'Agility Hurdles', price: 300, size: [2, 1], comfort: 2, pet: true, desc: 'Jump, jump, treat!' },
  doghouse: { group: 'pets', name: 'Pet House', price: 350, size: [1, 1], comfort: 3, pet: true, perk: { patience: 0.01 }, desc: 'A cosy kennel with a bone over the door.' },
  cattree: { group: 'pets', name: 'Cat Tree', price: 380, size: [1, 1], comfort: 3, pet: true, desc: 'Scratching posts, perches and a dangling mouse.' },
  // fancy
  statue: { group: 'fancy', name: 'Garden Statue', price: 1200, size: [1, 1], comfort: 8, perk: { review: 0.01 }, desc: 'A marble chef holding a ladle aloft.' },
  fountain: { group: 'fancy', name: 'Tiered Fountain', price: 2500, size: [2, 2], comfort: 12, fx: 'spray', perk: { review: 0.02 }, desc: 'Three tiers of splashing water.' },
  gazebo: { group: 'fancy', name: 'Gazebo', price: 4000, size: [3, 3], comfort: 16, light: true, perk: { patience: 0.02 }, desc: 'An airy white gazebo with benches and lanterns.' },
  balloon: { group: 'fancy', name: 'Hot Air Balloon', price: 8000, size: [2, 2], comfort: 20, perk: { arrivals: 0.02 }, desc: 'Tethered in the yard and visible all over town.' },
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

export function buildHomeItem(id) {
  const g = B[id]();
  const ud = { ...g.userData };
  mergeStatic(g, 'prop');
  Object.assign(g.userData, ud);
  return g;
}

export const HAS_ITEM_MODEL = (id) => !!B[id];
