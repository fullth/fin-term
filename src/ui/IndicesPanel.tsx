import React from 'react';
import { Box, Text } from 'ink';
import type { Quote } from '../core/types.js';
import { INDICES } from '../config.js';
import { fmtPriceCompact, fmtPct, arrow, changeColor } from './format.js';

interface Props {
  quotes: Quote[];
  loading: boolean;
}

export function IndicesPanel({ quotes, loading }: Props) {
  const labelOf = (sym: string) => INDICES.find((i) => i.symbol === sym)?.label ?? sym;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      <Text bold color="blue">
        지수 현황 <Text dimColor>· Esc 닫기</Text>
      </Text>
      {loading && <Text dimColor>불러오는 중…</Text>}
      {!loading && quotes.length === 0 && <Text dimColor>데이터 없음</Text>}
      {quotes.map((q) => (
        <Box key={q.symbol}>
          <Box width={14} flexShrink={0}>
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
