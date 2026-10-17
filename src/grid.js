// Restaurant floor grid: object placement & rotation, occupancy, collision,
// reachability checks (so layouts can never block a station) and serialization.

import * as THREE from 'three';
import { CATALOG } from './catalog.js';
import { buildAppliance } from './models.js';
import { createStation } from './stations.js';
import { clamp, uid, easeOutBack, DIRS4 } from './utils.js';

const AUTOMATION_EXEMPT = new Set(['conveyor', 'grabber']);

export class Grid {
  constructor(game) {
    this.game = game;
    this.W = 0;
    this.H = 0;
    this.doorX = 0;
    this.objects = [];
    this.occ = [];
    this.floorOcc = [];
    this.solid = new Uint8Array(0);
    this.group = new THREE.Group();
    game.renderer.scene.add(this.group);
    this.version = 0;
  }

  setSize(W, H) {
    this.W = W;
    this.H = H;
    this.doorX = W - 2;
    this.rebuildOccupancy();
  }

  get doorTile() { return { x: this.doorX, z: this.H - 1 }; }
  idx(x, z) { return z * this.W + x; }
  inBounds(x, z) { return x >= 0 && z >= 0 && x < this.W && z < this.H; }

  footprint(def, x, z, rot) {
    const [w0, d0] = def.size;
    const swap = rot % 2 === 1;
    const w = swap ? d0 : w0;
    const d = swap ? w0 : d0;
    const cx = x + w / 2;
    const cz = z + d / 2;
    const theta = rot * (Math.PI / 2);
    const c = Math.round(Math.cos(theta));
    const s = Math.round(Math.sin(theta));
    let local = def.cells;
    if (!local) {
      local = [];
      for (let lx = 0; lx < w0; lx++) for (let lz = 0; lz < d0; lz++) local.push([lx, lz, 'main']);
    }
    const cells = local.map(([lx, lz, role]) => {
      const ox = lx + 0.5 - w0 / 2;
      const oz = lz + 0.5 - d0 / 2;
      const rx = ox * c + oz * s;
      const rz = -ox * s + oz * c;
      return { x: Math.floor(cx + rx + 1e-6), z: Math.floor(cz + rz + 1e-6), role: role || 'main', lx, lz };
    });
    return { cells, w, d, cx, cz };
  }

  rebuildOccupancy() {
    const n = this.W * this.H;
    this.occ = new Array(n).fill(null);
    this.floorOcc = new Array(n).fill(null);
    this.solid = new Uint8Array(n);
    for (const o of this.objects) {
      for (const c of o.cells) {
        if (!this.inBounds(c.x, c.z)) continue;
        const i = this.idx(c.x, c.z);
        if (o.def.layer === 'floor') this.floorOcc[i] = o;
        else {
          this.occ[i] = o;
          if (o.def.solid) this.solid[i] = 1;
        }
      }
    }
    this.version++;
  }

  objectAt(x, z) {
    if (!this.inBounds(x, z)) return null;
    return this.occ[this.idx(x, z)];
  }

  stationAt(x, z) {
    const o = this.objectAt(x, z);
    return o ? o.station : null;
  }

  isSolid(x, z) {
    if (!this.inBounds(x, z)) return true;
    return this.solid[this.idx(x, z)] === 1;
  }

  isWalkable(x, z) { return !this.isSolid(x, z); }

  // ------------------------------------------------------------ placement
  canPlace(def, x, z, rot, ignore = null) {
    const fp = this.footprint(def, x, z, rot);
    const door = this.doorTile;
    for (const c of fp.cells) {
      if (!this.inBounds(c.x, c.z)) return { ok: false, reason: 'Out of bounds', fp };
      const i = this.idx(c.x, c.z);
      if (def.layer === 'floor') {
        const o = this.floorOcc[i];
        if (o && o !== ignore) return { ok: false, reason: 'Space occupied', fp };
      } else {
        const o = this.occ[i];
        if (o && o !== ignore) return { ok: false, reason: 'Space occupied', fp };
        if (c.x === door.x && c.z === door.z) return { ok: false, reason: 'Keep the doorway clear', fp };
      }
    }
    if (def.layer !== 'floor' && def.solid) {
      const blocked = this.accessProblem(fp.cells, ignore, def);
      if (blocked) return { ok: false, reason: blocked, fp };
    }
    return { ok: true, reason: '', fp };
  }

