// Art direction layer: the colour grade that makes props, food and characters pop against a
// softer environment, a stylised sky-rim light, ink outlines and contact shadows for
// characters, fake ambient occlusion strips, a painted ground, and the procedural garden
// around the restaurant (lush rounded trees, bushes, flower patches, grass tufts) batched
// into a couple of vertex-coloured meshes so the whole thing costs a handful of draw calls.

import * as THREE from '../vendor/three-0.169.0.module.min.js';

// Shared uniforms, driven by the renderer every frame / time of day
export const LOOK = {
  time: { value: 0 },
  rimColor: { value: new THREE.Color('#fff1da') },
  rimChar: { value: 0.55 },
  rimProp: { value: 0.2 },
  outlineThickness: { value: 0.02 },
  outlineColor: { value: new THREE.Color('#2e1c14') },
  wind: { value: 1 },
};

// ---------------------------------------------------------------------------
// Colour grade

const _rgb = { r: 0, g: 0, b: 0 };
// Push a colour away from its own grey (more chroma) and optionally scale its lightness.
export function gradeColor(color, chroma = 1.14, light = 1) {
  const c = color instanceof THREE.Color ? color.clone() : new THREE.Color(color);
  c.getRGB(_rgb, THREE.SRGBColorSpace);
  const y = _rgb.r * 0.299 + _rgb.g * 0.587 + _rgb.b * 0.114;
  const f = (v) => Math.min(1, Math.max(0, (y + (v - y) * chroma) * light));
  return c.setRGB(f(_rgb.r), f(_rgb.g), f(_rgb.b), THREE.SRGBColorSpace);
}

// Same idea for 2D canvases: soften (chroma < 1) and lift environment textures.
export function gradeCanvas(ctx, w, h, chroma = 0.85, light = 1, warm = 0) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const y = r * 0.299 + g * 0.587 + b * 0.114;
    d[i] = (y + (r - y) * chroma) * light + warm;
    d[i + 1] = (y + (g - y) * chroma) * light + warm * 0.45;
    d[i + 2] = (y + (b - y) * chroma) * light - warm * 0.3;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Stylised rim: a warm sky-light fresnel on the edges of characters & props (strongest on
// upward-facing edges) so they separate from the floor without an extra light or pass.

const RIM_GLSL = /* glsl */ `
{
  float rimF = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 2.3);
  vec3 rimUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
  rimF *= saturate(dot(geometryNormal, rimUp) * 0.65 + 0.5);
  outgoingLight += uRimColor * (rimF * uRimStrength);
}
#include <opaque_fragment>`;

export function addRim(material, strength) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = LOOK.rimColor;
    shader.uniforms.uRimStrength = strength;
    shader.fragmentShader = `uniform vec3 uRimColor;\nuniform float uRimStrength;\n${shader.fragmentShader.replace('#include <opaque_fragment>', RIM_GLSL)}`;
  };
  material.customProgramCacheKey = () => 'look-rim';
  return material;
}

// ---------------------------------------------------------------------------
// Ink outline (inverted hull). Thickness is in world units and kept at a constant on-screen
// width by the renderer. Only used for characters, so it only costs their vertices.

