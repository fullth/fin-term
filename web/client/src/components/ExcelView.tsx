import { useEffect, useRef, useState } from 'react';
import type {
  CoinMeta, CoinNewsItem, CoinQuote, CoinSearchResult, Quote, NewsItem, HotItem,
  LabelEntry, SearchResult, UpbitTick,
} from '../lib/types';
import type { ConnectionInfo } from '../lib/connection';
import { api } from '../lib/api';
import { fmtPriceCompact, fmtPct, fmtChange, fmtBig, fmtTime, changeClass } from '../lib/format';

// 엑셀 위장 모드 — 앱의 실데이터(관심종목·지수·환율·뉴스·급상승)를 그대로
// 스프레드시트 골격(초록 리본·셀·시트탭) 안에 담아 보여준다. 더미·라벨 위장 없음.
// 토글은 App 에서 (` 키 / 버튼) 제어하고, 여기서는 표시만 담당한다.

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

type SheetKey = 'summary' | 'stocks' | 'coins' | 'news' | 'hot';

interface ExcelViewProps {
  watchlist: string[];
  names: Record<string, string>;
  quotes: Record<string, Quote>;
  indices: Quote[];
  markets: Quote[];
  labels: { indices: LabelEntry[]; markets: LabelEntry[] };
  news: NewsItem[];
  hot: HotItem[];
  coins: CoinMeta[];
  coinQuotes: CoinQuote[];
  coinLive: Record<string, UpbitTick>;
  coinNews: CoinNewsItem[];
  stockConnection: ConnectionInfo;
  coinConnection: ConnectionInfo;
  onAddSymbol: (symbol: string, name: string) => void;
  onAddCoin: (coin: CoinMeta) => void;
  onExit: () => void; // 엑셀 모드 해제 (리본 "보기" 옆 버튼)
}

type AssetSearchResult =
  | { kind: 'stock'; key: string; symbol: string; name: string; meta: string; value: SearchResult }
  | { kind: 'coin'; key: string; symbol: string; name: string; meta: string; value: CoinSearchResult };

// 한 셀 — 값 + 정렬/색/헤더 여부. 등락 색은 .up/.down 클래스로 처리한다.
// href 가 있으면 링크 버튼으로 렌더(뉴스 원문 등).
type Cell = { v: string; cls?: string; left?: boolean; head?: boolean; section?: boolean; span?: number; href?: string };

function row(cells: Cell[]): Cell[] {
  return cells;
}

function fmtKrw(value: number | null): string {
  if (value == null) return '—';
  return `₩${Math.round(value).toLocaleString('ko-KR')}`;
}

function connectionLabel(connection: ConnectionInfo): string {
  if (connection.issue) return '확인 필요';
  if (connection.state === 'live') return '정상';
  if (connection.state === 'stale') return '지연';
  if (connection.state === 'reconnecting') return '재연결';
  if (connection.state === 'idle') return '대기';
  return '연결 중';
}

function buildSummary(props: ExcelViewProps): Cell[][] {
  const labelOf = (symbol: string, list: LabelEntry[]) => list.find((item) => item.symbol === symbol)?.label ?? symbol;
  const rows: Cell[][] = [
    [{ v: '시장 종합 현황', section: true, span: 7 }],
    [
      { v: '구분', head: true, left: true },
      { v: '항목', head: true, left: true },
      { v: '현재가', head: true },
      { v: '등락률', head: true },
      { v: '연결', head: true, left: true },
      { v: '갱신', head: true, left: true },
      { v: '데이터', head: true, left: true },
    ],
  ];
  const stockUpdated = props.stockConnection.lastUpdated ? fmtTime(props.stockConnection.lastUpdated) : '—';
  for (const quote of props.indices) {
    rows.push(row([
      { v: '주식', left: true },
      { v: labelOf(quote.symbol, props.labels.indices), left: true },
      { v: fmtPriceCompact(quote.price) },
      { v: fmtPct(quote.change_pct), cls: changeClass(quote.change_pct) },
      { v: connectionLabel(props.stockConnection), left: true },
      { v: stockUpdated, left: true },
      { v: quote.symbol, left: true },
    ]));
  }
  for (const quote of props.markets) {
    rows.push(row([
      { v: '환율/원자재', left: true },
      { v: labelOf(quote.symbol, props.labels.markets), left: true },
      { v: fmtPriceCompact(quote.price) },
      { v: fmtPct(quote.change_pct), cls: changeClass(quote.change_pct) },
      { v: connectionLabel(props.stockConnection), left: true },
      { v: stockUpdated, left: true },
      { v: quote.symbol, left: true },
    ]));
  }
  const coinUpdated = props.coinConnection.lastUpdated ? fmtTime(props.coinConnection.lastUpdated) : '—';
  for (const coin of props.coins) {
    const quote = props.coinQuotes.find((item) => item.symbol === coin.symbol);
    const tick = props.coinLive[coin.upbitMarket];
    const change = tick ? tick.change_rate * 100 : quote?.change_24h ?? null;
    rows.push(row([
      { v: '코인', left: true },
      { v: `${coin.symbol} ${coin.name}`, left: true },
      { v: fmtKrw(tick?.trade_price ?? quote?.price_krw ?? null) },
      { v: fmtPct(change), cls: changeClass(change) },
      { v: connectionLabel(props.coinConnection), left: true },
      { v: coinUpdated, left: true },
      { v: coin.upbitMarket, left: true },
    ]));
  }
  if (rows.length === 2) rows.push([{ v: '불러오는 중…', left: true }]);
  return rows;
}

