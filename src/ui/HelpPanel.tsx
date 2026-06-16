import React from 'react';
import { Box, Text } from 'ink';

// 단축키 도움말 모달 (? 또는 :help). Esc 로 닫기.
// 명령은 약어 / 전체 / 설명 으로 표시. 좌우 2열로 배치.

interface Cmd {
  short: string;
  full: string;
  desc: string;
}

const COMMANDS: Cmd[] = [
  { short: ':s', full: ':search', desc: '종목 검색 (회사명/심볼)' },
  { short: ':a', full: ':add', desc: '관심종목 추가' },
  { short: ':rm', full: ':remove', desc: '관심종목 제거' },
  { short: ':n', full: ':news', desc: '종목 뉴스 필터 (인자 없으면 해제)' },
  { short: ':sc', full: ':scope', desc: '뉴스 범위 국내→해외→전체' },
  { short: ':o', full: ':open', desc: 'N번째 뉴스 열기' },
  { short: ':b', full: ':brief', desc: 'AI 시장 브리핑' },
  { short: ':e', full: ':explain', desc: '용어 풀이' },
  { short: ':h', full: ':hot', desc: '핫 종목 새로고침' },
  { short: ':i', full: ':indices', desc: '지수 새로고침' },
  { short: ':r', full: ':refresh', desc: '시세·뉴스 즉시 새로고침' },
  { short: ':q', full: ':quit', desc: '종료' },
];

const KEYS: { key: string; desc: string }[] = [
  { key: 'Tab', desc: '패널 포커스 전환 (검색칸→용어칸→WATCHLIST→NEWS)' },
  { key: '↑ ↓ / j k', desc: '포커스 패널에서 커서 이동' },
  { key: 'Enter', desc: '뉴스 열기 · 검색 결과 종목 추가' },
  { key: '/', desc: '빠른 종목 검색' },
  { key: '?', desc: '이 도움말 열기' },
  { key: 'Esc', desc: '모달·검색 닫기' },
];

function CmdRow({ c }: { c: Cmd }) {
  return (
    <Text>
      <Text color="yellow">{c.short.padEnd(4)}</Text>
      <Text dimColor>{c.full.padEnd(10)}</Text>
      <Text>{c.desc}</Text>
    </Text>
  );
}

export function HelpPanel() {
  const half = Math.ceil(COMMANDS.length / 2);
  const left = COMMANDS.slice(0, half);
  const right = COMMANDS.slice(half);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        단축키 / 명령 <Text dimColor>· Esc 닫기</Text>
      </Text>
      <Box marginTop={1}>
        <Text bold color="magenta">콜론 명령 </Text>
        <Text dimColor>(약어 · 전체 둘 다 동작)</Text>
      </Box>
      <Box>
        <Box flexDirection="column" width="50%">
          {left.map((c) => (
            <CmdRow key={c.full} c={c} />
          ))}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {right.map((c) => (
            <CmdRow key={c.full} c={c} />
          ))}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text bold color="magenta">키 조작</Text>
      </Box>
      {KEYS.map((k) => (
        <Text key={k.key}>
          <Text color="cyan">{k.key.padEnd(11)}</Text>
          <Text>{k.desc}</Text>
        </Text>
      ))}
    </Box>
  );
}
