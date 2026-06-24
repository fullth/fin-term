// Claude 기반 시장 브리핑. 관심종목 시세 + 최근 뉴스를 묶어 한국어 요약을 생성한다.
// ANTHROPIC_API_KEY 없으면 비활성(null 반환).
import Anthropic from '@anthropic-ai/sdk';
import type { NewsItem } from '../core/types.js';

export function hasBriefKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

interface BriefInput {
  news: NewsItem[];
}

function buildPrompt(input: BriefInput): string {
  // 최근 헤드라인 상위 25개만 (토큰 절약)
  const newsLines = input.news
    .slice(0, 25)
    .map((n) => `- [${n.tickers.join(',') || 'MKT'}] ${n.title} (${n.source})`)
    .join('\n');

  return [
    '아래는 최근 금융 뉴스 헤드라인이다.',
    '',
    '## 최근 뉴스',
    newsLines,
    '',
    '위 헤드라인을 바탕으로 한국어로 국내외 주식시장 정세 브리핑을 작성하라. 읽는 사람은 투자 초보자이므로 흐름과 맥락을 쉽게 풀어준다. 형식:',
    '1. 요약: 오늘 전체 시장 분위기를 세 문장 정도로',
    '2. 해외 시장: 미국 등 주요 해외 증시의 흐름과 그 배경을 한두 줄로',
    '3. 국내 시장: 코스피·코스닥 등 국내 증시의 흐름과 그 배경을 한두 줄로 (관련 뉴스 없으면 "직접 관련 뉴스 없음")',
    '4. 주요 테마: 2~3개. 각 테마는 "무슨 일이 있었는지" 한 줄, 그 아래 "왜 그런지 / 무엇을 뜻하는지" 한 줄로 풀어서',
    '5. 오늘의 키워드: 뉴스에 등장한 어려운 용어나 개념 1~2개를 한 문장으로 쉽게 설명 (없으면 생략)',
    '6. 흐름 메모: 최근 분위기가 이어지는지 바뀌는지, 초보자가 무엇을 지켜보면 좋을지 한두 줄',
    '',
    '투자 조언이나 매수/매도 권유는 하지 말 것. 사실과 흐름 요약, 개념 설명만. 전문용어는 처음 나올 때 괄호로 짧게 풀어준다.',
    '단정적 예측("오를 것이다" 등) 대신 관찰과 가능성으로 서술한다. 전체 24줄 이내.',
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
      max_tokens: 1536,
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
