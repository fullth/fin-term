import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  text: string | null;
  loading: boolean;
}

export function BriefPanel({ text, loading }: Props) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text bold color="magenta">
        AI 시장 브리핑 <Text dimColor>· Esc 닫기</Text>
      </Text>
      {loading && <Text dimColor>생성 중…</Text>}
      {!loading && text && <Text>{text}</Text>}
      {!loading && !text && <Text color="red">생성 실패 (ANTHROPIC_API_KEY 확인)</Text>}
    </Box>
  );
}
