import React, { Suspense, lazy, useState } from 'react';
import ShoppingList from './ShoppingList.jsx';

// 3D（three.js）は重いので、レイアウト画面を開いたときだけ読み込む
const StoreLayout3D = lazy(() => import('./store3d/StoreLayout3D.jsx'));

const VIEWS = [
  { id: 'list', label: '買い物リスト', emoji: '🛒' },
  { id: 'layout', label: '店内レイアウト', emoji: '🏬' },
];

export default function App() {
  const [view, setView] = useState('list');

  return (
    <div className="appShell">
      <nav className="viewSwitch">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={'viewTab' + (view === v.id ? ' on' : '')}
            onClick={() => setView(v.id)}
          >
            <span aria-hidden="true">{v.emoji}</span> {v.label}
          </button>
        ))}
      </nav>

      <main className={'viewArea' + (view === 'list' ? ' scroll' : '')}>
        {view === 'list' ? (
          <ShoppingList />
        ) : (
          <Suspense fallback={<div className="viewLoading">3Dを読み込み中…</div>}>
            <StoreLayout3D />
          </Suspense>
        )}
      </main>
    </div>
  );
}
