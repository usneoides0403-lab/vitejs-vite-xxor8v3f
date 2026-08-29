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
      room: { w: 10, d: 8, h: 3 },
      items: [
        makeItem('door', { x: 0, z: 3.9, name: '入口' }),
      ],
    }),
  },

  konbini: {
    label: 'コンビニ風',
    build: () => ({
      room: { w: 12, d: 9, h: 3 },
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

  super: {
    label: 'スーパー風',
    build: () => ({
      room: { w: 18, d: 13, h: 3.4 },
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
