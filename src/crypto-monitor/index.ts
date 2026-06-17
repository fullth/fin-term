// bitcoin-monitor 원본(blessed) 화면을 그대로 옮긴 코인 모니터.
// fin-term 코인 모드 진입 시 Ink 를 내리고 이 화면을 띄운다. q 또는 m 으로 주식 모드 복귀.
// 원본 index.mjs 의 로직을 거의 1:1 보존 (holdings 경로/형식만 fin-term 에 맞춤).
// @ts-nocheck — blessed/blessed-contrib 는 타입이 느슨해 원본 JS 를 그대로 유지한다.
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import WebSocket from 'ws';

const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', upbitMarket: 'KRW-BTC' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', upbitMarket: 'KRW-ETH' },
  { id: 'ripple', symbol: 'XRP', name: 'Ripple', upbitMarket: 'KRW-XRP' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', upbitMarket: 'KRW-BCH' },
];

const BACKGROUND_REFRESH_MS = 120_000;
const NEWS_LIMIT = 14;
const ALERT_HISTORY_LIMIT = 12;
const HOLDINGS_FILE = join(homedir(), '.fin-term', 'holdings.json');
const TIMEFRAMES = [
  { label: '1분', key: 'minute-1', endpoint: 'minutes/1', count: 30, format: { hour: '2-digit', minute: '2-digit', hour12: false } },
  { label: '1시간', key: 'minute-60', endpoint: 'minutes/60', count: 24, format: { month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false } },
  { label: '24시간', key: 'day-1', endpoint: 'minutes/60', count: 24, format: { hour: '2-digit', minute: '2-digit', hour12: false } },
  { label: '7일', key: 'day-7', endpoint: 'days', count: 7, format: { month: '2-digit', day: '2-digit' } },
  { label: '1달', key: 'month-1', endpoint: 'days', count: 30, format: { month: '2-digit', day: '2-digit' } },
];

// fin-term holdings.json (snake_case) → 원본이 기대하는 형식으로 로드.
function loadHoldings() {
  try {
    const raw = JSON.parse(readFileSync(HOLDINGS_FILE, 'utf8'));
    if (!Array.isArray(raw)) return [];
    return raw.map((h: any) => ({
      id: h.id,
      symbol: String(h.symbol ?? h.id).toUpperCase(),
      quantity: Number(h.quantity) || 0,
      avgBuyKrw: Number(h.avg_buy_krw ?? h.avgBuyKrw) || 0,
      buyAmountKrw:
        Number(h.buy_amount_krw ?? h.buyAmountKrw) ||
        (Number(h.quantity) || 0) * (Number(h.avg_buy_krw ?? h.avgBuyKrw) || 0),
    }));
  } catch {
    return [];
  }
}

export interface CryptoMonitorHandle {
  destroy: () => void;
}

