import React from 'react';
import { Box, Text } from 'ink';
import type { NewsItem, NewsScope } from '../core/types.js';
import { fmtTime } from './format.js';

interface Props {
  visible: NewsItem[]; // App 에서 filter+slice 적용해 넘긴 화면 표시 목록
  filter: string | null;
  scope: NewsScope; // 뉴스 범위 (domestic/foreign/all)
  focused: boolean; // NEWS 패널 포커스 여부 (Tab)
  cursor: number; // 포커스 시 선택 행 인덱스
}

const SCOPE_LABEL: Record<NewsScope, string> = {
  domestic: '국내',
  foreign: '해외',
  all: '전체',
};

export function NewsStream({ visible, filter, scope, focused, cursor }: Props) {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text bold color="yellow">
          NEWS STREAM {focused && <Text dimColor>●</Text>}
        </Text>
        <Box>
          {filter && <Text color="cyan">filter: {filter} </Text>}
          <Text dimColor>
            [{SCOPE_LABEL[scope]}] · {focused ? '↑↓ 이동 · Enter/클릭 열기' : 'Tab 또는 클릭으로 포커스'}
          </Text>
        </Box>
      </Box>
      {visible.length === 0 && <Text dimColor>no headlines{filter ? ` for ${filter}` : ''}…</Text>}
      {visible.map((n, i) => {
        const title = n.title;
        const sel = focused && i === cursor;
        return (
          <Box key={n.id}>
            <Text color={sel ? 'cyan' : undefined} bold={sel}>
              {sel ? '▶' : ' '}
              {String(i + 1).padStart(2, ' ')}{' '}
            </Text>
            <Text dimColor>{fmtTime(n.published_at)} </Text>
            {n.tickers.length > 0 ? (
              <Text color="green">[{n.tickers.join(',')}] </Text>
            ) : (
              <Text color="gray">[MKT] </Text>
            )}
            <Text color={sel ? 'cyan' : undefined} wrap="truncate-end">
              {title}
            </Text>
            <Text dimColor> ({n.source})</Text>
          </Box>
        );
      })}
    </Box>
  );
}
