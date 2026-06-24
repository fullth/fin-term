// User-Agent 경량 파서 — 의존성 없이 정규식으로 os/device/browser 만 뽑는다.
// 완벽한 분류가 목적이 아니라 대시보드 분포 집계용이라, 주요 케이스만 커버한다.

export interface ParsedUA {
  os: string;
  device: string; // desktop | mobile | tablet | bot
  browser: string;
}

export function parseUA(ua: string | null | undefined): ParsedUA {
  const s = ua ?? '';
  return { os: detectOS(s), device: detectDevice(s), browser: detectBrowser(s) };
}

function detectOS(s: string): string {
  if (/Windows NT 10/.test(s)) return 'Windows 10/11';
  if (/Windows NT/.test(s)) return 'Windows';
  // iOS 를 macOS 보다 먼저 — iPad/iPhone UA 에 "like Mac OS X" 가 섞여 있음.
  if (/iPhone|iPad|iPod/.test(s)) return 'iOS';
  if (/Mac OS X|Macintosh/.test(s)) return 'macOS';
  if (/Android/.test(s)) return 'Android';
  if (/CrOS/.test(s)) return 'ChromeOS';
  if (/Linux/.test(s)) return 'Linux';
  return '(unknown)';
}

function detectDevice(s: string): string {
  if (/bot|crawler|spider|crawling/i.test(s)) return 'bot';
  if (/iPad|Tablet/.test(s) || (/Android/.test(s) && !/Mobile/.test(s))) return 'tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile/.test(s)) return 'mobile';
  return 'desktop';
}

function detectBrowser(s: string): string {
  // 순서 중요 — Edge/Opera/Samsung 은 UA 에 "Chrome" 도 포함하므로 먼저 판별.
  if (/Edg\//.test(s)) return 'Edge';
  if (/OPR\/|Opera/.test(s)) return 'Opera';
  if (/SamsungBrowser/.test(s)) return 'Samsung Internet';
  if (/Whale/.test(s)) return 'Whale';
  if (/Firefox\//.test(s)) return 'Firefox';
  if (/CriOS/.test(s)) return 'Chrome'; // iOS Chrome
  if (/Chrome\//.test(s)) return 'Chrome';
  // Safari 는 Chrome 계열을 모두 거른 뒤 마지막에.
  if (/Safari\//.test(s)) return 'Safari';
  return '(unknown)';
}
