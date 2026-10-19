// Three.js renderer: isometric orthographic camera, soft shadows, day/night lighting,
// a pooled set of warm point lights, the restaurant shell + street, and a thumbnail baker.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { CAMERA, WALL_HEIGHT, FRONT_WALL_HEIGHT, LIGHT_POOL_SIZE } from './config.js';
import { clamp, damp, lerp, rand } from './utils.js';
import {
  floorTexture, wallTexture, grassTexture, sidewalkTexture, roadTexture, signTexture, openSignTexture, setMaxAnisotropy,
} from './textures.js';
import {
  mat, mesh, box, cyl, sph, torus, mergeStatic, buildStreetLamp, buildCar, buildBench, buildPointer, envMats, disposeObject,
} from './models.js';
import { LOOK, buildAOStrips, buildGarden, makeGroundMaterial } from './look.js';
import { TOWN_STAGES, buildTown, townLots, townStagePos } from './town.js';
import { driveLane } from './drivethru.js';
import { signTex } from './decor.js';

// Time-of-day grade. fog = the horizon haze the top of the screen fades into (also the clear
// colour); sun = warm key; hemi = cool sky fill over a warm ground bounce; rim = the sky-rim
// tint & strength on characters/props; fill = warm interior glow; lamps = street/table lamps.
const SKY_KEYS = [
  { h: 0, fog: '#141a32', sun: '#9db3ea', sunI: 0.44, hemiSky: '#42548a', hemiGround: '#2a2220', hemiI: 0.54, fill: 1, lamps: 1, rim: '#9fb8ff', rimI: 0.55 },
  { h: 8, fog: '#ffd9b4', sun: '#ffd09c', sunI: 2.4, hemiSky: '#bcd8fa', hemiGround: '#86684c', hemiI: 0.78, fill: 0.12, lamps: 0.15, rim: '#fff0d8', rimI: 0.55 },
  { h: 10, fog: '#cfe7f2', sun: '#ffeccc', sunI: 3.0, hemiSky: '#a8d0ff', hemiGround: '#957555', hemiI: 0.8, fill: 0.03, lamps: 0, rim: '#fff6e8', rimI: 0.5 },
  { h: 13, fog: '#cae6f4', sun: '#fff1da', sunI: 3.2, hemiSky: '#a4ceff', hemiGround: '#967656', hemiI: 0.8, fill: 0, lamps: 0, rim: '#fffaf0', rimI: 0.48 },
  { h: 17, fog: '#f2dcc0', sun: '#ffdca6', sunI: 3.0, hemiSky: '#b8d2f2', hemiGround: '#946e4e', hemiI: 0.8, fill: 0.04, lamps: 0, rim: '#ffefd0', rimI: 0.55 },
  { h: 19.3, fog: '#ffcf9c', sun: '#ffc274', sunI: 2.7, hemiSky: '#a2b8ea', hemiGround: '#86603f', hemiI: 0.82, fill: 0.25, lamps: 0.4, rim: '#ffd59c', rimI: 0.8 },
  { h: 20.6, fog: '#eea07c', sun: '#ff9e5e', sunI: 1.7, hemiSky: '#b29aa4', hemiGround: '#523a32', hemiI: 0.8, fill: 0.7, lamps: 0.9, rim: '#ffb884', rimI: 0.8 },
  { h: 21.6, fog: '#2a2a46', sun: '#a6b6e6', sunI: 0.6, hemiSky: '#4e5c88', hemiGround: '#2c2420', hemiI: 0.62, fill: 0.95, lamps: 1, rim: '#a8c0ff', rimI: 0.6 },
  { h: 24, fog: '#141a32', sun: '#9db3ea', sunI: 0.44, hemiSky: '#42548a', hemiGround: '#2a2220', hemiI: 0.54, fill: 1, lamps: 1, rim: '#9fb8ff', rimI: 0.55 },
];
const OUTLINE_DAY = new THREE.Color('#3a2418');
const OUTLINE_NIGHT = new THREE.Color('#1a1018');

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _v = new THREE.Vector3();

function sampleSky(hour) {
  hour = ((hour % 24) + 24) % 24;
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (hour >= SKY_KEYS[i].h && hour <= SKY_KEYS[i + 1].h) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const t = (hour - a.h) / Math.max(0.0001, b.h - a.h);
  const col = (k) => `#${_c1.set(a[k]).lerp(_c2.set(b[k]), t).getHexString()}`;
  return {
    fog: col('fog'), sun: col('sun'), hemiSky: col('hemiSky'), hemiGround: col('hemiGround'), rim: col('rim'),
    sunI: lerp(a.sunI, b.sunI, t), hemiI: lerp(a.hemiI, b.hemiI, t), fill: lerp(a.fill, b.fill, t), lamps: lerp(a.lamps, b.lamps, t), rimI: lerp(a.rimI, b.rimI, t),
  };
}

