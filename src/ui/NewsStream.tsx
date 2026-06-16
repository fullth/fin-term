import React from 'react';
import { Box, Text } from 'ink';
import type { NewsItem, NewsScope } from '../core/types.js';
import { fmtTime } from './format.js';

interface Props {
  visible: NewsItem[]; // App 에서 윈도우 슬라이스해 넘긴 화면 표시 목록
  filter: string | null;
  scope: NewsScope; // 뉴스 범위 (domestic/foreign/all)
  focused: boolean; // NEWS 패널 포커스 여부 (Tab)
  cursor: number; // 윈도우 내 선택 행 인덱스 (전체커서 - windowStart)
  total: number; // 필터 적용된 전체 기사 수
  cursorAbs: number; // 전체 기준 현재 커서 위치 (1-based, 빈 목록 0)
  windowStart: number; // 윈도우 시작 오프셋 (행 번호를 전체 기준으로 표시)
  hasAbove: boolean; // 윈도우 위로 더 있는지
  hasBelow: boolean; // 윈도우 아래로 더 있는지
}

const SCOPE_LABEL: Record<NewsScope, string> = {
  domestic: '국내',
  foreign: '해외',
  all: '전체',
};

export function NewsStream({ visible, filter, scope, focused, cursor, total, cursorAbs, windowStart, hasAbove, hasBelow }: Props) {
  const pos = total > 0 ? `${cursorAbs}/${total}${hasAbove ? ' ▲' : ''}${hasBelow ? ' ▼' : ''}` : '0';
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
          NEWS STREAM {focused && <Text dimColor>●</Text>} <Text dimColor>[{pos}]</Text>
        </Text>
        <Box>
          {filter && <Text color="cyan">filter: {filter} </Text>}
          <Text dimColor>
            [{SCOPE_LABEL[scope]}] · {focused ? '↑↓ 스크롤 · Enter/클릭 열기' : 'Tab 또는 클릭으로 포커스'}
          </Text>
        </Box>
      </Box>
      {visible.length === 0 && <Text dimColor>no headlines{filter ? ` for ${filter}` : ''}…</Text>}
      {visible.map((n, i) => {
        const title = n.title;
        const sel = focused && i === cursor;
        const num = windowStart + i + 1; // 전체 기준 행 번호 (스크롤해도 이어짐)
        const numW = String(total).length;
        return (
          <Box key={n.id}>
            <Text color={sel ? 'cyan' : undefined} bold={sel}>
              {sel ? '▶' : ' '}
              {String(num).padStart(numW, ' ')}{' '}
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
