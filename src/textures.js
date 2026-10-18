// Procedurally painted canvas textures (floors, wallpaper, tablecloths, rugs, signage, street).

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { rand, randInt } from './utils.js';
import { gradeCanvas } from './look.js';

const cache = new Map();
let maxAniso = 4;
export function setMaxAnisotropy(a) { maxAniso = a; }

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // Painted once then read back (noise, grading): keep the canvas CPU-side
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

function toTexture(canvas, repeat = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function noise(ctx, w, h, amount = 18) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

// Each floor texture covers 2x2 world tiles.
export function floorTexture(theme) {
  return cached(`floor:${theme}`, () => {
    const S = 512;
    const [c, g] = makeCanvas(S, S);
    if (theme === 'wood') {
      const rows = 8;
      const rh = S / rows;
      const tones = ['#c48d58', '#b97f4b', '#cf9a63', '#ba8450', '#c99460'];
      for (let r = 0; r < rows; r++) {
        let x = -randInt(0, 200);
        while (x < S) {
          const len = randInt(180, 320);
          const tone = tones[randInt(0, tones.length - 1)];
          g.fillStyle = tone;
          g.fillRect(x, r * rh, len, rh);
          // grain
          g.strokeStyle = shade(tone, -0.06);
          g.lineWidth = 1.2;
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            const y0 = r * rh + rand(6, rh - 6);
            g.moveTo(x, y0);
            for (let px = x; px < x + len; px += 20) g.lineTo(px, y0 + Math.sin(px * 0.03 + k) * 2.5);
            g.stroke();
          }
          g.fillStyle = 'rgba(60,30,10,0.55)';
          g.fillRect(x, r * rh, 2, rh);
          x += len;
        }
        g.fillStyle = 'rgba(60,30,10,0.45)';
        g.fillRect(0, r * rh, S, 2);
      }
      noise(g, S, S, 14);
    } else if (theme === 'checker' || theme === 'mint') {
      const a = theme === 'checker' ? '#f4f1ea' : '#fff6e6';
      const b = theme === 'checker' ? '#2e3138' : '#8fd3c1';
      const n = 4;
      const t = S / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        g.fillStyle = (i + j) % 2 ? b : a;
        g.fillRect(i * t, j * t, t, t);
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.fillRect(i * t + 6, j * t + 6, t - 30, 10);
      }
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = 3;
      for (let i = 0; i <= n; i++) {
        g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, S); g.stroke();
        g.beginPath(); g.moveTo(0, i * t); g.lineTo(S, i * t); g.stroke();
      }
      noise(g, S, S, 10);
    } else if (theme === 'terracotta') {
      const n = 4;
      const t = S / n;
      g.fillStyle = '#c9b8a2';
      g.fillRect(0, 0, S, S);
      const tones = ['#d9774b', '#cf6d42', '#e0855a', '#c96640'];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        g.fillStyle = tones[randInt(0, 3)];
        g.fillRect(i * t + 4, j * t + 4, t - 8, t - 8);
        g.fillStyle = 'rgba(255,240,220,0.12)';
        g.fillRect(i * t + 10, j * t + 10, t - 30, 8);
      }
      noise(g, S, S, 22);
    } else if (theme === 'marble') {
      g.fillStyle = '#efece6';
      g.fillRect(0, 0, S, S);
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = `rgba(120,120,130,${rand(0.08, 0.3)})`;
        g.lineWidth = rand(0.6, 2.4);
        g.beginPath();
        let x = rand(0, S), y = rand(0, S);
        g.moveTo(x, y);
        for (let s = 0; s < 8; s++) {
          x += rand(-60, 60); y += rand(10, 70);
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.strokeStyle = '#c9a54a';
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, S / 2 - 3, S / 2 - 3);
      g.strokeRect(S / 2 + 1.5, 1.5, S / 2 - 3, S / 2 - 3);
      g.strokeRect(1.5, S / 2 + 1.5, S / 2 - 3, S / 2 - 3);
      g.strokeRect(S / 2 + 1.5, S / 2 + 1.5, S / 2 - 3, S / 2 - 3);
      noise(g, S, S, 8);
    }
    // Environment surfaces sit a step softer than the props & characters on top of them
    gradeCanvas(g, S, S, 0.84, 1.03);
    return toTexture(c);
  });
}

