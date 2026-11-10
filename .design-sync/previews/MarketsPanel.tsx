import { MarketsPanel } from 'fin-term-client';

// MarketsPanel is the sibling of IndicesPanel — "환율 · 원자재" (magenta title),
// same row shape (label + price/change).

const QUOTES = [
  { symbol: 'USDKRW=X', price: 1_378.5, change_pct: 0.24 },
  { symbol: 'EURKRW=X', price: 1_492.1, change_pct: -0.11 },
  { symbol: 'JPYKRW=X', price: 9.12, change_pct: 0.37 },
  { symbol: 'GC=F', price: 2_648.4, change_pct: 0.62 },
  { symbol: 'CL=F', price: 71.3, change_pct: -1.44 },
];

const LABELS = [
  { symbol: 'USDKRW=X', label: '달러/원' },
  { symbol: 'EURKRW=X', label: '유로/원' },
  { symbol: 'JPYKRW=X', label: '엔/원' },
  { symbol: 'GC=F', label: '금' },
  { symbol: 'CL=F', label: 'WTI' },
];

export const Default = () => <div style={{ maxWidth: 300 }}><MarketsPanel quotes={QUOTES} labels={LABELS} /></div>;

export const WithError = () => (
  <div style={{ maxWidth: 300 }}>
    <MarketsPanel
      quotes={[...QUOTES.slice(0, 3), { symbol: 'CL=F', price: null, change_pct: null, error: 'no data' }]}
      labels={LABELS}
    />
  </div>
);
