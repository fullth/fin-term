import React from 'react';
import { Box, Text } from 'ink';
import type { NewsItem } from '../core/types.js';
import { fmtTime } from './format.js';
import { hyperlink } from '../core/open-url.js';

interface Props {
  visible: NewsItem[]; // App 에서 filter+slice 적용해 넘긴 화면 표시 목록
  filter: string | null;
  lang: 'en' | 'ko';
}

// 표시 언어에 맞춰 제목 선택. ko 모드 + 영문기사 + 번역본 있으면 한글, 없으면 원문.
function displayTitle(n: NewsItem, lang: 'en' | 'ko'): string {
  if (lang === 'ko' && n.lang === 'en' && n.title_ko) return n.title_ko;
  return n.title;
}

export function NewsStream({ visible, filter, lang }: Props) {
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="yellow">
          NEWS STREAM
        </Text>
        <Box>
          {filter && <Text color="cyan">filter: {filter} </Text>}
          <Text dimColor>[{lang}] · 클릭 또는 :open N</Text>
        </Box>
      </Box>
      {visible.length === 0 && <Text dimColor>no headlines{filter ? ` for ${filter}` : ''}…</Text>}
      {visible.map((n, i) => {
        const title = displayTitle(n, lang);
        return (
          <Box key={n.id}>
            <Text dimColor>{String(i + 1).padStart(2, ' ')} </Text>
            <Text dimColor>{fmtTime(n.published_at)} </Text>
            {n.tickers.length > 0 ? (
              <Text color="green">[{n.tickers.join(',')}] </Text>
            ) : (
              <Text color="gray">[MKT] </Text>
            )}
            {/* OSC8 하이퍼링크: 지원 터미널이면 클릭 가능, 아니면 평문 */}
            <Text wrap="truncate-end">{hyperlink(n.url, title)}</Text>
            <Text dimColor> ({n.source})</Text>
          </Box>
        );
      })}
    </Box>
  );
}
