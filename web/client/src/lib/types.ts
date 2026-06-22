// 도메인 타입 — 루트 src/core/types.ts 와 동일. 클라이언트는 BFF JSON 응답을 이 형태로 받는다.
// (루트 파일을 직접 import 하지 않고 재선언: 클라/서버 빌드 경계를 분리)
export interface Quote {
  symbol: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  spark: number[];
  updated_at: number;
  error?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  lang: 'en' | 'ko';
  url: string;
  source: string;
  published_at: number;
  tickers: string[];
}

export type NewsScope = 'domestic' | 'foreign' | 'all';
export type QuoteMap = Record<string, Quote>;

export interface Detail {
  symbol: string;
  name?: string;
  week52_high?: number | null;
  week52_low?: number | null;
  volume?: number | null;
  pe?: number | null;
  market_cap?: number | null;
  industry?: string;
  exchange?: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export interface HotItem {
  symbol: string;
  name: string;
  price: number | null;
  change_pct: number | null;
}

export interface LabelEntry {
  symbol: string;
  label: string;
}

export interface CoinQuote {
  id: string;
  symbol: string;
  name: string;
  upbitMarket: string;
  price_krw: number | null;
  price_usd: number | null;
  change_1h: number | null;
  change_24h: number | null;
  change_7d: number | null;
  spark: number[];
}

export interface UpbitTick {
  market: string;
  trade_price: number;
  change_rate: number;
  change: 'RISE' | 'FALL' | 'EVEN';
}

export interface CoinMeta {
  id: string;
  symbol: string;
  name: string;
  upbitMarket: string;
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  upbitMarket: string;
}

export interface CoinNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: number;
}
