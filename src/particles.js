// Particle engine: soft GPU point sprites (steam, smoke, fire, foam, dust, sparks),
// physical instanced chunks (veggie crumbs, confetti, coins) and DOM floaters
// (cash numbers, star ratings and emoji bubbles anchored in world space).

import * as THREE from 'three';
import { rand, clamp, TAU } from './utils.js';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale;
  }
`;

const FRAG = /* glsl */ `
  uniform float uSoft;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.5 - uSoft, d) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`;

const _c0 = new THREE.Color();
const _c1 = new THREE.Color();

class PointPool {
  constructor(scene, max, blending, soft, renderOrder) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.c0 = new Float32Array(max * 3);
    this.c1 = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.turb = new Float32Array(max);
    this.seed = new Float32Array(max);
    this.alive = 0;

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aColor', this.aCol);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 50 }, uSoft: { value: soft } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    scene.add(this.points);
  }

  spawn(o) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = o.x; this.pos[i3 + 1] = o.y; this.pos[i3 + 2] = o.z;
    this.vel[i3] = o.vx || 0; this.vel[i3 + 1] = o.vy || 0; this.vel[i3 + 2] = o.vz || 0;
    _c0.set(o.color);
    _c1.set(o.color2 ?? o.color);
    this.c0[i3] = _c0.r; this.c0[i3 + 1] = _c0.g; this.c0[i3 + 2] = _c0.b;
    this.c1[i3] = _c1.r; this.c1[i3 + 1] = _c1.g; this.c1[i3 + 2] = _c1.b;
    this.s0[i] = o.size; this.s1[i] = o.size2 ?? o.size;
    this.a0[i] = o.alpha ?? 1;
    this.life[i] = this.maxLife[i] = o.life;
    this.drag[i] = o.drag ?? 0;
    this.grav[i] = o.grav ?? 0;
    this.turb[i] = o.turb ?? 0;
    this.seed[i] = Math.random() * 100;
  }

  update(dt, time) {
    const { pos, vel, col, c0, c1, size, s0, s1, alpha, a0, life, maxLife, drag, grav, turb, seed } = this;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) {
        if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; }
        continue;
      }
      life[i] -= dt;
      if (life[i] <= 0) { alpha[i] = 0; size[i] = 0; continue; }
      alive++;
      const i3 = i * 3;
      const t = 1 - life[i] / maxLife[i];
      const dr = Math.max(0, 1 - drag[i] * dt);
      vel[i3] *= dr; vel[i3 + 1] *= dr; vel[i3 + 2] *= dr;
      vel[i3 + 1] += grav[i] * dt;
      if (turb[i]) {
        const s = seed[i];
        vel[i3] += Math.sin(time * 3.1 + s) * turb[i] * dt;
        vel[i3 + 2] += Math.cos(time * 2.7 + s * 1.3) * turb[i] * dt;
      }
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      size[i] = s0[i] + (s1[i] - s0[i]) * t;
      const fadeIn = Math.min(1, t / 0.12);
      alpha[i] = a0[i] * fadeIn * (1 - t) * (1 - t * 0.3);
      col[i3] = c0[i3] + (c1[i3] - c0[i3]) * t;
      col[i3 + 1] = c0[i3 + 1] + (c1[i3 + 1] - c0[i3 + 1]) * t;
      col[i3 + 2] = c0[i3 + 2] + (c1[i3 + 2] - c0[i3 + 2]) * t;
    }
    this.alive = alive;
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
  }

  clear() { this.life.fill(0); }
}

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

class ChunkPool {
  constructor(scene, max, geometry, material) {
    this.max = max;
    this.cursor = 0;
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.rot = new Float32Array(max * 3);
    this.spin = new Float32Array(max * 3);
    this.scale = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.floor = new Float32Array(max);
    this.grav = new Float32Array(max);
    for (let i = 0; i < max; i++) {
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
      this.mesh.setColorAt(i, _col.set('#ffffff'));
    }
    scene.add(this.mesh);
  }

  spawn(o) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = o.x; this.pos[i3 + 1] = o.y; this.pos[i3 + 2] = o.z;
    this.vel[i3] = o.vx; this.vel[i3 + 1] = o.vy; this.vel[i3 + 2] = o.vz;
    this.rot[i3] = rand(0, TAU); this.rot[i3 + 1] = rand(0, TAU); this.rot[i3 + 2] = rand(0, TAU);
    this.spin[i3] = rand(-12, 12); this.spin[i3 + 1] = rand(-12, 12); this.spin[i3 + 2] = rand(-12, 12);
    const s = o.scale;
    this.scale[i3] = s * (o.sx ?? 1); this.scale[i3 + 1] = s * (o.sy ?? 1); this.scale[i3 + 2] = s * (o.sz ?? 1);
    this.life[i] = this.maxLife[i] = o.life;
    this.floor[i] = o.floor ?? 0;
    this.grav[i] = o.grav ?? -14;
    this.mesh.setColorAt(i, _col.set(o.color));
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const { pos, vel, rot, spin, scale, life, maxLife, floor, grav } = this;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      any = true;
      life[i] -= dt;
      const i3 = i * 3;
      if (life[i] <= 0) {
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      vel[i3 + 1] += grav[i] * dt;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      const resting = pos[i3 + 1] <= floor[i] + scale[i3 + 1] * 0.5;
      if (resting) {
        pos[i3 + 1] = floor[i] + scale[i3 + 1] * 0.5;
        if (vel[i3 + 1] < 0) vel[i3 + 1] *= -0.32;
        vel[i3] *= 0.62; vel[i3 + 2] *= 0.62;
        spin[i3] *= 0.5; spin[i3 + 1] *= 0.5; spin[i3 + 2] *= 0.5;
      }
      rot[i3] += spin[i3] * dt; rot[i3 + 1] += spin[i3 + 1] * dt; rot[i3 + 2] += spin[i3 + 2] * dt;
      const t = life[i] / maxLife[i];
      const shrink = t < 0.25 ? t / 0.25 : 1;
      _dummy.position.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      _dummy.rotation.set(rot[i3], rot[i3 + 1], rot[i3 + 2]);
      _dummy.scale.set(scale[i3] * shrink, scale[i3 + 1] * shrink, scale[i3 + 2] * shrink);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.life.fill(0.0001);
    this.update(0.001);
  }
}

// World-anchored DOM text (cash, stars, emoji). Crisp at any zoom and emoji-friendly.
class FloaterLayer {
  constructor(container, project) {
    this.container = container;
    this.project = project;
    this.items = [];
  }

  spawn(x, y, z, html, cls = '', opts = {}) {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.innerHTML = html;
    this.container.appendChild(el);
    this.items.push({
      el, x, y, z,
      vy: opts.vy ?? 1.1,
      vx: opts.vx ?? 0,
      life: opts.life ?? 1.6,
      max: opts.life ?? 1.6,
      wobble: opts.wobble ?? 0,
      scale: opts.scale ?? 1,
      seed: Math.random() * 10,
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.el.remove();
        this.items.splice(i, 1);
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= 1 - 1.2 * dt;
      f.x += f.vx * dt;
      const t = 1 - f.life / f.max;
      const p = this.project(f.x, f.y, f.z);
      const pop = t < 0.15 ? 0.4 + (t / 0.15) * 0.75 : t < 0.25 ? 1.15 - ((t - 0.15) / 0.1) * 0.15 : 1;
      const alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      const wob = f.wobble ? Math.sin(t * 12 + f.seed) * f.wobble : 0;
      f.el.style.transform = `translate(${p.x + wob}px, ${p.y}px) translate(-50%, -50%) scale(${pop * f.scale})`;
      f.el.style.opacity = p.visible ? alpha : 0;
    }
  }

  clear() {
    for (const f of this.items) f.el.remove();
    this.items.length = 0;
  }
}

export class Particles {
  constructor(scene, container, project) {
    this.scene = scene;
    this.time = 0;
    this.soft = new PointPool(scene, 2600, THREE.NormalBlending, 0.42, 20);
    this.glow = new PointPool(scene, 1800, THREE.AdditiveBlending, 0.5, 21);

    const chunkMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
    this.chunks = new ChunkPool(scene, 420, new THREE.BoxGeometry(1, 1, 1), chunkMat);
    const coinMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.8, emissive: '#5a3a00', emissiveIntensity: 0.4 });
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.18, 14);
    this.coins = new ChunkPool(scene, 120, coinGeo, coinMat);
    this.floaters = new FloaterLayer(container, project);
  }

  setScale(s) {
    this.soft.material.uniforms.uScale.value = s;
    this.glow.material.uniforms.uScale.value = s;
  }

  update(dt) {
    this.time += dt;
    this.soft.update(dt, this.time);
    this.glow.update(dt, this.time);
    this.chunks.update(dt);
    this.coins.update(dt);
    this.floaters.update(dt);
  }

  clear() {
    this.soft.clear();
    this.glow.clear();
    this.chunks.clear();
    this.coins.clear();
    this.floaters.clear();
  }

  // ------------------------------------------------------------ emitters
  steam(x, y, z, strength = 1) {
    this.soft.spawn({
      x: x + rand(-0.12, 0.12), y, z: z + rand(-0.12, 0.12),
      vx: rand(-0.05, 0.05), vy: rand(0.5, 0.9), vz: rand(-0.05, 0.05),
      color: '#ffffff', size: 0.16, size2: 0.55, alpha: 0.38 * strength,
      life: rand(1.0, 1.6), drag: 0.6, turb: 0.6,
    });
  }

  smoke(x, y, z, dark = 1) {
    const c = dark > 0.6 ? '#2a2522' : '#77706a';
    this.soft.spawn({
      x: x + rand(-0.15, 0.15), y, z: z + rand(-0.15, 0.15),
      vx: rand(-0.1, 0.1), vy: rand(0.7, 1.3), vz: rand(-0.1, 0.1),
      color: c, color2: '#9a948e', size: 0.25, size2: 1.0 + dark * 0.5, alpha: 0.5 + dark * 0.3,
      life: rand(1.4, 2.4), drag: 0.5, turb: 0.9,
    });
  }

  sparks(x, y, z, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(0.6, 2.2);
      this.glow.spawn({
        x, y, z,
        vx: Math.cos(a) * s, vy: rand(1.5, 3.5), vz: Math.sin(a) * s,
        color: '#ffd27a', color2: '#ff4a00', size: rand(0.05, 0.09), size2: 0.02,
        alpha: 1, life: rand(0.35, 0.7), grav: -7, drag: 0.4,
      });
    }
  }

  fire(x, y, z, intensity = 1) {
    const spread = 0.32;
    this.glow.spawn({
      x: x + rand(-spread, spread), y: y + rand(0, 0.15), z: z + rand(-spread, spread),
      vx: rand(-0.15, 0.15), vy: rand(1.3, 2.4) * (0.7 + intensity * 0.5), vz: rand(-0.15, 0.15),
      color: '#fff0a0', color2: '#ff2a00', size: rand(0.45, 0.8) * (0.65 + intensity * 0.6), size2: 0.1,
      alpha: 0.95, life: rand(0.5, 0.85), drag: 0.6, turb: 2.4,
    });
    if (Math.random() < 0.35) {
      // hot core at the base
      this.glow.spawn({
        x: x + rand(-0.15, 0.15), y: y + 0.05, z: z + rand(-0.15, 0.15),
        vx: 0, vy: rand(0.4, 0.8), vz: 0,
        color: '#ffffff', color2: '#ffb000', size: rand(0.5, 0.75) * (0.6 + intensity * 0.5), size2: 0.2,
        alpha: 0.7, life: rand(0.25, 0.4),
      });
    }
    if (Math.random() < 0.18 * intensity) this.smoke(x, y + 0.9, z, 1);
    if (Math.random() < 0.12) this.sparks(x, y + 0.3, z, 1);
  }

  foam(x, y, z, dx, dz) {
    const s = rand(3.5, 5.5);
    const spread = 0.35;
    this.soft.spawn({
      x, y, z,
      vx: (dx + rand(-spread, spread)) * s, vy: rand(-0.2, 0.8), vz: (dz + rand(-spread, spread)) * s,
      color: '#ffffff', color2: '#dfe9f2', size: 0.12, size2: 0.6, alpha: 0.85,
      life: rand(0.55, 0.9), drag: 3.2, grav: -1.5,
    });
  }

  crumbs(x, y, z, color, n = 4) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(0.6, 1.8);
      this.chunks.spawn({
        x: x + rand(-0.1, 0.1), y: y + 0.05, z: z + rand(-0.1, 0.1),
        vx: Math.cos(a) * s, vy: rand(1.8, 3.6), vz: Math.sin(a) * s,
        color, scale: rand(0.04, 0.08), sy: rand(0.4, 1), life: rand(0.8, 1.4), floor: y - 0.02,
      });
    }
  }

  confetti(x, y, z, n = 30) {
    const cols = ['#ff5d73', '#ffd23f', '#3ec1d3', '#7bd148', '#a66cff', '#ff9f43'];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(0.5, 2.4);
      this.chunks.spawn({
        x, y, z,
        vx: Math.cos(a) * s, vy: rand(3.5, 6.5), vz: Math.sin(a) * s,
        color: cols[i % cols.length], scale: rand(0.07, 0.11), sy: 0.15, life: rand(1.6, 2.6), floor: 0.01, grav: -9,
      });
    }
  }

  coinsBurst(x, y, z, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(0.3, 1.2);
      this.coins.spawn({
        x, y, z,
        vx: Math.cos(a) * s, vy: rand(3, 5), vz: Math.sin(a) * s,
        color: '#ffcc33', scale: 0.16, life: rand(0.7, 1.1), floor: y - 0.1, grav: -16,
      });
    }
  }

  dust(x, z, n = 3, color = '#d8c8b0') {
    for (let i = 0; i < n; i++) {
      this.soft.spawn({
        x: x + rand(-0.15, 0.15), y: 0.08, z: z + rand(-0.15, 0.15),
        vx: rand(-0.6, 0.6), vy: rand(0.2, 0.6), vz: rand(-0.6, 0.6),
        color, size: 0.18, size2: 0.55, alpha: 0.55, life: rand(0.4, 0.75), drag: 3,
      });
    }
  }

  splash(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(0.4, 1.4);
      this.soft.spawn({
        x, y, z,
        vx: Math.cos(a) * s, vy: rand(1.5, 3), vz: Math.sin(a) * s,
        color: '#bfe8ff', color2: '#ffffff', size: rand(0.06, 0.12), size2: 0.04, alpha: 0.9,
        life: rand(0.35, 0.6), grav: -9,
      });
    }
    if (Math.random() < 0.6) this.bubbles(x, y, z, 2);
  }

  bubbles(x, y, z, n = 1) {
    for (let i = 0; i < n; i++) {
      this.soft.spawn({
        x: x + rand(-0.2, 0.2), y, z: z + rand(-0.2, 0.2),
        vx: 0, vy: rand(0.25, 0.6), vz: 0,
        color: '#ffffff', size: rand(0.05, 0.11), size2: 0.16, alpha: 0.75, life: rand(0.3, 0.6),
      });
    }
  }

  oilBubbles(x, y, z) {
    this.glow.spawn({
      x: x + rand(-0.2, 0.2), y, z: z + rand(-0.2, 0.2),
      vx: rand(-0.3, 0.3), vy: rand(0.6, 1.4), vz: rand(-0.3, 0.3),
      color: '#ffc85a', color2: '#6b3b00', size: rand(0.04, 0.08), size2: 0.02, alpha: 0.8, life: rand(0.2, 0.45), grav: -6,
    });
  }

  sparkle(x, y, z, color = '#fff3a0') {
    this.glow.spawn({
      x: x + rand(-0.35, 0.35), y: y + rand(0, 0.6), z: z + rand(-0.35, 0.35),
      vx: 0, vy: rand(0.3, 0.8), vz: 0,
      color, color2: '#ffffff', size: rand(0.08, 0.16), size2: 0.01, alpha: 1, life: rand(0.6, 1.1),
    });
  }

  poof(x, y, z, color = '#ffffff', n = 10) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.soft.spawn({
        x, y, z,
        vx: Math.cos(a) * rand(1.2, 2), vy: rand(0.2, 0.9), vz: Math.sin(a) * rand(1.2, 2),
        color, size: 0.25, size2: 0.65, alpha: 0.7, life: rand(0.4, 0.7), drag: 4,
      });
    }
  }

  // ------------------------------------------------------------ floaters
  cashText(x, y, z, amount) {
    this.floaters.spawn(x, y, z, `+$${Math.round(amount)}`, 'f-cash', { vy: 1.4, life: 1.7 });
  }
  costText(x, y, z, amount) {
    this.floaters.spawn(x, y, z, `-$${Math.round(amount)}`, 'f-cost', { vy: 0.9, life: 1.1, scale: 0.8 });
  }
  starsText(x, y, z, stars) {
    const full = clamp(Math.round(stars), 1, 5);
    this.floaters.spawn(x, y, z, '★'.repeat(full) + '<span class="dim">' + '★'.repeat(5 - full) + '</span>', 'f-stars', { vy: 1.0, life: 2.0 });
  }
  emoji(x, y, z, e, big = false) {
    this.floaters.spawn(x, y, z, e, big ? 'f-emoji big' : 'f-emoji', { vy: 0.9, life: 1.6, wobble: 4 });
  }
  label(x, y, z, text, cls = 'f-info') {
    this.floaters.spawn(x, y, z, text, cls, { vy: 0.8, life: 1.8 });
  }
}
