import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'mono-shopping-v3_2';
const DEFAULT_STORES = ['イオン', '業スー', 'ドラスト', 'コンビニ', 'その他'];
const DEFAULT_UNITS = ['個', '本', '袋', 'パック', 'g', 'ml'];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function safeParse(json, fallback) {
  try {
    return JSON.parse(json) ?? fallback;
  } catch {
    return fallback;
  }
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a8.6 8.6 0 0 0 .1-1l2-1.2-2-3.4-2.3.6a7.6 7.6 0 0 0-1.7-1l-.3-2.4H9l-.3 2.4a7.6 7.6 0 0 0-1.7 1l-2.3-.6-2 3.4 2 1.2a8.6 8.6 0 0 0 .1 1l-2 1.2 2 3.4 2.3-.6a7.6 7.6 0 0 0 1.7 1l.3 2.4h6.1l.3-2.4a7.6 7.6 0 0 0 1.7-1l2.3.6 2-3.4-2-1.2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M20 7L10 17l-5-5"
        stroke="#0b0b0c"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path
        d="M8 7h8M8 12h8M8 17h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function XIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ShoppingList() {
  // items: {id,name,qty,unit,store,checked,createdAt,order}
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState(DEFAULT_STORES);

  // input
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState('個');
  const [store, setStore] = useState('イオン');

  // settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sortMode, setSortMode] = useState('manual'); // manual | store | name | created

  // UI: 反映用（確定値）
  const [ui, setUi] = useState({ font: 18, inputH: 52, rowH: 54 });
  // UI: 入力中の文字列（途中は反映しない）
  const [uiDraft, setUiDraft] = useState({
    font: '18',
    inputH: '52',
    rowH: '54',
  });

  // 店追加（設定内）
  const [newStore, setNewStore] = useState('');

  const inputRef = useRef(null);

  // drag
  const listRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const dragState = useRef({ active: false });

  // load
  useEffect(() => {
    const saved = safeParse(localStorage.getItem(STORAGE_KEY) || '{}', {});
    if (Array.isArray(saved.items)) setItems(saved.items);
    if (Array.isArray(saved.stores)) setStores(saved.stores);
    if (saved.ui && typeof saved.ui === 'object') {
      const merged = { font: 18, inputH: 52, rowH: 54, ...saved.ui };
      setUi(merged);
      setUiDraft({
        font: String(merged.font),
        inputH: String(merged.inputH),
        rowH: String(merged.rowH),
      });
    }
    if (typeof saved.sortMode === 'string') setSortMode(saved.sortMode);
  }, []);

  // save
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items, stores, ui, sortMode })
    );
  }, [items, stores, ui, sortMode]);

  // apply css vars（確定値 ui のみ）
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--font', `${ui.font}px`);
    r.style.setProperty('--inputH', `${ui.inputH}px`);
    r.style.setProperty('--rowH', `${ui.rowH}px`);
  }, [ui]);

  // order を保証（手動順）
  useEffect(() => {
    setItems((prev) => {
      let changed = false;
      const withOrder = prev.map((x, idx) => {
        if (typeof x.order !== 'number') {
          changed = true;
          return { ...x, order: prev.length - idx };
        }
        return x;
      });
      return changed ? withOrder : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((x) => x.checked).length;
    return { total, done, left: total - done };
  }, [items]);

  const display = useMemo(() => {
    const copy = [...items];

    // 未購入→購入済 は常に優先
    const base = (a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return 0;
    };

    const cmpName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ja');
    const cmpStore = (a, b) =>
      (a.store || '').localeCompare(b.store || '', 'ja');

    copy.sort((a, b) => {
      const p = base(a, b);
      if (p !== 0) return p;

      if (sortMode === 'store') {
        const s = cmpStore(a, b);
        if (s !== 0) return s;
        return cmpName(a, b);
      }
      if (sortMode === 'name') return cmpName(a, b);
      if (sortMode === 'created')
        return (b.createdAt || 0) - (a.createdAt || 0);

      // manual
      return (b.order || 0) - (a.order || 0);
    });

    return copy;
  }, [items, sortMode]);

  function addItem() {
    const n = name.trim();
    if (!n) return;

    const q = Number(qty) || 1;
    const u = (unit || '個').trim();
    const s = (store || 'その他').trim();

    const maxOrder = items.reduce((m, x) => Math.max(m, x.order || 0), 0);

    const newItem = {
      id: uid(),
      name: n,
      qty: q,
      unit: u,
      store: s,
      checked: false,
      createdAt: Date.now(),
      order: maxOrder + 1,
    };

    setItems((prev) => [newItem, ...prev]);
    setName('');
    setQty(1);
    setUnit('個');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function toggle(id) {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, checked: !x.checked } : x))
    );
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  function clearDone() {
    setItems((prev) => prev.filter((x) => !x.checked));
  }

  function resetAll() {
    setItems([]);
  }

  // 店追加/削除（設定内）
  function addStore() {
    const s = newStore.trim();
    if (!s) return;
    if (!stores.includes(s)) setStores((prev) => [s, ...prev]);
    setStore(s);
    setNewStore('');
  }

  function deleteStore(s) {
    if (s === 'その他') return;
    // その店を使ってる商品は「その他」に退避
    setItems((prev) =>
      prev.map((x) => (x.store === s ? { ...x, store: 'その他' } : x))
    );
    setStores((prev) => prev.filter((x) => x !== s));
    if (store === s) setStore('その他');
  }

  // ===== ドラッグ並び替え（グリップ長押し→ドラッグ） =====
  function onGripPointerDown(e, id) {
    if (sortMode !== 'manual') setSortMode('manual');

    e.preventDefault();
    e.stopPropagation();

    dragState.current.active = true;
    setDragId(id);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  }

  function onGripPointerMove(e) {
    if (!dragState.current.active || !dragId) return;

    const listEl = listRef.current;
    if (!listEl) return;

    const nodes = Array.from(listEl.querySelectorAll('[data-item-id]'));
    const draggingIndex = nodes.findIndex(
      (n) => n.getAttribute('data-item-id') === dragId
    );
    if (draggingIndex < 0) return;

    const y = e.clientY;

    let overIndex = draggingIndex;
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (y < mid) {
        overIndex = i;
        break;
      }
      overIndex = i;
    }
    if (overIndex === draggingIndex) return;

    setItems((prev) => {
      const prevMap = new Map(prev.map((x) => [x.id, x]));
      const overId = nodes[overIndex].getAttribute('data-item-id');
      const dragging = prevMap.get(dragId);
      const overItem = prevMap.get(overId);
      if (!dragging || !overItem) return prev;

      // 未購入/購入済の壁を越えない（誤操作防止）
      if (dragging.checked !== overItem.checked) return prev;

      // 現在のmanual表示順（未購入→購入済）
      const current = [...prev].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        return (b.order || 0) - (a.order || 0);
      });

      const from = current.findIndex((x) => x.id === dragId);
      const to = current.findIndex((x) => x.id === overId);
      if (from < 0 || to < 0) return prev;

      const moved = current.splice(from, 1)[0];
      current.splice(to, 0, moved);

      // order を振り直し（未購入/購入済それぞれ）
      const notDone = current.filter((x) => !x.checked);
      const done = current.filter((x) => x.checked);
      const renumber = (arr, base) =>
        arr.map((x, i) => ({ ...x, order: base + (arr.length - i) }));

      const notDone2 = renumber(notDone, 100000);
      const done2 = renumber(done, 0);

      const merged = [...notDone2, ...done2];
      const mergedMap = new Map(merged.map((x) => [x.id, x]));
      return prev.map((x) => mergedMap.get(x.id) || x);
    });
  }

  function onGripPointerUp(e) {
    dragState.current.active = false;
    setDragId(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  // ===== UI入力：改善（入力中はdraft、確定時にuiへ） =====
  function onDraftChange(key, v) {
    setUiDraft((p) => ({ ...p, [key]: v }));
  }

  function commitDraft(key, min, max) {
    const raw = uiDraft[key].trim();
    if (raw === '') {
      // 空なら元に戻す（勝手に端の値に飛ばさない）
      setUiDraft((p) => ({ ...p, [key]: String(ui[key]) }));
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) {
      setUiDraft((p) => ({ ...p, [key]: String(ui[key]) }));
      return;
    }
    const c = clamp(n, min, max);
    setUi((p) => ({ ...p, [key]: c }));
    setUiDraft((p) => ({ ...p, [key]: String(c) }));
  }

  function onDraftKeyDown(e, key, min, max) {
    if (e.key === 'Enter') {
      commitDraft(key, min, max);
      e.currentTarget.blur();
    }
  }

  return (
    <>
      <div className="container">
        <div className="header">
          <div className="titleBlock">
            <div className="titleRow">
              <div className="t">🛒 買い物リスト</div>
              <div className="sub">
                残り {stats.left} / 全 {stats.total}
              </div>
            </div>
          </div>

          {/* 歯車：右上・小さめ */}
          <button
            className="iconBtn"
            onClick={() => setSettingsOpen((v) => !v)}
            type="button"
            aria-label="settings"
            title="設定"
          >
            <GearIcon />
          </button>
        </div>

        <div className="card">
          {/* 入力：1行目 商品名フル / 2行目 数・単位・店・追加 */}
          <div className="addWrap">
            <input
              ref={inputRef}
              className="input"
              placeholder="例：卵、牛乳、バター…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
            />

            <div className="addLine2">
              <input
                className="input qtySmall"
                inputMode="numeric"
                pattern="[0-9]*"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />

              <select
                className="select unitMid"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {DEFAULT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <select
                className="select storeGrow"
                value={store}
                onChange={(e) => setStore(e.target.value)}
              >
                {stores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <button
                className="btn primary addBtn"
                onClick={addItem}
                type="button"
              >
                追加
              </button>
            </div>
          </div>

          {/* 設定（歯車） */}
          {settingsOpen ? (
            <div className="drawer">
              <div className="hr" />

              <div className="smallLabel">並び替え</div>
              <div className="row">
                <select
                  className="select"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                >
                  <option value="manual">手動（長押しドラッグ）</option>
                  <option value="store">店 → 名前</option>
                  <option value="name">名前（あいうえお）</option>
                  <option value="created">追加した順（新しい順）</option>
                </select>
              </div>

              <div className="hr" />
              <div className="smallLabel">
                表示サイズ（入力→確定で反映 / Enter or フォーカス外す）
              </div>
              <div className="row">
                <input
                  className="input"
                  style={{ width: 120 }}
                  inputMode="numeric"
                  placeholder="文字(px)"
                  value={uiDraft.font}
                  onChange={(e) => onDraftChange('font', e.target.value)}
                  onBlur={() => commitDraft('font', 12, 40)}
                  onKeyDown={(e) => onDraftKeyDown(e, 'font', 12, 40)}
                />
                <input
                  className="input"
                  style={{ width: 120 }}
                  inputMode="numeric"
                  placeholder="入力(px)"
                  value={uiDraft.inputH}
                  onChange={(e) => onDraftChange('inputH', e.target.value)}
                  onBlur={() => commitDraft('inputH', 40, 100)}
                  onKeyDown={(e) => onDraftKeyDown(e, 'inputH', 40, 100)}
                />
                <input
                  className="input"
                  style={{ width: 120 }}
                  inputMode="numeric"
                  placeholder="行(px)"
                  value={uiDraft.rowH}
                  onChange={(e) => onDraftChange('rowH', e.target.value)}
                  onBlur={() => commitDraft('rowH', 40, 120)}
                  onKeyDown={(e) => onDraftKeyDown(e, 'rowH', 40, 120)}
                />
              </div>

              <div className="hr" />
              <div className="smallLabel">店の追加 / 削除</div>
              <div className="row">
                <input
                  className="input"
                  placeholder="店を追加（例：コストコ）"
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addStore()}
                />
                <button className="btn" onClick={addStore} type="button">
                  追加
                </button>
              </div>

              <div className="row" style={{ alignItems: 'center' }}>
                {stores.map((s) => (
                  <div
                    key={s}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <div
                      className="smallLabel"
                      style={{ fontWeight: 900, color: 'var(--text)' }}
                    >
                      {s}
                    </div>
                    {s !== 'その他' ? (
                      <button
                        className="xBtn"
                        type="button"
                        onClick={() => deleteStore(s)}
                        aria-label={`delete store ${s}`}
                        title={`${s}を削除`}
                      >
                        <XIcon size={14} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="smallLabel" style={{ marginTop: 10 }}>
                ※ 店を削除すると、その店の商品は「その他」に移動します。
              </div>
            </div>
          ) : null}
        </div>

        {/* リスト */}
        <div className="list" ref={listRef}>
          {display.length === 0 ? (
            <div className="card" style={{ opacity: 0.9 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>空です</div>
              <div className="sub">上で追加してね</div>
            </div>
          ) : (
            display.map((it) => (
              <div
                key={it.id}
                className={'item' + (dragId === it.id ? ' dragging' : '')}
                data-item-id={it.id}
              >
                <div className="left">
                  <div
                    className="grip"
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => onGripPointerDown(e, it.id)}
                    onPointerMove={onGripPointerMove}
                    onPointerUp={onGripPointerUp}
                    onPointerCancel={onGripPointerUp}
                    aria-label="drag"
                    title="長押しして並び替え"
                  >
                    <GripIcon />
                  </div>

                  <div
                    className={'chk' + (it.checked ? ' on' : '')}
                    onClick={() => toggle(it.id)}
                    role="button"
                    tabIndex={0}
                    aria-label="check"
                  >
                    {it.checked ? <CheckIcon /> : null}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      className="name"
                      style={{
                        textDecoration: it.checked ? 'line-through' : 'none',
                        opacity: it.checked ? 0.7 : 1,
                      }}
                    >
                      {it.name}
                    </div>
                    <div className="meta">
                      {it.qty} {it.unit} ・ {it.store}
                    </div>
                  </div>
                </div>

                <div className="right">
                  <button
                    className="xBtn"
                    onClick={() => removeItem(it.id)}
                    type="button"
                    aria-label="delete item"
                    title="削除"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 下部ボタン */}
      <div className="footerBar">
        <div className="footerInner">
          <button
            className="btn"
            onClick={clearDone}
            type="button"
            style={{ flex: 1 }}
          >
            完了を削除
          </button>
          <button
            className="btn danger"
            onClick={resetAll}
            type="button"
            style={{ flex: 1 }}
          >
            全消去
          </button>
        </div>
      </div>
    </>
  );
}
