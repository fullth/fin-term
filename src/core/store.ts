// 앱 상태 컨테이너 + 변경 구독. ink 쪽에서 subscribe 해서 re-render.
import { EventEmitter } from 'node:events';
import type {
  Quote,
  QuoteMap,
  NewsItem,
  NewsScope,
  Holding,
  CryptoTicker,
  CryptoTickerMap,
  Candle,
  ChartTimeframe,
  FeedStatus,
} from './types.js';
import type { SearchResult } from '../sources/search.js';
import type { HotItem } from '../sources/hot.js';
import type { Detail } from '../sources/detail.js';
import { saveWatchlist } from './persist.js';

export type Focus = 'watchlist' | 'news' | 'search' | 'symbolInput' | 'termInput';

// 일시적 오버레이 (Claude 응답 등). brief/search 와 함께 상호 배타.
export type Overlay =
  | { kind: 'brief'; text: string | null; loading: boolean }
  | { kind: 'explain'; term: string; text: string | null; loading: boolean }
  | { kind: 'help' }; // 단축키 도움말 (? 또는 :help)

export interface State {
  watchlist: string[];
  names: Record<string, string>; // symbol → 회사명 (표시·영속화용)
  quotes: QuoteMap;
  news: NewsItem[];
  newsFilter: string | null; // ticker 필터 (:news AAPL)
  newsScope: NewsScope; // 뉴스 범위 (domestic 국내 / foreign 해외 / all 전체)
  focus: Focus; // 키 입력이 향하는 패널 (Tab 으로 전환)
  searchResults: SearchResult[]; // :search 결과 (비어있으면 패널 숨김)
  searchQuery: string; // 검색어 (패널 헤더 표시용)
  update: { latest: string } | null; // 사용 가능한 새 버전 (없으면 null)
  detail: Detail | null; // 선택 종목 상세 (QUOTE 패널 인라인)
  // 상시 표시 패널 (가로 3분할)
  hot: HotItem[]; // 핫 종목 (거래량 급등)
  indices: Quote[]; // 주요 지수 시세
  markets: Quote[]; // 환율·원자재·암호화폐 시세
  overlay: Overlay | null; // brief/explain 일시 오버레이 (Claude 응답)
  status: string; // 하단 상태 메시지
  // --- 코인 모니터 (업비트 KRW) ---
  holdings: Holding[]; // 보유 내역 (~/.fin-term/holdings.json)
  cryptoTickers: CryptoTickerMap; // 실시간 KRW 시세 (코인 id → 티커)
  cryptoSelected: string | null; // 차트·상세 대상 코인 id
  chartTimeframe: ChartTimeframe; // 차트 기간
  candles: Candle[]; // 선택 코인·기간 캔들
  feedStatus: FeedStatus; // 웹소켓 피드 상태
  alerts: string[]; // 코인 수익률/변동 알림 로그 (최신 우선)
  showCrypto: boolean; // 코인 패널(보유·차트) 표시 토글 (:crypto)
}

const ALERT_LIMIT = 12;

export class Store extends EventEmitter {
  private state: State;

  constructor(
    initialWatchlist: string[],
    initialScope: NewsScope = 'all',
    initialNames: Record<string, string> = {},
    initialHoldings: Holding[] = [],
  ) {
    super();
    this.state = {
      watchlist: [...initialWatchlist],
      names: { ...initialNames },
      quotes: {},
      news: [],
      newsFilter: null,
      newsScope: initialScope,
      focus: 'watchlist',
      searchResults: [],
      searchQuery: '',
      update: null,
      detail: null,
      hot: [],
      indices: [],
      markets: [],
      overlay: null,
      status: 'ready',
      holdings: [...initialHoldings],
      cryptoTickers: {},
      cryptoSelected: initialHoldings[0]?.id ?? 'bitcoin',
      chartTimeframe: 'day-7',
      candles: [],
      feedStatus: 'polling',
      alerts: [],
      showCrypto: false,
    };
  }

  // 관심종목·종목명만 디스크에 저장 (변경 시마다 호출)
  private persist() {
    saveWatchlist({ watchlist: this.state.watchlist, names: this.state.names });
  }

