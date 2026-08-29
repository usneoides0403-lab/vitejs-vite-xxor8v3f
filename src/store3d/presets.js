import { CATALOG_BY_TYPE } from './fixtures.js';

export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/** カタログの既定値を使って什器を1つ作る */
export function makeItem(type, patch = {}) {
  const base = CATALOG_BY_TYPE[type] || CATALOG_BY_TYPE.shelf;
  return {
    id: uid(),
    type,
    name: base.label,
    x: 0,
    z: 0,
    y: base.y || 0,
    rotY: 0,
    w: base.w,
    d: base.d,
    h: base.h,
    color: base.color,
    ...patch,
  };
}

function row(type, xs, z, patch = {}) {
  return xs.map((x) => makeItem(type, { x, z, ...patch }));
}

export const PRESETS = {
  empty: {
    label: 'から（空の店）',
    build: () => ({
      room: { w: 10, d: 8, h: 3, floor: 'wood' },
      items: [
        makeItem('door', { x: 0, z: 3.9, name: '入口' }),
      ],
    }),
  },

  konbini: {
    label: 'コンビニ風',
    build: () => ({
      room: { w: 12, d: 9, h: 3, floor: 'tile' },
      items: [
        makeItem('door', { x: -3.5, z: 4.38, name: '入口' }),
        makeItem('sign', { x: -1.5, z: 4.0, name: 'のぼり' }),
        makeItem('basket', { x: -5.4, z: 3.6, name: 'カゴ' }),

        ...row('fridge', [-4.5, -2.7, -0.9, 0.9], -4.0, { name: '冷蔵ケース' }),
        makeItem('freezer', { x: 3.4, z: -3.8, name: 'アイス' }),
        makeItem('freezer', { x: 5.0, z: -3.8, name: '冷凍食品' }),

        ...row('shelf', [-3.6, -2.4, -1.2, 0, 1.2], -1.6, { name: 'お菓子' }),
        ...row('shelf', [-3.6, -2.4, -1.2, 0, 1.2], 0.4, { name: '日用品' }),
        makeItem('endcap', { x: 2.2, z: -1.6, name: 'エンド' }),
        makeItem('endcap', { x: 2.2, z: 0.4, name: 'エンド' }),

        makeItem('register', { x: 3.6, z: 3.0, name: 'レジ1' }),
        makeItem('counter', { x: 5.0, z: 3.0, name: 'カウンター' }),

        makeItem('table', { x: -5.1, z: 0.2, rotY: 90, name: 'イートイン' }),
        makeItem('table', { x: -5.1, z: 2.0, rotY: 90, name: 'イートイン' }),
        makeItem('plant', { x: 5.4, z: 4.0, name: '観葉植物' }),
      ],
    }),
  },

  washoku: {
    label: '和食店風',
    build: () => ({
      room: { w: 13, d: 11, h: 3, floor: 'wood' },
      items: [
        // --- 縁側と座敷 ---
        makeItem('engawa', { x: -1.2, z: -5.0, w: 8.0, d: 0.9, name: '縁側' }),
        ...row('sliding', [-3.4, -1.4, 0.6], -4.45, { name: '引戸' }),

        makeItem('zashiki', { x: -1.2, z: -3.0, w: 8.0, d: 2.6, name: '座敷' }),
        makeItem('lowtable', { x: -3.6, z: -3.0, y: 0.4, name: '座卓' }),
        makeItem('lowtable', { x: -1.2, z: -3.0, y: 0.4, name: '座卓' }),
        makeItem('lowtable', { x: 1.2, z: -3.0, y: 0.4, name: '座卓' }),

        ...row('sliding', [-3.4, -0.4], -1.6, { name: '引戸' }),

        makeItem('zashiki', { x: -1.2, z: -0.2, w: 8.0, d: 2.6, name: '座敷' }),
        makeItem('lowtable', { x: -3.0, z: -0.2, y: 0.4, w: 2.4, d: 1.0, name: '大テーブル' }),
        makeItem('irori', { x: 1.2, z: -0.2, y: 0.4, name: 'いろり' }),

        makeItem('rack', { x: -5.9, z: -4.6, rotY: 90, name: '物置' }),

        // --- 厨房（間仕切りの奥。中央を通路にする） ---
        makeItem('wall', { x: 2.9, z: -4.4, rotY: 90, w: 2.2, h: 2.6, name: '厨房壁' }),
        makeItem('wall', { x: 2.9, z: -1.2, rotY: 90, w: 1.8, h: 2.6, name: '厨房壁' }),

        makeItem('rack', { x: 3.6, z: -5.1, name: '棚' }),
        makeItem('microwave', { x: 3.3, z: -5.05, y: 0.95, name: '電子レンジ' }),
        makeItem('dishwasher', { x: 4.4, z: -5.05, name: '食洗器' }),
        makeItem('reachin', { x: 3.5, z: -3.9, rotY: 90, name: '冷蔵庫' }),
        makeItem('handwash', { x: 3.35, z: -2.7, rotY: 90, name: '手洗い' }),
        makeItem('freezer', { x: 5.1, z: -4.9, name: '冷凍庫' }),
        makeItem('worktable', { x: 5.1, z: -3.3, w: 1.6, d: 0.9, name: '作業台' }),
        makeItem('hotplate', { x: 4.7, z: -3.3, y: 0.85, name: 'ホットプレート' }),
        makeItem('gasrange', { x: 6.0, z: -4.6, rotY: 90, name: 'コンロ' }),
        makeItem('hood', { x: 6.0, z: -4.6, rotY: 90, y: 1.6, name: 'レンジフード' }),
        makeItem('sink', { x: 6.0, z: -3.1, rotY: 90, name: 'シンク' }),
        makeItem('sink', { x: 6.0, z: -1.7, rotY: 90, w: 1.2, name: 'シンク' }),
        makeItem('ventfan', { x: 5.4, z: -5.35, y: 2.0, name: '換気扇' }),
        makeItem('rack', { x: 6.1, z: -0.7, rotY: 90, name: '棚' }),

        // --- レジ・水まわり ---
        makeItem('register', { x: 2.2, z: 1.9, name: 'レジ' }),
        makeItem('handwash', { x: 3.4, z: 2.2, rotY: 90, name: '手洗い' }),
        makeItem('wall', { x: 4.4, z: 2.6, rotY: 90, w: 3.6, h: 2.4, name: '仕切り' }),
        makeItem('wall', { x: 5.4, z: 2.5, w: 1.8, h: 2.4, name: '仕切り' }),
        makeItem('door', { x: 4.4, z: 1.6, rotY: 90, w: 0.8, h: 2.0, name: 'ドア' }),
        makeItem('door', { x: 4.4, z: 3.4, rotY: 90, w: 0.8, h: 2.0, name: 'ドア' }),
        makeItem('toilet', { x: 5.4, z: 1.6, name: 'トイレ' }),
        makeItem('toilet', { x: 5.4, z: 3.5, rotY: 180, name: 'トイレ' }),

        // --- テーブル席と出入口 ---
        makeItem('table', { x: -4.4, z: 2.8, name: 'テーブル席' }),
        makeItem('table', { x: -1.6, z: 2.8, name: 'テーブル席' }),
        makeItem('door', { x: 0.4, z: 5.35, name: '出入口' }),
        makeItem('sign', { x: 2.4, z: 4.7, name: '看板' }),
        makeItem('plant', { x: -5.9, z: 4.8, name: '観葉植物' }),
      ],
    }),
  },

  super: {
    label: 'スーパー風',
    build: () => ({
      room: { w: 18, d: 13, h: 3.4, floor: 'tile' },
      items: [
        makeItem('door', { x: -6.5, z: 6.38, name: '入口' }),
        makeItem('door', { x: 6.5, z: 6.38, name: '出口' }),
        makeItem('basket', { x: -8.2, z: 5.4, name: 'カゴ / カート' }),

        ...row('fridge', [-7.2, -5.4, -3.6, -1.8, 0, 1.8], -6.0, { name: '精肉・鮮魚' }),
        ...row('freezer', [4.2, 5.9, 7.6], -5.6, { name: '冷凍' }),

        ...row('shelf', [-6.5, -5.3, -4.1, -2.9, -1.7, -0.5, 0.7], -3.0, { name: '青果' }),
        ...row('shelf', [-6.5, -5.3, -4.1, -2.9, -1.7, -0.5, 0.7], -0.6, { name: '加工食品' }),
        ...row('shelf', [-6.5, -5.3, -4.1, -2.9, -1.7, -0.5, 0.7], 1.8, { name: '飲料' }),
        ...row('shelf', [5.0, 6.2, 7.4], -2.4, { rotY: 90, name: '日用品' }),
        ...row('shelf', [5.0, 6.2, 7.4], 0.6, { rotY: 90, name: '雑貨' }),

        makeItem('endcap', { x: 2.4, z: -3.0, name: '特売' }),
        makeItem('endcap', { x: 2.4, z: -0.6, name: '特売' }),
        makeItem('endcap', { x: 2.4, z: 1.8, name: '特売' }),

        ...row('register', [-4.0, -2.0, 0, 2.0], 4.4, { name: 'レジ' }),
        makeItem('counter', { x: 4.6, z: 4.4, name: 'サービス' }),

        makeItem('pillar', { x: -3.0, z: 3.0, name: '柱' }),
        makeItem('pillar', { x: 3.0, z: 3.0, name: '柱' }),
        makeItem('plant', { x: 8.2, z: 5.6, name: '観葉植物' }),
        makeItem('sign', { x: -8.2, z: 3.4, name: '案内板' }),
      ],
    }),
  },
};

/** 什器どうしが重ならない位置を、中心から渦巻き状に探す */
export function findFreeSpot(doc, w, d) {
  const room = doc.room;
  const step = 0.5;
  const overlaps = (x, z) =>
    doc.items.some(
      (o) =>
        Math.abs(o.x - x) < (o.w + w) / 2 + 0.15 &&
        Math.abs(o.z - z) < (o.d + d) / 2 + 0.15
    );
  const fits = (x, z) =>
    Math.abs(x) + w / 2 <= room.w / 2 && Math.abs(z) + d / 2 <= room.d / 2;

  if (!overlaps(0, 0) && fits(0, 0)) return { x: 0, z: 0 };
  for (let ring = 1; ring < 60; ring++) {
    for (let i = -ring; i <= ring; i++) {
      const cands = [
        [i * step, -ring * step],
        [i * step, ring * step],
        [-ring * step, i * step],
        [ring * step, i * step],
      ];
      for (const [x, z] of cands) {
        if (fits(x, z) && !overlaps(x, z)) return { x, z };
      }
    }
  }
  return { x: 0, z: 0 };
}
