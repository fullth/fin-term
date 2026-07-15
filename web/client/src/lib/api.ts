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

  // AI 데일리 브리핑 — SSE 스트리밍. 델타를 onChunk 로 흘리고, 완료 시 누적 본문을 반환.
  // 서버 키 없음(401)이면 status=401, text=null. 스트림 에러면 error 세팅.
  brief: async (onChunk: (delta: string) => void) => {
    const res = await fetch('/api/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...aiHeaders() },
    });
    if (res.status !== 200 || !res.body) {
      return { status: res.status, text: null, error: 'no_server_key' } as { status: number; text: string | null; error?: string };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let text = '';
    let error: string | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // CRLF 가 네트워크 청크 경계에서 나뉘어도 합친 버퍼에서 정규화한다.
      buf = (buf + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      // SSE 이벤트는 빈 줄로 구분. 완성된 이벤트만 처리하고 나머지는 버퍼에 남긴다.
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const part of parts) {
        const ev = /event:\s*(\w+)/.exec(part)?.[1];
        const dataLine = /data:\s*(.*)/.exec(part)?.[1];
        if (ev === 'chunk' && dataLine) {
          try {
            const delta = (JSON.parse(dataLine) as { delta: string }).delta;
            text += delta;
            onChunk(delta);
          } catch {
            /* 파싱 실패한 이벤트는 무시 */
          }
        } else if (ev === 'error') {
          error = 'stream_error';
        }
      }
    }
    return { status: 200, text: text || null, error } as { status: number; text: string | null; error?: string };
  },

  explain: (term: string) =>
    fetch(`/api/explain?term=${encodeURIComponent(term)}`, { headers: aiHeaders() }).then(
      async (r) => ({ status: r.status, ...(await r.json()) } as { status: number; text: string | null; error?: string }),
    ),

  aiStatus: () => getJson<{ serverKey: boolean }>('/api/ai-status'),

  // 방문 기록 — 페이지 로드 시 1회. 실패해도 앱에 영향 없도록 호출부에서 무시.
  visit: () =>
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname }),
    }),
};
