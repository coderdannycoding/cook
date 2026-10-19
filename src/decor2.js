// Second décor batch: more floor pieces and wall-mounted pieces (see catalog-extra.js). Wall pieces
// are built with their origin on the wall face at the piece's lowest point and +z pointing into the
// room (grid.meshSpot hangs them at def.mount); they stay 0.15 clear of their cells' ends so they
// never touch the windows or a neighbour. Floor pieces follow decor.js.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { mat, umat, mesh, box, rbox, cyl, sph, cone, torus, ico, capsule, finish, dyn, mergeStatic } from './models.js';
import { TAU } from './utils.js';

const SIGN_FONT = '"Lilita One", system-ui, sans-serif';

const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
const lathe = (key, pts, seg = 20) => geo(`lathe:${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));
const plane = (w, h) => geo(`plane:${w},${h}`, () => new THREE.PlaneGeometry(w, h));

const texCache = new Map();
function paintTex(key, w, h, paint, repeat = false) {
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.userData.key = key;
    texCache.set(key, t);
  }
  return t;
}
const texMat = (tex, o = {}) => mat('#ffffff', { r: 0.85, ...o, map: tex, mapKey: tex.userData.key });

// Self-lit canvas (signs, a sunny window view)
const glowCache = new Map();
function glowMat(map, ei = 0.6) {
  const key = `${map.userData.key}|${ei}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: ei, roughness: 0.5 });
    glowCache.set(key, m);
  }
  return m;
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
const V = (p) => new THREE.Vector3(...p);

function limb(root, a, b, r, material, seg = 8) {
  const A = V(a), B = V(b);
  const d = B.clone().sub(A);
  const m = mesh(cyl(r, r, 1, seg), material);
  m.scale.y = d.length();
  m.position.copy(A).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  root.add(m);
  return m;
}

// A tube along a smooth curve through `pts` (cached by key)
function tube(key, pts, r, { closed = false, tension = 0.5, seg = 0, radial = 6 } = {}) {
  return geo(`tube:${key}`, () => {
    const curve = new THREE.CatmullRomCurve3(pts.map(V), closed, 'catmullrom', tension);
    return new THREE.TubeGeometry(curve, seg || Math.max(16, pts.length * 12), r, radial, closed);
  });
}

// Points along a hanging rope from a to b that sags by `sag`
function swag(a, b, sag, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
}

function flower(root, x, y, z, color, r = 0.06, centre = '#ffcf3a', face = null) {
  const g = new THREE.Group();
  const pm = mat(color, { r: 0.7 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const p = Sc(mesh(sph(r * 0.55, 8, 6), pm, Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8), 1, 0.35, 0.6);
    p.rotation.y = -a;
    g.add(p);
  }
  g.add(Sc(mesh(sph(r * 0.45, 8, 6), mat(centre)), 1, 0.6, 1));
  g.position.set(x, y, z);
  if (face === 'z') g.rotation.x = Math.PI / 2;
  root.add(g);
  return g;
}

function see(m) { m.userData.noMerge = true; return m; }
// Animated part whose own static bits still merge into one draw call
const dynMerged = (g) => dyn(mergeStatic(g));

const WOOD_DARK = '#5e3a22', OAK = '#c99a63', LEAF = '#4fa35a', LEAF2 = '#7cc95e', LEAF3 = '#2f7d45';
const gold = () => mat('#f0c04a', { r: 0.25, m: 0.85 });
const brass = () => mat('#d8a845', { r: 0.3, m: 0.8 });
const chrome = () => mat('#dfe5ea', { r: 0.2, m: 0.85 });
const iron = () => mat('#2b2b30', { r: 0.5, m: 0.4 });
const glass = (tint = '#dff4ff', op = 0.25) => mat(tint, { op, r: 0.05 });
const DS = THREE.DoubleSide;

const hang = (root, top, extra) => finish(root, [0, top, 0.2], extra);

export const DECOR2_BUILDERS = {};
const D = DECOR2_BUILDERS;

// =============================================================================== wall pieces

// Rectangular picture frame centred at (0, cy) on the wall, front face at z = depth
function frame(r, w, h, cy, fm, bar = 0.07, depth = 0.06) {
  r.add(mesh(box(w - bar, h - bar, 0.02), mat('#3a2a1e'), 0, cy, 0.012, false));
  for (const s of [1, -1]) {
    r.add(mesh(rbox(w, bar, depth, 0.016), fm, 0, cy + s * (h - bar) / 2, depth / 2));
    r.add(mesh(rbox(bar, h - 0.01, depth, 0.016), fm, s * (w - bar) / 2, cy, depth / 2));
  }
}

function lavenderTex() {
  return paintTex('art-lavender', 512, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, 130);
    sky.addColorStop(0, '#7cc8ff');
    sky.addColorStop(1, '#ffe2bf');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(400, 62, 8, 400, 62, 70);
    sun.addColorStop(0, 'rgba(255,248,200,1)');
    sun.addColorStop(0.35, 'rgba(255,236,150,0.9)');
    sun.addColorStop(1, 'rgba(255,236,150,0)');
    g.fillStyle = sun;
    g.fillRect(320, 0, 160, 140);
    g.fillStyle = '#fff8d0';
    g.beginPath(); g.arc(400, 62, 22, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, s] of [[90, 46, 1], [200, 30, 0.7], [300, 70, 0.6]]) {
      for (const [dx, dy, rr] of [[0, 0, 18], [20, -6, 22], [42, 2, 16], [22, 8, 18]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, rr * s, 0, TAU); g.fill(); }
    }
    g.fillStyle = '#9db7dc';
    g.beginPath(); g.moveTo(0, 122); g.quadraticCurveTo(90, 88, 190, 116); g.quadraticCurveTo(300, 92, 420, 112); g.quadraticCurveTo(470, 104, 512, 116); g.lineTo(512, 140); g.lineTo(0, 140); g.fill();
    g.fillStyle = '#86b65e';
    g.beginPath(); g.moveTo(0, 132); g.quadraticCurveTo(140, 112, 280, 130); g.quadraticCurveTo(400, 120, 512, 130); g.lineTo(512, 150); g.lineTo(0, 150); g.fill();
    // farmhouse and cypresses
    g.fillStyle = '#f6e7c8'; g.fillRect(110, 112, 40, 22);
    g.fillStyle = '#d06a3c'; g.beginPath(); g.moveTo(104, 114); g.lineTo(130, 98); g.lineTo(156, 114); g.fill();
    g.fillStyle = '#6a8fb0'; g.fillRect(122, 120, 7, 8); g.fillRect(136, 120, 7, 8);
    g.fillStyle = '#2f5d34';
    for (const [x, hh] of [[170, 46], [184, 34], [330, 40], [92, 30]]) { g.beginPath(); g.ellipse(x, 134 - hh / 2, 6, hh / 2, 0, 0, TAU); g.fill(); }
    // lavender rows converging on the horizon
    const vx = 256;
    g.fillStyle = '#6f9a4a';
    g.fillRect(0, 140, w, h - 140);
    for (let i = -14; i <= 14; i++) {
      const x0 = vx + i * 46, x1 = vx + (i + 0.62) * 46;
      g.fillStyle = i % 2 ? '#9a7ad8' : '#8c6ccc';
      g.beginPath(); g.moveTo(vx + i * 5, 140); g.lineTo(vx + (i + 0.62) * 5, 140); g.lineTo(vx + (x1 - vx) * 2.4, h); g.lineTo(vx + (x0 - vx) * 2.4, h); g.fill();
    }
    const rnd = rng(17);
    for (let i = 0; i < 700; i++) {
      const y = 142 + rnd() ** 0.7 * (h - 142);
      const x = rnd() * w;
      g.fillStyle = ['#b79cf0', '#7c5cc0', '#c9b4ff'][i % 3];
      const s = 1 + (y - 140) / 40;
      g.fillRect(x, y, s * 1.4, s * 2.6);
    }
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 2;
    for (let i = 0; i < 60; i++) { const x = rnd() * w, y = rnd() * 130; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y + 2); g.stroke(); }
  });
}

D.art_hills = () => {
  const r = new THREE.Group();
  const gilt = gold();
  frame(r, 1.62, 0.92, 0.46, gilt, 0.085, 0.07);
  for (const s of [1, -1]) {
    r.add(mesh(box(1.44, 0.018, 0.02), mat('#b8862a', { r: 0.35, m: 0.8 }), 0, 0.46 + s * 0.37, 0.055));
    r.add(mesh(box(0.018, 0.76, 0.02), mat('#b8862a', { r: 0.35, m: 0.8 }), s * 0.72, 0.46, 0.055));
  }
  r.add(mesh(plane(1.44, 0.74), texMat(lavenderTex()), 0, 0.46, 0.04, false));
  // brass picture light
  const b = brass();
  r.add(R(mesh(cyl(0.035, 0.035, 0.02, 12), b, 0, 0.98, 0.012), Math.PI / 2));
  limb(r, [0, 0.98, 0.02], [0, 1.04, 0.16], 0.012, b);
  r.add(R(mesh(cyl(0.035, 0.035, 0.46, 14), b, 0, 1.03, 0.2), 0, 0, Math.PI / 2));
  r.add(R(mesh(box(0.44, 0.012, 0.04), mat('#fff2c8', { e: '#ffd890', ei: 1.4 }), 0, 1.008, 0.205, false), 0.5));
  return hang(r, 1.1);
};

function abstractTex() {
  return paintTex('art-abstract', 256, 352, (g, w, h) => {
    g.fillStyle = '#f4e9d8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9b8a2';
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.arc(70, 330, 120 - i * 26, Math.PI, 0); g.lineTo(70 + 120 - i * 26 - 18, 330); g.arc(70, 330, 120 - i * 26 - 18, 0, Math.PI, true); g.fill();
      g.fillStyle = i % 2 ? '#e9b8a2' : '#d98b6a';
    }
    g.fillStyle = '#c8603a';
    g.beginPath(); g.moveTo(120, 352); g.lineTo(120, 170); g.arc(180, 170, 60, Math.PI, 0); g.lineTo(240, 352); g.fill();
    g.fillStyle = '#e8a93a';
    g.beginPath(); g.arc(150, 96, 46, 0, TAU); g.fill();
    g.fillStyle = '#93ab84';
    g.beginPath(); g.ellipse(60, 150, 40, 62, -0.4, 0, TAU); g.fill();
    g.fillStyle = '#3d4b58';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(196, 40 + i * 16, 4, 0, TAU); g.fill(); }
    g.strokeStyle = '#3d4b58';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(20, 40); for (let i = 0; i < 5; i++) g.quadraticCurveTo(30 + i * 20, i % 2 ? 30 : 52, 40 + i * 20, 40); g.stroke();
  });
}

D.art_abstract = () => {
  const r = new THREE.Group();
  frame(r, 0.6, 0.82, 0.41, mat('#d7b07a', { r: 0.55 }), 0.05, 0.05);
  r.add(mesh(box(0.52, 0.74, 0.01), mat('#fbf8f1', { r: 0.9 }), 0, 0.41, 0.03, false));
  r.add(mesh(plane(0.4, 0.55), texMat(abstractTex()), 0, 0.42, 0.037, false));
  return hang(r, 0.9);
};

function catTex() {
  return paintTex('art-cat', 256, 320, (g, w, h) => {
    const bg = g.createRadialGradient(128, 130, 20, 128, 160, 200);
    bg.addColorStop(0, '#4f7a5a');
    bg.addColorStop(1, '#1d3326');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // velvet coat and ruff
    g.fillStyle = '#2d4fa8';
    g.beginPath(); g.moveTo(30, 320); g.quadraticCurveTo(40, 220, 128, 210); g.quadraticCurveTo(216, 220, 226, 320); g.fill();
    g.fillStyle = '#f0c04a';
    g.beginPath(); g.arc(128, 268, 12, 0, TAU); g.fill();
    g.fillStyle = '#c0392b'; g.fillRect(122, 230, 12, 30);
    g.fillStyle = '#fbf6ea';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(70 + i * 14.5, 210 + Math.sin(i * 1.3) * 3, 12, 16, 0, 0, TAU); g.fill(); }
    // head
    g.fillStyle = '#ef9a3c';
    for (const s of [1, -1]) { g.beginPath(); g.moveTo(128 + s * 30, 72); g.lineTo(128 + s * 66, 40); g.lineTo(128 + s * 62, 110); g.fill(); }
    g.fillStyle = '#ffc7c7';
    for (const s of [1, -1]) { g.beginPath(); g.moveTo(128 + s * 40, 80); g.lineTo(128 + s * 60, 54); g.lineTo(128 + s * 58, 100); g.fill(); }
    g.fillStyle = '#ef9a3c';
    g.beginPath(); g.ellipse(128, 136, 70, 64, 0, 0, TAU); g.fill();
    g.fillStyle = '#c96f1f';
    for (const [x, y, a] of [[128, 82, 0], [108, 86, -0.3], [148, 86, 0.3]]) { g.save(); g.translate(x, y); g.rotate(a); g.fillRect(-4, 0, 8, 26); g.restore(); }
    for (const s of [1, -1]) for (let i = 0; i < 2; i++) { g.fillRect(128 + s * (56 + i * 6) - 3, 120 + i * 18, 14 * s, 6); }
    g.fillStyle = '#fff6ea';
    g.beginPath(); g.ellipse(128, 162, 36, 26, 0, 0, TAU); g.fill();
    for (const s of [1, -1]) {
      g.fillStyle = '#9fd36a';
      g.beginPath(); g.ellipse(128 + s * 28, 128, 15, 11, 0, 0, TAU); g.fill();
      g.fillStyle = '#1d1a14';
      g.beginPath(); g.ellipse(128 + s * 28, 128, 4, 10, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(128 + s * 28 + 4, 123, 3, 0, TAU); g.fill();
    }
    g.fillStyle = '#ff8fa0';
    g.beginPath(); g.moveTo(118, 150); g.lineTo(138, 150); g.lineTo(128, 160); g.fill();
    g.strokeStyle = '#5a3a20';
    g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(128, 160); g.lineTo(128, 168); g.quadraticCurveTo(118, 176, 110, 168); g.moveTo(128, 168); g.quadraticCurveTo(138, 176, 146, 168); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1.5;
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(128 + s * 30, 162 + i * 5); g.lineTo(128 + s * 82, 154 + i * 10); g.stroke(); }
    // varnish sheen
    const sh = g.createLinearGradient(0, 0, w, h);
    sh.addColorStop(0, 'rgba(255,240,200,0.12)');
    sh.addColorStop(1, 'rgba(0,0,0,0.15)');
    g.fillStyle = sh;
    g.fillRect(0, 0, w, h);
  });
}

D.art_cat = () => {
  const r = new THREE.Group();
  const gilt = gold();
  const cy = 0.41, sy = 1.28;
  r.add(Sc(mesh(cyl(0.31, 0.31, 0.02, 32), mat('#3a2a1e'), 0, cy, 0.012, false), 1, 1, sy).rotateX(Math.PI / 2));
  r.add(Sc(mesh(torus(0.29, 0.045, 10, 40), gilt, 0, cy, 0.045), 1, sy, 1));
  r.add(Sc(mesh(torus(0.245, 0.014, 6, 40), mat('#b8862a', { r: 0.35, m: 0.8 }), 0, cy, 0.05), 1, sy, 1));
  r.add(Sc(mesh(geo('oval-canvas', () => new THREE.CircleGeometry(0.25, 40)), texMat(catTex()), 0, cy, 0.035, false), 1, sy, 1));
  // crest on top
  r.add(Sc(mesh(sph(0.06, 12, 10), gilt, 0, cy + 0.39, 0.05), 1.4, 0.9, 0.6));
  for (const s of [1, -1]) r.add(R(Sc(mesh(cone(0.035, 0.12, 8), gilt, s * 0.08, cy + 0.37, 0.05), 1, 1, 0.5), 0, 0, s * 1.2));
  r.add(mesh(sph(0.03, 10, 8), gilt, 0, cy - 0.395, 0.05));
  return hang(r, 0.85);
};

function posterTex() {
  return paintTex('art-poster', 256, 352, (g, w, h) => {
    g.fillStyle = '#fff3d6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#9fd8c4';
    g.fillRect(12, 12, w - 24, h - 24);
    g.save();
    g.beginPath(); g.rect(12, 12, w - 24, h - 24); g.clip();
    g.fillStyle = '#c4ecd9';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      g.beginPath(); g.moveTo(128, 200); g.arc(128, 200, 260, a, a + TAU / 32); g.fill();
    }
    g.restore();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `66px ${SIGN_FONT}`;
    g.lineWidth = 10;
    g.strokeStyle = '#2b2233';
    g.strokeText('TASTY!', 128, 60);
    g.fillStyle = '#e8463f';
    g.fillText('TASTY!', 128, 60);
    const cx = 128;
    g.lineWidth = 6;
    g.strokeStyle = '#2b2233';
    const layer = (col, y0, hh, rx, top) => {
      g.fillStyle = col;
      g.beginPath();
      if (top) g.ellipse(cx, y0 + hh, rx, hh, 0, Math.PI, 0);
      else g.roundRect(cx - rx, y0, rx * 2, hh, hh / 2);
      g.fill(); g.stroke();
    };
    layer('#f2b45a', 160, 36, 84, true);
    layer('#7ad16a', 196, 14, 90);
    layer('#ffd23f', 208, 12, 86);
    layer('#8a4b2e', 218, 24, 84);
    layer('#f2b45a', 242, 22, 80);
    g.fillStyle = '#fff3d6';
    for (const [x, y] of [[100, 172], [128, 166], [156, 172], [114, 182], [142, 182]]) { g.beginPath(); g.ellipse(x, y, 5, 3, 0.3, 0, TAU); g.fill(); }
    g.fillStyle = '#e8463f';
    g.fillRect(12, 290, w - 24, 50);
    g.font = `30px ${SIGN_FONT}`;
    g.fillStyle = '#fff3d6';
    g.fillText('HOT & FRESH', 128, 316);
  });
}

D.art_poster = () => {
  const r = new THREE.Group();
  frame(r, 0.6, 0.8, 0.4, mat('#26222c', { r: 0.4 }), 0.035, 0.04);
  r.add(mesh(plane(0.54, 0.74), texMat(posterTex(), { r: 0.6 }), 0, 0.4, 0.03, false));
  return hang(r, 0.85);
};

function mirrorTex() {
  return paintTex('mirror', 128, 128, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#e9f6ff');
    bg.addColorStop(0.5, '#a9c6d8');
    bg.addColorStop(1, '#7d98ad');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.8);
    g.fillRect(-60, -34, 120, 14);
    g.fillRect(-60, -12, 120, 6);
    g.restore();
  });
}