export const outlineMaterial = new THREE.ShaderMaterial({
  uniforms: { uThick: LOOK.outlineThickness, uColor: LOOK.outlineColor },
  vertexShader: /* glsl */ `
    uniform float uThick;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      mv.xyz += n * uThick;
      mv.z -= uThick * 0.5;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    void main() {
      gl_FragColor = vec4(uColor, 1.0);
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide,
});

// ---------------------------------------------------------------------------
// Soft contact shadow (radial gradient decal) — pinned to the ground even when the owner sits.

function gradientCanvas(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

let blobMat = null;
function blobMaterial() {
  if (!blobMat) {
    const tex = gradientCanvas(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.7)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    });
    blobMat = new THREE.MeshBasicMaterial({ color: '#3a2418', map: tex, transparent: true, opacity: 0.42, depthWrite: false });
  }
  return blobMat;
}
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function pinToGround() { this.matrixWorld.elements[13] = 0.022; }

export function makeBlobShadow(size = 0.9) {
  const m = new THREE.Mesh(blobGeo, blobMaterial());
  m.scale.set(size, 1, size);
  m.renderOrder = 1;
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.noMerge = true;
  m.onBeforeRender = pinToGround;
  return m;
}

// ---------------------------------------------------------------------------
// Fake ambient occlusion: dark gradient strips along the creases where walls meet the floor.
// strips: [{ o: [x,y,z], along: [x,y,z], across: [x,y,z] }] — `o` is on the crease line.

let aoMat = null;
export function buildAOStrips(strips) {
  if (!aoMat) {
    const tex = gradientCanvas(4, 64, (g, w, h) => {
      for (let y = 0; y < h; y++) {
        const t = y / (h - 1);
        g.fillStyle = `rgba(255,255,255,${Math.pow(1 - t, 2.2).toFixed(3)})`;
        g.fillRect(0, y, w, 1);
      }
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    aoMat = new THREE.MeshBasicMaterial({
      color: '#3b2718', map: tex, transparent: true, opacity: 0.5, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
  }
  const pos = [], uv = [], idx = [];
  for (const s of strips) {
    const [ox, oy, oz] = s.o, [ax, ay, az] = s.along, [cx, cy, cz] = s.across;
    const b = pos.length / 3;
    pos.push(ox, oy, oz, ox + ax, oy + ay, oz + az, ox + ax + cx, oy + ay + cy, oz + az + cz, ox + cx, oy + cy, oz + cz);
    uv.push(0, 1, 1, 1, 1, 0, 0, 0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  geo.userData.merged = true;
  const m = new THREE.Mesh(geo, aoMat);
  m.renderOrder = 2;
  m.userData.ownGeo = true;
  return m;
}

// ---------------------------------------------------------------------------
// Painted ground: a tiling detail texture modulated by a big, soft colour-variation map
// sampled in world space (one extra texture fetch, no extra geometry or passes).

function groundVariationTexture(seed = 7) {
  const rnd = seeded(seed);
  return gradientCanvas(256, 256, (g, w, h) => {
    g.fillStyle = 'rgb(128,128,128)';
    g.fillRect(0, 0, w, h);
    const blob = (x, y, r, col, a) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${col},${a})`);
      grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (let i = 0; i < 80; i++) blob(rnd() * w, rnd() * h, 6 + rnd() * 20, rnd() < 0.5 ? '168,174,116' : '92,108,108', 0.6);
    for (let i = 0; i < 30; i++) blob(rnd() * w, rnd() * h, 3 + rnd() * 6, '176,164,112', 0.5);
    // gentle darkening far away from the restaurant (an in-world vignette)
    const v = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.5);
    v.addColorStop(0, 'rgba(70,90,110,0)');
    v.addColorStop(1, 'rgba(70,90,110,0.45)');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  });
}

export function makeGroundMaterial(detail, cx, cz, span = 128) {
  const m = new THREE.MeshStandardMaterial({ map: detail, roughness: 1 });
  const varTex = groundVariationTexture();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uVar = { value: varTex };
    sh.uniforms.uVarXf = { value: new THREE.Vector4(cx - span / 2, cz - span / 2, 1 / span, 1 / span) };
    sh.vertexShader = `varying vec2 vGroundXZ;\n${sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n vGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')}`;
    sh.fragmentShader = `varying vec2 vGroundXZ;\nuniform sampler2D uVar;\nuniform vec4 uVarXf;\n${sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= texture2D(uVar, (vGroundXZ - uVarXf.xy) * uVarXf.zw).rgb * 2.0;')}`;
  };
  m.customProgramCacheKey = () => 'look-ground';
  return m;
}

// ---------------------------------------------------------------------------
// Garden: lush rounded trees, bushes, flowers and grass tufts in two batched meshes

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const _m4 = new THREE.Matrix4();
const _n3 = new THREE.Matrix3();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _col = new THREE.Color();

const flatCache = new Map();
function nonIndexed(key, make) {
  let g = flatCache.get(key);
  if (!g) {
    g = make();
    if (g.index) g = g.toNonIndexed();
    flatCache.set(key, g);
  }
  return g;
}
const G = {
  blob2: () => nonIndexed('blob2', () => new THREE.SphereGeometry(1, 12, 9)),
  blob1: () => nonIndexed('blob1', () => new THREE.IcosahedronGeometry(1, 1)),
  gem: () => nonIndexed('gem', () => new THREE.OctahedronGeometry(1, 0)),
  trunk: () => nonIndexed('trunk', () => new THREE.CylinderGeometry(0.62, 1, 1, 7, 1, true)),
  blade: () => nonIndexed('blade', () => new THREE.ConeGeometry(1, 1, 3, 1, true)),
  leaf: () => nonIndexed('leaf', () => new THREE.ConeGeometry(1, 1, 5, 1, true)),
  disc: () => nonIndexed('disc', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, false)),
};

