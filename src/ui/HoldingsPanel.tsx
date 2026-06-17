import React from 'react';
import { Box, Text } from 'ink';
import type { Holding, CryptoTickerMap, FeedStatus } from '../core/types.js';
import { portfolio } from '../core/holdings.js';
import { fmtKrw, fmtPct, arrow, changeColor } from './format.js';

interface Props {
  holdings: Holding[];
  tickers: CryptoTickerMap;
  selected: string | null;
  feedStatus: FeedStatus;
  focused: boolean;
}

const FEED_LABEL: Record<FeedStatus, string> = {
  polling: '폴링',
  connecting: '연결중',
  live: '실시간',
  reconnecting: '재연결',
  error: '오류',
};

export function HoldingsPanel({ holdings, tickers, selected, feedStatus, focused }: Props) {
  const summary = portfolio(holdings, tickers);

  return (
    <Box
      flexDirection="column"
      width={50}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text bold color="yellow">
          코인 보유 {focused && <Text dimColor>●</Text>}
        </Text>
        <Text color={feedStatus === 'live' ? 'green' : 'gray'}>{FEED_LABEL[feedStatus]}</Text>
      </Box>
      {holdings.length === 0 && <Text dimColor>~/.fin-term/holdings.json 없음</Text>}
      {summary.snapshots.map((s) => {
        const isSel = s.id === selected;
        return (
          <Box key={s.id}>
            <Box width={6} flexShrink={0}>
              <Text color={isSel ? 'cyan' : undefined} bold={isSel} wrap="truncate">
                {isSel ? '▶ ' : '  '}
                {s.symbol}
              </Text>
            </Box>
            <Box flexGrow={1} justifyContent="flex-end" marginRight={1}>
              <Text wrap="truncate">{fmtKrw(s.current_value_krw)}</Text>
            </Box>
            <Box width={11} flexShrink={0} justifyContent="flex-end">
              <Text color={changeColor(s.return_pct)} wrap="truncate">
                {arrow(s.return_pct)}
                {fmtPct(s.return_pct)}
              </Text>
            </Box>
          </Box>
        );
      })}
      {summary.snapshots.length > 0 && (
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>합계</Text>
          <Text>{fmtKrw(summary.current_value_krw)}</Text>
          <Text color={changeColor(summary.pnl_krw)}>
            {' '}
            {arrow(summary.return_pct)}
            {fmtPct(summary.return_pct)}
          </Text>
        </Box>
      )}
    </Box>
  );
}
