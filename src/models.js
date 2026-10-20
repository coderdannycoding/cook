// Procedural 3D models: characters, appliances, furniture, decor, food at every stage, plates
// and street props. Everything is built from primitives, with no external assets.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { SURFACE_Y } from './config.js';
import { itemKey, DISHES, itemFromKey, makePlate } from './recipes.js';
import { ginghamTexture, rugTexture, beltTexture, counterTopTexture } from './textures.js';
import { pick, TAU } from './utils.js';
import { LOOK, gradeColor, addRim, outlineMaterial, makeBlobShadow, buildGardenTree } from './look.js';
import { DECOR_BUILDERS } from './decor.js';
import { DECOR2_BUILDERS } from './decor2.js';

const S = SURFACE_Y;

// Material & geometry caches

const matCache = new Map();
// kind: 'prop' (default: appliances, furniture, food) and 'char' get the hit-game grade: a little
// extra chroma plus a warm sky rim so they pop, while 'env' keeps the authored colour, no rim.
export function mat(color, o = {}) {
  const kind = o.kind ?? 'prop';
  const key = `${color}|${o.r ?? ''}|${o.m ?? ''}|${o.e ?? ''}|${o.ei ?? ''}|${o.op ?? ''}|${o.flat ? 1 : 0}|${o.mapKey ?? ''}|${o.side ?? ''}|${kind}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: kind === 'env' ? color : gradeColor(color, kind === 'char' ? 1.12 : 1.1),
      roughness: o.r ?? 0.72,
      metalness: o.m ?? 0,
      emissive: o.e ?? '#000000',
      emissiveIntensity: o.ei ?? 1,
      flatShading: !!o.flat,
    });
    if (o.map) m.map = o.map;
    if (o.op !== undefined) {
      m.transparent = true;
      m.opacity = o.op;
      m.depthWrite = o.op > 0.7;
    }
    if (o.side) m.side = o.side;
    if (kind !== 'env') addRim(m, kind === 'char' ? LOOK.rimChar : LOOK.rimProp);
    matCache.set(key, m);
  }
  return m;
}

// Unique material (for per-object animated emissive etc.)
export function umat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: gradeColor(color, 1.1), roughness: o.r ?? 0.6, metalness: o.m ?? 0, emissive: o.e ?? '#000000', emissiveIntensity: o.ei ?? 1,
  });
  m.userData.unique = true;
  if (o.op !== undefined) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
  addRim(m, LOOK.rimProp);
  return m;
}

const geoCache = new Map();
function G(key, fn) {
  let g = geoCache.get(key);
  if (!g) { g = fn(); geoCache.set(key, g); }
  return g;
}

function makeRoundedBox(width, height, depth, radius, segments) {
  const seg = segments * 2 + 1;
  radius = Math.min(width / 2, height / 2, depth / 2, radius);
  const geo = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const bx = width / 2 - radius, by = height / 2 - radius, bz = depth / 2 - radius;
  const half = 0.5 / seg;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v);
    n.x -= Math.sign(n.x) * half;
    n.y -= Math.sign(n.y) * half;
    n.z -= Math.sign(n.z) * half;
    n.normalize();
    pos.setXYZ(i, bx * Math.sign(v.x) + n.x * radius, by * Math.sign(v.y) + n.y * radius, bz * Math.sign(v.z) + n.z * radius);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  return geo;
}

export const rbox = (w, h, d, r = 0.04, seg = 2) => G(`rb${w},${h},${d},${r},${seg}`, () => makeRoundedBox(w, h, d, r, seg));
export const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, seg = 18, open = false, ts = 0, tl = TAU) => G(`c${rt},${rb},${h},${seg},${open},${ts},${tl}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl));
export const sph = (r, ws = 18, hs = 12, ps = 0, pl = TAU, ts = 0, tl = Math.PI) => G(`s${r},${ws},${hs},${ps},${pl},${ts},${tl}`, () => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl));
export const cone = (r, h, seg = 14) => G(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const torus = (r, t, rs = 8, ts = 20, arc = TAU) => G(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
export const ico = (r, d = 1) => G(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
export const capsule = (r, l) => G(`cap${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));
// Low-poly capsule for tiny details (brows, whiskers) where 14 segments are wasted
const capsuleLo = (r, l) => G(`capl${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 2, 6));

const plateGeo = () => G('plate', () => {
  const pts = [
    [0, 0], [0.2, 0], [0.24, 0.012], [0.31, 0.044], [0.326, 0.05], [0.322, 0.058],
    [0.3, 0.054], [0.23, 0.026], [0, 0.026],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 28);
});

const bowlGeo = () => G('bowl', () => {
  const pts = [
    [0, 0], [0.12, 0], [0.13, 0.02], [0.22, 0.1], [0.255, 0.2], [0.24, 0.205], [0.205, 0.11], [0.12, 0.04], [0, 0.04],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 28);
});

export function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function rotated(m, axis, v) {
  m.rotation[axis] = v;
  return m;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Static mesh merging: collapses all non-dynamic meshes in a group into one mesh per
// material, dramatically cutting draw calls for furniture.

function isDynamic(o, root) {
  let p = o;
  while (p && p !== root) {
    if (p.userData.dynamic) return true;
    p = p.parent;
  }
  return false;
}

function mergeGeometries(geos, withUv, colors = null) {
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = withUv ? new Float32Array(count * 2) : null;
  const col = colors ? new Float32Array(count * 3) : null;
  let o = 0;
  geos.forEach((g, gi) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (uv && g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col) {
      // either a flat colour baked from the source material, or the geometry's own vertex colours
      const c = colors[gi];
      if (c) for (let k = o * 3, e = (o + n) * 3; k < e; k += 3) { col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; }
      else if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
      else col.fill(1, o * 3, (o + n) * 3);
    }
    o += n;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  out.userData.merged = true;
  return out;
}

// Free GPU resources owned by an object (merged geometries & unique materials). Cached ones are shared.
export function disposeObject(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry?.userData.merged || o.geometry?.userData.own) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) if (m?.userData.unique) m.dispose();
  });
}

// Plain opaque colours collapse into a handful of shared vertex-coloured materials (grouped by
// finish: matte / glossy / two metals, flat or smooth, one or two sided), so a whole appliance or
// character body is usually a single draw call.
const vcMats = new Map();
function vcMaterial(src, kind) {
  const metal = src.metalness >= 0.65 ? 0.75 : src.metalness >= 0.3 ? 0.45 : 0;
  const rough = metal ? (src.roughness < 0.36 ? 0.3 : 0.42) : kind === 'char' ? 0.68 : src.roughness < 0.45 ? 0.35 : 0.72;
  const key = `${kind}|${metal}|${rough}|${src.flatShading ? 1 : 0}|${src.side}`;
  let m = vcMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, flatShading: src.flatShading, side: src.side });
    if (kind !== 'env') addRim(m, kind === 'char' ? LOOK.rimChar : LOOK.rimProp);
    vcMats.set(key, m);
  }
  return m;
}
function canVertexColor(m) {
  if (!m.isMeshStandardMaterial || m.map || m.transparent || m.userData.unique || m.vertexColors) return false;
  return m.emissiveIntensity === 0 || m.emissive.r + m.emissive.g + m.emissive.b === 0;
}

export function mergeStatic(root, kind = 'prop') {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  const m4 = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o === root || isDynamic(o, root) || o.userData.noMerge) return;
    if (Array.isArray(o.material) || o.material.transparent) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    m4.multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(m4);
    const vc = canVertexColor(o.material);
    const material = vc ? vcMaterial(o.material, kind) : o.material;
    // Characters and pets decide shadow casting after merging, so their parts share one bucket
    const key = kind === 'char' ? material.uuid : `${material.uuid}|${o.castShadow}`;
    if (!buckets.has(key)) buckets.set(key, { material, cast: o.castShadow, geos: [], colors: material.vertexColors ? [] : null });
    const b = buckets.get(key);
    b.cast ||= o.castShadow;
    b.geos.push(g);
    if (b.colors) b.colors.push(vc ? o.material.color : null);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, !!b.material.map, b.colors);
    for (const g of b.geos) g.dispose();
    const m = new THREE.Mesh(merged, b.material);
    m.castShadow = b.cast;
    m.receiveShadow = true;
    root.add(m);
  }
  return root;
}

// Palette

export const C = {
  cab: '#3e9e8e', cabPanel: '#4fb3a2', plinth: '#2f3a3f', brass: '#d8a845',
  steel: '#cdd5dd', steelDark: '#5f6873', black: '#26282d', wood: '#c1844e', woodDark: '#87552c', woodLight: '#e3b67f',
  white: '#f7f6f1', cream: '#f3e6c8',
};

const steelMat = () => mat(C.steel, { r: 0.32, m: 0.75 });
const darkSteelMat = () => mat(C.steelDark, { r: 0.4, m: 0.6 });

const shadeHex = (c, k) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;

// A bar handle on two little posts, along x (or upright)
function barHandle(root, x, y, z, len, upright = false) {
  const brass = mat(C.brass, { r: 0.3, m: 0.8 });
  const bar = mesh(cyl(0.016, 0.016, len, 8), brass, x, y, z + 0.035);
  if (!upright) bar.rotation.z = Math.PI / 2;
  root.add(bar);
  for (const s of [-1, 1]) root.add(mesh(cyl(0.012, 0.012, 0.035, 6), brass, x + (upright ? 0 : s * len * 0.38), y + (upright ? s * len * 0.38 : 0), z + 0.017).rotateX(Math.PI / 2));
}

// Kitchen cabinet base: plinth, body, a drawer over two shaker doors (or an oven front), worktop
export function cabinet(root, o = {}) {
  const h = o.h ?? S;
  const body = o.body ?? C.cab;
  const panel = o.panel ?? C.cabPanel;
  root.add(mesh(box(0.86, 0.08, 0.86), mat(C.plinth), 0, 0.04, 0));
  const bh = h - 0.12;
  root.add(mesh(rbox(0.94, bh, 0.94, 0.035), mat(body, { r: 0.6 }), 0, 0.06 + bh / 2, 0));
  const pm = mat(panel, { r: 0.55 }), inset = mat(shadeHex(panel, 0.9), { r: 0.6 });
  const drawerY = h - 0.07 - 0.085;
  if (o.front === 'oven') {
    // Oven door with a tinted window and a long handle, a shallow drawer underneath
    const doorH = drawerY - 0.12 - 0.2;
    const doorY = 0.2 + doorH / 2;
    root.add(mesh(rbox(0.84, doorH, 0.035, 0.014), mat(shadeHex(body, 0.82), { r: 0.45, m: 0.3 }), 0, doorY, 0.462));
    root.add(mesh(rbox(0.6, doorH * 0.5, 0.012, 0.02), mat('#1a1c22', { r: 0.08, m: 0.3, e: '#ff7a2a', ei: 0.18 }), 0, doorY - 0.02, 0.482, false));
    barHandle(root, 0, doorY + doorH / 2 - 0.05, 0.48, 0.62);
    root.add(mesh(rbox(0.84, 0.1, 0.03, 0.012), pm, 0, 0.13, 0.465));
    barHandle(root, 0, 0.13, 0.48, 0.22);
  } else if (!o.noDoors) {
    root.add(mesh(rbox(0.84, 0.13, 0.03, 0.012), pm, 0, drawerY, 0.465));
    barHandle(root, 0, drawerY, 0.48, 0.2);
    const doorTop = drawerY - 0.085, doorH = doorTop - 0.12, doorY = 0.12 + doorH / 2;
    for (const x of [-0.21, 0.21]) {
      root.add(mesh(rbox(0.4, doorH, 0.03, 0.012), pm, x, doorY, 0.465));
      root.add(mesh(rbox(0.3, doorH - 0.1, 0.012, 0.01), inset, x, doorY, 0.482, false));
      barHandle(root, x > 0 ? x - 0.15 : x + 0.15, doorTop - 0.12, 0.48, 0.12, true);
    }
  }
  const top = o.top ?? 'butcher';
  let topMat;
  if (top === 'butcher') topMat = mat('#ffffff', { r: 0.65, map: counterTopTexture(), mapKey: 'butcher' });
  else if (top === 'steel') topMat = mat('#e1e6eb', { r: 0.28, m: 0.7 });
  else topMat = mat(top, { r: 0.5 });
  root.add(mesh(rbox(0.99, 0.07, 0.99, 0.025), topMat, 0, h - 0.035, 0));
}

export function finish(root, anchor, extra = {}) {
  root.userData.anchor = new THREE.Vector3(...anchor);
  Object.assign(root.userData, extra);
  mergeStatic(root);
  return root;
}

export function dyn(obj) {
  obj.userData.dynamic = true;
  return obj;
}

// Appliances

const BUILDERS = {};

BUILDERS.counter = () => {
  const r = new THREE.Group();
  cabinet(r);
  return finish(r, [0, S, 0]);
};

BUILDERS.pass = () => {
  const r = new THREE.Group();
  cabinet(r, { body: '#aab4be', panel: '#bdc6cf', top: 'steel' });
  const pole = mat('#3b4048', { r: 0.4, m: 0.6 });
  r.add(mesh(cyl(0.022, 0.022, 0.95, 8), pole, -0.44, S + 0.47, 0));
  r.add(mesh(cyl(0.022, 0.022, 0.95, 8), pole, 0.44, S + 0.47, 0));
  const bar = mesh(cyl(0.025, 0.025, 0.92, 8), pole, 0, S + 0.95, 0);
  bar.rotation.z = Math.PI / 2;
  r.add(bar);
  for (const x of [-0.2, 0.2]) {
    r.add(mesh(cone(0.13, 0.13, 16), mat('#c0392b', { r: 0.4 }), x, S + 0.86, 0));
    r.add(mesh(sph(0.05, 10, 8), mat('#ffd9a0', { e: '#ffb347', ei: 2.2 }), x, S + 0.8, 0, false));
  }
  r.add(mesh(sph(0.06, 12, 8, 0, TAU, 0, Math.PI / 2), mat('#e8b84a', { r: 0.25, m: 0.9 }), 0.36, S, 0.34));
  r.add(mesh(cyl(0.07, 0.07, 0.015, 12), mat('#3b4048'), 0.36, S + 0.005, 0.34));
  return finish(r, [0, S, 0], { heatLamp: true });
};

BUILDERS.board = (def) => {
  const r = new THREE.Group();
  const parts = {};
  if (def.auto) {
    cabinet(r, { body: '#4a5560', panel: '#5b6773', top: 'steel' });
    r.add(mesh(cyl(0.3, 0.32, 0.05, 20), mat('#2d3238'), 0, S + 0.02, 0));
    const blade = dyn(new THREE.Group());
    for (let i = 0; i < 3; i++) {
      const b = mesh(box(0.42, 0.012, 0.05), steelMat(), 0, 0, 0);
      b.rotation.y = (i * Math.PI) / 3;
      blade.add(b);
    }
    blade.position.set(0, S + 0.33, 0);
    r.add(blade);
    parts.blade = blade;
    const dome = mesh(sph(0.36, 20, 12, 0, TAU, 0, Math.PI / 2), mat('#bfe6ff', { op: 0.22, r: 0.1 }), 0, S + 0.02, 0, false);
    dome.userData.noMerge = true;
    r.add(dome);
    const light = dyn(mesh(sph(0.04, 8, 6), umat('#7dff8a', { e: '#36ff5a', ei: 0.4 }), 0.32, S - 0.12, 0.48, false));
    r.add(light);
    parts.light = light;
  } else {
    cabinet(r);
    r.add(mesh(rbox(0.66, 0.05, 0.5, 0.02), mat('#efd3a3', { r: 0.7 }), -0.04, S + 0.025, 0));
    r.add(mesh(cyl(0.02, 0.02, 0.05, 8), mat('#b08458'), 0.24, S + 0.03, -0.18));
    const knife = dyn(new THREE.Group());
    knife.add(mesh(box(0.06, 0.012, 0.26), mat('#dfe5ea', { r: 0.2, m: 0.85 }), 0, 0, 0.06));
    knife.add(mesh(rbox(0.045, 0.035, 0.13, 0.012), mat('#2b2b2b'), 0, 0.01, -0.13));
    knife.position.set(0.39, S + 0.02, 0.02);
    r.add(knife);
    parts.knife = knife;
  }
  return finish(r, [-0.02, S + 0.05, 0], { parts });
};

