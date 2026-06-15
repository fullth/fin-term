import React from 'react';
import { Box, Text } from 'ink';
import type { JournalEntry } from '../core/journal.js';
import type { QuoteMap } from '../core/types.js';
import { fmtPriceCompact, fmtTime } from './format.js';

interface Props {
  entries: JournalEntry[];
  quotes: QuoteMap; // 현재가 비교용
}

// 예측이 맞았는지 판정: 현재가 vs 예측 당시가 + 방향.
function verdict(e: JournalEntry, current: number | null): { label: string; color: string } {
  if (e.price_at == null || current == null) return { label: '판정불가', color: 'gray' };
  const moved = current - e.price_at;
  const correct = e.direction === 'up' ? moved > 0 : moved < 0;
  if (Math.abs(moved) < e.price_at * 0.001) return { label: '보합', color: 'gray' };
  return correct ? { label: '적중', color: 'green' } : { label: '빗나감', color: 'red' };
}

export function JournalPanel({ entries, quotes }: Props) {
  const sorted = [...entries].sort((a, b) => b.created_at - a.created_at);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        예측 일지 <Text dimColor>· Esc 닫기 · :predict SYM up|down 근거</Text>
      </Text>
      {sorted.length === 0 && <Text dimColor>예측 없음 — :predict AAPL up 실적호조</Text>}
      {sorted.slice(0, 12).map((e) => {
        const cur = quotes[e.symbol]?.price ?? null;
        const v = verdict(e, cur);
        return (
          <Box key={e.id} flexDirection="column">
            <Box>
              <Text dimColor>{fmtTime(e.created_at)} </Text>
              <Text bold>{e.symbol} </Text>
              <Text color={e.direction === 'up' ? 'green' : 'red'}>
                {e.direction === 'up' ? '▲예측' : '▼예측'}{' '}
              </Text>
              <Text dimColor>
                {fmtPriceCompact(e.price_at)} → {fmtPriceCompact(cur)}{' '}
              </Text>
              <Text color={v.color}>[{v.label}]</Text>
            </Box>
            <Box marginLeft={6}>
              <Text dimColor wrap="truncate-end">
                {e.reason}
                {e.feedback ? ` · AI: ${e.feedback}` : ''}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
