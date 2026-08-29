import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildFixture, tintFixture, disposeFixture } from './fixtures.js';

const EYE_HEIGHT = 1.6;
const WALK_SPEED = 3.2; // m/s

function deg(d) {
  return (d * Math.PI) / 180;
}

/** 回転後のフットプリント半径（X/Z） */
export function halfExtents(item) {
  const c = Math.abs(Math.cos(deg(item.rotY || 0)));
  const s = Math.abs(Math.sin(deg(item.rotY || 0)));
  return {
    hx: (c * item.w + s * item.d) / 2,
    hz: (s * item.w + c * item.d) / 2,
  };
}

function makeLabelSprite(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = 'bold 44px system-ui, -apple-system, "Noto Sans JP", sans-serif';
  ctx.font = font;
  const w = Math.min(720, Math.ceil(ctx.measureText(text).width) + 40);
  canvas.width = w;
  canvas.height = 72;
  const c = canvas.getContext('2d');
  c.font = font;
  c.fillStyle = 'rgba(12,12,14,0.82)';
  c.beginPath();
  c.roundRect(0, 0, canvas.width, canvas.height, 18);
  c.fill();
  c.fillStyle = '#ffffff';
  c.textBaseline = 'middle';
  c.textAlign = 'center';
  c.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  );
  sprite.renderOrder = 10;
  sprite.scale.set((canvas.width / canvas.height) * 0.34, 0.34, 1);
  sprite.userData.text = text;
  return sprite;
}

