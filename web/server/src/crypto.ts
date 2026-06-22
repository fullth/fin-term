// 코인 데이터 소스. CoinGecko(시세·변동률·검색) + 업비트 WS(실시간 KRW 체결가).
// blessed UI 와 무관한 데이터 부분만 발췌해 BFF 용으로 재구성.
import { WebSocket } from 'ws';
import Parser from 'rss-parser';

export interface CoinMeta {
  id: string;
  symbol: string;
  name: string;
  upbitMarket: string;
}

export const DEFAULT_COINS: CoinMeta[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', upbitMarket: 'KRW-BTC' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', upbitMarket: 'KRW-ETH' },
  { id: 'ripple', symbol: 'XRP', name: 'Ripple', upbitMarket: 'KRW-XRP' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', upbitMarket: 'KRW-BCH' },
];

// 하위호환 — 기존 import 유지
export const COINS = DEFAULT_COINS;

const UA = { accept: 'application/json', 'user-agent': 'fin-term-crypto' };

export interface CoinQuote {
  id: string;
  symbol: string;
  name: string;
  upbitMarket: string;
  price_krw: number | null;
  price_usd: number | null; // 업비트는 KRW 마켓만 → USD 미제공(null)
  change_1h: number | null;
  change_24h: number | null;
  change_7d: number | null;
  spark: number[]; // 7일 종가 (업비트 days 캔들)
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 업비트 기반 코인 대시보드 — CoinGecko 가 클라우드 IP 를 차단해 업비트로 일원화.
// ticker(현재가·당일변동) + days 캔들(7일 스파크라인·7d변동) + minutes/60 캔들(1h변동).
export async function fetchCoinDashboard(coins: CoinMeta[] = DEFAULT_COINS): Promise<CoinQuote[]> {
  if (coins.length === 0) return [];
  const markets = coins.map((c) => c.upbitMarket).join(',');
  const tickers = (await fetchJson(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(markets)}`)) as any[];
  const tickerByMarket = new Map<string, any>(tickers.map((t) => [t.market, t]));

  // 코인별 캔들은 병렬로. 실패해도 해당 항목만 비고 전체는 진행.
  return Promise.all(
    coins.map(async (coin) => {
      const t = tickerByMarket.get(coin.upbitMarket);
      let spark: number[] = [];
      let change_7d: number | null = null;
      let change_1h: number | null = null;
      try {
        const days = (await fetchJson(
          `https://api.upbit.com/v1/candles/days?market=${encodeURIComponent(coin.upbitMarket)}&count=7`,
        )) as any[];
        // 업비트는 최신순 → 오래된순으로 뒤집어 스파크라인
        const closes = days.map((d) => d.trade_price).reverse();
        spark = closes;
        if (closes.length >= 2 && closes[0]) change_7d = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
      } catch {
        /* 캔들 실패 무시 */
      }
      try {
        const m = (await fetchJson(
          `https://api.upbit.com/v1/candles/minutes/60?market=${encodeURIComponent(coin.upbitMarket)}&count=1`,
        )) as any[];
        const c = m[0];
        if (c && t && c.opening_price) change_1h = ((t.trade_price - c.opening_price) / c.opening_price) * 100;
      } catch {
        /* 무시 */
      }
      return {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        upbitMarket: coin.upbitMarket,
        price_krw: t?.trade_price ?? null,
        price_usd: null,
        change_1h,
        change_24h: t ? t.signed_change_rate * 100 : null,
        change_7d,
        spark,
      };
    }),
  );
}

// 업비트 실시간 체결가를 단일 WS 로 받아 콜백으로 흘려보낸다 (서버 1연결 → SSE 다중 중계).
export interface UpbitTick {
  market: string; // KRW-BTC
  trade_price: number;
  change_rate: number; // 0.0123 = +1.23%
  change: 'RISE' | 'FALL' | 'EVEN';
}

type TickListener = (tick: UpbitTick) => void;

// 구독할 마켓 집합을 동적으로 관리. 새 코인이 추가되면 구독 갱신.
class UpbitFeed {
  private ws: WebSocket | null = null;
  private listeners = new Set<TickListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private latest = new Map<string, UpbitTick>();
  private markets = new Set<string>(DEFAULT_COINS.map((c) => c.upbitMarket));

  // 구독 마켓 갱신 — 합집합 유지. 새 마켓이 생기면 재구독.
  ensureMarkets(codes: string[]) {
    let changed = false;
    for (const c of codes) {
      if (c && !this.markets.has(c)) {
        this.markets.add(c);
        changed = true;
      }
    }
    if (changed && this.ws?.readyState === WebSocket.OPEN) this.sendSubscribe();
  }

