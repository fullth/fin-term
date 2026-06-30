// 종목 심볼 검색. 키 불필요.
// - 네이버 자동완성을 1순위로 (국내 한글·해외 영문 모두 지원, 클라우드 IP 에서도 안정적).
// - Yahoo 는 폴백 (클라우드에서 429 차단되는 경우가 있어 보조).
const YAHOO_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';
const NAVER_SEARCH = 'https://m.stock.naver.com/front-api/search/autoComplete';

const UA = { 'User-Agent': 'Mozilla/5.0 (fin-term)' };

export interface SearchResult {
  symbol: string;
  name: string;
  type: string; // EQUITY / ETF / INDEX ...
  exchange: string;
}

// 네이버 종목 검색 (국내+해외). 국내는 .KS/.KQ, 해외(미국 등)는 순수 심볼(code) 사용 — quote.ts 가 reutersCode 내부 해석.
// target 은 stock,index 만 허용 (worldstock 은 더 이상 허용되지 않아 400 유발). stock 이 이미 해외 종목을 포함한다.
async function searchNaver(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `${NAVER_SEARCH}?query=${encodeURIComponent(query)}&target=stock,index`;
    const res = await fetch(url, { headers: { ...UA, Referer: 'https://m.stock.naver.com/' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { result?: { items?: any[] } };
    return (data.result?.items ?? [])
      .filter((it) => it.code)
      .map((it) => {
        let symbol: string = it.code;
        if (it.nationCode === 'KOR') {
          symbol = `${it.code}${it.typeCode === 'KOSDAQ' ? '.KQ' : '.KS'}`;
        }
        return {
          symbol,
          name: it.name as string,
          type: it.category === 'index' ? 'INDEX' : 'EQUITY',
          exchange: (it.typeName ?? it.nationName ?? '') as string,
        };
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

// Yahoo 검색 (영문/심볼).
async function searchYahoo(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `${YAHOO_SEARCH}?q=${encodeURIComponent(query)}&quotesCount=${limit}&newsCount=0`;
    const res = await fetch(url, { headers: UA });
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

export async function searchSymbols(query: string, limit = 8): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  // 네이버 1순위 (국내·해외 모두, 클라우드 안정). 결과 없을 때만 Yahoo 폴백.
  const naver = await searchNaver(q, limit);
  if (naver.length) return naver;
  return searchYahoo(q, limit);
}