D.mirror = () => {
  const r = new THREE.Group();
  const cy = 0.36;
  const g = gold();
  r.add(R(mesh(cyl(0.19, 0.19, 0.04, 32), g, 0, cy, 0.025), Math.PI / 2));
  r.add(mesh(torus(0.19, 0.022, 8, 36), g, 0, cy, 0.05));
  r.add(mesh(geo('mirror-disc', () => new THREE.CircleGeometry(0.17, 36)), mat('#ffffff', { map: mirrorTex(), mapKey: 'mirror', r: 0.08, m: 0.35 }), 0, cy, 0.047, false));
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU, long = i % 2 === 0;
    const len = long ? 0.15 : 0.09, mid = 0.2 + len / 2;
    r.add(R(mesh(box(long ? 0.022 : 0.016, len, 0.018), g, Math.cos(a) * mid, cy + Math.sin(a) * mid, 0.025), 0, 0, a - Math.PI / 2));
    if (long) r.add(mesh(sph(0.022, 8, 6), g, Math.cos(a) * 0.36, cy + Math.sin(a) * 0.36, 0.025));
  }
  return hang(r, 0.75);
};

D.sconce = (def) => {
  const r = new THREE.Group();
  const b = brass();
  r.add(Sc(mesh(cyl(0.07, 0.07, 0.03, 20), b, 0, 0.3, 0.015), 1, 1, 1.9).rotateX(Math.PI / 2));
  r.add(Sc(mesh(cyl(0.05, 0.05, 0.02, 16), mat('#b8862a', { r: 0.35, m: 0.8 }), 0, 0.3, 0.035), 1, 1, 1.9).rotateX(Math.PI / 2));
  r.add(mesh(sph(0.03, 10, 8), b, 0, 0.3, 0.05));
  r.add(R(mesh(cone(0.025, 0.1, 10), b, 0, 0.12, 0.02), Math.PI));
  const glow = mat('#fff6e2', { e: '#ffc56a', ei: 1.6, r: 0.4 });
  for (const s of [1, -1]) {
    r.add(mesh(tube(`sconce-arm${s}`, [[0, 0.3, 0.05], [s * 0.1, 0.22, 0.12], [s * 0.2, 0.26, 0.18], [s * 0.22, 0.36, 0.2]], 0.016), b));
    r.add(mesh(cyl(0.045, 0.03, 0.06, 14), b, s * 0.22, 0.38, 0.2));
    r.add(mesh(cyl(0.06, 0.045, 0.02, 14), b, s * 0.22, 0.42, 0.2));
    r.add(Sc(mesh(sph(0.1, 20, 14), glow, s * 0.22, 0.52, 0.2, false), 1, 1.15, 1));
    r.add(mesh(sph(0.018, 8, 6), b, s * 0.22, 0.645, 0.2, false));
  }
  return hang(r, 0.7, { light: { y: def.mount + 0.5, color: '#ffbf70', intensity: 3.2, distance: 3.6 } });
};

D.stringlights = (def) => {
  const r = new THREE.Group();
  const wire = mat('#2b2622', { r: 0.6 });
  const sock = mat('#3a332c', { r: 0.5 });
  const bulbs = [umat('#ffe2a0', { e: '#ffaa30', ei: 1.8 }), umat('#ffe2a0', { e: '#ffaa30', ei: 1.8 })];
  const hooks = [-1.3, -0.43, 0.43, 1.3];
  let k = 0;
  for (let i = 0; i < 3; i++) {
    const a = [hooks[i], 0.42, 0.05], b = [hooks[i + 1], 0.42, 0.05];
    const pts = swag(a, b, 0.24);
    r.add(mesh(tube(`festoon${i}`, pts, 0.011), wire, 0, 0, 0, false));
    for (let j = 1; j < 6; j++) {
      const t = j / 6, x = a[0] + (b[0] - a[0]) * t, y = 0.42 - Math.sin(t * Math.PI) * 0.24;
      r.add(mesh(cyl(0.022, 0.022, 0.05, 8), sock, x, y - 0.03, 0.05, false));
      r.add(Sc(mesh(sph(0.055, 12, 10), bulbs[k++ % 2], x, y - 0.1, 0.05, false), 1, 1.25, 1));
    }
  }
  for (const x of hooks) {
    r.add(R(mesh(cyl(0.012, 0.012, 0.05, 6), brass(), x, 0.43, 0.025), Math.PI / 2));
    r.add(mesh(sph(0.02, 8, 6), brass(), x, 0.43, 0.05));
  }
  const light = { y: def.mount + 0.25, color: '#ffc47a', intensity: 2.5, distance: 4 };
  return hang(r, 0.5, {
    light,
    animate(t) {
      bulbs[0].emissiveIntensity = 1.6 + Math.sin(t * 2.1) * 0.5;
      bulbs[1].emissiveIntensity = 1.6 + Math.sin(t * 2.1 + Math.PI) * 0.5;
      light.intensity = 2.5 + Math.sin(t * 4.2) * 0.15;
    },
  });
};

const flagGeo = () => geo('flag', () => {
  const s = new THREE.Shape();
  s.moveTo(-0.08, 0); s.lineTo(0.08, 0); s.lineTo(0, -0.17); s.lineTo(-0.08, 0);
  return new THREE.ShapeGeometry(s);
});

D.bunting = () => {
  const r = new THREE.Group();
  const cols = ['#e8463f', '#ffbb1f', '#2fb3a6', '#ff7ab6', '#5f8fe8', '#ff8a3a', '#8fd16a'];
  const string = mat('#f4efe6', { r: 0.8 });
  const ends = [-1.32, 0, 1.32];
  let k = 0;
  for (let i = 0; i < 2; i++) {
    const a = [ends[i], 0.36, 0.03], b = [ends[i + 1], 0.36, 0.03];
    r.add(mesh(tube(`bunting${i}`, swag(a, b, 0.2), 0.006), string, 0, 0, 0, false));
    for (let j = 1; j < 8; j++) {
      const t = j / 8, x = a[0] + (b[0] - a[0]) * t, y = 0.36 - Math.sin(t * Math.PI) * 0.2;
      const slope = -Math.cos(t * Math.PI) * 0.2 * Math.PI / (b[0] - a[0]);
      const f = mesh(flagGeo(), mat(cols[k++ % cols.length], { r: 0.8, side: DS }), x, y, 0.035 + (j % 2) * 0.004);
      f.rotation.set(-0.12, 0, Math.atan(slope));
      r.add(f);
    }
  }
  for (const x of ends) r.add(mesh(sph(0.022, 8, 6), brass(), x, 0.37, 0.025));
  return hang(r, 0.45);
};

D.macrame = () => {
  const r = new THREE.Group();
  const cord = mat('#f1e6d2', { r: 0.95 });
  const wood = mat('#b8a07e', { r: 0.85 });
  r.add(R(mesh(cyl(0.024, 0.02, 0.66, 10), wood, 0, 0.66, 0.05), 0, 0, Math.PI / 2));
  for (const s of [1, -1]) r.add(mesh(sph(0.026, 8, 6), wood, s * 0.33, 0.66, 0.05));
  limb(r, [-0.24, 0.66, 0.05], [0, 0.84, 0.015], 0.006, cord);
  limb(r, [0.24, 0.66, 0.05], [0, 0.84, 0.015], 0.006, cord);
  r.add(mesh(sph(0.016, 8, 6), brass(), 0, 0.845, 0.012));
  const n = 8, sx = 0.07;
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sx);
  const knotY = (i) => 0.56 - Math.abs(i - (n - 1) / 2) * 0.05;
  const knot = mat('#e9dcc4', { r: 0.95 });
  for (let i = 0; i < n; i++) {
    r.add(R(mesh(torus(0.022, 0.008, 6, 10), cord, xs[i], 0.648, 0.05), 0, Math.PI / 2, 0));
    limb(r, [xs[i], 0.64, 0.05], [xs[i], knotY(i), 0.055], 0.006, cord);
    r.add(Sc(mesh(sph(0.024, 8, 6), knot, xs[i], knotY(i), 0.056), 1, 1.3, 0.8));
  }
  // diamond lattice of square knots
  for (let row = 0; row < 3; row++) {
    for (let i = row % 2; i < n - 1; i += 2) {
      const x = (xs[i] + xs[i + 1]) / 2, y = Math.min(knotY(i), knotY(i + 1)) - 0.07 - row * 0.07;
      limb(r, [xs[i], knotY(i) - row * 0.07, 0.055], [x, y, 0.058], 0.006, cord);
      limb(r, [xs[i + 1], knotY(i + 1) - row * 0.07, 0.055], [x, y, 0.058], 0.006, cord);
      r.add(Sc(mesh(sph(0.028, 8, 6), knot, x, y, 0.06), 1.2, 1, 0.8));
    }
  }
  r.add(mesh(sph(0.03, 10, 8), mat('#c8643c', { r: 0.6 }), 0, 0.3, 0.062));
  for (const s of [1, -1]) r.add(mesh(sph(0.022, 8, 6), mat('#e3a23a', { r: 0.6 }), s * 0.1, 0.34, 0.062));
  // fringe cut in a V
  for (let i = 0; i < 14; i++) {
    const x = (i - 6.5) * 0.034, top = 0.28 - Math.abs(x) * 0.25, bot = 0.02 + Math.abs(x) * 0.5;
    limb(r, [x, top, 0.058], [x * 1.08, bot, 0.06], 0.007, cord, 5);
  }
  return hang(r, 0.86);
};

function pothosVine(r, x0, y0, z0, len, seed, leafMats) {
  const rnd = rng(seed);
  const n = Math.round(len / 0.055);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + Math.sin(t * 4 + seed) * 0.04, y0 - t * len, z0 + Math.sin(t * 3 + seed) * 0.02 + t * 0.04]);
  }
  r.add(mesh(tube(`vine${seed}`, pts, 0.006, { radial: 4 }), mat('#3f7d3a'), 0, 0, 0, false));
  pts.forEach(([x, y, z], i) => {
    if (!i) return;
    const s = 1.05 - (i / n) * 0.4, side = i % 2 ? 1 : -1;
    const leaf = Sc(mesh(sph(0.055, 8, 6), leafMats[Math.floor(rnd() * leafMats.length)], x + side * 0.035, y, z + 0.01), 0.85 * s, 1 * s, 0.28 * s);
    leaf.rotation.set(0.35 + rnd() * 0.3, side * 0.4, side * -0.8);
    r.add(leaf);
  });
}

function bush(r, x, y, z, rad, mats, seed, n = 9) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(), d = rad * (0.3 + rnd() * 0.7);
    const leaf = Sc(mesh(sph(0.065, 8, 6), mats[i % mats.length], x + Math.cos(a) * d, y + rnd() * rad * 0.8, z + Math.sin(a) * d * 0.8), 0.9, 1.1, 0.35);
    leaf.rotation.set(0.5 + rnd() * 0.5, -a, 0.4);
    r.add(leaf);
  }
}

D.plantshelf = () => {
  const r = new THREE.Group();
  const wood = mat(OAK, { r: 0.6 });
  r.add(mesh(rbox(1.66, 0.06, 0.3, 0.014), wood, 0, 0.62, 0.15));
  for (const x of [-0.55, 0.55]) {
    r.add(mesh(box(0.035, 0.18, 0.03), iron(), x, 0.52, 0.015));
    limb(r, [x, 0.45, 0.02], [x, 0.6, 0.22], 0.012, iron());
  }
  const leaves = [mat('#4fa35a', { r: 0.6 }), mat('#7cc95e', { r: 0.6 }), mat('#9bd36a', { r: 0.6 }), mat('#3f8f45', { r: 0.6 })];
  // terracotta pot of pothos
  r.add(mesh(cyl(0.14, 0.1, 0.2, 18), mat('#d0703f', { r: 0.8 }), -0.52, 0.75, 0.15));
  r.add(mesh(cyl(0.15, 0.15, 0.04, 18), mat('#c0632f', { r: 0.8 }), -0.52, 0.84, 0.15));
  bush(r, -0.52, 0.86, 0.15, 0.14, leaves, 2, 12);
  pothosVine(r, -0.62, 0.84, 0.31, 0.72, 3, leaves);
  pothosVine(r, -0.45, 0.83, 0.32, 0.5, 7, leaves);
  pothosVine(r, -0.3, 0.8, 0.3, 0.32, 9, leaves);
  // white ribbed pot of string-of-pearls
  r.add(mesh(lathe('ribpot', [[0, 0], [0.08, 0], [0.12, 0.03], [0.13, 0.14], [0.12, 0.18], [0, 0.18]], 18), mat('#f6f2ea', { r: 0.4 }), 0.02, 0.65, 0.15));
  for (let i = 0; i < 8; i++) r.add(R(mesh(box(0.012, 0.13, 0.01), mat('#e2ddd2'), 0.02 + Math.cos((i / 8) * TAU) * 0.125, 0.73, 0.15 + Math.sin((i / 8) * TAU) * 0.125), 0, -(i / 8) * TAU, 0));
  r.add(mesh(cyl(0.115, 0.115, 0.01, 16), mat('#5b3b25'), 0.02, 0.82, 0.15));
  const pearl = mat('#8fd16a', { r: 0.4 });
  for (let v = 0; v < 5; v++) {
    const x0 = -0.08 + v * 0.05, len = 0.3 + (v % 3) * 0.16;
    for (let i = 0; i < len / 0.032; i++) r.add(mesh(sph(0.021, 6, 5), pearl, x0 + Math.sin(i * 0.7 + v) * 0.014, 0.8 - i * 0.032, 0.31 + Math.min(i, 3) * 0.006, false));
  }
  for (let i = 0; i < 14; i++) r.add(mesh(sph(0.024, 6, 5), pearl, 0.02 + Math.cos(i * 0.9) * 0.09 * ((i % 3) / 3 + 0.4), 0.84 + (i % 2) * 0.02, 0.15 + Math.sin(i * 0.9) * 0.09 * ((i % 3) / 3 + 0.4), false));
  // speckled blue pot with a fern
  r.add(mesh(cyl(0.13, 0.1, 0.19, 18), mat('#4f7fd0', { r: 0.5 }), 0.55, 0.745, 0.15));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    r.add(mesh(sph(0.013, 5, 4), mat('#f4efe6'), 0.55 + Math.cos(a) * 0.123, 0.7 + (i % 3) * 0.04, 0.15 + Math.sin(a) * 0.115, false));
  }
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU;
    const f = Sc(mesh(cone(0.06, 0.38, 4), leaves[i % 2 ? 3 : 0], 0.55 + Math.cos(a) * 0.1, 0.92, 0.15 + Math.sin(a) * 0.09), 1, 1, 0.25);
    f.rotation.set(Math.sin(a) * 1.0, -a, -Math.cos(a) * 1.0);
    r.add(f);
  }
  pothosVine(r, 0.66, 0.82, 0.31, 0.44, 11, leaves);
  return hang(r, 1.1);
};

function chalkMenuTex() {
  return paintTex('menu-board', 512, 288, (g, w, h) => {
    g.fillStyle = '#26352f';
    g.fillRect(0, 0, w, h);
    const rnd = rng(5);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 50; i++) g.fillRect(rnd() * w, rnd() * h, 60, 4);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffe9a8';
    g.font = `56px ${SIGN_FONT}`;
    g.fillText('MENU', w / 2, 44);
    g.strokeStyle = '#ffe9a8';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(170, 76); g.quadraticCurveTo(256, 88, 342, 74); g.stroke();
    const items = [['Burgers', '8', '#ffffff'], ['Pizza', '9', '#ff9aa8'], ['Sushi', '12', '#9ad8ff'], ['Tacos', '7', '#b8f08a'], ['Ramen', '10', '#ffd27a'], ['Shakes', '5', '#e0b4ff']];
    g.font = `28px ${SIGN_FONT}`;
    items.forEach(([n, p, c], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = col ? 290 : 46, y = 122 + row * 50;
      g.textAlign = 'left';
      g.fillStyle = c;
      g.fillText(n, x, y);
      g.textAlign = 'right';
      g.fillStyle = '#ffe9a8';
      g.fillText(`$${p}`, x + 180, y);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let d = x + 112; d < x + 146; d += 8) g.fillRect(d, y + 6, 3, 3);
    });
    g.strokeStyle = '#ff9aa8';
    g.lineWidth = 3;
    g.beginPath(); g.arc(462, 40, 16, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(478, 36); g.quadraticCurveTo(490, 40, 478, 48); g.stroke();
    g.strokeStyle = '#9ad8ff';
    for (const [x, y] of [[50, 36], [80, 56]]) { g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.moveTo(x, y - 10); g.lineTo(x, y + 10); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 600; i++) g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
  });
}

D.menuboard = () => {
  const r = new THREE.Group();
  frame(r, 1.62, 0.94, 0.47, mat('#a0683a', { r: 0.6 }), 0.07, 0.05);
  r.add(mesh(plane(1.5, 0.82), texMat(chalkMenuTex(), { r: 0.95 }), 0, 0.47, 0.03, false));
  r.add(mesh(rbox(1.3, 0.035, 0.08, 0.01), mat('#a0683a', { r: 0.6 }), 0, 0.02, 0.06));
  ['#ffffff', '#ff9aa8', '#ffe9a8'].forEach((c, i) => r.add(R(mesh(cyl(0.011, 0.011, 0.09, 6), mat(c, { r: 0.9 }), 0.35 + i * 0.12, 0.05, 0.07), 0, 0, Math.PI / 2 + 0.1)));
  const rope = mat('#c9b48a', { r: 0.9 });
  limb(r, [-0.6, 0.93, 0.03], [0, 1.08, 0.01], 0.008, rope);
  limb(r, [0.6, 0.93, 0.03], [0, 1.08, 0.01], 0.008, rope);
  r.add(mesh(sph(0.018, 8, 6), brass(), 0, 1.085, 0.01));
  return hang(r, 1.0);
};

