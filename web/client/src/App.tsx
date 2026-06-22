import { useEffect, useMemo, useRef, useState } from 'react';
import type { Quote, NewsItem, NewsScope, Detail, HotItem, LabelEntry, CoinMeta } from './lib/types';
import { api } from './lib/api';
import { loadPersisted, savePersisted } from './lib/storage';
import { Watchlist } from './components/Watchlist';
import { QuotePanel } from './components/QuotePanel';
import { NewsStream } from './components/NewsStream';
import { IndicesPanel, MarketsPanel, HotPanel } from './components/SidePanels';
import { BriefPanel, ExplainPanel } from './components/AiPanels';
import { AlertPanel } from './components/AlertPanel';
import { usePriceAlerts } from './lib/alerts';
import { fmtPrice } from './lib/format';
import { AiKeyManager } from './components/AiKeyManager';
import { SearchBar } from './components/SearchBar';
import { CryptoView } from './components/CryptoView';
import './styles/app.css';

type Mode = 'stock' | 'crypto';

const NEWS_INTERVAL = 60_000;
const HOT_INTERVAL = 120_000;

export function App() {
  const persisted = useMemo(loadPersisted, []);
  const [mode, setMode] = useState<Mode>('stock');
  const [watchlist, setWatchlist] = useState<string[]>(persisted.watchlist);
  const [names, setNames] = useState<Record<string, string>>(persisted.names);
  const [scope, setScope] = useState<NewsScope>(persisted.scope);
  const [selected, setSelected] = useState<string | null>(persisted.watchlist[0] ?? null);
  const [coins, setCoins] = useState<CoinMeta[]>(persisted.coins);
  const [newsFilter, setNewsFilter] = useState<string | null>(null);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [, setAiKeyVersion] = useState(0); // 키 변경 시 AI 패널 리렌더 트리거
  const [theme, setTheme] = useState<'dark' | 'light'>(persisted.theme);
  const stockAlerts = usePriceAlerts('stock');

  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [indices, setIndices] = useState<Quote[]>([]);
  const [markets, setMarkets] = useState<Quote[]>([]);
  const [labels, setLabels] = useState<{ indices: LabelEntry[]; markets: LabelEntry[] }>({ indices: [], markets: [] });
  const [news, setNews] = useState<NewsItem[]>([]);
  const [hot, setHot] = useState<HotItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);

  // 영속화 — 주식 watchlist + 코인 목록 + 테마
  useEffect(() => {
    savePersisted({ watchlist, names, scope, coins, theme });
  }, [watchlist, names, scope, coins, theme]);

  // 테마를 <html data-theme> 에 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 초기 URL 쿼리(mode, sym) 읽기 — 공유 링크 복원
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get('mode');
    if (m === 'crypto' || m === 'stock') setMode(m);
    const sym = q.get('sym');
    if (sym) setSelected(sym.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 상태 → URL 동기화 (mode, 선택종목). 새로고침/공유 시 복원됨
  useEffect(() => {
    const q = new URLSearchParams();
    q.set('mode', mode);
    if (mode === 'stock' && selected) q.set('sym', selected);
    const url = `${window.location.pathname}?${q.toString()}`;
    window.history.replaceState(null, '', url);
  }, [mode, selected]);

  // 키보드 단축키 — / 검색, j/k 종목 이동, Esc 필터 해제, m 모드 토글
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // 입력 중엔 무시
      if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.searchbar input')?.focus();
      } else if (e.key === 'Escape') {
        setNewsFilter(null);
      } else if (e.key === 'm') {
        setMode((mo) => (mo === 'stock' ? 'crypto' : 'stock'));
      } else if ((e.key === 'j' || e.key === 'k') && mode === 'stock' && watchlist.length) {
        const idx = selected ? watchlist.indexOf(selected) : -1;
        const next = e.key === 'j' ? Math.min(idx + 1, watchlist.length - 1) : Math.max(idx - 1, 0);
        setSelected(watchlist[next] ?? watchlist[0]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, selected, watchlist]);

  const addCoin = (c: CoinMeta) => setCoins((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, c]));
  const removeCoin = (id: string) => setCoins((cs) => cs.filter((c) => c.id !== id));

  // 라벨 + AI 키(서버 env 보유 여부) 1회 로드
  useEffect(() => {
    api.markets().then((m) => setLabels(m.labels)).catch(() => {});
    api.aiStatus().then((s) => setHasServerKey(s.serverKey)).catch(() => {});
  }, []);

  const onAiKeyChange = () => setAiKeyVersion((v) => v + 1);
  const onNeedKey = () => setAiKeyVersion((v) => v + 1); // 키 매니저는 상단 상시 노출 — 알림용

  // SSE 시세 스트림 — watchlist 바뀌면 재연결
  useEffect(() => {
    if (!watchlist.length) return;
    const es = new EventSource(`/api/stream/quotes?symbols=${encodeURIComponent(watchlist.join(','))}`);
    es.addEventListener('quotes', (e) => {
      const { quotes } = JSON.parse((e as MessageEvent).data) as { quotes: Quote[] };
      setQuotes((prev) => {
        const next = { ...prev };
        for (const q of quotes) next[q.symbol] = q;
        return next;
      });
      for (const q of quotes) if (q.price != null) stockAlerts.onPrice(q.symbol, q.price, q.symbol);
    });
    es.addEventListener('markets', (e) => {
      const { indices, markets } = JSON.parse((e as MessageEvent).data) as { indices: Quote[]; markets: Quote[] };
      if (indices?.length) setIndices(indices);
      if (markets?.length) setMarkets(markets);
    });
    return () => es.close();
  }, [watchlist, stockAlerts]);

  // 뉴스 폴링
  useEffect(() => {
    let alive = true;
    const load = () => api.news(scope, watchlist).then((r) => alive && setNews(r.news)).catch(() => {});
    load();
    const t = setInterval(load, NEWS_INTERVAL);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [scope, watchlist]);

  // 핫 종목 폴링
  useEffect(() => {
    let alive = true;
    const load = () => api.hot().then((r) => alive && setHot(r.items)).catch(() => {});
    load();
    const t = setInterval(load, HOT_INTERVAL);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // 선택 종목 상세
  const detailReq = useRef(0);
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    const id = ++detailReq.current;
    api.detail(selected).then((r) => {
      if (id === detailReq.current) setDetail(r.detail);
    }).catch(() => {});
  }, [selected]);

  // 선택 종목이 목록에서 빠지면 첫 항목으로
  useEffect(() => {
    if (selected && !watchlist.includes(selected)) setSelected(watchlist[0] ?? null);
  }, [watchlist, selected]);

  const addSymbol = (sym: string, name: string) => {
    const up = sym.toUpperCase();
    setWatchlist((w) => (w.includes(up) ? w : [...w, up]));
    setNames((n) => ({ ...n, [up]: name }));
    setSelected(up);
  };
  const removeSymbol = (sym: string) => setWatchlist((w) => w.filter((s) => s !== sym));

  return (
    <>
      <div className="topbar">
        <div className="brand">
          fin-term <span className="ver">v0.9.1 · web</span>
        </div>
        <div className="modes">
          <button
            className="mode-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title="테마 전환"
          >
            {theme === 'dark' ? '☾' : '☀'}
          </button>
          <AiKeyManager onChange={onAiKeyChange} />
          <button className={`mode-btn${mode === 'stock' ? ' active' : ''}`} onClick={() => setMode('stock')}>
            주식
          </button>
          <button className={`mode-btn${mode === 'crypto' ? ' active' : ''}`} onClick={() => setMode('crypto')}>
            코인
          </button>
        </div>
      </div>

      {mode === 'stock' ? (
        <>
          <SearchBar onAdd={addSymbol} />
          <div className="grid">
            <Watchlist
              watchlist={watchlist}
              names={names}
              quotes={quotes}
              selected={selected}
              newsFilter={newsFilter}
              onSelect={setSelected}
              onRemove={removeSymbol}
              onFilterNews={(sym) => setNewsFilter((f) => (f === sym ? null : sym))}
            />
            <QuotePanel quote={selected ? quotes[selected] : undefined} detail={detail} />
            <NewsStream
              news={news}
              scope={scope}
              onScopeChange={setScope}
              filter={newsFilter}
              onClearFilter={() => setNewsFilter(null)}
            />
            <div className="area-side">
              <IndicesPanel quotes={indices} labels={labels.indices} />
              <MarketsPanel quotes={markets} labels={labels.markets} />
              <HotPanel items={hot} onSelect={(sym) => addSymbol(sym, '')} />
              <AlertPanel
                settings={stockAlerts.settings}
                bases={stockAlerts.bases}
                rows={watchlist.map((sym) => ({ key: sym, label: sym, price: quotes[sym]?.price ?? null }))}
                fmt={fmtPrice}
                onToggle={stockAlerts.toggle}
                onThreshold={stockAlerts.setThreshold}
                onSetBase={stockAlerts.setBase}
              />
              <BriefPanel
                watchlist={watchlist}
                names={names}
                quotes={quotes}
                news={news}
                hasServerKey={hasServerKey}
                onNeedKey={onNeedKey}
              />
              <ExplainPanel hasServerKey={hasServerKey} onNeedKey={onNeedKey} />
            </div>
          </div>
        </>
      ) : (
        <CryptoView coins={coins} onAdd={addCoin} onRemove={removeCoin} />
      )}

      <div className="cmdbar">
        <span>
          {mode === 'stock'
            ? '클릭 선택 · 우클릭 삭제 · / 검색 · j/k 이동 · m 모드전환 · Esc 필터해제'
            : '클릭 코인 선택 · 업비트 실시간 · m 모드전환'}
        </span>
        <span className="dim">데이터: Yahoo · Naver · RSS · Upbit · 키 없이 동작</span>
      </div>
      {mode === 'stock' && stockAlerts.toast && (
        <div className="alert-toast" onClick={() => stockAlerts.setToast(null)}>
          🔔 {stockAlerts.toast}
        </div>
      )}
    </>
  );
}
