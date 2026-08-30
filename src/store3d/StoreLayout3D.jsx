import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StoreScene } from './scene.js';
import { CATALOG } from './fixtures.js';
import { PRESETS, makeItem, findFreeSpot } from './presets.js';
import { saveFile, dataUrlToBlob } from './saveFile.js';
import './store3d.css';

const STORAGE_KEY = 'store-layout-3d-v1';
const QUALITY_KEY = 'store-layout-3d-quality';

const COLORS = [
  '#c9ced6', '#a9b6bf', '#d9c49a', '#c9ab7d', '#e0cf9b',
  '#8fd0a8', '#7fa8d9', '#b98fd9', '#e08a8a', '#e8a13c',
];

const MODES = [
  { id: 'orbit', label: '俯瞰', emoji: '🧊' },
  { id: 'top', label: '真上', emoji: '🗺️' },
  { id: 'walk', label: '店内', emoji: '🚶' },
];

const HINTS = {
  orbit: '什器をドラッグで移動 / 何もない所をドラッグで視点回転 / ホイール・ピンチでズーム',
  top: '什器をドラッグで移動 / 何もない所をドラッグで地図を移動 / ホイール・ピンチでズーム',
  walk: 'ドラッグで見回す / WASD・矢印キー・右下のパッドで歩く',
};

/** カタログを分類ごとにまとめる */
const CATALOG_GROUPS = Object.entries(
  CATALOG.reduce((acc, c) => {
    const key = c.group || 'その他';
    (acc[key] = acc[key] || []).push(c);
    return acc;
  }, {})
);

const FLOORS = [
  { v: 'wood', label: '板張り' },
  { v: 'darkwood', label: '濃い板張り' },
  { v: 'tatami', label: '畳' },
  { v: 'tile', label: 'タイル' },
  { v: 'concrete', label: '土間' },
];

const WALLS = [
  { v: 'plaster', label: '白い塗り壁' },
  { v: 'juraku', label: '聚楽壁' },
  { v: 'woodwall', label: '板壁' },
  { v: 'panel', label: 'キッチンパネル' },
];

const CEILINGS = [
  { v: 'plaster', label: '白' },
  { v: 'wood', label: '竿縁天井' },
];

const LIGHTS = [
  { v: 'day', label: '昼（自然光）' },
  { v: 'night', label: '夜（店内照明）' },
];

const QUALITIES = [
  { v: 'standard', label: '標準' },
  { v: 'high', label: '高（陰影あり）' },
];

const SNAPS = [
  { v: 0, label: '自由' },
  { v: 0.1, label: '10cm' },
  { v: 0.25, label: '25cm' },
  { v: 0.5, label: '50cm' },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** 部屋のサイズを変えたとき、はみ出した什器を室内へ戻す */
function fitItems(doc) {
  return {
    ...doc,
    items: doc.items.map((it) => {
      const rad = ((it.rotY || 0) * Math.PI) / 180;
      const hx = (Math.abs(Math.cos(rad)) * it.w + Math.abs(Math.sin(rad)) * it.d) / 2;
      const hz = (Math.abs(Math.sin(rad)) * it.w + Math.abs(Math.cos(rad)) * it.d) / 2;
      const maxX = Math.max(0, doc.room.w / 2 - hx);
      const maxZ = Math.max(0, doc.room.d / 2 - hz);
      const x = clamp(it.x, -maxX, maxX);
      const z = clamp(it.z, -maxZ, maxZ);
      return x === it.x && z === it.z ? it : { ...it, x, z };
    }),
  };
}

function loadDoc() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw);
    if (!doc?.room || !Array.isArray(doc.items)) return null;
    return doc;
  } catch {
    return null;
  }
}

