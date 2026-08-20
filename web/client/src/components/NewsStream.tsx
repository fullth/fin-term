import { useMemo, useState } from 'react';
import type { NewsItem, NewsScope } from '../lib/types';
import { fmtTime } from '../lib/format';
import { prepareNews, type NewsView } from '../lib/news-ranking';

interface Props {
  news: NewsItem[];
  scope: NewsScope;
  onScopeChange: (s: NewsScope) => void;
  filter: string | null;
  onClearFilter: () => void;
}

const SCOPE_LABEL: Record<NewsScope, string> = { domestic: '국내', foreign: '해외', all: '전체' };
const SCOPES: NewsScope[] = ['all', 'domestic', 'foreign'];
const VIEWS: { value: NewsView; label: string }[] = [
  { value: 'key', label: '핵심' },
  { value: 'breaking', label: '속보' },
  { value: 'all', label: '최신' },
];

export function NewsStream({ news, scope, onScopeChange, filter, onClearFilter }: Props) {
  const [view, setView] = useState<NewsView>('key');
  // 종목 필터 적용 — 해당 티커가 태깅된 기사만
  const filtered = filter ? news.filter((item) => item.tickers.includes(filter)) : news;
  const prepared = useMemo(
    () => prepareNews(filtered, view, (item) => item.tickers.length > 0),
    [filtered, view],
  );
  const numW = String(prepared.items.length).length;
  return (
    <div className="panel area-news">
      <div className="ptitle t-yellow news-panel-head">
        <span>
          NEWS STREAM <span className="sub">[{prepared.items.length}/{prepared.uniqueCount}]</span>
        </span>
        <span className="news-filter-tools">
          {filter && (
            <button className="mode-btn aikey-ok" style={{ padding: '1px 6px', marginRight: 4 }} onClick={onClearFilter}>
              {filter} ✕
            </button>
          )}
          {VIEWS.map((item) => (
            <button
              key={item.value}
              className={`mode-btn${item.value === view ? ' active' : ''}`}
              onClick={() => setView(item.value)}
            >
              {item.label}
            </button>
          ))}
          {SCOPES.map((s) => (
            <button
              key={s}
              className={`mode-btn${s === scope ? ' active' : ''}`}
              style={{ padding: '1px 6px', marginLeft: 4 }}
              onClick={() => onScopeChange(s)}
            >
              {SCOPE_LABEL[s]}
            </button>
          ))}
        </span>
      </div>
      {prepared.items.length === 0 && (
        <div className="dim">{filter ? `${filter} 관련 뉴스 없음` : view === 'breaking' ? '새로운 속보가 없습니다' : 'no headlines…'}</div>
      )}
      {prepared.items.map((n, i) => (
        <div key={n.id} className="news-row" onClick={() => window.open(n.url, '_blank', 'noopener')}>
          <span className="num">{String(i + 1).padStart(numW, ' ')}</span>
          <span className="time">{fmtTime(n.published_at)}</span>
          {n.tickers.length > 0 ? (
            <span className="tag tkr">[{n.tickers.join(',')}]</span>
          ) : (
            <span className="tag mkt">[MKT]</span>
          )}
          <span className="title">{n.title}</span>
          <span className="src">({n.source})</span>
        </div>
      ))}
    </div>
  );
}