function platesTex() {
  return paintTex('plate-atlas', 384, 384, (g) => {
    const C = 128;
    const designs = [
      (x, y) => { // blue willow
        disc(g, x, y, 60, '#fbfaf5'); ring(g, x, y, 56, 8, '#2f5fae'); ring(g, x, y, 44, 2, '#2f5fae');
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; petal(g, x + Math.cos(a) * 18, y + Math.sin(a) * 18, 9, a, '#2f5fae'); }
        disc(g, x, y, 8, '#2f5fae');
      },
      (x, y) => { // yellow polka
        disc(g, x, y, 60, '#ffd23f'); ring(g, x, y, 57, 4, '#ffffff');
        for (let i = 0; i < 24; i++) { const a = i * 2.4, d = 10 + (i % 4) * 11; disc(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 4.5, '#ffffff'); }
      },
      (x, y) => { // lemon
        disc(g, x, y, 60, '#fbfaf5'); ring(g, x, y, 56, 7, '#e8463f');
        g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(x, y, 26, 18, -0.5, 0, TAU); g.fill();
        g.fillStyle = '#5fae4a'; g.beginPath(); g.ellipse(x + 20, y - 22, 12, 6, -0.9, 0, TAU); g.fill();
      },
      (x, y) => { // green leaves
        disc(g, x, y, 60, '#e9f4e4'); ring(g, x, y, 56, 5, '#3f8f45');
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; petal(g, x + Math.cos(a) * 26, y + Math.sin(a) * 26, 14, a, i % 2 ? '#5fae4a' : '#3f8f45'); }
      },
      (x, y) => { // pink scallop floral
        for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; disc(g, x + Math.cos(a) * 52, y + Math.sin(a) * 52, 10, '#ff9ab8'); }
        disc(g, x, y, 54, '#ffe4ec');
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; petal(g, x + Math.cos(a) * 14, y + Math.sin(a) * 14, 12, a, '#ff6f9a'); }
        disc(g, x, y, 7, '#ffd23f');
      },
      (x, y) => { // terracotta swirl
        disc(g, x, y, 60, '#d0703f'); ring(g, x, y, 54, 3, '#fbe7d0');
        g.strokeStyle = '#fbe7d0'; g.lineWidth = 4; g.beginPath();
        for (let t = 0; t < 14; t += 0.2) { const rr = t * 3; g.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); }
        g.stroke();
      },
      (x, y) => { // navy star
        disc(g, x, y, 60, '#22356b'); ring(g, x, y, 55, 4, '#f0c04a');
        g.fillStyle = '#f0c04a'; g.beginPath();
        for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? 12 : 28; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        g.fill();
      },
      (x, y) => { // strawberry
        disc(g, x, y, 60, '#fbfaf5'); ring(g, x, y, 56, 6, '#5fc0a0');
        g.fillStyle = '#e8343f'; g.beginPath(); g.moveTo(x - 22, y - 8); g.quadraticCurveTo(x, y + 44, x + 22, y - 8); g.quadraticCurveTo(x, y - 22, x - 22, y - 8); g.fill();
        g.fillStyle = '#ffe9a8'; for (let i = 0; i < 6; i++) disc(g, x - 10 + (i % 3) * 10, y + (i < 3 ? 2 : 14), 2, '#ffe9a8');
        g.fillStyle = '#4c9a45'; g.beginPath(); g.ellipse(x, y - 14, 16, 6, 0, 0, TAU); g.fill();
      },
      (x, y) => { // mint stripes
        disc(g, x, y, 60, '#bfe8dc');
        for (let i = 0; i < 4; i++) ring(g, x, y, 54 - i * 12, 4, i % 2 ? '#ffffff' : '#2fb3a6');
      },
    ];
    designs.forEach((d, i) => d((i % 3) * C + C / 2, Math.floor(i / 3) * C + C / 2));
  });
  function disc(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function ring(g, x, y, r, w, c) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
  function petal(g, x, y, r, a, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r, r * 0.5, a, 0, TAU); g.fill(); }
}

// Plate face showing one cell of the 3x3 plate atlas
const plateFace = (i) => geo(`plate-face${i}`, () => {
  const g = new THREE.CircleGeometry(1, 32);
  const uv = g.attributes.uv;
  const cx = i % 3, cy = 2 - Math.floor(i / 3);
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (cx + 0.03 + uv.getX(k) * 0.94) / 3, (cy + 0.03 + uv.getY(k) * 0.94) / 3);
  return g;
});

D.platewall = () => {
  const r = new THREE.Group();
  const face = mat('#ffffff', { map: platesTex(), mapKey: 'plate-atlas', r: 0.3 });
  const rim = mat('#f6f3ec', { r: 0.3 });
  const plates = [[0, 0.56, 0.25, 0], [-0.44, 0.88, 0.16, 1], [0.42, 0.9, 0.15, 2], [-0.48, 0.42, 0.18, 3], [0.48, 0.46, 0.19, 4],
    [-0.14, 0.15, 0.13, 6], [0.19, 0.15, 0.12, 5], [-0.75, 0.68, 0.1, 8], [0.76, 0.76, 0.09, 7], [0.0, 0.97, 0.09, 1], [-0.76, 0.2, 0.08, 2], [0.75, 0.2, 0.09, 8]];
  for (const [x, y, s, d] of plates) {
    r.add(R(mesh(cyl(s, s * 0.82, 0.03, 28), rim, x, y, 0.018), Math.PI / 2));
    r.add(Sc(mesh(plateFace(d), face, x, y, 0.0335, false), s * 0.97));
    r.add(mesh(box(0.012, 0.03, 0.012), brass(), x, y + s + 0.005, 0.03, false));
  }
  return hang(r, 1.0);
};

D.fishtrophy = () => {
  const r = new THREE.Group();
  const plaque = mat('#6b3b22', { r: 0.45 });
  r.add(mesh(rbox(0.66, 0.44, 0.05, 0.05), plaque, 0, 0.3, 0.025));
  r.add(mesh(rbox(0.58, 0.36, 0.02, 0.04), mat('#8a5230', { r: 0.45 }), 0, 0.3, 0.055));
  r.add(mesh(rbox(0.26, 0.06, 0.012, 0.01), gold(), 0, 0.13, 0.068));
  r.add(mesh(box(0.06, 0.06, 0.1), plaque, 0, 0.32, 0.1));
  const fish = new THREE.Group();
  fish.position.set(0, 0.33, 0.17);
  const green = mat('#5f8f3a', { r: 0.4 });
  const belly = mat('#e3dca0', { r: 0.4 });
  fish.add(Sc(mesh(sph(0.1, 18, 12), green, 0, 0, 0), 2.5, 1, 0.65));
  fish.add(Sc(mesh(sph(0.09, 16, 10), belly, 0.02, -0.03, 0.012), 2.3, 0.75, 0.6));
  for (let i = 0; i < 5; i++) fish.add(Sc(mesh(sph(0.02, 6, 5), mat('#3b5e25'), -0.12 + i * 0.06, 0.02 + (i % 2) * 0.02, 0.06), 1.4, 1, 0.4));
  for (let i = 0; i < 5; i++) fish.add(R(Sc(mesh(cone(0.025, 0.08, 4), green, -0.08 + i * 0.045, 0.1, 0), 1, 1, 0.25), 0, 0, 0.35));
  const tail = dyn(new THREE.Group());
  tail.position.set(-0.24, 0, 0);
  for (const s of [1, -1]) tail.add(R(Sc(mesh(cone(0.06, 0.16, 6), green, -0.06, s * 0.05, 0), 1, 1, 0.25), 0, 0, Math.PI / 2 + s * 0.6));
  fish.add(tail);
  const head = dyn(new THREE.Group());
  head.position.set(0.2, 0, 0);
  head.add(Sc(mesh(sph(0.08, 14, 10), green, 0.02, 0.01, 0), 1.1, 1, 0.75));
  head.add(Sc(mesh(sph(0.045, 10, 8), mat('#7a2228'), 0.085, -0.015, 0), 0.6, 1, 0.8));
  head.add(mesh(sph(0.02, 8, 6), mat('#fff6d0'), 0.04, 0.04, 0.05));
  head.add(mesh(sph(0.011, 6, 5), mat('#1d1a14'), 0.045, 0.042, 0.065, false));
  fish.add(head);
  for (const s of [1, -1]) fish.add(R(Sc(mesh(cone(0.03, 0.08, 5), green, 0.06, -0.06, s * 0.05), 1, 1, 0.3), 0, 0, -2.2));
  r.add(fish);
  return hang(r, 0.6, {
    animate(t) {
      const k = (t * 0.17) % 1, on = k > 0.85 ? Math.sin(((k - 0.85) / 0.15) * Math.PI) : 0;
      tail.rotation.y = Math.sin(t * 14) * 0.6 * on;
      head.rotation.y = -on * 0.45;
      fish.rotation.y = on * 0.15;
    },
  });
};

function jar(r, x, y, z, h, rad, fill, lid, extra) {
  r.add(mesh(cyl(rad, rad, h * 0.78, 14), mat(fill, { r: 0.55 }), x, y + h * 0.39, z));
  r.add(mesh(cyl(rad * 0.98, rad, h * 0.16, 14), mat('#e2f1f3', { r: 0.1 }), x, y + h * 0.86, z));
  r.add(mesh(cyl(rad * 0.8, rad * 0.8, 0.02, 14), mat('#e2f1f3', { r: 0.1 }), x, y + h * 0.95, z));
  r.add(mesh(cyl(rad * 0.85, rad * 0.85, 0.035, 14), mat(lid, { r: 0.5 }), x, y + h, z));
  r.add(mesh(box(0.01, h * 0.6, 0.01), mat('#ffffff', { r: 0.1 }), x - rad * 0.55, y + h * 0.45, z + rad * 0.82, false));
  if (extra) extra(x, y, z);
}

D.openshelf = () => {
  const r = new THREE.Group();
  const wood = mat(OAK, { r: 0.6 });
  for (const y of [0.3, 0.76]) {
    r.add(mesh(rbox(1.62, 0.045, 0.28, 0.012), wood, 0, y, 0.14));
    for (const x of [-0.6, 0.6]) {
      r.add(mesh(box(0.025, 0.14, 0.025), iron(), x, y - 0.09, 0.013));
      r.add(mesh(box(0.025, 0.025, 0.24), iron(), x, y - 0.035, 0.13));
      limb(r, [x, y - 0.15, 0.02], [x, y - 0.03, 0.18], 0.008, iron());
    }
  }
  // top: jars
  const top = 0.7825;
  jar(r, -0.62, top, 0.14, 0.24, 0.07, '#f2d16b', '#c9a04a');
  jar(r, -0.44, top, 0.14, 0.2, 0.065, '#a8402c', '#e8463f');
  jar(r, -0.27, top, 0.14, 0.27, 0.07, '#fbf6ea', '#c9a04a');
  jar(r, -0.1, top, 0.14, 0.2, 0.07, '#fff1a0', '#4fa35a', (x, y, z) => {
    for (let i = 0; i < 5; i++) r.add(mesh(sph(0.03, 8, 6), mat('#ffd23f', { r: 0.5 }), x + (i % 2 ? 0.03 : -0.03), y + 0.04 + Math.floor(i / 2) * 0.045, z + 0.045, false));
  });
  jar(r, 0.06, top, 0.14, 0.17, 0.06, '#6b8f3a', '#2b2b30');
  // cookbooks and a pot plant on top right
  const bookCols = ['#e8463f', '#2f8cf0', '#ffbb1f', '#2fbf5f', '#9b5cf6'];
  bookCols.forEach((c, i) => r.add(mesh(box(0.05, 0.24 + (i % 3) * 0.03, 0.2), mat(c, { r: 0.7 }), 0.22 + i * 0.056, top + 0.12 + (i % 3) * 0.015, 0.13)));
  r.add(R(mesh(box(0.05, 0.22, 0.19), mat('#ff7ab6', { r: 0.7 }), 0.52, top + 0.105, 0.13), 0, 0, -0.32));
  r.add(mesh(cyl(0.07, 0.055, 0.1, 14), mat('#e07a4f', { r: 0.8 }), 0.66, top + 0.05, 0.14));
  r.add(mesh(ico(0.1, 1), mat(LEAF, { flat: true }), 0.66, top + 0.16, 0.14));
  // lower: stacked books, copper pot, herbs
  const low = 0.3225;
  [['#f4efe6', 0.3], ['#2fb3a6', 0.27], ['#e8463f', 0.29]].forEach(([c, w], i) => r.add(mesh(box(w, 0.05, 0.2), mat(c, { r: 0.7 }), -0.5, low + 0.025 + i * 0.05, 0.13)));
  r.add(mesh(cyl(0.06, 0.05, 0.08, 12), mat('#c9a04a'), -0.5, low + 0.19, 0.13));
  const copper = mat('#d0794a', { r: 0.3, m: 0.75 });
  r.add(mesh(cyl(0.12, 0.11, 0.14, 18), copper, -0.05, low + 0.07, 0.14));
  r.add(mesh(cyl(0.125, 0.125, 0.02, 18), copper, -0.05, low + 0.15, 0.14));
  r.add(mesh(sph(0.025, 8, 6), copper, -0.05, low + 0.17, 0.14));
  for (const s of [1, -1]) r.add(R(mesh(torus(0.03, 0.008, 6, 10, Math.PI), copper, -0.05 + s * 0.13, low + 0.12, 0.14), 0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2));
  for (let i = 0; i < 3; i++) {
    const x = 0.3 + i * 0.16;
    r.add(mesh(cyl(0.055, 0.045, 0.09, 12), mat(['#fbf6ea', '#e07a4f', '#fbf6ea'][i], { r: 0.6 }), x, low + 0.045, 0.14));
    for (let k = 0; k < 6; k++) r.add(Sc(mesh(sph(0.03, 6, 5), mat(k % 2 ? LEAF : LEAF2), x + Math.cos(k) * 0.03, low + 0.12 + (k % 3) * 0.025, 0.14 + Math.sin(k) * 0.03), 1, 1.5, 1));
  }
  // utensil rail
  r.add(R(mesh(cyl(0.01, 0.01, 1.2, 8), brass(), 0, 0.21, 0.07), 0, 0, Math.PI / 2));
  for (const x of [-0.6, 0.6]) r.add(mesh(box(0.02, 0.02, 0.07), brass(), x, 0.21, 0.035));
  r.add(R(mesh(cyl(0.11, 0.1, 0.03, 18), copper, -0.35, 0.03, 0.08), Math.PI / 2));
  r.add(mesh(box(0.025, 0.1, 0.012), copper, -0.35, 0.16, 0.08));
  limb(r, [0.05, 0.2, 0.08], [0.05, 0.04, 0.08], 0.008, chrome());
  r.add(Sc(mesh(sph(0.04, 10, 8, 0, TAU, Math.PI / 2, Math.PI / 2), chrome(), 0.05, 0.04, 0.08), 1, 1, 1));
  limb(r, [0.3, 0.2, 0.08], [0.3, 0.1, 0.08], 0.007, chrome());
  for (let i = 0; i < 4; i++) r.add(R(Sc(mesh(torus(0.035, 0.004, 4, 12), chrome(), 0.3, 0.07, 0.08), 0.6, 1.3, 1), 0, (i / 4) * Math.PI, 0));
  return hang(r, 1.12);
};

function clockFaceTex() {
  return paintTex('cuckoo-face', 128, 128, (g, w, h) => {
    g.fillStyle = '#f7ecd2';
    g.beginPath(); g.arc(64, 64, 63, 0, TAU); g.fill();
    g.fillStyle = '#3b2414';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `22px ${SIGN_FONT}`;
    for (const [n, a] of [['12', 0], ['3', 0.25], ['6', 0.5], ['9', 0.75]]) g.fillText(n, 64 + Math.sin(a * TAU) * 46, 66 - Math.cos(a * TAU) * 46);
    for (let i = 0; i < 12; i++) if (i % 3) { const a = (i / 12) * TAU; g.beginPath(); g.arc(64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48, 3, 0, TAU); g.fill(); }
  });
}

D.cuckoo = () => {
  const r = new THREE.Group();
  const wood = mat('#6b3b22', { r: 0.55 });
  const light = mat('#a0683a', { r: 0.55 });
  r.add(mesh(rbox(0.44, 0.46, 0.18, 0.02), wood, 0, 0.86, 0.09));
  r.add(mesh(rbox(0.48, 0.05, 0.2, 0.015), light, 0, 0.62, 0.1));
  for (const s of [1, -1]) {
    const roof = mesh(rbox(0.36, 0.04, 0.28, 0.012), light, s * 0.14, 1.17, 0.15);
    roof.rotation.z = -s * 0.62;
    r.add(roof);
    for (let i = 0; i < 4; i++) {
      const d = 0.05 + i * 0.085;
      r.add(R(mesh(box(0.05, 0.018, 0.28), mat('#5e3a22'), s * d * 0.814, 1.275 - d * 0.581 + 0.02, 0.15), 0, 0, -s * 0.62));
    }
  }
  r.add(R(mesh(rbox(0.36, 0.03, 0.03, 0.01), light, 0, 1.06, 0.2), 0, 0, 0));
  // carved leaves and a bird on the roof peak
  for (let i = 0; i < 5; i++) r.add(R(Sc(mesh(sph(0.05, 8, 6), mat('#4f7a3a', { r: 0.7 }), -0.12 + i * 0.06, 1.3 + (i % 2) * 0.02, 0.12), 1.2, 0.6, 0.4), 0, 0, (i - 2) * 0.4));
  r.add(Sc(mesh(sph(0.045, 10, 8), mat('#8a5a33'), 0, 1.36, 0.13), 1.3, 1, 1));
  r.add(mesh(sph(0.03, 8, 6), mat('#8a5a33'), 0.05, 1.4, 0.13));
  r.add(R(mesh(cone(0.012, 0.03, 6), mat('#ffbb1f'), 0.085, 1.4, 0.13), 0, 0, -Math.PI / 2));
  // face and hands
  r.add(mesh(geo('cuckoo-dial', () => new THREE.CircleGeometry(0.13, 32)), mat('#ffffff', { map: clockFaceTex(), mapKey: 'cuckoo-face', r: 0.6 }), 0, 0.82, 0.185, false));
  r.add(mesh(torus(0.135, 0.012, 6, 28), gold(), 0, 0.82, 0.185));
  const hand = mat('#2b1d14');
  const hourH = dyn(new THREE.Group()), minH = dyn(new THREE.Group());
  hourH.position.set(0, 0.82, 0.19);
  minH.position.set(0, 0.82, 0.195);
  hourH.add(mesh(box(0.018, 0.07, 0.006), hand, 0, 0.032, 0, false));
  minH.add(mesh(box(0.012, 0.1, 0.006), hand, 0, 0.046, 0, false));
  r.add(hourH, minH, mesh(sph(0.012, 8, 6), gold(), 0, 0.82, 0.2, false));
  // the cuckoo's door and bird
  r.add(mesh(rbox(0.1, 0.1, 0.02, 0.01), mat('#2b1810'), 0, 1.0, 0.18));
  const door = dyn(new THREE.Group());
  door.position.set(-0.05, 1.0, 0.192);
  door.add(mesh(box(0.1, 0.1, 0.012), light, 0.05, 0, 0, false));
  r.add(door);
  const bird = dyn(new THREE.Group());
  bird.position.set(0, 1.0, 0.12);
  bird.add(Sc(mesh(sph(0.035, 10, 8), mat('#f2d16b'), 0, 0, 0), 1, 1, 1.3));
  bird.add(mesh(sph(0.026, 8, 6), mat('#f2d16b'), 0, 0.03, 0.03));
  bird.add(R(mesh(cone(0.012, 0.035, 6), mat('#ff8a3a'), 0, 0.03, 0.065), Math.PI / 2));
  bird.add(mesh(sph(0.007, 5, 4), mat('#1d1a14'), 0.018, 0.04, 0.045, false));
  bird.add(mesh(sph(0.007, 5, 4), mat('#1d1a14'), -0.018, 0.04, 0.045, false));
  r.add(bird);
  // pendulum and pinecone weights
  const pend = dyn(new THREE.Group());
  pend.position.set(0, 0.62, 0.17);
  pend.add(mesh(box(0.012, 0.26, 0.006), gold(), 0, -0.13, 0, false));
  pend.add(Sc(mesh(sph(0.045, 12, 8), gold(), 0, -0.28, 0, false), 1, 1.2, 0.25));
  r.add(pend);
  const cone2 = mat('#4a2c18', { r: 0.7, flat: true });
  for (const [x, y] of [[-0.1, 0.04], [0.1, 0.16]]) {
    const L = 0.6 - y - 0.13;
    r.add(mesh(cyl(0.004, 0.004, L, 4), brass(), x, y + 0.13 + L / 2, 0.1, false));
    r.add(mesh(cyl(0.03, 0.012, 0.13, 8), cone2, x, y + 0.065, 0.1));
    for (let i = 0; i < 3; i++) r.add(mesh(cyl(0.032 - i * 0.004, 0.032 - i * 0.004, 0.012, 8), cone2, x, y + 0.03 + i * 0.035, 0.1));
  }
  return hang(r, 1.4, {
    animate(t) {
      minH.rotation.z = -t * 0.5;
      hourH.rotation.z = -t * 0.5 / 12;
      pend.rotation.z = Math.sin(t * 3.2) * 0.25;
      const k = (t / 9) % 1, out = k < 0.12 ? Math.sin((k / 0.12) * Math.PI) : 0;
      door.rotation.y = -Math.min(1, out * 3) * 1.6;
      bird.position.z = 0.12 + out * 0.13;
      bird.rotation.x = out > 0.5 ? Math.sin(t * 20) * 0.15 : 0;
    },
  });
};

