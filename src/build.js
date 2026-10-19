// Night-time grid build mode: ghost previews, rotation, placement validation (including
// reachability), moving existing objects and selling them.

import { icon } from './icons.js';
import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { CATALOG } from './catalog.js';
import { ECON } from './config.js';
import { buildAppliance } from './models.js';
import { formatMoney } from './utils.js';

export class BuildMode {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.selectedType = null;
    this.moving = null;
    this.rot = 0;
    this.ghost = null;
    this.ghostMats = [];
    this.hover = null;
    this.lastHelp = '';
    this.pending = null;
    this.toolsKey = '';
  }

  enter() {
    this.active = true;
    this.game.renderer.setGridVisible(true);
    this.help();
  }

  exit() {
    this.cancel();
    this.renderTools(null);
    this.active = false;
    const r = this.game.renderer;
    r.setGridVisible(false);
    r.setTileMarkers([], true);
    r.hideHighlight();
  }

  select(type) {
    this.cancelMove();
    this.selectedType = type;
    this.makeGhost(CATALOG[type]);
    // Touch screens have no hover: the preview sits in the middle of the room until the first tap
    this.aimed = !this.game.input.touchMode;
    this.pending = null;
  }

  cancel() {
    this.cancelMove();
    this.selectedType = null;
    this.removeGhost();
    this.game.renderer.setTileMarkers([], true);
  }

  cancelMove() {
    if (this.moving) {
      this.moving.mesh.visible = true;
      this.moving = null;
      this.removeGhost();
    }
  }

  makeGhost(def) {
    this.removeGhost();
    const g = buildAppliance(def);
    this.ghostMats = [];
    const cache = new Map();
    g.traverse((o) => {
      if (!o.isMesh) return;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      let m = cache.get(src.uuid);
      if (!m) {
        m = src.clone();
        m.transparent = true;
        m.opacity = 0.62;
        m.depthWrite = false;
        if (m.emissive) {
          m.emissive = new THREE.Color('#1f8a3a');
          m.emissiveIntensity = 0.55;
        }
        cache.set(src.uuid, m);
        this.ghostMats.push(m);
      }
      o.material = m;
      o.castShadow = false;
    });
    g.renderOrder = 8;
    this.game.renderer.scene.add(g);
    this.ghost = g;
  }

  removeGhost() {
    if (this.ghost) {
      this.game.renderer.scene.remove(this.ghost);
      for (const m of this.ghostMats) m.dispose();
      this.ghost = null;
      this.ghostMats = [];
    }
  }

  tint(ok) {
    for (const m of this.ghostMats) if (m.emissive) m.emissive.set(ok ? '#1f8a3a' : '#a01515');
  }

  help(text) {
    const touch = this.game.input.touchMode;
    const t = text || (this.selectedType || this.moving
      ? (touch ? '<b>Tap</b> a spot to preview it, then <b>tap again</b> to place' : '<b>Click</b> to place · <kbd>R</kbd> rotates · <b>right-click</b> or <kbd>Esc</kbd> cancels')
      : (touch
        ? '<b>Choose an item</b> below to buy it · <b>tap</b> a placed item to move or sell it · drag to pan, pinch to zoom'
        : '<b>Choose an item</b> below to buy it · <b>click</b> a placed item to move it · <b>right-click</b> or <kbd>X</kbd> sells it for 75% back · drag or <kbd>WASD</kbd> pans'));
    if (t !== this.lastHelp) {
      this.lastHelp = t;
      this.game.ui.setBuildHelp(t);
    }
  }

  footprintAt(def, sx, sy) {
    const p = this.game.renderer.screenToGround(sx, sy);
    if (!p) return null;
    const [w0, d0] = def.size;
    const w = this.rot % 2 ? d0 : w0, d = this.rot % 2 ? w0 : d0;
    return { x: Math.floor(p.x - w / 2 + 0.5), z: Math.floor(p.z - d / 2 + 0.5) };
  }

  rotate() {
    this.rot = (this.rot + 1) % 4;
    this.game.audio.click();
  }

  update() {
    if (!this.active) return;
    const g = this.game;
    const input = g.input;
    const r = g.renderer;
    const tap = input.tap && input.tap.button === 0 ? input.tap : null;
    if (input.wasPressed('KeyR')) this.rotate();
    if (input.wasPressed('Escape') && (this.selectedType || this.moving)) {
      this.cancel();
      g.ui.renderDock();
    }
    const placing = this.selectedType || this.moving;
    if (placing) {
      const shown = this.pending; // where the preview stood last frame, before this tap moved it
      if (tap) this.aimed = true;
      if (!this.aimed) {
        // follows the room centre while the camera settles (the dock folds away on phones)
        const c = r.project(g.grid.W / 2, 0, g.grid.H / 2);
        input.hover.x = c.x;
        input.hover.y = c.y;
      }
      const def = this.moving ? this.moving.def : CATALOG[this.selectedType];
      if (def.edge === 'right') this.rot = 1; // faces out through the right-hand wall
      const at = this.footprintAt(def, input.hover.x, input.hover.y);
      if (!at) { this.renderTools(null); return; }
      const { x, z } = at;
      const check = g.grid.canPlace(def, x, z, this.rot, this.moving);
      const afford = this.moving || g.state.cash >= def.price;
      const ok = check.ok && afford;
      const fp = check.fp;
      this.ghost.position.set(fp.cx, 0.02 + Math.sin(g.time * 6) * 0.02, fp.cz);
      this.ghost.rotation.y = this.rot * (Math.PI / 2);
      this.ghost.visible = true;
      this.tint(ok);
      r.setTileMarkers(fp.cells, ok);
      r.hideHighlight();
      const reason = !check.ok ? check.reason : !afford ? 'Not enough cash' : '';
      this.pending = { def, x, z, ok, reason };
      const how = input.touchMode ? '<b>Tap again</b> to place' : '<b>Click</b> place · <kbd>R</kbd> rotate · <b>Right-click</b> cancel';
      this.help(`${this.moving ? 'Moving' : 'Placing'} <b>${def.name}</b>${this.moving ? '' : ` (${formatMoney(def.price)})`}${reason ? `: <span class="bad">${reason}</span>` : ''} · ${how}`);
      if (tap) {
        // A click places right away (the preview already follows the mouse). A touch tap on the
        // preview places it; a tap anywhere else only moves the preview there.
        const t = this.footprintAt(def, tap.x, tap.y);
        const target = tap.touch ? shown : this.pending;
        if (t && target && t.x === target.x && t.z === target.z && target.def === def) this.tryCommit();
      }
      if (input.mouse.clicked[2]) {
        this.cancel();
        g.ui.renderDock();
      }
      this.renderTools({ moving: this.moving, ok });
      return;
    }

    // Hover / pick existing objects (mouse hovers; touch taps)
    r.setTileMarkers([], true);
    this.pending = null;
    const pick = (sx, sy) => {
      const p = r.screenToGround(sx, sy);
      if (!p) return null;
      const tx = Math.floor(p.x), tz = Math.floor(p.z);
      return g.grid.objectAt(tx, tz) || (g.grid.inBounds(tx, tz) ? g.grid.floorOcc[g.grid.idx(tx, tz)] : null);
    };
    this.hover = input.touchMode ? null : pick(input.hover.x, input.hover.y);
    const tapped = tap ? pick(tap.x, tap.y) : null;
    if (tapped) {
      this.startMove(tapped);
      return;
    }
    if (this.hover) {
      const o = this.hover;
      r.showHighlight(o.cx, 0.05, o.cz, o.w, o.d, '#9ad0ff');
      this.help(`<b>${o.def.name}</b> · <b>Click</b> to move · <b>Right-click</b>/<kbd>X</kbd> sell for <b>${formatMoney(Math.round(o.def.price * ECON.sellRefund))}</b>`);
      if (input.mouse.clicked[2] || input.wasPressed('KeyX') || input.wasPressed('Delete')) this.sell(o);
    } else {
      r.hideHighlight();
      this.help();
    }
    this.renderTools(null);
  }

  // While an item is being placed on a phone, fold the dock down to its tab row so the floor is visible
  updatePeek() {
    const placing = !!(this.selectedType || this.moving);
    this.game.ui.setDockPeek(placing && (this.game.input.touchMode || window.innerHeight < 560));
  }

  startMove(o) {
    this.aimed = true; // the preview starts where the item was tapped or clicked
    this.pending = null;
    this.moving = o;
    this.rot = o.rot;
    o.mesh.visible = false;
    this.makeGhost(o.def);
    this.game.audio.pickup();
  }

  tryCommit() {
    const g = this.game;
    const pd = this.pending;
    if (!pd) return;
    if (pd.ok) this.commit(pd.def, pd.x, pd.z);
    else {
      g.audio.error();
      if (pd.reason) g.ui.toast(pd.reason, 'warn');
    }
  }

  // On-screen toolbar so placement never requires a keyboard or right mouse button.
  renderTools(st) {
    const T = this.game.ui.e.buildTools;
    const key = st ? `${st.moving ? 'm' : 'p'}:${st.ok ? 1 : 0}:${st.moving ? st.moving.uid : ''}` : '';
    if (key === this.toolsKey) return;
    this.toolsKey = key;
    if (!st) {
      T.classList.add('hidden');
      T.innerHTML = '';
      return;
    }
    const refund = st.moving ? formatMoney(Math.round(st.moving.def.price * ECON.sellRefund)) : '';
    T.innerHTML = `<button type="button" data-tool="rotate">${icon('rotate')}Rotate</button>
      <button type="button" class="ok" data-tool="place" ${st.ok ? '' : 'disabled'}>${icon('check')}Place here</button>
      ${st.moving ? `<button type="button" class="bad" data-tool="sell">${icon('trash')}Sell for ${refund}</button>` : ''}
      <button type="button" data-tool="cancel">${icon('x')}Cancel</button>`;
    T.classList.remove('hidden');
    if (!T.onclick) {
      T.onclick = (ev) => {
        const b = ev.target.closest('button');
        if (!b || b.disabled) return;
        const g = this.game;
        const tool = b.dataset.tool;
        if (tool === 'rotate') this.rotate();
        else if (tool === 'place') this.tryCommit();
        else if (tool === 'sell' && this.moving) this.sell(this.moving);
        else if (tool === 'cancel') { g.audio.click(); this.cancel(); g.ui.renderDock(); }
      };
    }
  }

  commit(def, x, z) {
    const g = this.game;
    if (this.moving) {
      const o = this.moving;
      g.grid.move(o, x, z, this.rot);
      o.mesh.visible = true;
      this.moving = null;
      this.removeGhost();
      g.audio.place();
      g.particles.dust(o.cx, o.cz, 8);
    } else {
      if (!g.spend(def.price)) return;
      const o = g.grid.place(def.id, x, z, this.rot);
      g.audio.place();
      g.particles.poof(o.cx, 0.3, o.cz, '#fff6dd', 12);
      g.particles.dust(o.cx, o.cz, 8);
      g.renderer.addShake(0.08);
      if (g.state.cash < def.price) {
        this.cancel();
      }
    }
    g.onLayoutChanged();
    g.ui.renderDock();
  }

  sell(o) {
    const g = this.game;
    if (this.moving === o) {
      this.moving = null;
      this.removeGhost();
      this.game.renderer.setTileMarkers([], true);
    }
    const refund = Math.round(o.def.price * ECON.sellRefund);
    g.particles.poof(o.cx, 0.4, o.cz, '#ffffff', 14);
    g.grid.remove(o);
    g.addCash(refund, o.cx, 1.2, o.cz);
    g.audio.sell();
    this.hover = null;
    g.onLayoutChanged();
    g.ui.renderDock();
  }
}
