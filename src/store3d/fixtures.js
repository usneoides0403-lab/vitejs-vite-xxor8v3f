import * as THREE from 'three';
import { material, surface } from './textures.js';

/**
 * 什器（フィクスチャ）の定義とメッシュ生成。
 *
 * 生成されるグループは「単位空間」で作る:
 *   x, z ∈ [-0.5, 0.5] / y ∈ [0, 1]（床が y=0）
 * 実サイズは呼び出し側で group.scale.set(w, h, d) して合わせる。
 */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const UNIT_SPHERE = new THREE.IcosahedronGeometry(0.5, 1);

export const CATALOG = [
  // --- 売場・什器 ---
  { type: 'shelf',      group: '売場',   label: 'ゴンドラ棚',   emoji: '🗄️', w: 1.2,  d: 0.6,  h: 1.8,  color: '#c9ced6' },
  { type: 'endcap',     group: '売場',   label: 'エンド平台',   emoji: '🧺', w: 1.2,  d: 0.9,  h: 0.9,  color: '#d9c49a' },
  { type: 'fridge',     group: '売場',   label: '冷蔵ケース',   emoji: '🥤', w: 1.8,  d: 0.8,  h: 2.0,  color: '#a9b6bf' },
  { type: 'freezer',    group: '売場',   label: '冷凍平ケース', emoji: '🍨', w: 1.6,  d: 0.9,  h: 0.9,  color: '#b6ccd6' },
  { type: 'basket',     group: '売場',   label: 'カゴ置き場',   emoji: '🛒', w: 0.6,  d: 0.8,  h: 0.9,  color: '#7fa8d9' },
  { type: 'sign',       group: '売場',   label: '看板 / POP',   emoji: '🪧', w: 0.9,  d: 0.12, h: 1.7,  color: '#e8a13c' },
  { type: 'plant',      group: '売場',   label: '観葉植物',     emoji: '🪴', w: 0.7,  d: 0.7,  h: 1.4,  color: '#4f9e57' },

  // --- 客席・和室 ---
  { type: 'table',      group: '客席',   label: 'テーブル席',   emoji: '🍽️', w: 1.2,  d: 0.8,  h: 0.75, color: '#c08f5e' },
  { type: 'lowtable',   group: '客席',   label: '座卓',         emoji: '🍵', w: 1.5,  d: 0.8,  h: 0.35, color: '#8a5a33' },
  { type: 'zashiki',    group: '客席',   label: '小上がり（畳）', emoji: '🀄', w: 3.64, d: 2.73, h: 0.4,  color: '#8a6b4a' },
  { type: 'engawa',     group: '客席',   label: '縁側',         emoji: '🪵', w: 3.6,  d: 0.9,  h: 0.42, color: '#a3865c' },
  { type: 'irori',      group: '客席',   label: 'いろり',       emoji: '🔥', w: 0.9,  d: 0.9,  h: 0.35, color: '#6b4f37' },
  { type: 'counter',    group: '客席',   label: 'カウンター',   emoji: '🧾', w: 2.0,  d: 0.7,  h: 1.0,  color: '#c9ab7d' },
  { type: 'register',   group: '客席',   label: 'レジ',         emoji: '💳', w: 1.4,  d: 0.8,  h: 1.0,  color: '#e0cf9b' },

  // --- 厨房 ---
  { type: 'worktable',  group: '厨房',   label: '作業台',       emoji: '🔪', w: 1.5,  d: 0.75, h: 0.85, color: '#b9c0c6' },
  { type: 'sink',       group: '厨房',   label: 'シンク',       emoji: '🚰', w: 1.5,  d: 0.75, h: 0.85, color: '#b9c0c6' },
  { type: 'gasrange',   group: '厨房',   label: 'ガスレンジ',   emoji: '🔥', w: 1.2,  d: 0.75, h: 0.8,  color: '#9aa1a8' },
  { type: 'hood',       group: '厨房',   label: 'レンジフード', emoji: '💨', w: 1.6,  d: 0.9,  h: 0.6,  color: '#aeb5bb', y: 1.6 },
  { type: 'reachin',    group: '厨房',   label: '業務用冷蔵庫', emoji: '🧊', w: 1.2,  d: 0.8,  h: 1.95, color: '#b9c0c6' },
  { type: 'rack',       group: '厨房',   label: 'ステンレス棚', emoji: '🗃️', w: 1.2,  d: 0.5,  h: 1.8,  color: '#aeb5bb' },
  { type: 'dishwasher', group: '厨房',   label: '食洗器',       emoji: '🫧', w: 0.6,  d: 0.65, h: 0.85, color: '#b9c0c6' },
  { type: 'microwave',  group: '厨房',   label: '電子レンジ',   emoji: '📻', w: 0.5,  d: 0.4,  h: 0.3,  color: '#dcdfe3', y: 0.85 },
  { type: 'hotplate',   group: '厨房',   label: 'ホットプレート', emoji: '🍳', w: 0.5, d: 0.35, h: 0.12, color: '#4a4f55', y: 0.85 },
  { type: 'ventfan',    group: '厨房',   label: '換気扇',       emoji: '🌀', w: 0.5,  d: 0.2,  h: 0.5,  color: '#c8cbcf', y: 2.0 },

  // --- 建具・水まわり ---
  { type: 'door',       group: '建具',   label: '入口',         emoji: '🚪', w: 1.6,  d: 0.25, h: 2.2,  color: '#8fd0a8' },
  { type: 'sliding',    group: '建具',   label: '引戸 / 障子',  emoji: '🎴', w: 1.8,  d: 0.1,  h: 1.95, color: '#c8b48c' },
  { type: 'wall',       group: '建具',   label: '間仕切り',     emoji: '🧱', w: 2.0,  d: 0.15, h: 2.2,  color: '#d3d1cb' },
  { type: 'pillar',     group: '建具',   label: '柱',           emoji: '🏛️', w: 0.45, d: 0.45, h: 3.0,  color: '#d5d5d8' },
  { type: 'toilet',     group: '建具',   label: 'トイレ',       emoji: '🚽', w: 0.8,  d: 1.2,  h: 0.95, color: '#f2f2f0' },
  { type: 'handwash',   group: '建具',   label: '手洗い',       emoji: '🧼', w: 0.6,  d: 0.45, h: 1.0,  color: '#e8ebee' },
];

