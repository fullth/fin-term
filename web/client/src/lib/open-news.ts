export function openNews(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      window.open(parsed.href, '_blank', 'noopener,noreferrer');
    }
  } catch {
    // 잘못된 기사 주소는 열지 않는다.
  }
}