// Wall texture covers 1 world unit horizontally and the full wall height vertically.
export function wallTexture(theme) {
  return cached(`wall:${theme}`, () => {
    const W = 256, H = 690;
    const [c, g] = makeCanvas(W, H);
    const wainscot = H * 0.36; // bottom ~1m
    const top = H - wainscot;
    if (theme === 'cream') {
      for (let x = 0; x < W; x += 32) {
        g.fillStyle = (x / 32) % 2 ? '#f6ecd2' : '#fbf4e2';
        g.fillRect(x, 0, 32, top);
      }
      g.fillStyle = '#a8703f';
      g.fillRect(0, top, W, wainscot);
      for (let x = 0; x < W; x += 64) {
        g.fillStyle = '#b97f4b';
        g.fillRect(x + 8, top + 20, 48, wainscot - 40);
      }
      g.fillStyle = '#7d4d26';
      g.fillRect(0, top - 6, W, 12);
    } else if (theme === 'brick') {
      g.fillStyle = '#d7c6b0';
      g.fillRect(0, 0, W, H);
      const bh = 34, bw = 86;
      for (let row = 0; row * bh < H; row++) {
        const off = row % 2 ? -bw / 2 : 0;
        for (let x = off; x < W; x += bw) {
          g.fillStyle = ['#b5523b', '#a84a34', '#bd5d43', '#9e4430'][randInt(0, 3)];
          g.fillRect(x + 3, row * bh + 3, bw - 6, bh - 6);
          g.fillStyle = 'rgba(255,255,255,0.07)';
          g.fillRect(x + 6, row * bh + 5, bw - 14, 5);
        }
      }
      g.fillStyle = '#5b3a24';
      g.fillRect(0, H - 26, W, 26);
      noise(g, W, H, 18);
    } else if (theme === 'sage') {
      g.fillStyle = '#9cb89a';
      g.fillRect(0, 0, W, top);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (let y = 30; y < top; y += 80) for (let x = (y / 80) % 2 ? 64 : 0; x < W + 64; x += 128) {
        g.beginPath();
        g.moveTo(x, y - 26); g.quadraticCurveTo(x + 22, y, x, y + 26); g.quadraticCurveTo(x - 22, y, x, y - 26);
        g.fill();
        g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#f3efe4';
      g.fillRect(0, top, W, wainscot);
      g.strokeStyle = '#d9d2c0';
      g.lineWidth = 4;
      for (let x = 0; x < W; x += 128) g.strokeRect(x + 14, top + 22, 100, wainscot - 44);
      g.fillStyle = '#e8e1cf';
      g.fillRect(0, top - 8, W, 14);
    } else if (theme === 'navy') {
      g.fillStyle = '#26365c';
      g.fillRect(0, 0, W, top);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 2, top);
      g.fillStyle = '#d4af37';
      g.fillRect(0, top - 40, W, 4);
      g.fillStyle = '#f5f3ee';
      g.fillRect(0, top, W, wainscot);
      g.strokeStyle = '#d8d4ca';
      g.lineWidth = 5;
      for (let x = 0; x < W; x += 85) g.strokeRect(x + 10, top + 20, 65, wainscot - 40);
      g.fillStyle = '#ffffff';
      g.fillRect(0, top - 8, W, 14);
    } else if (theme === 'sunset') {
      const t = 64;
      for (let y = 0; y < H; y += t) for (let x = 0; x < W; x += t) {
        const k = y / H;
        const grad = g.createLinearGradient(x, y, x + t, y + t);
        grad.addColorStop(0, `hsl(${18 + k * 20}, 85%, ${68 - k * 10}%)`);
        grad.addColorStop(1, `hsl(${340 + k * 30}, 70%, ${62 - k * 8}%)`);
        g.fillStyle = grad;
        g.fillRect(x + 2, y + 2, t - 4, t - 4);
      }
      g.fillStyle = '#5a2d3c';
      g.fillRect(0, H - 22, W, 22);
      noise(g, W, H, 8);
    }
    gradeCanvas(g, W, H, 0.86, 1.02);
    return toTexture(c);
  });
}

