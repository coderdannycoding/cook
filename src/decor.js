// Decor & showpiece models: plants, furniture, gadgets and pets. Built from primitives plus a few
// painted canvases; anything that moves is a small dynamic group animated from userData.animate.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { mat, umat, mesh, box, rbox, cyl, sph, cone, torus, ico, capsule, finish, dyn } from './models.js';
import { buildGarden } from './look.js';
import { TAU } from './utils.js';

const SIGN_FONT = '"Lilita One", system-ui, sans-serif';

const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
const lathe = (key, pts, seg = 20) => geo(`lathe:${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));

const texCache = new Map();
function paintTex(key, w, h, paint) {
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(key, t);
  }
  return t;
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const R = (m, x = 0, y = 0, z = 0) => { m.rotation.set(x, y, z); return m; };
const Sc = (m, x, y = x, z = x) => { m.scale.set(x, y, z); return m; };
const UP = new THREE.Vector3(0, 1, 0);

// A cylinder running from point a to point b
function limb(root, a, b, r, material) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const m = mesh(cyl(r, r, 1, 8), material);
  m.scale.y = d.length();
  m.position.copy(A).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  root.add(m);
  return m;
}

// Little daisy-style flower facing up (or along `face`)
function flower(root, x, y, z, color, r = 0.06, centre = '#ffcf3a') {
  const g = new THREE.Group();
  const pm = mat(color, { r: 0.7 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    g.add(Sc(mesh(sph(r * 0.55, 8, 6), pm, Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8), 1, 0.35, 0.6));
    g.children[g.children.length - 1].rotation.y = -a;
  }
  g.add(Sc(mesh(sph(r * 0.45, 8, 6), mat(centre)), 1, 0.6, 1));
  g.position.set(x, y, z);
  root.add(g);
  return g;
}

const WOOD = '#8a5a33', WOOD_DARK = '#5e3a22', GOLD = '#f0c04a', LEAF = '#4fa35a', LEAF2 = '#7cc95e';
const gold = () => mat(GOLD, { r: 0.25, m: 0.85 });
const chrome = () => mat('#dfe5ea', { r: 0.2, m: 0.85 });
const glass = (tint = '#dff4ff', op = 0.25) => mat(tint, { op, r: 0.05 });

function see(m) { m.userData.noMerge = true; return m; }

export const DECOR_BUILDERS = {};
const D = DECOR_BUILDERS;

// ---------------------------------------------------------------------------- small decor

D.cactus = () => {
  const r = new THREE.Group();
  r.add(mesh(cyl(0.2, 0.15, 0.3, 16), mat('#e07a4f', { r: 0.8 }), 0, 0.15, 0));
  r.add(R(mesh(torus(0.2, 0.03, 6, 18), mat('#f2c14e'), 0, 0.3, 0), Math.PI / 2));
  r.add(mesh(cyl(0.18, 0.18, 0.02, 16), mat('#5b3b25'), 0, 0.3, 0));
  const green = mat('#4fa35a', { r: 0.75 });
  r.add(Sc(mesh(capsule(0.12, 0.3), green, 0, 0.58, 0), 1, 1, 0.92));
  r.add(R(mesh(capsule(0.055, 0.08), green, 0.14, 0.58, 0), 0, 0, Math.PI / 2));
  r.add(mesh(capsule(0.055, 0.12), green, 0.2, 0.68, 0));
  r.add(R(mesh(capsule(0.05, 0.06), green, -0.13, 0.5, 0), 0, 0, Math.PI / 2));
  r.add(mesh(capsule(0.05, 0.1), green, -0.18, 0.58, 0));
  const dot = mat('#f4f1e6');
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, y = 0.4 + (i % 7) * 0.06;
    r.add(mesh(sph(0.012, 5, 4), dot, Math.cos(a) * 0.118, y, Math.sin(a) * 0.11, false));
  }
  flower(r, 0, 0.87, 0, '#ff6fae', 0.05);
  flower(r, 0.2, 0.8, 0, '#ffd23f', 0.035);
  return finish(r, [0, 0.95, 0]);
};

D.flowers = () => {
  const r = new THREE.Group();
  const stone = mat('#f4efe6', { r: 0.6 });
  r.add(mesh(rbox(0.42, 0.08, 0.42, 0.02), stone, 0, 0.04, 0));
  r.add(mesh(cyl(0.11, 0.13, 0.62, 14), stone, 0, 0.39, 0));
  r.add(mesh(rbox(0.36, 0.06, 0.36, 0.02), stone, 0, 0.73, 0));
  r.add(mesh(lathe('vase', [[0, 0], [0.08, 0], [0.12, 0.08], [0.11, 0.16], [0.07, 0.22], [0.08, 0.27], [0.065, 0.27], [0.06, 0.22], [0, 0.22]]), mat('#3fb6c8', { r: 0.25 }), 0, 0.76, 0));
  const stem = mat('#4c9a45');
  const cols = ['#ff4f6d', '#ffcf3a', '#ff8fc0', '#ff7a3a', '#c86bff'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3, lean = 0.1 + (i % 2) * 0.06;
    const top = [Math.cos(a) * lean, 1.3 + (i % 3) * 0.06, Math.sin(a) * lean];
    limb(r, [0, 0.98, 0], top, 0.012, stem);
    r.add(Sc(mesh(sph(0.055, 10, 8), mat(cols[i]), top[0], top[1] + 0.04, top[2]), 1, 1.35, 1));
    r.add(Sc(mesh(cone(0.04, 0.12, 6), mat(cols[i]), top[0], top[1] + 0.1, top[2]), 1, 0.6, 1));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    r.add(R(Sc(mesh(cone(0.04, 0.26, 4), mat('#5fae4a'), Math.cos(a) * 0.06, 1.08, Math.sin(a) * 0.06), 1, 1, 0.3), Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5));
  }
  return finish(r, [0, 1.45, 0]);
};

D.coatrack = () => {
  const r = new THREE.Group();
  const wood = mat(WOOD_DARK, { r: 0.55 });
  r.add(mesh(cyl(0.2, 0.24, 0.05, 18), wood, 0, 0.025, 0));
  r.add(mesh(cyl(0.032, 0.04, 1.75, 10), wood, 0, 0.9, 0));
  r.add(mesh(sph(0.055, 10, 8), mat(GOLD, { r: 0.3, m: 0.8 }), 0, 1.8, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    limb(r, [0, 1.6, 0], [Math.cos(a) * 0.16, 1.7, Math.sin(a) * 0.16], 0.014, wood);
  }
  // bowler hat, scarf, raincoat
  const hat = mat('#2b3a67', { r: 0.6 });
  r.add(mesh(cyl(0.15, 0.15, 0.015, 18), hat, 0.15, 1.7, 0.12));
  r.add(mesh(cyl(0.085, 0.095, 0.1, 16), hat, 0.15, 1.76, 0.12));
  r.add(mesh(cyl(0.097, 0.097, 0.025, 16), mat('#e8343f'), 0.15, 1.725, 0.12));
  for (let i = 0; i < 5; i++) r.add(mesh(rbox(0.09, 0.1, 0.03, 0.01), mat(i % 2 ? '#fff4e0' : '#e8343f'), -0.15, 1.58 - i * 0.1, -0.11));
  const coat = mat('#ffc23a', { r: 0.6 });
  r.add(mesh(rbox(0.34, 0.62, 0.12, 0.05), coat, 0.0, 1.3, 0.16));
  r.add(mesh(rbox(0.36, 0.08, 0.14, 0.03), coat, 0.0, 1.6, 0.16));
  for (let i = 0; i < 3; i++) r.add(mesh(sph(0.018, 6, 5), mat('#3b3b3b'), 0, 1.45 - i * 0.14, 0.225));
  return finish(r, [0, 1.85, 0]);
};

D.barrel = () => {
  const r = new THREE.Group();
  r.add(mesh(lathe('barrel', [[0, 0], [0.24, 0], [0.28, 0.15], [0.3, 0.3], [0.28, 0.45], [0.25, 0.58], [0, 0.58]], 18), mat('#a0683a', { r: 0.75 }), 0, 0, 0));
  const hoop = mat('#4a4f57', { r: 0.4, m: 0.6 });
  for (const y of [0.1, 0.48]) r.add(R(mesh(torus(0.285, 0.016, 6, 24), hoop, 0, y, 0), Math.PI / 2));
  r.add(mesh(cyl(0.24, 0.24, 0.02, 18), mat('#5b3b25'), 0, 0.585, 0));
  r.add(Sc(mesh(ico(0.2, 1), mat(LEAF), 0, 0.64, 0), 1.1, 0.55, 1.1));
  const cols = ['#ffffff', '#ffffff', '#ffd23f', '#ff8fc0', '#ffffff', '#b98cff'];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    flower(r, Math.cos(a) * 0.14, 0.72 + (i % 3) * 0.03, Math.sin(a) * 0.14, cols[i], 0.055);
  }
  return finish(r, [0, 0.85, 0]);
};

D.gumball = () => {
  const r = new THREE.Group();
  const red = mat('#e8343f', { r: 0.35 });
  r.add(mesh(cyl(0.17, 0.21, 0.08, 18), red, 0, 0.04, 0));
  r.add(mesh(cyl(0.06, 0.08, 0.32, 14), red, 0, 0.24, 0));
  r.add(mesh(rbox(0.26, 0.2, 0.24, 0.05), red, 0, 0.5, 0));
  r.add(mesh(cyl(0.05, 0.05, 0.02, 14), chrome(), 0, 0.5, 0.125));
  r.children[r.children.length - 1].rotation.x = Math.PI / 2;
  r.add(mesh(box(0.06, 0.04, 0.02), mat('#3b3b3b'), 0, 0.44, 0.125));
  r.add(mesh(cyl(0.13, 0.15, 0.04, 18), chrome(), 0, 0.62, 0));
  const rnd = rng(7);
  const cols = ['#ff4f6d', '#ffd23f', '#3fb6ff', '#5fd06a', '#ff9a3c', '#b98cff', '#ffffff'];
  for (let i = 0; i < 22; i++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.15, y = 0.68 + rnd() * 0.17;
    r.add(mesh(sph(0.042, 8, 6), mat(cols[i % cols.length], { r: 0.3 }), Math.cos(a) * d, y, Math.sin(a) * d, false));
  }
  r.add(see(mesh(sph(0.22, 20, 14), glass(), 0, 0.82, 0, false)));
  r.add(mesh(cyl(0.09, 0.12, 0.06, 16), red, 0, 1.03, 0));
  r.add(mesh(sph(0.04, 10, 8), red, 0, 1.08, 0));
  return finish(r, [0, 1.1, 0]);
};

function chalkTex() {
  return paintTex('chalk', 256, 384, (g, w, h) => {
    g.fillStyle = '#26352f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 40, 3);
    g.textAlign = 'center';
    g.fillStyle = '#ffe9a8';
    g.font = `46px ${SIGN_FONT}`;
    g.fillText('Specials', w / 2, 62);
    g.strokeStyle = '#ffe9a8';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(40, 78); g.quadraticCurveTo(w / 2, 90, w - 40, 76); g.stroke();
    // a chalk burger
    const cx = w / 2, cy = 160;
    g.fillStyle = '#f2b45a'; g.beginPath(); g.ellipse(cx, cy - 12, 58, 30, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#7ad16a'; g.fillRect(cx - 62, cy - 12, 124, 10);
    g.fillStyle = '#8a4b2e'; g.fillRect(cx - 58, cy - 2, 116, 16);
    g.fillStyle = '#f2b45a'; g.fillRect(cx - 56, cy + 14, 112, 14);
    g.fillStyle = '#ffffff';
    g.font = `30px ${SIGN_FONT}`;
    g.fillText('Burger', w / 2, 236);
    g.fillStyle = '#ff9aa8';
    g.fillText('Pizza', w / 2, 282);
    g.fillStyle = '#9ad8ff';
    g.fillText('Sushi', w / 2, 328);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  });
}

D.easel = () => {
  const r = new THREE.Group();
  const wood = mat('#b97f4b', { r: 0.6 });
  const board = mat('#ffffff', { map: chalkTex(), mapKey: 'chalk', r: 0.95 });
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(0, 1.05, 0);
    g.rotation.x = -side * 0.2;
    g.add(mesh(rbox(0.64, 1.0, 0.05, 0.02), wood, 0, -0.5, 0));
    const face = mesh(new THREE.PlaneGeometry(0.54, 0.86), board, 0, -0.5, side * 0.027, false);
    if (side < 0) face.rotation.y = Math.PI;
    g.add(face);
    r.add(g);
  }
  r.add(mesh(box(0.66, 0.05, 0.05), wood, 0, 1.06, 0));
  return finish(r, [0, 1.15, 0]);
};

D.lavalamp = () => {
  const r = new THREE.Group();
  const wood = mat('#c08552', { r: 0.6 });
  r.add(mesh(cyl(0.16, 0.18, 0.04, 18), wood, 0, 0.02, 0));
  r.add(mesh(cyl(0.035, 0.035, 0.54, 10), wood, 0, 0.3, 0));
  r.add(mesh(cyl(0.25, 0.25, 0.04, 22), wood, 0, 0.58, 0));
  const metal = mat('#8a5cf0', { r: 0.25, m: 0.7 });
  r.add(mesh(cyl(0.06, 0.1, 0.14, 16), metal, 0, 0.67, 0));
  r.add(mesh(cyl(0.035, 0.06, 0.08, 16), metal, 0, 1.09, 0));
  r.add(see(mesh(cyl(0.052, 0.078, 0.32, 18), mat('#ff8ad8', { op: 0.55, r: 0.1, e: '#ff3fb0', ei: 0.7 }), 0, 0.9, 0, false)));
  const blobMat = umat('#ffb03a', { e: '#ff7a1a', ei: 1.4 });
  const blobs = [];
  for (let i = 0; i < 3; i++) {
    const b = dyn(mesh(sph(0.03, 10, 8), blobMat, 0, 0.8, 0, false));
    r.add(b);
    blobs.push(b);
  }
  return finish(r, [0, 1.15, 0], {
    light: { y: 1.0, color: '#ff6fd0', intensity: 3, distance: 3 },
    animate(t) {
      blobs.forEach((b, i) => {
        const k = Math.sin(t * 0.45 + i * 2.1) * 0.5 + 0.5;
        b.position.set(Math.sin(t * 0.3 + i) * 0.012, 0.78 + k * 0.22, Math.cos(t * 0.27 + i) * 0.012);
        const s = 0.8 + Math.sin(t * 0.9 + i) * 0.25;
        b.scale.set(s, s * (1.3 + (1 - k) * 0.3), s);
      });
    },
  });
};

function landscapeTex() {
  return paintTex('landscape', 256, 192, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#6fc3ff');
    sky.addColorStop(0.6, '#ffd6b0');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffe066';
    g.beginPath(); g.arc(190, 58, 26, 0, TAU); g.fill();
    g.fillStyle = '#7cc95e';
    g.beginPath(); g.moveTo(0, 130); g.quadraticCurveTo(70, 90, 140, 125); g.quadraticCurveTo(200, 150, 256, 118); g.lineTo(256, 192); g.lineTo(0, 192); g.fill();
    g.fillStyle = '#4fa35a';
    g.beginPath(); g.moveTo(0, 165); g.quadraticCurveTo(110, 130, 256, 168); g.lineTo(256, 192); g.lineTo(0, 192); g.fill();
    g.fillStyle = '#ff6b5a'; g.fillRect(52, 104, 26, 20);
    g.fillStyle = '#8a3a2a'; g.beginPath(); g.moveTo(48, 106); g.lineTo(65, 92); g.lineTo(82, 106); g.fill();
    for (let i = 0; i < 18; i++) {
      g.fillStyle = ['#ff6fae', '#ffffff', '#ffd23f'][i % 3];
      g.beginPath(); g.arc(10 + i * 14, 176 + Math.sin(i) * 6, 3, 0, TAU); g.fill();
    }
  });
}

D.painting = () => {
  const r = new THREE.Group();
  const wood = mat('#c99a63', { r: 0.6 });
  limb(r, [-0.32, 0, 0.2], [-0.07, 1.62, 0.02], 0.025, wood);
  limb(r, [0.32, 0, 0.2], [0.07, 1.62, 0.02], 0.025, wood);
  limb(r, [0, 0, -0.38], [0, 1.45, -0.02], 0.025, wood);
  r.add(mesh(box(0.86, 0.04, 0.12), wood, 0, 0.8, 0.14));
  const canvas = new THREE.Group();
  canvas.position.set(0, 1.12, 0.1);
  canvas.rotation.x = -0.12;
  canvas.add(mesh(box(0.8, 0.6, 0.03), mat('#f6f1e6'), 0, 0, 0));
  canvas.add(mesh(new THREE.PlaneGeometry(0.74, 0.54), mat('#ffffff', { map: landscapeTex(), mapKey: 'landscape', r: 0.85 }), 0, 0, 0.017, false));
  r.add(canvas);
  const pal = Sc(mesh(cyl(0.12, 0.12, 0.015, 16), mat('#d9b07a')), 1, 1, 0.75);
  pal.position.set(0.22, 0.83, 0.14);
  r.add(pal);
  ['#ff4f6d', '#3fb6ff', '#ffd23f', '#5fd06a'].forEach((c, i) => r.add(mesh(sph(0.02, 6, 5), mat(c), 0.16 + i * 0.04, 0.845, 0.12 + (i % 2) * 0.03, false)));
  return finish(r, [0, 1.5, 0]);
};

D.sunflowers = () => {
  const r = new THREE.Group();
  r.add(mesh(rbox(1.84, 0.42, 0.55, 0.04), mat('#3d7fd0', { r: 0.6 }), 0, 0.21, 0));
  r.add(mesh(rbox(1.9, 0.05, 0.6, 0.02), mat('#f4efe6'), 0, 0.44, 0));
  r.add(mesh(box(1.76, 0.02, 0.48), mat('#5b3b25'), 0, 0.455, 0));
  const stem = mat('#4c9a45');
  const leaf = mat('#5fae4a', { flat: true });
  const centre = mat('#6b3b1d', { r: 0.9 });
  const pet = [mat('#ffc82a'), mat('#ffb01a')];
  for (let i = 0; i < 5; i++) {
    const x = -0.72 + i * 0.36, h = 0.95 + ((i * 3) % 5) * 0.09, z = (i % 2 ? -0.08 : 0.06);
    limb(r, [x, 0.45, z], [x, h, z], 0.022, stem);
    for (const s of [1, -1]) {
      const l = Sc(mesh(cone(0.06, 0.22, 5), leaf, x + s * 0.08, 0.62 + i * 0.03, z), 1, 1, 0.3);
      l.rotation.z = -s * 1.1;
      r.add(l);
    }
    const head = new THREE.Group();
    head.position.set(x, h + 0.02, z + 0.04);
    head.rotation.x = -0.35;
    head.add(R(mesh(cyl(0.11, 0.11, 0.05, 16), centre, 0, 0, 0), Math.PI / 2));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      const p = Sc(mesh(sph(0.05, 8, 6), pet[k % 2], Math.cos(a) * 0.16, Math.sin(a) * 0.16, -0.005), 0.55, 1.4, 0.3);
      p.rotation.z = a - Math.PI / 2;
      head.add(p);
    }
    r.add(head);
  }
  return finish(r, [0, 1.3, 0]);
};

function globeTex() {
  return paintTex('globe', 256, 128, (g, w, h) => {
    g.fillStyle = '#3d8fd6';
    g.fillRect(0, 0, w, h);
    const rnd = rng(42);
    const blob = (x, y, rx, ry, c) => {
      g.fillStyle = c;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.ellipse(x + (rnd() - 0.5) * rx, y + (rnd() - 0.5) * ry, rx * (0.35 + rnd() * 0.3), ry * (0.35 + rnd() * 0.3), rnd() * 3, 0, TAU);
        g.fill();
      }
    };
    blob(48, 44, 46, 34, '#7cc95e'); blob(70, 92, 26, 34, '#7cc95e');
    blob(130, 40, 40, 24, '#e8c27a'); blob(140, 76, 30, 30, '#7cc95e');
    blob(200, 50, 54, 30, '#7cc95e'); blob(214, 96, 24, 16, '#e8c27a');
    g.fillStyle = '#f4f8ff';
    g.fillRect(0, 0, w, 7);
    g.fillRect(0, h - 7, w, 7);
  });
}

D.globe = () => {
  const r = new THREE.Group();
  const wood = mat(WOOD, { r: 0.55 });
  r.add(mesh(cyl(0.2, 0.24, 0.06, 18), wood, 0, 0.03, 0));
  r.add(mesh(lathe('globe-stand', [[0, 0], [0.06, 0], [0.04, 0.1], [0.06, 0.2], [0.03, 0.35], [0.05, 0.55], [0.07, 0.6], [0, 0.6]], 12), wood, 0, 0.06, 0));
  const tilt = new THREE.Group();
  tilt.position.set(0, 0.94, 0);
  tilt.rotation.z = 0.41;
  tilt.add(R(mesh(torus(0.28, 0.014, 6, 32, Math.PI * 1.25), mat(GOLD, { r: 0.3, m: 0.85 })), 0, 0, Math.PI * 0.375));
  const spin = dyn(new THREE.Group());
  spin.add(mesh(sph(0.25, 24, 16), mat('#ffffff', { map: globeTex(), mapKey: 'globe', r: 0.4 }), 0, 0, 0));
  tilt.add(spin);
  r.add(tilt);
  limb(r, [0, 0.66, 0], [0, 0.72, 0], 0.03, wood);
  return finish(r, [0, 1.25, 0], { animate(t) { spin.rotation.y = t * 0.35; } });
};

D.bonsai = () => {
  const r = new THREE.Group();
  const lac = mat('#7a2e24', { r: 0.4 });
  r.add(mesh(rbox(0.8, 0.06, 0.5, 0.02), lac, 0, 0.42, 0));
  for (const [x, z] of [[-0.34, -0.19], [0.34, -0.19], [-0.34, 0.19], [0.34, 0.19]]) r.add(mesh(box(0.05, 0.4, 0.05), lac, x, 0.2, z));
  r.add(mesh(rbox(0.52, 0.12, 0.32, 0.03), mat('#2f6fb0', { r: 0.25 }), 0, 0.51, 0));
  r.add(mesh(box(0.46, 0.02, 0.26), mat('#4e7a3a'), 0, 0.575, 0));
  const bark = mat('#6b4a32', { r: 0.9 });
  const pts = [[0, 0.57, 0], [0.08, 0.74, 0.02], [-0.06, 0.9, 0], [0.04, 1.04, -0.02]];
  for (let i = 0; i < pts.length - 1; i++) limb(r, pts[i], pts[i + 1], 0.04 - i * 0.008, bark);
  limb(r, [0.06, 0.78, 0.02], [0.24, 0.86, 0.02], 0.02, bark);
  limb(r, [-0.05, 0.9, 0], [-0.22, 0.98, 0.04], 0.018, bark);
  const pad = [mat('#3f8f45', { r: 0.8 }), mat('#62b452', { r: 0.8 })];
  for (const [x, y, z, s, k] of [[0.25, 0.88, 0.02, 0.17, 0], [-0.22, 1.0, 0.04, 0.15, 1], [0.04, 1.1, -0.02, 0.18, 0], [0.1, 0.95, 0.08, 0.1, 1], [-0.08, 1.14, 0.06, 0.1, 1]]) {
    r.add(Sc(mesh(ico(s, 1), pad[k], x, y, z), 1.2, 0.5, 1));
  }
  r.add(mesh(ico(0.04, 0), mat('#9e9e9e', { flat: true }), 0.15, 0.6, 0.06));
  r.add(mesh(ico(0.03, 0), mat('#b5b5b5', { flat: true }), -0.16, 0.595, -0.05));
  return finish(r, [0, 1.25, 0]);
};

D.luckycat = () => {
  const r = new THREE.Group();
  const lac = mat('#c8302c', { r: 0.35 });
  r.add(mesh(rbox(0.5, 0.52, 0.44, 0.04), lac, 0, 0.26, 0));
  r.add(mesh(rbox(0.54, 0.04, 0.48, 0.015), gold(), 0, 0.53, 0));
  r.add(mesh(rbox(0.38, 0.06, 0.34, 0.03), mat('#7d2bb5', { r: 0.8 }), 0, 0.58, 0));
  const white = mat('#fbf8f1', { r: 0.4 });
  r.add(Sc(mesh(sph(0.15, 16, 12), white, 0, 0.75, 0), 1, 1.05, 0.88));
  r.add(mesh(sph(0.135, 16, 12), white, 0, 0.98, 0.01));
  const pink = mat('#ff9aaa');
  for (const s of [1, -1]) {
    r.add(R(Sc(mesh(cone(0.05, 0.09, 4), white, s * 0.08, 1.1, 0), 1, 1, 0.6), 0, 0, -s * 0.3));
    r.add(R(Sc(mesh(cone(0.03, 0.06, 4), pink, s * 0.08, 1.1, 0.02), 1, 1, 0.4), 0, 0, -s * 0.3));
    r.add(Sc(mesh(sph(0.016, 8, 6), mat('#2b2b2b'), s * 0.05, 1.0, 0.125), 1, 0.5, 0.6));
    r.add(Sc(mesh(sph(0.03, 8, 6), mat('#ffc7d0'), s * 0.085, 0.955, 0.11), 1, 0.6, 0.5));
    r.add(mesh(sph(0.045, 10, 8), white, s * 0.08, 0.62, 0.08));
  }
  r.add(mesh(sph(0.014, 8, 6), pink, 0, 0.975, 0.14));
  r.add(R(mesh(torus(0.1, 0.016, 6, 20), mat('#e8343f'), 0, 0.87, 0.0), Math.PI / 2 + 0.15));
  r.add(mesh(sph(0.026, 10, 8), gold(), 0, 0.84, 0.115));
  r.add(R(Sc(mesh(cyl(0.07, 0.07, 0.015, 18), gold(), -0.02, 0.73, 0.14), 0.7, 1, 1), Math.PI / 2 - 0.15));
  const arm = dyn(new THREE.Group());
  arm.position.set(0.12, 0.84, 0.03);
  arm.add(mesh(capsule(0.038, 0.1), white, 0, 0.08, 0));
  arm.add(mesh(sph(0.022, 8, 6), pink, 0, 0.14, 0.03));
  r.add(arm);
  return finish(r, [0, 1.15, 0], { animate(t) { arm.rotation.x = -0.25 + Math.sin(t * 4) * 0.4; } });
};

D.bookshelf = () => {
  const r = new THREE.Group();
  const wood = mat(WOOD, { r: 0.6 });
  r.add(mesh(box(1.76, 1.95, 0.03), mat(WOOD_DARK), 0, 1.0, -0.2));
  for (const x of [-0.89, 0.89]) r.add(mesh(box(0.06, 2.0, 0.44), wood, x, 1.0, 0));
  for (const y of [0.04, 0.52, 1.0, 1.48, 1.97]) r.add(mesh(box(1.84, 0.05, 0.44), wood, 0, y, 0));
  const rnd = rng(11);
  const cols = ['#e8343f', '#2f8cf0', '#2fbf5f', '#ffbb1f', '#9b5cf6', '#ff6fae', '#f4efe6', '#1d1a2f', '#ff8a3a', '#3fb6c8'];
  for (let s = 0; s < 4; s++) {
    const y0 = 0.065 + s * 0.48;
    let x = -0.84;
    while (x < 0.8) {
      if (rnd() < 0.08 && x < 0.55) {
        // a little stack lying flat, or a trinket
        if (rnd() < 0.5) {
          for (let k = 0; k < 3; k++) r.add(mesh(box(0.24, 0.05, 0.28), mat(cols[Math.floor(rnd() * cols.length)], { r: 0.7 }), x + 0.12, y0 + 0.025 + k * 0.05, 0.02));
        } else {
          r.add(mesh(sph(0.08, 12, 10), mat(cols[Math.floor(rnd() * cols.length)], { r: 0.3 }), x + 0.12, y0 + 0.08, 0.02));
        }
        x += 0.28;
        continue;
      }
      const w = 0.045 + rnd() * 0.05, h = 0.28 + rnd() * 0.13;
      const b = mesh(box(w, h, 0.3), mat(cols[Math.floor(rnd() * cols.length)], { r: 0.7 }), x + w / 2, y0 + h / 2, 0.03);
      if (rnd() < 0.08 && x > -0.7) { b.rotation.z = 0.22; b.position.x += 0.04; x += 0.05; }
      r.add(b);
      x += w + 0.006;
    }
  }
  r.add(mesh(cyl(0.1, 0.08, 0.14, 12), mat('#e07a4f'), 0.6, 2.06, 0));
  r.add(mesh(ico(0.14, 1), mat(LEAF), 0.6, 2.2, 0));
  for (let i = 0; i < 4; i++) r.add(Sc(mesh(ico(0.05, 0), mat(LEAF2), 0.68 + i * 0.03, 2.05 - i * 0.12, 0.15), 1, 1.3, 1));
  r.add(mesh(cyl(0.05, 0.07, 0.1, 10), gold(), -0.55, 2.04, 0));
  r.add(mesh(lathe('cup-s', [[0, 0], [0.03, 0], [0.012, 0.04], [0.012, 0.08], [0.07, 0.12], [0.08, 0.2], [0.07, 0.2], [0.06, 0.13], [0, 0.11]]), gold(), -0.55, 2.09, 0));
  return finish(r, [0, 2.1, 0]);
};

D.lantern = () => {
  const r = new THREE.Group();
  const wood = mat('#4a2f22', { r: 0.6 });
  r.add(mesh(rbox(0.36, 0.1, 0.36, 0.03), mat('#a9a59c', { r: 0.9 }), 0, 0.05, 0));
  r.add(mesh(box(0.08, 2.1, 0.08), wood, 0, 1.1, 0));
  r.add(mesh(box(0.9, 0.06, 0.07), wood, 0, 2.05, 0));
  r.add(mesh(box(0.06, 0.2, 0.06), wood, 0.0, 2.15, 0));
  const lamps = [];
  const cols = [['#ff4d3d', '#ff5a2a'], ['#ffb23d', '#ff9a1a'], ['#ff6fae', '#ff3f8a']];
  [[-0.36, 0], [0.36, 1], [0, 2]].forEach(([x, k], i) => {
    const g = dyn(new THREE.Group());
    g.position.set(x, i === 2 ? 1.55 : 2.02, i === 2 ? 0.12 : 0);
    if (i === 2) r.add(mesh(box(0.05, 0.05, 0.16), wood, 0, 1.58, 0.07));
    const [c, e] = cols[k];
    g.add(mesh(cyl(0.004, 0.004, 0.22, 4), mat('#2b2b2b'), 0, -0.11, 0, false));
    const L = i === 2 ? 0.12 : 0.16;
    g.add(Sc(mesh(sph(L, 14, 10), mat(c, { e, ei: 0.9, r: 0.6 }), 0, -0.22 - L, 0, false), 1, 1.2, 1));
    g.add(mesh(cyl(L * 0.5, L * 0.5, 0.03, 10), mat('#2b2b2b'), 0, -0.22 - L * 0.1, 0, false));
    g.add(mesh(cyl(L * 0.45, L * 0.45, 0.03, 10), mat('#2b2b2b'), 0, -0.22 - L * 2.15, 0, false));
    g.add(mesh(cone(0.025, 0.1, 6), mat('#ffd23f'), 0, -0.22 - L * 2.35 - 0.05, 0, false));
    g.children[g.children.length - 1].rotation.x = Math.PI;
    r.add(g);
    lamps.push(g);
  });
  return finish(r, [0, 2.1, 0], {
    light: { y: 1.7, color: '#ffa860', intensity: 4, distance: 4 },
    animate(t) { lamps.forEach((g, i) => { g.rotation.z = Math.sin(t * 1.3 + i * 1.7) * 0.07; g.rotation.x = Math.sin(t * 0.9 + i) * 0.04; }); },
  });
};

const heartGeo = () => geo('heart', () => {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * TAU;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(new THREE.Vector3(x * 0.017, y * 0.017 + 0.02, 0));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.022, 8, true);
});

D.neon = () => {
  const r = new THREE.Group();
  const dark = mat('#1b2440', { r: 0.5 });
  r.add(mesh(rbox(0.6, 0.06, 0.32, 0.02), dark, 0, 0.03, 0));
  r.add(mesh(box(0.05, 1.0, 0.05), chrome(), -0.32, 0.55, 0));
  r.add(mesh(box(0.05, 1.0, 0.05), chrome(), 0.32, 0.55, 0));
  r.add(mesh(rbox(0.86, 0.82, 0.06, 0.04), dark, 0, 1.38, -0.02));
  r.add(mesh(rbox(0.9, 0.86, 0.04, 0.04), chrome(), 0, 1.38, -0.05));
  const pinkMat = umat('#ffd0ea', { e: '#ff3fa8', ei: 2.2 });
  r.add(mesh(heartGeo(), pinkMat, 0, 1.38, 0.03, false));
  const dotMat = umat('#d6fbff', { e: '#3fe0ff', ei: 2 });
  for (const [x, y] of [[-0.3, 1.66], [0.31, 1.12], [0.3, 1.65]]) {
    r.add(mesh(sph(0.025, 8, 6), dotMat, x, y, 0.03, false));
  }
  const light = { y: 1.4, color: '#ff4fa8', intensity: 4, distance: 3.5 };
  return finish(r, [0, 1.8, 0], {
    light,
    animate(t) {
      const off = Math.sin(t * 23) + Math.sin(t * 7.3) > 1.75;
      const k = off ? 0.25 : 1;
      pinkMat.emissiveIntensity = 2.2 * k + Math.sin(t * 2) * 0.2;
      dotMat.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.9;
      light.intensity = 4 * k;
    },
  });
};

D.clock = () => {
  const r = new THREE.Group();
  const wood = mat('#6b3b22', { r: 0.5 });
  const trim = gold();
  r.add(mesh(rbox(0.62, 0.3, 0.42, 0.03), wood, 0, 0.15, 0));
  r.add(mesh(rbox(0.5, 1.15, 0.36, 0.03), wood, 0, 0.87, 0));
  r.add(mesh(rbox(0.64, 0.64, 0.42, 0.04), wood, 0, 1.76, 0));
  r.add(mesh(rbox(0.68, 0.07, 0.46, 0.02), wood, 0, 2.1, 0));
  r.add(R(mesh(cyl(0.2, 0.2, 0.42, 20, false, -Math.PI / 2, Math.PI), wood, 0, 2.13, 0), -Math.PI / 2));
  r.add(mesh(sph(0.045, 10, 8), trim, 0, 2.38, 0));
  r.add(R(mesh(cyl(0.22, 0.22, 0.02, 28), mat('#fbf4e2'), 0, 1.76, 0.215), Math.PI / 2));
  r.add(R(mesh(torus(0.225, 0.02, 6, 28), trim, 0, 1.76, 0.22), 0));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    r.add(R(mesh(box(0.014, i % 3 ? 0.03 : 0.05, 0.01), mat('#2b2b2b'), Math.sin(a) * 0.17, 1.76 + Math.cos(a) * 0.17, 0.228, false), 0, 0, -a));
  }
  const hand = mat('#2b2b2b');
  r.add(R(mesh(box(0.016, 0.1, 0.008), hand, -0.04, 1.79, 0.235, false), 0, 0, 1.0));
  r.add(R(mesh(box(0.012, 0.15, 0.008), hand, 0.05, 1.82, 0.238, false), 0, 0, -0.6));
  r.add(mesh(sph(0.015, 8, 6), trim, 0, 1.76, 0.24, false));
  r.add(mesh(rbox(0.34, 0.82, 0.02, 0.02), mat('#2a1a12'), 0, 0.92, 0.18));
  r.add(mesh(rbox(0.38, 0.86, 0.015, 0.02), trim, 0, 0.92, 0.172));
  const pend = dyn(new THREE.Group());
  pend.position.set(0, 1.3, 0.2);
  pend.add(mesh(box(0.014, 0.58, 0.01), trim, 0, -0.29, 0, false));
  pend.add(R(mesh(cyl(0.07, 0.07, 0.016, 20), trim, 0, -0.6, 0, false), Math.PI / 2));
  r.add(pend);
  return finish(r, [0, 2.3, 0], { animate(t) { pend.rotation.z = Math.sin(t * Math.PI) * 0.2; } });
};

// ---------------------------------------------------------------------------- showpieces

D.cat = () => {
  const r = new THREE.Group();
  const wicker = mat('#e2b26e', { r: 0.85 });
  r.add(mesh(cyl(0.36, 0.3, 0.2, 22), wicker, 0, 0.1, 0));
  r.add(R(mesh(torus(0.36, 0.045, 8, 26), mat('#b07c45', { r: 0.85 }), 0, 0.2, 0), Math.PI / 2));
  r.add(R(mesh(torus(0.335, 0.012, 6, 26), mat('#9a6a3a'), 0, 0.1, 0), Math.PI / 2));
  r.add(mesh(cyl(0.31, 0.31, 0.06, 22), mat('#4f8fe0', { r: 0.9 }), 0, 0.21, 0));
  for (let i = 0; i < 4; i++) r.add(mesh(box(0.6 - Math.abs(i - 1.5) * 0.18, 0.005, 0.04), mat('#8fc0ff'), 0, 0.242, -0.21 + i * 0.14, false));
  const fur = mat('#f39a3c', { r: 0.7 });
  const stripe = mat('#d9741f', { r: 0.7 });
  const white = mat('#fff6ea', { r: 0.7 });
  const body = dyn(new THREE.Group());
  body.position.set(0, 0.24, 0);
  body.scale.setScalar(1.25);
  body.add(Sc(mesh(sph(0.2, 18, 12), fur, 0, 0.09, -0.02), 1.15, 0.6, 0.95));
  for (let i = 0; i < 3; i++) body.add(Sc(mesh(sph(0.06, 10, 8), stripe, -0.12 + i * 0.1, 0.19, -0.04), 0.5, 0.25, 1.9));
  const head = new THREE.Group();
  head.position.set(0.17, 0.11, 0.1);
  head.add(Sc(mesh(sph(0.11, 16, 12), fur, 0, 0, 0), 1, 0.88, 0.95));
  head.add(Sc(mesh(sph(0.05, 10, 8), white, 0.02, -0.04, 0.07), 1.2, 0.8, 0.8));
  for (const s of [1, -1]) {
    head.add(R(Sc(mesh(cone(0.045, 0.08, 4), fur, s * 0.065, 0.09, -0.01), 1, 1, 0.55), 0, 0, -s * 0.35));
    head.add(R(mesh(box(0.035, 0.008, 0.01), mat('#3b2a20'), s * 0.042, 0.01, 0.1, false), 0, 0, s * 0.25));
  }
  head.add(mesh(sph(0.012, 8, 6), mat('#ff8a9a'), 0, -0.01, 0.105, false));
  body.add(head);
  body.add(mesh(sph(0.045, 10, 8), white, 0.14, 0.0, 0.17));
  body.add(mesh(sph(0.045, 10, 8), white, 0.05, 0.0, 0.18));
  r.add(body);
  const tail = dyn(new THREE.Group());
  tail.position.set(-0.05, 0.27, 0.0);
  tail.scale.setScalar(1.25);
  tail.add(R(mesh(torus(0.2, 0.035, 6, 16, Math.PI * 0.9), fur, 0, 0, 0), Math.PI / 2, 0, Math.PI * 0.25));
  tail.add(mesh(sph(0.037, 8, 6), white, -0.14, 0, 0.14));
  r.add(tail);
  return finish(r, [0, 0.6, 0], {
    animate(t) {
      const b = Math.sin(t * 1.8);
      body.scale.set(1.25 + b * 0.02, 1.25 + b * 0.06, 1.25 + b * 0.02);
      tail.rotation.y = Math.sin(t * 0.8) * 0.12 + Math.max(0, Math.sin(t * 0.37)) ** 6 * 0.3;
    },
  });
};

D.parrot = () => {
  const r = new THREE.Group();
  const brass = mat('#c9a04a', { r: 0.3, m: 0.85 });
  r.add(mesh(cyl(0.24, 0.28, 0.05, 18), brass, 0, 0.025, 0));
  r.add(mesh(cyl(0.024, 0.024, 1.36, 8), brass, 0, 0.7, 0));
  r.add(R(mesh(cyl(0.02, 0.02, 0.66, 8), mat('#8a5a33'), 0, 1.38, 0), 0, 0, Math.PI / 2));
  for (const s of [1, -1]) {
    r.add(mesh(cyl(0.06, 0.045, 0.06, 12), brass, s * 0.3, 1.42, 0));
    r.add(mesh(sph(0.045, 8, 6), mat('#e8c27a', { flat: true }), s * 0.3, 1.45, 0));
  }
  const red = mat('#e8302a', { r: 0.5 });
  const bird = dyn(new THREE.Group());
  bird.position.set(0, 1.4, 0);
  bird.scale.setScalar(1.5);
  bird.add(R(mesh(capsule(0.085, 0.13), red, 0, 0.14, 0), -0.25));
  bird.add(mesh(box(0.06, 0.03, 0.03), mat('#7a7a7a'), 0, 0.01, 0.02, false));
  for (const s of [1, -1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.08, 0.15, -0.01);
    w.rotation.set(-0.3, 0, s * 0.12);
    w.add(mesh(rbox(0.04, 0.12, 0.13, 0.02), mat('#ffd23f'), 0, 0.03, 0));
    w.add(mesh(rbox(0.04, 0.12, 0.12, 0.02), mat('#2f8cf0'), 0, -0.08, -0.02));
    bird.add(w);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.04, -0.08);
  tail.rotation.x = 0.5;
  tail.add(mesh(box(0.05, 0.3, 0.015), mat('#2f8cf0'), -0.02, -0.15, 0));
  tail.add(mesh(box(0.05, 0.34, 0.015), red, 0.025, -0.17, 0));
  bird.add(tail);
  const head = dyn(new THREE.Group());
  head.position.set(0, 0.3, -0.02);
  head.add(mesh(sph(0.075, 14, 10), red, 0, 0, 0));
  for (const s of [1, -1]) {
    head.add(Sc(mesh(sph(0.035, 10, 8), mat('#fff6ea'), s * 0.05, 0.0, 0.03), 0.5, 1, 1));
    head.add(mesh(sph(0.014, 6, 5), mat('#1d1a2f'), s * 0.066, 0.012, 0.035, false));
  }
  head.add(R(mesh(cone(0.032, 0.09, 8), mat('#f3e3c3'), 0, -0.02, 0.09), Math.PI / 2 + 0.7));
  head.add(R(mesh(cone(0.022, 0.04, 8), mat('#2b2b2b'), 0, -0.05, 0.07), Math.PI / 2 + 1.2));
  bird.add(head);
  r.add(bird);
  return finish(r, [0, 2.0, 0], {
    animate(t) {
      head.rotation.z = Math.sin(t * 2.2) * 0.22;
      head.rotation.x = Math.max(0, Math.sin(t * 3.1)) ** 3 * 0.35;
      bird.rotation.y = Math.sin(t * 0.35) * 0.7;
      bird.position.y = 1.4 + Math.max(0, Math.sin(t * 1.7)) ** 12 * 0.08;
    },
  });
};

function signTex(key, text, bg, fg, w = 256, h = 80) {
  return paintTex(key, w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${Math.round(h * 0.62)}px ${SIGN_FONT}`;
    g.lineWidth = 8;
    g.strokeStyle = '#1d1a2f';
    g.strokeText(text, w / 2, h / 2 + 3);
    g.fillStyle = fg;
    g.fillText(text, w / 2, h / 2 + 3);
  });
}

