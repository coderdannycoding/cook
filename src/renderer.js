// Three.js renderer: isometric orthographic camera, soft shadows, day/night lighting,
// a pooled set of warm point lights, the restaurant shell + street, and a thumbnail baker.

import * as THREE from '../vendor/three-0.169.0.module.min.js';
import { CAMERA, WALL_HEIGHT, FRONT_WALL_HEIGHT, LIGHT_POOL_SIZE } from './config.js';
import { clamp, damp, lerp, rand } from './utils.js';
import {
  floorTexture, wallTexture, grassTexture, sidewalkTexture, roadTexture, signTexture, openSignTexture, setMaxAnisotropy,
} from './textures.js';
import {
  mat, mesh, box, cyl, sph, torus, mergeStatic, buildStreetLamp, buildTree, buildCar, buildBench, buildPointer, envMats, disposeObject,
} from './models.js';

const SKY_KEYS = [
  { h: 0, sky: '#111c24', sun: '#9fb4d8', sunI: 0.35, hemiSky: '#3b5262', hemiGround: '#1c1a18', hemiI: 0.55, fill: 0.9, lamps: 1 },
  { h: 8, sky: '#ffcfa8', sun: '#ffd2a0', sunI: 1.9, hemiSky: '#ffe2c4', hemiGround: '#6b5a48', hemiI: 0.9, fill: 0.15, lamps: 0.2 },
  { h: 10, sky: '#bfe4ff', sun: '#fff1dc', sunI: 2.5, hemiSky: '#d8eeff', hemiGround: '#7a6650', hemiI: 1.0, fill: 0.05, lamps: 0 },
  { h: 13, sky: '#a9dcff', sun: '#fffaf0', sunI: 2.8, hemiSky: '#dff1ff', hemiGround: '#7a6650', hemiI: 1.05, fill: 0.0, lamps: 0 },
  { h: 17, sky: '#bcd8f5', sun: '#ffe6c0', sunI: 2.4, hemiSky: '#ffe8d0', hemiGround: '#7a6050', hemiI: 0.95, fill: 0.05, lamps: 0 },
  { h: 19.3, sky: '#ffad80', sun: '#ff9a55', sunI: 1.8, hemiSky: '#ffbf98', hemiGround: '#6b4a48', hemiI: 0.85, fill: 0.25, lamps: 0.4 },
  { h: 20.6, sky: '#55647e', sun: '#ff9e7a', sunI: 0.9, hemiSky: '#7d8aa6', hemiGround: '#3a3330', hemiI: 0.7, fill: 0.6, lamps: 0.9 },
  { h: 21.6, sky: '#1b2936', sun: '#9fb4d8', sunI: 0.45, hemiSky: '#45606e', hemiGround: '#201d1a', hemiI: 0.6, fill: 0.85, lamps: 1 },
  { h: 24, sky: '#10162e', sun: '#8fa6ff', sunI: 0.35, hemiSky: '#38457a', hemiGround: '#1d1a24', hemiI: 0.55, fill: 0.9, lamps: 1 },
];

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
    sky: col('sky'), sun: col('sun'), hemiSky: col('hemiSky'), hemiGround: col('hemiGround'),
    sunI: lerp(a.sunI, b.sunI, t), hemiI: lerp(a.hemiI, b.hemiI, t), fill: lerp(a.fill, b.fill, t), lamps: lerp(a.lamps, b.lamps, t),
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#bfe4ff');
    this.scene.fog = new THREE.Fog('#bfe4ff', 46, 80);

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
    this.hemi = new THREE.HemisphereLight('#dff1ff', '#7a6650', 1.0);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff6e8', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 3;
    const sc = this.sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
    this.scene.add(this.sun, this.sun.target);

    // Warm "interior" spotlight used in the evening/night so the restaurant glows while the street stays dark
    this.fill = new THREE.SpotLight('#ffcf94', 0, 0, 0.6, 0.55, 0);
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
  buildRoom(W, H, doorX, floorTheme, wallTheme, name = 'Pandemonium Bistro') {
    this.W = W;
    this.H = H;
    this.doorX = doorX;
    const g = this.roomGroup;
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      c.traverse((o) => {
        if (!o.isMesh || !o.userData.ownGeo) return;
        o.geometry.dispose();
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
    const wallOuter = mat('#e9dfcf', { r: 0.9 });
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
    const capM = mat('#6b4428', { r: 0.6 });
    const cap1 = mesh(new THREE.BoxGeometry(W + 0.42, 0.12, 0.42), capM, W / 2 - 0.15, WALL_HEIGHT + 0.06, -0.15);
    const cap2 = mesh(new THREE.BoxGeometry(0.42, 0.12, H + 0.3), capM, -0.15, WALL_HEIGHT + 0.06, H / 2 - 0.15);
    cap1.userData.ownGeo = cap2.userData.ownGeo = true;
    g.add(cap1, cap2);

    // Windows on the back walls
    const winGroup = new THREE.Group();
    const frameM = mat('#f4efe6', { r: 0.6 });
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
    g.add(winGroup);

    // Wall clock
    this.clock = new THREE.Group();
    const face = mesh(cyl(0.34, 0.34, 0.05, 28), mat('#fffdf5', { r: 0.4 }), 0, 0, 0, false);
    face.rotation.x = Math.PI / 2;
    this.clock.add(face);
    const rim = mesh(torus(0.34, 0.04, 8, 28), mat('#8a5a33', { r: 0.5 }), 0, 0, 0.02, false);
    this.clock.add(rim);
    for (let i = 0; i < 12; i++) {
      const tick = mesh(box(0.03, 0.07, 0.02), mat('#333'), Math.sin((i / 12) * Math.PI * 2) * 0.27, Math.cos((i / 12) * Math.PI * 2) * 0.27, 0.035, false);
      tick.rotation.z = -(i / 12) * Math.PI * 2;
      this.clock.add(tick);
    }
    this.hourHand = new THREE.Group();
    this.hourHand.add(mesh(box(0.04, 0.17, 0.02), mat('#222'), 0, 0.08, 0.045, false));
    this.minHand = new THREE.Group();
    this.minHand.add(mesh(box(0.025, 0.25, 0.02), mat('#c0392b'), 0, 0.12, 0.05, false));
    this.clock.add(this.hourHand, this.minHand);
    this.clock.position.set(Math.min(W - 2, 7.5), 2.15, 0.06);
    g.add(this.clock);

    // Front low walls with a door gap
    const lowM = mat('#c56b4b', { r: 0.85 });
    const lowCap = mat('#f1e3c8', { r: 0.7 });
    const lw = (x0, x1, z0, z1) => {
      const len = Math.max(x1 - x0, z1 - z0);
      const alongX = x1 - x0 > z1 - z0;
      const m = mesh(new THREE.BoxGeometry(alongX ? len : 0.22, FRONT_WALL_HEIGHT, alongX ? 0.22 : len), lowM, (x0 + x1) / 2, FRONT_WALL_HEIGHT / 2, (z0 + z1) / 2);
      const c = mesh(new THREE.BoxGeometry(alongX ? len + 0.06 : 0.3, 0.07, alongX ? 0.3 : len + 0.06), lowCap, (x0 + x1) / 2, FRONT_WALL_HEIGHT + 0.035, (z0 + z1) / 2);
      m.userData.ownGeo = c.userData.ownGeo = true;
      g.add(m, c);
    };
    lw(-0.3, doorX, H + 0.11, H + 0.11);
    lw(doorX + 1, W + 0.22, H + 0.11, H + 0.11);
    lw(W + 0.11, W + 0.11, -0.3, H);
    // Flower boxes on the low wall
    const flowers = new THREE.Group();
    const petalCols = ['#ff6b8b', '#ffd23f', '#ffffff', '#b980ff', '#ff8c42'];
    for (let x = 0.6; x < W; x += 1.6) {
      if (Math.abs(x + 0.4 - (doorX + 0.5)) < 1.4) continue;
      flowers.add(mesh(box(0.8, 0.14, 0.24), mat('#7a4a2a'), x + 0.4, FRONT_WALL_HEIGHT + 0.14, H + 0.11));
      for (let k = 0; k < 4; k++) {
        flowers.add(mesh(sph(0.07, 8, 6), mat('#4c9a4a', { flat: true }), x + 0.12 + k * 0.19, FRONT_WALL_HEIGHT + 0.25, H + 0.11));
        flowers.add(mesh(sph(0.045, 8, 6), mat(petalCols[(k + Math.floor(x)) % petalCols.length]), x + 0.12 + k * 0.19, FRONT_WALL_HEIGHT + 0.33, H + 0.11 + 0.02));
      }
    }
    for (let z = 0.6; z < H - 0.4; z += 1.6) {
      flowers.add(mesh(box(0.24, 0.14, 0.8), mat('#7a4a2a'), W + 0.11, FRONT_WALL_HEIGHT + 0.14, z + 0.4));
      for (let k = 0; k < 4; k++) {
        flowers.add(mesh(sph(0.07, 8, 6), mat('#4c9a4a', { flat: true }), W + 0.11, FRONT_WALL_HEIGHT + 0.25, z + 0.12 + k * 0.19));
        flowers.add(mesh(sph(0.045, 8, 6), mat(petalCols[(k + Math.floor(z)) % petalCols.length]), W + 0.13, FRONT_WALL_HEIGHT + 0.33, z + 0.12 + k * 0.19));
      }
    }
    g.add(mergeStatic(flowers));

    // Door frame, double doors, awning and sign
    const door = new THREE.Group();
    const postM = mat('#4a2f1e', { r: 0.6 });
    door.add(mesh(box(0.14, 2.4, 0.26), postM, doorX, 1.2, H + 0.11));
    door.add(mesh(box(0.14, 2.4, 0.26), postM, doorX + 1, 1.2, H + 0.11));
    door.add(mesh(box(1.28, 0.16, 0.3), postM, doorX + 0.5, 2.42, H + 0.11));
    g.add(door);
    const leafM = mat('#bfe6ff', { op: 0.45, r: 0.05 });
    const leafFrame = mat('#5a3a24');
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
    g.add(mergeStatic(awning));
    // Sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshStandardMaterial({ map: signTexture(name, 'open 10 am to 10 pm'), emissive: '#ffffff', emissiveMap: signTexture(name, 'open 10 am to 10 pm'), emissiveIntensity: 0.35, roughness: 0.6 }));
    sign.position.set(doorX + 0.5, 3.15, H + 0.18);
    sign.userData.ownGeo = true;
    g.add(sign);
    this.signMat = sign.material;
    g.add(mesh(box(2.75, 0.8, 0.08), mat('#2a1530'), doorX + 0.5, 3.15, H + 0.12));
    // Neon OPEN sign
    this.openSignMat = new THREE.MeshStandardMaterial({ map: openSignTexture(), emissive: '#ffffff', emissiveMap: openSignTexture(), emissiveIntensity: 0.0, roughness: 0.5 });
    const os = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), this.openSignMat);
    os.position.set(doorX - 0.9, 1.2, H + 0.24);
    os.userData.ownGeo = true;
    g.add(os);

    // Floor trim (dark edge)
    const trim = mat('#3a2a1e');
    g.add(mesh(new THREE.BoxGeometry(W, 0.03, 0.08), trim, W / 2, 0.015, H - 0.04, false));

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
    }
    this.cars.length = 0;
    const cx = W / 2;

    const grass = grassTexture().clone();
    grass.needsUpdate = true;
    grass.repeat.set(40, 40);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, -0.03, H / 2);
    ground.receiveShadow = true;
    g.add(ground);

    // Patio around the building
    const patioTex = sidewalkTexture().clone();
    patioTex.needsUpdate = true;
    patioTex.repeat.set((W + 3) / 2, (H + 2) / 2);
    const patio = new THREE.Mesh(new THREE.PlaneGeometry(W + 3, H + 2), new THREE.MeshStandardMaterial({ map: patioTex, roughness: 0.95 }));
    patio.rotation.x = -Math.PI / 2;
    patio.position.set(W / 2 + 0.5, -0.015, H / 2 - 0.5);
    patio.receiveShadow = true;
    g.add(patio);

    const swTex = sidewalkTexture().clone();
    swTex.needsUpdate = true;
    swTex.repeat.set(40, 1.4);
    const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(80, 2.8), new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.95 }));
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(cx, 0.005, H + 1.6);
    sidewalk.receiveShadow = true;
    g.add(sidewalk);
    g.add(mesh(new THREE.BoxGeometry(80, 0.12, 0.2), mat('#a9a49b'), cx, 0.0, H + 3.05, false));

    const rt = roadTexture().clone();
    rt.needsUpdate = true;
    rt.repeat.set(20, 1);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 6), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.9 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, -0.02, H + 6.15);
    road.receiveShadow = true;
    g.add(road);
    const far = sidewalk.clone();
    far.position.z = H + 10.6;
    g.add(far);

    // Lamps, trees, benches
    this.streetLamps = [];
    for (let x = -10; x < W + 14; x += 6) {
      const lamp = buildStreetLamp();
      lamp.position.set(x, 0, H + 2.7);
      g.add(lamp);
      this.streetLamps.push(new THREE.Vector3(x, 2.5, H + 2.7));
    }
    for (let x = -7; x < W + 14; x += 6) {
      if (Math.abs(x - (doorX + 0.5)) < 2) continue;
      const t = buildTree(Math.floor(x * 13 + 7));
      t.position.set(x, 0, H + 2.4);
      t.scale.setScalar(0.85);
      g.add(t);
    }
    for (let i = 0; i < 9; i++) {
      const t = buildTree(i * 31 + 3);
      t.position.set(-3 - (i % 3) * 2.6, 0, -1 + i * 1.5);
      t.scale.setScalar(0.9 + (i % 3) * 0.15);
      g.add(t);
      const t2 = buildTree(i * 17 + 5);
      t2.position.set(-1 + i * 2.4, 0, -3.2 - (i % 2) * 1.8);
      g.add(t2);
    }
    const bench = buildBench();
    bench.position.set(doorX - 3.2, 0, H + 1.2);
    bench.rotation.y = Math.PI;
    g.add(bench);

    // Parked car on the right
    const parked = buildCar('#3d9be9');
    parked.position.set(W + 3, 0, H - 2);
    parked.rotation.y = Math.PI / 2;
    g.add(parked);

    // Moving cars
    const colors = ['#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22'];
    for (let i = 0; i < 3; i++) {
      const car = buildCar(colors[i % colors.length]);
      const dir = i % 2 ? -1 : 1;
      car.userData = { dir, speed: rand(5, 8), lane: dir > 0 ? H + 7.6 : H + 4.7, wait: rand(0, 10), x: dir > 0 ? -30 : W + 30 };
      car.rotation.y = dir > 0 ? 0 : Math.PI;
      car.position.set(car.userData.x, 0, car.userData.lane);
      g.add(car);
      this.cars.push(car);
    }
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
    this.scene.background.lerp(_c1.set(s.sky), k);
    this.scene.fog.color.copy(this.scene.background);
    this.sun.color.lerp(_c1.set(s.sun), k);
    this.sun.intensity = lerp(this.sun.intensity, s.sunI, k);
    this.hemi.color.lerp(_c1.set(s.hemiSky), k);
    this.hemi.groundColor.lerp(_c1.set(s.hemiGround), k);
    this.hemi.intensity = lerp(this.hemi.intensity, s.hemiI, k);
    this.fill.intensity = lerp(this.fill.intensity, s.fill * 1.9, k);
    this.lampLevel = lerp(this.lampLevel, s.lamps, k);
    const daylight = clamp((s.sunI - 0.35) / 2.45, 0, 1);
    this.scene.environmentIntensity = lerp(this.scene.environmentIntensity, 0.08 + daylight * 0.37, k);

    // Sun arc: rises in the east (+x), sets west, always from the camera side so the room is lit.
    const h = clamp(hour, 6, 22);
    const t = (h - 6) / 16;
    const ang = lerp(-1.1, 1.1, t);
    const elev = hour > 21 || hour < 7 ? 0.95 : 0.55 + Math.sin(t * Math.PI) * 0.5;
    const cx = (this.W || 12) / 2, cz = (this.H || 9) / 2;
    this.sun.target.position.set(cx, 0, cz);
    _v.set(Math.sin(ang + 0.6) * Math.cos(elev), Math.sin(elev), Math.cos(ang + 0.6) * Math.cos(elev)).multiplyScalar(30);
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
    this.particleScale = this.pixelsPerUnit;
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();
    env.background = new THREE.Color('#9aa0aa');
    const l = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(5) }));
    l.position.y = 8;
    env.add(l);
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a6a', 1.6));
    const d = new THREE.DirectionalLight('#fff4e0', 2.6);
    d.position.set(3, 6, 4);
    this.scene.add(d);
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
