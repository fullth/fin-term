import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import type { Store, State } from '../core/store.js';
import type { Poller } from '../core/poller.js';
import { Watchlist } from './Watchlist.js';
import { QuotePanel } from './QuotePanel.js';
import { NewsStream } from './NewsStream.js';
import { CommandBar, type Command } from './CommandBar.js';
import { openUrl } from '../core/open-url.js';

interface Props {
  store: Store;
  poller: Poller;
}

export function App({ store, poller }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [state, setState] = useState<State>(store.get());
  const [selected, setSelected] = useState<string | null>(store.get().watchlist[0] ?? null);

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

  // 터미널 높이 기반 뉴스 행 수 + 화면에 실제 보이는 뉴스 목록.
  // (:open N 의 N 기준과 NewsStream 표시 순서를 동일 목록으로 일치)
  const rows = stdout?.rows ?? 30;
  const newsRows = Math.max(5, rows - 16);
  const visibleNews = (
    state.newsFilter ? state.news.filter((n) => n.tickers.includes(state.newsFilter!)) : state.news
  ).slice(0, newsRows);

  const handleCommand = (cmd: Command) => {
    switch (cmd.name) {
      case 'add':
        if (cmd.arg && store.addSymbol(cmd.arg)) {
          setSelected(cmd.arg.toUpperCase().trim());
          store.setStatus(`added ${cmd.arg.toUpperCase()}`);
          void poller.refreshQuotesNow();
        } else {
          store.setStatus(`add failed`);
        }
        break;
      case 'rm':
      case 'remove':
        if (cmd.arg && store.removeSymbol(cmd.arg)) store.setStatus(`removed ${cmd.arg.toUpperCase()}`);
        else store.setStatus('rm failed');
        break;
      case 'news':
        store.setNewsFilter(cmd.arg ?? null);
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

  const selectNext = (dir: 1 | -1) => {
    const wl = state.watchlist;
    if (!wl.length) return;
    const idx = selected ? wl.indexOf(selected) : 0;
    const next = (idx + dir + wl.length) % wl.length;
    setSelected(wl[next]);
  };

  return (
    <Box flexDirection="column" width="100%">
      <Box paddingX={1}>
        <Text bold backgroundColor="yellow" color="black">
          {' '}FIN-TERM{' '}
        </Text>
        <Text dimColor> live quotes + news · free data</Text>
      </Box>
      <Box>
        <Watchlist watchlist={state.watchlist} quotes={state.quotes} selected={selected} />
        <QuotePanel quote={selected ? state.quotes[selected] : undefined} />
      </Box>
      <NewsStream visible={visibleNews} filter={state.newsFilter} lang={state.lang} />
      <CommandBar
        status={state.status}
        onCommand={handleCommand}
        onQuit={() => exit()}
        onSelectNext={selectNext}
      />
    </Box>
  );
}