D.popcorn = () => {
  const r = new THREE.Group();
  const red = mat('#e23b3b', { r: 0.4 });
  const trim = gold();
  for (const s of [1, -1]) {
    r.add(R(mesh(cyl(0.2, 0.2, 0.05, 18), mat('#2b2b2b'), s * 0.4, 0.2, 0.05), 0, 0, Math.PI / 2));
    r.add(R(mesh(cyl(0.07, 0.07, 0.07, 10), trim, s * 0.4, 0.2, 0.05), 0, 0, Math.PI / 2));
    for (let k = 0; k < 4; k++) r.add(R(mesh(box(0.02, 0.34, 0.02), trim, s * 0.42, 0.2, 0.05), (k / 4) * Math.PI, 0, 0));
  }
  r.add(mesh(rbox(0.74, 0.42, 0.56, 0.05), red, 0, 0.5, 0));
  for (let i = 0; i < 4; i++) r.add(mesh(box(0.07, 0.4, 0.01), mat('#fff6ea'), -0.27 + i * 0.18, 0.5, 0.285));
  r.add(mesh(rbox(0.78, 0.05, 0.6, 0.02), trim, 0, 0.73, 0));
  const rnd = rng(5);
  const pop = [mat('#fff6d8', { flat: true }), mat('#ffe7a0', { flat: true })];
  for (let i = 0; i < 46; i++) r.add(mesh(ico(0.035, 0), pop[i % 2], (rnd() - 0.5) * 0.6, 0.78 + rnd() * rnd() * 0.16, (rnd() - 0.5) * 0.42, false));
  r.add(see(mesh(box(0.7, 0.55, 0.5), glass('#fff8e8', 0.22), 0, 1.03, 0, false)));
  for (const [x, z] of [[-0.35, -0.25], [0.35, -0.25], [-0.35, 0.25], [0.35, 0.25]]) r.add(mesh(box(0.03, 0.56, 0.03), trim, x, 1.03, z));
  r.add(mesh(rbox(0.78, 0.04, 0.58, 0.02), trim, 0, 1.31, 0));
  r.add(mesh(cyl(0.08, 0.06, 0.08, 12), chrome(), 0.1, 1.22, 0));
  r.add(mesh(cyl(0.01, 0.01, 0.06, 6), chrome(), 0.1, 1.28, 0));
  for (let i = 0; i < 8; i++) {
    const seg = mesh(cyl(0.03, 0.56, 0.26, 3, false, (i / 8) * TAU, TAU / 8), mat(i % 2 ? '#fff6ea' : '#e23b3b', { r: 0.6 }), 0, 1.47, 0);
    r.add(seg);
  }
  r.add(mesh(sph(0.05, 10, 8), trim, 0, 1.63, 0));
  r.add(mesh(new THREE.PlaneGeometry(0.5, 0.16), mat('#ffffff', { map: signTex('sign-popcorn', 'Popcorn', '#ffd23f', '#e23b3b'), mapKey: 'sign-popcorn' }), 0, 0.55, 0.292, false));
  const kernels = [];
  for (let i = 0; i < 4; i++) {
    const k = dyn(mesh(ico(0.03, 0), pop[0], (i - 1.5) * 0.12, 0.9, (i % 2 ? 0.08 : -0.08), false));
    r.add(k);
    kernels.push(k);
  }
  return finish(r, [0, 1.6, 0], {
    animate(t) {
      kernels.forEach((k, i) => {
        const p = (t * 1.6 + i * 0.37) % 1;
        k.position.y = 0.86 + Math.sin(p * Math.PI) * 0.3;
        k.rotation.set(t * 5 + i, t * 3, 0);
      });
    },
  });
};

