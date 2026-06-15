// Claude 기반 시장 브리핑. 관심종목 시세 + 최근 뉴스를 묶어 한국어 요약을 생성한다.
// ANTHROPIC_API_KEY 없으면 비활성(null 반환).
import Anthropic from '@anthropic-ai/sdk';
import type { Quote, NewsItem } from '../core/types.js';

export function hasBriefKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

interface BriefInput {
  watchlist: string[];
  names: Record<string, string>;
  quotes: Record<string, Quote>;
  news: NewsItem[];
}

function buildPrompt(input: BriefInput): string {
  const quoteLines = input.watchlist
    .map((sym) => {
      const q = input.quotes[sym];
      const name = input.names[sym] ?? '';
      if (!q || q.price == null) return `- ${sym} ${name}: 데이터 없음`;
      const pct = q.change_pct?.toFixed(2) ?? '?';
      return `- ${sym} ${name}: ${q.price} (${pct}%)`;
    })
    .join('\n');

  // 최근 헤드라인 상위 25개만 (토큰 절약)
  const newsLines = input.news
    .slice(0, 25)
    .map((n) => `- [${n.tickers.join(',') || 'MKT'}] ${n.title} (${n.source})`)
    .join('\n');

  return [
    '아래는 한 투자자의 관심종목 시세와 최근 금융 뉴스 헤드라인이다.',
    '',
    '## 관심종목',
    quoteLines,
    '',
    '## 최근 뉴스',
    newsLines,
    '',
    '위 정보를 바탕으로 한국어로 간결한 시장 브리핑을 작성하라. 형식:',
    '1. 한 줄 요약: 오늘 시장 분위기를 한 문장으로',
    '2. 주요 테마: 2~3개 불릿, 각 한 줄',
    '3. 내 종목 영향: 관심종목 중 뉴스와 관련된 것만 한 줄씩 (없으면 "직접 관련 뉴스 없음")',
    '',
    '투자 조언이나 매수/매도 권유는 하지 말 것. 사실과 흐름 요약만. 전체 12줄 이내.',
    '마크다운 기호(**, #, -, ` 등)를 절대 쓰지 말고 평문으로만 작성하라. 강조는 따옴표로.',
  ].join('\n');
}

// 브리핑 텍스트 반환. 키 없거나 실패 시 null.
export async function generateBrief(input: BriefInput): Promise<string | null> {
  if (!hasBriefKey()) return null;
  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: buildPrompt(input) }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || null;
  } catch {
    return null;
  }
}
