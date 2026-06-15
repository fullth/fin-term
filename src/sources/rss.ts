// RSS 금융 뉴스 수집 + ticker 태깅 + (선택) 영문 헤드라인 한글 번역.
import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import type { NewsItem } from '../core/types.js';
import type { Feed } from '../config.js';
import { tagTickers } from '../core/ticker-tag.js';
import { translateBatch, getTranslation } from '../sources/translate.js';

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

interface FetchOpts {
  translateToKo?: boolean; // lang=ko 표시 모드일 때만 영문 번역
  deeplKey?: string;
}

export async function fetchNews(
  feeds: Feed[],
  watchlist: string[],
  opts: FetchOpts = {},
): Promise<NewsItem[]> {
  // ko 표시 모드인데 DeepL 키가 없으면 영문 헤드라인을 번역할 수 없으므로
  // 영문 피드를 아예 제외하고 한글 피드만 가져온다 (영문이 주르륵 나오는 것 방지).
  const activeFeeds =
    opts.translateToKo && !opts.deeplKey ? feeds.filter((f) => f.lang === 'ko') : feeds;
  const batches = await Promise.all(activeFeeds.map((f) => fetchFeed(f, watchlist)));
  const all = batches.flat();

  // id 중복제거
  const seen = new Map<string, NewsItem>();
  for (const item of all) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  const items = [...seen.values()].sort((a, b) => b.published_at - a.published_at);

  // 한글 표시 모드 + DeepL 키 있으면 영문 헤드라인 번역
  if (opts.translateToKo && opts.deeplKey) {
    const enTitles = items.filter((n) => n.lang === 'en').map((n) => n.title);
    await translateBatch(enTitles, opts.deeplKey);
    for (const n of items) {
      if (n.lang === 'en') n.title_ko = getTranslation(n.title);
    }
  }

  return items;
}
