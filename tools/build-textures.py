"""店内の写真から、アプリで使うテクスチャ一式を作る。

  1. 写真の中の四角い面を指定して遠近補正（ホモグラフィ）
  2. 照明のムラを割り算で落として、素材の色だけにする
  3. 端がつながるように巡回ブレンドしてタイル化
  4. 明暗から法線マップを作る
  5. 畳は「写真の い草」を八畳敷きに並べ、縁（へり）を描いて合成する

使い方:
    SRC=/path/to/photos python3 tools/build-textures.py

SRC には元の店内写真（<名前>-image.jpg）を置く。写真そのものは
リポジトリには含めていないので、書き出し済みの src/store3d/photos/
を使う場合はこのスクリプトを実行する必要はない。
"""
import os
import numpy as np
from PIL import Image

UP = os.environ.get("SRC", os.path.join(os.path.dirname(__file__), "photos-src"))
DEST = os.path.join(os.path.dirname(__file__), "..", "src", "store3d", "photos")
os.makedirs(DEST, exist_ok=True)



def homography(src, dst):
    """src(4点) -> dst(4点) の射影変換行列"""
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    A = np.array(A, dtype=np.float64)
    b = np.array([c for p in dst for c in p], dtype=np.float64)
    h = np.linalg.solve(A, b)
    return np.append(h, 1).reshape(3, 3)


def warp(im, quad, size):
    """quad（左上→右上→右下→左下）を size 角の正方形へ起こす"""
    arr = np.asarray(im, dtype=np.float32)
    H, W = arr.shape[:2]
    dst = [(0, 0), (size, 0), (size, size), (0, size)]
    M = np.linalg.inv(homography(quad, dst))
    ys, xs = np.mgrid[0:size, 0:size]
    p = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5, np.ones(size * size)])
    q = M @ p
    sx = (q[0] / q[2]).reshape(size, size)
    sy = (q[1] / q[2]).reshape(size, size)
    sx = np.clip(sx, 0, W - 1.001)
    sy = np.clip(sy, 0, H - 1.001)
    x0, y0 = np.floor(sx).astype(int), np.floor(sy).astype(int)
    fx, fy = (sx - x0)[..., None], (sy - y0)[..., None]
    out = (
        arr[y0, x0] * (1 - fx) * (1 - fy)
        + arr[y0, x0 + 1] * fx * (1 - fy)
        + arr[y0 + 1, x0] * (1 - fx) * fy
        + arr[y0 + 1, x0 + 1] * fx * fy
    )
    return out


def box_blur(a, r):
    """巡回する箱ぼかし（3回でガウスの代わり）"""
    out = a.astype(np.float32)
    for _ in range(3):
        k = 2 * r + 1
        c = np.cumsum(np.pad(out, ((r + 1, r), (0, 0), (0, 0)), mode="wrap"), axis=0)
        out = (c[k:] - c[:-k]) / k
        c = np.cumsum(np.pad(out, ((0, 0), (r + 1, r), (0, 0)), mode="wrap"), axis=1)
        out = (c[:, k:] - c[:, :-k]) / k
    return out


