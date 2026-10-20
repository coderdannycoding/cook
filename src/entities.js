// Characters: shared kinematics + expressive procedural animation (bobbing, squash & stretch,
// floating hands that grip held items, blinking, moods), plus the Player, Customer and Staff types.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { PLAYER } from './config.js';
import { buildCharacter, buildItem, playerLook, criticLook, vipLook, randomCustomerLook, staffLook, disposeObject } from './models.js';
import { STAFF_LEVELS } from './catalog.js';
import { clamp, damp, dampAngle, rand } from './utils.js';

// Building a character model takes several milliseconds, so random-looking guests and passers-by
// reuse finished models: a few are built ahead of time and every one is returned when it leaves.
const MODEL_POOL = [];
const POOL_MAX = 24;
export function warmCharacterPool(n = 1, target = 14) {
  for (let i = 0; i < n && MODEL_POOL.length < target; i++) {
    const look = randomCustomerLook();
    MODEL_POOL.push({ look, model: buildCharacter(look) });
  }
}
function resetModel(m) {
  m.root.position.set(0, 0, 0);
  m.root.rotation.set(0, 0, 0);
  m.root.visible = true;
  m.pivot.position.set(0, 0, 0);
  m.pivot.rotation.set(0, 0, 0);
  m.pivot.scale.set(1, 1, 1);
  m.head.rotation.set(0, 0, 0);
  m.eyes.scale.set(1, 1, 1);
  m.mouths.smile.visible = true;
  m.mouths.frown.visible = false;
  m.mouths.open.visible = false;
  m.footL.visible = m.footR.visible = true;
}

export class Character {
  // look: a look object, or null for a random guest (taken from the model pool)
  constructor(game, look) {
    this.game = game;
    if (look) {
      this.model = buildCharacter(look);
    } else {
      const p = MODEL_POOL.pop() ?? (() => { const l = randomCustomerLook(); return { look: l, model: buildCharacter(l) }; })();
      look = p.look;
      this.model = p.model;
      resetModel(this.model);
      this.pooled = true;
    }
    this.look = look;
    this.root = this.model.root;
    this.baseScale = look.scale || 1;
    game.charGroup.add(this.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.targetFacing = 0;
    this.radius = 0.28;
    this.held = null;
    this.heldKey = '';
    this.heldMesh = null;
    this.walkPhase = Math.random() * 10;
    this.squash = 0;
    this.squashV = 0;
    this.mood = 'smile';
    this.blinkT = rand(1, 4);
    this.path = null;
    this.pathI = 0;
    this.sitting = false;
    this.workingT = 0;
    this.cheer = 0;
    this.chopRate = 1;
    this.washRate = 1;
    this.speed = 3;
    this.t = Math.random() * 10;
    this.eatAnim = 0;
  }

  setPos(x, z) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.root.position.copy(this.pos);
  }

  get tileX() { return Math.floor(this.pos.x); }
  get tileZ() { return Math.floor(this.pos.z); }