  // Simulate placing `cells` and verify every station stays reachable from the door.
  accessProblem(newCells, ignore, newDef) {
    const solid = new Uint8Array(this.solid);
    if (ignore) for (const c of ignore.cells) if (this.inBounds(c.x, c.z) && ignore.def.layer !== 'floor') solid[this.idx(c.x, c.z)] = 0;
    for (const c of newCells) solid[this.idx(c.x, c.z)] = 1;
    const reach = this.reachable(solid);
    const fakeNew = { def: newDef, cells: newCells };
    const list = this.objects.filter((o) => o !== ignore && o.def.layer !== 'floor');
    list.push(fakeNew);
    for (const o of list) {
      if (!this.needsAccess(o.def)) continue;
      if (!this.hasAccess(o, reach)) return o === fakeNew ? 'No room to reach it there' : `Would block the ${o.def.name}`;
    }
    return null;
  }

  needsAccess(def) {
    return !!def.station && !AUTOMATION_EXEMPT.has(def.station);
  }

  hasAccess(o, reach) {
    if (o.def.station === 'table') {
      let tableOk = false;
      for (const c of o.cells) {
        const near = DIRS4.some(([dx, dz]) => this._reach(reach, c.x + dx, c.z + dz));
        if (c.role === 'seat' && !near) return false;
        if (c.role === 'table' && near) tableOk = true;
      }
      return tableOk;
    }
    for (const c of o.cells) {
      if (DIRS4.some(([dx, dz]) => this._reach(reach, c.x + dx, c.z + dz))) return true;
    }
    return false;
  }

  _reach(reach, x, z) {
    return this.inBounds(x, z) && reach[this.idx(x, z)] === 1;
  }

  reachable(solid = this.solid) {
    const reach = new Uint8Array(this.W * this.H);
    const d = this.doorTile;
    if (solid[this.idx(d.x, d.z)]) return reach;
    const q = [d.x, d.z];
    reach[this.idx(d.x, d.z)] = 1;
    while (q.length) {
      const z = q.pop();
      const x = q.pop();
      for (const [dx, dz] of DIRS4) {
        const nx = x + dx, nz = z + dz;
        if (!this.inBounds(nx, nz)) continue;
        const i = this.idx(nx, nz);
        if (reach[i] || solid[i]) continue;
        reach[i] = 1;
        q.push(nx, nz);
      }
    }
    return reach;
  }

  // Walkable tiles adjacent to the object's interactive cells.
  accessTiles(obj) {
    const out = [];
    const seen = new Set();
    for (const c of obj.cells) {
      if (obj.def.station === 'table' && c.role !== 'table') continue;
      for (const [dx, dz] of DIRS4) {
        const x = c.x + dx, z = c.z + dz;
        const k = x * 1000 + z;
        if (seen.has(k) || !this.isWalkable(x, z)) continue;
        seen.add(k);
        out.push({ x, z, fx: c.x, fz: c.z });
      }
    }
    return out;
  }

  place(type, x, z, rot = 0, opts = {}) {
    const def = CATALOG[type];
    if (!def) return null;
    const fp = this.footprint(def, x, z, rot);
    const obj = { uid: uid(), type, def, x, z, rot, ...fp, popT: opts.silent ? 1 : 0 };
    obj.mesh = buildAppliance(def);
    obj.mesh.position.set(fp.cx, 0, fp.cz);
    obj.mesh.rotation.y = rot * (Math.PI / 2);
    obj.mesh.userData.obj = obj;
    if (!opts.silent) obj.mesh.scale.setScalar(0.01);
    this.group.add(obj.mesh);
    obj.station = createStation(obj, this.game);
    this.objects.push(obj);
    this.rebuildOccupancy();
    return obj;
  }