export class StoreScene {
  constructor(container, handlers = {}) {
    this.container = container;
    this.handlers = handlers;
    this.doc = null;
    this.selectedId = null;
    this.mode = 'orbit';
    this.snap = 0.25;
    this.showLabels = true;
    this.items = new Map(); // id -> THREE.Group
    this.labels = new Map(); // id -> THREE.Sprite
    this.walls = [];
    this.keys = new Set();
    this.padInput = { f: 0, s: 0 };
    this.clock = new THREE.Clock();

    // --- renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    // --- scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0e0f13');
    this.scene = scene;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a46, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0012;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    this.roomGroup = new THREE.Group();
    scene.add(this.roomGroup);
    this.itemGroup = new THREE.Group();
    scene.add(this.itemGroup);
    this.labelGroup = new THREE.Group();
    scene.add(this.labelGroup);

    // --- 選択ハイライト ---
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffe066, depthTest: false })
    );
    this.outline.renderOrder = 5;
    this.outline.visible = false;
    scene.add(this.outline);

    this.footprint = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffe066,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    this.footprint.rotation.x = -Math.PI / 2;
    this.footprint.visible = false;
    scene.add(this.footprint);

    // --- cameras ---
    this.persp = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    this.persp.position.set(9, 9, 12);
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 500);
    this.ortho.position.set(0, 40, 0);
    this.ortho.up.set(0, 0, -1);
    this.camera = this.persp;

    this.controls = new OrbitControls(this.persp, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 90;

    this.topControls = new OrbitControls(this.ortho, renderer.domElement);
    this.topControls.enableRotate = false;
    this.topControls.enableDamping = true;
    this.topControls.dampingFactor = 0.15;
    this.topControls.screenSpacePanning = true;
    this.topControls.enabled = false;

    // 一人称
    this.walkYaw = 0;
    this.walkPitch = 0;
    this.walkPos = new THREE.Vector3(0, EYE_HEIGHT, 4);

    // --- interaction ---
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.drag = null;
    this.look = null;

    this._onPointerDown = this.onPointerDown.bind(this);
    this._onPointerMove = this.onPointerMove.bind(this);
    this._onPointerUp = this.onPointerUp.bind(this);
    this._onKeyDown = (e) => {
      if (document.body.dataset.modal) return;
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);

    const el = renderer.domElement;
    el.addEventListener('pointerdown', this._onPointerDown, true);
    el.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    this.running = true;
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  // ===== 部屋 =====
  buildRoom(room) {
    const g = this.roomGroup;
    while (g.children.length) {
      const c = g.children.pop();
      c.geometry?.dispose?.();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => m.dispose());
      }
    }
    this.walls = [];

    const { w, d, h } = room;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color: '#e9e6e0', roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.isFloor = true;
    g.add(floor);

    // 床と同じ大きさのグリッド（50cm 間隔）
    const pts = [];
    const eps = 1e-6;
    for (let x = -w / 2; x <= w / 2 + eps; x += 0.5) {
      pts.push(x, 0, -d / 2, x, 0, d / 2);
    }
    for (let z = -d / 2; z <= d / 2 + eps; z += 0.5) {
      pts.push(-w / 2, 0, z, w / 2, 0, z);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({
        color: 0x9aa2ad,
        transparent: true,
        opacity: 0.5,
      })
    );
    grid.position.y = 0.004;
    g.add(grid);

    // 天井（一人称のときだけ見せる）
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color: '#f7f6f3', roughness: 1 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = h;
    ceiling.visible = this.mode === 'walk';
    g.add(ceiling);
    this.ceiling = ceiling;

    const wallMat = () =>
      new THREE.MeshStandardMaterial({
        color: '#f2f0eb',
        roughness: 0.95,
        transparent: true,
        opacity: 1,
      });
    const t = 0.12;
    const defs = [
      { pos: [0, h / 2, -d / 2 - t / 2], size: [w + t * 2, h, t], n: [0, 0, 1] },
      { pos: [0, h / 2, d / 2 + t / 2], size: [w + t * 2, h, t], n: [0, 0, -1] },
      { pos: [-w / 2 - t / 2, h / 2, 0], size: [t, h, d], n: [1, 0, 0] },
      { pos: [w / 2 + t / 2, h / 2, 0], size: [t, h, d], n: [-1, 0, 0] },
    ];
    for (const def of defs) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...def.size), wallMat());
      m.position.set(...def.pos);
      m.receiveShadow = true;
      m.castShadow = false;
      m.userData.inward = new THREE.Vector3(...def.n);
      g.add(m);
      this.walls.push(m);
    }

    // 日照（影）の範囲を部屋に合わせる
    const r = Math.max(w, d);
    this.sunHome = new THREE.Vector3(w * 0.6, h * 4 + 6, d * 0.7);
    this.sun.position.copy(
      this.mode === 'top' ? new THREE.Vector3(0, r * 4 + 10, 0.01) : this.sunHome
    );
    this.sun.target.position.set(0, 0, 0);
    const cam = this.sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.5;
    cam.far = r * 6 + 40;
    cam.updateProjectionMatrix();

    this.controls.target.set(0, Math.min(h / 2, 1.2), 0);
    this.topControls.target.set(0, 0, 0);
    this.resize();
  }

  // ===== 状態の反映 =====
  setDoc(doc) {
    const roomChanged =
      !this.doc ||
      this.doc.room.w !== doc.room.w ||
      this.doc.room.d !== doc.room.d ||
      this.doc.room.h !== doc.room.h;
    this.doc = doc;
    if (roomChanged) this.buildRoom(doc.room);

    const seen = new Set();
    for (const item of doc.items) {
      seen.add(item.id);
      let g = this.items.get(item.id);
      if (!g || g.userData.type !== item.type) {
        if (g) {
          this.itemGroup.remove(g);
          disposeFixture(g);
        }
        g = buildFixture(item.type, item.color);
        g.userData.id = item.id;
        g.userData.type = item.type;
        g.userData.color = item.color;
        this.itemGroup.add(g);
        this.items.set(item.id, g);
      }
      if (g.userData.color !== item.color) {
        tintFixture(g, item.color);
        g.userData.color = item.color;
      }
      g.position.set(item.x, 0, item.z);
      g.rotation.y = deg(item.rotY || 0);
      g.scale.set(item.w, item.h, item.d);

      // ラベル
      let sp = this.labels.get(item.id);
      const text = item.name || '';
      if (!sp || sp.userData.text !== text) {
        if (sp) {
          this.labelGroup.remove(sp);
          sp.material.map.dispose();
          sp.material.dispose();
        }
        sp = makeLabelSprite(text || '—');
        this.labelGroup.add(sp);
        this.labels.set(item.id, sp);
      }
      sp.position.set(item.x, item.h + 0.32, item.z);
    }

    for (const [id, g] of this.items) {
      if (seen.has(id)) continue;
      this.itemGroup.remove(g);
      disposeFixture(g);
      this.items.delete(id);
      const sp = this.labels.get(id);
      if (sp) {
        this.labelGroup.remove(sp);
        sp.material.map.dispose();
        sp.material.dispose();
        this.labels.delete(id);
      }
    }

    this.labelGroup.visible = this.showLabels;
    this.updateOutline();
  }

  setSelected(id) {
    this.selectedId = id;
    this.updateOutline();
  }

  updateOutline() {
    const item = this.doc?.items.find((x) => x.id === this.selectedId);
    if (!item) {
      this.outline.visible = false;
      this.footprint.visible = false;
      return;
    }
    this.outline.visible = true;
    this.outline.position.set(item.x, item.h / 2, item.z);
    this.outline.rotation.y = deg(item.rotY || 0);
    this.outline.scale.set(item.w * 1.02, item.h * 1.02, item.d * 1.02);

    this.footprint.visible = true;
    this.footprint.position.set(item.x, 0.012, item.z);
    this.footprint.rotation.set(-Math.PI / 2, 0, -deg(item.rotY || 0));
    this.footprint.scale.set(item.w, item.d, 1);
  }

  setLabels(on) {
    this.showLabels = on;
    this.labelGroup.visible = on;
  }

  setSnap(v) {
    this.snap = v;
  }

  setMode(mode) {
    this.mode = mode;
    const room = this.doc?.room || { w: 12, d: 9, h: 3 };
    if (this.sunHome && mode !== 'top') this.sun.position.copy(this.sunHome);
    if (this.ceiling) this.ceiling.visible = mode === 'walk';

    if (mode === 'orbit') {
      this.camera = this.persp;
      this.controls.enabled = true;
      this.topControls.enabled = false;
      const r = Math.max(room.w, room.d);
      this.persp.position.set(r * 0.75, r * 0.7, r * 0.95);
      this.controls.target.set(0, 1, 0);
      this.controls.update();
    } else if (mode === 'top') {
      this.camera = this.ortho;
      // 真上から見るときは影がズレて見えるので、光源も真上へ
      this.sun.position.set(0, Math.max(room.w, room.d) * 4 + 10, 0.01);
      this.controls.enabled = false;
      this.topControls.enabled = true;
      this.ortho.position.set(0, 40, 0);
      this.ortho.zoom = 1;
      this.topControls.target.set(0, 0, 0);
      this.topControls.update();
    } else {
      this.camera = this.persp;
      this.controls.enabled = false;
      this.topControls.enabled = false;
      this.walkPos.set(0, EYE_HEIGHT, room.d / 2 - 1.2);
      this.walkYaw = 0; // 店の奥（-Z）を向く
      this.walkPitch = 0;
    }
    this.resize();
  }

  setPadInput(f, s) {
    this.padInput.f = f;
    this.padInput.s = s;
  }

  // ===== 入力 =====
  ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    return this.pointer;
  }

  pickItem(e) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hits = this.raycaster.intersectObjects(this.itemGroup.children, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.id) o = o.parent;
    return o ? { group: o, point: hits[0].point } : null;
  }

  planePoint(e) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.dragPlane, p) ? p : null;
  }

  onPointerDown(e) {
    if (e.button === 2) return; // 右クリックはカメラ操作に任せる
    const hit = this.pickItem(e);

    if (this.mode === 'walk') {
      this.look = { x: e.clientX, y: e.clientY, moved: 0, id: hit?.group.userData.id ?? null };
      return;
    }

    if (!hit) {
      this.handlers.onSelect?.(null);
      return;
    }

    // オブジェクトを掴む → カメラ操作を止める
    this.controls.enabled = false;
    this.topControls.enabled = false;

    const id = hit.group.userData.id;
    this.handlers.onSelect?.(id);

    const p = this.planePoint(e);
    const item = this.doc.items.find((x) => x.id === id);
    this.drag = {
      id,
      moved: false,
      offset: p && item ? { x: item.x - p.x, z: item.z - p.z } : { x: 0, z: 0 },
    };
    e.stopPropagation();
  }

  onPointerMove(e) {
    if (this.mode === 'walk' && this.look) {
      const dx = e.clientX - this.look.x;
      const dy = e.clientY - this.look.y;
      this.look.x = e.clientX;
      this.look.y = e.clientY;
      this.look.moved += Math.abs(dx) + Math.abs(dy);
      this.walkYaw -= dx * 0.005;
      this.walkPitch = THREE.MathUtils.clamp(
        this.walkPitch - dy * 0.005,
        -1.2,
        1.2
      );
      return;
    }

    if (!this.drag) return;
    const p = this.planePoint(e);
    if (!p) return;
    const item = this.doc.items.find((x) => x.id === this.drag.id);
    if (!item) return;

    let x = p.x + this.drag.offset.x;
    let z = p.z + this.drag.offset.z;
    if (this.snap > 0) {
      x = Math.round(x / this.snap) * this.snap;
      z = Math.round(z / this.snap) * this.snap;
    }
    const { hx, hz } = halfExtents(item);
    const room = this.doc.room;
    x = THREE.MathUtils.clamp(x, -room.w / 2 + hx, room.w / 2 - hx);
    z = THREE.MathUtils.clamp(z, -room.d / 2 + hz, room.d / 2 - hz);

    if (!this.drag.moved) {
      this.drag.moved = true;
      this.handlers.onMove?.(this.drag.id, x, z, 'start');
    } else {
      this.handlers.onMove?.(this.drag.id, x, z, 'move');
    }
  }

  onPointerUp() {
    if (this.drag) {
      this.drag = null;
      this.handlers.onMoveEnd?.();
    }
    if (this.look) {
      if (this.look.moved < 6) this.handlers.onSelect?.(this.look.id);
      this.look = null;
    }
    if (this.mode === 'orbit') this.controls.enabled = true;
    if (this.mode === 'top') this.topControls.enabled = true;
  }

  // ===== ループ =====
  walkStep(dt) {
    let f = this.padInput.f;
    let s = this.padInput.s;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) s += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) s -= 1;

    if (f || s) {
      const len = Math.hypot(f, s) || 1;
      const speed = WALK_SPEED * dt;
      const sin = Math.sin(this.walkYaw);
      const cos = Math.cos(this.walkYaw);
      const dx = ((-sin * f) / len + cos * (s / len)) * speed;
      const dz = ((-cos * f) / len - sin * (s / len)) * speed;
      this.tryMove(dx, dz);
    }

    this.persp.position.copy(this.walkPos);
    this.persp.rotation.set(0, 0, 0);
    this.persp.rotateY(this.walkYaw);
    this.persp.rotateX(this.walkPitch);
  }

  tryMove(dx, dz) {
    const room = this.doc?.room;
    if (!room) return;
    const r = 0.28;
    const nx = THREE.MathUtils.clamp(
      this.walkPos.x + dx,
      -room.w / 2 + r,
      room.w / 2 - r
    );
    const nz = THREE.MathUtils.clamp(
      this.walkPos.z + dz,
      -room.d / 2 + r,
      room.d / 2 - r
    );
    // 什器にぶつからないよう軸ごとに判定
    if (!this.blocked(nx, this.walkPos.z, r)) this.walkPos.x = nx;
    if (!this.blocked(this.walkPos.x, nz, r)) this.walkPos.z = nz;
  }

  blocked(x, z, r) {
    for (const item of this.doc.items) {
      if (item.type === 'door' || item.h < 0.4) continue;
      const a = -deg(item.rotY || 0);
      const dx = x - item.x;
      const dz = z - item.z;
      const lx = dx * Math.cos(a) - dz * Math.sin(a);
      const lz = dx * Math.sin(a) + dz * Math.cos(a);
      if (
        Math.abs(lx) < item.w / 2 + r &&
        Math.abs(lz) < item.d / 2 + r
      ) {
        return true;
      }
    }
    return false;
  }

  updateWalls() {
    const camPos = this.camera.position;
    for (const wall of this.walls) {
      if (this.mode === 'walk') {
        wall.visible = true;
        wall.material.opacity = 1;
        continue;
      }
      if (this.mode === 'top') {
        wall.visible = true;
        wall.material.opacity = 0.35;
        continue;
      }
      // 手前の壁（カメラと室内の間にある壁）は隠す
      const toCam = camPos.clone().sub(wall.position);
      wall.visible = toCam.dot(wall.userData.inward) > 0;
      wall.material.opacity = 0.9;
    }
  }

  tick() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.mode === 'walk') this.walkStep(dt);
    else if (this.mode === 'top') this.topControls.update();
    else this.controls.update();

    this.labelGroup.visible = this.showLabels && this.mode !== 'walk';
    this.updateWalls();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();

    const room = this.doc?.room || { w: 12, d: 9 };
    const pad = 1.4;
    const aspect = w / h;
    let halfW = (room.w / 2) * pad;
    let halfH = (room.d / 2) * pad;
    if (halfW / halfH < aspect) halfW = halfH * aspect;
    else halfH = halfW / aspect;
    this.ortho.left = -halfW;
    this.ortho.right = halfW;
    this.ortho.top = halfH;
    this.ortho.bottom = -halfH;
    this.ortho.updateProjectionMatrix();
  }

  /** 画像として書き出す（PNG dataURL） */
  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this._onPointerDown, true);
    el.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.controls.dispose();
    this.topControls.dispose();
    for (const g of this.items.values()) disposeFixture(g);
    this.renderer.dispose();
    el.remove();
  }
}
