// The town that grows around the restaurant: as the star rating climbs, neighbourhood
// buildings and landmarks open on plots around the shop (cottage, bakery, flower market, duck
// pond park, ice cream corner, townhouses, windmill, Ferris wheel). Plots not built yet get
// small "coming soon" stakes. Static parts merge into a few vertex-coloured meshes; moving
// parts (Ferris wheel, sails, ducks, swings) stay as small separate groups.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { mat, mesh, box, rbox, cyl, sph, cone, torus, ico, mergeStatic, buildBench } from './models.js';
import { buildGarden, buildAOStrips } from './look.js';

export const TOWN_STAGES = [
  { rating: 1.3, name: 'Rose Cottage', toast: 'New neighbours moved into the cottage out back.' },
  { rating: 1.6, name: 'Corner Bakery', toast: 'A bakery opened behind the shop.' },
  { rating: 2.0, name: 'Flower Market', toast: 'Flower stalls popped up down the lane.' },
  { rating: 2.4, name: 'Duck Pond Park', toast: 'A park with a duck pond opened on the lawn.' },
  { rating: 2.8, name: 'Ice Cream Corner', toast: 'An ice cream kiosk and a taco truck set up across the road.' },
  { rating: 3.2, name: 'Townhouse Row', toast: 'A row of townhouses and a bookshop went up next door.' },
  { rating: 3.7, name: 'Windmill Hill', toast: 'A windmill started turning at the edge of town.' },
  { rating: 4.3, name: 'Ferris Wheel', toast: 'A Ferris wheel now lights up the skyline.' },
];

const PI = Math.PI;
const TAU = PI * 2;
const FACE_CAM = PI / 4; // rotation.y that turns a +z front toward the camera
const FONT = '"Lilita One", system-ui, sans-serif';
const C = {
  white: '#fffaf0', stone: '#d9cfc0', wood: '#b07445', woodDark: '#7a4b2e', iron: '#3b4a47', leaf: '#4f9a45', path: '#eadcc0',
};
const PETALS = ['#ff7a9a', '#ffd23f', '#ffffff', '#b98cff', '#ff9a4d', '#7ec8ff'];
const LIT = '#ffffff', DIM = '#7e8cab';

// plots
// Each stage: lot (kept clear of the random garden) and site [cx, cz, w, d] (the footprint the
// "coming soon" stakes mark and the celebration aims at). Trees listed per lot are always there.
function layout(W, H, doorX) {
  const L = (x0, z0, x1, z1) => ({ x0, z0, x1, z1 });
  const wx = 6 + (W - 12) * 0.3;
  const px = W + 5.6, pz = -6.2;
  const ix = doorX - 9.5, iz = H + 12.8;
  return [
    { lot: L(W - 5.8, -7.8, W - 0.4, -3.4), site: [W - 3.1, -6.1, 3.6, 2.8], trees: [[W - 0.8, -7.2, 0.8]] },
    { lot: L(-2.6, -7.8, 3.0, -3.4), site: [0.2, -6.0, 4.2, 2.8], trees: [[-2.35, -4.1, 0.72]] },
    { lot: L(-10.6, -0.8, -5.0, 4.4), site: [-8.0, 1.8, 4.4, 4.6], trees: [[-10.2, -0.3, 0.85]] },
    { lot: L(px, pz, W + 15.6, H - 5.4), site: [px + 5, (pz + H - 5.4) / 2, 9, H], trees: [[px + 0.6, pz + 0.5, 1], [px + 4.6, pz + 0.3, 0.95], [px + 9.3, pz + 0.7, 1.05], [px + 9.4, pz + 5.2, 0.9], [px + 0.5, pz + 6.0, 0.85]] },
    { lot: L(ix, iz, ix + 11, iz + 4), site: [ix + 5.4, iz + 2, 10, 3.4], trees: [[ix + 0.4, iz + 3.4, 0.9], [ix + 10.7, iz + 3.5, 0.95]] },
    { lot: L(W + 5.6, H - 4.6, W + 15.6, H - 0.2), site: [W + 10.6, H - 2.3, 9.8, 3.6], trees: [] },
    { lot: L(-11.6, 5.0, -5.0, H - 0.2), site: [-8.3, (H + 4.8) / 2, 3.2, 3.2], trees: [[-11.1, H - 0.8, 0.85], [-11.0, 5.5, 0.8]] },
    { lot: L(wx - 4.2, -14.6, wx + 4.2, -6.6), site: [wx, -9.8, 6.4, 3], trees: [[wx - 3.6, -13.2, 1.1], [wx + 3.4, -13.6, 1.05], [wx - 0.3, -14.0, 1.0]] },
  ];
}

// Every rectangle the town ever uses (all stages), for the garden generator to keep clear
export function townLots(W, H, doorX) {
  return layout(W, H, doorX).map((p) => ({ ...p.lot }));
}

// Centre of a stage's plot (stage 1..8) in world units
export function townStagePos(W, H, doorX, stage) {
  const p = layout(W, H, doorX)[Math.max(1, Math.min(TOWN_STAGES.length, stage)) - 1];
  return { x: p.site[0], z: p.site[1] };
}

// shared materials & signs
const E = (c, r = 0.75) => mat(c, { kind: 'env', r });

// Glowing bits (windows, bulbs) carry per-vertex colours that also tint their emissive light, so
// warm, dim and coloured lights all share one draw call.
function glowPatch(m, key) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor;');
  };
  m.customProgramCacheKey = () => key;
  return m;
}

const AW = 1024, AH = 768;
const SHOP = {
  bakery: [0, 'Bakery', '#ff9ab8', '#e0608a'], flowers: [1, 'Flowers', '#93dc8a', '#46a85a'], icecream: [2, 'Ice Cream', '#9ad8ff', '#4d9be0'],
  books: [3, 'Books', '#c6aeff', '#8366e0'], tacos: [4, 'Tacos', '#ffd45e', '#f08f2c'], park: [5, 'Duck Pond', '#9bd86e', '#53a345'],
};
const shopCell = (i) => [(i % 2) * 512, Math.floor(i / 2) * 128, 512, 128];
const soonCell = (i) => [(i % 4) * 256, 512 + Math.floor(i / 4) * 128, 256, 128];

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function inkText(g, text, x, y, size, maxW, fill, ink, stroke) {
  let s = size;
  g.font = `${s}px ${FONT}`;
  while (g.measureText(text).width > maxW && s > 10) { s -= 2; g.font = `${s}px ${FONT}`; }
  g.lineJoin = 'round';
  g.lineWidth = stroke;
  g.strokeStyle = ink;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

function starPath(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + (i * PI) / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

let atlas = null;
function signAtlas() {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = AW;
  c.height = AH;
  const g = c.getContext('2d');
  const ink = '#2e2235';
  g.fillStyle = ink;
  g.fillRect(0, 0, AW, AH);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [i, text, c1, c2] of Object.values(SHOP)) {
    const [x, y, w, h] = shopCell(i);
    roundRect(g, x + 8, y + 8, w - 16, h - 16, 26);
    const grd = g.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    g.fillStyle = grd;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    roundRect(g, x + 22, y + 22, w - 44, h - 44, 14);
    g.stroke();
    inkText(g, text, x + w / 2, y + h / 2 + 3, 72, w - 90, '#fffaf0', ink, 12);
  }
  TOWN_STAGES.forEach((s, i) => {
    const [x, y, w, h] = soonCell(i);
    roundRect(g, x + 6, y + 6, w - 12, h - 12, 16);
    const grd = g.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, '#f6cf94');
    grd.addColorStop(1, '#d9a062');
    g.fillStyle = grd;
    g.fill();
    g.fillStyle = 'rgba(120,70,30,0.25)';
    g.fillRect(x + 12, y + 62, w - 24, 3);
    inkText(g, 'COMING SOON', x + w / 2, y + 36, 34, w - 36, '#fff8ea', '#5a3420', 8);
    starPath(g, x + w / 2 - 44, y + 92, 22);
    g.lineWidth = 7;
    g.strokeStyle = '#5a3420';
    g.stroke();
    g.fillStyle = '#ffd23f';
    g.fill();
    inkText(g, s.rating.toFixed(1), x + w / 2 + 18, y + 94, 50, 110, '#ffd23f', '#5a3420', 9);
  });
  atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  return atlas;
}

let M = null;
function mats() {
  if (!M) {
    M = {
      win: glowPatch(new THREE.MeshStandardMaterial({ vertexColors: true, color: '#9fd3f0', emissive: '#6fb8e8', emissiveIntensity: 0.3, roughness: 0.12, metalness: 0.15 }), 'town-win'),
      glow: glowPatch(new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.45 }), 'town-glow'),
      sign: new THREE.MeshStandardMaterial({ map: signAtlas(), emissive: '#ffffff', emissiveMap: signAtlas(), emissiveIntensity: 0.25, roughness: 0.6 }),
    };
  }
  return M;
}