// ---------------------------------------------------------------------------- neon signs

function neonBacker(r, w, h, cy, rad = 0.06) {
  r.add(mesh(rbox(w, h, 0.03, rad), mat('#1b2440', { r: 0.45 }), 0, cy, 0.03));
  for (const sx of [1, -1]) for (const sy of [1, -1]) r.add(R(mesh(cyl(0.014, 0.014, 0.03, 8), chrome(), sx * (w / 2 - 0.05), cy + sy * (h / 2 - 0.05), 0.03), Math.PI / 2));
}

function neonFlicker(t, seed) {
  return Math.sin(t * 23 + seed) + Math.sin(t * 7.3 + seed * 2) > 1.8 ? 0.25 : 1;
}

D.neon_pizza = (def) => {
  const r = new THREE.Group();
  neonBacker(r, 0.66, 0.66, 0.33);
  const z = 0.062;
  const cheese = umat('#ffd84a', { e: '#ffaa00', ei: 1.8 });
  const crust = umat('#ff9a40', { e: '#ff6a00', ei: 1.8 });
  const pep = umat('#ff5a6a', { e: '#ff1a2a', ei: 1.8 });
  r.add(mesh(tube('pizza-slice', [[-0.2, 0.5, 0], [0, 0.1, 0], [0.2, 0.5, 0]], 0.017, { tension: 0.1 }), cheese, 0, 0, z, false));
  r.add(mesh(tube('pizza-crust', [[-0.25, 0.48, 0], [-0.12, 0.56, 0], [0, 0.58, 0], [0.12, 0.56, 0], [0.25, 0.48, 0]], 0.024), crust, 0, 0, z, false));
  for (const [x, y] of [[-0.06, 0.4], [0.07, 0.43], [0.01, 0.27]]) r.add(mesh(torus(0.04, 0.012, 6, 18), pep, x, y, z, false));
  r.add(mesh(tube('pizza-drip', [[0.11, 0.36, 0], [0.12, 0.3, 0], [0.115, 0.26, 0]], 0.012), cheese, 0, 0, z, false));
  for (const [x, y] of [[-0.2, 0.5], [0.2, 0.5], [0.115, 0.26]]) r.add(mesh(sph(0.017, 8, 6), cheese, x, y, z, false));
  const light = { y: def.mount + 0.35, color: '#ff9a3a', intensity: 3.5, distance: 3.2 };
  return hang(r, 0.7, {
    light,
    animate(t) {
      const k = neonFlicker(t, 1.3);
      cheese.emissiveIntensity = 1.8 * k;
      crust.emissiveIntensity = 1.8 * k;
      pep.emissiveIntensity = 1.4 + Math.max(0, Math.sin(t * 2.4)) * 1.2;
      light.intensity = 3.5 * (0.4 + 0.6 * k);
    },
  });
};

D.neon_coffee = (def) => {
  const r = new THREE.Group();
  neonBacker(r, 0.66, 0.68, 0.34);
  const z = 0.062;
  const cup = umat('#7fe8ff', { e: '#1fc8ff', ei: 1.8 });
  const steam = [0, 1, 2].map(() => umat('#ff8ad9', { e: '#ff3fc0', ei: 1.8 }));
  r.add(mesh(tube('coffee-cup', [[-0.19, 0.4, 0], [-0.16, 0.2, 0], [-0.08, 0.13, 0], [0.08, 0.13, 0], [0.16, 0.2, 0], [0.19, 0.4, 0], [-0.19, 0.4, 0]], 0.017, { tension: 0.25, seg: 120 }), cup, 0, 0, z, false));
  r.add(R(mesh(torus(0.065, 0.015, 6, 20, Math.PI * 1.2), cup, 0.19, 0.3, z, false), 0, 0, -Math.PI * 0.6));
  r.add(mesh(tube('coffee-saucer', [[-0.26, 0.1, 0], [-0.1, 0.07, 0], [0.1, 0.07, 0], [0.26, 0.1, 0]], 0.015), cup, 0, 0, z, false));
  [-0.08, 0, 0.08].forEach((x, i) => {
    r.add(mesh(tube(`coffee-steam${i}`, [[x, 0.46, 0], [x + 0.03, 0.5, 0], [x - 0.02, 0.55, 0], [x + 0.02, 0.6, 0]], 0.012), steam[i], 0, 0, z, false));
  });
  const light = { y: def.mount + 0.35, color: '#7fdcff', intensity: 3.2, distance: 3.2 };
  return hang(r, 0.72, {
    light,
    animate(t) {
      const k = neonFlicker(t, 4.1);
      cup.emissiveIntensity = 1.8 * k;
      steam.forEach((m, i) => { m.emissiveIntensity = 0.3 + Math.max(0, Math.sin(t * 2.6 - i * 0.9)) * 2.2; });
      light.intensity = 3.2 * (0.4 + 0.6 * k);
    },
  });
};

D.neon_yum = (def) => {
  const r = new THREE.Group();
  neonBacker(r, 1.6, 0.66, 0.33, 0.2);
  const z = 0.062;
  const pink = umat('#ff6fc0', { e: '#ff1f90', ei: 2 });
  const cyan = umat('#6fe4ff', { e: '#19c4ff', ei: 1.8 });
  const T = (key, pts, m, rad = 0.022, o) => r.add(mesh(tube(key, pts, rad, o), m, 0, 0, z, false));
  T('yum-y1', [[-0.6, 0.53, 0], [-0.44, 0.33, 0], [-0.28, 0.53, 0]], pink, 0.022, { tension: 0.15 });
  T('yum-y2', [[-0.44, 0.33, 0], [-0.44, 0.15, 0]], pink, 0.022, { tension: 0 });
  T('yum-u', [[-0.15, 0.53, 0], [-0.15, 0.27, 0], [-0.1, 0.17, 0], [0, 0.14, 0], [0.1, 0.17, 0], [0.15, 0.27, 0], [0.15, 0.53, 0]], pink, 0.022, { tension: 0.35 });
  T('yum-m', [[0.27, 0.15, 0], [0.27, 0.53, 0], [0.45, 0.3, 0], [0.63, 0.53, 0], [0.63, 0.15, 0]], pink, 0.022, { tension: 0.1 });
  for (const [x, y] of [[-0.6, 0.53], [-0.28, 0.53], [-0.44, 0.15], [-0.15, 0.53], [0.15, 0.53], [0.27, 0.15], [0.63, 0.15]]) r.add(mesh(sph(0.022, 8, 6), pink, x, y, z, false));
  T('yum-line', [[-0.62, 0.08, 0], [-0.2, 0.06, 0], [0.3, 0.07, 0], [0.66, 0.1, 0]], cyan, 0.016);
  for (const [x, y, s] of [[-0.68, 0.45, 1], [0.7, 0.42, 0.8]]) {
    r.add(mesh(box(0.012 * s, 0.11 * s, 0.012), cyan, x, y, z, false));
    r.add(mesh(box(0.11 * s, 0.012 * s, 0.012), cyan, x, y, z, false));
  }
  const light = { y: def.mount + 0.35, color: '#ff4fb0', intensity: 4.2, distance: 3.6 };
  return hang(r, 0.7, {
    light,
    animate(t) {
      const k = neonFlicker(t, 0.7);
      pink.emissiveIntensity = 2 * k + Math.sin(t * 2) * 0.15;
      cyan.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.8;
      light.intensity = 4.2 * (0.35 + 0.65 * k);
    },
  });
};

function windowViewTex() {
  return paintTex('window-view', 256, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#5fb8ff');
    sky.addColorStop(0.7, '#bfe6ff');
    sky.addColorStop(1, '#e8f6ff');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (const [x, y, s] of [[60, 60, 1], [180, 40, 0.8], [150, 110, 0.6]]) {
      for (const [dx, dy, rr] of [[0, 0, 20], [22, -8, 24], [46, 0, 18], [24, 8, 20]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, rr * s, 0, TAU); g.fill(); }
    }
    g.fillStyle = '#9ccf7a';
    g.beginPath(); g.moveTo(0, 190); g.quadraticCurveTo(80, 160, 160, 186); g.quadraticCurveTo(220, 170, 256, 180); g.lineTo(256, 256); g.lineTo(0, 256); g.fill();
    g.fillStyle = '#6fb35a';
    g.beginPath(); g.moveTo(0, 220); g.quadraticCurveTo(120, 196, 256, 224); g.lineTo(256, 256); g.lineTo(0, 256); g.fill();
    g.fillStyle = '#4f8f45';
    for (const [x, y, rr] of [[200, 168, 26], [222, 176, 20], [40, 196, 18]]) { g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
    g.fillStyle = '#7a4a2e'; g.fillRect(208, 186, 6, 18);
  });
}

D.windowbox = () => {
  const r = new THREE.Group();
  const white = mat('#f6f2ea', { r: 0.5 });
  const cy = 0.74;
  r.add(mesh(plane(0.8, 0.86), glowMat(windowViewTex(), 0.55), 0, cy, 0.02, false));
  for (const s of [1, -1]) {
    r.add(mesh(rbox(0.94, 0.07, 0.07, 0.015), white, 0, cy + s * 0.465, 0.035));
    r.add(mesh(rbox(0.07, 1.0, 0.07, 0.015), white, s * 0.435, cy, 0.035));
  }
  r.add(mesh(box(0.035, 0.88, 0.04), white, 0, cy, 0.03));
  r.add(mesh(box(0.84, 0.035, 0.04), white, 0, cy, 0.03));
  r.add(mesh(rbox(1.04, 0.05, 0.14, 0.015), white, 0, cy - 0.5, 0.07));
  const shut = mat('#6f9c7c', { r: 0.6 });
  const slat = mat('#5d8a6a', { r: 0.6 });
  for (const s of [1, -1]) {
    const x = s * 0.66;
    r.add(mesh(rbox(0.32, 0.98, 0.035, 0.01), shut, x, cy, 0.02));
    for (let i = 0; i < 11; i++) r.add(R(mesh(box(0.26, 0.05, 0.012), slat, x, cy - 0.38 + i * 0.076, 0.042), -0.5));
    r.add(mesh(box(0.035, 0.035, 0.03), iron(), s * 0.52, cy + 0.3, 0.04));
    r.add(mesh(box(0.035, 0.035, 0.03), iron(), s * 0.52, cy - 0.3, 0.04));
  }
  // flower box
  const boxM = mat('#a0683a', { r: 0.7 });
  r.add(mesh(rbox(0.98, 0.18, 0.22, 0.02), boxM, 0, 0.1, 0.14));
  for (let i = 0; i < 4; i++) r.add(mesh(box(0.012, 0.16, 0.012), mat('#7a4a2e'), -0.36 + i * 0.24, 0.1, 0.252, false));
  for (const x of [-0.36, 0.36]) {
    r.add(mesh(box(0.03, 0.12, 0.03), iron(), x, 0.0, 0.015));
    limb(r, [x, -0.03, 0.02], [x, 0.03, 0.18], 0.008, iron());
  }
  r.add(mesh(box(0.92, 0.02, 0.18), mat('#5b3b25'), 0, 0.19, 0.14));
  const leaf = [mat(LEAF, { r: 0.7 }), mat(LEAF2, { r: 0.7 }), mat(LEAF3, { r: 0.7 })];
  for (let i = 0; i < 9; i++) r.add(Sc(mesh(ico(0.075, 1), leaf[i % 3], -0.4 + i * 0.1, 0.24 + (i % 2) * 0.03, 0.14 + (i % 3 - 1) * 0.04), 1, 0.8, 1));
  const cols = ['#e8343f', '#ff7ab6', '#ffffff', '#e8343f', '#ff9a3c', '#ff7ab6', '#e8343f'];
  for (let i = 0; i < 7; i++) {
    const x = -0.38 + i * 0.127, y = 0.33 + (i % 2) * 0.05;
    for (let k = 0; k < 5; k++) r.add(mesh(sph(0.03, 8, 6), mat(cols[i], { r: 0.6 }), x + Math.cos(k * 1.3) * 0.035, y + Math.sin(k * 2.1) * 0.02, 0.15 + Math.sin(k * 1.3) * 0.035, false));
  }
  const rnd = rng(23);
  for (let v = 0; v < 5; v++) {
    const x0 = -0.42 + v * 0.21;
    for (let i = 0; i < 5; i++) {
      const lf = Sc(mesh(sph(0.04, 8, 6), leaf[(v + i) % 3], x0 + Math.sin(i + v) * 0.02, 0.2 - i * 0.055, 0.26 + i * 0.006), 0.8, 1, 0.3);
      lf.rotation.set(0.3, rnd() - 0.5, (i % 2 ? 0.6 : -0.6));
      r.add(lf);
    }
  }
  return hang(r, 1.3);
};

D.goldrecord = () => {
  const r = new THREE.Group();
  frame(r, 0.62, 0.78, 0.39, mat('#1d1a20', { r: 0.35 }), 0.05, 0.07);
  r.add(mesh(box(0.54, 0.7, 0.01), mat('#f4efe6', { r: 0.9 }), 0, 0.39, 0.025, false));
  const disc = umat('#f0c04a', { r: 0.22, m: 0.9, e: '#ffcf50', ei: 0.1 });
  r.add(R(mesh(cyl(0.2, 0.2, 0.012, 40), disc, 0, 0.47, 0.04), Math.PI / 2));
  for (let i = 0; i < 4; i++) r.add(mesh(torus(0.18 - i * 0.03, 0.004, 4, 40), mat('#c9962a', { r: 0.3, m: 0.85 }), 0, 0.47, 0.047, false));
  r.add(R(mesh(cyl(0.065, 0.065, 0.014, 24), mat('#e8343f', { r: 0.5 }), 0, 0.47, 0.042), Math.PI / 2));
  r.add(R(mesh(cyl(0.012, 0.012, 0.016, 10), mat('#1d1a20'), 0, 0.47, 0.043), Math.PI / 2));
  r.add(mesh(box(0.08, 0.008, 0.004), mat('#fff6ea'), 0, 0.5, 0.05, false));
  r.add(mesh(rbox(0.3, 0.08, 0.012, 0.008), gold(), 0, 0.16, 0.035));
  for (let i = 0; i < 2; i++) r.add(mesh(box(0.2 - i * 0.06, 0.008, 0.004), mat('#6b4a1a'), 0, 0.172 - i * 0.022, 0.042, false));
  const spark = dyn(new THREE.Group());
  spark.position.set(0.12, 0.6, 0.06);
  const sm = umat('#fffbe0', { e: '#fff1a0', ei: 2.5 });
  spark.add(mesh(box(0.012, 0.09, 0.006), sm, 0, 0, 0, false));
  spark.add(mesh(box(0.09, 0.012, 0.006), sm, 0, 0, 0, false));
  r.add(spark);
  return hang(r, 0.85, {
    animate(t) {
      const k = (t * 0.3) % 1, p = k < 0.2 ? Math.sin((k / 0.2) * Math.PI) : 0;
      spark.scale.setScalar(0.01 + p);
      spark.rotation.z = t;
      disc.emissiveIntensity = 0.1 + p * 0.35;
    },
  });
};

D.greenwall = () => {
  const r = new THREE.Group();
  const wood = mat(WOOD_DARK, { r: 0.6 });
  frame(r, 1.66, 1.1, 0.55, wood, 0.07, 0.09);
  r.add(mesh(box(1.54, 0.98, 0.03), mat('#2f5f2a', { r: 0.95 }), 0, 0.55, 0.03));
  const greens = ['#2f7d45', '#4fa35a', '#7cc95e', '#3f8f45', '#9bd36a', '#5a9a3a', '#2a6a3a'].map((c) => mat(c, { r: 0.8, flat: true }));
  const rnd = rng(31);
  for (let gy = 0; gy < 7; gy++) {
    for (let gx = 0; gx < 11; gx++) {
      const x = -0.68 + gx * 0.136 + (rnd() - 0.5) * 0.06, y = 0.13 + gy * 0.14 + (rnd() - 0.5) * 0.05;
      const s = 0.065 + rnd() * 0.05;
      r.add(Sc(mesh(ico(s, 1), greens[Math.floor(rnd() * greens.length)], x, y, 0.06 + rnd() * 0.04), 1, 0.9, 0.7));
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = -0.66 + rnd() * 1.32, y = 0.15 + rnd() * 0.8;
    const f = Sc(mesh(cone(0.045, 0.26, 4), greens[i % 2 ? 1 : 4], x, y, 0.1), 1, 1, 0.22);
    f.rotation.set(1.0 + rnd() * 0.4, 0, (rnd() - 0.5) * 2.4);
    r.add(f);
  }
  const fl = ['#ffffff', '#ff8fc0', '#ffd23f', '#b98cff'];
  for (let i = 0; i < 9; i++) flower(r, -0.62 + rnd() * 1.24, 0.15 + rnd() * 0.8, 0.13, fl[i % 4], 0.04, '#ffcf3a', 'z');
  for (let v = 0; v < 6; v++) {
    const x0 = -0.6 + v * 0.24 + rnd() * 0.05;
    for (let i = 0; i < 3; i++) r.add(R(Sc(mesh(sph(0.04, 8, 6), greens[(v + i) % 3], x0, 0.07 - i * 0.05, 0.1), 0.8, 1, 0.3), 0.3, 0, i % 2 ? 0.6 : -0.6));
  }
  return hang(r, 1.15);
};

// =============================================================================== floor pieces

// Leaf blade from an outline (right half, base to tip; mirrored), cupped and drooping. Built in
// the XY plane, base at the origin, tip up +y, face +z.
function leafGeo(key, half, cup = 0.1, droop = 0.25) {
  return geo(`leaf:${key}`, () => {
    const s = new THREE.Shape();
    s.moveTo(half[0][0], half[0][1]);
    for (const [x, y] of half.slice(1)) s.lineTo(x, y);
    for (const [x, y] of [...half].reverse()) if (x > 0) s.lineTo(-x, y);
    const g = new THREE.ShapeGeometry(s, 4);
    const p = g.attributes.position;
    const len = Math.max(...half.map(([, y]) => y)), wid = Math.max(...half.map(([x]) => x));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, cup * (x / wid) ** 2 - droop * (y / len) ** 2 * len);
    }
    g.computeVertexNormals();
    return g;
  });
}