export class Renderer {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // Phones and tablets have high-DPI screens but modest GPUs: start them at a lighter resolution
    let coarse = false;
    try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch { coarse = false; }
    this.mobile = coarse && Math.min(window.innerWidth, window.innerHeight) < 900;
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 1.75);
    this.renderer.setPixelRatio(this.maxPixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Neutral tone mapping keeps authored hues & saturation (ACES greys them out), for a bright,
    // saturated "hit game" palette.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    // The sky itself is never in frame (the camera looks down at the ground), so the "sky
    // gradient" is aerial haze: fog that thickens toward the top of the screen in the horizon
    // colour of the hour, which also gives a soft tilt-shift depth falloff.
    this.scene.background = new THREE.Color('#d2ebf6');
    this.scene.fog = new THREE.Fog('#d2ebf6', 41, 74);

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    this.viewSize = CAMERA.dayView;
    this.targetView = CAMERA.dayView;
    this.camTarget = new THREE.Vector3(6, 0, 4.5);
    this.camSmooth = new THREE.Vector3(6, 0, 4.5);
    this.yaw = CAMERA.yaw;
    this.targetYaw = CAMERA.yaw;
    this.shake = 0;
    this.time = 0;

    this._initEnvironmentMap();
    this._initLights();

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.roomGroup = new THREE.Group();
    this.streetGroup = new THREE.Group();
    this.world.add(this.roomGroup, this.streetGroup);

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this._initHelpers();
    this.cars = [];
    this.town = null;
    this.townLevel = 0;
    this.driveZ = null;
    this.doorOpen = 0;
    this.doorTarget = 0;
    this.openSignOn = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _initEnvironmentMap() {
    // A simple procedural "studio" for reflections on metals.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();
    env.background = new THREE.Color('#8a8f99');
    const add = (color, intensity, x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
      m.position.set(x, y, z);
      env.add(m);
    };
    add('#fff4e0', 6, 0, 8, 0, 10, 0.5, 10);
    add('#bfe0ff', 3, -9, 3, 0, 0.5, 6, 12);
    add('#ffd0a0', 2.5, 9, 2, 3, 0.5, 4, 8);
    add('#3b3026', 1, 0, -4, 0, 30, 0.5, 30);
    this.envMap = pmrem.fromScene(env, 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
  }

  _initLights() {
    // Cool sky fill over a warm ground bounce; shadows pick up the blue, lit faces the warm sun
    this.hemi = new THREE.HemisphereLight('#b0d6ff', '#9c7c5c', 1.0);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff4e2', 2.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 3;
    const sc = this.sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
    this.scene.add(this.sun, this.sun.target);

    // Warm "interior" spotlight used in the evening/night so the restaurant glows while the street stays dark
    this.fill = new THREE.SpotLight('#ffc888', 0, 0, 0.6, 0.6, 0);
    this.fill.position.set(6, 14, 4.5);
    this.scene.add(this.fill, this.fill.target);

    this.pool = [];
    for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
      const l = new THREE.PointLight('#ffb070', 0, 4, 2);
      l.position.set(0, -50, 0);
      this.scene.add(l);
      this.pool.push(l);
    }
    this.lightRequests = [];
    this.lampLevel = 0;
  }

  _initHelpers() {
    // Target highlight frame
    const ring = new THREE.RingGeometry(0.62, 0.72, 4, 1);
    ring.rotateZ(Math.PI / 4);
    ring.rotateX(-Math.PI / 2);
    this.highlightMat = new THREE.MeshBasicMaterial({ color: '#fff4a8', transparent: true, opacity: 0.9, depthWrite: false });
    this.highlight = new THREE.Mesh(ring, this.highlightMat);
    this.highlight.renderOrder = 10;
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    // Build grid
    this.gridLines = null;

    // Build tile markers
    this.tileMarkers = [];
    const tg = new THREE.PlaneGeometry(0.94, 0.94);
    tg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: '#4cff8a', transparent: true, opacity: 0.35, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 5;
      this.scene.add(m);
      this.tileMarkers.push(m);
    }

    // Tutorial pointer
    this.pointer = buildPointer();
    this.pointer.visible = false;
    this.scene.add(this.pointer);
    this.pointerPos = new THREE.Vector3();
  }

  // Adaptive quality: 2 = full, 1 = reduced resolution, 0 = low (also cheaper shadows)
  setQuality(level) {
    this.quality = level;
    const pr = level >= 2 ? this.maxPixelRatio : level === 1 ? Math.max(1, this.maxPixelRatio * 0.7) : 1;
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.type = level === 0 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (level === 0 && this.sun.shadow.mapSize.x > 1024) {
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this._updateProjection();
  }

  _updateProjection() {
    const aspect = this.width / this.height;
    const halfH = this.viewSize / 2;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  get pixelsPerUnit() {
    return this.renderer.getContext().drawingBufferHeight / this.viewSize;
  }

  // ---------------------------------------------------------------- room shell
  buildRoom(W, H, doorX, floorTheme, wallTheme, name = 'Sizzle Shack') {
    this.W = W;
    this.H = H;
    this.doorX = doorX;
    const g = this.roomGroup;
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      c.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData.ownGeo || o.geometry.userData.merged) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m.userData.ownTex && m.map) m.map.dispose();
          if (m.userData.ownMat) m.dispose();
        }
      });
    }

    // Floor
    const ft = floorTexture(floorTheme).clone();
    ft.needsUpdate = true;
    ft.repeat.set(W / 2, H / 2);
    const floorGeo = new THREE.PlaneGeometry(W, H);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ map: ft, roughness: floorTheme === 'marble' ? 0.25 : 0.7, metalness: 0.0 });
    floorMat.userData.ownTex = floorMat.userData.ownMat = true;
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(W / 2, 0, H / 2);
    floor.receiveShadow = true;
    floor.userData.ownGeo = true;
    g.add(floor);
    this.floorMesh = floor;

    // Back walls (tall, textured inside)
    const wt = wallTexture(wallTheme);
    const env = { kind: 'env' };
    const wallOuter = mat('#efe3d0', { r: 0.9, ...env });
    const makeWall = (len, alongX) => {
      const t = wt.clone();
      t.needsUpdate = true;
      t.repeat.set(len, 1);
      const inner = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
      inner.userData.ownTex = inner.userData.ownMat = true;
      const geo = new THREE.BoxGeometry(alongX ? len : 0.3, WALL_HEIGHT, alongX ? 0.3 : len);
      // Box material order: +x, -x, +y, -y, +z, -z
      const mats = alongX ? [wallOuter, wallOuter, wallOuter, wallOuter, inner, wallOuter] : [inner, wallOuter, wallOuter, wallOuter, wallOuter, wallOuter];
      const m = new THREE.Mesh(geo, mats);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.ownGeo = true;
      return m;
    };
    const wz = makeWall(W + 0.3, true);
    wz.position.set(W / 2 - 0.15, WALL_HEIGHT / 2, -0.15);
    const wx = makeWall(H, false);
    wx.position.set(-0.15, WALL_HEIGHT / 2, H / 2);
    g.add(wz, wx);
    const capM = mat('#7a5034', { r: 0.6, ...env });
    const cap1 = mesh(new THREE.BoxGeometry(W + 0.42, 0.12, 0.42), capM, W / 2 - 0.15, WALL_HEIGHT + 0.06, -0.15);
    const cap2 = mesh(new THREE.BoxGeometry(0.42, 0.12, H + 0.3), capM, -0.15, WALL_HEIGHT + 0.06, H / 2 - 0.15);
    cap1.userData.ownGeo = cap2.userData.ownGeo = true;
    g.add(cap1, cap2);

    // Windows on the back walls
    const winGroup = new THREE.Group();
    const frameM = mat('#f6f1e8', { r: 0.6, ...env });
    const addWindow = (x, z, alongX) => {
      const w = new THREE.Group();
      w.add(mesh(box(1.3, 1.0, 0.08), frameM, 0, 0, 0));
      const glass = new THREE.Mesh(box(1.12, 0.84, 0.1), envMats.windowGlass);
      w.add(glass);
      w.add(mesh(box(0.05, 0.84, 0.12), frameM, 0, 0, 0));
      w.add(mesh(box(1.12, 0.05, 0.12), frameM, 0, 0, 0));
      w.add(mesh(box(1.45, 0.08, 0.22), frameM, 0, -0.52, 0.06));
      w.position.set(x, 1.75, z);
      if (!alongX) w.rotation.y = Math.PI / 2;
      winGroup.add(w);
    };
    for (let x = 2.5; x < W - 1.5; x += 4) addWindow(x, 0.01, true);
    for (let z = 2.5; z < H - 1.5; z += 4) addWindow(0.01, z, false);
    g.add(mergeStatic(winGroup, 'env'));

    // Wall clock
    this.clock = new THREE.Group();
    const face = mesh(cyl(0.34, 0.34, 0.05, 28), mat('#fffdf5', { r: 0.4, ...env }), 0, 0, 0, false);
    face.rotation.x = Math.PI / 2;
    this.clock.add(face);
    const rim = mesh(torus(0.34, 0.04, 8, 28), mat('#8a5a33', { r: 0.5, ...env }), 0, 0, 0.02, false);
    this.clock.add(rim);
    for (let i = 0; i < 12; i++) {
      const tick = mesh(box(0.03, 0.07, 0.02), mat('#333', env), Math.sin((i / 12) * Math.PI * 2) * 0.27, Math.cos((i / 12) * Math.PI * 2) * 0.27, 0.035, false);
      tick.rotation.z = -(i / 12) * Math.PI * 2;
      this.clock.add(tick);
    }
    this.hourHand = new THREE.Group();
    this.hourHand.add(mesh(box(0.04, 0.17, 0.02), mat('#222'), 0, 0.08, 0.045, false));
    this.minHand = new THREE.Group();
    this.minHand.add(mesh(box(0.025, 0.25, 0.02), mat('#c0392b'), 0, 0.12, 0.05, false));
    this.clock.add(this.hourHand, this.minHand);
    this.hourHand.userData.dynamic = this.minHand.userData.dynamic = true;
    this.clock.position.set(Math.min(W - 2, 7.5), 2.15, 0.06);
    mergeStatic(this.clock, 'env');
    g.add(this.clock);

    // Front low walls with a door gap
    const lowM = mat('#c97c5e', { r: 0.85, ...env });
    const lowCap = mat('#f4e8d2', { r: 0.7, ...env });
    const lowWalls = new THREE.Group();
    const lw = (x0, x1, z0, z1) => {
      const len = Math.max(x1 - x0, z1 - z0);
      const alongX = x1 - x0 > z1 - z0;
      const m = mesh(new THREE.BoxGeometry(alongX ? len : 0.22, FRONT_WALL_HEIGHT, alongX ? 0.22 : len), lowM, (x0 + x1) / 2, FRONT_WALL_HEIGHT / 2, (z0 + z1) / 2);
      const c = mesh(new THREE.BoxGeometry(alongX ? len + 0.06 : 0.3, 0.07, alongX ? 0.3 : len + 0.06), lowCap, (x0 + x1) / 2, FRONT_WALL_HEIGHT + 0.035, (z0 + z1) / 2);
      lowWalls.add(m, c);
    };
    lw(-0.3, doorX, H + 0.11, H + 0.11);
    lw(doorX + 1, W + 0.22, H + 0.11, H + 0.11);
    lw(W + 0.11, W + 0.11, -0.3, H);
    mergeStatic(lowWalls, 'env');
    lowWalls.traverse((o) => { if (o.isMesh) o.userData.ownGeo = true; });
    g.add(lowWalls);
    // Flower boxes on the low wall
    const flowers = new THREE.Group();
    const petalCols = ['#ff6b8b', '#ffd23f', '#ffffff', '#b980ff', '#ff8c42'];
    for (let x = 0.6; x < W; x += 1.6) {
      if (Math.abs(x + 0.4 - (doorX + 0.5)) < 1.4) continue;
      flowers.add(mesh(box(0.8, 0.14, 0.24), mat('#8a5a36', env), x + 0.4, FRONT_WALL_HEIGHT + 0.14, H + 0.11));
      for (let k = 0; k < 4; k++) {
        flowers.add(mesh(sph(0.075, 8, 6), mat('#4c9a4a'), x + 0.12 + k * 0.19, FRONT_WALL_HEIGHT + 0.25, H + 0.11));
        flowers.add(mesh(sph(0.045, 8, 6), mat(petalCols[(k + Math.floor(x)) % petalCols.length]), x + 0.12 + k * 0.19, FRONT_WALL_HEIGHT + 0.33, H + 0.11 + 0.02));
      }
    }
    for (let z = 0.6; z < H - 0.4; z += 1.6) {
      flowers.add(mesh(box(0.24, 0.14, 0.8), mat('#8a5a36', env), W + 0.11, FRONT_WALL_HEIGHT + 0.14, z + 0.4));
      for (let k = 0; k < 4; k++) {
        flowers.add(mesh(sph(0.075, 8, 6), mat('#4c9a4a'), W + 0.11, FRONT_WALL_HEIGHT + 0.25, z + 0.12 + k * 0.19));
        flowers.add(mesh(sph(0.045, 8, 6), mat(petalCols[(k + Math.floor(z)) % petalCols.length]), W + 0.13, FRONT_WALL_HEIGHT + 0.33, z + 0.12 + k * 0.19));
      }
    }
    mergeStatic(flowers);
    flowers.traverse((o) => { if (o.isMesh) o.userData.ownGeo = true; });
    g.add(flowers);

    // Door frame, double doors, awning and sign
    const door = new THREE.Group();
    const postM = mat('#4a2f1e', { r: 0.6, ...env });
    door.add(mesh(box(0.14, 2.4, 0.26), postM, doorX, 1.2, H + 0.11));
    door.add(mesh(box(0.14, 2.4, 0.26), postM, doorX + 1, 1.2, H + 0.11));
    door.add(mesh(box(1.28, 0.16, 0.3), postM, doorX + 0.5, 2.42, H + 0.11));
    g.add(mergeStatic(door, 'env'));
    const leafM = mat('#bfe6ff', { op: 0.45, r: 0.05, ...env });
    const leafFrame = mat('#5a3a24', env);
    this.doorLeaves = [];
    for (const side of [0, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(doorX + 0.07 + side * 0.86, 0, H + 0.11);
      const leaf = new THREE.Group();
      leaf.add(mesh(box(0.42, 2.1, 0.05), leafM, 0, 1.08, 0, false));
      leaf.add(mesh(box(0.44, 0.08, 0.07), leafFrame, 0, 0.06, 0));
      leaf.add(mesh(box(0.44, 0.08, 0.07), leafFrame, 0, 2.12, 0));
      leaf.add(mesh(box(0.05, 2.1, 0.07), leafFrame, side ? 0.2 : -0.2, 1.08, 0));
      leaf.add(mesh(cyl(0.02, 0.02, 0.3, 6), mat('#d8a845', { m: 0.8, r: 0.3 }), side ? -0.15 : 0.15, 1.05, 0.06));
      leaf.position.x = side ? -0.215 : 0.215;
      mergeStatic(leaf, 'env');
      pivot.add(leaf);
      pivot.userData.side = side;
      g.add(pivot);
      this.doorLeaves.push(pivot);
    }
    // Awning
    const awning = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const s = mesh(box(0.25, 0.04, 1.0), mat(i % 2 ? '#ffffff' : '#d63c3c', { r: 0.8 }), doorX - 0.5 + 0.125 + i * 0.25, 2.62, H + 0.58);
      s.rotation.x = 0.35;
      awning.add(s);
    }
    mergeStatic(awning);
    awning.traverse((o) => { if (o.isMesh) o.userData.ownGeo = true; });
    g.add(awning);
    // Sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshStandardMaterial({ map: signTexture(name, 'open 10 am to 10 pm'), emissive: '#ffffff', emissiveMap: signTexture(name, 'open 10 am to 10 pm'), emissiveIntensity: 0.35, roughness: 0.6 }));
    sign.position.set(doorX + 0.5, 3.15, H + 0.18);
    sign.userData.ownGeo = true;
    g.add(sign);
    this.signMat = sign.material;
    g.add(mesh(box(2.75, 0.8, 0.08), mat('#1d1a2f', env), doorX + 0.5, 3.15, H + 0.12));
    // Neon OPEN sign
    this.openSignMat = new THREE.MeshStandardMaterial({ map: openSignTexture(), emissive: '#ffffff', emissiveMap: openSignTexture(), emissiveIntensity: 0.0, roughness: 0.5 });
    const os = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), this.openSignMat);
    os.position.set(doorX - 0.9, 1.2, H + 0.24);
    os.userData.ownGeo = true;
    g.add(os);

    // Floor trim (dark edge)
    const trim = mat('#3a2a1e', env);
    const trimM = mesh(new THREE.BoxGeometry(W, 0.03, 0.08), trim, W / 2, 0.015, H - 0.04, false);
    trimM.userData.ownGeo = true;
    g.add(trimM);

    // Fake ambient occlusion: soft dark gradients in the creases where walls meet the floor,
    // inside and out (one transparent draw call)
    const fy = 0.004, py = -0.011, sy = 0.009;
    g.add(buildAOStrips([
      { o: [0, fy, 0], along: [W, 0, 0], across: [0, 0, 0.62] },
      { o: [0, fy, 0], along: [0, 0, H], across: [0.62, 0, 0] },
      { o: [0, 0, 0.004], along: [W, 0, 0], across: [0, 0.5, 0] },
      { o: [0.004, 0, 0], along: [0, 0, H], across: [0, 0.5, 0] },
      { o: [0, fy, H], along: [doorX, 0, 0], across: [0, 0, -0.32] },
      { o: [doorX + 1, fy, H], along: [W - doorX - 1, 0, 0], across: [0, 0, -0.32] },
      { o: [W, fy, 0], along: [0, 0, H], across: [-0.32, 0, 0] },
      { o: [-0.3, py, -0.3], along: [W + 0.52, 0, 0], across: [0, 0, -0.62] },
      { o: [-0.3, py, -0.3], along: [0, 0, H + 0.52], across: [-0.62, 0, 0] },
      { o: [-0.3, sy, H + 0.22], along: [doorX + 0.3, 0, 0], across: [0, 0, 0.42] },
      { o: [doorX + 1, sy, H + 0.22], along: [W + 0.22 - doorX - 1, 0, 0], across: [0, 0, 0.42] },
      { o: [W + 0.22, py, -0.3], along: [0, 0, H + 0.52], across: [0.42, 0, 0] },
    ]));

    this._buildGrid(W, H);
    this._buildStreet(W, H, doorX);
    this._fitShadow();
  }

  _buildGrid(W, H) {
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.geometry.dispose();
    }
    const pts = [];
    for (let x = 0; x <= W; x++) pts.push(x, 0.02, 0, x, 0.02, H);
    for (let z = 0; z <= H; z++) pts.push(0, 0.02, z, W, 0.02, z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.gridLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    this.gridLines.visible = false;
    this.gridLines.renderOrder = 4;
    this.scene.add(this.gridLines);
  }

  _buildStreet(W, H, doorX) {
    const g = this.streetGroup;
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      disposeObject(c);
      c.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData.ownGeo) o.geometry.dispose();
        if (o.material.userData.ownMat) { o.material.map?.dispose(); o.material.dispose(); }
      });
    }
    this.cars.length = 0;
    const cx = W / 2;
    const own = (m) => { m.userData.ownGeo = true; m.material.userData.ownMat = true; return m; };

    // Lawn: tiling grass detail × a large soft colour-variation map (painted, not flat green)
    const grass = grassTexture().clone();
    grass.needsUpdate = true;
    grass.repeat.set(40, 40);
    const ground = own(new THREE.Mesh(new THREE.PlaneGeometry(160, 160), makeGroundMaterial(grass, cx, H / 2)));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, -0.03, H / 2);
    ground.receiveShadow = true;
    g.add(ground);

    // Patio around the building + a parking pad for the parked car (world-space UVs, one mesh)
    const rects = [[-1, -1.5, W + 2, H + 0.5], [W + 2, H - 4.2, W + 4.3, H + 0.5]];
    const pp = [], pu = [], pi = [];
    for (const [x0, z0, x1, z1] of rects) {
      const b = pp.length / 3;
      pp.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
      pu.push(x0 / 2, -z0 / 2, x1 / 2, -z0 / 2, x1 / 2, -z1 / 2, x0 / 2, -z1 / 2);
      pi.push(b, b + 3, b + 2, b, b + 2, b + 1);
    }
    const patioGeo = new THREE.BufferGeometry();
    patioGeo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    patioGeo.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2));
    patioGeo.setIndex(pi);
    patioGeo.computeVertexNormals();
    const patioTex = sidewalkTexture().clone();
    patioTex.needsUpdate = true;
    const patio = own(new THREE.Mesh(patioGeo, new THREE.MeshStandardMaterial({ map: patioTex, roughness: 0.95 })));
    patio.position.y = -0.015;
    patio.receiveShadow = true;
    g.add(patio);

    const swTex = sidewalkTexture().clone();
    swTex.needsUpdate = true;
    swTex.repeat.set(40, 1.4);
    const swMat = new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.95 });
    const sidewalk = own(new THREE.Mesh(new THREE.PlaneGeometry(80, 2.8), swMat));
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(cx, 0.005, H + 1.6);
    sidewalk.receiveShadow = true;
    g.add(sidewalk);
    const curb = own(mesh(new THREE.BoxGeometry(80, 0.12, 0.2), mat('#b9b2a6', { kind: 'env' }), cx, 0.0, H + 3.05, false));
    curb.material.userData.ownMat = false;
    g.add(curb);

    const rt = roadTexture().clone();
    rt.needsUpdate = true;
    rt.repeat.set(20, 1);
    const road = own(new THREE.Mesh(new THREE.PlaneGeometry(80, 6), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.9 })));
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, -0.02, H + 6.15);
    road.receiveShadow = true;
    g.add(road);
    const far = new THREE.Mesh(sidewalk.geometry, swMat);
    far.rotation.x = -Math.PI / 2;
    far.position.set(cx, 0.005, H + 10.6);
    far.receiveShadow = true;
    g.add(far);

    // Static street furniture batched together: lamps, bench, parked car
    const props = new THREE.Group();
    this.streetLamps = [];
    for (let x = -10; x < W + 14; x += 6) {
      const lamp = buildStreetLamp();
      lamp.position.set(x, 0, H + 2.7);
      props.add(lamp);
      this.streetLamps.push(new THREE.Vector3(x, 2.5, H + 2.7));
    }
    const bench = buildBench();
    bench.position.set(doorX - 3.2, 0, H + 1.2);
    bench.rotation.y = Math.PI;
    props.add(bench);
    if (this.driveZ === null) {
      const parked = buildCar('#4aa3f0');
      parked.position.set(W + 3.15, 0, H - 2.1);
      parked.rotation.y = Math.PI / 2;
      props.add(parked);
    } else props.add(this._buildDriveLane(W, H));
    g.add(mergeStatic(props, 'env'));

    // Garden: lush rounded trees, bushes, flower patches and grass tufts (two draw calls)
    g.add(buildGarden(this._gardenSpec(W, H, doorX), W * 31 + H));

    // Moving cars
    const colors = ['#ff5a4a', '#ffc93c', '#3fcf7a', '#a66cff', '#f4f6f8', '#ff9142'];
    for (let i = 0; i < 3; i++) {
      const car = buildCar(colors[i % colors.length]);
      const dir = i % 2 ? -1 : 1;
      car.userData = { dir, speed: rand(5, 8), lane: dir > 0 ? H + 7.6 : H + 4.7, wait: rand(0, 10), x: dir > 0 ? -30 : W + 30 };
      car.rotation.y = dir > 0 ? 0 : Math.PI;
      car.position.set(car.userData.x, 0, car.userData.lane);
      g.add(car);
      this.cars.push(car);
    }

    // The neighbourhood around the shop (rebuilt only if the floor size changed)
    this.setTownLevel(this.townLevel);
  }

  // ---------------------------------------------------------------- town
  // Show the town for stages 1..level (0 = only empty plots). Cheap to call every day: it only
  // rebuilds when the level or the floor size changed.
  // ---------------------------------------------------------------- drive-thru
  // Lane for a drive-thru window on cell (W - 1, wz); null removes it. Rebuilds the street only on change.
  setDriveThru(wz) {
    wz = wz ?? null;
    if (wz === this.driveZ) return;
    this.driveZ = wz;
    if (this.W !== undefined) this._buildStreet(this.W, this.H, this.doorX);
  }

  _buildDriveLane(W, H) {
    const L = driveLane(W, H, this.driveZ);
    const g = new THREE.Group();
    const r = (L.x1 - L.x0) / 2, cx = (L.x0 + L.x1) / 2;
    // Asphalt: straight lanes from the road plus a U-turn behind the window (shape y = -world z)
    const s = new THREE.Shape();
    s.moveTo(L.x0, -(H + 3.0));
    s.lineTo(L.x1, -(H + 3.0));
    s.lineTo(L.x1, -L.topZ);
    s.absarc(cx, -L.topZ, r, 0, Math.PI, false);
    s.lineTo(L.x0, -(H + 3.0));
    const lane = mesh(new THREE.ShapeGeometry(s, 24), mat('#5d636e', { kind: 'env', r: 0.92 }), 0, 0.012, 0, false);
    lane.rotation.x = -Math.PI / 2;
    lane.geometry.userData.own = true;
    g.add(lane);
    const paint = mat('#f4f1e6', { kind: 'env', r: 0.8 });
    for (let z = H + 0.2; z > L.topZ + 0.2; z -= 1.0) g.add(mesh(box(0.08, 0.01, 0.5), paint, L.midX, 0.02, z, false));
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.07, -0.35); arrow.lineTo(0.07, -0.35); arrow.lineTo(0.07, 0.05); arrow.lineTo(0.2, 0.05);
    arrow.lineTo(0, 0.35); arrow.lineTo(-0.2, 0.05); arrow.lineTo(-0.07, 0.05); arrow.lineTo(-0.07, -0.35);
    const arrowGeo = new THREE.ShapeGeometry(arrow);
    arrowGeo.userData.own = true;
    const addArrow = (x, z, south) => {
      const a = mesh(arrowGeo, paint, x, 0.021, z, false);
      a.rotation.set(-Math.PI / 2, 0, south ? Math.PI : 0);
      g.add(a);
    };
    if (L.stopZ + 2.2 < H - 0.3) addArrow(L.inX, L.stopZ + 2.2, false);
    addArrow(L.inX, H + 0.9, false);
    addArrow(L.outX, Math.max(L.topZ + 1, (L.topZ + H) / 2), true);
    addArrow(L.outX, H + 0.9, true);
    // Drive-thru sign at the entrance and a menu board beside the order point
    const post = mat('#2b2d5c', { kind: 'env', r: 0.5 });
    const sx = L.x1 + 0.55;
    g.add(mesh(cyl(0.06, 0.07, 1.9, 10), post, sx, 0.95, H + 0.8));
    const sign = mesh(new THREE.PlaneGeometry(1.3, 0.34), mat('#ffffff', { kind: 'env', map: signTex('sign-drive', 'DRIVE THRU', '#ffd23f', '#e8343f', 320, 80), mapKey: 'sign-drive' }), sx, 2.0, H + 0.8, false);
    sign.rotation.y = Math.PI / 4;
    g.add(sign);
    const back = mesh(box(1.38, 0.42, 0.06), post, sx, 2.0, H + 0.8);
    back.rotation.y = Math.PI / 4;
    back.position.x -= 0.03;
    back.position.z -= 0.03;
    g.add(back);
    const mz = Math.min(L.stopZ + 1.7, H - 0.6);
    for (const dz of [-0.45, 0.45]) g.add(mesh(box(0.08, 1.1, 0.08), post, sx, 0.55, mz + dz));
    g.add(mesh(box(0.1, 0.9, 1.2), post, sx, 1.45, mz));
    const menu = mesh(new THREE.PlaneGeometry(1.08, 0.24), mat('#ffffff', { kind: 'env', map: signTex('sign-menu', 'MENU', '#2b2d5c', '#ffd23f', 256, 64), mapKey: 'sign-menu' }), sx - 0.06, 1.75, mz, false);
    menu.rotation.y = -Math.PI / 2;
    g.add(menu);
    const rows = ['#ff6b57', '#ffd23f', '#7fd833', '#5ccbff'];
    rows.forEach((c, i) => {
      g.add(mesh(box(0.02, 0.09, 0.12), mat(c, { kind: 'env' }), sx - 0.06, 1.52 - i * 0.14, mz - 0.38, false));
      g.add(mesh(box(0.02, 0.04, 0.62), paint, sx - 0.06, 1.52 - i * 0.14, mz + 0.06, false));
    });
    return g;
  }

  setTownLevel(level) {
    this.townLevel = clamp(Math.floor(level) || 0, 0, TOWN_STAGES.length);
    if (this.W === undefined) return;
    const key = `${this.W}|${this.H}|${this.doorX}|${this.townLevel}`;
    if (this.town && this._townKey === key) return;
    this._disposeTown();
    this.town = buildTown(this.W, this.H, this.doorX, this.townLevel);
    this._townKey = key;
    this.world.add(this.town);
    this.town.userData.setNight(this.lampLevel);
  }

  _disposeTown() {
    const t = this.town;
    if (!t) return;
    this.world.remove(t);
    t.userData.dispose?.();
    disposeObject(t);
    t.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.ownGeo) o.geometry.dispose();
      if (o.material.userData?.ownMat) { o.material.map?.dispose(); o.material.dispose(); }
    });
    this.town = null;
  }

  // World position {x, z} of a town stage's plot (1..8), e.g. for a celebration effect
  townStagePos(stage) {
    return townStagePos(this.W ?? 12, this.H ?? 9, this.doorX ?? 10, stage);
  }

  // Where the garden grows: tree rows behind and beside the restaurant, round street trees in
  // soil pits on the sidewalk, hedgerows of bushes along the patio, flowers and grass tufts.
  _gardenSpec(W, H, doorX) {
    let seed = (W * 7919 + H * 104729) >>> 0;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const trees = [], bushes = [], flowers = [], tufts = [], pits = [];
    const kind = () => { const r = rnd(); return r < 0.09 ? 'blossom' : r < 0.12 ? 'autumn' : undefined; };
    // Street trees between the lamps
    for (let x = -7; x < W + 14; x += 6) {
      if (Math.abs(x - (doorX + 0.5)) < 2) continue;
      trees.push({ x, z: H + 2.25, s: 0.82 });
      pits.push({ x, z: H + 2.25, r: 0.55 });
      flowers.push({ x, z: H + 2.25, n: 4 });
    }
    // Behind the restaurant: two staggered rows
    for (let x = -2.5; x < W + 4.5; x += 2.2 + rnd() * 0.7) trees.push({ x, z: -3.1 - rnd() * 1.4, s: 0.95 + rnd() * 0.3, kind: kind() });
    for (let x = -4; x < W + 6; x += 2.6 + rnd() * 0.8) trees.push({ x, z: -6.4 - rnd() * 1.4, s: 1.05 + rnd() * 0.3, kind: kind() });
    // Left side: two staggered columns
    for (let z = -1; z < H + 0.5; z += 2.1 + rnd() * 0.7) trees.push({ x: -3.3 - rnd() * 1.2, z, s: 0.95 + rnd() * 0.3, kind: kind() });
    for (let z = 0; z < H + 0.5; z += 2.6 + rnd() * 0.8) trees.push({ x: -6.6 - rnd() * 1.4, z, s: 1.05 + rnd() * 0.25, kind: kind() });
    // Right lawn
    for (let z = -2; z < H - 1.4; z += 2.6 + rnd() * 1.0) trees.push({ x: W + 6.4 + rnd() * 1.6, z, s: 0.9 + rnd() * 0.3, kind: kind() });
    // Across the road
    for (let x = -12; x < W + 16; x += 3.6 + rnd() * 1.6) trees.push({ x, z: H + 13.6 + rnd() * 1.6, s: 0.95 + rnd() * 0.3, kind: kind() });
    // Hedgerows along the patio edges, some flowering
    for (let x = -1.2; x < W + 2.4; x += 1.45 + rnd() * 0.6) bushes.push({ x, z: -2.05 - rnd() * 0.2, s: 0.85 + rnd() * 0.3, flowers: rnd() < 0.35 });
    for (let z = -1.2; z < H + 0.1; z += 1.5 + rnd() * 0.6) bushes.push({ x: -1.65 - rnd() * 0.2, z, s: 0.85 + rnd() * 0.3, flowers: rnd() < 0.35 });
    for (let z = -1.2; z < H - 4.6; z += 1.3 + rnd() * 0.5) bushes.push({ x: W + 2.7 + rnd() * 0.2, z, s: 0.8 + rnd() * 0.3, flowers: rnd() < 0.4 });
    bushes.push({ x: W + 4.9, z: H - 0.4, s: 1, flowers: true }, { x: W + 4.8, z: H - 3.9, s: 0.85 });
    for (let x = -12; x < W + 16; x += 2.8 + rnd() * 1.6) if (rnd() < 0.5) bushes.push({ x, z: H + 12.55, s: 0.75 + rnd() * 0.25, flowers: rnd() < 0.4 });
    // Flower patches on the lawns
    for (let z = -0.8; z < H - 5; z += 1.7 + rnd()) flowers.push({ x: W + 3.8 + rnd() * 1.6, z, n: 6 + Math.floor(rnd() * 4) });
    for (let z = 0; z < H; z += 2 + rnd() * 1.4) flowers.push({ x: -2.5 - rnd() * 0.8, z, n: 5 + Math.floor(rnd() * 4) });
    for (let i = 0; i < 10; i++) flowers.push({ x: -3 + rnd() * (W + 8), z: H + 12.9 + rnd() * 0.5, n: 5 });
    // Grass tufts anywhere that isn't paved
    const paved = (x, z) => (x > -1.4 && x < W + 2.3 && z > -1.8 && z < H + 0.6)
      || (x > W + 1.8 && x < W + 4.5 && z > H - 4.5 && z < H + 0.6) || (z > H + 0.1 && z < H + 12.3);
    for (let i = 0; i < 420 && tufts.length < 240; i++) {
      const x = W / 2 + (rnd() - 0.5) * 46, z = -11 + rnd() * (H + 30);
      if (!paved(x, z)) tufts.push({ x, z, s: 0.8 + rnd() * 0.5 });
    }
    // Keep the town's plots clear (canopies need a little more room than flowers & tufts)
    const lots = townLots(W, H, doorX);
    if (this.driveZ !== null) {
      const L = driveLane(W, H, this.driveZ);
      lots.push({ x0: L.x0 - 0.7, x1: L.x1 + 1.0, z0: L.topZ - (L.x1 - L.x0) / 2 - 0.8, z1: H + 0.6 });
    }
    const clear = (pad) => (o) => !lots.some((l) => o.x > l.x0 - pad && o.x < l.x1 + pad && o.z > l.z0 - pad && o.z < l.z1 + pad);
    // Spatial chunks (front / back-left / right) so off-screen parts are culled; only trees
    // inside the sun's shadow box cast shadows
    const cx = W / 2, cz = H / 2, r = Math.max(W, H) * 0.85 + 4;
    const chunk = (x, z) => (z > H + 3 ? 'front' : x > W + 2 ? 'right' : 'back');
    const caster = (x, z) => Math.hypot(x - cx, z - cz) < r;
    return {
      trees: trees.filter(clear(0.6)), bushes: bushes.filter(clear(0.4)), flowers: flowers.filter(clear(0.3)),
      tufts: tufts.filter(clear(0.1)), pits: pits.filter(clear(0.5)), chunk, caster,
    };
  }

  _fitShadow() {
    const sc = this.sun.shadow.camera;
    const r = Math.max(this.W, this.H) * 0.85 + 5;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r;
    sc.updateProjectionMatrix();
  }

  setGridVisible(v) { if (this.gridLines) this.gridLines.visible = v; }

  // ---------------------------------------------------------------- lighting
  setTimeOfDay(hour, dt = 1) {
    const s = sampleSky(hour);
    const k = Math.min(1, dt * 2.5);
    this.scene.background.lerp(_c1.set(s.fog), k);
    this.scene.fog.color.copy(this.scene.background);
    this.sun.color.lerp(_c1.set(s.sun), k);
    this.sun.intensity = lerp(this.sun.intensity, s.sunI, k);
    this.hemi.color.lerp(_c1.set(s.hemiSky), k);
    this.hemi.groundColor.lerp(_c1.set(s.hemiGround), k);
    this.hemi.intensity = lerp(this.hemi.intensity, s.hemiI, k);
    this.fill.intensity = lerp(this.fill.intensity, s.fill * 2.1, k);
    this.lampLevel = lerp(this.lampLevel, s.lamps, k);
    const daylight = clamp((s.sunI - 0.44) / 2.5, 0, 1);
    this.scene.environmentIntensity = lerp(this.scene.environmentIntensity, 0.08 + daylight * 0.22, k);
    // Character/prop sky rim and ink colour follow the light
    LOOK.rimColor.value.lerp(_c1.set(s.rim), k);
    LOOK.rimChar.value = lerp(LOOK.rimChar.value, s.rimI, k);
    LOOK.rimProp.value = lerp(LOOK.rimProp.value, s.rimI * 0.36, k);
    LOOK.outlineColor.value.lerp(_c1.copy(OUTLINE_NIGHT).lerp(OUTLINE_DAY, daylight), k);
    // Haze sits a little closer at night so the dark street falls away around the lit room
    const night = 1 - daylight;
    this.scene.fog.near = lerp(this.scene.fog.near, 40 - night * 3, k);
    this.scene.fog.far = lerp(this.scene.fog.far, 76 - night * 14, k);

    // Key light from the upper-left of the screen all day (drifting slightly toward the camera),
    // so shadows fall to the side where they read, while staying inside the arc where the back
    // walls can never shade the room. Low and long in the morning/evening, higher at noon.
    const h = clamp(hour, 6, 22);
    const t = (h - 6) / 16;
    const moon = hour > 21.2 || hour < 7;
    const az = moon ? 0.4 : lerp(0.14, 0.6, t);
    const elev = moon ? 0.95 : 0.62 + Math.sin(t * Math.PI) * 0.36;
    const cx = (this.W || 12) / 2, cz = (this.H || 9) / 2;
    this.sun.target.position.set(cx, 0, cz);
    _v.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)).multiplyScalar(30);
    this.sun.position.set(cx + _v.x, _v.y, cz + _v.z);
    this.fill.target.position.set(cx, 0, cz);
    this.fill.position.set(cx, 14, cz);
    this.fill.angle = Math.atan((Math.max(this.W || 12, this.H || 9) * 0.62 + 0.5) / 14);

    envMats.lampBulb.emissiveIntensity = 0.2 + this.lampLevel * 3;
    envMats.windowGlass.emissiveIntensity = lerp(0.35, 0.05, this.lampLevel);
    envMats.windowGlass.emissive.set(this.lampLevel > 0.5 ? '#203060' : '#6fb8e8');
    envMats.headlight.emissiveIntensity = 0.3 + this.lampLevel * 3;
    if (this.signMat) this.signMat.emissiveIntensity = 0.35 + this.lampLevel * 0.9;
    if (this.openSignMat) this.openSignMat.emissiveIntensity = this.openSignOn ? 1.6 + Math.sin(this.time * 8) * 0.1 : 0.05;
    this.town?.userData.setNight(this.lampLevel);
  }

  requestLight(x, y, z, color, intensity, distance, priority = 1) {
    this.lightRequests.push({ x, y, z, color, intensity, distance, priority });
  }

  _applyLights() {
    const reqs = this.lightRequests;
    const cx = this.camSmooth.x, cz = this.camSmooth.z;
    for (const r of reqs) r.score = r.priority * 10 - Math.hypot(r.x - cx, r.z - cz) * 0.5;
    reqs.sort((a, b) => b.score - a.score);
    for (let i = 0; i < this.pool.length; i++) {
      const l = this.pool[i];
      const r = reqs[i];
      if (r) {
        l.position.set(r.x, r.y, r.z);
        l.color.set(r.color);
        l.intensity = r.intensity;
        l.distance = r.distance;
      } else {
        l.intensity = 0;
      }
    }
    reqs.length = 0;
  }

  // ---------------------------------------------------------------- camera
  setCameraTarget(x, z) { this.camTarget.set(x, 0, z); }
  snapCamera() { this.camSmooth.copy(this.camTarget); this.viewSize = this.targetView; this._updateProjection(); }
  // Portrait screens are narrow, so allow a taller view to show the same width of floor
  setView(v) {
    const aspect = this.width > 0 && this.height > 0 ? this.width / this.height : 1;
    if (!Number.isFinite(v)) v = CAMERA.dayView;
    this.targetView = clamp(v, CAMERA.minView, CAMERA.maxView / Math.min(1, aspect));
  }
  addShake(a) {
    if (this.reducedMotion === undefined) {
      try { this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { this.reducedMotion = false; }
    }
    if (!this.reducedMotion) this.shake = Math.min(0.6, this.shake + a);
  }

  // View size needed to fit the whole room on screen
  fitViewForRoom(W, H, margin = 1.15) {
    const key = `${W}|${H}|${margin}|${this.yaw.toFixed(3)}|${this.width}|${this.height}`;
    if (this._fitKey === key) return this._fitVal;
    this._fitKey = key;
    this._fitVal = this._fitView(W, H, margin);
    return this._fitVal;
  }

  _fitView(W, H, margin) {
    const corners = [];
    for (const [x, z] of [[0, 0], [W, 0], [0, H], [W, H]]) for (const y of [0, WALL_HEIGHT]) corners.push(new THREE.Vector3(x, y, z));
    const dir = this._camDir();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of corners) {
      const px = c.dot(right), py = c.dot(camUp);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    const aspect = this.width / this.height;
    return Math.max(maxY - minY, (maxX - minX) / aspect) * margin;
  }

  _camDir() {
    return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(CAMERA.elevation), Math.sin(CAMERA.elevation), Math.cos(this.yaw) * Math.cos(CAMERA.elevation));
  }

  updateCamera(dt) {
    this.camSmooth.x = damp(this.camSmooth.x, this.camTarget.x, 5, dt);
    this.camSmooth.z = damp(this.camSmooth.z, this.camTarget.z, 5, dt);
    this.yaw = damp(this.yaw, this.targetYaw, 3, dt);
    const prev = this.viewSize;
    this.viewSize = damp(this.viewSize, this.targetView, 6, dt);
    if (Math.abs(prev - this.viewSize) > 0.0001) this._updateProjection();
    const dir = this._camDir();
    let sx = 0, sz = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake * 0.5;
      sz = (Math.random() - 0.5) * this.shake * 0.5;
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }
    this.camera.position.set(this.camSmooth.x + dir.x * CAMERA.distance + sx, dir.y * CAMERA.distance, this.camSmooth.z + dir.z * CAMERA.distance + sz);
    this.camera.lookAt(this.camSmooth.x + sx, 0, this.camSmooth.z + sz);
  }

  // ---------------------------------------------------------------- helpers
  project(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    return { x: (_v.x + 1) * 0.5 * this.width, y: (1 - _v.y) * 0.5 * this.height, visible: _v.z > -1 && _v.z < 1 };
  }

  screenToGround(mx, my) {
    const ndc = new THREE.Vector2((mx / this.width) * 2 - 1, -(my / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return null;
    return p;
  }

  showHighlight(x, y, z, w = 1, d = 1, color = '#fff4a8') {
    this.highlight.visible = true;
    this.highlight.position.set(x, y, z);
    this.highlight.scale.set(w, 1, d);
    this.highlightMat.color.set(color);
  }
  hideHighlight() { this.highlight.visible = false; }

  setTileMarkers(cells, ok) {
    for (let i = 0; i < this.tileMarkers.length; i++) {
      const m = this.tileMarkers[i];
      const c = cells[i];
      if (c) {
        m.visible = true;
        m.position.set(c.x + 0.5, 0.03, c.z + 0.5);
        m.material.color.set(ok ? '#4cff8a' : '#ff4c5b');
      } else m.visible = false;
    }
  }

  setPointer(pos) {
    if (!pos) { this.pointer.visible = false; return; }
    this.pointer.visible = true;
    this.pointerPos.copy(pos);
  }

  setClock(hour) {
    if (!this.hourHand) return;
    this.hourHand.rotation.z = -((hour % 12) / 12) * Math.PI * 2;
    this.minHand.rotation.z = -((hour % 1)) * Math.PI * 2;
  }

  setDoorOpen(open) { this.doorTarget = open ? 1 : 0; }

  update(dt) {
    this.time += dt;
    this.updateCamera(dt);
    this.highlightMat.opacity = 0.6 + Math.sin(this.time * 7) * 0.3;
    if (this.pointer.visible) {
      this.pointer.position.set(this.pointerPos.x, this.pointerPos.y + 0.35 + Math.abs(Math.sin(this.time * 4)) * 0.3, this.pointerPos.z);
      this.pointer.rotation.y += dt * 2;
    }
    this.doorOpen = damp(this.doorOpen, this.doorTarget, 8, dt);
    for (const p of this.doorLeaves || []) p.rotation.y = (p.userData.side ? 1 : -1) * this.doorOpen * 1.3;
    for (const car of this.cars) {
      const u = car.userData;
      if (u.wait > 0) { u.wait -= dt; continue; }
      u.x += u.dir * u.speed * dt;
      car.position.x = u.x;
      if ((u.dir > 0 && u.x > (this.W || 12) + 34) || (u.dir < 0 && u.x < -34)) {
        u.x = u.dir > 0 ? -34 : (this.W || 12) + 34;
        u.wait = rand(4, 14);
        u.speed = rand(5, 8);
      }
    }
    // Street lamp lights at night
    if (this.lampLevel > 0.3 && this.streetLamps) {
      for (const p of this.streetLamps) this.requestLight(p.x, p.y, p.z, '#ffcf80', 10 * this.lampLevel, 7, 1.5);
    }
    // Town: Ferris wheel, sails, ducks & swings; two warm porch lights at night (lowest priority)
    if (this.town) {
      this.town.userData.animate(this.time, dt);
      if (this.lampLevel > 0.3) for (const l of this.town.userData.lights) this.requestLight(l.x, l.y, l.z, l.color, l.intensity * this.lampLevel, l.distance, 0.8);
    }
    this.particleScale = this.pixelsPerUnit;
    // Ink outlines stay ~1.6 CSS px wide at any zoom; foliage sways on the shared clock
    LOOK.outlineThickness.value = clamp((1.6 * this.renderer.getPixelRatio()) / Math.max(1, this.particleScale), 0.008, 0.04);
    LOOK.time.value = this.time;
  }

  render() {
    this._applyLights();
    this.renderer.render(this.scene, this.camera);
  }
}

// Bakes small transparent PNG thumbnails of 3D models for the HUD and build menu.
export class ThumbnailBaker {
  constructor(size = 128) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();
    env.background = new THREE.Color('#9aa0aa');
    const l = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(5) }));
    l.position.y = 8;
    env.add(l);
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
    // Studio lighting: warm key, cool sky fill and a cool back light that rims the silhouette so
    // icons read on both light and dark HUD panels
    this.scene.add(new THREE.HemisphereLight('#f4f8ff', '#a8957e', 1.55));
    const d = new THREE.DirectionalLight('#fff0dc', 2.5);
    d.position.set(3, 6, 4);
    this.scene.add(d);
    const back = new THREE.DirectionalLight('#d8e8ff', 1.3);
    back.position.set(-4, 3, -3.5);
    this.scene.add(back);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  }

  bake(object, { elevation = 0.75, yaw = Math.PI / 4, pad = 1.12 } = {}) {
    this.scene.add(object);
    object.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(object);
    const center = bb.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(yaw) * Math.cos(elevation));
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
    let ext = 0;
    const corner = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).sub(center);
      ext = Math.max(ext, Math.abs(corner.dot(right)), Math.abs(corner.dot(camUp)));
    }
    ext *= pad;
    this.camera.left = -ext; this.camera.right = ext; this.camera.top = ext; this.camera.bottom = -ext;
    this.camera.position.copy(center).addScaledVector(dir, 20);
    this.camera.lookAt(center);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    this.scene.remove(object);
    disposeObject(object);
    return url;
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
