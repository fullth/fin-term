import { HotPanel } from 'fin-term-client';

// HotPanel is the right-column "급상승 종목" list. Each row: market chip
// (KR/US), rank + symbol, name, price/change, an optional sector + volume
// meta line, and nested headlines.

const ITEMS = [
  {
    symbol: '042700',
    name: '한미반도체',
    price: 138_400,
    change_pct: 12.7,
    market: 'KR' as const,
    sector: '반도체장비',
    volume: 3_120_000,
    news: [
      { title: 'HBM 장비 수주 확대 기대감에 급등', source: '이데일리', url: '#' },
      { title: '외국인·기관 동반 순매수', source: '한국경제', url: '' },
    ],
  },
  {
    symbol: 'SMCI',
    name: 'Super Micro Computer',
    price: 48.2,
    change_pct: 9.4,
    market: 'US' as const,
    sector: 'Technology',
    volume: 22_500_000,
    news: [{ title: 'Super Micro rallies after upbeat AI server outlook', source: 'CNBC', url: '#' }],
  },
  {
    symbol: '278280',
    name: '천보',
    price: 61_900,
    change_pct: 7.1,
    market: 'KR' as const,
    sector: '2차전지 소재',
    volume: 890_000,
    news: [],
  },
];

export const Loaded = () => <div style={{ maxWidth: 380 }}><HotPanel items={ITEMS} loaded onSelect={() => {}} /></div>;

export const MarketClosed = () => (
  <div style={{ maxWidth: 380 }}><HotPanel items={[]} loaded onSelect={() => {}} /></div>
);

export const Loading = () => (
  <div style={{ maxWidth: 380 }}><HotPanel items={[]} loaded={false} onSelect={() => {}} /></div>
);
