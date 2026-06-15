import React from 'react';
import { Box, Text } from 'ink';
import type { HotItem } from '../sources/hot.js';
import { fmtPriceCompact, fmtPct, arrow, changeColor } from './format.js';

interface Props {
  items: HotItem[];
  loading: boolean;
}

export function HotPanel({ items, loading }: Props) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1}>
      <Text bold color="red">
        🔥 핫 종목 (거래량 급등) <Text dimColor>· Esc 닫기 · :add 로 관심종목 추가</Text>
      </Text>
      {loading && <Text dimColor>불러오는 중…</Text>}
      {!loading && items.length === 0 && <Text dimColor>데이터 없음</Text>}
      {items.map((it, i) => (
        <Box key={`${it.symbol}-${i}`}>
          <Box width={14} flexShrink={0}>
            <Text bold color="cyan">
              {String(i + 1)}. {it.symbol}
            </Text>
          </Box>
          <Box flexGrow={1} flexShrink={1} marginRight={1}>
            <Text dimColor wrap="truncate">
              {it.name}
            </Text>
          </Box>
          <Box flexShrink={0}>
            <Text color={changeColor(it.change_pct)}>
              {fmtPriceCompact(it.price)} {arrow(it.change_pct)}
              {fmtPct(it.change_pct)}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
