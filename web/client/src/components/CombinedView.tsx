import type { CoinMeta, CoinNewsItem, CoinQuote, Detail, LabelEntry, NewsItem, NewsScope, Quote, UpbitTick } from '../lib/types';
import { arrow, changeClass, fmtPct, fmtPriceCompact, fmtTime } from '../lib/format';
import type { ConnectionInfo, ConnectionState } from '../lib/connection';
import { CoinSearchBar } from './CoinSearchBar';
import { IndicesPanel, MarketsPanel } from './SidePanels';
import { NewsStream } from './NewsStream';
import { QuotePanel } from './QuotePanel';
import { SearchBar } from './SearchBar';
import { Sparkline } from './Sparkline';
import { Watchlist } from './Watchlist';
import { CoinNewsStream } from './CoinNewsStream';

interface Props {
  watchlist: string[];
  names: Record<string, string>;
  quotes: Record<string, Quote>;
  selected: string | null;
  detail: Detail | null;
  indices: Quote[];
  markets: Quote[];
  labels: { indices: LabelEntry[]; markets: LabelEntry[] };
  news: NewsItem[];
  scope: NewsScope;
  newsFilter: string | null;
  coins: CoinMeta[];
  coinQuotes: CoinQuote[];
  coinLive: Record<string, UpbitTick>;
  coinNews: CoinNewsItem[];
  selectedCoin: string | null;
  stockConnection: ConnectionInfo;
  coinConnection: ConnectionInfo;
  onAddSymbol: (symbol: string, name: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  onSelectSymbol: (symbol: string) => void;
  onFilterNews: (symbol: string) => void;
  onClearNewsFilter: () => void;
  onScopeChange: (scope: NewsScope) => void;
  onAddCoin: (coin: CoinMeta) => void;
  onRemoveCoin: (id: string) => void;
  onSelectCoin: (symbol: string) => void;
}

function fmtKrw(value: number | null): string {
  if (value == null) return '—';
  const digits = Math.abs(value) >= 100 ? 0 : 2;
  return `₩${value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function CoinWatchlist({
  coins,
  quotes,
  live,
  selected,
  onSelect,
  onRemove,
}: {
  coins: CoinMeta[];
  quotes: CoinQuote[];
  live: Record<string, UpbitTick>;
  selected: string | null;
  onSelect: (symbol: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="panel area-watch focused">
      <div className="ptitle t-yellow">
        COIN WATCH <span className="dot">●</span> <span className="sub">업비트</span>
      </div>
      {coins.length === 0 && <div className="dim">검색으로 코인 추가</div>}
      {coins.map((coin) => {
        const quote = quotes.find((item) => item.symbol === coin.symbol);
        const tick = live[coin.upbitMarket];
        const price = tick?.trade_price ?? quote?.price_krw ?? null;
        const change = tick ? tick.change_rate * 100 : quote?.change_24h ?? null;
        const isSelected = selected === coin.symbol;
        return (
          <div
            key={coin.id}
            className={`listrow${isSelected ? ' sel' : ''}`}
            onClick={() => onSelect(coin.symbol)}
            onContextMenu={(event) => {
              event.preventDefault();
              onRemove(coin.id);
            }}
            title="클릭 선택 / 우클릭 삭제"
          >
            <div className="listrow-top">
              <span className="caret">{isSelected ? '▶' : ''}</span>
              <span className="sym">{coin.symbol}</span>
              <button
                className="list-remove-btn"
                aria-label={`${coin.symbol} 코인 삭제`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(coin.id);
                }}
              >
                ×
              </button>
              <span className={`val ${changeClass(change)}`}>
                {fmtKrw(price)} {arrow(change)}{fmtPct(change)}
              </span>
            </div>
            <div className="listrow-sub">{coin.name}</div>
          </div>
        );
      })}
    </div>
  );
}

function CoinQuotePanel({
  coin,
  quote,
  tick,
}: {
  coin: CoinMeta | null;
  quote: CoinQuote | null;
  tick: UpbitTick | undefined;
}) {
  const price = tick?.trade_price ?? quote?.price_krw ?? null;
  const change = tick ? tick.change_rate * 100 : quote?.change_24h ?? null;
  return (
    <div className="panel area-quote">
      <div className="ptitle t-yellow">COIN QUOTE</div>
      {!coin && <div className="dim">코인을 선택하세요</div>}
      {coin && (
        <>
          <div className="quote-head">
            <span className="qsym">{coin.symbol}</span>
            <span className="qname">{coin.name}</span>
            <span className={`qprice ${changeClass(change)}`}>
              {fmtKrw(price)} {arrow(change)} {fmtPct(change)}
            </span>
          </div>
          {quote ? (
            <>
              <div className="fields">
                <span className="field"><span className="l">1시간</span><span className={changeClass(quote.change_1h)}>{fmtPct(quote.change_1h)}</span></span>
                <span className="field"><span className="l">24시간</span><span className={changeClass(quote.change_24h)}>{fmtPct(quote.change_24h)}</span></span>
                <span className="field"><span className="l">7일</span><span className={changeClass(quote.change_7d)}>{fmtPct(quote.change_7d)}</span></span>
              </div>
              <Sparkline values={quote.spark} positive={(quote.change_7d ?? 0) >= 0} />
              <div className="updated">7일 추이 / 업비트</div>
            </>
          ) : (
            <div className="dim">시세 불러오는 중…</div>
          )}
        </>
      )}
    </div>
  );
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  idle: '대기',
  connecting: '연결 중',
  live: '실시간',
  reconnecting: '재연결 중',
  stale: '데이터 지연',
};

function ConnectionBadge({ connection, source }: { connection: ConnectionInfo; source: string }) {
  const updated = connection.lastUpdated ? fmtTime(connection.lastUpdated) : null;
  return (
    <span className={`connection-badge state-${connection.state}`} title={connection.issue ?? undefined}>
      <i /> {source} {CONNECTION_LABEL[connection.state]}
      {updated && <small>{updated}</small>}
      {connection.issue && <b>!</b>}
    </span>
  );
}

function CrossMarketSummary({
  indices,
  markets,
  coinQuotes,
}: {
  indices: Quote[];
  markets: Quote[];
  coinQuotes: CoinQuote[];
}) {
  const quoteOf = (symbol: string) => [...indices, ...markets].find((quote) => quote.symbol === symbol);
  const sp = quoteOf('^GSPC');
  const nasdaq = quoteOf('^IXIC');
  const dollar = quoteOf('KRW=X');
  const gold = quoteOf('GC=F');
  const btc = coinQuotes.find((coin) => coin.symbol === 'BTC');
  const riskInputs = [sp?.change_pct, nasdaq?.change_pct, btc?.change_24h].filter((value): value is number => value != null);
  const riskScore = riskInputs.length ? riskInputs.reduce((sum, value) => sum + value, 0) / riskInputs.length : null;
  const signal = riskScore == null
    ? '시장 신호 계산 중'
    : riskScore > 0.35
      ? '위험선호 우세'
      : riskScore < -0.35
        ? '방어 흐름 우세'
        : '주요 시장 혼조';
  const metrics = [
    { label: 'S&P500', value: fmtPriceCompact(sp?.price ?? null), change: sp?.change_pct ?? null },
    { label: 'NASDAQ', value: fmtPriceCompact(nasdaq?.price ?? null), change: nasdaq?.change_pct ?? null },
    { label: '원달러', value: fmtPriceCompact(dollar?.price ?? null), change: dollar?.change_pct ?? null },
    { label: '금', value: fmtPriceCompact(gold?.price ?? null), change: gold?.change_pct ?? null },
    { label: 'BTC', value: fmtKrw(btc?.price_krw ?? null), change: btc?.change_24h ?? null },
  ];

  return (
    <section className="cross-market-summary" aria-label="교차시장 요약">
      <div className="cross-market-signal">
        <span>CROSS MARKET</span>
        <strong>{signal}</strong>
        <small>미국 지수와 BTC 흐름 기준</small>
      </div>
      <div className="cross-market-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em className={changeClass(metric.change)}>{arrow(metric.change)}{fmtPct(metric.change)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CombinedView(props: Props) {
  const {
    watchlist,
    names,
    quotes,
    selected,
    detail,
    indices,
    markets,
    labels,
    news,
    scope,
    newsFilter,
    coins,
    coinQuotes,
    coinLive,
    coinNews,
    selectedCoin,
    stockConnection,
    coinConnection,
    onAddSymbol,
    onRemoveSymbol,
    onSelectSymbol,
    onFilterNews,
    onClearNewsFilter,
    onScopeChange,
    onAddCoin,
    onRemoveCoin,
    onSelectCoin,
  } = props;

  const selectedCoinMeta = coins.find((coin) => coin.symbol === selectedCoin) ?? null;
  const selectedCoinQuote = coinQuotes.find((coin) => coin.symbol === selectedCoin) ?? null;
  const selectedCoinTick = selectedCoinMeta ? coinLive[selectedCoinMeta.upbitMarket] : undefined;

  return (
    <main className="combined-main">
      <div className="combined-searches">
        <div className="combined-search-group stock">
          <span className="combined-search-label">STOCK</span>
          <SearchBar onAdd={onAddSymbol} />
        </div>
        <div className="combined-search-group crypto">
          <span className="combined-search-label">COIN</span>
          <CoinSearchBar onAdd={onAddCoin} />
        </div>
      </div>

      <CrossMarketSummary indices={indices} markets={markets} coinQuotes={coinQuotes} />

      <div className="combined-market-grid">
        <section className="combined-lane stock-lane" aria-labelledby="combined-stock-title">
          <header className="combined-lane-head">
            <div>
              <span className="combined-eyebrow">EQUITY MARKET</span>
              <h2 id="combined-stock-title">주식</h2>
            </div>
            <ConnectionBadge connection={stockConnection} source="SSE" />
          </header>
          <div className="combined-overview">
            <Watchlist
              watchlist={watchlist}
              names={names}
              quotes={quotes}
              selected={selected}
              newsFilter={newsFilter}
              onSelect={onSelectSymbol}
              onRemove={onRemoveSymbol}
              onFilterNews={onFilterNews}
            />
            <div className="combined-detail-stack">
              <QuotePanel quote={selected ? quotes[selected] : undefined} detail={detail} />
              <div className="combined-market-metrics">
                <IndicesPanel quotes={indices} labels={labels.indices} />
                <MarketsPanel quotes={markets} labels={labels.markets} />
              </div>
            </div>
          </div>
          <NewsStream
            news={news}
            scope={scope}
            onScopeChange={onScopeChange}
            filter={newsFilter}
            onClearFilter={onClearNewsFilter}
          />
        </section>

        <section className="combined-lane crypto-lane" aria-labelledby="combined-crypto-title">
          <header className="combined-lane-head">
            <div>
              <span className="combined-eyebrow">DIGITAL ASSET MARKET</span>
              <h2 id="combined-crypto-title">코인</h2>
            </div>
            <ConnectionBadge connection={coinConnection} source="업비트" />
          </header>
          <div className="combined-overview">
            <CoinWatchlist
              coins={coins}
              quotes={coinQuotes}
              live={coinLive}
              selected={selectedCoin}
              onSelect={onSelectCoin}
              onRemove={onRemoveCoin}
            />
            <CoinQuotePanel coin={selectedCoinMeta} quote={selectedCoinQuote} tick={selectedCoinTick} />
          </div>
          <CoinNewsStream news={coinNews} />
        </section>
      </div>
    </main>
  );
}
