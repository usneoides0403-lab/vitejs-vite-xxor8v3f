import React, { useEffect, useState } from 'react';
import StoreLayout3D from './store3d/StoreLayout3D.jsx';

const HELP = [
  ['什器を置く', '右（スマホは下）の「什器を追加」から選ぶと、空いている場所に配置されます。'],
  ['動かす', '3D画面で什器をドラッグ。グリッド吸着を使うと通路幅をそろえられます。'],
  ['向き・大きさ・色', '什器を選び「選択中」タブでサイズ・角度・色・名前を変更します。'],
  ['台の上・頭上に置く', '「選択中」の「床から」に高さを入れると、レンジフードや電子レンジを台の上や頭上に置けます。'],
  ['視点を変える', '俯瞰（回して眺める）／真上（間取り図として編集）／店内（一人称で歩く）。'],
  ['店内を歩く', '「店内」でドラッグして見回し、WASD・矢印キー・画面のパッドで移動します。'],
  ['店の広さ・内装', '「店の広さ」タブで幅・奥行・天井高のほか、床材・壁材・天井を変更。テンプレートも読み込めます。'],
  ['照明・画質', '同じタブで昼／夜の照明を切り替え。画質「高」は陰影が付き、重いときは「標準」に戻せます。'],
  ['保存', 'この端末に自動保存されます。JSON / PNG での書き出しと JSON の読み込みに対応。'],
];

const KEYS = [
  ['R', '15°回転（Shift+R で逆回転）'],
  ['↑ ↓ ← →', '選択中の什器を微調整'],
  ['Delete', '削除'],
  ['Ctrl / ⌘ + D', '複製'],
  ['Ctrl / ⌘ + Z', '元に戻す（Shift 併用でやり直す）'],
  ['Esc', '選択を解除'],
];

function HelpSheet({ onClose }) {
  // 開いている間は 3D 側のショートカット（R / Delete / WASD など）を止める
  useEffect(() => {
    document.body.dataset.modal = 'open';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      delete document.body.dataset.modal;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="helpBackdrop" onClick={onClose}>
      <div
        className="helpSheet"
        role="dialog"
        aria-modal="true"
        aria-label="使い方"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="helpHead">
          <strong>使い方</strong>
          <button type="button" className="helpClose" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        <dl className="helpList">
          {HELP.map(([term, desc]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
        <div className="helpSub">キーボードショートカット</div>
        <ul className="helpKeys">
          {KEYS.map(([key, desc]) => (
            <li key={key}>
              <kbd>{key}</kbd>
              <span>{desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function App() {
  const [help, setHelp] = useState(false);

  return (
    <div className="appShell">
      <header className="appBar">
        <span className="appMark" aria-hidden="true">
          🏬
        </span>
        <div className="appTitles">
          <h1 className="appTitle">店内レイアウト3D</h1>
          <p className="appSub">棚もレジもドラッグで自由に配置できる店内3Dモデル</p>
        </div>
        <button type="button" className="appHelpBtn" onClick={() => setHelp(true)}>
          使い方
        </button>
      </header>

      <main className="appMain">
        <StoreLayout3D />
      </main>

      {help ? <HelpSheet onClose={() => setHelp(false)} /> : null}
    </div>
  );
}
