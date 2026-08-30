/**
 * 店内の写真から起こしたテクスチャ。
 *
 * 実際の写真を遠近補正して、照明のムラを落とし、端がつながるように
 * 加工したもの（作り方は tools/build-textures.py）。
 * scale はテクスチャ1枚が実寸で何メートル分かを表す。
 */
import tatamiC from './photos/tatami.jpg';
import tatamiN from './photos/tatami_n.jpg';
import woodC from './photos/wood.jpg';
import woodN from './photos/wood_n.jpg';
import darkwoodC from './photos/darkwood.jpg';
import darkwoodN from './photos/darkwood_n.jpg';
import concreteC from './photos/concrete.jpg';
import concreteN from './photos/concrete_n.jpg';
import metalC from './photos/metal.jpg';
import metalN from './photos/metal_n.jpg';
import panelC from './photos/panel.jpg';
import panelN from './photos/panel_n.jpg';
import jurakuC from './photos/juraku.jpg';
import jurakuN from './photos/juraku_n.jpg';
import woodgrainC from './photos/woodgrain.jpg';
import woodgrainN from './photos/woodgrain_n.jpg';

export const PHOTOS = {
  tatami: { color: tatamiC, normal: tatamiN, scale: 3.64, roughness: 0.88 },
  wood: { color: woodC, normal: woodN, scale: 1.2, roughness: 0.55 },
  darkwood: { color: darkwoodC, normal: darkwoodN, scale: 1.2, roughness: 0.3 },
  concrete: { color: concreteC, normal: concreteN, scale: 2.2, roughness: 0.92 },
  panel: { color: panelC, normal: panelN, scale: 1.6, roughness: 0.35 },
  juraku: { color: jurakuC, normal: jurakuN, scale: 1.8, roughness: 0.95 },
  // ステンレスは見た目が反射で決まるので、写真は凹凸（傷）だけに使い、
  // 下地の色はマテリアル側の明るいグレーをそのまま生かす
  metal: { color: metalC, normal: metalN, scale: 1.0, roughness: 0.3, bumpOnly: true },
  woodGrain: { color: woodgrainC, normal: woodgrainN, scale: 1.0, roughness: 0.6 },
};
