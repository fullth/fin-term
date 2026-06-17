// 코인 뉴스. 구글 뉴스 RSS(한국어, 비트코인/이더리움/리플/비트코인캐시) → NewsItem.
import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import type { NewsItem } from '../core/types.js';

// 비트코인 OR 이더리움 OR 리플 OR 비트코인캐시 (한국어, 한국)
const FEED =
  'https://news.google.com/rss/search?q=%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8+OR+%EC%9D%B4%EB%8D%94%EB%A6%AC%EC%9B%80+OR+%EB%A6%AC%ED%94%8C+OR+%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8%EC%BA%90%EC%8B%9C&hl=ko&gl=KR&ceid=KR:ko';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (fin-term)' },
  timeout: 8000,
});

function idOf(url: string, title: string): string {
  return createHash('sha1').update(url || title).digest('hex').slice(0, 12);
}

export async function fetchCryptoNews(): Promise<NewsItem[]> {
  try {
    const parsed = await parser.parseURL(FEED);
    const items = (parsed.items ?? []).map((it) => {
      const title = (it.title ?? '').trim();
      const link = it.link ?? '';
      const published = it.isoDate ? Date.parse(it.isoDate) : NaN;
      return {
        id: idOf(link, title),
        title,
        lang: 'ko' as const,
        url: link,
        source: 'Google News',
        // 파싱 실패 시 0 으로 둬 최신순 정렬에서 맨 뒤로 (Date.now() 로 채우면 상단 몰림)
        published_at: Number.isNaN(published) ? 0 : published,
        tickers: [],
      };
    });
    return items.sort((a, b) => b.published_at - a.published_at);
  } catch {
    return [];
  }
}
