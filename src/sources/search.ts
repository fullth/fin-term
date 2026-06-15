// Yahoo 심볼 검색. 회사명/심볼로 종목 후보 조회. 키 불필요.
const YAHOO_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';

export interface SearchResult {
  symbol: string;
  name: string;
  type: string; // EQUITY / ETF / INDEX ...
  exchange: string;
}

export async function searchSymbols(query: string, limit = 8): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `${YAHOO_SEARCH}?q=${encodeURIComponent(q)}&quotesCount=${limit}&newsCount=0`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (fin-term)' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { quotes?: any[] };
    return (data.quotes ?? [])
      .filter((r) => r.symbol && (r.quoteType === 'EQUITY' || r.quoteType === 'ETF' || r.quoteType === 'INDEX'))
      .map((r) => ({
        symbol: r.symbol as string,
        name: (r.shortname ?? r.longname ?? '') as string,
        type: (r.quoteType ?? '') as string,
        exchange: (r.exchDisp ?? '') as string,
      }))
      .slice(0, limit);
  } catch {
    return [];
  }
}