BUILDERS.crate = (def) => {
  const r = new THREE.Group();
  const wood = mat('#c08a54', { r: 0.8 });
  const woodD = mat('#8a5b30', { r: 0.8 });
  r.add(mesh(box(0.84, 0.66, 0.84), mat('#4a2f19'), 0, 0.36, 0));
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < 3; k++) {
      const p = mesh(rbox(0.9, 0.18, 0.05, 0.015), k % 2 ? woodD : wood, 0, 0.14 + k * 0.23, 0.44);
      const g = new THREE.Group();
      g.add(p);
      g.rotation.y = (side * Math.PI) / 2;
      r.add(g);
    }
  }
  for (const [x, z] of [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]]) {
    r.add(mesh(box(0.1, 0.76, 0.1), woodD, x, 0.38, z));
  }
  // Pile of the raw ingredient inside
  const rnd = seeded(hash(def.ing));
  const spots = [[-0.2, -0.2], [0.18, -0.18], [-0.18, 0.18], [0.2, 0.2], [0, 0]];
  for (let i = 0; i < spots.length; i++) {
    const m = ingredientMesh(def.ing, 'raw', null, def.ing + i);
    m.position.set(spots[i][0] + (rnd() - 0.5) * 0.06, 0.66 + (i === 4 ? 0.08 : 0), spots[i][1] + (rnd() - 0.5) * 0.06);
    m.rotation.y = rnd() * TAU;
    m.scale.setScalar(0.9);
    r.add(m);
  }
  // Label
  r.add(mesh(rbox(0.46, 0.2, 0.03, 0.02), mat('#fff6e0'), 0, 0.45, 0.475));
  return finish(r, [0, 0.8, 0]);
};

BUILDERS.cooker = (def) => {
  const r = new THREE.Group();
  const parts = {};
  const type = def.cook;
  if (type === 'stove') {
    cabinet(r, { body: '#3b3f46', panel: '#4b5058', top: '#1f2125', front: 'oven' });
    const burnerMat = umat('#333', { e: '#ff5a1a', ei: 0 });
    const burner = dyn(mesh(torus(0.2, 0.022, 6, 28), burnerMat, 0, S + 0.01, 0, false));
    burner.rotation.x = Math.PI / 2;
    r.add(burner);
    parts.glowMat = burnerMat;
    for (let i = 0; i < 4; i++) {
      const g = mesh(box(0.56, 0.02, 0.03), mat('#15161a'), 0, S + 0.02, 0);
      g.rotation.y = (i * Math.PI) / 4;
      r.add(g);
    }
    r.add(mesh(cyl(0.27, 0.23, 0.07, 26), mat('#1d1f23', { r: 0.45, m: 0.5 }), 0, S + 0.06, 0));
    r.add(mesh(cyl(0.24, 0.24, 0.072, 26), mat('#34373d', { r: 0.35, m: 0.6 }), 0, S + 0.062, 0));
    const handle = mesh(rbox(0.22, 0.035, 0.06, 0.015), mat('#1d1f23'), 0.36, S + 0.08, 0);
    r.add(handle);
    for (const x of [-0.25, 0, 0.25]) {
      const k = mesh(cyl(0.045, 0.045, 0.05, 12), mat('#d64541'), x, S - 0.14, 0.49);
      k.rotation.x = Math.PI / 2;
      r.add(k);
    }
    return finish(r, [0, S + 0.1, 0], { parts });
  }
  if (type === 'pot') {
    cabinet(r, { body: '#3b3f46', panel: '#4b5058', top: '#1f2125', front: 'oven' });
    const burnerMat = umat('#333', { e: '#ff5a1a', ei: 0 });
    const burner = dyn(mesh(torus(0.22, 0.02, 6, 28), burnerMat, 0, S + 0.01, 0, false));
    burner.rotation.x = Math.PI / 2;
    r.add(burner);
    parts.glowMat = burnerMat;
    r.add(mesh(cyl(0.33, 0.3, 0.36, 28), steelMat(), 0, S + 0.18, 0));
    const rim = mesh(torus(0.325, 0.022, 6, 28), steelMat(), 0, S + 0.36, 0);
    rim.rotation.x = Math.PI / 2;
    r.add(rim);
    for (const x of [-0.36, 0.36]) {
      const h = mesh(torus(0.06, 0.016, 6, 12, Math.PI), darkSteelMat(), x, S + 0.3, 0);
      h.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
      r.add(h);
    }
    const water = dyn(mesh(cyl(0.305, 0.305, 0.02, 28), mat('#8fc4d8', { r: 0.15, m: 0.1 }), 0, S + 0.33, 0, false));
    r.add(water);
    parts.water = water;
    return finish(r, [0, S + 0.33, 0], { parts });
  }
  if (type === 'oven') {
    cabinet(r, { body: '#9a4a35', panel: '#ad5840', top: '#d8cbb6', noDoors: true });
    for (let k = 0; k < 3; k++) r.add(mesh(box(0.95, 0.02, 0.95), mat('#7b3826'), 0, 0.25 + k * 0.22, 0));
    const dome = mesh(sph(0.42, 24, 12, 0, TAU, 0, Math.PI / 2), mat('#c9673f', { r: 0.85, flat: false }), 0, S, -0.1);
    dome.scale.set(1, 0.95, 1);
    r.add(dome);
    r.add(rotated(mesh(torus(0.42, 0.03, 6, 28), mat('#a85234'), 0, S + 0.01, -0.1), 'x', Math.PI / 2));
    const mouth = mesh(sph(0.2, 16, 10, 0, TAU, 0, Math.PI / 2), mat('#1a0e0a'), 0, S, 0.22);
    mouth.scale.set(1.1, 0.95, 0.5);
    r.add(mouth);
    const glowMat = umat('#ff7a2a', { e: '#ff5a10', ei: 0.3 });
    const glow = dyn(mesh(sph(0.15, 12, 8, 0, TAU, 0, Math.PI / 2), glowMat, 0, S + 0.01, 0.2, false));
    glow.scale.set(1.1, 0.8, 0.5);
    r.add(glow);
    parts.glowMat = glowMat;
    r.add(mesh(cyl(0.07, 0.085, 0.42, 12), mat('#5a5047'), 0.16, S + 0.5, -0.24));
    r.add(mesh(cyl(0.09, 0.09, 0.05, 12), mat('#3f3832'), 0.16, S + 0.72, -0.24));
    return finish(r, [0, S + 0.01, 0.26], { parts, itemScale: 0.8 });
  }
  if (type === 'fryer') {
    cabinet(r, { body: '#9aa4ae', panel: '#aeb8c1', top: 'steel' });
    r.add(mesh(box(0.74, 0.03, 0.62), mat('#2a2d31'), 0, S + 0.005, 0.04));
    const oilMat = umat('#e0a63a', { e: '#c06a10', ei: 0.15, r: 0.15 });
    const oil = dyn(mesh(box(0.66, 0.02, 0.54), oilMat, 0, S + 0.02, 0.04, false));
    r.add(oil);
    parts.glowMat = oilMat;
    r.add(mesh(rbox(0.86, 0.22, 0.12, 0.03), mat('#c5cdd5', { r: 0.3, m: 0.6 }), 0, S + 0.1, -0.42));
    r.add(mesh(sph(0.03, 8, 6), mat('#ff4d4d', { e: '#ff2020', ei: 1.4 }), -0.25, S + 0.12, -0.355, false));
    r.add(mesh(sph(0.03, 8, 6), mat('#6dff7a', { e: '#20ff40', ei: 1.4 }), -0.15, S + 0.12, -0.355, false));
    const basket = mesh(box(0.04, 0.04, 0.32), mat('#2b2b2b'), 0.22, S + 0.12, -0.2);
    basket.rotation.x = -0.6;
    r.add(basket);
    return finish(r, [0, S + 0.03, 0.04], { parts });
  }
  return finish(r, [0, S, 0]);
};

BUILDERS.sink = () => {
  const r = new THREE.Group();
  const parts = {};
  cabinet(r, { body: '#dfe6ea', panel: '#eef2f4', top: 'steel' });
  r.add(mesh(box(0.56, 0.03, 0.56), mat('#6c7783', { r: 0.3, m: 0.7 }), -0.14, S + 0.005, 0.03));
  r.add(mesh(box(0.5, 0.012, 0.5), mat('#9bd7f0', { r: 0.05, m: 0.1 }), -0.14, S + 0.02, 0.03, false));
  r.add(mesh(cyl(0.025, 0.03, 0.34, 10), steelMat(), -0.14, S + 0.17, -0.4));
  const spout = mesh(cyl(0.022, 0.022, 0.22, 10), steelMat(), -0.14, S + 0.33, -0.3);
  spout.rotation.x = Math.PI / 2;
  r.add(spout);
  r.add(mesh(cyl(0.03, 0.02, 0.05, 10), steelMat(), -0.14, S + 0.3, -0.2));
  for (const x of [-0.24, -0.04]) r.add(mesh(cyl(0.03, 0.03, 0.04, 8), mat('#d64541'), x, S + 0.06, -0.42));
  for (let k = 0; k < 5; k++) r.add(mesh(box(0.28, 0.015, 0.03), mat('#b9c3cc', { r: 0.3, m: 0.6 }), 0.31, S + 0.008, -0.24 + k * 0.12));
  const dirty = dyn(new THREE.Group());
  dirty.position.set(-0.14, S + 0.02, 0.03);
  r.add(dirty);
  const clean = dyn(new THREE.Group());
  clean.position.set(0.31, S + 0.015, 0.02);
  clean.scale.setScalar(0.75);
  r.add(clean);
  parts.dirty = dirty;
  parts.clean = clean;
  return finish(r, [0.31, S + 0.02, 0], { parts });
};

BUILDERS.autowasher = () => {
  const r = new THREE.Group();
  const parts = {};
  cabinet(r, { body: '#eef2f5', panel: '#f6f8fa', top: 'steel', noDoors: true });
  const win = mesh(cyl(0.24, 0.24, 0.03, 24), mat('#1d3d5c', { r: 0.05, m: 0.3 }), 0, 0.45, 0.47);
  win.rotation.x = Math.PI / 2;
  r.add(win);
  const ring = mesh(torus(0.25, 0.03, 8, 24), steelMat(), 0, 0.45, 0.48);
  r.add(ring);
  r.add(mesh(rbox(0.84, 0.13, 0.03, 0.012), mat('#d9e0e6', { r: 0.4 }), 0, S - 0.14, 0.465));
  r.add(mesh(box(0.2, 0.06, 0.01), mat('#16323f', { r: 0.1, e: '#3fd4ff', ei: 0.35 }), -0.18, S - 0.14, 0.483, false));
  for (const x of [0.05, 0.13, 0.21]) r.add(mesh(cyl(0.022, 0.022, 0.02, 10), mat(x > 0.2 ? '#e8343f' : '#8d99ae'), x, S - 0.14, 0.485).rotateX(Math.PI / 2));
  const lightMat = umat('#8affc1', { e: '#00ff88', ei: 0.2 });
  const light = dyn(mesh(sph(0.035, 8, 6), lightMat, 0.32, 0.82, 0.48, false));
  r.add(light);
  parts.lightMat = lightMat;
  const suds = dyn(new THREE.Group());
  for (let i = 0; i < 6; i++) suds.add(mesh(sph(0.04 + (i % 3) * 0.015, 8, 6), mat('#ffffff', { r: 0.2 }), Math.cos(i) * 0.12, Math.sin(i * 2) * 0.1, 0, false));
  suds.position.set(0, 0.45, 0.5);
  suds.visible = false;
  r.add(suds);
  parts.suds = suds;
  const dirty = dyn(new THREE.Group());
  dirty.position.set(-0.22, S, 0);
  dirty.scale.setScalar(0.7);
  r.add(dirty);
  const clean = dyn(new THREE.Group());
  clean.position.set(0.22, S, 0);
  clean.scale.setScalar(0.7);
  r.add(clean);
  parts.dirty = dirty;
  parts.clean = clean;
  return finish(r, [0.22, S, 0], { parts });
};

BUILDERS.platerack = () => {
  const r = new THREE.Group();
  const parts = {};
  cabinet(r);
  const wood = mat('#a8703f');
  r.add(mesh(box(0.74, 0.05, 0.62), wood, 0, S + 0.025, 0));
  for (const x of [-0.35, 0.35]) {
    r.add(mesh(box(0.04, 0.42, 0.04), wood, x, S + 0.21, -0.28));
    r.add(mesh(box(0.04, 0.42, 0.04), wood, x, S + 0.21, 0.28));
    r.add(mesh(box(0.04, 0.04, 0.6), wood, x, S + 0.4, 0));
  }
  const plates = dyn(new THREE.Group());
  plates.position.set(0, S + 0.02, 0);
  r.add(plates);
  parts.plates = plates;
  return finish(r, [0, S, 0], { parts });
};

BUILDERS.trash = () => {
  const r = new THREE.Group();
  const parts = {};
  const bin = mat('#5b8a72', { r: 0.4, m: 0.4 }), binDark = mat('#46705b', { r: 0.4, m: 0.4 });
  r.add(mesh(cyl(0.3, 0.25, 0.8, 22), bin, 0, 0.4, 0));
  // vertical flutes
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const f = mesh(box(0.03, 0.62, 0.02), binDark, Math.sin(a) * 0.285, 0.4, Math.cos(a) * 0.285);
    f.rotation.set(0.0625, a, 0, 'YXZ');
    r.add(f);
  }
  for (const y of [0.06, 0.74]) {
    const band = mesh(torus(y < 0.4 ? 0.255 : 0.295, 0.022, 6, 24), binDark, 0, y, 0);
    band.rotation.x = Math.PI / 2;
    r.add(band);
  }
  // recycling label and the foot pedal
  r.add(mesh(rbox(0.2, 0.2, 0.02, 0.06), mat('#f7f6f1', { r: 0.6 }), 0, 0.44, 0.285));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const ar = mesh(box(0.08, 0.02, 0.01), mat('#2fbf5f'), Math.sin(a) * 0.045, 0.44 + Math.cos(a) * 0.045, 0.3, false);
    ar.rotation.z = -a + Math.PI / 2;
    r.add(ar);
  }
  r.add(mesh(rbox(0.2, 0.04, 0.14, 0.015), mat('#2f3a3f', { r: 0.4, m: 0.5 }), 0, 0.03, 0.3));
  const lid = dyn(new THREE.Group());
  lid.add(mesh(cyl(0.32, 0.32, 0.05, 22), mat('#4c7b63', { r: 0.4, m: 0.4 }), 0, 0, 0.3));
  lid.add(mesh(cyl(0.26, 0.3, 0.05, 22), mat('#4c7b63', { r: 0.4, m: 0.4 }), 0, 0.045, 0.3));
  lid.add(mesh(rbox(0.16, 0.04, 0.05, 0.015), mat('#2f3a3f'), 0, 0.085, 0.42));
  lid.position.set(0, 0.82, -0.3);
  r.add(lid);
  parts.lid = lid;
  return finish(r, [0, 0.86, 0], { parts });
};

