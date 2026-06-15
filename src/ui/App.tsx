import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import type { Store, State } from '../core/store.js';
import type { Poller } from '../core/poller.js';
import { Watchlist } from './Watchlist.js';
import { QuotePanel } from './QuotePanel.js';
import { NewsStream } from './NewsStream.js';
import { CommandBar, type Command } from './CommandBar.js';

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

  // 터미널 높이 기반 뉴스 행 수 (대략)
  const rows = stdout?.rows ?? 30;
  const newsRows = Math.max(5, rows - 16);

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
      <NewsStream news={state.news} filter={state.newsFilter} maxRows={newsRows} />
      <CommandBar
        status={state.status}
        onCommand={handleCommand}
        onQuit={() => exit()}
        onSelectNext={selectNext}
      />
    </Box>
  );
}
