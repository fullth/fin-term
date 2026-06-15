import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import type { Store, State } from '../core/store.js';
import type { Poller } from '../core/poller.js';
import { Watchlist } from './Watchlist.js';
import { QuotePanel } from './QuotePanel.js';
import { NewsStream } from './NewsStream.js';
import { SearchPanel } from './SearchPanel.js';
import { CommandBar, type Command } from './CommandBar.js';
import { openUrl } from '../core/open-url.js';
import { searchSymbols } from '../sources/search.js';

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

  // 터미널 높이 기반 뉴스 행 수 + 화면에 실제 보이는 뉴스 목록.
  // (:open N 의 N 기준과 NewsStream 표시 순서를 동일 목록으로 일치)
  const rows = stdout?.rows ?? 30;
  const newsRows = Math.max(5, rows - 16);
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

  const addSymbol = (sym: string) => {
    if (store.addSymbol(sym)) {
      setSelected(sym.toUpperCase().trim());
      store.setStatus(`added ${sym.toUpperCase()}`);
      void poller.refreshQuotesNow();
    } else {
      store.setStatus(`이미 있음: ${sym.toUpperCase()}`);
    }
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
      case 'open': {
        const n = Number(cmd.arg);
        const item = Number.isInteger(n) ? visibleNews[n - 1] : undefined;
        if (item && openUrl(item.url)) store.setStatus(`opened #${n}`);
        else store.setStatus(`open failed (1~${visibleNews.length})`);
        break;
      }
      default:
        store.setStatus(`unknown: ${cmd.name}`);
    }
  };

  // Tab: 검색 패널 열려있으면 search 포함 순환, 아니면 watchlist↔news
  const cycleFocus = () => {
    const order: State['focus'][] = state.searchResults.length
      ? ['watchlist', 'news', 'search']
      : ['watchlist', 'news'];
    const idx = order.indexOf(state.focus);
    store.setFocus(order[(idx + 1) % order.length]);
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
        addSymbol(r.symbol);
        store.clearSearch();
      }
    }
  };

  // Esc: 검색 패널 닫기
  const escape = () => {
    if (state.searchResults.length) {
      store.clearSearch();
      store.setStatus('search 닫음');
    }
  };

  const hint =
    state.focus === 'news'
      ? 'Tab 패널 · ↑↓ 뉴스 · Enter 열기 · :search'
      : state.focus === 'search'
        ? '↑↓ 선택 · Enter 추가 · Esc 닫기'
        : 'Tab 패널 · ↑↓ 종목 · :search :add :news :lang :q';

  return (
    <Box flexDirection="column" width="100%">
      <Box paddingX={1}>
        <Text bold backgroundColor="yellow" color="black">
          {' '}FIN-TERM{' '}
        </Text>
        <Text dimColor> live quotes + news · free data</Text>
      </Box>
      <Box>
        <Watchlist
          watchlist={state.watchlist}
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
      />
    </Box>
  );
}
