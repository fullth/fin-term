// URL 을 OS 기본 브라우저로 열기 + OSC8 터미널 하이퍼링크 생성.
import { spawn } from 'node:child_process';

export function openUrl(url: string): boolean {
  if (!/^https?:\/\//.test(url)) return false;
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// OSC8 하이퍼링크: 지원 터미널(iTerm2/WezTerm/최신 Terminal)에서 클릭 가능.
// 미지원 터미널은 라벨만 평문 표시 (escape 무시).
const ESC = '';
const BEL = '';

export function hyperlink(url: string, label: string): string {
  if (!/^https?:\/\//.test(url)) return label;
  return `${ESC}]8;;${url}${BEL}${label}${ESC}]8;;${BEL}`;
}