BUILDERS.extinguisher = () => {
  const r = new THREE.Group();
  const parts = {};
  r.add(mesh(rbox(0.6, 0.06, 0.6, 0.02), mat('#5d636b'), 0, 0.03, 0));
  r.add(mesh(rbox(0.16, 1.5, 0.12, 0.03), mat('#c0392b', { r: 0.5 }), 0, 0.75, -0.24));
  const sign = mesh(rbox(0.42, 0.26, 0.04, 0.02), mat('#e74c3c', { e: '#ff2a1a', ei: 0.35 }), 0, 1.36, -0.17);
  r.add(sign);
  r.add(mesh(box(0.3, 0.05, 0.05), mat('#ffffff', { e: '#ffffff', ei: 0.4 }), 0, 1.36, -0.145));
  r.add(mesh(box(0.05, 0.18, 0.05), mat('#ffffff', { e: '#ffffff', ei: 0.4 }), 0, 1.36, -0.145));
  r.add(mesh(rbox(0.3, 0.05, 0.16, 0.02), mat('#3b4048'), 0, 0.3, -0.12));
  const ext = dyn(buildExtinguisher());
  ext.position.set(0, 0.33, -0.08);
  r.add(ext);
  parts.ext = ext;
  return finish(r, [0, 0.35, 0], { parts });
};

BUILDERS.conveyor = () => {
  const r = new THREE.Group();
  const frame = mat('#5c6670', { r: 0.4, m: 0.6 });
  for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {
    r.add(mesh(box(0.06, 0.74, 0.06), frame, x, 0.37, z));
  }
  r.add(mesh(box(0.9, 0.04, 0.9), frame, 0, 0.3, 0));
  for (const x of [-0.45, 0.45]) r.add(mesh(rbox(0.07, 0.14, 1.0, 0.02), mat('#f1c40f', { r: 0.5 }), x, 0.8, 0));
  for (const z of [-0.47, 0.47]) {
    const roller = mesh(cyl(0.05, 0.05, 0.82, 12), steelMat(), 0, 0.78, z);
    roller.rotation.z = Math.PI / 2;
    r.add(roller);
  }
  const belt = mesh(box(0.82, 0.05, 0.98), mat('#ffffff', { map: beltTexture(), mapKey: 'belt', r: 0.8 }), 0, 0.8, 0);
  belt.userData.noMerge = true;
  r.add(belt);
  return finish(r, [0, 0.83, 0]);
};

BUILDERS.grabber = () => {
  const r = new THREE.Group();
  const parts = {};
  r.add(mesh(rbox(0.82, 0.06, 0.82, 0.02), mat('#5c6670', { r: 0.45, m: 0.6 }), 0, 0.03, 0));
  for (const [x, z] of [[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]]) r.add(mesh(cyl(0.03, 0.03, 0.03, 8), steelMat(), x, 0.07, z));
  r.add(mesh(cyl(0.32, 0.36, 0.5, 20), mat('#3b4048', { r: 0.5, m: 0.4 }), 0, 0.3, 0));
  r.add(mesh(cyl(0.33, 0.33, 0.04, 20), steelMat(), 0, 0.55, 0));
  r.add(mesh(rbox(0.16, 0.1, 0.03, 0.02), mat('#1d2228'), 0, 0.3, 0.34));
  r.add(mesh(sph(0.025, 8, 6), mat('#7dff8a', { e: '#36ff5a', ei: 0.8 }), -0.04, 0.3, 0.36, false));
  r.add(mesh(sph(0.025, 8, 6), mat('#ffd23f', { e: '#ffb020', ei: 0.6 }), 0.04, 0.3, 0.36, false));
  for (let i = 0; i < 8; i++) {
    const s = mesh(box(0.1, 0.08, 0.02), mat(i % 2 ? '#f1c40f' : '#222'), Math.sin((i / 8) * TAU) * 0.335, 0.48, Math.cos((i / 8) * TAU) * 0.335);
    s.rotation.y = (i / 8) * TAU;
    r.add(s);
  }
  const turret = dyn(new THREE.Group());
  turret.position.set(0, 0.55, 0);
  turret.add(mesh(cyl(0.12, 0.14, 0.12, 14), mat('#f1c40f', { r: 0.45 }), 0, 0.06, 0));
  turret.add(mesh(cyl(0.05, 0.05, 0.5, 10), steelMat(), 0, 0.35, 0));
  turret.add(mesh(sph(0.07, 10, 8), mat('#f1c40f'), 0, 0.6, 0));
  const arm = mesh(rbox(0.07, 0.07, 0.42, 0.02), steelMat(), 0, 0.6, 0.21);
  turret.add(arm);
  turret.add(mesh(cyl(0.025, 0.025, 0.3, 8), mat('#f1c40f', { r: 0.4 }), 0, 0.45, 0.12).rotateX(0.9));
  turret.add(mesh(cyl(0.05, 0.05, 0.05, 10), mat('#222'), 0, 0.6, 0.42));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const f = mesh(box(0.025, 0.13, 0.025), mat('#222'), Math.sin(a) * 0.05, 0.52, 0.42 + Math.cos(a) * 0.05);
    f.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
    turret.add(f);
  }
  const hold = new THREE.Group();
  hold.position.set(0, 0.35, 0.42);
  turret.add(hold);
  r.add(turret);
  parts.turret = turret;
  parts.hold = hold;
  return finish(r, [0, 0.9, 0], { parts });
};

// Chairs & tables
function chair(root, x, z, faceX, faceZ, color = '#a0612f', seatColor = '#c47a3c') {
  const g = new THREE.Group();
  const wood = mat(color, { r: 0.7 });
  g.add(mesh(rbox(0.46, 0.06, 0.46, 0.02), mat(seatColor, { r: 0.6 }), 0, 0.46, 0));
  for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) g.add(mesh(box(0.05, 0.45, 0.05), wood, lx, 0.225, lz));
  g.add(mesh(rbox(0.46, 0.46, 0.06, 0.03), wood, 0, 0.75, -0.21));
  g.add(mesh(box(0.05, 0.3, 0.05), wood, -0.18, 0.58, -0.21));
  g.add(mesh(box(0.05, 0.3, 0.05), wood, 0.18, 0.58, -0.21));
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(faceX, faceZ);
  root.add(g);
}

function booth(root, x, z, faceX, faceZ) {
  const g = new THREE.Group();
  const velvet = mat('#9c2f45', { r: 0.85 });
  const trim = mat('#5a2a1a', { r: 0.6 });
  g.add(mesh(rbox(0.9, 0.42, 0.62, 0.05), trim, 0, 0.21, -0.05));
  g.add(mesh(rbox(0.86, 0.14, 0.58, 0.06), velvet, 0, 0.47, -0.04));
  g.add(mesh(rbox(0.9, 0.95, 0.16, 0.06), velvet, 0, 0.82, -0.36));
  g.add(mesh(rbox(0.94, 0.08, 0.2, 0.03), trim, 0, 1.32, -0.36));
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(faceX, faceZ);
  root.add(g);
}

function stool(root, x, z) {
  const g = new THREE.Group();
  const metal = mat('#dfe5ea', { r: 0.2, m: 0.85 });
  g.add(mesh(cyl(0.17, 0.2, 0.03, 16), metal, 0, 0.015, 0));
  g.add(mesh(cyl(0.035, 0.035, 0.42, 10), metal, 0, 0.22, 0));
  g.add(rotated(mesh(torus(0.13, 0.012, 6, 18), metal, 0, 0.17, 0), 'x', Math.PI / 2));
  g.add(mesh(cyl(0.21, 0.2, 0.07, 18), mat('#e8343f', { r: 0.45 }), 0, 0.46, 0));
  g.add(rotated(mesh(torus(0.205, 0.014, 6, 22), mat('#fff6ea'), 0, 0.46, 0), 'x', Math.PI / 2));
  g.position.set(x, 0, z);
  root.add(g);
}

