# 買い物リスト / 店内レイアウト3D

React + Vite のアプリです。上部のタブで2つの画面を切り替えます。

- **🛒 買い物リスト** … 商品の追加・チェック・並び替え（従来からの機能）
- **🏬 店内レイアウト** … 店内を自由にレイアウトできる3Dモデル（three.js）

## 店内レイアウト3D の使い方

| できること | 操作 |
| --- | --- |
| 什器を置く | 右（スマホは下）の「什器を追加」からタップ。棚・冷蔵ケース・レジ・イートイン席など13種類 |
| 動かす | 3D画面で什器を**ドラッグ**。グリッド吸着（自由 / 10 / 25 / 50cm）で通路幅もそろう |
| 向き・大きさ・色 | 什器を選ぶと「選択中」タブでサイズ(m)・角度・色・名前を変更 |
| 視点 | **俯瞰**（回して眺める） / **真上**（間取り図のように編集） / **店内**（一人称で歩く） |
| 店内を歩く | 「店内」でドラッグして見回し、WASD・矢印キー・画面のパッドで移動。什器と壁には当たり判定あり |
| 店の広さ | 「店の広さ」タブで幅・奥行・天井高を変更。テンプレート（コンビニ風 / スーパー風 / 空の店）も読み込める |
| 保存 | 端末に自動保存。JSON / PNG での書き出しと、JSON の読み込みに対応 |

ショートカット: `R` 回転 / 矢印キー 微調整 / `Delete` 削除 / `Ctrl+D` 複製 / `Ctrl+Z` 元に戻す / `Esc` 選択解除

## 開発

```bash
npm install
npm run dev     # 開発サーバ
npm run build   # 本番ビルド
npm run lint    # ESLint
```

3D画面は `React.lazy` で遅延読み込みしているため、買い物リストだけを使う場合は three.js を読み込みません。

### ソース構成

- `src/App.jsx` … 画面切り替え
- `src/ShoppingList.jsx` … 買い物リスト
- `src/store3d/StoreLayout3D.jsx` … 3Dレイアウト画面のUI・状態管理
- `src/store3d/scene.js` … three.js のシーン（カメラ操作・選択・ドラッグ・一人称移動）
- `src/store3d/fixtures.js` … 什器カタログとモデル生成
- `src/store3d/presets.js` … テンプレートと配置ヘルパー

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
