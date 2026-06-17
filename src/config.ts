// 환경 설정. 키 없어도 동작하도록 전부 optional.
import { loadWatchlist } from './core/persist.js';
import type { NewsScope } from './core/types.js';

export interface Feed {
  source: string;
  url: string;
  lang: 'en' | 'ko'; // 원문 언어
}

export interface AppConfig {
  finnhub_key?: string;
  quote_interval_ms: number;
  news_interval_ms: number;
  initial_watchlist: string[];
  initial_names: Record<string, string>; // symbol → 회사명 (영속 로드)
  rss_feeds: Feed[];
  initial_scope: NewsScope; // 뉴스 범위 (domestic/foreign/all)
  initial_mode: 'stock' | 'crypto'; // 시작 화면 모드 (FIN_MODE)
}

// 주요 지수 (chart API 심볼). 현황판 표시용.
export const INDICES: { symbol: string; label: string }[] = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^IXIC', label: 'NASDAQ' },
  { symbol: '^DJI', label: 'Dow Jones' },
  { symbol: '^KS11', label: 'KOSPI' },
  { symbol: '^KQ11', label: 'KOSDAQ' },
];

// 환율·원자재·암호화폐 (chart API 심볼). 키 없이 조회. 하단 패널 표시용.
export const MARKETS: { symbol: string; label: string }[] = [
  { symbol: 'KRW=X', label: '달러/원' },
  { symbol: 'DX-Y.NYB', label: '달러인덱스' },
  { symbol: 'CL=F', label: 'WTI 유가' },
  { symbol: 'GC=F', label: '금' },
  { symbol: 'BTC-USD', label: '비트코인' },
];

const DEFAULT_FEEDS: Feed[] = [
  // 블룸버그 공식 RSS 폐지됨 → 대체 무료 금융 피드
  // 영문
  { source: 'Yahoo', url: 'https://finance.yahoo.com/news/rssindex', lang: 'en' },
  { source: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', lang: 'en' },
  { source: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', lang: 'en' },
  // 한글 (원문 한글 → 번역 불필요)
  { source: '한경증권', url: 'https://www.hankyung.com/feed/finance', lang: 'ko' },
  { source: '한경경제', url: 'https://www.hankyung.com/feed/economy', lang: 'ko' },
  { source: '동아경제', url: 'https://rss.donga.com/economy.xml', lang: 'ko' },
  { source: '연합경제', url: 'https://www.yna.co.kr/rss/economy.xml', lang: 'ko' },
  { source: '연합시장', url: 'https://www.yna.co.kr/rss/market.xml', lang: 'ko' },
];

export function loadConfig(): AppConfig {
  const watchEnv = process.env.FIN_WATCHLIST?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  // FIN_NEWS_SCOPE 우선, 없으면 구 FIN_LANG=ko 를 domestic 으로 호환 처리. 기본 all.
  const scope: NewsScope =
    process.env.FIN_NEWS_SCOPE === 'domestic' || process.env.FIN_NEWS_SCOPE === 'foreign'
      ? process.env.FIN_NEWS_SCOPE
      : process.env.FIN_LANG === 'ko'
        ? 'domestic'
        : 'all';
  const saved = loadWatchlist();

  // 우선순위: 환경변수 > 저장 파일 > 기본값. (FIN_WATCHLIST 로 명시하면 그게 최우선)
  const watchlist = watchEnv?.length
    ? watchEnv
    : saved?.watchlist.length
      ? saved.watchlist
      : ['AAPL', 'TSLA', 'NVDA', 'MSFT'];

  return {
    finnhub_key: process.env.FINNHUB_KEY,
    quote_interval_ms: Number(process.env.FIN_QUOTE_MS ?? 10_000),
    news_interval_ms: Number(process.env.FIN_NEWS_MS ?? 60_000),
    initial_watchlist: watchlist,
    initial_names: saved?.names ?? {},
    rss_feeds: DEFAULT_FEEDS,
    initial_scope: scope,
    initial_mode: process.env.FIN_MODE === 'crypto' ? 'crypto' : 'stock',
  };
}