// blessed 화면을 띄운다. onExit 은 q/m 입력 시(주식 모드 복귀) 호출.
export function startCryptoMonitor(onExit: () => void): CryptoMonitorHandle {
  const HOLDINGS = loadHoldings();

  const state = {
    selectedIndex: 0,
    selectedTimeframeIndex: 3,
    isSensitiveMasked: false,
    lastUpdated: '-',
    feedStatus: 'polling',
    previousPrices: new Map<string, number>(),
    previousPortfolioReturns: new Map<string, number>(),
    alerts: [] as string[],
    renderTimer: null as ReturnType<typeof setTimeout> | null,
    priceFlash: new Map<string, { direction: string; until: number }>(),
    data: { markets: [] as any[], marketsKrw: [] as any[], news: [] as any[], chart: [] as any[] },
  };

  const FEED_STATUS_LABELS: Record<string, string> = {
    polling: '폴링',
    connecting: '연결중',
    live: '실시간',
    reconnecting: '재연결중',
    error: '오류',
  };

  const SENSITIVE_MASK = '**';

  const screen = blessed.screen({
    smartCSR: true,
    title: '비트코인 모니터링 패널',
    fullUnicode: true,
  });

  const grid = new contrib.grid({ rows: 18, cols: 12, screen });

  const header = grid.set(0, 0, 3, 12, blessed.box, {
    label: ' 코인 모니터 ',
    tags: true,
    border: 'line',
    style: { border: { fg: 'cyan' } },
  });

  const watchlistTable = grid.set(3, 0, 5, 4, blessed.box, {
    label: ' 관심 코인 ',
    tags: true,
    border: 'line',
    style: { border: { fg: 'cyan' } },
  });

  const quoteBox = grid.set(3, 4, 5, 8, blessed.box, {
    label: ' 시세 상세 ',
    tags: true,
    border: 'line',
    style: { border: { fg: 'yellow' } },
    scrollable: true,
    alwaysScroll: true,
  });

  const chart = grid.set(8, 0, 6, 8, blessed.box, {
    label: ' 차트 ',
    tags: true,
    border: 'line',
    style: { border: { fg: 'cyan' } },
  });

  const metricsBox = grid.set(8, 8, 6, 2, blessed.box, {
    label: ' 보유 요약 ',
    tags: true,
    border: 'line',
    style: { border: { fg: 'magenta' } },
  });

  const alertsLog = grid.set(8, 10, 6, 2, contrib.log, {
    label: ' 알림 ',
    fg: 'white',
    selectedFg: 'white',
    border: { type: 'line', fg: 'red' },
  });

  const newsLog = grid.set(14, 0, 3, 12, contrib.log, {
    label: ' 뉴스 ',
    fg: 'white',
    selectedFg: 'white',
    border: { type: 'line', fg: 'yellow' },
  });

  const footer = grid.set(17, 0, 1, 12, blessed.box, {
    tags: true,
    border: 'line',
    style: { border: { fg: 'gray' } },
  });

  function fmtCurrency(value: number) {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  }

  function fmtKrw(value: number) {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function fmtCompact(value: number) {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  }

  function fmtPercent(value: number) {
    if (value == null || Number.isNaN(Number(value))) return '-';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  function fmtSensitive(value: number, formatter: (v: number) => string) {
    if (state.isSensitiveMasked) return SENSITIVE_MASK;
    return formatter(value);
  }

  function fmtUnits(value: number) {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(value);
  }

  function fmtPriceLabel(value: number) {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }

  function feedStatusLabel(status: string) {
    return FEED_STATUS_LABELS[status] ?? status;
  }

  function colorizePercent(value: number) {
    const text = fmtPercent(value);
    if (text === '-') return '{white-fg}-{/white-fg}';
    const color = value >= 0 ? 'red' : 'blue';
    return `{${color}-fg}${text}{/${color}-fg}`;
  }

  function colorizeSensitivePercent(value: number) {
    if (state.isSensitiveMasked) return `{white-fg}${SENSITIVE_MASK}{/white-fg}`;
    return colorizePercent(value);
  }

  function maskingStatusLabel() {
    return state.isSensitiveMasked ? '{yellow-fg}ON{/yellow-fg}' : '{white-fg}OFF{/white-fg}';
  }

  function selectedCoin() {
    return COINS[state.selectedIndex];
  }

  function selectedTimeframe() {
    return TIMEFRAMES[state.selectedTimeframeIndex];
  }

  function getMarketById(id: string) {
    return state.data.markets.find((coin: any) => coin.id === id);
  }

  function getKrwMarketById(id: string) {
    return state.data.marketsKrw.find((coin: any) => coin.id === id);
  }

  function getHoldingById(id: string) {
    return HOLDINGS.find((coin: any) => coin.id === id);
  }

  function getCoinByUpbitMarket(code: string) {
    return COINS.find((coin) => coin.upbitMarket === code);
  }

  function getHoldingSnapshot(id: string) {
    const holding = getHoldingById(id);
    const marketKrw = getKrwMarketById(id);
    if (!holding || !marketKrw) return null;
    const currentValueKrw = holding.quantity * marketKrw.current_price;
    const buyAmountKrw = holding.buyAmountKrw ?? holding.quantity * holding.avgBuyKrw;
    const pnlKrw = currentValueKrw - buyAmountKrw;
    const returnPct = buyAmountKrw > 0 ? (pnlKrw / buyAmountKrw) * 100 : null;
    return { ...holding, currentPriceKrw: marketKrw.current_price, currentValueKrw, buyAmountKrw, pnlKrw, returnPct };
  }

  function getPortfolioSummary() {
    const snapshots = COINS.map((coin) => getHoldingSnapshot(coin.id)).filter(Boolean) as any[];
    const totals = snapshots.reduce(
      (acc, item) => {
        acc.buyAmountKrw += item.buyAmountKrw;
        acc.currentValueKrw += item.currentValueKrw;
        acc.pnlKrw += item.pnlKrw;
        return acc;
      },
      { buyAmountKrw: 0, currentValueKrw: 0, pnlKrw: 0 },
    );
    const returnPct = totals.buyAmountKrw > 0 ? (totals.pnlKrw / totals.buyAmountKrw) * 100 : null;
    return { ...totals, returnPct, snapshots };
  }

  function pushAlert(message: string) {
    const timestamp = new Date().toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    state.alerts.unshift(`[${timestamp}] ${message}`);
    state.alerts = state.alerts.slice(0, ALERT_HISTORY_LIMIT);
  }

  function sendMacNotification(title: string, subtitle: string, message: string) {
    const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(
      title,
    )} subtitle ${JSON.stringify(subtitle)}`;
    execFile('osascript', ['-e', script], () => {});
  }

  function getThresholdStepsBetween(previousPct: number, currentPct: number) {
    if (previousPct == null || currentPct == null || previousPct === currentPct) return [];
    const thresholds: number[] = [];
    if (currentPct > previousPct) {
      const start = Math.ceil((previousPct + Number.EPSILON) / 5) * 5;
      for (let step = start; step <= currentPct; step += 5) thresholds.push(step);
      return thresholds;
    }
    const start = Math.floor((previousPct - Number.EPSILON) / 5) * 5;
    for (let step = start; step >= currentPct; step -= 5) thresholds.push(step);
    return thresholds;
  }

  function checkPortfolioThresholdAlert(coinId: string) {
    const coin = COINS.find((item) => item.id === coinId);
    const snapshot = getHoldingSnapshot(coinId);
    if (!coin || !snapshot || snapshot.returnPct == null) return;
    const previousPct = state.previousPortfolioReturns.get(coinId);
    state.previousPortfolioReturns.set(coinId, snapshot.returnPct);
    if (previousPct == null) return;
    const crossedSteps = getThresholdStepsBetween(previousPct, snapshot.returnPct);
    for (const step of crossedSteps) {
      const direction = snapshot.returnPct >= previousPct ? '상향 돌파' : '하향 이탈';
      const message = `${coin.symbol} 수익률 ${fmtPercent(step)} ${direction}`;
      pushAlert(message);
      sendMacNotification('코인 수익률 알림', `${coin.symbol} ${fmtPercent(step)}`, `${direction} · 현재 ${fmtPercent(snapshot.returnPct)}`);
    }
  }

  function setFlashDirection(id: string, direction: string) {
    state.priceFlash.set(id, { direction, until: Date.now() + 900 });
  }

  function getFlashDirection(id: string) {
    const flash = state.priceFlash.get(id);
    if (!flash) return null;
    if (Date.now() > flash.until) {
      state.priceFlash.delete(id);
      return null;
    }
    return flash.direction;
  }

  function padText(value: any, width: number) {
    return String(value).padEnd(width, ' ');
  }

  function setLastUpdatedFromTimestamp(timestamp = Date.now()) {
    state.lastUpdated = new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function queueRender() {
    if (state.renderTimer) return;
    state.renderTimer = setTimeout(() => {
      state.renderTimer = null;
      renderAll();
    }, 150);
  }

  function updateAlertsFromMarket(markets: any[]) {
    for (const coin of markets) {
      const prev = state.previousPrices.get(coin.id);
      if (prev != null) {
        const move = ((coin.current_price - prev) / prev) * 100;
        if (Math.abs(move) >= 1) pushAlert(`${coin.symbol.toUpperCase()} 폴링 기준 ${fmtPercent(move)} 변동`);
      }
      const dayMove = coin.price_change_percentage_24h ?? 0;
      if (dayMove >= 5) pushAlert(`${coin.symbol.toUpperCase()} 24시간 급등 ${fmtPercent(dayMove)}`);
      if (dayMove <= -5) pushAlert(`${coin.symbol.toUpperCase()} 24시간 급락 ${fmtPercent(dayMove)}`);
      state.previousPrices.set(coin.id, coin.current_price);
    }
  }

  function applyLiveTicker(ticker: any) {
    const coin = getCoinByUpbitMarket(ticker.code);
    if (!coin) return;
    const market = getKrwMarketById(coin.id);
    if (!market) return;
    market.current_price = ticker.trade_price;
    market.high_24h = ticker.high_price;
    market.low_24h = ticker.low_price;
    market.total_volume = ticker.acc_trade_price_24h;
    market.price_change_percentage_24h = (ticker.signed_change_rate ?? 0) * 100;
    const previous = state.previousPrices.get(`${coin.id}:krw-live`);
    if (previous != null) {
      const move = ((ticker.trade_price - previous) / previous) * 100;
      const direction = ticker.trade_price > previous ? 'up' : ticker.trade_price < previous ? 'down' : 'flat';
      if (direction !== 'flat') setFlashDirection(coin.id, direction);
      if (Math.abs(move) >= 0.5) pushAlert(`${coin.symbol} 실시간 변동 ${fmtPercent(move)}`);
    }
    state.previousPrices.set(`${coin.id}:krw-live`, ticker.trade_price);
    checkPortfolioThresholdAlert(coin.id);
    state.feedStatus = 'live';
    setLastUpdatedFromTimestamp(ticker.trade_timestamp);
    queueRender();
  }

  async function fetchJson(url: string) {
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'fin-term-crypto' } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  async function fetchText(url: string) {
    const response = await fetch(url, {
      headers: { accept: 'application/rss+xml, application/xml, text/xml, text/plain', 'user-agent': 'fin-term-crypto' },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  }

  function decodeHtml(value: string) {
    return value
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  function parseRssItems(xml: string) {
    const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return matches.slice(0, NEWS_LIMIT).map(([, item]) => {
      const title = decodeHtml(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? 'Untitled');
      const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? '';
      const source = decodeHtml(item.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? 'Google News');
      return {
        title,
        source_info: { name: source },
        published_on: pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : 0,
      };
    });
  }

  async function fetchChartData() {
    const coin = selectedCoin();
    const timeframe = selectedTimeframe();
    const data = await fetchJson(
      `https://api.upbit.com/v1/candles/${timeframe.endpoint}?market=${coin.upbitMarket}&count=${timeframe.count}`,
    );
    state.data.chart = data
      .map((item: any) => ({
        timestamp: new Date(item.candle_date_time_kst || item.candle_date_time_utc).getTime(),
        open: item.opening_price,
        high: item.high_price,
        low: item.low_price,
        close: item.trade_price,
      }))
      .reverse();
  }

  async function fetchDashboardData() {
    const ids = COINS.map((coin) => coin.id).join(',');
    const [marketsResult, marketsKrwResult, newsResult] = await Promise.allSettled([
      fetchJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=1h,24h,7d`),
      fetchJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=krw&ids=${ids}&price_change_percentage=24h`),
      fetchText('https://news.google.com/rss/search?q=%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8+OR+%EC%9D%B4%EB%8D%94%EB%A6%AC%EC%9B%80+OR+%EB%A6%AC%ED%94%8C+OR+%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8%EC%BA%90%EC%8B%9C&hl=ko&gl=KR&ceid=KR:ko'),
    ]);

    let hasCoreFailure = false;
    if (marketsResult.status === 'fulfilled') {
      state.data.markets = marketsResult.value as any[];
      updateAlertsFromMarket(marketsResult.value as any[]);
    } else if (state.data.markets.length === 0) {
      hasCoreFailure = true;
    }
    if (marketsKrwResult.status === 'fulfilled') {
      state.data.marketsKrw = marketsKrwResult.value as any[];
    } else if (state.data.marketsKrw.length === 0) {
      hasCoreFailure = true;
    }
    if (newsResult.status === 'fulfilled') {
      state.data.news = parseRssItems(newsResult.value as string);
    }
    const chartResult = await Promise.allSettled([fetchChartData()]);
    if (chartResult[0].status === 'rejected' && state.data.chart.length === 0) hasCoreFailure = true;
    setLastUpdatedFromTimestamp();
    if (hasCoreFailure) throw new Error('일부 시세 데이터를 아직 가져오지 못했습니다');
  }

  let ws: WebSocket | null = null;
  let wsClosedByUs = false;

  function connectLiveTicker() {
    ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    ws.on('open', () => {
      state.feedStatus = 'connecting';
      ws?.send(
        JSON.stringify([
          { ticket: 'fin-term-crypto' },
          { type: 'ticker', codes: COINS.map((coin) => coin.upbitMarket), isOnlyRealtime: true },
        ]),
      );
      pushAlert('업비트 실시간 시세 연결됨');
      queueRender();
    });
    ws.on('message', (payload: Buffer) => {
      try {
        const ticker = JSON.parse(payload.toString('utf8'));
        applyLiveTicker(ticker);
      } catch (error: any) {
        pushAlert(`실시간 시세 파싱 실패: ${error.message}`);
        queueRender();
      }
    });
    ws.on('close', () => {
      if (wsClosedByUs) return;
      state.feedStatus = 'reconnecting';
      pushAlert('업비트 실시간 연결 종료, 재시도 중');
      queueRender();
      setTimeout(connectLiveTicker, 3000);
    });
    ws.on('error', (error: any) => {
      state.feedStatus = 'error';
      pushAlert(`업비트 실시간 오류: ${error.message}`);
      queueRender();
    });
  }

  function renderHeader() {
    const selected = selectedCoin();
    const portfolio = getPortfolioSummary();
    header.setContent(
      [
        '{bold}실시간 코인 시세 + 한국어 뉴스{/bold}',
        `선택: {cyan-fg}${selected.symbol}{/cyan-fg} ${selected.name}  |  시세: {white-fg}${feedStatusLabel(state.feedStatus)}{/white-fg}  |  갱신: {white-fg}${state.lastUpdated}{/white-fg}`,
        `총 평가금액: ${fmtSensitive(portfolio.currentValueKrw, fmtKrw)}  |  손익 ${fmtSensitive(portfolio.pnlKrw, fmtKrw)} (${colorizeSensitivePercent(portfolio.returnPct as number)})`,
        `키: {yellow-fg}Up/Down{/yellow-fg} 코인 이동  {yellow-fg}Left/Right{/yellow-fg} 차트 기간  {yellow-fg}1-4{/yellow-fg} 바로가기  {yellow-fg}m{/yellow-fg} 마스킹  {yellow-fg}r{/yellow-fg} 새로고침  {yellow-fg}q{/yellow-fg} 주식 모드`,
      ].join('\n'),
    );
  }

  function renderWatchlist() {
    const lines = [`{bold}${padText('코인', 8)}${padText('수량', 12)}${padText('원화', 12)}24H{/bold}`, ''];
    COINS.forEach((coin, index) => {
      const market = getKrwMarketById(coin.id);
      const holding = getHoldingById(coin.id);
      const flash = getFlashDirection(coin.id);
      const pointer = index === state.selectedIndex ? '>' : ' ';
      const price = market ? fmtCompact(market.current_price) : '-';
      const change = market ? colorizePercent(market.price_change_percentage_24h ?? 0) : '{white-fg}-{/white-fg}';
      const qty = holding ? fmtUnits(holding.quantity) : '-';
      const tick = flash === 'up' ? '▲' : flash === 'down' ? '▼' : '•';
      lines.push(`${pointer}${tick}${padText(coin.symbol, 6)}${padText(qty, 12)}${padText(price, 12)}${change}`);
    });
    watchlistTable.setContent(lines.join('\n'));
  }

  function renderQuote() {
    const market = getMarketById(selectedCoin().id);
    const holding = getHoldingSnapshot(selectedCoin().id);
    const marketKrw = getKrwMarketById(selectedCoin().id);
    const flash = getFlashDirection(selectedCoin().id);
    if (!market || !holding || !marketKrw) {
      quoteBox.setContent('시세 불러오는 중...');
      return;
    }
    (quoteBox.style as any).border.fg = flash === 'up' ? 'red' : flash === 'down' ? 'blue' : 'yellow';
    const liveColor = flash === 'up' ? 'red' : flash === 'down' ? 'blue' : 'white';
    const liveText = flash === 'up' ? '상승' : flash === 'down' ? '하락' : '보합';
    quoteBox.setContent(
      [
        `{bold}${market.symbol.toUpperCase()} ${market.name}{/bold}`,
        `${fmtCurrency(market.current_price)}   ${colorizePercent(market.price_change_percentage_24h ?? 0)}`,
        `${fmtKrw(marketKrw.current_price)}   평균가 ${fmtSensitive(holding.avgBuyKrw, fmtKrw)}`,
        `실시간 체결    {${liveColor}-fg}${liveText}{/${liveColor}-fg}`,
        '',
        `보유 수량      ${fmtUnits(holding.quantity)} ${market.symbol.toUpperCase()}`,
        `매수 금액      ${fmtSensitive(holding.buyAmountKrw, fmtKrw)}`,
        `평가 금액      ${fmtSensitive(holding.currentValueKrw, fmtKrw)}`,
        `평가 손익      ${fmtSensitive(holding.pnlKrw, fmtKrw)} (${colorizeSensitivePercent(holding.returnPct as number)})`,
        '',
        `시가총액       ${fmtCurrency(market.market_cap)}`,
        `24H 거래대금   ${fmtCompact(market.total_volume)}`,
        `유통 공급량    ${fmtCompact(market.circulating_supply)}`,
        `24H 고가       ${fmtCurrency(market.high_24h)}`,
        `24H 저가       ${fmtCurrency(market.low_24h)}`,
        `ATH            ${fmtCurrency(market.ath)}`,
        `ATL            ${fmtCurrency(market.atl)}`,
        '',
        `1시간 변동     ${colorizePercent(market.price_change_percentage_1h_in_currency ?? 0)}`,
        `7일 변동       ${colorizePercent(market.price_change_percentage_7d_in_currency ?? 0)}`,
        `시총 순위      #${market.market_cap_rank ?? '-'}`,
      ].join('\n'),
    );
  }

  function renderChart() {
    const market = getKrwMarketById(selectedCoin().id);
    const holding = getHoldingSnapshot(selectedCoin().id);
    const timeframe = selectedTimeframe();
    const candles = state.data.chart;
    if (!market || !holding || candles.length === 0) {
      chart.setLabel(` ${timeframe.label} 캔들 `);
      chart.setContent('차트 불러오는 중...');
      return;
    }
    const firstPrice = candles[0].open;
    const lastPrice = candles[candles.length - 1].close;
    const highPrice = Math.max(...candles.map((point: any) => point.high));
    const lowPrice = Math.min(...candles.map((point: any) => point.low));
    const changePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
    const trendColor = changePct >= 0 ? 'red' : 'blue';
    (chart.style as any).border.fg = trendColor;
    chart.setLabel(
      ` ${selectedCoin().symbol} ${timeframe.label} ${fmtPriceLabel(lastPrice)} ${fmtPercent(changePct)} 평균가 ${fmtSensitive(holding.avgBuyKrw, fmtPriceLabel)} `,
    );
    const innerWidth = Math.max(12, ((chart.width as number) ?? 40) - 4);
    const innerHeight = Math.max(6, ((chart.height as number) ?? 12) - 3);
    const labelRowCount = 1;
    const plotRows = Math.max(4, innerHeight - labelRowCount);
    const candleSlots = Math.max(6, Math.floor(innerWidth / 2));
    let sampled: any[];
    if (candles.length <= candleSlots) {
      sampled = candles.slice();
    } else {
      const step = Math.max(1, Math.ceil(candles.length / candleSlots));
      sampled = candles.filter((_: any, index: number) => index % step === 0).slice(-candleSlots);
    }
    if (sampled.length === 0) sampled = candles.slice(-Math.min(candleSlots, candles.length));
    if (sampled.length === 0) {
      chart.setContent('차트 불러오는 중...');
      return;
    }
    const span = highPrice - lowPrice;
    const padding = span === 0 ? Math.max(lastPrice * 0.01, 1) : span * 0.08;
    const minPrice = Math.max(0, lowPrice - padding);
    const maxPrice = highPrice + padding;
    const range = Math.max(maxPrice - minPrice, 1);
    const cells = Array.from({ length: plotRows }, () =>
      Array.from({ length: innerWidth }, () => ({ ch: ' ', color: null as string | null })),
    );
    const toRow = (price: number) => {
      const scaled = ((maxPrice - price) / range) * (plotRows - 1);
      return Math.max(0, Math.min(plotRows - 1, Math.round(scaled)));
    };
    sampled.forEach((candle: any, index: number) => {
      const x = Math.min(innerWidth - 1, index * 2);
      const wickTop = toRow(candle.high);
      const wickBottom = toRow(candle.low);
      const openRow = toRow(candle.open);
      const closeRow = toRow(candle.close);
      const color = candle.close >= candle.open ? 'red' : 'blue';
      const bodyTop = Math.min(openRow, closeRow);
      const bodyBottom = Math.max(openRow, closeRow);
      for (let row = wickTop; row <= wickBottom; row += 1) cells[row][x] = { ch: '│', color: 'white' };
      if (bodyTop === bodyBottom) {
        cells[bodyTop][x] = { ch: '■', color };
      } else {
        for (let row = bodyTop; row <= bodyBottom; row += 1) cells[row][x] = { ch: '█', color };
      }
    });
    const chartLines = cells.map((row) =>
      row.map((cell) => (!cell.color ? cell.ch : `{${cell.color}-fg}${cell.ch}{/${cell.color}-fg}`)).join(''),
    );
    const firstLabel = new Date(sampled[0].timestamp).toLocaleTimeString('ko-KR', timeframe.format as any);
    const midLabel = new Date(sampled[Math.floor(sampled.length / 2)].timestamp).toLocaleTimeString('ko-KR', timeframe.format as any);
    const lastLabel = new Date(sampled[sampled.length - 1].timestamp).toLocaleTimeString('ko-KR', timeframe.format as any);
    const left = firstLabel;
    const right = lastLabel;
    const middleStart = Math.max(0, Math.floor((innerWidth - midLabel.length) / 2));
    const bottomChars = Array.from({ length: innerWidth }, () => ' ');
    for (let i = 0; i < left.length && i < innerWidth; i += 1) bottomChars[i] = left[i];
    for (let i = 0; i < midLabel.length && middleStart + i < innerWidth; i += 1) bottomChars[middleStart + i] = midLabel[i];
    for (let i = 0; i < right.length && innerWidth - right.length + i < innerWidth; i += 1) {
      const index = innerWidth - right.length + i;
      if (index >= 0) bottomChars[index] = right[i];
    }
    const bottomLine = bottomChars.join('');
    chart.setContent(
      [
        `{white-fg}고가 ${fmtPriceLabel(highPrice)}{/white-fg}  {yellow-fg}평균매수가 ${fmtSensitive(holding.avgBuyKrw, fmtPriceLabel)}{/yellow-fg}  {white-fg}저가 ${fmtPriceLabel(lowPrice)}{/white-fg}`,
        ...chartLines.slice(0, Math.max(0, plotRows - 1)),
        `{gray-fg}${bottomLine}{/gray-fg}`,
      ].join('\n'),
    );
  }

  function renderMetrics() {
    const portfolio = getPortfolioSummary();
    if (portfolio.snapshots.length === 0) {
      metricsBox.setContent('보유 요약 불러오는 중...');
      return;
    }
    metricsBox.setContent(
      [
        '{bold}포트폴리오{/bold}',
        '',
        `매수\n${fmtSensitive(portfolio.buyAmountKrw, fmtKrw)}`,
        '',
        `평가\n${fmtSensitive(portfolio.currentValueKrw, fmtKrw)}`,
        '',
        `손익\n${fmtSensitive(portfolio.pnlKrw, fmtKrw)}`,
        '',
        `수익률\n${colorizeSensitivePercent(portfolio.returnPct as number)}`,
        '',
        `선택\n${selectedTimeframe().label}`,
      ].join('\n'),
    );
  }

  function renderAlerts() {
    alertsLog.setItems(state.alerts.length > 0 ? state.alerts : ['알림 대기 중...']);
  }

  function renderNews() {
    const lines = state.data.news.map((item: any, index: number) => {
      const time = new Date((item.published_on ?? 0) * 1000).toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
      const source = item.source_info?.name ?? 'News';
      return `${String(index + 1).padStart(2, ' ')} ${time} [${source}] ${item.title}`;
    });
    newsLog.setItems(lines.length > 0 ? lines : ['뉴스 불러오는 중...']);
  }

  function renderFooter() {
    footer.setContent(
      `{gray-fg}원화 시세: 업비트 웹소켓  |  차트: Left/Right로 1분, 1시간, 24시간, 7일, 1달 전환  |  마스킹: ${maskingStatusLabel()} {gray-fg}(m){/gray-fg}  |  보유정보: ~/.fin-term/holdings.json  |  한국 뉴스 RSS + 배경 새로고침 120초  |  q: 주식 모드{/gray-fg}`,
    );
  }

  function renderAll() {
    renderHeader();
    renderWatchlist();
    renderQuote();
    renderChart();
    renderMetrics();
    renderAlerts();
    renderNews();
    renderFooter();
    screen.render();
  }

  async function refreshDashboard(showStatus = true) {
    try {
      if (showStatus) {
        footer.setContent('{yellow-fg}시장 데이터 갱신 중...{/yellow-fg}');
        screen.render();
      }
      await fetchDashboardData();
      renderAll();
    } catch (error: any) {
      pushAlert(`데이터 갱신 실패: ${error.message}`);
      renderAll();
    }
  }

  let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

  // 정리 후 주식 모드로 복귀.
  function exitToStock() {
    cleanup();
    onExit();
  }

  function cleanup() {
    wsClosedByUs = true;
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    if (state.renderTimer) clearTimeout(state.renderTimer);
    try {
      ws?.close();
    } catch {
      /* noop */
    }
    try {
      screen.destroy();
    } catch {
      /* noop */
    }
  }

  function bindKeys() {
    // 원본의 q=종료 → 여기선 주식 모드 복귀. C-c 는 전체 종료 신호로 위임.
    screen.key(['q', 'm'], () => exitToStock());
    screen.key(['C-c'], () => process.exit(0));
    screen.key(['r'], () => {
      refreshDashboard();
    });
    // 원본 m(마스킹) → 충돌 피해 s 로 이동 (m 은 모드 복귀)
    screen.key(['s'], () => {
      state.isSensitiveMasked = !state.isSensitiveMasked;
      renderAll();
    });
    screen.key(['up'], () => {
      state.selectedIndex = (state.selectedIndex - 1 + COINS.length) % COINS.length;
      refreshDashboard(false);
    });
    screen.key(['down'], () => {
      state.selectedIndex = (state.selectedIndex + 1) % COINS.length;
      refreshDashboard(false);
    });
    screen.key(['left'], () => {
      state.selectedTimeframeIndex = (state.selectedTimeframeIndex - 1 + TIMEFRAMES.length) % TIMEFRAMES.length;
      refreshDashboard(false);
    });
    screen.key(['right'], () => {
      state.selectedTimeframeIndex = (state.selectedTimeframeIndex + 1) % TIMEFRAMES.length;
      refreshDashboard(false);
    });
    COINS.forEach((_, index) => {
      screen.key([String(index + 1)], () => {
        state.selectedIndex = index;
        refreshDashboard(false);
      });
    });
  }

  function startAutoRefresh() {
    autoRefreshTimer = setInterval(() => {
      refreshDashboard(false);
    }, BACKGROUND_REFRESH_MS);
  }

  // bootstrap
  bindKeys();
  renderAll();
  refreshDashboard();
  connectLiveTicker();
  startAutoRefresh();

  return { destroy: cleanup };
}
