// fin-term BFF. 브라우저가 외부 API 를 직접 못 부르는(CORS·시크릿) 문제를 해결.
// 기존 src/sources/* 를 그대로 재사용해 HTTP/SSE 로 노출한다.
//
// 핵심 설계: 시세·뉴스는 "서버가 단일 폴링→캐시→SSE 브로드캐스트" 한다.
// 클라이언트가 N명이어도 외부 API 호출량은 클라 수와 무관하게 일정하다.
import express from 'express';
import type { Request, Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fetchQuotes } from '../../../src/sources/quote.js';
import { fetchNews } from '../../../src/sources/rss.js';
import { fetchDetail } from '../../../src/sources/detail.js';
import { searchSymbols } from '../../../src/sources/search.js';
import { fetchHot } from '../../../src/sources/hot.js';
import { resolveKey, explainTermWith, generateBriefWith } from './ai.js';
import type { Quote, NewsScope } from '../../../src/core/types.js';
import { DEFAULT_FEEDS, INDICES, MARKETS } from './feeds.js';
import { fetchCoinDashboard, upbitFeed, DEFAULT_COINS, searchCoins, fetchCoinNews, type CoinMeta } from './crypto.js';

const PORT = Number(process.env.PORT ?? 8787);
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const QUOTE_INTERVAL = Number(process.env.FIN_QUOTE_INTERVAL_MS ?? 60_000);
// 지수·환율(markets)은 Finnhub 무료 미지원 심볼 → Yahoo 로만 조회하고 주기를 길게(레이트리밋 절약).
const MARKETS_INTERVAL = Number(process.env.FIN_MARKETS_INTERVAL_MS ?? 300_000);

// 기본 관심종목 — TUI 기본값과 동일. 클라이언트가 watchlist 를 쿼리로 보내면 그걸 우선.
const DEFAULT_WATCHLIST = ['AAPL', 'TSLA', 'NVDA', 'MSFT'];

const app = express();
app.use(express.json());

// 로컬 개발은 Vite(5173) 와 분리 포트라 CORS 허용. 운영은 동일 출처 서빙이라 무영향.
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-AI-Key');
  next();
});

// 헬스체크 — Railway healthcheckPath 와 일치
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── 서버측 공유 시세 캐시 (지수·마켓처럼 전역 공통인 것) ──────────────
interface MarketCache {
  indices: Quote[];
  markets: Quote[];
  updatedAt: number;
}
const marketCache: MarketCache = { indices: [], markets: [], updatedAt: 0 };
const quoteCache = new Map<string, Quote>(); // symbol → 최신 시세 (전역 공유, SSE·REST 공용)

async function refreshMarkets() {
  try {
    // 지수·환율은 Finnhub 무료 미지원 → 키 없이 Yahoo 로만 조회 (Finnhub 레이트리밋 보호)
    const [indices, markets] = await Promise.all([
      fetchQuotes(INDICES.map((i) => i.symbol)),
      fetchQuotes(MARKETS.map((m) => m.symbol)),
    ]);
    marketCache.indices = indices;
    marketCache.markets = markets;
    marketCache.updatedAt = Date.now();
  } catch (e) {
    console.error('[markets] refresh failed', e);
  }
}

// ── REST 라우트 ───────────────────────────────────────────────────────
// 시세 초기 로드: 공유 캐시에 있으면 그대로, 없는 심볼만 조회 (Finnhub 호출 절약).
app.get('/api/quotes', async (req: Request, res: Response) => {
  const symbols = String(req.query.symbols ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const list = symbols.length ? symbols : DEFAULT_WATCHLIST;
  const missing = list.filter((s) => !quoteCache.has(s));
  if (missing.length) {
    const fresh = await fetchQuotes(missing, FINNHUB_KEY);
    for (const q of fresh) if (!q.error) quoteCache.set(q.symbol, q);
  }
  const quotes = list.map((s) => quoteCache.get(s) ?? { symbol: s, price: null, change: null, change_pct: null, open: null, high: null, low: null, prev_close: null, spark: [], updated_at: Date.now(), error: 'no data' });
  res.json({ quotes });
});

// 지수·마켓: 서버 공유 캐시 그대로 반환 (전역 공통)
app.get('/api/markets', (_req, res) => {
  res.json({
    indices: marketCache.indices,
    markets: marketCache.markets,
    labels: { indices: INDICES, markets: MARKETS },
    updatedAt: marketCache.updatedAt,
  });
});

app.get('/api/news', async (req, res) => {
  const scope = (req.query.scope as NewsScope) ?? 'all';
  const watchlist = String(req.query.watchlist ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const news = await fetchNews(DEFAULT_FEEDS, watchlist, scope);
  res.json({ news });
});

app.get('/api/detail/:symbol', async (req, res) => {
  const detail = await fetchDetail(req.params.symbol.toUpperCase(), FINNHUB_KEY);
  res.json({ detail });
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ results: [] });
  const results = await searchSymbols(q);
  res.json({ results });
});

