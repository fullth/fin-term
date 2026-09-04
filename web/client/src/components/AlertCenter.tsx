import { useMemo, useState } from 'react';
import type { AlertEvent } from '../lib/alerts';

// 한 시장(주식/코인)의 알림 상태 + 조작 핸들 — App 의 usePriceAlerts 결과에서 필요한 것만 추림.
export interface AlertScopeView {
  key: 'stock' | 'crypto';
  label: string; // "주식" / "코인"
  enabled: boolean;
  threshold: number;
  watchCount: number; // 감시 중인 종목 수
  history: AlertEvent[];
  onToggle: () => void;
  onThreshold: (pct: number) => void;
  onOpenDetail: () => void; // 종목별 세부 설정 모달
  onClearHistory: () => void;
}

interface Props {
  scopes: AlertScopeView[];
  onClose: () => void;
}

const fmtTime = (at: number) =>
  new Date(at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

// 알림 센터 — 주식·코인 알림 상태를 한 곳에서 켜고, 최근 발생 알림을 시간순으로 모아 본다.
// 기존 "종목별 임계값/기준가" 편집은 각 시장의 세부 설정 모달로 넘긴다.
export function AlertCenter({ scopes, onClose }: Props) {
  const [thEdits, setThEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(scopes.map((s) => [s.key, String(s.threshold)])),
  );

  // 주식·코인 이력을 하나로 합쳐 최신순 정렬 (어느 시장인지 배지로 구분)
  const feed = useMemo(() => {
    const merged = scopes.flatMap((s) => s.history.map((e) => ({ ...e, scope: s.label })));
    return merged.sort((a, b) => b.at - a.at).slice(0, 60);
  }, [scopes]);

  const anyOn = scopes.some((s) => s.enabled);
  const totalWatch = scopes.reduce((sum, s) => sum + (s.enabled ? s.watchCount : 0), 0);

  const commitThreshold = (key: string) => {
    const scope = scopes.find((s) => s.key === key);
    if (!scope) return;
    const v = Number(thEdits[key]);
    if (Number.isFinite(v) && v > 0 && v !== scope.threshold) scope.onThreshold(v);
    else setThEdits((p) => ({ ...p, [key]: String(scope.threshold) }));
  };

  return (
    <div className="brief-modal-overlay" onClick={onClose}>
      <div className="alert-center" onClick={(e) => e.stopPropagation()}>
        <div className="ptitle t-red" style={{ justifyContent: 'space-between' }}>
          <span>🔔 알림 센터</span>
          <button className="newsbtn" onClick={onClose}>닫기</button>
        </div>

        <p className="alert-center-lead dim">
          {anyOn
            ? `가격 알림 켜짐 · 감시 중 ${totalWatch}종목. 기준가 대비 임계값 이상 움직이면 브라우저 알림과 소리로 알려줍니다.`
            : '가격 알림이 모두 꺼져 있습니다. 시장을 켜면 관심 종목이 크게 움직일 때 알려줍니다.'}
        </p>

        <div className="alert-center-scopes">
          {scopes.map((s) => (
            <div key={s.key} className={`alert-scope-card${s.enabled ? ' on' : ''}`}>
              <div className="alert-scope-top">
                <strong>{s.label} 알림</strong>
                <button
                  className={`mode-btn${s.enabled ? ' active' : ''}`}
                  style={{ padding: '2px 10px' }}
                  onClick={s.onToggle}
                  aria-pressed={s.enabled}
                >
                  {s.enabled ? '켜짐' : '꺼짐'}
                </button>
              </div>
              <div className="alert-scope-body">
                <label className="alert-scope-th">
                  <span className="dim">임계값 ±</span>
                  <input
                    className="aikey-input"
                    style={{ width: 58, padding: '3px 6px', textAlign: 'right' }}
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={thEdits[s.key] ?? ''}
                    onChange={(e) => setThEdits((p) => ({ ...p, [s.key]: e.target.value }))}
                    onBlur={() => commitThreshold(s.key)}
                    onKeyDown={(e) => e.key === 'Enter' && commitThreshold(s.key)}
                  />
                  <span className="dim">%</span>
                </label>
                <span className="dim alert-scope-watch">
                  {s.enabled ? `${s.watchCount}종목 감시` : '대기'}
                </span>
                <button className="newsbtn" onClick={s.onOpenDetail}>종목별 설정</button>
              </div>
            </div>
          ))}
        </div>

        <div className="alert-center-feed-head">
          <span className="dim">최근 알림 {feed.length ? `(${feed.length})` : ''}</span>
          {feed.length > 0 && (
            <button
              className="newsbtn"
              onClick={() => scopes.forEach((s) => s.onClearHistory())}
            >
              전체 지우기
            </button>
          )}
        </div>
        <div className="alert-center-feed">
          {feed.length === 0 && (
            <div className="dim" style={{ fontSize: 12, padding: '8px 2px' }}>
              아직 발생한 알림이 없습니다. 임계값 이상 움직임이 생기면 여기에 쌓입니다.
            </div>
          )}
          {feed.map((e) => (
            <div key={`${e.scope}-${e.id}`} className="alert-feed-row">
              <span className="alert-feed-scope">{e.scope}</span>
              <span className="alert-feed-time dim">{fmtTime(e.at)}</span>
              <span className="alert-feed-label">{e.label}</span>
              <span className={`alert-feed-pct ${e.up ? 'up' : 'down'}`}>
                {e.up ? '▲' : '▼'} {e.up ? '+' : ''}{e.pct.toFixed(1)}%
              </span>
              <span className="alert-feed-price dim">{e.price.toLocaleString('ko-KR')}</span>
            </div>
          ))}
        </div>

        <div className="alert-center-foot dim">
          최근 알림은 이 브라우저에 저장되며 시장별 최대 50건까지 보관합니다.
        </div>
      </div>
    </div>
  );
}
