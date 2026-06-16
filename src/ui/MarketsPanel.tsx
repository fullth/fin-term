import React from 'react';
import { Box, Text } from 'ink';
import type { Quote } from '../core/types.js';
import { MARKETS } from '../config.js';
import { fmtPriceCompact, fmtPct, arrow, changeColor } from './format.js';

interface Props {
  quotes: Quote[];
}

// 환율·원자재·암호화폐 시세 패널 (하단 상시). 지수 패널과 동일 레이아웃.
export function MarketsPanel({ quotes }: Props) {
  const labelOf = (sym: string) => MARKETS.find((m) => m.symbol === sym)?.label ?? sym;
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text bold color="magenta">
        환율 · 원자재
      </Text>
      {quotes.length === 0 && <Text dimColor>불러오는 중…</Text>}
      {quotes.map((q) => (
        <Box key={q.symbol}>
          <Box width={12} flexShrink={0}>
            <Text bold>{labelOf(q.symbol)}</Text>
          </Box>
          <Box flexGrow={1} justifyContent="flex-end">
            <Text color={changeColor(q.change_pct)}>
              {q.error ? 'ERR' : `${fmtPriceCompact(q.price)} ${arrow(q.change_pct)}${fmtPct(q.change_pct)}`}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
