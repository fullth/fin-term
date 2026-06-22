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
      // pubDate(isoDate) 우선, 없으면 RSS pubDate 원문 파싱. 둘 다 실패면 0(맨 뒤).
      // Date.now() 폴백은 날짜 없는 기사를 매 폴링마다 상단으로 끌어올려 정렬을 망친다.
      const rawDate = it.isoDate ?? (it as { pubDate?: string }).pubDate;
      const parsed = rawDate ? Date.parse(rawDate) : NaN;
      return {
        id: idOf(link, title),
        title,
        lang: feed.lang,
        url: link,
        source: feed.source,
        published_at: Number.isNaN(parsed) ? 0 : parsed,
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

  // id 중복제거
  const seen = new Map<string, NewsItem>();
  for (const item of all) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  const items = [...seen.values()].sort((a, b) => b.published_at - a.published_at);

  // 단일 scope(국내/해외)는 최신순 그대로. '전체'는 국내·해외를 교차 배치한다.
  // 해외 피드 타임스탬프가 더 최근이라 순수 최신순이면 상단을 영어가 독점하는 문제 해소.
  if (scope !== 'all') return items;
  return interleaveByLang(items);
}

// 국내(ko)·해외(en)를 각각 최신순으로 둔 뒤 번갈아 끼운다. 한쪽이 끝나면 나머지를 이어붙임.
function interleaveByLang(items: NewsItem[]): NewsItem[] {
  const ko = items.filter((n) => n.lang === 'ko');
  const en = items.filter((n) => n.lang === 'en');
  const merged: NewsItem[] = [];
  const max = Math.max(ko.length, en.length);
  for (let i = 0; i < max; i++) {
    if (i < ko.length) merged.push(ko[i]);
    if (i < en.length) merged.push(en[i]);
  }
  return merged;
}
