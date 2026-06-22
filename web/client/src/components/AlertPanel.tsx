import { useState } from 'react';
import type { AlertSettings } from '../lib/alerts';

interface Row {
  key: string; // 심볼/마켓 (기준가 맵 키)
  label: string; // 표시명 (BTC, AAPL)
  price: number | null; // 현재가
}

interface Props {
  settings: AlertSettings;
  bases: Record<string, number>;
  rows: Row[];
  fmt: (n: number | null) => string;
  onToggle: () => void;
  onThreshold: (n: number) => void;
  onSetBase: (key: string, price: number) => void;
}

// 가격 알림 패널 — 코인/주식 공용. 종목별 기준가 표시·편집·현재가 리셋.
export function AlertPanel({ settings, bases, rows, fmt, onToggle, onThreshold, onSetBase }: Props) {
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const startEdit = (key: string, base: number | undefined) => {
    setEditKey(key);
    setEditVal(base != null ? String(base) : '');
  };
  const commitEdit = (key: string) => {
    const v = Number(editVal.replace(/,/g, ''));
    if (Number.isFinite(v) && v > 0) onSetBase(key, v);
    setEditKey(null);
  };

  return (
    <div className="panel">
      <div className="ptitle t-red" style={{ justifyContent: 'space-between' }}>
        <span>가격 알림</span>
        <button className={`mode-btn${settings.enabled ? ' active' : ''}`} style={{ padding: '2px 8px' }} onClick={onToggle}>
          {settings.enabled ? '켜짐' : '꺼짐'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6 }}>
        <span className="dim">기준가 대비 ±</span>
        <input
          className="aikey-input"
          style={{ width: 56, padding: '3px 6px', textAlign: 'right' }}
          type="number"
          min={0.1}
          step={0.5}
          value={settings.threshold}
          onChange={(e) => onThreshold(Number(e.target.value) || 0.1)}
        />
        <span className="dim">% 변동 시</span>
      </div>
      {settings.enabled &&
        rows.map((r) => {
          const base = bases[r.key];
          const pct = base != null && r.price != null && base ? ((r.price - base) / base) * 100 : null;
          const editing = editKey === r.key;
          return (
            <div key={r.key} className="row" style={{ cursor: 'default', fontSize: 12 }}>
              <span className="sym" style={{ minWidth: 46 }}>{r.label}</span>
              {editing ? (
                <input
                  className="aikey-input"
                  style={{ flex: 1, padding: '2px 6px' }}
                  autoFocus
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(r.key);
                    if (e.key === 'Escape') setEditKey(null);
                  }}
                  onBlur={() => commitEdit(r.key)}
                />
              ) : (
                <>
                  <span className="dim" style={{ flex: 1 }} title="클릭해 기준가 편집" onClick={() => startEdit(r.key, base)}>
                    기준 {fmt(base ?? null)}
                  </span>
                  {pct != null && (
                    <span className={pct > 0 ? 'up' : pct < 0 ? 'down' : 'dim'} style={{ marginRight: 6 }}>
                      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  )}
                  <button
                    className="newsbtn"
                    title="현재가를 기준으로 리셋"
                    onClick={() => r.price != null && onSetBase(r.key, r.price)}
                  >
                    리셋
                  </button>
                </>
              )}
            </div>
          );
        })}
      {!settings.enabled && (
        <div className="dim" style={{ fontSize: 11 }}>켜면 브라우저 알림·소리로 알려줍니다</div>
      )}
    </div>
  );
}
