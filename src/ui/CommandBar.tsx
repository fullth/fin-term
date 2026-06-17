import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { isPrintable } from './format.js';

export interface Command {
  name: string;
  arg?: string;
}

interface Props {
  status: string;
  hint: string; // 비편집 모드 우측 안내 (focus 따라 App 이 결정)
  onCommand: (cmd: Command) => void;
  onQuit: () => void;
  onMove: (dir: 1 | -1) => void; // ↑↓: 포커스된 패널 커서 이동
  onTab: () => void; // Tab: 패널 포커스 전환
  onEnter: () => void; // Enter: 포커스 패널 기본 동작 (뉴스 열기 / 검색결과 추가)
  onEscape: () => void; // Esc: 검색 패널 닫기 등
  onRefresh: () => void; // r: 시세·뉴스 즉시 갱신
  onHelp: () => void; // ?: 단축키 도움말 모달 열기
  onMode: () => void; // m: 주식↔코인 모드 토글
  onHorizontal: (dir: 1 | -1) => void; // ←→: 코인 모드 차트 기간 전환
  inputActive: boolean; // 검색 입력바 포커스 중이면 글자 단축키(q/r/jk)를 SearchBar 에 양보
}

// 콜론 명령: :add SYM  :rm SYM  :news SYM  :news(clear)  :q
function parse(input: string): Command | null {
  const raw = input.replace(/^:/, '').trim();
  if (!raw) return null;
  const [name, ...rest] = raw.split(/\s+/);
  return { name: name.toLowerCase(), arg: rest.join(' ') || undefined };
}

export function CommandBar({
  status,
  hint,
  onCommand,
  onQuit,
  onMove,
  onTab,
  onEnter,
  onEscape,
  onRefresh,
  onHelp,
  onMode,
  onHorizontal,
  inputActive,
}: Props) {
  const [buffer, setBuffer] = useState('');
  const [editing, setEditing] = useState(false);

  useInput((input, key) => {
    if (editing) {
      if (key.return) {
        const cmd = parse(buffer);
        if (cmd) {
          if (cmd.name === 'q' || cmd.name === 'quit') onQuit();
          else onCommand(cmd);
        }
        setBuffer('');
        setEditing(false);
      } else if (key.escape) {
        setBuffer('');
        setEditing(false);
      } else if (key.backspace || key.delete) {
        setBuffer((b) => b.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && isPrintable(input)) {
        setBuffer((b) => b + input);
      }
      return;
    }

    // 검색 입력바 포커스 중에는 Tab(포커스 전환)만 처리하고
    // 나머지(글자 단축키 q/r/j/k, 콜론 명령)는 SearchBar 가 타이핑으로 받게 양보.
    if (inputActive) {
      if (key.tab) onTab();
      return;
    }

    // 비편집 모드 단축키
    if (input === ':' || input === '/') {
      // ':' = 일반 명령, '/' = 빠른 검색 (:search 프리필)
      setEditing(true);
      setBuffer(input === '/' ? ':search ' : ':');
    } else if (key.tab) {
      onTab();
    } else if (key.return) {
      onEnter();
    } else if (key.escape) {
      onEscape();
    } else if (input === 'q') {
      onQuit();
    } else if (input === 'r') {
      onRefresh();
    } else if (input === '?') {
      onHelp();
    } else if (input === 'm') {
      onMode();
    } else if (key.downArrow || input === 'j') {
      onMove(1);
    } else if (key.upArrow || input === 'k') {
      onMove(-1);
    } else if (key.rightArrow || input === 'l') {
      onHorizontal(1);
    } else if (key.leftArrow || input === 'h') {
      onHorizontal(-1);
    }
  });

  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text>
        {editing ? (
          <Text color="cyan">{buffer}█</Text>
        ) : (
          <Text dimColor>
            {status} · {hint}
          </Text>
        )}
      </Text>
    </Box>
  );
}