const DAY_GLASS = new THREE.Color('#9fd3f0'), NIGHT_GLASS = new THREE.Color('#ffe2a6');
const DAY_EMI = new THREE.Color('#6fb8e8'), NIGHT_EMI = new THREE.Color('#ffb04a');
// Window & bulb glow follows the street lamps (0 = day, 1 = night)
function setNight(l) {
  const m = mats();
  m.win.color.copy(DAY_GLASS).lerp(NIGHT_GLASS, l);
  m.win.emissive.copy(DAY_EMI).lerp(NIGHT_EMI, l);
  m.win.emissiveIntensity = 0.3 + l * 1.1;
  m.glow.emissiveIntensity = 0.15 + l * 1.9;
  m.sign.emissiveIntensity = 0.25 + l * 0.6;
}

// A cached geometry copy carrying a flat vertex colour (for the glow / window materials)
const tintCache = new Map();
function tinted(geo, hex) {
  const k = `${geo.uuid}|${hex}`;
  let g = tintCache.get(k);
  if (!g) {
    g = geo.clone();
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    tintCache.set(k, g);
  }
  return g;
}

// Triangular prism: base w along x, apex h above y=0, extruded d along z (flat-shaded)
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

function signPlane(cell, w, h) {
  const [x, y, cw, ch] = cell;
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  const u0 = (x + 4) / AW, u1 = (x + cw - 4) / AW, v1 = 1 - (y + 4) / AH, v0 = 1 - (y + ch - 4) / AH;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  return geo;
}

// building helpers
function grp(x = 0, z = 0, ry = 0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}
function dyn(g) { g.userData.dynamic = true; return g; }

function put(parent, geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = mesh(geo, typeof color === 'string' ? E(color) : color, x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}
function glow(parent, geo, hex, x, y, z) {
  const m = mesh(tinted(geo, hex), mats().glow, x, y, z, false);
  parent.add(m);
  return m;
}
// A group whose local +z is the outward normal of a wall (x runs along the wall)
function face(g, ry, x, z, y = 0) {
  const f = grp(x, z, ry, y);
  g.add(f);
  return f;
}

function flowerBox(f, x, y, w, seed = 0) {
  put(f, box(w, 0.16, 0.2), '#a8673f', x, y, 0.12);
  const n = Math.max(3, Math.round(w / 0.17));
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + (i + 0.5) * (w / n);
    put(f, ico(0.08, 0), C.leaf, px, y + 0.11, 0.12);
    put(f, ico(0.05, 0), PETALS[(i + seed) % PETALS.length], px, y + 0.18, 0.16);
  }
}

function win(f, x, y, w = 0.6, h = 0.7, o = {}) {
  const fr = o.frame || C.white;
  f.add(mesh(tinted(box(w, h, 0.06), o.dim ? DIM : LIT), mats().win, x, y, 0.01, false));
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

function roundWin(f, x, y, r) {
  const g = mesh(tinted(cyl(r, r, 0.06, 16), LIT), mats().win, x, y, 0.01, false);
  g.rotation.x = PI / 2;
  f.add(g);
  put(f, torus(r, 0.05, 6, 18), C.white, x, y, 0.04);
}

function door(f, x, w, h, col, o = {}) {
  put(f, box(w + 0.18, h + 0.09, 0.07), o.frame || C.white, x, (h + 0.09) / 2, 0.02);
  put(f, rbox(w, h, 0.08, 0.04, 1), col, x, h / 2, 0.05);
  if (o.glass) f.add(mesh(tinted(box(w * 0.56, h * 0.42, 0.04), LIT), mats().win, x, h * 0.64, 0.09, false));
  else put(f, box(w * 0.32, w * 0.32, 0.03), C.white, x, h * 0.7, 0.09);
  put(f, sph(0.045, 8, 6), '#f2c94c', x + w * 0.32, h * 0.48, 0.11);
  if (o.step !== false) put(f, box(w + 0.4, 0.1, 0.36), C.stone, x, 0.05, 0.2);
}

function lantern(f, x, y) {
  put(f, box(0.05, 0.05, 0.16), C.iron, x, y + 0.12, 0.08);
  put(f, cone(0.1, 0.09, 6), C.iron, x, y + 0.15, 0.17);
  glow(f, sph(0.075, 8, 6), '#ffd27a', x, y, 0.17);
}

// Striped awning sloping out from a wall, with a scalloped valance
function awning(f, x, y, w, depth, a, b, tilt = 0.45) {
  const n = Math.max(4, Math.round(w / 0.26)), sw = w / n;
  for (let i = 0; i < n; i++) put(f, box(sw + 0.004, 0.04, depth), i % 2 ? b : a, x - w / 2 + (i + 0.5) * sw, y - (Math.sin(tilt) * depth) / 2, (Math.cos(tilt) * depth) / 2, tilt);
  const fy = y - Math.sin(tilt) * depth, fz = Math.cos(tilt) * depth + 0.01;
  for (let i = 0; i < n; i++) put(f, cyl(sw / 2, sw / 2, 0.03, 8, false, -PI / 2, PI), i % 2 ? b : a, x - w / 2 + (i + 0.5) * sw, fy, fz, PI / 2);
}

function signBoard(f, key, x, y, w, h, z = 0.03) {
  put(f, box(w + 0.12, h + 0.12, 0.06), '#2e2235', x, y, z);
  f.add(mesh(signPlane(shopCell(SHOP[key][0]), w, h), mats().sign, x, y, z + 0.035, false));
}

// Pitched roof over a w×d block whose walls end at y: wall-coloured gable ends, two overhanging
// slabs and a ridge cap. alongX: ridge along x (slopes face front & back).
function roof(g, ox, oz, w, d, y, h, wallCol, roofCol, alongX = true, oh = 0.22) {
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

function fence(g, x0, z0, x1, z1, col = C.white) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.2)), ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
    put(g, box(0.09, 0.44, 0.04), col, x, 0.22, z, 0, -ang, 0);
    put(g, box(0.064, 0.064, 0.04), col, x, 0.44, z, 0, -ang, PI / 4);
  }
  for (const y of [0.15, 0.33]) put(g, box(len, 0.05, 0.03), col, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, -ang, 0);
}

function stones(g, pts, gap = 0.48, r = 0.2) {
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / gap));
    for (let i = k ? 1 : 0; i <= n; i++) put(g, cyl(r, r * 1.05, 0.05, 7), C.path, ax + ((bx - ax) * i) / n, 0, az + ((bz - az) * i) / n, 0, i * 1.3, 0).castShadow = false;
  }
}

function bunting(g, a, b, sag = 0.3, n = 9) {
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * PI) * sag;
    if (i < n) {
      const t2 = (i + 1) / n, x2 = a[0] + (b[0] - a[0]) * t2, z2 = a[2] + (b[2] - a[2]) * t2, y2 = a[1] + (b[1] - a[1]) * t2 - Math.sin(t2 * PI) * sag;
      const len = Math.hypot(x2 - x, y2 - y, z2 - z);
      put(g, box(len, 0.015, 0.015), '#fff6e0', (x + x2) / 2, (y + y2) / 2, (z + z2) / 2).rotation.set(0, -Math.atan2(z2 - z, x2 - x), Math.atan2(y2 - y, Math.hypot(x2 - x, z2 - z)), 'YZX');
      const fl = put(g, cone(0.09, 0.2, 3), PETALS[i % PETALS.length], (x + x2) / 2, (y + y2) / 2 - 0.1, (z + z2) / 2);
      fl.rotation.set(PI, Math.atan2(-(z2 - z), x2 - x), 0, 'YXZ');
      fl.scale.set(1, 1, 0.3);
    }
  }
}

// Soft contact darkening around a (rotated) footprint, so buildings sit on the lawn even where
// the sun's shadow map doesn't reach
function aoBox(c, x, z, w, d, ry = 0, width = 0.5) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const P = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const pts = [P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)];
  const nrm = [P(0, -1), P(1, 0), P(0, 1), P(-1, 0)].map(([nx, nz]) => [nx - x, nz - z]);
  for (let k = 0; k < 4; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % 4], [nx, nz] = nrm[k];
    c.ao.push({ o: [ax, -0.012, az], along: [bx - ax, 0, bz - az], across: [nx * width, 0, nz * width] });
  }
}
function aoRing(c, x, z, r, w = 0.5, n = 10) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
    const p0 = [x + Math.sin(a0) * r, z + Math.cos(a0) * r], p1 = [x + Math.sin(a1) * r, z + Math.cos(a1) * r];
    const m = (a0 + a1) / 2;
    c.ao.push({ o: [p0[0], -0.012, p0[1]], along: [p1[0] - p0[0], 0, p1[1] - p0[1]], across: [Math.sin(m) * w, 0, Math.cos(m) * w] });
  }
}

