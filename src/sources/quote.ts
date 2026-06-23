// 시세 fetch. 우선순위: Finnhub(키 있으면) → Yahoo 공개 chart API(키 불필요).
import type { Quote } from '../core/types.js';

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FINNHUB_QUOTE = 'https://finnhub.io/api/v1/quote';

// 실제 브라우저 UA 로 위장 — Yahoo 가 데이터센터/봇 UA 를 차단하는 것을 우회 시도.
const UA = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchJson(url: string): Promise<any> {
  // Yahoo 가 클라우드 IP 등에서 순간 거부(429/5xx)하는 경우가 있어 1회 짧게 재시도.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

// Yahoo: 시세 + 인트라데이 스파크라인까지 한 방에.
async function fromYahoo(symbol: string): Promise<Quote> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
  const data = await fetchJson(url);
  const r = data?.chart?.result?.[0];
  if (!r) throw new Error('no data');

  const meta = r.meta ?? {};
  const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
  const spark = closes.filter((n): n is number => typeof n === 'number');

  const price = meta.regularMarketPrice ?? spark.at(-1) ?? null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change = price != null && prev != null ? price - prev : null;
  const change_pct = change != null && prev ? (change / prev) * 100 : null;

  return {
    symbol,
    price,
    change,
    change_pct,
    open: meta.regularMarketOpen ?? spark[0] ?? null,
    high: meta.regularMarketDayHigh ?? (spark.length ? Math.max(...spark) : null),
    low: meta.regularMarketDayLow ?? (spark.length ? Math.min(...spark) : null),
    prev_close: prev,
    spark: spark.slice(-40),
    updated_at: Date.now(),
  };
}

// ── 네이버 폴백 (Yahoo 429 차단 대응) ──────────────────────────────
// 심볼 → 네이버 reutersCode(예: NVDA.O) 캐시. 자동완성 API 로 해석.
const reutersCache = new Map<string, string | null>();

async function resolveReutersCode(symbol: string): Promise<string | null> {
  if (reutersCache.has(symbol)) return reutersCache.get(symbol)!;
  try {
    const data = await fetchJson(`https://ac.stock.naver.com/ac?q=${encodeURIComponent(symbol)}&target=stock`);
    const items: { code?: string; reutersCode?: string; category?: string }[] = data?.items ?? [];
    // 심볼이 정확히 일치하는 해외주식 우선
    const hit = items.find((it) => it.code?.toUpperCase() === symbol.toUpperCase() && it.reutersCode) ?? items[0];
    const code = hit?.reutersCode ?? null;
    reutersCache.set(symbol, code);
    return code;
  } catch {
    reutersCache.set(symbol, null);
    return null;
  }
}

// 네이버 해외주식 시세. open/high/low·스파크라인은 미제공 → null/빈배열.
async function fromNaver(symbol: string): Promise<Quote> {
  const reuters = await resolveReutersCode(symbol);
  if (!reuters) throw new Error('no reuters code');
  const d = await fetchJson(`https://api.stock.naver.com/stock/${encodeURIComponent(reuters)}/basic`);
  const price = d?.closePrice != null ? Number(String(d.closePrice).replace(/,/g, '')) : null;
  if (price == null || !Number.isFinite(price)) throw new Error('no data');
  const change = d?.compareToPreviousClosePrice != null ? Number(String(d.compareToPreviousClosePrice).replace(/,/g, '')) : null;
  const change_pct = d?.fluctuationsRatio != null ? Number(String(d.fluctuationsRatio).replace(/,/g, '')) : null;
  const prev_close = change != null ? price - change : null;
  const halted = d?.tradeStopType?.name === 'HALTED';
  return {
    symbol,
    price,
    change,
    change_pct,
    open: null,
    high: null,
    low: null,
    prev_close,
    spark: [],
    updated_at: Date.now(),
    ...(halted ? { halted: true } : {}),
  };
}

// Finnhub: 스파크라인 미제공 → price/change 만. 키 있을 때만.
async function fromFinnhub(symbol: string, key: string): Promise<Quote> {
  const url = `${FINNHUB_QUOTE}?symbol=${encodeURIComponent(symbol)}&token=${key}`;
  const d = await fetchJson(url);
  // Finnhub: c=current, d=change, dp=pct, o/h/l, pc=prevClose
  if (d.c == null || d.c === 0) throw new Error('no data');
  return {
    symbol,
    price: d.c,
    change: d.d ?? null,
    change_pct: d.dp ?? null,
    open: d.o ?? null,
    high: d.h ?? null,
    low: d.l ?? null,
    prev_close: d.pc ?? null,
    spark: [],
    updated_at: Date.now(),
  };
}

export async function fetchQuote(symbol: string, finnhubKey?: string): Promise<Quote> {
  // 소스 우선순위: Finnhub(키) → Yahoo → 네이버. Yahoo 가 429 로 막히면 네이버가 받친다.
  const sources: (() => Promise<Quote>)[] = [];
  if (finnhubKey) sources.push(() => fromFinnhub(symbol, finnhubKey));
  sources.push(() => fromYahoo(symbol));
  sources.push(() => fromNaver(symbol));

  let lastErr: unknown;
  for (const src of sources) {
    try {
      return await src();
    } catch (e) {
      lastErr = e;
    }
  }
  {
    const e = lastErr;
    return {
      symbol,
      price: null,
      change: null,
      change_pct: null,
      open: null,
      high: null,
      low: null,
      prev_close: null,
      spark: [],
      updated_at: Date.now(),
      error: e instanceof Error ? e.message : 'fetch failed',
    };
  }
}

export async function fetchQuotes(symbols: string[], finnhubKey?: string): Promise<Quote[]> {
  return Promise.all(symbols.map((s) => fetchQuote(s, finnhubKey)));
}