function armchair(root, x, z, faceX, faceZ) {
  const g = new THREE.Group();
  const velvet = mat('#1f7a5c', { r: 0.85 });
  const dark = mat('#17604a', { r: 0.85 });
  const brass = mat(C.brass, { r: 0.3, m: 0.8 });
  g.add(mesh(rbox(0.66, 0.24, 0.6, 0.06), dark, 0, 0.2, 0));
  g.add(mesh(rbox(0.56, 0.12, 0.52, 0.05), velvet, 0, 0.38, 0.03));
  g.add(mesh(rbox(0.68, 0.62, 0.18, 0.08), velvet, 0, 0.66, -0.24));
  g.add(rotated(mesh(cyl(0.34, 0.34, 0.18, 20, false, -Math.PI / 2, Math.PI), velvet, 0, 0.94, -0.24), 'x', -Math.PI / 2));
  for (const s of [1, -1]) {
    g.add(mesh(rbox(0.13, 0.32, 0.58, 0.05), velvet, s * 0.3, 0.46, 0.0));
    g.add(mesh(cyl(0.025, 0.02, 0.08, 8), brass, s * 0.26, 0.04, 0.24));
    g.add(mesh(cyl(0.025, 0.02, 0.08, 8), brass, s * 0.26, 0.04, -0.24));
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(faceX, faceZ);
  root.add(g);
}

BUILDERS.table = (def) => {
  const r = new THREE.Group();
  const [w, d] = def.size;
  const off = (cx, cz) => [cx + 0.5 - w / 2, cz + 0.5 - d / 2];
  const tableCells = def.cells.filter((c) => c[2] === 'table').map((c) => off(c[0], c[1]));
  const minX = Math.min(...tableCells.map((c) => c[0])), maxX = Math.max(...tableCells.map((c) => c[0]));
  const minZ = Math.min(...tableCells.map((c) => c[1])), maxZ = Math.max(...tableCells.map((c) => c[1]));
  const tx = (minX + maxX) / 2, tz = (minZ + maxZ) / 2;
  const tw = maxX - minX + 0.92, td = maxZ - minZ + 0.92;
  const style = def.style || (def.id === 'booth' ? 'booth' : 'basic');
  const topY = 0.78;
  if (style === 'round') {
    r.add(mesh(cyl(0.66, 0.66, 0.04, 32), mat('#fff4e0', { r: 0.8 }), tx, topY - 0.01, tz));
    r.add(mesh(cyl(0.67, 0.71, 0.2, 32, true), mat('#ffe2b8', { r: 0.85, side: THREE.DoubleSide }), tx, topY - 0.12, tz));
    r.add(mesh(cyl(0.4, 0.4, 0.012, 24), mat('#ffffff', { map: ginghamTexture('#2fbf5f'), mapKey: 'gingham-green', r: 0.9 }), tx, topY + 0.016, tz));
    r.add(mesh(cyl(0.07, 0.09, topY - 0.05, 12), mat('#3a2a1e'), tx, (topY - 0.05) / 2, tz));
    r.add(mesh(cyl(0.3, 0.33, 0.04, 18), mat('#3a2a1e'), tx, 0.02, tz));
  } else if (style === 'bar') {
    const front = Math.sign(def.cells.find((c) => c[2] === 'seat')[1] + 0.5 - d / 2 - tz) || 1;
    r.add(mesh(rbox(tw + 0.04, 0.06, td + 0.1, 0.025), mat('#e8343f', { r: 0.35 }), tx, topY - 0.03, tz + front * 0.05));
    r.add(mesh(rbox(tw + 0.08, 0.03, td + 0.14, 0.012), mat('#dfe5ea', { r: 0.2, m: 0.85 }), tx, topY - 0.07, tz + front * 0.05));
    r.add(mesh(rbox(tw - 0.06, topY - 0.08, td - 0.3, 0.03), mat('#8fd3c1', { r: 0.5 }), tx, (topY - 0.08) / 2, tz - front * 0.12));
    for (let i = 0; i < 3; i++) r.add(mesh(box(tw - 0.04, 0.025, 0.012), mat('#dfe5ea', { r: 0.2, m: 0.85 }), tx, 0.2 + i * 0.18, tz - front * 0.12 + front * (td - 0.3) / 2 + front * 0.004));
    for (const sx of [-1, 1]) {
      r.add(mesh(cyl(0.03, 0.03, 0.14, 10), mat(sx > 0 ? '#e8343f' : '#ffd23f', { r: 0.3 }), tx + sx * (tw / 2 - 0.12), topY + 0.07, tz - front * 0.18));
      r.add(mesh(cone(0.02, 0.05, 8), mat(sx > 0 ? '#e8343f' : '#ffd23f', { r: 0.3 }), tx + sx * (tw / 2 - 0.12), topY + 0.165, tz - front * 0.18));
    }
  } else if (style === 'lounge') {
    r.add(mesh(rbox(tw, 0.05, td, 0.025), mat('#f1ede6', { r: 0.2 }), tx, topY - 0.025, tz));
    r.add(mesh(rbox(tw - 0.04, 0.03, td - 0.04, 0.012), mat(C.brass, { r: 0.3, m: 0.8 }), tx, topY - 0.06, tz));
    const legX = tw / 2 - 0.12, legZ = td / 2 - 0.12;
    for (const [lx, lz] of [[-legX, -legZ], [legX, -legZ], [-legX, legZ], [legX, legZ]]) r.add(mesh(cyl(0.025, 0.018, topY - 0.07, 8), mat(C.brass, { r: 0.3, m: 0.8 }), tx + lx, (topY - 0.07) / 2, tz + lz));
  } else if (tableCells.length === 1 && style !== 'booth') {
    const cloth = style === 'parasol' ? ginghamTexture('#ffbb1f') : ginghamTexture('#d94545');
    r.add(mesh(cyl(0.47, 0.47, 0.05, 28), mat(style === 'parasol' ? '#f4f1e6' : '#8a5a33', { r: 0.6 }), tx, topY - 0.025, tz));
    r.add(mesh(cyl(0.5, 0.5, 0.03, 28), mat('#ffffff', { map: cloth, mapKey: style === 'parasol' ? 'gingham-yellow' : 'gingham-red', r: 0.9 }), tx, topY + 0.01, tz));
    r.add(mesh(cyl(0.05, 0.07, topY - 0.05, 10), mat('#3a2a1e'), tx, (topY - 0.05) / 2, tz));
    r.add(mesh(cyl(0.24, 0.26, 0.04, 16), mat('#3a2a1e'), tx, 0.02, tz));
  } else {
    r.add(mesh(rbox(tw, 0.06, td, 0.025), mat(style === 'booth' ? '#6b3e22' : '#9a6538', { r: 0.55 }), tx, topY - 0.03, tz));
    if (style !== 'booth') r.add(mesh(box(tw - 0.06, 0.02, 0.32), mat('#ffffff', { map: ginghamTexture('#3a7bd5'), mapKey: 'gingham-blue', r: 0.9 }), tx, topY + 0.005, tz));
    const legX = tw / 2 - 0.1, legZ = td / 2 - 0.1;
    for (const [lx, lz] of [[-legX, -legZ], [legX, -legZ], [-legX, legZ], [legX, legZ]]) {
      r.add(mesh(box(0.06, topY - 0.06, 0.06), mat('#3a2a1e'), tx + lx, (topY - 0.06) / 2, tz + lz));
    }
  }
  if (style === 'parasol') {
    // striped sunshade, high enough that the table & guests stay readable from above
    r.add(mesh(cyl(0.022, 0.022, 1.7, 8), mat('#f4f1e6'), tx + 0.05, 0.85 + 0.75, tz + 0.05));
    for (let i = 0; i < 8; i++) r.add(mesh(cyl(0.03, 0.78, 0.3, 3, false, (i / 8) * TAU, TAU / 8), mat(i % 2 ? '#fff6ea' : '#ff5a4a', { r: 0.6 }), tx + 0.05, 2.38, tz + 0.05));
    r.add(mesh(sph(0.045, 10, 8), mat(C.brass, { r: 0.3, m: 0.8 }), tx + 0.05, 2.55, tz + 0.05));
  }
  // Candle + flowers centrepiece
  if (style !== 'bar') {
    r.add(mesh(cyl(0.035, 0.04, 0.12, 10), mat('#f6f0e0'), tx + 0.08, topY + 0.07, tz - 0.05));
    r.add(mesh(sph(0.025, 8, 6), mat('#ffd27a', { e: '#ffaa33', ei: 2 }), tx + 0.08, topY + 0.15, tz - 0.05, false));
    r.add(mesh(cyl(0.04, 0.03, 0.1, 10), mat('#7fb8d8', { r: 0.2 }), tx - 0.09, topY + 0.06, tz + 0.04));
    r.add(mesh(sph(0.045, 8, 6), mat('#ff6b8b'), tx - 0.09, topY + 0.14, tz + 0.04));
  }
  // Seats
  for (const c of def.cells) {
    if (c[2] !== 'seat') continue;
    const [sx, sz] = off(c[0], c[1]);
    let fx = 0, fz = 0;
    // face toward nearest table cell
    let best = Infinity;
    for (const [cx, cz] of tableCells) {
      const dd = Math.hypot(cx - sx, cz - sz);
      if (dd < best) { best = dd; fx = cx - sx; fz = cz - sz; }
    }
    if (style === 'booth') booth(r, sx, sz, fx, fz);
    else if (style === 'bar') stool(r, sx, sz);
    else if (style === 'lounge') armchair(r, sx, sz, fx, fz);
    else if (style === 'parasol') chair(r, sx, sz, fx, fz, '#2f6b4f', '#3f8f6a');
    else if (style === 'round') chair(r, sx, sz, fx, fz, '#a0612f', c[0] === 1 ? '#e2b04a' : '#c47a3c');
    else chair(r, sx, sz, fx, fz);
  }
  return finish(r, [tx, topY + 0.02, tz], { tableTop: topY });
};

// Decor
BUILDERS.plant = () => {
  const r = new THREE.Group();
  r.add(mesh(cyl(0.26, 0.2, 0.42, 16), mat('#c96a43', { r: 0.8 }), 0, 0.21, 0));
  r.add(rotated(mesh(torus(0.26, 0.035, 6, 18), mat('#b65b38'), 0, 0.42, 0), 'x', Math.PI / 2));
  r.add(mesh(cyl(0.24, 0.24, 0.03, 16), mat('#4a3020'), 0, 0.42, 0));
  const leaf = mat('#3f8f45', { r: 0.8 });
  const leaf2 = mat('#62b452', { r: 0.8 });
  const leaf3 = mat('#8fd060', { r: 0.8 });
  r.add(mesh(ico(0.3, 2), leaf, 0, 0.72, 0));
  r.add(mesh(ico(0.22, 1), leaf2, 0.15, 0.92, 0.08));
  r.add(mesh(ico(0.2, 1), leaf2, -0.14, 0.88, -0.1));
  r.add(mesh(ico(0.17, 1), leaf3, 0.02, 1.08, 0.02));
  r.add(mesh(ico(0.12, 1), leaf3, 0.12, 0.8, 0.22));
  const root = finish(r, [0, 1.2, 0]);
  return root;
};

BUILDERS.palm = () => {
  const r = new THREE.Group();
  r.add(mesh(cyl(0.28, 0.22, 0.38, 8), mat('#e8dcc8', { r: 0.6 }), 0, 0.19, 0));
  r.add(mesh(cyl(0.26, 0.26, 0.03, 8), mat('#4a3020'), 0, 0.38, 0));
  const trunk = mat('#9a6b3c', { flat: true });
  for (let i = 0; i < 5; i++) r.add(mesh(cyl(0.07 - i * 0.006, 0.08 - i * 0.006, 0.26, 7), trunk, Math.sin(i * 0.5) * 0.04, 0.5 + i * 0.24, 0));
  const fr = mat('#3f9b4f', { flat: true, side: THREE.DoubleSide });
  const fr2 = mat('#5bbd5e', { flat: true, side: THREE.DoubleSide });
  const top = new THREE.Group();
  top.position.set(0.1, 1.65, 0);
  for (let i = 0; i < 7; i++) {
    const f = mesh(cone(0.12, 0.85, 4), i % 2 ? fr : fr2, 0, 0, 0.38);
    f.rotation.x = Math.PI / 2 + 0.55;
    f.scale.set(1, 1, 0.25);
    const g = new THREE.Group();
    g.add(f);
    g.rotation.y = (i / 7) * TAU;
    top.add(g);
  }
  r.add(top);
  return finish(r, [0, 1.6, 0]);
};

BUILDERS.rug = () => {
  const r = new THREE.Group();
  const m = mesh(new THREE.PlaneGeometry(1.86, 1.86), mat('#ffffff', { map: rugTexture(), mapKey: 'rug', r: 0.95 }), 0, 0.012, 0, false);
  m.rotation.x = -Math.PI / 2;
  r.add(m);
  const fr = mat('#e8c070');
  for (const z of [-0.95, 0.95]) {
    for (let i = 0; i < 12; i++) r.add(mesh(box(0.02, 0.01, 0.07), fr, -0.85 + i * 0.155, 0.012, z, false));
  }
  return finish(r, [0, 0.02, 0]);
};

BUILDERS.lamp = () => {
  const r = new THREE.Group();
  const brass = mat('#c9a04a', { r: 0.3, m: 0.85 });
  r.add(mesh(cyl(0.22, 0.25, 0.05, 18), brass, 0, 0.025, 0));
  r.add(mesh(cyl(0.025, 0.025, 1.45, 8), brass, 0, 0.75, 0));
  r.add(mesh(cyl(0.16, 0.3, 0.32, 18, true), mat('#f7e2b5', { e: '#ffcf7a', ei: 0.35, side: THREE.DoubleSide }), 0, 1.5, 0));
  r.add(mesh(sph(0.08, 10, 8), mat('#fff3d0', { e: '#ffd27a', ei: 3 }), 0, 1.42, 0, false));
  return finish(r, [0, 1.42, 0], { light: { y: 1.4, color: '#ffc67a', intensity: 6, distance: 5 } });
};

BUILDERS.jukebox = () => {
  const r = new THREE.Group();
  const parts = {};
  r.add(mesh(rbox(0.8, 1.15, 0.55, 0.08), mat('#7a2e8e', { r: 0.4 }), 0, 0.58, 0));
  const arch = mesh(cyl(0.4, 0.4, 0.55, 24, false, -Math.PI / 2, Math.PI), mat('#8e3aa5', { r: 0.4 }), 0, 1.15, 0);
  arch.rotation.x = Math.PI / 2;
  arch.rotation.z = Math.PI / 2;
  r.add(arch);
  r.add(mesh(rbox(0.6, 0.36, 0.05, 0.03), mat('#1a1a2e'), 0, 0.42, 0.27));
  for (let i = 0; i < 6; i++) r.add(mesh(box(0.5, 0.015, 0.02), mat('#c9a04a', { m: 0.8, r: 0.3 }), 0, 0.3 + i * 0.05, 0.3));
  const stripeMats = [];
  for (let i = 0; i < 3; i++) {
    const m = umat('#ffffff', { e: '#ff3ea5', ei: 1.5 });
    stripeMats.push(m);
    const s = dyn(mesh(rbox(0.08, 0.7, 0.04, 0.02), m, -0.28 + i * 0.28, 0.95, 0.27, false));
    r.add(s);
  }
  parts.stripes = stripeMats;
  const window = mesh(cyl(0.22, 0.22, 0.04, 20, false, -Math.PI / 2, Math.PI), mat('#ffe9a8', { e: '#ffcc55', ei: 0.8 }), 0, 1.15, 0.27, false);
  window.rotation.x = Math.PI / 2;
  window.rotation.z = Math.PI / 2;
  r.add(window);
  return finish(r, [0, 1.5, 0], {
    parts,
    light: { y: 1.2, color: '#ff6ad5', intensity: 4, distance: 3.5 },
    animate(t) {
      stripeMats.forEach((m, i) => m.emissive.setHSL((t * 0.15 + i * 0.33) % 1, 0.9, 0.55));
    },
  });
};

BUILDERS.fishtank = () => {
  const r = new THREE.Group();
  r.add(mesh(rbox(1.9, 0.6, 0.8, 0.04), mat('#5a3a24'), 0, 0.3, 0));
  r.add(mesh(box(1.82, 0.06, 0.72), mat('#e8d8b0'), 0, 0.63, 0));
  const glass = mesh(box(1.84, 0.8, 0.74), mat('#a8e4ff', { op: 0.28, r: 0.05 }), 0, 1.0, 0, false);
  glass.userData.noMerge = true;
  r.add(glass);
  const water = mesh(box(1.78, 0.68, 0.68), mat('#3fa9d8', { op: 0.25, r: 0.1 }), 0, 0.96, 0, false);
  water.userData.noMerge = true;
  r.add(water);
  r.add(mesh(box(1.86, 0.05, 0.76), mat('#2d3238'), 0, 1.42, 0));
  for (let i = 0; i < 5; i++) {
    r.add(mesh(cone(0.05, 0.35 + (i % 3) * 0.1, 5), mat('#3fbf6a', { flat: true }), -0.7 + i * 0.35, 0.82, -0.18 + (i % 2) * 0.3));
  }
  r.add(mesh(ico(0.1, 0), mat('#9e9e9e', { flat: true }), 0.5, 0.7, 0.1));
  const fishes = [];
  const fishColors = ['#ff8c1a', '#ffd23f', '#ff5e7e', '#5ec8ff'];
  for (let i = 0; i < 5; i++) {
    const f = dyn(new THREE.Group());
    f.add(mesh(sph(0.06, 10, 8), mat(fishColors[i % 4]), 0, 0, 0, false));
    f.children[0].scale.set(1.5, 1, 0.6);
    const tail = mesh(cone(0.05, 0.08, 4), mat(fishColors[i % 4]), -0.11, 0, 0, false);
    tail.rotation.z = Math.PI / 2;
    tail.scale.set(1, 1, 0.3);
    f.add(tail);
    f.userData.seed = i * 1.7;
    r.add(f);
    fishes.push(f);
  }
  return finish(r, [0, 1.5, 0], {
    light: { y: 1.0, color: '#7fd8ff', intensity: 3, distance: 3 },
    animate(t) {
      for (const f of fishes) {
        const s = f.userData.seed;
        const a = t * (0.4 + s * 0.05) + s;
        const x = Math.sin(a) * 0.72;
        const dx = Math.cos(a);
        f.position.set(x, 0.85 + Math.sin(t * 0.7 + s) * 0.18 + 0.15, Math.sin(a * 1.7 + s) * 0.18);
        f.rotation.y = dx > 0 ? 0 : Math.PI;
      }
    },
  });
};

BUILDERS.fountain = () => {
  const r = new THREE.Group();
  const stone = mat('#d9d2c5', { r: 0.8 });
  const stone2 = mat('#c4bcad', { r: 0.8 });
  r.add(mesh(cyl(0.95, 1.0, 0.4, 8), stone, 0, 0.2, 0));
  r.add(mesh(cyl(0.82, 0.82, 0.05, 8), mat('#4fb0d9', { r: 0.1, m: 0.2, e: '#0a3550', ei: 0.4 }), 0, 0.38, 0));
  r.add(mesh(cyl(0.14, 0.18, 0.75, 10), stone2, 0, 0.75, 0));
  r.add(mesh(cyl(0.42, 0.18, 0.16, 10), stone, 0, 1.15, 0));
  r.add(mesh(cyl(0.36, 0.36, 0.03, 10), mat('#4fb0d9', { r: 0.1, m: 0.2, e: '#0a3550', ei: 0.4 }), 0, 1.22, 0));
  r.add(mesh(sph(0.1, 10, 8), stone2, 0, 1.33, 0));
  return finish(r, [0, 1.4, 0], { fountain: true });
};

export function buildAppliance(def) {
  if (def.station === 'cooker') return BUILDERS.cooker(def);
  if (def.station === 'crate') return BUILDERS.crate(def);
  if (def.station === 'table') return BUILDERS.table(def);
  if (def.station === 'board') return BUILDERS.board(def);
  const b = BUILDERS[def.id] || DECOR_BUILDERS[def.id] || DECOR2_BUILDERS[def.id];
  if (b) return b(def);
  const r = new THREE.Group();
  cabinet(r);
  return finish(r, [0, S, 0]);
}

// Food

const FOODC = {
  lettuce: '#6cc04a', lettuce2: '#a6e36f', tomato: '#ff4a3d', tomatoIn: '#ff8a70', bun: '#e2a35a', bunTop: '#d98f45',
  meatRaw: '#d64b5d', pattyRaw: '#e2707c', pattyCooked: '#7a4326', grill: '#3d2014', cheese: '#ffd23f',
  dough: '#f3dfb6', crust: '#e3a857', crustRim: '#d4913f', sauce: '#d63a2a', rice: '#fbfbf5', salmon: '#ff8c69',
  nori: '#1f3b2c', noodles: '#f6e2a1', egg: '#fff8ec', yolk: '#ffa31a', tortilla: '#f1d38f', potato: '#c99b5a',
  fry: '#f6c453', shrimp: '#ff9e80', batter: '#e9a640', berry: '#5b3cc4', berry2: '#7b3fc4', burnt: '#2b211d',
};

function charred(rnd) {
  const g = new THREE.Group();
  const m = mat(FOODC.burnt, { flat: true, r: 0.95 });
  const a = mesh(ico(0.15, 1), m, 0, 0.06, 0);
  a.scale.set(1.2, 0.5, 1);
  g.add(a);
  for (let i = 0; i < 3; i++) {
    g.add(mesh(ico(0.05, 0), m, (rnd() - 0.5) * 0.25, 0.06, (rnd() - 0.5) * 0.25));
  }
  g.add(mesh(sph(0.025, 6, 4), mat('#ff5a1a', { e: '#ff3300', ei: 1.2 }), 0.05, 0.11, 0.02, false));
  return g;
}

function pizzaMesh(state, toppings) {
  const g = new THREE.Group();
  const baked = state === 'baked';
  const burnt = state === 'burnt';
  const tops = toppings || [];
  const isTart = tops.includes('berries');
  if (burnt) {
    g.add(mesh(cyl(0.24, 0.24, 0.04, 24), mat('#231b17', { r: 0.95 }), 0, 0.02, 0));
    g.add(rotated(mesh(torus(0.23, 0.03, 6, 24), mat('#1a1411', { r: 0.95 }), 0, 0.04, 0), 'x', Math.PI / 2));
    return g;
  }
  g.add(mesh(cyl(0.24, 0.24, 0.035, 26), mat(baked ? FOODC.crust : FOODC.dough, { r: 0.85 }), 0, 0.018, 0));
  const rim = mesh(torus(0.23, isTart ? 0.035 : 0.028, 6, 26), mat(baked ? FOODC.crustRim : '#ecd09a', { r: 0.85 }), 0, 0.038, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  let y = 0.04;
  if (tops.includes('tomato')) {
    g.add(mesh(cyl(0.2, 0.2, 0.01, 24), mat(baked ? '#b8321f' : FOODC.sauce, { r: 0.4 }), 0, y, 0));
    y += 0.006;
  }
  if (tops.includes('cheese')) {
    if (isTart) {
      g.add(mesh(cyl(0.2, 0.2, 0.04, 24), mat(baked ? '#fbe7b5' : '#fff3d6', { r: 0.6 }), 0, y + 0.015, 0));
      y += 0.035;
    } else if (baked) {
      g.add(mesh(cyl(0.19, 0.19, 0.01, 24), mat('#ffd45c', { r: 0.45 }), 0, y + 0.002, 0));
      const rnd = seeded(77);
      for (let i = 0; i < 7; i++) {
        const a = rnd() * TAU, d = rnd() * 0.15;
        const s = mesh(sph(0.025, 6, 4), mat('#d18b2c'), Math.cos(a) * d, y + 0.006, Math.sin(a) * d, false);
        s.scale.set(1, 0.25, 1);
        g.add(s);
      }
      y += 0.008;
    } else {
      const rnd = seeded(31);
      for (let i = 0; i < 16; i++) {
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.17;
        const s = mesh(box(0.06, 0.012, 0.018), mat(FOODC.cheese), Math.cos(a) * d, y + 0.008, Math.sin(a) * d, false);
        s.rotation.y = rnd() * TAU;
        g.add(s);
      }
      y += 0.01;
    }
  }
  if (tops.includes('meat')) {
    const rnd = seeded(5);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + rnd() * 0.4, d = i === 6 ? 0 : 0.12;
      g.add(mesh(cyl(0.04, 0.04, 0.012, 12), mat(baked ? '#a3301f' : '#e06b75', { r: 0.6 }), Math.cos(a) * d, y + 0.008, Math.sin(a) * d, false));
    }
  }
  if (tops.includes('berries')) {
    const rnd = seeded(9);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.16;
      g.add(mesh(sph(0.03, 8, 6), mat(baked ? '#4a1f78' : FOODC.berry, { r: 0.3 }), Math.cos(a) * d, y + 0.02, Math.sin(a) * d, false));
    }
  }
  return g;
}