function addFlowers(c, x, z, n = 6) { c.garden.flowers.push({ x, z, n }); }

// 1: cottage
function cottage(c) {
  const [cx, cz] = c.site, { lot } = c;
  const g = grp(cx, cz);
  const w = 3.2, d = 2.5, wh = 2.0, wall = '#fff0d2', roofC = '#ef6f5c', trim = '#4fb6c9';
  put(g, rbox(w + 0.1, 0.24, d + 0.1, 0.04, 1), '#e6d5bd', 0, 0.12, 0);
  put(g, rbox(w, wh, d, 0.06, 1), wall, 0, wh / 2, 0);
  roof(g, 0, 0, w, d, wh, 1.3, wall, roofC, true, 0.26);
  put(g, rbox(0.42, 1.2, 0.42, 0.04, 1), '#c8735a', -0.95, wh + 1.05, -0.5);
  put(g, box(0.52, 0.1, 0.52), '#8c4f3c', -0.95, wh + 1.68, -0.5);
  const f = face(g, 0, 0, d / 2);
  door(f, -0.75, 0.62, 1.25, trim);
  put(f, rbox(1.05, 0.08, 0.6, 0.03, 1), roofC, -0.75, 1.55, 0.26, 0.3);
  for (const s of [-1, 1]) put(f, box(0.05, 0.3, 0.05), C.white, -0.75 + s * 0.42, 1.38, 0.35, 0.8);
  lantern(f, -0.2, 1.25);
  win(f, 0.75, 1.15, 0.82, 0.72, { shutter: trim, box: 1 });
  const s = face(g, PI / 2, w / 2, 0);
  win(s, 0.1, 1.15, 0.62, 0.7, { shutter: trim, box: 3 });
  roundWin(s, 0, wh + 0.45, 0.2);
  // Picket fence with a gate, mailbox and a stepping-stone path
  const fz = lot.z1 - 0.2, fx0 = lot.x0 + 0.25, fx1 = lot.x1 - 0.25, gx = cx - 0.75;
  fence(g, fx0 - cx, fz - cz, gx - 0.5 - cx, fz - cz);
  fence(g, gx + 0.5 - cx, fz - cz, fx1 - cx, fz - cz);
  fence(g, fx0 - cx, fz - cz, fx0 - cx, d / 2 + 0.1);
  fence(g, fx1 - cx, fz - cz, fx1 - cx, d / 2 + 0.1);
  const mb = grp(gx + 0.85 - cx, fz - cz + 0.3);
  put(mb, box(0.07, 0.75, 0.07), C.wood, 0, 0.375, 0);
  put(mb, rbox(0.26, 0.24, 0.42, 0.1, 1), '#5b8def', 0, 0.86, 0);
  put(mb, box(0.03, 0.2, 0.06), '#ef4b4b', 0.15, 0.95, -0.1);
  g.add(mb);
  stones(g, [[-0.75, d / 2 + 0.45], [-0.75, fz - cz - 0.1]], 0.42, 0.18);
  aoBox(c, cx, cz, w, d);
  addFlowers(c, cx + 0.8, cz + d / 2 + 0.45, 7);
  addFlowers(c, cx + 1.4, fz - 0.45, 5);
  c.garden.bushes.push({ x: cx - w / 2 - 0.5, z: cz + d / 2 + 0.2, s: 0.8, flowers: true });
  c.lights.push({ rank: 3, x: cx - 0.75, y: 1.4, z: cz + d / 2 + 0.7, color: '#ffc27a', intensity: 4, distance: 4.5 });
  return g;
}

// 2: bakery
function bakery(c) {
  const [cx, cz] = c.site;
  const g = grp(cx, cz);
  const w = 4.0, d = 2.7, g1 = 1.95, g2 = 1.5;
  put(g, rbox(w, g1, d, 0.06, 1), '#ffe2b4', 0, g1 / 2, 0);
  put(g, rbox(w + 0.14, 0.14, d + 0.14, 0.03, 1), C.white, 0, g1, 0);
  put(g, rbox(w, g2, d, 0.06, 1), '#ffbccb', 0, g1 + g2 / 2 + 0.05, 0);
  const top = g1 + g2 + 0.05;
  put(g, rbox(w + 0.22, 0.22, d + 0.22, 0.05, 1), C.white, 0, top, 0);
  // Giant cupcake on the roof
  put(g, cyl(0.6, 0.46, 0.6, 12), '#ff7aa2', 0, top + 0.4, -0.2);
  for (let i = 0; i < 12; i++) put(g, box(0.05, 0.58, 0.05), '#e05a86', Math.sin((i / 12) * TAU) * 0.535, top + 0.4, -0.2 + Math.cos((i / 12) * TAU) * 0.535, 0, (i / 12) * TAU, 0);
  const fr = put(g, sph(0.66, 14, 10), '#fff2f6', 0, top + 0.78, -0.2);
  fr.scale.set(1, 0.55, 1);
  put(g, sph(0.44, 12, 8), '#fff2f6', 0, top + 1.05, -0.2).scale.set(1, 0.7, 1);
  put(g, sph(0.24, 10, 8), '#fff2f6', 0, top + 1.3, -0.2);
  put(g, sph(0.13, 10, 8), '#e8323c', 0, top + 1.52, -0.2);
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4, rr = 0.35 + (i % 3) * 0.1;
    put(g, box(0.1, 0.03, 0.03), PETALS[i % PETALS.length], Math.cos(a) * rr, top + 0.95 + (i % 2) * 0.12, -0.2 + Math.sin(a) * rr, 0, a, 0.4);
  }
  const f = face(g, 0, 0, d / 2);
  put(f, rbox(3.6, 1.7, 0.1, 0.03, 1), '#8a5a3c', 0, 0.85, 0.02);
  win(f, -1.0, 0.98, 1.1, 1.0, { frame: '#f6e7cf' });
  win(f, 1.0, 0.98, 1.1, 1.0, { frame: '#f6e7cf' });
  door(f, 0, 0.62, 1.45, '#6e4630', { glass: true, frame: '#f6e7cf' });
  awning(f, 0, 1.86, 3.8, 0.8, '#ff86a6', '#fff7f0');
  signBoard(f, 'bakery', 0, g1 + 0.48, 1.5, 0.38);
  for (const x of [-1.25, 1.25]) win(f, x, g1 + 0.86, 0.62, 0.68, { box: x > 0 ? 2 : 4 });
  const s = face(g, PI / 2, w / 2, 0);
  win(s, 0, 1.0, 0.7, 0.72, {});
  win(s, 0, g1 + 0.82, 0.62, 0.66, { shutter: '#ff86a6' });
  // Chalkboard, planters, a cafe table
  const ch = grp(1.9, d / 2 + 0.75, -0.4);
  put(ch, box(0.5, 0.62, 0.04), '#3c3f45', 0, 0.42, 0.08, -0.22);
  put(ch, box(0.56, 0.68, 0.03), C.wood, 0, 0.42, 0.06, -0.22);
  put(ch, box(0.5, 0.62, 0.04), '#3c3f45', 0, 0.42, -0.08, 0.22);
  g.add(ch);
  const t = grp(-1.6, d / 2 + 0.85);
  put(t, cyl(0.32, 0.32, 0.04, 14), C.white, 0, 0.7, 0);
  put(t, cyl(0.04, 0.05, 0.7, 6), C.iron, 0, 0.35, 0);
  put(t, cyl(0.2, 0.2, 0.03, 10), C.iron, 0, 0.02, 0);
  for (const s2 of [-1, 1]) {
    put(t, cyl(0.17, 0.17, 0.04, 10), '#ff86a6', s2 * 0.5, 0.44, 0);
    put(t, cyl(0.025, 0.025, 0.44, 5), C.iron, s2 * 0.5, 0.22, 0);
  }
  g.add(t);
  aoBox(c, cx, cz, w, d);
  c.garden.bushes.push({ x: cx - w / 2 - 0.35, z: cz + d / 2 + 0.25, s: 0.7, flowers: true }, { x: cx + w / 2 + 0.35, z: cz + d / 2 + 0.2, s: 0.65 });
  c.lights.push({ rank: 2, x: cx, y: 1.5, z: cz + d / 2 + 1.0, color: '#ffc27a', intensity: 4, distance: 5 });
  return g;
}

