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
  title: string; // 원문 제목 (번역 없음)
  lang: 'en' | 'ko'; // 원문 언어 (domestic=ko, foreign=en)
  url: string;
  source: string;
  published_at: number; // epoch ms
  tickers: string[]; // watchlist 매칭 결과
}

// 뉴스 범위 토글. domestic=국내(한글) 피드, foreign=해외(영문) 피드, all=둘 다.
export type NewsScope = 'domestic' | 'foreign' | 'all';

export type QuoteMap = Record<string, Quote>;

// --- 코인 모니터 도메인 (업비트 KRW) ---

// 보유 내역. ~/.fin-term/holdings.json 에서 로드. 외부 파일 페이로드와 분리된 내부 모델.
export interface Holding {
  id: string; // 코인 id (예: bitcoin) — 업비트 마켓 매핑 키
  symbol: string; // 표시용 심볼 (예: BTC)
  quantity: number; // 보유 수량
  avg_buy_krw: number; // 평균 매수 단가 (KRW)
  buy_amount_krw: number; // 총 매수 금액 (KRW). 없으면 quantity*avg_buy_krw 로 보강
}

// 보유 스냅샷 = 보유 내역 + 현재가 기준 평가/손익/수익률.
export interface HoldingSnapshot extends Holding {
  current_price_krw: number;
  current_value_krw: number;
  pnl_krw: number;
  return_pct: number | null;
}

// 업비트 실시간 티커 (웹소켓). KRW 기준 코인 시세.
export interface CryptoTicker {
  id: string; // 내부 코인 id
  symbol: string;
  market: string; // 업비트 마켓 코드 (예: KRW-BTC)
  price_krw: number;
  change_pct_24h: number; // 24시간 변동률(%)
  high_24h: number;
  low_24h: number;
  acc_trade_price_24h: number; // 24시간 누적 거래대금
  updated_at: number; // epoch ms
}

// 캔들 한 봉.
export interface Candle {
  timestamp: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
}

// 차트 기간. 업비트 캔들 endpoint/count 매핑은 sources/upbit.ts.
export type ChartTimeframe = 'minute-1' | 'minute-60' | 'day-1' | 'day-7' | 'month-1';

export type CryptoTickerMap = Record<string, CryptoTicker>; // key = 코인 id

// 실시간 피드 상태.
export type FeedStatus = 'polling' | 'connecting' | 'live' | 'reconnecting' | 'error';
