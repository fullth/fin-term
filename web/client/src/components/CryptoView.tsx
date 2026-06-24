import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CoinQuote, UpbitTick, CoinMeta, CoinNewsItem } from '../lib/types';
import { api } from '../lib/api';
import { fmtPct, arrow, changeClass, fmtTime } from '../lib/format';
import { Sparkline } from './Sparkline';
import { CoinSearchBar } from './CoinSearchBar';
import type { usePriceAlerts } from '../lib/alerts';

function fmtKrw(n: number | null): string {
  if (n == null) return '—';
  const digits = Math.abs(n) >= 100 ? 0 : 2;
  return `₩${n.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

// 급변동 피드 한 줄 — 직전 수신가 대비 순간 변동.
interface Surge {
  id: number;
  symbol: string;
  price: number;
  deltaPct: number; // 직전 수신가 대비 순간 변동률(부호 포함)
  at: number;
}
const SURGE_PCT = 0.15; // 이 절댓값(%) 이상 튄 순간만 피드에 기록
const MAX_SURGES = 30; // 피드 최대 줄 수(메모리·렌더 가드)

interface Props {
  coins: CoinMeta[];
  onAdd: (c: CoinMeta) => void;
  onRemove: (id: string) => void;
  alerts: ReturnType<typeof usePriceAlerts>; // 알림 훅은 App 에서 끌어올려 상단바 버튼과 공유
  onCoinPrices: (m: Record<string, number | null>) => void; // 알림 모달 rows 용 현재가 공유
  briefSlot?: ReactNode; // 데일리 브리핑 — App 이 소유(주식/코인 공용), 코인 화면 상단에 표시
}

export function CryptoView({ coins: coinList, onAdd, onRemove, alerts, onCoinPrices, briefSlot }: Props) {
  const [quotes, setQuotes] = useState<CoinQuote[]>([]);
  const [live, setLive] = useState<Record<string, UpbitTick>>({});
  const [news, setNews] = useState<CoinNewsItem[]>([]);
  const [selected, setSelected] = useState<string | null>(coinList[0]?.symbol ?? null);
  // 급변동 피드 — 직전 수신가 대비 SURGE_PCT 이상 튄 순간만 기록(최근 MAX_SURGES 개)
  const [surges, setSurges] = useState<Surge[]>([]);
  const lastPriceRef = useRef<Record<string, number>>({}); // market → 직전 수신 체결가
  const surgeSeqRef = useRef(0); // 피드 항목 고유 키(수신 순서)

  // CoinGecko 대시보드 폴링 — coinList 바뀌면 재조회
  useEffect(() => {
    if (coinList.length === 0) {
      setQuotes([]);
      return;
    }
    let alive = true;
    const load = () => api.crypto(coinList).then((r) => alive && setQuotes(r.coins)).catch(() => {});
    load();
    const t = setInterval(load, 120_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [coinList]);

  // 선택 코인이 목록에서 빠지면 첫 항목으로
  useEffect(() => {
    if (selected && !coinList.some((c) => c.symbol === selected)) setSelected(coinList[0]?.symbol ?? null);
    else if (!selected && coinList.length) setSelected(coinList[0].symbol);
  }, [coinList, selected]);

  // 업비트 실시간 SSE — coinList 마켓 구독
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const markets = coinList.map((c) => c.upbitMarket).join(',');
    const es = new EventSource(`/api/stream/crypto?markets=${encodeURIComponent(markets)}`);
    esRef.current = es;
    es.addEventListener('tick', (e) => {
      const tick = JSON.parse((e as MessageEvent).data) as UpbitTick;
      setLive((prev) => ({ ...prev, [tick.market]: tick }));
      const sym = coinList.find((c) => c.upbitMarket === tick.market)?.symbol ?? tick.market;
      alerts.onPrice(tick.market, tick.trade_price, sym);

      // 급변동 감지 — 직전 수신가 대비 순간 변동률이 임계값 이상이면 피드에 추가.
      const prevPrice = lastPriceRef.current[tick.market];
      lastPriceRef.current[tick.market] = tick.trade_price;
      if (prevPrice && prevPrice > 0) {
        const deltaPct = ((tick.trade_price - prevPrice) / prevPrice) * 100;
        if (Math.abs(deltaPct) >= SURGE_PCT) {
          surgeSeqRef.current += 1;
          const surge: Surge = { id: surgeSeqRef.current, symbol: sym, price: tick.trade_price, deltaPct, at: Date.now() };
          setSurges((prev) => [surge, ...prev].slice(0, MAX_SURGES));
        }
      }
    });
    return () => es.close();
    // alerts.onPrice 는 useCallback 으로 안정적 — coinList 만 재연결 트리거 (무한 재연결 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinList]);

  // 코인 뉴스 폴링
  useEffect(() => {
    let alive = true;
    const load = () => api.cryptoNews().then((r) => alive && setNews(r.news)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const sel = quotes.find((c) => c.symbol === selected) ?? null;
  const selMeta = coinList.find((c) => c.symbol === selected) ?? null;
  const priceOf = (c: CoinQuote) => live[c.upbitMarket]?.trade_price ?? c.price_krw;
  const liveRateOf = (c: CoinQuote) => {
    const t = live[c.upbitMarket];
    return t ? t.change_rate * 100 : null;
  };

  // 알림 모달(상단바)에서 쓸 현재가 맵을 App 으로 올린다. 실시간/대시보드 시세 갱신 시 동기화.
  useEffect(() => {
    const m: Record<string, number | null> = {};
    for (const c of coinList) {
      const q = quotes.find((x) => x.symbol === c.symbol);
      m[c.upbitMarket] = live[c.upbitMarket]?.trade_price ?? q?.price_krw ?? null;
    }
    onCoinPrices(m);
  }, [coinList, quotes, live, onCoinPrices]);

  return (
    <div className="crypto-main">
      <CoinSearchBar onAdd={onAdd} />
      <div className="grid">
        {/* 좌측 LNB: 데일리 브리핑 + 코인 시세 */}
        <div className="area-watch-col">
        {briefSlot}
        {/* 코인 리스트 */}
        <div className="panel area-watch focused">
          <div className="ptitle t-yellow">
            코인 시세 <span className="dot">●</span> <span className="sub">업비트 실시간</span>
          </div>
          {coinList.length === 0 && <div className="dim">검색으로 코인 추가</div>}
          {coinList.map((meta) => {
            const c = quotes.find((q) => q.symbol === meta.symbol);
            const isSel = meta.symbol === selected;
            const livePct = c ? liveRateOf(c) : null;
            const pct = livePct ?? c?.change_24h ?? null;
            return (
              <div
                key={meta.id}
                className={`listrow${isSel ? ' sel' : ''}`}
                onClick={() => setSelected(meta.symbol)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onRemove(meta.id);
                }}
                title="클릭 선택 · 우클릭 삭제"
              >
                <div className="listrow-top">
                  <span className="caret">{isSel ? '▶' : ''}</span>
                  <span className="sym">{meta.symbol}</span>
                  <span className={`val ${changeClass(pct)}`}>
                    {fmtKrw(c ? priceOf(c) : null)} {arrow(pct)}{fmtPct(pct)}
                  </span>
                </div>
                {meta.name && <div className="listrow-sub">{meta.name}</div>}
              </div>
            );
          })}
        </div>
        </div>

        {/* 선택 코인 차트 */}
        <div className="panel area-quote">
          <div className="ptitle t-yellow">CHART</div>
          {!sel && <div className="dim">코인을 선택하세요</div>}
          {sel && (
            <>
              <div className="quote-head">
                <span className="qsym">{sel.symbol}</span>
                <span className="qname">{selMeta?.name ?? sel.name}</span>
                <span className={`qprice ${changeClass(liveRateOf(sel) ?? sel.change_24h)}`}>
                  {fmtKrw(priceOf(sel))}
                </span>
              </div>
              <div className="fields">
                <span className="field"><span className="l">1시간</span><span className={changeClass(sel.change_1h)}>{fmtPct(sel.change_1h)}</span></span>
                <span className="field"><span className="l">24시간</span><span className={changeClass(sel.change_24h)}>{fmtPct(sel.change_24h)}</span></span>
                <span className="field"><span className="l">7일</span><span className={changeClass(sel.change_7d)}>{fmtPct(sel.change_7d)}</span></span>
              </div>
              <Sparkline values={sel.spark} positive={(sel.change_7d ?? 0) >= 0} />
              <div className="updated">7일 추이 · 업비트</div>
            </>
          )}
        </div>

        {/* 코인 뉴스 */}
        <div className="panel area-news">
          <div className="ptitle t-yellow">
            코인 뉴스 <span className="sub">[{news.length}]</span>
          </div>
          {news.length === 0 && <div className="dim">불러오는 중…</div>}
          {news.map((n, i) => (
            <div key={n.id} className="news-row" onClick={() => window.open(n.url, '_blank', 'noopener')}>
              <span className="num">{i + 1}</span>
              <span className="time">{fmtTime(n.published_at)}</span>
              <span className="tag mkt">[COIN]</span>
              <span className="title">{n.title}</span>
              <span className="src">({n.source})</span>
            </div>
          ))}
        </div>

        {/* 우측: USD 시세 + 24h 요약 */}
        <div className="area-side">
          <div className="panel">
            <div className="ptitle t-blue">24시간 시세 <span className="sub">KRW</span></div>
            {quotes.length === 0 && <div className="dim">불러오는 중…</div>}
            {quotes.map((c) => (
              <div key={c.id} className="row" style={{ cursor: 'pointer' }} onClick={() => setSelected(c.symbol)}>
                <span className="sym">{c.symbol}</span>
                <span className={`val ${changeClass(c.change_24h)}`}>{fmtKrw(priceOf(c))} {arrow(c.change_24h)}{fmtPct(c.change_24h)}</span>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="ptitle t-magenta">기간별 변동</div>
            {quotes.map((c) => (
              <div key={c.id} className="row" style={{ cursor: 'pointer' }} onClick={() => setSelected(c.symbol)}>
                <span className="sym" style={{ minWidth: 46 }}>{c.symbol}</span>
                <span className={changeClass(c.change_1h)} style={{ flex: 1, textAlign: 'center' }}>{fmtPct(c.change_1h)}</span>
                <span className={changeClass(c.change_24h)} style={{ flex: 1, textAlign: 'center' }}>{fmtPct(c.change_24h)}</span>
                <span className={changeClass(c.change_7d)} style={{ flex: 1, textAlign: 'right' }}>{fmtPct(c.change_7d)}</span>
              </div>
            ))}
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>1h · 24h · 7d</div>
          </div>
          <div className="panel">
            <div className="ptitle t-magenta">
              실시간 피드 <span className="sub">급변동 ±{SURGE_PCT}%</span>
            </div>
            {surges.length === 0 ? (
              <div className="dim" style={{ fontSize: 12 }}>
                {Object.keys(live).length > 0 ? '급변동 대기 중…' : '연결 중…'}
              </div>
            ) : (
              surges.map((s) => (
                <div key={s.id} className="surge-row">
                  <span className="time">{fmtTime(s.at)}</span>
                  <span className="sym">{s.symbol}</span>
                  <span className="surge-price">{fmtKrw(s.price)}</span>
                  <span className={`val ${changeClass(s.deltaPct)}`}>
                    {arrow(s.deltaPct)}{fmtPct(s.deltaPct)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