  faceTo(x, z) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    if (dx * dx + dz * dz > 1e-6) this.targetFacing = Math.atan2(dx, dz);
  }

  bounce(amount = 0.6) { this.squashV += amount * 6; }

  setMood(m) {
    if (m === this.mood) return;
    this.mood = m;
    const ms = this.model.mouths;
    ms.smile.visible = m === 'smile';
    ms.frown.visible = m === 'frown';
    ms.open.visible = m === 'open';
  }

  setPath(path) {
    this.path = path;
    this.pathI = 0;
  }

  // Move along this.path. Returns 'arrived' | 'moving' | 'none'.
  followPath(dt, speed) {
    if (!this.path) return 'none';
    if (this.pathI >= this.path.length) {
      this.vel.set(0, 0, 0);
      return 'arrived';
    }
    const tgt = this.path[this.pathI];
    const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const last = this.pathI === this.path.length - 1;
    if (d < (last ? 0.07 : 0.3)) {
      this.pathI++;
      if (this.pathI >= this.path.length) {
        this.vel.set(0, 0, 0);
        return 'arrived';
      }
      return 'moving';
    }
    let sp = speed;
    if (last && d < 0.6) sp *= Math.max(0.35, d / 0.6);
    const tx = (dx / d) * sp, tz = (dz / d) * sp;
    this.vel.x = damp(this.vel.x, tx, 12, dt);
    this.vel.z = damp(this.vel.z, tz, 12, dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.targetFacing = Math.atan2(this.vel.x, this.vel.z);
    return 'moving';
  }

  syncHeld() {
    const it = this.held;
    const key = it ? `${it.uid}:${it.ver}` : '';
    if (key === this.heldKey) return;
    this.heldKey = key;
    const h = this.model.held;
    if (this.heldMesh) h.remove(this.heldMesh);
    this.heldMesh = null;
    if (it) {
      const m = buildItem(it);
      if (it.kind === 'tool') {
        m.rotation.x = Math.PI / 2;
        m.position.set(0, 0, -0.2);
      } else if (it.kind === 'plate') {
        m.position.y = -0.04;
      }
      m.userData.pop = 0;
      m.userData.base = it.kind === 'tool' ? 1 : 1.18;
      m.scale.setScalar(m.userData.base);
      h.add(m);
      this.heldMesh = m;
    }
  }

  updateVisual(dt) {
    this.t += dt;
    const m = this.model;
    const spd = Math.hypot(this.vel.x, this.vel.z);
    const moving = clamp(spd / 3, 0, 1);
    if (moving > 0.05) this.walkPhase += dt * (5 + spd * 2.6);
    this.facing = dampAngle(this.facing, this.targetFacing, 13, dt);

    // squash & stretch spring
    this.squashV += (-this.squash * 220 - this.squashV * 15) * dt;
    this.squash += this.squashV * dt;
    const s = clamp(this.squash, -0.5, 0.5);
    m.pivot.scale.set(1 + s * 0.28, 1 - s * 0.34, 1 + s * 0.28);

    this.root.position.set(this.pos.x, this.pos.y + (this.sitting ? 0.38 : 0), this.pos.z);
    this.root.rotation.y = this.facing;

    const bob = moving > 0.05 ? Math.abs(Math.sin(this.walkPhase)) * 0.075 * moving : Math.sin(this.t * 2.4) * 0.012;
    m.pivot.position.y = bob;
    m.pivot.rotation.x = moving * 0.13 + (this.workingT > 0 ? 0.12 : 0);
    m.pivot.rotation.z = this.pose === 'dance' && spd < 0.3 ? Math.sin(this.t * 3.25) * 0.16 : 0;
    m.head.rotation.z = moving > 0.05 ? Math.sin(this.walkPhase) * 0.05 : Math.sin(this.t * 1.3) * 0.03;

    // feet
    if (this.sitting) {
      m.footL.position.set(-0.11, -0.22, 0.24);
      m.footR.position.set(0.11, -0.22, 0.24);
      m.footL.visible = m.footR.visible = true;
    } else {
      const sw = Math.sin(this.walkPhase) * 0.13 * moving;
      m.footL.position.set(-0.11, 0.06 + Math.max(0, Math.cos(this.walkPhase)) * 0.06 * moving, 0.02 + sw);
      m.footR.position.set(0.11, 0.06 + Math.max(0, -Math.cos(this.walkPhase)) * 0.06 * moving, 0.02 - sw);
    }

    // hands
    const hl = m.handL.position, hr = m.handR.position;
    if (this.cheer > 0) {
      this.cheer -= dt;
      const w = Math.sin(this.t * 14) * 0.08;
      hl.set(-0.32, 1.25 + w, 0.05);
      hr.set(0.32, 1.25 - w, 0.05);
    } else if (this.held) {
      const plate = this.held.kind === 'plate';
      const hw = plate ? 0.3 : this.held.kind === 'tool' ? 0.12 : 0.2;
      hl.set(-hw, 0.6 + bob, 0.4);
      hr.set(hw, 0.6 + bob, 0.4);
    } else if (this.workingT > 0) {
      this.workingT -= dt;
      const c = Math.abs(Math.sin(this.t * 18));
      hl.set(-0.18, 0.62 + c * 0.12, 0.42);
      hr.set(0.18, 0.62 + (1 - c) * 0.12, 0.42);
    } else if (this.eatAnim > 0) {
      const c = Math.abs(Math.sin(this.t * 6));
      hl.set(-0.25, 0.55, 0.32);
      hr.set(0.12, 0.65 + c * 0.35, 0.3 - c * 0.05);
    } else if (this.pose === 'strum' && spd < 0.3) {
      hl.set(-0.3, 0.7, 0.3);
      hr.set(0.08 + Math.sin(this.t * 16) * 0.04, 0.5, 0.33);
    } else if (this.pose === 'dance' && spd < 0.3) {
      const a = this.t * 6.5;
      hl.set(-0.4, 0.95 + Math.sin(a) * 0.32, 0.12);
      hr.set(0.4, 0.95 - Math.sin(a) * 0.32, 0.12);
      m.pivot.position.y += Math.abs(Math.sin(a)) * 0.12;
    } else if (this.pose === 'clip' && spd < 0.3) {
      hl.set(-0.16, 0.66, 0.34);
      hr.set(0.1, 0.7 + Math.abs(Math.sin(this.t * 7)) * 0.04, 0.38);
    } else {
      const sw = Math.sin(this.walkPhase) * 0.14 * moving;
      hl.set(-0.33, 0.5 + bob * 0.6, 0.05 - sw);
      hr.set(0.33, 0.5 + bob * 0.6, 0.05 + sw);
    }
    m.held.position.set(0, 0.6 + bob, 0.4);

    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      m.eyes.scale.y = 0.15;
      if (this.blinkT < -0.12) {
        this.blinkT = rand(2, 5);
        m.eyes.scale.y = 1;
      }
    }

    this.syncHeld();
    if (this.heldMesh && this.heldMesh.userData.pop < 1) {
      const hm = this.heldMesh;
      hm.userData.pop = Math.min(1, hm.userData.pop + dt * 7);
      const k = (1 + Math.sin(hm.userData.pop * Math.PI) * 0.3) * hm.userData.base;
      hm.scale.setScalar(k);
    }
  }

  dispose() {
    this.game.charGroup.remove(this.root);
    if (this.heldMesh) {
      this.model.held.remove(this.heldMesh);
      disposeObject(this.heldMesh);
      this.heldMesh = null;
    }
    if (this.pooled && MODEL_POOL.length < POOL_MAX) MODEL_POOL.push({ look: this.look, model: this.model });
    else disposeObject(this.root);
  }
}