  subscribe(fn: TickListener): () => void {
    this.listeners.add(fn);
    for (const t of this.latest.values()) fn(t);
    if (this.listeners.size === 1) this.connect();
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.disconnect();
    };
  }

  private sendSubscribe() {
    this.ws?.send(
      JSON.stringify([{ ticket: 'fin-term-web' }, { type: 'ticker', codes: [...this.markets] }]),
    );
  }

  private connect() {
    this.ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    this.ws.on('open', () => this.sendSubscribe());
    this.ws.on('message', (raw: Buffer) => {
      try {
        const d = JSON.parse(raw.toString());
        const tick: UpbitTick = {
          market: d.code ?? d.cd,
          trade_price: d.trade_price ?? d.tp,
          change_rate: (d.signed_change_rate ?? d.scr ?? 0),
          change: (d.change ?? d.c ?? 'EVEN') as UpbitTick['change'],
        };
        if (!tick.market) return;
        this.latest.set(tick.market, tick);
        for (const fn of this.listeners) fn(tick);
      } catch {
        /* 무시 */
      }
    });
    this.ws.on('close', () => this.scheduleReconnect());
    this.ws.on('error', () => this.ws?.close());
  }

  private scheduleReconnect() {
    if (this.listeners.size === 0 || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.listeners.size > 0) this.connect();
    }, 3000);
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

export const upbitFeed = new UpbitFeed();

// ── 업비트 KRW 마켓 캐시 (검색 시 거래 가능 여부 판별) ────────────────
let upbitMarkets: { market: string; symbol: string }[] = [];
let upbitMarketsAt = 0;
async function getUpbitMarkets(): Promise<{ market: string; symbol: string }[]> {
  if (upbitMarkets.length && Date.now() - upbitMarketsAt < 3_600_000) return upbitMarkets;
  try {
    const all = (await fetchJson('https://api.upbit.com/v1/market/all')) as any[];
    upbitMarkets = all
      .filter((m) => typeof m.market === 'string' && m.market.startsWith('KRW-'))
      .map((m) => ({ market: m.market, symbol: m.market.slice(4) }));
    upbitMarketsAt = Date.now();
  } catch {
    /* 캐시 유지 */
  }
  return upbitMarkets;
}

// 코인 검색 — CoinGecko 검색 ∩ 업비트 KRW 상장 (실시간 시세 가능한 것만)
export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  upbitMarket: string;
}
export async function searchCoins(query: string, limit = 8): Promise<CoinSearchResult[]> {
  if (!query.trim()) return [];
  const [search, markets] = await Promise.all([
    fetchJson(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`),
    getUpbitMarkets(),
  ]);
  const krwSymbols = new Map(markets.map((m) => [m.symbol.toUpperCase(), m.market]));
  const out: CoinSearchResult[] = [];
  for (const c of (search?.coins ?? []) as any[]) {
    const sym = String(c.symbol).toUpperCase();
    const upbitMarket = krwSymbols.get(sym);
    if (!upbitMarket) continue; // 업비트 KRW 미상장 → 제외
    out.push({ id: c.id, symbol: sym, name: c.name, upbitMarket });
    if (out.length >= limit) break;
  }
  return out;
}

// 코인 뉴스 — Google News RSS (코인 키워드). 제목/시간/출처만.
const cryptoParser = new Parser({ headers: { 'User-Agent': 'Mozilla/5.0 (fin-term)' }, timeout: 8000 });
export interface CoinNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: number;
}
let coinNewsCache: CoinNewsItem[] = [];
let coinNewsAt = 0;
export async function fetchCoinNews(): Promise<CoinNewsItem[]> {
  if (coinNewsCache.length && Date.now() - coinNewsAt < 60_000) return coinNewsCache;
  const q = encodeURIComponent('비트코인 OR 이더리움 OR 가상자산 OR 암호화폐 OR 코인');
  try {
    const feed = await cryptoParser.parseURL(`https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`);
    coinNewsCache = (feed.items ?? []).slice(0, 30).map((it, i) => ({
      id: it.guid ?? it.link ?? String(i),
      title: it.title ?? '',
      url: it.link ?? '',
      source: (it as any).source?.['#text'] ?? it.creator ?? 'Google News',
      published_at: it.isoDate ? new Date(it.isoDate).getTime() : Date.now(),
    }));
    coinNewsAt = Date.now();
  } catch {
    /* 캐시 유지 */
  }
  return coinNewsCache;
}