D.sodafridge = () => {
  const r = new THREE.Group();
  const red = mat('#e8343f', { r: 0.35 });
  r.add(mesh(box(0.86, 1.95, 0.06), red, 0, 0.975, -0.32));
  for (const x of [-0.395, 0.395]) r.add(mesh(box(0.07, 1.95, 0.7), red, x, 0.975, 0));
  r.add(mesh(rbox(0.86, 0.36, 0.7, 0.05), red, 0, 1.77, 0));
  r.add(mesh(rbox(0.86, 0.3, 0.7, 0.04), red, 0, 0.15, 0));
  r.add(mesh(box(0.72, 1.3, 0.02), mat('#eef8ff', { e: '#cfeeff', ei: 0.55 }), 0, 0.95, -0.28));
  const shelf = chrome();
  const cols = ['#e8343f', '#ff9a1a', '#2fbf5f', '#9b5cf6', '#6b3b1d', '#3fb6ff'];
  for (let s = 0; s < 4; s++) {
    const y = 0.38 + s * 0.32;
    r.add(mesh(box(0.7, 0.02, 0.38), shelf, 0, y, 0.0));
    for (let i = 0; i < 6; i++) {
      const c = mat(cols[(i + s * 2) % cols.length], { r: 0.25 });
      const x = -0.27 + i * 0.108;
      r.add(mesh(cyl(0.038, 0.038, 0.15, 10), c, x, y + 0.085, 0.02, false));
      r.add(mesh(cyl(0.014, 0.034, 0.06, 10), c, x, y + 0.19, 0.02, false));
      r.add(mesh(cyl(0.016, 0.016, 0.015, 8), mat('#f4f4f4'), x, y + 0.225, 0.02, false));
    }
  }
  r.add(see(mesh(box(0.72, 1.34, 0.02), glass('#e6f7ff', 0.18), 0, 0.95, 0.35, false)));
  r.add(mesh(box(0.035, 0.5, 0.04), chrome(), 0.33, 1.0, 0.38));
  r.add(mesh(rbox(0.8, 0.28, 0.04, 0.03), mat('#fff6e0', { e: '#fff1c2', ei: 0.7 }), 0, 1.78, 0.35));
  r.add(mesh(new THREE.PlaneGeometry(0.66, 0.2), mat('#ffffff', { map: signTex('sign-soda', 'Fizz!', '#fff6e0', '#e8343f'), mapKey: 'sign-soda', e: '#ffffff', ei: 0.15 }), 0, 1.78, 0.372, false));
  r.add(mesh(box(0.8, 0.12, 0.04), mat('#2b2b2b'), 0, 0.1, 0.35));
  return finish(r, [0, 2.0, 0], { light: { y: 1.1, color: '#bfe6ff', intensity: 2.5, distance: 3 } });
};

