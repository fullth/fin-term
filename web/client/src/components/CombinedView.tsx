import { useEffect, useState } from 'react';
import type { CoinMeta, CoinNewsItem, CoinQuote, Detail, LabelEntry, NewsItem, NewsScope, Quote, UpbitTick } from '../lib/types';
import { arrow, changeClass, fmtPct, fmtTime } from '../lib/format';
import { CoinSearchBar } from './CoinSearchBar';
import { IndicesPanel, MarketsPanel } from './SidePanels';
import { NewsStream } from './NewsStream';
import { QuotePanel } from './QuotePanel';
import { SearchBar } from './SearchBar';
import { Sparkline } from './Sparkline';
import { Watchlist } from './Watchlist';

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
  onAddSymbol: (symbol: string, name: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  onSelectSymbol: (symbol: string) => void;
  onFilterNews: (symbol: string) => void;
  onClearNewsFilter: () => void;
  onScopeChange: (scope: NewsScope) => void;
  onAddCoin: (coin: CoinMeta) => void;
  onRemoveCoin: (id: string) => void;
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

function CoinNews({ news }: { news: CoinNewsItem[] }) {
  return (
    <div className="panel area-news">
      <div className="ptitle t-yellow">
        COIN NEWS <span className="sub">[{news.length}]</span>
      </div>
      {news.length === 0 && <div className="dim">불러오는 중…</div>}
      {news.map((item, index) => (
        <div key={item.id} className="news-row" onClick={() => window.open(item.url, '_blank', 'noopener')}>
          <span className="num">{index + 1}</span>
          <span className="time">{fmtTime(item.published_at)}</span>
          <span className="tag mkt">[COIN]</span>
          <span className="title">{item.title}</span>
          <span className="src">({item.source})</span>
        </div>
      ))}
    </div>
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
    onAddSymbol,
    onRemoveSymbol,
    onSelectSymbol,
    onFilterNews,
    onClearNewsFilter,
    onScopeChange,
    onAddCoin,
    onRemoveCoin,
  } = props;
  const [selectedCoin, setSelectedCoin] = useState<string | null>(coins[0]?.symbol ?? null);

  useEffect(() => {
    if (selectedCoin && !coins.some((coin) => coin.symbol === selectedCoin)) {
      setSelectedCoin(coins[0]?.symbol ?? null);
    } else if (!selectedCoin && coins.length) {
      setSelectedCoin(coins[0].symbol);
    }
  }, [coins, selectedCoin]);

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

      <div className="combined-market-grid">
        <section className="combined-lane stock-lane" aria-labelledby="combined-stock-title">
          <header className="combined-lane-head">
            <div>
              <span className="combined-eyebrow">EQUITY MARKET</span>
              <h2 id="combined-stock-title">주식</h2>
            </div>
            <span className="combined-live"><i /> SSE 실시간</span>
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
            <span className="combined-live"><i /> 업비트 실시간</span>
          </header>
          <div className="combined-overview">
            <CoinWatchlist
              coins={coins}
              quotes={coinQuotes}
              live={coinLive}
              selected={selectedCoin}
              onSelect={setSelectedCoin}
              onRemove={onRemoveCoin}
            />
            <CoinQuotePanel coin={selectedCoinMeta} quote={selectedCoinQuote} tick={selectedCoinTick} />
          </div>
          <CoinNews news={coinNews} />
        </section>
      </div>
    </main>
  );
}