export const CATALOG_BY_TYPE = Object.fromEntries(
  CATALOG.map((c) => [c.type, c])
);

const GOODS_COLORS = [
  '#e5624a', '#f0a23c', '#f2d05a', '#79b45b',
  '#4aa3c7', '#7d6bc4', '#d95f9a', '#e8e2d4',
];

/**
 * 什器の仕上げ（テクスチャの当て方）。
 * 木部・ステンレス・粉体塗装で反射と細かい凹凸を変える。
 */
const FINISH = {
  shelf: 'painted',
  endcap: 'woodGrain',
  fridge: 'metal',
  freezer: 'metal',
  register: 'painted',
  counter: 'woodGrain',
  table: 'woodGrain',
  basket: 'painted',
  plant: 'painted',
  pillar: 'painted',
  wall: 'plaster',
  door: 'painted',
  sign: 'painted',

  lowtable: 'woodGrain',
  zashiki: 'woodGrain',
  engawa: 'woodGrain',
  irori: 'woodGrain',
  sliding: 'woodGrain',

  worktable: 'metal',
  sink: 'metal',
  gasrange: 'metal',
  hood: 'metal',
  reachin: 'metal',
  rack: 'metal',
  dishwasher: 'metal',
  microwave: 'metal',
  hotplate: 'painted',
  ventfan: 'metal',

  toilet: 'painted',
  handwash: 'painted',
};

const NORMAL_SCALE = new THREE.Vector2(0.6, 0.6);

/** 仕上げごとのテクスチャの細かさ・反射の強さ */
const FINISH_LOOK = {
  woodGrain: { repeat: 2, metalness: 0.03, env: 0.45 },
  metal: { repeat: 4, metalness: 0.78, env: 1.35 },
  painted: { repeat: 3, metalness: 0.05, env: 0.6 },
  plaster: { repeat: 2, metalness: 0, env: 0.3 },
};

function stdMat(color, extra) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.85,
    metalness: 0.05,
    ...extra,
  });
}

