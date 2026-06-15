// RSS 금융 뉴스 수집 + ticker 태깅. 키 불필요, 무제한.
import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import type { NewsItem } from '../core/types.js';
import { tagTickers } from '../core/ticker-tag.js';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (fin-term)' },
  timeout: 8000,
});

function idOf(url: string, title: string): string {
  return createHash('sha1').update(url || title).digest('hex').slice(0, 12);
}

async function fetchFeed(source: string, url: string, watchlist: string[]): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? []).map((it) => {
      const title = (it.title ?? '').trim();
      const link = it.link ?? '';
      const published = it.isoDate ? Date.parse(it.isoDate) : Date.now();
      return {
        id: idOf(link, title),
        title,
        url: link,
        source,
        published_at: Number.isNaN(published) ? Date.now() : published,
        tickers: tagTickers(title, watchlist),
      };
    });
  } catch {
    return []; // 피드 하나 죽어도 전체는 계속
  }
}

export async function fetchNews(
  feeds: { source: string; url: string }[],
  watchlist: string[],
): Promise<NewsItem[]> {
  const batches = await Promise.all(feeds.map((f) => fetchFeed(f.source, f.url, watchlist)));
  const all = batches.flat();
  // id 중복제거
  const seen = new Map<string, NewsItem>();
  for (const item of all) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()].sort((a, b) => b.published_at - a.published_at);
}
