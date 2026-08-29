import * as THREE from 'three';

/**
 * テクスチャの生成。
 *
 * 画像ファイルを持たずに済むよう、canvas に手続き的に描いて作る。
 * どれもタイル状に繰り返すので、継ぎ目が出ないよう
 * ノイズの格子と模様の周期を canvas の幅に合わせてある。
 *
 * 生成結果はモジュール内でキャッシュし、シーン全体で共有する。
 */

const SIZE = 512;

function newCanvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

// ===== 周期ノイズ =====

/** n×n の乱数格子（巡回参照するので継ぎ目が出ない） */
function lattice(n, seed) {
  const g = new Float32Array(n * n);
  let s = seed >>> 0;
  for (let i = 0; i < g.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    g[i] = s / 4294967296;
  }
  return g;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** 格子 g（n×n）を使った周期ノイズ。x, y は格子単位 */
function noise2(g, n, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = smoothstep(x - xi);
  const ty = smoothstep(y - yi);
  const i0 = ((xi % n) + n) % n;
  const j0 = ((yi % n) + n) % n;
  const i1 = (i0 + 1) % n;
  const j1 = (j0 + 1) % n;
  const a = g[j0 * n + i0];
  const b = g[j0 * n + i1];
  const c = g[j1 * n + i0];
  const d = g[j1 * n + i1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/**
 * フラクタルノイズを1つ作る。
 * 格子はここで用意しておき、ピクセルごとの処理では参照するだけにする
 * （テクスチャ1枚で数百万回呼ぶので、ここでの割り当てが効く）。
 */
function field(seed, octaves = 4, base = 4) {
  const ns = new Int32Array(octaves);
  const gs = [];
  let total = 0;
  let amp = 0.5;
  for (let o = 0; o < octaves; o++) {
    const n = base * 2 ** o;
    ns[o] = n;
    gs.push(lattice(n, seed * 7919 + n * 104729 + 12345));
    total += amp;
    amp *= 0.5;
  }
  return (x, y) => {
    let sum = 0;
    let a = 0.5;
    for (let o = 0; o < octaves; o++) {
      const n = ns[o];
      sum += a * noise2(gs[o], n, x * n, y * n);
      a *= 0.5;
    }
    return sum / total;
  };
}

// ===== ピクセル操作 =====

/** fn(u, v, out) が out に [r, g, b] を書く形で canvas を塗る */
function paint(fn, size = SIZE) {
  const c = newCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const out = [0, 0, 0];
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x * inv, y * inv, out);
      const i = (y * size + x) * 4;
      img.data[i] = out[0];
      img.data[i + 1] = out[1];
      img.data[i + 2] = out[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** グレースケール1枚を塗る（法線マップの元になる高さ） */
function paintGray(fn, size = SIZE) {
  const c = newCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = fn(x * inv, y * inv) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** 高さ（グレースケール）から法線マップを作る */
function heightToNormal(heightCanvas, strength = 2.5) {
  const s = heightCanvas.width;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, s, s).data;
  const at = (x, y) => src[((((y % s) + s) % s) * s + (((x % s) + s) % s)) * 4] / 255;

  const out = newCanvas(s);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * s + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function toTexture(canvas, { srgb = false, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function rgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

/** 明るさ v(0..1) を色 base に乗せて out に書く */
function shade(out, base, v) {
  out[0] = base[0] * v;
  out[1] = base[1] * v;
  out[2] = base[2] * v;
  return out;
}

// ===== 素材ごとの模様 =====

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 継ぎ目までの近さ（0=離れている, 1=継ぎ目の上） */
function seamAt(v, pitch, width) {
  const d = Math.abs(((v * pitch) % 1) - 0.5) * 2;
  return d > 1 - width ? (d - (1 - width)) / width : 0;
}

/** 板張りの床。canvas 1枚 = 2m 角 */
function woodPlanks() {
  const rows = 5; // 板の枚数（板幅 40cm）
  const light = rgb('#caa478');
  const dark = rgb('#91704b');
  const grainField = field(1, 4, 4);
  const fineField = field(2, 3, 8);
  const base = [0, 0, 0];

  const color = paint((u, v, out) => {
    const r = Math.floor(v * rows);
    const off = (r % 2) * 0.5; // 木口を互い違いにずらす
    const grain = grainField((u + off) * 1.0, v * 9.0);
    const fine = fineField((u + off) * 3.0, v * 40.0);
    const t = clamp01((grain * 0.7 + fine * 0.3) * 1.25 - 0.1);
    base[0] = mix(dark[0], light[0], t);
    base[1] = mix(dark[1], light[1], t);
    base[2] = mix(dark[2], light[2], t);
    const tone = 0.82 + ((r * 37) % 11) / 40; // 板ごとの色ムラ
    // 板の継ぎ目（長辺）と木口（短辺）を暗く
    const j = Math.max(seamAt(v, rows, 0.06), seamAt(u + off, 2, 0.035) * 0.8);
    shade(out, base, tone * (1 - j * 0.55));
  });

  const height = paintGray((u, v) => {
    const r = Math.floor(v * rows);
    const off = (r % 2) * 0.5;
    const grain = fineField((u + off) * 3.0, v * 40.0);
    const j = Math.max(seamAt(v, rows, 0.05), seamAt(u + off, 2, 0.03));
    return (0.7 + grain * 0.3) * (1 - j);
  });

  return { color, height, normalStrength: 2.2, roughness: 0.62 };
}

/**
 * 畳。canvas 1枚 = 3.64m 角（八畳敷き）。
 * 1畳 0.91×1.82m を、四半分ごとに向きを変えて風車状に並べる。
 */
function tatami() {
  const SZ = 768;
  const face = rgb('#c4b78d');
  const deep = rgb('#a2996e');
  const edge = rgb('#33384a'); // 縁（へり）
  const edgeField = field(6, 2, 8);
  const strandField = field(7, 2, 8);
  const blotchField = field(5, 3, 4);
  const base = [0, 0, 0];

  // その点がどの畳の、どこに当たるか（across=短辺方向, along=長辺方向）
  const across = (u, v) => {
    const vertical = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0;
    return vertical ? (((u * 2) % 1) * 2) % 1 : (((v * 2) % 1) * 2) % 1;
  };
  const along = (u, v) => {
    const vertical = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0;
    return vertical ? (v * 2) % 1 : (u * 2) % 1;
  };

  const color = paint((u, v, out) => {
    const a = across(u, v);
    const l = along(u, v);
    if (a < 0.036 || a > 0.964) {
      // 縁：細かい織りの縞
      const w = 0.5 + 0.5 * Math.sin(l * Math.PI * 2 * 260);
      shade(out, edge, 0.95 + edgeField(u * 20, v * 20) * 0.25 + w * 0.1);
      return;
    }
    if (l < 0.006 || l > 0.994) {
      shade(out, deep, 0.55); // 畳と畳の合わせ目
      return;
    }
    // い草の目：長辺と直交する細い縞
    const weave = 0.5 + 0.5 * Math.sin(l * Math.PI * 2 * 96);
    const t =
      0.45 + blotchField(u * 2, v * 2) * 0.4 + strandField(u * 24, v * 24) * 0.15;
    base[0] = mix(deep[0], face[0], t);
    base[1] = mix(deep[1], face[1], t);
    base[2] = mix(deep[2], face[2], t);
    shade(out, base, 0.94 + weave * 0.09);
  }, SZ);

  const height = paintGray((u, v) => {
    const a = across(u, v);
    const l = along(u, v);
    if (a < 0.036 || a > 0.964) return 0.84;
    if (l < 0.006 || l > 0.994) return 0.24;
    const weave = 0.5 + 0.5 * Math.sin(l * Math.PI * 2 * 96);
    const rim = a < 0.05 || a > 0.95 ? 0.6 : 1;
    return (0.55 + weave * 0.45) * rim;
  }, SZ);

  return { color, height, normalStrength: 1.4, roughness: 0.88 };
}

/** タイル床。canvas 1枚 = 1.2m 角（30cm角タイル 4×4） */
function tiles() {
  const n = 4;
  const base = rgb('#d8d5cd');
  const grout = rgb('#9c9a95');
  const mottleField = field(9, 3, 8);
  const c = [0, 0, 0];

  const grid = (u, v) => {
    const gu = Math.abs(((u * n) % 1) - 0.5) * 2;
    const gv = Math.abs(((v * n) % 1) - 0.5) * 2;
    const g = Math.max(gu, gv);
    return g > 0.94 ? (g - 0.94) / 0.06 : 0; // 目地への近さ
  };

  const color = paint((u, v, out) => {
    const g = grid(u, v);
    const cell = Math.floor(u * n) + Math.floor(v * n) * n;
    const tone = 0.94 + ((cell * 29) % 9) / 90;
    shade(c, base, tone * (0.94 + mottleField(u * 3, v * 3) * 0.12));
    out[0] = mix(c[0], grout[0], g);
    out[1] = mix(c[1], grout[1], g);
    out[2] = mix(c[2], grout[2], g);
  });

  const height = paintGray((u, v) => 1 - grid(u, v) * 0.9);

  return { color, height, normalStrength: 3.2, roughness: 0.35 };
}

/** モルタル・土間。canvas 1枚 = 2m 角 */
function concrete() {
  const base = rgb('#b9b7b2');
  const mottleField = field(11, 5, 4);
  const speckField = field(12, 2, 16);
  const bumpField = field(12, 3, 16);

  const color = paint((u, v, out) => {
    const n = mottleField(u, v);
    const speck = speckField(u * 8, v * 8);
    shade(out, base, 0.86 + n * 0.2 + (speck > 0.72 ? 0.06 : 0));
  });
  const height = paintGray((u, v) => bumpField(u * 8, v * 8));
  return { color, height, normalStrength: 1.2, roughness: 0.92 };
}

/** 塗り壁（漆喰）。canvas 1枚 = 2.5m 角 */
function plaster() {
  const base = rgb('#efece5');
  const cloudField = field(21, 5, 4);
  const trowelField = field(22, 3, 8); // 倍率は整数のみ（周期を保つため）
  const bumpField = field(22, 4, 8);

  const color = paint((u, v, out) => {
    shade(
      out,
      base,
      0.9 + cloudField(u, v) * 0.13 + trowelField(u * 3, v * 3) * 0.06
    );
  });
  const height = paintGray((u, v) => bumpField(u * 3, v * 3));
  return { color, height, normalStrength: 1.6, roughness: 0.95 };
}

/** 什器の木部。色を乗せるので白基調 */
function woodGrain() {
  const SZ = 256;
  const grainField = field(31, 4, 4);
  const fineField = field(32, 3, 8);
  const color = paint((u, v, out) => {
    const t = 0.86 + grainField(u * 1, v * 12) * 0.18 + fineField(u * 4, v * 48) * 0.06;
    out[0] = out[1] = out[2] = t * 255;
  }, SZ);
  const height = paintGray((u, v) => fineField(u * 4, v * 48), SZ);
  return { color, height, normalStrength: 1.4, roughness: 0.7 };
}

/** ステンレスのヘアライン */
function brushedMetal() {
  const SZ = 256;
  const lineField = field(41, 2, 16);
  const wideField = field(42, 3, 4);
  const color = paint((u, v, out) => {
    const t = 0.95 + lineField(u * 1.0, v * 384) * 0.06 + wideField(u * 2, v * 8) * 0.02;
    out[0] = out[1] = out[2] = t * 255;
  }, SZ);
  const height = paintGray((u, v) => lineField(u * 1.0, v * 384), SZ);
  return { color, height, normalStrength: 0.35, roughness: 0.3 };
}

/** 粉体塗装の金属（棚など）。ごく細かい梨地 */
function paintedSteel() {
  const SZ = 256;
  const grainField = field(51, 2, 16);
  const color = paint((u, v, out) => {
    const t = 0.93 + grainField(u * 16, v * 16) * 0.1;
    out[0] = out[1] = out[2] = t * 255;
  }, SZ);
  const height = paintGray((u, v) => grainField(u * 16, v * 16), SZ);
  return { color, height, normalStrength: 0.7, roughness: 0.55 };
}

// ===== 公開API =====

const BUILDERS = {
  wood: woodPlanks,
  tatami,
  tile: tiles,
  concrete,
  plaster,
  woodGrain,
  metal: brushedMetal,
  painted: paintedSteel,
};

/** 素材1枚分の実寸（m）。床材の繰り返し計算に使う */
export const MATERIAL_SCALE = {
  wood: 2.0,
  tatami: 3.64,
  tile: 1.2,
  concrete: 2.0,
  plaster: 2.5,
};

const cache = new Map();

/**
 * 素材の {map, normalMap, roughness} を返す。
 * repeat は呼び出し側で texture.repeat を触らずに済むよう、
 * 素材ごとに1組だけ作って共有する（床は setRepeat で個別に調整）。
 */
export function material(kind, repeat = 1) {
  const key = kind + '@' + repeat;
  let m = cache.get(key);
  if (m) return m;

  const build = BUILDERS[kind];
  if (!build) return null;

  const { color, height, normalStrength, roughness } = build();
  m = {
    map: toTexture(color, { srgb: true, repeat }),
    normalMap: toTexture(heightToNormal(height, normalStrength), { repeat }),
    roughness,
  };
  cache.set(key, m);
  return m;
}

/** 床・壁のように部屋の大きさで繰り返し数が変わるもの用 */
export function surface(kind, widthM, heightM) {
  const src = material(kind);
  if (!src) return null;
  const scale = MATERIAL_SCALE[kind] || 2;
  const map = src.map.clone();
  const normalMap = src.normalMap.clone();
  for (const t of [map, normalMap]) {
    t.needsUpdate = true;
    t.repeat.set(widthM / scale, heightM / scale);
  }
  return { map, normalMap, roughness: src.roughness };
}