/** 仕上げのテクスチャを当てたマテリアル */
function finishMat(color, finish, extra) {
  const look = FINISH_LOOK[finish] || FINISH_LOOK.painted;
  const tex = material(finish, look.repeat);
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: tex ? tex.roughness : 0.85,
    metalness: look.metalness,
    envMapIntensity: look.env,
    map: tex ? tex.map : null,
    normalMap: tex ? tex.normalMap : null,
    normalScale: NORMAL_SCALE.clone(),
    ...extra,
  });
}

/**
 * 床材（畳・板張り）を什器の天端に張る。
 * 実寸に合わせた繰り返しは、大きさが決まる scene 側で設定する。
 */
function deckMat(g, kind, scale) {
  const tex = surface(kind, scale, scale);
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: tex ? tex.roughness : 0.8,
    metalness: 0,
    map: tex?.map || null,
    normalMap: tex?.normalMap || null,
    envMapIntensity: 0.3,
  });
  if (tex) {
    g.userData.deck = { maps: [tex.map, tex.normalMap], scale };
  }
  return mat;
}

function glassMat() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#dff1fa'),
    roughness: 0.04,
    metalness: 0,
    transmission: 0,
    transparent: true,
    opacity: 0.22,
    envMapIntensity: 1.6,
  });
}

