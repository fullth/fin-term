// 환경 설정. 키 없어도 동작하도록 전부 optional.

export interface AppConfig {
  finnhub_key?: string;
  quote_interval_ms: number;
  news_interval_ms: number;
  initial_watchlist: string[];
  rss_feeds: { source: string; url: string }[];
}

const DEFAULT_FEEDS = [
  // 블룸버그 공식 RSS 폐지됨 → 대체 무료 금융 피드
  { source: 'Yahoo', url: 'https://finance.yahoo.com/news/rssindex' },
  { source: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114' },
  { source: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
];

export function loadConfig(): AppConfig {
  const watchEnv = process.env.FIN_WATCHLIST?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  return {
    finnhub_key: process.env.FINNHUB_KEY,
    quote_interval_ms: Number(process.env.FIN_QUOTE_MS ?? 10_000),
    news_interval_ms: Number(process.env.FIN_NEWS_MS ?? 60_000),
    initial_watchlist: watchEnv?.length ? watchEnv : ['AAPL', 'TSLA', 'NVDA', 'MSFT'],
    rss_feeds: DEFAULT_FEEDS,
  };
}