export class Player extends Character {
  constructor(game, color, look = null) {
    super(game, look || playerLook(color));
    this.radius = PLAYER.radius;
    this.dashT = 0;
    this.dashCD = 0;
    this.dashDir = new THREE.Vector3(0, 0, 1);
    this.target = null;
    this.targetCell = null;
    this.workLatch = null;
    this.spraying = false;
    this.stepT = 0;
    this.moved = 0;
  }

  get dashReady() { return this.dashCD <= 0; }

  update(dt) {
    const g = this.game;
    const input = g.input;
    const mv = input.moveVector();
    const yaw = g.renderer.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let wx = rx * mv.x + fx * mv.y;
    let wz = rz * mv.x + fz * mv.y;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const maxSpeed = PLAYER.speed * g.upg('speed');

    this.dashCD -= dt;
    if (input.dashPressed && this.dashCD <= 0) {
      this.dashT = PLAYER.dashTime;
      this.dashCD = g.upg('dash');
      if (len > 0.1) this.dashDir.set(wx, 0, wz).normalize();
      else this.dashDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.squash = -0.35;
      this.squashV = -2;
      g.audio.swoosh();
      g.particles.dust(this.pos.x, this.pos.z, 6);
      g.events.emit('dash');
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.x = this.dashDir.x * PLAYER.dashSpeed;
      this.vel.z = this.dashDir.z * PLAYER.dashSpeed;
      if (Math.random() < 0.7) g.particles.dust(this.pos.x, this.pos.z, 1, '#e8dccb');
      if (this.dashT <= 0) { this.bounce(0.5); }
    } else {
      const k = len > 0.05 ? PLAYER.accel : PLAYER.friction;
      this.vel.x = damp(this.vel.x, wx * maxSpeed, k / 3, dt);
      this.vel.z = damp(this.vel.z, wz * maxSpeed, k / 3, dt);
    }
    const px = this.pos.x, pz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    g.grid.collide(this.pos, this.radius);
    // Kill velocity into walls so we don't "stick"
    if (dt > 0) {
      this.vel.x = (this.pos.x - px) / dt * 0.999 || 0;
      this.vel.z = (this.pos.z - pz) / dt * 0.999 || 0;
      if (this.dashT <= 0) {
        // recover desired velocity component for smooth control next frame
        this.vel.x = clamp(this.vel.x, -maxSpeed * 1.05, maxSpeed * 1.05);
        this.vel.z = clamp(this.vel.z, -maxSpeed * 1.05, maxSpeed * 1.05);
      }
    }
    this.moved += Math.hypot(this.pos.x - px, this.pos.z - pz);

    if (len > 0.1) this.targetFacing = Math.atan2(wx, wz);
    const spd = Math.hypot(this.vel.x, this.vel.z);
    if (spd > 1) {
      this.stepT -= dt * spd;
      if (this.stepT < 0) {
        this.stepT = 1.4;
        if (Math.random() < 0.5) g.particles.dust(this.pos.x, this.pos.z, 1);
      }
    }

    // Targeting
    this.target = this.findTarget();
    if (this.target) {
      const c = this.targetCell;
      g.renderer.showHighlight(c.x + 0.5, (this.target.kind === 'table' ? this.target.topY : this.target.topY) + 0.02, c.z + 0.5, 1, 1, this.target.fire > 0 ? '#ff5a3d' : '#fff4a8');
    } else g.renderer.hideHighlight();

    // Pick up / drop
    if (input.pickPressed) {
      const before = this.held;
      const res = g.interact.pickDrop(this, this.target);
      if (res.ok) {
        this.bounce(0.45);
        if (res.kind === 'take' || res.kind === 'clear' || res.kind === 'scoop') g.audio.pickup();
        else if (res.kind === 'serve') g.audio.clink();
        else if (res.kind !== 'trash') g.audio.drop();
        g.events.emit('player:action', { kind: res.kind, station: this.target, before, after: this.held });
      } else if (this.target || this.held) {
        if (res.msg) {
          g.audio.error();
          g.particles.label(this.pos.x, 1.9, this.pos.z, res.msg, 'f-warn');
        }
      }
      this.workLatch = null;
    }

    // Work / spray
    this.spraying = false;
    let working = false;
    if (this.held && this.held.kind === 'tool') {
      if (input.workHeld) {
        this.spraying = true;
        const dx = Math.sin(this.facing), dz = Math.cos(this.facing);
        const ox = this.pos.x + dx * 0.55, oz = this.pos.z + dz * 0.55;
        for (let i = 0; i < 3; i++) g.particles.foam(ox, 1.0, oz, dx, dz);
        g.fire.spray(this.pos.x, this.pos.z, dx, dz, dt);
        this.vel.x -= dx * dt * 3;
        this.vel.z -= dz * dt * 3;
      }
    } else {
      if (input.workPressed && this.target) this.workLatch = this.target;
      if (this.workLatch && (this.workLatch !== this.target || len > 0.2)) this.workLatch = null;
      if ((input.workHeld || this.workLatch) && this.target) {
        working = g.interact.work(this, this.target, dt);
        if (working) this.workingT = 0.15;
        else this.workLatch = null;
        if (!working && input.workPressed && this.held && this.target.canWork?.(this)) {
          g.audio.error();
          g.particles.label(this.pos.x, 1.9, this.pos.z, 'Hands full', 'f-warn');
        }
      }
    }
    g.audio.setLoop('spray', this.spraying || g.staffSpraying ? 1 : 0);
    g.staffSpraying = false;
    this.working = working;

    // Cash magnet
    for (const t of g.grid.stations('table')) {
      if (t.cash > 0 && Math.hypot(t.x - this.pos.x, t.z - this.pos.z) < 1.6) t.collectCash();
    }
  }