/** 非制御入力。Enter / フォーカス外しで数値を確定する */
function NumField({ value, onCommit, min, max, step = 0.1, suffix, ...rest }) {
  const ref = useRef(null);

  // 外側で値が変わったら（ドラッグ移動など）入力欄へ反映する
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) el.value = String(value);
  }, [value]);

  function commit() {
    const el = ref.current;
    if (!el) return;
    const n = Number(el.value);
    if (el.value.trim() === '' || Number.isNaN(n)) {
      el.value = String(value);
      return;
    }
    const c = Math.round(clamp(n, min, max) * 100) / 100;
    el.value = String(c);
    if (c !== value) onCommit(c);
  }

  return (
    <label className="s3dNum">
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        step={step}
        defaultValue={String(value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        {...rest}
      />
      {suffix ? <span>{suffix}</span> : null}
    </label>
  );
}

export default function StoreLayout3D() {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const handlersRef = useRef({});

  const [state, setState] = useState(() => ({
    doc: loadDoc() || PRESETS.konbini.build(),
    past: [],
    future: [],
  }));
  const doc = state.doc;

  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('orbit');
  const [snap, setSnap] = useState(0.25);
  const [quality, setQuality] = useState(() => {
    try {
      const saved = localStorage.getItem(QUALITY_KEY);
      if (saved) return saved;
    } catch {
      /* 参照できない環境では既定値を使う */
    }
    // 広い画面なら陰影ありで始める
    return typeof window !== 'undefined' && window.innerWidth >= 900
      ? 'high'
      : 'standard';
  });
  const [labels, setLabels] = useState(true);
  const [tab, setTab] = useState('add');
  const [jsonDraft, setJsonDraft] = useState('');
  const [toast, setToast] = useState('');
  // 確認ダイアログ。window.confirm は埋め込み表示（iframe）で無効化されるため自前で出す
  const [ask, setAsk] = useState(null);

  const selected = useMemo(
    () => doc.items.find((x) => x.id === selectedId) || null,
    [doc, selectedId]
  );

  // ===== 編集（履歴つき） =====
  const edit = useCallback((fn, history = true) => {
    setState((s) => ({
      doc: fn(s.doc),
      past: history ? [...s.past, s.doc].slice(-60) : s.past,
      future: history ? [] : s.future,
    }));
  }, []);

  /** スライダー操作の直前に、今の状態を履歴へ積む */
  const beginGesture = useCallback(() => {
    setState((s) => ({ ...s, past: [...s.past, s.doc].slice(-60), future: [] }));
  }, []);

  const undo = useCallback(() => {
    setState((s) =>
      s.past.length
        ? {
            doc: s.past[s.past.length - 1],
            past: s.past.slice(0, -1),
            future: [s.doc, ...s.future].slice(0, 60),
          }
        : s
    );
  }, []);

  const redo = useCallback(() => {
    setState((s) =>
      s.future.length
        ? {
            doc: s.future[0],
            past: [...s.past, s.doc].slice(-60),
            future: s.future.slice(1),
          }
        : s
    );
  }, []);

  const patchItem = useCallback(
    (id, patch, history = true) => {
      edit(
        (d) => ({
          ...d,
          items: d.items.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }),
        history
      );
    },
    [edit]
  );

  const addFixture = useCallback(
    (type) => {
      const item = makeItem(type);
      let created = item.id;
      setState((s) => {
        const spot = findFreeSpot(s.doc, item.w, item.d);
        const next = { ...item, x: spot.x, z: spot.z };
        created = next.id;
        return {
          doc: { ...s.doc, items: [...s.doc.items, next] },
          past: [...s.past, s.doc].slice(-60),
          future: [],
        };
      });
      setSelectedId(created);
      setTab('inspect');
    },
    []
  );

  const duplicateItem = useCallback(
    (item) => {
      const copy = { ...item, id: makeItem(item.type).id };
      setState((s) => {
        const spot = findFreeSpot(s.doc, item.w, item.d);
        return {
          doc: {
            ...s.doc,
            items: [...s.doc.items, { ...copy, x: spot.x, z: spot.z }],
          },
          past: [...s.past, s.doc].slice(-60),
          future: [],
        };
      });
      setSelectedId(copy.id);
    },
    []
  );

  const removeItem = useCallback(
    (id) => {
      edit((d) => ({ ...d, items: d.items.filter((x) => x.id !== id) }));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [edit]
  );

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 1800);
  }, []);

  // ===== シーン生成 =====
  useEffect(() => {
    handlersRef.current = {
      onSelect: (id) => {
        setSelectedId(id);
        if (id) setTab('inspect');
      },
      onMove: (id, x, z, phase) => {
        patchItem(id, { x, z }, phase === 'start');
      },
      onMoveEnd: () => {},
    };
  });

  useEffect(() => {
    const scene = new StoreScene(hostRef.current, {
      onSelect: (id) => handlersRef.current.onSelect?.(id),
      onMove: (id, x, z, phase) =>
        handlersRef.current.onMove?.(id, x, z, phase),
      onMoveEnd: () => handlersRef.current.onMoveEnd?.(),
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setDoc(doc);
  }, [doc]);

  useEffect(() => {
    sceneRef.current?.setSelected(selectedId);
  }, [selectedId, doc]);

  useEffect(() => {
    sceneRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    sceneRef.current?.setLabels(labels);
  }, [labels]);

  useEffect(() => {
    sceneRef.current?.setSnap(snap);
  }, [snap]);

  useEffect(() => {
    sceneRef.current?.setQuality(quality);
    try {
      localStorage.setItem(QUALITY_KEY, quality);
    } catch {
      /* 保存できなくても動作に影響はない */
    }
  }, [quality]);

  // 自動保存
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      } catch {
        /* 容量オーバーなどは無視 */
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [doc]);

  // ===== キーボードショートカット =====
  useEffect(() => {
    function onKey(e) {
      if (document.body.dataset.modal) return; // 使い方シートなどを開いている間
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }

      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      if (!selected) return;

      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateItem(selected);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeItem(selected.id);
        return;
      }
      if (e.key.toLowerCase() === 'r') {
        const dir = e.shiftKey ? -15 : 15;
        patchItem(selected.id, { rotY: (((selected.rotY + dir) % 360) + 360) % 360 });
        return;
      }
      if (mode !== 'walk' && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = snap > 0 ? snap : 0.1;
        const dx =
          (e.key === 'ArrowRight' ? step : 0) - (e.key === 'ArrowLeft' ? step : 0);
        const dz =
          (e.key === 'ArrowDown' ? step : 0) - (e.key === 'ArrowUp' ? step : 0);
        patchItem(selected.id, {
          x: Math.round((selected.x + dx) * 100) / 100,
          z: Math.round((selected.z + dz) * 100) / 100,
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, mode, snap, undo, redo, patchItem, removeItem, duplicateItem]);

  // ===== データ入出力 =====
  useEffect(() => {
    if (tab === 'data') setJsonDraft(JSON.stringify(doc, null, 2));
    // タブを開いた瞬間だけ流し込む（編集中に上書きしない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function applyJson() {
    try {
      const next = JSON.parse(jsonDraft);
      if (!next?.room || !Array.isArray(next.items)) throw new Error('形式が違います');
      edit(() => next);
      setSelectedId(null);
      showToast('レイアウトを読み込みました');
    } catch (err) {
      showToast('JSONを読み込めません: ' + err.message);
    }
  }

  async function save(name, blob) {
    try {
      const res = await saveFile(name, blob);
      if (res === 'saved') showToast(`${name} を保存しました`);
    } catch (err) {
      showToast('保存できません: ' + err.message);
    }
  }

  function downloadJson() {
    save(
      'store-layout.json',
      new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    );
  }

  function downloadPng() {
    const data = sceneRef.current?.snapshot();
    if (data) save('store-layout.png', dataUrlToBlob(data));
  }

  function loadPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    const run = () => {
      edit(() => p.build());
      setSelectedId(null);
      showToast(`${p.label} を読み込みました`);
    };
    if (!doc.items.length) {
      run();
      return;
    }
    setAsk({
      text: `「${p.label}」を読み込みます。今のレイアウトは置き換わります。`,
      ok: '読み込む',
      run,
    });
  }

  const area = (doc.room.w * doc.room.d).toFixed(1);

  // ===== 描画 =====
  return (
    <div className="s3d">
      <div className="s3dStage">
        <div className="s3dCanvas" ref={hostRef} />

        <div className="s3dOverlay s3dTop">
          <div className="s3dSeg">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={'s3dSegBtn' + (mode === m.id ? ' on' : '')}
                onClick={() => setMode(m.id)}
                title={m.label}
              >
                <span aria-hidden="true">{m.emoji}</span> {m.label}
              </button>
            ))}
          </div>

          <div className="s3dSpacer" />

          <button
            type="button"
            className="s3dChip"
            onClick={undo}
            disabled={!state.past.length}
            title="元に戻す (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            type="button"
            className="s3dChip"
            onClick={redo}
            disabled={!state.future.length}
            title="やり直す (Ctrl+Shift+Z)"
          >
            ↷
          </button>
          <button
            type="button"
            className={'s3dChip' + (labels ? ' on' : '')}
            onClick={() => setLabels((v) => !v)}
            title="名前ラベルの表示"
          >
            🏷️
          </button>
        </div>

        <div className="s3dOverlay s3dBottom">
          <span className="s3dHint">{HINTS[mode]}</span>
        </div>

        {mode === 'walk' ? (
          <div className="s3dPad">
            {[
              { k: 'up', f: 1, s: 0, t: '▲' },
              { k: 'left', f: 0, s: -1, t: '◀' },
              { k: 'down', f: -1, s: 0, t: '▼' },
              { k: 'right', f: 0, s: 1, t: '▶' },
            ].map((b) => (
              <button
                key={b.k}
                type="button"
                className={'s3dPadBtn ' + b.k}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  sceneRef.current?.setPadInput(b.f, b.s);
                }}
                onPointerUp={() => sceneRef.current?.setPadInput(0, 0)}
                onPointerCancel={() => sceneRef.current?.setPadInput(0, 0)}
                aria-label={b.k}
              >
                {b.t}
              </button>
            ))}
          </div>
        ) : null}

        {toast ? <div className="s3dToast">{toast}</div> : null}

        {ask ? (
          <div className="s3dAsk" onClick={() => setAsk(null)}>
            <div
              className="s3dAskBox"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="s3dAskText">{ask.text}</div>
              <div className="s3dRow">
                <button type="button" className="s3dBtn" onClick={() => setAsk(null)}>
                  やめる
                </button>
                <button
                  type="button"
                  className="s3dBtn on"
                  onClick={() => {
                    ask.run();
                    setAsk(null);
                  }}
                >
                  {ask.ok}
                </button>
              </div>
              <div className="s3dNote">元に戻す（Ctrl+Z）でやり直せます。</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="s3dPanel">
        <div className="s3dTabs">
          {[
            ['add', '什器を追加'],
            ['inspect', '選択中'],
            ['room', '店の広さ'],
            ['data', '保存'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={'s3dTab' + (tab === id ? ' on' : '')}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="s3dPanelBody">
          {tab === 'add' ? (
            <>
              <div className="s3dLabel">タップで店内に追加できます</div>
              {CATALOG_GROUPS.map(([group, items]) => (
                <div key={group}>
                  <div className="s3dGroup">{group}</div>
                  <div className="s3dCatalog">
                    {items.map((c) => (
                      <button
                        key={c.type}
                        type="button"
                        className="s3dCatBtn"
                        onClick={() => addFixture(c.type)}
                      >
                        <span className="s3dCatEmoji" aria-hidden="true">
                          {c.emoji}
                        </span>
                        <span className="s3dCatName">{c.label}</span>
                        <span className="s3dCatSize">
                          {c.w}×{c.d}m
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="s3dNote">
                什器は {doc.items.length} 個 / 床面積 {area} ㎡
              </div>
            </>
          ) : null}

          {tab === 'inspect' ? (
            selected ? (
              <>
                <div className="s3dLabel">名前（ラベルに表示）</div>
                <input
                  className="s3dText"
                  value={selected.name}
                  onChange={(e) =>
                    patchItem(selected.id, { name: e.target.value }, false)
                  }
                  placeholder="例：お菓子コーナー"
                />

                <div className="s3dLabel">サイズ（m）</div>
                <div className="s3dGrid3">
                  <div>
                    <span className="s3dMini">幅</span>
                    <NumField
                      value={selected.w}
                      min={0.2}
                      max={12}
                      onCommit={(v) => patchItem(selected.id, { w: v })}
                    />
                  </div>
                  <div>
                    <span className="s3dMini">奥行</span>
                    <NumField
                      value={selected.d}
                      min={0.2}
                      max={12}
                      onCommit={(v) => patchItem(selected.id, { d: v })}
                    />
                  </div>
                  <div>
                    <span className="s3dMini">高さ</span>
                    <NumField
                      value={selected.h}
                      min={0.2}
                      max={4}
                      onCommit={(v) => patchItem(selected.id, { h: v })}
                    />
                  </div>
                </div>

                <div className="s3dLabel">向き（{Math.round(selected.rotY)}°）</div>
                <div className="s3dRow">
                  <button
                    type="button"
                    className="s3dBtn"
                    onClick={() =>
                      patchItem(selected.id, {
                        rotY: (((selected.rotY - 90) % 360) + 360) % 360,
                      })
                    }
                  >
                    ↺ 90°
                  </button>
                  <input
                    className="s3dRange"
                    type="range"
                    min="0"
                    max="345"
                    step="15"
                    value={selected.rotY}
                    onPointerDown={beginGesture}
                    onChange={(e) =>
                      patchItem(selected.id, { rotY: Number(e.target.value) }, false)
                    }
                  />
                  <button
                    type="button"
                    className="s3dBtn"
                    onClick={() =>
                      patchItem(selected.id, {
                        rotY: (((selected.rotY + 90) % 360) + 360) % 360,
                      })
                    }
                  >
                    ↻ 90°
                  </button>
                </div>

                <div className="s3dLabel">位置（m・中央が0）</div>
                <div className="s3dGrid3">
                  <div>
                    <span className="s3dMini">左右 X</span>
                    <NumField
                      value={selected.x}
                      min={-doc.room.w / 2}
                      max={doc.room.w / 2}
                      onCommit={(v) => patchItem(selected.id, { x: v })}
                    />
                  </div>
                  <div>
                    <span className="s3dMini">奥手前 Z</span>
                    <NumField
                      value={selected.z}
                      min={-doc.room.d / 2}
                      max={doc.room.d / 2}
                      onCommit={(v) => patchItem(selected.id, { z: v })}
                    />
                  </div>
                  <div>
                    <span className="s3dMini">床から</span>
                    <NumField
                      value={selected.y || 0}
                      min={0}
                      max={Math.max(0, doc.room.h - 0.1)}
                      step={0.05}
                      onCommit={(v) => patchItem(selected.id, { y: v })}
                    />
                  </div>
                </div>
                <div className="s3dRow">
                  <button
                    type="button"
                    className="s3dBtn"
                    onClick={() => patchItem(selected.id, { x: 0, z: 0 })}
                  >
                    中央へ
                  </button>
                  <button
                    type="button"
                    className="s3dBtn"
                    onClick={() => patchItem(selected.id, { y: 0 })}
                  >
                    床に下ろす
                  </button>
                </div>
                <div className="s3dNote">
                  「床から」はレンジフードや電子レンジのように、台の上や頭上へ置くときに使います。
                </div>

                <div className="s3dLabel">色</div>
                <div className="s3dSwatches">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={
                        's3dSwatch' + (selected.color === c ? ' on' : '')
                      }
                      style={{ background: c }}
                      onClick={() => patchItem(selected.id, { color: c })}
                      aria-label={c}
                    />
                  ))}
                  <input
                    className="s3dColor"
                    type="color"
                    value={selected.color}
                    onChange={(e) =>
                      patchItem(selected.id, { color: e.target.value }, false)
                    }
                  />
                </div>

                <div className="s3dRow s3dActions">
                  <button
                    type="button"
                    className="s3dBtn"
                    onClick={() => duplicateItem(selected)}
                  >
                    複製
                  </button>
                  <button
                    type="button"
                    className="s3dBtn danger"
                    onClick={() => removeItem(selected.id)}
                  >
                    削除
                  </button>
                </div>
                <div className="s3dNote">
                  ショートカット：R＝回転 / 矢印＝微調整 / Delete＝削除 /
                  Ctrl+D＝複製 / Ctrl+Z＝元に戻す
                </div>
              </>
            ) : (
              <div className="s3dEmpty">
                什器をタップすると、ここでサイズ・向き・色を調整できます。
              </div>
            )
          ) : null}

          {tab === 'room' ? (
            <>
              <div className="s3dLabel">店の大きさ（m）</div>
              <div className="s3dGrid3">
                <div>
                  <span className="s3dMini">幅</span>
                  <NumField
                    value={doc.room.w}
                    min={4}
                    max={40}
                    step={0.5}
                    onCommit={(v) =>
                      edit((d) => fitItems({ ...d, room: { ...d.room, w: v } }))
                    }
                  />
                </div>
                <div>
                  <span className="s3dMini">奥行</span>
                  <NumField
                    value={doc.room.d}
                    min={4}
                    max={40}
                    step={0.5}
                    onCommit={(v) =>
                      edit((d) => fitItems({ ...d, room: { ...d.room, d: v } }))
                    }
                  />
                </div>
                <div>
                  <span className="s3dMini">天井高</span>
                  <NumField
                    value={doc.room.h}
                    min={2.2}
                    max={8}
                    step={0.1}
                    onCommit={(v) =>
                      edit((d) => ({ ...d, room: { ...d.room, h: v } }))
                    }
                  />
                </div>
              </div>

              <div className="s3dLabel">床材</div>
              <div className="s3dRow">
                {FLOORS.map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    className={
                      's3dBtn' + ((doc.room.floor || 'wood') === f.v ? ' on' : '')
                    }
                    onClick={() =>
                      edit((d) => ({ ...d, room: { ...d.room, floor: f.v } }))
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="s3dLabel">壁材</div>
              <div className="s3dRow">
                {WALLS.map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    className={
                      's3dBtn' + ((doc.room.wall || 'plaster') === f.v ? ' on' : '')
                    }
                    onClick={() =>
                      edit((d) => ({ ...d, room: { ...d.room, wall: f.v } }))
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="s3dLabel">天井</div>
              <div className="s3dRow">
                {CEILINGS.map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    className={
                      's3dBtn' + ((doc.room.ceiling || 'plaster') === f.v ? ' on' : '')
                    }
                    onClick={() =>
                      edit((d) => ({ ...d, room: { ...d.room, ceiling: f.v } }))
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="s3dNote">天井は「店内」で歩くときに見えます。</div>

              <div className="s3dLabel">照明</div>
              <div className="s3dRow">
                {LIGHTS.map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    className={
                      's3dBtn' + ((doc.room.light || 'day') === f.v ? ' on' : '')
                    }
                    onClick={() =>
                      edit((d) => ({ ...d, room: { ...d.room, light: f.v } }))
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="s3dLabel">画質</div>
              <div className="s3dRow">
                {QUALITIES.map((q) => (
                  <button
                    key={q.v}
                    type="button"
                    className={'s3dBtn' + (quality === q.v ? ' on' : '')}
                    onClick={() => setQuality(q.v)}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="s3dNote">
                「高」は隅や什器の足元に陰影（アンビエントオクルージョン）を付けます。
                動きが重いときは「標準」にしてください。
              </div>

              <div className="s3dLabel">グリッド吸着</div>
              <div className="s3dRow">
                {SNAPS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className={'s3dBtn' + (snap === s.v ? ' on' : '')}
                    onClick={() => setSnap(s.v)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="s3dLabel">テンプレート</div>
              <div className="s3dRow">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    className="s3dBtn"
                    onClick={() => loadPreset(key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="s3dRow s3dActions">
                <button
                  type="button"
                  className="s3dBtn danger"
                  onClick={() =>
                    setAsk({
                      text: '什器をすべて削除します。よろしいですか？',
                      ok: '全部消す',
                      run: () => {
                        edit((d) => ({ ...d, items: [] }));
                        setSelectedId(null);
                      },
                    })
                  }
                >
                  什器を全消去
                </button>
              </div>
            </>
          ) : null}

          {tab === 'data' ? (
            <>
              <div className="s3dNote">
                レイアウトはこの端末に自動保存されます。JSONで持ち出し・読み込みもできます。
              </div>
              <div className="s3dRow s3dActions">
                <button type="button" className="s3dBtn" onClick={downloadJson}>
                  JSON保存
                </button>
                <button type="button" className="s3dBtn" onClick={downloadPng}>
                  画像で保存
                </button>
                <button
                  type="button"
                  className="s3dBtn"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(JSON.stringify(doc))
                      .then(() => showToast('コピーしました'))
                      .catch(() => showToast('コピーできませんでした'));
                  }}
                >
                  コピー
                </button>
              </div>
              <div className="s3dLabel">JSON（貼り付けて「読み込む」）</div>
              <textarea
                className="s3dTextarea"
                value={jsonDraft}
                onChange={(e) => setJsonDraft(e.target.value)}
                spellCheck="false"
              />
              <div className="s3dRow s3dActions">
                <button type="button" className="s3dBtn" onClick={applyJson}>
                  読み込む
                </button>
                <button
                  type="button"
                  className="s3dBtn"
                  onClick={() => setJsonDraft(JSON.stringify(doc, null, 2))}
                >
                  今の内容に戻す
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