let marqueeMat = null;
function arcadeMarquee() {
  if (!marqueeMat) {
    const map = paintTex('arcade-marquee', 256, 80, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#ff3fa8');
      grad.addColorStop(1, '#ffbb1f');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `52px ${SIGN_FONT}`;
      g.lineWidth = 8;
      g.strokeStyle = '#1d1a2f';
      g.strokeText('PLAY!', w / 2, h / 2 + 3);
      g.fillStyle = '#ffffff';
      g.fillText('PLAY!', w / 2, h / 2 + 3);
    });
    marqueeMat = new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.6, roughness: 0.5 });
  }
  return marqueeMat;
}

D.arcade = () => {
  const r = new THREE.Group();
  const body = mat('#5b2fc9', { r: 0.45 });
  const black = mat('#1d1a2f', { r: 0.5 });
  r.add(mesh(rbox(0.72, 1.02, 0.62, 0.04), body, 0, 0.51, 0));
  r.add(mesh(rbox(0.72, 0.85, 0.46, 0.04), body, 0, 1.45, -0.08));
  r.add(R(mesh(rbox(0.74, 0.08, 0.34, 0.02), black, 0, 1.06, 0.2), 0.3));
  r.add(mesh(rbox(0.74, 0.24, 0.52, 0.04), body, 0, 1.95, -0.04));
  r.add(mesh(new THREE.PlaneGeometry(0.66, 0.18), arcadeMarquee(), 0, 1.95, 0.225, false));
  for (const s of [1, -1]) {
    r.add(mesh(box(0.012, 1.6, 0.06), mat('#3fe0ff'), s * 0.365, 1.05, 0.12));
    r.add(mesh(box(0.012, 0.9, 0.05), mat('#ff3fa8'), s * 0.365, 0.6, -0.1));
  }
  r.add(mesh(cyl(0.035, 0.04, 0.02, 12), black, -0.15, 1.12, 0.22));
  r.add(R(mesh(cyl(0.012, 0.012, 0.1, 8), mat('#cfd4da', { m: 0.8, r: 0.3 }), -0.15, 1.16, 0.22), 0, 0, 0.2));
  r.add(mesh(sph(0.035, 10, 8), mat('#e8343f', { r: 0.3 }), -0.14, 1.21, 0.22));
  ['#ffd23f', '#3fe0ff', '#2fbf5f'].forEach((c, i) => r.add(mesh(cyl(0.025, 0.025, 0.03, 12), mat(c, { r: 0.3 }), 0.05 + i * 0.08, 1.11, 0.22 + (i % 2) * 0.03)));
  r.add(mesh(rbox(0.22, 0.24, 0.02, 0.02), black, 0, 0.55, 0.31));
  r.add(mesh(box(0.03, 0.07, 0.01), mat('#ffb03a', { e: '#ff8a1a', ei: 1.5 }), -0.05, 0.57, 0.322, false));
  r.add(mesh(box(0.03, 0.07, 0.01), mat('#ffb03a', { e: '#ff8a1a', ei: 1.5 }), 0.05, 0.57, 0.322, false));
  const screen = new THREE.Group();
  screen.position.set(0, 1.47, 0.155);
  screen.rotation.x = -0.12;
  screen.add(mesh(rbox(0.6, 0.5, 0.02, 0.01), black, 0, 0, -0.005));
  const glow = umat('#0d1440', { e: '#1a2a7a', ei: 0.9 });
  screen.add(mesh(box(0.52, 0.42, 0.01), glow, 0, 0, 0.006, false));
  const sprites = dyn(new THREE.Group());
  sprites.position.z = 0.013;
  const inv = umat('#a8ff9a', { e: '#56ff6a', ei: 1.6 });
  const invaders = new THREE.Group();
  for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) invaders.add(mesh(box(0.045, 0.03, 0.006), inv, -0.16 + i * 0.08, 0.13 - row * 0.06, 0, false));
  sprites.add(invaders);
  const ship = mesh(box(0.06, 0.03, 0.006), umat('#d6fbff', { e: '#3fe0ff', ei: 1.8 }), 0, -0.16, 0, false);
  sprites.add(ship);
  const shot = mesh(box(0.01, 0.03, 0.006), umat('#fff6c8', { e: '#ffe066', ei: 2 }), 0, 0, 0, false);
  sprites.add(shot);
  screen.add(sprites);
  r.add(screen);
  return finish(r, [0, 2.1, 0], {
    light: { y: 1.5, color: '#8a6bff', intensity: 3, distance: 3 },
    animate(t) {
      invaders.position.x = Math.sin(t * 0.8) * 0.06;
      invaders.position.y = -((t * 0.02) % 0.08);
      ship.position.x = Math.sin(t * 1.7) * 0.18;
      const p = (t * 1.4) % 1;
      shot.position.set(Math.sin((t - p / 1.4) * 1.7) * 0.18, -0.13 + p * 0.3, 0);
      glow.emissiveIntensity = 0.8 + Math.sin(t * 9) * 0.05;
    },
  });
};

