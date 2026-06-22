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
const QUOTE_INTERVAL = Number(process.env.FIN_QUOTE_INTERVAL_MS ?? 15_000);

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

async function refreshMarkets() {
  try {
    const [indices, markets] = await Promise.all([
      fetchQuotes(INDICES.map((i) => i.symbol), FINNHUB_KEY),
      fetchQuotes(MARKETS.map((m) => m.symbol), FINNHUB_KEY),
    ]);
    marketCache.indices = indices;
    marketCache.markets = markets;
    marketCache.updatedAt = Date.now();
  } catch (e) {
    console.error('[markets] refresh failed', e);
  }
}

// ── REST 라우트 ───────────────────────────────────────────────────────
// 시세: 클라이언트별 watchlist 가 다르므로 요청 시 조회 (짧은 캐시는 추후)
app.get('/api/quotes', async (req: Request, res: Response) => {
  const symbols = String(req.query.symbols ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const list = symbols.length ? symbols : DEFAULT_WATCHLIST;
  const quotes = await fetchQuotes(list, FINNHUB_KEY);
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

// ── SSE: 시세 스트림 ──────────────────────────────────────────────────
// 클라이언트가 watchlist 를 쿼리로 주면 그 종목들을 주기 폴링해 push.
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
  const list = symbols.length ? symbols : DEFAULT_WATCHLIST;

  let closed = false;
  const tick = async () => {
    if (closed) return;
    try {
      const quotes = await fetchQuotes(list, FINNHUB_KEY);
      res.write(`event: quotes\ndata: ${JSON.stringify({ quotes })}\n\n`);
      res.write(`event: markets\ndata: ${JSON.stringify({ indices: marketCache.indices, markets: marketCache.markets })}\n\n`);
    } catch (e) {
      // 부분 실패는 무시하고 다음 틱 진행
    }
  };

  await tick();
  const timer = setInterval(tick, QUOTE_INTERVAL);
  req.on('close', () => {
    closed = true;
    clearInterval(timer);
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
setInterval(() => void refreshMarkets(), QUOTE_INTERVAL);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[fin-term BFF] listening on :${PORT}  (finnhub=${FINNHUB_KEY ? 'on' : 'off'})`);
});