// Lay a leaf so its tip points out along azimuth `a`, raised by `lift` radians, face up
function leaf(root, g, material, pos, a, lift, s = 1) {
  const m = mesh(g, material, ...pos);
  m.rotation.set(-Math.PI / 2 + lift, -Math.PI / 2 - a, 0, 'YXZ');
  m.scale.setScalar(s);
  root.add(m);
  return m;
}

const monsteraHalf = (() => {
  const edge = [[0, 0.07], [0.12, -0.05], [0.3, -0.04], [0.44, 0.08], [0.52, 0.24], [0.52, 0.4], [0.45, 0.56], [0.32, 0.7], [0.16, 0.8], [0, 0.84]];
  const out = [edge[0]];
  for (let i = 1; i < edge.length; i++) {
    const [x0, y0] = edge[i - 1], [x1, y1] = edge[i];
    if (i >= 3 && i <= 7) {
      // a slit cut in towards the midrib
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      out.push([mx - (x1 - x0) * 0.08, my - (y1 - y0) * 0.08], [mx * 0.28, my * 0.9 + 0.02], [mx + (x1 - x0) * 0.08, my + (y1 - y0) * 0.08]);
    }
    out.push([x1, y1]);
  }
  return out;
})();

D.monstera = () => {
  const r = new THREE.Group();
  const wood = mat('#b98a55', { r: 0.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    limb(r, [Math.cos(a) * 0.14, 0.26, Math.sin(a) * 0.14], [Math.cos(a) * 0.27, 0, Math.sin(a) * 0.27], 0.018, wood);
  }
  r.add(R(mesh(torus(0.15, 0.018, 6, 20), wood, 0, 0.25, 0), Math.PI / 2));
  r.add(mesh(lathe('monstera-pot', [[0, 0], [0.13, 0], [0.17, 0.05], [0.19, 0.2], [0.2, 0.32], [0.18, 0.32], [0, 0.3]], 22), mat('#f4f1ea', { r: 0.45 }), 0, 0.2, 0));
  r.add(R(mesh(torus(0.19, 0.012, 6, 24), gold(), 0, 0.52, 0), Math.PI / 2));
  r.add(mesh(cyl(0.18, 0.18, 0.02, 20), mat('#4a3020'), 0, 0.5, 0));
  const lg = leafGeo('monstera', monsteraHalf, 0.06, 0.18);
  const greens = [mat('#2f8a3e', { r: 0.45, side: DS }), mat('#3fa04a', { r: 0.45, side: DS }), mat('#267a36', { r: 0.45, side: DS })];
  const stem = mat('#4c8a3a', { r: 0.6 });
  const leaves = [[0.3, 1.05, 0.25, 0.7], [1.6, 1.25, 0.2, 0.55], [2.6, 0.95, 0.28, 0.75], [3.7, 1.35, 0.18, 0.5], [4.6, 1.1, 0.27, 0.65], [5.5, 1.45, 0.12, 0.4], [0.9, 1.55, 0.08, 0.3]];
  leaves.forEach(([a, y, d, lift], i) => {
    const p = [Math.cos(a) * d, y, Math.sin(a) * d];
    r.add(mesh(tube(`monstera-stem${i}`, [[0, 0.5, 0], [Math.cos(a) * d * 0.4, (0.5 + y) / 2 + 0.1, Math.sin(a) * d * 0.4], p], 0.014), stem));
    leaf(r, lg, greens[i % 3], p, a, lift, 0.62 + (i % 3) * 0.06);
  });
  return finish(r, [0, 1.6, 0]);
};

function weaveTex(key, base, dark) {
  return paintTex(key, 256, 128, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      for (let x = 0; x < w; x += 16) {
        const flip = ((x + y) / 16) % 2;
        g.fillStyle = flip ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.14)';
        g.fillRect(x + 1, y + 1, 14, 14);
        g.strokeStyle = dark;
        g.lineWidth = 1.5;
        g.beginPath();
        if (flip) { g.moveTo(x + 2, y + 5); g.lineTo(x + 14, y + 5); g.moveTo(x + 2, y + 11); g.lineTo(x + 14, y + 11); } else { g.moveTo(x + 5, y + 2); g.lineTo(x + 5, y + 14); g.moveTo(x + 11, y + 2); g.lineTo(x + 11, y + 14); }
        g.stroke();
      }
    }
  });
}

const fiddleHalf = [[0, 0], [0.05, 0.02], [0.08, 0.08], [0.07, 0.14], [0.09, 0.2], [0.12, 0.27], [0.11, 0.33], [0.06, 0.37], [0, 0.38]];

D.fiddlefig = () => {
  const r = new THREE.Group();
  const basket = mat('#ffffff', { map: weaveTex('weave-seagrass', '#d6b98a', '#9a7a4a'), mapKey: 'weave-seagrass', r: 0.9 });
  r.add(mesh(lathe('fig-basket', [[0, 0], [0.19, 0], [0.22, 0.04], [0.25, 0.3], [0.26, 0.36], [0, 0.34]], 22), basket, 0, 0, 0));
  r.add(R(mesh(torus(0.255, 0.022, 6, 24), mat('#b89a6a', { r: 0.9 }), 0, 0.36, 0), Math.PI / 2));
  r.add(mesh(cyl(0.24, 0.24, 0.02, 20), mat('#4a3020'), 0, 0.34, 0));
  const bark = mat('#7a5a3e', { r: 0.9 });
  limb(r, [0, 0.34, 0], [0.04, 1.0, 0.02], 0.035, bark);
  limb(r, [0.04, 1.0, 0.02], [-0.02, 1.6, 0], 0.028, bark);
  limb(r, [-0.02, 1.6, 0], [0.02, 2.0, 0.02], 0.02, bark);
  limb(r, [0.04, 1.15, 0.02], [0.22, 1.45, 0.05], 0.016, bark);
  limb(r, [0, 1.35, 0], [-0.2, 1.62, -0.06], 0.015, bark);
  const lg = leafGeo('fiddle', fiddleHalf, 0.04, 0.05);
  const greens = [mat('#3b8a3e', { r: 0.35, side: DS }), mat('#4f9e48', { r: 0.35, side: DS }), mat('#2f7a36', { r: 0.35, side: DS })];
  const rnd = rng(8);
  for (let i = 0; i < 26; i++) {
    const t = i / 26, a = i * 2.4;
    const cx = Math.sin(t * 9) * 0.06, y = 1.0 + t * 1.05;
    const d = 0.05 + (1 - Math.abs(t - 0.45)) * 0.06;
    leaf(r, lg, greens[i % 3], [cx + Math.cos(a) * d, y, Math.sin(a) * d], a, 0.5 + rnd() * 0.6, 0.85 + (1 - t) * 0.35);
  }
  return finish(r, [0, 2.1, 0]);
};

const paddleHalf = [[0, 0], [0.04, 0.03], [0.075, 0.12], [0.085, 0.3], [0.075, 0.48], [0.04, 0.6], [0, 0.64]];

D.birdparadise = () => {
  const r = new THREE.Group();
  r.add(mesh(lathe('bop-pot', [[0, 0], [0.15, 0], [0.2, 0.06], [0.23, 0.22], [0.22, 0.36], [0.24, 0.38], [0, 0.36]], 22), mat('#2f6fb0', { r: 0.3 }), 0, 0, 0));
  r.add(mesh(cyl(0.22, 0.22, 0.02, 20), mat('#4a3020'), 0, 0.36, 0));
  const lg = leafGeo('paddle', paddleHalf, 0.05, 0.04);
  const greens = [mat('#3f8f45', { r: 0.45, side: DS }), mat('#4fa35a', { r: 0.45, side: DS })];
  const stem = mat('#5f9a4a', { r: 0.6 });
  const L = [[0.2, 0.95, 0.12], [1.3, 1.15, 0.1], [2.3, 0.9, 0.14], [3.3, 1.2, 0.1], [4.4, 1.0, 0.13], [5.4, 1.3, 0.08]];
  L.forEach(([a, h, d], i) => {
    const top = [Math.cos(a) * d, h, Math.sin(a) * d];
    limb(r, [0, 0.36, 0], top, 0.012, stem);
    leaf(r, lg, greens[i % 2], top, a, 1.15, 1.05);
  });
  const orange = mat('#ff8a1a', { r: 0.5 });
  const blue = mat('#3f6fe8', { r: 0.4 });
  const beak = mat('#4f7a3a', { r: 0.5 });
  for (const [a, h] of [[0.8, 1.15], [3.9, 1.05]]) {
    const x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08;
    limb(r, [0, 0.36, 0], [x, h, z], 0.012, stem);
    const f = new THREE.Group();
    f.position.set(x, h, z);
    f.rotation.y = -a;
    f.add(R(Sc(mesh(cone(0.035, 0.26, 8), beak, 0.12, 0.02, 0), 1, 1, 0.7), 0, 0, -Math.PI / 2 + 0.25));
    f.add(R(Sc(mesh(cone(0.03, 0.24, 6), mat('#b04a7a'), 0.08, -0.005, 0), 1, 1, 0.5), 0, 0, -Math.PI / 2 + 0.3));
    for (let k = 0; k < 4; k++) f.add(R(Sc(mesh(cone(0.03, 0.22, 6), orange, 0.05 + k * 0.025, 0.1, (k - 1.5) * 0.03), 1, 1, 0.45), (k - 1.5) * 0.25, 0, -0.35 - k * 0.12));
    f.add(R(Sc(mesh(cone(0.022, 0.18, 6), blue, 0.08, 0.08, 0), 1, 1, 0.5), 0, 0, -0.9));
    r.add(f);
  }
  return finish(r, [0, 1.6, 0]);
};

D.pampas = () => {
  const r = new THREE.Group();
  r.add(mesh(lathe('pampas-vase', [[0, 0], [0.12, 0], [0.17, 0.08], [0.19, 0.24], [0.15, 0.42], [0.08, 0.56], [0.075, 0.64], [0.095, 0.68], [0, 0.66]], 22), mat('#c8764a', { r: 0.75 }), 0, 0, 0));
  for (const y of [0.2, 0.26]) r.add(R(mesh(torus(0.188, 0.008, 4, 28), mat('#f1e6d2'), 0, y, 0), Math.PI / 2));
  const plumes = new THREE.Group();
  const stem = mat('#c9b48a', { r: 0.8 });
  const fluff = [mat('#f3e8d4', { r: 1 }), mat('#e8c9b2', { r: 1 }), mat('#dccaa6', { r: 1 })];
  const rnd = rng(13);
  for (let i = 0; i < 8; i++) {
    const a = i * 2.3, lean = 0.14 + (i % 3) * 0.08, h = 1.35 + rnd() * 0.45;
    const top = [Math.cos(a) * lean * 2, h, Math.sin(a) * lean * 2];
    limb(plumes, [0, 0.62, 0], top, 0.007, stem, 5);
    for (let k = 0; k < 7; k++) {
      const t = 0.62 + k * 0.055;
      const p = [top[0] * t * 1.1, 0.62 + (h - 0.62) * t + 0.05, top[2] * t * 1.1];
      plumes.add(Sc(mesh(sph(0.045, 8, 6), fluff[(i + k) % 3], ...p), 1, 2.4 - k * 0.15, 1));
    }
  }
  r.add(dynMerged(plumes));
  return finish(r, [0, 1.8, 0], { animate(t) { plumes.rotation.z = Math.sin(t * 1.1) * 0.025; plumes.rotation.x = Math.sin(t * 0.8 + 1) * 0.02; } });
};

const beanGeo = () => geo('beanbag', () => {
  const g = new THREE.SphereGeometry(0.4, 28, 18);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    y = Math.max(y * 0.7, -0.22);
    const sink = Math.exp(-((x - 0.02) ** 2 + (z - 0.06) ** 2) / 0.045) * 0.13;
    if (y > -0.1) y -= sink;
    const spread = 1 + Math.max(0, -y) * 0.35;
    p.setXYZ(i, x * spread, y + 0.22, z * spread);
  }
  g.computeVertexNormals();
  return g;
});

D.beanbags = () => {
  const r = new THREE.Group();
  const cols = [['#e3a23a', '#c98a24'], ['#2f9e9a', '#237f7c']];
  [-0.45, 0.47].forEach((x, i) => {
    const b = mesh(beanGeo(), mat(cols[i][0], { r: 0.95 }), x, 0, i ? 0.02 : -0.04);
    b.rotation.y = i ? -0.5 : 0.6;
    r.add(b);
    r.add(R(mesh(torus(0.05, 0.012, 6, 12), mat(cols[i][1]), x, 0.5, i ? 0.02 : -0.04), Math.PI / 2));
  });
  r.add(R(mesh(rbox(0.22, 0.03, 0.16, 0.01), mat('#e8463f', { r: 0.7 }), 0.0, 0.015, 0.3), 0, 0.4, 0));
  r.add(R(mesh(rbox(0.2, 0.025, 0.15, 0.01), mat('#f4efe6', { r: 0.7 }), 0.0, 0.04, 0.3), 0, 0.25, 0));
  r.add(mesh(cyl(0.045, 0.04, 0.09, 12), mat('#f6f2ea', { r: 0.4 }), -0.05, 0.045, 0.15));
  r.add(R(mesh(torus(0.025, 0.008, 6, 10), mat('#f6f2ea'), -0.005, 0.05, 0.15), 0, 0, 0));
  r.add(mesh(cyl(0.04, 0.04, 0.005, 12), mat('#6b3b1d'), -0.05, 0.088, 0.15));
  return finish(r, [0, 0.7, 0]);
};

D.velvetrope = () => {
  const r = new THREE.Group();
  const b = brass();
  for (const x of [-0.72, 0.72]) {
    r.add(mesh(cyl(0.15, 0.17, 0.04, 22), b, x, 0.02, 0));
    r.add(mesh(sph(0.15, 20, 10, 0, TAU, 0, Math.PI / 2), b, x, 0.03, 0));
    r.children[r.children.length - 1].scale.y = 0.35;
    r.add(mesh(cyl(0.026, 0.026, 0.86, 12), b, x, 0.5, 0));
    r.add(mesh(cyl(0.04, 0.04, 0.03, 14), b, x, 0.91, 0));
    r.add(mesh(sph(0.055, 14, 10), b, x, 0.97, 0));
    r.add(R(mesh(torus(0.022, 0.007, 6, 10), b, x - Math.sign(x) * 0.04, 0.86, 0), 0, Math.PI / 2, 0));
  }
  const pts = swag([-0.66, 0.85, 0], [0.66, 0.85, 0], 0.24, 16);
  r.add(mesh(tube('velvet-rope', pts, 0.034, { radial: 10 }), mat('#b0182e', { r: 0.85 })));
  for (const x of [-0.66, 0.66]) r.add(R(mesh(cyl(0.04, 0.04, 0.07, 12), b, x, 0.85, 0), 0, 0, Math.PI / 2 + Math.sign(x) * 0.5));
  return finish(r, [0, 1.05, 0]);
};

D.tiki = () => {
  const r = new THREE.Group();
  const rnd = rng(19);
  const stones = ['#9d988e', '#b8b3a8', '#8a847a', '#a39b90'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    r.add(Sc(mesh(ico(0.1, 0), mat(stones[i % 4], { flat: true, r: 0.9 }), Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2), 1.2, 0.6 + rnd() * 0.3, 1));
  }
  const wood = mat('#7a4a2a', { r: 0.8 });
  const dark = mat('#4a2c18', { r: 0.8 });
  r.add(mesh(cyl(0.12, 0.14, 1.3, 12), wood, 0, 0.65, 0));
  for (const y of [0.35, 0.72]) r.add(R(mesh(torus(0.125, 0.018, 6, 16), dark, 0, y, 0), Math.PI / 2));
  // carved face
  const fz = 0.11;
  r.add(mesh(rbox(0.28, 0.06, 0.08, 0.02), dark, 0, 1.17, fz));
  for (const s of [1, -1]) {
    r.add(Sc(mesh(sph(0.045, 10, 8), mat('#f6f0e0'), s * 0.065, 1.08, fz + 0.03), 1, 0.8, 0.5));
    r.add(mesh(sph(0.022, 8, 6), mat('#1d1a14'), s * 0.065, 1.08, fz + 0.055, false));
  }
  r.add(mesh(rbox(0.07, 0.12, 0.06, 0.02), wood, 0, 0.98, fz + 0.03));
  r.add(mesh(rbox(0.16, 0.05, 0.05, 0.015), wood, 0, 0.92, fz + 0.035));
  r.add(mesh(rbox(0.22, 0.12, 0.05, 0.03), dark, 0, 0.82, fz + 0.01));
  for (let i = 0; i < 5; i++) r.add(mesh(box(0.025, 0.04, 0.02), mat('#f6f0e0'), -0.07 + i * 0.035, 0.85, fz + 0.04, false));
  r.add(mesh(box(0.2, 0.03, 0.02), mat('#2fb3a6', { r: 0.6 }), 0, 0.62, fz + 0.03));
  r.add(mesh(box(0.2, 0.03, 0.02), mat('#e8463f', { r: 0.6 }), 0, 0.57, fz + 0.03));
  // bamboo pole and torch
  const bam = mat('#d8b56a', { r: 0.6 });
  r.add(mesh(cyl(0.045, 0.05, 0.55, 10), bam, 0, 1.56, 0));
  for (const y of [1.45, 1.66]) r.add(mesh(cyl(0.052, 0.052, 0.025, 10), mat('#b8934a'), 0, y, 0));
  r.add(mesh(cyl(0.1, 0.07, 0.2, 12), mat('#ffffff', { map: weaveTex('weave-torch', '#b8893c', '#7a5a2a'), mapKey: 'weave-torch', r: 0.9 }), 0, 1.92, 0));
  r.add(R(mesh(torus(0.1, 0.014, 6, 14), mat('#7a5a2a'), 0, 2.02, 0), Math.PI / 2));
  r.add(mesh(cyl(0.02, 0.02, 0.05, 8), mat('#2b2b2b'), 0, 2.05, 0));
  const fm = [umat('#ffe27a', { e: '#ffb020', ei: 2.2 }), umat('#ff8a3a', { e: '#ff5a1a', ei: 2 })];
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const f = dyn(mesh(cone(0.07 - i * 0.015, 0.26 - i * 0.04, 8), fm[i % 2], (i - 1) * 0.03, 2.2, (i % 2) * 0.02, false));
    r.add(f);
    flames.push(f);
  }
  const light = { y: 2.2, color: '#ff9a40', intensity: 3.5, distance: 3.5 };
  return finish(r, [0, 2.3, 0], {
    light,
    animate(t) {
      flames.forEach((f, i) => {
        const k = 0.8 + Math.sin(t * 10 + i * 2.1) * 0.15 + Math.sin(t * 16.3 + i) * 0.08;
        f.scale.set(1.1 - k * 0.2, k, 1.1 - k * 0.2);
        f.position.y = 2.08 + k * 0.12;
        f.rotation.z = Math.sin(t * 3 + i) * 0.08;
      });
      light.intensity = 3.2 + Math.sin(t * 11) * 0.4 + Math.sin(t * 17.7) * 0.3;
    },
  });
};

