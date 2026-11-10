import { useState } from 'react';

// 브리핑 상태는 App 에서 관리(모드 전환·새로고침에도 유지). 패널은 표시 + 생성 트리거만.
interface BriefProps {
  text: string | null;
  loading: boolean;
  err: string | null;
  generatedAt?: string;
}

export function BriefPanel({ text, loading, err, generatedAt }: BriefProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="panel brief-panel">
      <div className="ptitle t-magenta" style={{ justifyContent: 'space-between' }}>
        <span>데일리 AI 브리핑 {generatedAt && <small className="dim">{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(generatedAt))} 기준</small>}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          {text && (
            <button className="mode-btn" onClick={() => setExpanded(true)} style={{ padding: '2px 8px' }}>
              전체보기
            </button>
          )}
        </span>
      </div>
      <div className="brief-body" onClick={() => text && setExpanded(true)} style={{ cursor: text ? 'pointer' : 'default' }}>
        {text && <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text}</div>}
        {!text && err && <div className="down" style={{ fontSize: 12 }}>{err}</div>}
        {!text && !err && !loading && (
          <div className="dim" style={{ fontSize: 12 }}>
            매일 오전 7시 시장 브리핑이 공개됩니다.
          </div>
        )}
      </div>
      {expanded && text && (
        <div className="brief-modal-overlay" onClick={() => setExpanded(false)}>
          <div className="brief-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ptitle t-magenta" style={{ justifyContent: 'space-between' }}>
              <span>데일리 AI 브리핑</span>
              <button className="mode-btn" onClick={() => setExpanded(false)} style={{ padding: '2px 8px' }}>
                닫기 ✕
              </button>
            </div>
            <div className="brief-modal-body">{text}</div>
          </div>
        </div>
      )}
    </div>
  );
}
