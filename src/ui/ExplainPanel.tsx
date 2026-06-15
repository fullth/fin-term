import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  term: string;
  text: string | null;
  loading: boolean;
}

export function ExplainPanel({ term, text, loading }: Props) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
      <Text bold color="green">
        용어 풀이: {term} <Text dimColor>· Esc 닫기</Text>
      </Text>
      {loading && <Text dimColor>설명 생성 중…</Text>}
      {!loading && text && <Text>{text}</Text>}
      {!loading && !text && <Text color="red">생성 실패 (ANTHROPIC_API_KEY 확인)</Text>}
    </Box>
  );
}
