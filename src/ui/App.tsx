import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useStdout, measureElement, type DOMElement } from 'ink';
import type { Store, State } from '../core/store.js';
import type { Poller } from '../core/poller.js';
import { Watchlist } from './Watchlist.js';
import { QuotePanel } from './QuotePanel.js';
import { NewsStream } from './NewsStream.js';
import { SearchPanel } from './SearchPanel.js';
import { BriefPanel } from './BriefPanel.js';
import { HotPanel } from './HotPanel.js';
import { IndicesPanel } from './IndicesPanel.js';
import { MarketsPanel } from './MarketsPanel.js';
import { ExplainPanel } from './ExplainPanel.js';
import { HelpPanel } from './HelpPanel.js';
import { SearchBar } from './SearchBar.js';
import { CommandBar, type Command } from './CommandBar.js';
import { openUrl } from '../core/open-url.js';
import { searchSymbols } from '../sources/search.js';
import { useMouse, type MouseClick, type WheelEvent } from './use-mouse.js';
import { checkForUpdate } from '../core/update-check.js';
import { generateBrief, hasBriefKey } from '../sources/brief.js';
import { fetchHot } from '../sources/hot.js';
import { fetchDetail } from '../sources/detail.js';
import { fetchQuotes } from '../sources/quote.js';
import { explainTerm, hasAiKey } from '../sources/explain.js';
import { INDICES, MARKETS } from '../config.js';
interface Props {
  store: Store;
  poller: Poller;
  onEnterCrypto: () => void; // 코인 모드 진입 요청 (index 가 blessed 화면으로 교체)
}