D.topiary = () => {
  const r = new THREE.Group();
  const white = mat('#f6f2ea', { r: 0.6 });
  r.add(mesh(rbox(0.62, 0.36, 0.62, 0.03), white, 0, 0.18, 0));
  for (const y of [0.04, 0.33]) r.add(mesh(rbox(0.66, 0.05, 0.66, 0.015), mat('#2f5f6f', { r: 0.6 }), 0, y, 0));
  r.add(mesh(box(0.56, 0.02, 0.56), mat('#5b3b25'), 0, 0.36, 0));
  const g1 = mat('#3f8f45', { flat: true, r: 0.85 }), g2 = mat('#5aa84a', { flat: true, r: 0.85 });
  r.add(Sc(mesh(ico(0.26, 1), g1, 0, 0.66, -0.04), 1, 0.9, 1.15));
  r.add(Sc(mesh(ico(0.17, 1), g2, 0, 0.95, 0.17), 1, 1, 1));
  r.add(mesh(ico(0.08, 1), g2, 0, 0.66, -0.36));
  for (const s of [1, -1]) {
    r.add(R(Sc(mesh(ico(0.07, 1), g1, s * 0.07, 1.2, 0.12), 0.7, 2.2, 0.55), -0.25, 0, -s * 0.18));
    r.add(Sc(mesh(ico(0.075, 1), g2, s * 0.12, 0.44, 0.2), 1, 0.7, 1.3));
    r.add(mesh(sph(0.018, 8, 6), mat('#1d1a14'), s * 0.07, 0.99, 0.31, false));
  }
  r.add(mesh(sph(0.02, 8, 6), mat('#ff8fa0'), 0, 0.94, 0.335, false));
  r.add(mesh(ico(0.05, 0), mat('#f6f0e0', { flat: true }), 0, 0.68, -0.43));
  const rnd = rng(29);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * TAU, b = rnd() * Math.PI;
    r.add(mesh(ico(0.035, 0), i % 2 ? g2 : mat('#2f7d45', { flat: true }), Math.cos(a) * Math.sin(b) * 0.26, 0.66 + Math.cos(b) * 0.23, -0.04 + Math.sin(a) * Math.sin(b) * 0.3, false));
  }
  for (let i = 0; i < 6; i++) flower(r, -0.22 + (i % 3) * 0.22, 0.4, i < 3 ? 0.22 : -0.22, ['#ff8fc0', '#ffffff', '#ffd23f'][i % 3], 0.045);
  return finish(r, [0, 1.4, 0]);
};

D.rockinghorse = () => {
  const r = new THREE.Group();
  const RR = 0.9;
  const horse = new THREE.Group();
  const wood = mat('#a0683a', { r: 0.55 });
  for (const x of [-0.2, 0.2]) {
    const arc = mesh(torus(RR, 0.028, 6, 30, 1.0), wood, 0, 0, 0);
    arc.rotation.z = -Math.PI / 2 - 0.5;
    const holder = new THREE.Group();
    holder.position.set(x, 0, 0);
    holder.rotation.y = Math.PI / 2;
    holder.add(arc);
    horse.add(holder);
  }
  for (const z of [-0.32, 0, 0.32]) horse.add(mesh(box(0.46, 0.035, 0.07), wood, 0, -RR + RR * (1 - Math.cos(Math.asin(z / RR))) + 0.04, z));
  const coat = mat('#efe9e0', { r: 0.6 });
  const dap = mat('#b9b3ac', { r: 0.6 });
  const yarn = mat('#6b3b22', { r: 0.95 });
  const y0 = -RR;
  for (const [x, z] of [[-0.09, -0.16], [0.09, -0.16], [-0.09, 0.16], [0.09, 0.16]]) limb(horse, [x, y0 + 0.58, z], [x * 2, y0 + 0.08, z * 1.7], 0.035, coat);
  horse.add(R(Sc(mesh(capsule(0.15, 0.32), coat, 0, y0 + 0.66, 0), 1, 1, 0.95), Math.PI / 2));
  for (let i = 0; i < 9; i++) horse.add(Sc(mesh(sph(0.035, 8, 6), dap, (i % 2 ? 0.13 : -0.13), y0 + 0.62 + (i % 3) * 0.05, -0.2 + i * 0.05, false), 0.4, 1, 1));
  limb(horse, [0, y0 + 0.72, 0.2], [0, y0 + 0.98, 0.32], 0.09, coat);
  horse.add(R(Sc(mesh(capsule(0.085, 0.16), coat, 0, y0 + 1.0, 0.42), 0.9, 1, 1), 1.2));
  horse.add(R(mesh(capsule(0.06, 0.06), mat('#d8cfc4', { r: 0.6 }), 0, y0 + 0.93, 0.53), 1.3));
  for (const s of [1, -1]) {
    horse.add(R(mesh(cone(0.03, 0.09, 6), coat, s * 0.045, y0 + 1.12, 0.36), -0.3, 0, -s * 0.2));
    horse.add(mesh(sph(0.018, 8, 6), mat('#1d1a14'), s * 0.072, y0 + 1.04, 0.45, false));
  }
  limb(horse, [-0.13, y0 + 1.0, 0.43], [0.13, y0 + 1.0, 0.43], 0.014, mat('#5e3a22'));
  for (const s of [1, -1]) horse.add(mesh(sph(0.028, 8, 6), mat('#e8463f'), s * 0.14, y0 + 1.0, 0.43));
  for (let i = 0; i < 7; i++) horse.add(Sc(mesh(sph(0.04, 8, 6), yarn, 0, y0 + 0.78 + i * 0.045, 0.2 + i * 0.03, false), 0.8, 1, 1.2));
  for (let i = 0; i < 5; i++) limb(horse, [0, y0 + 0.7, -0.28], [(i - 2) * 0.03, y0 + 0.36, -0.38 - (i % 2) * 0.04], 0.018, yarn, 5);
  horse.add(mesh(rbox(0.32, 0.05, 0.26, 0.03), mat('#c8302c', { r: 0.5 }), 0, y0 + 0.8, -0.02));
  horse.add(mesh(rbox(0.34, 0.012, 0.28, 0.006), gold(), 0, y0 + 0.775, -0.02));
  for (const s of [1, -1]) {
    limb(horse, [s * 0.15, y0 + 0.78, -0.02], [s * 0.17, y0 + 0.52, -0.02], 0.006, mat('#3b2a20'));
    horse.add(R(mesh(torus(0.03, 0.007, 6, 12), gold(), s * 0.17, y0 + 0.5, -0.02), 0, Math.PI / 2, 0));
  }
  r.add(dynMerged(horse));
  horse.position.y = RR;
  return finish(r, [0, 1.25, 0], {
    animate(t) {
      const a = Math.sin(t * 1.7) * 0.12;
      horse.rotation.x = a;
      horse.position.z = RR * a;
    },
  });
};

function screenTex() {
  return paintTex('rice-paper', 128, 192, (g, w, h) => {
    g.fillStyle = '#f6efdc';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,130,80,0.18)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#6f8a4a';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(30, h); g.lineTo(36, 20); g.stroke();
    g.fillStyle = '#6f9a4a';
    for (const [x, y, a] of [[36, 50, -0.6], [36, 80, 0.7], [36, 110, -0.5], [36, 30, 0.5]]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(22, 0, 24, 6, 0, 0, TAU); g.fill(); g.restore(); }
    g.fillStyle = '#e8463f';
    g.beginPath(); g.arc(96, 36, 12, 0, TAU); g.fill();
  });
}

D.bamboo = () => {
  const r = new THREE.Group();
  const bam = mat('#d8b56a', { r: 0.55 });
  const node = mat('#b8934a', { r: 0.6 });
  const paper = mat('#ffffff', { map: screenTex(), mapKey: 'rice-paper', r: 0.9, side: DS });
  [-0.535, 0, 0.535].forEach((x, i) => {
    const p = new THREE.Group();
    p.position.set(x, 0, 0);
    p.rotation.y = i % 2 ? 0.3 : -0.3;
    for (const s of [1, -1]) {
      p.add(mesh(cyl(0.028, 0.03, 1.78, 10), bam, s * 0.25, 0.9, 0));
      for (let k = 0; k < 5; k++) p.add(mesh(cyl(0.033, 0.033, 0.02, 10), node, s * 0.25, 0.2 + k * 0.36, 0));
      p.add(mesh(sph(0.032, 8, 6), node, s * 0.25, 1.8, 0));
    }
    for (const y of [0.08, 0.98, 1.72]) p.add(R(mesh(cyl(0.022, 0.022, 0.5, 8), bam, 0, y, 0), 0, 0, Math.PI / 2));
    for (let k = 0; k < 9; k++) {
      p.add(mesh(cyl(0.017, 0.017, 0.88, 8), k % 2 ? bam : mat('#cfa95c', { r: 0.55 }), -0.2 + k * 0.05, 0.53, 0));
      p.add(mesh(cyl(0.02, 0.02, 0.015, 8), node, -0.2 + k * 0.05, 0.4 + (k % 3) * 0.12, 0));
    }
    p.add(mesh(plane(0.47, 0.72), paper, 0, 1.35, 0, false));
    r.add(p);
  });
  return finish(r, [0, 1.9, 0]);
};

D.twinkletree = () => {
  const r = new THREE.Group();
  r.add(mesh(rbox(0.46, 0.3, 0.46, 0.03), mat('#c8302c', { r: 0.6 }), 0, 0.15, 0));
  for (const y of [0.05, 0.25]) r.add(mesh(rbox(0.48, 0.03, 0.48, 0.01), gold(), 0, y, 0));
  r.add(mesh(cyl(0.05, 0.06, 0.2, 8), mat('#6b4a32'), 0, 0.38, 0));
  const tiers = [[0.52, 0.62, 0.42], [0.42, 0.55, 0.78], [0.31, 0.5, 1.1], [0.19, 0.42, 1.38]];
  const pine = mat('#2f6f45', { flat: true, r: 0.8 });
  const pine2 = mat('#3f8a52', { flat: true, r: 0.8 });
  tiers.forEach(([rad, h, y], i) => r.add(mesh(cone(rad, h, 10), i % 2 ? pine2 : pine, 0, y + h / 2, 0)));
  const bulbM = ['#ff4f6d', '#ffd23f', '#3fb6ff', '#ff8fd8'].map((c) => umat('#ffffff', { e: c, ei: 1.8 }));
  const bead = gold();
  let k = 0;
  tiers.forEach(([rad, h, y], ti) => {
    const n = 9 - ti * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ti * 0.7, f = 0.15 + (i % 2) * 0.25;
      const rr = rad * (1 - f) + 0.02;
      r.add(mesh(sph(0.032, 8, 6), bulbM[k++ % 4], Math.cos(a) * rr, y + h * f, Math.sin(a) * rr, false));
    }
  });
  for (let i = 0; i < 46; i++) {
    const t = i / 46, y = 0.5 + t * 1.25;
    const rad = 0.5 * (1 - t) + 0.05, a = t * TAU * 3.2;
    r.add(mesh(sph(0.016, 6, 5), bead, Math.cos(a) * rad, y, Math.sin(a) * rad, false));
  }
  const star = dyn(new THREE.Group());
  star.position.set(0, 1.9, 0);
  const sg = geo('star-shape', () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + Math.PI / 2, rr = i % 2 ? 0.05 : 0.12; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 });
    g.translate(0, 0, -0.02);
    return g;
  });
  star.add(mesh(sg, mat('#ffe066', { e: '#ffc21a', ei: 1.2, r: 0.3, m: 0.4 }), 0, 0, 0, false));
  r.add(star);
  for (const [x, z, w, c, rib] of [[0.3, 0.26, 0.2, '#3fb6ff', '#ffffff'], [-0.28, 0.3, 0.16, '#ffd23f', '#e8343f'], [0.05, 0.36, 0.13, '#ff8fd8', '#ffd23f']]) {
    r.add(mesh(rbox(w, w * 0.8, w, 0.015), mat(c, { r: 0.5 }), x, w * 0.4, z));
    r.add(mesh(box(w + 0.01, w * 0.8 + 0.01, 0.03), mat(rib), x, w * 0.4, z));
    r.add(mesh(box(0.03, w * 0.8 + 0.01, w + 0.01), mat(rib), x, w * 0.4, z));
    r.add(Sc(mesh(torus(0.03, 0.01, 6, 10), mat(rib), x, w * 0.8 + 0.02, z), 1, 1, 0.6));
  }
  const light = { y: 1.2, color: '#ffd28a', intensity: 3, distance: 3.5 };
  return finish(r, [0, 2.0, 0], {
    light,
    animate(t) {
      bulbM.forEach((m, i) => { m.emissiveIntensity = 0.5 + Math.max(0, Math.sin(t * 2.2 + i * 1.6)) * 2; });
      star.rotation.y = t * 0.8;
    },
  });
};

D.teddy = () => {
  const r = new THREE.Group();
  const fur = mat('#b0773f', { r: 0.95 });
  const pale = mat('#ecd3ae', { r: 0.95 });
  const dark = mat('#2b1d14', { r: 0.3 });
  r.add(Sc(mesh(sph(0.34, 22, 16), fur, 0, 0.4, -0.05), 1, 1.12, 0.9));
  r.add(Sc(mesh(sph(0.22, 18, 12), pale, 0, 0.38, 0.17), 1, 1.15, 0.5));
  for (const s of [1, -1]) {
    r.add(R(Sc(mesh(capsule(0.12, 0.2), fur, s * 0.2, 0.13, 0.2), 1, 1, 1), Math.PI / 2 - 0.15, 0, 0));
    r.add(Sc(mesh(sph(0.1, 14, 10), pale, s * 0.2, 0.13, 0.36), 1, 1, 0.4));
    limb(r, [s * 0.28, 0.6, 0.0], [s * 0.36, 0.3, 0.18], 0.1, fur);
    r.add(mesh(sph(0.1, 12, 10), fur, s * 0.36, 0.28, 0.2));
    r.add(Sc(mesh(sph(0.07, 12, 8), pale, s * 0.38, 0.27, 0.27), 1, 1, 0.5));
  }
  const head = new THREE.Group();
  head.position.set(0, 0.96, 0.02);
  head.add(mesh(sph(0.27, 22, 16), fur, 0, 0, 0));
  head.add(Sc(mesh(sph(0.12, 16, 12), pale, 0, -0.06, 0.22), 1.15, 0.85, 0.75));
  head.add(Sc(mesh(sph(0.05, 12, 8), dark, 0, -0.02, 0.31), 1.3, 0.85, 0.8));
  head.add(R(mesh(box(0.012, 0.05, 0.01), dark, 0, -0.08, 0.3, false), 0, 0, 0));
  for (const s of [1, -1]) {
    head.add(mesh(sph(0.035, 10, 8), dark, s * 0.1, 0.06, 0.23));
    head.add(mesh(sph(0.01, 6, 5), mat('#ffffff'), s * 0.1 + 0.012, 0.075, 0.26, false));
    head.add(Sc(mesh(sph(0.1, 14, 10), fur, s * 0.2, 0.2, -0.02), 1, 1, 0.55));
    head.add(Sc(mesh(sph(0.06, 12, 8), pale, s * 0.2, 0.2, 0.02), 1, 1, 0.4));
    head.add(Sc(mesh(sph(0.04, 10, 8), mat('#ff9aa0', { r: 0.9 }), s * 0.17, -0.06, 0.2), 1, 0.6, 0.4));
  }
  r.add(dynMerged(head));
  const red = mat('#d6283a', { r: 0.5 });
  for (const s of [1, -1]) r.add(R(Sc(mesh(cone(0.08, 0.16, 10), red, s * 0.09, 0.73, 0.26), 1, 1, 0.5), 0, 0, s * Math.PI / 2));
  r.add(mesh(sph(0.045, 10, 8), red, 0, 0.73, 0.27));
  r.add(R(mesh(torus(0.2, 0.02, 6, 24), red, 0, 0.74, 0.04), Math.PI / 2 + 0.2));
  return finish(r, [0, 1.3, 0], {
    animate(t) {
      const k = (t * 0.12) % 1;
      head.rotation.z = k > 0.8 ? Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.18 : 0;
      head.rotation.x = Math.sin(t * 1.4) * 0.03;
    },
  });
};