app.get('/api/hot', async (_req, res) => {
  const items = await fetchHot();
  res.json({ items });
});

// AI 기능 사용 가능 여부 — 서버 env 키 보유 여부만 알려줌(클라가 키 없을 때 fallback 판단용).
app.get('/api/ai-status', (_req, res) => res.json({ serverKey: Boolean(process.env.ANTHROPIC_API_KEY) }));

// 클라 헤더 키(X-AI-Key) 우선, 없으면 서버 env. 둘 다 없으면 needKey.
function aiKeyOf(req: Request): string | null {
  return resolveKey(req.header('X-AI-Key') ?? undefined);
}

// AI 브리핑
app.post('/api/brief', async (req, res) => {
  const key = aiKeyOf(req);
  if (!key) return res.status(401).json({ text: null, error: 'need_key' });
  const { watchlist = [], names = {}, quotes = {}, news = [] } = req.body ?? {};
  const text = await generateBriefWith(key, { watchlist, names, quotes, news });
  res.json({ text });
});

// 용어 풀이
app.get('/api/explain', async (req, res) => {
  const key = aiKeyOf(req);
  if (!key) return res.status(401).json({ text: null, error: 'need_key' });
  const term = String(req.query.term ?? '').trim();
  if (!term) return res.json({ text: null });
  const text = await explainTermWith(key, term);
  res.json({ text });
});

// ── SSE: 시세 스트림 (전역 공유 캐시) ────────────────────────────────
// 다수 사용자 대비: 클라이언트별 폴링이 아니라, 서버가 "구독 중인 모든 심볼의 합집합"을
// 단일 루프로 주기 조회해 캐시하고, 모든 구독자에게 같은 캐시를 push 한다.
// → N명이 같은 종목을 봐도 외부 API 호출은 심볼당 1회. Finnhub 레이트리밋 보호.
interface QuoteSub {
  res: Response;
  symbols: string[];
}
const quoteSubs = new Set<QuoteSub>();

// 구독 중인 모든 심볼의 합집합
function subscribedSymbols(): string[] {
  const set = new Set<string>();
  for (const sub of quoteSubs) for (const s of sub.symbols) set.add(s);
  return [...set];
}

let quoteLoopTimer: ReturnType<typeof setInterval> | null = null;
async function quoteLoop() {
  const symbols = subscribedSymbols();
  if (symbols.length === 0) return;
  try {
    const quotes = await fetchQuotes(symbols, FINNHUB_KEY);
    for (const q of quotes) if (!q.error) quoteCache.set(q.symbol, q);
  } catch {
    /* 부분 실패 무시 */
  }
  // 각 구독자에게 자기 심볼 시세만 추려서 push
  for (const sub of quoteSubs) {
    const mine = sub.symbols.map((s) => quoteCache.get(s)).filter((q): q is Quote => !!q);
    try {
      sub.res.write(`event: quotes\ndata: ${JSON.stringify({ quotes: mine })}\n\n`);
      sub.res.write(`event: markets\ndata: ${JSON.stringify({ indices: marketCache.indices, markets: marketCache.markets })}\n\n`);
    } catch {
      /* 끊긴 연결 무시 */
    }
  }
}

