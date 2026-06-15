// 종목 심볼 검색. 키 불필요.
// - 한글이 포함되면 네이버 금융 검색(한국 종목 한글명 지원) → Yahoo 코드(.KS/.KQ)로 변환.
// - 그 외(영문/심볼)는 Yahoo 검색.
const YAHOO_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';
const NAVER_SEARCH = 'https://m.stock.naver.com/front-api/search/autoComplete';

const UA = { 'User-Agent': 'Mozilla/5.0 (fin-term)' };

export interface SearchResult {
  symbol: string;
  name: string;
  type: string; // EQUITY / ETF / INDEX ...
  exchange: string;
}

const HANGUL = /[가-힣]/;

// 네이버 국내 종목 검색. typeCode 로 KOSPI(.KS)/KOSDAQ(.KQ) 판별해 Yahoo 형식 심볼로 변환.
async function searchNaver(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `${NAVER_SEARCH}?query=${encodeURIComponent(query)}&target=stock`;
    const res = await fetch(url, { headers: { ...UA, Referer: 'https://m.stock.naver.com/' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { result?: { items?: any[] } };
    return (data.result?.items ?? [])
      .filter((it) => it.code && it.nationCode === 'KOR')
      .map((it) => {
        const suffix = it.typeCode === 'KOSDAQ' ? '.KQ' : '.KS';
        return {
          symbol: `${it.code}${suffix}`,
          name: it.name as string,
          type: 'EQUITY',
          exchange: (it.typeName ?? '') as string, // 코스피 / 코스닥
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
  // 한글이 섞이면 네이버(한국 종목). 결과 없으면 Yahoo 폴백.
  if (HANGUL.test(q)) {
    const naver = await searchNaver(q, limit);
    if (naver.length) return naver;
    return searchYahoo(q, limit);
  }
  return searchYahoo(q, limit);
}