def flatten(a, r=None):
    """照明のムラ（低周波）を割って素材の色だけ残す"""
    r = r or max(4, a.shape[0] // 8)
    low = box_blur(a, r)
    mean = low.mean(axis=(0, 1), keepdims=True)
    return np.clip(a / np.maximum(low, 1e-3) * mean, 0, 255)


def tileable(a):
    """端がつながるように、半分ずらした自分自身と混ぜる"""
    n = a.shape[0]
    rolled = np.roll(np.roll(a, n // 2, 0), n // 2, 1)
    t = np.arange(n) / n
    w = (0.5 - 0.5 * np.cos(2 * np.pi * t)) ** 0.8
    w2 = (w[:, None] * w[None, :])[..., None]
    return a * w2 + rolled * (1 - w2)


def normal_map(a, strength=2.4):
    """明暗の凹凸から法線マップを作る"""
    lum = a.mean(axis=2)
    lum = lum - box_blur(lum[..., None], max(2, a.shape[0] // 24))[..., 0]
    lum = lum / max(1e-3, np.abs(lum).max())
    dx = (np.roll(lum, -1, 1) - np.roll(lum, 1, 1)) * strength
    dy = (np.roll(lum, -1, 0) - np.roll(lum, 1, 0)) * strength
    ln = np.sqrt(dx * dx + dy * dy + 1)
    return np.stack([(-dx / ln * 0.5 + 0.5), (-dy / ln * 0.5 + 0.5), (1 / ln * 0.5 + 0.5)], -1) * 255


def build(spec):
    im = Image.open(f"{UP}/{spec['src']}-image.jpg").convert("RGB")
    a = warp(im, spec["quad"], spec["size"])
    if spec.get("flatten", True):
        a = flatten(a, spec.get("flatR"))
    gain = spec.get("gain", 1.0)
    a = np.clip((a - 128) * spec.get("contrast", 1.0) + 128 * gain, 0, 255)
    a = tileable(a)
    Image.fromarray(a.astype(np.uint8)).save(f"{OUT}/{spec['name']}.jpg", quality=88)
    n = normal_map(a, spec.get("bump", 2.4))
    Image.fromarray(n.astype(np.uint8)).save(f"{OUT}/{spec['name']}_n.jpg", quality=88)
    return spec["name"]




def save(name, arr, bump):
    arr = np.clip(arr, 0, 255)
    Image.fromarray(arr.astype(np.uint8)).save(f"{DEST}/{name}.jpg", quality=88)
    n = normal_map(arr, bump)
    nim = Image.fromarray(n.astype(np.uint8))
    if nim.width > 512:  # 法線は半分の解像度で十分
        nim = nim.resize((512, 512), Image.LANCZOS)
    nim.save(f"{DEST}/{name}_n.jpg", quality=82)
    kb = (os.path.getsize(f"{DEST}/{name}.jpg") + os.path.getsize(f"{DEST}/{name}_n.jpg")) // 1024
    print(f"  {name}: {kb} KB")


def extract(src, quad, size, flatR=None, contrast=1.0, gain=1.0):
    im = Image.open(f"{UP}/{src}-image.jpg").convert("RGB")
    a = warp(im, quad, size)
    a = flatten(a, flatR)
    a = np.clip((a - 128) * contrast + 128 * gain, 0, 255)
    return tileable(a)


print("写真から切り出し")
face = extract("e2a75421", [[20, 2150], [760, 2200], [820, 2900], [0, 2800]], 512)
wood = extract("52708fdc", [[2600, 2500], [3900, 2500], [3900, 2990], [2600, 2990]], 512)
concrete = extract("46c2e2d2", [[1467, 1556], [2000, 1556], [2667, 2978], [1200, 2978]], 512)
metal = extract("f7e62f0f", [[150, 2400], [1700, 2300], [1850, 2850], [100, 2950]], 512, flatR=24)
panel = extract("f7e62f0f", [[300, 120], [900, 120], [900, 620], [300, 620]], 512)
juraku = extract("e2a75421", [[3560, 300], [3960, 300], [3960, 1300], [3560, 1300]], 512)

save("wood", wood, 2.0)
save("concrete", concrete, 1.4)
save("metal", metal, 0.7)
save("panel", panel, 1.0)
save("juraku", juraku, 1.2)

print("木目から派生")
# 濃色の板張り：同じ木目を濃く着色する
lum_w = (wood / 255.0).mean(axis=2, keepdims=True)
stain = np.array([0.34, 0.20, 0.145])   # 濃い茶（拭き漆）
dark = 255 * (0.30 + 0.70 * lum_w ** 1.5) * stain * 2.3
save("darkwood", np.clip(dark, 0, 255), 2.0)

# 什器の木部：色を乗せられるよう明度だけにする
lum = wood.mean(axis=2, keepdims=True)
grain = np.clip(lum / max(1.0, lum.mean()) * 232, 120, 255).repeat(3, axis=2)
save("woodgrain", grain, 1.6)

print("畳を敷き込み（写真の い草 ＋ 八畳敷き）")
N = 1024                      # 3.64m 角
PX = N / 3.64                 # 1m あたりのピクセル
tat = np.zeros((N, N, 3), np.float32)
fh, fw = face.shape[:2]
face_v = face                       # 縦向きの畳（い草の目が横）
face_h = np.rot90(face, 1)          # 横向きの畳

def fill(dstY, dstX, h, w, src):
    """src を敷き詰めて (dstY,dstX) から h×w を埋める"""
    sh, sw = src.shape[:2]
    for y in range(dstY, dstY + h, sh):
        for x in range(dstX, dstX + w, sw):
            hh = min(sh, dstY + h - y)
            ww = min(sw, dstX + w - x)
            tat[y:y + hh, x:x + ww] = src[:hh, :ww]

half = N // 2
for qy in range(2):
    for qx in range(2):
        vertical = (qx + qy) % 2 == 0
        y0, x0 = qy * half, qx * half
        fill(y0, x0, half, half, face_v if vertical else face_h)

# 縁（へり）と畳の合わせ目を、畳1枚ずつに描く
heri = np.array([0.20, 0.31, 0.26]) * 255   # 藍がかった深い緑
seam = np.array([0.33, 0.31, 0.24]) * 255
hw = max(7, int(0.036 * PX))                # 縁の幅 3.6cm

def band(y0, y1, x0, x1, color, blend=1.0):
    y0, y1 = max(0, y0), min(N, y1)
    x0, x1 = max(0, x0), min(N, x1)
    if y1 <= y0 or x1 <= x0:
        return
    tat[y0:y1, x0:x1] = tat[y0:y1, x0:x1] * (1 - blend) + color * blend

matS = half // 2  # 畳の短辺（0.91m）
for qy in range(2):
    for qx in range(2):
        vertical = (qx + qy) % 2 == 0
        y0, x0 = qy * half, qx * half
        for m in range(2):  # 四半分に畳2枚
            if vertical:
                mx = x0 + m * matS
                band(y0, y0 + half, mx, mx + hw, heri)                    # 長辺（左）
                band(y0, y0 + half, mx + matS - hw, mx + matS, heri)      # 長辺（右）
                band(y0, y0 + 3, mx, mx + matS, seam, 0.75)               # 短辺
                band(y0 + half - 3, y0 + half, mx, mx + matS, seam, 0.75)
            else:
                my = y0 + m * matS
                band(my, my + hw, x0, x0 + half, heri)
                band(my + matS - hw, my + matS, x0, x0 + half, heri)
                band(my, my + matS, x0, x0 + 3, seam, 0.75)
                band(my, my + matS, x0 + half - 3, x0 + half, seam, 0.75)

save("tatami", tat, 1.8)

print("done ->", DEST)