  // What the chef will interact with. Counters sit on a grid, so the aim snaps to the nearest of the
  // four grid directions (keeping the previous one until you steer clearly past the diagonal); a
  // diagonal approach into a corner then still picks the crate you're in front of rather than the
  // board beside it. Among stations in that direction the closest wins, the current target is
  // sticky so the choice doesn't flicker, and stations that can use what you're holding get a nudge.
  findTarget() {
    const grid = this.game.grid;
    const raw = this.targetFacing;
    let snap = Math.round(raw / (Math.PI / 2)) * (Math.PI / 2);
    if (this.aimSnap !== undefined) {
      const off = Math.atan2(Math.sin(raw - this.aimSnap), Math.cos(raw - this.aimSnap));
      if (Math.abs(off) < Math.PI / 4 + 0.2) snap = this.aimSnap;
    }
    this.aimSnap = snap;
    const fx = Math.sin(snap), fz = Math.cos(snap);
    const ptx = this.tileX, ptz = this.tileZ;
    let best = null, bestScore = Infinity, bestCell = null;
    const acts = new Map();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const x = ptx + dx, z = ptz + dz;
        const s = grid.stationAt(x, z);
        if (!s || s.kind === 'grabber') continue;
        // nearest point of this tile to the chef
        const cx = clamp(this.pos.x, x, x + 1), cz = clamp(this.pos.z, z, z + 1);
        const d = Math.hypot(cx - this.pos.x, cz - this.pos.z);
        if (d > 0.85) continue;
        const vx = x + 0.5 - this.pos.x, vz = z + 0.5 - this.pos.z;
        const vl = Math.hypot(vx, vz) || 1;
        const dot = (vx * fx + vz * fz) / vl;
        if (dot < 0.3) continue;
        let score = d + 0.55 * (1 - dot);
        if (s === this.target) score -= 0.12;
        if (!acts.has(s)) acts.set(s, this.wouldAct(s));
        if (acts.get(s)) score -= 0.06;
        if (score < bestScore) { bestScore = score; best = s; bestCell = { x, z }; }
      }
    }
    this.targetCell = bestCell;
    return best;
  }

  wouldAct(st) {
    try {
      const d = this.game.interact.describe(this, st);
      return !!(d && (d.e || d.f));
    } catch {
      return false;
    }
  }
}