function buildWatch(watchlist: string[], names: Record<string, string>, quotes: Record<string, Quote>): Cell[][] {
  const header = ['종목', '종목명', '현재가', '등락률', '대비', '고가', '저가'];
  const rows: Cell[][] = [
    [{ v: '관심종목 (WATCHLIST)', section: true, span: 7 }],
    header.map((h) => ({ v: h, head: true, left: true })),
  ];
  for (const sym of watchlist) {
    const q = quotes[sym];
    const cc = changeClass(q?.change_pct ?? null);
    rows.push(
      row([
        { v: sym, left: true },
        { v: names[sym] || '', left: true },
        { v: q?.error ? 'ERR' : fmtPriceCompact(q?.price ?? null) },
        { v: q ? fmtPct(q.change_pct) : '—', cls: cc },
        { v: q ? fmtChange(q.change) : '—', cls: cc },
        { v: fmtPriceCompact(q?.high ?? null) },
        { v: fmtPriceCompact(q?.low ?? null) },
      ]),
    );
  }
  return rows;
}

function buildMarkets(indices: Quote[], markets: Quote[], labels: ExcelViewProps['labels']): Cell[][] {
  const labelOf = (sym: string, list: LabelEntry[]) => list.find((l) => l.symbol === sym)?.label ?? sym;
  const rows: Cell[][] = [
    [{ v: '지수 / 환율 / 원자재', section: true, span: 7 }],
    [
      { v: '항목', head: true, left: true },
      { v: '현재가', head: true },
      { v: '등락률', head: true },
    ],
  ];
  const push = (q: Quote, label: string) => {
    const cc = changeClass(q.change_pct);
    rows.push(
      row([
        { v: label, left: true },
        { v: fmtPriceCompact(q.price) },
        { v: fmtPct(q.change_pct), cls: cc },
      ]),
    );
  };
  for (const q of indices) push(q, labelOf(q.symbol, labels.indices));
  for (const q of markets) push(q, labelOf(q.symbol, labels.markets));
  if (indices.length + markets.length === 0) rows.push([{ v: '불러오는 중…', left: true }]);
  return rows;
}

function buildCoins(coins: CoinMeta[], quotes: CoinQuote[], live: Record<string, UpbitTick>): Cell[][] {
  const rows: Cell[][] = [
    [{ v: '코인 관심목록', section: true, span: 7 }],
    [
      { v: '코인', head: true, left: true },
      { v: '이름', head: true, left: true },
      { v: '현재가', head: true },
      { v: '1시간', head: true },
      { v: '24시간', head: true },
      { v: '7일', head: true },
      { v: '마켓', head: true, left: true },
    ],
  ];
  for (const coin of coins) {
    const quote = quotes.find((item) => item.symbol === coin.symbol);
    const tick = live[coin.upbitMarket];
    const change24h = tick ? tick.change_rate * 100 : quote?.change_24h ?? null;
    rows.push(row([
      { v: coin.symbol, left: true },
      { v: coin.name, left: true },
      { v: fmtKrw(tick?.trade_price ?? quote?.price_krw ?? null) },
      { v: fmtPct(quote?.change_1h ?? null), cls: changeClass(quote?.change_1h ?? null) },
      { v: fmtPct(change24h), cls: changeClass(change24h) },
      { v: fmtPct(quote?.change_7d ?? null), cls: changeClass(quote?.change_7d ?? null) },
      { v: coin.upbitMarket, left: true },
    ]));
  }
  if (coins.length === 0) rows.push([{ v: '등록된 코인이 없습니다', left: true }]);
  return rows;
}

