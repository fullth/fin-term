// 한국 종목·지수 시세 — 네이버 금융 API. Yahoo 가 Railway IP 를 차단하는 것을 우회.
// 미국 종목은 Finnhub(quote.ts), 한국(.KS/.KQ)·국내지수는 여기서 처리.
import type { Quote } from '../../../src/core/types.js';

const NAVER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://m.stock.naver.com/',
  Accept: 'application/json',
};

// Yahoo 심볼 → 네이버 시세 소스 매핑.
// kind: kr-stock(국내종목) / index(국내·해외 지수) / market(환율·원자재 productDetail)
// kr-index: 국내 지수(m.stock/api/index) / index: 해외 지수(api.stock/index) / market: 환율·원자재
type NaverKind = 'kr-index' | 'index' | 'market';
const NAVER_MAP: Record<string, { kind: NaverKind; code: string; category?: string }> = {
  // 국내 지수 (m.stock.naver.com/api/index/{KOSPI|KOSDAQ}/basic)
  '^KS11': { kind: 'kr-index', code: 'KOSPI' },
  '^KQ11': { kind: 'kr-index', code: 'KOSDAQ' },
  // 해외 지수 (api.stock.naver.com/index/{code}/basic)
  '^GSPC': { kind: 'index', code: '.INX' },
  '^IXIC': { kind: 'index', code: '.IXIC' },
  '^DJI': { kind: 'index', code: '.DJI' },
  // 환율·원자재 (front-api/marketIndex/productDetail)
  'KRW=X': { kind: 'market', code: 'FX_USDKRW', category: 'exchange' },
  'DX-Y.NYB': { kind: 'market', code: '.DXY', category: 'exchange' },
  'CL=F': { kind: 'market', code: 'CLcv1', category: 'energy' },
  'GC=F': { kind: 'market', code: 'GCcv1', category: 'metals' },
  // BTC-USD 는 업비트로 처리(여기선 제외)
};

// 네이버로 조회 가능한 심볼인지 (한국 종목 .KS/.KQ + 매핑 테이블)
export function isKrSymbol(symbol: string): boolean {
  return /\.(KS|KQ)$/i.test(symbol) || symbol in NAVER_MAP;
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

// 네이버 basic/productDetail 공통 필드 → Quote
function toQuote(symbol: string, d: any, withOHLC: boolean): Quote {
  const price = num(d.closePrice) ?? num(d.calcPrice);
  const change = num(d.compareToPreviousClosePrice);
  const pct = num(d.fluctuationsRatio);
  const dir = d.compareToPreviousPrice?.name; // RISING/FALLING/...
  const signedChange = change == null ? null : dir === 'FALLING' ? -Math.abs(change) : Math.abs(change);
  return {
    symbol,
    price,
    change: signedChange,
    change_pct: pct,
    open: withOHLC ? num(d.openPrice) : null,
    high: withOHLC ? num(d.highPrice) : null,
    low: withOHLC ? num(d.lowPrice) : null,
    prev_close: price != null && signedChange != null ? price - signedChange : null,
    spark: [],
    updated_at: Date.now(),
  };
}

export async function fetchKrQuote(symbol: string): Promise<Quote> {
  try {
    const mapped = NAVER_MAP[symbol];
    if (!mapped) {
      // 한국 개별종목 (.KS/.KQ)
      const code = symbol.replace(/\.(KS|KQ)$/i, '');
      const d = await fetchNaverJson(`https://m.stock.naver.com/api/stock/${code}/basic`);
      return toQuote(symbol, d, true);
    }
    if (mapped.kind === 'kr-index') {
      // 국내 지수 — m.stock 경로
      const d = await fetchNaverJson(`https://m.stock.naver.com/api/index/${mapped.code}/basic`);
      return toQuote(symbol, d, false);
    }
    if (mapped.kind === 'index') {
      // 해외 지수 — api.stock 경로
      const d = await fetchNaverJson(`https://api.stock.naver.com/index/${mapped.code}/basic`);
      return toQuote(symbol, d, false);
    }
    // market(환율·원자재): productDetail → result 안에 데이터
    const wrap = await fetchNaverJson(
      `https://m.stock.naver.com/front-api/marketIndex/productDetail?category=${mapped.category}&reutersCode=${mapped.code}`,
    );
    return toQuote(symbol, wrap?.result ?? {}, false);
  } catch (e) {
    return emptyQuote(symbol, e instanceof Error ? e.message : 'fetch failed');
  }
}

export async function fetchKrQuotes(symbols: string[]): Promise<Quote[]> {
  return Promise.all(symbols.map(fetchKrQuote));
}
