import { useEffect, useMemo, useRef, useState } from 'react';
import type { Quote, NewsItem, NewsScope, Detail, HotItem, LabelEntry, CoinMeta } from './lib/types';
import { api } from './lib/api';
import { loadPersisted, savePersisted, loadStoredBrief, saveStoredBrief } from './lib/storage';
import { bootChannelTalk } from './lib/channel-talk';
import { Watchlist } from './components/Watchlist';
import { QuotePanel } from './components/QuotePanel';
import { NewsStream } from './components/NewsStream';
import { IndicesPanel, MarketsPanel, HotPanel } from './components/SidePanels';
import { BriefPanel, ExplainPanel } from './components/AiPanels';
import { AlertButton } from './components/AlertButton';
import { AlertSettingsModal } from './components/AlertSettingsModal';
import { AlertTriggerButton } from './components/AlertTriggerButton';
import { InstallButton } from './components/InstallButton';
import { usePriceAlerts, fireAlert } from './lib/alerts';
import { fmtPrice } from './lib/format';
import { AiKeyManager } from './components/AiKeyManager';
import { SearchBar } from './components/SearchBar';
import { CryptoView } from './components/CryptoView';
import { useCryptoLive } from './lib/use-crypto-live';
import { ExcelView } from './components/ExcelView';
import { TerminalView } from './components/TerminalView';
import { ManualModal } from './components/ManualModal';
import './styles/app.css';

type Mode = 'stock' | 'crypto';

const NEWS_INTERVAL = 60_000;
const HOT_INTERVAL = 120_000;