function cake(root, x, y, z, s, c1, c2, top = '#e8343f') {
  root.add(mesh(cyl(0.17 * s, 0.17 * s, 0.07 * s, 20), mat(c1, { r: 0.6 }), x, y + 0.035 * s, z));
  root.add(mesh(cyl(0.172 * s, 0.172 * s, 0.025 * s, 20), mat(c2, { r: 0.5 }), x, y + 0.083 * s, z));
  root.add(mesh(cyl(0.17 * s, 0.17 * s, 0.07 * s, 20), mat(c1, { r: 0.6 }), x, y + 0.13 * s, z));
  root.add(mesh(cyl(0.175 * s, 0.175 * s, 0.025 * s, 20), mat(c2, { r: 0.5 }), x, y + 0.175 * s, z));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    root.add(mesh(sph(0.028 * s, 8, 6), mat(c2), x + Math.cos(a) * 0.14 * s, y + 0.19 * s, z + Math.sin(a) * 0.14 * s, false));
  }
  root.add(mesh(sph(0.035 * s, 10, 8), mat(top, { r: 0.3 }), x, y + 0.22 * s, z, false));
}

D.cakecase = () => {
  const r = new THREE.Group();
  r.add(mesh(rbox(1.86, 0.78, 0.64, 0.05), mat('#f7b3c8', { r: 0.5 }), 0, 0.39, 0));
  for (let i = 0; i < 9; i++) r.add(mesh(box(0.1, 0.6, 0.01), mat(i % 2 ? '#fff6ea' : '#ff8fb0'), -0.8 + i * 0.2, 0.39, 0.322));
  r.add(mesh(rbox(1.9, 0.05, 0.68, 0.02), mat('#fff6ea'), 0, 0.8, 0));
  cake(r, -0.56, 0.83, 0.02, 1, '#ffb3c6', '#ffffff');
  cake(r, 0.0, 0.83, 0.02, 1, '#7a4a2e', '#f3dcc2', '#ffd23f');
  cake(r, 0.56, 0.83, 0.02, 1, '#ffe27a', '#ffffff', '#5fd06a');
  r.add(see(mesh(box(1.78, 0.5, 0.58), glass('#f2fbff', 0.2), 0, 1.07, 0, false)));
  for (const x of [-0.88, 0.88]) for (const z of [-0.28, 0.28]) r.add(mesh(box(0.03, 0.5, 0.03), chrome(), x, 1.07, z));
  r.add(mesh(rbox(1.84, 0.04, 0.64, 0.02), mat('#fff6ea'), 0, 1.34, 0));
  const top = dyn(new THREE.Group());
  top.position.set(0.45, 1.36, 0);
  top.add(mesh(cyl(0.2, 0.2, 0.02, 20), chrome(), 0, 0.01, 0));
  cake(top, 0, 0.02, 0, 1.15, '#ffffff', '#ff8fb0', '#e8343f');
  cake(top, 0, 0.26, 0, 0.75, '#ffffff', '#ff8fb0', '#e8343f');
  cake(top, 0, 0.42, 0, 0.5, '#ffffff', '#ff8fb0', '#e8343f');
  r.add(top);
  r.add(mesh(cyl(0.12, 0.1, 0.02, 16), chrome(), -0.5, 1.37, 0));
  for (let i = 0; i < 3; i++) {
    const x = -0.56 + i * 0.06, z = -0.04 + (i % 2) * 0.08;
    r.add(mesh(cyl(0.035, 0.028, 0.05, 10), mat('#ffbb1f'), x, 1.405, z));
    r.add(mesh(sph(0.035, 10, 8), mat(['#ff8fb0', '#b98cff', '#ffffff'][i]), x, 1.44, z, false));
  }
  return finish(r, [0, 1.9, 0], { animate(t) { top.rotation.y = t * 0.4; } });
};

