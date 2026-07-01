import { useEffect, useState } from 'react';
import type { CoinQuote, UpbitTick, CoinMeta, CoinNewsItem } from './types';
import type { usePriceAlerts } from './alerts';
import { api } from './api';

// 코인 실시간 데이터 훅 — App 레벨에서 1회 호출해 CryptoView·TerminalView 가 공유한다.
// coins 가 있을 때만 업비트 SSE 를 연결(조건부)해 불필요한 상시 연결/부하를 피한다.
// 반환: 대시보드 시세(quotes) + 실시간 체결(live) + 뉴스 + 알림 모달용 현재가 맵(coinPrices).

export interface CryptoLive {
  quotes: CoinQuote[];
  live: Record<string, UpbitTick>;
  news: CoinNewsItem[];
  coinPrices: Record<string, number | null>;
}

export function useCryptoLive(
  coins: CoinMeta[],
  alerts: ReturnType<typeof usePriceAlerts>,
): CryptoLive {
  const [quotes, setQuotes] = useState<CoinQuote[]>([]);
  const [live, setLive] = useState<Record<string, UpbitTick>>({});
  const [news, setNews] = useState<CoinNewsItem[]>([]);

  // 대시보드(REST) 폴링 — coins 바뀌면 재조회. 비면 비운다.
  useEffect(() => {
    if (coins.length === 0) {
      setQuotes([]);
      return;
    }
    let alive = true;
    const load = () => api.crypto(coins).then((r) => alive && setQuotes(r.coins)).catch(() => {});
    load();
    const t = setInterval(load, 120_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [coins]);

  // 업비트 실시간 SSE — coins 있을 때만 연결. 알림(onPrice)도 여기서 발동.
  useEffect(() => {
    if (coins.length === 0) return;
    const markets = coins.map((c) => c.upbitMarket).join(',');
    const es = new EventSource(`/api/stream/crypto?markets=${encodeURIComponent(markets)}`);
    es.addEventListener('tick', (e) => {
      const tick = JSON.parse((e as MessageEvent).data) as UpbitTick;
      setLive((prev) => ({ ...prev, [tick.market]: tick }));
      const sym = coins.find((c) => c.upbitMarket === tick.market)?.symbol ?? tick.market;
      alerts.onPrice(tick.market, tick.trade_price, sym);
    });
    return () => es.close();
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
    const load = () => api.cryptoNews().then((r) => alive && setNews(r.news)).catch(() => {});
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

  return { quotes, live, news, coinPrices };
}
