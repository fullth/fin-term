import React from 'react';
import { Box, Text } from 'ink';
import type { NewsItem } from '../core/types.js';
import { fmtTime } from './format.js';

interface Props {
  news: NewsItem[];
  filter: string | null;
  lang: 'en' | 'ko';
  maxRows: number;
}

// 표시 언어에 맞춰 제목 선택. ko 모드 + 영문기사 + 번역본 있으면 한글, 없으면 원문.
function displayTitle(n: NewsItem, lang: 'en' | 'ko'): string {
  if (lang === 'ko' && n.lang === 'en' && n.title_ko) return n.title_ko;
  return n.title;
}

export function NewsStream({ news, filter, lang, maxRows }: Props) {
  const filtered = filter ? news.filter((n) => n.tickers.includes(filter)) : news;
  const rows = filtered.slice(0, maxRows);

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="yellow">
          NEWS STREAM
        </Text>
        <Box>
          {filter && <Text color="cyan">filter: {filter} </Text>}
          <Text dimColor>[{lang}]</Text>
        </Box>
      </Box>
      {rows.length === 0 && <Text dimColor>no headlines{filter ? ` for ${filter}` : ''}…</Text>}
      {rows.map((n) => (
        <Box key={n.id}>
          <Text dimColor>{fmtTime(n.published_at)} </Text>
          {n.tickers.length > 0 && <Text color="green">[{n.tickers.join(',')}] </Text>}
          {n.tickers.length === 0 && <Text color="gray">[MKT] </Text>}
          <Text wrap="truncate-end">{displayTitle(n, lang)}</Text>
          <Text dimColor> ({n.source})</Text>
        </Box>
      ))}
    </Box>
  );
}
