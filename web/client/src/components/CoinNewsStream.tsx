import { useMemo, useState } from 'react';
import type { CoinNewsItem } from '../lib/types';
import { fmtTime } from '../lib/format';
import { prepareNews, type NewsView } from '../lib/news-ranking';

const VIEWS: { value: NewsView; label: string }[] = [
  { value: 'key', label: '핵심' },
  { value: 'breaking', label: '속보' },
  { value: 'all', label: '전체' },
];

export function CoinNewsStream({ news }: { news: CoinNewsItem[] }) {
  const [view, setView] = useState<NewsView>('key');
  const prepared = useMemo(() => prepareNews(news, view), [news, view]);

  return (
    <div className="panel area-news">
      <div className="ptitle t-yellow news-panel-head">
        <span>
          COIN NEWS <span className="sub">[{prepared.items.length}/{prepared.uniqueCount}]</span>
        </span>
        <span className="news-view-tabs" aria-label="코인 뉴스 보기 방식">
          {VIEWS.map((item) => (
            <button
              key={item.value}
              className={`mode-btn${view === item.value ? ' active' : ''}`}
              onClick={() => setView(item.value)}
            >
              {item.label}
            </button>
          ))}
        </span>
      </div>
      {prepared.items.length === 0 && <div className="dim">{view === 'breaking' ? '새로운 속보가 없습니다' : '불러오는 중…'}</div>}
      {prepared.items.map((item, index) => (
        <div key={item.id} className="news-row" onClick={() => window.open(item.url, '_blank', 'noopener')}>
          <span className="num">{index + 1}</span>
          <span className="time">{fmtTime(item.published_at)}</span>
          <span className="tag mkt">[COIN]</span>
          <span className="title">{item.title}</span>
          <span className="src">({item.source})</span>
        </div>
      ))}
    </div>
  );
}
