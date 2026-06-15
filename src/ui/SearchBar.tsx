import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  symbolFocused: boolean; // 종목 검색칸 포커스
  termFocused: boolean; // 용어 검색칸 포커스
  onSymbolSubmit: (query: string) => void;
  onTermSubmit: (term: string) => void;
}

// 상단 상시 검색바. 종목 검색칸 + 용어 풀이칸. 포커스된 칸만 타이핑을 받는다.
export function SearchBar({ symbolFocused, termFocused, onSymbolSubmit, onTermSubmit }: Props) {
  const [symbolBuf, setSymbolBuf] = useState('');
  const [termBuf, setTermBuf] = useState('');

  // 포커스된 칸에만 입력 처리. 둘 다 비포커스면 아무것도 안 함(다른 useInput 이 처리).
  useInput(
    (input, key) => {
      const focused = symbolFocused ? 'symbol' : termFocused ? 'term' : null;
      if (!focused) return;
      const buf = focused === 'symbol' ? symbolBuf : termBuf;
      const setBuf = focused === 'symbol' ? setSymbolBuf : setTermBuf;

      if (key.return) {
        const v = buf.trim();
        if (v) (focused === 'symbol' ? onSymbolSubmit : onTermSubmit)(v);
        setBuf('');
      } else if (key.backspace || key.delete) {
        setBuf((b) => b.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
        setBuf((b) => b + input);
      }
    },
    { isActive: symbolFocused || termFocused },
  );

  return (
    <Box paddingX={1}>
      <Box
        width="50%"
        borderStyle="round"
        borderColor={symbolFocused ? 'cyan' : 'gray'}
        paddingX={1}
        marginRight={1}
      >
        <Text dimColor>종목 </Text>
        <Text color={symbolFocused ? 'cyan' : undefined}>
          {symbolBuf || (symbolFocused ? '' : '클릭/Tab 후 입력 (예: apple)')}
          {symbolFocused ? '█' : ''}
        </Text>
      </Box>
      <Box
        flexGrow={1}
        borderStyle="round"
        borderColor={termFocused ? 'green' : 'gray'}
        paddingX={1}
      >
        <Text dimColor>용어 </Text>
        <Text color={termFocused ? 'green' : undefined}>
          {termBuf || (termFocused ? '' : '클릭/Tab 후 입력 (예: PER)')}
          {termFocused ? '█' : ''}
        </Text>
      </Box>
    </Box>
  );
}