export function App() {
  const persisted = useMemo(loadPersisted, []);
  const [mode, setMode] = useState<Mode>('stock');
  const [watchlist, setWatchlist] = useState<string[]>(persisted.watchlist);
  const [names, setNames] = useState<Record<string, string>>(persisted.names);
  const namesRef = useRef(names); // 알림 표시명용 — SSE 클로저에서 최신 종목명 참조
  namesRef.current = names;
  const [scope, setScope] = useState<NewsScope>(persisted.scope);
  const [selected, setSelected] = useState<string | null>(persisted.watchlist[0] ?? null);
  const [coins, setCoins] = useState<CoinMeta[]>(persisted.coins);
  const [newsFilter, setNewsFilter] = useState<string | null>(null);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [, setAiKeyVersion] = useState(0); // 키 변경 시 AI 패널 리렌더 트리거
  const [theme, setTheme] = useState<'dark' | 'light'>(persisted.theme);
  const [excel, setExcel] = useState(false); // 엑셀 위장 모드 — ` 키 / 버튼 토글
  const [mono, setMono] = useState(false); // 단색 모드 — 등락 색 제거
  const [terminal, setTerminal] = useState(persisted.terminal); // 터미널 모드 — 명령 콘솔 룩
  const [manualOpen, setManualOpen] = useState(false); // 사용 안내 모달
  const stockAlerts = usePriceAlerts('stock');
  const cryptoAlerts = usePriceAlerts('crypto');
  const [cryptoAlertOpen, setCryptoAlertOpen] = useState(false);
  // 데일리 브리핑 — 주식/코인 공용, 모드 전환·새로고침에도 유지. 생성 버튼 누를 때만 갱신.
  // 마지막 생성 결과를 localStorage 에 보관해 새로고침 후에도 복원한다.
  const [brief, setBrief] = useState<{ text: string | null; loading: boolean; err: string | null }>(() => ({
    text: loadStoredBrief(),
    loading: false,
    err: null,
  }));
  // 코인 실시간 — App 레벨에서 1회 연결(coins 있을 때만). CryptoView·TerminalView 공유 + 알림 발동.
  const cryptoLive = useCryptoLive(coins, cryptoAlerts);
  const coinPrices = cryptoLive.coinPrices; // upbitMarket → 현재가 (알림 모달 rows 용)

  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [indices, setIndices] = useState<Quote[]>([]);
  const [markets, setMarkets] = useState<Quote[]>([]);
  const [labels, setLabels] = useState<{ indices: LabelEntry[]; markets: LabelEntry[] }>({ indices: [], markets: [] });
  const [news, setNews] = useState<NewsItem[]>([]);
  const seenNewsRef = useRef<Set<string> | null>(null); // 속보 알림 중복 방지 (null=첫 로드 전)
  const [hot, setHot] = useState<HotItem[]>([]);
  const [hotLoaded, setHotLoaded] = useState(false); // 최초 응답 도착 여부 — 로딩 vs 빈 결과(장 마감) 구분
  const [detail, setDetail] = useState<Detail | null>(null);

  // 영속화 — 주식 watchlist + 코인 목록 + 테마 + 터미널 모드
  useEffect(() => {
    savePersisted({ watchlist, names, scope, coins, theme, terminal });
  }, [watchlist, names, scope, coins, theme, terminal]);

  // 채널톡 — 앱 마운트 시 1회 익명 boot
  useEffect(() => {
    bootChannelTalk();
  }, []);

  // 테마를 <html data-theme> 에 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 단색 모드 — 등락 색 제거. CSS 가 [data-mono] 아래에서 --up/--down 을 무채색으로 덮는다.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-mono', mono);
  }, [mono]);

  // 엑셀 위장 모드 — 탭 제목까지 스프레드시트로 바꿔 작업표시줄/탭에서도 티 안 나게.
  // 진입 시 매뉴얼 모달은 닫는다(위장 화면 위에 떠 있으면 안 됨).
  useEffect(() => {
    document.title = excel ? 'watchlist.xlsx - Excel' : 'fin-term · web';
    if (excel) setManualOpen(false);
  }, [excel]);

  // 쿼리스트링이 주소창에 남아 있으면 한 번 걷어낸다 (URL 동기화 폐지 — 위장 목적상 노출 금지).
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // 키보드 단축키 — / 검색, j/k 종목 이동, Esc 필터 해제, m 모드 토글, ` 엑셀 위장
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // 입력 중엔 무시
      if (e.key === '`') {
        e.preventDefault();
        setExcel((x) => !x); // 엑셀 위장 모드 토글 (한 손 복귀)
        return;
      }
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

  // 라벨 + AI 키(서버 env 보유 여부) 1회 로드 + 방문 기록
  useEffect(() => {
    api.markets().then((m) => setLabels(m.labels)).catch(() => {});
    api.aiStatus().then((s) => setHasServerKey(s.serverKey)).catch(() => {});
    api.visit().catch(() => {});
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
      for (const q of quotes)
        if (q.price != null) {
          const nm = namesRef.current[q.symbol];
          // 알림에 종목명 노출 (코드만으로는 어떤 종목인지 알기 어려움)
          const displayName = nm ? `${nm} (${q.symbol})` : q.symbol;
          stockAlerts.onPrice(q.symbol, q.price, displayName);
        }
    });
    es.addEventListener('markets', (e) => {
      const { indices, markets } = JSON.parse((e as MessageEvent).data) as { indices: Quote[]; markets: Quote[] };
      if (indices?.length) setIndices(indices);
      if (markets?.length) setMarkets(markets);
    });
    return () => es.close();
    // onPrice 는 usePriceAlerts 에서 useCallback 으로 안정적 — watchlist 만 재연결 트리거
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  // 제목에 속보/긴급/breaking 포함 = 속보. 새로 들어온 것만 알림(첫 로드는 폭탄 방지로 스킵).
  const BREAKING_RE = /\[?\s*(속보|긴급)\s*\]?|breaking/i;
  const checkBreakingNews = (items: NewsItem[]) => {
    const first = seenNewsRef.current === null;
    if (seenNewsRef.current === null) seenNewsRef.current = new Set();
    const seen = seenNewsRef.current;
    for (const n of items) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      if (first) continue; // 최초 로드분은 알림 생략
      if (BREAKING_RE.test(n.title)) {
        fireAlert('📰 속보', n.title);
        stockAlerts.setToast(`📰 속보 · ${n.title}`);
        setTimeout(() => stockAlerts.setToast(null), 12000);
      }
    }
  };

  // 뉴스 폴링 + [속보] 알림
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .news(scope, watchlist)
        .then((r) => {
          if (!alive) return;
          setNews(r.news);
          checkBreakingNews(r.news);
        })
        .catch(() => {});
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
    const load = () =>
      api
        .hot()
        .then((r) => {
          if (!alive) return;
          setHot(r.items);
          setHotLoaded(true);
        })
        .catch(() => {});
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

  // 브리핑 생성 — 명시적 호출에만(생성/다시 버튼). 결과는 모드 전환과 무관하게 유지.
  const briefUsable = hasServerKey;
  const runBrief = async () => {
    if (!briefUsable) {
      onNeedKey();
      return;
    }
    setBrief((b) => ({ ...b, loading: true, err: null }));
    try {
      const r = await api.brief();
      if (r.status === 401) setBrief({ text: null, loading: false, err: '브리핑은 현재 사용할 수 없습니다' });
      else if (!r.text) setBrief({ text: null, loading: false, err: '생성 실패 — 잠시 후 다시 시도하세요' });
      else {
        setBrief({ text: r.text, loading: false, err: null });
        saveStoredBrief(r.text);
      }
    } catch {
      setBrief((b) => ({ ...b, loading: false, err: '생성 실패' }));
    }
  };

  return (
    <div className="app-shell">
      {!excel && (
      <div className="topbar">
        <div className="brand">
          fin-term <span className="ver">v0.9.12 · web</span>
          <button className="manual-btn" onClick={() => setManualOpen(true)} title="사용 안내">
            ?
          </button>
        </div>
        <div className="modes">
          {mode === 'stock' && (
            <AlertButton
              settings={stockAlerts.settings}
              bases={stockAlerts.bases}
              overrides={stockAlerts.overrides}
              rows={watchlist.map((sym) => ({ key: sym, label: sym, price: quotes[sym]?.price ?? null }))}
              fmt={fmtPrice}
              onToggle={stockAlerts.toggle}
              onApply={stockAlerts.applyBatch}
              history={stockAlerts.history}
              onClearHistory={stockAlerts.clearHistory}
            />
          )}
          {mode === 'crypto' && (
            <div className="alert-btn-wrap" style={{ position: 'relative' }}>
              <AlertTriggerButton enabled={cryptoAlerts.settings.enabled} onClick={() => setCryptoAlertOpen(true)} />
            </div>
          )}
          <InstallButton />
          <button
            className="mode-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title="테마 전환"
          >
            {theme === 'dark' ? '☾ 다크' : '☀ 라이트'}
          </button>
          <button
            className={`mode-btn${mono ? ' active' : ''}`}
            onClick={() => setMono((m) => !m)}
            title="단색 모드 — 등락 색 숨김"
          >
            ◐ 단색
          </button>
          <button
            className={`mode-btn${terminal ? ' active' : ''}`}
            onClick={() => setTerminal((t) => !t)}
            title="터미널 모드 — 명령 콘솔"
          >
            ▶ 터미널
          </button>
          <button
            className={`mode-btn${excel ? ' active' : ''}`}
            onClick={() => setExcel((x) => !x)}
            title="엑셀 모드 — ` 키로도 전환"
          >
            ▦ 엑셀
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
      )}

      {excel ? (
        <ExcelView
          watchlist={watchlist}
          names={names}
          quotes={quotes}
          indices={indices}
          markets={markets}
          labels={labels}
          news={news}
          hot={hot}
          onExit={() => setExcel(false)}
        />
      ) : terminal ? (
        <TerminalView
          watchlist={watchlist}
          names={names}
          quotes={quotes}
          indices={indices}
          markets={markets}
          labels={labels}
          news={news}
          hot={hot}
          brief={brief.text}
          briefLoading={brief.loading}
          briefErr={brief.err}
          briefUsable={briefUsable}
          onRunBrief={runBrief}
          coins={coins}
          coinQuotes={cryptoLive.quotes}
          coinLive={cryptoLive.live}
          coinNews={cryptoLive.news}
          onAddSymbol={addSymbol}
          onRemoveSymbol={removeSymbol}
          onAddCoin={addCoin}
          onRemoveCoin={removeCoin}
        />
      ) : mode === 'stock' ? (
        <>
          <div className="topbars">
            <SearchBar onAdd={addSymbol} />
            <ExplainPanel onNeedKey={onNeedKey} compact />
          </div>
          {/* 3열: 좌(브리핑+WATCHLIST) · 중앙(지수·환율+QUOTE+NEWS) · 우(급상승) */}
          <div className="layout3">
            <div className="col-left">
              <BriefPanel text={brief.text} loading={brief.loading} err={brief.err} usable={briefUsable} onRun={runBrief} />
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
            </div>
            <div className="col-mid">
              <div className="mid-info">
                <IndicesPanel quotes={indices} labels={labels.indices} />
                <MarketsPanel quotes={markets} labels={labels.markets} />
              </div>
              <QuotePanel quote={selected ? quotes[selected] : undefined} detail={detail} />
              <NewsStream
                news={news}
                scope={scope}
                onScopeChange={setScope}
                filter={newsFilter}
                onClearFilter={() => setNewsFilter(null)}
              />
            </div>
            <div className="col-right">
              <HotPanel items={hot} loaded={hotLoaded} onSelect={(sym) => addSymbol(sym, '')} />
            </div>
          </div>
        </>
      ) : (
        <CryptoView
          coins={coins}
          onAdd={addCoin}
          onRemove={removeCoin}
          quotes={cryptoLive.quotes}
          live={cryptoLive.live}
          news={cryptoLive.news}
          briefSlot={<BriefPanel text={brief.text} loading={brief.loading} err={brief.err} usable={briefUsable} onRun={runBrief} />}
        />
      )}

      {!excel && !terminal && (
        <div className="cmdbar">
          <span>
            {mode === 'stock'
              ? '클릭 선택 · 우클릭 삭제 · / 검색 · j/k 이동 · m 모드전환 · Esc 필터해제'
              : '클릭 코인 선택 · 업비트 실시간 · m 모드전환'}
          </span>
          <span className="dim">데이터: Naver · Upbit · RSS · Yahoo(폴백) · 키 없이 동작</span>
        </div>
      )}
      {mode === 'stock' && stockAlerts.toast && (
        <div className="alert-toast" onClick={() => stockAlerts.setToast(null)}>
          🔔 {stockAlerts.toast}
        </div>
      )}
      {mode === 'crypto' && cryptoAlerts.toast && (
        <div className="alert-toast" onClick={() => cryptoAlerts.setToast(null)}>
          🔔 {cryptoAlerts.toast}
        </div>
      )}
      {cryptoAlertOpen && (
        <AlertSettingsModal
          settings={cryptoAlerts.settings}
          bases={cryptoAlerts.bases}
          overrides={cryptoAlerts.overrides}
          rows={coins.map((c) => ({ key: c.upbitMarket, label: c.symbol, price: coinPrices[c.upbitMarket] ?? null }))}
          fmt={(n: number | null) => (n == null ? '—' : `₩${n.toLocaleString('ko-KR')}`)}
          onClose={() => setCryptoAlertOpen(false)}
          onToggle={cryptoAlerts.toggle}
          onApply={cryptoAlerts.applyBatch}
          history={cryptoAlerts.history}
          onClearHistory={cryptoAlerts.clearHistory}
        />
      )}
      {manualOpen && <ManualModal onClose={() => setManualOpen(false)} />}
    </div>
  );
}
