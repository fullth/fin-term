// 종목 상세. 키 없이 chart meta(거래소/통화/52주/거래량) + Finnhub 있으면 PER/시총/업종 보강.
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FINNHUB_METRIC = 'https://finnhub.io/api/v1/stock/metric';
const FINNHUB_PROFILE = 'https://finnhub.io/api/v1/stock/profile2';

const UA = { 'User-Agent': 'Mozilla/5.0 (fin-term)' };

export interface Detail {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  week52_high: number | null;
  week52_low: number | null;
  volume: number | null;
  // Finnhub 보강 (키 있을 때만)
  pe: number | null;
  market_cap: number | null; // 단위: 백만 (Finnhub profile marketCapitalization)
  industry: string | null;
}

async function fromChartMeta(symbol: string): Promise<Partial<Detail>> {
  try {
    const res = await fetch(`${YAHOO_CHART}/${encodeURIComponent(symbol)}?range=1d&interval=1d`, {
      headers: UA,
    });
    if (!res.ok) return {};
    const meta = ((await res.json()) as any)?.chart?.result?.[0]?.meta ?? {};
    return {
      name: meta.longName ?? meta.shortName ?? null,
      exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
      currency: meta.currency ?? null,
      week52_high: meta.fiftyTwoWeekHigh ?? null,
      week52_low: meta.fiftyTwoWeekLow ?? null,
      volume: meta.regularMarketVolume ?? null,
    };
  } catch {
    return {};
  }
}

async function fromFinnhub(symbol: string, key: string): Promise<Partial<Detail>> {
  try {
    const [metricRes, profileRes] = await Promise.all([
      fetch(`${FINNHUB_METRIC}?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`, { headers: UA }),
      fetch(`${FINNHUB_PROFILE}?symbol=${encodeURIComponent(symbol)}&token=${key}`, { headers: UA }),
    ]);
    const metric = metricRes.ok ? (((await metricRes.json()) as any)?.metric ?? {}) : {};
    const profile = profileRes.ok ? ((await profileRes.json()) as any) : {};
    return {
      pe: metric.peTTM ?? metric.peNormalizedAnnual ?? null,
      market_cap: profile.marketCapitalization ?? null,
      industry: profile.finnhubIndustry ?? null,
    };
  } catch {
    return {};
  }
}

export async function fetchDetail(symbol: string, finnhubKey?: string): Promise<Detail> {
  const base = await fromChartMeta(symbol);
  const enrich = finnhubKey ? await fromFinnhub(symbol, finnhubKey) : {};
  return {
    symbol,
    name: base.name ?? null,
    exchange: base.exchange ?? null,
    currency: base.currency ?? null,
    week52_high: base.week52_high ?? null,
    week52_low: base.week52_low ?? null,
    volume: base.volume ?? null,
    pe: enrich.pe ?? null,
    market_cap: enrich.market_cap ?? null,
    industry: enrich.industry ?? null,
  };
}
