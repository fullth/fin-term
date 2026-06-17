// 데스크톱 알림. macOS 는 osascript, 그 외 플랫폼은 no-op.
import { execFile } from 'node:child_process';
import { platform } from 'node:os';

const isMac = platform() === 'darwin';

export function notify(title: string, subtitle: string, message: string): void {
  if (!isMac) return; // 비-mac 환경에서는 조용히 무시 (TUI 알림 로그로 대체됨)
  const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(
    title,
  )} subtitle ${JSON.stringify(subtitle)}`;
  execFile('osascript', ['-e', script], () => {});
}
