import { openNews } from '../lib/open-news';
import { useMemo, useState } from 'react';
import type { CoinNewsItem } from '../lib/types';
import { fmtTime } from '../lib/format';
import { prepareNews, type NewsView } from '../lib/news-ranking';

const VIEWS: { value: NewsView; label: string }[] = [
  { value: 'key', label: '핵심' },
  { value: 'breaking', label: '속보' },
  { value: 'all', label: '최신' },
];

export function CoinNewsStream({ news }: { news: CoinNewsItem[] }) {
  const [view, setView] = useState<NewsView>('all');
  const prepared = useMemo(() => prepareNews(news, view), [news, view]);

  return (
    <div className="panel area-news">
      <div className="ptitle t-yellow news-panel-head">
        <span>
          COIN NEWS <span className="sub">[{prepared.items.length}/{prepared.uniqueCount}]</span>
        </span>
        <span className="news-view-tabs" aria-label="코인 뉴스 보기 방식">
          <select className="news-select" aria-label="코인 뉴스 보기 방식" value={view} onChange={(event) => setView(event.target.value as NewsView)}>
            {VIEWS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </span>
      </div>
      {prepared.items.length === 0 && <div className="dim">{view === 'breaking' ? '새로운 속보가 없습니다' : '불러오는 중…'}</div>}
      {prepared.items.map((item) => (
        <div key={item.id} className="news-row" onClick={() => openNews(item.url)}>
          <span className="time">{fmtTime(item.published_at)}</span>
          <span className="title">{item.title}</span>
          <span className="src">({item.source})</span>
        </div>
      ))}
    </div>
  );
}
