// Avatar editor: restyle the chef or any worker (skin, hair, hats, outfit colours, extras) with a
// live 3D preview. Only the choices that differ from the default look are saved.

import { ThumbnailBaker } from './renderer.js';
import { buildCharacter } from './models.js';
import { icon } from './icons.js';
import { pick } from './utils.js';

const SKINS = ['#ffe3cc', '#ffd9b8', '#f5c49c', '#e0a878', '#c68a5a', '#9a6440', '#6e4428'];
const HAIRS = ['#2b1d14', '#4a2f1e', '#8a5a2b', '#d6a24a', '#e8d3a0', '#b03a2e', '#1c1c24', '#7d7d86', '#5a2d6e', '#2f6fd6', '#ff6fae', '#2fbf5f'];
const COLORS = ['#fbfbf8', '#e8343f', '#ff8a3a', '#ffbb1f', '#2fbf5f', '#2f8cf0', '#2b2d5c', '#9b5cf6', '#ff6fae', '#8d99ae', '#1d1a2f', '#6b4f3a'];
const HAIR_STYLES = [['short', 'Short'], ['bob', 'Bob'], ['bun', 'Bun'], ['pony', 'Ponytail'], ['spiky', 'Spiky'], ['curly', 'Curly'], ['long', 'Long'], ['afro', 'Afro'], ['bald', 'Bald']];
const HATS = [
  [null, 'None'], ['chef', 'Chef'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['beret', 'Beret'], ['bandana', 'Bandana'], ['fedora', 'Fedora'],
  ['tophat', 'Top hat'], ['cowboy', 'Cowboy'], ['party', 'Party'], ['crown', 'Crown'], ['flowers', 'Flowers'],
];
const TINTED_HATS = new Set(['cap', 'beanie', 'beret', 'bandana', 'fedora', 'tophat', 'cowboy', 'party']);
const EXTRAS = [['glasses', 'Glasses'], ['shades', 'Sunglasses'], ['mustache', 'Mustache']];
const KEYS = ['skin', 'hair', 'hairStyle', 'hat', 'hatColor', 'shirt', 'pants', 'apron', 'vest', 'scarf', 'bowtie', 'glasses', 'shades', 'mustache'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// opts: { title, base (default look), look (saved overrides), name (optional, editable), onSave(overrides, name) }
export function openAvatarEditor(game, opts) {
  const ui = game.ui;
  const base = opts.base;
  let cur = { ...base, ...(opts.look || {}) };
  let name = opts.name ?? null;
  let baker = null;
  try {
    baker = new ThumbnailBaker(256);
  } catch {
    baker = null; // no second WebGL context available: the editor still works without a preview
  }

  const swatches = (key, list, none) => `${none ? `<button class="av-sw none ${!cur[key] ? 'on' : ''}" data-k="${key}" data-v="" aria-label="None">${icon('x')}</button>` : ''}${list
    .map((c) => `<button class="av-sw ${cur[key] === c ? 'on' : ''}" data-k="${key}" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}`;
  const chips = (key, list) => list.map(([v, label]) => `<button class="av-chip ${(cur[key] ?? null) === v ? 'on' : ''}" data-k="${key}" data-v="${v ?? ''}">${label}</button>`).join('');
  const row = (label, inner) => `<div class="av-row"><div class="av-label">${label}</div><div class="av-opts-row">${inner}</div></div>`;

  const body = () => `
    ${name !== null ? `<label class="av-name"><span class="av-label">Name</span><input type="text" maxlength="14" value="${esc(name)}" data-name></label>` : ''}
    ${row('Skin', swatches('skin', SKINS))}
    ${row('Hair', chips('hairStyle', HAIR_STYLES))}
    ${row('Hair colour', swatches('hair', HAIRS))}
    ${row('Hat', chips('hat', HATS))}
    ${TINTED_HATS.has(cur.hat) ? row('Hat colour', swatches('hatColor', COLORS)) : ''}
    ${row('Shirt', swatches('shirt', COLORS))}
    ${row('Trousers', swatches('pants', COLORS))}
    ${row('Apron', swatches('apron', COLORS, true))}
    ${row('Vest', swatches('vest', COLORS, true))}
    ${row('Scarf', swatches('scarf', COLORS, true))}
    ${row('Bow tie', swatches('bowtie', COLORS, true))}
    ${row('Extras', EXTRAS.map(([k, label]) => `<button class="av-chip ${cur[k] ? 'on' : ''}" data-t="${k}">${label}</button>`).join(''))}
    <div class="av-row"><div class="av-label"></div><div class="av-opts-row"><button class="av-chip" data-a="reset">Back to default</button></div></div>`;

  const w = ui.modal(`
    <h2>${esc(opts.title)}</h2>
    <div class="av-body">
      <div class="av-preview"><img alt="Preview"></div>
      <div class="av-opts">${body()}</div>
    </div>
    <div class="m-actions">
      <button class="big-btn ghost" data-a="close">Cancel</button>
      <button class="big-btn ghost" data-a="random">Surprise me</button>
      <button class="big-btn primary" data-a="save">Save</button>
    </div>`, 'avatar');
  const img = w.querySelector('.av-preview img');
  const optsEl = w.querySelector('.av-opts');

  const preview = () => {
    if (!baker) return;
    try {
      img.src = baker.bake(buildCharacter(cur).root, { elevation: 0.22, yaw: 0.5, pad: 1.06 });
    } catch {
      /* preview is a nicety; ignore a lost context */
    }
  };
  const refresh = () => {
    const scroll = optsEl.scrollTop;
    optsEl.innerHTML = body();
    optsEl.scrollTop = scroll;
    preview();
  };
  const close = () => {
    ui.closeModal(w);
    baker?.dispose();
    baker = null;
  };

  w.addEventListener('input', (ev) => {
    if (ev.target.matches('[data-name]')) name = ev.target.value;
  });
  w.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    game.audio.click();
    if (b.dataset.k) {
      const v = b.dataset.v || null;
      cur[b.dataset.k] = v;
      if (b.dataset.k === 'hat' && TINTED_HATS.has(v) && !cur.hatColor) cur.hatColor = COLORS[1];
      refresh();
      return;
    }
    if (b.dataset.t) {
      const k = b.dataset.t;
      cur[k] = !cur[k];
      if (k === 'glasses' && cur.glasses) cur.shades = false;
      if (k === 'shades' && cur.shades) cur.glasses = false;
      refresh();
      return;
    }
    const a = b.dataset.a;
    if (a === 'random') {
      const hat = pick(HATS)[0];
      cur = {
        ...cur,
        skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(HAIR_STYLES)[0], hat, hatColor: pick(COLORS), shirt: pick(COLORS), pants: pick(COLORS),
        apron: Math.random() < 0.6 ? pick(COLORS) : null, vest: Math.random() < 0.25 ? pick(COLORS) : null,
        scarf: Math.random() < 0.35 ? pick(COLORS) : null, bowtie: Math.random() < 0.25 ? pick(COLORS) : null,
        glasses: Math.random() < 0.2, shades: false, mustache: Math.random() < 0.2,
      };
      if (!cur.glasses) cur.shades = Math.random() < 0.15;
      refresh();
    } else if (a === 'reset') {
      cur = { ...base };
      refresh();
    } else if (a === 'save') {
      const out = {};
      for (const k of KEYS) if ((cur[k] ?? null) !== (base[k] ?? null)) out[k] = cur[k] ?? null;
      close();
      opts.onSave(out, name !== null ? (name.trim() || opts.name) : null);
    } else if (a === 'close') close();
  });
  preview();
  return w;
}
