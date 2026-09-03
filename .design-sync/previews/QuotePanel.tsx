import { QuotePanel } from 'fin-term-client';

// QuotePanel is the centre-column detail card in stock mode. It takes a live
// `quote` plus a `detail` (fundamentals) for the same symbol and renders the
// header, OHLC row, a fundamentals line, and an inline Sparkline.

const AAPL_QUOTE = {
  symbol: 'AAPL',
  price: 229.87,
  change: 3.41,
  change_pct: 1.51,
  open: 226.9,
  high: 230.4,
  low: 226.1,
  prev_close: 226.46,
  spark: [226.5, 227.1, 226.8, 228.0, 227.4, 228.9, 229.6, 229.1, 230.0, 229.87],
  updated_at: Date.now(),
};

const AAPL_DETAIL = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  week52_high: 260.1,
  week52_low: 169.21,
  volume: 41_230_000,
  pe: 34.7,
  market_cap: 3_480_000, // millions
  industry: 'Consumer Electronics',
};

const SAMSUNG_QUOTE = {
  symbol: '005930',
  price: 71_800,
  change: -1_200,
  change_pct: -1.64,
  open: 73_000,
  high: 73_100,
  low: 71_500,
  prev_close: 73_000,
  spark: [73_000, 72_800, 72_400, 72_600, 72_100, 71_900, 71_600, 71_800, 71_700, 71_800],
  updated_at: Date.now(),
};

const SAMSUNG_DETAIL = {
  symbol: '005930',
  name: '삼성전자',
  week52_high: 88_800,
  week52_low: 49_900,
  volume: 12_450_000,
  pe: 12.3,
  market_cap: 428_000_000,
  industry: '반도체',
};

export const Gain = () => <QuotePanel quote={AAPL_QUOTE} detail={AAPL_DETAIL} />;

export const Loss = () => <QuotePanel quote={SAMSUNG_QUOTE} detail={SAMSUNG_DETAIL} />;

export const DetailLoading = () => <QuotePanel quote={AAPL_QUOTE} detail={null} />;

export const NoSelection = () => <QuotePanel quote={undefined} detail={null} />;

export const QuoteError = () => (
  <QuotePanel
    quote={{
      symbol: 'ZZZZ',
      price: null,
      change: null,
      change_pct: null,
      open: null,
      high: null,
      low: null,
      prev_close: null,
      spark: [],
      updated_at: Date.now(),
      error: 'no data',
    }}
    detail={null}
  />
);