function trophyCup(root, x, y, z, s, material) {
  root.add(mesh(box(0.12 * s, 0.05 * s, 0.12 * s), mat('#5b3420'), x, y + 0.025 * s, z));
  root.add(mesh(lathe('cup', [[0, 0], [0.05, 0], [0.02, 0.03], [0.018, 0.1], [0.06, 0.14], [0.085, 0.24], [0.075, 0.24], [0.05, 0.15], [0, 0.13]]), material, x, y + 0.05 * s, z));
  root.children[root.children.length - 1].scale.setScalar(s);
  for (const side of [1, -1]) root.add(R(mesh(torus(0.04 * s, 0.009 * s, 6, 12, Math.PI), material, x + side * 0.08 * s, y + 0.23 * s, z), 0, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2));
}

D.trophy = () => {
  const r = new THREE.Group();
  const wood = mat('#5b3420', { r: 0.5 });
  r.add(mesh(box(1.8, 1.72, 0.03), mat('#3b4f9a', { r: 0.9 }), 0, 0.98, -0.21));
  for (const x of [-0.89, 0.89]) r.add(mesh(box(0.06, 1.8, 0.48), wood, x, 0.9, 0));
  r.add(mesh(rbox(1.86, 0.3, 0.5, 0.03), wood, 0, 0.15, 0));
  r.add(mesh(rbox(1.9, 0.08, 0.52, 0.02), wood, 0, 1.82, 0));
  for (const y of [0.3, 0.86, 1.36]) r.add(mesh(box(1.74, 0.03, 0.42), mat('#f4efe6'), 0, y, 0));
  const g = gold();
  const silver = mat('#e2e6ea', { r: 0.2, m: 0.85 });
  const bronze = mat('#d08a4e', { r: 0.3, m: 0.8 });
  trophyCup(r, 0, 0.32, 0, 1.9, g);
  trophyCup(r, -0.55, 0.32, 0, 1.3, silver);
  trophyCup(r, 0.55, 0.32, 0, 1.3, bronze);
  trophyCup(r, -0.3, 0.88, 0, 1.1, g);
  trophyCup(r, 0.6, 0.88, 0, 1.0, silver);
  r.add(mesh(box(0.06, 0.18, 0.06), mat('#2b2b2b'), 0.2, 0.97, 0));
  r.add(mesh(ico(0.1, 0), g, 0.2, 1.12, 0));
  r.add(mesh(rbox(0.36, 0.26, 0.03, 0.01), wood, -0.55, 1.5, -0.15));
  r.add(mesh(box(0.3, 0.2, 0.01), mat('#fff6ea'), -0.55, 1.5, -0.133));
  r.add(mesh(ico(0.05, 0), mat('#ffbb1f'), -0.55, 1.5, -0.12, false));
  for (const [x, c] of [[0.0, '#e8343f'], [0.3, '#2f8cf0'], [0.6, '#2fbf5f']]) {
    r.add(mesh(box(0.06, 0.16, 0.01), mat(c), x, 1.6, -0.17));
    r.add(R(mesh(cyl(0.06, 0.06, 0.015, 16), g, x, 1.48, -0.16), Math.PI / 2));
  }
  r.add(see(mesh(box(1.74, 1.5, 0.02), glass('#eaf6ff', 0.16), 0, 1.06, 0.23, false)));
  r.add(mesh(box(0.02, 1.5, 0.03), g, 0, 1.06, 0.24));
  r.add(mesh(box(0.5, 0.06, 0.3), mat('#fff6d0', { e: '#fff1b0', ei: 1.0 }), 0, 1.77, 0));
  return finish(r, [0, 1.95, 0]);
};