// 3: flower market (faces +x)
function flowerStall(g, x, z, a, b, seed) {
  const s = grp(x, z);
  put(s, box(1.25, 0.08, 0.75), C.wood, 0, 0.72, 0);
  put(s, box(1.2, 0.5, 0.05), '#d49460', 0, 0.45, 0.36);
  for (const [px, pz] of [[-0.58, -0.33], [0.58, -0.33], [-0.58, 0.33], [0.58, 0.33]]) put(s, cyl(0.035, 0.035, pz < 0 ? 1.85 : 1.6, 6), C.woodDark, px, pz < 0 ? 0.925 : 0.8, pz);
  awning(face(s, 0, 0, -0.35, 1.8), 0, 0, 1.4, 0.9, a, b, 0.3);
  for (let k = 0; k < 3; k++) {
    const kx = -0.4 + k * 0.4;
    put(s, box(0.34, 0.14, 0.5), '#c98a4e', kx, 0.83, 0);
    for (let i = 0; i < 6; i++) {
      put(s, ico(0.08, 0), PETALS[(k * 2 + i + seed) % PETALS.length], kx - 0.1 + (i % 2) * 0.2, 0.95, -0.17 + Math.floor(i / 2) * 0.17);
    }
  }
  for (let i = 0; i < 3; i++) {
    const bx = -0.45 + i * 0.45;
    put(s, cyl(0.13, 0.11, 0.28, 10), '#9fb3c4', bx, 0.14, 0.62);
    for (let k = 0; k < 4; k++) put(s, ico(0.085, 0), PETALS[(i + k + seed + 1) % PETALS.length], bx + Math.sin(k * 1.7) * 0.07, 0.36 + (k % 2) * 0.05, 0.62 + Math.cos(k * 1.7) * 0.07);
  }
  g.add(s);
  return s;
}

function flowerMarket(c) {
  const [cx, cz] = c.site;
  const g = grp(cx, cz, PI / 2); // local +z = world +x
  const w = 3.8, d = 2.2, wh = 2.5, bz = -1.2, wall = '#fde2ec';
  put(g, rbox(w, wh, d, 0.06, 1), wall, 0, wh / 2, bz);
  roof(g, 0, bz, w, d, wh, 1.0, wall, '#5fbf8f', true, 0.24);
  const f = face(g, 0, 0, bz + d / 2);
  door(f, 0, 0.66, 1.3, '#5fbf8f', { glass: true });
  win(f, -1.15, 1.05, 0.8, 0.8, { frame: '#5fbf8f', box: 1 });
  win(f, 1.15, 1.05, 0.8, 0.8, { frame: '#5fbf8f', box: 4 });
  awning(f, 0, 1.78, 3.6, 0.7, '#5fbf8f', '#fffaf0');
  const s = face(g, -PI / 2, 0, 0); // the shop's left end faces world +z
  s.position.set(-w / 2, 0, bz);
  win(s, 0, 1.15, 0.7, 0.72, { frame: '#5fbf8f', box: 2 });
  signBoard(s, 'flowers', 0, wh + 0.2, 1.2, 0.3, 0.02);
  // Two stalls flanking the door, buckets of flowers & bunting
  flowerStall(g, -1.45, 1.05, '#ffd23f', '#fffaf0', 0);
  flowerStall(g, 1.45, 1.05, '#ff86a6', '#fffaf0', 3);
  bunting(g, [-2.05, 1.85, 0.7], [2.05, 1.85, 0.7], 0.25, 10);
  for (const [x, z, k] of [[-0.55, 0.2, 2], [0.55, 0.25, 5]]) {
    put(g, cyl(0.16, 0.13, 0.32, 10), '#7a8ea0', x, 0.16, z);
    for (let i = 0; i < 5; i++) put(g, ico(0.09, 0), PETALS[(i + k) % PETALS.length], x + Math.sin(i * 1.3) * 0.08, 0.38 + (i % 2) * 0.06, z + Math.cos(i * 1.3) * 0.08);
  }
  // world-space footprint (local x -> world -z, local z -> world +x)
  aoBox(c, cx + bz, cz, d, w);
  addFlowers(c, cx + 1.9, cz - 2.0, 7);
  addFlowers(c, cx + 2.0, cz + 2.1, 6);
  c.lights.push({ rank: 1, x: cx + 0.6, y: 1.5, z: cz, color: '#ffc27a', intensity: 3.5, distance: 4.5 });
  return g;
}

// 4: duck pond park
function duck(parent, a, r, s, body) {
  const d = grp(Math.cos(a) * r, Math.sin(a) * r, PI / 2 - a);
  d.scale.setScalar(s);
  put(d, sph(0.17, 10, 8), body, 0, 0.1, 0).scale.set(1.35, 0.8, 1);
  put(d, sph(0.1, 10, 8), body, 0.17, 0.25, 0);
  put(d, box(0.12, 0.035, 0.08), '#ff9a2e', 0.29, 0.24, 0);
  put(d, cone(0.07, 0.14, 5), body, -0.22, 0.17, 0, 0, 0, 1.1);
  for (const z of [-0.06, 0.06]) put(d, sph(0.018, 5, 4), '#2a2a2a', 0.23, 0.28, z);
  parent.add(d);
}