export function ingredientMesh(id, state, toppings = null, seedStr = '') {
  const rnd = seeded(hash(id + state + seedStr));
  const g = new THREE.Group();
  if (id === 'dough' && state !== 'raw') return pizzaMesh(state, toppings);
  if (state === 'burnt') return charred(rnd);
  switch (id) {
    case 'lettuce': {
      if (state === 'raw') {
        const a = mesh(ico(0.17, 1), mat(FOODC.lettuce, { flat: true }), 0, 0.15, 0);
        a.scale.set(1, 0.88, 1);
        g.add(a);
        g.add(mesh(ico(0.12, 1), mat(FOODC.lettuce2, { flat: true }), 0.06, 0.22, 0.05));
        g.add(mesh(ico(0.1, 1), mat('#4fa53a', { flat: true }), -0.08, 0.12, 0.08));
      } else {
        for (let i = 0; i < 9; i++) {
          const p = mesh(box(0.1, 0.02, 0.08), mat(i % 2 ? FOODC.lettuce : FOODC.lettuce2, { flat: true }), (rnd() - 0.5) * 0.24, 0.015 + rnd() * 0.05, (rnd() - 0.5) * 0.24, false);
          p.rotation.set(rnd() * 0.6, rnd() * TAU, rnd() * 0.6);
          g.add(p);
        }
      }
      break;
    }
    case 'tomato': {
      if (state === 'raw') {
        const t = mesh(sph(0.15, 18, 14), mat(FOODC.tomato, { r: 0.35 }), 0, 0.13, 0);
        t.scale.set(1, 0.86, 1);
        g.add(t);
        g.add(mesh(cyl(0.012, 0.015, 0.06, 6), mat('#3e7d2a'), 0, 0.28, 0));
        for (let i = 0; i < 5; i++) {
          const l = mesh(box(0.08, 0.01, 0.025), mat('#4f9a35'), Math.cos((i / 5) * TAU) * 0.04, 0.255, Math.sin((i / 5) * TAU) * 0.04, false);
          l.rotation.y = -(i / 5) * TAU;
          g.add(l);
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 0.09, z = (rnd() - 0.5) * 0.06;
          const s = mesh(cyl(0.085, 0.085, 0.03, 16), mat(FOODC.tomato, { r: 0.4 }), x, 0.02 + i * 0.008, z, false);
          s.rotation.z = (i - 1) * 0.12;
          g.add(s);
          g.add(mesh(cyl(0.065, 0.065, 0.032, 16), mat(FOODC.tomatoIn, { r: 0.5 }), x, 0.021 + i * 0.008, z, false));
        }
      }
      break;
    }
    case 'bun': {
      g.add(bunBottom());
      const top = bunTop();
      top.position.y = 0.07;
      g.add(top);
      break;
    }
    case 'meat': {
      if (state === 'raw') {
        g.add(mesh(rbox(0.32, 0.12, 0.24, 0.045), mat(FOODC.meatRaw, { r: 0.55 }), 0, 0.06, 0));
        const fat = mesh(rbox(0.3, 0.05, 0.04, 0.015), mat('#f7dede'), 0, 0.1, 0.03, false);
        fat.rotation.y = 0.3;
        g.add(fat);
        g.add(rotated(mesh(cyl(0.025, 0.025, 0.14, 8), mat('#f4efe6'), 0.19, 0.08, 0), 'z', Math.PI / 2));
        g.add(mesh(sph(0.035, 8, 6), mat('#f4efe6'), 0.27, 0.08, 0.02));
        g.add(mesh(sph(0.035, 8, 6), mat('#f4efe6'), 0.27, 0.08, -0.03));
      } else {
        g.add(patty(state));
      }
      break;
    }
    case 'cheese': {
      if (state === 'raw') {
        const w = mesh(cyl(0.19, 0.19, 0.15, 3), mat(FOODC.cheese, { r: 0.5 }), 0, 0.075, 0);
        w.rotation.y = 0.3;
        g.add(w);
        for (let i = 0; i < 4; i++) {
          g.add(mesh(sph(0.025, 8, 6), mat('#e8b52a'), Math.cos(i * 1.6) * 0.07, 0.15, Math.sin(i * 1.6) * 0.07, false));
        }
      } else {
        g.add(cheeseSlice());
      }
      break;
    }
    case 'dough': {
      const d = mesh(sph(0.15, 16, 12), mat(FOODC.dough, { r: 0.85 }), 0, 0.1, 0);
      d.scale.set(1, 0.72, 1);
      g.add(d);
      g.add(mesh(sph(0.04, 8, 6), mat('#fffaf0', { r: 1 }), 0.05, 0.19, 0.03, false));
      break;
    }
    case 'rice': {
      if (state === 'raw') {
        const sack = mesh(sph(0.16, 14, 10), mat('#d8c49a', { flat: true, r: 0.95 }), 0, 0.15, 0);
        sack.scale.set(1, 1.05, 0.85);
        g.add(sack);
        g.add(mesh(cyl(0.06, 0.09, 0.08, 10), mat('#d8c49a', { flat: true }), 0, 0.32, 0));
        g.add(rotated(mesh(torus(0.065, 0.015, 6, 12), mat('#8a5a30'), 0, 0.3, 0), 'x', Math.PI / 2));
        g.add(mesh(box(0.14, 0.1, 0.01), mat('#ffffff'), 0, 0.15, 0.14, false));
        g.add(mesh(sph(0.03, 6, 4), mat('#d94545'), 0, 0.15, 0.15, false));
      } else {
        g.add(riceMound());
      }
      break;
    }
    case 'fish': {
      if (state === 'raw') {
        const body = mesh(sph(0.13, 16, 10), mat('#a9bccb', { r: 0.35, m: 0.3 }), 0, 0.1, 0);
        body.scale.set(1.7, 0.8, 0.75);
        g.add(body);
        const belly = mesh(sph(0.12, 14, 8), mat('#ffb49a', { r: 0.5 }), 0, 0.075, 0);
        belly.scale.set(1.6, 0.6, 0.72);
        g.add(belly);
        const tail = mesh(cone(0.09, 0.14, 4), mat('#8fa5b5', { r: 0.4, m: 0.3 }), -0.26, 0.1, 0);
        tail.rotation.z = Math.PI / 2;
        tail.scale.set(1, 1, 0.3);
        g.add(tail);
        g.add(mesh(sph(0.025, 8, 6), mat('#111'), 0.16, 0.13, 0.065, false));
        g.add(mesh(sph(0.025, 8, 6), mat('#111'), 0.16, 0.13, -0.065, false));
      } else if (state === 'chopped') {
        g.add(salmonSlices(rnd));
      } else {
        const f = mesh(rbox(0.32, 0.08, 0.14, 0.04), mat(FOODC.batter, { flat: true, r: 0.8 }), 0, 0.045, 0);
        f.rotation.y = 0.4;
        g.add(f);
        for (let i = 0; i < 6; i++) g.add(mesh(ico(0.025, 0), mat('#d38a2a', { flat: true }), (rnd() - 0.5) * 0.24, 0.09, (rnd() - 0.5) * 0.12, false));
      }
      break;
    }
    case 'nori': {
      for (let i = 0; i < 3; i++) {
        const s = mesh(box(0.28, 0.01, 0.28), mat(FOODC.nori, { r: 0.35 }), 0, 0.006 + i * 0.012, 0);
        s.rotation.y = i * 0.2;
        g.add(s);
      }
      break;
    }
    case 'noodles': {
      if (state === 'raw') {
        g.add(mesh(rbox(0.28, 0.1, 0.2, 0.03), mat('#f2dc9a', { r: 0.8 }), 0, 0.05, 0));
        for (let i = 0; i < 5; i++) {
          const w = mesh(torus(0.03, 0.008, 4, 10), mat('#fff0bf'), -0.1 + i * 0.05, 0.1, 0, false);
          w.rotation.x = Math.PI / 2;
          g.add(w);
        }
      } else {
        const n = mesh(G('noodleKnot', () => new THREE.TorusKnotGeometry(0.1, 0.022, 64, 6, 2, 5)), mat(FOODC.noodles, { r: 0.5 }), 0, 0.06, 0);
        n.scale.set(1, 0.45, 1);
        g.add(n);
      }
      break;
    }
    case 'egg': {
      if (state === 'raw') {
        const e = mesh(sph(0.085, 14, 10), mat(FOODC.egg, { r: 0.4 }), 0, 0.11, 0);
        e.scale.set(1, 1.3, 1);
        g.add(e);
      } else {
        g.add(eggHalves());
      }
      break;
    }
    case 'tortilla': {
      for (let i = 0; i < 2; i++) {
        g.add(mesh(cyl(0.22, 0.22, 0.018, 22), mat(FOODC.tortilla, { r: 0.85 }), 0, 0.01 + i * 0.02, 0));
      }
      for (let i = 0; i < 7; i++) {
        const s = mesh(sph(0.025, 6, 4), mat('#c9944f'), (rnd() - 0.5) * 0.3, 0.032, (rnd() - 0.5) * 0.3, false);
        s.scale.set(1, 0.2, 1);
        g.add(s);
      }
      break;
    }
    case 'potato': {
      if (state === 'raw') {
        const p = mesh(ico(0.13, 1), mat(FOODC.potato, { flat: true, r: 0.9 }), 0, 0.1, 0);
        p.scale.set(1.3, 0.85, 1);
        g.add(p);
        for (let i = 0; i < 3; i++) g.add(mesh(sph(0.015, 6, 4), mat('#6b4a25'), (rnd() - 0.5) * 0.2, 0.16, (rnd() - 0.5) * 0.12, false));
      } else if (state === 'chopped') {
        for (let i = 0; i < 9; i++) {
          const s = mesh(box(0.035, 0.035, 0.22), mat('#f3e3b0'), (i % 3 - 1) * 0.045 + (rnd() - 0.5) * 0.02, 0.02 + Math.floor(i / 3) * 0.035, (rnd() - 0.5) * 0.04, false);
          s.rotation.y = (rnd() - 0.5) * 0.3;
          g.add(s);
        }
      } else {
        g.add(friesCup(rnd));
      }
      break;
    }
    case 'shrimp': {
      const fried = state === 'fried';
      const sh = mesh(torus(0.09, fried ? 0.058 : 0.045, 8, 16, Math.PI * 1.3), mat(fried ? FOODC.batter : FOODC.shrimp, { flat: fried, r: fried ? 0.8 : 0.45 }), 0, 0.06, 0);
      sh.rotation.x = -Math.PI / 2;
      g.add(sh);
      const tail = mesh(cone(0.05, 0.08, 5), mat('#ff6f4f'), 0.09, 0.06, 0.06, false);
      tail.rotation.z = -Math.PI / 2;
      tail.scale.set(1, 1, 0.4);
      g.add(tail);
      break;
    }
    case 'berries': {
      if (state === 'raw') {
        for (let i = 0; i < 8; i++) {
          const a = (i / 7) * TAU, d = i === 7 ? 0 : 0.08;
          g.add(mesh(sph(0.05, 10, 8), mat(i % 2 ? FOODC.berry : FOODC.berry2, { r: 0.3 }), Math.cos(a) * d, 0.05 + (i === 7 ? 0.06 : 0), Math.sin(a) * d));
        }
        const leaf = mesh(box(0.1, 0.01, 0.04), mat('#4f9a35'), 0.02, 0.17, 0, false);
        leaf.rotation.y = 0.5;
        g.add(leaf);
      } else {
        const b = mesh(sph(0.12, 14, 10), mat('#6a2fa0', { r: 0.2 }), 0, 0.03, 0);
        b.scale.set(1, 0.35, 1);
        g.add(b);
        for (let i = 0; i < 4; i++) g.add(mesh(sph(0.035, 8, 6), mat(FOODC.berry, { r: 0.3 }), (rnd() - 0.5) * 0.12, 0.06, (rnd() - 0.5) * 0.12, false));
      }
      break;
    }
    default:
      g.add(mesh(sph(0.12, 10, 8), mat('#ff00ff'), 0, 0.12, 0));
  }
  return g;
}

function bunBottom() {
  return mesh(cyl(0.16, 0.15, 0.055, 20), mat(FOODC.bun, { r: 0.8 }), 0, 0.028, 0);
}
function bunTop() {
  const g = new THREE.Group();
  const t = mesh(sph(0.165, 20, 10, 0, TAU, 0, Math.PI / 2), mat(FOODC.bunTop, { r: 0.6 }), 0, 0, 0);
  t.scale.set(1, 0.72, 1);
  g.add(t);
  const seed = seeded(3);
  for (let i = 0; i < 8; i++) {
    const a = seed() * TAU, d = 0.04 + seed() * 0.07;
    const s = mesh(sph(0.012, 6, 4), mat('#fff3d6'), Math.cos(a) * d, 0.105 - d * 0.35, Math.sin(a) * d, false);
    s.scale.set(1.4, 0.6, 0.8);
    g.add(s);
  }
  return g;
}
function patty(state) {
  const g = new THREE.Group();
  const cooked = state === 'cooked';
  g.add(mesh(cyl(0.155, 0.15, 0.06, 20), mat(cooked ? FOODC.pattyCooked : FOODC.pattyRaw, { r: cooked ? 0.65 : 0.5, flat: false }), 0, 0.03, 0));
  if (cooked) {
    for (let i = -1; i <= 1; i++) {
      const m = mesh(box(0.24, 0.005, 0.022), mat(FOODC.grill), i * 0.06, 0.062, 0, false);
      m.rotation.y = 0.6;
      g.add(m);
    }
  } else {
    for (let i = 0; i < 5; i++) g.add(mesh(sph(0.02, 6, 4), mat('#f2a3ac'), Math.cos(i * 1.3) * 0.08, 0.06, Math.sin(i * 1.3) * 0.08, false));
  }
  return g;
}
function cheeseSlice() {
  const s = mesh(box(0.24, 0.016, 0.24), mat('#ffcf33', { r: 0.45 }), 0, 0.01, 0);
  s.rotation.y = Math.PI / 4;
  return s;
}
function riceMound() {
  const m = mesh(sph(0.14, 14, 8, 0, TAU, 0, Math.PI / 2), mat(FOODC.rice, { r: 0.9 }), 0, 0, 0);
  m.scale.set(1, 0.75, 1);
  const g = new THREE.Group();
  g.add(m);
  const rnd = seeded(12);
  for (let i = 0; i < 8; i++) {
    const a = rnd() * TAU, d = rnd() * 0.1;
    const gr = mesh(sph(0.014, 5, 4), mat('#ffffff'), Math.cos(a) * d, 0.08 - d * 0.4, Math.sin(a) * d, false);
    gr.scale.set(1.8, 0.8, 0.8);
    gr.rotation.y = rnd() * TAU;
    g.add(gr);
  }
  return g;
}
function salmonSlices(rnd) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Group();
    s.add(mesh(rbox(0.21, 0.035, 0.085, 0.015), mat(FOODC.salmon, { r: 0.4 }), 0, 0, 0));
    for (let k = -1; k <= 1; k++) {
      const st = mesh(box(0.012, 0.037, 0.087), mat('#ffd9cc'), k * 0.06, 0, 0, false);
      st.rotation.y = 0.4;
      s.add(st);
    }
    s.position.set((i - 1) * 0.03, 0.02 + i * 0.012, (i - 1) * 0.07 + (rnd() - 0.5) * 0.01);
    s.rotation.y = -0.3 + i * 0.15;
    g.add(s);
  }
  return g;
}
function eggHalves() {
  const g = new THREE.Group();
  for (const x of [-0.055, 0.055]) {
    const h = mesh(sph(0.065, 12, 8, 0, TAU, 0, Math.PI / 2), mat(FOODC.egg, { r: 0.4 }), x, 0, 0);
    h.scale.set(1, 0.6, 1.3);
    h.rotation.z = Math.PI;
    h.position.y = 0.04;
    g.add(h);
    const y = mesh(sph(0.035, 10, 8), mat(FOODC.yolk, { r: 0.3 }), x, 0.042, 0, false);
    y.scale.set(1, 0.35, 1.2);
    g.add(y);
  }
  return g;
}
function friesCup(rnd) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.11, 0.08, 0.16, 14), mat('#e8402e', { r: 0.6 }), 0, 0.08, 0));
  g.add(mesh(box(0.1, 0.04, 0.005), mat('#ffd23f'), 0, 0.09, 0.098, false));
  for (let i = 0; i < 11; i++) {
    const f = mesh(box(0.028, 0.2, 0.028), mat(FOODC.fry, { r: 0.6 }), (rnd() - 0.5) * 0.12, 0.2 + rnd() * 0.04, (rnd() - 0.5) * 0.12, false);
    f.rotation.set((rnd() - 0.5) * 0.4, rnd() * TAU, (rnd() - 0.5) * 0.4);
    g.add(f);
  }
  return g;
}