D.wishingwell = () => {
  const r = new THREE.Group();
  r.add(mesh(cyl(0.66, 0.7, 0.5, 22), mat('#a9a59c', { r: 0.9 }), 0, 0.25, 0));
  const rnd = rng(3);
  const stones = ['#b8b3a8', '#9d988e', '#c9c4b8', '#a6a197'];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + (row % 2) * (TAU / 24);
      const s = mesh(rbox(0.32, 0.15, 0.12, 0.04), mat(stones[Math.floor(rnd() * 4)], { r: 0.9 }), Math.cos(a) * 0.69, 0.1 + row * 0.16, Math.sin(a) * 0.69);
      s.rotation.y = -a + Math.PI / 2;
      r.add(s);
    }
  }
  r.add(R(mesh(torus(0.64, 0.07, 8, 26), mat('#d9d2c5', { r: 0.85 }), 0, 0.52, 0), Math.PI / 2));
  r.add(mesh(cyl(0.58, 0.58, 0.02, 22), mat('#3a9bd0', { r: 0.1, m: 0.2, e: '#0a3550', ei: 0.5 }), 0, 0.42, 0));
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, d = rnd() * 0.45;
    r.add(mesh(cyl(0.035, 0.035, 0.01, 10), gold(), Math.cos(a) * d, 0.435, Math.sin(a) * d, false));
  }
  const wood = mat('#7a4a2e', { r: 0.6 });
  for (const s of [1, -1]) r.add(mesh(box(0.1, 1.82, 0.1), wood, s * 0.66, 1.13, 0));
  const roof = mat('#d0473a', { r: 0.7 });
  for (const s of [1, -1]) {
    const p = mesh(rbox(1.7, 0.06, 0.62, 0.02), roof, 0, 1.86, s * 0.24);
    p.rotation.x = s * 0.62;
    r.add(p);
    for (let k = 0; k < 3; k++) {
      const d = 0.14 + k * 0.15;
      const st = mesh(box(1.72, 0.025, 0.025), mat('#a8352b'), 0, 2.07 - d * Math.sin(0.62), s * d * Math.cos(0.62));
      st.rotation.x = s * 0.62;
      r.add(st);
    }
  }
  r.add(R(mesh(cyl(0.05, 0.05, 1.72, 8), mat('#a8352b'), 0, 2.06, 0), 0, 0, Math.PI / 2));
  r.add(R(mesh(cyl(0.04, 0.04, 1.4, 8), wood, 0, 1.45, 0), 0, 0, Math.PI / 2));
  r.add(mesh(cyl(0.08, 0.08, 0.1, 10), mat('#d9c9a3'), 0, 1.45, 0));
  r.add(R(mesh(box(0.03, 0.2, 0.03), wood, 0.76, 1.38, 0.0), 0, 0, 0));
  r.add(mesh(box(0.14, 0.03, 0.03), wood, 0.82, 1.3, 0));
  r.add(mesh(cyl(0.006, 0.006, 0.3, 4), mat('#d9c9a3'), 0, 1.25, 0, false));
  r.add(mesh(cyl(0.1, 0.08, 0.14, 12), wood, 0, 1.03, 0));
  r.add(R(mesh(torus(0.095, 0.012, 6, 16), mat('#4a4f57', { m: 0.6, r: 0.4 }), 0, 1.07, 0), Math.PI / 2));
  for (let i = 0; i < 5; i++) flower(r, Math.cos(i * 1.4 + 0.5) * 0.85, 0.08, Math.sin(i * 1.4 + 0.5) * 0.85, ['#ff6fae', '#ffd23f', '#ffffff', '#b98cff', '#ff9a4d'][i], 0.06);
  return finish(r, [0, 2.2, 0]);
};

const pianoShape = () => {
  const s = new THREE.Shape();
  s.moveTo(-0.74, -0.5);
  s.lineTo(0.74, -0.5);
  s.lineTo(0.74, -0.15);
  s.bezierCurveTo(0.74, 0.3, 0.2, 0.3, 0.05, 0.78);
  s.quadraticCurveTo(-0.15, 0.95, -0.74, 0.86);
  s.lineTo(-0.74, -0.5);
  return s;
};

D.piano = () => {
  const r = new THREE.Group();
  const lacquer = mat('#1b1b22', { r: 0.18, m: 0.15 });
  const body = mesh(geo('piano-body', () => new THREE.ExtrudeGeometry(pianoShape(), { depth: 0.28, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 18 })), lacquer, 0, 0.68, 0);
  body.rotation.x = -Math.PI / 2;
  r.add(body);
  const felt = mesh(geo('piano-plate', () => new THREE.ShapeGeometry(pianoShape(), 18)), mat('#7a2335', { r: 0.9 }), 0, 0.99, 0, false);
  felt.rotation.x = -Math.PI / 2;
  felt.scale.set(0.92, 0.92, 1);
  r.add(felt);
  const plate = mesh(felt.geometry, mat('#c99a3a', { r: 0.3, m: 0.8 }), -0.08, 0.995, -0.05, false);
  plate.rotation.x = -Math.PI / 2;
  plate.scale.set(0.7, 0.72, 1);
  r.add(plate);
  for (let i = 0; i < 9; i++) r.add(mesh(box(0.006, 0.004, 1.0 - Math.abs(i - 4) * 0.06), mat('#eadfc8', { m: 0.6, r: 0.3 }), -0.5 + i * 0.1, 1.0, 0.0, false));
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-0.76, 1.0, 0);
  lidPivot.rotation.z = 0.62;
  const lid = mesh(geo('piano-lid', () => new THREE.ExtrudeGeometry(pianoShape(), { depth: 0.025, bevelEnabled: false, curveSegments: 18 })), lacquer, 0.76, 0, 0);
  lid.rotation.x = -Math.PI / 2;
  lidPivot.add(lid);
  r.add(lidPivot);
  limb(r, [0.35, 0.99, 0.1], [0.35, 1.79, 0.1], 0.012, lacquer);
  r.add(mesh(box(1.5, 0.1, 0.28), lacquer, 0, 0.74, 0.62));
  r.add(mesh(box(1.38, 0.04, 0.2), mat('#fbfaf5', { r: 0.3 }), 0, 0.8, 0.64));
  const blackKey = mat('#111116', { r: 0.3 });
  const pattern = [1, 1, 0, 1, 1, 1, 0];
  for (let i = 0, x = -0.66; x < 0.64; i++, x += 0.054) if (pattern[i % 7]) r.add(mesh(box(0.028, 0.03, 0.11), blackKey, x + 0.027, 0.83, 0.6));
  for (let i = 0; i < 26; i++) r.add(mesh(box(0.003, 0.041, 0.2), mat('#c9c6bc'), -0.675 + i * 0.054, 0.801, 0.64, false));
  for (const s of [1, -1]) r.add(mesh(box(0.06, 0.16, 0.3), lacquer, s * 0.72, 0.8, 0.62));
  r.add(R(mesh(box(0.5, 0.24, 0.02), lacquer, 0, 1.1, 0.42), -0.25));
  for (const [x, z] of [[-0.62, 0.42], [0.62, 0.42], [-0.45, -0.68]]) r.add(mesh(cyl(0.05, 0.035, 0.68, 10), lacquer, x, 0.34, z));
  r.add(mesh(box(0.2, 0.3, 0.05), lacquer, 0, 0.2, 0.46));
  for (const x of [-0.05, 0, 0.05]) r.add(mesh(box(0.025, 0.012, 0.07), gold(), x, 0.06, 0.5));
  r.add(mesh(rbox(0.6, 0.07, 0.24, 0.02), lacquer, 0, 0.47, 0.88));
  r.add(mesh(rbox(0.56, 0.05, 0.2, 0.02), mat('#9c2f45', { r: 0.85 }), 0, 0.52, 0.88));
  for (const x of [-0.26, 0.26]) for (const z of [0.79, 0.97]) r.add(mesh(box(0.035, 0.44, 0.035), lacquer, x, 0.22, z));
  r.add(mesh(cyl(0.035, 0.035, 0.12, 10), mat('#f6f0e0'), 0.45, 1.06, -0.1));
  r.add(mesh(sph(0.022, 8, 6), mat('#ffd27a', { e: '#ffaa33', ei: 2 }), 0.45, 1.14, -0.1, false));
  return finish(r, [0, 1.5, 0]);
};

D.fireplace = () => {
  const r = new THREE.Group();
  const rnd = rng(9);
  const tones = ['#a39b90', '#8f877c', '#b5ada1', '#9a9286', '#c2b9ab'];
  r.add(mesh(rbox(1.96, 0.12, 0.72, 0.03), mat('#8a827a', { r: 0.9 }), 0, 0.06, 0.02));
  r.add(mesh(rbox(1.8, 1.28, 0.3, 0.04), mat('#958d82', { r: 0.95 }), 0, 0.76, -0.2));
  for (let row = 0; row < 6; row++) {
    let x = -0.88 + (row % 2) * 0.12;
    while (x < 0.86) {
      const w = 0.22 + rnd() * 0.14;
      const cx = Math.min(x + w / 2, (x + 0.88) / 2), cy = 0.2 + row * 0.21;
      const opening = Math.abs(cx) < 0.5 && cy - 0.1 < 0.84 + Math.sqrt(Math.max(0, 0.25 - cx * cx));
      if (!opening) r.add(mesh(rbox(Math.min(w - 0.03, 0.88 - x), 0.18, 0.24, 0.03), mat(tones[Math.floor(rnd() * tones.length)], { r: 0.95 }), cx, cy, 0.07));
      x += w;
    }
  }
  const soot = mat('#1b1210', { r: 1 });
  r.add(mesh(box(0.9, 0.72, 0.02), soot, 0, 0.48, -0.04));
  r.add(R(mesh(cyl(0.45, 0.45, 0.02, 20, false, -Math.PI / 2, Math.PI), soot, 0, 0.84, -0.04), -Math.PI / 2));
  r.add(mesh(box(0.9, 0.02, 0.24), soot, 0, 0.13, 0.07));
  r.add(mesh(torus(0.47, 0.05, 6, 20, Math.PI), mat('#c2b9ab', { r: 0.9 }), 0, 0.84, 0.18));
  const wood = mat('#7a4a2e', { r: 0.6 });
  r.add(mesh(rbox(2.0, 0.1, 0.42, 0.03), wood, 0, 1.44, 0.05));
  r.add(mesh(rbox(1.1, 0.95, 0.42, 0.04), mat('#958d82', { r: 0.95 }), 0, 1.97, -0.12));
  for (let row = 0; row < 4; row++) {
    let x = -0.52 + (row % 2) * 0.1;
    while (x < 0.5) {
      const w = Math.min(0.2 + rnd() * 0.12, 0.52 - x);
      if (w > 0.06) r.add(mesh(rbox(w - 0.03, 0.18, 0.05, 0.02), mat(tones[Math.floor(rnd() * tones.length)], { r: 0.95 }), x + w / 2, 1.6 + row * 0.22, 0.1));
      x += w;
    }
  }
  r.add(mesh(rbox(1.16, 0.06, 0.46, 0.02), mat('#8a827a'), 0, 2.46, -0.12));
  const log = mat('#6b4226', { r: 0.9 });
  r.add(R(mesh(cyl(0.06, 0.06, 0.6, 8), log, 0, 0.2, 0.12), 0, 0.2, Math.PI / 2));
  r.add(R(mesh(cyl(0.055, 0.055, 0.55, 8), log, 0, 0.2, 0.0), 0, -0.25, Math.PI / 2));
  r.add(R(mesh(cyl(0.05, 0.05, 0.5, 8), log, 0, 0.3, 0.06), 0, 0.05, Math.PI / 2));
  const flames = [];
  const fm = [umat('#ffd04a', { e: '#ffb020', ei: 2.2 }), umat('#ff7a2a', { e: '#ff5a1a', ei: 2 })];
  for (let i = 0; i < 5; i++) {
    const f = dyn(mesh(cone(0.09 - (i % 2) * 0.02, 0.3, 7), fm[i % 2], -0.22 + i * 0.11, 0.42, 0.06 + (i % 2) * 0.05, false));
    r.add(f);
    flames.push(f);
  }
  r.add(mesh(sph(0.03, 6, 5), umat('#ff5a2a', { e: '#ff3a1a', ei: 2 }), 0.12, 0.22, 0.2, false));
  for (const x of [-0.75, 0.75]) {
    r.add(mesh(cyl(0.035, 0.04, 0.16, 10), mat('#f6f0e0'), x, 1.57, 0.05));
    r.add(mesh(sph(0.022, 8, 6), mat('#ffd27a', { e: '#ffaa33', ei: 2 }), x, 1.67, 0.05, false));
  }
  r.add(mesh(rbox(0.36, 0.28, 0.04, 0.01), mat(GOLD, { r: 0.3, m: 0.8 }), -0.3, 1.64, -0.05));
  r.add(mesh(new THREE.PlaneGeometry(0.3, 0.22), mat('#ffffff', { map: landscapeTex(), mapKey: 'landscape' }), -0.3, 1.64, -0.028, false));
  r.add(mesh(cyl(0.07, 0.06, 0.1, 10), mat('#e07a4f'), 0.35, 1.54, 0.05));
  r.add(mesh(ico(0.1, 1), mat(LEAF), 0.35, 1.66, 0.05));
  const light = { y: 0.6, color: '#ff8a3a', intensity: 5, distance: 4.5 };
  return finish(r, [0, 2.4, 0], {
    light,
    animate(t) {
      flames.forEach((f, i) => {
        const k = 0.75 + Math.sin(t * 9 + i * 2.1) * 0.15 + Math.sin(t * 14.3 + i) * 0.1;
        f.scale.set(1 - (k - 0.75) * 0.5, k, 1 - (k - 0.75) * 0.5);
        f.position.y = 0.3 + k * 0.15;
      });
      light.intensity = 4.4 + Math.sin(t * 11) * 0.5 + Math.sin(t * 17.7) * 0.4;
    },
  });
};

