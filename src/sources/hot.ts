// 핫 종목 (거래량 급등 상위). Yahoo day_gainers 스크리너. 키 불필요.
const SCREENER =
  'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=day_gainers&count=5';

export interface HotItem {
  symbol: string;
  name: string;
  price: number | null;
  change_pct: number | null;
}

export async function fetchHot(): Promise<HotItem[]> {
  try {
    const res = await fetch(SCREENER, { headers: { 'User-Agent': 'Mozilla/5.0 (fin-term)' } });
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
