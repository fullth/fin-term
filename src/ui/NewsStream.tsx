import React from 'react';
import { Box, Text } from 'ink';
import type { NewsItem } from '../core/types.js';
import { fmtTime } from './format.js';

interface Props {
  news: NewsItem[];
  filter: string | null;
  maxRows: number;
}

export function NewsStream({ news, filter, maxRows }: Props) {
  const filtered = filter ? news.filter((n) => n.tickers.includes(filter)) : news;
  const rows = filtered.slice(0, maxRows);

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="yellow">
          NEWS STREAM
        </Text>
        {filter && <Text color="cyan">filter: {filter}</Text>}
      </Box>
      {rows.length === 0 && <Text dimColor>no headlines{filter ? ` for ${filter}` : ''}…</Text>}
      {rows.map((n) => (
        <Box key={n.id}>
          <Text dimColor>{fmtTime(n.published_at)} </Text>
          {n.tickers.length > 0 && <Text color="green">[{n.tickers.join(',')}] </Text>}
          {n.tickers.length === 0 && <Text color="gray">[MKT] </Text>}
          <Text wrap="truncate-end">{n.title}</Text>
          <Text dimColor> ({n.source})</Text>
        </Box>
      ))}
    </Box>
  );
}