export function ginghamTexture(color = '#e04848') {
  return cached(`gingham:${color}`, () => {
    const S = 128;
    const [c, g] = makeCanvas(S, S);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, S, S);
    const n = 8;
    const t = S / n;
    g.globalAlpha = 0.55;
    g.fillStyle = color;
    for (let i = 0; i < n; i += 2) {
      g.fillRect(i * t, 0, t, S);
      g.fillRect(0, i * t, S, t);
    }
    g.globalAlpha = 1;
    const tex = toTexture(c);
    tex.repeat.set(2, 2);
    return tex;
  });
}

export function rugTexture() {
  return cached('rug', () => {
    const S = 512;
    const [c, g] = makeCanvas(S, S);
    g.fillStyle = '#7d1f2b';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = '#e8c070';
    g.lineWidth = 10;
    g.strokeRect(24, 24, S - 48, S - 48);
    g.lineWidth = 4;
    g.strokeRect(48, 48, S - 96, S - 96);
    g.fillStyle = '#1f3a5f';
    g.fillRect(56, 56, S - 112, S - 112);
    g.save();
    g.translate(S / 2, S / 2);
    for (let r = 0; r < 4; r++) {
      g.rotate(Math.PI / 4);
      g.fillStyle = r % 2 ? '#e8c070' : '#b8323f';
      g.beginPath();
      g.moveTo(0, -150); g.lineTo(60, 0); g.lineTo(0, 150); g.lineTo(-60, 0);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#f2e3c4';
    g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b8323f';
    g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = '#e8c070';
    for (let i = 0; i < 4; i++) {
      const x = i % 2 ? S - 110 : 110, y = i < 2 ? 110 : S - 110;
      g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill();
    }
    noise(g, S, S, 16);
    return toTexture(c, false);
  });
}

export function beltTexture() {
  return cached('belt', () => {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#2d3036';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#ffb347';
    g.lineWidth = 9;
    g.lineCap = 'round';
    for (let y = 16; y < 128; y += 64) {
      g.beginPath();
      g.moveTo(34, y + 26); g.lineTo(64, y); g.lineTo(94, y + 26);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 128, 2);
    return toTexture(c);
  });
}

const SIGN_FONT = '"Lilita One", "Arial Rounded MT Bold", sans-serif';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Chunky outlined lettering (dark ink outline + drop shadow + bright fill), fitted to maxW
function inkText(g, text, x, y, size, maxW, fill, ink, outline) {
  let px = size;
  g.font = `400 ${px}px ${SIGN_FONT}`;
  const w = g.measureText(text).width;
  if (w > maxW) { px = Math.floor((px * maxW) / w); g.font = `400 ${px}px ${SIGN_FONT}`; }
  g.lineJoin = 'round';
  g.lineWidth = outline;
  g.strokeStyle = ink;
  g.fillStyle = ink;
  const d = Math.max(3, px * 0.07);
  g.strokeText(text, x, y + d);
  g.fillText(text, x, y + d);
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

export function signTexture(text, sub = '') {
  return cached(`sign:${text}:${sub}`, () => {
    const W = 1024, H = 256;
    const [c, g] = makeCanvas(W, H);
    // A bright game-style shop sign: ink-outlined board, sunny trim, cream lettering
    const ink = '#1d1a2f';
    g.fillStyle = ink;
    g.fillRect(0, 0, W, H);
    roundRect(g, 14, 14, W - 28, H - 28, 34);
    const grd = g.createLinearGradient(0, 14, 0, H - 14);
    grd.addColorStop(0, '#e2483a');
    grd.addColorStop(1, '#b82f2c');
    g.fillStyle = grd;
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#ffc93c';
    roundRect(g, 32, 32, W - 64, H - 64, 22);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(g, 44, 44, W - 88, (H - 88) * 0.42, 16);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const ty = sub ? H / 2 - 22 : H / 2 - 4;
    inkText(g, text, W / 2, ty, 124, W - 150, '#fff4d6', ink, 16);
    if (sub) inkText(g, sub.toUpperCase(), W / 2, H / 2 + 70, 40, W - 260, '#ffc93c', ink, 9);
    return toTexture(c, false);
  });
}

export function openSignTexture() {
  return cached('opensign', () => {
    const [c, g] = makeCanvas(256, 128);
    g.fillStyle = '#1d1a2f';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#ff5e8a';
    g.lineWidth = 5;
    g.shadowColor = '#ff2d6f';
    g.shadowBlur = 14;
    roundRect(g, 10, 10, 236, 108, 18);
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `400 74px ${SIGN_FONT}`;
    g.shadowBlur = 22;
    g.fillStyle = '#ffb3c8';
    g.fillText('OPEN', 128, 68);
    g.shadowBlur = 0;
    g.fillStyle = '#fff0f5';
    g.fillText('OPEN', 128, 66);
    return toTexture(c, false);
  });
}

export function grassTexture() {
  return cached('grass', () => {
    const S = 256;
    const [c, g] = makeCanvas(S, S);
    g.fillStyle = '#80ad58';
    g.fillRect(0, 0, S, S);
    // soft mottling, then little blade strokes (light tips, dark roots) — reads as lawn, not felt
    for (let i = 0; i < 60; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(120,180,80,0.18)' : 'rgba(100,160,70,0.16)';
      g.beginPath();
      g.arc(rand(0, S), rand(0, S), rand(8, 26), 0, Math.PI * 2);
      g.fill();
    }
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = rand(0, S), y = rand(0, S), h = rand(3, 7), lean = rand(-2, 2);
      g.strokeStyle = Math.random() < 0.55 ? 'rgba(70,128,48,0.28)' : 'rgba(186,228,128,0.3)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + lean, y - h);
      g.stroke();
    }
    return toTexture(c);
  });
}

export function sidewalkTexture() {
  return cached('sidewalk', () => {
    const S = 256;
    const [c, g] = makeCanvas(S, S);
    // Warm pale paving with soft bevelled joints
    g.fillStyle = '#ddd5c7';
    g.fillRect(0, 0, S, S);
    const tones = ['#e2dacc', '#d9d0c1', '#ded6c9', '#d5ccbd'];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = tones[i * 2 + j];
      g.fillRect(i * S / 2 + 3, j * S / 2 + 3, S / 2 - 6, S / 2 - 6);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(i * S / 2 + 4, j * S / 2 + 4, S / 2 - 8, 4);
    }
    g.strokeStyle = 'rgba(110,96,80,0.28)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, S / 2, S / 2);
    g.strokeRect(S / 2, 0, S / 2, S / 2);
    g.strokeRect(0, S / 2, S / 2, S / 2);
    g.strokeRect(S / 2, S / 2, S / 2, S / 2);
    noise(g, S, S, 10);
    return toTexture(c);
  });
}

