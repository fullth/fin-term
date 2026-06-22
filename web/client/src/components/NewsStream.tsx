import type { NewsItem, NewsScope } from '../lib/types';
import { fmtTime } from '../lib/format';

interface Props {
  news: NewsItem[];
  scope: NewsScope;
  onScopeChange: (s: NewsScope) => void;
  filter: string | null;
  onClearFilter: () => void;
}

const SCOPE_LABEL: Record<NewsScope, string> = { domestic: '국내', foreign: '해외', all: '전체' };
const SCOPES: NewsScope[] = ['all', 'domestic', 'foreign'];

export function NewsStream({ news, scope, onScopeChange, filter, onClearFilter }: Props) {
  // 종목 필터 적용 — 해당 티커가 태깅된 기사만
  const shown = filter ? news.filter((n) => n.tickers.includes(filter)) : news;
  const numW = String(shown.length).length;
  return (
    <div className="panel area-news">
      <div className="ptitle t-yellow" style={{ justifyContent: 'space-between' }}>
        <span>
          NEWS STREAM <span className="sub">[{shown.length}]</span>
        </span>
        <span className="sub">
          {filter && (
            <button className="mode-btn aikey-ok" style={{ padding: '1px 6px', marginRight: 4 }} onClick={onClearFilter}>
              {filter} ✕
            </button>
          )}
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
      {shown.length === 0 && <div className="dim">{filter ? `${filter} 관련 뉴스 없음` : 'no headlines…'}</div>}
      {shown.map((n, i) => (
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
