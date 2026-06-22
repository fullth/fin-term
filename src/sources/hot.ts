// 급상승 종목 (상승률 상위). Yahoo day_gainers 스크리너. 키 불필요.
const SCREENER =
  'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=day_gainers&count=5';

const UA = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export interface HotItem {
  symbol: string;
  name: string;
  price: number | null;
  change_pct: number | null;
}

export async function fetchHot(): Promise<HotItem[]> {
  try {
    const res = await fetch(SCREENER, { headers: UA });
    if (!res.ok) return [];
    const data = (await res.json()) as { finance?: { result?: { quotes?: any[] }[] } };
    const quotes = data.finance?.result?.[0]?.quotes ?? [];
    return quotes.slice(0, 5).map((q) => ({
      symbol: q.symbol as string,
      name: (q.shortName ?? q.longName ?? '') as string,
      price: typeof q.regularMarketPrice === 'number' ? q.regularMarketPrice : null,
      change_pct: typeof q.regularMarketChangePercent === 'number' ? q.regularMarketChangePercent : null,
    }));
  } catch {
    return [];
  }
}
