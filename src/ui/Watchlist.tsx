import React from 'react';
import { Box, Text } from 'ink';
import type { QuoteMap } from '../core/types.js';
import { fmtPriceCompact, fmtPct, arrow, changeColor } from './format.js';

interface Props {
  watchlist: string[];
  names: Record<string, string>; // symbol → 회사명
  quotes: QuoteMap;
  selected: string | null;
  focused: boolean;
}

export function Watchlist({ watchlist, names, quotes, selected, focused }: Props) {
  return (
    <Box
      flexDirection="column"
      width={44}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Text bold color="yellow">
        WATCHLIST {focused && <Text dimColor>●</Text>}
      </Text>
      {watchlist.length === 0 && <Text dimColor>empty — :add SYM</Text>}
      {watchlist.map((sym) => {
        const q = quotes[sym];
        const pct = q?.change_pct ?? null;
        const isSel = sym === selected;
        const name = names[sym];
        const right = q?.error
          ? 'ERR'
          : `${fmtPriceCompact(q?.price ?? null)} ${arrow(pct)}${fmtPct(pct)}`;
        return (
          // 좌: 심볼(고정) + 회사명(가변, 흐림) / 우: 가격·변동. 모두 truncate 로 행 분리 방지.
          <Box key={sym}>
            <Box width={13} flexShrink={0}>
              <Text color={isSel ? 'cyan' : undefined} bold={isSel} wrap="truncate">
                {isSel ? '▶ ' : '  '}
                {sym}
              </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1} marginRight={1}>
              <Text dimColor wrap="truncate">
                {name ?? ''}
              </Text>
            </Box>
            <Box flexShrink={0} justifyContent="flex-end">
              <Text color={changeColor(pct)} wrap="truncate">
                {right}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
