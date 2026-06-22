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
  const usable = !!activeAiKey() || hasServerKey;

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
        setErr('AI 키가 필요합니다');
        onNeedKey();
      } else if (!r.text) {
        setErr('생성 실패 — 키가 유효한지 확인하세요');
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
    <div className="panel">
      <div className="ptitle t-magenta" style={{ justifyContent: 'space-between' }}>
        <span>AI 시장 브리핑 {!usable && <span className="aikey-need-tag">키 필요</span>}</span>
        <button className="mode-btn" onClick={run} disabled={loading} style={{ padding: '2px 8px' }}>
          {loading ? '생성 중…' : text ? '다시' : '생성'}
        </button>
      </div>
      {text && <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text}</div>}
      {!text && err && <div className="down" style={{ fontSize: 12 }}>{err}</div>}
      {!text && !err && !loading && (
        <div className="dim" style={{ fontSize: 12 }}>
          {usable ? '관심종목+뉴스로 오늘 시장 요약을 생성합니다.' : 'AI 키 입력 후 사용 가능 (상단 AI 키)'}
        </div>
      )}
    </div>
  );
}

interface ExplainProps {
  hasServerKey: boolean;
  onNeedKey: () => void;
}

export function ExplainPanel({ hasServerKey, onNeedKey }: ExplainProps) {
  const [term, setTerm] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const usable = !!activeAiKey() || hasServerKey;

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
