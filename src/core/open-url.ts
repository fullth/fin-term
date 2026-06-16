// URL 을 OS 기본 브라우저로 열기 + OSC8 터미널 하이퍼링크 생성.
import { spawn } from 'node:child_process';

export function openUrl(url: string): boolean {
  if (!/^https?:\/\//.test(url)) return false;
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    // ENOENT(예: 헤드리스 서버에 xdg-open 없음)는 비동기 'error' 이벤트로 오므로
    // 반드시 핸들러를 달아야 한다. 없으면 unhandled 'error' 로 프로세스가 죽는다.
    child.on('error', () => {});
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