app.get('/api/stream/quotes', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(': connected\n\n');

  const symbols = String(req.query.symbols ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const sub: QuoteSub = { res, symbols: symbols.length ? symbols : DEFAULT_WATCHLIST };
  quoteSubs.add(sub);

  // 신규 구독자에게 캐시된 시세 즉시 전달 (없으면 다음 루프에서 채워짐)
  const cached = sub.symbols.map((s) => quoteCache.get(s)).filter((q): q is Quote => !!q);
  if (cached.length) res.write(`event: quotes\ndata: ${JSON.stringify({ quotes: cached })}\n\n`);
  res.write(`event: markets\ndata: ${JSON.stringify({ indices: marketCache.indices, markets: marketCache.markets })}\n\n`);

  // 새 심볼이 추가됐으면 즉시 한 번 조회해 반영 (캐시에 없던 종목)
  const missing = sub.symbols.filter((s) => !quoteCache.has(s));
  if (missing.length) {
    void fetchQuotes(missing, FINNHUB_KEY).then((qs) => {
      for (const q of qs) if (!q.error) quoteCache.set(q.symbol, q);
      const mine = sub.symbols.map((s) => quoteCache.get(s)).filter((q): q is Quote => !!q);
      try {
        res.write(`event: quotes\ndata: ${JSON.stringify({ quotes: mine })}\n\n`);
      } catch {
        /* 무시 */
      }
    });
  }

  // 전역 루프가 멈춰 있으면 시작
  if (!quoteLoopTimer) {
    void quoteLoop();
    quoteLoopTimer = setInterval(() => void quoteLoop(), QUOTE_INTERVAL);
  }

  req.on('close', () => {
    quoteSubs.delete(sub);
    if (quoteSubs.size === 0 && quoteLoopTimer) {
      clearInterval(quoteLoopTimer);
      quoteLoopTimer = null;
    }
  });
});

// 코인 목록 쿼리 파싱: coins=bitcoin:BTC:KRW-BTC,ethereum:ETH:KRW-ETH (id:symbol:market)
function parseCoinsParam(raw: unknown): CoinMeta[] {
  const s = String(raw ?? '').trim();
  if (!s) return DEFAULT_COINS;
  const parsed = s
    .split(',')
    .map((part) => {
      const [id, symbol, upbitMarket] = part.split(':');
      if (!id || !symbol || !upbitMarket) return null;
      return { id, symbol: symbol.toUpperCase(), name: symbol.toUpperCase(), upbitMarket };
    })
    .filter((c): c is CoinMeta => c !== null);
  return parsed.length ? parsed : DEFAULT_COINS;
}

// ── 코인 모드 ─────────────────────────────────────────────────────────
// CoinGecko 대시보드 (시세·변동률·스파크라인). 코인 목록은 쿼리로 받음.
app.get('/api/crypto', async (req, res) => {
  const coins = parseCoinsParam(req.query.coins);
  try {
    const data = await fetchCoinDashboard(coins);
    upbitFeed.ensureMarkets(coins.map((c) => c.upbitMarket));
    res.json({ coins: data });
  } catch (e) {
    res.status(502).json({ coins: [], error: 'coingecko failed' });
  }
});

// 코인 검색 — CoinGecko ∩ 업비트 KRW 상장
app.get('/api/crypto/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ results: [] });
  const results = await searchCoins(q);
  res.json({ results });
});

// 코인 뉴스 — Google News RSS
app.get('/api/crypto/news', async (_req, res) => {
  const news = await fetchCoinNews();
  res.json({ news });
});

// 업비트 실시간 체결가 SSE. 서버 단일 WS → 구독자 다중 중계.
app.get('/api/stream/crypto', (req, res) => {
  // 쿼리로 받은 마켓을 구독 집합에 합류
  const markets = String(req.query.markets ?? '').split(',').filter(Boolean);
  if (markets.length) upbitFeed.ensureMarkets(markets);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(': connected\n\n');
  const unsub = upbitFeed.subscribe((tick) => {
    res.write(`event: tick\ndata: ${JSON.stringify(tick)}\n\n`);
  });
  req.on('close', unsub);
});

// ── 정적 클라이언트 서빙 (운영: 단일 서비스) ─────────────────────────
// 클라이언트 빌드 산출물이 있으면 함께 서빙. SPA 라 미매칭 경로는 index.html 로 폴백.
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = join(__dirname, '../../client/dist');
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(CLIENT_DIST, 'index.html')));
  console.log(`[fin-term BFF] serving client from ${CLIENT_DIST}`);
}

// ── 부팅 ──────────────────────────────────────────────────────────────
void refreshMarkets();
setInterval(() => void refreshMarkets(), MARKETS_INTERVAL);

// 기본 관심종목 시세 캐시 워밍 — 첫 접속이 빈 화면 안 되게 미리 채움.
void fetchQuotes(DEFAULT_WATCHLIST, FINNHUB_KEY).then((qs) => {
  for (const q of qs) if (!q.error) quoteCache.set(q.symbol, q);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[fin-term BFF] listening on :${PORT}  (finnhub=${FINNHUB_KEY ? 'on' : 'off'})`);
});
