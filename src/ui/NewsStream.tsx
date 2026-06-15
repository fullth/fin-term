import React from 'react';
import { Box, Text } from 'ink';
import type { NewsItem } from '../core/types.js';
import { fmtTime } from './format.js';

interface Props {
  visible: NewsItem[]; // App 에서 filter+slice 적용해 넘긴 화면 표시 목록
  filter: string | null;
  lang: 'en' | 'ko';
  focused: boolean; // NEWS 패널 포커스 여부 (Tab)
  cursor: number; // 포커스 시 선택 행 인덱스
}

// 표시 언어에 맞춰 제목 선택. ko 모드 + 영문기사 + 번역본 있으면 한글, 없으면 원문.
function displayTitle(n: NewsItem, lang: 'en' | 'ko'): string {
  if (lang === 'ko' && n.lang === 'en' && n.title_ko) return n.title_ko;
  return n.title;
}

export function NewsStream({ visible, filter, lang, focused, cursor }: Props) {
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
            [{lang}] · {focused ? '↑↓ 이동 · Enter/클릭 열기' : 'Tab 또는 클릭으로 포커스'}
          </Text>
        </Box>
      </Box>
      {visible.length === 0 && <Text dimColor>no headlines{filter ? ` for ${filter}` : ''}…</Text>}
      {visible.map((n, i) => {
        const title = displayTitle(n, lang);
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
