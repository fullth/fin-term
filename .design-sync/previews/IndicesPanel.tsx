import { IndicesPanel } from 'fin-term-client';

// IndicesPanel is a compact "지수 현황" panel (blue title). Each row is a
// short label + price/change; symbols map to labels via the labels array.

const QUOTES = [
  { symbol: '^KS11', price: 2_612.4, change_pct: 0.83 },
  { symbol: '^KQ11', price: 742.1, change_pct: -0.41 },
  { symbol: '^GSPC', price: 5_738.2, change_pct: 0.32 },
  { symbol: '^IXIC', price: 18_190.3, change_pct: -0.15 },
  { symbol: '^N225', price: 38_925.6, change_pct: 1.21 },
];

const LABELS = [
  { symbol: '^KS11', label: '코스피' },
  { symbol: '^KQ11', label: '코스닥' },
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^IXIC', label: '나스닥' },
  { symbol: '^N225', label: '닛케이' },
];

export const Default = () => <div style={{ maxWidth: 300 }}><IndicesPanel quotes={QUOTES} labels={LABELS} /></div>;

export const Loading = () => <div style={{ maxWidth: 300 }}><IndicesPanel quotes={[]} labels={LABELS} /></div>;
