import { Watchlist } from 'fin-term-client';

// Watchlist is the left-column list in stock mode: click to select, right-click
// to remove, a per-row 뉴스 button toggles the news filter. Rows show symbol,
// optional halt badge, name, and price with a colored change %.

const NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  NVDA: 'NVIDIA Corp.',
  '005930': '삼성전자',
  TSLA: 'Tesla Inc.',
  '035720': '카카오',
};

const QUOTES = {
  AAPL: { symbol: 'AAPL', price: 229.87, change_pct: 1.51 },
  NVDA: { symbol: 'NVDA', price: 121.4, change_pct: -2.03 },
  '005930': { symbol: '005930', price: 71_800, change_pct: -1.64 },
  TSLA: { symbol: 'TSLA', price: 242.1, change_pct: 0.0 },
  '035720': { symbol: '035720', price: 41_250, change_pct: 3.12, halted: true },
};

const WL = ['AAPL', 'NVDA', '005930', 'TSLA', '035720'];

const noop = () => {};

export const Default = () => (
  <div style={{ maxWidth: 340 }}>
    <Watchlist
      watchlist={WL}
      names={NAMES}
      quotes={QUOTES}
      selected="AAPL"
      newsFilter={null}
      onSelect={noop}
      onRemove={noop}
      onFilterNews={noop}
    />
  </div>
);

export const NewsFilterActive = () => (
  <div style={{ maxWidth: 340 }}>
    <Watchlist
      watchlist={WL}
      names={NAMES}
      quotes={QUOTES}
      selected="NVDA"
      newsFilter="NVDA"
      onSelect={noop}
      onRemove={noop}
      onFilterNews={noop}
    />
  </div>
);

export const Empty = () => (
  <div style={{ maxWidth: 340 }}>
    <Watchlist
      watchlist={[]}
      names={{}}
      quotes={{}}
      selected={null}
      newsFilter={null}
      onSelect={noop}
      onRemove={noop}
      onFilterNews={noop}
    />
  </div>
);
