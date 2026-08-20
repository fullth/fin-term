export type NewsView = 'key' | 'breaking' | 'all';

interface RankedNews {
  id: string;
  title: string;
  published_at: number;
}

const BREAKING_RE = /속보|긴급|breaking|flash/i;
const MARKET_RE = /금리|환율|달러|유가|국채|연준|fed|fomc|관세|규제|실적|급등|급락|상승|하락|인플레이션|고용|gdp|비트코인|이더리움|nasdaq|s&p|코스피|코스닥/i;

function canonicalTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s[-–—|]\s[^-–—|]{2,24}$/u, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function score(item: RankedNews, tagged: boolean): number {
  const ageHours = Math.max(0, (Date.now() - item.published_at) / 3_600_000);
  const freshness = Math.max(0, 24 - ageHours);
  return (BREAKING_RE.test(item.title) ? 100 : 0) + (MARKET_RE.test(item.title) ? 30 : 0) + (tagged ? 15 : 0) + freshness;
}

export function prepareNews<T extends RankedNews>(
  items: T[],
  view: NewsView,
  isTagged: (item: T) => boolean = () => false,
): { items: T[]; uniqueCount: number } {
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = canonicalTitle(item.title) || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ranked = [...unique].sort((a, b) => {
    const scoreDiff = score(b, isTagged(b)) - score(a, isTagged(a));
    return scoreDiff || b.published_at - a.published_at;
  });

  if (view === 'breaking') {
    return { items: ranked.filter((item) => BREAKING_RE.test(item.title)).slice(0, 50), uniqueCount: unique.length };
  }
  if (view === 'key') return { items: ranked.slice(0, 60), uniqueCount: unique.length };
  return { items: unique.sort((a, b) => b.published_at - a.published_at).slice(0, 150), uniqueCount: unique.length };
}