export function plateBase(dirty) {
  const g = new THREE.Group();
  g.add(mesh(plateGeo(), mat('#fbfbf7', { r: 0.25, side: THREE.DoubleSide }), 0, 0, 0));
  g.add(rotated(mesh(torus(0.29, 0.006, 4, 28), mat('#5c8dd6'), 0, 0.048, 0, false), 'x', Math.PI / 2));
  if (dirty) {
    const rnd = seeded(41);
    for (let i = 0; i < 4; i++) {
      const s = mesh(sph(0.06 + rnd() * 0.04, 8, 6), mat(i % 2 ? '#8a5a2b' : '#b8732f', { r: 0.9 }), (rnd() - 0.5) * 0.25, 0.028, (rnd() - 0.5) * 0.25, false);
      s.scale.set(1, 0.12, 0.7);
      s.rotation.y = rnd() * TAU;
      g.add(s);
    }
    g.add(mesh(ico(0.025, 0), mat('#6b8e3a', { flat: true }), 0.06, 0.04, -0.05, false));
  }
  return g;
}

function burgerStack(contents) {
  const g = new THREE.Group();
  const has = (k) => contents.some((c) => itemKey(c) === k);
  let y = 0;
  const add = (m, h) => { m.position.y = y; g.add(m); y += h; };
  add(bunBottom(), 0.05);
  if (has('meat:cooked')) add(patty('cooked'), 0.055);
  if (has('cheese:chopped')) add(cheeseSlice(), 0.016);
  if (has('tomato:chopped')) {
    const t = new THREE.Group();
    for (const x of [-0.06, 0.06]) {
      t.add(mesh(cyl(0.075, 0.075, 0.025, 14), mat(FOODC.tomato, { r: 0.4 }), x, 0.012, 0, false));
      t.add(mesh(cyl(0.055, 0.055, 0.027, 14), mat(FOODC.tomatoIn), x, 0.012, 0, false));
    }
    add(t, 0.025);
  }
  if (has('lettuce:chopped')) {
    const l = mesh(ico(0.19, 1), mat(FOODC.lettuce, { flat: true }), 0, 0.012, 0, false);
    l.scale.set(1, 0.09, 1);
    add(l, 0.022);
  }
  add(bunTop(), 0);
  return { group: g, leftover: contents.filter((c) => !['bun:raw', 'meat:cooked', 'cheese:chopped', 'tomato:chopped', 'lettuce:chopped'].includes(itemKey(c))) };
}

function wrapStyle(contents) {
  const g = new THREE.Group();
  const keys = contents.map(itemKey);
  const fillings = contents.filter((c) => c.id !== 'tortilla');
  const fillColor = (c) => ({ meat: FOODC.pattyCooked, tomato: FOODC.tomato, cheese: FOODC.cheese, rice: FOODC.rice, lettuce: FOODC.lettuce }[c.id] || '#aa7744');
  if (keys.includes('rice:cooked') || fillings.length >= 3) {
    const roll = mesh(cyl(0.1, 0.1, 0.42, 18), mat(FOODC.tortilla, { r: 0.85 }), 0, 0.1, 0);
    roll.rotation.z = Math.PI / 2;
    g.add(roll);
    const foil = mesh(cyl(0.104, 0.104, 0.14, 18), mat('#d9dde2', { r: 0.25, m: 0.8 }), 0.15, 0.1, 0);
    foil.rotation.z = Math.PI / 2;
    g.add(foil);
    fillings.forEach((c, i) => {
      const a = (i / Math.max(1, fillings.length)) * TAU;
      g.add(mesh(sph(0.04, 8, 6), mat(fillColor(c)), -0.21, 0.1 + Math.sin(a) * 0.04, Math.cos(a) * 0.04, false));
    });
  } else {
    const shell = mesh(cyl(0.15, 0.15, 0.36, 18, true, 0, Math.PI), mat(FOODC.tortilla, { r: 0.85, side: THREE.DoubleSide }), 0, 0.15, 0);
    shell.rotation.z = -Math.PI / 2;
    g.add(shell);
    const rnd = seeded(hash(keys.join()));
    fillings.forEach((c, i) => {
      for (let k = 0; k < 5; k++) {
        const p = mesh(c.id === 'meat' ? box(0.06, 0.04, 0.05) : sph(0.03, 6, 4), mat(fillColor(c), { flat: true }), -0.14 + rnd() * 0.28, 0.13 + i * 0.015 + rnd() * 0.02, (rnd() - 0.5) * 0.1, false);
        p.rotation.y = rnd() * TAU;
        g.add(p);
      }
    });
  }
  return g;
}

function bowlStyle(contents) {
  const g = new THREE.Group();
  g.add(mesh(bowlGeo(), mat('#b8322a', { r: 0.35, side: THREE.DoubleSide }), 0, 0, 0));
  g.add(mesh(cyl(0.2, 0.2, 0.01, 24), mat('#e8bf86', { r: 0.3 }), 0, 0.15, 0, false));
  const keys = contents.map(itemKey);
  if (keys.includes('noodles:boiled')) {
    const n = mesh(G('noodleKnot', () => new THREE.TorusKnotGeometry(0.1, 0.022, 64, 6, 2, 5)), mat(FOODC.noodles, { r: 0.5 }), -0.02, 0.16, 0, false);
    n.scale.set(1.1, 0.3, 1.1);
    g.add(n);
  }
  if (keys.includes('egg:boiled')) {
    const e = eggHalves();
    e.position.set(0.08, 0.15, 0.06);
    e.scale.setScalar(0.85);
    g.add(e);
  }
  if (keys.includes('meat:cooked')) {
    for (let i = 0; i < 2; i++) {
      const c = mesh(cyl(0.06, 0.06, 0.02, 14), mat('#a8653a', { r: 0.6 }), -0.08 + i * 0.05, 0.17 + i * 0.01, -0.08, false);
      c.rotation.x = 0.4;
      g.add(c);
    }
  }
  for (let i = 0; i < 6; i++) g.add(mesh(cyl(0.012, 0.012, 0.012, 6), mat('#5cb84a'), Math.cos(i * 2) * 0.12, 0.165, Math.sin(i * 2) * 0.12, false));
  g.add(rotated(mesh(box(0.1, 0.008, 0.12), mat(FOODC.nori), -0.1, 0.2, 0.08, false), 'x', -0.9));
  return g;
}

function makiStyle(contents) {
  const g = new THREE.Group();
  const keys = contents.map(itemKey);
  const hasRice = keys.includes('rice:cooked');
  const hasFish = keys.includes('fish:chopped');
  if (!hasRice) {
    const n = ingredientMesh('nori', 'raw');
    g.add(n);
    return g;
  }
  const pos = [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08], [0, 0]];
  for (const [x, z] of pos.slice(0, hasFish ? 5 : 4)) {
    g.add(mesh(cyl(0.065, 0.065, 0.08, 16), mat(FOODC.nori, { r: 0.4 }), x, 0.04, z));
    g.add(mesh(cyl(0.055, 0.055, 0.082, 16), mat(FOODC.rice, { r: 0.9 }), x, 0.041, z, false));
    if (hasFish) g.add(mesh(cyl(0.025, 0.025, 0.084, 10), mat(FOODC.salmon), x, 0.042, z, false));
  }
  g.add(mesh(sph(0.03, 8, 6), mat('#7bc043', { r: 0.6 }), 0.17, 0.02, 0.12, false));
  return g;
}

function nigiriStyle() {
  const g = new THREE.Group();
  for (const z of [-0.07, 0.07]) {
    g.add(mesh(rbox(0.17, 0.07, 0.09, 0.03), mat(FOODC.rice, { r: 0.9 }), 0, 0.035, z));
    const s = new THREE.Group();
    s.add(mesh(rbox(0.2, 0.03, 0.1, 0.012), mat(FOODC.salmon, { r: 0.35 }), 0, 0, 0));
    for (let k = -1; k <= 1; k++) {
      const st = mesh(box(0.012, 0.032, 0.102), mat('#ffd9cc'), k * 0.06, 0, 0, false);
      st.rotation.y = 0.4;
      s.add(st);
    }
    s.position.set(0, 0.085, z);
    g.add(s);
  }
  return g;
}

function saladStyle(contents) {
  const g = new THREE.Group();
  const keys = contents.map(itemKey);
  const rnd = seeded(hash(keys.join()));
  if (keys.includes('lettuce:chopped')) {
    for (let i = 0; i < 5; i++) {
      const l = mesh(ico(0.09, 1), mat(i % 2 ? FOODC.lettuce : FOODC.lettuce2, { flat: true }), (rnd() - 0.5) * 0.18, 0.05, (rnd() - 0.5) * 0.18, false);
      l.scale.set(1, 0.6, 1);
      g.add(l);
    }
  }
  if (keys.includes('tomato:chopped')) {
    for (let i = 0; i < 4; i++) {
      const t = mesh(sph(0.045, 10, 8, 0, TAU, 0, Math.PI / 2), mat(FOODC.tomato, { r: 0.4 }), (rnd() - 0.5) * 0.16, 0.08, (rnd() - 0.5) * 0.16, false);
      t.rotation.x = rnd();
      g.add(t);
    }
  }
  if (keys.includes('cheese:chopped')) {
    for (let i = 0; i < 6; i++) g.add(mesh(box(0.035, 0.035, 0.035), mat(FOODC.cheese), (rnd() - 0.5) * 0.16, 0.1, (rnd() - 0.5) * 0.16, false));
  }
  return g;
}

function scatter(contents) {
  const g = new THREE.Group();
  const n = contents.length;
  contents.forEach((c, i) => {
    const m = ingredientMesh(c.id, c.state, c.toppings);
    if (n === 1) {
      m.position.set(0, 0, 0);
    } else {
      const a = (i / n) * TAU + 0.6;
      const d = n === 2 ? 0.1 : 0.12;
      m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      m.scale.setScalar(n > 2 ? 0.7 : 0.8);
    }
    g.add(m);
  });
  return g;
}

export function arrangeFood(contents) {
  const keys = contents.map(itemKey);
  const ids = new Set(contents.map((c) => c.id));
  let group;
  let leftover = [];
  if (ids.has('bun')) {
    const r = burgerStack(contents);
    group = r.group;
    leftover = r.leftover;
  } else if (ids.has('tortilla')) {
    group = wrapStyle(contents);
  } else if (keys.includes('noodles:boiled') || keys.includes('egg:boiled')) {
    group = bowlStyle(contents);
    leftover = contents.filter((c) => !['noodles:boiled', 'egg:boiled', 'meat:cooked'].includes(itemKey(c)));
  } else if (ids.has('nori')) {
    group = makiStyle(contents);
    leftover = contents.filter((c) => !['nori:raw', 'rice:cooked', 'fish:chopped'].includes(itemKey(c)));
  } else if (keys.includes('rice:cooked') && keys.includes('fish:chopped') && contents.length === 2) {
    group = nigiriStyle();
  } else if (contents.every((c) => ['lettuce:chopped', 'tomato:chopped', 'cheese:chopped'].includes(itemKey(c))) && contents.length > 1) {
    group = saladStyle(contents);
  } else {
    group = scatter(contents);
  }
  if (leftover.length) {
    const extra = scatter(leftover);
    extra.position.set(0.17, 0, 0.12);
    extra.scale.setScalar(0.7);
    const g = new THREE.Group();
    g.add(group, extra);
    return g;
  }
  return group;
}

export function buildExtinguisher() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.085, 0.085, 0.36, 16), mat('#d62c1f', { r: 0.35, m: 0.2 }), 0, 0.18, 0));
  g.add(mesh(sph(0.085, 14, 8, 0, TAU, 0, Math.PI / 2), mat('#d62c1f', { r: 0.35 }), 0, 0.36, 0));
  g.add(mesh(cyl(0.03, 0.03, 0.08, 8), mat('#2b2b2b'), 0, 0.46, 0));
  g.add(mesh(box(0.14, 0.025, 0.04), mat('#c9ced4', { m: 0.8, r: 0.3 }), 0.04, 0.5, 0));
  const hose = mesh(cyl(0.015, 0.015, 0.2, 6), mat('#1e1e1e'), 0, 0.46, 0.09);
  hose.rotation.x = Math.PI / 2;
  g.add(hose);
  g.add(rotated(mesh(cone(0.035, 0.08, 8), mat('#1e1e1e'), 0, 0.46, 0.22), 'x', Math.PI / 2));
  g.add(mesh(box(0.1, 0.1, 0.005), mat('#ffffff'), 0, 0.2, 0.086, false));
  return g;
}

// Build the mesh for any item (ingredient / plate / tool)
export function buildItem(item) {
  if (item.kind === 'tool') return buildExtinguisher();
  if (item.kind === 'plate') {
    const g = new THREE.Group();
    const n = item.stack || 1;
    for (let i = 0; i < n; i++) {
      const p = plateBase(item.dirty);
      p.position.y = i * 0.04;
      p.rotation.y = i * 0.9;
      g.add(p);
    }
    if (!item.dirty && item.contents.length) {
      const food = arrangeFood(item.contents);
      food.position.y = 0.026;
      g.add(food);
    }
    return g;
  }
  return ingredientMesh(item.id, item.state, item.toppings);
}

export function buildDishPreview(dishId) {
  const p = makePlate();
  p.contents = DISHES[dishId].parts.map(itemFromKey);
  const g = buildItem(p);
  // Icons read better with the food a touch larger than the plate
  const food = g.children[g.children.length - 1];
  if (food) food.scale.setScalar(1.35);
  return g;
}

// Characters

const SKINS = ['#ffd9b8', '#f5c49c', '#e0a878', '#c68a5a', '#9a6440', '#6e4428', '#ffe3cc'];
const HAIRS = ['#2b1d14', '#4a2f1e', '#8a5a2b', '#d6a24a', '#e8d3a0', '#b03a2e', '#1c1c24', '#7d7d86', '#5a2d6e', '#2f6fd6'];
const SHIRTS = ['#e8505b', '#3d9be9', '#f6c443', '#7bc96f', '#a66cff', '#ff8c42', '#2ec4b6', '#f78fb3', '#4a69bd', '#6ab04c', '#eb4d4b', '#686de0'];

export function randomCustomerLook() {
  return {
    skin: pick(SKINS),
    shirt: pick(SHIRTS),
    hair: pick(HAIRS),
    hairStyle: pick(['short', 'bob', 'bun', 'spiky', 'pony', 'bald', 'short', 'bob', 'curly']),
    hat: Math.random() < 0.18 ? pick(['cap', 'beanie', 'beret']) : null,
    hatColor: pick(SHIRTS),
    glasses: Math.random() < 0.2,
    pants: pick(PANTS),
    vest: Math.random() < 0.18 ? pick(SHIRTS) : null,
    scarf: Math.random() < 0.2 ? pick(SHIRTS) : null,
    scale: 0.88 + Math.random() * 0.14,
  };
}
const PANTS = ['#2b2d5c', '#3a3f4a', '#6b4f3a', '#1d1a2f', '#4a6fa5', '#4a6fa5', '#8d99ae', '#c9b28a'];