function buildNews(news: NewsItem[], coinNews: CoinNewsItem[]): Cell[][] {
  const rows: Cell[][] = [
    [{ v: '종합 뉴스', section: true, span: 7 }],
    [
      { v: '시각', head: true, left: true },
      { v: '구분', head: true, left: true },
      { v: '제목', head: true, left: true, span: 3 },
      { v: '링크', head: true },
      { v: '출처', head: true, left: true },
    ],
  ];
  const combined = [
    ...news.map((item) => ({ ...item, market: '주식' })),
    ...coinNews.map((item) => ({ ...item, market: '코인' })),
  ]
    .sort((a, b) => b.published_at - a.published_at)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.url === item.url && candidate.title === item.title) === index)
    .slice(0, 60);
  for (const n of combined) {
    rows.push(
      row([
        { v: fmtTime(n.published_at), left: true },
        { v: n.market, left: true },
        { v: n.title, left: true, span: 3 },
        { v: n.url ? '열기' : '', href: n.url || undefined },
        { v: n.source, left: true },
      ]),
    );
  }
  if (combined.length === 0) rows.push([{ v: '불러오는 중…', left: true }]);
  return rows;
}

function buildHot(hot: HotItem[]): Cell[][] {
  const rows: Cell[][] = [
    [{ v: '급상승 종목', section: true, span: 7 }],
    [
      { v: '시장', head: true, left: true },
      { v: '종목', head: true, left: true },
      { v: '종목명', head: true, left: true },
      { v: '현재가', head: true },
      { v: '등락률', head: true },
      { v: '거래량', head: true },
      { v: '섹터', head: true, left: true },
    ],
  ];
  for (const it of hot) {
    const cc = changeClass(it.change_pct);
    rows.push(
      row([
        { v: it.market, left: true },
        { v: it.symbol, left: true },
        { v: it.name, left: true },
        { v: fmtPriceCompact(it.price) },
        { v: fmtPct(it.change_pct), cls: cc },
        { v: fmtBig(it.volume) },
        { v: it.sector || '', left: true },
      ]),
    );
  }
  if (hot.length === 0) rows.push([{ v: '거래 시간이 아니거나 급상승 종목이 없습니다', left: true }]);
  return rows;
}

const SHEETS: { key: SheetKey; tab: string }[] = [
  { key: 'summary', tab: '종합' },
  { key: 'stocks', tab: '주식' },
  { key: 'coins', tab: '코인' },
  { key: 'news', tab: '뉴스' },
  { key: 'hot', tab: '급상승' },
];

