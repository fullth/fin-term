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
  price_krw: number | null; // 업비트 실시간(우선) 또는 CoinGecko KRW
  price_usd: number | null;
  change_1h: number | null;
  change_24h: number | null;
  change_7d: number | null;
  spark: number[]; // 7d sparkline (CoinGecko)
}

async function fetchJson(url: string): Promise<any> {
  // CoinGecko 무료 API 는 순간 429(레이트리밋)가 잦다 → 1회 짧게 재시도.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1200));
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

// CoinGecko: USD(1h/24h/7d + 스파크라인) + KRW(24h) 머지. 코인 목록은 인자로 받음.
export async function fetchCoinDashboard(coins: CoinMeta[] = DEFAULT_COINS): Promise<CoinQuote[]> {
  if (coins.length === 0) return [];
  const ids = coins.map((c) => c.id).join(',');
  const [usd, krw] = await Promise.all([
    fetchJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=1h,24h,7d&sparkline=true`),
    fetchJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=krw&ids=${ids}`),
  ]);
  const krwById = new Map<string, any>((krw as any[]).map((c) => [c.id, c]));
  return coins.map((coin) => {
    const u = (usd as any[]).find((c) => c.id === coin.id);
    const k = krwById.get(coin.id);
    return {
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      upbitMarket: coin.upbitMarket,
      price_krw: k?.current_price ?? null,
      price_usd: u?.current_price ?? null,
      change_1h: u?.price_change_percentage_1h_in_currency ?? null,
      change_24h: u?.price_change_percentage_24h_in_currency ?? u?.price_change_percentage_24h ?? null,
      change_7d: u?.price_change_percentage_7d_in_currency ?? null,
      spark: (u?.sparkline_in_7d?.price ?? []).filter((n: unknown): n is number => typeof n === 'number').slice(-48),
    };
  });
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