function park(c) {
  const { lot } = c;
  const x0 = lot.x0, z0 = lot.z0, depth = lot.z1 - lot.z0;
  const g = grp();
  // Pond with a sandy shore, stones, lily pads, reeds and a family of ducks
  const px = x0 + 6.5, pz = z0 + Math.min(3.2, depth * 0.33), rx = 2.3, rz = 1.6;
  const p = grp(px, pz);
  put(p, cyl(1, 1, 0.04, 28), '#ead9a6', 0, -0.005, 0).scale.set(rx + 0.4, 1, rz + 0.4);
  put(p, cyl(1, 1, 0.05, 28), E('#62c6ec', 0.15), 0, 0.01, 0).scale.set(rx, 1, rz);
  put(p, cyl(1, 1, 0.05, 24), E('#47aad8', 0.15), 0, 0.016, 0).scale.set(rx * 0.55, 1, rz * 0.5);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + Math.sin(i * 3.1) * 0.08;
    put(p, ico(0.17 + (i % 3) * 0.03, 0), ['#cfc7bb', '#b9b0a2', '#e2dbd0'][i % 3], Math.cos(a) * (rx + 0.22), 0.03, Math.sin(a) * (rz + 0.22), 0, i, 0).scale.set(1, 0.55, 1);
  }
  for (const [lx, lz] of [[-1.2, 0.5], [-0.9, -0.7], [1.3, 0.6]]) {
    put(p, cyl(0.2, 0.2, 0.02, 10, false, 0.3, TAU - 0.6), '#5aa84a', lx, 0.05, lz);
    put(p, sph(0.06, 6, 5), '#ff9ec7', lx + 0.05, 0.08, lz);
  }
  for (let i = 0; i < 7; i++) {
    const rx2 = 1.9 + (i % 3) * 0.12, a = -0.5 + i * 0.12;
    put(p, cyl(0.018, 0.022, 0.65 + (i % 2) * 0.2, 4), '#4d8a3e', Math.cos(a) * rx2, 0.33, Math.sin(a) * rz * 1.05);
    if (i % 2 === 0) put(p, cattail(), '#7a4a2e', Math.cos(a) * rx2, 0.7, Math.sin(a) * rz * 1.05);
  }
  const ducks = dyn(grp(0, 0, 0, 0.03));
  duck(ducks, 0, 1.15, 1, '#fffdf6');
  duck(ducks, 0.55, 1.15, 0.6, '#ffd84a');
  duck(ducks, 0.95, 1.15, 0.6, '#ffd84a');
  mergeStatic(ducks, 'env');
  p.add(ducks);
  c.anim.push((t) => { ducks.rotation.y = t * 0.22; ducks.position.y = 0.03 + Math.sin(t * 2.4) * 0.01; });
  g.add(p);
  // Gazebo
  const gzx = x0 + 2.3, gzz = z0 + Math.min(2.6, depth * 0.27);
  const gz = grp(gzx, gzz);
  put(gz, cyl(1.4, 1.5, 0.22, 8), '#f3ebe0', 0, 0.11, 0, 0, PI / 8, 0);
  put(gz, rbox(0.9, 0.12, 0.45, 0.03, 1), '#e8dccb', Math.sin(FACE_CAM) * 1.6, 0.06, Math.cos(FACE_CAM) * 1.6, 0, FACE_CAM, 0);
  for (let i = 0; i < 8; i++) {
    const a = PI / 8 + (i * PI) / 4;
    put(gz, cyl(0.06, 0.07, 1.55, 8), C.white, Math.sin(a) * 1.22, 0.99, Math.cos(a) * 1.22);
    const m = a + PI / 8;
    if (Math.abs(((m - FACE_CAM + TAU) % TAU)) < 0.01) continue;
    for (const y of [0.4, 0.68]) put(gz, box(0.9, 0.05, 0.05), C.white, Math.sin(m) * 1.13, y, Math.cos(m) * 1.13, 0, m + PI / 2, 0);
  }
  put(gz, cyl(1.72, 1.72, 0.12, 8), C.white, 0, 1.8, 0, 0, PI / 8, 0);
  put(gz, cone(1.78, 0.95, 8), '#5cc8c0', 0, 2.33, 0, 0, PI / 8, 0);
  put(gz, sph(0.11, 8, 6), '#f2c94c', 0, 2.86, 0);
  put(gz, cone(0.05, 0.3, 6), '#f2c94c', 0, 3.05, 0);
  glow(gz, sph(0.12, 8, 6), '#ffd27a', 0, 1.5, 0);
  put(gz, cyl(0.01, 0.01, 0.25, 4), C.iron, 0, 1.68, 0);
  g.add(gz);
  aoRing(c, gzx, gzz, 1.5, 0.45, 8);
  // Playground: swings, slide, sandbox
  const py = z0 + Math.min(7.3, depth - 1.6);
  const sw = grp(x0 + 2.4, py);
  for (const sx of [-1.2, 1.2]) {
    for (const zb of [-0.55, 0.55]) {
      const len = Math.hypot(1.75, zb);
      put(sw, cyl(0.05, 0.06, len, 6), '#ef5b5b', sx, 0.875, zb / 2, Math.asin(-zb / len), 0, 0);
    }
  }
  put(sw, cyl(0.06, 0.06, 2.6, 8), '#ffd23f', 0, 1.75, 0, 0, 0, PI / 2);
  [-0.5, 0.5].forEach((sx, i) => {
    const pv = dyn(grp(sx, 0, 0, 1.72));
    for (const cx2 of [-0.18, 0.18]) put(pv, cyl(0.012, 0.012, 1.25, 4), '#8a8f99', cx2, -0.62, 0);
    put(pv, rbox(0.44, 0.05, 0.2, 0.02, 1), i ? '#4aa3f0' : '#3fcf7a', 0, -1.27, 0);
    mergeStatic(pv, 'env');
    sw.add(pv);
    c.anim.push((t) => { pv.rotation.x = Math.sin(t * 2.1 + i * 1.9) * (0.35 + i * 0.12); });
  });
  g.add(sw);
  const sl = grp(x0 + 5.9, py + 0.1);
  for (const [lx, lz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) put(sl, cyl(0.04, 0.04, 1.6, 6), '#ef5b5b', lx, 0.8, lz);
  put(sl, rbox(0.75, 0.08, 0.75, 0.02, 1), '#4aa3f0', 0, 1.1, 0);
  put(sl, cone(0.6, 0.45, 4), '#ffd23f', 0, 1.82, 0, 0, PI / 4, 0);
  put(sl, rbox(0.5, 0.06, 1.7, 0.02, 1), '#ffd23f', 0, 0.62, 1.05, 0.62);
  for (const s of [-1, 1]) put(sl, box(0.04, 0.12, 1.7), '#ffb627', s * 0.25, 0.68, 1.05, 0.62);
  for (const s of [-1, 1]) put(sl, cyl(0.025, 0.025, 1.3, 5), '#8a8f99', s * 0.22, 0.62, -0.62, 0.3);
  for (let i = 0; i < 4; i++) put(sl, box(0.44, 0.03, 0.04), '#8a8f99', 0, 0.22 + i * 0.26, -0.62 + (i * 0.26 - 0.4) * 0.31);
  g.add(sl);
  const sb = grp(x0 + 8.4, py - 0.1);
  for (const [bx, bz, bw, bd] of [[0, -0.6, 1.3, 0.1], [0, 0.6, 1.3, 0.1], [-0.6, 0, 0.1, 1.1], [0.6, 0, 0.1, 1.1]]) put(sb, box(bw, 0.18, bd), C.wood, bx, 0.09, bz);
  put(sb, box(1.12, 0.1, 1.12), '#f2d79a', 0, 0.05, 0);
  put(sb, cyl(0.12, 0.09, 0.18, 10), '#ef5b5b', -0.25, 0.18, 0.2);
  put(sb, cyl(0.16, 0.2, 0.18, 8), '#e8c87e', 0.2, 0.18, -0.15);
  put(sb, cone(0.1, 0.18, 6), '#e8c87e', 0.2, 0.36, -0.15);
  g.add(sb);
  // Paths, benches, lamps, sign
  stones(g, [[lot.x1 - 0.3, lot.z1 - 0.3], [px + 1.5, pz + rz + 0.9], [px - 1.4, pz + rz + 0.9], [gzx + 1.4, gzz + 1.2]], 0.45, 0.22);
  stones(g, [[px - 1.4, pz + rz + 0.9], [x0 + 2.4, py - 0.7]], 0.45, 0.2);
  for (const bx of [px - 0.2, px + 1.6]) {
    const b = buildBench();
    b.position.set(bx, 0, pz + rz + 1.55);
    b.rotation.y = PI;
    g.add(b);
  }
  lampPost(g, px - 1.8, pz + rz + 1.5);
  lampPost(g, lot.x1 - 1.0, pz - 0.4);
  const sg = grp(lot.x1 - 0.9, lot.z1 - 0.9, FACE_CAM);
  for (const s of [-0.6, 0.6]) put(sg, box(0.08, 1.0, 0.08), C.woodDark, s, 0.5, 0);
  signBoard(face(sg, 0, 0, 0.05), 'park', 0, 0.98, 1.3, 0.33);
  g.add(sg);
  addFlowers(c, gzx + 1.8, gzz - 1.2, 7);
  addFlowers(c, px + 2.9, pz + 1.3, 6);
  addFlowers(c, x0 + 4.2, py - 1.4, 6);
  c.garden.bushes.push({ x: px + 2.8, z: pz - 1.4, s: 0.8, flowers: true }, { x: x0 + 0.6, z: py - 1.6, s: 0.75 });
  return g;
}

let cattailGeo = null;
function cattail() {
  if (!cattailGeo) cattailGeo = new THREE.CapsuleGeometry(0.035, 0.12, 3, 6);
  return cattailGeo;
}

function lampPost(g, x, z) {
  put(g, cyl(0.1, 0.13, 0.16, 8), C.iron, x, 0.08, z);
  put(g, cyl(0.035, 0.045, 1.7, 6), C.iron, x, 0.95, z);
  put(g, cyl(0.13, 0.06, 0.1, 8), C.iron, x, 1.86, z);
  glow(g, sph(0.12, 10, 8), '#ffe3a0', x, 1.75, z);
  put(g, cone(0.17, 0.14, 8), C.iron, x, 1.97, z);
}

// 5: ice cream corner (across the road)
function umbrella(g, x, z, a, b, h = 1.6, r = 0.75) {
  put(g, cyl(0.025, 0.025, h, 5), C.white, x, h / 2, z);
  for (let i = 0; i < 8; i++) put(g, cyl(0, r, 0.32, 2, false, (i / 8) * TAU, TAU / 8), i % 2 ? b : a, x, h, z);
  put(g, sph(0.05, 6, 5), C.white, x, h + 0.18, z);
}

function picnicTable(g, x, z, ry) {
  const t = grp(x, z, ry);
  put(t, box(1.3, 0.07, 0.62), C.wood, 0, 0.68, 0);
  for (const s of [-1, 1]) {
    put(t, box(1.3, 0.06, 0.24), C.wood, 0, 0.4, s * 0.52);
    put(t, box(0.07, 0.72, 0.07), C.woodDark, s * 0.5, 0.34, -0.25, 0.5);
    put(t, box(0.07, 0.72, 0.07), C.woodDark, s * 0.5, 0.34, 0.25, -0.5);
  }
  g.add(t);
}

