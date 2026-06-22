// 한국 종목·지수 시세 — 네이버 금융 API. Yahoo 가 Railway IP 를 차단하는 것을 우회.
// 미국 종목은 Finnhub(quote.ts), 한국(.KS/.KQ)·국내지수는 여기서 처리.
import type { Quote } from '../../../src/core/types.js';

const NAVER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://m.stock.naver.com/',
  Accept: 'application/json',
};

// 심볼이 한국 종목(.KS/.KQ) 또는 국내 지수(^KS11/^KQ11)인지
export function isKrSymbol(symbol: string): boolean {
  return /\.(KS|KQ)$/i.test(symbol) || symbol === '^KS11' || symbol === '^KQ11';
}

// Yahoo 심볼 → 네이버 코드. 005930.KS → 005930, ^KS11 → KOSPI, ^KQ11 → KOSDAQ
function toNaverCode(symbol: string): { code: string; isIndex: boolean } {
  if (symbol === '^KS11') return { code: 'KOSPI', isIndex: true };
  if (symbol === '^KQ11') return { code: 'KOSDAQ', isIndex: true };
  return { code: symbol.replace(/\.(KS|KQ)$/i, ''), isIndex: false };
}

function num(s: unknown): number | null {
  if (s == null) return null;
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

async function fetchNaverJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: NAVER_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
      else throw e;
    }
  }
}

function emptyQuote(symbol: string, error?: string): Quote {
  return {
    symbol, price: null, change: null, change_pct: null, open: null, high: null,
    low: null, prev_close: null, spark: [], updated_at: Date.now(), error,
  };
}

// 개별 종목: /api/stock/{code}/basic
async function fetchKrStock(symbol: string): Promise<Quote> {
  const { code } = toNaverCode(symbol);
  try {
    const d = await fetchNaverJson(`https://m.stock.naver.com/api/stock/${code}/basic`);
    const price = num(d.closePrice);
    const change = num(d.compareToPreviousClosePrice);
    const pct = num(d.fluctuationsRatio);
    const dir = d.compareToPreviousPrice?.name; // RISING/FALLING/...
    const signedChange = change == null ? null : dir === 'FALLING' ? -Math.abs(change) : Math.abs(change);
    return {
      symbol,
      price,
      change: signedChange,
      change_pct: pct,
      open: num(d.openPrice),
      high: num(d.highPrice),
      low: num(d.lowPrice),
      prev_close: price != null && signedChange != null ? price - signedChange : null,
      spark: [],
      updated_at: Date.now(),
    };
  } catch (e) {
    return emptyQuote(symbol, e instanceof Error ? e.message : 'fetch failed');
  }
}

// 지수: /api/index/{KOSPI|KOSDAQ}/basic
async function fetchKrIndex(symbol: string): Promise<Quote> {
  const { code } = toNaverCode(symbol);
  try {
    const d = await fetchNaverJson(`https://m.stock.naver.com/api/index/${code}/basic`);
    const price = num(d.closePrice);
    const change = num(d.compareToPreviousClosePrice);
    const pct = num(d.fluctuationsRatio);
    const dir = d.compareToPreviousPrice?.name;
    const signedChange = change == null ? null : dir === 'FALLING' ? -Math.abs(change) : Math.abs(change);
    return {
      symbol, price, change: signedChange, change_pct: pct,
      open: null, high: null, low: null,
      prev_close: price != null && signedChange != null ? price - signedChange : null,
      spark: [], updated_at: Date.now(),
    };
  } catch (e) {
    return emptyQuote(symbol, e instanceof Error ? e.message : 'fetch failed');
  }
}

export async function fetchKrQuote(symbol: string): Promise<Quote> {
  return toNaverCode(symbol).isIndex ? fetchKrIndex(symbol) : fetchKrStock(symbol);
}

export async function fetchKrQuotes(symbols: string[]): Promise<Quote[]> {
  return Promise.all(symbols.map(fetchKrQuote));
}
