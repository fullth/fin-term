// BFF 호출 래퍼. 개발은 Vite 프록시(/api → :8787), 운영은 동일 출처.
import type {
  Quote, NewsItem, NewsScope, Detail, SearchResult, HotItem, LabelEntry,
  CoinQuote, CoinMeta, CoinSearchResult, CoinNewsItem,
} from './types';
import { activeAiKey } from './ai-key';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// AI 요청용 헤더 — 브라우저에 저장된 키를 X-AI-Key 로 전송 (없으면 미첨부).
function aiHeaders(): Record<string, string> {
  const k = activeAiKey();
  return k ? { 'X-AI-Key': k } : {};
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

  // AI 데일리 브리핑 — 시장 전반(개인화 없음). 서버가 시장 데이터를 직접 모으므로 입력 불필요.
  brief: () =>
    fetch('/api/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...aiHeaders() },
    }).then(async (r) => ({ status: r.status, ...(await r.json()) } as { status: number; text: string | null; error?: string })),

  explain: (term: string) =>
    fetch(`/api/explain?term=${encodeURIComponent(term)}`, { headers: aiHeaders() }).then(
      async (r) => ({ status: r.status, ...(await r.json()) } as { status: number; text: string | null; error?: string }),
    ),

  aiStatus: () => getJson<{ serverKey: boolean }>('/api/ai-status'),
};