class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; }
  // colorFn(worldPos, worldNormal, out THREE.Color) -> void
  add(geo, x, y, z, sx, sy, sz, rx, ry, rz, colorFn) {
    _m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    _n3.getNormalMatrix(_m4);
    const P = geo.attributes.position, N = geo.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      _p.fromBufferAttribute(P, i).applyMatrix4(_m4);
      _n.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize();
      this.pos.push(_p.x, _p.y, _p.z);
      this.nor.push(_n.x, _n.y, _n.z);
      colorFn(_p, _n, _col);
      this.col.push(_col.r, _col.g, _col.b);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.userData.merged = true;
    return g;
  }
}

// Wind sway for foliage: canopy (or blade tips) drift gently; shadows stay put (amplitude is tiny).
function swayMaterial(minY, maxY, amp, roughness = 0.85) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = LOOK.time;
    sh.uniforms.uWind = LOOK.wind;
    sh.vertexShader = `uniform float uTime;\nuniform float uWind;\n${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float k = smoothstep(${minY.toFixed(2)}, ${maxY.toFixed(2)}, position.y) * ${amp.toFixed(3)} * uWind;
        float ph = uTime * 1.4 + position.x * 0.45 + position.z * 0.3;
        transformed.x += sin(ph) * k;
        transformed.z += cos(ph * 0.8 + 1.3) * k * 0.6;
      }`)}`;
  };
  m.customProgramCacheKey = () => `look-sway-${minY}-${maxY}-${amp}`;
  return m;
}
let foliageMat = null, coverMat = null;
export function foliageMaterials() {
  if (!foliageMat) {
    foliageMat = swayMaterial(1.1, 3.4, 0.05, 0.9);
    addRimToSway(foliageMat);
    coverMat = swayMaterial(0.02, 0.3, 0.035, 0.9);
  }
  return { foliageMat, coverMat };
}
// Foliage gets a soft sky-coloured rim too (on top of its sway patch)
function addRimToSway(m) {
  const sway = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    sway(sh, r);
    sh.uniforms.uRimColor = LOOK.rimColor;
    sh.uniforms.uRimStrength = { value: 0.22 };
    sh.fragmentShader = `uniform vec3 uRimColor;\nuniform float uRimStrength;\n${sh.fragmentShader.replace('#include <opaque_fragment>', RIM_GLSL)}`;
  };
  m.customProgramCacheKey = () => 'look-sway-rim';
}

const PAL = {
  leaf: [
    { base: '#5ea24c', light: '#a6d468', dark: '#336c3e' },
    { base: '#529850', light: '#96cb6a', dark: '#2c5e3e' },
    { base: '#74aa50', light: '#bcd879', dark: '#3f763a' },
    { base: '#62a45e', light: '#a8d482', dark: '#306848' },
  ],
  blossom: { base: '#f4a3b8', light: '#ffd9e2', dark: '#c66a8a' },
  autumn: { base: '#e8a548', light: '#fbd488', dark: '#a8653a' },
  bark: '#7c5236',
  barkDark: '#4f3322',
  bush: [
    { base: '#4b9446', light: '#8cc95c', dark: '#24583a' },
    { base: '#5aa04a', light: '#a2d66a', dark: '#2d6338' },
  ],
  petals: ['#ff7a9a', '#ffd23f', '#ffffff', '#b98cff', '#ff9a4d', '#ff5e7e', '#7ec8ff'],
  grass: { dark: '#4f8f3d', light: '#a8d872' },
  soil: '#6a4a33',
};
const cache = new Map();
const col = (hex) => {
  let c = cache.get(hex);
  if (!c) { c = new THREE.Color(hex); cache.set(hex, c); }
  return c;
};

function canopyColor(pal, y0, y1, tint) {
  const base = col(pal.base), light = col(pal.light), dark = col(pal.dark);
  return (p, n, out) => {
    const t = THREE.MathUtils.clamp((p.y - y0) / (y1 - y0), 0, 1);
    const up = n.y * 0.5 + 0.5;
    // bottom & inner faces darker (baked occlusion), sunny tops lighter
    const k = THREE.MathUtils.clamp(t * 0.75 + up * 0.35 - 0.1, 0, 1);
    if (k < 0.5) out.copy(dark).lerp(base, k * 2);
    else out.copy(base).lerp(light, (k - 0.5) * 2 * 0.7);
    out.multiplyScalar(tint);
  };
}

function addTree(batch, x, z, s, rnd, kind) {
  const pal = kind === 'blossom' ? PAL.blossom : kind === 'autumn' ? PAL.autumn : PAL.leaf[Math.floor(rnd() * PAL.leaf.length)];
  const bark = col(PAL.bark), barkDark = col(PAL.barkDark);
  const trunkH = (1.15 + rnd() * 0.25) * s;
  const barkFn = (p, n, out) => out.copy(barkDark).lerp(bark, THREE.MathUtils.clamp(p.y / trunkH, 0, 1) * 0.8 + 0.2);
  const lean = (rnd() - 0.5) * 0.12;
  batch.add(G.trunk(), x, trunkH / 2, z, 0.2 * s, trunkH, 0.2 * s, lean, rnd() * 6, lean * 0.5, barkFn);
  batch.add(G.trunk(), x, 0.1 * s, z, 0.34 * s, 0.2 * s, 0.34 * s, 0, rnd() * 6, 0, barkFn);
  const cy = trunkH + 0.55 * s;
  const y0 = trunkH - 0.2 * s, y1 = cy + 1.0 * s;
  const tint = 0.94 + rnd() * 0.12;
  const fn = canopyColor(pal, y0, y1, tint);
  const R = (0.82 + rnd() * 0.12) * s;
  batch.add(G.blob2(), x, cy, z, R, R * 0.88, R, 0, rnd() * 6, 0, fn);
  const n = 4;
  const a0 = rnd() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    const d = (0.55 + rnd() * 0.15) * s;
    const r = (0.48 + rnd() * 0.14) * s;
    batch.add(G.blob1(), x + Math.cos(a) * d, cy - 0.18 * s + rnd() * 0.3 * s, z + Math.sin(a) * d, r, r * 0.9, r, rnd(), rnd() * 6, 0, fn);
  }
  const rt = (0.46 + rnd() * 0.1) * s;
  batch.add(G.blob1(), x + (rnd() - 0.5) * 0.3 * s, cy + 0.6 * s, z + (rnd() - 0.5) * 0.3 * s, rt, rt * 0.9, rt, 0, rnd() * 6, 0, fn);
}

function addBush(batch, x, z, s, rnd, flowers, petals) {
  const pal = PAL.bush[Math.floor(rnd() * PAL.bush.length)];
  const fn = canopyColor(pal, 0, 0.75 * s, 0.95 + rnd() * 0.1);
  const n = 3 + Math.floor(rnd() * 2);
  const spots = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd();
    const d = i === 0 ? 0 : (0.28 + rnd() * 0.12) * s;
    const r = (i === 0 ? 0.45 : 0.32 + rnd() * 0.1) * s;
    const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d, by = r * 0.7;
    batch.add(G.blob1(), bx, by, bz, r, r * 0.85, r, 0, rnd() * 6, 0, fn);
    spots.push([bx, by, bz, r]);
  }
  if (flowers && petals) {
    const pc = col(PAL.petals[Math.floor(rnd() * PAL.petals.length)]);
    const solid = (p, nn, out) => out.copy(pc);
    for (let i = 0; i < 6; i++) {
      const [bx, by, bz, r] = spots[i % spots.length];
      const a = rnd() * Math.PI * 2, el = 0.35 + rnd() * 0.8;
      petals.add(G.gem(), bx + Math.cos(a) * Math.cos(el) * r * 0.92, by + Math.sin(el) * r * 0.8, bz + Math.sin(a) * Math.cos(el) * r * 0.92, 0.055, 0.04, 0.055, 0, rnd() * 6, 0, solid);
    }
  }
}

function addFlowerPatch(batch, x, z, rnd, count = 7) {
  const g0 = col('#4c9440'), g1 = col('#7cbf55');
  const leafFn = (p, n, out) => out.copy(g0).lerp(g1, THREE.MathUtils.clamp(p.y / 0.14, 0, 1));
  const c1 = col(PAL.petals[Math.floor(rnd() * PAL.petals.length)]);
  const c2 = col(PAL.petals[Math.floor(rnd() * PAL.petals.length)]);
  const centre = col('#ffcf3a');
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.5;
    const fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d;
    batch.add(G.leaf(), fx, 0.06, fz, 0.1, 0.13, 0.1, 0, rnd() * 6, 0, leafFn);
    const pc = rnd() < 0.6 ? c1 : c2;
    const h = 0.15 + rnd() * 0.08;
    batch.add(G.gem(), fx, h, fz, 0.075, 0.045, 0.075, 0, rnd() * 6, 0, (p, nn, out) => {
      // sunny centre on the upper tip, petal colour around it
      if (nn.y > 0.5 && p.y > h + 0.02) out.copy(centre); else out.copy(pc);
    });
  }
}

function addTuft(batch, x, z, rnd, s = 1) {
  const dk = col(PAL.grass.dark), lt = col(PAL.grass.light);
  const fn = (p, n, out) => out.copy(dk).lerp(lt, THREE.MathUtils.clamp(p.y / (0.3 * s), 0, 1));
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const h = (0.18 + rnd() * 0.14) * s;
    const tilt = 0.25 + rnd() * 0.25;
    batch.add(G.blade(), x + Math.cos(a) * 0.05, h / 2 - 0.01, z + Math.sin(a) * 0.05, 0.035 * s, h, 0.035 * s, Math.sin(a) * tilt, rnd() * 6, -Math.cos(a) * tilt, fn);
  }
}

function addSoil(batch, x, z, r) {
  const c = col(PAL.soil);
  batch.add(G.disc(), x, 0.02, z, r, 0.05, r, 0, 0, 0, (p, n, out) => out.copy(c));
}

// spec: { trees: [{x,z,s,kind}], bushes: [{x,z,s,flowers}], flowers: [{x,z,n}], tufts: [{x,z,s}], pits: [{x,z,r}],
//         chunk(x, z) -> string (spatial chunk so off-screen parts are frustum-culled),
//         caster(x, z) -> bool (trees inside the shadow map cast; bushes & far trees don't) }
export function buildGarden(spec, seed = 11) {
  const rnd = seeded(seed);
  const chunkOf = spec.chunk || (() => 'all');
  const batches = new Map();
  const get = (key) => { let b = batches.get(key); if (!b) { b = new Batch(); batches.set(key, b); } return b; };
  for (const t of spec.trees || []) {
    const cast = spec.caster ? spec.caster(t.x, t.z) : true;
    addTree(get(`tall|${cast ? 1 : 0}|${chunkOf(t.x, t.z)}`), t.x, t.z, t.s ?? 1, rnd, t.kind);
  }
  for (const b of spec.bushes || []) {
    const batch = get(`tall|0|${chunkOf(b.x, b.z)}`);
    addBush(batch, b.x, b.z, b.s ?? 1, rnd, b.flowers, batch);
  }
  for (const f of spec.flowers || []) addFlowerPatch(get(`low|0|${chunkOf(f.x, f.z)}`), f.x, f.z, rnd, f.n ?? 7);
  for (const t of spec.tufts || []) addTuft(get(`low|0|${chunkOf(t.x, t.z)}`), t.x, t.z, rnd, t.s ?? 1);
  for (const p of spec.pits || []) addSoil(get(`low|0|${chunkOf(p.x, p.z)}`), p.x, p.z, p.r ?? 0.5);
  const { foliageMat, coverMat } = foliageMaterials();
  const group = new THREE.Group();
  for (const [key, b] of batches) {
    if (!b.pos.length) continue;
    const [layer, cast] = key.split('|');
    const m = new THREE.Mesh(b.build(), layer === 'tall' ? foliageMat : coverMat);
    m.castShadow = cast === '1';
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

// A single stand-alone stylised tree (kept for callers of models.buildTree)
export function buildGardenTree(seed = 1) {
  return buildGarden({ trees: [{ x: 0, z: 0, s: 1 }] }, seed);
}