export function criticLook() {
  return {
    skin: pick(SKINS), shirt: '#2c2f4a', hair: '#d9d9d9', hairStyle: 'short', hat: 'fedora', hatColor: '#3a2d2a',
    bowtie: '#c0392b', vest: '#f2f2f2', monocle: true, pants: '#1d1a2f', scale: 1.0,
  };
}

export function vipLook() {
  return {
    skin: pick(SKINS), shirt: '#ffd23f', vest: pick(['#ff6fae', '#9b5cf6', '#2b2d5c']), hair: pick(HAIRS), hairStyle: pick(['long', 'bob', 'afro', 'pony']),
    hat: Math.random() < 0.5 ? 'fedora' : null, hatColor: '#1d1a2f', shades: true, scarf: '#ffffff', pants: '#1d1a2f', scale: 1.02,
  };
}

// Work clothes come with dark trousers (the mascot suit has none)
export function staffLook(role, seed = 0) {
  const l = roleLook(role, seed);
  if (!l.costume) l.pants ??= role === 'drive' || role === 'busser' ? '#3a3f4a' : '#2b2d5c';
  return l;
}

function roleLook(role, seed) {
  const r = seeded(seed + 7);
  const skin = SKINS[Math.floor(r() * SKINS.length)];
  const hair = HAIRS[Math.floor(r() * 7)];
  if (role === 'chef') return { skin, shirt: '#f4f4f0', apron: '#4a69bd', hair, hairStyle: 'short', hat: 'chef', hatScale: 0.8, scarf: '#e74c3c', scale: 0.95 };
  if (role === 'waiter') return { skin, shirt: '#ffffff', vest: '#22252b', bowtie: '#b0263a', hair, hairStyle: pick(['short', 'bun', 'pony']), scale: 0.95 };
  const style = ['short', 'bun', 'pony', 'bob', 'curly', 'spiky'][Math.floor(r() * 6)];
  if (role === 'plater') return { skin, shirt: '#ffffff', apron: '#2fbf5f', hair, hairStyle: style, hat: 'cap', hatColor: '#2fbf5f', scale: 0.95 };
  if (role === 'drive') return { skin, shirt: '#e8343f', apron: '#ffd23f', hair, hairStyle: style, hat: 'cap', hatColor: '#ffd23f', scale: 0.95 };
  if (role === 'busser') return { skin, shirt: '#8d99ae', apron: '#6b4f3a', hair, hairStyle: 'short', hat: 'beanie', hatColor: '#2b2d5c', scale: 0.93 };
  if (role === 'host') return { skin, shirt: '#ffffff', vest: '#2b2d5c', bowtie: '#ffd23f', hair, hairStyle: ['bun', 'bob', 'short', 'pony'][Math.floor(r() * 4)], scale: 0.97 };
  if (role === 'musician') return { skin, shirt: '#9b5cf6', scarf: '#ffd23f', hair, hairStyle: ['long', 'curly', 'spiky', 'afro'][Math.floor(r() * 4)], hat: r() < 0.5 ? 'fedora' : null, hatColor: '#1d1a2f', prop: 'guitar', scale: 0.95 };
  if (role === 'mascot') return { skin, shirt: '#ffb03a', gloves: '#ffffff', hair, hairStyle: 'short', costume: 'burger', scale: 1.0 };
  if (role === 'manager') return { skin, shirt: '#ffffff', vest: '#3f6fb8', bowtie: '#e8343f', hair, hairStyle: ['short', 'bob', 'bun'][Math.floor(r() * 3)], glasses: r() < 0.5, prop: 'clipboard', scale: 0.98 };
  return { skin, shirt: '#3a8fd6', apron: '#1f5f99', hair, hairStyle: 'short', hat: 'bandana', hatColor: '#f1c40f', gloves: '#ffd23f', scale: 0.93 };
}

export function playerLook(color = '#e74c3c') {
  return { skin: '#ffd9b8', shirt: '#fbfbf8', apron: color, pants: '#2b2d5c', hair: '#4a2f1e', hairStyle: 'short', hat: 'chef', scarf: color, scale: 1.0, buttons: true };
}

// Outline hulls only need the silhouette, so rounded parts use a coarser copy of their geometry
function hullGeometry(geo) {
  const p = geo.parameters;
  if (geo.type === 'SphereGeometry') {
    return sph(p.radius, Math.max(10, Math.round(p.widthSegments * 0.6)), Math.max(6, Math.round(p.heightSegments * 0.6)), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
  }
  if (geo.type === 'CapsuleGeometry') return G(`caphull${p.radius},${p.length}`, () => new THREE.CapsuleGeometry(p.radius, p.length, 3, 10));
  return geo;
}

export function buildCharacter(look) {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const ch = { kind: 'char' };
  const skinM = mat(look.skin, { r: 0.6, ...ch });
  const shirtM = mat(look.shirt, { r: 0.75, ...ch });
  // Silhouette parts get an ink outline (inverted hull), merged into one extra draw call per group
  const OL = (m) => { m.userData.outline = true; return m; };

  // Feet
  const footM = mat('#3a302c', { r: 0.7, ...ch });
  const footL = mesh(sph(0.1, 12, 8), footM, -0.11, 0.06, 0.02);
  footL.scale.set(1, 0.6, 1.35);
  const footR = mesh(sph(0.1, 12, 8), footM, 0.11, 0.06, 0.02);
  footR.scale.set(1, 0.6, 1.35);
  root.add(footL, footR);

  // Torso
  const torso = OL(mesh(capsule(0.25, 0.26), shirtM, 0, 0.47, 0));
  pivot.add(torso);
  if (look.pants) {
    // Trousers: the lower half of the body in its own colour, with a belt line
    const pm = mat(look.pants, { r: 0.75, ...ch });
    pivot.add(OL(mesh(sph(0.256, 18, 10, 0, TAU, Math.PI / 2, Math.PI / 2), pm, 0, 0.34, 0)));
    pivot.add(mesh(cyl(0.256, 0.256, 0.07, 18, true), pm, 0, 0.375, 0));
    const belt = mesh(torus(0.257, 0.016, 4, 18), mat(shadeHex(look.pants, 0.55), { r: 0.6, ...ch }), 0, 0.41, 0);
    belt.rotation.x = Math.PI / 2;
    pivot.add(belt);
  }
  if (look.apron) {
    const ap = OL(mesh(rbox(0.36, 0.42, 0.06, 0.03), mat(look.apron, { r: 0.8, ...ch }), 0, 0.38, 0.21));
    ap.rotation.x = -0.12;
    pivot.add(ap);
    pivot.add(mesh(box(0.02, 0.24, 0.02), mat(look.apron, ch), -0.14, 0.66, 0.17));
    pivot.add(mesh(box(0.02, 0.24, 0.02), mat(look.apron, ch), 0.14, 0.66, 0.17));
  }
  if (look.vest) {
    const v = OL(mesh(capsule(0.255, 0.18), mat(look.vest === '#f2f2f2' ? '#2c2f4a' : look.vest, { r: 0.7, ...ch }), 0, 0.5, -0.005));
    v.scale.set(1.0, 1, 0.98);
    pivot.add(v);
    pivot.add(mesh(box(0.14, 0.3, 0.05), mat(look.vest === '#f2f2f2' ? '#f2f2f2' : '#ffffff', ch), 0, 0.58, 0.225));
  }
  if (look.buttons) {
    for (let i = 0; i < 2; i++) for (const x of [-0.07, 0.07]) pivot.add(mesh(sph(0.018, 6, 4), mat('#c9c9c2', ch), x, 0.68 - i * 0.07, 0.235, false));
  }
  if (look.bowtie) {
    const bt = mat(look.bowtie, ch);
    const l = mesh(cone(0.05, 0.08, 4), bt, -0.04, 0.78, 0.235);
    l.rotation.z = Math.PI / 2;
    const r2 = mesh(cone(0.05, 0.08, 4), bt, 0.04, 0.78, 0.235);
    r2.rotation.z = -Math.PI / 2;
    pivot.add(l, r2, mesh(sph(0.025, 6, 4), bt, 0, 0.78, 0.24));
  }
  if (look.scarf) {
    const sc = OL(mesh(torus(0.19, 0.045, 8, 18), mat(look.scarf, { r: 0.8, ...ch }), 0, 0.8, 0.02));
    sc.rotation.x = Math.PI / 2;
    pivot.add(sc);
    pivot.add(mesh(cone(0.06, 0.12, 4), mat(look.scarf, ch), 0, 0.72, 0.21));
  }

  // Head
  const head = new THREE.Group();
  head.position.set(0, 1.06, 0);
  pivot.add(head);
  const burger = look.costume === 'burger';
  if (burger) {
    // Mascot suit: a giant burger for a head, with big friendly eyes on the top bun
    const bun = mat('#eda14a', { r: 0.55, ...ch });
    head.add(OL(mesh(cyl(0.35, 0.33, 0.13, 22), bun, 0, -0.2, 0)));
    head.add(mesh(cyl(0.39, 0.39, 0.1, 22), mat('#6b3a22', { r: 0.85, ...ch }), 0, -0.09, 0));
    const cheese = mesh(box(0.62, 0.025, 0.62), mat('#ffcc33', { r: 0.5, ...ch }), 0, -0.035, 0);
    cheese.rotation.y = Math.PI / 4;
    head.add(cheese);
    const lettuce = mesh(torus(0.37, 0.05, 6, 20), mat('#5fc24a', { r: 0.7, ...ch }), 0, -0.02, 0);
    lettuce.rotation.x = Math.PI / 2;
    head.add(lettuce);
    const top = OL(mesh(sph(0.38, 22, 12, 0, TAU, 0, Math.PI / 2), bun, 0, 0.0, 0));
    top.scale.y = 0.85;
    head.add(top);
    const seed = mat('#fff3d6', { r: 0.6, ...ch });
    for (let i = 0; i < 7; i++) {
      const a = i * 2.3, rr = 0.12 + (i % 3) * 0.07;
      const sd = mesh(sph(0.025, 6, 4), seed, Math.sin(a) * rr, 0.3 - rr * 0.35, Math.cos(a) * rr - 0.04, false);
      sd.scale.set(1, 0.5, 1.7);
      head.add(sd);
    }
  } else {
    head.add(OL(mesh(sph(0.27, 18, 12), skinM, 0, 0, 0)));
    for (const x of [-0.262, 0.262]) {
      const ear = mesh(sph(0.065, 10, 8), skinM, x, -0.005, -0.01);
      ear.scale.set(0.55, 0.9, 0.7);
      head.add(ear);
    }
    // eyebrows in a darker shade of the hair
    const browM = mat(shadeHex(look.hair || '#4a2f1e', 0.75), { r: 0.8, ...ch });
    for (const x of [-0.1, 0.1]) {
      const b = mesh(capsuleLo(0.014, 0.05), browM, x, 0.118, 0.236, false);
      b.rotation.z = Math.PI / 2 + (x < 0 ? -0.12 : 0.12);
      b.rotation.y = x < 0 ? 0.25 : -0.25;
      head.add(b);
    }
  }
  const eyeM = mat('#1b1b22', { r: 0.3, ...ch });
  const hiM = mat('#ffffff', { r: 0.3, ...ch });
  const eyes = new THREE.Group();
  for (const x of [-0.095, 0.095]) {
    const e = mesh(sph(0.043, 10, 8), eyeM, x, 0.03, 0.225, false);
    e.scale.set(1, 1.2, 0.7);
    eyes.add(e);
    eyes.add(mesh(sph(0.014, 6, 4), hiM, x + 0.014, 0.05, 0.255, false));
  }
  head.add(eyes);
  if (burger) {
    eyes.position.set(0, 0.14, -0.04);
    eyes.scale.setScalar(1.55);
    for (const x of [-0.147, 0.147]) {
      const w = mesh(sph(0.078, 12, 8), hiM, x, 0.187, 0.27, false);
      w.scale.set(1, 1.15, 0.45);
      head.add(w);
    }
  } else {
    const cheekM = mat('#ff9aa2', { r: 0.8, ...ch });
    for (const x of [-0.16, 0.16]) {
      const c = mesh(sph(0.04, 8, 6), cheekM, x, -0.04, 0.2, false);
      c.scale.set(1, 0.6, 0.4);
      head.add(c);
    }
    head.add(mesh(sph(0.032, 8, 6), mat(look.skin, { r: 0.5, ...ch }), 0, -0.005, 0.27, false));
  }
  const mouthM = mat('#5a2020', { r: 0.6, ...ch });
  const smile = mesh(torus(0.045, 0.012, 6, 12, Math.PI), mouthM, 0, -0.07, 0.245, false);
  smile.rotation.z = Math.PI;
  const frown = mesh(torus(0.04, 0.012, 6, 12, Math.PI), mouthM, 0, -0.1, 0.245, false);
  const open = mesh(sph(0.035, 10, 8), mouthM, 0, -0.09, 0.24, false);
  open.scale.set(1, 1.2, 0.5);
  frown.visible = false;
  open.visible = false;
  head.add(smile, frown, open);
  if (burger) {
    for (const m of [smile, frown, open]) { m.position.y += 0.15; m.position.z += 0.135; m.scale.multiplyScalar(1.3); }
  }
  if (look.glasses) {
    const gm = mat('#222', { r: 0.3, ...ch });
    for (const x of [-0.095, 0.095]) head.add(mesh(torus(0.06, 0.012, 6, 14), gm, x, 0.03, 0.25, false));
    head.add(mesh(box(0.07, 0.012, 0.012), gm, 0, 0.04, 0.26, false));
  }
  if (look.monocle) {
    head.add(mesh(torus(0.065, 0.012, 6, 16), mat('#d4af37', { m: 0.9, r: 0.2, ...ch }), 0.095, 0.03, 0.255, false));
  }
  if (look.shades) {
    const sm = mat('#15151c', { r: 0.15, m: 0.4, ...ch });
    for (const x of [-0.1, 0.1]) head.add(mesh(rbox(0.13, 0.08, 0.03, 0.025), sm, x, 0.035, 0.255, false));
    head.add(mesh(box(0.08, 0.02, 0.02), sm, 0, 0.055, 0.262, false));
  }
  if (look.mustache) {
    const mm = mat(look.hair, { r: 0.8, ...ch });
    for (const sx of [-1, 1]) {
      const m = mesh(capsuleLo(0.025, 0.07), mm, sx * 0.05, -0.04, 0.262, false);
      m.rotation.z = sx * (Math.PI / 2 - 0.35);
      head.add(m);
    }
  }

  // Hair
  const hairM = mat(look.hair, { r: 0.8, ...ch });
  const hs = burger ? 'bald' : look.hairStyle;
  if (hs && hs !== 'bald' && look.hat !== 'chef' && look.hat !== 'bandana' && look.hat !== 'fedora') {
    const cap = OL(mesh(sph(0.285, 20, 12, 0, TAU, 0, hs === 'bob' ? 1.75 : 1.25), hairM, 0, 0.0, -0.02));
    cap.rotation.x = -0.25;
    head.add(cap);
    if (hs === 'bun') head.add(OL(mesh(sph(0.11, 12, 8), hairM, 0, 0.24, -0.16)));
    if (hs === 'pony') {
      const p = OL(mesh(sph(0.1, 10, 8), hairM, 0, 0.0, -0.3));
      p.scale.set(0.8, 1.6, 0.8);
      head.add(p);
    }
    if (hs === 'spiky') for (let i = 0; i < 5; i++) {
      const s = mesh(cone(0.06, 0.16, 5), hairM, (i - 2) * 0.09, 0.26, -0.02 - Math.abs(i - 2) * 0.03);
      s.rotation.z = -(i - 2) * 0.35;
      head.add(s);
    }
    if (hs === 'curly') for (let i = 0; i < 7; i++) head.add(OL(mesh(sph(0.09, 8, 6), hairM, Math.cos(i * 0.9) * 0.2, 0.17 + Math.sin(i * 1.7) * 0.04, Math.sin(i * 0.9) * 0.2 - 0.04)));
    if (hs === 'long') {
      const l = OL(mesh(rbox(0.5, 0.42, 0.16, 0.07), hairM, 0, -0.16, -0.2));
      l.rotation.x = 0.12;
      head.add(l);
    }
    if (hs === 'afro') {
      const a = OL(mesh(ico(0.36, 2), hairM, 0, 0.1, -0.06));
      a.scale.set(1, 0.85, 0.95);
      head.add(a);
    }
  } else if (look.hat === 'chef' || look.hat === 'bandana') {
    head.add(OL(mesh(sph(0.28, 18, 10, 0, TAU, 0, 1.0), hairM, 0, -0.02, -0.03)));
  }

  // Hats
  let hat = null;
  if (look.hat === 'chef') {
    hat = new THREE.Group();
    const w = mat('#ffffff', { r: 0.85, ...ch });
    hat.add(OL(mesh(cyl(0.2, 0.2, 0.14, 18), w, 0, 0.07, 0)));
    const puff = OL(mesh(sph(0.24, 16, 12), w, 0, 0.25, 0));
    puff.scale.set(1, 0.75, 1);
    hat.add(puff);
    for (let i = 0; i < 4; i++) hat.add(OL(mesh(sph(0.12, 10, 8), w, Math.cos(i * 1.57) * 0.13, 0.3, Math.sin(i * 1.57) * 0.13)));
    hat.position.set(0, 0.17, -0.01);
    hat.scale.setScalar(look.hatScale ?? 1);
    head.add(hat);
  } else if (look.hat === 'cap') {
    hat = new THREE.Group();
    const cm = mat(look.hatColor, { r: 0.7, ...ch });
    hat.add(OL(mesh(sph(0.29, 16, 10, 0, TAU, 0, Math.PI / 2), cm, 0, 0, 0)));
    const brim = mesh(cyl(0.16, 0.16, 0.02, 14, false, -Math.PI / 2, Math.PI), cm, 0, 0.01, 0.2);
    hat.add(brim);
    hat.position.y = 0.06;
    head.add(hat);
  } else if (look.hat === 'beanie') {
    hat = new THREE.Group();
    hat.add(OL(mesh(sph(0.295, 16, 10, 0, TAU, 0, Math.PI / 2), mat(look.hatColor, { r: 0.9, ...ch }), 0, 0, 0)));
    hat.add(OL(mesh(sph(0.07, 8, 6), mat('#ffffff', ch), 0, 0.3, 0)));
    hat.position.y = 0.04;
    head.add(hat);
  } else if (look.hat === 'beret') {
    hat = OL(mesh(sph(0.27, 16, 8), mat(look.hatColor, { r: 0.9, ...ch }), 0.05, 0.2, -0.02));
    hat.scale.set(1.1, 0.3, 1.1);
    hat.rotation.z = -0.25;
    head.add(hat);
  } else if (look.hat === 'fedora') {
    hat = new THREE.Group();
    const fm = mat(look.hatColor, { r: 0.7, ...ch });
    hat.add(mesh(cyl(0.4, 0.4, 0.025, 22), fm, 0, 0, 0));
    hat.add(OL(mesh(cyl(0.2, 0.23, 0.22, 18), fm, 0, 0.11, 0)));
    hat.add(mesh(cyl(0.232, 0.232, 0.05, 18), mat('#b8860b', ch), 0, 0.04, 0));
    hat.position.y = 0.2;
    hat.rotation.z = -0.08;
    head.add(hat);
  } else if (look.hat === 'bandana') {
    hat = OL(mesh(sph(0.29, 16, 10, 0, TAU, 0, 1.25), mat(look.hatColor, { r: 0.8, ...ch }), 0, 0.01, -0.02));
    hat.rotation.x = -0.15;
    head.add(hat);
  } else if (look.hat === 'crown') {
    hat = new THREE.Group();
    const gm = mat('#f5c542', { r: 0.25, m: 0.85, ...ch });
    hat.add(OL(mesh(cyl(0.2, 0.19, 0.1, 18, true), gm, 0, 0.05, 0)));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      hat.add(mesh(cone(0.05, 0.12, 4), gm, Math.sin(a) * 0.19, 0.15, Math.cos(a) * 0.19));
      hat.add(mesh(sph(0.025, 8, 6), mat(['#e8343f', '#2f8cf0', '#2fbf5f'][i % 3], { r: 0.2, ...ch }), Math.sin(a) * 0.2, 0.06, Math.cos(a) * 0.2, false));
    }
    hat.position.y = 0.22;
    head.add(hat);
  } else if (look.hat === 'tophat') {
    hat = new THREE.Group();
    const tm = mat(look.hatColor, { r: 0.5, ...ch });
    hat.add(mesh(cyl(0.34, 0.34, 0.025, 22), tm, 0, 0, 0));
    hat.add(OL(mesh(cyl(0.2, 0.2, 0.36, 20), tm, 0, 0.18, 0)));
    hat.add(mesh(cyl(0.205, 0.205, 0.06, 20), mat('#e8343f', ch), 0, 0.05, 0));
    hat.position.y = 0.21;
    head.add(hat);
  } else if (look.hat === 'party') {
    hat = new THREE.Group();
    hat.add(OL(mesh(cone(0.15, 0.36, 16), mat(look.hatColor, { r: 0.6, ...ch }), 0, 0.18, 0)));
    for (let i = 0; i < 3; i++) hat.add(mesh(torus(0.13 - i * 0.04, 0.012, 6, 16), mat('#ffffff', ch), 0, 0.05 + i * 0.1, 0, false));
    hat.children.slice(1).forEach((t) => { t.rotation.x = Math.PI / 2; });
    hat.add(mesh(sph(0.05, 10, 8), mat('#ffd23f', ch), 0, 0.38, 0));
    hat.position.set(0.04, 0.24, 0);
    hat.rotation.z = -0.15;
    head.add(hat);
  } else if (look.hat === 'cowboy') {
    hat = new THREE.Group();
    const cm = mat(look.hatColor, { r: 0.75, ...ch });
    const brim = mesh(cyl(0.44, 0.44, 0.03, 22), cm, 0, 0, 0);
    brim.scale.set(1, 1, 0.85);
    hat.add(brim);
    hat.add(OL(mesh(cyl(0.2, 0.24, 0.24, 18), cm, 0, 0.12, 0)));
    hat.add(mesh(cyl(0.245, 0.245, 0.04, 18), mat('#5b3420', ch), 0, 0.04, 0));
    hat.position.y = 0.2;
    head.add(hat);
  } else if (look.hat === 'flowers') {
    hat = new THREE.Group();
    hat.add(mesh(torus(0.26, 0.025, 6, 22), mat('#4c9a45', ch), 0, 0, 0));
    hat.children[0].rotation.x = Math.PI / 2;
    const cols = ['#ff6fae', '#ffd23f', '#ffffff', '#b98cff', '#ff8a3a'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      hat.add(mesh(sph(0.055, 8, 6), mat(cols[i % cols.length], { r: 0.6, ...ch }), Math.sin(a) * 0.26, 0.02, Math.cos(a) * 0.26, false));
    }
    hat.position.y = 0.15;
    hat.rotation.x = -0.12;
    head.add(hat);
  }

  // Hands
  const handM = mat(look.gloves || look.skin, { r: 0.6, ...ch });
  const handL = mesh(sph(0.085, 12, 8), handM, -0.33, 0.5, 0.05);
  const handR = mesh(sph(0.085, 12, 8), handM, 0.33, 0.5, 0.05);
  root.add(handL, handR);

  const held = new THREE.Group();
  held.position.set(0, 0.6, 0.4);
  root.add(held);

  // Props for the support roles: a guitar slung in front, a clipboard in the left hand
  if (look.prop === 'guitar') {
    const g = new THREE.Group();
    const wood = mat('#c8783a', { r: 0.45, ...ch }), dark = mat('#3a2418', { r: 0.6, ...ch });
    const lower = OL(mesh(sph(0.15, 14, 10), wood, 0, -0.06, 0));
    lower.scale.set(1, 1, 0.38);
    const upper = OL(mesh(sph(0.115, 14, 10), wood, 0, 0.1, 0));
    upper.scale.set(1, 1, 0.38);
    g.add(lower, upper, mesh(cyl(0.045, 0.045, 0.02, 14), dark, 0, 0.02, 0.055, false).rotateX(Math.PI / 2));
    g.add(mesh(box(0.05, 0.42, 0.03), dark, 0, 0.38, 0.02), mesh(box(0.07, 0.1, 0.035), dark, 0, 0.62, 0.02));
    g.add(mesh(box(0.11, 0.02, 0.03), dark, 0, -0.14, 0.055, false));
    g.position.set(0.02, 0.5, 0.27);
    g.rotation.z = 0.95;
    pivot.add(g);
  } else if (look.prop === 'clipboard') {
    const c = new THREE.Group();
    c.add(mesh(box(0.2, 0.26, 0.02), mat('#a8743f', { r: 0.6, ...ch }), 0, 0, 0));
    c.add(mesh(box(0.17, 0.2, 0.005), mat('#ffffff', { r: 0.8, ...ch }), 0, -0.01, 0.012, false));
    c.add(mesh(box(0.08, 0.035, 0.03), mat('#c9ccd2', { r: 0.3, m: 0.7, ...ch }), 0, 0.12, 0.01, false));
    for (let i = 0; i < 3; i++) c.add(mesh(box(0.12, 0.008, 0.002), mat('#8d99ae', { r: 0.8, ...ch }), 0, 0.04 - i * 0.045, 0.016, false));
    c.position.set(0.06, 0.05, 0.08);
    c.rotation.set(-0.9, 0.3, 0);
    handL.add(c);
  }

  // Soft contact shadow under the feet so characters read as grounded
  root.add(makeBlobShadow(0.95));

  root.scale.setScalar(look.scale || 1);
  // Outline twins share the body geometry; hands get their own (they animate separately)
  const twins = [];
  root.traverse((o) => { if (o.isMesh && o.userData.outline) twins.push(o); });
  for (const o of twins) {
    const t = new THREE.Mesh(hullGeometry(o.geometry), outlineMaterial);
    t.position.copy(o.position);
    t.quaternion.copy(o.quaternion);
    t.scale.copy(o.scale);
    o.parent.add(t);
  }
  // Collapse static body parts into a few meshes (animated parts stay separate)
  head.userData.dynamic = true;
  for (const m of [smile, frown, open]) m.userData.dynamic = true;
  eyes.userData.dynamic = true;
  mergeStatic(pivot, 'char');
  mergeStatic(head, 'char');
  mergeStatic(eyes, 'char');
  // Body parts cast shadows; outlines, the contact blob and tiny face details don't
  root.traverse((o) => { if (o.isMesh) o.castShadow = o.material !== outlineMaterial && !o.material.transparent; });
  // hands and feet are too small to matter in the shadow map
  for (const o of [handL, handR, footL, footR]) o.castShadow = false;
  eyes.traverse((o) => { o.castShadow = false; });
  for (const m of [smile, frown, open]) m.castShadow = false;
  return { root, pivot, head, eyes, handL, handR, footL, footR, held, hat, mouths: { smile, frown, open } };
}