export function roadTexture() {
  return cached('road', () => {
    const W = 256, H = 512;
    const [c, g] = makeCanvas(W, H);
    g.fillStyle = '#5b5e68';
    g.fillRect(0, 0, W, H);
    noise(g, W, H, 14);
    g.fillStyle = '#f0cf5a';
    g.fillRect(0, H / 2 - 5, W * 0.55, 10);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(0, 24, W, 6);
    g.fillRect(0, H - 30, W, 6);
    return toTexture(c);
  });
}

export function counterTopTexture() {
  return cached('butcher', () => {
    const S = 128;
    const [c, g] = makeCanvas(S, S);
    for (let x = 0; x < S; x += 16) {
      g.fillStyle = ['#e6c08a', '#dcb07a', '#ecc896', '#d9ab72'][(x / 16) % 4];
      g.fillRect(x, 0, 16, S);
      g.fillStyle = 'rgba(120,70,30,0.25)';
      g.fillRect(x, 0, 1, S);
    }
    noise(g, S, S, 10);
    return toTexture(c);
  });
}

export function tileTexture() {
  return cached('kitchentile', () => {
    const S = 128;
    const [c, g] = makeCanvas(S, S);
    g.fillStyle = '#d7dde3';
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 64) {
      const off = (y / 32) % 2 ? 32 : 0;
      g.fillStyle = '#f5f8fb';
      g.fillRect(x + off + 2, y + 2, 60, 28);
      g.fillRect(x + off - 64 + 2, y + 2, 60, 28);
    }
    return toTexture(c);
  });
}
