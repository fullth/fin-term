import React from 'react';
import { Box, Text } from 'ink';
import type { QuoteMap } from '../core/types.js';
import { fmtPrice, fmtPct, arrow, changeColor } from './format.js';

interface Props {
  watchlist: string[];
  quotes: QuoteMap;
  selected: string | null;
}

export function Watchlist({ watchlist, quotes, selected }: Props) {
  return (
    <Box flexDirection="column" width={28} borderStyle="round" borderColor="gray" paddingX={1}>
      <Text bold color="yellow">
        WATCHLIST
      </Text>
      {watchlist.length === 0 && <Text dimColor>empty — :add SYM</Text>}
      {watchlist.map((sym) => {
        const q = quotes[sym];
        const pct = q?.change_pct ?? null;
        const isSel = sym === selected;
        return (
          <Box key={sym} justifyContent="space-between">
            <Text color={isSel ? 'cyan' : undefined} bold={isSel}>
              {isSel ? '▶ ' : '  '}
              {sym}
            </Text>
            <Text color={changeColor(pct)}>
              {q?.error ? 'ERR' : `${fmtPrice(q?.price ?? null)} ${arrow(pct)}${fmtPct(pct)}`}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
