import { useEffect, useRef, useState } from 'react';
import type { CoinQuote, UpbitTick, CoinMeta, CoinNewsItem } from './types';
import type { usePriceAlerts } from './alerts';
import { api } from './api';
import { INITIAL_CONNECTION, type ConnectionInfo } from './connection';

// 코인 실시간 데이터 훅 — App 레벨에서 1회 호출해 CryptoView·TerminalView 가 공유한다.
// coins 가 있을 때만 업비트 SSE 를 연결(조건부)해 불필요한 상시 연결/부하를 피한다.
// 반환: 대시보드 시세(quotes) + 실시간 체결(live) + 뉴스 + 알림 모달용 현재가 맵(coinPrices).

export interface CryptoLive {
  quotes: CoinQuote[];
  live: Record<string, UpbitTick>;
  news: CoinNewsItem[];
  coinPrices: Record<string, number | null>;
  connection: ConnectionInfo;
}

export function useCryptoLive(
  coins: CoinMeta[],
  alerts: ReturnType<typeof usePriceAlerts>,
): CryptoLive {
  const [quotes, setQuotes] = useState<CoinQuote[]>([]);
  const [live, setLive] = useState<Record<string, UpbitTick>>({});
  const [news, setNews] = useState<CoinNewsItem[]>([]);
  const [connection, setConnection] = useState<ConnectionInfo>(INITIAL_CONNECTION);
  const lastTickRef = useRef<number | null>(null);

  // 대시보드(REST) 폴링 — coins 바뀌면 재조회. 비면 비운다.
  useEffect(() => {
    if (coins.length === 0) {
      setQuotes([]);
      return;
    }
    let alive = true;
    const load = () => api.crypto(coins)
      .then((result) => {
        if (!alive) return;
        setQuotes(result.coins);
        setConnection((current) => ({ ...current, issue: null }));
      })
      .catch(() => alive && setConnection((current) => ({ ...current, issue: '코인 시세 갱신 실패' })));
    load();
    const t = setInterval(load, 120_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [coins]);

  // 업비트 실시간 SSE — coins 있을 때만 연결. 알림(onPrice)도 여기서 발동.
  useEffect(() => {
    if (coins.length === 0) {
      setConnection({ state: 'idle', lastUpdated: null, issue: null });
      return;
    }
    setConnection((current) => ({ ...current, state: 'connecting' }));
    const markets = coins.map((c) => c.upbitMarket).join(',');
    const es = new EventSource(`/api/stream/crypto?markets=${encodeURIComponent(markets)}`);
    es.addEventListener('open', () => setConnection((current) => ({ ...current, state: 'live' })));
    es.addEventListener('tick', (e) => {
      const tick = JSON.parse((e as MessageEvent).data) as UpbitTick;
      const receivedAt = Date.now();
      lastTickRef.current = receivedAt;
      setConnection((current) => ({ ...current, state: 'live', lastUpdated: receivedAt }));
      setLive((prev) => ({ ...prev, [tick.market]: tick }));
      const sym = coins.find((c) => c.upbitMarket === tick.market)?.symbol ?? tick.market;
      alerts.onPrice(tick.market, tick.trade_price, sym);
    });
    es.addEventListener('error', () => setConnection((current) => ({ ...current, state: 'reconnecting' })));
    const staleTimer = setInterval(() => {
      const lastTick = lastTickRef.current;
      if (lastTick && Date.now() - lastTick > 90_000) {
        setConnection((current) => ({ ...current, state: 'stale' }));
      }
    }, 15_000);
    return () => {
      clearInterval(staleTimer);
      es.close();
    };
    // alerts.onPrice 는 useCallback 으로 안정적 — coins 만 재연결 트리거
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins]);

  // 코인 뉴스 폴링 — 코인을 쓸 때만(coins 있을 때) 받는다.
  useEffect(() => {
    if (coins.length === 0) {
      setNews([]);
      return;
    }
    let alive = true;
    const load = () => api.cryptoNews()
      .then((result) => {
        if (!alive) return;
        setNews(result.news);
        setConnection((current) => ({ ...current, issue: null }));
      })
      .catch(() => alive && setConnection((current) => ({ ...current, issue: '코인 뉴스 갱신 실패' })));
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [coins.length === 0]);

  // 알림 모달(상단바)용 현재가 맵 — 실시간/대시보드 시세 갱신 시 동기화.
  const [coinPrices, setCoinPrices] = useState<Record<string, number | null>>({});
  useEffect(() => {
    const m: Record<string, number | null> = {};
    for (const c of coins) {
      const q = quotes.find((x) => x.symbol === c.symbol);
      m[c.upbitMarket] = live[c.upbitMarket]?.trade_price ?? q?.price_krw ?? null;
    }
    setCoinPrices(m);
  }, [coins, quotes, live]);

  return { quotes, live, news, coinPrices, connection };
}