D.eggchair = () => {
  const r = new THREE.Group();
  const metal = mat('#2b2b30', { r: 0.4, m: 0.5 });
  r.add(mesh(cyl(0.3, 0.33, 0.05, 24), metal, 0, 0.025, -0.05));
  r.add(mesh(tube('egg-stand', [[0, 0.05, -0.3], [0, 0.9, -0.38], [0, 1.7, -0.36], [0, 2.05, -0.18], [0, 2.1, 0.02]], 0.035, { radial: 8 }), metal));
  r.add(mesh(sph(0.04, 8, 6), metal, 0, 2.1, 0.02));
  const swing = new THREE.Group();
  const SY = 2.06;
  swing.add(mesh(cyl(0.012, 0.012, 0.32, 6), chrome(), 0, -0.16, 0.02));
  for (let i = 0; i < 4; i++) swing.add(R(mesh(torus(0.022, 0.006, 4, 8), chrome(), 0, -0.04 - i * 0.07, 0.02), 0, i % 2 ? Math.PI / 2 : 0, 0));
  const rattan = mat('#ffffff', { map: weaveTex('weave-rattan', '#c99a5a', '#8a5e2e'), mapKey: 'weave-rattan', r: 0.85, side: DS });
  const gap = 0.36;
  const shell = mesh(geo('egg-shell', () => new THREE.SphereGeometry(0.42, 28, 18, Math.PI / 2 + gap * Math.PI, TAU - 2 * gap * Math.PI, 0.18, Math.PI - 0.18)), rattan, 0, -1.0, 0);
  shell.scale.set(1, 1.3, 1);
  swing.add(shell);
  swing.add(R(mesh(torus(0.13, 0.02, 6, 16), mat('#8a5e2e'), 0, -0.47, 0), Math.PI / 2));
  swing.add(Sc(mesh(sph(0.34, 18, 12), mat('#f4efe6', { r: 0.95 }), 0, -1.38, 0.0), 1, 0.3, 0.95));
  swing.add(R(Sc(mesh(sph(0.3, 18, 12), mat('#f4efe6', { r: 0.95 }), 0, -0.95, -0.22), 1, 1.2, 0.35), -0.2));
  swing.add(R(Sc(mesh(sph(0.13, 12, 10), mat('#e3a23a', { r: 0.9 }), 0.12, -1.22, -0.06), 1, 1, 0.45), -0.4, -0.3, 0.3));
  swing.add(R(Sc(mesh(sph(0.11, 12, 10), mat('#2f9e9a', { r: 0.9 }), -0.14, -1.24, -0.04), 1, 1, 0.45), -0.4, 0.4, -0.2));
  swing.position.set(0, SY, 0.02);
  r.add(dynMerged(swing));
  return finish(r, [0, 2.15, 0], {
    animate(t) {
      swing.rotation.z = Math.sin(t * 0.9) * 0.035;
      swing.rotation.x = Math.sin(t * 0.7 + 1) * 0.03;
      swing.rotation.y = Math.sin(t * 0.4) * 0.12;
    },
  });
};

// ---------------------------------------------------------------------------- showpieces

