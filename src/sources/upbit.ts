// 업비트 데이터 소스. 캔들은 REST, 실시간 KRW 시세는 웹소켓. 키 불필요.
import WebSocket from 'ws';
import type { Candle, ChartTimeframe, CryptoTicker } from '../core/types.js';

const REST = 'https://api.upbit.com/v1';
const WS = 'wss://api.upbit.com/websocket/v1';
const UA = { 'User-Agent': 'Mozilla/5.0 (fin-term)' };

// 추적 코인 목록. 업비트 KRW 마켓 기준. holdings.json 의 id 와 매칭.
export interface CoinDef {
  id: string;
  symbol: string;
  name: string;
  market: string; // 업비트 마켓 코드
}

export const COINS: CoinDef[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', market: 'KRW-BTC' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', market: 'KRW-ETH' },
  { id: 'ripple', symbol: 'XRP', name: 'Ripple', market: 'KRW-XRP' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', market: 'KRW-BCH' },
];

export function coinByMarket(market: string): CoinDef | undefined {
  return COINS.find((c) => c.market === market);
}

export function coinById(id: string): CoinDef | undefined {
  return COINS.find((c) => c.id === id);
}

// 차트 기간 → 업비트 캔들 endpoint/count. label 은 UI 표시용.
interface TimeframeDef {
  key: ChartTimeframe;
  label: string;
  endpoint: string; // candles/ 뒤 경로
  count: number;
}

export const TIMEFRAMES: TimeframeDef[] = [
  { key: 'minute-1', label: '1분', endpoint: 'minutes/1', count: 30 },
  { key: 'minute-60', label: '1시간', endpoint: 'minutes/60', count: 24 },
  { key: 'day-1', label: '24시간', endpoint: 'minutes/60', count: 24 },
  { key: 'day-7', label: '7일', endpoint: 'days', count: 7 },
  { key: 'month-1', label: '1달', endpoint: 'days', count: 30 },
];

export function timeframe(key: ChartTimeframe): TimeframeDef {
  return TIMEFRAMES.find((t) => t.key === key) ?? TIMEFRAMES[3];
}

// 선택 코인·기간의 캔들 조회. 실패 시 빈 배열 (호출부에서 graceful).
export async function fetchCandles(market: string, tf: ChartTimeframe): Promise<Candle[]> {
  const def = timeframe(tf);
  try {
    const res = await fetch(`${REST}/candles/${def.endpoint}?market=${market}&count=${def.count}`, {
      headers: UA,
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as any[];
    return rows
      .map((r) => ({
        timestamp: new Date(r.candle_date_time_kst || r.candle_date_time_utc).getTime(),
        open: r.opening_price,
        high: r.high_price,
        low: r.low_price,
        close: r.trade_price,
      }))
      .reverse(); // 업비트는 최신순 → 오름차순으로
  } catch {
    return [];
  }
}

// 업비트 웹소켓 티커 페이로드(snake_case) → 내부 CryptoTicker 모델로 매핑.
function toTicker(coin: CoinDef, raw: any): CryptoTicker {
  return {
    id: coin.id,
    symbol: coin.symbol,
    market: coin.market,
    price_krw: raw.trade_price,
    change_pct_24h: (raw.signed_change_rate ?? 0) * 100,
    high_24h: raw.high_price,
    low_24h: raw.low_price,
    acc_trade_price_24h: raw.acc_trade_price_24h,
    updated_at: raw.trade_timestamp ?? Date.now(),
  };
}

export interface LiveTickerHandlers {
  onTicker: (ticker: CryptoTicker) => void;
  onStatus: (status: 'connecting' | 'live' | 'reconnecting' | 'error') => void;
}

// 업비트 실시간 티커 웹소켓 구독. 끊기면 자동 재연결. stop() 으로 종료.
export function connectLiveTickers(handlers: LiveTickerHandlers): { stop: () => void } {
  let ws: WebSocket | null = null;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (stopped) return;
    handlers.onStatus('connecting');
    ws = new WebSocket(WS);

    ws.on('open', () => {
      ws?.send(
        JSON.stringify([
          { ticket: 'fin-term-crypto' },
          { type: 'ticker', codes: COINS.map((c) => c.market), isOnlyRealtime: true },
        ]),
      );
    });

    ws.on('message', (payload: Buffer) => {
      try {
        const raw = JSON.parse(payload.toString('utf8'));
        const coin = coinByMarket(raw.code);
        if (!coin) return;
        handlers.onStatus('live');
        handlers.onTicker(toTicker(coin, raw));
      } catch {
        // 파싱 실패는 무시 (다음 메시지로 회복)
      }
    });

    ws.on('close', () => {
      if (stopped) return;
      handlers.onStatus('reconnecting');
      reconnectTimer = setTimeout(connect, 3000);
    });

    ws.on('error', () => {
      handlers.onStatus('error');
      // close 가 이어서 발생하며 재연결을 예약한다.
    });
  };

  connect();

  return {
    stop: () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