export function App({ store, poller, onEnterCrypto }: Props) {
  const { stdout } = useStdout();
  const [state, setState] = useState<State>(store.get());
  const [selected, setSelected] = useState<string | null>(store.get().watchlist[0] ?? null);
  // 포커스된 패널 내부 커서 (행 인덱스)
  const [newsCursor, setNewsCursor] = useState(0);
  const [searchCursor, setSearchCursor] = useState(0);

  // store 변경 → setState. 단, 업비트 웹소켓 티커는 초당 수십 건 commit 하므로
  // 매번 즉시 setState 하면 전체 재렌더가 폭주해 (특히 ttyd 웹 송출에서) 깜빡인다.
  // 마지막 상태를 모아 ~120ms 마다 한 번만 반영(throttle)해 재렌더 빈도를 묶는다.
  useEffect(() => {
    let pending: State | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      if (pending) {
        setState(pending);
        pending = null;
      }
    };
    const onChange = (s: State) => {
      pending = { ...s };
      if (timer) return; // 이미 flush 예약됨 — 최신 상태만 갱신하고 대기
      timer = setTimeout(flush, 120);
    };
    store.on('change', onChange);
    return () => {
      store.off('change', onChange);
      if (timer) clearTimeout(timer);
    };
  }, [store]);

  // 선택 종목이 watchlist 에서 사라지면 첫 항목으로
  useEffect(() => {
    if (selected && !state.watchlist.includes(selected)) {
      setSelected(state.watchlist[0] ?? null);
    } else if (!selected && state.watchlist.length) {
      setSelected(state.watchlist[0]);
    }
  }, [state.watchlist, selected]);

  // 검색 결과 바뀌면 커서 리셋
  useEffect(() => {
    setSearchCursor(0);
  }, [state.searchResults]);

  // 선택 종목 바뀌면 상세 fetch (chart meta + Finnhub 보강). 캐시 없이 매번 단순 조회.
  useEffect(() => {
    if (!selected) {
      store.setDetail(null);
      return;
    }
    let cancelled = false;
    void fetchDetail(selected, process.env.FINNHUB_KEY).then((d) => {
      if (!cancelled) store.setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, store]);

  // 상시 패널 데이터: 시작 시 로드 + 핫종목/지수/환율은 60s 주기 갱신.
  useEffect(() => {
    void loadHot();
    void loadIndices();
    void loadMarkets();
    const t = setInterval(() => {
      void loadHot();
      void loadIndices();
      void loadMarkets();
    }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // 시작 시 새 버전 확인 (하루 1회 캐시, 실패는 무시)
  useEffect(() => {
    void checkForUpdate(Date.now()).then((info) => {
      if (info?.hasUpdate) store.setUpdate(info.latest);
    });
  }, [store]);

  // 화면 절대 행 측정 (1-based). 마우스 클릭 → 항목 매핑, 뉴스 표시 행수 계산에 쓴다.
  // - headerRef: 헤더 + 안내 영역 → WATCHLIST 첫 종목 행 위치
  // - topRef: 헤더~시세/검색 전체 → 뉴스 첫 행 위치
  const headerRef = useRef<DOMElement | null>(null);
  const topRef = useRef<DOMElement | null>(null);
  const [newsFirstRow, setNewsFirstRow] = useState(0);
  const [wlFirstRow, setWlFirstRow] = useState(4);
  useEffect(() => {
    // 값이 실제로 바뀔 때만 setState — 매 렌더 측정→setState 진동(깜빡임) 방지.
    if (topRef.current) {
      const v = measureElement(topRef.current).height + 3;
      setNewsFirstRow((prev) => (prev === v ? prev : v));
    }
    if (headerRef.current) {
      // header 다음 줄부터 WATCHLIST 박스. +border(1) +제목(1) +1(1-based) = +3
      const v = measureElement(headerRef.current).height + 3;
      setWlFirstRow((prev) => (prev === v ? prev : v));
    }
  });

  // 뉴스 행 수는 측정된 뉴스 시작 위치(newsFirstRow) 이후 남는 높이로 정한다.
  // 전체 출력이 터미널 높이를 넘으면 ink 가 매 렌더마다 화면을 통째로 다시 그려 깜빡이므로,
  // 보이는 뉴스 개수를 남는 줄 수로 제한해 출력이 화면 안에 들어오게 한다.
  // newsFirstRow(뉴스 첫 항목 절대행) 다음에 뉴스 N행 + 하단 border(1) + commandbar(1)
  // 이 들어가야 하므로, 출력이 터미널을 넘지 않도록 여유 4줄을 빼서 깜빡임을 막는다.
  const rows = stdout?.rows ?? 30;
  // 여유 6줄: 전체 출력이 터미널 높이를 절대 넘지 않게 한다. 1줄이라도 넘치면 ink 가
  // 맨 윗줄을 스크롤로 밀어올려 이전 프레임 한 줄이 상단에 잔상으로 남는다.
  const newsRows = Math.max(3, (newsFirstRow > 0 ? rows - newsFirstRow : rows - 20) - 6);
  // 필터 적용된 전체 목록. newsCursor 는 이 전체 인덱스를 가리킨다.
  const filteredNews = state.newsFilter
    ? state.news.filter((n) => n.tickers.includes(state.newsFilter!))
    : state.news;
  // 폴링으로 목록이 줄어 커서가 범위를 벗어나면 마지막 항목으로 보정.
  useEffect(() => {
    if (newsCursor > 0 && newsCursor >= filteredNews.length) {
      setNewsCursor(Math.max(0, filteredNews.length - 1));
    }
  }, [filteredNews.length, newsCursor]);

  // 윈도우 스크롤: 커서가 보이도록 시작 오프셋을 잡고 newsRows 개만 잘라 보여준다.
  const windowStart = Math.max(0, Math.min(newsCursor - Math.floor(newsRows / 2), filteredNews.length - newsRows));
  const visibleNews = filteredNews.slice(windowStart, windowStart + newsRows);

  // 회사명/심볼 검색 → 결과 패널 표시
  const runSearch = async (query: string) => {
    store.setStatus(`searching “${query}”…`);
    const results = await searchSymbols(query);
    store.setSearchResults(query, results);
    store.setStatus(results.length ? `${results.length} hits · ↑↓ 선택 · Enter 추가` : `no result: ${query}`);
  };

  // AI 시장 브리핑 (Claude). 키 없으면 안내만. brief 는 일시 오버레이.
  const runBrief = async () => {
    if (!hasBriefKey()) {
      store.setStatus('ANTHROPIC_API_KEY 없음 — :brief 사용하려면 키 설정');
      return;
    }
    const s = store.get();
    store.setOverlay({ kind: 'brief', text: null, loading: true });
    store.setStatus('AI 브리핑 생성 중…');
    const text = await generateBrief({ news: s.news });
    store.updateOverlay({ kind: 'brief', text, loading: false });
    store.setStatus(text ? 'AI 브리핑 완료' : 'AI 브리핑 실패');
  };

  // 핫 종목 — 상시 패널. 거래량 급등 조회 후 store 갱신.
  const loadHot = async () => {
    const items = await fetchHot();
    store.setHot(items);
  };

  // 지수 현황 — 상시 패널. 주요 지수 시세 조회.
  const loadIndices = async () => {
    const quotes = await fetchQuotes(
      INDICES.map((i) => i.symbol),
      process.env.FINNHUB_KEY,
    );
    store.setIndices(quotes);
  };

  // 환율·원자재·암호화폐 — Yahoo chart API (Finnhub 무료론 안 되므로 키 미전달).
  const loadMarkets = async () => {
    const quotes = await fetchQuotes(MARKETS.map((m) => m.symbol));
    store.setMarkets(quotes);
  };

  // 용어 풀이 — Claude 설명 (일시 오버레이).
  const runExplain = async (term: string) => {
    if (!hasAiKey()) {
      store.setStatus('ANTHROPIC_API_KEY 없음 — :explain 사용하려면 키 설정');
      return;
    }
    store.setOverlay({ kind: 'explain', term, text: null, loading: true });
    store.setStatus(`"${term}" 설명 생성 중…`);
    const text = await explainTerm(term);
    store.updateOverlay({ kind: 'explain', term, text, loading: false });
    store.setStatus(text ? '용어 풀이 완료' : '용어 풀이 실패');
  };

  const addSymbol = (sym: string, name?: string) => {
    if (store.addSymbol(sym, name)) {
      setSelected(sym.toUpperCase().trim());
      store.setStatus(`added ${sym.toUpperCase()}`);
      void poller.refreshQuotesNow();
    } else {
      store.setStatus(`이미 있음: ${sym.toUpperCase()}`);
    }
  };

  // 시세·뉴스를 지금 즉시 갱신 (r 키 / :refresh)
  const refreshNow = () => {
    store.setStatus('새로고침…');
    void Promise.all([poller.refreshQuotesNow(), poller.refreshNewsNow()]).then(() =>
      store.setStatus('새로고침 완료'),
    );
  };

  const handleCommand = (cmd: Command) => {
    switch (cmd.name) {
      case 'a':
      case 'add':
        if (cmd.arg) addSymbol(cmd.arg);
        else store.setStatus('add failed');
        break;
      case 's':
      case 'search':
      case 'find':
        if (cmd.arg) void runSearch(cmd.arg);
        else store.setStatus('검색어 입력: :s apple');
        break;
      case 'rm':
      case 'remove':
        if (cmd.arg && store.removeSymbol(cmd.arg)) store.setStatus(`removed ${cmd.arg.toUpperCase()}`);
        else store.setStatus('rm failed');
        break;
      case 'n':
      case 'news':
        store.setNewsFilter(cmd.arg ?? null);
        setNewsCursor(0);
        store.setStatus(cmd.arg ? `news: ${cmd.arg.toUpperCase()}` : 'news: all');
        break;
      case 'sc':
      case 'lang': // 구 명령 별칭 — 뉴스 범위 토글로 흡수
      case 'news-scope':
      case 'scope': {
        const SCOPES = ['domestic', 'foreign', 'all'] as const;
        const arg = cmd.arg?.toLowerCase();
        const explicit = SCOPES.find((s) => s === arg);
        // 인자 있으면 그 값, 없으면 domestic→foreign→all 순환
        const next =
          explicit ?? SCOPES[(SCOPES.indexOf(state.newsScope) + 1) % SCOPES.length];
        const label = next === 'domestic' ? '국내' : next === 'foreign' ? '해외' : '전체';
        store.setNewsScope(next);
        store.setStatus(`뉴스 범위: ${label}`);
        void poller.refreshNewsNow();
        break;
      }
      case 'refresh':
      case 'r':
        refreshNow();
        break;
      case 'o':
      case 'open': {
        // 행 번호는 전체 기준(1-based) 이므로 filteredNews 에서 바로 집는다.
        const n = Number(cmd.arg);
        const item = Number.isInteger(n) ? filteredNews[n - 1] : undefined;
        if (item && openUrl(item.url)) store.setStatus(`opened #${n}`);
        else store.setStatus(`open failed (1~${filteredNews.length})`);
        break;
      }
      case 'b':
      case 'brief':
      case 'ai':
        void runBrief();
        break;
      case 'h':
      case 'hot':
        void loadHot();
        store.setStatus('핫 종목 새로고침');
        break;
      case 'i':
      case 'indices':
      case 'index':
        void loadIndices();
        store.setStatus('지수 새로고침');
        break;
      case 'e':
      case 'explain':
        if (cmd.arg) void runExplain(cmd.arg);
        else store.setStatus('형식: :e PER');
        break;
      case 'crypto':
      case 'coin':
      case 'coins':
      case 'hold':
        onEnterCrypto(); // 코인 모드(blessed 화면)로 전환
        break;
      case '?':
      case 'help':
        store.setOverlay({ kind: 'help' });
        break;
      default:
        store.setStatus(`unknown: ${cmd.name}`);
    }
  };

  // Tab: 종목입력 → 용어입력 → WATCHLIST → NEWS 순환.
  const cycleFocus = () => {
    const order: State['focus'][] = ['symbolInput', 'termInput', 'watchlist', 'news'];
    const i = order.indexOf(state.focus);
    store.setFocus(order[(i + 1) % order.length] ?? 'symbolInput');
  };

  // ↑↓: 포커스 패널 커서 이동
  const move = (dir: 1 | -1) => {
    if (state.focus === 'news') {
      if (!filteredNews.length) return;
      // 전체 목록 인덱스 기준 이동(끝에서 멈춤). 윈도우는 따라 스크롤됨.
      setNewsCursor((c) => Math.max(0, Math.min(c + dir, filteredNews.length - 1)));
    } else if (state.focus === 'search') {
      const len = state.searchResults.length;
      if (!len) return;
      setSearchCursor((c) => (c + dir + len) % len);
    } else {
      const wl = state.watchlist;
      if (!wl.length) return;
      const i = selected ? wl.indexOf(selected) : 0;
      setSelected(wl[(i + dir + wl.length) % wl.length]);
    }
  };

  // Enter: 포커스 패널 기본 동작
  const activate = () => {
    if (state.focus === 'news') {
      const item = filteredNews[newsCursor];
      if (item && openUrl(item.url)) store.setStatus(`opened: ${item.title.slice(0, 30)}…`);
    } else if (state.focus === 'search') {
      const r = state.searchResults[searchCursor];
      if (r) {
        addSymbol(r.symbol, r.name);
        store.clearSearch();
      }
    }
  };

  // Esc: 일시 오버레이(brief/explain) → 검색 순으로 닫기. 상시 패널은 안 닫음.
  const escape = () => {
    if (state.overlay) {
      store.clearOverlay();
      store.setStatus('닫음');
    } else if (state.searchResults.length) {
      store.clearSearch();
      store.setStatus('search 닫음');
    }
  };

  // WATCHLIST 박스 폭 (Watchlist.tsx width 와 일치). 첫 종목 행은 wlFirstRow(측정값).
  const WL_PANEL_WIDTH = 44;

  // 마우스 좌클릭 처리. 클릭 위치로 패널을 판정한다.
  // - WATCHLIST 영역(좌측 패널) 종목 행: WATCHLIST 포커스 + 그 종목 선택.
  // - NEWS 영역 뉴스 행: NEWS 포커스 + 그 행 선택. 같은 행 재클릭이면 기사 열기.
  const onMouseClick = (e: MouseClick) => {
    // 좌상단 모드 탭 박스(테두리 포함 3행) 클릭. 내용 행(row 2)의 [코인] 영역 → 코인 모드.
    // 박스 border(1) + paddingX(1) 이후: [주식](col 2~9) 공백 [코인](col 11~18).
    if (e.row <= 3) {
      if (e.col >= 10 && e.col <= 19) onEnterCrypto(); // [코인] 탭 클릭
      return; // 주식 탭/박스 다른 곳 클릭은 무시(이미 주식 모드)
    }

    // 검색바: WATCHLIST 박스 바로 위(테두리 포함 2~3행). 좌측 절반=종목, 우측=용어.
    // 검색바 입력 행은 wlFirstRow 직전 영역 (헤더 박스 안 맨 아래).
    if (e.row < wlFirstRow - 1 && e.row >= wlFirstRow - 4) {
      const cols = stdout?.columns ?? 100;
      if (e.col < cols / 2) {
        store.setFocus('symbolInput');
        store.setStatus('종목 검색칸 — 입력 후 Enter');
      } else {
        store.setFocus('termInput');
        store.setStatus('용어 검색칸 — 입력 후 Enter');
      }
      return;
    }

    // WATCHLIST (좌상단, 좁은 폭)
    if (e.col <= WL_PANEL_WIDTH) {
      const wi = e.row - wlFirstRow;
      if (wi >= 0 && wi < state.watchlist.length) {
        store.setFocus('watchlist');
        setSelected(state.watchlist[wi]);
        store.setStatus(`선택 ${state.watchlist[wi]}`);
        return;
      }
    }

    // NEWS 행 — 클릭 행은 윈도우 상대 위치, 전체 인덱스로 환산.
    const rel = e.row - newsFirstRow;
    if (rel < 0 || rel >= visibleNews.length) return;
    const item = visibleNews[rel];
    if (!item) return;
    const idx = windowStart + rel;

    const alreadyOnRow = state.focus === 'news' && newsCursor === idx;
    if (alreadyOnRow) {
      if (openUrl(item.url)) store.setStatus(`opened: ${item.title.slice(0, 30)}…`);
    } else {
      store.setFocus('news');
      setNewsCursor(idx);
      store.setStatus(`선택 #${idx + 1} · 다시 클릭하거나 Enter 로 열기`);
    }
  };
  // 마우스 휠: 커서가 있는 위치의 패널을 스크롤한다.
  // NEWS 영역(newsFirstRow 이상)이면 뉴스 커서를, 그 위면 WATCHLIST 종목을 이동.
  // 휠은 한 번에 이벤트가 여러 개 빠르게 와서 setState 가 연타되면 매번 전체
  // 재렌더되어 깜빡인다. delta 를 모아 한 프레임에 한 번만 반영(코얼레싱).
  const wheelAccum = useRef(0);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onWheel = (e: WheelEvent) => {
    const inNews = newsFirstRow > 0 && e.row >= newsFirstRow;
    if (inNews) {
      if (!filteredNews.length) return;
      if (state.focus !== 'news') store.setFocus('news');
      wheelAccum.current += e.dir;
      if (wheelTimer.current) return; // 이미 flush 예약됨 — delta 만 쌓고 대기
      wheelTimer.current = setTimeout(() => {
        const d = wheelAccum.current;
        wheelAccum.current = 0;
        wheelTimer.current = null;
        setNewsCursor((c) => Math.max(0, Math.min(c + d, filteredNews.length - 1)));
      }, 16);
    } else {
      const wl = state.watchlist;
      if (!wl.length) return;
      if (state.focus !== 'watchlist') store.setFocus('watchlist');
      const i = selected ? wl.indexOf(selected) : 0;
      setSelected(wl[Math.max(0, Math.min(i + e.dir, wl.length - 1))]);
    }
  };
  useMouse(onMouseClick, onWheel);

  const hint =
    state.focus === 'news'
      ? 'Tab 패널 · ↑↓ 뉴스 · Enter 열기 · :s 검색'
      : state.focus === 'search'
        ? '↑↓ 선택 · Enter 추가 · Esc 닫기'
        : 'Tab 패널 · ↑↓ 종목 · :s 검색 :sc 범위 · ? 단축키도움말 · :q 종료';

  // brief/explain 오버레이는 풀스크린 모달로 표시 (다른 패널을 가려 화면 넘침 방지, Esc 로 닫기).
  if (state.overlay) {
    return (
      <Box flexDirection="column" width="100%" minHeight={(stdout?.rows ?? 30) - 1}>
        <Box paddingX={1}>
          <Text bold backgroundColor="yellow" color="black">
            {' '}FIN-TERM{' '}
          </Text>
          <Text dimColor> — Esc 로 닫고 메인으로 돌아가기</Text>
        </Box>
        <Box flexGrow={1}>
          {state.overlay.kind === 'brief' ? (
            <BriefPanel text={state.overlay.text} loading={state.overlay.loading} />
          ) : state.overlay.kind === 'explain' ? (
            <ExplainPanel
              term={state.overlay.term}
              text={state.overlay.text}
              loading={state.overlay.loading}
            />
          ) : (
            <HelpPanel />
          )}
        </Box>
        <CommandBar
          status={state.status}
          hint="Esc 닫기"
          onCommand={handleCommand}
          onQuit={() => process.exit(0)}
          onMove={() => {}}
          onTab={() => {}}
          onEnter={() => {}}
          onEscape={escape}
          onMode={() => {}}
          onHorizontal={() => {}}
          onRefresh={() => {}}
          onHelp={() => {}}
          inputActive={false}
        />
      </Box>
    );
  }

  // 좌상단 모드 탭 (크게). [주식] 활성 · [코인] 클릭/m 으로 코인 모드(blessed) 진입.
  // 박스 테두리 1행 + 내용 1행 + 테두리 1행 = 3행. 마우스 매핑은 onMouseClick 참조.
  const ModeTabs = (
    <Box>
      <Box borderStyle="round" borderColor="yellow" paddingX={1}>
        <Text bold backgroundColor="cyan" color="black">
          {'  주식  '}
        </Text>
        <Text> </Text>
        <Text color="gray">{'  코인  '}</Text>
      </Box>
      <Box paddingX={1} flexDirection="column" justifyContent="center">
        <Text bold backgroundColor="yellow" color="black">
          {' FIN-TERM '}
        </Text>
        <Text dimColor>m 또는 [코인] 클릭 → 코인 모드</Text>
      </Box>
      {state.update && (
        <Box justifyContent="center" flexDirection="column">
          <Text color="green">⬆ {state.update.latest} · npm i -g fin-term@latest</Text>
        </Box>
      )}
    </Box>
  );

  const commandBar = (
    <CommandBar
      status={state.status}
      hint={hint}
      onCommand={handleCommand}
      onQuit={() => process.exit(0)}
      onMove={move}
      onTab={cycleFocus}
      onEnter={activate}
      onEscape={escape}
      onRefresh={refreshNow}
      onHelp={() => store.setOverlay({ kind: 'help' })}
      onMode={onEnterCrypto}
      onHorizontal={() => {}}
      inputActive={state.focus === 'symbolInput' || state.focus === 'termInput'}
    />
  );

  // 주식 모드 대시보드. (코인 모드는 index 에서 blessed 화면으로 교체)
  // 최상위 박스 높이를 터미널 높이로 고정. 출력이 높이를 넘으면 ink 가 스크롤로 맨
  // 윗줄을 밀어올려 잔상이 남으므로, 높이를 고정해 그 안에 들어오게 한다.
  // (overflow=hidden 은 OSC8 하이퍼링크 시퀀스까지 잘라 제목·테두리가 깨지므로 안 씀.
  //  대신 newsRows 여유로 콘텐츠가 높이를 넘지 않게 맞춘다.)
  return (
    <Box flexDirection="column" width="100%" height={rows - 1}>
      {/* 상단 영역: 높이를 측정해 뉴스 첫 행 위치 계산 (마우스 클릭 매핑용) */}
      <Box flexDirection="column" ref={topRef}>
        {/* 헤더 + 안내 — 높이를 측정해 WATCHLIST 첫 종목 행 위치 계산 (마우스 매핑용) */}
        <Box flexDirection="column" ref={headerRef}>
          {ModeTabs}
          {/* 사용법 안내 — 조작과 기능을 상단에 노출 */}
          <Box paddingX={1} flexDirection="column">
            <Text dimColor>
              <Text color="yellow">:s</Text> 종목검색 ·{' '}
              <Text color="yellow">:a</Text>/<Text color="yellow">:rm</Text> 관심종목 ·{' '}
              <Text color="yellow">:n</Text> 종목뉴스필터 ·{' '}
              <Text color="yellow">:sc</Text> 국내/해외/전체 ·{' '}
              <Text color="magenta">:b</Text> AI브리핑 ·{' '}
              <Text color="green">:e</Text> 용어풀이 ·{' '}
              <Text color="gray">?</Text> 도움말
            </Text>
          </Box>
          {/* 상단 상시 검색바 — 종목 / 용어. 클릭·Tab 으로 포커스 후 입력 */}
          <SearchBar
            symbolFocused={state.focus === 'symbolInput'}
            termFocused={state.focus === 'termInput'}
            onSymbolSubmit={(q) => void runSearch(q)}
            onTermSubmit={(t) => void runExplain(t)}
          />
        </Box>
        <Box>
          <Watchlist
            watchlist={state.watchlist}
            names={state.names}
            quotes={state.quotes}
            selected={selected}
            focused={state.focus === 'watchlist'}
          />
          <QuotePanel quote={selected ? state.quotes[selected] : undefined} detail={state.detail} />
        </Box>
        {/* 핫종목 · 지수 · 환율/원자재 — 가로 3분할 상시 표시 */}
        <Box>
          <Box width="34%">
            <HotPanel items={state.hot} />
          </Box>
          <Box width="30%">
            <IndicesPanel quotes={state.indices} />
          </Box>
          <Box flexGrow={1}>
            <MarketsPanel quotes={state.markets} />
          </Box>
        </Box>
        {state.searchResults.length > 0 && (
          <SearchPanel
            query={state.searchQuery}
            results={state.searchResults}
            cursor={searchCursor}
            focused={state.focus === 'search'}
          />
        )}
        {/* brief/explain 은 풀스크린 모달(상단 early-return)에서 렌더 — 여기선 인라인 안 함 */}
      </Box>
      <NewsStream
        visible={visibleNews}
        filter={state.newsFilter}
        scope={state.newsScope}
        focused={state.focus === 'news'}
        cursor={newsCursor - windowStart}
        total={filteredNews.length}
        cursorAbs={filteredNews.length ? newsCursor + 1 : 0}
        windowStart={windowStart}
        hasAbove={windowStart > 0}
        hasBelow={windowStart + newsRows < filteredNews.length}
      />
      {commandBar}
    </Box>
  );
}
