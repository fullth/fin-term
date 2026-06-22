// 급상승 종목 (상승률 상위). 네이버 금융 거래소별 상승률 랭킹. 키 불필요.
// Yahoo day_gainers 스크리너가 429(Too Many Requests)로 차단되어 네이버로 우회.
const NAVER_RANK = (exchange: string, size: number) =>
  `https://api.stock.naver.com/stock/exchange/${exchange}/up?page=1&pageSize=${size}`;

// 미국(NASDAQ) + 국내(KOSPI·KOSDAQ) 상승률 상위를 합쳐 상위 N개.
const EXCHANGES = ['NASDAQ', 'KOSPI', 'KOSDAQ'] as const;
type Exchange = (typeof EXCHANGES)[number];
const PER_EXCHANGE = 10;
const TOP_N = 5;

const UA = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://m.stock.naver.com/',
  Accept: 'application/json',
};

const NEWS_PER_ITEM = 3; // 종목별 관련 기사 수

export interface HotNews {
  title: string;
  source: string;
  url: string;
}

export interface HotItem {
  symbol: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  // 트렌드 파악 근거
  market: 'KR' | 'US'; // 어느 시장 급등주인지
  sector: string | null; // 업종(섹터) — 어떤 분야가 뜨는지
  volume: number | null; // 누적 거래량 — 급등 신뢰도/관심도
  news: HotNews[]; // 관련 기사 (제목 위주)
}

interface NaverRankStock {
  symbolCode?: string;
  stockName?: string;
  stockNameEng?: string;
  reutersCode?: string;
  closePriceRaw?: string | number;
  fluctuationsRatioRaw?: string | number;
  accumulatedTradingVolume?: string | number;
  stockExchangeType?: { name?: string };
  industryCodeType?: { industryGroupKor?: string };
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// 네이버 종목 → 우리 심볼. 국내는 .KS/.KQ 접미사를 붙여야 시세 조회가 동작.
function toSymbol(s: NaverRankStock): string | null {
  const code = s.symbolCode;
  if (!code) return null;
  const exch = s.stockExchangeType?.name;
  if (exch === 'KOSPI') return `${code}.KS`;
  if (exch === 'KOSDAQ') return `${code}.KQ`;
  return code; // 미국 등 해외는 심볼 그대로
}

function marketOf(exchange: Exchange): 'KR' | 'US' {
  return exchange === 'KOSPI' || exchange === 'KOSDAQ' ? 'KR' : 'US';
}

// HotItem + 뉴스 조회에 필요한 네이버 코드. newsKey 는 시장별로 다름(국내=종목코드, 미국=reutersCode).
type RankedItem = HotItem & { newsKey: string | null };

async function fetchExchange(exchange: Exchange): Promise<RankedItem[]> {
  const market = marketOf(exchange);
  try {
    const res = await fetch(NAVER_RANK(exchange, PER_EXCHANGE), { headers: UA });
    if (!res.ok) return [];
    const data = (await res.json()) as { stocks?: NaverRankStock[] };
    const stocks = data.stocks ?? [];
    return stocks
      .map((s) => {
        const symbol = toSymbol(s);
        if (!symbol) return null;
        return {
          symbol,
          name: s.stockName ?? s.stockNameEng ?? '',
          price: num(s.closePriceRaw),
          change_pct: num(s.fluctuationsRatioRaw),
          market,
          sector: s.industryCodeType?.industryGroupKor ?? null,
          volume: num(s.accumulatedTradingVolume),
          news: [] as HotNews[],
          newsKey: market === 'US' ? (s.reutersCode ?? null) : (s.symbolCode ?? null),
        } satisfies RankedItem;
      })
      .filter((x): x is RankedItem => x !== null);
  } catch {
    return [];
  }
}

// 종목별 관련 기사. 미국/국내 응답 구조가 달라 분기.
async function fetchItemNews(market: 'KR' | 'US', key: string): Promise<HotNews[]> {
  try {
    if (market === 'US') {
      // [{ tit, ohnm, oid, aid, dt }, ...]
      const res = await fetch(
        `https://api.stock.naver.com/news/worldStock/${encodeURIComponent(key)}?pageSize=${NEWS_PER_ITEM}&page=1`,
        { headers: UA },
      );
      if (!res.ok) return [];
      const arr = (await res.json()) as { tit?: string; ohnm?: string; oid?: string; aid?: string }[];
      return arr.slice(0, NEWS_PER_ITEM).map((n) => ({
        title: (n.tit ?? '').trim(),
        source: n.ohnm ?? '',
        // 미국(해외) 기사는 네이버 증권 내부 뷰어 경로. n.news.naver.com 은 fnGuide 등 제휴 oid 에 500.
        url: n.oid && n.aid ? `https://m.stock.naver.com/worldstock/news/view/${n.oid}/${n.aid}` : '',
      }));
    }
    // 국내: [{ total, items: [{ title, officeName, officeId, articleId }] }]
    const res = await fetch(
      `https://api.stock.naver.com/news/stock/${encodeURIComponent(key)}?pageSize=${NEWS_PER_ITEM}&page=1`,
      { headers: UA },
    );
    if (!res.ok) return [];
    const groups = (await res.json()) as {
      items?: { title?: string; officeName?: string; officeId?: string; articleId?: string }[];
    }[];
    const items = groups.flatMap((g) => g.items ?? []);
    return items.slice(0, NEWS_PER_ITEM).map((n) => ({
      title: (n.title ?? '').trim(),
      source: n.officeName ?? '',
      url: n.officeId && n.articleId ? `https://n.news.naver.com/mnews/article/${n.officeId}/${n.articleId}` : '',
    }));
  } catch {
    return [];
  }
}

export async function fetchHot(): Promise<HotItem[]> {
  const lists = await Promise.all(EXCHANGES.map(fetchExchange));
  const top = lists
    .flat()
    .sort((a, b) => (b.change_pct ?? -Infinity) - (a.change_pct ?? -Infinity))
    .slice(0, TOP_N);

  // 상위 N개에 대해서만 관련 기사 조회 (불필요한 호출 최소화)
  await Promise.all(
    top.map(async (it) => {
      if (it.newsKey) it.news = await fetchItemNews(it.market, it.newsKey);
    }),
  );

  // newsKey 는 내부용 — 외부로 노출하지 않음
  return top.map(({ newsKey: _newsKey, ...rest }) => rest);
}
