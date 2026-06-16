// RSS 금융 뉴스 수집 + ticker 태깅. scope 에 따라 국내/해외 피드 선택. 번역 없음.
import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import type { NewsItem, NewsScope } from '../core/types.js';
import type { Feed } from '../config.js';
import { tagTickers } from '../core/ticker-tag.js';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (fin-term)' },
  timeout: 8000,
});

function idOf(url: string, title: string): string {
  return createHash('sha1').update(url || title).digest('hex').slice(0, 12);
}

async function fetchFeed(feed: Feed, watchlist: string[]): Promise<NewsItem[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items ?? []).map((it) => {
      const title = (it.title ?? '').trim();
      const link = it.link ?? '';
      const published = it.isoDate ? Date.parse(it.isoDate) : Date.now();
      return {
        id: idOf(link, title),
        title,
        lang: feed.lang,
        url: link,
        source: feed.source,
        published_at: Number.isNaN(published) ? Date.now() : published,
        tickers: tagTickers(title, watchlist),
      };
    });
  } catch {
    return []; // 피드 하나 죽어도 전체는 계속
  }
}

// scope 에 맞는 피드만 추림. domestic=ko, foreign=en, all=둘 다.
function feedsForScope(feeds: Feed[], scope: NewsScope): Feed[] {
  if (scope === 'all') return feeds;
  const target = scope === 'domestic' ? 'ko' : 'en';
  return feeds.filter((f) => f.lang === target);
}

export async function fetchNews(
  feeds: Feed[],
  watchlist: string[],
  scope: NewsScope = 'all',
): Promise<NewsItem[]> {
  const activeFeeds = feedsForScope(feeds, scope);
  const batches = await Promise.all(activeFeeds.map((f) => fetchFeed(f, watchlist)));
  const all = batches.flat();

  // id 중복제거 후 최신순 정렬
  const seen = new Map<string, NewsItem>();
  for (const item of all) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()].sort((a, b) => b.published_at - a.published_at);
}
