import { NewsStream } from 'fin-term-client';

// NewsStream is the scrolling headline panel. It renders a scope switch
// (전체 / 국내 / 해외), an optional ticker filter chip, and numbered rows with
// time, ticker/[MKT] tag, title and source.

const now = Date.now();
const m = (min: number) => now - min * 60_000;

const NEWS = [
  { id: 'n1', title: '[속보] 미 연준, 기준금리 25bp 인하 결정', url: '#', source: 'Reuters', published_at: m(4), tickers: [] },
  { id: 'n2', title: 'Apple to unveil M4 MacBook Pro lineup next week, sources say', url: '#', source: 'Bloomberg', published_at: m(12), tickers: ['AAPL'] },
  { id: 'n3', title: '삼성전자, 3분기 영업이익 컨센서스 상회… 반도체 회복세', url: '#', source: '연합뉴스', published_at: m(23), tickers: ['005930'] },
  { id: 'n4', title: 'Nvidia supplier hikes capacity guidance on AI demand', url: '#', source: 'CNBC', published_at: m(41), tickers: ['NVDA'] },
  { id: 'n5', title: '코스피, 외국인 순매수에 2,600선 회복 마감', url: '#', source: '한국경제', published_at: m(58), tickers: [] },
  { id: 'n6', title: 'Tesla Q3 deliveries miss estimates amid price-cut fatigue', url: '#', source: 'The Verge', published_at: m(74), tickers: ['TSLA'] },
];

export const All = () => (
  <NewsStream news={NEWS} scope="all" onScopeChange={() => {}} filter={null} onClearFilter={() => {}} />
);

export const DomesticScope = () => (
  <NewsStream news={NEWS} scope="domestic" onScopeChange={() => {}} filter={null} onClearFilter={() => {}} />
);

export const TickerFiltered = () => (
  <NewsStream news={NEWS} scope="all" onScopeChange={() => {}} filter="AAPL" onClearFilter={() => {}} />
);

export const Empty = () => (
  <NewsStream news={[]} scope="all" onScopeChange={() => {}} filter={null} onClearFilter={() => {}} />
);
