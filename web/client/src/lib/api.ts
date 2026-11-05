// BFF 호출 래퍼. 개발은 Vite 프록시(/api → :8787), 운영은 동일 출처.
import type {
  Quote, NewsItem, NewsScope, Detail, SearchResult, HotItem, LabelEntry,
  CoinQuote, CoinMeta, CoinSearchResult, CoinNewsItem,
} from './types';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  quotes: (symbols: string[]) =>
    getJson<{ quotes: Quote[] }>(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`),

  markets: () =>
    getJson<{ indices: Quote[]; markets: Quote[]; labels: { indices: LabelEntry[]; markets: LabelEntry[] } }>(
      '/api/markets',
    ),

  news: (scope: NewsScope, watchlist: string[]) =>
    getJson<{ news: NewsItem[] }>(
      `/api/news?scope=${scope}&watchlist=${encodeURIComponent(watchlist.join(','))}`,
    ),

  detail: (symbol: string) => getJson<{ detail: Detail }>(`/api/detail/${encodeURIComponent(symbol)}`),

  search: (q: string) => getJson<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`),

  hot: () => getJson<{ items: HotItem[] }>('/api/hot'),

  crypto: (coins: CoinMeta[]) => {
    const param = coins.map((c) => `${c.id}:${c.symbol}:${c.upbitMarket}`).join(',');
    return getJson<{ coins: CoinQuote[] }>(`/api/crypto?coins=${encodeURIComponent(param)}`);
  },

  cryptoSearch: (q: string) => getJson<{ results: CoinSearchResult[] }>(`/api/crypto/search?q=${encodeURIComponent(q)}`),

  cryptoNews: () => getJson<{ news: CoinNewsItem[] }>('/api/crypto/news'),

  brief: () => getJson<{ briefs: { day: string; text: string; generated_at: number }[] }>('/api/brief'),

  // 방문 기록 — 페이지 로드 시 1회. 실패해도 앱에 영향 없도록 호출부에서 무시.
  visit: () =>
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname }),
    }),
};