D.sakura = () => {
  const r = new THREE.Group();
  r.add(mesh(cyl(0.82, 0.72, 0.45, 14), mat('#efe6da', { r: 0.8 }), 0, 0.225, 0));
  r.add(R(mesh(torus(0.82, 0.05, 6, 28), mat('#d9cfc0', { r: 0.8 }), 0, 0.45, 0), Math.PI / 2));
  r.add(mesh(cyl(0.78, 0.78, 0.02, 24), mat('#5b3b25'), 0, 0.445, 0));
  const tree = buildGarden({ trees: [{ x: 0, z: 0, s: 0.95, kind: 'blossom' }] }, 21);
  tree.position.y = 0.45;
  r.add(tree);
  const rnd = rng(4);
  const petal = [mat('#ffb3c6'), mat('#ffd9e2')];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * TAU, d = 0.2 + rnd() * 0.55;
    const p = mesh(cyl(0.035, 0.035, 0.006, 6), petal[i % 2], Math.cos(a) * d, 0.46, Math.sin(a) * d, false);
    p.rotation.set(rnd() * 0.4, rnd() * 3, rnd() * 0.4);
    r.add(p);
  }
  for (let i = 0; i < 4; i++) flower(r, Math.cos(i * 1.6) * 0.6, 0.5, Math.sin(i * 1.6) * 0.6, '#ffffff', 0.05);
  return finish(r, [0, 2.7, 0]);
};

D.statue = () => {
  const r = new THREE.Group();
  const marble = mat('#efece6', { r: 0.35 });
  r.add(mesh(rbox(0.86, 0.14, 0.86, 0.03), marble, 0, 0.07, 0));
  r.add(mesh(rbox(0.72, 0.42, 0.72, 0.03), marble, 0, 0.35, 0));
  r.add(mesh(rbox(0.8, 0.08, 0.8, 0.03), marble, 0, 0.6, 0));
  r.add(mesh(rbox(0.42, 0.14, 0.02, 0.01), gold(), 0, 0.36, 0.365));
  r.add(mesh(ico(0.045, 0), mat('#fff6d0', { r: 0.3, m: 0.6 }), 0, 0.36, 0.38, false));
  const fig = new THREE.Group();
  fig.scale.setScalar(1.2);
  fig.position.y = 0.64 - 0.64 * 1.2;
  r.add(fig);
  const g = mat('#f5c542', { r: 0.22, m: 0.9 });
  for (const s of [1, -1]) fig.add(mesh(capsule(0.075, 0.22), g, s * 0.08, 0.83, 0));
  fig.add(Sc(mesh(capsule(0.17, 0.2), g, 0, 1.12, 0), 1, 1, 0.85));
  fig.add(mesh(rbox(0.26, 0.3, 0.04, 0.03), g, 0, 1.06, 0.14));
  fig.add(mesh(sph(0.14, 18, 14), g, 0, 1.45, 0.01));
  fig.add(mesh(sph(0.03, 8, 6), g, 0, 1.44, 0.15));
  for (const s of [1, -1]) fig.add(R(Sc(mesh(capsule(0.022, 0.06), g, s * 0.045, 1.4, 0.135), 1, 1, 0.7), 0, 0, s * 1.2));
  fig.add(mesh(cyl(0.12, 0.11, 0.12, 16), g, 0, 1.62, 0));
  for (const [x, z] of [[-0.07, 0], [0.07, 0], [0, 0.06], [0, -0.06]]) fig.add(mesh(sph(0.085, 12, 10), g, x, 1.72, z));
  fig.add(mesh(sph(0.1, 12, 10), g, 0, 1.76, 0));
  limb(fig, [0.15, 1.24, 0], [0.26, 1.42, 0.05], 0.055, g);
  limb(fig, [0.26, 1.42, 0.05], [0.28, 1.66, 0.08], 0.05, g);
  fig.add(mesh(sph(0.055, 10, 8), g, 0.28, 1.68, 0.08));
  limb(fig, [0.29, 1.62, 0.08], [0.3, 1.98, 0.08], 0.014, g);
  fig.add(Sc(mesh(sph(0.06, 12, 10), g, 0.3, 2.02, 0.09), 1, 1.25, 0.6));
  limb(fig, [-0.15, 1.24, 0], [-0.26, 1.08, 0.04], 0.055, g);
  limb(fig, [-0.26, 1.08, 0.04], [-0.14, 0.98, 0.1], 0.05, g);
  const sparkMat = umat('#fffbe0', { e: '#ffe680', ei: 2.5 });
  const sparks = [];
  for (let i = 0; i < 3; i++) {
    const s = dyn(mesh(ico(0.035, 0), sparkMat, 0, 0, 0, false));
    r.add(s);
    sparks.push(s);
  }
  return finish(r, [0, 2.4, 0], {
    animate(t) {
      sparks.forEach((s, i) => {
        const p = (t * 0.45 + i / 3) % 1;
        const a = i * 2.1 + t * 0.2;
        s.position.set(Math.cos(a) * 0.32, 0.9 + p * 1.1, Math.sin(a) * 0.32);
        const k = Math.sin(p * Math.PI);
        s.scale.setScalar(0.2 + k);
        s.rotation.set(t * 3, t * 2, 0);
      });
    },
  });
};

// ---------------------------------------------------------------------------- rugs

function roundRugTex() {
  return paintTex('rug-round', 512, 512, (g, w) => {
    const c = w / 2;
    const rings = ['#ffbb1f', '#ff6f4f', '#fff4e0', '#3fb6c8', '#ff6f4f', '#fff4e0', '#ffbb1f', '#e8343f'];
    rings.forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(c, c, c - i * 30, 0, TAU);
      g.fill();
    });
    g.fillStyle = '#fff4e0';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      g.beginPath();
      g.arc(c + Math.cos(a) * (c - 45), c + Math.sin(a) * (c - 45), 7, 0, TAU);
      g.fill();
    }
    g.strokeStyle = 'rgba(80,40,20,0.15)';
    g.lineWidth = 2;
    for (let rr = 20; rr < c; rr += 8) { g.beginPath(); g.arc(c, c, rr, 0, TAU); g.stroke(); }
  });
}

function runnerTex() {
  return paintTex('rug-runner', 768, 256, (g, w, h) => {
    g.fillStyle = '#c8402e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4e3c4';
    g.fillRect(0, 18, w, 10);
    g.fillRect(0, h - 28, w, 10);
    g.fillStyle = '#2a6f78';
    g.fillRect(0, 40, w, h - 80);
    for (let i = 0; i < 6; i++) {
      const cx = 64 + i * 128;
      for (const [s, col] of [[56, '#ffbb1f'], [38, '#c8402e'], [20, '#f4e3c4']]) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(cx, h / 2 - s); g.lineTo(cx + s, h / 2); g.lineTo(cx, h / 2 + s); g.lineTo(cx - s, h / 2);
        g.fill();
      }
    }
    g.fillStyle = '#f4e3c4';
    for (let x = 8; x < w; x += 24) { g.fillRect(x, 4, 10, 8); g.fillRect(x, h - 12, 10, 8); }
  });
}

D.roundrug = () => {
  const r = new THREE.Group();
  const m = mesh(geo('roundrug', () => new THREE.CircleGeometry(0.94, 40)), mat('#ffffff', { map: roundRugTex(), mapKey: 'rug-round', r: 0.95 }), 0, 0.012, 0, false);
  m.rotation.x = -Math.PI / 2;
  r.add(m);
  return finish(r, [0, 0.02, 0]);
};

D.runner = () => {
  const r = new THREE.Group();
  const m = mesh(geo('runner', () => new THREE.PlaneGeometry(2.84, 0.84)), mat('#ffffff', { map: runnerTex(), mapKey: 'rug-runner', r: 0.95 }), 0, 0.012, 0, false);
  m.rotation.x = -Math.PI / 2;
  r.add(m);
  const fr = mat('#f4e3c4');
  for (const x of [-1.44, 1.44]) for (let i = 0; i < 8; i++) r.add(mesh(box(0.07, 0.01, 0.02), fr, x, 0.012, -0.36 + i * 0.103, false));
  return finish(r, [0, 0.02, 0]);
};
