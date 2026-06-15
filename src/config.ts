// 환경 설정. 키 없어도 동작하도록 전부 optional.

export interface Feed {
  source: string;
  url: string;
  lang: 'en' | 'ko'; // 원문 언어
}

export interface AppConfig {
  finnhub_key?: string;
  deepl_key?: string;
  quote_interval_ms: number;
  news_interval_ms: number;
  initial_watchlist: string[];
  rss_feeds: Feed[];
  initial_lang: 'en' | 'ko'; // 표시 언어 (ko면 영문 헤드라인 번역)
}

const DEFAULT_FEEDS: Feed[] = [
  // 블룸버그 공식 RSS 폐지됨 → 대체 무료 금융 피드
  // 영문
  { source: 'Yahoo', url: 'https://finance.yahoo.com/news/rssindex', lang: 'en' },
  { source: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', lang: 'en' },
  { source: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', lang: 'en' },
  // 한글 (원문 한글 → 번역 불필요)
  { source: '한경', url: 'https://www.hankyung.com/feed/finance', lang: 'ko' },
  { source: '매경증권', url: 'https://www.mk.co.kr/rss/50200011/', lang: 'ko' },
  { source: '연합경제', url: 'https://www.yna.co.kr/rss/economy.xml', lang: 'ko' },
];

export function loadConfig(): AppConfig {
  const watchEnv = process.env.FIN_WATCHLIST?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const lang = process.env.FIN_LANG === 'ko' ? 'ko' : 'en';
  return {
    finnhub_key: process.env.FINNHUB_KEY,
    deepl_key: process.env.DEEPL_KEY,
    quote_interval_ms: Number(process.env.FIN_QUOTE_MS ?? 10_000),
    news_interval_ms: Number(process.env.FIN_NEWS_MS ?? 60_000),
    initial_watchlist: watchEnv?.length ? watchEnv : ['AAPL', 'TSLA', 'NVDA', 'MSFT'],
    rss_feeds: DEFAULT_FEEDS,
    initial_lang: lang,
  };
}