// Street props

export const envMats = {
  lampBulb: new THREE.MeshStandardMaterial({ color: '#fff4cf', emissive: '#ffcf70', emissiveIntensity: 0.2 }),
  windowGlass: new THREE.MeshStandardMaterial({ color: '#9fd3f0', emissive: '#6fb8e8', emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.2 }),
  headlight: new THREE.MeshStandardMaterial({ color: '#fffbe6', emissive: '#fff2b0', emissiveIntensity: 0.3 }),
};

export function buildStreetLamp() {
  const r = new THREE.Group();
  const iron = mat('#33433f', { r: 0.5, m: 0.5, kind: 'env' });
  r.add(mesh(cyl(0.12, 0.16, 0.2, 10), iron, 0, 0.1, 0));
  r.add(mesh(cyl(0.05, 0.06, 2.6, 8), iron, 0, 1.4, 0));
  r.add(mesh(cyl(0.18, 0.08, 0.16, 8), iron, 0, 2.75, 0));
  r.add(mesh(sph(0.14, 12, 8), envMats.lampBulb, 0, 2.62, 0, false));
  r.add(mesh(cone(0.24, 0.18, 8), iron, 0, 2.9, 0));
  return mergeStatic(r, 'env');
}

// Lush rounded stylised tree (one vertex-coloured mesh). The street scenery batches many of
// these together via look.buildGarden; this stand-alone version is kept for other callers.
export function buildTree(seed = 1) {
  return buildGardenTree(seed);
}

export function buildCar(color) {
  const r = new THREE.Group();
  r.add(mesh(rbox(2.0, 0.5, 0.95, 0.15), mat(color, { r: 0.3, m: 0.4 }), 0, 0.45, 0));
  r.add(mesh(rbox(1.1, 0.42, 0.85, 0.14), mat(color, { r: 0.3, m: 0.4 }), -0.1, 0.85, 0));
  r.add(mesh(rbox(1.12, 0.3, 0.87, 0.1), mat('#2c3e50', { r: 0.1, m: 0.5 }), -0.1, 0.86, 0));
  for (const [x, z] of [[-0.62, -0.46], [0.62, -0.46], [-0.62, 0.46], [0.62, 0.46]]) {
    const w = mesh(cyl(0.2, 0.2, 0.14, 14), mat('#1b1b1f'), x, 0.22, z);
    w.rotation.x = Math.PI / 2;
    r.add(w);
    const hub = mesh(cyl(0.09, 0.09, 0.15, 10), mat('#c9ced4', { m: 0.8, r: 0.3 }), x, 0.22, z);
    hub.rotation.x = Math.PI / 2;
    r.add(hub);
  }
  r.add(mesh(box(0.05, 0.12, 0.2), envMats.headlight, 1.0, 0.5, -0.3, false));
  r.add(mesh(box(0.05, 0.12, 0.2), envMats.headlight, 1.0, 0.5, 0.3, false));
  r.add(mesh(box(0.05, 0.1, 0.18), mat('#ff3b3b', { e: '#ff0000', ei: 0.6 }), -1.0, 0.5, -0.3, false));
  r.add(mesh(box(0.05, 0.1, 0.18), mat('#ff3b3b', { e: '#ff0000', ei: 0.6 }), -1.0, 0.5, 0.3, false));
  return mergeStatic(r, 'env');
}

export function buildBench() {
  const r = new THREE.Group();
  const w = mat('#b07445', { kind: 'env' });
  const iron = mat('#33433f', { m: 0.5, r: 0.5, kind: 'env' });
  for (let i = 0; i < 3; i++) r.add(mesh(box(1.4, 0.05, 0.12), w, 0, 0.45, -0.14 + i * 0.14));
  for (let i = 0; i < 2; i++) r.add(mesh(box(1.4, 0.12, 0.04), w, 0, 0.62 + i * 0.16, -0.24));
  for (const x of [-0.6, 0.6]) {
    r.add(mesh(box(0.06, 0.45, 0.4), iron, x, 0.225, -0.02));
    r.add(mesh(box(0.06, 0.4, 0.06), iron, x, 0.7, -0.24));
  }
  return mergeStatic(r, 'env');
}

export function buildPointer() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffb000', emissiveIntensity: 0.9 });
  const c = new THREE.Mesh(cone(0.18, 0.34, 4), m);
  c.rotation.x = Math.PI;
  c.position.y = 0.17;
  g.add(c);
  const b = new THREE.Mesh(box(0.12, 0.25, 0.12), m);
  b.position.y = 0.45;
  g.add(b);
  return g;
}
