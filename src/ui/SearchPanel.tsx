import React from 'react';
import { Box, Text } from 'ink';
import type { SearchResult } from '../sources/search.js';

interface Props {
  query: string;
  results: SearchResult[];
  cursor: number;
  focused: boolean;
}

export function SearchPanel({ query, results, cursor, focused }: Props) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Text bold color="yellow">
        SEARCH “{query}” <Text dimColor>· ↑↓ 선택 · Enter 추가 · Esc 닫기</Text>
      </Text>
      {results.length === 0 && <Text dimColor>결과 없음</Text>}
      {results.map((r, i) => {
        const sel = i === cursor;
        return (
          <Box key={`${r.symbol}-${i}`}>
            <Text color={sel ? 'cyan' : undefined} bold={sel}>
              {sel ? '▶ ' : '  '}
              {r.symbol.padEnd(10)}
            </Text>
            <Text color={sel ? 'cyan' : undefined} wrap="truncate-end">
              {r.name}
            </Text>
            <Text dimColor>
              {' '}
              ({r.type}
              {r.exchange ? `·${r.exchange}` : ''})
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