function addBox(group, material, w, h, d, x, y, z) {
  const m = new THREE.Mesh(UNIT_BOX, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function addCyl(group, material, r, h, x, y, z) {
  const m = new THREE.Mesh(UNIT_CYL, material);
  m.scale.set(r * 2, h, r * 2);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function addSphere(group, material, r, x, y, z) {
  const m = new THREE.Mesh(UNIT_SPHERE, material);
  m.scale.set(r * 2, r * 2, r * 2);
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

/** 棚板の上に並ぶ「商品」っぽい小箱 */
function addGoods(group, y, depth, seed) {
  for (let i = 0; i < 4; i++) {
    const c = GOODS_COLORS[(seed * 4 + i) % GOODS_COLORS.length];
    addBox(
      group,
      finishMat(c, 'painted', { roughness: 0.72 }),
      0.16,
      0.13,
      depth,
      -0.33 + i * 0.22,
      y + 0.065,
      0
    );
  }
}

/**
 * type に応じた単位サイズのグループを作る。
 * 戻り値の userData.tint に「本体色を反映するマテリアル」を入れておく。
 */
export function buildFixture(type, color) {
  const g = new THREE.Group();
  const finish = FINISH[type] || 'painted';
  const body = finishMat(color, finish);
  const dark = finishMat(new THREE.Color(color).multiplyScalar(0.62), finish);
  const metal = finishMat('#aeb5bb', 'metal', { roughness: 0.26 });
  g.userData.tint = [body, dark];

  switch (type) {
    case 'shelf': {
      addBox(g, dark, 1, 1, 0.06, 0, 0.5, -0.47); // 背板
      addBox(g, body, 0.05, 1, 0.94, -0.475, 0.5, 0.03); // 側板
      addBox(g, body, 0.05, 1, 0.94, 0.475, 0.5, 0.03);
      addBox(g, body, 1, 0.05, 0.94, 0, 0.025, 0.03); // 底
      for (let i = 0; i < 3; i++) {
        const y = 0.28 + i * 0.26;
        addBox(g, body, 0.94, 0.03, 0.9, 0, y, 0.03);
        addGoods(g, y + 0.015, 0.34, i);
      }
      break;
    }
    case 'endcap': {
      addBox(g, body, 1, 0.72, 1, 0, 0.36, 0);
      addBox(g, dark, 1.02, 0.06, 1.02, 0, 0.75, 0);
      addGoods(g, 0.78, 0.5, 2);
      break;
    }
    case 'fridge': {
      addBox(g, body, 1, 1, 1, 0, 0.5, 0); // 筐体
      addBox(g, dark, 0.92, 0.86, 0.06, 0, 0.5, 0.47); // 扉フレーム
      const glass = glassMat();
      addBox(g, glass, 0.86, 0.78, 0.02, 0, 0.5, 0.5);
      for (let i = 0; i < 3; i++) {
        const y = 0.22 + i * 0.24;
        addBox(g, metal, 0.86, 0.02, 0.8, 0, y, -0.02);
        addGoods(g, y, 0.3, i + 1);
      }
      addBox(g, stdMat('#fff6d8', { emissive: '#fff2c9', emissiveIntensity: 0.8, roughness: 0.4 }), 0.9, 0.03, 0.06, 0, 0.96, 0.44);
      break;
    }
    case 'freezer': {
      addBox(g, body, 1, 0.9, 1, 0, 0.45, 0);
      addBox(g, dark, 0.92, 0.06, 0.92, 0, 0.78, 0);
      addBox(g, finishMat('#dff1f7', 'metal', { roughness: 0.18, metalness: 0.35 }), 0.86, 0.02, 0.86, 0, 0.82, 0);
      addBox(g, dark, 1.02, 0.08, 1.02, 0, 0.96, 0);
      break;
    }
    case 'register': {
      addBox(g, body, 1, 0.85, 1, 0, 0.425, 0);
      addBox(g, dark, 1.06, 0.06, 1.06, 0, 0.88, 0);
      addBox(g, stdMat('#22262b', { roughness: 0.25 }), 0.34, 0.26, 0.05, -0.2, 1.04, -0.05); // モニタ
      addBox(g, metal, 0.06, 0.12, 0.06, -0.2, 0.94, -0.05);
      addBox(g, finishMat('#5a6068', 'painted'), 0.26, 0.06, 0.2, 0.24, 0.94, 0); // ドロア
      break;
    }
    case 'counter': {
      addBox(g, body, 1, 0.9, 0.86, 0, 0.45, 0);
      addBox(g, dark, 1.04, 0.08, 1, 0, 0.94, 0);
      break;
    }
    case 'table': {
      addBox(g, dark, 1, 0.08, 1, 0, 0.96, 0); // 天板
      const legs = [
        [-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42],
      ];
      for (const [x, z] of legs) addBox(g, metal, 0.06, 0.92, 0.06, x, 0.46, z);
      addCyl(g, body, 0.16, 0.06, -0.62, 0.58, 0); // 椅子（座面）
      addCyl(g, body, 0.16, 0.06, 0.62, 0.58, 0);
      addCyl(g, metal, 0.04, 0.55, -0.62, 0.28, 0);
      addCyl(g, metal, 0.04, 0.55, 0.62, 0.28, 0);
      break;
    }
    case 'basket': {
      for (let i = 0; i < 4; i++) {
        addBox(g, i % 2 ? dark : body, 0.9, 0.2, 0.9, 0, 0.11 + i * 0.22, 0);
      }
      break;
    }
    case 'plant': {
      addCyl(g, finishMat('#a8674a', 'painted', { roughness: 0.6 }), 0.28, 0.3, 0, 0.15, 0);
      addCyl(g, finishMat('#4a3b2f', 'woodGrain'), 0.05, 0.35, 0, 0.42, 0);
      addSphere(g, body, 0.34, 0, 0.72, 0);
      addSphere(g, dark, 0.24, 0.18, 0.9, 0.1);
      addSphere(g, dark, 0.2, -0.2, 0.86, -0.08);
      break;
    }
    case 'pillar': {
      addBox(g, body, 1, 1, 1, 0, 0.5, 0);
      addBox(g, dark, 1.15, 0.05, 1.15, 0, 0.03, 0);
      addBox(g, dark, 1.15, 0.05, 1.15, 0, 0.97, 0);
      break;
    }
    case 'wall': {
      addBox(g, body, 1, 1, 1, 0, 0.5, 0);
      addBox(g, dark, 1.02, 0.04, 1.1, 0, 0.99, 0);
      break;
    }
    case 'door': {
      addBox(g, body, 0.12, 1, 1, -0.44, 0.5, 0); // 枠
      addBox(g, body, 0.12, 1, 1, 0.44, 0.5, 0);
      addBox(g, body, 1, 0.1, 1, 0, 0.95, 0);
      addBox(g, glassMat(), 0.36, 0.86, 0.4, -0.19, 0.45, 0);
      addBox(g, glassMat(), 0.36, 0.86, 0.4, 0.19, 0.45, 0);
      break;
    }
    case 'sign': {
      addCyl(g, metal, 0.05, 0.62, 0, 0.31, 0);
      addBox(g, metal, 0.5, 0.04, 0.5, 0, 0.02, 0);
      addBox(g, body, 1, 0.42, 1, 0, 0.79, 0);
      addBox(g, stdMat('#f7f5ef', { roughness: 0.55 }), 0.84, 0.3, 0.2, 0, 0.79, 0.42);
      break;
    }
    case 'zashiki': {
      // 小上がり：台輪の上に畳
      addBox(g, dark, 1, 0.86, 1, 0, 0.43, 0);
      addBox(g, body, 1.02, 0.08, 1.02, 0, 0.9, 0); // 畳寄せの框
      addBox(g, deckMat(g, 'tatami', 3.64), 0.98, 0.12, 0.98, 0, 0.95, 0);
      break;
    }
    case 'engawa': {
      // 縁側：縁板と下地、束
      addBox(g, deckMat(g, 'wood', 2), 1, 0.2, 1, 0, 0.9, 0);
      addBox(g, dark, 0.98, 0.5, 0.9, 0, 0.55, 0);
      for (const x of [-0.42, 0, 0.42]) {
        addBox(g, dark, 0.08, 0.62, 0.6, x, 0.31, 0);
      }
      break;
    }
    case 'irori': {
      const t = 0.16;
      // 木枠
      addBox(g, body, 1, 1, t, 0, 0.5, -0.5 + t / 2);
      addBox(g, body, 1, 1, t, 0, 0.5, 0.5 - t / 2);
      addBox(g, body, t, 1, 1 - t * 2, -0.5 + t / 2, 0.5, 0);
      addBox(g, body, t, 1, 1 - t * 2, 0.5 - t / 2, 0.5, 0);
      // 灰と炭
      addBox(g, stdMat('#9a958c', { roughness: 1 }), 1 - t * 2, 0.82, 1 - t * 2, 0, 0.41, 0);
      addBox(
        g,
        stdMat('#3b2a24', { emissive: '#ff5a1e', emissiveIntensity: 0.5, roughness: 0.9 }),
        0.34,
        0.05,
        0.34,
        0,
        0.84,
        0
      );
      // 五徳と鍋
      addCyl(g, metal, 0.2, 0.04, 0, 0.88, 0);
      addCyl(g, stdMat('#2f3336', { roughness: 0.5, metalness: 0.4 }), 0.19, 0.22, 0, 1.0, 0);
      break;
    }
    case 'lowtable': {
      addBox(g, dark, 1, 0.16, 1, 0, 0.92, 0); // 天板
      for (const [x, z] of [[-0.4, -0.36], [0.4, -0.36], [-0.4, 0.36], [0.4, 0.36]]) {
        addBox(g, body, 0.07, 0.84, 0.07, x, 0.42, z);
      }
      // 座布団
      for (const z of [-0.78, 0.78]) {
        addBox(g, stdMat('#7d3b3b', { roughness: 0.95 }), 0.42, 0.16, 0.4, 0, 0.08, z);
      }
      break;
    }
    case 'sliding': {
      const paper = stdMat('#f6f2e4', { roughness: 0.95 });
      addBox(g, dark, 1, 0.04, 1, 0, 0.02, 0); // 敷居
      addBox(g, dark, 1, 0.05, 1, 0, 0.975, 0); // 鴨居
      for (const side of [-1, 1]) {
        const x = side * 0.25;
        const z = side * 0.18;
        addBox(g, paper, 0.48, 0.9, 0.3, x, 0.5, z);
        // 桟
        for (let i = 0; i < 4; i++) {
          addBox(g, body, 0.48, 0.014, 0.42, x, 0.14 + i * 0.21, z);
        }
        for (let j = 0; j < 3; j++) {
          addBox(g, body, 0.014, 0.88, 0.42, x - 0.15 + j * 0.15, 0.5, z);
        }
        // 框
        addBox(g, body, 0.5, 0.05, 0.46, x, 0.94, z);
        addBox(g, body, 0.5, 0.05, 0.46, x, 0.06, z);
        addBox(g, body, 0.035, 0.9, 0.46, x - 0.24, 0.5, z);
        addBox(g, body, 0.035, 0.9, 0.46, x + 0.24, 0.5, z);
      }
      break;
    }
    case 'toilet': {
      addBox(g, body, 0.5, 0.42, 0.44, 0, 0.21, 0.1); // 便器
      addCyl(g, body, 0.26, 0.09, 0, 0.44, 0.12); // 便座
      addCyl(g, stdMat('#dfe2e4'), 0.2, 0.03, 0, 0.5, 0.12);
      addBox(g, body, 0.56, 0.62, 0.2, 0, 0.31, -0.32); // タンク
      addBox(g, dark, 0.58, 0.05, 0.22, 0, 0.64, -0.32);
      break;
    }
    case 'handwash': {
      addBox(g, body, 1, 0.1, 1, 0, 0.9, 0); // カウンター
      addBox(g, stdMat('#cfd6db', { roughness: 0.3 }), 0.62, 0.12, 0.6, 0, 0.86, 0.04); // ボウル
      addBox(g, body, 0.24, 0.85, 0.24, 0, 0.42, -0.24); // 支柱
      addCyl(g, metal, 0.03, 0.24, 0, 1.02, -0.3); // 水栓
      addBox(g, metal, 0.05, 0.03, 0.22, 0, 1.12, -0.2);
      break;
    }
    case 'worktable': {
      addBox(g, body, 1, 0.09, 1, 0, 0.955, 0); // 天板
      addBox(g, body, 0.94, 0.04, 0.9, 0, 0.28, 0); // 中棚
      for (const [x, z] of [[-0.45, -0.42], [0.45, -0.42], [-0.45, 0.42], [0.45, 0.42]]) {
        addBox(g, metal, 0.05, 0.92, 0.05, x, 0.46, z);
      }
      break;
    }
    case 'sink': {
      // 天板は縁だけ残して、槽が見えるようにする
      const rail = 0.09;
      addBox(g, body, 1, rail, 0.16, 0, 0.955, -0.42); // 奥
      addBox(g, body, 1, rail, 0.16, 0, 0.955, 0.42); // 手前
      addBox(g, body, 0.08, rail, 1, -0.46, 0.955, 0); // 左
      addBox(g, body, 0.08, rail, 1, 0.46, 0.955, 0); // 右
      addBox(g, body, 0.1, rail, 1, 0, 0.955, 0); // 中桟
      const basin = stdMat('#8d959b', { roughness: 0.22, metalness: 0.65 });
      for (const x of [-0.24, 0.24]) {
        addBox(g, basin, 0.36, 0.42, 0.6, x, 0.66, 0); // 槽
      }
      addBox(g, body, 1, 0.3, 0.08, 0, 1.05, -0.46); // バックガード
      addCyl(g, metal, 0.028, 0.24, 0, 1.08, -0.38); // 水栓
      addBox(g, metal, 0.05, 0.03, 0.26, 0, 1.18, -0.28);
      addBox(g, body, 0.94, 0.04, 0.86, 0, 0.24, 0); // 中棚
      for (const [x, z] of [[-0.45, -0.42], [0.45, -0.42], [-0.45, 0.42], [0.45, 0.42]]) {
        addBox(g, metal, 0.05, 0.92, 0.05, x, 0.46, z);
      }
      break;
    }
    case 'gasrange': {
      addBox(g, body, 1, 0.9, 1, 0, 0.45, 0);
      addBox(g, dark, 1.02, 0.06, 1.02, 0, 0.93, 0); // 天板
      for (const [x, z] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]]) {
        addCyl(g, stdMat('#26292d', { roughness: 0.6 }), 0.13, 0.03, x, 0.97, z); // 五徳
        addCyl(g, metal, 0.05, 0.05, x, 0.99, z); // バーナー
      }
      addBox(g, dark, 0.86, 0.34, 0.04, 0, 0.36, 0.5); // グリル扉
      addBox(g, metal, 0.6, 0.04, 0.05, 0, 0.5, 0.53);
      break;
    }
    case 'hood': {
      // 逆台形のフード＋ダクト
      addBox(g, body, 1, 0.5, 1, 0, 0.25, 0);
      addBox(g, body, 0.82, 0.3, 0.82, 0, 0.62, 0);
      addBox(g, dark, 0.94, 0.05, 0.94, 0, 0.03, 0); // グリスフィルタ枠
      addBox(g, stdMat('#8d959b', { roughness: 0.4, metalness: 0.5 }), 0.8, 0.03, 0.8, 0, 0.05, 0);
      addBox(g, body, 0.34, 0.24, 0.34, 0, 0.88, -0.16); // ダクト
      break;
    }
    case 'reachin': {
      addBox(g, body, 1, 0.94, 1, 0, 0.52, 0);
      for (const x of [-0.25, 0.25]) {
        addBox(g, dark, 0.46, 0.86, 0.04, x, 0.54, 0.5);
        addBox(g, metal, 0.03, 0.44, 0.06, x + (x < 0 ? 0.19 : -0.19), 0.6, 0.53); // 取っ手
      }
      addBox(g, dark, 1.02, 0.06, 1.02, 0, 0.97, 0);
      for (const [x, z] of [[-0.44, -0.42], [0.44, -0.42], [-0.44, 0.42], [0.44, 0.42]]) {
        addBox(g, metal, 0.05, 0.06, 0.05, x, 0.03, z); // 脚
      }
      break;
    }
    case 'rack': {
      for (const [x, z] of [[-0.46, -0.42], [0.46, -0.42], [-0.46, 0.42], [0.46, 0.42]]) {
        addBox(g, metal, 0.05, 1, 0.05, x, 0.5, z);
      }
      for (let i = 0; i < 4; i++) {
        addBox(g, body, 0.98, 0.025, 0.94, 0, 0.06 + i * 0.31, 0);
      }
      break;
    }
    case 'dishwasher': {
      addBox(g, body, 1, 1, 1, 0, 0.5, 0);
      addBox(g, dark, 0.86, 0.56, 0.04, 0, 0.44, 0.5); // 扉
      addBox(g, metal, 0.66, 0.05, 0.06, 0, 0.76, 0.53); // ハンドル
      addBox(g, stdMat('#2a2d31', { roughness: 0.3 }), 0.24, 0.1, 0.04, 0.28, 0.88, 0.5); // 操作部
      break;
    }
    case 'microwave': {
      addBox(g, body, 1, 1, 1, 0, 0.5, 0);
      addBox(g, stdMat('#23262a', { roughness: 0.2 }), 0.6, 0.72, 0.04, -0.14, 0.52, 0.5); // 窓
      addBox(g, dark, 0.22, 0.84, 0.04, 0.36, 0.5, 0.5); // 操作パネル
      break;
    }
    case 'hotplate': {
      addBox(g, dark, 1, 0.55, 1, 0, 0.27, 0);
      addBox(g, stdMat('#33383d', { roughness: 0.35, metalness: 0.35 }), 0.86, 0.4, 0.84, 0, 0.75, 0);
      break;
    }
    case 'ventfan': {
      addBox(g, body, 1, 1, 1, 0, 0.5, 0); // 枠
      const disc = addCyl(g, stdMat('#3a3f45', { roughness: 0.6 }), 0.4, 0.12, 0, 0.5, 0.28);
      disc.rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) {
        const blade = addBox(g, metal, 0.6, 0.16, 0.03, 0, 0.5, 0.34);
        blade.rotation.z = (i * Math.PI) / 4;
      }
      addCyl(g, metal, 0.06, 0.1, 0, 0.5, 0.36).rotation.x = Math.PI / 2;
      break;
    }
    default: {
      addBox(g, body, 1, 1, 1, 0, 0.5, 0);
    }
  }

  return g;
}

/** グループ内の「本体色」マテリアルを塗り替える */
export function tintFixture(group, color) {
  const c = new THREE.Color(color);
  const list = group.userData.tint || [];
  if (list[0]) list[0].color.copy(c);
  if (list[1]) list[1].color.copy(c.clone().multiplyScalar(0.62));
}

/** グループが持つマテリアル/複製テクスチャを破棄（共有ジオメトリは残す） */
export function disposeFixture(group) {
  for (const t of group.userData.deck?.maps || []) t.dispose();
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m.dispose();
    }
  });
}
