// 앱 상태 컨테이너 + 변경 구독. ink 쪽에서 subscribe 해서 re-render.
import { EventEmitter } from 'node:events';
import type { Quote, QuoteMap, NewsItem } from './types.js';

export interface State {
  watchlist: string[];
  quotes: QuoteMap;
  news: NewsItem[];
  newsFilter: string | null; // ticker 필터 (:news AAPL)
  lang: 'en' | 'ko'; // 표시 언어 (ko면 영문 헤드라인 번역 표시)
  status: string; // 하단 상태 메시지
}

export class Store extends EventEmitter {
  private state: State;

  constructor(initialWatchlist: string[], initialLang: 'en' | 'ko' = 'en') {
    super();
    this.state = {
      watchlist: [...initialWatchlist],
      quotes: {},
      news: [],
      newsFilter: null,
      lang: initialLang,
      status: 'ready',
    };
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

  addSymbol(symbol: string): boolean {
    const sym = symbol.toUpperCase().trim();
    if (!sym || this.state.watchlist.includes(sym)) return false;
    this.commit({ watchlist: [...this.state.watchlist, sym] });
    return true;
  }

  removeSymbol(symbol: string): boolean {
    const sym = symbol.toUpperCase().trim();
    if (!this.state.watchlist.includes(sym)) return false;
    const quotes = { ...this.state.quotes };
    delete quotes[sym];
    this.commit({ watchlist: this.state.watchlist.filter((s) => s !== sym), quotes });
    return true;
  }

  setNewsFilter(ticker: string | null) {
    this.commit({ newsFilter: ticker ? ticker.toUpperCase() : null });
  }

  setLang(lang: 'en' | 'ko') {
    this.commit({ lang });
  }
}