  get(): State {
    return this.state;
  }

  private commit(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.emit('change', this.state);
  }

  setQuotes(quotes: Quote[]) {
    const map: QuoteMap = { ...this.state.quotes };
    for (const q of quotes) map[q.symbol] = q;
    this.commit({ quotes: map });
  }

  setNews(news: NewsItem[]) {
    this.commit({ news });
  }

  setStatus(status: string) {
    this.commit({ status });
  }

  addSymbol(symbol: string, name?: string): boolean {
    const sym = symbol.toUpperCase().trim();
    if (!sym || this.state.watchlist.includes(sym)) return false;
    const names = { ...this.state.names };
    if (name) names[sym] = name;
    this.commit({ watchlist: [...this.state.watchlist, sym], names });
    this.persist();
    return true;
  }

  removeSymbol(symbol: string): boolean {
    const sym = symbol.toUpperCase().trim();
    if (!this.state.watchlist.includes(sym)) return false;
    const quotes = { ...this.state.quotes };
    delete quotes[sym];
    const names = { ...this.state.names };
    delete names[sym];
    this.commit({ watchlist: this.state.watchlist.filter((s) => s !== sym), quotes, names });
    this.persist();
    return true;
  }

  setNewsFilter(ticker: string | null) {
    this.commit({ newsFilter: ticker ? ticker.toUpperCase() : null });
  }

  setNewsScope(newsScope: NewsScope) {
    this.commit({ newsScope });
  }

  setUpdate(latest: string) {
    this.commit({ update: { latest } });
  }

  // 선택 종목 상세 (QUOTE 인라인). 종목 바뀌면 교체.
  setDetail(detail: Detail | null) {
    this.commit({ detail });
  }

  // 상시 패널 — 핫종목/지수/환율.
  setHot(hot: HotItem[]) {
    this.commit({ hot });
  }

  setIndices(indices: Quote[]) {
    this.commit({ indices });
  }

  setMarkets(markets: Quote[]) {
    this.commit({ markets });
  }

  // 일시 오버레이 표시 (brief/explain) — 검색은 닫는다.
  setOverlay(overlay: Overlay) {
    this.commit({ overlay, searchResults: [], searchQuery: '' });
  }

  updateOverlay(overlay: Overlay) {
    this.commit({ overlay });
  }

  clearOverlay() {
    this.commit({ overlay: null });
  }

  setFocus(focus: Focus) {
    this.commit({ focus });
  }

  // 검색 결과 표시 → focus 를 search 로 이동
  setSearchResults(query: string, results: SearchResult[]) {
    this.commit({ searchQuery: query, searchResults: results, focus: results.length ? 'search' : this.state.focus });
  }

  clearSearch() {
    this.commit({ searchResults: [], searchQuery: '', focus: 'watchlist' });
  }

  // --- 코인 모니터 ---

  // 실시간 티커 1건 갱신 (코인 id 키로 머지).
  setCryptoTicker(ticker: CryptoTicker) {
    this.commit({ cryptoTickers: { ...this.state.cryptoTickers, [ticker.id]: ticker } });
  }

  setFeedStatus(feedStatus: FeedStatus) {
    if (this.state.feedStatus === feedStatus) return; // 동일 상태 재커밋 방지 (불필요 렌더)
    this.commit({ feedStatus });
  }

  setCandles(candles: Candle[]) {
    this.commit({ candles });
  }

  setCryptoSelected(id: string) {
    this.commit({ cryptoSelected: id });
  }

  setChartTimeframe(chartTimeframe: ChartTimeframe) {
    this.commit({ chartTimeframe });
  }

  toggleCrypto(show?: boolean) {
    this.commit({ showCrypto: show ?? !this.state.showCrypto });
  }

  // 알림 로그에 타임스탬프 붙여 최신 우선으로 적재 (최대 ALERT_LIMIT).
  pushAlert(message: string) {
    const ts = new Date().toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const alerts = [`[${ts}] ${message}`, ...this.state.alerts].slice(0, ALERT_LIMIT);
    this.commit({ alerts });
  }
}