  move(obj, x, z, rot) {
    const fp = this.footprint(obj.def, x, z, rot);
    Object.assign(obj, { x, z, rot, ...fp });
    obj.mesh.position.set(fp.cx, 0, fp.cz);
    obj.mesh.rotation.y = rot * (Math.PI / 2);
    obj.popT = 0.3;
    obj.station?.onMoved?.();
    this.rebuildOccupancy();
  }

  remove(obj) {
    const i = this.objects.indexOf(obj);
    if (i >= 0) this.objects.splice(i, 1);
    this.group.remove(obj.mesh);
    obj.station?.dispose?.();
    this.rebuildOccupancy();
  }

  clear() {
    for (const o of [...this.objects]) this.remove(o);
  }

  stations(kind = null) {
    const out = [];
    for (const o of this.objects) {
      if (!o.station) continue;
      if (!kind || o.station.kind === kind) out.push(o.station);
    }
    return out;
  }

  countType(type) {
    return this.objects.filter((o) => o.type === type).length;
  }

  serialize() {
    return this.objects.map((o) => ({ type: o.type, x: o.x, z: o.z, rot: o.rot }));
  }

  // ------------------------------------------------------------ collision
  // Push a circle (pos.x, pos.z, r) out of solid tiles and the room bounds.
  collide(pos, r, allowOutside = false) {
    if (!allowOutside) {
      pos.x = clamp(pos.x, r, this.W - r);
      pos.z = clamp(pos.z, r, this.H - r);
    }
    for (let iter = 0; iter < 2; iter++) {
      const x0 = Math.floor(pos.x - r), x1 = Math.floor(pos.x + r);
      const z0 = Math.floor(pos.z - r), z1 = Math.floor(pos.z + r);
      for (let tx = x0; tx <= x1; tx++) {
        for (let tz = z0; tz <= z1; tz++) {
          if (!this.inBounds(tx, tz)) continue;
          if (!this.solid[this.idx(tx, tz)]) continue;
          const cx = clamp(pos.x, tx, tx + 1);
          const cz = clamp(pos.z, tz, tz + 1);
          let dx = pos.x - cx, dz = pos.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 < 1e-8) {
            // centre inside tile: push out along the shallowest axis
            const left = pos.x - tx, right = tx + 1 - pos.x, top = pos.z - tz, bottom = tz + 1 - pos.z;
            const m = Math.min(left, right, top, bottom);
            if (m === left) pos.x = tx - r;
            else if (m === right) pos.x = tx + 1 + r;
            else if (m === top) pos.z = tz - r;
            else pos.z = tz + 1 + r;
            continue;
          }
          const d = Math.sqrt(d2);
          const push = r - d;
          pos.x += (dx / d) * push;
          pos.z += (dz / d) * push;
        }
      }
    }
  }

  // Is a straight walk from a to b (with body radius r) free of solid tiles?
  lineClear(ax, az, bx, bz, r = 0.28) {
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(2, Math.ceil(len / 0.15));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        if (this.isSolid(Math.floor(x + ox), Math.floor(z + oz))) return false;
      }
    }
    return true;
  }

  update(dt, t) {
    for (const o of this.objects) {
      if (o.popT < 1) {
        o.popT = Math.min(1, o.popT + dt * 3);
        const s = Math.max(0.01, easeOutBack(o.popT));
        o.mesh.scale.set(s, s, s);
      }
      if (o.station) o.station.animate(dt, t);
      const an = o.mesh.userData.animate;
      if (an) an(t, dt);
    }
  }
}
