import { useMemo, useState } from 'react';
import type { AlertSettings, AlertOverride, AlertEvent } from '../lib/alerts';

interface Row {
  key: string; // 심볼/마켓 (기준가 맵 키)
  label: string; // 표시명 (BTC, AAPL)
  price: number | null; // 현재가
}

interface Props {
  settings: AlertSettings;
  bases: Record<string, number>;
  overrides: Record<string, AlertOverride>;
  rows: Row[];
  fmt: (n: number | null) => string;
  onClose: () => void;
  onToggle: () => void;
  // 확인 시 일괄 커밋
  onApply: (patch: { threshold?: number; bases?: Record<string, number>; overrides?: Record<string, AlertOverride> }) => void;
  history: AlertEvent[]; // 이번 세션 알림 이력 (페이지 닫으면 소멸)
  onClearHistory: () => void;
}

// 가격 알림 설정 모달 — 공통/개별 임계값·기준가를 편집해 "확인" 으로 일괄 적용.
export function AlertSettingsModal({ settings, bases, overrides, rows, fmt, onClose, onToggle, onApply, history, onClearHistory }: Props) {
  const [tab, setTab] = useState<'settings' | 'history'>('settings');
  // 편집 버퍼 (확인 전까지 실제 설정 미반영)
  const [threshold, setThreshold] = useState(String(settings.threshold));
  const [baseEdits, setBaseEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, bases[r.key] != null ? String(bases[r.key]) : ''])),
  );
  const [thEdits, setThEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, overrides[r.key]?.threshold != null ? String(overrides[r.key]!.threshold) : ''])),
  );

  const num = (s: string) => Number(s.replace(/,/g, ''));

  // 전체 기준가를 현재가로
  const resetAllBases = () => {
    setBaseEdits((prev) => {
      const next = { ...prev };
      for (const r of rows) if (r.price != null) next[r.key] = String(r.price);
      return next;
    });
  };
  // 전체 개별 임계값을 공통값으로 통일 (= 오버라이드 제거)
  const clearAllOverrides = () => {
    setThEdits((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, ''])));
  };

  const apply = () => {
    const nextBases: Record<string, number> = {};
    for (const r of rows) {
      const v = num(baseEdits[r.key] ?? '');
      if (Number.isFinite(v) && v > 0) nextBases[r.key] = v;
    }
    const nextOverrides: Record<string, AlertOverride> = {};
    for (const r of rows) {
      const v = num(thEdits[r.key] ?? '');
      if (Number.isFinite(v) && v > 0) nextOverrides[r.key] = { threshold: Math.max(0.1, v) };
    }
    const th = num(threshold);
    onApply({
      threshold: Number.isFinite(th) && th > 0 ? th : undefined,
      bases: nextBases,
      overrides: nextOverrides,
    });
    onClose();
  };

  const sortedRows = useMemo(() => rows, [rows]);

  return (
    <div className="brief-modal-overlay" onClick={onClose}>
      <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ptitle t-red" style={{ justifyContent: 'space-between' }}>
          <span>🔔 변동 알림</span>
          <button className={'mode-btn' + (settings.enabled ? ' active' : '')} style={{ padding: '2px 8px' }} onClick={onToggle}>
            {settings.enabled ? '켜짐' : '꺼짐'}
          </button>
        </div>

        {/* 탭: 설정 / 이력 */}
        <div className="alert-modal-tabs">
          <button className={'newsbtn' + (tab === 'settings' ? ' on' : '')} onClick={() => setTab('settings')}>설정</button>
          <button className={'newsbtn' + (tab === 'history' ? ' on' : '')} onClick={() => setTab('history')}>
            최근 알림{history.length ? ` (${history.length})` : ''}
          </button>
        </div>

        {tab === 'settings' && (
        <>
        {/* 공통 임계값 + 전체 일괄 */}
        <div className="alert-modal-common">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="dim">공통 임계값 ±</span>
            <input
              className="aikey-input"
              style={{ width: 64, padding: '3px 6px', textAlign: 'right' }}
              type="number"
              min={0.1}
              step={0.5}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
            <span className="dim">% 변동 시</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="newsbtn" onClick={resetAllBases} title="모든 종목 기준가를 현재가로">
              전체 기준가 현재가로
            </button>
            <button className="newsbtn" onClick={clearAllOverrides} title="개별 임계값 모두 공통값으로">
              개별 임계값 초기화
            </button>
          </div>
        </div>

        {/* 종목별 개별 설정 */}
        <div className="alert-modal-list">
          <div className="alert-modal-head">
            <span style={{ flex: '0 0 64px' }}>종목</span>
            <span style={{ flex: 1 }}>기준가</span>
            <span style={{ flex: '0 0 110px', textAlign: 'right' }}>개별 임계값 %</span>
            <span style={{ flex: '0 0 44px' }} />
          </div>
          {sortedRows.map((r) => (
            <div key={r.key} className="alert-modal-row">
              <span className="sym" style={{ flex: '0 0 64px' }}>{r.label}</span>
              <input
                className="aikey-input"
                style={{ flex: 1, padding: '2px 6px' }}
                value={baseEdits[r.key] ?? ''}
                placeholder={r.price != null ? fmt(r.price) : '미설정'}
                onChange={(e) => setBaseEdits((p) => ({ ...p, [r.key]: e.target.value }))}
              />
              <input
                className="aikey-input"
                style={{ flex: '0 0 110px', padding: '2px 6px', textAlign: 'right' }}
                type="number"
                min={0.1}
                step={0.5}
                value={thEdits[r.key] ?? ''}
                placeholder={`공통 ${settings.threshold}`}
                onChange={(e) => setThEdits((p) => ({ ...p, [r.key]: e.target.value }))}
              />
              <button
                className="newsbtn"
                style={{ flex: '0 0 44px' }}
                title="이 종목 기준가를 현재가로"
                onClick={() => r.price != null && setBaseEdits((p) => ({ ...p, [r.key]: String(r.price) }))}
              >
                현재가
              </button>
            </div>
          ))}
          {sortedRows.length === 0 && <div className="dim" style={{ fontSize: 12 }}>관심 종목이 없습니다</div>}
        </div>

        {/* 하단 확인/취소 */}
        <div className="alert-modal-footer">
          <span className="dim" style={{ fontSize: 11 }}>개별 임계값을 비우면 공통값을 따릅니다</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="newsbtn" onClick={onClose}>취소</button>
            <button className="newsbtn on" onClick={apply}>확인</button>
          </div>
        </div>
        </>
        )}

        {tab === 'history' && (
        <>
          <div className="alert-modal-list">
            {history.length === 0 && (
              <div className="dim" style={{ fontSize: 12 }}>아직 발생한 알림이 없습니다 (페이지를 닫으면 이력은 초기화됩니다)</div>
            )}
            {history.map((e) => (
              <div key={e.id} className="alert-hist-row">
                <span className="alert-hist-time">{new Date(e.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span className="alert-hist-label">{e.label}</span>
                <span className={'alert-hist-pct ' + (e.up ? 'up' : 'down')}>
                  {e.up ? '▲' : '▼'} {e.up ? '+' : ''}{e.pct.toFixed(1)}%
                </span>
                <span className="alert-hist-price dim">{fmt(e.price)}</span>
              </div>
            ))}
          </div>
          <div className="alert-modal-footer">
            <span className="dim" style={{ fontSize: 11 }}>이번 세션 알림 이력 · 최대 {50}건</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {history.length > 0 && <button className="newsbtn" onClick={onClearHistory}>지우기</button>}
              <button className="newsbtn on" onClick={onClose}>닫기</button>
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  );
}