function iceCream(c) {
  const { lot } = c;
  const x0 = lot.x0, z0 = lot.z0;
  const g = grp();
  // Round kiosk with a striped cone canopy and a giant cone on top
  const kx = x0 + 2.4, kz = z0 + 1.9;
  const k = grp(kx, kz);
  put(k, cyl(1.0, 1.06, 1.0, 16), '#a8e6cf', 0, 0.5, 0);
  for (let i = 0; i < 8; i++) put(k, box(0.1, 1.0, 0.04), '#ff9ec7', Math.sin((i / 8) * TAU) * 1.035, 0.5, Math.cos((i / 8) * TAU) * 1.035, 0, (i / 8) * TAU, 0);
  put(k, cyl(1.16, 1.16, 0.1, 16), C.white, 0, 1.04, 0);
  k.add(mesh(tinted(cyl(0.98, 0.98, 0.55, 16, true), LIT), mats().win, 0, 1.36, 0, false));
  for (let i = 0; i < 6; i++) put(k, cyl(0.035, 0.035, 0.6, 5), C.white, Math.sin((i / 6) * TAU + 0.3) * 1.0, 1.38, Math.cos((i / 6) * TAU + 0.3) * 1.0);
  for (let i = 0; i < 12; i++) put(k, cyl(0, 1.5, 0.75, 2, false, (i / 12) * TAU, TAU / 12), i % 2 ? '#fffaf0' : '#ff86a6', 0, 2.06, 0);
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * TAU;
    const sc = put(k, cyl(0.38, 0.38, 0.03, 8, false, -PI / 2, PI), i % 2 ? '#fffaf0' : '#ff86a6', Math.sin(a) * 1.5, 1.68, Math.cos(a) * 1.5);
    sc.rotation.set(PI / 2, a, 0, 'YXZ');
  }
  put(k, cone(0.32, 0.85, 10), '#e8b06a', 0, 2.85, 0, PI);
  put(k, sph(0.36, 12, 10), '#ff9ec7', 0, 3.3, 0);
  put(k, sph(0.3, 12, 10), '#9be3c4', 0, 3.68, 0);
  put(k, sph(0.1, 8, 6), '#e8323c', 0, 3.98, 0);
  const sf = face(k, FACE_CAM, Math.sin(FACE_CAM) * 1.08, Math.cos(FACE_CAM) * 1.08);
  signBoard(sf, 'icecream', 0, 0.62, 1.1, 0.3);
  g.add(k);
  aoRing(c, kx, kz, 1.06, 0.45, 10);
  // Taco truck (serving hatch faces the picnic tables)
  const tx = x0 + 7.4, tz = z0 + 1.6;
  const t = grp(tx, tz);
  const body = '#ff8a5c';
  put(t, rbox(2.8, 1.5, 1.4, 0.18, 2), body, -0.25, 1.2, 0);
  put(t, rbox(2.82, 0.22, 1.42, 0.06, 1), '#fff1d6', -0.25, 0.75, 0);
  put(t, rbox(1.0, 1.05, 1.36, 0.16, 2), body, 1.6, 0.98, 0);
  t.add(mesh(tinted(box(0.06, 0.45, 1.1), LIT), mats().win, 2.1, 1.22, 0, false));
  t.add(mesh(tinted(box(0.6, 0.42, 0.06), LIT), mats().win, 1.6, 1.22, 0.68, false));
  put(t, rbox(0.2, 0.2, 1.42, 0.06, 1), '#d6d9de', 2.12, 0.5, 0);
  for (const [wx, wz] of [[-1.1, -0.68], [-1.1, 0.68], [1.5, -0.68], [1.5, 0.68]]) {
    put(t, cyl(0.3, 0.3, 0.2, 14), '#2a2a30', wx, 0.3, wz, PI / 2);
    put(t, cyl(0.13, 0.13, 0.22, 10), '#d6d9de', wx, 0.3, wz, PI / 2);
  }
  const hf = face(t, 0, -0.25, 0.71);
  put(hf, box(1.6, 0.62, 0.04), '#3a2a2a', 0, 1.35, 0);
  put(hf, rbox(1.75, 0.07, 0.3, 0.02, 1), C.white, 0, 1.0, 0.12);
  awning(hf, 0, 1.78, 1.9, 0.6, '#ffd23f', '#fffaf0', 0.5);
  for (let i = 0; i < 4; i++) put(hf, ico(0.07, 0), PETALS[i + 1], -0.5 + i * 0.32, 1.1, 0.14);
  const rs = face(t, 0, -0.25, 0.1, 1.95);
  for (const s of [-0.7, 0.7]) put(rs, box(0.05, 0.3, 0.05), C.iron, s, 0.12, 0);
  signBoard(rs, 'tacos', 0, 0.42, 1.5, 0.37);
  g.add(t);
  aoBox(c, tx + 0.25, tz, 3.8, 1.4, 0, 0.4);
  // Picnic tables with umbrellas, string lights between the kiosk and the truck
  picnicTable(g, x0 + 5.0, z0 + 3.1, 0.15);
  umbrella(g, x0 + 5.0, z0 + 3.1, '#ff86a6', '#fffaf0', 1.7, 0.8);
  picnicTable(g, x0 + 9.7, z0 + 3.2, -0.2);
  umbrella(g, x0 + 9.7, z0 + 3.2, '#4fb6c9', '#fffaf0', 1.7, 0.8);
  const a = [x0 + 3.6, 2.6, z0 + 3.5], b = [x0 + 10.6, 2.6, z0 + 3.1];
  for (const p of [a, b]) put(g, cyl(0.04, 0.05, 2.7, 6), C.woodDark, p[0], 1.35, p[2]);
  for (let i = 0; i <= 12; i++) {
    const tt = i / 12;
    glow(g, ico(0.065, 0), ['#ffd27a', '#ff9ec7', '#9ad8ff', '#b9f0a0'][i % 4], a[0] + (b[0] - a[0]) * tt, 2.56 - Math.sin(tt * PI) * 0.35, a[2] + (b[2] - a[2]) * tt);
  }
  bunting(g, [a[0], 2.6, a[2]], [b[0], 2.6, b[2]], 0.35, 12);
  addFlowers(c, x0 + 1.0, z0 + 0.4, 5);
  c.lights.push({ rank: 1, x: x0 + 7, y: 1.8, z: z0 + 3.2, color: '#ffc27a', intensity: 4, distance: 5.5 });
  return g;
}

// 6: townhouse row (faces the street)
function townhouse(row, hx, w, d, floors, wall, roofC, o = {}) {
  const fh = 1.3, g0 = o.shop ? 1.95 : 1.45, H = g0 + (floors - 1) * fh + 0.1;
  put(row, rbox(w, H, d, 0.05, 1), wall, hx, H / 2, -d / 2);
  put(row, box(w + 0.06, 0.26, d + 0.06), '#d9cfc0', hx, 0.13, -d / 2);
  for (let k = 1; k < floors; k++) put(row, box(w + 0.08, 0.07, d + 0.08), C.white, hx, g0 + (k - 1) * fh, -d / 2);
  const f = face(row, 0, hx, 0);
  if (o.shop) {
    put(f, rbox(w - 0.2, 1.45, 0.08, 0.03, 1), '#4a5fa8', 0, 0.75, 0.02);
    win(f, -0.32, 0.88, w - 1.25, 0.95, { frame: '#f6e7cf', plain: true });
    door(f, w / 2 - 0.55, 0.56, 1.3, '#f6e7cf', { glass: true, step: false });
    awning(f, 0, 1.52, w - 0.1, 0.6, '#5b8def', '#fffaf0');
    for (let i = 0; i < 5; i++) put(f, box(0.1, 0.14 + (i % 3) * 0.03, 0.06), PETALS[i], -0.85 + i * 0.13, 0.55, 0.09);
  } else {
    door(f, (o.doorSide || 1) * (w / 2 - 0.55), 0.56, 1.22, o.door || '#3fb8a8', { glass: true });
    win(f, -(o.doorSide || 1) * 0.42, 0.95, 0.7, 0.75, { box: o.seed || 1 });
    lantern(f, (o.doorSide || 1) * (w / 2 - 0.12), 1.25);
  }
  for (let k = 1; k < floors; k++) {
    const y = g0 + (k - 1) * fh + 0.7;
    for (const s of [-1, 1]) win(f, s * w * 0.22, y, 0.52, 0.68, { dim: (k + s + (o.seed || 0)) % 3 === 0, box: k === 1 && s > 0 ? 3 + (o.seed || 0) : 0 });
  }
  if (o.side) {
    const sf = face(row, PI / 2, hx + w / 2, -d / 2);
    for (let k = 1; k < floors; k++) win(sf, 0, g0 + (k - 1) * fh + 0.7, 0.52, 0.66, { dim: k === 2 });
  }
  if (o.flat) {
    put(row, rbox(w + 0.16, 0.3, d + 0.16, 0.05, 1), C.white, hx, H + 0.12, -d / 2);
    put(row, rbox(0.5, 0.6, 0.5, 0.04, 1), '#c8735a', hx - w * 0.25, H + 0.5, -d * 0.7);
    put(row, box(1.0, 0.3, 0.45), C.wood, hx + w * 0.12, H + 0.42, -d * 0.35);
    for (let i = 0; i < 4; i++) put(row, ico(0.17, 1), i % 2 ? '#5aa04a' : '#6fb85a', hx + w * 0.12 - 0.36 + i * 0.24, H + 0.64, -d * 0.35);
    put(row, box(0.6, 0.08, 0.6), '#8c4f3c', hx - w * 0.25, H + 0.82, -d * 0.7);
  } else {
    roof(row, hx, -d / 2, w, d, H, o.pitch || 1.0, wall, roofC, false, 0.18);
    const rf = face(row, 0, hx, 0, H);
    roundWin(rf, 0, 0.42, 0.16);
    put(row, rbox(0.36, 0.7, 0.36, 0.03, 1), '#c8735a', hx + w * 0.28, H + 0.6, -d * 0.75);
    put(row, box(0.46, 0.08, 0.46), '#8c4f3c', hx + w * 0.28, H + 0.97, -d * 0.75);
  }
  return H;
}

