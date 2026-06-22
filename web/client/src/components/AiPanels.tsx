import { useState } from 'react';
import type { Quote, NewsItem } from '../lib/types';
import { api } from '../lib/api';
import { activeAiKey } from '../lib/ai-key';

interface BriefProps {
  watchlist: string[];
  names: Record<string, string>;
  quotes: Record<string, Quote>;
  news: NewsItem[];
  hasServerKey: boolean;
  onNeedKey: () => void;
}

export function BriefPanel({ watchlist, names, quotes, news, hasServerKey, onNeedKey }: BriefProps) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  // 브리핑은 서버 키 전용(운영자 부담) — 사용자 키와 무관하게 서버 키가 있으면 기본 제공.
  const usable = hasServerKey;

  const run = async () => {
    if (!usable) {
      onNeedKey();
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await api.brief({ watchlist, names, quotes, news });
      if (r.status === 401) {
        setErr('브리핑은 현재 사용할 수 없습니다');
      } else if (!r.text) {
        setErr('생성 실패 — 잠시 후 다시 시도하세요');
      } else {
        setText(r.text);
      }
    } catch {
      setErr('생성 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel brief-panel">
      <div className="ptitle t-magenta" style={{ justifyContent: 'space-between' }}>
        <span>데일리 AI 브리핑</span>
        <span style={{ display: 'flex', gap: 6 }}>
          {text && (
            <button className="mode-btn" onClick={() => setExpanded(true)} style={{ padding: '2px 8px' }}>
              전체보기
            </button>
          )}
          {usable && (
            <button className="mode-btn" onClick={run} disabled={loading} style={{ padding: '2px 8px' }}>
              {loading ? '생성 중…' : text ? '다시' : '생성'}
            </button>
          )}
        </span>
      </div>
      <div className="brief-body" onClick={() => text && setExpanded(true)} style={{ cursor: text ? 'pointer' : 'default' }}>
        {text && <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text}</div>}
        {!text && err && <div className="down" style={{ fontSize: 12 }}>{err}</div>}
        {!text && !err && !loading && (
          <div className="dim" style={{ fontSize: 12 }}>
            {usable ? '관심종목+뉴스로 오늘 시장 요약을 생성합니다.' : '브리핑 기능이 비활성화되어 있습니다.'}
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

interface ExplainProps {
  onNeedKey: () => void;
  compact?: boolean; // 상단 검색줄에 가로로 들어갈 때
}

export function ExplainPanel({ onNeedKey, compact }: ExplainProps) {
  const [term, setTerm] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 용어 풀이는 사용자 키 전용 — 임의 입력을 받으므로 서버 키로 열어주지 않는다.
  const usable = !!activeAiKey();

  const run = async () => {
    if (!term.trim()) return;
    if (!usable) {
      onNeedKey();
      return;
    }
    setLoading(true);
    setErr(null);
    setText(null);
    try {
      const r = await api.explain(term.trim());
      if (r.status === 401) {
        setErr('AI 키가 필요합니다');
        onNeedKey();
      } else if (!r.text) {
        setErr('풀이 실패');
      } else {
        setText(r.text);
      }
    } catch {
      setErr('풀이 실패');
    } finally {
      setLoading(false);
    }
  };

  // compact: 상단 검색줄용 — 한 줄 입력 + 결과는 아래 팝오버
  if (compact) {
    return (
      <div className="explain-compact" style={{ position: 'relative' }}>
        <input
          className="aikey-input"
          value={term}
          placeholder={`용어 풀이${!usable ? ' (키 필요)' : ''} — 예: PER, ETF`}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button className="mode-btn" onClick={run} disabled={loading}>
          {loading ? '…' : '풀이'}
        </button>
        {(text || err) && (
          <div className="explain-pop" onClick={() => { setText(null); setErr(null); }}>
            {text ? <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span> : <span className="down">{err}</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="ptitle t-magenta">
        용어 풀이 {!usable && <span className="aikey-need-tag">키 필요</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          className="aikey-input"
          style={{ flex: 1 }}
          value={term}
          placeholder="예: PER, 시가총액, ETF"
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button className="mode-btn" onClick={run} disabled={loading}>
          {loading ? '…' : '풀이'}
        </button>
      </div>
      {text && <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text}</div>}
      {!text && err && <div className="down" style={{ fontSize: 12 }}>{err}</div>}
      {!text && !err && !loading && (
        <div className="dim" style={{ fontSize: 12 }}>
          {usable ? '금융 용어를 쉽게 설명합니다.' : 'AI 키 입력 후 사용 가능'}
        </div>
      )}
    </div>
  );
}
