// BFF 전용 상수. 루트 config.ts 는 persist(fs) 에 의존하므로 재사용하지 않고
// 서버가 필요한 피드/지수/마켓 목록만 여기서 독립 선언한다. (TUI config 와 값은 동일)
// Feed 구조는 루트 config.ts 의 Feed 와 동일 — fetchNews 가 구조적으로 받는다.
export interface Feed {
  source: string;
  url: string;
  lang: 'en' | 'ko';
}

export const DEFAULT_FEEDS: Feed[] = [
  // 미국
  { source: 'Yahoo', url: 'https://finance.yahoo.com/news/rssindex', lang: 'en' },
  { source: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', lang: 'en' },
  { source: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', lang: 'en' },
  // 유럽·아시아 — 세계 시장 흐름 커버리지(영어라 해외(en) 스코프에 포함). 날짜 정상 피드만 선별.
  { source: 'Guardian', url: 'https://www.theguardian.com/uk/business/rss', lang: 'en' },
  { source: 'DW', url: 'https://rss.dw.com/rdf/rss-en-bus', lang: 'en' },
  { source: 'SCMP', url: 'https://www.scmp.com/rss/92/feed', lang: 'en' },
  { source: 'JapanTimes', url: 'https://www.japantimes.co.jp/feed/', lang: 'en' },
  // 국내
  { source: '한경증권', url: 'https://www.hankyung.com/feed/finance', lang: 'ko' },
  { source: '한경경제', url: 'https://www.hankyung.com/feed/economy', lang: 'ko' },
  { source: '동아경제', url: 'https://rss.donga.com/economy.xml', lang: 'ko' },
  { source: '연합경제', url: 'https://www.yna.co.kr/rss/economy.xml', lang: 'ko' },
  { source: '연합시장', url: 'https://www.yna.co.kr/rss/market.xml', lang: 'ko' },
];

export const INDICES: { symbol: string; label: string }[] = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^IXIC', label: 'NASDAQ' },
  { symbol: '^DJI', label: 'Dow Jones' },
  { symbol: '^KS11', label: 'KOSPI' },
  { symbol: '^KQ11', label: 'KOSDAQ' },
];

export const MARKETS: { symbol: string; label: string }[] = [
  { symbol: 'KRW=X', label: '달러/원' },
  { symbol: 'DX-Y.NYB', label: '달러인덱스' },
  { symbol: 'CL=F', label: 'WTI 유가' },
  { symbol: 'GC=F', label: '금' },
];