export function ExcelView(props: ExcelViewProps) {
  const [sheet, setSheet] = useState<SheetKey>('summary');
  const [sel, setSel] = useState<string>('A1'); // 선택 셀 (수식줄 표시용)
  const [formula, setFormula] = useState<string>('WATCHLIST');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const keyword = query.trim();
    if (!keyword) {
      setSearchResults([]);
      setSearching(false);
      setSearchOpen(false);
      return;
    }
    let active = true;
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const [stocks, crypto] = await Promise.allSettled([api.search(keyword), api.cryptoSearch(keyword)]);
      if (!active) return;
      const next: AssetSearchResult[] = [];
      if (stocks.status === 'fulfilled') {
        next.push(...stocks.value.results.slice(0, 5).map((value) => ({
          kind: 'stock' as const,
          key: `stock:${value.symbol}`,
          symbol: value.symbol,
          name: value.name,
          meta: value.exchange || value.type,
          value,
        })));
      }
      if (crypto.status === 'fulfilled') {
        next.push(...crypto.value.results.slice(0, 5).map((value) => ({
          kind: 'coin' as const,
          key: `coin:${value.id}`,
          symbol: value.symbol,
          name: value.name,
          meta: value.upbitMarket,
          value,
        })));
      }
      setSearchResults(next);
      setSearching(false);
      setSearchOpen(true);
    }, 250);
    return () => {
      active = false;
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const addSearchResult = (result: AssetSearchResult) => {
    if (result.kind === 'stock') {
      props.onAddSymbol(result.value.symbol, result.value.name);
      setSheet('stocks');
    } else {
      props.onAddCoin({
        id: result.value.id,
        symbol: result.value.symbol,
        name: result.value.name,
        upbitMarket: result.value.upbitMarket,
      });
      setSheet('coins');
    }
    setSel('A1');
    setFormula(`${result.symbol} 관심목록 추가`);
    setQuery('');
    setSearchResults([]);
    setSearchOpen(false);
  };

  const data: Cell[][] =
    sheet === 'summary'
      ? buildSummary(props)
      : sheet === 'stocks'
        ? [...buildWatch(props.watchlist, props.names, props.quotes), ...buildMarkets(props.indices, props.markets, props.labels)]
        : sheet === 'coins'
          ? buildCoins(props.coins, props.coinQuotes, props.coinLive)
        : sheet === 'news'
          ? buildNews(props.news, props.coinNews)
          : buildHot(props.hot);

  return (
    <div className="excel">
      <div className="excel-ribbon-tabs">
        <span className="tab">파일</span>
        <span className="tab active">홈</span>
        <span className="tab">삽입</span>
        <span className="tab">페이지 레이아웃</span>
        <span className="tab">수식</span>
        <span className="tab">데이터</span>
        <span className="tab">검토</span>
        <span className="tab">보기</span>
        <button className="excel-exit" onClick={props.onExit} title="엑셀 모드 해제 (` 키)">
          화면 복귀
        </button>
      </div>
      <div className="excel-ribbon">
        <div className="rg">
          <div className="rrow"><span className="rib-btn">붙여넣기</span></div>
          <div className="rlabel">클립보드</div>
        </div>
        <div className="rsep" />
        <div className="rg">
          <div className="rrow"><span className="rib-btn">맑은 고딕</span><span className="rib-btn">11</span></div>
          <div className="rrow"><span className="rib-btn"><b>가</b></span><span className="rib-btn"><i>가</i></span><span className="rib-btn">U</span></div>
          <div className="rlabel">글꼴</div>
        </div>
        <div className="rsep" />
        <div className="rg">
          <div className="rrow"><span className="rib-btn">₩</span><span className="rib-btn">%</span><span className="rib-btn">.00</span></div>
          <div className="rlabel">표시 형식</div>
        </div>
        <div className="rsep" />
        <div className="rg excel-search-group">
          <div className="excel-search">
            <span className="excel-search-icon">⌕</span>
            <input
              value={query}
              placeholder="주식 또는 코인 검색 (예: AAPL, 삼성, BTC)"
              aria-label="주식 또는 코인 검색"
              aria-expanded={searchOpen}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && searchResults[0]) addSearchResult(searchResults[0]);
                if (event.key === 'Escape') setSearchOpen(false);
              }}
            />
            {searchOpen && (
              <div className="excel-search-results" role="listbox">
                {searchResults.map((result) => (
                  <button key={result.key} type="button" onClick={() => addSearchResult(result)}>
                    <span className={`asset-kind ${result.kind}`}>{result.kind === 'stock' ? '주식' : '코인'}</span>
                    <strong>{result.symbol}</strong>
                    <span className="asset-name">{result.name}</span>
                    <small>{result.meta}</small>
                  </button>
                ))}
                {!searching && searchResults.length === 0 && <div className="excel-search-empty">검색 결과가 없습니다</div>}
              </div>
            )}
          </div>
          <div className="rlabel">자산 찾기 및 추가</div>
        </div>
      </div>
      <div className="excel-formula-bar">
        <span className="name-box">{sel}</span>
        <span className="fx">fx</span>
        <span className="formula-input">{formula}</span>
      </div>
      <div className="excel-grid-wrap">
        <table className="excel-sheet">
          <thead>
            <tr>
              <th className="row-h" />
              {COLS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((cells, ri) => (
              <tr key={ri}>
                <td className="row-h">{ri + 1}</td>
                {cells.map((cell, ci) => (
                  <td
                    key={ci}
                    colSpan={cell.span}
                    className={[
                      cell.left ? 'left' : '',
                      cell.head ? 'head' : '',
                      cell.section ? 'section' : '',
                      cell.cls || '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      setSel(`${COLS[ci] ?? 'A'}${ri + 1}`);
                      setFormula(cell.href || cell.v || '');
                    }}
                  >
                    {cell.href ? (
                      <a
                        className="excel-link"
                        href={cell.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {cell.v}
                      </a>
                    ) : (
                      cell.v
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="excel-sheet-tabs">
        {SHEETS.map((s) => (
          <span
            key={s.key}
            className={`sheet-tab${sheet === s.key ? ' active' : ''}`}
            onClick={() => {
              setSheet(s.key);
              setSel('A1');
              setFormula(s.tab);
            }}
          >
            {s.tab}
          </span>
        ))}
      </div>
      <div className="excel-statusbar">
        <span>준비</span>
        <span className="right">
          <span>종목 {props.watchlist.length}</span>
          <span>코인 {props.coins.length}</span>
          <span>뉴스 {props.news.length + props.coinNews.length}</span>
          <span>100%</span>
        </span>
      </div>
    </div>
  );
}
