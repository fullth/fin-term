import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useStdout, measureElement, type DOMElement } from 'ink';
import type { Store, State } from '../core/store.js';
import type { Poller } from '../core/poller.js';
import { Watchlist } from './Watchlist.js';
import { QuotePanel } from './QuotePanel.js';
import { NewsStream } from './NewsStream.js';
import { SearchPanel } from './SearchPanel.js';
import { BriefPanel } from './BriefPanel.js';
import { CommandBar, type Command } from './CommandBar.js';
import { openUrl } from '../core/open-url.js';
import { searchSymbols } from '../sources/search.js';
import { useMouse, type MouseClick } from './use-mouse.js';
import { checkForUpdate } from '../core/update-check.js';
import { generateBrief, hasBriefKey } from '../sources/brief.js';

interface Props {
  store: Store;
  poller: Poller;
}

export function App({ store, poller }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [state, setState] = useState<State>(store.get());
  const [selected, setSelected] = useState<string | null>(store.get().watchlist[0] ?? null);
  // 포커스된 패널 내부 커서 (행 인덱스)
  const [newsCursor, setNewsCursor] = useState(0);
  const [searchCursor, setSearchCursor] = useState(0);

  useEffect(() => {
    const onChange = (s: State) => setState({ ...s });
    store.on('change', onChange);
    return () => {
      store.off('change', onChange);
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
    if (topRef.current) {
      setNewsFirstRow(measureElement(topRef.current).height + 3);
    }
    if (headerRef.current) {
      // header 다음 줄부터 WATCHLIST 박스. +border(1) +제목(1) +1(1-based) = +3
      setWlFirstRow(measureElement(headerRef.current).height + 3);
    }
  });

  // 뉴스 행 수는 측정된 뉴스 시작 위치(newsFirstRow) 이후 남는 높이로 정한다.
  // 전체 출력이 터미널 높이를 넘으면 ink 가 매 렌더마다 화면을 통째로 다시 그려 깜빡이므로,
  // 보이는 뉴스 개수를 남는 줄 수로 제한해 출력이 화면 안에 들어오게 한다.
  // (commandbar 1줄 + 뉴스박스 하단 border 1줄을 빼서 여유 확보)
  const rows = stdout?.rows ?? 30;
  const newsRows = Math.max(3, (newsFirstRow > 0 ? rows - newsFirstRow : rows - 18) - 2);
  const visibleNews = (
    state.newsFilter ? state.news.filter((n) => n.tickers.includes(state.newsFilter!)) : state.news
  ).slice(0, newsRows);

  // 회사명/심볼 검색 → 결과 패널 표시
  const runSearch = async (query: string) => {
    store.setStatus(`searching “${query}”…`);
    const results = await searchSymbols(query);
    store.setSearchResults(query, results);
    store.setStatus(results.length ? `${results.length} hits · ↑↓ 선택 · Enter 추가` : `no result: ${query}`);
  };

  // AI 시장 브리핑 생성 (Claude). 키 없으면 안내만.
  const runBrief = async () => {
    if (!hasBriefKey()) {
      store.setStatus('ANTHROPIC_API_KEY 없음 — :brief 사용하려면 키 설정');
      return;
    }
    const s = store.get();
    store.setBriefLoading();
    store.setStatus('AI 브리핑 생성 중…');
    const text = await generateBrief({
      watchlist: s.watchlist,
      names: s.names,
      quotes: s.quotes,
      news: s.news,
    });
    store.setBrief(text);
    store.setStatus(text ? 'AI 브리핑 완료' : 'AI 브리핑 실패');
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
      case 'add':
        if (cmd.arg) addSymbol(cmd.arg);
        else store.setStatus('add failed');
        break;
      case 'search':
      case 'find':
        if (cmd.arg) void runSearch(cmd.arg);
        else store.setStatus('검색어 입력: :search apple');
        break;
      case 'rm':
      case 'remove':
        if (cmd.arg && store.removeSymbol(cmd.arg)) store.setStatus(`removed ${cmd.arg.toUpperCase()}`);
        else store.setStatus('rm failed');
        break;
      case 'news':
        store.setNewsFilter(cmd.arg ?? null);
        setNewsCursor(0);
        store.setStatus(cmd.arg ? `news: ${cmd.arg.toUpperCase()}` : 'news: all');
        break;
      case 'lang': {
        const next = cmd.arg?.toLowerCase() === 'ko' ? 'ko' : cmd.arg?.toLowerCase() === 'en' ? 'en' : state.lang === 'ko' ? 'en' : 'ko';
        store.setLang(next);
        store.setStatus(`lang: ${next}${next === 'ko' ? ' (영문 헤드라인 번역)' : ''}`);
        void poller.refreshNewsNow();
        break;
      }
      case 'refresh':
      case 'r':
        refreshNow();
        break;
      case 'open': {
        const n = Number(cmd.arg);
        const item = Number.isInteger(n) ? visibleNews[n - 1] : undefined;
        if (item && openUrl(item.url)) store.setStatus(`opened #${n}`);
        else store.setStatus(`open failed (1~${visibleNews.length})`);
        break;
      }
      case 'brief':
      case 'ai':
        void runBrief();
        break;
      default:
        store.setStatus(`unknown: ${cmd.name}`);
    }
  };

  // Tab: WATCHLIST ↔ NEWS 만 순환. 검색 패널은 Tab 순환에서 빼서(검색 중이어도)
  // 언제든 두 패널을 자유롭게 오갈 수 있게 한다. (검색 패널은 Esc 로 닫음)
  const cycleFocus = () => {
    store.setFocus(state.focus === 'watchlist' ? 'news' : 'watchlist');
  };

  // ↑↓: 포커스 패널 커서 이동
  const move = (dir: 1 | -1) => {
    if (state.focus === 'news') {
      if (!visibleNews.length) return;
      setNewsCursor((c) => (c + dir + visibleNews.length) % visibleNews.length);
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
      const item = visibleNews[newsCursor];
      if (item && openUrl(item.url)) store.setStatus(`opened: ${item.title.slice(0, 30)}…`);
    } else if (state.focus === 'search') {
      const r = state.searchResults[searchCursor];
      if (r) {
        addSymbol(r.symbol, r.name);
        store.clearSearch();
      }
    }
  };

  // Esc: 열린 오버레이 닫기 (브리핑 우선, 그다음 검색)
  const escape = () => {
    if (state.brief) {
      store.clearBrief();
      store.setStatus('브리핑 닫음');
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
    // WATCHLIST 먼저 (좌상단, 좁은 폭)
    if (e.col <= WL_PANEL_WIDTH) {
      const wi = e.row - wlFirstRow;
      if (wi >= 0 && wi < state.watchlist.length) {
        store.setFocus('watchlist');
        setSelected(state.watchlist[wi]);
        store.setStatus(`선택 ${state.watchlist[wi]}`);
        return;
      }
    }

    // NEWS 행
    const idx = e.row - newsFirstRow;
    if (idx < 0 || idx >= visibleNews.length) return;
    const item = visibleNews[idx];
    if (!item) return;

    const alreadyOnRow = state.focus === 'news' && newsCursor === idx;
    if (alreadyOnRow) {
      if (openUrl(item.url)) store.setStatus(`opened: ${item.title.slice(0, 30)}…`);
    } else {
      store.setFocus('news');
      setNewsCursor(idx);
      store.setStatus(`선택 #${idx + 1} · 다시 클릭하거나 Enter 로 열기`);
    }
  };
  useMouse(onMouseClick);

  const hint =
    state.focus === 'news'
      ? 'Tab 패널 · ↑↓ 뉴스 · Enter 열기 · :search'
      : state.focus === 'search'
        ? '↑↓ 선택 · Enter 추가 · Esc 닫기'
        : 'Tab 패널 · ↑↓ 종목 · :search :add :news :lang :q';

  return (
    <Box flexDirection="column" width="100%">
      {/* 상단 영역: 높이를 측정해 뉴스 첫 행 위치 계산 (마우스 클릭 매핑용) */}
      <Box flexDirection="column" ref={topRef}>
        {/* 헤더 + 안내 — 높이를 측정해 WATCHLIST 첫 종목 행 위치 계산 (마우스 매핑용) */}
        <Box flexDirection="column" ref={headerRef}>
          <Box paddingX={1}>
            <Text bold backgroundColor="yellow" color="black">
              {' '}FIN-TERM{' '}
            </Text>
            <Text dimColor> live quotes + news · free data</Text>
            {state.update && (
              <Text color="green">
                {'  '}⬆ 업데이트 {state.update.latest} · npm i -g fin-term@latest
              </Text>
            )}
          </Box>
          {/* 사용법 안내 — 조작과 기능을 상단에 노출 */}
          <Box paddingX={1} flexDirection="column">
            <Text>
              <Text color="cyan">클릭</Text>
              <Text dimColor> 패널/항목 선택 (뉴스는 한 번 더 클릭하면 열림) · </Text>
              <Text color="cyan">Tab</Text>
              <Text dimColor> 패널 전환 · </Text>
              <Text color="cyan">↑↓</Text>
              <Text dimColor> 이동 · </Text>
              <Text color="cyan">Enter</Text>
              <Text dimColor> 열기/추가 · </Text>
              <Text color="cyan">r</Text>
              <Text dimColor> 새로고침 · </Text>
              <Text color="cyan">q</Text>
              <Text dimColor> 종료</Text>
            </Text>
            <Text dimColor>
              <Text color="yellow">:search</Text> 종목검색 ·{' '}
              <Text color="yellow">:add</Text>/<Text color="yellow">:rm</Text> 관심종목 ·{' '}
              <Text color="yellow">:news</Text> 종목뉴스필터 ·{' '}
              <Text color="yellow">:lang</Text> 한/영 ·{' '}
              <Text color="yellow">:refresh</Text> 새로고침 ·{' '}
              <Text color="magenta">:brief</Text> AI브리핑
            </Text>
          </Box>
        </Box>
        <Box>
          <Watchlist
            watchlist={state.watchlist}
            names={state.names}
            quotes={state.quotes}
            selected={selected}
            focused={state.focus === 'watchlist'}
          />
          <QuotePanel quote={selected ? state.quotes[selected] : undefined} />
        </Box>
        {state.searchResults.length > 0 && (
          <SearchPanel
            query={state.searchQuery}
            results={state.searchResults}
            cursor={searchCursor}
            focused={state.focus === 'search'}
          />
        )}
        {state.brief && <BriefPanel text={state.brief.text} loading={state.brief.loading} />}
      </Box>
      <NewsStream
        visible={visibleNews}
        filter={state.newsFilter}
        lang={state.lang}
        focused={state.focus === 'news'}
        cursor={newsCursor}
      />
      <CommandBar
        status={state.status}
        hint={hint}
        onCommand={handleCommand}
        onQuit={() => exit()}
        onMove={move}
        onTab={cycleFocus}
        onEnter={activate}
        onEscape={escape}
        onRefresh={refreshNow}
      />
    </Box>
  );
}