function townhouses(c) {
  const { lot } = c;
  const d = 3.0, fz = lot.z1 - 0.45;
  const g = grp(0, fz);
  const spec = [
    [2.5, 2, '#a8d8ff', '#5b6fb5', { shop: true }],
    [2.3, 3, '#ffb7c5', '#e8664f', { seed: 1, doorSide: -1, door: '#ffd23f' }],
    [2.4, 2, '#ffe08a', '#5fbf8f', { seed: 2, flat: true, door: '#ef5b5b' }],
    [2.4, 3, '#b7e8c8', '#b45a8c', { seed: 3, side: true, pitch: 1.2, door: '#5b6fb5' }],
  ];
  let x = lot.x0 + 0.2;
  for (const [w, floors, wall, roofC, o] of spec) {
    townhouse(g, x + w / 2, w, d, floors, wall, roofC, o);
    x += w;
  }
  signBoard(face(g, 0, lot.x0 + 0.2 + 1.25, 0.04), 'books', 0, 1.76, 1.2, 0.28);
  aoBox(c, (lot.x0 + 0.2 + x) / 2, fz - d / 2, x - lot.x0 - 0.2, d);
  for (const [bx, fl] of [[4.27, true], [5.78, false], [8.18, true]]) c.garden.bushes.push({ x: lot.x0 + bx, z: fz + 0.3, s: 0.45, flowers: fl });
  c.lights.push({ rank: 4, x: lot.x0 + 1.4, y: 1.4, z: fz + 0.9, color: '#ffc27a', intensity: 4, distance: 5 });
  return g;
}

// 7: windmill
function windmill(c) {
  const [cx, cz] = c.site;
  const g = grp(cx, cz, FACE_CAM);
  put(g, cyl(1.5, 1.6, 0.3, 12), '#cdbfae', 0, 0.15, 0);
  put(g, cyl(0.88, 1.28, 3.9, 10), '#fff6e6', 0, 2.25, 0);
  put(g, cyl(1.38, 1.38, 0.1, 14), C.wood, 0, 2.5, 0);
  put(g, torus(1.36, 0.03, 4, 24), C.woodDark, 0, 2.82, 0, PI / 2);
  for (let i = 0; i < 10; i++) put(g, cyl(0.025, 0.025, 0.32, 4), C.woodDark, Math.sin((i / 10) * TAU) * 1.36, 2.66, Math.cos((i / 10) * TAU) * 1.36);
  put(g, cone(1.12, 1.3, 10), '#e2574c', 0, 4.85, 0);
  put(g, sph(0.12, 8, 6), '#f2c94c', 0, 5.55, 0);
  const taper = Math.atan2(0.4, 3.9);
  const f = face(g, 0, 0, 1.25, 0.3);
  f.rotation.x = -taper;
  door(f, 0, 0.6, 1.05, '#5b8def', { step: false, frame: C.wood });
  const f2 = face(g, 0, 0, 1.2, 1.0);
  f2.rotation.x = -taper;
  win(f2, 0, 1.15, 0.4, 0.5, { frame: C.wood, plain: true });
  const f3 = face(g, PI / 2, 1.0, 0, 3.0);
  f3.rotation.set(-taper, PI / 2, 0, 'YXZ');
  win(f3, 0, 0.42, 0.36, 0.46, { frame: C.wood, plain: true });
  put(g, cyl(0.12, 0.14, 0.75, 8), C.woodDark, 0, 4.15, 1.2, PI / 2);
  // Sails (turn slowly about the axle that points at the camera, clear of the gallery)
  const sails = dyn(grp(0, 1.58, 0, 4.15));
  put(sails, sph(0.2, 10, 8), '#e2574c', 0, 0, 0.05);
  for (let i = 0; i < 4; i++) {
    const arm = grp();
    arm.rotation.z = (i * PI) / 2 + PI / 4;
    put(arm, box(0.1, 2.75, 0.08), C.woodDark, 0, 1.4, 0);
    put(arm, box(0.6, 1.95, 0.03), '#fffaf0', 0.36, 1.68, -0.02);
    for (let k = 0; k < 5; k++) put(arm, box(0.68, 0.04, 0.05), '#c9524a', 0.33, 0.75 + k * 0.46, 0.01);
    put(arm, box(0.04, 1.95, 0.05), '#c9524a', 0.66, 1.68, 0.01);
    sails.add(arm);
  }
  mergeStatic(sails, 'env');
  g.add(sails);
  c.anim.push((t) => { sails.rotation.z = -t * 0.55; });
  // Flour sacks and a little cart
  for (const [sx, sz, r] of [[1.25, 0.95, 0], [1.55, 0.7, 0.6], [1.4, 0.75, 0.3]]) put(g, sph(0.2, 8, 6), '#efe2c4', sx, 0.2 + (r > 0.5 ? 0.18 : 0), sz, 0, r, 0).scale.set(1, 1.2, 0.85);
  const cart = grp(-1.9, 0.6, 0.5);
  put(cart, box(0.9, 0.3, 0.6), C.wood, 0, 0.45, 0);
  put(cart, box(0.8, 0.12, 0.5), '#f2d79a', 0, 0.62, 0);
  for (const s of [-1, 1]) put(cart, cyl(0.25, 0.25, 0.06, 12), C.woodDark, 0.05, 0.25, s * 0.33, PI / 2);
  put(cart, cyl(0.025, 0.025, 0.8, 5), C.woodDark, 0.75, 0.38, 0, 0, 0, 1.3);
  g.add(cart);
  aoRing(c, cx, cz, 1.6, 0.5, 12);
  // Tulip rows
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) addFlowers(c, c.lot.x1 - 0.6 - k * 0.95, cz - 1.4 + i * 1.1, 8);
  c.lights.push({ rank: 1, x: cx + 1.2, y: 1.6, z: cz + 1.2, color: '#ffc27a', intensity: 3.5, distance: 4.5 });
  return g;
}

