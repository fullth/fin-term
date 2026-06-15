// 뉴스 제목에서 watchlist ticker 매칭. 회사명 별칭도 일부 인식.

const ALIASES: Record<string, string[]> = {
  AAPL: ['apple'],
  TSLA: ['tesla'],
  NVDA: ['nvidia'],
  MSFT: ['microsoft'],
  GOOGL: ['google', 'alphabet'],
  AMZN: ['amazon'],
  META: ['meta', 'facebook'],
};

export function tagTickers(title: string, watchlist: string[]): string[] {
  const text = title.toLowerCase();
  const hits = new Set<string>();
  for (const sym of watchlist) {
    const upper = sym.toUpperCase();
    // 심볼 단어 경계 매칭 ($AAPL, AAPL)
    const symRe = new RegExp(`\\$?\\b${upper}\\b`);
    if (symRe.test(title.toUpperCase())) {
      hits.add(upper);
      continue;
    }
    // 회사명 별칭
    if (ALIASES[upper]?.some((alias) => text.includes(alias))) {
      hits.add(upper);
    }
  }
  return [...hits];
}
