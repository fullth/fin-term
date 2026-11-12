import { openNews } from '../lib/open-news';
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
  const [view, setView] = useState<NewsView>('all');
  // 종목 필터 적용 — 해당 티커가 태깅된 기사만
  const filtered = filter ? news.filter((item) => item.tickers.includes(filter)) : news;
  const prepared = useMemo(
    () => prepareNews(filtered, view, (item) => item.tickers.length > 0),
    [filtered, view],
  );
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
          <select className="news-select" aria-label="뉴스 보기 방식" value={view} onChange={(event) => setView(event.target.value as NewsView)}>
            {VIEWS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select className="news-select" aria-label="뉴스 지역" value={scope} onChange={(event) => onScopeChange(event.target.value as NewsScope)}>
            {SCOPES.map((item) => <option key={item} value={item}>{SCOPE_LABEL[item]}</option>)}
          </select>
        </span>
      </div>
      {prepared.items.length === 0 && (
        <div className="dim">{filter ? `${filter} 관련 뉴스 없음` : view === 'breaking' ? '새로운 속보가 없습니다' : '뉴스를 불러오는 중…'}</div>
      )}
      {prepared.items.map((n) => (
        <div key={n.id} className="news-row" onClick={() => openNews(n.url)}>
          <span className="time">{fmtTime(n.published_at)}</span>
          {n.tickers.length > 0 ? (
            <span className="tag tkr">[{n.tickers.join(',')}]</span>
          ) : null}
          <span className="title">{n.title}</span>
          <span className="src">({n.source})</span>
        </div>
      ))}
    </div>
  );
}