export class Customer extends Character {
  constructor(game, group, critic = false, vip = false) {
    super(game, critic ? criticLook() : vip ? vipLook() : null);
    this.group = group;
    this.critic = critic;
    this.vip = vip;
    this.state = 'arriving';
    this.order = null;
    this.patience = 1;
    this.patienceMax = 60;
    this.thinkT = 0;
    this.seat = null;
    this.table = null;
    this.eatProgress = 0;
    this.claimedBy = null;
    this.ticket = null;
    this.review = 5;
    this.waypoints = [];
    this.speed = rand(1.9, 2.4);
    this.emoteT = rand(2, 5);
    if (critic || vip) {
      const ringGeo = new THREE.RingGeometry(0.42, 0.55, 32).rotateX(-Math.PI / 2);
      ringGeo.userData.own = true;
      const ringMat = new THREE.MeshBasicMaterial({ color: vip ? '#ff6fd0' : '#ffd700', transparent: true, opacity: 0.7, depthWrite: false });
      ringMat.userData.unique = true;
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.03;
      ring.renderOrder = 6;
      this.root.add(ring);
      this.aura = ring;
    }
  }

  onServed(plate) {
    this.game.customers.onServed(this, plate);
  }
}

export class Staff extends Character {
  constructor(game, data) {
    super(game, { ...staffLook(data.role, data.seed), ...(data.look || {}) });
    this.data = data;
    this.role = data.role;
    this.brain = null;
    this.status = '';
    this.applyLevel();
  }

  applyLevel() {
    const L = STAFF_LEVELS[Math.max(0, Math.min(STAFF_LEVELS.length - 1, this.data.level - 1))];
    this.speed = this.baseSpeed = L.speed;
    this.chopRate = this.washRate = this.baseWork = L.work;
  }
}

