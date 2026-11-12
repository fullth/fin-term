import { useEffect, useMemo, useRef, useState } from 'react';
import type { Quote, NewsItem, NewsScope, Detail, HotItem, LabelEntry, CoinMeta } from './lib/types';
import { api } from './lib/api';
import { loadPersisted, savePersisted, loadBriefHistory, type BriefEntry } from './lib/storage';
import { bootChannelTalk, openChannelTalk } from './lib/channel-talk';
import { bootDonate } from './lib/donate';
import { BriefPanel } from './components/AiPanels';
import { AlertSettingsModal } from './components/AlertSettingsModal';
import { InstallButton } from './components/InstallButton';
import { usePriceAlerts, notify } from './lib/alerts';
import { fmtPrice } from './lib/format';
import { useCryptoLive } from './lib/use-crypto-live';
import { ExcelView } from './components/ExcelView';
import { TerminalView } from './components/TerminalView';
import { DiaryView } from './components/DiaryView';
import { ManualModal } from './components/ManualModal';
import { CombinedView } from './components/CombinedView';
import { INITIAL_CONNECTION, type ConnectionInfo } from './lib/connection';
import './styles/index.css';

type Mode = 'combined' | 'diary';

const NEWS_INTERVAL = 60_000;
const HOT_INTERVAL = 120_000;

