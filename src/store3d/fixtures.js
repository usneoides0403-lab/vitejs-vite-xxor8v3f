import * as THREE from 'three';

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
  { type: 'shelf',    label: 'ゴンドラ棚',   emoji: '🗄️', w: 1.2, d: 0.6, h: 1.8, color: '#c9ced6' },
  { type: 'endcap',   label: 'エンド平台',   emoji: '🧺', w: 1.2, d: 0.9, h: 0.9, color: '#d9c49a' },
  { type: 'fridge',   label: '冷蔵ケース',   emoji: '🥤', w: 1.8, d: 0.8, h: 2.0, color: '#a9b6bf' },
  { type: 'freezer',  label: '冷凍平ケース', emoji: '🍨', w: 1.6, d: 0.9, h: 0.9, color: '#b6ccd6' },
  { type: 'register', label: 'レジ',         emoji: '💳', w: 1.4, d: 0.8, h: 1.0, color: '#e0cf9b' },
  { type: 'counter',  label: 'カウンター',   emoji: '🧾', w: 2.0, d: 0.7, h: 1.0, color: '#c9ab7d' },
  { type: 'table',    label: 'イートイン席', emoji: '🍽️', w: 1.2, d: 0.8, h: 0.75, color: '#c08f5e' },
  { type: 'basket',   label: 'カゴ置き場',   emoji: '🛒', w: 0.6, d: 0.8, h: 0.9, color: '#7fa8d9' },
  { type: 'plant',    label: '観葉植物',     emoji: '🪴', w: 0.7, d: 0.7, h: 1.4, color: '#4f9e57' },
  { type: 'pillar',   label: '柱',           emoji: '🏛️', w: 0.45, d: 0.45, h: 3.0, color: '#d5d5d8' },
  { type: 'wall',     label: '間仕切り',     emoji: '🧱', w: 2.0, d: 0.15, h: 2.2, color: '#d3d1cb' },
  { type: 'door',     label: '入口',         emoji: '🚪', w: 1.6, d: 0.25, h: 2.2, color: '#8fd0a8' },
  { type: 'sign',     label: '看板 / POP',   emoji: '🪧', w: 0.9, d: 0.12, h: 1.7, color: '#e8a13c' },
];

export const CATALOG_BY_TYPE = Object.fromEntries(
  CATALOG.map((c) => [c.type, c])
);

const GOODS_COLORS = [
  '#e5624a', '#f0a23c', '#f2d05a', '#79b45b',
  '#4aa3c7', '#7d6bc4', '#d95f9a', '#e8e2d4',
];

function stdMat(color, extra) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.85,
    metalness: 0.05,
    ...extra,
  });
}

function glassMat() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cfeaf7'),
    roughness: 0.08,
    metalness: 0.0,
    transparent: true,
    opacity: 0.3,
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
      stdMat(c, { roughness: 0.6 }),
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
  const body = stdMat(color);
  const dark = stdMat(new THREE.Color(color).multiplyScalar(0.62));
  const metal = stdMat('#9aa1a8', { roughness: 0.45, metalness: 0.35 });
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
      addBox(g, stdMat('#fff6d8', { emissive: '#fff2c9', emissiveIntensity: 0.6 }), 0.9, 0.03, 0.06, 0, 0.96, 0.44);
      break;
    }
    case 'freezer': {
      addBox(g, body, 1, 0.9, 1, 0, 0.45, 0);
      addBox(g, dark, 0.92, 0.06, 0.92, 0, 0.78, 0);
      addBox(g, stdMat('#dff1f7', { roughness: 0.3 }), 0.86, 0.02, 0.86, 0, 0.82, 0);
      addBox(g, dark, 1.02, 0.08, 1.02, 0, 0.96, 0);
      break;
    }
    case 'register': {
      addBox(g, body, 1, 0.85, 1, 0, 0.425, 0);
      addBox(g, dark, 1.06, 0.06, 1.06, 0, 0.88, 0);
      addBox(g, stdMat('#3a3f46'), 0.34, 0.26, 0.05, -0.2, 1.04, -0.05); // モニタ
      addBox(g, metal, 0.06, 0.12, 0.06, -0.2, 0.94, -0.05);
      addBox(g, stdMat('#5a6068'), 0.26, 0.06, 0.2, 0.24, 0.94, 0); // ドロア
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
      addCyl(g, stdMat('#a8674a'), 0.28, 0.3, 0, 0.15, 0);
      addCyl(g, stdMat('#4a3b2f'), 0.05, 0.35, 0, 0.42, 0);
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
      addBox(g, stdMat('#ffffff'), 0.84, 0.3, 0.2, 0, 0.79, 0.42);
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

/** グループが持つジオメトリ/マテリアルを破棄（共有ジオメトリは残す） */
export function disposeFixture(group) {
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m.dispose();
    }
  });
}