// 8: Ferris wheel
const _m4 = new THREE.Matrix4();
function ferrisWheel(c) {
  const [cx, cz] = c.site;
  const g = grp(cx, cz, FACE_CAM);
  const R = 3.3, hub = 4.5, n = 10, rimC = '#ff7aa2', spokeC = '#fff6ea', legC = '#7c8ee0';
  put(g, rbox(5.4, 0.3, 2.6, 0.08, 1), '#f3d9c9', 0, 0.15, 0);
  put(g, rbox(1.4, 0.16, 0.6, 0.04, 1), '#f3d9c9', 0, 0.08, 1.55);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) put(g, cyl(0.035, 0.035, 0.5, 5), C.white, s * (0.85 + i * 0.6), 0.55, 1.22);
    put(g, box(1.85, 0.05, 0.05), C.white, s * 1.75, 0.72, 1.22);
    put(g, cyl(0.04, 0.05, 0.75, 6), '#d8a845', s * 0.62, 0.68, 1.85);
  }
  put(g, cyl(0.025, 0.025, 1.24, 4), '#e04f6f', 0, 0.9, 1.85, 0, 0, PI / 2);
  for (const z of [-0.78, 0.78]) {
    for (const x of [-2.1, 2.1]) {
      const len = Math.hypot(x, hub - 0.3);
      put(g, cyl(0.09, 0.13, len, 8), legC, x / 2, 0.3 + (hub - 0.3) / 2, z, 0, 0, Math.asin(x / len));
    }
    put(g, cyl(0.06, 0.06, 2.6, 6), legC, 0, 1.5, z, 0, 0, PI / 2);
  }
  put(g, cyl(0.13, 0.13, 1.8, 10), '#c9cfe0', 0, hub, 0, PI / 2);
  // Ticket booth
  const tb = grp(3.3, 0.6);
  put(tb, rbox(0.9, 1.2, 0.8, 0.06, 1), '#ffd36e', 0, 0.6, 0);
  put(tb, cone(0.75, 0.5, 4), '#ff7aa2', 0, 1.45, 0, 0, PI / 4, 0);
  tb.add(mesh(tinted(box(0.55, 0.35, 0.05), LIT), mats().win, 0, 0.85, 0.41, false));
  g.add(tb);
  // Rotating wheel: two rims, spokes, cross bars and bulbs
  const wheel = dyn(grp(0, 0, 0, hub));
  for (const z of [-0.4, 0.4]) {
    put(wheel, torus(R, 0.08, 6, 48), rimC, 0, 0, z);
    put(wheel, torus(R * 0.52, 0.05, 6, 32), '#ffd36e', 0, 0, z);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      put(wheel, cyl(0.03, 0.03, R, 5), spokeC, (Math.cos(a) * R) / 2, (Math.sin(a) * R) / 2, z, 0, 0, a - PI / 2);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    put(wheel, cyl(0.035, 0.035, 0.88, 6), spokeC, Math.cos(a) * R, Math.sin(a) * R, 0, PI / 2);
  }
  put(wheel, cyl(0.32, 0.32, 0.9, 14), '#a77be8', 0, 0, 0, PI / 2);
  const bulbs = ['#fff1b8', '#ff9ec7', '#9ad8ff', '#ffd27a'];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    glow(wheel, ico(0.105, 0), bulbs[i % 4], Math.cos(a) * R, Math.sin(a) * R, 0.52);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    for (let k = 1; k <= 3; k++) glow(wheel, ico(0.07, 0), bulbs[(i + k) % 4], Math.cos(a) * R * (k / 4 + 0.05), Math.sin(a) * R * (k / 4 + 0.05), 0.46);
  }
  glow(wheel, cyl(0.24, 0.24, 0.06, 12), '#ffd27a', 0, 0, 0.47).rotation.x = PI / 2;
  mergeStatic(wheel, 'env');
  g.add(wheel);
  // Cabins: one instanced mesh that stays upright while the wheel turns
  const cab = grp();
  put(cab, rbox(0.62, 0.48, 0.56, 0.12, 1), '#ffffff', 0, -0.62, 0);
  put(cab, rbox(0.64, 0.16, 0.58, 0.04, 1), '#7e8796', 0, -0.52, 0);
  put(cab, cyl(0.06, 0.4, 0.22, 8), '#ffffff', 0, -0.28, 0);
  put(cab, cyl(0.025, 0.025, 0.3, 5), '#9aa0aa', 0, -0.1, 0);
  mergeStatic(cab, 'env');
  const src = cab.children[0];
  const cabins = new THREE.InstancedMesh(src.geometry, src.material, n);
  cabins.userData.dynamic = true;
  cabins.frustumCulled = false;
  cabins.castShadow = false;
  cabins.receiveShadow = true;
  const tints = ['#ff9aa2', '#ffd36e', '#8fd3ff', '#a8e6a1', '#c9a7ff'];
  for (let i = 0; i < n; i++) cabins.setColorAt(i, new THREE.Color(tints[i % tints.length]));
  g.add(cabins);
  c.disposers.push(() => cabins.dispose());
  const spin = (t) => {
    const a = t * 0.16;
    wheel.rotation.z = a;
    for (let i = 0; i < n; i++) {
      const th = a + (i / n) * TAU;
      _m4.makeRotationZ(Math.sin(t * 1.3 + i) * 0.04).setPosition(Math.cos(th) * R, hub + Math.sin(th) * R, 0);
      cabins.setMatrixAt(i, _m4);
    }
    cabins.instanceMatrix.needsUpdate = true;
  };
  spin(0);
  c.anim.push(spin);
  aoBox(c, cx, cz, 5.4, 2.6, FACE_CAM);
  return g;
}

// empty plots
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function emptyPlot(c, i, next) {
  const [x, z, w, d] = c.site;
  const g = grp();
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  pts.forEach(([px, pz], k) => {
    put(g, box(0.07, 0.5, 0.07), '#c99a64', px, 0.25, pz);
    put(g, box(0.035, 0.12, 0.14), '#ff7a59', px, 0.44, pz + 0.07);
    const [bx, bz] = pts[(k + 1) % 4], len = Math.hypot(bx - px, bz - pz);
    put(g, box(len, 0.018, 0.018), '#fff4e0', (px + bx) / 2, 0.38, (pz + bz) / 2, 0, -Math.atan2(bz - pz, bx - px), 0).castShadow = false;
  });
  const s = grp(x1 - 0.55, z1 - 0.45, FACE_CAM);
  for (const sx of [-0.5, 0.5]) put(s, box(0.08, 0.95, 0.08), C.woodDark, sx, 0.475, -0.05);
  put(s, rbox(1.28, 0.68, 0.07, 0.04, 1), C.woodDark, 0, 0.9, 0);
  s.add(mesh(signPlane(soonCell(i), 1.18, 0.59), mats().sign, 0, 0.9, 0.04, false));
  g.add(s);
  // The lawn grows a little wild until building starts
  const rnd = seeded(i * 7919 + 17), n = Math.round((w * d) / 5);
  for (let k = 0; k < n; k++) addFlowers(c, x0 + 0.5 + rnd() * (w - 1), z0 + 0.5 + rnd() * (d - 1), 4 + Math.floor(rnd() * 3));
  for (let k = 0; k < n * 2; k++) c.garden.tufts.push({ x: x0 + 0.3 + rnd() * (w - 0.6), z: z0 + 0.3 + rnd() * (d - 0.6), s: 0.8 + rnd() * 0.5 });
  if (w * d > 20) c.garden.bushes.push({ x: x0 + w * 0.3, z: z0 + d * 0.35, s: 0.8, flowers: true }, { x: x0 + w * 0.7, z: z0 + d * 0.6, s: 0.7 });
  // Next to open: a pallet of bricks and planks, a dirt pile and a shovel
  if (next) {
    const m = grp(x0 + 1.0, z1 - 0.9, 0.3);
    put(m, box(1.0, 0.12, 0.8), C.wood, 0, 0.06, 0);
    for (let k = 0; k < 6; k++) put(m, box(0.28, 0.14, 0.18), '#d0694f', -0.3 + (k % 3) * 0.3, 0.19 + Math.floor(k / 3) * 0.15, -0.18);
    for (let k = 0; k < 3; k++) put(m, box(0.95, 0.06, 0.12), '#e3b67f', 0, 0.15 + k * 0.065, 0.2, 0, 0.04 * k, 0);
    put(m, sph(0.45, 9, 5), '#8a6342', 1.0, -0.06, 0.35).scale.set(1, 0.6, 0.8);
    const sh = grp(1.05, 0.3, 0.6, 0.12);
    put(sh, cyl(0.025, 0.025, 0.85, 5), C.wood, 0, 0.42, 0, 0.3);
    put(sh, box(0.22, 0.26, 0.03), '#9aa3ad', 0, 0.02, -0.02, 0.3);
    m.add(sh);
    g.add(m);
  }
  return g;
}

const BUILDERS = [cottage, bakery, flowerMarket, park, iceCream, townhouses, windmill, ferrisWheel];

// town
// Everything for stages 1..level (plus "coming soon" stakes on the rest) in one group.
// userData: animate(t, dt), setNight(level01), lights (≤ 2 warm night lights), dispose().
export function buildTown(W, H, doorX, level = 0) {
  level = Math.max(0, Math.min(TOWN_STAGES.length, Math.floor(level) || 0));
  const cx = W / 2, cz = H / 2, r = Math.max(W, H) * 0.85 + 4;
  const caster = (x, z) => Math.hypot(x - cx, z - cz) < r;
  const town = new THREE.Group();
  town.name = 'town';
  const stat = new THREE.Group();
  town.add(stat);
  const ctx = { W, H, doorX, anim: [], lights: [], ao: [], disposers: [], garden: { trees: [], bushes: [], flowers: [], tufts: [] } };
  layout(W, H, doorX).forEach((p, i) => {
    const c = { ...ctx, lot: p.lot, site: p.site };
    const g = i < level ? BUILDERS[i](c) : emptyPlot(c, i, i === level);
    if (!caster(p.site[0], p.site[1])) g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    stat.add(g);
    for (const [x, z, s] of p.trees) ctx.garden.trees.push({ x, z, s });
  });
  mergeStatic(stat, 'env');
  if (ctx.ao.length) town.add(buildAOStrips(ctx.ao));
  town.add(buildGarden({ ...ctx.garden, chunk: () => 'town', caster }, W * 13 + H * 7 + 5));
  ctx.lights.sort((a, b) => b.rank - a.rank);
  town.userData = {
    level,
    animate: (t, dt) => { for (const f of ctx.anim) f(t, dt); },
    setNight,
    lights: ctx.lights.slice(0, 2),
    dispose: () => { for (const f of ctx.disposers) f(); },
  };
  return town;
}