export function App() {
  const persisted = useMemo(loadPersisted, []);
  const [mode, setMode] = useState<Mode>('combined');
  const [watchlist, setWatchlist] = useState<string[]>(persisted.watchlist);
  const [names, setNames] = useState<Record<string, string>>(persisted.names);
  const namesRef = useRef(names); // 알림 표시명용 — SSE 클로저에서 최신 종목명 참조
  namesRef.current = names;
  const [scope, setScope] = useState<NewsScope>(persisted.scope);
  const [selected, setSelected] = useState<string | null>(
    persisted.selectedSymbol && persisted.watchlist.includes(persisted.selectedSymbol)
      ? persisted.selectedSymbol
      : persisted.watchlist[0] ?? null,
  );
  const [coins, setCoins] = useState<CoinMeta[]>(persisted.coins);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(
    persisted.selectedCoin && persisted.coins.some((coin) => coin.symbol === persisted.selectedCoin)
      ? persisted.selectedCoin
      : persisted.coins[0]?.symbol ?? null,
  );
  const [newsFilter, setNewsFilter] = useState<string | null>(null);
  const [excel, setExcel] = useState(false); // 엑셀 위장 모드 — ` 키 / 버튼 토글
  const [office, setOffice] = useState(persisted.officeMode); // 업무 화면 — 차분한 색과 개인 위젯 숨김
  const [terminal, setTerminal] = useState(persisted.terminal); // 터미널 모드 — 명령 콘솔 룩
  const [manualOpen, setManualOpen] = useState(false); // 사용 안내 모달
  const [briefHistory, setBriefHistory] = useState<BriefEntry[]>(loadBriefHistory);
  const stockAlerts = usePriceAlerts('stock');
  const cryptoAlerts = usePriceAlerts('crypto');
  const [stockAlertOpen, setStockAlertOpen] = useState(false);
  const [cryptoAlertOpen, setCryptoAlertOpen] = useState(false);
  const alertsOn = stockAlerts.settings.enabled || cryptoAlerts.settings.enabled;
  // 오늘의 AI 브리핑 — 서버가 하루 한 번 만들어 공유하는 내용을 1분마다 다시 받아 온다.
  const [brief, setBrief] = useState<{ text: string | null; loading: boolean; err: string | null }>({ text: null, loading: true, err: null });
  useEffect(() => {
    let active = true;
    const refresh = () => api.brief().then(({ briefs }) => {
      if (!active) return;
      const shared = briefs.map((item) => ({ id: `brief:${item.day}`, at: new Date(item.generated_at).toISOString(), text: item.text }));
      setBrief({ text: shared[0]?.text ?? null, loading: false, err: null });
      setBriefHistory([...shared, ...loadBriefHistory().filter((entry) => !shared.some((item) => item.id === entry.id))]);
    }).catch(() => { if (active) setBrief((current) => ({ ...current, loading: false, err: '브리핑을 불러오지 못했습니다' })); });
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  // 코인 실시간 — App 레벨에서 1회 연결(coins 있을 때만). 화면들이 공유하고 알림도 여기서 발동한다.
  const cryptoLive = useCryptoLive(coins, cryptoAlerts);
  const coinPrices = cryptoLive.coinPrices; // upbitMarket → 현재가 (알림 모달 rows 용)

  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [indices, setIndices] = useState<Quote[]>([]);
  const [markets, setMarkets] = useState<Quote[]>([]);
  const [labels, setLabels] = useState<{ indices: LabelEntry[]; markets: LabelEntry[] }>({ indices: [], markets: [] });
  const [news, setNews] = useState<NewsItem[]>([]);
  const seenNewsRef = useRef<Set<string> | null>(null); // 속보 알림 중복 방지 (null=첫 로드 전)
  const newsScopeRef = useRef(scope);
  const [hot, setHot] = useState<HotItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [stockConnection, setStockConnection] = useState<ConnectionInfo>(INITIAL_CONNECTION);
  const lastStockEventRef = useRef<number | null>(null);

  // 영속화 — 목록, 뉴스 범위, 선택 자산, 터미널·업무 화면 상태
  useEffect(() => {
    savePersisted({
      watchlist,
      names,
      scope,
      coins,
      selectedSymbol: selected,
      selectedCoin,
      terminal,
      officeMode: office,
    });
  }, [watchlist, names, scope, coins, selected, selectedCoin, terminal, office]);

  // 채널톡 · 후원 위젯 — 앱 마운트 시 1회 boot
  useEffect(() => {
    bootChannelTalk();
    bootDonate();
  }, []);

  // 업무 화면 — 등락 강조를 낮추고 개인용 위젯을 감춘다. 선택값은 localStorage 로 복원된다.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-office', office);
  }, [office]);

  // 엑셀 위장과 업무 화면에서는 채널톡과 후원 버튼도 감춰 화면 목적을 일관되게 유지한다.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-stealth', office || excel);
  }, [office, excel]);

  // 엑셀 위장 모드 — 탭 제목까지 스프레드시트로 바꿔 작업표시줄/탭에서도 티 안 나게.
  // 진입 시 매뉴얼 모달은 닫는다(위장 화면 위에 떠 있으면 안 됨).
  useEffect(() => {
    document.title = excel ? 'market-report.xlsx - Excel' : 'fin-term';
    if (excel) setManualOpen(false);
  }, [excel]);

  // 쿼리스트링이 주소창에 남아 있으면 한 번 걷어낸다 (URL 동기화 폐지 — 위장 목적상 노출 금지).
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // 키보드 단축키 — / 검색, j/k 종목 이동, Esc 필터 해제, ` 엑셀 위장
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
        const search = document.querySelector<HTMLDetailsElement>('.stock-lane .lane-search');
        if (search) { search.open = true; search.querySelector<HTMLInputElement>('input')?.focus(); }
      } else if (e.key === 'Escape') {
        setNewsFilter(null);
      } else if ((e.key === 'j' || e.key === 'k') && mode === 'combined' && watchlist.length) {
        const idx = selected ? watchlist.indexOf(selected) : -1;
        const next = e.key === 'j' ? Math.min(idx + 1, watchlist.length - 1) : Math.max(idx - 1, 0);
        setSelected(watchlist[next] ?? watchlist[0]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, selected, watchlist]);

  const addCoin = (c: CoinMeta) => {
    setCoins((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, c]));
    setSelectedCoin(c.symbol);
  };
  const removeCoin = (id: string) => setCoins((cs) => cs.filter((c) => c.id !== id));

  // 라벨 + AI 키(서버 env 보유 여부) 1회 로드 + 방문 기록
  useEffect(() => {
    api.markets()
      .then((marketResult) => {
        setLabels(marketResult.labels);
        setStockConnection((current) => ({ ...current, issue: null }));
      })
      .catch(() => setStockConnection((current) => ({ ...current, issue: '시장 지표 갱신 실패' })));
    api.visit().catch(() => {});
  }, []);

  // SSE 시세 스트림 — watchlist 바뀌면 재연결
  useEffect(() => {
    if (!watchlist.length) {
      setStockConnection({ state: 'idle', lastUpdated: null, issue: null });
      return;
    }
    setStockConnection((current) => ({ ...current, state: 'connecting' }));
    const es = new EventSource(`/api/stream/quotes?symbols=${encodeURIComponent(watchlist.join(','))}`);
    es.addEventListener('open', () => setStockConnection((current) => ({ ...current, state: 'live' })));
    es.addEventListener('quotes', (e) => {
      const { quotes } = JSON.parse((e as MessageEvent).data) as { quotes: Quote[] };
      const receivedAt = Date.now();
      lastStockEventRef.current = receivedAt;
      setStockConnection((current) => ({ ...current, state: 'live', lastUpdated: receivedAt }));
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
      const receivedAt = Date.now();
      lastStockEventRef.current = receivedAt;
      setStockConnection((current) => ({ ...current, state: 'live', lastUpdated: receivedAt }));
      if (indices?.length) setIndices(indices);
      if (markets?.length) setMarkets(markets);
    });
    es.addEventListener('error', () => setStockConnection((current) => ({ ...current, state: 'reconnecting' })));
    const staleTimer = setInterval(() => {
      const lastEvent = lastStockEventRef.current;
      if (lastEvent && Date.now() - lastEvent > 90_000) {
        setStockConnection((current) => ({ ...current, state: 'stale' }));
      }
    }, 15_000);
    return () => {
      clearInterval(staleTimer);
      es.close();
    };
    // onPrice 는 usePriceAlerts 에서 useCallback 으로 안정적 — watchlist 만 재연결 트리거
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  // 제목에 속보/긴급/breaking 포함 = 속보. 새로 들어온 것만 소리 없이 알린다.
  // 첫 로드와 뉴스 범위를 바꾼 직후의 목록은 기존 기사로 보고 알리지 않는다.
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
        notify('📰 속보', n.title);
        stockAlerts.setToast(`📰 속보 · ${n.title}`);
        setTimeout(() => stockAlerts.setToast(null), 12000);
      }
    }
  };

  // 뉴스 폴링 + [속보] 알림
  useEffect(() => {
    if (newsScopeRef.current !== scope) {
      newsScopeRef.current = scope;
      seenNewsRef.current = null;
    }
    let alive = true;
    const load = () =>
      api
        .news(scope, watchlist)
        .then((r) => {
          if (!alive) return;
          setNews(r.news);
          setStockConnection((current) => ({ ...current, issue: null }));
          checkBreakingNews(r.news);
        })
        .catch(() => setStockConnection((current) => ({ ...current, issue: '뉴스 갱신 실패' })));
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

  useEffect(() => {
    if (selectedCoin && !coins.some((coin) => coin.symbol === selectedCoin)) {
      setSelectedCoin(coins[0]?.symbol ?? null);
    } else if (!selectedCoin && coins.length) {
      setSelectedCoin(coins[0].symbol);
    }
  }, [coins, selectedCoin]);

  const addSymbol = (sym: string, name: string) => {
    const up = sym.toUpperCase();
    setWatchlist((w) => (w.includes(up) ? w : [...w, up]));
    setNames((n) => ({ ...n, [up]: name }));
    setSelected(up);
  };
  const removeSymbol = (sym: string) => setWatchlist((w) => w.filter((s) => s !== sym));

  const navConnectionState = stockConnection.state === 'idle' && cryptoLive.connection.state === 'idle'
    ? 'idle'
    : stockConnection.state === 'live' && cryptoLive.connection.state === 'live'
      ? 'live'
      : stockConnection.state === 'stale' || cryptoLive.connection.state === 'stale'
        ? 'stale'
        : stockConnection.state === 'reconnecting' || cryptoLive.connection.state === 'reconnecting'
          ? 'reconnecting'
          : 'connecting';
  const navConnectionLabel = navConnectionState === 'live'
    ? '수신 중'
    : navConnectionState === 'idle'
      ? '대기'
    : navConnectionState === 'stale'
      ? '지연'
      : navConnectionState === 'reconnecting'
        ? '재연결'
        : '연결 중';

  return (
    <div className="app-shell">
      {!excel && (
      <div className="topbar">
        <div className="brand-wrap">
          <button className="brand" onClick={() => { setMode('combined'); setTerminal(false); }} title="대시보드로 이동">
            <img className="brand-logo" src="/favicon.svg" alt="" />
            <span className="brand-copy">
              <strong>fin-term</strong>
              <small>주식 + 코인</small>
            </span>
          </button>
          <button className="manual-btn" onClick={() => setManualOpen(true)} title="사용 안내">
            ?
          </button>
        </div>
        <nav className="modes" aria-label="주요 화면">
          {/* 시장 모드 */}
          <div className="nav-button-group market-tools" aria-label="시장 화면">
          {(mode === 'diary' || terminal) && (
            <button className="mode-btn" onClick={() => { setMode('combined'); setTerminal(false); }}>
              대시보드
            </button>
          )}
          <button
            className={`mode-btn${!terminal && mode === 'diary' ? ' active' : ''}`}
            onClick={() => {
              setMode('diary');
              setTerminal(false);
            }}
            aria-current={!terminal && mode === 'diary' ? 'page' : undefined}
            title="브리핑 이력과 투자 일지"
          >
            투자일지
          </button>
          </div>
          <details className="nav-menu tools-menu"><summary className="mode-btn">도구 / 설정</summary><div className="nav-menu-pop tools-menu-pop">
          <div className="nav-button-group display-tools" aria-label="보기 도구">
            <button
              className={`mode-btn tool-btn${terminal ? ' active' : ''}`}
              onClick={() => setTerminal((value) => !value)}
              title="명령형 Terminal 화면"
              aria-label="Terminal"
              aria-pressed={terminal}
            >
              <span className="tool-glyph">›_</span> Terminal
            </button>
            <button className="mode-btn tool-btn" onClick={() => setExcel(true)} title="Excel 위장 화면 (` 키)" aria-label="Excel">
              <span className="tool-glyph">▦</span> Excel
            </button>
            <button
              className={`mode-btn tool-btn${office ? ' active' : ''}`}
              onClick={() => setOffice((value) => !value)}
              title="등락 색상을 낮추고 개인 위젯 숨김"
              aria-label="업무 화면"
              aria-pressed={office}
            >
              <span className="tool-glyph">◐</span> 업무
            </button>
          </div>
          <details className="nav-menu">
            <summary className={`mode-btn alert-trigger${alertsOn ? ' on' : ''}`}>
              알림{alertsOn ? ' ●' : ''}
            </summary>
            <div className="nav-menu-pop nav-alert-menu">
              <button
                className={`nav-menu-item${stockAlerts.settings.enabled ? ' active' : ''}`}
                onClick={(event) => {
                  const details = event.currentTarget.closest('details');
                  if (details) details.open = false;
                  setStockAlertOpen(true);
                }}
              >
                주식 알림 <span>{stockAlerts.settings.enabled ? 'ON' : 'OFF'}</span>
              </button>
              <button
                className={`nav-menu-item${cryptoAlerts.settings.enabled ? ' active' : ''}`}
                onClick={(event) => {
                  const details = event.currentTarget.closest('details');
                  if (details) details.open = false;
                  setCryptoAlertOpen(true);
                }}
              >
                코인 알림 <span>{cryptoAlerts.settings.enabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </details>
          <InstallButton />
          </div></details>
          <span className={`nav-live state-${navConnectionState}`} title={`연결 상태: ${navConnectionLabel}`} aria-label={`연결 상태: ${navConnectionLabel}`}>● {navConnectionState !== 'live' && navConnectionLabel}</span>
        </nav>
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
          coins={coins}
          coinQuotes={cryptoLive.quotes}
          coinLive={cryptoLive.live}
          coinNews={cryptoLive.news}
          stockConnection={stockConnection}
          coinConnection={cryptoLive.connection}
          onAddSymbol={addSymbol}
          onAddCoin={addCoin}
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
          briefState={brief}
          briefHistory={briefHistory}
          coins={coins}
          coinQuotes={cryptoLive.quotes}
          coinLive={cryptoLive.live}
          coinNews={cryptoLive.news}
          onAddSymbol={addSymbol}
          onRemoveSymbol={removeSymbol}
          onAddCoin={addCoin}
          onRemoveCoin={removeCoin}
        />
      ) : mode === 'combined' ? (
        <CombinedView
          briefSlot={<BriefPanel text={brief.text} loading={brief.loading} err={brief.err} generatedAt={briefHistory.find((entry) => entry.text === brief.text)?.at} />}
          watchlist={watchlist}
          names={names}
          quotes={quotes}
          selected={selected}
          detail={detail}
          indices={indices}
          markets={markets}
          labels={labels}
          news={news}
          scope={scope}
          newsFilter={newsFilter}
          coins={coins}
          coinQuotes={cryptoLive.quotes}
          coinLive={cryptoLive.live}
          coinNews={cryptoLive.news}
          selectedCoin={selectedCoin}
          stockConnection={stockConnection}
          coinConnection={cryptoLive.connection}
          onAddSymbol={addSymbol}
          onRemoveSymbol={removeSymbol}
          onSelectSymbol={setSelected}
          onFilterNews={(symbol) => setNewsFilter((filter) => (filter === symbol ? null : symbol))}
          onClearNewsFilter={() => setNewsFilter(null)}
          onScopeChange={setScope}
          onAddCoin={addCoin}
          onRemoveCoin={removeCoin}
          onSelectCoin={setSelectedCoin}
        />
      ) : (
        <DiaryView
          history={briefHistory}
        />
      )}

      {!excel && !terminal && mode !== 'diary' && (
        <div className="cmdbar">
          <span>
            주식/코인 동시 모니터링 | / 종목 검색 | j/k 이동 | 우클릭 목록삭제
          </span>
          <span className="dim">데이터: Naver · Upbit · RSS · Yahoo(폴백) · 주식 시세는 약 1분 간격 · 투자 참고용</span>
        </div>
      )}
      {mode === 'combined' && stockAlerts.toast && (
        <div className="alert-toast" onClick={() => stockAlerts.setToast(null)}>
          🔔 {stockAlerts.toast}
        </div>
      )}
      {mode === 'combined' && cryptoAlerts.toast && (
        <div
          className={`alert-toast${mode === 'combined' && stockAlerts.toast ? ' alert-toast-secondary' : ''}`}
          onClick={() => cryptoAlerts.setToast(null)}
        >
          🔔 {cryptoAlerts.toast}
        </div>
      )}
      {stockAlertOpen && (
        <AlertSettingsModal
          settings={stockAlerts.settings}
          bases={stockAlerts.bases}
          overrides={stockAlerts.overrides}
          rows={watchlist.map((symbol) => ({ key: symbol, label: symbol, price: quotes[symbol]?.price ?? null }))}
          fmt={fmtPrice}
          onClose={() => setStockAlertOpen(false)}
          onToggle={stockAlerts.toggle}
          onApply={stockAlerts.applyBatch}
          history={stockAlerts.history}
          onClearHistory={stockAlerts.clearHistory}
        />
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
      <button className="contact-launcher" onClick={openChannelTalk} aria-label="문의하기">문의하기</button>
      {manualOpen && <ManualModal onClose={() => setManualOpen(false)} />}
    </div>
  );
}
