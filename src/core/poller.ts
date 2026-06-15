// 주기 폴링 루프. 시세/뉴스 각각 독립 인터벌. watchlist 변경 시 즉시 시세 재조회.
import type { AppConfig } from '../config.js';
import { fetchQuotes } from '../sources/quote.js';
import { fetchNews } from '../sources/rss.js';
import type { Store } from './store.js';

export class Poller {
  private quoteTimer?: ReturnType<typeof setInterval>;
  private newsTimer?: ReturnType<typeof setInterval>;
  private stopped = false;

  constructor(
    private store: Store,
    private config: AppConfig,
  ) {}

  start() {
    void this.pollQuotes();
    void this.pollNews();
    this.quoteTimer = setInterval(() => void this.pollQuotes(), this.config.quote_interval_ms);
    this.newsTimer = setInterval(() => void this.pollNews(), this.config.news_interval_ms);
  }

  stop() {
    this.stopped = true;
    if (this.quoteTimer) clearInterval(this.quoteTimer);
    if (this.newsTimer) clearInterval(this.newsTimer);
  }

  // watchlist 바뀌면 다음 틱 안 기다리고 즉시
  async refreshQuotesNow() {
    await this.pollQuotes();
  }

  private async pollQuotes() {
    if (this.stopped) return;
    const { watchlist } = this.store.get();
    if (!watchlist.length) return;
    const quotes = await fetchQuotes(watchlist, this.config.finnhub_key);
    if (!this.stopped) this.store.setQuotes(quotes);
  }

  private async pollNews() {
    if (this.stopped) return;
    const { watchlist } = this.store.get();
    const news = await fetchNews(this.config.rss_feeds, watchlist);
    if (!this.stopped) this.store.setNews(news);
  }
}