function signGlow(key, text, bg, fg, w = 256, h = 80) {
  return glowMat(paintTex(key, w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${Math.round(h * 0.66)}px ${SIGN_FONT}`;
    g.lineWidth = 8;
    g.strokeStyle = '#1d1a2f';
    g.strokeText(text, w / 2, h / 2 + 3);
    g.fillStyle = fg;
    g.fillText(text, w / 2, h / 2 + 3);
  }), 0.55);
}

// Little plush prize: a round head with ears
function plush(root, x, y, z, color, kind, s = 1) {
  const m = mat(color, { r: 0.95 });
  root.add(mesh(sph(0.075 * s, 12, 10), m, x, y, z));
  if (kind === 'bunny') for (const k of [1, -1]) root.add(R(Sc(mesh(capsule(0.022 * s, 0.07 * s), m, x + k * 0.03 * s, y + 0.1 * s, z), 1, 1, 0.6), 0, 0, -k * 0.2));
  else for (const k of [1, -1]) root.add(mesh(sph(0.03 * s, 8, 6), m, x + k * 0.055 * s, y + 0.055 * s, z));
  root.add(mesh(sph(0.012 * s, 6, 5), mat('#1d1a14'), x - 0.025 * s, y + 0.01 * s, z + 0.068 * s, false));
  root.add(mesh(sph(0.012 * s, 6, 5), mat('#1d1a14'), x + 0.025 * s, y + 0.01 * s, z + 0.068 * s, false));
}

D.clawmachine = (def) => {
  const r = new THREE.Group();
  const pink = mat('#ff6fae', { r: 0.4 });
  const teal = mat('#2fc4c0', { r: 0.4 });
  r.add(mesh(rbox(0.86, 0.86, 0.86, 0.05), pink, 0, 0.43, 0));
  r.add(mesh(box(0.88, 0.06, 0.88), teal, 0, 0.06, 0));
  r.add(mesh(rbox(0.3, 0.26, 0.04, 0.02), mat('#1d1a2f'), -0.2, 0.42, 0.43));
  r.add(mesh(rbox(0.24, 0.2, 0.02, 0.02), mat('#3a3550'), -0.2, 0.42, 0.45));
  r.add(mesh(rbox(0.86, 0.1, 0.3, 0.03), teal, 0, 0.88, 0.33));
  r.add(mesh(cyl(0.025, 0.03, 0.02, 12), mat('#1d1a2f'), 0.15, 0.94, 0.38));
  limb(r, [0.15, 0.94, 0.38], [0.15, 1.03, 0.36], 0.01, chrome());
  r.add(mesh(sph(0.03, 10, 8), mat('#e8343f', { r: 0.3 }), 0.15, 1.04, 0.36));
  r.add(mesh(cyl(0.035, 0.035, 0.03, 14), mat('#ffd23f', { r: 0.3, e: '#ffb000', ei: 0.4 }), 0.3, 0.94, 0.38));
  r.add(mesh(rbox(0.12, 0.05, 0.012, 0.01), mat('#2b2b2b'), 0.22, 0.6, 0.433));
  // glass box with prizes
  for (const x of [-0.41, 0.41]) for (const z of [-0.41, 0.41]) r.add(mesh(box(0.05, 0.9, 0.05), pink, x, 1.31, z));
  const cols = ['#ffd23f', '#8fd16a', '#ff9ab8', '#3fb6ff', '#b98cff', '#ff8a3a', '#ffffff', '#e8c9a0'];
  const rnd = rng(41);
  r.add(mesh(box(0.78, 0.04, 0.78), mat('#3a3550'), 0, 0.88, 0));
  for (let i = 0; i < 16; i++) {
    const x = -0.3 + (i % 4) * 0.2 + (rnd() - 0.5) * 0.06, z = -0.3 + Math.floor(i / 4) * 0.2 + (rnd() - 0.5) * 0.06;
    if (x < -0.15 && z > 0.12) continue;
    plush(r, x, 0.97 + (i % 3) * 0.04, z, cols[i % cols.length], i % 3 ? 'bear' : 'bunny', 1.1);
  }
  r.add(see(mesh(box(0.2, 0.2, 0.2), glass('#ffffff', 0.3), -0.28, 0.98, 0.28, false)));
  r.add(see(mesh(box(0.8, 0.86, 0.8), glass('#eaf7ff', 0.18), 0, 1.31, 0, false)));
  // marquee header
  r.add(mesh(rbox(0.9, 0.3, 0.9, 0.05), pink, 0, 1.88, 0));
  r.add(mesh(plane(0.7, 0.2), signGlow('sign-claw', 'CLAW!', '#ffd23f', '#ff3f8a'), 0, 1.88, 0.452, false));
  r.add(R(mesh(plane(0.7, 0.2), signGlow('sign-claw', 'CLAW!', '#ffd23f', '#ff3f8a'), 0.452, 1.88, 0, false), 0, Math.PI / 2, 0));
  const bulbs = [umat('#fff6d0', { e: '#ffcf40', ei: 2 }), umat('#ffe0f0', { e: '#ff5fb0', ei: 2 })];
  for (let i = 0; i < 8; i++) {
    r.add(mesh(sph(0.025, 8, 6), bulbs[i % 2], -0.39 + i * 0.111, 2.045, 0.43, false));
    r.add(mesh(sph(0.025, 8, 6), bulbs[(i + 1) % 2], 0.43, 2.045, -0.39 + i * 0.111, false));
  }
  // gantry and claw
  for (const z of [-0.36, 0.36]) r.add(R(mesh(cyl(0.012, 0.012, 0.76, 8), chrome(), 0, 1.7, z), 0, 0, Math.PI / 2));
  const bridge = dyn(new THREE.Group());
  bridge.position.y = 1.7;
  bridge.add(R(mesh(cyl(0.012, 0.012, 0.74, 8), chrome(), 0, 0, 0), Math.PI / 2));
  const carriage = new THREE.Group();
  carriage.add(mesh(box(0.08, 0.05, 0.08), mat('#3a3550'), 0, -0.01, 0));
  const cable = mesh(cyl(0.005, 0.005, 1, 4), mat('#2b2b2b'), 0, 0, 0, false);
  carriage.add(cable);
  const claw = new THREE.Group();
  claw.add(mesh(cyl(0.035, 0.045, 0.05, 12), chrome(), 0, 0, 0));
  const prongs = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Group();
    p.rotation.y = (i / 3) * TAU;
    const arm = new THREE.Group();
    arm.position.set(0.03, -0.02, 0);
    limb(arm, [0, 0, 0], [0.05, -0.07, 0], 0.008, chrome());
    limb(arm, [0.05, -0.07, 0], [0.02, -0.13, 0], 0.008, chrome());
    p.add(arm);
    claw.add(p);
    prongs.push(arm);
  }
  carriage.add(claw);
  bridge.add(carriage);
  r.add(bridge);
  const light = { y: 1.5, color: '#ff7ac8', intensity: 2.8, distance: 3 };
  return finish(r, [0, 2.1, 0], {
    light,
    animate(t) {
      const T = t % 8;
      const dx = Math.sin(t * 0.37) * 0.24, dz = Math.cos(t * 0.29) * 0.2;
      let drop = 0, open = 0.6;
      if (T < 3) { bridge.position.z = dz * (T / 3); carriage.position.x = dx * (T / 3); }
      else if (T < 5) { const k = (T - 3) / 2; drop = Math.sin(k * Math.PI) * 0.55; open = k < 0.5 ? 0.6 : 0; bridge.position.z = dz; carriage.position.x = dx; }
      else { const k = (T - 5) / 3; open = 0; bridge.position.z = dz * (1 - k) + 0.28 * k; carriage.position.x = dx * (1 - k) - 0.28 * k; if (k > 0.9) open = 0.6; }
      claw.position.y = -0.08 - drop;
      cable.scale.y = 0.08 + drop;
      cable.position.y = -(0.08 + drop) / 2;
      for (const a of prongs) a.rotation.z = open * 0.6 - 0.2;
      const blink = Math.floor(t * 3) % 2;
      bulbs[0].emissiveIntensity = blink ? 2.2 : 0.6;
      bulbs[1].emissiveIntensity = blink ? 0.6 : 2.2;
    },
  });
};

D.recordplayer = () => {
  const r = new THREE.Group();
  const walnut = mat('#7a4a2a', { r: 0.45 });
  for (const [x, z] of [[-0.34, -0.18], [0.34, -0.18], [-0.34, 0.18], [0.34, 0.18]]) limb(r, [x * 0.9, 0.3, z * 0.9], [x, 0, z * 1.1], 0.022, mat('#4a2c18'));
  r.add(mesh(rbox(0.84, 0.46, 0.5, 0.03), walnut, 0, 0.53, 0));
  const grille = mat('#ffffff', { map: weaveTex('weave-grille', '#d9c7a4', '#a8916a'), mapKey: 'weave-grille', r: 0.95 });
  r.add(mesh(plane(0.34, 0.34), grille, -0.2, 0.53, 0.252, false));
  r.add(mesh(rbox(0.36, 0.36, 0.02, 0.01), mat('#5e3a22'), -0.2, 0.53, 0.243));
  for (let i = 0; i < 3; i++) r.add(R(mesh(cyl(0.03, 0.03, 0.03, 14), brass(), 0.14 + i * 0.09, 0.62, 0.26), Math.PI / 2));
  for (let i = 0; i < 5; i++) r.add(mesh(box(0.025, 0.2, 0.33), mat(['#e8463f', '#2f8cf0', '#ffbb1f', '#2fbf5f', '#1d1a2f'][i], { r: 0.6 }), 0.13 + i * 0.045, 0.45, 0.06));
  // turntable
  r.add(mesh(rbox(0.6, 0.06, 0.44, 0.02), mat('#5e3a22', { r: 0.4 }), 0.05, 0.79, 0));
  r.add(mesh(cyl(0.19, 0.19, 0.025, 28), chrome(), -0.02, 0.83, 0));
  const disc = dyn(new THREE.Group());
  disc.position.set(-0.02, 0.85, 0);
  disc.add(mesh(cyl(0.18, 0.18, 0.012, 32), mat('#18161c', { r: 0.25 }), 0, 0, 0));
  for (let i = 0; i < 3; i++) disc.add(R(mesh(torus(0.15 - i * 0.03, 0.002, 3, 32), mat('#3a3640', { r: 0.2 }), 0, 0.007, 0, false), Math.PI / 2));
  disc.add(mesh(cyl(0.06, 0.06, 0.014, 20), mat('#e8463f', { r: 0.5 }), 0, 0.001, 0));
  disc.add(mesh(box(0.06, 0.016, 0.012), mat('#ffd23f'), 0.02, 0.001, 0, false));
  r.add(dynMerged(disc));
  r.add(mesh(cyl(0.035, 0.035, 0.04, 12), chrome(), 0.27, 0.84, -0.12));
  limb(r, [0.27, 0.87, -0.12], [0.24, 0.87, 0.1], 0.008, chrome());
  limb(r, [0.24, 0.87, 0.1], [0.12, 0.865, 0.12], 0.008, chrome());
  r.add(mesh(box(0.04, 0.02, 0.03), mat('#1d1a2f'), 0.11, 0.86, 0.12));
  // lid propped open
  const lid = see(mesh(rbox(0.6, 0.02, 0.44, 0.01), glass('#c8d0d8', 0.3), 0.05, 1.0, -0.36, false));
  lid.rotation.x = -1.2;
  r.add(lid);
  const notes = [];
  const noteM = mat('#1d1a2f', { r: 0.4 });
  for (let i = 0; i < 2; i++) {
    const n = new THREE.Group();
    n.add(Sc(mesh(sph(0.03, 10, 8), noteM, 0, 0, 0), 1.2, 0.9, 0.6));
    n.add(mesh(box(0.008, 0.1, 0.008), noteM, 0.03, 0.05, 0));
    n.add(R(mesh(box(0.04, 0.012, 0.008), noteM, 0.045, 0.095, 0), 0, 0, -0.5));
    const g = dynMerged(n);
    r.add(g);
    notes.push(g);
  }
  return finish(r, [0, 1.2, 0], {
    animate(t) {
      disc.rotation.y = -t * 3.5;
      notes.forEach((n, i) => {
        const p = (t * 0.35 + i * 0.5) % 1;
        n.position.set(-0.05 + Math.sin(p * 6 + i) * 0.08, 0.95 + p * 0.7, 0.05);
        n.scale.setScalar(Math.sin(p * Math.PI) * 1.2 + 0.01);
        n.rotation.z = Math.sin(p * 8) * 0.3;
      });
    },
  });
};

function photoStripTex() {
  return paintTex('photo-strip', 64, 224, (g, w, h) => {
    g.fillStyle = '#fbfaf5';
    g.fillRect(0, 0, w, h);
    const bgs = ['#ffb3c6', '#9fd8ff', '#ffe27a', '#b8f08a'];
    for (let i = 0; i < 4; i++) {
      const y = 6 + i * 53;
      g.fillStyle = bgs[i];
      g.fillRect(6, y, w - 12, 47);
      g.fillStyle = ['#f5c49c', '#c68a5a', '#ffd9b8', '#9a6440'][i];
      g.beginPath(); g.arc(32, y + 22, 12, 0, TAU); g.fill();
      g.fillRect(18, y + 34, 28, 13);
      g.fillStyle = '#1d1a14';
      g.fillRect(26, y + 19, 3, 3); g.fillRect(35, y + 19, 3, 3);
      g.strokeStyle = '#1d1a14'; g.lineWidth = 2;
      g.beginPath(); g.arc(32, y + 25, 5, 0.2, Math.PI - 0.2); g.stroke();
      if (i === 1) { g.fillStyle = '#e8343f'; g.fillRect(20, y + 4, 24, 7); }
      if (i === 3) { g.strokeStyle = '#1d1a2f'; g.lineWidth = 3; g.strokeRect(22, y + 16, 9, 7); g.strokeRect(33, y + 16, 9, 7); }
    }
  });
}

D.photobooth = () => {
  const r = new THREE.Group();
  const body = mat('#2fa39c', { r: 0.45 });
  const trim = mat('#ffd23f', { r: 0.4 });
  r.add(mesh(rbox(0.9, 2.0, 0.9, 0.04), body, 0, 1.0, 0));
  r.add(mesh(box(0.92, 0.08, 0.92), mat('#1d6f6a'), 0, 0.04, 0));
  r.add(mesh(rbox(0.94, 0.06, 0.94, 0.02), trim, 0, 2.02, 0));
  // curtain doorway on the front
  r.add(mesh(box(0.52, 1.5, 0.02), mat('#1d1a2f'), -0.15, 0.95, 0.448));
  r.add(R(mesh(cyl(0.012, 0.012, 0.58, 8), brass(), -0.15, 1.72, 0.48), 0, 0, Math.PI / 2));
  const red = [mat('#c8203a', { r: 0.85 }), mat('#a8162e', { r: 0.85 })];
  for (let i = 0; i < 9; i++) r.add(Sc(mesh(cyl(0.035, 0.04, 1.42, 8), red[i % 2], -0.37 + i * 0.045, 0.99, 0.47), 1, 1, 0.8));
  r.add(R(mesh(torus(0.04, 0.012, 6, 12), trim, -0.05, 1.05, 0.5), 0, 0, 0));
  // side panel: sign, slot and photo strips
  r.add(mesh(rbox(0.22, 0.5, 0.03, 0.02), mat('#1d1a2f'), 0.3, 1.2, 0.455));
  r.add(mesh(plane(0.18, 0.44), mat('#ffffff', { map: photoStripTex(), mapKey: 'photo-strip', r: 0.6 }), 0.3, 1.2, 0.472, false));
  r.add(mesh(box(0.16, 0.02, 0.02), mat('#2b2b2b'), 0.3, 0.75, 0.455));
  r.add(mesh(rbox(0.24, 0.2, 0.03, 0.02), trim, 0.3, 0.55, 0.455));
  const strip = mat('#ffffff', { map: photoStripTex(), mapKey: 'photo-strip', r: 0.6 });
  [[0.452, 1.2, -0.25, 0.08], [0.452, 1.15, 0.0, -0.06], [0.452, 1.22, 0.25, 0.1]].forEach(([x, y, z, a]) => {
    const p = mesh(plane(0.13, 0.46), strip, x, y, z, false);
    p.rotation.set(0, Math.PI / 2, a);
    r.add(p);
    r.add(mesh(sph(0.015, 6, 5), mat('#e8343f'), x + 0.01, y + 0.22, z, false));
  });
  r.add(R(mesh(plane(0.8, 0.22), signGlow('sign-photo', 'PHOTOS', '#ff4f8a', '#ffffff'), 0.452, 1.82, 0, false), 0, Math.PI / 2, 0));
  r.add(mesh(plane(0.8, 0.22), signGlow('sign-photo', 'PHOTOS', '#ff4f8a', '#ffffff'), 0, 1.86, 0.452, false));
  // flash on top
  r.add(mesh(rbox(0.26, 0.16, 0.14, 0.02), mat('#1d1a2f'), 0.15, 2.13, 0.25));
  const flash = umat('#ffffff', { e: '#ffffff', ei: 0.3 });
  r.add(mesh(box(0.2, 0.1, 0.01), flash, 0.15, 2.13, 0.322, false));
  const stars = umat('#fff6d0', { e: '#ffe066', ei: 1.5 });
  for (const [x, y] of [[-0.35, 1.9], [0.35, 1.75]]) {
    r.add(mesh(box(0.012, 0.08, 0.01), stars, x, y, 0.465, false));
    r.add(mesh(box(0.08, 0.012, 0.01), stars, x, y, 0.465, false));
  }
  const light = { y: 2.0, color: '#ffffff', intensity: 0, distance: 4 };
  return finish(r, [0, 2.3, 0], {
    light,
    animate(t) {
      const k = (t / 5) % 1;
      const f = k < 0.04 ? 1 - k / 0.04 : (k > 0.12 && k < 0.16 ? 1 - (k - 0.12) / 0.04 : 0);
      flash.emissiveIntensity = 0.3 + f * 4;
      light.intensity = f * 9;
      stars.emissiveIntensity = 1 + Math.sin(t * 4) * 0.6;
    },
  });
};

function bobaCup(root, x, y, z, s, tea, lid = '#ffffff', straw = '#ff6fae') {
  root.add(mesh(cyl(0.085 * s, 0.065 * s, 0.24 * s, 16), mat(tea, { r: 0.3 }), x, y + 0.12 * s, z));
  root.add(mesh(cyl(0.088 * s, 0.088 * s, 0.03 * s, 16), mat('#f4f8fa', { r: 0.15 }), x, y + 0.225 * s, z));
  const pearl = mat('#2b1a14', { r: 0.25 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    root.add(mesh(sph(0.018 * s, 6, 5), pearl, x + Math.cos(a) * 0.066 * s, y + (0.025 + (i % 2) * 0.03) * s, z + Math.sin(a) * 0.066 * s, false));
  }
  root.add(mesh(sph(0.088 * s, 16, 8, 0, TAU, 0, Math.PI / 2), mat(lid, { r: 0.2 }), x, y + 0.24 * s, z));
  root.add(R(mesh(cyl(0.016 * s, 0.016 * s, 0.24 * s, 8), mat(straw, { r: 0.4 }), x + 0.02 * s, y + 0.38 * s, z), 0, 0, -0.2));
}

D.bobacart = () => {
  const r = new THREE.Group();
  const mint = mat('#9fe0c8', { r: 0.5 });
  const wood = mat('#c99a63', { r: 0.6 });
  r.add(mesh(rbox(1.5, 0.66, 0.6, 0.04), mint, 0, 0.55, 0));
  for (let i = 0; i < 7; i++) r.add(mesh(box(0.012, 0.56, 0.01), mat('#7fc8ae'), -0.6 + i * 0.2, 0.55, 0.302, false));
  r.add(mesh(rbox(1.6, 0.06, 0.68, 0.02), wood, 0, 0.9, 0));
  r.add(mesh(plane(0.86, 0.26), signGlow('sign-boba', 'BOBA', '#ff8fb8', '#ffffff'), 0, 0.58, 0.31, false));
  for (const s of [1, -1]) {
    const wx = s * 0.78;
    r.add(R(mesh(torus(0.22, 0.03, 8, 24), mat('#ff6fae', { r: 0.4 }), wx, 0.24, 0.05), 0, Math.PI / 2, 0));
    for (let k = 0; k < 4; k++) r.add(R(mesh(box(0.02, 0.42, 0.02), mat('#fff6ea'), wx, 0.24, 0.05), (k / 4) * Math.PI, 0, 0));
    r.add(R(mesh(cyl(0.05, 0.05, 0.06, 12), mat('#fff6ea'), wx, 0.24, 0.05), 0, 0, Math.PI / 2));
  }
  limb(r, [-0.6, 0.22, -0.2], [-0.62, 0, -0.22], 0.025, wood);
  limb(r, [0.6, 0.22, -0.2], [0.62, 0, -0.22], 0.025, wood);
  limb(r, [0.62, 0.8, -0.3], [0.86, 0.86, -0.32], 0.02, wood);
  // drinks on the counter
  bobaCup(r, -0.5, 0.93, 0.05, 1.3, '#c8a07a');
  bobaCup(r, -0.18, 0.93, 0.12, 1.15, '#b89ae0', '#ffffff', '#3fb6ff');
  bobaCup(r, 0.12, 0.93, 0.02, 1.25, '#a8d88a', '#ffffff', '#ffd23f');
  bobaCup(r, 0.42, 0.93, 0.12, 1.1, '#ffb3c6', '#ffffff', '#2fbf5f');
  // striped awning on posts
  for (const x of [-0.7, 0.7]) r.add(mesh(cyl(0.022, 0.022, 0.95, 10), wood, x, 1.4, -0.25));
  const stripes = [mat('#ff6fae', { r: 0.7, side: DS }), mat('#fff6ea', { r: 0.7, side: DS })];
  for (let i = 0; i < 9; i++) {
    const s = mesh(box(0.18, 0.025, 0.72), stripes[i % 2], -0.72 + i * 0.18, 1.9, 0.02);
    s.rotation.x = 0.22;
    r.add(s);
    r.add(Sc(mesh(cyl(0.09, 0.09, 0.025, 12, false, 0, Math.PI), stripes[i % 2], -0.72 + i * 0.18, 1.8, 0.37), 1, 1, 1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2));
  }
  const sign = dyn(new THREE.Group());
  sign.position.set(0, 1.98, -0.1);
  bobaCup(sign, 0, 0, 0, 2.1, '#c8a07a', '#ffffff', '#ff6fae');
  r.add(dynMerged(sign));
  return finish(r, [0, 2.3, 0], {
    animate(t) {
      sign.position.y = 1.98 + Math.abs(Math.sin(t * 2.2)) * 0.06;
      sign.rotation.y = Math.sin(t * 0.8) * 0.4;
    },
  });
};

function koi(colors) {
  const g = new THREE.Group();
  const [base, spot] = colors;
  g.add(Sc(mesh(sph(0.07, 14, 10), mat(base, { r: 0.4 }), 0, 0, 0), 0.7, 0.5, 1.6));
  g.add(Sc(mesh(sph(0.04, 10, 8), mat(spot, { r: 0.4 }), 0, 0.02, 0.03), 0.9, 0.4, 1.2));
  g.add(Sc(mesh(sph(0.03, 10, 8), mat(spot, { r: 0.4 }), 0.01, 0.022, -0.06), 0.9, 0.4, 1));
  const tail = R(Sc(mesh(cone(0.05, 0.09, 6), mat(base, { r: 0.4 }), 0, 0, -0.14), 1, 0.25, 1), -Math.PI / 2);
  g.add(tail);
  for (const s of [1, -1]) g.add(R(Sc(mesh(cone(0.025, 0.06, 5), mat(base), s * 0.05, -0.01, 0.04), 1, 0.2, 1), 0, 0, s * 1.3));
  return g;
}

function pondTex() {
  return paintTex('pond-water', 256, 256, (g, w, h) => {
    const bg = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    bg.addColorStop(0, '#1f5f6f');
    bg.addColorStop(0.75, '#2d7f8a');
    bg.addColorStop(1, '#4a9a8a');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const rnd = rng(55);
    g.fillStyle = 'rgba(30,60,40,0.35)';
    for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 10, 4 + rnd() * 6, rnd() * 3, 0, TAU); g.fill(); }
  });
}

D.koipond = () => {
  const r = new THREE.Group();
  const rnd = rng(77);
  const stones = ['#a9a59c', '#8f8a80', '#bdb8ac', '#9d988e', '#c9c2b2'];
  const shape = (a) => 0.8 + Math.sin(a * 2 + 0.6) * 0.05 + Math.sin(a * 3 + 1.4) * 0.04;
  r.add(mesh(cyl(0.86, 0.9, 0.06, 28), mat('#6b6a60', { r: 0.95 }), 0, 0.03, 0));
  const water = mesh(geo('pond-water', () => {
    const s = new THREE.Shape();
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU, rr = shape(a) - 0.06; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    return new THREE.ShapeGeometry(s, 2);
  }), mat('#ffffff', { map: pondTex(), mapKey: 'pond-water', r: 0.15, m: 0.1 }), 0, 0.1, 0, false);
  water.rotation.x = -Math.PI / 2;
  r.add(water);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + rnd() * 0.1, rr = shape(a) + 0.02;
    const st = mesh(ico(0.13 + rnd() * 0.04, 1), mat(stones[i % stones.length], { flat: true, r: 0.9 }), Math.cos(a) * rr, 0.1, -Math.sin(a) * rr);
    st.scale.set(1.1, 0.55 + rnd() * 0.25, 0.9);
    st.rotation.y = a;
    r.add(st);
  }
  // fish swim under a glassy surface
  const fish = [];
  [['#ff7a2a', '#ffffff'], ['#ffffff', '#ff4a2a'], ['#ffd23f', '#ff7a2a'], ['#1d1a20', '#ff8a3a']].forEach((c, i) => {
    const f = dynMerged(koi(c));
    f.position.y = 0.13;
    r.add(f);
    fish.push(f);
  });
  r.add(see(mesh(geo('pond-surface', () => new THREE.CircleGeometry(0.72, 32)), mat('#bfeaf0', { op: 0.28, r: 0.05 }), 0, 0.165, 0, false)));
  r.children[r.children.length - 1].rotation.x = -Math.PI / 2;
  const pads = [];
  const padM = mat('#4fa35a', { r: 0.6, side: DS });
  for (const [x, z, s] of [[0.35, 0.28, 1], [-0.3, 0.4, 0.8], [0.15, -0.42, 0.9], [-0.42, -0.12, 0.7]]) {
    const p = new THREE.Group();
    p.position.set(x, 0.175, z);
    p.add(Sc(mesh(cyl(0.12 * s, 0.12 * s, 0.012, 16, false, 0.4, TAU - 0.4), padM, 0, 0, 0), 1, 1, 1));
    if (s === 1) {
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; p.add(R(Sc(mesh(cone(0.03, 0.07, 6), mat('#ff9ac0', { r: 0.6 }), Math.cos(a) * 0.02, 0.04, Math.sin(a) * 0.02), 1, 1, 0.5), Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6)); }
      p.add(mesh(sph(0.02, 8, 6), mat('#ffd23f'), 0, 0.05, 0));
    }
    const d = dynMerged(p);
    r.add(d);
    pads.push(d);
  }
  // stone lantern and reeds
  const lx = -0.62, lz = -0.62;
  const ston = mat('#b5afa3', { r: 0.9 });
  r.add(mesh(rbox(0.22, 0.08, 0.22, 0.02), ston, lx, 0.2, lz));
  r.add(mesh(cyl(0.05, 0.06, 0.3, 8), ston, lx, 0.39, lz));
  r.add(mesh(rbox(0.2, 0.05, 0.2, 0.02), ston, lx, 0.56, lz));
  r.add(mesh(rbox(0.14, 0.13, 0.14, 0.02), ston, lx, 0.65, lz));
  r.add(mesh(box(0.08, 0.07, 0.15), mat('#fff1b0', { e: '#ffcf70', ei: 1.2 }), lx, 0.65, lz, false));
  r.add(mesh(box(0.15, 0.07, 0.08), mat('#fff1b0', { e: '#ffcf70', ei: 1.2 }), lx, 0.65, lz, false));
  r.add(mesh(cone(0.19, 0.12, 4), ston, lx, 0.78, lz));
  r.children[r.children.length - 1].rotation.y = Math.PI / 4;
  r.add(mesh(sph(0.035, 8, 6), ston, lx, 0.86, lz));
  const reed = mat('#5f9a4a', { r: 0.7 });
  for (let i = 0; i < 7; i++) {
    const a = 0.3 + i * 0.12;
    limb(r, [Math.cos(a) * 0.72, 0.1, -Math.sin(a) * 0.72], [Math.cos(a) * 0.76 + (i % 2) * 0.04, 0.55 + (i % 3) * 0.1, -Math.sin(a) * 0.76], 0.01, reed, 5);
    if (i % 2) r.add(mesh(capsule(0.016, 0.08), mat('#7a4a2a'), Math.cos(a) * 0.76 + 0.04, 0.6 + (i % 3) * 0.1, -Math.sin(a) * 0.76));
  }
  return finish(r, [0, 1.0, 0], {
    animate(t) {
      fish.forEach((f, i) => {
        const a = t * (0.35 + i * 0.07) * (i % 2 ? -1 : 1) + i * 1.7, rr = 0.25 + (i % 2) * 0.22 + Math.sin(t * 0.5 + i) * 0.05;
        f.position.x = Math.cos(a) * rr;
        f.position.z = Math.sin(a) * rr;
        f.rotation.y = (i % 2 ? Math.PI : 0) - a;
        f.children.forEach((c) => { c.rotation.y = Math.sin(t * 6 + i) * 0.15; });
      });
      pads.forEach((p, i) => { p.position.y = 0.175 + Math.sin(t * 1.3 + i) * 0.006; p.rotation.y = Math.sin(t * 0.3 + i) * 0.2; });
    },
  });
};

D.dino = () => {
  const r = new THREE.Group();
  r.add(mesh(rbox(1.84, 0.18, 1.2, 0.03), mat('#2b2b33', { r: 0.4 }), 0, 0.09, 0));
  r.add(mesh(rbox(1.88, 0.03, 1.24, 0.01), gold(), 0, 0.185, 0));
  r.add(mesh(rbox(0.4, 0.1, 0.012, 0.01), gold(), 0.5, 0.1, 0.606));
  const bone = mat('#efe3c8', { r: 0.7 });
  const boneD = mat('#d9c9a6', { r: 0.7 });
  const rod = mat('#3a3a40', { r: 0.4, m: 0.6 });
  const B = 0.2;
  // spine from tail tip to neck
  const spine = new THREE.CatmullRomCurve3([[-0.95, B + 0.55, 0], [-0.6, B + 0.8, 0], [-0.2, B + 1.05, 0], [0.15, B + 1.12, 0], [0.42, B + 1.3, 0], [0.55, B + 1.55, 0]].map(V));
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, p = spine.getPoint(t), tg = spine.getTangent(t);
    const s = 0.5 + Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.9) * 0.7;
    const v = mesh(rbox(0.05 * s, 0.07 * s, 0.07 * s, 0.015), i % 2 ? bone : boneD, p.x, p.y, p.z);
    v.rotation.z = Math.atan2(tg.y, tg.x);
    r.add(v);
    if (t > 0.2 && t < 0.75) r.add(R(mesh(box(0.015, 0.09 * s, 0.02), bone, p.x, p.y + 0.06 * s, 0), 0, 0, Math.atan2(tg.y, tg.x) - Math.PI / 2 + 0.3));
  }
  // ribs
  for (let i = 0; i < 7; i++) {
    const t = 0.42 + i * 0.045, p = spine.getPoint(t);
    const s = 1 - Math.abs(i - 3) * 0.12;
    const rib = mesh(torus(0.16 * s, 0.012, 5, 14, Math.PI), bone, p.x, p.y - 0.17 * s, 0);
    rib.rotation.set(0, Math.PI / 2, 0);
    r.add(rib);
  }
  // hips, legs and feet
  const hip = spine.getPoint(0.42);
  r.add(Sc(mesh(sph(0.11, 12, 10), bone, hip.x, hip.y - 0.05, 0), 1.4, 1, 0.9));
  for (const s of [1, -1]) {
    const z = s * 0.14;
    limb(r, [hip.x, hip.y - 0.08, z], [hip.x + 0.14, B + 0.55, z], 0.045, bone);
    r.add(mesh(sph(0.05, 10, 8), boneD, hip.x + 0.14, B + 0.55, z));
    limb(r, [hip.x + 0.14, B + 0.55, z], [hip.x - 0.06, B + 0.18, z], 0.035, bone);
    limb(r, [hip.x - 0.06, B + 0.18, z], [hip.x + 0.02, B + 0.03, z], 0.025, bone);
    for (const a of [-0.4, 0, 0.4]) limb(r, [hip.x + 0.02, B + 0.03, z], [hip.x + 0.02 + Math.cos(a) * 0.14, B + 0.015, z + Math.sin(a) * 0.08], 0.014, boneD);
  }
  // tiny arms
  const sh = spine.getPoint(0.8);
  for (const s of [1, -1]) {
    limb(r, [sh.x, sh.y - 0.12, s * 0.1], [sh.x + 0.1, sh.y - 0.2, s * 0.12], 0.016, bone);
    limb(r, [sh.x + 0.1, sh.y - 0.2, s * 0.12], [sh.x + 0.17, sh.y - 0.16, s * 0.12], 0.012, bone);
  }
  // skull with a snapping jaw
  const head = new THREE.Group();
  const top = spine.getPoint(1);
  head.position.set(top.x + 0.04, top.y + 0.02, 0);
  head.rotation.z = -0.25;
  head.add(mesh(rbox(0.42, 0.16, 0.18, 0.05), bone, 0.18, 0.02, 0));
  head.add(mesh(rbox(0.2, 0.14, 0.2, 0.05), bone, 0.04, 0.06, 0));
  for (const s of [1, -1]) {
    head.add(Sc(mesh(sph(0.035, 8, 6), mat('#2b2420'), 0.06, 0.08, s * 0.085), 1.2, 1, 0.4));
    head.add(Sc(mesh(sph(0.03, 8, 6), mat('#2b2420'), 0.2, 0.03, s * 0.085), 1.6, 0.8, 0.4));
  }
  for (let i = 0; i < 6; i++) head.add(R(mesh(cone(0.012, 0.045, 5), mat('#fff8e6'), 0.06 + i * 0.055, -0.07, 0.06), Math.PI));
  for (let i = 0; i < 6; i++) head.add(R(mesh(cone(0.012, 0.045, 5), mat('#fff8e6'), 0.06 + i * 0.055, -0.07, -0.06), Math.PI));
  const jaw = dyn(new THREE.Group());
  jaw.position.set(0.0, -0.05, 0);
  jaw.add(mesh(rbox(0.36, 0.06, 0.15, 0.025), boneD, 0.17, -0.04, 0));
  for (let i = 0; i < 5; i++) for (const s of [1, -1]) jaw.add(mesh(cone(0.01, 0.035, 5), mat('#fff8e6'), 0.08 + i * 0.055, 0.0, s * 0.055, false));
  head.add(jaw);
  r.add(head);
  // display rods
  for (const x of [-0.45, 0.25]) limb(r, [x, B, 0], [x, spine.getPoint(x < 0 ? 0.25 : 0.6).y - 0.03, 0], 0.012, rod);
  return finish(r, [0, 2.0, 0], {
    animate(t) {
      const k = (t * 0.2) % 1;
      jaw.rotation.z = -(k > 0.85 ? Math.sin(((k - 0.85) / 0.15) * Math.PI * 2) ** 2 * 0.35 : 0.05);
    },
  });
};
