import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface Command {
  name: string;
  arg?: string;
}

interface Props {
  status: string;
  onCommand: (cmd: Command) => void;
  onQuit: () => void;
  onSelectNext: (dir: 1 | -1) => void;
}

// 콜론 명령: :add SYM  :rm SYM  :news SYM  :news(clear)  :q
function parse(input: string): Command | null {
  const raw = input.replace(/^:/, '').trim();
  if (!raw) return null;
  const [name, ...rest] = raw.split(/\s+/);
  return { name: name.toLowerCase(), arg: rest.join(' ') || undefined };
}

export function CommandBar({ status, onCommand, onQuit, onSelectNext }: Props) {
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
      } else if (input && !key.ctrl && !key.meta) {
        setBuffer((b) => b + input);
      }
      return;
    }

    // 비편집 모드 단축키
    if (input === ':') {
      setEditing(true);
      setBuffer(':');
    } else if (input === 'q') {
      onQuit();
    } else if (key.downArrow || input === 'j') {
      onSelectNext(1);
    } else if (key.upArrow || input === 'k') {
      onSelectNext(-1);
    }
  });

  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text>
        {editing ? (
          <Text color="cyan">{buffer}█</Text>
        ) : (
          <Text dimColor>
            {status} · <Text color="yellow">:</Text>add :rm :news :lang :q · ↑↓ select
          </Text>
        )}
      </Text>
    </Box>
  );
}
