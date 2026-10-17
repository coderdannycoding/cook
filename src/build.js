// Night-time grid build mode: ghost previews, rotation, placement validation (including
// reachability), moving existing objects and selling them.

import * as THREE from 'three';
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
  }

  enter() {
    this.active = true;
    this.game.renderer.setGridVisible(true);
    this.help();
  }

  exit() {
    this.cancel();
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
    const t = text || (this.selectedType || this.moving
      ? '<b>Click</b> to place · <kbd>R</kbd> rotate · <b>Right-click</b>/<kbd>Esc</kbd> cancel'
      : '<b>Pick an item</b> below to buy · <b>Click</b> a placed item to move it · <b>Right-click</b> or <kbd>X</kbd> to sell (75% refund) · <kbd>WASD</kbd> pan · wheel zoom');
    if (t !== this.lastHelp) {
      this.lastHelp = t;
      this.game.ui.setBuildHelp(t);
    }
  }

  update() {
    if (!this.active) return;
    const g = this.game;
    const input = g.input;
    const r = g.renderer;
    const p = r.screenToGround(input.mouse.x, input.mouse.y);
    if (input.wasPressed('KeyR')) {
      this.rot = (this.rot + 1) % 4;
      g.audio.click();
    }
    if (input.wasPressed('Escape') && (this.selectedType || this.moving)) {
      this.cancel();
      g.ui.renderDock();
    }
    const placing = this.selectedType || this.moving;
    if (placing) {
      const def = this.moving ? this.moving.def : CATALOG[this.selectedType];
      const [w0, d0] = def.size;
      const w = this.rot % 2 ? d0 : w0, d = this.rot % 2 ? w0 : d0;
      if (!p) return;
      const x = Math.floor(p.x - w / 2 + 0.5), z = Math.floor(p.z - d / 2 + 0.5);
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
      this.help(`${this.moving ? 'Moving' : 'Placing'} <b>${def.name}</b>${this.moving ? '' : ` (${formatMoney(def.price)})`}${reason ? ` — <span class="bad">${reason}</span>` : ''} · <b>Click</b> place · <kbd>R</kbd> rotate · <b>Right-click</b> cancel`);
      if (input.mouse.clicked[0]) {
        if (ok) this.commit(def, x, z);
        else {
          g.audio.error();
          if (reason) g.ui.toast(reason, 'warn');
        }
      }
      if (input.mouse.clicked[2]) {
        this.cancel();
        g.ui.renderDock();
      }
      return;
    }

    // Hover / pick existing objects
    r.setTileMarkers([], true);
    this.hover = null;
    if (p) {
      const tx = Math.floor(p.x), tz = Math.floor(p.z);
      this.hover = g.grid.objectAt(tx, tz) || (g.grid.inBounds(tx, tz) ? g.grid.floorOcc[g.grid.idx(tx, tz)] : null);
    }
    if (this.hover) {
      const o = this.hover;
      r.showHighlight(o.cx, 0.05, o.cz, o.w, o.d, '#9ad0ff');
      this.help(`<b>${o.def.name}</b> · <b>Click</b> to move · <b>Right-click</b>/<kbd>X</kbd> sell for <b>${formatMoney(Math.round(o.def.price * ECON.sellRefund))}</b>`);
      if (input.mouse.clicked[0]) {
        this.moving = o;
        this.rot = o.rot;
        o.mesh.visible = false;
        this.makeGhost(o.def);
        g.audio.pickup();
      } else if (input.mouse.clicked[2] || input.wasPressed('KeyX') || input.wasPressed('Delete')) {
        this.sell(o);
      }
    } else {
      r.hideHighlight();
      this.help();
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
