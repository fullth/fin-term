// 도메인 모델. 외부 API 페이로드와 분리된 내부 타입.

export interface Quote {
  symbol: string;
  price: number | null;
  change: number | null; // 절대 변동
  change_pct: number | null; // % 변동
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  spark: number[]; // 인트라데이 가격 샘플 (스파크라인용)
  updated_at: number; // epoch ms
  error?: string;
}

export interface NewsItem {
  id: string; // 중복제거 키 (url 해시)
  title: string;
  url: string;
  source: string;
  published_at: number; // epoch ms
  tickers: string[]; // watchlist 매칭 결과
}

export type QuoteMap = Record<string, Quote>;
